(async () => {
  try {
    const resp = await fetch('https://instances.cobalt.tools/api/instances');
    const instances = await resp.json();
    console.log('Found instances:', instances.length);
    const active = instances.filter(i => i.score > 90 && i.version.startsWith('10.'));
    console.log('Active high score:', active.length);
    
    // Test the top 5
    for (const api of active.slice(0, 5)) {
      const url = 'https://' + api.domain;
      console.log('\n=== Testing ' + url + ' ===');
      try {
        const testResp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            downloadMode: 'audio',
            audioFormat: 'mp3'
          })
        });
        const text = await testResp.text();
        console.log('Status: ' + testResp.status, text.slice(0, 100));
        if (text.includes('"url"')) {
          console.log('SUCCESS! ' + url + ' works!');
          break;
        }
      } catch(e) {
        console.log('Failed:', e.message);
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
