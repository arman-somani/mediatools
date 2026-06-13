document.addEventListener('DOMContentLoaded', () => {
  const urlEl = document.getElementById('url');
  const btn = document.getElementById('btn-download');
  const statusEl = document.getElementById('status');

  function setStatus(msg) {
    statusEl.style.display = 'block';
    statusEl.textContent = msg;
  }

  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    const url = tabs[0]?.url;
    if (url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'))) {
      urlEl.textContent = url;
      btn.disabled = false;
      
      btn.onclick = () => {
        btn.disabled = true;
        setStatus("Processing... This requires RAM to merge video/audio via WebAssembly. Please wait...");
        
        chrome.runtime.sendMessage({ action: 'download_video', url }, (response) => {
          if (!response) {
            setStatus("Error: Background script disconnected. Check extension errors.");
          } else if (response.success) {
            setStatus("Success! The browser download has been initiated.");
          } else {
            setStatus("Error: " + response.error);
          }
          btn.disabled = false;
        });
      };
    } else {
      urlEl.textContent = "Please open a YouTube video.";
    }
  });
});
