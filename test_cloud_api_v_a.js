(async () => {
  const headers = { 'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com', 'x-rapidapi-key': '208e9bff95msh90b82e1f2353e90p17b16ejsn23f1054a290e' };
  const videoId = 'dQw4w9WgXcQ';
  try {
    const r = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=' + videoId + '&filter=videoonly', { headers });
    const vData = await r.json();
    
    const r2 = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=' + videoId + '&filter=audioonly', { headers });
    const aData = await r2.json();

    const targetHeight = 720;
    const sortedVideos = vData.filter(f => f.height).sort((a, b) => b.height - a.height);
    const bestVideo = sortedVideos.find(f => f.height <= targetHeight) || sortedVideos[0] || vData[0];
    const bestAudio = aData.find(f => f.ext === 'm4a' || f.acodec !== 'none') || aData[0];
    
    console.log('Best Video:', bestVideo.height, bestVideo.ext, !!bestVideo.url);
    console.log('Best Audio:', bestAudio.ext, bestAudio.acodec, !!bestAudio.url);
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
