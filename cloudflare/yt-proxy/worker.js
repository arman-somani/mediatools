/**
 * MediaTools YouTube egress proxy (Cloudflare Worker).
 *
 * The backend's proxy shim opens a WebSocket to this Worker and asks it to
 * open a raw TCP connection to a target host:port. From then on the Worker
 * shuffles raw bytes both directions, so the TLS session between yt-dlp and
 * YouTube stays end-to-end:
 *
 *   yt-dlp --(HTTP CONNECT)--> shim --(WebSocket)--> Worker --(TCP)--> YouTube
 *
 * Every connection the Worker opens egresses from Cloudflare's network, not
 * from the Render datacenter IP that YouTube rate-limits. Deploy this Worker
 * several times (different names = different workers.dev subdomains) and list
 * all the URLs in the backend's CF_PROXY_URLS to get a fallback pool.
 *
 * Security: every request must carry the shared secret as ?token=... or an
 * x-proxy-token header. Set it with:
 *   wrangler secret put PROXY_TOKEN
 * and put the same value in the backend's CF_PROXY_TOKEN.
 */

import { connect } from 'cloudflare:sockets';

/** Worker has no wall-clock concern, but a dead socket must not pin the pair. */
const CONNECT_TIMEOUT_MS = 10_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const token =
      url.searchParams.get('token') ||
      request.headers.get('x-proxy-token') ||
      request.headers.get('sec-websocket-protocol');

    if (env.PROXY_TOKEN && token !== env.PROXY_TOKEN) {
      return new Response('forbidden', { status: 403 });
    }

    if (url.pathname === '/ping') {
      return new Response('pong', { status: 200 });
    }

    // Raw TCP tunnel used by the backend shim (and anything else that speaks
    // the same protocol).
    if (url.pathname === '/tunnel') {
      if ((request.headers.get('upgrade') || '').toLowerCase() !== 'websocket') {
        return new Response('websocket upgrade required', { status: 426 });
      }
      return handleTunnel(request, env);
    }

    // Plain HTTP forward, mainly for testing the Worker without the shim:
    //   GET /?url=https%3A%2F%2Fwww.youtube.com%2F...
    // Streams the response through untouched, Range header included, so it
    // also works for googlevideo URLs during manual debugging.
    const target = url.searchParams.get('url');
    if (target) {
      return forward(target, request);
    }

    return new Response('MediaTools proxy. See /ping.', { status: 200 });
  },
};

/**
 * WebSocket <-> TCP pipe.
 *
 * Protocol: the client's FIRST message must be {"host": "...", "port": N}.
 * The Worker replies with the literal text "ok" once the TCP connection is
 * established, or "err:<reason>" before closing. After that the channel is
 * opaque binary in both directions.
 */
function handleTunnel(request, env) {
  const pair = new WebSocketPair();
  const server = pair.server;
  server.accept();

  let tcp = null;
  let bridged = false;

  server.addEventListener('message', async (event) => {
    if (bridged) return;
    bridged = true;

    let host, port;
    try {
      const text = typeof event.data === 'string'
        ? event.data
        : new TextDecoder().decode(event.data);
      const msg = JSON.parse(text);
      host = String(msg.host || '');
      port = Number(msg.port) || 443;
    } catch {
      fail(server, 'bad handshake message');
      return;
    }

    if (!host || host.length > 253 || port < 1 || port > 65535) {
      fail(server, 'bad host or port');
      return;
    }

    if (!hostAllowed(host, env)) {
      fail(server, `host ${host} is not on the allow-list`);
      return;
    }

    try {
      // Plain TCP here — the TLS handshake happens end-to-end between yt-dlp
      // and YouTube, so the Worker never sees decrypted traffic.
      tcp = connect(`${host}:${port}`, { secureTransport: 'starttls' });
      await withTimeout(tcp.opened, CONNECT_TIMEOUT_MS, 'tcp connect timed out');
      server.send('ok');
      pump(server, tcp);
    } catch (err) {
      try { tcp?.close(); } catch {}
      fail(server, (err && err.message) || 'connect failed');
    }
  });

  server.addEventListener('close', () => { try { tcp?.close(); } catch {} });
  server.addEventListener('error', () => { try { tcp?.close(); } catch {} });

  return new Response(null, { status: 101, webSocket: pair.client });
}

function fail(ws, message) {
  try { ws.send(`err:${message}`); } catch {}
  try { ws.close(); } catch {}
}

/**
 * Moves bytes both ways with crude backpressure: each side pauses reading
 * while the other side's send buffer exceeds a few MB, which keeps a large
 * googlevideo response from ballooning the isolate's heap.
 */
function pump(ws, tcp) {
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    try { ws.close(); } catch {}
    try { tcp.close(); } catch {}
  };

  // WebSocket -> TCP, serialised so writes keep their order.
  const writer = tcp.writable.getWriter();
  let draining = false;
  const queue = [];
  ws.addEventListener('message', (event) => {
    const chunk = event.data instanceof ArrayBuffer
      ? new Uint8Array(event.data)
      : new TextEncoder().encode(String(event.data));
    queue.push(chunk);
    drain();
  });
  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        await writer.write(queue.shift());
      }
    } catch {
      cleanup();
    } finally {
      draining = false;
    }
  }

  // TCP -> WebSocket.
  (async () => {
    const reader = tcp.readable.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || ws.readyState !== 1) break;
        ws.send(value);
        while (ws.bufferedAmount > 4_000_000 && ws.readyState === 1) {
          await new Promise((r) => setTimeout(r, 10));
        }
      }
    } catch {
      // Socket reset by the target; the client side sees the close.
    }
    cleanup();
  })();

  ws.addEventListener('close', cleanup);
  ws.addEventListener('error', cleanup);
  try {
    tcp.closed.then(cleanup).catch(cleanup);
  } catch {}
}

/**
 * Optional host allow-list. Set PROXY_ALLOW_HOSTS to a comma-separated list of
 * domain suffixes (e.g. "youtube.com,googlevideo.com"); unset or empty allows
 * any host, which the token already gates. The suffix match requires a dot
 * boundary so "notyoutube.com" cannot slip through as "youtube.com".
 */
function hostAllowed(host, env) {
  const list = (env.PROXY_ALLOW_HOSTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const h = host.toLowerCase();
  return list.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

/** Streams an arbitrary http(s) request through, minus hop-by-hop headers. */
async function forward(target, request) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('bad url parameter', { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response('only http and https targets are allowed', { status: 400 });
  }

  const headers = new Headers();
  const skipped = ['host', 'connection', 'transfer-encoding', 'content-length', 'accept-encoding', 'x-proxy-token'];
  for (const [key, value] of request.headers.entries()) {
    if (!skipped.includes(key.toLowerCase()) && !key.toLowerCase().startsWith('cf-')) {
      headers.set(key, value);
    }
  }

  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  let upstream;
  try {
    upstream = await fetch(parsed.toString(), init);
  } catch (err) {
    return new Response(`upstream fetch failed: ${err?.message || err}`, { status: 502 });
  }

  const out = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    const k = key.toLowerCase();
    if (k !== 'content-encoding' && k !== 'content-length' && k !== 'transfer-encoding' && k !== 'connection') {
      out.set(key, value);
    }
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}
