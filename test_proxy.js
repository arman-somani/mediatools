(async () => {
  const rapidUrl = 'https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=dQw4w9WgXcQ';
  const options = {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
      'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com'
    }
  };
  const resp = await fetch(rapidUrl, options);
  const data = await resp.json();
  const targetUrl = data.audios.items[0].url;
  
  const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
  const r2 = await fetch(proxyUrl, { headers: { 'Range': 'bytes=0-99' } });
  console.log('Corsproxy:', r2.status);
  
  const proxyUrl2 = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);
  const r3 = await fetch(proxyUrl2, { headers: { 'Range': 'bytes=0-99' } });
  console.log('Allorigins:', r3.status);
})();
