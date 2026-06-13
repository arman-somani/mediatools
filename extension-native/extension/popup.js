document.addEventListener('DOMContentLoaded', function() {
  const urlDisplay = document.getElementById('url-display');
  const btnVideo = document.getElementById('btn-video');
  const btnAudio = document.getElementById('btn-audio');
  const statusDiv = document.getElementById('status');
  
  let currentUrl = '';

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
        showStatus('Error: Check if the Native Host is installed correctly.', 'error');
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

  btnVideo.addEventListener('click', () => download('video'));
  btnAudio.addEventListener('click', () => download('audio'));
});
