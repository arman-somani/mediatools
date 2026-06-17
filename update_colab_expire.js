const fs = require('fs');

let nb = JSON.parse(fs.readFileSync('Colab-Server.ipynb', 'utf8'));

// Find the cell with the pre-harvest logic
let cell = nb.cells.find(c => c.source.join('').includes('pre_harvest.js'));

if (cell) {
  cell.source = [
    "# Pre-Harvest Cookies if they are missing or genuinely expired\n",
    "import os\n",
    "import time\n",
    "\n",
    "cookies_path = '/content/mediatools/backend/outputs/youtube_cookies.txt'\n",
    "needs_harvest = True\n",
    "\n",
    "if os.path.exists(cookies_path):\n",
    "    needs_harvest = False\n",
    "    now = time.time()\n",
    "    try:\n",
    "        with open(cookies_path, 'r') as f:\n",
    "            for line in f:\n",
    "                if not line.startswith('#') and line.strip():\n",
    "                    parts = line.strip().split('\\t')\n",
    "                    if len(parts) >= 5:\n",
    "                        exp = int(parts[4])\n",
    "                        # If the expiration timestamp is in the past, it's expired!\n",
    "                        if exp > 0 and exp < now:\n",
    "                            needs_harvest = True\n",
    "                            print(f\"⚠️ Found expired cookie! Timestamp {exp} is in the past.\")\n",
    "                            break\n",
    "    except Exception as e:\n",
    "        needs_harvest = True\n",
    "\n",
    "    if not needs_harvest:\n",
    "        print(\"✅ Cookies file exists and is NOT expired! Skipping harvest.\")\n",
    "\n",
    "if needs_harvest:\n",
    "    print(\"🍪 Cookies are missing or expired. Harvesting fresh cookies now...\")\n",
    "    script = \"\"\"\n",
    "const { harvestCookies } = require('./dist/utils/browser.js');\n",
    "harvestCookies('https://youtube.com').then(() => {\n",
    "    console.log('✅ Successfully generated fresh cookies before server start!');\n",
    "    process.exit(0);\n",
    "}).catch(err => {\n",
    "    console.error('⚠️ Failed to pre-harvest cookies:', err);\n",
    "    process.exit(1);\n",
    "});\n",
    "\"\"\"\n",
    "    with open('/content/mediatools/backend/pre_harvest.js', 'w') as f:\n",
    "        f.write(script)\n",
    "    \n",
    "    os.system('cd /content/mediatools/backend && node pre_harvest.js')\n",
    "\n",
    "# Start the Node.js backend server\n",
    "print(\"\\n📜 STREAMING LIVE SERVER LOGS BELOW...\")\n",
    "print(\"-\" * 60)\n",
    "!npm start\n"
  ];

  fs.writeFileSync('Colab-Server.ipynb', JSON.stringify(nb, null, 2));
  console.log('Notebook true expiration logic updated successfully');
} else {
  console.log('Could not find the cell to update');
}
