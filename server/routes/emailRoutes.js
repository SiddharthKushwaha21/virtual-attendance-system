const express = require('express')
const router = express.Router()
const {
  sendDailyAbsentReport,
  sendAttendanceConfirmation,
  sendTestEmail,
  sendCustomReport,
  sendLowAttendanceAlerts,
} = require('../controllers/emailController')
const { protect } = require('../middleware/authMiddleware')

router.get('/test', protect, sendTestEmail)
router.post('/test', protect, sendTestEmail)          // used by TReports "Email Report" button
router.get('/daily-report', protect, sendDailyAbsentReport)
router.post('/send-confirmation', protect, sendAttendanceConfirmation)
router.post('/send-report', protect, sendCustomReport)
router.post('/low-attendance-alert', protect, sendLowAttendanceAlerts)

module.exports = router