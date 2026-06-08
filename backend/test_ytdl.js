const { Innertube } = require('youtubei.js');
const fs = require('fs');

(async () => {
  try {
    const yt = await Innertube.create();
    const video = await yt.getInfo('jNQXAC9IVRw');
    console.log('Title:', video.basic_info.title);
    
    const stream = await yt.download('jNQXAC9IVRw', {
      type: 'video+audio',
      quality: 'best',
      format: 'mp4'
    });
    
    console.log('Stream constructor:', stream.constructor.name);
    // write to file using stream.pipeTo?
  } catch(e) {
    console.error(e);
  }
})();
