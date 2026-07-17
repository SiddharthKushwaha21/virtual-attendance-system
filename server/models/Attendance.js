const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// Attendance Model
// One document = one student's attendance for one specific date.
// ─────────────────────────────────────────────
const attendanceSchema = new mongoose.Schema({

  // Which student this record belongs to
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,          // Index added — makes queries by studentId much faster
  },

  // Date stored as a plain string (YYYY-MM-DD) so date-range queries are simple
  date: {
    type: String,
    required: true,
    index: true,          // Index added — makes queries by date much faster
  },

  // Attendance status for this day
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Late'],
    required: true,
  },

  // Time the attendance was marked (e.g. "09:30 AM")
  time: { type: String },

  // Who marked it — e.g. "Teacher: Dr. Sharma" or "Face Recognition" or "Manual"
  markedBy: { type: String, default: 'Manual' },

  // AI face-recognition confidence score (0–1). Null if marked manually.
  confidence: { type: Number, default: null },

  // Optional teacher note for this record (e.g. "Left early", "Medical leave")
  remark: { type: String, default: '' },

  // Snapshot of the student's class details at the time of marking.
  // Stored here so reports still work correctly even if the student later
  // moves to a different class.
  class:   { type: String },
  section: { type: String },
  year:    { type: String },
  session: { type: String },

  // ── Edit audit trail ──────────────────────────────────────────────────────
  // These fields are only set when a teacher edits an already-submitted record.
  editReason: { type: String, default: '' },   // Reason the teacher gave for the edit
  editedAt:   { type: Date },                  // When the edit happened
  editedBy:   { type: String },                // Which teacher made the edit

}, { timestamps: true });

// Compound index: one student can only have one record per date.
// This prevents duplicate attendance entries at the database level.
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);