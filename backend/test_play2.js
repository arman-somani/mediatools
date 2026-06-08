const play = require('play-dl');
const fs = require('fs');
(async () => {
    try {
        const stream = await play.stream('https://www.youtube.com/watch?v=jNQXAC9IVRw', { quality: 2 });
        console.log('Stream works:', !!stream.url);
    } catch(e) {
        console.error('Play-dl error:', e);
    }
})();
