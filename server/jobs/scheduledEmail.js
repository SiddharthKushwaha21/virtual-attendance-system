// server/jobs/scheduledEmail.js
const cron = require('node-cron')
const { sendBulkEmails } = require('../utils/emailService')
const { dailyAbsentReportTemplate, teacherWeeklySummaryTemplate } = require('../utils/emailTemplates')
const Attendance = require('../models/Attendance')
const Student = require('../models/Student')
const User = require('../models/User')

// ─────────────────────────────────────────────
// Job 1: Daily Absent Report — sent to all admins every day at 8 PM IST
// ─────────────────────────────────────────────
const scheduleDailyReport = () => {
  cron.schedule('0 20 * * *', async () => {
    console.log('🕗 Cron: sending daily attendance report to admins...')
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
        }))

      const admins = await User.find({ role: 'admin' }, 'email name')
      if (!admins.length) { console.log('⚠️  No admin emails found, skipping daily report.'); return }

      const html = dailyAbsentReportTemplate({ date: dateStr, absentStudents, totalStudents, presentCount })
      const emailList = admins.map(admin => ({
        to: admin.email,
        subject: `📊 Daily Attendance Report — ${dateStr}`,
        html,
      }))

      const results = await sendBulkEmails(emailList)
      console.log(`✅ Daily report sent to ${results.filter(r => r.success).length}/${admins.length} admin(s).`)
    } catch (err) {
      console.error('❌ Daily report cron error:', err.message)
    }
  }, { timezone: 'Asia/Kolkata' })

  console.log('📅 Daily report scheduler active — 8:00 PM IST every day.')
}

// ─────────────────────────────────────────────
// Job 2: Weekly Teacher Summary — sent every Monday at 8 AM IST
// ─────────────────────────────────────────────
const scheduleWeeklyTeacherReport = () => {
  cron.schedule('0 8 * * 1', async () => {
    console.log('🕗 Cron: sending weekly teacher summaries...')
    try {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() - 1)
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 6)

      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      const teachers = await User.find({ role: 'teacher', isActive: true })
      if (!teachers.length) { console.log('⚠️  No teachers found, skipping weekly report.'); return }

      const weekAttendance = await Attendance.find({ date: { $gte: startStr, $lte: endStr } })
        .populate('studentId', '_id')

      const allStudents = await Student.find({ isActive: true })
      const emailList = []

      for (const teacher of teachers) {
        if (!teacher.email || !teacher.assignedClasses?.length) continue

        const myStudents = allStudents.filter(s =>
          teacher.assignedClasses.some(c => c.class === s.class && (!c.section || c.section === s.section))
        )
        if (!myStudents.length) continue

        const myStudentIds = myStudents.map(s => s._id.toString())
        const myAttendance = weekAttendance.filter(a =>
          myStudentIds.includes((a.studentId?._id || a.studentId)?.toString())
        )

        const present = myAttendance.filter(a => a.status === 'Present').length
        const absent = myAttendance.filter(a => a.status === 'Absent').length
        const late = myAttendance.filter(a => a.status === 'Late').length
        const total = myAttendance.length
        const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0

        const html = teacherWeeklySummaryTemplate({
          teacherName: teacher.name, startDate: startStr, endDate: endStr,
          totalStudents: myStudents.length, present, absent, late, percentage,
        })

        emailList.push({
          to: teacher.email,
          subject: `📆 Your Weekly Attendance Summary — ${startStr} to ${endStr}`,
          html,
        })
      }

      if (!emailList.length) { console.log('⚠️  No teacher emails to send.'); return }
      const results = await sendBulkEmails(emailList)
      console.log(`✅ Weekly summary sent to ${results.filter(r => r.success).length}/${emailList.length} teacher(s).`)
    } catch (err) {
      console.error('❌ Weekly report cron error:', err.message)
    }
  }, { timezone: 'Asia/Kolkata' })

  console.log('📅 Weekly teacher report scheduler active — 8:00 AM IST every Monday.')
}

module.exports = { scheduleDailyReport, scheduleWeeklyTeacherReport }