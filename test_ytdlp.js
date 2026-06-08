const { spawnSync } = require('child_process');
const result = spawnSync('yt-dlp', ['--print', 'title', '--extractor-args', 'youtube:player_client=android', 'https://www.youtube.com/watch?v=hDVOoC7FyCg']);
console.log('stdout:', result.stdout.toString());
console.log('stderr:', result.stderr.toString());
