import http from 'http';
import net from 'net';
import type { Duplex } from 'stream';
import { env } from '../config/env';
import { proxyPool } from './proxyPool';

/* -------------------------------------------------------------------------- */
/* What this is                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A forward proxy on 127.0.0.1 that tunnels through Cloudflare Workers.
 *
 * yt-dlp only understands standard HTTP proxies, and a Cloudflare Worker
 * cannot be one directly — so this shim sits in the middle and speaks both
 * languages. Every connection yt-dlp opens (HTTPS goes through CONNECT,
 * plain HTTP through absolute-form requests) is bridged over a WebSocket to
 * a Worker, which opens the real TCP connection to YouTube:
 *
 *   yt-dlp --(127.0.0.1:port)--> shim --(wss)--> Worker --(TCP)--> youtube.com
 *
 * The TLS session is between yt-dlp and YouTube; the shim and the Worker only
 * relay ciphertext, so neither can read the traffic.
 *
 * Failover happens at two levels:
 *   per connection  - this shim tries up to three healthy Workers before
 *                     giving up on a CONNECT, so a dead Worker costs one
 *                     connection attempt, not one download;
 *   per job         - a Worker that breaks mid-stream is reported unhealthy
 *                     to the pool, and the download loop in the routes
 *                     retries on the next route while yt-dlp's .part file
 *                     makes it resume where it stopped.
 */

/** Refuse to open a tunnel to these ports regardless of what the client asks. */
const BLOCKED_PORTS = new Set([25, 445, 3389]);

const HANDSHAKE_TIMEOUT_MS = 12_000;
/** Worker send buffer above which the client socket is paused (bytes). */
const WS_BUFFER_HIGH = 4_000_000;
const WS_BUFFER_LOW = 1_000_000;

let server: http.Server | null = null;
let listeningPort = 0;

/** The `--proxy` value for yt-dlp while the shim is up, else null. */
export function shimProxyUrl(): string | null {
  return server ? `http://127.0.0.1:${listeningPort}` : null;
}

/**
 * Starts the shim. Never throws: if it cannot listen, the pool simply skips
 * the Cloudflare route and downloads fall back to upstream proxies or direct
 * egress, which is strictly better than refusing to boot.
 */
