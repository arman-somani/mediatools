const playdl = require('play-dl');
(async () => {
  try {
    console.log('Testing play-dl...');
    const info = await playdl.video_info('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log('Title:', info.video_details.title);
    const stream = await playdl.stream('https://www.youtube.com/watch?v=jNQXAC9IVRw', { quality: 2 });
    console.log('Stream type:', stream.type, '- SUCCESS');
  } catch(e) {
    console.error('play-dl FAILED:', e.message);
  }
})();
