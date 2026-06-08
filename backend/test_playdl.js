const playdl = require('play-dl');
const fs = require('fs');
(async () => {
  const info = await playdl.video_info('jNQXAC9IVRw');
  // Get best muxed mp4 (has video+audio)
  const muxed = info.format.filter(f => f.mimeType && f.mimeType.includes('video/mp4') && f.url);
  console.log('Muxed formats:', muxed.length);
  if (muxed.length > 0) {
    const best = muxed.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    console.log('Best:', best.qualityLabel, best.mimeType);
    // Try fetching first 100 bytes
    const r = await fetch(best.url, { headers: { Range: 'bytes=0-99' } });
    console.log('Fetch status:', r.status, r.statusText);
  }
  // Also check audio-only formats
  const audioOnly = info.format.filter(f => f.mimeType && f.mimeType.includes('audio') && f.url);
  console.log('Audio-only formats:', audioOnly.length);
})();
