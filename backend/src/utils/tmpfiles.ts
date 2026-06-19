import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

export async function uploadToTmpFiles(filePath: string): Promise<string> {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  try {
    const response = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
      headers: {
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (response.data?.status === 'success' && response.data?.data?.url) {
      // The API returns https://tmpfiles.org/12345/video.mp4 (Preview page)
      // We convert it to https://tmpfiles.org/dl/12345/video.mp4 (Direct download)
      const rawUrl = response.data.data.url;
      const directDlUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      return directDlUrl;
    }
    throw new Error('Invalid response from tmpfiles.org');
  } catch (error: any) {
    console.error('tmpfiles.org upload failed:', error.message);
    throw error;
  }
}
