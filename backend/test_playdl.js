const play = require('play-dl');

(async () => {
  const videoInfo = await play.video_info('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  console.log('Got video info:', videoInfo.video_details.title);
  
  const stream = await play.stream_from_info(videoInfo, { quality: 2 });
  console.log('Stream URL:', stream.url);
})();
