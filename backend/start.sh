#!/usr/bin/env bash
#
# Container entrypoint, sized for a 512MB instance.
#
# Memory is the binding constraint here, so it is worth being explicit about the
# budget. At peak the container holds:
#
#   API (Node, capped below)            ~190MB
#   yt-dlp (Python)                      ~70MB
#   then ONE of:
#     PO token generator (Node, brief)  ~120MB   during extraction
#     ffmpeg (merge/transcode)           ~90MB   after extraction
#
# Those two never overlap: a token is needed to resolve formats, which finishes
# before any muxing starts. Peak is therefore ~380MB, which fits with headroom.
#
# This is why the PO token provider is NOT run as a long-lived HTTP server. That
# mode keeps a second Node process resident for the life of the container —
# roughly 130MB that cannot be reclaimed and that would be held *while* ffmpeg
# runs, pushing peak past the limit and getting the whole container OOM-killed
# mid-download. Script mode spawns the generator per extraction and lets it exit,
# and it caches tokens on disk so most requests do not spawn it at all.
#
# Set POT_PROVIDER_URL to use an HTTP provider running on some *other* host; the
# API prefers the local script whenever it is present.

set -euo pipefail

POT_SERVER_HOME="${POT_SERVER_HOME:-/app/bgutil-ytdlp-pot-provider/server}"
NODE_HEAP_MB="${NODE_HEAP_MB:-192}"

# The token generator caches to $XDG_CACHE_HOME (or $HOME/.cache). Pointing it
# somewhere guaranteed writable matters because the image runs as an
# unprivileged user; without a writable cache it regenerates a token on every
# single extraction, which is both slow and far more visible to YouTube.
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/app/.cache}"
mkdir -p "$XDG_CACHE_HOME"

# Optional: refresh yt-dlp at boot. Off by default because it adds 10-20s to a
# cold start and needs network egress, but a yt-dlp that is a few weeks stale is
# the single most common cause of a deployment that worked last month and does
# not work today.
if [[ "${YTDLP_AUTO_UPDATE:-false}" == "true" ]]; then
  echo "[boot] refreshing yt-dlp from master"
  pip3 install --no-cache-dir --break-system-packages -q \
    "yt-dlp[default] @ https://github.com/yt-dlp/yt-dlp/archive/master.zip" \
    || echo "[boot] yt-dlp refresh failed; continuing with the bundled version"
fi

echo "[boot] yt-dlp $(yt-dlp --version 2>/dev/null || echo 'NOT FOUND')"
echo "[boot] node $(node --version)"

if [[ "${ENABLE_POT_PROVIDER:-true}" == "true" && -f "$POT_SERVER_HOME/build/generate_once.js" ]]; then
  export POT_SERVER_HOME
  echo "[boot] PO token generator: script mode at $POT_SERVER_HOME"
  echo "[boot] token cache: $XDG_CACHE_HOME/bgutil-ytdlp-pot-provider"
else
  # Unset so the API does not advertise a generator that is not there. The
  # extraction ladder falls back to the clients that need no token.
  unset POT_SERVER_HOME || true
  if [[ "${ENABLE_POT_PROVIDER:-true}" != "true" ]]; then
    echo "[boot] PO token generator disabled (ENABLE_POT_PROVIDER=false)"
  else
    echo "[boot] PO token generator not found at $POT_SERVER_HOME/build/generate_once.js"
  fi
  echo "[boot] continuing with tokenless clients (android_vr, tv_simply, tv_embedded)"
fi

echo "[boot] starting MediaTools API (heap cap ${NODE_HEAP_MB}MB)"

# `exec` replaces this shell so the API receives Render's SIGTERM directly and
# can drain in-flight downloads itself instead of being killed outright.
exec node --max-old-space-size="$NODE_HEAP_MB" -r dotenv/config dist/app.js
