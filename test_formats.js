// Test youtube-mp36.p.rapidapi.com and youtube-media-downloader.p.rapidapi.com
(async () => {
  const KEY = '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e';
  
  const apis = [
    { host: 'youtube-mp36.p.rapidapi.com', url: 'https://youtube-mp36.p.rapidapi.com/dl?id=dQw4w9WgXcQ' },
    { host: 'youtube-media-downloader.p.rapidapi.com', url: 'https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=dQw4w9WgXcQ' },
    { host: 'ytstream-download-youtube-videos.p.rapidapi.com', url: 'https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=dQw4w9WgXcQ' },
    { host: 'youtube-downloader-download-youtube-videos-as-mp4.p.rapidapi.com', url: 'https://youtube-downloader-download-youtube-videos-as-mp4.p.rapidapi.com/dlYoutubeMp4?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ' }
  ];
  
  for (const api of apis) {
    try {
      const r = await fetch(api.url, { headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': api.host } });
      const text = await r.text();
      console.log(api.host + ' -> ' + r.status + ': ' + text.slice(0, 150));
    } catch(e) {
      console.log(api.host + ' -> ERROR: ' + e.message);
    }
  }
})();
