const fetch = require('node-fetch');
const { spawn } = require('child_process');

(async () => {
  const headers = {
    'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com',
    'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e'
  };

  const videoId = 'jNQXAC9IVRw';

  const [infoRes, videoRes, audioRes] = await Promise.all([
    fetch(https://cloud-api-hub-youtube-downloader.p.rapidapi.com/info?id=\, { headers }),
    fetch(https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=\&filter=videoonly, { headers }),
    fetch(https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=\&filter=audioonly, { headers })
  ]);

  const infoData = await infoRes.json().catch(() => ({}));
  const videoData = await videoRes.json().catch(() => ([]));
  const audioData = await audioRes.json().catch(() => ([]));

  console.log('Video data length:', videoData.length);
  console.log('Audio data length:', audioData.length);
  
  if (videoData.length > 0) {
    console.log('First video URL:', videoData[0].url.substring(0, 100));
  }
  if (audioData.length > 0) {
    console.log('First audio URL:', audioData[0].url.substring(0, 100));
  }
})();
