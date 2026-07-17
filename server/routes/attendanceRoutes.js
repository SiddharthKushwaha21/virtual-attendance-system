const express = require('express');
const router  = express.Router();
const {
  markAttendance,
  bulkMarkAttendance,
  getTodayAttendance,
  getAttendanceByDate,
  getStudentAttendance,
  getBulkStudentAttendance,
  getDashboardStats,
  getTeacherDashboardStats,
  updateAttendance,
  getMonthlyAttendance,
  getLowAttendance,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');

router.post('/mark',            protect, markAttendance);
router.post('/bulk-mark',       protect, bulkMarkAttendance);
router.post('/bulk-stats',      protect, getBulkStudentAttendance);
router.get('/today',            protect, getTodayAttendance);
router.get('/stats',            protect, getDashboardStats);
router.get('/teacher-stats',   protect, getTeacherDashboardStats);  // NEW — teacher specific
router.get('/monthly',          protect, getMonthlyAttendance);
router.get('/low-attendance',   protect, getLowAttendance);
router.get('/date/:date',       protect, getAttendanceByDate);
router.get('/student/:id',      protect, getStudentAttendance);
router.put('/:id',              protect, updateAttendance);

module.exports = router;