const { Innertube, UniversalCache, Platform } = require('youtubei.js');
const vm = require('vm');
const fs = require('fs');

Platform.shim.eval = (script) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
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
      type: 'audio',
      quality: 'best',
      format: 'mp4'
    });
    console.log('Stream works!', !!stream);
    
    const fileStream = fs.createWriteStream('test-download.mp4');
    for await (const chunk of stream) {
      fileStream.write(chunk);
    }
    fileStream.end();
    console.log('Finished writing to test-download.mp4');
  } catch(e) {
    console.error(e);
  }
})();
