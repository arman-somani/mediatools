(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/test-ytdlcore';
  try {
    const resp = await fetch(url);
    console.log('Status:', resp.status);
    console.log(await resp.text());
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
