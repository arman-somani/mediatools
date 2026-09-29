FROM node:20-bookworm-slim

# FFmpeg (+ffprobe) for merging/transcoding, Python for yt-dlp, chromium for the
# optional puppeteer cookie refresher.
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

# curl_cffi powers yt-dlp's --impersonate (real browser TLS fingerprints),
# which helps against bot detection. Kept deliberately.
RUN pip3 install --no-cache-dir curl_cffi --break-system-packages

# Latest yt-dlp from master. Installed via pip rather than the PyInstaller
# binary so Node/Deno can be used as the JS runtime for signature solving.
RUN pip3 install -U https://github.com/yt-dlp/yt-dlp/archive/master.zip --break-system-packages

# Install the yt-dlp plugin for PO token generation
RUN pip3 install -U bgutil-ytdlp-pot-provider --break-system-packages

# Deno as the JS runtime for yt-dlp's n-parameter / signature challenges.
RUN curl -fsSL https://deno.land/install.sh | sh && \
    ln -s /root/.deno/bin/deno /usr/local/bin/deno
ENV PATH="/root/.deno/bin:${PATH}"

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all backend source code
COPY . .

# Build the TypeScript code for the main app
RUN npm run build

# Build the PO token provider server
RUN cd bgutil-ytdlp-pot-provider/server && npm ci && npx tsc

# Create necessary directories for the app
RUN mkdir -p uploads outputs

# Render injects PORT at runtime; 5000 is only the local/default fallback.
EXPOSE 5000

# Ensure start script is executable
RUN chmod +x start.sh

# Start using the launcher script to run both the PO token provider and the main app
CMD ["./start.sh"]
