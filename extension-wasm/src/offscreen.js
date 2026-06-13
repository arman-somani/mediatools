import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target === 'offscreen' && request.action === 'merge') {
    mergeFiles(request.videoUrl, request.audioUrl, request.title)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error("Offscreen Error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // async
  }
});

async function mergeFiles(videoUrl, audioUrl, title) {
  if (!ffmpeg) {
    console.log("Loading FFmpeg core...");
    ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: chrome.runtime.getURL('ffmpeg-core.js'),
      wasmURL: chrome.runtime.getURL('ffmpeg-core.wasm')
    });
    console.log("FFmpeg core loaded!");
  }

  // Download chunks into memory using fetch
  // Note: googlevideo.com requires range requests or plain fetch, but since it's an extension, CORS is bypassed.
  console.log("Downloading video chunk...");
  const vRes = await fetch(videoUrl);
  if (!vRes.ok) throw new Error("Failed to fetch video: " + vRes.status);
  const vData = await vRes.arrayBuffer();
  await ffmpeg.writeFile('video.mp4', new Uint8Array(vData));

  console.log("Downloading audio chunk...");
  const aRes = await fetch(audioUrl);
  if (!aRes.ok) throw new Error("Failed to fetch audio: " + aRes.status);
  const aData = await aRes.arrayBuffer();
  await ffmpeg.writeFile('audio.m4a', new Uint8Array(aData));

  console.log("Merging files...");
  // -c copy is extremely fast as it just remuxes without re-encoding
  await ffmpeg.exec(['-i', 'video.mp4', '-i', 'audio.m4a', '-c', 'copy', 'output.mp4']);

  console.log("Reading result...");
  const data = await ffmpeg.readFile('output.mp4');
  
  // Create download link
  const blob = new Blob([data.buffer], { type: 'video/mp4' });
  const objectUrl = URL.createObjectURL(blob);

  console.log("Triggering browser download...");
  chrome.downloads.download({
    url: objectUrl,
    filename: `${title}.mp4`,
    saveAs: true
  });

  // Free WASM memory
  await ffmpeg.deleteFile('video.mp4');
  await ffmpeg.deleteFile('audio.m4a');
  await ffmpeg.deleteFile('output.mp4');
  
  // URL object cannot be immediately revoked if download takes a moment to initiate
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000); 

  return true;
}