export function startProxyShim(): void {
  if (server) return;

  const srv = http.createServer();
  server = srv;

  srv.on('clientError', (_err, socket) => {
    try { socket.destroy(); } catch { /* already gone */ }
  });

  // HTTPS (the overwhelmingly common case): yt-dlp sends CONNECT host:port.
  srv.on('connect', (req, clientSocket, head) => {
    const target = parseHostPort(req.url || '');
    if (!target) {
      clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      clientSocket.destroy();
      return;
    }

    establish(target.host, target.port)
      .then(({ ws, workerUrl }) => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head && head.length) relayToWorker(ws, head);
        bridge(ws, clientSocket, workerUrl);
      })
      .catch(err => {
        console.warn(`[cf-shim] CONNECT ${target.host}:${target.port} failed: ${err.message}`);
        clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        clientSocket.destroy();
      });
  });

  // Plain HTTP: yt-dlp sends the full absolute URL as the request target.
  srv.on('request', (req, res) => {
    const rawTarget = req.url || '';
    if (!/^https?:\/\//i.test(rawTarget)) {
      // Someone hit the shim directly instead of using it as a proxy.
      res.writeHead(405, { 'content-type': 'text/plain' });
      res.end('this port is a forward proxy, not a web server');
      return;
    }

    let target: URL;
    try {
      target = new URL(rawTarget);
    } catch {
      res.writeHead(400);
      res.destroy();
      return;
    }
    const port = Number(target.port) || (target.protocol === 'https:' ? 443 : 80);

    establish(target.hostname, port)
      .then(({ ws, workerUrl }) => {
        // Bypass the http.ServerResponse API and write raw bytes, because the
        // far end speaks the origin server's wire protocol, not a parsed one.
        const socket = res.socket as net.Socket | null;
        if (!socket) return;

        const headers: string[] = [
          `${req.method} ${target.pathname}${target.search} HTTP/1.1`,
          `Host: ${target.host}`,
        ];
        for (const [name, value] of Object.entries(req.headers)) {
          const lower = name.toLowerCase();
          if (['host', 'connection', 'proxy-connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(lower)) continue;
          if (Array.isArray(value)) value.forEach(v => headers.push(`${name}: ${v}`));
          else if (value !== undefined) headers.push(`${name}: ${value}`);
        }
        headers.push('Connection: close', '');
        relayToWorker(ws, headers.join('\r\n') + '\r\n');

        req.on('data', chunk => relayToWorker(ws, chunk));
        req.on('end', () => { /* requests have no body in practice; nothing to half-close */ });

        ws.addEventListener('message', (event: any) => {
          const chunk = event.data instanceof ArrayBuffer ? Buffer.from(event.data) : Buffer.from(String(event.data), 'utf8');
          if (!socket.destroyed) socket.write(chunk);
        });

        bridgeCore(ws, socket, workerUrl, { killSocketOnError: true });
      })
      .catch(err => {
        console.warn(`[cf-shim] ${req.method} ${target.hostname} failed: ${err.message}`);
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
  });

  // Port 0 lets the OS pick a free one; CF_SHIM_PORT pins it for debugging.
  srv.listen(env.youtube.shimPort || 0, '127.0.0.1', () => {
    const address = srv.address();
    listeningPort = typeof address === 'object' && address ? address.port : 0;
    proxyPool.setShimUrl(shimProxyUrl());
    console.log(`[cf-shim] cloudflare proxy shim listening on 127.0.0.1:${listeningPort} `
      + `(${proxyPool.workerUrls().length} worker URL(s))`);
  });
  srv.on('error', err => {
    console.error(`[cf-shim] shim failed, cloudflare egress disabled: ${err.message}`);
    proxyPool.setShimUrl(null);
    server = null;
  });
}

/* -------------------------------------------------------------------------- */
/* Worker tunnels                                                             */
/* -------------------------------------------------------------------------- */

function parseHostPort(url: string): { host: string; port: number } | null {
  const idx = url.lastIndexOf(':');
  if (idx === -1) return null;
  const host = url.slice(0, idx).replace(/^\[|\]$/g, '');
  const port = Number(url.slice(idx + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (BLOCKED_PORTS.has(port)) return null;
  return { host, port };
}

/**
 * Opens a WebSocket tunnel to `host:port`, trying up to three healthy Workers
 * in the pool's preferred order. Each Worker that fails to establish is
 * reported to the pool, so the next CONNECT does not even try it.
 */
async function establish(host: string, port: number): Promise<{ ws: WebSocket; workerUrl: string }> {
  const workers = proxyPool.workerUrls();
  if (!workers.length) throw new Error('no cloudflare worker URLs configured');

  const errors: string[] = [];
  for (const workerUrl of workers.slice(0, 3)) {
    try {
      const ws = await connectViaWorker(workerUrl, host, port);
      proxyPool.reportSuccess('shim');
      return { ws, workerUrl };
    } catch (err) {
      errors.push(`${workerUrl}: ${(err as Error).message}`);
      // The tunnel never carried traffic, so this is a Worker availability
      // problem, not YouTube blocking — still worth a cooldown either way.
      proxyPool.reportFailure('shim', `worker tunnel failed: ${(err as Error).message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

function connectViaWorker(workerUrl: string, host: string, port: number): Promise<WebSocket> {
  const wsUrl = `${workerUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/tunnel`
    + `?token=${encodeURIComponent(env.youtube.cfProxyToken)}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* never opened */ }
      reject(new Error('tunnel handshake timed out'));
    }, HANDSHAKE_TIMEOUT_MS);

    const bail = (message: string) => {
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      reject(new Error(message));
    };

    ws.onerror = () => { if (timer) bail('tunnel websocket error'); };
    ws.onclose = () => bail('tunnel closed before it was ready');

    ws.onopen = () => {
      ws.send(JSON.stringify({ host, port }));
    };

    ws.onmessage = (event: any) => {
      clearTimeout(timer);
      const text = event.data instanceof ArrayBuffer ? Buffer.from(event.data).toString('utf8') : String(event.data);
      if (text === 'ok') {
        ws.onclose = null;
        ws.onerror = null;
        resolve(ws);
      } else {
        bail(text.startsWith('err:') ? text.slice(4) : 'unexpected tunnel reply');
      }
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Bridging                                                                   */
/* -------------------------------------------------------------------------- */

/** Queues a chunk for the Worker, dropping both if either side already died. */
function relayToWorker(ws: WebSocket, chunk: Buffer | string): void {
  if (ws.readyState === 1) ws.send(toWire(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8')));
}

/** WebSocket.send wants ArrayBuffer; Node Buffers are ArrayBufferLike. */
function toWire(chunk: Buffer): ArrayBuffer {
  return chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;
}

/**
 * Wires both directions for an established tunnel and handles teardown.
 * Kept separate from the HTTP-request branch above, which adds raw-response
 * handling on top of the same core.
 */
function bridge(ws: WebSocket, clientSocket: Duplex, workerUrl: string): void {
  if (clientSocket.readable) {
    clientSocket.on('data', (chunk: Buffer) => {
      if (ws.readyState !== 1) return;
      ws.send(toWire(chunk));
      // Client -> Worker backpressure: WebSocket.send buffers without bound,
      // so stop reading from yt-dlp until the Worker has drained.
      if (ws.bufferedAmount > WS_BUFFER_HIGH) {
        clientSocket.pause();
        const resume = setInterval(() => {
          if (ws.bufferedAmount < WS_BUFFER_LOW || ws.readyState !== 1) {
            clearInterval(resume);
            if (!clientSocket.destroyed) clientSocket.resume();
          }
        }, 20);
        resume.unref();
      }
    });
  }

  bridgeCore(ws, clientSocket, workerUrl, { killSocketOnError: true });
}

/**
 * Worker -> client direction plus teardown for both cases.
 *
 * `workerDiedFirst` distinguishes the failure that matters: when the tunnel
 * breaks while yt-dlp is still sending, the Worker (or the path to it) is the
 * problem, so it is marked unhealthy and the download loop above will rotate
 * to another Worker on its next attempt. When the client closes first, that
 * is just yt-dlp finishing a connection.
 */
function bridgeCore(
  ws: WebSocket,
  clientSocket: Duplex,
  workerUrl: string,
  _opts: { killSocketOnError: boolean }
): void {
  let clientClosed = false;
  let workerClosed = false;

  const onMessage = (event: any) => {
    if (clientSocket.destroyed) return;
    const chunk = event.data instanceof ArrayBuffer ? Buffer.from(event.data) : Buffer.from(String(event.data), 'utf8');
    clientSocket.write(chunk);
  };  ws.addEventListener('message', onMessage);

  const teardown = () => {
    ws.removeEventListener('message', onMessage);
    try { if (!clientSocket.destroyed) clientSocket.destroy(); } catch { /* already gone */ }
  };

  clientSocket.on('close', () => {
    clientClosed = true;
    try { if (ws.readyState === 1) ws.close(); } catch { /* already closed */ }
  });
  clientSocket.on('error', () => {
    clientClosed = true;
    try { if (ws.readyState === 1) ws.close(); } catch { /* already closed */ }
  });

  ws.addEventListener('close', () => {
    workerClosed = true;
    if (!clientClosed) {
      console.warn(`[cf-shim] tunnel broke mid-stream (${shortUrl(workerUrl)}), client told to retry`);
      proxyPool.reportFailure('shim', `tunnel broke mid-stream to ${shortUrl(workerUrl)}`);
    }
    teardown();
  });
  ws.addEventListener('error', () => {
    if (!workerClosed && !clientClosed) {
      proxyPool.reportFailure('shim', `tunnel error to ${shortUrl(workerUrl)}`);
    }
    workerClosed = true;
    teardown();
  });
}

function shortUrl(url: string): string {
  try { return new URL(url).host; } catch { return url.slice(0, 40); }
}
