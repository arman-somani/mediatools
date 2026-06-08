(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/youtube';
  const data = { url: 'https://www.youtube.com/watch?v=hDVOoC7FyCg', quality: '192' };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('Status:', resp.status);
    const body = await resp.json();
    console.log(body);
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
