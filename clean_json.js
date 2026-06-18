const fs = require('fs');

let content = fs.readFileSync('Colab-Server.ipynb', 'utf8');

// The file got corrupted because line numbers like "78: 104:         ..." were pasted.
// Actually, it was just "78: 104: " or similar.
// Wait, looking at the output:
// Colab-Server.ipynb:112:138:         "    '--user-data-dir=/root/.config/chromium', \n",
// This was from Select-String.
// The actual file content looks like:
// 78: 104:         "env_content = base64.b64decode(env_b64).decode('utf-8')\n",
// So the pattern to replace is /^\d+: /gm

let fixedContent = content.replace(/^\d+:\s/gm, '');

// Verify it's valid JSON
try {
  JSON.parse(fixedContent);
  fs.writeFileSync('Colab-Server.ipynb', fixedContent);
  console.log('Successfully fixed Colab-Server.ipynb');
} catch (e) {
  console.error('Still invalid JSON:', e);
}
