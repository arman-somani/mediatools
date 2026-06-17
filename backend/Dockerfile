FROM node:20-bookworm-slim

# Install FFmpeg, Python (required for yt-dlp), wget, and shared libraries for Sparticuz Chromium
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    wget \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Download and install the latest yt-dlp nightly build (fixes bot protection)
# CACHE BUST: 2026-06-12
RUN wget -q https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all backend source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Create necessary directories for the app
RUN mkdir -p uploads outputs

# Render automatically passes the PORT env variable
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
