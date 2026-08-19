#!/bin/bash

echo "[PO Token] Initializing bgutil-ytdlp-pot-provider..."

# Clone and build the PO Token server if not exists
if [ ! -d "bgutil-ytdlp-pot-provider" ]; then
    echo "[PO Token] Cloning repository..."
    git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git
    cd bgutil-ytdlp-pot-provider/server
    npm ci && npx tsc
    cd ../../
fi

echo "[PO Token] Starting server in the background..."
node bgutil-ytdlp-pot-provider/server/build/main.js &

export YT_DLP_POT_PROVIDER_URL="http://127.0.0.1:4416"

# Wait for PO token server to boot
sleep 3

echo "[PO Token] Server started! Launching Node backend..."
exec node --max-old-space-size=200 -r dotenv/config dist/app.js
