(async () => {
  try {
    const r = await fetch('https://yt1s.com/api/ajaxSearch/index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      body: 'q=https://www.youtube.com/watch?v=dQw4w9WgXcQ&vt=home'
    });
    console.log(await r.text());
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
