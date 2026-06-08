(async () => {
  const url = 'https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': '208e9bff95msh90b82e1f2353e90p17b16ejsn23f1054a290e',
      'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
    }
  };
  try {
    const resp = await fetch(url, options);
    const data = await resp.json();
    console.log(data);
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
