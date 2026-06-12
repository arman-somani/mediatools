const fs = require('fs');

const path = 'Colab-Server.ipynb';
let data = JSON.parse(fs.readFileSync(path, 'utf8'));

for (let cell of data.cells) {
  if (cell.cell_type === 'code' && cell.source.join('').includes('Cloudflare Tunnel')) {
    cell.source = [
      "# 5. Start Ngrok Tunnel and the Server!\n",
      "import subprocess\n",
      "import time\n",
      "\n",
      "ngrok_token = None\n",
      "ngrok_domain = None\n",
      "\n",
      "try:\n",
      "    with open('/content/mediatools/backend/.env', 'r') as f:\n",
      "        for line in f:\n",
      "            if line.startswith('NGROK_AUTHTOKEN='):\n",
      "                ngrok_token = line.strip().split('=', 1)[1]\n",
      "            elif line.startswith('NGROK_DOMAIN='):\n",
      "                ngrok_domain = line.strip().split('=', 1)[1]\n",
      "except Exception as e:\n",
      "    print(f\"❌ ERROR reading .env: {e}\")\n",
      "\n",
      "if not ngrok_token or not ngrok_domain:\n",
      "    print(\"❌ ERROR: You must add NGROK_AUTHTOKEN=... and NGROK_DOMAIN=... to your .env file in Google Drive!\")\n",
      "else:\n",
      "    print(\"🌐 Downloading Ngrok...\")\n",
      "    !wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz\n",
      "    !tar -xf ngrok-v3-stable-linux-amd64.tgz\n",
      "    !chmod +x ngrok\n",
      "\n",
      "    print(\"🔑 Authenticating Ngrok...\")\n",
      "    subprocess.run(f\"./ngrok config add-authtoken {ngrok_token}\", shell=True)\n",
      "\n",
      "    print(f\"🚀 Starting Ngrok Tunnel on {ngrok_domain}...\")\n",
      "    subprocess.run(f\"nohup ./ngrok http --domain={ngrok_domain} 5000 > ngrok.log 2>&1 &\", shell=True)\n",
      "\n",
      "    print(\"=\"*60)\n",
      "    print(f\"🎯 YOUR BACKEND API IS LIVE AT: https://{ngrok_domain}\")\n",
      "    print(\"=\"*60)\n",
      "\n",
      "# Start the Node.js backend server\n",
      "print(\"\\n📜 STREAMING LIVE SERVER LOGS BELOW...\")\n",
      "print(\"-\"*60)\n",
      "!npm start\n"
    ];
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('Updated Colab-Server.ipynb to use Ngrok instead of Cloudflare');
