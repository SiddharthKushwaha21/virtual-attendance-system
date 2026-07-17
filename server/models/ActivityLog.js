const mongoose = require('mongoose')

const activityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    // e.g. 'STUDENT_ADD', 'STUDENT_EDIT', 'STUDENT_DELETE',
    //      'ATTENDANCE_MARK', 'ATTENDANCE_UPDATE',
    //      'LOGIN', 'LOGOUT', 'BULK_IMPORT', 'FACE_REGISTER'
  },
  category: {
    type: String,
    enum: ['Student', 'Attendance', 'Auth', 'System'],
    required: true,
  },
  description: {
    type: String,
    required: true,
    // e.g. 'Added student Rahul Sharma (BCA - A)'
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  performedByName: {
    type: String, // Store name directly for easy display
  },
  targetId: {
    type: String, // Student ID or Attendance ID
    default: null,
  },
  targetName: {
    type: String, // Student name or relevant info
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Extra info like old/new values
    default: null,
  },
  ip: {
    type: String,
    default: null,
  },
}, { timestamps: true })

// Index for faster queries
activityLogSchema.index({ createdAt: -1 })
activityLogSchema.index({ category: 1 })
activityLogSchema.index({ performedBy: 1 })

module.exports = mongoose.model('ActivityLog', activityLogSchema)