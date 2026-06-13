import ytdl from '@distube/ytdl-core';

let creating; // Promise for offscreen document

async function setupOffscreenDocument(path) {
  if (await chrome.offscreen.hasDocument()) return;
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'To run ffmpeg.wasm in the browser'
    });
    await creating;
    creating = null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download_video') {
    handleDownload(request.url)
      .then(result => sendResponse(result))
      .catch(err => {
        console.error("Download Error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }
});

async function handleDownload(url) {
  console.log("Fetching formats for:", url);
  // 1. Fetch info using ytdl-core (bypasses IP blocks because it uses the user's browser!)
  const info = await ytdl.getInfo(url);
  
  // 2. Select 1080p video and best audio
  let videoFormat;
  try {
    videoFormat = ytdl.chooseFormat(info.formats, { quality: '1080p', filter: 'videoonly' });
  } catch(e) {
    // Fallback if 1080p isn't available
    videoFormat = ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'videoonly' });
  }
  
  const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

  if (!videoFormat || !audioFormat) {
    throw new Error('Could not find suitable video or audio formats.');
  }

  console.log("Video Format:", videoFormat.url);
  console.log("Audio Format:", audioFormat.url);

  // 3. Setup Offscreen document for ffmpeg processing
  await setupOffscreenDocument('offscreen.html');

  // 4. Send direct URLs to offscreen document
  const safeTitle = info.videoDetails.title.replace(/[^\w\s-]/gi, '').trim() || 'Downloaded_Video';
  
  return new Promise((resolve, reject) => {
    console.log("Sending merge request to offscreen document...");
    chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'merge',
      videoUrl: videoFormat.url,
      audioUrl: audioFormat.url,
      title: safeTitle
    }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!response || !response.success) return reject(new Error(response?.error || 'Unknown error during merge'));
      resolve({ success: true, title: safeTitle });
    });
  });
}
