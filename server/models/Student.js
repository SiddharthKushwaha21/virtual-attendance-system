const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// Student Model
// One document = one student in the system.
// ─────────────────────────────────────────────
const studentSchema = new mongoose.Schema({

  // Basic identity
  name:   { type: String, required: true, trim: true },
  rollNo: { type: String, required: true, trim: true, index: true },

  // Contact — email is used for attendance notification emails
  email: { type: String, trim: true, lowercase: true, default: '' },
  phone: { type: String, trim: true, default: '' },

  // Academic details — used by the cascading filter dropdowns in the Teacher Panel
  class:   { type: String, required: true, trim: true },
  section: { type: String, trim: true, default: '' },
  year:    { type: String, trim: true, default: '' },
  session: { type: String, trim: true, default: '' },

  // Profile photo — Cloudinary URL stored here
  photo: { type: String, default: '' },

  // Face recognition data — used by the Python FastAPI AI service
  faceEncoding: { type: Array, default: [] },
  faceImage:    { type: String, default: '' },

  // Soft-delete flag — false means the student is archived, not hard-deleted.
  // All attendance queries filter by isActive: true so archived students
  // do not appear in any Teacher Panel list.
  isActive: { type: Boolean, default: true, index: true },

}, { timestamps: true });

// Ensure no two students can share the same roll number
studentSchema.index({ rollNo: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);