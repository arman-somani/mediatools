const fs = require('fs');
const FormData = require('form-data');
const https = require('https');
const { PassThrough } = require('stream');

async function test() {
  const dummyFile = 'dummy.bin';
  if (!fs.existsSync(dummyFile)) {
    fs.writeFileSync(dummyFile, Buffer.alloc(10 * 1024 * 1024)); // 10MB
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
  
  return new Promise((resolve, reject) => {
    const req = https.request('https://httpbin.org/post', {
      method: 'POST',
      headers: form.getHeaders()
    }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', (e) => {
      console.log('Finished with error', e.message);
      resolve();
    });
    form.pipe(req);
  });
}

test();
