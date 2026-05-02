const { Resend } = require('resend');

const sendEmail = async (to, subject, text) => {
  try {
    // ✅ Initialize inside function so env var is always loaded
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'Mingle <onboarding@resend.dev>',
      to,
      subject,
      text
    });
    console.log("📧 Email sent to:", to);
  } catch (error) {
    console.error("Email error:", error.message);
  }
};

module.exports = { sendEmail };