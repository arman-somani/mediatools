// Inject a secret handshake so the website knows the extension is installed
document.documentElement.dataset.hasMediatoolsExtension = 'true';
console.log('MediaTools Extension is active on this page.');
