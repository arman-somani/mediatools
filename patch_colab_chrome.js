const fs = require('fs');

let colab = fs.readFileSync('Colab-Server.ipynb', 'utf8');

// Replace installation
colab = colab.replace(
    /"# 1\. Install Node\.js, FFmpeg, yt-dlp, Ubuntu Chromium, and cloudflared\\n",\s+"!curl -fsSL https:\/\/deb\.nodesource\.com\/setup_20\.x \| sudo -E bash -\\n",\s+"!sudo apt-get install -y nodejs ffmpeg python3 wget chromium-browser libnss3 libatk1\.0-0 libatk-bridge2\.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1\.0-0 libcairo2 libasound2\\n",/g,
    `"# 1. Install Node.js, FFmpeg, yt-dlp, Google Chrome, and cloudflared\\n",
        "!curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\\n",
        "!sudo apt-get install -y nodejs ffmpeg python3 wget libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2\\n",
        "!wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -\\n",
        "!sudo sh -c 'echo \\"deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main\\" >> /etc/apt/sources.list.d/google.list'\\n",
        "!sudo apt-get update && sudo apt-get install -y google-chrome-stable\\n",`
);

// Replace browser execution
colab = colab.replace(
    /profile_dir = '\/root\/\.config\/chromium'/g,
    `profile_dir = '/root/.config/google-chrome'`
);

colab = colab.replace(
    /print\("🌐 Running Ubuntu's Chromium Browser silently to fetch fresh YouTube cookies\.\.\."\)/g,
    `print("🌐 Running Google Chrome silently to fetch fresh YouTube cookies...")`
);

colab = colab.replace(
    /'chromium-browser', \\n",\s+'--headless', \\n",\s+'--dump-dom', \\n",\s+'--no-sandbox', \\n",\s+'--disable-dev-shm-usage', \\n",\s+'--user-data-dir=\/root\/\.config\/chromium', \\n",\s+'--password-store=basic', \\n",\s+'https:\/\/www\.youtube\.com'\\n"/g,
    `'google-chrome-stable', \\n",
    '--headless', \\n",
    '--no-sandbox', \\n",
    '--disable-dev-shm-usage', \\n",
    '--user-data-dir=/root/.config/google-chrome', \\n",
    '--password-store=basic', \\n",
    '--virtual-time-budget=5000', \\n",
    'https://www.youtube.com'\\n"`
);

// Format Tier 1 description again just to be safe
colab = colab.replace(
    /Your backend is natively configured with the following 5 layers of redundancy to bypass blocks:\\n",\s+"- \*\*Tier 1 \(Native yt-dlp\)\*\*: Attempts a direct connection using the cached cookies from Ubuntu's Chromium Browser\.\\n",/g,
    `Your backend is natively configured with the following layers of redundancy to bypass blocks:\\n",
        "- **Tier 1 (Headless Browser Interception)**: Uses Puppeteer to physically open YouTube invisibly, play the video, and intercept the raw streaming network requests.\\n",
        "- **Tier 2 (Native yt-dlp)**: Attempts a direct connection using the cached cookies from Google Chrome.\\n",`
);

fs.writeFileSync('Colab-Server.ipynb', colab);
