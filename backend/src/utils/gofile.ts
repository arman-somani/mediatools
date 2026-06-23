import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

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

    const form = new FormData();
    form.append('token', 'zr5lPVjXmF3Isjd2PiVtm3cgeiYWmFoN');
    form.append('file', fs.createReadStream(localFilePath), { filename: safeFilename });

    const response = await axios.post(`https://${serverName}.gofile.io/contents/uploadfile`, form, {
      headers: { ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (onProgress) onProgress(percent);
        }
      }
    });

    if (response.data?.status !== 'ok') {
      throw new Error('GoFile upload failed: ' + JSON.stringify(response.data));
    }

    return response.data.data.downloadPage;
  } catch (error: any) {
    console.error('GoFile Upload Error:', error.message);
    throw error;
  }
}
