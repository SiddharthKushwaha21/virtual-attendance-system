// server/utils/emailService.js
const nodemailer = require('nodemailer')

// Gmail SMTP transporter — free tier supports up to ~500 emails/day.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// Verify the connection once at server startup so misconfigurations are caught early.
const verifyEmailConnection = async () => {
  try {
    await transporter.verify()
    console.log('✅ Email service connected (Gmail SMTP)')
  } catch (err) {
    console.log('❌ Email service connection failed:', err.message)
  }
}

// Send a single email. Returns { success, messageId } or { success: false, error }.
const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Attendance System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    })
    console.log(`📧 Email sent → ${to} (${info.messageId})`)
    return { success: true, messageId: info.messageId }
  } catch (err) {
    console.error(`❌ Email failed → ${to}:`, err.message)
    return { success: false, error: err.message }
  }
}

// Send multiple emails sequentially with a 500 ms gap to respect Gmail rate limits.
const sendBulkEmails = async (emailList) => {
  const results = []
  for (const emailData of emailList) {
    const result = await sendEmail(emailData)
    results.push({ ...result, to: emailData.to })
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return results
}

module.exports = { sendEmail, sendBulkEmails, verifyEmailConnection }