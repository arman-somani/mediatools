const { Innertube, UniversalCache } = require('youtubei.js');
const { Jinter } = require('jintr');

(async () => {
  try {
    const yt = await Innertube.create({
      generate_session_locally: true,
      fetch: fetch,
      cache: new UniversalCache(false),
      js_evaluator: (script) => new Jinter().evaluate(script)
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
