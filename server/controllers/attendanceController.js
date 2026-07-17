const Attendance = require('../models/Attendance');
const Student    = require('../models/Student');
const { sendEmail, sendBulkEmails }                                = require('../utils/emailService');
const { attendanceConfirmationTemplate, absentNotificationTemplate } = require('../utils/emailTemplates');
const { logActivity }                                              = require('../utils/activityLogger');

// ─────────────────────────────────────────────
// IST-safe date helper
// PROBLEM: new Date().toISOString().split('T')[0] always returns the UTC
// calendar date. Between 12:00 AM and 5:29 AM IST, UTC is still on the
// previous day, so attendance marked during that window (or dashboard
// stats computed during that window) silently used "yesterday" as "today".
// FIX: convert to IST first, then build the YYYY-MM-DD string from that.
// This is a pure drop-in replacement for `new Date().toISOString().split('T')[0]`
// — same string format, same usage everywhere, just timezone-correct.
// ─────────────────────────────────────────────
const getISTDateString = (date = new Date()) => {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = istDate.getFullYear();
  const mm   = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd   = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// ─────────────────────────────────────────────
// Mark Single Attendance
// POST /api/attendance/mark
// ─────────────────────────────────────────────
exports.markAttendance = async (req, res) => {
  try {
    const { studentId, status, markedBy, confidence, date: reqDate, remark } = req.body;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const date = reqDate || getISTDateString();
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const existing = await Attendance.findOne({ studentId, date });
    if (existing) {
      return res.status(400).json({
        message: `${student.name}'s attendance is already marked for ${date}.`,
      });
    }

    const attendance = await Attendance.create({
      studentId, date, status, time,
      markedBy:   markedBy   || 'Manual',
      confidence: confidence || null,
      remark:     remark     || '',
      class:   student.class,
      section: student.section,
      year:    student.year,
      session: student.session,
    });

    if (student.email) {
      const html = attendanceConfirmationTemplate({
        studentName: student.name, date, status, time,
        className: student.class, section: student.section, session: student.session,
      });
      sendEmail({
        to: student.email,
        subject: `${status === 'Present' ? '✅' : status === 'Absent' ? '❌' : '⏰'} Attendance ${status} — ${student.name}`,
        html,
      }).catch(err => console.error('Email error:', err.message));
    }

    await logActivity({
      action: 'ATTENDANCE_MARK', category: 'Attendance',
      description: `Marked ${student.name} as ${status} on ${date} (${markedBy || 'Manual'})`,
      performedBy: req.user._id, performedByName: req.user.name,
      targetId: studentId, targetName: student.name,
      metadata: { status, date, time, markedBy: markedBy || 'Manual', class: student.class, section: student.section },
      ip: req.ip,
    });

    res.status(201).json({ message: `${student.name} — ${status}!`, attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Bulk Mark Attendance
// POST /api/attendance/bulk-mark
// ─────────────────────────────────────────────
exports.bulkMarkAttendance = async (req, res) => {
  try {
    const { records, date: reqDate, markedBy } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'records array is required.' });
    }

    const date       = reqDate || getISTDateString();
    const time       = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const studentIds = records.map(r => r.studentId);

    const students   = await Student.find({ _id: { $in: studentIds } });
    const studentMap = {};
    students.forEach(s => { studentMap[s._id.toString()] = s; });

    const alreadyMarked    = await Attendance.find({ studentId: { $in: studentIds }, date });
    const alreadyMarkedSet = new Set(alreadyMarked.map(a => a.studentId.toString()));

    const toCreate               = [];
    const absentStudentsWithEmail = [];
    let skipped = 0;

    for (const record of records) {
      const sid = record.studentId.toString();
      if (alreadyMarkedSet.has(sid)) { skipped++; continue; }
      const student = studentMap[sid];
      if (!student) continue;

      toCreate.push({
        studentId: record.studentId, date,
        status:   record.status || 'Present', time,
        markedBy: markedBy || 'Manual',
        remark:   record.remark || '',
        class:   student.class, section: student.section,
        year:    student.year,  session: student.session,
      });

      if (record.status === 'Absent' && student.email) {
        absentStudentsWithEmail.push(student);
      }
    }

    const inserted = await Attendance.insertMany(toCreate);

    if (absentStudentsWithEmail.length > 0) {
      const emailList = absentStudentsWithEmail.map(student => ({
        to:      student.email,
        subject: `❌ Absent Notification — ${student.name} (${date})`,
        html:    absentNotificationTemplate({
          studentName: student.name, date,
          className: student.class, section: student.section, session: student.session,
        }),
      }));
      sendBulkEmails(emailList).catch(err => console.error('Bulk email error:', err.message));
    }

    res.status(201).json({
      message: `Attendance saved: ${inserted.length} marked, ${skipped} already existed.`,
      saved: inserted.length, skipped,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Get Today's Attendance
// GET /api/attendance/today
// ─────────────────────────────────────────────
exports.getTodayAttendance = async (req, res) => {
  try {
    const today = getISTDateString();
    const attendance = await Attendance.find({ date: today })
      .populate('studentId', 'name rollNo photo class section year session email')
      .sort({ createdAt: -1 });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Get Attendance By Date
// GET /api/attendance/date/:date
// ─────────────────────────────────────────────
exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const attendance = await Attendance.find({ date })
      .populate('studentId', 'name rollNo photo class section year session email')
      .sort({ createdAt: -1 });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Get Student Attendance History
// GET /api/attendance/student/:id
// ─────────────────────────────────────────────
exports.getStudentAttendance = async (req, res) => {
  try {
    const { id }     = req.params;
    const attendance = await Attendance.find({ studentId: id }).sort({ date: -1 });
    const total      = attendance.length;
    const present    = attendance.filter(a => a.status === 'Present').length;
    const absent     = attendance.filter(a => a.status === 'Absent').length;
    const late       = attendance.filter(a => a.status === 'Late').length;
    const percentage = total > 0 ? ((present + late) / total * 100).toFixed(1) : 0;
    res.json({ attendance, stats: { total, present, absent, late, percentage } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Bulk Student Attendance Stats
// POST /api/attendance/bulk-stats
// ─────────────────────────────────────────────
exports.getBulkStudentAttendance = async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'studentIds array is required.' });
    }

    const allAttendance = await Attendance.find({ studentId: { $in: studentIds } });

    const statsMap = {};
    studentIds.forEach(id => {
      statsMap[id] = { total: 0, present: 0, absent: 0, late: 0, percentage: 0, recent: [] };
    });

    allAttendance.forEach(a => {
      const sid = a.studentId.toString();
      if (!statsMap[sid]) statsMap[sid] = { total: 0, present: 0, absent: 0, late: 0, percentage: 0, recent: [] };
      statsMap[sid].total += 1;
      if (a.status === 'Present')     statsMap[sid].present += 1;
      else if (a.status === 'Absent') statsMap[sid].absent  += 1;
      else if (a.status === 'Late')   statsMap[sid].late    += 1;
    });

    const sorted = [...allAttendance].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(a => {
      const sid = a.studentId.toString();
      if (statsMap[sid] && statsMap[sid].recent.length < 5) {
        statsMap[sid].recent.push({ date: a.date, status: a.status });
      }
    });

    Object.keys(statsMap).forEach(sid => {
      const s = statsMap[sid];
      s.percentage = s.total > 0
        ? parseFloat(((s.present + s.late) / s.total * 100).toFixed(1)) : 0;
    });

    res.json({ stats: statsMap });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Admin Dashboard Stats
// GET /api/attendance/stats
// Used by Admin Panel only
// ─────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const today         = getISTDateString();
    const totalStudents = await Student.countDocuments({ isActive: true });

    const todayAttendance = await Attendance.find({ date: today })
      .populate('studentId', 'name rollNo photo class section year session');

    const presentToday  = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
    const absentToday   = todayAttendance.filter(a => a.status === 'Absent').length;
    const avgPercentage = totalStudents > 0
      ? ((presentToday / totalStudents) * 100).toFixed(1) : 0;

    // One query for last 30 days
    const d30Start    = new Date(today + 'T00:00:00');
    d30Start.setDate(d30Start.getDate() - 29);
    const d30StartStr = getISTDateString(d30Start);

    const last30Attendance = await Attendance.find({ date: { $gte: d30StartStr, $lte: today } })
      .populate('studentId', 'name class section rollNo')
      .lean();

    const byDate = {};
    last30Attendance.forEach(a => {
      if (!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push(a);
    });

    // Last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d  = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - i);
      const ds = getISTDateString(d);
      const da = byDate[ds] || [];
      const p  = da.filter(a => a.status === 'Present' || a.status === 'Late').length;
      last7Days.push({
        date: ds,
        day:  d.toLocaleDateString('en-IN', { weekday: 'short' }),
        present: p,
        absent:  da.filter(a => a.status === 'Absent').length,
        late:    da.filter(a => a.status === 'Late').length,
        total:   totalStudents,
        percentage: totalStudents > 0 ? parseFloat(((p / totalStudents) * 100).toFixed(1)) : 0,
      });
    }

    // Last 30 days heatmap
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d  = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - i);
      const ds = getISTDateString(d);
      const da = byDate[ds] || [];
      const p  = da.filter(a => a.status === 'Present' || a.status === 'Late').length;
      last30Days.push({
        date:    ds, present: p,
        absent:  da.filter(a => a.status === 'Absent').length,
        total:   totalStudents,
        percentage: totalStudents > 0 ? parseFloat(((p / totalStudents) * 100).toFixed(1)) : 0,
      });
    }

    // Monthly overview
    const nowDate    = new Date(today + 'T00:00:00');
    const monthStr   = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthStr}-01`;
    const monthEnd   = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthAtt   = await Attendance.find({ date: { $gte: monthStart, $lte: monthEnd } });
    const mUniqueDates = [...new Set(monthAtt.map(a => a.date))];
    const mPresent   = monthAtt.filter(a => a.status === 'Present' || a.status === 'Late').length;
    const mTotal     = mUniqueDates.length * totalStudents;
    const mPct       = mTotal > 0 ? parseFloat(((mPresent / mTotal) * 100).toFixed(1)) : 0;

    // Teacher streak
    let teacherStreak = 0;
    for (let i = 0; i <= 90; i++) {
      const d  = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - i);
      const ds = getISTDateString(d);
      if ((byDate[ds] || []).length > 0) teacherStreak++;
      else if (i > 0) break;
    }

    // Trending down detection
    const last5Dates  = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - i);
      last5Dates.push(getISTDateString(d));
    }
    const last3Dates  = last5Dates.slice(2);
    const older2Dates = last5Dates.slice(0, 2);

    const trendMap = {};
    last5Dates.forEach(ds => {
      (byDate[ds] || []).forEach(a => {
        const sid = a.studentId?._id?.toString() || a.studentId?.toString();
        if (!sid) return;
        if (!trendMap[sid]) {
          trendMap[sid] = {
            name: a.studentId?.name, class: a.studentId?.class,
            section: a.studentId?.section, rollNo: a.studentId?.rollNo,
            last3: [], older2: [],
          };
        }
        if (last3Dates.includes(ds))  trendMap[sid].last3.push(a.status);
        if (older2Dates.includes(ds)) trendMap[sid].older2.push(a.status);
      });
    });

    const trendingDown = [];
    Object.values(trendMap).forEach(s => {
      const wasPresent  = s.older2.some(st => st === 'Present');
      const recentlyBad = s.last3.filter(st => st === 'Absent' || st === 'Late').length >= 2;
      if (wasPresent && recentlyBad && s.last3.length >= 2) {
        trendingDown.push({
          name: s.name, class: s.class, section: s.section, rollNo: s.rollNo,
          recentStatuses: s.last3,
        });
      }
    });

    res.json({
      totalStudents, presentToday, absentToday, avgPercentage,
      last7Days, last30Days,
      monthlyOverview: { month: monthStr, workingDays: mUniqueDates.length, percentage: mPct, present: mPresent },
      teacherStreak, trendingDown,
      recentAttendance: todayAttendance.slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher Dashboard Stats — MAIN endpoint for Teacher Panel
// GET /api/attendance/teacher-stats?date=YYYY-MM-DD
//
// FIX 1: overallPct and recentPct added to trendingDown items
// FIX 2: recentAttendance limit increased from 5 to 20 (TDashboard shows 10)
// FIX 3: needsImmediateAttention threshold corrected to < 75 (was < 60)
// FIX 4: classBreakdown returns full last7Days and last30Days per class
//         so bar chart and heatmap switch correctly on class filter
// FIX 5: selectedDate properly respected for all calculations
// FIX 6: todayStr now computed in IST instead of UTC, so the date-validation
//         check (reqDate <= todayStr) and all "today" calculations stay
//         correct even between 12:00 AM–5:29 AM IST when UTC is still on
//         the previous calendar day
// ─────────────────────────────────────────────
exports.getTeacherDashboardStats = async (req, res) => {
  try {
    const todayStr  = getISTDateString();
    const { date: reqDate } = req.query;

    // FIX 5: Validate date — reject future dates, fallback to today
    const selectedDate = (reqDate && reqDate <= todayStr) ? reqDate : todayStr;

    const assignedClasses = req.user.assignedClasses || [];

    const emptyResponse = {
      myStudents: 0, presentToday: 0, lateToday: 0, absentToday: 0,
      markedToday: 0, unmarkedToday: 0, attendancePct: 0, teacherStreak: 0,
      last7Days: [], last30Days: [], classBreakdown: {},
      monthlyOverview: { percentage: 0, workingDays: 0 },
      lowAttendance: [], trendingDown: [], recentAttendance: [],
    };

    if (!assignedClasses.length) return res.json(emptyResponse);

    // ── Query 1: Teacher's students only ──────────────────────────────────
    const classConditions = assignedClasses.map(c => {
      const q = { class: c.class };
      if (c.section) q.section = c.section;
      return q;
    });

    const myStudents = await Student.find({ isActive: true, $or: classConditions })
      .select('_id name rollNo class section year session email phone photo')
      .lean();

    if (!myStudents.length) return res.json(emptyResponse);

    const myStudentIds = myStudents.map(s => s._id);

    // ── Query 2: All attendance for teacher's students (lean, fast) ───────
    const allMyAttendance = await Attendance.find(
      { studentId: { $in: myStudentIds } },
      { studentId: 1, date: 1, status: 1, _id: 0 }
    ).lean();

    // ── Query 3: Recent records for selected date with populated student ──
    // FIX 2: limit increased to 20 so TDashboard can show up to 10 and still have buffer
    const recentAttendance = await Attendance.find(
      { studentId: { $in: myStudentIds }, date: selectedDate },
      { studentId: 1, date: 1, status: 1, time: 1 }
    )
      .populate('studentId', 'name rollNo photo class section year session email phone')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // ── In-memory processing — no more DB calls after this ────────────────
    const byDate = {};
    allMyAttendance.forEach(a => {
      const sid = a.studentId.toString();
      if (!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push({ ...a, studentId: sid });
    });

    // Selected date stats
    const selectedAtt   = byDate[selectedDate] || [];
    const presentToday  = selectedAtt.filter(a => a.status === 'Present').length;
    const lateToday     = selectedAtt.filter(a => a.status === 'Late').length;
    const absentToday   = selectedAtt.filter(a => a.status === 'Absent').length;
    const markedToday   = selectedAtt.length;
    const unmarkedToday = Math.max(0, myStudents.length - markedToday);
    const attendancePct = myStudents.length > 0
      ? Math.round(((presentToday + lateToday) / myStudents.length) * 100) : 0;

    // Helper: date N days before selectedDate
    const dateNDaysAgo = (n) => {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - n);
      return getISTDateString(d);
    };

    // Last 7 days global
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d  = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const ds = getISTDateString(d);
      const da = byDate[ds] || [];
      const p  = da.filter(a => a.status === 'Present').length;
      const l  = da.filter(a => a.status === 'Late').length;
      last7Days.push({
        date: ds, fullDate: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        day:  d.toLocaleDateString('en-IN', { weekday: 'short' }),
        present: p, late: l,
        absent:  da.filter(a => a.status === 'Absent').length,
        marked:  da.length, total: myStudents.length,
        percentage: myStudents.length > 0
          ? parseFloat(((p + l) / myStudents.length * 100).toFixed(1)) : 0,
      });
    }

    // Last 30 days heatmap global
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d  = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const ds = getISTDateString(d);
      const da = byDate[ds] || [];
      const p  = da.filter(a => a.status === 'Present').length;
      const l  = da.filter(a => a.status === 'Late').length;
      last30Days.push({
        date: ds, present: p, late: l,
        absent: da.filter(a => a.status === 'Absent').length,
        total:  myStudents.length,
        percentage: myStudents.length > 0
          ? parseFloat(((p + l) / myStudents.length * 100).toFixed(1)) : 0,
      });
    }

    // Teacher streak (based on today, not selectedDate — streak is always real)
    let teacherStreak = 0;
    for (let i = 0; i < 90; i++) {
      const d  = new Date(todayStr + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const ds = getISTDateString(d);
      if ((byDate[ds] || []).length > 0) teacherStreak++;
      else if (i > 0) break;
    }

    // Monthly overview for selectedDate's month
    const [yr, mo]     = selectedDate.split('-');
    const mStart       = `${yr}-${mo}-01`;
    const mEnd         = new Date(parseInt(yr), parseInt(mo), 0).toISOString().split('T')[0];
    const mAtt         = allMyAttendance.filter(a => a.date >= mStart && a.date <= mEnd);
    const mWorkingDays = [...new Set(mAtt.map(a => a.date))].length;
    const mPresent     = mAtt.filter(a => a.status === 'Present').length;
    const mLate        = mAtt.filter(a => a.status === 'Late').length;
    const mTotal       = mAtt.length;
    const mPct         = mTotal > 0 ? parseFloat(((mPresent + mLate) / mTotal * 100).toFixed(1)) : 0;

    // ── FIX 4: Per-class breakdown — full last7Days + last30Days per class ──
    const classBreakdown = {};
    for (const cls of assignedClasses) {
      const key           = `${cls.class}${cls.section ? `-${cls.section}` : ''}`;
      const classStudents = myStudents.filter(s =>
        s.class === cls.class && (!cls.section || s.section === cls.section)
      );
      const classIdSet    = new Set(classStudents.map(s => s._id.toString()));

      // Build class-specific byDate
      const classByDate = {};
      allMyAttendance.forEach(a => {
        if (classIdSet.has(a.studentId.toString())) {
          if (!classByDate[a.date]) classByDate[a.date] = [];
          classByDate[a.date].push(a);
        }
      });

      const cToday = classByDate[selectedDate] || [];
      const cP     = cToday.filter(a => a.status === 'Present').length;
      const cL     = cToday.filter(a => a.status === 'Late').length;
      const cA     = cToday.filter(a => a.status === 'Absent').length;
      const cTotal = classStudents.length;

      // Class-specific last 7 days — switches bar chart when class is selected
      const c7 = [];
      for (let i = 6; i >= 0; i--) {
        const d  = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() - i);
        const ds = getISTDateString(d);
        const da = classByDate[ds] || [];
        const p  = da.filter(a => a.status === 'Present').length;
        const l  = da.filter(a => a.status === 'Late').length;
        c7.push({
          date: ds, fullDate: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          day:  d.toLocaleDateString('en-IN', { weekday: 'short' }),
          present: p, late: l,
          absent:  da.filter(a => a.status === 'Absent').length,
          marked:  da.length, total: cTotal,
          percentage: cTotal > 0 ? parseFloat(((p + l) / cTotal * 100).toFixed(1)) : 0,
        });
      }

      // Class-specific last 30 days — switches heatmap when class is selected
      const c30 = [];
      for (let i = 29; i >= 0; i--) {
        const d  = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() - i);
        const ds = getISTDateString(d);
        const da = classByDate[ds] || [];
        const p  = da.filter(a => a.status === 'Present').length;
        const l  = da.filter(a => a.status === 'Late').length;
        c30.push({
          date: ds, present: p, late: l,
          absent: da.filter(a => a.status === 'Absent').length,
          total:  cTotal,
          percentage: cTotal > 0 ? parseFloat(((p + l) / cTotal * 100).toFixed(1)) : 0,
        });
      }

      classBreakdown[key] = {
        class: cls.class, section: cls.section || null,
        total: cTotal, present: cP, late: cL, absent: cA,
        marked:   cToday.length,
        unmarked: Math.max(0, cTotal - cToday.length),
        pct:      cTotal > 0 ? Math.round(((cP + cL) / cTotal) * 100) : 0,
        last7Days:  c7,   // FIX 4
        last30Days: c30,  // FIX 4
      };
    }

    // ── Per-student stats for low attendance + trending ───────────────────
    const startDate7 = dateNDaysAgo(6);

    const studentStats = myStudents.map(student => {
      const sid     = student._id.toString();
      const sAtt    = allMyAttendance.filter(a => a.studentId.toString() === sid);
      const total   = sAtt.length;
      const present = sAtt.filter(a => a.status === 'Present').length;
      const absent  = sAtt.filter(a => a.status === 'Absent').length;
      const late    = sAtt.filter(a => a.status === 'Late').length;
      const percentage = total > 0
        ? parseFloat(((present + late) / total * 100).toFixed(1)) : 0;

      // Recent 7-day percentage for trend comparison
      const recent7   = sAtt.filter(a => a.date >= startDate7 && a.date <= selectedDate);
      const r7P       = recent7.filter(a => a.status === 'Present').length;
      const r7L       = recent7.filter(a => a.status === 'Late').length;
      // FIX 1: recentPct and overallPct now properly calculated
      const recentPct = recent7.length > 0
        ? parseFloat(((r7P + r7L) / recent7.length * 100).toFixed(1)) : 0;
      const overallPct = percentage;

      const sortedAtt      = [...sAtt].sort((a, b) => new Date(b.date) - new Date(a.date));
      const last3Statuses  = sortedAtt.slice(0, 3).map(a => a.status);
      const isAbsentToday  = sortedAtt.find(a => a.date === selectedDate)?.status === 'Absent';
      const isTrendingDown = last3Statuses.filter(s => s === 'Absent' || s === 'Late').length >= 2;

      return {
        studentId: student._id,
        name: student.name,   rollNo:  student.rollNo,
        class: student.class, section: student.section,
        year:  student.year,  session: student.session,
        email: student.email, phone:   student.phone, photo: student.photo,
        present, absent, late, total, percentage,
        // FIX 1: these fields now exist so TDashboard trending badges show correctly
        recentPct, overallPct,
        last3Statuses, isAbsentToday, isTrendingDown,
        // FIX 3: threshold corrected to < 75 (was incorrectly < 60)
        needsImmediateAttention: percentage < 75 && isTrendingDown && isAbsentToday,
      };
    });

    // Low attendance — below 75%, sorted by urgency then percentage
    const lowAttendance = studentStats
      .filter(s => s.total > 0 && s.percentage < 75)
      .sort((a, b) => {
        if (a.needsImmediateAttention !== b.needsImmediateAttention)
          return a.needsImmediateAttention ? -1 : 1;
        return a.percentage - b.percentage;
      });

    // FIX 1: Trending down now includes overallPct and recentPct
    // TDashboard uses: `${s.overallPct}% → ${s.recentPct}%`
    const trendingDown = studentStats
      .filter(s => s.total >= 5 && s.recentPct > 0 && (s.overallPct - s.recentPct) >= 10)
      .map(s => ({
        name:       s.name,
        class:      s.class,
        section:    s.section,
        rollNo:     s.rollNo,
        overallPct: s.overallPct,  // FIX 1
        recentPct:  s.recentPct,   // FIX 1
        percentage: s.percentage,
        present:    s.present,
        absent:     s.absent,
      }))
      .slice(0, 5);

    return res.json({
      myStudents: myStudents.length,
      presentToday, lateToday, absentToday,
      markedToday, unmarkedToday, attendancePct,
      teacherStreak,
      last7Days, last30Days,
      classBreakdown,
      monthlyOverview: { percentage: mPct, workingDays: mWorkingDays },
      lowAttendance,
      trendingDown,
      recentAttendance,
    });
  } catch (error) {
    console.error('getTeacherDashboardStats error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Update Attendance
// PUT /api/attendance/:id
// ─────────────────────────────────────────────
exports.updateAttendance = async (req, res) => {
  try {
    const { status, remark, editReason } = req.body;
    const oldAttendance = await Attendance.findById(req.params.id).populate('studentId', 'name');
    if (!oldAttendance) return res.status(404).json({ message: 'Attendance record not found.' });

    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      {
        status,
        remark:     remark || oldAttendance.remark || '',
        editReason: editReason || '',
        editedAt:   new Date(),
        editedBy:   req.user.name,
      },
      { new: true }
    );

    await logActivity({
      action: 'ATTENDANCE_UPDATE', category: 'Attendance',
      description: `Updated ${oldAttendance?.studentId?.name}'s attendance: ${oldAttendance?.status} → ${status} on ${oldAttendance?.date}`,
      performedBy: req.user._id, performedByName: req.user.name,
      targetId: req.params.id, targetName: oldAttendance?.studentId?.name,
      metadata: { oldStatus: oldAttendance?.status, newStatus: status, date: oldAttendance?.date, editReason },
      ip: req.ip,
    });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Monthly Attendance Summary
// GET /api/attendance/monthly?month=2026-06
// ─────────────────────────────────────────────
exports.getMonthlyAttendance = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ message: 'Month required. Format: YYYY-MM' });

    const [year, mon] = month.split('-');
    const startDate   = `${year}-${mon}-01`;
    const endDate     = new Date(year, parseInt(mon), 0).toISOString().split('T')[0];

    const monthAttendance = await Attendance.find({ date: { $gte: startDate, $lte: endDate } })
      .populate('studentId', 'name rollNo class section year session');

    const allStudents = await Student.find({ isActive: true })
      .select('name rollNo email phone photo class section year session');

    const uniqueDates = [...new Set(monthAttendance.map(a => a.date))].sort();
    const workingDays = uniqueDates.length;

    const studentSummary = allStudents.map(student => {
      const studentAtt = monthAttendance.filter(a =>
        a.studentId?._id?.toString() === student._id.toString()
      );
      const present  = studentAtt.filter(a => a.status === 'Present').length;
      const absent   = studentAtt.filter(a => a.status === 'Absent').length;
      const late     = studentAtt.filter(a => a.status === 'Late').length;
      const total    = studentAtt.length;
      const unmarked = Math.max(0, workingDays - total);
      const percentage = total > 0 ? ((present + late) / total * 100).toFixed(1) : 0;
      return {
        studentId: student._id,
        name: student.name, email: student.email || '', phone: student.phone || '',
        photo: student.photo || '', rollNo: student.rollNo,
        class: student.class, section: student.section, year: student.year, session: student.session,
        present, absent, late, total, unmarked,
        percentage: parseFloat(percentage),
        isLowAttendance: parseFloat(percentage) < 75 && total > 0,
      };
    });

    const dailySummary = uniqueDates.map(date => {
      const dayAtt  = monthAttendance.filter(a => a.date === date);
      const present = dayAtt.filter(a => a.status === 'Present').length;
      const late    = dayAtt.filter(a => a.status === 'Late').length;
      const absent  = dayAtt.filter(a => a.status === 'Absent').length;
      const total   = allStudents.length;
      return {
        date, present, absent, late,
        unmarked: Math.max(0, total - dayAtt.length), total,
        percentage: total > 0 ? (((present + late) / total) * 100).toFixed(1) : 0,
      };
    });

    res.json({
      month, startDate, endDate,
      totalStudents:     allStudents.length,
      workingDays,
      totalPresent:      studentSummary.reduce((s, x) => s + x.present,  0),
      totalAbsent:       studentSummary.reduce((s, x) => s + x.absent,   0),
      totalLate:         studentSummary.reduce((s, x) => s + x.late,     0),
      totalUnmarked:     studentSummary.reduce((s, x) => s + x.unmarked, 0),
      lowAttendanceCount: studentSummary.filter(s => s.isLowAttendance).length,
      studentSummary, dailySummary,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Low Attendance Students
// GET /api/attendance/low-attendance
// Used by Admin Panel. Teacher Panel uses getTeacherDashboardStats instead.
// ─────────────────────────────────────────────
exports.getLowAttendance = async (req, res) => {
  try {
    const allStudents   = await Student.find({ isActive: true })
      .select('name rollNo class section year session email');
    const allAttendance = await Attendance.find({});
    const todayStr      = getISTDateString();

    const studentStats = allStudents.map(student => {
      const studentAtt = allAttendance.filter(a =>
        a.studentId?.toString() === student._id.toString()
      );
      const present    = studentAtt.filter(a => a.status === 'Present').length;
      const absent     = studentAtt.filter(a => a.status === 'Absent').length;
      const late       = studentAtt.filter(a => a.status === 'Late').length;
      const total      = studentAtt.length;
      const percentage = total > 0 ? ((present + late) / total * 100).toFixed(1) : 0;
      const sorted       = [...studentAtt].sort((a, b) => new Date(b.date) - new Date(a.date));
      const last3        = sorted.slice(0, 3).map(a => a.status);
      const isAbsentToday  = sorted.find(a => a.date === todayStr)?.status === 'Absent';
      const isTrendingDown = last3.filter(s => s === 'Absent' || s === 'Late').length >= 2;
      return {
        studentId: student._id, name: student.name, rollNo: student.rollNo,
        class: student.class, section: student.section, year: student.year,
        session: student.session, email: student.email,
        present, absent, late, total, percentage: parseFloat(percentage),
        last3Statuses: last3, isAbsentToday, isTrendingDown,
        needsImmediateAttention: parseFloat(percentage) < 75 && isTrendingDown && isAbsentToday,
      };
    });

    const lowAttendance = studentStats
      .filter(s => s.total > 0 && s.percentage < 75)
      .sort((a, b) => a.percentage - b.percentage);

    res.json({ lowAttendance, total: lowAttendance.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};