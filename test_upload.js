const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { spawn } = require('child_process');

const testFile = 'test.txt';
fs.writeFileSync(testFile, 'Hello world from test script!');

async function testTmpfiles() {
  console.log('Testing tmpfiles.org...');
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile), { filename: testFile });

    const uploadResponse = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    console.log('Tmpfiles success:', uploadResponse.data);
  } catch (e) {
    console.error('Tmpfiles error:', e.message);
  }
}

async function testGoFile() {
  console.log('Testing gofile.io...');
  try {
    const serverResponse = await axios.get('https://api.gofile.io/servers');
    const serverName = serverResponse.data.data.servers[0].name;
    const args = [
      '-F', 'token=zr5lPVjXmF3Isjd2PiVtm3cgeiYWmFoN',
      '-F', `file=@${testFile};filename="${testFile}"`,
      `https://${serverName}.gofile.io/contents/uploadfile`
    ];

    await new Promise((resolve, reject) => {
      const curl = spawn('curl', args);
      let stdoutData = '';
      curl.stdout.on('data', (data) => stdoutData += data.toString());
      curl.stderr.on('data', (data) => {}); // ignore stderr progress
      curl.on('close', (code) => {
        if (code !== 0) reject(new Error('curl exit ' + code));
        else {
          console.log('GoFile success:', stdoutData);
          resolve();
        }
      });
      curl.on('error', (err) => reject(new Error('Spawn error: ' + err.message)));
    });
  } catch (e) {
    console.error('GoFile error:', e.message);
  }
}

async function run() {
  await testTmpfiles();
  await testGoFile();
}
run();
