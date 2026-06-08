const https = require('https');

const options = {
  hostname: 'cloud-api-hub-youtube-downloader.p.rapidapi.com',
  path: '/info?id=BaW_jenozKc',
  method: 'GET',
  headers: {
    'x-rapidapi-key': '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e',
    'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com'
  }
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
