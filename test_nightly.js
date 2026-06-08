(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/test-ytdlp';
  try {
    const downloadCmd = 'wget https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp -O /tmp/yt-dlp-nightly && chmod a+rx /tmp/yt-dlp-nightly';
    const resp1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: ;  + downloadCmd })
    });
    console.log(await resp1.text());
    
    const resp2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: ; /tmp/yt-dlp-nightly --version })
    });
    console.log(await resp2.text());
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
