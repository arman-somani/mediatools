#!/bin/bash
# Thin launcher for `npm start`. The Dockerfile invokes node directly.
#
# Removed: the Cloudflare WARP / wireproxy bootstrap that used to run here.
# It downloaded wgcf from GitHub on every cold start and opened a SOCKS5 proxy
# on 127.0.0.1:1080 that no MP3/MP4 download path ever referenced.
set -e

exec node --max-old-space-size=256 -r dotenv/config dist/app.js
