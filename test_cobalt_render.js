(async () => {
  const url = 'https://mediatools-2vg3.onrender.com/api/convert/test-ytdlp';
  const args = ; node -e "
    const instances = [
      'https://api.cobalt.tools',
      'https://co.wuk.sh',
      'https://cobalt.q0.is',
      'https://cobalt.p.starfiles.co',
      'https://cobalt-api.pequla.com'
    ];
    (async () => {
      for (const api of instances) {
        console.log('Testing', api);
        try {
          const r = await fetch(api, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
          });
          console.log(r.status, await r.text().catch(()=>''));
        } catch(e) { console.log(e.message); }
      }
    })();
  ";
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args })
    });
    console.log(await resp.text());
  } catch (e) { console.log('Error:', e.message); }
})();
