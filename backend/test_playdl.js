const playdl = require('play-dl');
(async () => {
  const info = await playdl.video_info('jNQXAC9IVRw');
  const fmt = info.format[0];
  console.log('Sample format keys:', Object.keys(fmt));
  console.log('mimeType:', fmt.mimeType);
  console.log('url exists:', !!fmt.url);
  // print all non-empty urls
  info.format.forEach((f, i) => {
    if (f.url) console.log(i, f.mimeType, f.contentLength, 'has_url=true');
  });
})();
