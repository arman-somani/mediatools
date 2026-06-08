const youtubedl = require('youtube-dl-exec');
youtubedl('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
  dumpJson: true,
  noWarnings: true,
  noCallHome: true,
  noCheckCertificate: true,
  preferFreeFormats: true,
  youtubeSkipDashManifest: true
}).then(output => console.log('Title:', output.title)).catch(err => console.error(err));
