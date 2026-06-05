import nodemailer from 'nodemailer';

const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendVerificationEmail = async (email: string, name: string, code: string): Promise<void> => {
  console.log(`\n======================================================`);
  console.log(`📧 EMAIL VERIFICATION FOR: ${email}`);
  console.log(`🔑 VERIFICATION CODE: ${code}`);
  console.log(`======================================================\n`);

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'MediaTools'}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Verify your MediaTools account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f23; color: #fff; padding: 40px; border-radius: 12px;">
          <h1 style="color: #a855f7; margin-bottom: 8px;">Welcome to MediaTools!</h1>
          <p style="color: #94a3b8; margin-bottom: 24px;">Hi ${name}, please use the following 6-digit code to verify your email address.</p>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #fff;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px;">This code expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log(`✅ Verification email sent via SMTP to ${email}`);
  } catch (error) {
    console.error(`⚠️ SMTP Error: Could not send email:`, error);
  }
};

export const sendPasswordResetEmail = async (email: string, name: string, token: string): Promise<void> => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
  const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

  console.log(`\n======================================================`);
  console.log(`🔐 PASSWORD RESET REQUESTED FOR: ${email}`);
  console.log(`🔗 RESET LINK: ${resetUrl}`);
  console.log(`======================================================\n`);

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'MediaTools'}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Reset your MediaTools password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f23; color: #fff; padding: 40px; border-radius: 12px;">
          <h1 style="color: #a855f7; margin-bottom: 8px;">Password Reset</h1>
          <p style="color: #94a3b8; margin-bottom: 24px;">Hi ${name}, click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #a855f7, #6366f1); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px;">If you didn't request this, please ignore this email. Your password won't change.</p>
        </div>
      `,
    });
    console.log(`✅ Password reset email sent via SMTP to ${email}`);
  } catch (error) {
    console.error(`⚠️ SMTP Error: Could not send email:`, error);
  }
};

export const sendContactEmail = async (name: string, email: string, message: string): Promise<void> => {
  const adminEmail = process.env.FROM_EMAIL || 'mediatools.contactus@gmail.com';

  console.log(`\n======================================================`);
  console.log(`📩 NEW CONTACT FORM SUBMISSION FROM: ${name} (${email})`);
  console.log(`======================================================\n`);

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${name} (via MediaTools Contact)" <${process.env.FROM_EMAIL}>`,
      replyTo: email,
      to: adminEmail,
      subject: `New Contact Form Message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f23; color: #fff; padding: 40px; border-radius: 12px;">
          <h1 style="color: #a855f7; margin-bottom: 8px;">New Contact Message</h1>
          <p style="color: #94a3b8; margin-bottom: 24px;">You have received a new message from the MediaTools Contact Us page.</p>
          
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #a855f7;">${email}</a></p>
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 15px 0;" />
            <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
          </div>
        </div>
      `,
    });
    console.log(`✅ Contact email sent to admin (${adminEmail})`);
  } catch (error) {
    console.error(`⚠️ SMTP Error: Could not send contact email:`, error);
    throw error; // Throw to handle in the route
  }
};
