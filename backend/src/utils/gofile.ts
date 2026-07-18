import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import https from 'https';
import { PassThrough } from 'stream';

/**
 * Uploads a local file to GoFile.io and returns the download page URL
 */
export async function uploadToGoFile(
  localFilePath: string, 
  filename: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  try {
    const serverResponse = await axios.get('https://api.gofile.io/servers');
    if (serverResponse.data.status !== 'ok') {
      throw new Error('Failed to get GoFile server');
    }
    
    const serverName = serverResponse.data.data.servers[0].name;
    const safeFilename = filename.replace(/"/g, "'");

    const fileStats = fs.statSync(localFilePath);
    const fileSize = fileStats.size;
    let uploadedBytes = 0;

    const progressStream = new PassThrough();
    progressStream.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      if (onProgress) {
        const percent = Math.min(100, Math.round((uploadedBytes * 100) / fileSize));
        onProgress(percent);
      }
    });

    const form = new FormData();
    form.append('token', 'zr5lPVjXmF3Isjd2PiVtm3cgeiYWmFoN');
    form.append('file', fs.createReadStream(localFilePath).pipe(progressStream), { 
      filename: safeFilename,
      knownLength: fileSize
    });

    return await new Promise<string>((resolve, reject) => {
      const req = https.request(`https://${serverName}.gofile.io/contents/uploadfile`, {
        method: 'POST',
        headers: form.getHeaders(),
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.status !== 'ok') {
              reject(new Error('GoFile upload failed: ' + body));
            } else {
              resolve(json.data.downloadPage);
            }
          } catch (e) {
            reject(new Error('Failed to parse GoFile response: ' + body));
          }
        });
      });

      req.on('error', reject);
      form.pipe(req);
    });
  } catch (error: any) {
    console.error('GoFile Upload Error:', error.message);
    throw error;
  }
}
