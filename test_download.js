const http = require('http');

const data = JSON.stringify({
  url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  quality: '720p'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/convert/youtube-Video',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log(STATUS: );
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(BODY: );
  });
});

req.on('error', (e) => {
  console.error(problem with request: );
});

req.write(data);
req.end();
