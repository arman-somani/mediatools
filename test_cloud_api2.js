(async () => {
  const headers = {
    'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com',
    'x-rapidapi-key': '208e9bff95msh90b82e1f2353e90p17b16ejsn23f1054a290e'
  };
  const videoId = 'hDVOoC7FyCg';
  try {
    const r = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=' + videoId + '&filter=audioonly', { headers });
    const data = await r.json();
    console.log(JSON.stringify(data).slice(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
