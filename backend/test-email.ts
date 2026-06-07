import dotenv from 'dotenv';
dotenv.config();

import { sendVerificationEmail } from './src/utils/email';

const run = async () => {
  try {
    console.log('Attempting to send OTP email...');
    // sending to self to verify it works
    await sendVerificationEmail(process.env.SMTP_USER || 'mediatools.contactus@gmail.com', 'Test User', '123456');
    console.log('Test completed.');
  } catch (err) {
    console.error('Test failed with error:', err);
  }
};

run();
