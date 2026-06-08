(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/test-ytdlp';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: '-U' })
    });
    console.log('Status:', resp.status);
    console.log(await resp.text());
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
