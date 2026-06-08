(async () => {
  const headers = { 'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com', 'x-rapidapi-key': '208e9bff95msh90b82e1f2353e90p17b16ejsn23f1054a290e' };
  const videoId = 'hDVOoC7FyCg';
  const audioUrl = 'https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=' + videoId + '&filter=audioonly';
  const aResp = await fetch(audioUrl, { headers });
  const aData = await aResp.json();
  const bestAudio = aData.find(f => f.ext === 'm4a' || f.acodec !== 'none') || aData[0];
  console.log('Audio URL:', bestAudio.url.slice(0, 80));
  
  const cdnResp = await fetch(bestAudio.url);
  console.log('CDN Status:', cdnResp.status);
})();
