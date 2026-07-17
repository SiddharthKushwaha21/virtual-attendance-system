// server/controllers/emailController.js
const { sendEmail, sendBulkEmails } = require('../utils/emailService')
const {
  dailyAbsentReportTemplate,
  attendanceConfirmationTemplate,
  lowAttendanceAlertTemplate,
} = require('../utils/emailTemplates')
const Attendance = require('../models/Attendance')
const Student = require('../models/Student')
const User = require('../models/User')

// ─────────────────────────────────────────────
// 1. Daily Absent Report — sent to all admins
//    GET /api/email/daily-report
// ─────────────────────────────────────────────
const sendDailyAbsentReport = async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dateStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const todayAttendance = await Attendance.find({
      date: { $gte: today, $lt: tomorrow },
    }).populate('studentId', 'name rollNo class section session email')

    const totalStudents = await Student.countDocuments()
    const presentCount = todayAttendance.filter(a => a.status === 'Present').length
    const absentStudents = todayAttendance
      .filter(a => a.status === 'Absent')
      .map(a => ({
        name: a.studentId?.name || 'Unknown',
        rollNo: a.studentId?.rollNo || '-',
        class: a.studentId?.class || a.class || '-',
        section: a.studentId?.section || a.section || '-',
        session: a.studentId?.session || a.session || '-',
        email: a.studentId?.email || null,
      }))

    const admins = await User.find({ role: 'admin' }, 'email name')
    if (!admins.length) {
      return res.status(400).json({ message: 'No admin email found.' })
    }

    const html = dailyAbsentReportTemplate({ date: dateStr, absentStudents, totalStudents, presentCount })
    const emailList = admins.map(admin => ({
      to: admin.email,
      subject: `📊 Daily Attendance Report — ${dateStr}`,
      html,
    }))

    const results = await sendBulkEmails(emailList)
    const successCount = results.filter(r => r.success).length

    return res.status(200).json({
      message: `Daily report sent to ${successCount}/${admins.length} admin(s).`,
      results,
    })
  } catch (err) {
    console.error('Daily report error:', err)
    return res.status(500).json({ message: 'Error sending email.', error: err.message })
  }
}

// ─────────────────────────────────────────────
// 2. Attendance Confirmation — sent to student/parent
//    POST /api/email/send-confirmation
//    Body: { attendanceId }
// ─────────────────────────────────────────────
const sendAttendanceConfirmation = async (req, res) => {
  try {
    const { attendanceId } = req.body

    const attendance = await Attendance.findById(attendanceId)
      .populate('studentId', 'name rollNo class section session email')

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found.' })
    }

    const student = attendance.studentId
    const recipientEmail = student?.email

    if (!recipientEmail) {
      return res.status(400).json({ message: 'No email found on this student\'s record.' })
    }

    const dateStr = new Date(attendance.date || Date.now()).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const html = attendanceConfirmationTemplate({
      studentName: student?.name || 'Student',
      date: dateStr,
      status: attendance.status,
      time: attendance.time || 'N/A',
      className: student?.class || attendance.class || '-',
      section: student?.section || attendance.section || '-',
      session: student?.session || attendance.session || '-',
    })

    const result = await sendEmail({
      to: recipientEmail,
      subject: `${attendance.status === 'Present' ? '✅' : '❌'} Attendance ${attendance.status} — ${student?.name}`,
      html,
    })

    if (result.success) {
      return res.status(200).json({ message: 'Confirmation email sent.', messageId: result.messageId })
    } else {
      return res.status(500).json({ message: 'Email failed to send.', error: result.error })
    }
  } catch (err) {
    console.error('Confirmation email error:', err)
    return res.status(500).json({ message: 'Server error.', error: err.message })
  }
}

