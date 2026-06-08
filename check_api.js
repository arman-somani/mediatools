const https = require('https');

const options = {
  hostname: 'youtube-media-downloader.p.rapidapi.com',
  path: '/v2/video/details?videoId=BaW_jenozKc',
  method: 'GET',
  headers: {
    'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
    'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com'
  }
};

const req = https.request(options, (res) => {
  console.log('--- HEADERS ---');
  console.log('Requests Limit:', res.headers['x-ratelimit-requests-limit'] || res.headers['x-ratelimit-limit']);
  console.log('Requests Remaining:', res.headers['x-ratelimit-requests-remaining'] || res.headers['x-ratelimit-remaining']);
  console.log(res.headers);
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
