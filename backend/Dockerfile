FROM node:20-bookworm-slim

# Install FFmpeg, Python (required for yt-dlp), wget, curl, and unzip
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    unzip \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer's built-in chromium download and use the system one
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install wireproxy
RUN curl -sL https://github.com/pufferffish/wireproxy/releases/latest/download/wireproxy_linux_amd64.tar.gz | tar xz -C /usr/local/bin


# Install bgutil-ytdlp-pot-provider pip plugin for yt-dlp PO Tokens
RUN pip3 install --no-cache-dir curl_cffi bgutil-ytdlp-pot-provider --break-system-packages
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

# Build the PO Token Microservice
RUN cd bgutil-ytdlp-pot-provider/server && npm ci && npx tsc

# Create necessary directories for the app
RUN mkdir -p uploads outputs

# Hugging Face Spaces requires the app to listen on port 7860
ENV PORT=7860
EXPOSE 7860

# Start the application using the auto-boot script
RUN chmod +x start.sh
CMD ["./start.sh"]
