(async () => {
  try {
    const testResp = await fetch('https://cobalt-api.pequla.com/api/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        isAudioOnly: true
      })
    });
    const text = await testResp.text();
    console.log('Status: ' + testResp.status, text.slice(0, 200));
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
