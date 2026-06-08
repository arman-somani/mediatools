(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/test-ytdlp';
  
  // 1. Get a CDN link via RapidAPI
  const rapidUrl = 'https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=dQw4w9WgXcQ';
  const options = {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn',
      'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com'
    }
  };
  const resp = await fetch(rapidUrl, options);
  const data = await resp.json();
  const targetUrl = data.audios.items[0].url;
  
  // 2. Fetch the CDN link using corsproxy.io on Render
  const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
  
  const args = ; curl -I " + proxyUrl + ";
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args })
    });
    console.log(await r.text());
  } catch (e) {}
})();
