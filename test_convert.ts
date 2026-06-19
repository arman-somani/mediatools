import axios from 'axios';

async function test() {
  try {
    console.log('Sending request for 4K video...');
    const res = await axios.post('http://localhost:5000/api/convert/universal', {
      url: 'https://www.youtube.com/watch?v=LXb3EKWsInQ',
      videoQuality: '4K'
    });
    console.log('Response:', res.data);
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
