const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'mediatools.contactus@gmail.com',
    pass: 'rvfr paki klwo aueh',
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("SMTP ERROR:", error);
  } else {
    console.log("SMTP SUCCESS: Server is ready to take our messages");
  }
});
