(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/youtube';
  const data = { url: 'https://www.youtube.com/watch?v=hDVOoC7FyCg', quality: '720', format: 'mp4' };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await resp.json();
    console.log('Job Started:', body);
    
    if (!body.data?.conversionId) return;
    
    const statusUrl = 'https://mediatools-2vg3.onrender.com/api/convert/status/' + body.data.conversionId;
    for (let i = 0; i < 30; i++) {
      const sResp = await fetch(statusUrl);
      const sData = await sResp.json();
      const status = sData.data?.status;
      console.log('Status:', status, sData.data?.progress + '%', sData.data?.errorMessage || '');
      if (status === 'completed' || status === 'failed') {
        break;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
