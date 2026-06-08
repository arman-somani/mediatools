(async () => {
  const headers = { 'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com', 'x-rapidapi-key': '208e9bff95msh90b82e1f2353e90p17b16ejsn23f1054a290e' };
  const videoId = 'dQw4w9WgXcQ';
  try {
    const r = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=' + videoId + '&filter=videoonly', { headers });
    const data = await r.json();
    console.log(data.map(f => ({ id: f.format_id, ext: f.ext, height: f.height, vcodec: f.vcodec })));
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
