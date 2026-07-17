// server/utils/emailTemplates.js
// Merged file — contains ALL templates from both versions,
// with the best and most complete details from each.

// ─────────────────────────────────────────────
// 1. Daily Absent Report — sent to admins
// Source: current file (more complete structure)
// ─────────────────────────────────────────────
const dailyAbsentReportTemplate = ({ date, absentStudents, totalStudents, presentCount }) => {
  const attendancePercent = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0

  const absentRows = absentStudents.map((s, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151">${s.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280">${s.rollNo || '-'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280">${s.class || '-'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280">${s.section || '-'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280">${s.session || '-'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">
        <span style="background:#fee2e2;color:#dc2626;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600">Absent</span>
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:640px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

    <div style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:28px 32px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="background:rgba(255,255,255,0.2);border-radius:8px;padding:8px;font-size:22px">📊</div>
        <div>
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">Daily Attendance Report</h1>
          <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px">${date}</p>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:20px 32px;gap:12px;background:#f8fafc;border-bottom:1px solid #e5e7eb">
      <div style="text-align:center;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb">
        <p style="margin:0;font-size:24px;font-weight:700;color:#2563eb">${totalStudents}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Total Students</p>
      </div>
      <div style="text-align:center;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb">
        <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a">${presentCount}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Present</p>
      </div>
      <div style="text-align:center;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb">
        <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626">${absentStudents.length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Absent</p>
      </div>
    </div>

    <div style="padding:20px 32px;border-bottom:1px solid #e5e7eb">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;font-weight:600;color:#374151">Overall Attendance</span>
        <span style="font-size:13px;font-weight:700;color:${attendancePercent >= 75 ? '#16a34a' : '#dc2626'}">${attendancePercent}%</span>
      </div>
      <div style="background:#e5e7eb;border-radius:999px;height:8px;overflow:hidden">
        <div style="background:${attendancePercent >= 75 ? '#22c55e' : attendancePercent >= 50 ? '#f59e0b' : '#ef4444'};width:${attendancePercent}%;height:100%;border-radius:999px"></div>
      </div>
    </div>

    ${absentStudents.length > 0 ? `
    <div style="padding:24px 32px">
      <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827">❌ Absent Students (${absentStudents.length})</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Name</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Roll No</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Class</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Section</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Session</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Status</th>
          </tr>
        </thead>
        <tbody>${absentRows}</tbody>
      </table>
    </div>` : `
    <div style="padding:32px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">🎉</div>
      <p style="font-size:16px;font-weight:600;color:#16a34a;margin:0">All students are present today!</p>
      <p style="font-size:13px;color:#6b7280;margin:6px 0 0">100% attendance achieved today.</p>
    </div>`}

    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">This email was sent automatically by <strong>Attendance System</strong></p>
    </div>
  </div>
</body>
</html>`
}

// ─────────────────────────────────────────────
// 2. Attendance Confirmation — sent to the student when marked
// Source: MERGED — current file structure + updated file's Late (amber) gradient support
// Previously Late status incorrectly showed the same red color as Absent.
// Now Late gets its own amber/yellow gradient header and color scheme.
// ─────────────────────────────────────────────
const attendanceConfirmationTemplate = ({ studentName, date, status, time, className, section, session }) => {
  const isPresent = status === 'Present'
  const isLate = status === 'Late'

  // Each status has its own distinct color pair
  const statusColor = isPresent ? '#16a34a' : isLate ? '#d97706' : '#dc2626'
  const statusBg = isPresent ? '#dcfce7' : isLate ? '#fef3c7' : '#fee2e2'
  const statusEmoji = isPresent ? '✅' : isLate ? '⏰' : '❌'

  // Updated: Late now gets its own amber gradient instead of sharing red with Absent
  const gradient = isPresent
    ? '#15803d,#22c55e'
    : isLate
    ? '#b45309,#f59e0b'
    : '#b91c1c,#ef4444'

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:480px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

    <div style="background:linear-gradient(135deg,${gradient});padding:24px 28px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">${statusEmoji}</div>
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700">Attendance ${status}</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${date}</p>
    </div>

    <div style="padding:24px 28px">
      <p style="margin:0 0 20px;font-size:15px;color:#374151">Hello! <strong>${studentName}</strong>'s attendance has been recorded for today.</p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;border:1px solid #e5e7eb;margin-bottom:20px">
        <div style="display:grid;gap:10px">
          ${[
            ['Student', studentName],
            ['Class', `${className}${section ? ` — ${section}` : ''}`],
            ['Session', session],
            ['Date', date],
            ['Time', time],
          ].map(([label, value]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:8px">
            <span style="font-size:13px;color:#6b7280">${label}</span>
            <span style="font-size:13px;font-weight:600;color:#111827">${value}</span>
          </div>`).join('')}
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:#6b7280">Status</span>
            <span style="background:${statusBg};color:${statusColor};padding:3px 12px;border-radius:999px;font-size:12px;font-weight:700">${statusEmoji} ${status}</span>
          </div>
        </div>
      </div>
      ${!isPresent ? `
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:13px;color:#92400e">⚠️ <strong>Please note:</strong> If this was marked incorrectly, please contact your teacher.</p>
      </div>` : ''}
    </div>

    <div style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">Automated email — <strong>Attendance System</strong></p>
    </div>
  </div>
</body>
</html>`
}

// ─────────────────────────────────────────────
// 3. Absent Notification — sent specifically when a student is marked Absent
// Source: NEW — only in updated file, not in current file at all.
// Separate from attendanceConfirmationTemplate — this is a dedicated
// absence alert with exam debarment warning, sent via bulk submit flow.
// ─────────────────────────────────────────────
const absentNotificationTemplate = ({ studentName, date, className, section, session }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:480px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

    <div style="background:linear-gradient(135deg,#b91c1c,#ef4444);padding:24px 28px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">❌</div>
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700">Absent Notification</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${date}</p>
    </div>

    <div style="padding:24px 28px">
      <p style="font-size:15px;color:#374151;margin:0 0 16px">
        Hello <strong>${studentName}</strong>, you have been marked <strong style="color:#dc2626">Absent</strong> today.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px">
        ${[
          ['Class', `${className}${section ? ` — ${section}` : ''}`],
          ['Session', session],
          ['Date', date],
          ['Status', '❌ Absent'],
        ].map(([label, value]) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #fee2e2">
          <span style="font-size:13px;color:#6b7280">${label}</span>
          <span style="font-size:13px;font-weight:600;color:#111827">${value}</span>
        </div>`).join('')}
      </div>
      <p style="font-size:13px;color:#6b7280;margin:0">If you believe this is a mistake, please contact your teacher immediately.</p>
    </div>

    <div style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">Automated email — <strong>Attendance System</strong></p>
    </div>
  </div>
</body>
</html>`

// ─────────────────────────────────────────────
// 4. Low Attendance Alert — sent to individual student
// Source: MERGED — current file's 4 colored stat boxes + progress bar
//         + updated file's detailed info list + exam debarment warning.
// ─────────────────────────────────────────────
const lowAttendanceAlertTemplate = ({ studentName, rollNo, className, section, session, present, absent, total, percentage }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

    <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:28px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">⚠️</div>
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Low Attendance Alert</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px">${className}${section ? ` - ${section}` : ''}${session ? ` • ${session}` : ''}</p>
    </div>

    <div style="padding:24px 28px">
      <p style="margin:0 0 16px;font-size:15px;color:#374151">Dear <strong>${studentName}</strong>, your current attendance is critically low.</p>
      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6">Your attendance is below 75%. Please review the details below and improve your attendance as soon as possible.</p>

      <!-- 4 colored stat boxes (from current file) -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="text-align:center;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px">
          <p style="margin:0;font-size:18px;font-weight:800;color:#374151">${total}</p>
          <p style="margin:2px 0 0;font-size:10px;color:#6b7280">Total</p>
        </div>
        <div style="text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px">
          <p style="margin:0;font-size:18px;font-weight:800;color:#16a34a">${present}</p>
          <p style="margin:2px 0 0;font-size:10px;color:#6b7280">Present</p>
        </div>
        <div style="text-align:center;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px">
          <p style="margin:0;font-size:18px;font-weight:800;color:#dc2626">${absent}</p>
          <p style="margin:2px 0 0;font-size:10px;color:#6b7280">Absent</p>
        </div>
        <div style="text-align:center;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px">
          <p style="margin:0;font-size:18px;font-weight:800;color:#dc2626">${percentage}%</p>
          <p style="margin:2px 0 0;font-size:10px;color:#6b7280">Attendance</p>
        </div>
      </div>

      <!-- Detailed info list (from updated file) -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:16px">
        ${[
          ['Roll No', rollNo || '-'],
          ['Class', `${className}${section ? ` - ${section}` : ''}`],
          ['Session', session || '-'],
          ['Days Present', present],
          ['Days Absent', absent],
          ['Total Days', total],
        ].map(([label, value]) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #fef3c7">
          <span style="font-size:13px;color:#6b7280">${label}</span>
          <span style="font-size:13px;font-weight:600;color:#111827">${value}</span>
        </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:8px 0">
          <span style="font-size:13px;color:#6b7280">Attendance %</span>
          <span style="font-size:16px;font-weight:800;color:#dc2626">${percentage}%</span>
        </div>
      </div>

      <!-- Progress bar (from current file) -->
      <div style="background:#e5e7eb;border-radius:999px;height:8px;overflow:hidden;margin-bottom:16px">
        <div style="background:#ef4444;width:${Math.min(100, percentage)}%;height:100%;border-radius:999px"></div>
      </div>

      <!-- Exam debarment warning (from updated file) -->
      <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:14px">
        <p style="font-size:13px;color:#b91c1c;margin:0;font-weight:600">
          ⚠️ Students with less than 75% attendance may face debarment from exams. Please attend your classes regularly.
        </p>
      </div>
    </div>

    <div style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">Automated email — <strong>Attendance System</strong></p>
    </div>
  </div>
</body>
</html>`

// ─────────────────────────────────────────────
// 5. Weekly Teacher Summary — sent every Monday morning
// Source: MERGED — current file's purple/indigo gradient (matches teacher theme)
//         + updated file's Students count box + large percentage display at bottom.
// ─────────────────────────────────────────────
const teacherWeeklySummaryTemplate = ({ teacherName, startDate, endDate, totalStudents, present, absent, late, percentage }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:30px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">📆</div>
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">Weekly Attendance Summary</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${startDate} — ${endDate}</p>
    </div>

    <div style="padding:24px 32px">
      <p style="font-size:15px;color:#374151;margin:0 0 20px">
        Hello <strong>${teacherName}</strong>, here is your class attendance summary for last week.
      </p>

      <!-- 5 stat boxes: Students added (from updated file), Present/Absent/Late kept (from current file) -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:10px;margin-bottom:20px">
        ${[
          ['Students', totalStudents, '#2563eb'],
          ['Present', present, '#16a34a'],
          ['Absent', absent, '#dc2626'],
          ['Late', late, '#d97706'],
          ['Attendance', `${percentage}%`, percentage >= 75 ? '#16a34a' : percentage >= 50 ? '#d97706' : '#dc2626'],
        ].map(([label, value, color]) => `
        <div style="text-align:center;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb">
          <p style="margin:0;font-size:18px;font-weight:700;color:${color}">${value}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#6b7280">${label}</p>
        </div>`).join('')}
      </div>

      <!-- Large attendance rate display (from updated file) -->
      <div style="background:#f0fdf4;border-radius:8px;padding:20px;text-align:center">
        <p style="margin:0;font-size:13px;color:#6b7280">Overall Attendance Rate</p>
        <p style="margin:6px 0 0;font-size:40px;font-weight:800;color:${percentage >= 75 ? '#16a34a' : percentage >= 50 ? '#d97706' : '#dc2626'}">${percentage}%</p>
        <div style="background:#e5e7eb;border-radius:999px;height:8px;overflow:hidden;margin-top:12px">
          <div style="background:${percentage >= 75 ? '#22c55e' : percentage >= 50 ? '#f59e0b' : '#ef4444'};width:${Math.min(100, percentage)}%;height:100%;border-radius:999px"></div>
        </div>
      </div>

      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center">
        Open the Reports tab in your dashboard for the full breakdown.
      </p>
    </div>

    <div style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">Sent automatically every Monday by <strong>Attendance System</strong></p>
    </div>
  </div>
</body>
</html>`

// ─────────────────────────────────────────────
// 6. Teacher Welcome Email — sent when a new teacher account is created
// Source: current file (MUCH more complete — has subject, qualification,
//         phone, assigned classes sections that updated file was missing)
// ─────────────────────────────────────────────
const teacherWelcomeTemplate = ({
  teacherName, email, password, subject, qualification,
  phone, assignedClasses, loginUrl
}) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <div style="background:linear-gradient(135deg,#1d4ed8,#4f46e5,#7c3aed);padding:36px 32px;text-align:center">
      <div style="width:64px;height:64px;background:rgba(255,255,255,0.2);border-radius:16px;margin:0 auto 16px;display:inline-flex;align-items:center;justify-content:center;font-size:28px">👨‍🏫</div>
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800">Welcome to Attendance System!</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Your teacher account has been created successfully</p>
    </div>

    <div style="padding:32px">
      <p style="color:#374151;font-size:15px;margin:0 0 8px">Hello, <strong>${teacherName}</strong> 👋</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.6">
        Your teacher account has been created. Below are your login credentials and profile details.
      </p>

      <!-- Login credentials section -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:20px">
        <h3 style="color:#1d4ed8;margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">🔑 Login Credentials</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:130px">Email:</td>
            <td style="padding:6px 0;color:#1d4ed8;font-size:13px;font-weight:700">${email}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px">Password:</td>
            <td style="padding:6px 0;color:#1d4ed8;font-size:14px;font-weight:700;font-family:monospace;letter-spacing:1px">${password}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px">Role:</td>
            <td style="padding:6px 0;color:#1d4ed8;font-size:13px;font-weight:700">Teacher</td>
          </tr>
        </table>
      </div>

      <!-- Profile details section (subject, qualification, phone) -->
      ${subject || qualification || phone ? `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px">
        <h3 style="color:#374151;margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">👤 Your Profile</h3>
        <table style="width:100%;border-collapse:collapse">
          ${subject ? `<tr><td style="padding:5px 0;color:#6b7280;font-size:13px;width:130px">Subject:</td><td style="padding:5px 0;color:#374151;font-size:13px;font-weight:600">${subject}</td></tr>` : ''}
          ${qualification ? `<tr><td style="padding:5px 0;color:#6b7280;font-size:13px">Qualification:</td><td style="padding:5px 0;color:#374151;font-size:13px;font-weight:600">${qualification}</td></tr>` : ''}
          ${phone ? `<tr><td style="padding:5px 0;color:#6b7280;font-size:13px">Phone:</td><td style="padding:5px 0;color:#374151;font-size:13px;font-weight:600">${phone}</td></tr>` : ''}
        </table>
      </div>` : ''}

      <!-- Assigned classes section -->
      ${assignedClasses && assignedClasses.length > 0 ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:20px">
        <h3 style="color:#16a34a;margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">🏫 Assigned Classes</h3>
        ${assignedClasses.map(cls => `
        <div style="background:#ffffff;border:1px solid #d1fae5;border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
          <span style="color:#166534;font-weight:700;font-size:13px">${cls.class}${cls.section ? ` - Section ${cls.section}` : ''}</span>
          ${cls.year || cls.session ? `<span style="color:#6b7280;font-size:12px">${[cls.year, cls.session].filter(Boolean).join(' • ')}</span>` : ''}
        </div>`).join('')}
      </div>` : ''}

      <!-- Password change warning -->
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:24px">
        <p style="color:#92400e;font-size:13px;margin:0">
          ⚠️ <strong>Important:</strong> Please change your password after first login for security purposes.
        </p>
      </div>

      <div style="text-align:center;margin-bottom:8px">
        <a href="${loginUrl || 'http://localhost:5173'}"
          style="background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">
          🚀 Login to Your Account
        </a>
      </div>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        This email was sent by <strong>Attendance System</strong>. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`

// ─────────────────────────────────────────────
// 7. Teacher Profile Update Email
// Source: current file (more complete — shows year+session in assigned classes)
// ─────────────────────────────────────────────
const teacherUpdateTemplate = ({
  teacherName, subject, qualification, phone,
  assignedClasses, updatedBy
}) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <div style="background:linear-gradient(135deg,#0891b2,#0284c7);padding:28px 32px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">✏️</div>
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:800">Profile Updated</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">Your teacher profile has been updated by admin</p>
    </div>

    <div style="padding:28px 32px">
      <p style="color:#374151;font-size:14px;margin:0 0 20px">Hello <strong>${teacherName}</strong>, your profile details have been updated.</p>

      ${subject || qualification || phone ? `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;margin-bottom:16px">
        <h3 style="color:#0369a1;margin:0 0 14px;font-size:13px;font-weight:700;text-transform:uppercase">Updated Profile Details</h3>
        <table style="width:100%;border-collapse:collapse">
          ${subject ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:130px">Subject:</td><td style="padding:6px 0;color:#374151;font-size:13px;font-weight:600">${subject}</td></tr>` : ''}
          ${qualification ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Qualification:</td><td style="padding:6px 0;color:#374151;font-size:13px;font-weight:600">${qualification}</td></tr>` : ''}
          ${phone ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Phone:</td><td style="padding:6px 0;color:#374151;font-size:13px;font-weight:600">${phone}</td></tr>` : ''}
        </table>
      </div>` : ''}

      ${assignedClasses && assignedClasses.length > 0 ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:16px">
        <h3 style="color:#16a34a;margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase">🏫 Assigned Classes</h3>
        ${assignedClasses.map(cls => `
        <div style="background:#ffffff;border:1px solid #d1fae5;border-radius:6px;padding:10px 14px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
          <span style="color:#166534;font-weight:700;font-size:13px">${cls.class}${cls.section ? ` - ${cls.section}` : ''}</span>
          ${cls.year ? `<span style="color:#6b7280;font-size:12px">${[cls.year, cls.session].filter(Boolean).join(' • ')}</span>` : ''}
        </div>`).join('')}
      </div>` : ''}

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px">
        <p style="color:#6b7280;font-size:12px;margin:0">
          Updated by: <strong style="color:#374151">${updatedBy}</strong> • ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Attendance System — Automated Notification</p>
    </div>
  </div>
</body>
</html>`

// ─────────────────────────────────────────────
// 8. Teacher Password Reset Email
// Source: current file (same in both, current kept for consistency)
// ─────────────────────────────────────────────
const teacherPasswordResetTemplate = ({ teacherName, newPassword, resetBy }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:500px;margin:30px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <div style="background:linear-gradient(135deg,#ea580c,#dc2626);padding:28px 32px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">🔐</div>
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:800">Password Reset</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">Your account password has been changed</p>
    </div>

    <div style="padding:28px 32px">
      <p style="color:#374151;font-size:14px;margin:0 0 20px">Hello <strong>${teacherName}</strong>, your login password has been reset by admin.</p>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center">
        <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">🔑 Your New Password</p>
        <div style="background:#ffffff;border:2px solid #fca5a5;border-radius:8px;padding:14px 20px;display:inline-block">
          <span style="font-family:monospace;font-size:20px;font-weight:800;color:#dc2626;letter-spacing:3px">${newPassword}</span>
        </div>
      </div>

      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px">
        <p style="color:#92400e;font-size:13px;margin:0">
          ⚠️ <strong>Security Notice:</strong> Please login immediately and change this password to something only you know.
        </p>
      </div>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px">
        <p style="color:#6b7280;font-size:12px;margin:0">
          Reset by: <strong style="color:#374151">${resetBy}</strong> • ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>

    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">Attendance System — Automated Notification</p>
    </div>
  </div>
</body>
</html>`

module.exports = {
  dailyAbsentReportTemplate,
  attendanceConfirmationTemplate,
  absentNotificationTemplate,
  lowAttendanceAlertTemplate,
  teacherWeeklySummaryTemplate,
  teacherWelcomeTemplate,
  teacherUpdateTemplate,
  teacherPasswordResetTemplate,
}