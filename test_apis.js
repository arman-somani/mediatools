// Full test: get best audio + best video URLs and verify they work
(async () => {
  const resp = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=jNQXAC9IVRw&format=mp3', {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
      'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
    }
  });
  const formats = await resp.json();
  
  // Pick best audio-only (highest abr)
  const audioFormats = formats.filter(f => !f.height && f.url && f.ext !== 'webm');
  const bestAudio = (audioFormats.length > 0 ? audioFormats : formats.filter(f => !f.height && f.url))
    .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
  
  // Pick best muxed video (has both audio+video)
  const muxedFormats = formats.filter(f => f.height && f.url && f.acodec !== 'none' && f.ext === 'mp4');
  const bestMuxed = muxedFormats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  
  // Pick best video-only (highest height)
  const videoFormats = formats.filter(f => f.height && f.url && f.ext === 'mp4');
  const bestVideo = videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  
  console.log('Best audio:', bestAudio?.ext, bestAudio?.abr + 'kbps', 'fetch:', bestAudio?.url ? '?' : '?');
  console.log('Best muxed video:', bestMuxed?.ext, bestMuxed?.height + 'p', 'fetch:', bestMuxed?.url ? '?' : '?');
  console.log('Best video:', bestVideo?.ext, bestVideo?.height + 'p', 'fetch:', bestVideo?.url ? '?' : '?');
  
  // Verify audio URL works
  if (bestAudio?.url) {
    const r = await fetch(bestAudio.url, { headers: { Range: 'bytes=0-99' } });
    console.log('Audio URL status:', r.status, r.statusText);
  }
  if (bestMuxed?.url) {
    const r = await fetch(bestMuxed.url, { headers: { Range: 'bytes=0-99' } });
    console.log('Muxed video URL status:', r.status, r.statusText);
  }
})();
