import axios from 'axios';
import fs from 'fs';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

/**
 * Uploads a local file to GoFile.io and returns the download page URL
 */
import { spawn } from 'child_process';

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

    const args = [
      '-F', 'token=zr5lPVjXmF3Isjd2PiVtm3cgeiYWmFoN',
      '-F', `file=@${localFilePath};filename="${safeFilename}"`,
      `https://${serverName}.gofile.io/contents/uploadfile`
    ];

    return new Promise((resolve, reject) => {
      const curl = spawn('curl', args);
      let stdoutData = '';

      curl.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      curl.stderr.on('data', (data) => {
        const output = data.toString();
        // Parse curl progress table
        // Format: % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
        //                                 Dload  Upload   Total   Spent    Left  Speed
        // 10 1000M    0     0   10  100M      0  10.0M  0:01:40  0:00:10  0:01:30 10.0M
        const lines = output.trim().split(/[\r\n]+/);
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
          const parts = lastLine.trim().split(/\s+/);
          // In curl progress table, the first column is % Total, but for upload, it's the % Xferd (column 5 or 6 depending on alignment)
          // Wait, curl outputs carriage returns (\r) to overwrite the line.
          const match = output.match(/(\d+)\s+\w+\s+\d+\s+\w+\s+(\d+)/g);
          if (match && match.length > 0) {
             const lastMatch = match[match.length - 1];
             const uploadPercentStr = lastMatch.trim().split(/\s+/)[2];
             if (uploadPercentStr && !isNaN(parseInt(uploadPercentStr))) {
               if (onProgress) onProgress(parseInt(uploadPercentStr));
             }
          }
        }
      });

      curl.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`curl exited with code ${code}`));
          return;
        }
        try {
          const responseData = JSON.parse(stdoutData);
          if (responseData.status !== 'ok') {
            reject(new Error('GoFile upload failed: ' + stdoutData));
          } else {
            resolve(responseData.data.downloadPage);
          }
        } catch (e) {
          reject(new Error('Failed to parse GoFile response: ' + stdoutData));
        }
      });
    });
  } catch (error) {
    console.error('GoFile Upload Error:', error);
    throw error;
  }
}
