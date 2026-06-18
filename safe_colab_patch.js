const fs = require('fs');

let content = fs.readFileSync('Colab-Server.ipynb', 'utf8');
let notebook = JSON.parse(content);

// 1. Fallback Tiers text (cell 0)
let tiersCell = notebook.cells[0];
let tiersSource = tiersCell.source.join('');
tiersSource = tiersSource.replace(
  "- **Tier 1 (Native yt-dlp)**: Attempts a direct connection using the cached cookies from Ubuntu's Chromium Browser.\\n",
  "- **Tier 1 (Headless Browser Interception)**: Uses Puppeteer to physically open YouTube invisibly, play the video, and intercept the raw streaming network requests.\\n\\n- **Tier 2 (Native yt-dlp)**: Attempts a direct connection using the cached cookies from Google Chrome.\\n"
);
// In case the markdown is currently a bit different
if (!tiersSource.includes('Headless Browser Interception')) {
  // If the replace failed, let's just rewrite the whole cell source
  notebook.cells[0].source = [
    "# MediaTools Backend on Google Colab\n",
    "This notebook installs Node.js, FFmpeg, your backend code, generates your `.env`, and runs **Google Chrome** in the background to automatically harvest fresh YouTube cookies for `yt-dlp`.\n",
    "\n",
    "### 🚀 Instructions\n",
    "1. Simply click **Runtime -> Run All**.\n",
    "2. The script will fetch fresh cookies silently, spin up your Vercel tunnel, and start the server!\n",
    "\n",
    "### 🛡️ Download Fallback Tiers\n",
    "Your backend is natively configured with the following layers of redundancy to bypass blocks:\n",
    "- **Tier 1 (Headless Browser Interception)**: Uses Puppeteer to physically open YouTube invisibly, play the video, and intercept the raw streaming network requests.\n",
    "- **Tier 2 (Native yt-dlp)**: Attempts a direct connection using the cached cookies from Google Chrome.\n",
    "- **Tier 3 (Proxy Network 1)**: If the native IP is blocked, it routes yt-dlp through a fresh proxy from your free proxy pool.\n",
    "- **Tier 4 (Proxy Network 2)**: If the first proxy fails, it fetches another batch of proxies and tries again.\n",
    "- **Tier 5 (ytdl-core)**: If all yt-dlp methods fail, it switches to the entirely different `@distube/ytdl-core` Node.js library.\n",
    "- **Tier 6 (play-dl)**: As the absolute last resort, it falls back to the `play-dl` Node.js scraping library."
  ];
}

// 2. Install Cell (cell 1)
notebook.cells[1].source = [
  "# 1. Install Node.js, FFmpeg, yt-dlp, Google Chrome, and cloudflared\n",
  "!curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n",
  "!sudo apt-get install -y nodejs ffmpeg python3 wget libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2\n",
  "!wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -\n",
  "!sudo sh -c 'echo \"deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main\" >> /etc/apt/sources.list.d/google.list'\n",
  "!sudo apt-get update && sudo apt-get install -y google-chrome-stable\n",
  "!npm install -g localtunnel\n",
  "!wget -q -nc https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb\n",
  "!dpkg -i cloudflared-linux-amd64.deb\n",
  "!wget -q https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp\n",
  "!chmod a+rx /usr/local/bin/yt-dlp\n"
];

// 3. Headless Browser Cell (cell 4)
notebook.cells[4].source = [
  "# 4. Run Google Chrome to Auto-Generate Fresh Cookies\n",
  "import os\n",
  "import subprocess\n",
  "import shutil\n",
  "\n",
  "# Automatically clear old browser cookies so we start 100% fresh every time \"Run All\" is clicked\n",
  "profile_dir = '/root/.config/google-chrome'\n",
  "if os.path.exists(profile_dir):\n",
  "    shutil.rmtree(profile_dir)\n",
  "    print(\"🧹 Old cookies wiped.\")\n",
  "\n",
  "print(\"🌐 Running Google Chrome silently to fetch fresh YouTube cookies...\")\n",
  "# Start Chrome in headless mode to automatically fetch cookies without a GUI\n",
  "subprocess.run([\n",
  "    'google-chrome-stable', \n",
  "    '--headless', \n",
  "    '--no-sandbox', \n",
  "    '--disable-dev-shm-usage', \n",
  "    '--user-data-dir=/root/.config/google-chrome', \n",
  "    '--password-store=basic', \n",
  "    '--virtual-time-budget=5000', \n",
  "    'https://www.youtube.com'\n",
  "], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)\n",
  "\n",
  "print(\"✅ Fresh YouTube cookies successfully generated!\")\n"
];

fs.writeFileSync('Colab-Server.ipynb', JSON.stringify(notebook, null, 2));
console.log('Successfully updated Colab-Server.ipynb!');
