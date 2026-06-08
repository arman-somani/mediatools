const { Innertube, UniversalCache } = require('youtubei.js');
const Jintr = require('jintr').default;

(async () => {
  try {
    const yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
      fetch: fetch,
      js_evaluator: (script) => {
        return new Jintr().evaluate(script);
      }
    });
    
    console.log('Created! Fetching video...');
    const video = await yt.getInfo('jNQXAC9IVRw');
    console.log('Title:', video.basic_info.title);
    
    // test download 240p
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
