(async () => {
  try {
    const url = 'https://loader.to/ajax/download.php?button=1&start=1&end=1&format=mp3&url=https://www.youtube.com/watch?v=hDVOoC7FyCg';
    const resp = await fetch(url);
    const data = await resp.json();
    console.log(data);
    if (!data.id) return;
    
    const pUrl = 'https://loader.to/ajax/progress.php?id=' + data.id;
    for (let i=0; i<15; i++) {
      const pResp = await fetch(pUrl);
      const pData = await pResp.json();
      console.log(pData.progress, pData.text);
      if (pData.success && pData.download_url) {
        console.log('Got URL:', pData.download_url);
        break;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
