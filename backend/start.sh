#!/bin/bash
# Launcher script that runs both the POT provider and the main application
set -e

echo "[boot] Starting bgutil-ytdlp-pot-provider on port 4416..."
(cd bgutil-ytdlp-pot-provider/server && node build/main.js -p 4416) &

# Give the provider a moment to bind
sleep 2

# Export the URL so our app's ytdlp.ts can use it automatically
export POT_PROVIDER_URL="http://127.0.0.1:4416"

echo "[boot] Starting main backend application..."
exec node --max-old-space-size=256 -r dotenv/config dist/app.js
