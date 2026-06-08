const { Innertube, UniversalCache, Platform } = require('youtubei.js');
const vm = require('vm');

Platform.shim.eval = (script) => {
  const code = typeof script === 'string' ? script : script.output;
  return new vm.Script(code).runInNewContext({}); // or new Function
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
