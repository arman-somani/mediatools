# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# MediaTools API
#
# Two stages. The builder carries the C toolchain and header packages that
# `canvas` needs to compile; the runtime image carries only the shared
# libraries it links against. That keeps gcc, make and ~300MB of -dev headers
# out of the shipped image, which matters on a 512MB instance where every
# resident megabyte competes with yt-dlp and ffmpeg.
#
# Node 22, not 20. The PO token provider declares `"engines": {"node": ">=22"}`
# and its dependency tree (youtubei.js 18, bgutils-js 4) relies on it; on
# Node 20 it installs with a warning and then dies at runtime, which left the
# provider silently dead while the app went on advertising it to yt-dlp.
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS builder

# Build dependencies for `canvas`, pulled in by the PO token provider through
# jsdom. Prebuilt binaries exist for common platforms but are not guaranteed to
# be available for every Node/libc combination, and a source fallback that
# cannot find Cairo fails the whole build.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      pkg-config \
      python3 \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg-dev \
      libgif-dev \
      librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
# `npm ci` rather than `npm install`: it installs exactly what the lockfile
# pins and fails loudly when the lockfile and package.json disagree, instead of
# quietly resolving a different tree in production than the one tested here.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Compiles TypeScript to dist/. The `build` script also fetches a yt-dlp
# binary for local Windows development; it is a no-op here because the runtime
# stage installs yt-dlp from source via pip.
RUN npm run build

# The PO token provider ships as a separate workspace with its own lockfile.
WORKDIR /app/bgutil-ytdlp-pot-provider/server
RUN npm ci && npx tsc

# Drop the provider's dev dependencies now that it is compiled; only its
# runtime tree needs to survive into the next stage.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      ffmpeg \
      python3 \
      python3-pip \
      # Shared libraries `canvas` links against at runtime. The -dev packages
      # that provided these headers stay behind in the builder stage.
      libcairo2 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libjpeg62-turbo \
      libgif7 \
      librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

# curl_cffi backs yt-dlp's `--impersonate`, which replays a real browser's TLS
# and HTTP/2 fingerprint. Without it, `--impersonate chrome` is ignored and the
# connection advertises Python's own fingerprint — one of the cheapest signals
# for a bot filter to key on. Deliberately kept.
RUN pip3 install --no-cache-dir --break-system-packages curl_cffi

# yt-dlp from master rather than the last PyPI release. YouTube ships breaking
# extractor changes with no notice and fixes land on master within days, so a
# release-pinned build is usually the reason a working deployment stops working.
# Rebuild (or enable YTDLP_AUTO_UPDATE below) to pick up fixes.
RUN pip3 install --no-cache-dir --break-system-packages \
      "yt-dlp[default] @ https://github.com/yt-dlp/yt-dlp/archive/master.zip"

# The provider plugin yt-dlp loads to obtain tokens. It supports both a local
# generator script and a remote HTTP server; this image uses the script, which
# runs only when a token is needed instead of holding ~130MB resident.
RUN pip3 install --no-cache-dir --break-system-packages bgutil-ytdlp-pot-provider

# Deno executes YouTube's signature-deciphering JavaScript. yt-dlp prefers a
# real JS runtime for the n-parameter challenge and falls back to slower, more
# fragile in-Python interpretation when none is present.
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- --yes \
    && deno --version

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# The generator script plus the dependency tree it needs at runtime.
COPY --from=builder /app/bgutil-ytdlp-pot-provider/server/build ./bgutil-ytdlp-pot-provider/server/build
COPY --from=builder /app/bgutil-ytdlp-pot-provider/server/node_modules ./bgutil-ytdlp-pot-provider/server/node_modules
COPY --from=builder /app/bgutil-ytdlp-pot-provider/server/package.json ./bgutil-ytdlp-pot-provider/server/package.json
COPY package.json ./
COPY start.sh ./

ENV POT_SERVER_HOME=/app/bgutil-ytdlp-pot-provider/server
# Generated tokens are cached here between extractions. Must be writable by the
# unprivileged user below, or every request regenerates a token — slower, and a
# much louder pattern from YouTube's point of view.
ENV XDG_CACHE_HOME=/app/.cache

RUN mkdir -p uploads outputs "$XDG_CACHE_HOME" && chmod +x start.sh

# Render injects PORT at runtime; this is documentation plus a local default.
EXPOSE 5000

# Run unprivileged. The base image ships a `node` user; nothing here needs root
# once the dependencies are installed.
RUN chown -R node:node /app
USER node

CMD ["./start.sh"]
