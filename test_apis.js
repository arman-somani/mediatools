(async () => {
  const resp = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/info?id=jNQXAC9IVRw', {
    headers: {
      'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
      'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
    }
  });
  const data = await resp.json();
  // Print all top-level keys and their types/values
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') console.log(k, '=', v.slice(0, 80));
    else if (Array.isArray(v)) console.log(k, '= Array[', v.length, ']', v[0] ? JSON.stringify(v[0]).slice(0,100) : '');
    else console.log(k, '=', typeof v, JSON.stringify(v)?.slice(0, 60));
  }
})();
