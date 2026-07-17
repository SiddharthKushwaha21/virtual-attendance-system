const express = require('express');
const router  = express.Router();
const {
  // ── Existing admin functions — unchanged ──
  getAllStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  getStudentById,
  bulkImport,
  // ── New student self-service functions ──
  studentLogin,
  getMyProfile,
  updateMyProfile,
  getMyDashboard,
  getMyAttendance,
} = require('../controllers/studentController');

const { protect } = require('../middleware/authMiddleware');

// ── Student self-service middleware ──────────────────────────────────────────
// Student ke requests ke liye alag middleware — Student model se verify karta hai
const protectStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided!' });
    }
    const token = authHeader.split(' ')[1];
    const jwt   = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'student') {
      return res.status(403).json({ message: 'Access denied. Students only.' });
    }

    const Student = require('../models/Student');
    const student = await Student.findById(decoded.id).select('-faceEncoding -faceImage');
    if (!student || !student.isActive) {
      return res.status(401).json({ message: 'Student account not found or deactivated!' });
    }
    req.student = student;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token!' });
  }
};

// ── Student Auth ─────────────────────────────────────────────────────────────
router.post('/login', studentLogin);

// ── Student Self-Service Routes ──────────────────────────────────────────────
router.get('/me/profile',    protectStudent, getMyProfile);
router.put('/me/profile',    protectStudent, updateMyProfile);
router.get('/me/dashboard',  protectStudent, getMyDashboard);
router.get('/me/attendance', protectStudent, getMyAttendance);

// ── Existing Admin Routes — UNCHANGED ────────────────────────────────────────
router.get('/',               protect, getAllStudents);
router.post('/bulk-import',   protect, bulkImport);
router.post('/',              protect, addStudent);
router.put('/:id',            protect, updateStudent);
router.delete('/:id',         protect, deleteStudent);
router.get('/:id',            protect, getStudentById);

module.exports = router;