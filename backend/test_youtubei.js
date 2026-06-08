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
      cache: new UniversalCache(false)
    });
    
    console.log('Fetching info...');
    const info = await yt.getInfo('jNQXAC9IVRw');
    const audioFormats = info.streaming_data.formats.filter(f => f.has_audio && !f.has_video);
    const adaptiveAudio = info.streaming_data.adaptive_formats.filter(f => f.has_audio && !f.has_video);
    
    console.log('Audio formats:', audioFormats.length);
    console.log('Adaptive audio:', adaptiveAudio.length);
    if (adaptiveAudio.length > 0) {
      console.log(adaptiveAudio[0].mime_type, adaptiveAudio[0].url ? 'Has URL' : (adaptiveAudio[0].signature_cipher ? 'Has Cipher' : 'No URL or Cipher'));
    }
  } catch(e) {
    console.error(e);
  }
})();
