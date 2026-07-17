const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student'],
    default: 'teacher',
  },
  phone: { type: String, default: '' },
  photo: { type: String, default: '' },
  subject: { type: String, default: '' },
  qualification: { type: String, default: '' },
  assignedClasses: [
    {
      class: { type: String },
      section: { type: String },
      year: { type: String },
      session: { type: String },
    }
  ],
  securityQuestion: { type: String, default: '' },
  securityAnswer: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);