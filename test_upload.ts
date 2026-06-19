import { uploadToTmpFiles } from './backend/src/utils/tmpfiles';
import { uploadToGoFile } from './backend/src/utils/gofile';
import fs from 'fs';

const testFile = 'test.txt';
fs.writeFileSync(testFile, 'Hello world');

async function test() {
  try {
    console.log('Testing tmpfiles...');
    const url1 = await uploadToTmpFiles(testFile, 'test.txt');
    console.log('Tmpfiles URL:', url1);
  } catch (e) {
    console.error('Tmpfiles error:', e);
  }

  try {
    console.log('Testing gofile...');
    const url2 = await uploadToGoFile(testFile, 'test.txt');
    console.log('Gofile URL:', url2);
  } catch (e) {
    console.error('Gofile error:', e);
  }
}

test();
