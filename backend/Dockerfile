FROM node:20-bookworm-slim

# Install FFmpeg, Python (required for yt-dlp), wget, and shared libraries for Sparticuz Chromium
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
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

# Install the latest yt-dlp nightly build via pip
# This avoids the PyInstaller bug that prevents Node.js from being used as a JS runtime
RUN pip3 install -U https://github.com/yt-dlp/yt-dlp/archive/master.zip --break-system-packages

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
