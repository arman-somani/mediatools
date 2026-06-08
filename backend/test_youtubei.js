const { Innertube, UniversalCache } = require('youtubei.js');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;

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
