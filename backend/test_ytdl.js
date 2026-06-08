const { Innertube } = require('youtubei.js');
const { JSDOM } = require('jsdom');
const fs = require('fs');

(async () => {
  try {
    const yt = await Innertube.create({
      generate_session_locally: true,
      js_evaluator: (script) => {
          const dom = new JSDOM();
          return dom.window.eval(script);
      }
    });
    const stream = await yt.download('jNQXAC9IVRw', {
      type: 'video+audio',
      quality: 'best',
      format: 'mp4'
    });
    
    console.log('Stream downloaded! Is readable stream:', !!stream.getReader);
  } catch(e) {
    console.error('Download failed:', e);
  }
})();
