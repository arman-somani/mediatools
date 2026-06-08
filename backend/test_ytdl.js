const { Innertube } = require('youtubei.js');
const fs = require('fs');

(async () => {
  try {
    const yt = await Innertube.create();
    const video = await yt.getInfo('jNQXAC9IVRw');
    console.log('Title:', video.basic_info.title);
    
    const stream = await yt.download('jNQXAC9IVRw', {
      type: 'video+audio',
      quality: '720p',
      format: 'mp4'
    });
    
    // Check what stream is
    console.log('Stream constructor:', stream.constructor.name);
    // Is it readable?
    if (stream.getReader) {
       console.log('It is a web stream');
    }
  } catch(e) {
    console.error(e);
  }
})();
