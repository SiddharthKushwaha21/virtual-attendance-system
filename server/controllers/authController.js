const mongoose = require('mongoose');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { logActivity } = require('../utils/activityLogger');

// ─────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists!' });
    }

    const user = new User({ name, email, password, role });
    await user.save();

    await logActivity({
      action: 'USER_REGISTER',
      category: 'Auth',
      description: `New user registered: ${name} (${email}) — Role: ${role || 'admin'}`,
      performedBy: user._id,
      performedByName: name,
      targetId: user._id.toString(),
      targetName: name,
      metadata: { email, role: role || 'admin' },
      ip: req.ip,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required!' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Log failed attempt (no user found)
      await logActivity({
        action: 'LOGIN_FAILED',
        category: 'Auth',
        description: `Failed login attempt — email not found: ${email}`,
        performedBy: new mongoose.Types.ObjectId(),
        performedByName: 'Unknown',
        metadata: { email, reason: 'User not found' },
        ip: req.ip,
      }).catch(() => {});
      return res.status(401).json({ message: 'Invalid email or password!' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await logActivity({
        action: 'LOGIN_FAILED',
        category: 'Auth',
        description: `Failed login attempt for: ${user.name} (${email})`,
        performedBy: user._id,
        performedByName: user.name,
        metadata: { email, reason: 'Wrong password' },
        ip: req.ip,
      });
      return res.status(401).json({ message: 'Invalid email or password!' });
    }

    // Teacher inactive check — block before token generation
    if (user.role === 'teacher' && !user.isActive) {
      await logActivity({
        action: 'LOGIN_FAILED',
        category: 'Auth',
        description: `Deactivated teacher tried to login: ${user.name}`,
        performedBy: user._id,
        performedByName: user.name,
        metadata: { email, reason: 'Account deactivated' },
        ip: req.ip,
      });
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact the admin.',
      });
    }

    // Successful login
    await logActivity({
      action: 'LOGIN',
      category: 'Auth',
      description: `${user.name} (${user.role}) logged in successfully`,
      performedBy: user._id,
      performedByName: user.name,
      targetId: user._id.toString(),
      targetName: user.name,
      metadata: { email, role: user.role },
      ip: req.ip,
    });

    // Return full profile so frontend can use it directly
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      photo: user.photo || '',
      phone: user.phone || '',
      subject: user.subject || '',
      qualification: user.qualification || '',
      assignedClasses: user.assignedClasses || [],
      securityQuestion: user.securityQuestion || '',
      securityAnswer: user.securityAnswer || '',
      isActive: user.isActive,
      createdAt: user.createdAt,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    await logActivity({
      action: 'LOGOUT',
      category: 'Auth',
      description: `${req.user.name} logged out`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      targetId: req.user._id.toString(),
      targetName: req.user.name,
      metadata: { email: req.user.email, role: req.user.role },
      ip: req.ip,
    });
    res.json({ message: 'Logged out successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Update Profile
// ─────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters!' });
    }

    const oldUser = await User.findById(req.user._id);

    // Check email not taken by another user
    if (email && email !== oldUser.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.user._id } });
      if (emailExists) {
        return res.status(400).json({ message: 'This email is already in use!' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim(), email: email ? email.toLowerCase() : oldUser.email },
      { new: true }
    ).select('-password');

    await logActivity({
      action: 'PROFILE_UPDATE',
      category: 'Auth',
      description: `${name} updated their profile`,
      performedBy: req.user._id,
      performedByName: name,
      targetId: req.user._id.toString(),
      targetName: name,
      metadata: {
        old: { name: oldUser?.name, email: oldUser?.email },
        new: { name, email }
      },
      ip: req.ip,
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required!' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters!' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect!' });
    }

    user.password = newPassword;
    await user.save();

    await logActivity({
      action: 'PASSWORD_CHANGE',
      category: 'Auth',
      description: `${user.name} changed their password`,
      performedBy: req.user._id,
      performedByName: user.name,
      targetId: req.user._id.toString(),
      targetName: user.name,
      ip: req.ip,
    });

    res.json({ message: 'Password changed successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};