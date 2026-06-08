const { Innertube, UniversalCache, Platform } = require('youtubei.js');
const vm = require('vm');

Platform.shim.eval = (script) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
};

(async () => {
  try {
    const yt = await Innertube.create({
      generate_session_locally: true,
      fetch: fetch,
      client_type: 'ANDROID',
      cache: new UniversalCache(false)
    });
    
    console.log('Created! Fetching audio...');
    const stream = await yt.download('dQw4w9WgXcQ', {
      type: 'audio',
      quality: 'best',
      format: 'any'
    });
    console.log('Stream works!', !!stream);
  } catch(e) {
    console.error(e);
  }
})();
