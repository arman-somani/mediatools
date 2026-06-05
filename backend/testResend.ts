import { Resend } from 'resend';

const resend = new Resend('re_Fuu7fecy_MLKPLQWwTdJZQnkKcsWzmR8C');
const email = 'arman.somani129354@marwadiuniversity.ac.in';

async function testEmail() {
  console.log(`Testing Resend API to: ${email}`);
  try {
    const response = await resend.emails.send({
      from: 'MediaTools <onboarding@resend.dev>',
      to: email,
      subject: 'Test Email',
      html: '<p>This is a test</p>'
    });
    
    console.log('Response:', JSON.stringify(response, null, 2));
    
    if (response.error) {
      console.error('RESEND API RETURNED AN ERROR:', response.error);
    } else {
      console.log('SUCCESS! Email sent.');
    }
  } catch (err) {
    console.error('CAUGHT EXCEPTION:', err);
  }
}

testEmail();
