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
  console.log("Requesting formats from backend...");
  
  // Use the backend to decipher the URLs. 
  // This avoids bundling 10MB of Node dependencies (ytdl-core) into the extension.
  // The actual heavy lifting (downloading chunks & merging) will still happen in the browser via ffmpeg.wasm using the user's IP!
  const backendUrl = 'http://localhost:5000/api/convert/youtube-formats'; // Change to live URL later
  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  
  if (!response.ok) throw new Error("Failed to fetch formats from backend: " + response.status);
  const data = await response.json();
  if (!data.success) throw new Error(data.message || data.error || "Failed to parse formats");

  console.log("Formats received from backend!");

  // Setup Offscreen document for ffmpeg processing
  await setupOffscreenDocument('offscreen.html');

  const safeTitle = (data.title || 'Downloaded_Video').replace(/[^\w\s-]/gi, '').trim() || 'Downloaded_Video';
  
  return new Promise((resolve, reject) => {
    console.log("Sending merge request to offscreen document...");
    chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'merge',
      videoUrl: data.videoUrl,
      audioUrl: data.audioUrl,
      title: safeTitle
    }, (mergeRes) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!mergeRes || !mergeRes.success) return reject(new Error(mergeRes?.error || 'Unknown error during merge'));
      resolve({ success: true, title: safeTitle });
    });
  });
}