// ─────────────────────────────────────────────
// 3. Test Email — GET: connectivity ping | POST: send a custom report
//    GET  /api/email/test  → sends a test ping to EMAIL_USER
//    POST /api/email/test  → accepts { to, subject, html } from TReports
// ─────────────────────────────────────────────
const sendTestEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body || {}

    // If the request carries a body, treat it as a custom report (TReports button).
    if (to && subject && html) {
      const result = await sendEmail({ to, subject, html })
      if (result.success) {
        return res.status(200).json({ message: `Report sent to ${to}.`, messageId: result.messageId })
      } else {
        return res.status(500).json({ message: 'Email failed to send.', error: result.error })
      }
    }

    // Plain connectivity ping — no body provided.
    const result = await sendEmail({
      to: process.env.EMAIL_USER,
      subject: '✅ Email Service Test — Attendance System',
      html: `<div style="font-family:Arial,sans-serif;padding:20px;max-width:400px;margin:0 auto">
        <h2 style="color:#2563eb">✅ Email Service Working!</h2>
        <p>Your email notification system is working correctly.</p>
        <p style="color:#6b7280;font-size:13px">Checked at: ${new Date().toLocaleString('en-IN')}</p>
      </div>`,
    })

    if (result.success) {
      return res.status(200).json({ message: 'Test email sent! Check your inbox.' })
    } else {
      return res.status(500).json({ message: 'Test email failed.', error: result.error })
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message })
  }
}

// ─────────────────────────────────────────────
// 4. Custom Report Email — used by TReports "Email Report" button
//    POST /api/email/send-report
//    Body: { to, subject, html }
// ─────────────────────────────────────────────
const sendCustomReport = async (req, res) => {
  try {
    const { to, subject, html } = req.body
    if (!to || !subject || !html) {
      return res.status(400).json({ message: 'to, subject and html are all required.' })
    }

    const result = await sendEmail({ to, subject, html })

    if (result.success) {
      return res.status(200).json({ message: `Report sent to ${to}.`, messageId: result.messageId })
    } else {
      return res.status(500).json({ message: 'Email failed to send.', error: result.error })
    }
  } catch (err) {
    console.error('Custom report email error:', err)
    return res.status(500).json({ message: 'Server error.', error: err.message })
  }
}

// ─────────────────────────────────────────────
// 5. Bulk Low Attendance Alert — sends to selected students
//    POST /api/email/low-attendance-alert
//    Body: { studentIds: ['id1', 'id2', ...] }
// ─────────────────────────────────────────────
const sendLowAttendanceAlerts = async (req, res) => {
  try {
    const { studentIds } = req.body
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'studentIds array is required.' })
    }

    const students = await Student.find({ _id: { $in: studentIds } })
    const allAttendance = await Attendance.find({ studentId: { $in: studentIds } })

    const emailList = []
    const skipped = []

    for (const student of students) {
      if (!student.email) {
        skipped.push({ name: student.name, reason: 'No email on record.' })
        continue
      }

      const studentAtt = allAttendance.filter(a => a.studentId.toString() === student._id.toString())
      const total = studentAtt.length
      const present = studentAtt.filter(a => a.status === 'Present').length
      const absent = studentAtt.filter(a => a.status === 'Absent').length
      const late = studentAtt.filter(a => a.status === 'Late').length
      const percentage = total > 0 ? parseFloat(((present + late) / total * 100).toFixed(1)) : 0

      const html = lowAttendanceAlertTemplate({
        studentName: student.name, rollNo: student.rollNo,
        className: student.class, section: student.section, session: student.session,
        present, absent, total, percentage,
      })

      emailList.push({
        to: student.email,
        subject: `⚠️ Low Attendance Alert — ${student.name} (${percentage}%)`,
        html,
      })
    }

    if (emailList.length === 0) {
      return res.status(400).json({ message: 'None of the selected students have an email on record.', skipped })
    }

    const results = await sendBulkEmails(emailList)
    const successCount = results.filter(r => r.success).length

    return res.status(200).json({
      message: `Alert sent to ${successCount}/${emailList.length} student(s).`,
      results, skipped,
    })
  } catch (err) {
    console.error('Bulk low attendance email error:', err)
    return res.status(500).json({ message: 'Server error.', error: err.message })
  }
}

module.exports = {
  sendDailyAbsentReport,
  sendAttendanceConfirmation,
  sendTestEmail,
  sendCustomReport,
  sendLowAttendanceAlerts,
}