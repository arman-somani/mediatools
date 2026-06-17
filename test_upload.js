const fs = require('fs');
const axios = require('axios');

async function testPixeldrain() {
    try {
        fs.writeFileSync('test_video.mp4', 'dummy content for testing upload speeds and links');
        
        console.log('Testing pixeldrain...');
        const fileData = fs.readFileSync('test_video.mp4');
        const res = await axios.put('https://pixeldrain.com/api/file/test_video.mp4', fileData);
        console.log('Pixeldrain response:\n', res.data);
        if (res.data.success) {
            console.log('Direct download link: https://pixeldrain.com/api/file/' + res.data.id + '?download');
        }
    } catch (e) {
        console.error('Pixeldrain failed', e.message);
    }
}

testPixeldrain();
