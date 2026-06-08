const { Innertube, UniversalCache } = require('youtubei.js');
const { Jinter } = require('jintr');

// The hack: Access Platform dynamically
const { Platform } = require('youtubei.js/dist/src/utils/Utils.js');

Platform.shim.eval = (script) => {
  return new Jinter().evaluate(script);
};

(async () => {
  try {
    const yt = await Innertube.create({
      generate_session_locally: true,
      fetch: fetch,
      cache: new UniversalCache(false)
    });
    
    console.log('Created! Fetching video...');
    const stream = await yt.download('jNQXAC9IVRw', {
      type: 'video+audio',
      quality: 'best',
      format: 'mp4'
    });
    console.log('Stream works!', !!stream);
  } catch(e) {
    console.error(e);
  }
})();
