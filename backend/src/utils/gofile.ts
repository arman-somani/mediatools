import axios from 'axios';
import fs from 'fs';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

/**
 * Uploads a local file to GoFile.io and returns the download page URL
 */
export async function uploadToGoFile(localFilePath: string, filename: string): Promise<string> {
  try {
    // 1. Get the best available server
    const serverResponse = await axios.get('https://api.gofile.io/servers');
    if (serverResponse.data.status !== 'ok') {
      throw new Error('Failed to get GoFile server');
    }
    
    // Choose the first available server
    const serverName = serverResponse.data.data.servers[0].name;

    // 2. Upload the file to that server using CURL instead of Axios
    // We use CURL because Node's Axios buffer often crashes with EPROTO on 2GB+ streams
    
    // Clean filename for curl: remove double quotes to avoid parsing issues inside curl's -F parameter
    const safeFilename = filename.replace(/"/g, "'");

    const args = [
      '-s', 
      '-F', 'token=zr5lPVjXmF3Isjd2PiVtm3cgeiYWmFoN',
      '-F', `file=@${localFilePath};filename="${safeFilename}"`,
      `https://${serverName}.gofile.io/contents/uploadfile`
    ];

    const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 });

    const responseData = JSON.parse(stdout);

    if (responseData.status !== 'ok') {
      throw new Error('GoFile upload failed: ' + JSON.stringify(responseData));
    }

    // GoFile returns a downloadPage (a webpage link to download the file)
    // E.g., "https://gofile.io/d/XXXXXX"
    return responseData.data.downloadPage;
  } catch (error) {
    console.error('GoFile Upload Error:', error);
    throw error;
  }
}
