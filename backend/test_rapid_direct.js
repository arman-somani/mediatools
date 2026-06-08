const fetch = require('node-fetch');

(async () => {
  const headers = {
    'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com',
    'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e'
  };

  const videoId = 'jNQXAC9IVRw';

  const audioRes = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=' + videoId + '&filter=audioonly', { headers });
  const audioData = await audioRes.json();
  
  if (audioData && audioData.length > 0) {
    const audioUrl = audioData[0].url;
    console.log('Got audio URL, fetching directly...');
    
    const directRes = await fetch(audioUrl);
    console.log('Direct fetch status:', directRes.status);
    
    if (directRes.status !== 200) {
       console.log(await directRes.text());
    }
  }
})();
