(async () => {
  // Get the full info
  const resp = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/info?id=jNQXAC9IVRw', {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
      'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
    }
  });
  const data = await resp.json();
  
  // Check formats array
  if (data.formats) {
    console.log('formats count:', data.formats.length);
    const mp4Audio = data.formats.filter(f => f.ext === 'm4a' || (f.acodec && f.acodec !== 'none' && !f.vcodec));
    const mp4Video = data.formats.filter(f => f.ext === 'mp4' && f.vcodec && f.vcodec !== 'none');
    console.log('Audio-only formats:', mp4Audio.length);
    console.log('Video formats:', mp4Video.length);
    if (mp4Audio[0]) console.log('Best audio:', JSON.stringify({url: mp4Audio[0].url?.slice(0,80), abr: mp4Audio[0].abr, ext: mp4Audio[0].ext}));
    if (mp4Video[0]) console.log('Best video:', JSON.stringify({url: mp4Video[0].url?.slice(0,80), height: mp4Video[0].height, ext: mp4Video[0].ext}));
  }
  
  // Check for direct url field
  if (data.url) console.log('Direct URL available:', data.url.slice(0, 100));
  if (data.audio) console.log('Audio field:', typeof data.audio);
})();
