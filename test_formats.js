(async () => {
  const resp = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=dQw4w9WgXcQ&format=mp4', {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
      'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
    }
  });
  const text = await resp.text();
  const data = JSON.parse(text);
  console.log('Type:', typeof data, Array.isArray(data) ? 'Array[' + data.length + ']' : '');
  console.log('Sample:', JSON.stringify(data).slice(0, 300));
})();
