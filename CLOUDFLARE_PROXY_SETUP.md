# Cloudflare Egress Pool — Setup Guide

## What this does

Downloads from YouTube are blocked per **source IP**. Render's datacenter IPs
are already heavily rate-limited, so this feature routes every download
through Cloudflare Workers instead, with automatic failover:

```
yt-dlp ──▶ local shim (127.0.0.1) ──WebSocket──▶ Cloudflare Worker ──TCP──▶ YouTube
   ▲                                                                        │
   └────────────────────── media streams back the same way ────────────────┘
```

- **If one IP stops working** (bot check, 429, mid-download 403), it is put on
  a cooldown and the next Worker takes over — automatically, per connection
  and per job.
- **If a download is cut halfway** through, yt-dlp's `.part` file survives and
  the retry on the next IP **resumes from the last byte** instead of starting
  over.
- **Fast by default:** whichever Worker last succeeded is preferred for
  subsequent requests, fragments download in parallel
  (`YT_CONCURRENT_FRAGMENTS`), and a dead Worker costs one connection attempt,
  not one download.

TLS between yt-dlp and YouTube stays end-to-end — the Worker only relays
encrypted bytes and never sees the media.

## Step 1 — Deploy the Worker(s)

Requires a free Cloudflare account and Node.

```bash
cd cloudflare/yt-proxy
npx wrangler login
npx wrangler secret put PROXY_TOKEN     # paste a long random string
npx wrangler deploy
```

Note the URL it prints, e.g. `https://mediatools-yt-proxy-1.<your-subdomain>.workers.dev`.

**More IPs = better fallback.** Each deployed Worker is a separate entry in
the pool. Copy `wrangler.toml` with a different `name` (e.g.
`mediatools-yt-proxy-2`) and deploy again to get a second one.

Generate a token with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 2 — Configure the backend

Set these environment variables (Render dashboard → Environment, or
`backend/.env` locally):

```
CF_PROXY_URLS=https://mediatools-yt-proxy-1.<sub>.workers.dev,https://mediatools-yt-proxy-2.<sub>.workers.dev
CF_PROXY_TOKEN=<the same value you put in PROXY_TOKEN>
```

That is all. On boot you will see:

```
[cf-shim] cloudflare proxy shim listening on 127.0.0.1:41234 (2 worker URL(s))
```

and `/api/health/ready` reports the live pool under `egress.routes`, including
which routes are healthy, how many times each failed, and how long each is in
cooldown.

## How failover works

The pool order is: **Cloudflare shim → PROXY_URL / YT_PROXY_URLS proxies →
direct egress**. Within a job, each route gets the full extraction-client
ladder before the pool moves on.

| Event | What happens |
|---|---|
| Worker unreachable | Shim tries up to 3 healthy Workers per connection; the dead one goes on cooldown |
| Bot check / 429 on an IP | Route marked unhealthy (3 min cooldown, doubling to 30 min), job continues on the next route |
| Download blocked halfway (`IP_BLOCKED`) | Route cooldown + next attempt resumes from the `.part` file |
| Worker breaks mid-stream | Reported unhealthy immediately; the next CONNECT avoids it |
| All Workers down | Falls back to `PROXY_URL`/`YT_PROXY_URLS`, then direct egress — same behavior as before this feature |
| Video is private / removed | Fails fast; IP rotation cannot fix that |

Routes recover automatically when their cooldown expires, so a Worker that
was temporarily throttled comes back on its own.

## Tuning

| Variable | Default | Meaning |
|---|---|---|
| `CF_PROXY_URLS` | – | Comma-separated Worker URLs |
| `CF_PROXY_TOKEN` | – | Shared secret (Worker's `PROXY_TOKEN`) |
| `CF_SHIM_PORT` | random | Pin the local shim's port for debugging |
| `YT_PROXY_URLS` | – | Extra HTTP/SOCKS fallback proxies, comma-separated |
| `YT_MAX_EGRESS_ATTEMPTS` | 8 | How many routes one job may walk |
| `YT_CONCURRENT_FRAGMENTS` | 3 | Parallel fragment downloads (1–8) |
| `YT_SLEEP_REQUESTS` | 1 | Delay between YouTube metadata requests |

## Worker hardening (optional)

`cloudflare/yt-proxy/worker.js` accepts `PROXY_ALLOW_HOSTS` as a wrangler var
to restrict tunnels to YouTube's domains:

```toml
[vars]
PROXY_ALLOW_HOSTS = "youtube.com,googlevideo.com,ytimg.com,googleapis.com,gstatic.com,ggpht.com"
```

Leave it unset if you also use the universal (non-YouTube) downloader — the
`PROXY_TOKEN` secret already gates the Worker either way.

## Notes

- Cloudflare Workers connect to arbitrary TCP hosts via the
  `cloudflare:sockets` API; the Worker code uses `secureTransport: 'starttls'`
  so it relays the raw TLS stream without terminating it.
- Deploying the Worker is free-tier friendly, but long-running relay
  connections benefit from the $5 Workers Paid plan (higher CPU allowance).
  Free plan works for typical downloads.
- To verify a Worker without the backend:
  `curl "https://<worker>/ping?token=<token>"` → `pong`.
