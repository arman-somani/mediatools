(async () => {
  try {
    const r = await fetch('https://dave15.savenow.to/pacific/?eHiXKcrS5UVOzjOS2Munlrb');
    console.log('Status:', r.status);
    console.log('Headers:', r.headers.get('content-type'), r.headers.get('content-length'));
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
