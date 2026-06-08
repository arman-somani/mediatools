(async () => {
  try {
    const resp = await fetch('https://youtube-po-token-generator.vercel.app/');
    const data = await resp.json();
    console.log(data);
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
