// Test Cobalt API
(async () => {
  console.log('=== Testing Cobalt API ===');
  try {
    const resp = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        downloadMode: 'audio',
        audioFormat: 'mp3',
        audioBitrate: '192'
      })
    });
    const data = await resp.json();
    console.log('Status:', resp.status, '| Response:', JSON.stringify(data).slice(0, 200));
  } catch(e) {
    console.error('Cobalt FAILED:', e.message);
  }

  console.log('\n=== Testing RapidAPI ===');
  try {
    const resp = await fetch('https://cloud-api-hub-youtube-downloader.p.rapidapi.com/info?id=jNQXAC9IVRw', {
      headers: {
        'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
        'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
      }
    });
    const data = await resp.json();
    console.log('Status:', resp.status, '| Keys:', Object.keys(data));
    if (data.audios) console.log('Audio formats:', data.audios.length);
    if (data.videos) console.log('Video formats:', data.videos.length);
    if (data.audios?.[0]) console.log('Sample audio:', JSON.stringify(data.audios[0]).slice(0, 150));
    if (data.videos?.[0]) console.log('Sample video:', JSON.stringify(data.videos[0]).slice(0, 150));
  } catch(e) {
    console.error('RapidAPI FAILED:', e.message);
  }
})();
