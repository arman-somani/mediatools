const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const { PassThrough } = require('stream');

async function test() {
  const dummyFile = 'dummy.bin';
  if (!fs.existsSync(dummyFile)) {
    fs.writeFileSync(dummyFile, Buffer.alloc(100 * 1024 * 1024)); // 100MB
  }

  const fileSize = fs.statSync(dummyFile).size;
  let uploadedBytes = 0;

  const progressStream = new PassThrough();
  progressStream.on('data', (chunk) => {
    uploadedBytes += chunk.length;
    console.log(`Uploaded ${uploadedBytes} bytes`);
  });

  const form = new FormData();
  form.append('file', fs.createReadStream(dummyFile).pipe(progressStream), { knownLength: fileSize, filename: 'dummy.bin' });

  console.log('Sending...');
  
  try {
    await axios.post('http://127.0.0.1:9999', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch(e) {
    console.log('Finished with error', e.message);
  }
}

test();
