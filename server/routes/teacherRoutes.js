const express = require('express');
const router = express.Router();
const {
  getAllTeachers,
  getTeacherById,
  addTeacher,
  updateTeacher,
  resetTeacherPassword,
  toggleTeacherStatus,
  deleteTeacher,
  getTeacherStats,
} = require('../controllers/teacherController');
const { protect } = require('../middleware/authMiddleware');

// All routes protected — only admin
router.get('/', protect, getAllTeachers);
router.get('/stats', protect, getTeacherStats);
router.get('/:id', protect, getTeacherById);
router.post('/', protect, addTeacher);
router.put('/:id', protect, updateTeacher);
router.put('/:id/reset-password', protect, resetTeacherPassword);
router.put('/:id/toggle-status', protect, toggleTeacherStatus);
router.delete('/:id', protect, deleteTeacher);

module.exports = router;