const nativeHostName = 'com.mediatools.ytdlp';

function checkHostStatus(sendResponse) {
  try {
    chrome.runtime.sendNativeMessage(
      nativeHostName,
      { action: 'ping' },
      function(response) {
        if (chrome.runtime.lastError) {
          if (sendResponse) sendResponse({ success: false, installed: false });
        } else {
          if (sendResponse) sendResponse({ success: true, installed: true });
        }
      }
    );
  } catch (e) {
    if (sendResponse) sendResponse({ success: false, installed: false });
  }
}

// Check if host is installed right when the extension is added to Chrome
chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.sendNativeMessage(nativeHostName, { action: 'ping' }, function(response) {
    if (chrome.runtime.lastError) {
      // Host is missing or not registered, redirect to setup page
      chrome.tabs.create({ url: 'http://localhost:3000/setup-engine' });
    } else {
      console.log('MediaTools Engine is already installed and alive.');
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'check_host') {
    checkHostStatus(sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === 'download') {
    console.log('Sending message to native host:', request);
    
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
