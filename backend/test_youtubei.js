const { Innertube, UniversalCache } = require('youtubei.js');
const vm = require('vm');

(async () => {
  try {
    const yt = await Innertube.create({
      js_evaluator: (script) => {
        return vm.runInNewContext(script);
      }
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
