const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const { logActivity } = require('../utils/activityLogger');
const { sendEmail } = require('../utils/emailService');
const {
  teacherWelcomeTemplate,
  teacherUpdateTemplate,
  teacherPasswordResetTemplate
} = require('../utils/emailTemplates');

// ─────────────────────────────────────────────
// Get All Teachers
// ─────────────────────────────────────────────
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Get Teacher By ID
// ─────────────────────────────────────────────
exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' })
      .select('-password');
    if (!teacher) return res.status(404).json({ message: 'Teacher not found!' });
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Add Teacher
// ─────────────────────────────────────────────
exports.addTeacher = async (req, res) => {
  try {
    const {
      name, email, password, phone,
      subject, qualification, assignedClasses,
      securityQuestion, securityAnswer, photo
    } = req.body;

    if (!name || name.trim().length < 2)
      return res.status(400).json({ message: 'Name must be at least 2 characters!' });
    if (!email)
      return res.status(400).json({ message: 'Email is required!' });
    if (!password || password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters!' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ message: 'Enter a valid email address!' });

    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone))
        return res.status(400).json({ message: 'Enter a valid 10 digit phone number!' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists)
      return res.status(400).json({ message: 'This email is already registered!' });

    // Upload photo to Cloudinary
    let photoUrl = '';
    if (photo && photo.startsWith('data:')) {
      const uploaded = await cloudinary.uploader.upload(photo, {
        folder: 'attendance-system/teachers',
      });
      photoUrl = uploaded.secure_url;
    }

    const teacher = await User.create({
      name, email: email.toLowerCase(), password,
      phone: phone || '', subject: subject || '',
      qualification: qualification || '', photo: photoUrl,
      assignedClasses: assignedClasses || [],
      securityQuestion: securityQuestion || '',
      securityAnswer: securityAnswer || '',
      role: 'teacher', isActive: true,
    });

    // Send welcome email
    sendEmail({
      to: email.toLowerCase(),
      subject: `🎉 Welcome to Attendance System — Your Account Details`,
      html: teacherWelcomeTemplate({
        teacherName: name,
        email: email.toLowerCase(),
        password,
        subject: subject || '',
        qualification: qualification || '',
        phone: phone || '',
        assignedClasses: assignedClasses || [],
        loginUrl: process.env.CLIENT_URL || 'http://localhost:5173',
      })
    }).catch(err => console.log('Welcome email error:', err.message));

    await logActivity({
      action: 'TEACHER_ADD',
      category: 'System',
      description: `Added teacher ${name} (${email}) — Subject: ${subject || 'N/A'}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      targetId: teacher._id.toString(),
      targetName: name,
      metadata: { email, subject, assignedClasses },
      ip: req.ip,
    });

    const teacherData = teacher.toObject();
    delete teacherData.password;
    res.status(201).json(teacherData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Update Teacher
// ─────────────────────────────────────────────
exports.updateTeacher = async (req, res) => {
  try {
    const {
      name, email, password, phone,
      subject, qualification, assignedClasses,
      isActive, securityQuestion, securityAnswer, photo
    } = req.body;

    if (!name || name.trim().length < 2)
      return res.status(400).json({ message: 'Name must be at least 2 characters!' });

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return res.status(400).json({ message: 'Enter a valid email address!' });
      const emailExists = await User.findOne({
        email: email.toLowerCase(), _id: { $ne: req.params.id }
      });
      if (emailExists)
        return res.status(400).json({ message: 'This email is already registered!' });
    }

    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone))
        return res.status(400).json({ message: 'Enter a valid 10 digit phone number!' });
    }

    if (password && password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters!' });

    const oldTeacher = await User.findById(req.params.id).select('-password');

    let photoUrl = oldTeacher.photo || '';
    if (photo && photo.startsWith('data:')) {
      const uploaded = await cloudinary.uploader.upload(photo, {
        folder: 'attendance-system/teachers',
      });
      photoUrl = uploaded.secure_url;
    }

    const updateData = {
      name,
      email: email ? email.toLowerCase() : oldTeacher.email,
      phone: phone || '',
      subject: subject || '',
      qualification: qualification || '',
      photo: photoUrl,
      assignedClasses: assignedClasses || [],
      isActive: isActive !== undefined ? isActive : oldTeacher.isActive,
      securityQuestion: securityQuestion || oldTeacher.securityQuestion || '',
      securityAnswer: securityAnswer || oldTeacher.securityAnswer || '',
    };

    const teacher = await User.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found!' });

    Object.assign(teacher, updateData);
    if (password) teacher.password = password;
    await teacher.save();

    // Send update email
    sendEmail({
      to: teacher.email,
      subject: `✏️ Your Profile Has Been Updated — Attendance System`,
      html: teacherUpdateTemplate({
        teacherName: name,
        subject: subject || '',
        qualification: qualification || '',
        phone: phone || '',
        assignedClasses: assignedClasses || [],
        updatedBy: req.user.name,
      })
    }).catch(err => console.log('Update email error:', err.message));

    await logActivity({
      action: 'TEACHER_EDIT',
      category: 'System',
      description: `Updated teacher ${name} — Subject: ${subject || 'N/A'}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      targetId: req.params.id,
      targetName: name,
      metadata: {
        old: { name: oldTeacher?.name, subject: oldTeacher?.subject },
        new: { name, subject, assignedClasses }
      },
      ip: req.ip,
    });

    const teacherData = teacher.toObject();
    delete teacherData.password;
    res.json(teacherData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Reset Teacher Password
// ─────────────────────────────────────────────
exports.resetTeacherPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters!' });

    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found!' });

    teacher.password = newPassword;
    await teacher.save();

    // Send password reset email
    sendEmail({
      to: teacher.email,
      subject: `🔐 Password Reset — Attendance System`,
      html: teacherPasswordResetTemplate({
        teacherName: teacher.name,
        newPassword,
        resetBy: req.user.name,
      })
    }).catch(err => console.log('Password reset email error:', err.message));

    await logActivity({
      action: 'TEACHER_PASSWORD_RESET',
      category: 'System',
      description: `Password reset for teacher ${teacher.name}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      targetId: req.params.id,
      targetName: teacher.name,
      ip: req.ip,
    });

    res.json({ message: `Password reset successfully for ${teacher.name}!` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Toggle Teacher Status
// ─────────────────────────────────────────────
exports.toggleTeacherStatus = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found!' });

    teacher.isActive = !teacher.isActive;
    await teacher.save();

    await logActivity({
      action: teacher.isActive ? 'TEACHER_ACTIVATED' : 'TEACHER_DEACTIVATED',
      category: 'System',
      description: `Teacher ${teacher.name} ${teacher.isActive ? 'activated' : 'deactivated'}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      targetId: req.params.id,
      targetName: teacher.name,
      ip: req.ip,
    });

    res.json({
      message: `${teacher.name} ${teacher.isActive ? 'activated' : 'deactivated'} successfully!`,
      isActive: teacher.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Delete Teacher
// ─────────────────────────────────────────────
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found!' });

    await User.findByIdAndDelete(req.params.id);

    await logActivity({
      action: 'TEACHER_DELETE',
      category: 'System',
      description: `Deleted teacher ${teacher.name} (${teacher.email})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      targetId: req.params.id,
      targetName: teacher.name,
      metadata: { email: teacher.email, subject: teacher.subject },
      ip: req.ip,
    });

    res.json({ message: `${teacher.name} deleted successfully!` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Get Teacher Stats
// ─────────────────────────────────────────────
exports.getTeacherStats = async (req, res) => {
  try {
    const total = await User.countDocuments({ role: 'teacher' });
    const active = await User.countDocuments({ role: 'teacher', isActive: true });
    const inactive = await User.countDocuments({ role: 'teacher', isActive: false });
    res.json({ total, active, inactive });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};