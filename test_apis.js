// Explore the download endpoint response fully
(async () => {
  const resp = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=jNQXAC9IVRw&format=mp3', {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
      'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
    }
  });
  const data = await resp.json();
  
  if (Array.isArray(data)) {
    console.log('Array of formats, count:', data.length);
    // Find best audio-only
    const audioOnly = data.filter(f => !f.height && f.url);
    const videoAudio = data.filter(f => f.height && f.url && f.acodec !== 'none');
    console.log('Audio-only with URL:', audioOnly.length);
    console.log('Video+Audio with URL:', videoAudio.length);
    if (audioOnly[0]) {
      console.log('Best audio:', {url: audioOnly[0].url?.slice(0, 100), abr: audioOnly[0].abr, ext: audioOnly[0].ext, format_note: audioOnly[0].format_note});
    }
    if (videoAudio[0]) {
      console.log('Best video:', {url: videoAudio[0].url?.slice(0, 100), height: videoAudio[0].height, ext: videoAudio[0].ext});
    }
    // Check if URL is fetchable
    if (audioOnly[0]?.url) {
      const testResp = await fetch(audioOnly[0].url, { headers: { Range: 'bytes=0-99' } });
      console.log('Audio URL fetch status:', testResp.status);
    }
  }
})();
