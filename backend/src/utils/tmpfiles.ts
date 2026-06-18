import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

/**
 * Uploads a local file to tmpfiles.org and returns the DIRECT download URL.
 * It does NOT return a webpage, it returns the raw file stream URL.
 * Max size: 100GB. Retention: 60-120 minutes.
 */
export async function uploadToTmpFiles(localFilePath: string, filename: string): Promise<string> {
  try {
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

    // Returns: https://tmpfiles.org/XXXXXX/filename.mp4
    const pageUrl = uploadResponse.data.data.url;
    
    // To get the TRUE direct hotlink, we replace tmpfiles.org/ with tmpfiles.org/dl/
    const directUrl = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');

    return directUrl;
  } catch (error) {
    console.error('tmpfiles.org Upload Error:', error);
    throw error;
  }
}
