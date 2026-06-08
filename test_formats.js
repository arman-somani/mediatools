(async () => {
  const KEY = '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e';
  const HOST = 'youtube-media-downloader.p.rapidapi.com';
  const headers = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

  const r = await fetch('https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=dQw4w9WgXcQ', { headers });
  const d = await r.json();
  
  // Print video formats
  console.log('=== VIDEO STREAMS ===');
  d.videos.items.forEach((v, i) => {
    console.log(i, v.quality || v.qualityLabel, v.extension, v.hasAudio ? 'WITH_AUDIO' : 'VIDEO_ONLY', v.url ? 'HAS_URL' : 'NO_URL');
  });
  
  console.log('\n=== AUDIO STREAMS ===');
  d.audios.items.forEach((a, i) => {
    console.log(i, a.quality || a.bitrate || a.audioSampleRate, a.extension, a.url ? 'HAS_URL' : 'NO_URL');
  });
  
  // Get best video (1080p, no audio)  
  const bestVid = d.videos.items.filter(v => !v.hasAudio && v.url).sort((a,b) => {
    const qa = parseInt(a.quality || a.qualityLabel || '0');
    const qb = parseInt(b.quality || b.qualityLabel || '0');
    return qb - qa;
  })[0];
  const bestAud = d.audios.items.filter(a => a.url)[0];
  
  console.log('\nBest video-only:', JSON.stringify({quality: bestVid?.quality || bestVid?.qualityLabel, ext: bestVid?.extension, hasAudio: bestVid?.hasAudio}).slice(0, 150));
  console.log('Best audio:', JSON.stringify({quality: bestAud?.quality, ext: bestAud?.extension}).slice(0, 100));
  
  // Test URLs
  if (bestVid?.url) { const tr = await fetch(bestVid.url, {headers:{Range:'bytes=0-99'}}); console.log('\nVideo URL test:', tr.status); }
  if (bestAud?.url) { const tr = await fetch(bestAud.url, {headers:{Range:'bytes=0-99'}}); console.log('Audio URL test:', tr.status); }
})();
