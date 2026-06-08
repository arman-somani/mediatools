const playdl = require('play-dl');
(async () => {
  try {
    // play-dl stream needs the full URL
    const stream = await playdl.stream('https://www.youtube.com/watch?v=jNQXAC9IVRw', { quality: 0 });
    console.log('Stream SUCCESS, type:', stream.type);
  } catch(e) {
    console.error('stream FAILED:', e.message);
  }
  try {
    const info = await playdl.video_info('jNQXAC9IVRw');
    console.log('video_info by ID SUCCESS:', info.video_details.title);
  } catch(e) {
    console.error('video_info by ID FAILED:', e.message);
  }
})();
