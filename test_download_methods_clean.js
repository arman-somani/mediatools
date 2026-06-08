/**
 * Test suite for YouTube downloader methods
 * Tests all fallback methods to ensure at least one is working
 */

const http = require('http');
const https = require('https');

const testResults = [];
const YOUTUBE_TEST_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const VIDEO_ID = 'dQw4w9WgXcQ';

async function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testCobaltAPI() {
  const start = Date.now();
  try {
    console.log('\n📡 Testing Cobalt API...');
    
    const instResp = await makeRequest({
      hostname: 'instances.cobalt.tools',
      path: '/api/instances',
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });

    if (!Array.isArray(instResp.data)) {
      throw new Error('Invalid instances response');
    }

    const instances = instResp.data
      .filter((i) => i.score > 85)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (instances.length === 0) {
      throw new Error('No high-score instances found');
    }

    console.log(`Found ${instances.length} Cobalt instances`);

    for (const inst of instances) {
      try {
        const resp = await makeRequest(
          {
            hostname: inst.domain,
            path: '/api/json',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000,
          },
          {
            url: YOUTUBE_TEST_URL,
            downloadMode: 'audio',
            audioFormat: 'mp3',
            audioBitrate: '192'
          }
        );

        if (resp.status === 200 && resp.data.url) {
          console.log(`✅ Cobalt instance ${inst.domain} working!`);
          testResults.push({
            method: `Cobalt API (${inst.domain})`,
            success: true,
            message: 'Successfully retrieved download URL',
            duration: Date.now() - start,
          });
          return;
        }
      } catch (e) {
        console.log(`❌ ${inst.domain}: ${e.message}`);
      }
    }

    throw new Error('No working Cobalt instances');
  } catch (e) {
    testResults.push({
      method: 'Cobalt API',
      success: false,
      message: 'Failed to connect to Cobalt',
      error: e.message,
      duration: Date.now() - start,
    });
    console.error(`❌ Cobalt API failed: ${e.message}`);
  }
}

async function testPipedAPI() {
  const start = Date.now();
  try {
    console.log('\n📡 Testing Piped API...');
    const instances = [
      'pipedapi.kavin.rocks',
      'pipedapi.moomoo.me',
      'pipedapi.syncpundit.io'
    ];

    for (const domain of instances) {
      try {
        const resp = await makeRequest({
          hostname: domain,
          path: `/streams/${VIDEO_ID}`,
          method: 'GET',
          timeout: 10000,
        });

        if (resp.status === 200 && resp.data.videoStreams) {
          const hasAudio = resp.data.audioStreams && resp.data.audioStreams.length > 0;
          if (hasAudio) {
            console.log(`✅ Piped instance ${domain} working!`);
            testResults.push({
              method: `Piped API (${domain})`,
              success: true,
              message: `Got ${resp.data.videoStreams.length} video + ${resp.data.audioStreams.length} audio streams`,
              duration: Date.now() - start,
            });
            return;
          }
        }
      } catch (e) {
        console.log(`❌ ${domain}: ${e.message}`);
      }
    }

    throw new Error('No working Piped instances');
  } catch (e) {
    testResults.push({
      method: 'Piped API',
      success: false,
      message: 'Failed to get streams from Piped',
      error: e.message,
      duration: Date.now() - start,
    });
    console.error(`❌ Piped API failed: ${e.message}`);
  }
}

async function testInvidiousAPI() {
  const start = Date.now();
  try {
    console.log('\n📡 Testing Invidious API...');
    const instances = [
      'invidious.nerdvpn.de',
      'invidious.flokinet.to',
      'inv.tux.pizza',
      'vid.puffyan.us'
    ];

    for (const domain of instances) {
      try {
        const resp = await makeRequest({
          hostname: domain,
          path: `/api/v1/videos/${VIDEO_ID}`,
          method: 'GET',
          timeout: 10000,
        });

        if (resp.status === 200 && resp.data.formatStreams) {
          console.log(`✅ Invidious instance ${domain} working!`);
          testResults.push({
            method: `Invidious API (${domain})`,
            success: true,
            message: `Got ${resp.data.formatStreams.length} format streams`,
            duration: Date.now() - start,
          });
          return;
        }
      } catch (e) {
        console.log(`❌ ${domain}: ${e.message}`);
      }
    }

    throw new Error('No working Invidious instances');
  } catch (e) {
    testResults.push({
      method: 'Invidious API',
      success: false,
      message: 'Failed to get streams from Invidious',
      error: e.message,
      duration: Date.now() - start,
    });
    console.error(`❌ Invidious API failed: ${e.message}`);
  }
}

function printResults() {
  console.log('\n\n' + '='.repeat(80));
  console.log('                        TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  const successful = testResults.filter(r => r.success);
  console.log(`\n✅ Successful: ${successful.length}/${testResults.length}\n`);

  for (const result of testResults) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.method}`);
    console.log(`   Message: ${result.message}`);
    if (result.error) console.log(`   Error: ${result.error}`);
    console.log(`   Duration: ${result.duration}ms\n`);
  }

  if (successful.length === 0) {
    console.warn('\n⚠️  WARNING: No download methods are working!');
    console.log('Please check your internet connection and API availability.');
  } else {
    console.log(`✅ At least ${successful.length} method(s) are working. YouTube downloads should succeed!`);
  }

  console.log('='.repeat(80) + '\n');
}

async function runAllTests() {
  console.log('🚀 Starting YouTube Downloader Test Suite\n');
  console.log(`Testing with video: ${YOUTUBE_TEST_URL}\n`);

  // Test external APIs
  await testCobaltAPI();
  await testPipedAPI();
  await testInvidiousAPI();

  // Print summary
  printResults();
}

// Run tests
runAllTests().catch(console.error);
