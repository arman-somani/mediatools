(async () => {
  const instances = [
    'https://co.wuk.sh',
    'https://cobalt.q0.is',
    'https://api.cobalt.tools',
    'https://cobalt-api.kwiatechu.com',
    'https://cobalt.p.starfiles.co'
  ];

  for (const api of instances) {
    console.log('\n=== Testing ' + api + ' ===');
    try {
      const resp = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          downloadMode: 'audio',
          audioFormat: 'mp3',
          audioBitrate: '192'
        })
      });
      const text = await resp.text();
      try {
        const data = JSON.parse(text);
        console.log('Status: ' + resp.status, data);
        if (data.url) {
          const testDl = await fetch(data.url, { headers: { 'Range': 'bytes=0-99' } });
          console.log('Download test: ' + testDl.status);
        }
      } catch(e) {
        console.log('Status: ' + resp.status, text.slice(0, 100));
      }
    } catch (e) {
      console.log('Error: ' + e.message);
    }
  }
})();
