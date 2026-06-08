(async () => {
  const instances = [
    'https://invidious.nerdvpn.de',
    'https://invidious.flokinet.to',
    'https://inv.tux.pizza',
    'https://vid.puffyan.us'
  ];

  for (const api of instances) {
    console.log('\n=== Testing ' + api + ' ===');
    try {
      const resp = await fetch(api + '/api/v1/videos/dQw4w9WgXcQ');
      const text = await resp.text();
      try {
        const data = JSON.parse(text);
        if (data.formatStreams) {
          console.log('Got streams:', data.formatStreams.length);
          const best = data.formatStreams[0];
          console.log('Stream URL:', best.url.slice(0, 100));
          const testDl = await fetch(best.url, { headers: { 'Range': 'bytes=0-99' } });
          console.log('Download test:', testDl.status);
        } else {
          console.log('No streams in response');
        }
      } catch(e) {
        console.log('Parse error', text.slice(0, 50));
      }
    } catch (e) {
      console.log('Error: ' + e.message);
    }
  }
})();
