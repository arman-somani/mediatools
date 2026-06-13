document.addEventListener('DOMContentLoaded', function() {
  const urlDisplay = document.getElementById('url-display');
  const btnVideo = document.getElementById('btn-video');
  const btnAudio = document.getElementById('btn-audio');
  const btnSetup = document.getElementById('btn-setup');
  const statusDiv = document.getElementById('status');
  
  const loadingUi = document.getElementById('loading-ui');
  const missingHostUi = document.getElementById('missing-host-ui');
  const mainUi = document.getElementById('main-ui');

  let currentUrl = '';

  // Check if Native Host is installed
  chrome.runtime.sendMessage({ action: 'check_host' }, function(response) {
    loadingUi.style.display = 'none';
    if (response && response.installed) {
      mainUi.style.display = 'block';
      initializeMainUI();
    } else {
      missingHostUi.style.display = 'block';
    }
  });

  btnSetup.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000/setup-engine' });
  });

  function initializeMainUI() {
    // Get current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = tabs[0].url;
      if (url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'))) {
        currentUrl = url;
        urlDisplay.textContent = url;
        btnVideo.disabled = false;
        btnAudio.disabled = false;
      } else {
        urlDisplay.textContent = 'Please open a YouTube video.';
      }
    });

    btnVideo.addEventListener('click', () => download('video'));
    btnAudio.addEventListener('click', () => download('audio'));
  }

  function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
  }

  function download(format) {
    btnVideo.disabled = true;
    btnAudio.disabled = true;
    showStatus('Sending to native host...', 'loading');

    chrome.runtime.sendMessage({
      action: 'download',
      url: currentUrl,
      format: format
    }, function(response) {
      if (!response) {
        showStatus('Error: The Native Host stopped responding.', 'error');
        btnVideo.disabled = false;
        btnAudio.disabled = false;
        return;
      }
      
      if (response.success) {
        showStatus(response.message || 'Download triggered successfully!', 'success');
      } else {
        showStatus(response.error || 'Unknown error occurred.', 'error');
      }
      
      setTimeout(() => {
        btnVideo.disabled = false;
        btnAudio.disabled = false;
      }, 3000);
    });
  }
});
