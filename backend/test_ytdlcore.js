const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
(async () => {
    try {
        const info = await ytdl.getInfo('https://www.youtube.com/watch?v=jNQXAC9IVRw');
        console.log('Title:', info.videoDetails.title);
        console.log('Formats length:', info.formats.length);
    } catch(e) {
        console.error('ytdl-core error:', e);
    }
})();
