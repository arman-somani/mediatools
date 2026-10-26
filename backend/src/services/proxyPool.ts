import { env } from '../config/env';

/* -------------------------------------------------------------------------- */
/* Model                                                                      */
/* -------------------------------------------------------------------------- */

export type RouteKind = 'shim' | 'upstream' | 'direct';

export interface EgressRoute {
  id: string;
  kind: RouteKind;
  /** Human-readable tag for logs and the health endpoint. */
  label: string;
  /**
   * Value handed to yt-dlp as `--proxy`. For the shim route this is the local
   * 127.0.0.1 proxy URL, resolved lazily because the shim starts after this
   * module is imported. `null` means direct egress (no --proxy at all).
   */
  getProxyArg(): string | null;
  /** For shim routes only: one entry per Cloudflare Worker URL. */
  workerUrls?: string[];
}

interface HealthState {
  fails: number;
  cooldownUntil: number;
  lastSuccessAt: number;
  lastError: string;
}

/**
 * The egress pool.
 *
 * YouTube enforces bot checks and rate limits per source IP, so the answer to
 * "this IP stopped working" is not a retry — it is a different IP. The pool
 * holds every way the backend can reach YouTube:
 *
 *   shim      - the local 127.0.0.1 proxy that tunnels through Cloudflare
 *               Workers (one route even with several Worker URLs; the shim
 *               rotates workers per connection itself)
 *   upstream  - a plain HTTP/SOCKS proxy from PROXY_URL / YT_PROXY_URLS
 *   direct    - the server's own address, kept as the last rung so a totally
 *               misconfigured pool degrades to the old behaviour
 *
 * Ordering prefers whichever route last succeeded, then round-robins the
 * healthy rest, then the cooling-down ones, then direct. A route that failed
 * is put on an exponential cooldown (3 min doubling to a 30 min cap), so a
 * worker that YouTube has blocked is not retried on every single job.
 */
class ProxyPool {
  private routes: EgressRoute[] = [];
  private health = new Map<string, HealthState>();
  private rr = 0;
  /** Set by cfProxyShim once the local proxy is listening. */
  private shimUrl: string | null = null;

  constructor() {
    if (env.youtube.cfProxyUrls.length) {
      this.routes.push({
        id: 'shim',
        kind: 'shim',
        label: `cloudflare-worker x${env.youtube.cfProxyUrls.length}`,
        workerUrls: env.youtube.cfProxyUrls,
        getProxyArg: () => this.shimUrl,
      });
    }

    const upstreams = [
      ...env.youtube.proxyUrl ? [env.youtube.proxyUrl] : [],
      ...env.youtube.extraProxyUrls,
    ];
    upstreams.forEach((url, i) => {
      this.routes.push({
        id: `upstream-${i}`,
        kind: 'upstream',
        label: url.replace(/\/\/[^@]*@/, '//***@'), // never log credentials
        getProxyArg: () => url,
      });
    });

    this.routes.push({
      id: 'direct',
      kind: 'direct',
      label: 'direct (server IP)',
      getProxyArg: () => null,
    });

    for (const route of this.routes) {
      this.health.set(route.id, { fails: 0, cooldownUntil: 0, lastSuccessAt: 0, lastError: '' });
    }
  }

  /** Called by the shim once it is listening. */
  setShimUrl(url: string | null): void {
    this.shimUrl = url;
  }

  getShimUrl(): string | null {
    return this.shimUrl;
  }

  /** The shim is only usable once it is actually listening. */
  private isAvailable(route: EgressRoute): boolean {
    if (route.kind === 'shim') return this.shimUrl !== null;
    return true;
  }

  /**
   * Routes in the order they should be attempted.
   *
   * Healthy routes first — most recently successful on top, so a working
   * Cloudflare worker keeps serving every request until it stops working —
   * then cooling-down routes (they may have recovered), with direct egress
   * always last.
   */
  candidates(): EgressRoute[] {
    const now = Date.now();
    const usable = this.routes.filter(r => this.isAvailable(r));
    const healthy = usable.filter(r => (this.health.get(r.id)!.cooldownUntil) <= now);
    const cooling = usable.filter(r => (this.health.get(r.id)!.cooldownUntil) > now);

    // Round-robin evens out ties among routes that have never succeeded.
    this.rr = (this.rr + 1) % Math.max(healthy.length, 1);
    const rotate = <T,>(arr: T[]): T[] =>
      arr.length ? [...arr.slice(this.rr % arr.length), ...arr.slice(0, this.rr % arr.length)] : arr;

    return [
      ...rotate(healthy).sort((a, b) => this.health.get(b.id)!.lastSuccessAt - this.health.get(a.id)!.lastSuccessAt),
      ...rotate(cooling),
    ];
  }

  /** Cloudflare Worker URLs, healthiest first — the shim's failover order. */
  workerUrls(): string[] {
    const shim = this.routes.find(r => r.kind === 'shim');
    return shim?.workerUrls ?? [];
  }

  reportSuccess(routeId: string): void {
    const state = this.health.get(routeId);
    if (state) {
      state.fails = 0;
      state.cooldownUntil = 0;
      state.lastError = '';
      state.lastSuccessAt = Date.now();
    }
  }

  reportFailure(routeId: string, error: string): void {
    const state = this.health.get(routeId);
    if (!state) return;
    state.fails += 1;
    state.lastError = error.slice(0, 200);
    // 3 min, doubling, capped at 30 min. Long enough that a genuinely blocked
    // worker is skipped by every job in the window, short enough that it comes
    // back on its own once YouTube's throttle expires.
    state.cooldownUntil = Date.now() + Math.min(3 * 60_000 * 2 ** (state.fails - 1), 30 * 60_000);
  }

  /** Snapshot for /api/health/ready. */
  status(): Array<{
    id: string; kind: RouteKind; label: string; healthy: boolean;
    fails: number; cooldownSecondsLeft: number; lastSuccessAgoSeconds: number | null; lastError: string;
  }> {
    const now = Date.now();
    return this.routes.map(r => {
      const h = this.health.get(r.id)!;
      return {
        id: r.id,
        kind: r.kind,
        label: r.label,
        healthy: this.isAvailable(r) && h.cooldownUntil <= now,
        fails: h.fails,
        cooldownSecondsLeft: Math.max(0, Math.ceil((h.cooldownUntil - now) / 1000)),
        lastSuccessAgoSeconds: h.lastSuccessAt ? Math.round((now - h.lastSuccessAt) / 1000) : null,
        lastError: h.lastError,
      };
    });
  }
}

export const proxyPool = new ProxyPool();

/**
 * Failure codes that say "this egress route is the problem". A private video
 * is private from every IP on earth, but a bot check, a rate limit, a geo
 * block or a mid-download 403 are properties of the IP that made the request,
 * and the correct response is to mark the route unhealthy and rotate.
 */
export const IP_RELATED_CODES = new Set([
  'BOT_CHECK',
  'RATE_LIMITED',
  'IP_BLOCKED',
  'GEO_BLOCKED',
  'NETWORK',
  'TIMEOUT',
  // Generic unknown failures: a proxy that 502s every request also surfaces
  // as UNKNOWN, so rotate and let the next route try rather than give up.
  'UNKNOWN',
]);
