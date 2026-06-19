function restartAndRunAll() {
    console.log("Initiating 60-minute Restart & Run All...");
    
    // 1. Click the 'Runtime' menu at the top
    const runtimeMenu = document.querySelector('colab-menu[for="runtime-menu"]');
    if (runtimeMenu) runtimeMenu.click();

    setTimeout(() => {
        // 2. Find and click 'Restart session and run all'
        const items = document.querySelectorAll('colab-menu-item');
        for (let item of items) {
            if (item.innerText.includes('Restart session and run all') || item.innerText.includes('Restart and run all')) {
                item.click();
                break;
            }
        }
        
        // 3. Click the "Yes" button on the confirmation popup
        setTimeout(() => {
            const okBtn = document.querySelector('colab-dialog paper-button.primary, paper-button[dialog-confirm]');
            if (okBtn) okBtn.click();
            console.log("Restart confirmed. Booting fresh server...");
        }, 1500);
        
    }, 500);
}

// Set to run exactly every 60 minutes (3,600,000 milliseconds)
setInterval(restartAndRunAll, 3600000);

// Also run a tiny keep-alive clicker so Colab doesn't disconnect in the middle of the 60 minutes
setInterval(() => {
   const connectBtn = document.querySelector("colab-connect-button");
   if(connectBtn && connectBtn.shadowRoot) {
        const actualBtn = connectBtn.shadowRoot.querySelector("#connect");
        if(actualBtn) actualBtn.click();
   }
}, 60000);

console.log("✅ Colab 24/7 Restarter Bot Activated! The server will now forcefully restart every 60 minutes.");
