import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { uploadToGoFile } from './gofile';

/**
 * Uploads a local file to tmpfiles.org or GoFile based on size.
 * TmpFiles is used for files < 90MB (direct link).
 * GoFile is used for files >= 90MB (redirect link).
 */
export async function uploadToTmpFiles(localFilePath: string, filename: string): Promise<string> {
  try {
    const stats = fs.statSync(localFilePath);
    const sizeMB = stats.size / (1024 * 1024);

    if (sizeMB > 90) {
      console.log(`[Hybrid CDN] File is ${sizeMB.toFixed(2)} MB. Uploading to GoFile...`);
      return await uploadToGoFile(localFilePath);
    }

    console.log(`[Hybrid CDN] File is ${sizeMB.toFixed(2)} MB. Uploading to TmpFiles...`);
    const form = new FormData();
    form.append('file', fs.createReadStream(localFilePath), { filename });

    const uploadResponse = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (uploadResponse.data.status !== 'success') {
      throw new Error('tmpfiles.org upload failed: ' + JSON.stringify(uploadResponse.data));
    }

    const pageUrl = uploadResponse.data.data.url;
    const directUrl = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    return directUrl;
  } catch (error) {
    console.error('Hybrid CDN Upload Error:', error);
    throw error;
  }
}
