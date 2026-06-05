import fs from 'fs';
import path from 'path';

const outputDir = process.env.OUTPUT_DIR || path.join(__dirname, '../../outputs');
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

export const cleanupOldFiles = (): void => {
  const ttlMs = parseInt(process.env.FILE_TTL_HOURS || '1') * 60 * 60 * 1000;
  const now = Date.now();

  [outputDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) return;

    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > ttlMs) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Cleaned up: ${file}`);
        }
      } catch {
        // File may have already been deleted
      }
    });
  });
};
