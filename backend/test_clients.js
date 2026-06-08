const { Innertube, UniversalCache, Platform, ClientType } = require('youtubei.js');
const vm = require('vm');

Platform.shim.eval = (script) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
};

(async () => {
  // Test all client types for BOTH video+audio and audio-only
  for (const type of ['ANDROID', 'TV', 'MWEB', 'WEB']) {
    try {
      const yt = await Innertube.create({
        generate_session_locally: true,
        fetch: fetch,
        cache: new UniversalCache(false),
        client_type: ClientType[type]
      });
      const stream = await yt.download('jNQXAC9IVRw', { type: 'video+audio', quality: 'best', format: 'mp4' });
      console.log('video+audio SUCCESS with client:', type);
      break;
    } catch(e) {
      console.log('video+audio FAILED with', type + ':', e.message.slice(0, 80));
    }
  }
  
  for (const type of ['ANDROID', 'TV', 'MWEB', 'WEB']) {
    try {
      const yt = await Innertube.create({
        generate_session_locally: true,
        fetch: fetch,
        cache: new UniversalCache(false),
        client_type: ClientType[type]
      });
      const stream = await yt.download('jNQXAC9IVRw', { type: 'audio', quality: 'best', format: 'any' });
      console.log('audio-only SUCCESS with client:', type);
      break;
    } catch(e) {
      console.log('audio-only FAILED with', type + ':', e.message.slice(0, 80));
    }
  }
})();
