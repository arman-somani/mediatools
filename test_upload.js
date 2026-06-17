const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

async function testOshi() {
    try {
        fs.writeFileSync('testfile.mp4', 'dummy content for testing upload speeds and links');
        
        const form = new FormData();
        form.append('f', fs.createReadStream('testfile.mp4'));
        
        console.log('Testing oshi.at...');
        const res = await axios.post('https://oshi.at', form, { headers: form.getHeaders() });
        console.log('Oshi response:\n', res.data);
    } catch (e) {
        console.error('Oshi failed', e.message);
    }
}

testOshi();
