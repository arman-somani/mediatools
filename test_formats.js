// Test yt-api.p.rapidapi.com - popular YouTube data API
// Also test ytdlfree API
(async () => {
  // Test 1: yt-api.p.rapidapi.com  
  console.log('=== Testing yt-api.p.rapidapi.com ===');
  try {
    const r = await fetch('https://yt-api.p.rapidapi.com/dl?id=dQw4w9WgXcQ', {
      headers: {
        'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
        'x-rapidapi-host': 'yt-api.p.rapidapi.com'
      }
    });
    const d = await r.json();
    console.log('Status:', r.status);
    if (d.adaptiveFormats) {
      const vOnly = d.adaptiveFormats.filter(f => f.mimeType?.includes('video') && !f.mimeType?.includes('audio'));
      const aOnly = d.adaptiveFormats.filter(f => f.mimeType?.includes('audio') && !f.mimeType?.includes('video'));
      console.log('Video-only adaptive:', vOnly.length, 'Best:', vOnly.sort((a,b)=>(b.height||0)-(a.height||0))[0]?.qualityLabel);
      console.log('Audio-only adaptive:', aOnly.length, 'Best:', aOnly[0]?.mimeType);
      if (vOnly[0]?.url) { const tr = await fetch(vOnly[0].url, {headers:{Range:'bytes=0-99'}}); console.log('Video URL test:', tr.status); }
    } else {
      console.log('Keys:', Object.keys(d).join(', '));
      console.log(JSON.stringify(d).slice(0, 200));
    }
  } catch(e) { console.error('yt-api FAILED:', e.message); }

  // Test 2: youtube-v3-alternative.p.rapidapi.com
  console.log('\n=== Testing youtube-v3-alternative ===');
  try {
    const r = await fetch('https://youtube-v3-alternative.p.rapidapi.com/video?id=dQw4w9WgXcQ', {
      headers: {
        'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
        'x-rapidapi-host': 'youtube-v3-alternative.p.rapidapi.com'
      }
    });
    console.log('Status:', r.status, (await r.text()).slice(0, 200));
  } catch(e) { console.error('FAILED:', e.message); }
})();
