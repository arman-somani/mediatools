(async () => {
  const headers = {
    'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com',
    'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e'
  };

  const videoId = 'jNQXAC9IVRw';

  const [infoRes, videoRes, audioRes] = await Promise.all([
    fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/info?id=' + videoId, { headers }),
    fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=' + videoId + '&filter=videoonly', { headers }),
    fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=' + videoId + '&filter=audioonly', { headers })
  ]);

  const infoData = await infoRes.json().catch(() => ({}));
  const videoData = await videoRes.json().catch(() => ([]));
  const audioData = await audioRes.json().catch(() => ([]));

  console.log('Video data:', JSON.stringify(videoData, null, 2));
})();
