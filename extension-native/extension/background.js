let port = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    const nativeHostName = 'com.mediatools.ytdlp';
    
    console.log('Sending message to native host:', nativeHostName, request);
    
    // Send to native host
    try {
      chrome.runtime.sendNativeMessage(
        nativeHostName,
        { url: request.url, format: request.format },
        function(response) {
          if (chrome.runtime.lastError) {
            console.error("Native Messaging Error:", chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log("Received response:", response);
            sendResponse(response);
          }
        }
      );
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    
    return true; // Keep channel open for async response
  }
});
