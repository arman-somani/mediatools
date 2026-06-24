FROM node:20-bookworm-slim

# Install FFmpeg, Python (required for yt-dlp), wget, and shared libraries for Sparticuz Chromium
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    wget \
    curl \
    unzip \
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

# Install native Google Chrome so Render runs exactly like Colab
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
    apt-get update && apt-get install -y google-chrome-stable

# Install the latest yt-dlp nightly build via pip
# This avoids the PyInstaller bug that prevents Node.js from being used as a JS runtime
RUN pip3 install -U https://github.com/yt-dlp/yt-dlp/archive/master.zip --break-system-packages

# Install Deno as the bulletproof JS runtime for yt-dlp
RUN curl -fsSL https://deno.land/install.sh | sh && \
    ln -s /root/.deno/bin/deno /usr/local/bin/deno

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
