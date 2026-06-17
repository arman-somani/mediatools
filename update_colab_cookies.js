const fs = require('fs');

let nb = JSON.parse(fs.readFileSync('Colab-Server.ipynb', 'utf8'));

// Find the last cell where npm start is located
let cell = nb.cells.find(c => c.source.join('').includes('!npm start'));

if (cell) {
  // We rewrite the end of the cell to inject the cookie pre-harvest logic
  let sourceStr = cell.source.join('');
  
  // Cut off the last two lines which are print and !npm start
  sourceStr = sourceStr.replace("# Start the Node.js backend server\nprint(\"\\n📜 STREAMING LIVE SERVER LOGS BELOW...\")\nprint(\"-\"*60)\n!npm start\n", "");

  const newLogic = `
# Pre-Harvest Cookies if they are missing or expired (older than 24h)
import os
import time

cookies_path = '/content/mediatools/backend/outputs/youtube_cookies.txt'
expired = True

if os.path.exists(cookies_path):
    file_age = time.time() - os.path.getmtime(cookies_path)
    if file_age < 86400: # 24 hours
        expired = False
        print("✅ Cookies are fresh. No need to re-harvest.")

if expired:
    print("🍪 Cookies are missing or older than 24 hours. Harvesting fresh cookies now...")
    script = """
const { harvestCookies } = require('./dist/utils/browser.js');
harvestCookies('https://youtube.com').then(() => {
    console.log('✅ Successfully generated fresh cookies before server start!');
    process.exit(0);
}).catch(err => {
    console.error('⚠️ Failed to pre-harvest cookies:', err);
    process.exit(1);
});
"""
    with open('/content/mediatools/backend/pre_harvest.js', 'w') as f:
        f.write(script)
    
    os.system('cd /content/mediatools/backend && node pre_harvest.js')

# Start the Node.js backend server
print("\\n📜 STREAMING LIVE SERVER LOGS BELOW...")
print("-" * 60)
!npm start
`;

  // We split by lines to keep the array format for Jupyter
  const newSourceLines = (sourceStr + newLogic).split('\n').map(line => line + '\n');
  
  // Clean up the very last newline artifact from splitting
  newSourceLines[newSourceLines.length - 1] = newSourceLines[newSourceLines.length - 1].replace('\n', '');

  cell.source = newSourceLines;

  fs.writeFileSync('Colab-Server.ipynb', JSON.stringify(nb, null, 2));
  console.log('Notebook cookie harvest logic updated successfully');
} else {
  console.log('Could not find the cell to update');
}
