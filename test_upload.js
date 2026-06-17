const fs = require('fs');
const axios = require('axios');

async function testTransfer() {
    try {
        fs.writeFileSync('testfile.mp4', 'dummy content for testing upload speeds and links');
        
        console.log('Testing transfer.sh...');
        const res = await axios.put('https://transfer.sh/testfile.mp4', fs.readFileSync('testfile.mp4'));
        console.log('Transfer response:\n', res.data);
    } catch (e) {
        console.error('Transfer failed', e.message);
    }
}

testTransfer();
