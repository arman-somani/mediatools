(async () => {
  try {
    // Get a valid video stream from ytdl-core
    const ytdl = require('@distube/ytdl-core');
    const info = await ytdl.getInfo('dQw4w9WgXcQ');
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    
    // Test direct fetch
    const r1 = await fetch(format.url, { headers: { 'Range': 'bytes=0-99' }});
    console.log('Direct status:', r1.status);
    
    // Test proxy
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(format.url);
    const r2 = await fetch(proxyUrl, { headers: { 'Range': 'bytes=0-99' }});
    console.log('Proxy status:', r2.status);
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
