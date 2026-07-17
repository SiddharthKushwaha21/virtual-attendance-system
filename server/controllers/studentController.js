const Student    = require('../models/Student');
const Attendance = require('../models/Attendance');
const cloudinary = require('../config/cloudinary');
const { logActivity } = require('../utils/activityLogger');

// ═══════════════════════════════════════════════════════════════════
// EXISTING ADMIN FUNCTIONS — bilkul change nahi kiya
// ═══════════════════════════════════════════════════════════════════

exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({ isActive: true }).sort({ rollNo: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addStudent = async (req, res) => {
  try {
    const { name, rollNo, email, phone, class: cls, section, year, session } = req.body;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Enter a valid email address!' });
      }
    }
    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Enter a valid 10 digit Indian phone number!' });
      }
    }
    const exists = await Student.findOne({
      rollNo, class: cls, section, year, session, isActive: true
    });
    if (exists) return res.status(400).json({
      message: 'Roll No already exists in this class/section/year/session!'
    });
    if (email) {
      const emailExists = await Student.findOne({ email, isActive: true });
      if (emailExists) return res.status(400).json({ message: 'This email is already registered!' });
    }
    let photo = '';
    if (req.body.photo) {
      const uploaded = await cloudinary.uploader.upload(req.body.photo, {
        folder: 'attendance-system/students',
      });
      photo = uploaded.secure_url;
    }
    const student = await Student.create({
      name, rollNo, email, phone, class: cls, section, year, session, photo
    });
    await logActivity({
      action: 'STUDENT_ADD', category: 'Student',
      description: `Added student ${name} (${cls}${section ? ` - ${section}` : ''}) — Roll No: ${rollNo}`,
      performedBy: req.user._id, performedByName: req.user.name,
      targetId: student._id.toString(), targetName: name,
      metadata: { class: cls, section, year, session, rollNo },
      ip: req.ip,
    });
    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { name, email, phone, class: cls, section, year, session } = req.body;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Enter a valid email address!' });
      }
    }
    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Enter a valid 10 digit phone number!' });
      }
    }
    let updateData = { name, email, phone, class: cls, section, year, session };
    if (req.body.photo && req.body.photo.startsWith('data:')) {
      const uploaded = await cloudinary.uploader.upload(req.body.photo, {
        folder: 'attendance-system/students',
      });
      updateData.photo = uploaded.secure_url;
    }
    const oldStudent = await Student.findById(req.params.id);
    const student = await Student.findByIdAndUpdate(
      req.params.id, updateData, { new: true }
    );
    await logActivity({
      action: 'STUDENT_EDIT', category: 'Student',
      description: `Updated student ${name} (${cls}${section ? ` - ${section}` : ''}) — Roll No: ${oldStudent?.rollNo}`,
      performedBy: req.user._id, performedByName: req.user.name,
      targetId: req.params.id, targetName: name,
      metadata: {
        old: { name: oldStudent?.name, class: oldStudent?.class, section: oldStudent?.section },
        new: { name, class: cls, section, year, session }
      },
      ip: req.ip,
    });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    await Student.findByIdAndDelete(req.params.id);
    await logActivity({
      action: 'STUDENT_DELETE', category: 'Student',
      description: `Deleted student ${student?.name} (${student?.class}${student?.section ? ` - ${student.section}` : ''}) — Roll No: ${student?.rollNo}`,
      performedBy: req.user._id, performedByName: req.user.name,
      targetId: req.params.id, targetName: student?.name,
      metadata: { class: student?.class, section: student?.section, rollNo: student?.rollNo },
      ip: req.ip,
    });
    res.json({ message: 'Student deleted!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found!' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.bulkImport = async (req, res) => {
  try {
    const { students } = req.body;
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ message: 'Students array required!' });
    }
    const results = { success: 0, failed: 0, errors: [] };
    for (const s of students) {
      try {
        const exists = await Student.findOne({ rollNo: s.rollNo, isActive: true });
        if (exists) {
          results.failed++;
          results.errors.push(`Roll No ${s.rollNo} already exists`);
          continue;
        }
        await Student.create(s);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${s.name}: ${err.message}`);
      }
    }
    await logActivity({
      action: 'BULK_IMPORT', category: 'Student',
      description: `Bulk imported ${results.success} students (${results.failed} failed)`,
      performedBy: req.user._id, performedByName: req.user.name,
      metadata: { success: results.success, failed: results.failed },
      ip: req.ip,
    });
    res.json({ message: `${results.success} students imported!`, ...results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════
// STUDENT SELF-SERVICE FUNCTIONS — Student Portal ke liye
// ═══════════════════════════════════════════════════════════════════

exports.getMyProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.student._id)
      .select('-faceEncoding -faceImage');
    if (!student) return res.status(404).json({ message: 'Student not found!' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const { phone, photo } = req.body;
    if (phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Enter a valid 10-digit Indian phone number!' });
      }
    }
    const updateData = {};
    if (phone !== undefined) updateData.phone = phone;
    if (photo && photo.startsWith('data:')) {
      const uploaded = await cloudinary.uploader.upload(photo, {
        folder: 'attendance-system/students',
      });
      updateData.photo = uploaded.secure_url;
    }
    const student = await Student.findByIdAndUpdate(
      req.student._id, updateData, { new: true }
    ).select('-faceEncoding -faceImage');
    await logActivity({
      action: 'STUDENT_SELF_UPDATE', category: 'Student',
      description: `Student ${student.name} updated their own profile`,
      performedBy: req.student._id, performedByName: student.name,
      targetId: req.student._id.toString(), targetName: student.name,
      ip: req.ip,
    });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyDashboard = async (req, res) => {
  try {
    const studentId    = req.student._id;
    const today        = new Date().toISOString().split('T')[0];
    const { date: reqDate } = req.query;
    const selectedDate = (reqDate && reqDate <= today) ? reqDate : today;

    const allAttendance = await Attendance.find({ studentId }).lean();

    if (allAttendance.length === 0) {
      return res.json({
        totalClasses: 0, present: 0, absent: 0, late: 0,
        percentage: 0, todayStatus: null,
        last7Days: [], last30Days: [],
        monthlyOverview: { percentage: 0, workingDays: 0 },
        streak: 0, classRank: null,
        debarmentWarning: null, recentActivity: [],
      });
    }

    const total   = allAttendance.length;
    const present = allAttendance.filter(a => a.status === 'Present').length;
    const absent  = allAttendance.filter(a => a.status === 'Absent').length;
    const late    = allAttendance.filter(a => a.status === 'Late').length;
    const pct     = parseFloat(((present + late) / total * 100).toFixed(1));

    const todayRecord   = allAttendance.find(a => a.date === selectedDate);
    const todayStatus   = todayRecord?.status   || null;
    const todayTime     = todayRecord?.time      || null;
    const todayMarkedBy = todayRecord?.markedBy  || null;

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d  = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const r  = allAttendance.find(a => a.date === ds);
      last7Days.push({
        date: ds,
        day:  d.toLocaleDateString('en-IN', { weekday: 'short' }),
        status: r?.status || null,
      });
    }

    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d  = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const r  = allAttendance.find(a => a.date === ds);
      last30Days.push({ date: ds, status: r?.status || null });
    }

    const [yr, mo] = selectedDate.split('-');
    const mStart   = `${yr}-${mo}-01`;
    const mEnd     = new Date(parseInt(yr), parseInt(mo), 0).toISOString().split('T')[0];
    const mAtt     = allAttendance.filter(a => a.date >= mStart && a.date <= mEnd);
    const mPresent = mAtt.filter(a => a.status === 'Present').length;
    const mLate    = mAtt.filter(a => a.status === 'Late').length;
    const mWorkDays = mAtt.length;
    const mPct     = mWorkDays > 0 ? parseFloat(((mPresent + mLate) / mWorkDays * 100).toFixed(1)) : 0;

    let streak = 0;
    const sorted = [...allAttendance].sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const r of sorted) {
      if (r.status === 'Present' || r.status === 'Late') streak++;
      else break;
    }

    let debarmentWarning = null;
    if (pct < 75 && total > 0) {
      const needed = Math.ceil((0.75 * total - (present + late)) / 0.25);
      debarmentWarning = {
        currentPct: pct,
        classesNeeded: Math.max(0, needed),
        message: `Attend ${Math.max(0, needed)} more consecutive classes to reach 75%`,
      };
    }

    let classRank = null;
    try {
      const student = await Student.findById(studentId).select('class section');
      if (student) {
        const classmates    = await Student.find({
          class: student.class,
          section: student.section || undefined,
          isActive: true,
        }).select('_id');
        const classmateIds  = classmates.map(s => s._id.toString());
        const classmateAtt  = await Attendance.find({ studentId: { $in: classmateIds } }).lean();
        const classmateStats = classmateIds.map(sid => {
          const att = classmateAtt.filter(a => a.studentId.toString() === sid);
          const p   = att.filter(a => a.status === 'Present').length;
          const l   = att.filter(a => a.status === 'Late').length;
          const t   = att.length;
          return { sid, pct: t > 0 ? (p + l) / t * 100 : 0 };
        });
        classmateStats.sort((a, b) => b.pct - a.pct);
        const myRank = classmateStats.findIndex(s => s.sid === studentId.toString()) + 1;
        classRank = { rank: myRank, total: classmateStats.length };
      }
    } catch { /* rank optional */ }

    const recentActivity = sorted.slice(0, 10).map(r => ({
      date:     r.date,
      status:   r.status,
      time:     r.time     || null,
      markedBy: r.markedBy || null,
    }));

    res.json({
      totalClasses: total, present, absent, late, percentage: pct,
      todayStatus, todayTime, todayMarkedBy,
      last7Days, last30Days,
      monthlyOverview: { percentage: mPct, workingDays: mWorkDays },
      streak, classRank, debarmentWarning, recentActivity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const studentId = req.student._id;
    const { month } = req.query;
    const now          = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth  = month || defaultMonth;
    const [yr, mo]     = targetMonth.split('-');
    const startDate    = `${yr}-${mo}-01`;
    const endDate      = new Date(parseInt(yr), parseInt(mo), 0).toISOString().split('T')[0];

    const monthAtt = await Attendance.find({
      studentId, date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 }).lean();

    const allAtt   = await Attendance.find({ studentId }).lean();
    const total    = allAtt.length;
    const present  = allAtt.filter(a => a.status === 'Present').length;
    const absent   = allAtt.filter(a => a.status === 'Absent').length;
    const late     = allAtt.filter(a => a.status === 'Late').length;
    const overallPct = total > 0 ? parseFloat(((present + late) / total * 100).toFixed(1)) : 0;

    const mPresent = monthAtt.filter(a => a.status === 'Present').length;
    const mAbsent  = monthAtt.filter(a => a.status === 'Absent').length;
    const mLate    = monthAtt.filter(a => a.status === 'Late').length;
    const mTotal   = monthAtt.length;
    const mPct     = mTotal > 0 ? parseFloat(((mPresent + mLate) / mTotal * 100).toFixed(1)) : 0;

    const prevDate  = new Date(parseInt(yr), parseInt(mo) - 2, 1);
    const prevMo    = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevStart = `${prevMo.split('-')[0]}-${prevMo.split('-')[1]}-01`;
    const prevEnd   = new Date(parseInt(prevMo.split('-')[0]), parseInt(prevMo.split('-')[1]), 0).toISOString().split('T')[0];
    const prevAtt   = await Attendance.find({ studentId, date: { $gte: prevStart, $lte: prevEnd } }).lean();
    const prevP     = prevAtt.filter(a => a.status === 'Present').length;
    const prevL     = prevAtt.filter(a => a.status === 'Late').length;
    const prevTotal = prevAtt.length;
    const prevPct   = prevTotal > 0 ? parseFloat(((prevP + prevL) / prevTotal * 100).toFixed(1)) : 0;

    const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
    const calendar    = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr   = `${yr}-${mo}-${String(d).padStart(2, '0')}`;
      const record    = monthAtt.find(a => a.date === dateStr);
      const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
      calendar.push({
        date: dateStr, day: d,
        dayName:   new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' }),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        status:    record?.status   || null,
        time:      record?.time     || null,
        markedBy:  record?.markedBy || null,
      });
    }

    res.json({
      month: targetMonth, startDate, endDate,
      monthStats: { present: mPresent, absent: mAbsent, late: mLate, total: mTotal, percentage: mPct, workingDays: mTotal },
      overallStats: { present, absent, late, total, percentage: overallPct },
      trend: { currentMonth: mPct, previousMonth: prevPct, change: parseFloat((mPct - prevPct).toFixed(1)), improving: mPct >= prevPct },
      calendar,
      records: monthAtt.map(r => ({
        date: r.date, status: r.status,
        time: r.time || null, markedBy: r.markedBy || null, remark: r.remark || null,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Student Login
// POST /api/students/login
// FIX: Email + Phone number se login hoga
// Email = student ka registered email
// Password = student ka registered phone number
// ─────────────────────────────────────────────
exports.studentLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and phone number are required!',
      });
    }

    // Email format validate karo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        message: 'Please enter a valid email address!',
      });
    }

    // Phone format validate karo (password field mein phone aata hai)
    const phoneDigits = String(password).replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        message: 'Please enter your 10-digit phone number as password!',
      });
    }

    // Email se student dhundo (case insensitive)
    const student = await Student.findOne({
      email: email.trim().toLowerCase(),
      isActive: true,
    });

    if (!student) {
      return res.status(401).json({
        message: 'No student found with this email address!',
      });
    }

    // Phone number match karo
    // Stored phone aur entered phone ke digits compare karo
    const storedDigits  = String(student.phone || '').replace(/\D/g, '');
    const enteredDigits = phoneDigits;

    // Last 10 digits compare karo (91XXXXXXXXXX vs XXXXXXXXXX dono handle)
    const storedLast10  = storedDigits.slice(-10);
    const enteredLast10 = enteredDigits.slice(-10);

    if (!storedDigits || storedLast10 !== enteredLast10) {
      return res.status(401).json({
        message: 'Incorrect phone number! Please enter your registered phone number.',
      });
    }

    // Generate token
    const generateToken = require('../utils/generateToken');
    const token = generateToken(student._id, 'student');

    await logActivity({
      action: 'STUDENT_LOGIN', category: 'Auth',
      description: `Student ${student.name} (${student.rollNo}) logged in via email+phone`,
      performedBy: student._id, performedByName: student.name,
      targetId: student._id.toString(), targetName: student.name,
      ip: req.ip,
    });

    res.json({
      _id:     student._id,
      name:    student.name,
      rollNo:  student.rollNo,
      email:   student.email   || '',
      phone:   student.phone   || '',
      photo:   student.photo   || '',
      class:   student.class,
      section: student.section || '',
      year:    student.year    || '',
      session: student.session || '',
      isActive: student.isActive,
      role:    'student',
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};