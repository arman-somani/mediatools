(async () => {
  const versionUrl = 'https://mediatools-2vg3.onrender.com/api/convert/version';
  try {
    const vResp = await fetch(versionUrl);
    console.log('Version:', await vResp.text());
  } catch(e) {}

  const url = 'https://mediatools-2vg3.onrender.com/api/convert/test-ytdlp';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: '--print title --extractor-args "youtube:player_client=android,web" https://www.youtube.com/watch?v=hDVOoC7FyCg' })
    });
    console.log('Test ytdlp:', await resp.text());
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
