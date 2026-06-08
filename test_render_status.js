(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/status/6a268dc9c3767740636457a6';

  for (let i = 0; i < 15; i++) {
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      console.log('Status:', data.data?.status, 'Progress:', data.data?.progress, data.data?.errorMessage || '');
      if (data.data?.status === 'completed' || data.data?.status === 'failed') {
        break;
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
})();
