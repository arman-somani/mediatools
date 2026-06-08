(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/version';
  for (let i = 0; i < 30; i++) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        console.log('Version:', data.version);
        if (data.version === 'v3_ytdlp_android_bypass') {
          console.log('DEPLOYMENT FINISHED!');
          break;
        }
      } else {
        console.log('Not deployed yet (404)');
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
})();
