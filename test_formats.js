(async () => {
  const KEY = '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e';
  const HOST = 'youtube-media-downloader.p.rapidapi.com';
  const headers = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };

  // Get full video details
  const r = await fetch('https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=dQw4w9WgXcQ', { headers });
  const d = await r.json();
  
  // Print all top-level keys
  console.log('Top keys:', Object.keys(d).join(', '));
  
  // Check for streams/formats
  if (d.videos) { console.log('d.videos items:', d.videos.items?.length); if(d.videos.items?.[0]) console.log('Video[0]:', JSON.stringify(d.videos.items[0]).slice(0,200)); }
  if (d.audios) { console.log('d.audios items:', d.audios.items?.length); if(d.audios.items?.[0]) console.log('Audio[0]:', JSON.stringify(d.audios.items[0]).slice(0,200)); }
  if (d.formats) console.log('d.formats:', JSON.stringify(d.formats).slice(0,300));
  if (d.streamingData) console.log('streamingData keys:', Object.keys(d.streamingData));
})();
