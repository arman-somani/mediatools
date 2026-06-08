(async () => {
  const apis = [
    { host: 'youtube-mp36.p.rapidapi.com', url: 'https://youtube-mp36.p.rapidapi.com/dl?id=dQw4w9WgXcQ' },
    { host: 'ytstream-download-youtube-videos.p.rapidapi.com', url: 'https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=dQw4w9WgXcQ' },
    { host: 'youtube-mp3-downloader2.p.rapidapi.com', url: 'https://youtube-mp3-downloader2.p.rapidapi.com/ytmp3/ytmp3/?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
  ];

  for (const api of apis) {
    try {
      const resp = await fetch(api.url, {
        headers: {
          'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
          'x-rapidapi-host': api.host
        }
      });
      console.log(api.host, resp.status, await resp.text().catch(()=>''));
    } catch (e) {
      console.log(api.host, 'Error');
    }
  }
})();
