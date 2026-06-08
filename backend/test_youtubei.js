const { Innertube, UniversalCache, Platform } = require('youtubei.js');
const { Jinter } = require('jintr');
const vm = require('vm');

// Option A: Jinter
Platform.shim.eval = (script) => {
  const jinter = new Jinter();
  // Depending on what yt.js passes, it might be a string or an object with .output
  const code = typeof script === 'string' ? script : script.output;
  return jinter.evaluate(code);
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
