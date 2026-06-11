FROM node:20-bookworm-slim

# Install FFmpeg, Python (required for yt-dlp), and wget
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download and install the latest yt-dlp nightly build (fixes bot protection)
RUN wget https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set up a non-root user (REQUIRED by HuggingFace Spaces)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Copy package files and install dependencies
COPY --chown=user package*.json ./
RUN npm install

# Copy all backend source code
COPY --chown=user . .

# Build the TypeScript code
RUN npm run build

# Create necessary directories for the app
RUN mkdir -p uploads outputs

# HuggingFace requires the app to listen on port 7860
EXPOSE 7860
ENV PORT=7860

# Start the application
CMD ["npm", "start"]
