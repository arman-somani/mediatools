// Check if there's a 'url' field in the response (direct download link) and a formats array
(async () => {
  const resp = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/info?id=jNQXAC9IVRw', {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
      'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
    }
  });
  const data = await resp.json();
  console.log('Has url field:', 'url' in data, data.url ? data.url.slice(0, 80) : 'N/A');
  console.log('Has formats field:', 'formats' in data);
  
  // Also check the requested_formats key
  console.log('Has requested_formats:', 'requested_formats' in data);
  
  // Try the /download endpoint instead
  console.log('\n=== Trying /download endpoint ===');
  const resp2 = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=jNQXAC9IVRw&format=mp3', {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
      'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
    }
  });
  console.log('Download status:', resp2.status);
  const data2 = await resp2.json().catch(() => resp2.text());
  console.log('Download response:', JSON.stringify(data2).slice(0, 200));
})();
