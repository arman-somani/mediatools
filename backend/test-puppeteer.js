const { interceptYoutubeStreams } = require('./dist/utils/puppeteerInterceptor');

(async () => {
    try {
        console.log('Testing Puppeteer Interception on YouTube...');
        const result = await interceptYoutubeStreams('https://www.youtube.com/watch?v=jNQXAC9IVRw', 'universal');
        console.log('Intercepted Result:');
        console.log('Video URL exists:', !!result.videoUrl);
        console.log('Audio URL exists:', !!result.audioUrl);
        if (result.videoUrl) console.log('Video URL (first 100 chars):', result.videoUrl.substring(0, 100));
        if (result.audioUrl) console.log('Audio URL (first 100 chars):', result.audioUrl.substring(0, 100));
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
})();
