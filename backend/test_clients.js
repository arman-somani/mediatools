const { Innertube, UniversalCache, Platform, ClientType } = require('youtubei.js');
const vm = require('vm');

Platform.shim.eval = (script) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
};

(async () => {
  for (const type of ['IOS', 'ANDROID', 'TV', 'MWEB']) {
    try {
      console.log('Trying client:', type);
      const yt = await Innertube.create({
        generate_session_locally: true,
        fetch: fetch,
        cache: new UniversalCache(false),
        client_type: ClientType[type]
      });
      const stream = await yt.download('jNQXAC9IVRw', { type: 'video+audio', quality: 'best', format: 'mp4' });
      console.log('SUCCESS with client:', type, '- stream:', !!stream);
      break;
    } catch(e) {
      console.log('FAILED with', type, ':', e.message);
    }
  }
})();
