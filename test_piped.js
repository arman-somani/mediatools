(async () => {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.moomoo.me',
    'https://pipedapi.syncpundit.io'
  ];

  for (const api of instances) {
    console.log('\n=== Testing ' + api + ' ===');
    try {
      const resp = await fetch(api + '/streams/dQw4w9WgXcQ');
      const text = await resp.text();
      try {
        const data = JSON.parse(text);
        if (data.videoStreams && data.audioStreams) {
          console.log('Video streams:', data.videoStreams.length);
          console.log('Audio streams:', data.audioStreams.length);
          
          const bestAudio = data.audioStreams.find(a => a.mimeType.includes('m4a'));
          const bestVideo = data.videoStreams.find(v => v.videoOnly);
          
          if (bestAudio) {
             console.log('Audio URL:', bestAudio.url.slice(0, 80));
             const testDl = await fetch(bestAudio.url, { headers: { 'Range': 'bytes=0-99' } });
             console.log('Audio dl test:', testDl.status);
          }
          if (bestVideo) {
             console.log('Video URL:', bestVideo.url.slice(0, 80));
             const testDl2 = await fetch(bestVideo.url, { headers: { 'Range': 'bytes=0-99' } });
             console.log('Video dl test:', testDl2.status);
          }
        } else {
          console.log('No streams in response', text.slice(0, 50));
        }
      } catch(e) {
        console.log('Parse error', text.slice(0, 50));
      }
    } catch (e) {
      console.log('Error: ' + e.message);
    }
  }
})();
