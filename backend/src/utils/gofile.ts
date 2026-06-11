import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

/**
 * Uploads a local file to GoFile.io and returns the download page URL
 */
export async function uploadToGoFile(localFilePath: string): Promise<string> {
  try {
    // 1. Get the best available server
    const serverResponse = await axios.get('https://api.gofile.io/servers');
    if (serverResponse.data.status !== 'ok') {
      throw new Error('Failed to get GoFile server');
    }
    
    // Choose the first available server
    const serverName = serverResponse.data.data.servers[0].name;

    // 2. Upload the file to that server
    const form = new FormData();
    // Link uploads to the user's GoFile account
    form.append('token', 'zr5lPVjXmF3Isjd2PiVtm3cgeiYWmFoN');
    form.append('file', fs.createReadStream(localFilePath));

    const uploadResponse = await axios.post(`https://${serverName}.gofile.io/contents/uploadfile`, form, {
      headers: form.getHeaders()
    });

    if (uploadResponse.data.status !== 'ok') {
      throw new Error('GoFile upload failed: ' + JSON.stringify(uploadResponse.data));
    }

    // GoFile returns a downloadPage (a webpage link to download the file)
    // E.g., "https://gofile.io/d/XXXXXX"
    return uploadResponse.data.data.downloadPage;
  } catch (error) {
    console.error('GoFile Upload Error:', error);
    throw error;
  }
}
