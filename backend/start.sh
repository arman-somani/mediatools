#!/bin/bash

echo "[WARP] Initializing Cloudflare WARP..."

# Download wgcf if not exists
if [ ! -f "/usr/local/bin/wgcf" ]; then
    echo "[WARP] Downloading wgcf..."
    curl -fsSL -o /usr/local/bin/wgcf "https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_linux_amd64"
    chmod +x /usr/local/bin/wgcf
fi

# Generate WARP config if not exists
if [ ! -f "wgcf-profile.conf" ]; then
    echo "[WARP] Registering new WARP account..."
    yes | wgcf register --accept-tos
    echo "[WARP] Generating WireGuard config..."
    wgcf generate
    
    echo "[WARP] Appending SOCKS5 settings to config..."
    cat >> wgcf-profile.conf << 'EOF'

[Socks5]
BindAddress = 127.0.0.1:1080
EOF
fi

echo "[WARP] Starting wireproxy on port 1080..."
wireproxy -c wgcf-profile.conf &

# Wait for proxy to boot
sleep 3

echo "[WARP] Proxy started! Launching Node backend..."
exec node -r dotenv/config dist/app.js
