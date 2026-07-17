import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, LineChart, Line
} from 'recharts'
import useTodayDate from '../../hooks/useTodayDate'

// ── Cascading filter options ──
const getCascadingOptions = (students, { fc, fs, fy, fses }) => {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort()
  return {
    classOptions: uniq(students.filter(s => (!fs || s.section === fs) && (!fy || s.year === fy) && (!fses || s.session === fses)).map(s => s.class)),
    sectionOptions: uniq(students.filter(s => (!fc || s.class === fc) && (!fy || s.year === fy) && (!fses || s.session === fses)).map(s => s.section)),
    yearOptions: uniq(students.filter(s => (!fc || s.class === fc) && (!fs || s.section === fs) && (!fses || s.session === fses)).map(s => s.year)),
    sessionOptions: uniq(students.filter(s => (!fc || s.class === fc) && (!fs || s.section === fs) && (!fy || s.year === fy)).map(s => s.session)),
  }
}

const getWeekDates = (startDateStr) => {
  const dates = []
  const start = new Date(startDateStr)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d)
  }
  return dates
}

const getDefaultWeekStart = () => {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toISOString().split('T')[0]
}

// mailto: only works if the browser/OS has a default mail app configured.
// Gmail's web compose link works for everyone instead, opened in a new tab.
const getGmailLink = (email) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`
const formatWhatsapp = (phone) => {
  const digits = String(phone).replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

// ── FilterBar — defined OUTSIDE the component so React keeps the same
//    function reference across renders instead of remounting dropdowns ──
const FilterBar = ({ allMyStudents, fc, sfc, fs, sfs, fy, sfy, fses, sfses, extra }) => {
  const { classOptions, sectionOptions, yearOptions, sessionOptions } = getCascadingOptions(allMyStudents, { fc, fs, fy, fses })
  const selClass = 'px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all'
  return (
    <div className="flex gap-2.5 flex-wrap items-center">
      {[
        { value: fc, onChange: (v) => { sfc(v); sfs(''); sfy(''); sfses('') }, opts: classOptions, ph: 'All Classes' },
        { value: fs, onChange: (v) => { sfs(v); sfy(''); sfses('') }, opts: sectionOptions, ph: 'All Sections' },
        { value: fy, onChange: (v) => { sfy(v); sfses('') }, opts: yearOptions, ph: 'All Years' },
        { value: fses, onChange: (v) => sfses(v), opts: sessionOptions, ph: 'All Sessions' },
      ].map((f, i) => (
        <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)} className={selClass}>
          <option value="">{f.ph}</option>
          {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      {extra}
      {(fc || fs || fy || fses) && (
        <button onClick={() => { sfc(''); sfs(''); sfy(''); sfses('') }}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-500 transition-all border border-gray-200 dark:border-gray-600">
          ✕ Clear
        </button>
      )}
    </div>
  )
}

const Spinner = () => (
  <div className="text-center py-14">
    <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
    <p className="text-gray-400 text-sm mt-3 font-medium">Loading...</p>
  </div>
)

const WeeklyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  const pct = d?.total > 0 ? Math.round((d.present / d.total) * 100) : 0
  return (
    <div className="bg-gray-950/95 backdrop-blur border border-gray-700/60 rounded-2xl px-4 py-3.5 shadow-2xl min-w-[180px]">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-gray-700/50">
        <p className="font-black text-white text-sm">{label} — {d?.fullDate}</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-400 text-xs flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Present</span>
          <span className="text-emerald-400 font-black text-sm">{d?.present}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-400 text-xs flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Absent</span>
          <span className="text-red-400 font-black text-sm">{d?.absent}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-400 text-xs flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Late</span>
          <span className="text-amber-400 font-black text-sm">{d?.late}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-400 text-xs flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block"/>Unmarked</span>
          <span className="text-slate-300 font-black text-sm">{d?.unmarked}</span>
        </div>
        <div className="border-t border-gray-700/50 pt-1.5 mt-1 flex items-center justify-between">
          <span className="text-gray-400 text-xs">Total Students</span>
          <span className="text-white font-black text-sm">{d?.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Attendance</span>
          <span className={`font-black text-sm ${pct>=75?'text-emerald-400':pct>=50?'text-amber-400':'text-red-400'}`}>{pct}%</span>
        </div>
      </div>
    </div>
  )
}

const MonthlyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-950/95 backdrop-blur border border-gray-700/60 rounded-2xl px-4 py-3.5 shadow-2xl min-w-[160px]">
      <p className="font-black text-white text-sm mb-2 pb-2 border-b border-gray-700/50">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="text-gray-400 text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-black text-sm" style={{ color: p.color }}>{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Calendar Heatmap ──
const CalendarHeatmap = ({ month, dailySummary }) => {
  const [year, mon] = month.split('-').map(Number)
  const firstDay = new Date(year, mon - 1, 1)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const startWeekday = firstDay.getDay()

  const dataByDate = {}
  dailySummary.forEach(d => { dataByDate[d.date] = d })

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ day, dateStr, data: dataByDate[dateStr] })
  }

  const getColor = (pct) => {
    if (pct === undefined || pct === null) return 'bg-gray-100 dark:bg-gray-700/30 text-gray-300 dark:text-gray-600'
    const p = parseFloat(pct)
    if (p >= 90) return 'bg-emerald-500 text-white'
    if (p >= 75) return 'bg-emerald-300 dark:bg-emerald-600 text-emerald-900 dark:text-white'
    if (p >= 50) return 'bg-amber-300 dark:bg-amber-600 text-amber-900 dark:text-white'
    if (p > 0) return 'bg-red-300 dark:bg-red-600 text-red-900 dark:text-white'
    return 'bg-gray-100 dark:bg-gray-700/30 text-gray-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-5 shadow-sm">
      <h3 className="text-base font-black text-gray-800 dark:text-white mb-4">🗓️ Calendar Heatmap</h3>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => (
          cell === null ? <div key={i} /> : (
            <div key={i}
              title={cell.data ? `${cell.dateStr}: ${cell.data.percentage}% (${(parseFloat(cell.data.present)||0) + (parseFloat(cell.data.late)||0)} present, ${cell.data.absent} absent)` : `${cell.dateStr}: no attendance taken`}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold cursor-default ${getColor(cell.data?.percentage)}`}>
              {cell.day}
            </div>
          )
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        {[
          { color: 'bg-emerald-500', label: '90%+' },
          { color: 'bg-emerald-300 dark:bg-emerald-600', label: '75-89%' },
          { color: 'bg-amber-300 dark:bg-amber-600', label: '50-74%' },
          { color: 'bg-red-300 dark:bg-red-600', label: '<50%' },
          { color: 'bg-gray-100 dark:bg-gray-700/30 border border-gray-300 dark:border-gray-600', label: 'No data' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${item.color}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Student Insight Modal — completely redesigned:
//    real avatar, full profile details, contact buttons, and the trend
//    chart now gracefully handles 0/1/2+ months of data instead of
//    rendering a broken-looking single dot. ──
const StudentInsightModal = ({ student, data, loading, dark, onClose }) => {
  if (!student) return null
  const isLow = data?.stats && parseFloat(data.stats.percentage) < 75 && data.stats.total > 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col relative" onClick={e => e.stopPropagation()}>

        {/* Cover */}
        <div className="h-28 bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 relative flex-shrink-0">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)', backgroundSize: '12px 12px' }} />
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm transition-all z-20">✕</button>
          {isLow && (
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 bg-red-500/20 text-red-200 border border-red-400/30 rounded-full text-xs font-black">⚠️ Low Attendance</span>
            </div>
          )}
        </div>

        {/* Avatar — positioned outside the scroll container so it never clips */}
        <div className="absolute left-6 top-16 z-10">
          {student.photo ? (
            <img src={student.photo} alt={student.name} className="w-20 h-20 rounded-3xl object-cover border-4 border-white dark:border-gray-800 shadow-2xl" />
          ) : (
            <div className={`w-20 h-20 rounded-3xl border-4 border-white dark:border-gray-800 shadow-2xl flex items-center justify-center text-white text-3xl font-black ${isLow ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
              {(student.name || '?').charAt(0)}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 pt-12
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-indigo-300
          [&::-webkit-scrollbar-thumb]:dark:bg-indigo-700
          [&::-webkit-scrollbar-thumb]:rounded-full">

          <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">{student.name}</h2>
          <p className="text-sm text-gray-400 mt-1">
            Roll No: {student.rollNo || 'N/A'} •{' '}
            {student.email
              ? <a href={getGmailLink(student.email)} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">{student.email}</a>
              : 'No email'}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            {[
              { label: 'Class', value: `${student.class || '-'}${student.section ? `-${student.section}` : ''}`, icon: '🏫' },
              { label: 'Year', value: student.year || 'N/A', icon: '📚' },
              { label: 'Session', value: student.session || 'N/A', icon: '🗓️' },
              { label: 'Phone', value: student.phone || 'N/A', icon: '📱' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                <p className="text-[10px] text-gray-400 mb-0.5 font-medium">{item.icon} {item.label}</p>
                <p className="text-sm font-black text-gray-700 dark:text-gray-200 truncate">{item.value}</p>
              </div>
            ))}
          </div>

          {(student.phone || student.email) && (
            <div className="flex gap-2 mt-3">
              {student.phone && <a href={`tel:${student.phone}`} className="flex-1 text-center py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-bold">📞 Call</a>}
              {student.phone && <a href={`https://wa.me/${formatWhatsapp(student.phone)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 text-xs font-bold">💬 WhatsApp</a>}
              {student.email && <a href={getGmailLink(student.email)} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-xs font-bold">✉️ Email</a>}
            </div>
          )}

          {loading ? <Spinner /> : data && (
            <>
              <div className="grid grid-cols-4 gap-2 mt-5 mb-4">
                {[
                  { label: 'Total', value: data.stats.total, color: 'text-gray-700 dark:text-white' },
                  { label: 'Present', value: data.stats.present, color: 'text-green-600' },
                  { label: 'Absent', value: data.stats.absent, color: 'text-red-500' },
                  { label: '%', value: `${data.stats.percentage}%`, color: parseFloat(data.stats.percentage) >= 75 ? 'text-green-600' : 'text-red-500' },
                ].map((c, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
                    <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-500">Attendance Progress</span>
                  <span className={`text-xs font-black ${parseFloat(data.stats.percentage) >= 75 ? 'text-green-600' : 'text-red-500'}`}>{data.stats.percentage}%</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${parseFloat(data.stats.percentage) >= 75 ? 'bg-green-500' : parseFloat(data.stats.percentage) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, parseFloat(data.stats.percentage))}%` }} />
                </div>
              </div>

              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Attendance Trend</p>
              {data.trend.length >= 2 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={dark ? '#1f2937' : '#f1f5f9'} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl px-3 py-2 shadow-xl">
                            <p className="text-white text-xs font-black">{label}</p>
                            <p className="text-indigo-300 text-xs font-bold">{payload[0].value}% attendance</p>
                          </div>
                        )
                      }}
                    />
                    <Line type="monotone" dataKey="percentage" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : data.trend.length === 1 ? (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-indigo-600">{data.trend[0].percentage}%</p>
                  <p className="text-xs text-gray-400 mt-1">Only {data.trend[0].label} on record — trend needs at least 2 months</p>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400">No attendance history yet</p>
                </div>
              )}

              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 mt-5">Recent Records</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {data.recent.map((rec, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2.5 border border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                      {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                      rec.status === 'Present' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                      rec.status === 'Absent' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    }`}>{rec.status}</span>
                  </div>
                ))}
                {data.recent.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No records yet</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Mobile card renderers ──
const DailyMobileCards = ({ list, onOpen }) => (
  <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-700/50">
    {list.map((a, i) => (
      <div key={i} className="p-4 flex items-center gap-3 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/30" onClick={() => onOpen(a.studentId)}>
        {a.studentId?.photo
          ? <img src={a.studentId.photo} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
          : <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xs font-black flex-shrink-0">{(a.studentId?.name || '?').charAt(0)}</div>}
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-800 dark:text-white text-sm truncate">{a.studentId?.name || '-'}</p>
          <p className="text-xs text-gray-400">{a.studentId?.class || a.class}{a.studentId?.section ? `-${a.studentId.section}` : ''} • Roll {a.studentId?.rollNo || '-'}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-black flex-shrink-0 ${
          a.status === 'Present' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
          a.status === 'Absent' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
          a.status === 'Late' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
          'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300'
        }`}>{a.status}</span>
      </div>
    ))}
  </div>
)

const MonthlyMobileCards = ({ list, onOpen }) => (
  <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-700/50">
    {list.map((s, i) => (
      <div key={i} className="p-4 cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/30"
        onClick={() => onOpen({ _id: s.studentId, name: s.name, rollNo: s.rollNo, class: s.class, section: s.section, year: s.year, session: s.session, email: s.email, phone: s.phone, photo: s.photo })}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-black text-gray-800 dark:text-white text-sm">{s.name}</p>
            <p className="text-xs text-gray-400">{s.class}{s.section ? `-${s.section}` : ''} • Roll {s.rollNo || '-'}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-black flex-shrink-0 ${s.isLowAttendance ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
            {s.percentage}%
          </span>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-green-600 font-bold">{s.present || 0}P</span>
          <span className="text-red-500 font-bold">{s.absent || 0}A</span>
          <span className="text-amber-500 font-bold">{s.late || 0}L</span>
          <span className="text-slate-400 font-bold">{s.unmarked || 0}U</span>
        </div>
      </div>
    ))}
  </div>
)

const LowMobileCards = ({ list, selectedIds, onToggle }) => (
  <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-700/50">
    {list.map((s, i) => (
      <div key={i} className="p-4 flex items-start gap-3">
        <input type="checkbox" checked={selectedIds.has(s.studentId)} onChange={() => onToggle(s.studentId)}
          className="w-4 h-4 mt-1 rounded accent-red-600 cursor-pointer flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-black text-gray-800 dark:text-white text-sm">{s.name}</p>
            <span className="text-base font-black text-red-500">{s.percentage}%</span>
          </div>
          <p className="text-xs text-gray-400">{s.class}{s.section ? `-${s.section}` : ''} • {s.email || 'No email'}</p>
          <div className="flex gap-3 text-xs mt-1">
            <span className="text-green-600 font-bold">{s.present || 0} Present</span>
            <span className="text-red-500 font-bold">{s.absent || 0} Absent</span>
          </div>
        </div>
      </div>
    ))}
  </div>
)

const TReports = ({ user, dark }) => {
  const [activeTab, setActiveTab] = useState('daily')
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [allMyStudents, setAllMyStudents] = useState([])

  // ── Midnight auto-refresh ────────────────────────────────────────────────
  // dailyDate used to be set once from new Date() and never updated again,
  // so the Daily tab silently kept showing yesterday's date after midnight
  // if the tab was left open. useTodayDate() recomputes the date exactly at
  // midnight and shifts the Daily tab forward; the existing
  // `useEffect([... dailyDate ...])` below then automatically refetches.
  // Monthly and Low Attendance tabs are intentionally NOT auto-reset here —
  // if a teacher is reviewing a past month, midnight should not yank them
  // back to the current month without warning.
  const todayStr = useTodayDate((newDate) => {
    setDailyDate(newDate)
  }, true)
  const [dailyDate, setDailyDate] = useState(todayStr)
  const [allDailyData, setAllDailyData] = useState([])
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [dailySearch, setDailySearch] = useState('')

  const [weekStartDate, setWeekStartDate] = useState(getDefaultWeekStart())
  const [weekData, setWeekData] = useState([])
  const [wFilterClass, setWFilterClass] = useState('')
  const [wFilterSection, setWFilterSection] = useState('')
  const [wFilterYear, setWFilterYear] = useState('')
  const [wFilterSession, setWFilterSession] = useState('')
  const [compareWeekly, setCompareWeekly] = useState(false)
  const [prevWeekPct, setPrevWeekPct] = useState(null)
  const [weekCompareLoading, setWeekCompareLoading] = useState(false)

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [allMonthlyData, setAllMonthlyData] = useState(null)
  const [mFilterClass, setMFilterClass] = useState('')
  const [mFilterSection, setMFilterSection] = useState('')
  const [mFilterYear, setMFilterYear] = useState('')
  const [mFilterSession, setMFilterSession] = useState('')
  const [monthlySearch, setMonthlySearch] = useState('')
  const [compareMonthly, setCompareMonthly] = useState(false)
  const [prevMonthPct, setPrevMonthPct] = useState(null)
  const [monthCompareLoading, setMonthCompareLoading] = useState(false)

  const [lowDate, setLowDate] = useState(new Date().toISOString().slice(0, 7))
  const [allLowData, setAllLowData] = useState(null)
  const [lFilterClass, setLFilterClass] = useState('')
  const [lFilterSection, setLFilterSection] = useState('')
  const [lFilterYear, setLFilterYear] = useState('')
  const [lFilterSession, setLFilterSession] = useState('')
  const [selectedLowIds, setSelectedLowIds] = useState(new Set())
  const [sendingLowAlerts, setSendingLowAlerts] = useState(false)

  const [insightStudent, setInsightStudent] = useState(null)
  const [insightData, setInsightData] = useState(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [showInsight, setShowInsight] = useState(false)

  const token = JSON.parse(localStorage.getItem('user'))?.token
  const assignedClasses = user?.assignedClasses || []

  useEffect(() => { fetchMyStudents() }, [])
  useEffect(() => {
    if (activeTab === 'daily') fetchDaily()
    if (activeTab === 'weekly') fetchWeekly()
    if (activeTab === 'monthly') fetchMonthly()
    if (activeTab === 'low') fetchLow()
  }, [activeTab, dailyDate, weekStartDate, month, lowDate, allMyStudents])

  useEffect(() => {
    if (compareMonthly) loadPreviousMonthCompare()
  }, [month])

  const fetchMyStudents = async () => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const my = data.filter(s =>
        assignedClasses.some(c => c.class === s.class && (!c.section || c.section === s.section))
      )
      setAllMyStudents(my)
    } catch { console.log('Students fetch error') }
  }

  const filterForTeacher = (data) => data.filter(item => {
    const ic = item.class || item.studentId?.class
    const is = item.section || item.studentId?.section
    return assignedClasses.some(c => c.class === ic && (!c.section || c.section === is))
  })

  const fetchDaily = async () => {
    if (!allMyStudents.length) return
    try {
      setLoading(true)
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/attendance/date/${dailyDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const markedMap = {}
      data.forEach(a => {
        const sid = a.studentId?._id || a.studentId
        if (sid) markedMap[sid] = a
      })
      const merged = allMyStudents.map(student => {
        const existing = markedMap[student._id]
        if (existing) {
          return { ...existing, studentId: { ...existing.studentId, ...student } }
        }
        return { studentId: student, status: 'Unmarked', time: '-' }
      })
      setAllDailyData(merged)
    } catch { toast.error('Failed to load daily report!') }
    finally { setLoading(false) }
  }

  const fetchWeekly = async () => {
    if (!allMyStudents.length) return
    try {
      setLoading(true)
      const weekDates = getWeekDates(weekStartDate)
      let hadError = false

      const responses = await Promise.all(
        weekDates.map(d => {
          const dateStr = d.toISOString().split('T')[0]
          return axios.get(`${import.meta.env.VITE_API_URL}/attendance/date/${dateStr}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => ({ data: res.data, ok: true }))
            .catch(() => { hadError = true; return { data: [], ok: false } })
        })
      )

      const results = weekDates.map((d, idx) => {
        const dateStr = d.toISOString().split('T')[0]
        const resp = responses[idx]
        const fd = resp.ok ? filterForTeacher(resp.data) : []

        const markedMap = {}
        fd.forEach(a => {
          const sid = a.studentId?._id || a.studentId
          if (sid) markedMap[String(sid)] = a
        })
        const merged = allMyStudents.map(student => {
          const existing = markedMap[String(student._id)]
          if (existing) return { ...existing, studentId: { ...existing.studentId, ...student } }
          return { studentId: student, status: 'Unmarked', time: '-' }
        })

        return {
          day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
          date: dateStr,
          fullDate: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          rawData: merged,
          present: merged.filter(a => a.status === 'Present').length,
          absent: merged.filter(a => a.status === 'Absent').length,
          late: merged.filter(a => a.status === 'Late').length,
          unmarked: merged.filter(a => a.status === 'Unmarked').length,
          total: merged.length,
        }
      })

      setWeekData(results)
      if (hadError) toast.error('Some days could not be loaded — showing partial data')
    } catch {
      toast.error('Failed to load weekly report!')
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthly = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/attendance/monthly?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const filtered = data.studentSummary?.filter(s =>
        assignedClasses.some(c => c.class === s.class && (!c.section || c.section === s.section))
      ) || []
      setAllMonthlyData({ ...data, studentSummary: filtered })
    } catch { toast.error('Failed to load monthly report!') }
    finally { setLoading(false) }
  }

  const fetchLow = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/attendance/monthly?month=${lowDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const filtered = data.studentSummary?.filter(s =>
        assignedClasses.some(c => c.class === s.class && (!c.section || c.section === s.section))
      ) || []
      setAllLowData({ ...data, studentSummary: filtered })
    } catch { toast.error('Failed to load low attendance report!') }
    finally { setLoading(false) }
  }

  const loadPreviousWeekCompare = async () => {
    if (!allMyStudents.length) return
    setWeekCompareLoading(true)
    try {
      const prevStart = new Date(weekStartDate)
      prevStart.setDate(prevStart.getDate() - 7)
      const prevDates = getWeekDates(prevStart.toISOString().split('T')[0])
      const responses = await Promise.all(
        prevDates.map(d => axios.get(`${import.meta.env.VITE_API_URL}/attendance/date/${d.toISOString().split('T')[0]}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })))
      )
      let present = 0, slots = 0
      responses.forEach(r => {
        const fd = filterForTeacher(r.data)
        present += fd.filter(a => a.status === 'Present' || a.status === 'Late').length
        slots += allMyStudents.length
      })
      setPrevWeekPct(slots > 0 ? Math.round((present / slots) * 100) : 0)
    } catch {
      toast.error('Failed to load comparison data')
    } finally {
      setWeekCompareLoading(false)
    }
  }

  const toggleCompareWeekly = () => {
    const next = !compareWeekly
    setCompareWeekly(next)
    if (next) loadPreviousWeekCompare()
  }

  const loadPreviousMonthCompare = async () => {
    try {
      setMonthCompareLoading(true)
      const [y, m] = month.split('-').map(Number)
      const prevDate = new Date(y, m - 2, 1)
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/attendance/monthly?month=${prevMonthStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const filtered = data.studentSummary?.filter(s =>
        assignedClasses.some(c => c.class === s.class && (!c.section || c.section === s.section))
      ) || []
      const totalP = filtered.reduce((s, x) => s + (x.present || 0), 0)
      const totalA = filtered.reduce((s, x) => s + (x.absent || 0), 0)
      const totalL = filtered.reduce((s, x) => s + (x.late || 0), 0)
      const denom = totalP + totalA + totalL
      setPrevMonthPct(denom > 0 ? Math.round(((totalP + totalL) / denom) * 100) : 0)
    } catch {
      toast.error('Failed to load comparison data')
    } finally {
      setMonthCompareLoading(false)
    }
  }

  const toggleCompareMonthly = () => {
    const next = !compareMonthly
    setCompareMonthly(next)
    if (next) loadPreviousMonthCompare()
  }

  const openStudentInsight = async (student) => {
    if (!student?._id) return
    setInsightStudent(student)
    setShowInsight(true)
    setInsightLoading(true)
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/attendance/student/${student._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const byMonth = {}
      data.attendance.forEach(a => {
        const m = a.date.slice(0, 7)
        if (!byMonth[m]) byMonth[m] = { present: 0, absent: 0, late: 0, total: 0 }
        byMonth[m].total++
        if (a.status === 'Present') byMonth[m].present++
        else if (a.status === 'Absent') byMonth[m].absent++
        else if (a.status === 'Late') byMonth[m].late++
      })
      const months = Object.keys(byMonth).sort().slice(-6)
      const trend = months.map(m => ({
        month: m,
        label: new Date(`${m}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        ...byMonth[m],
        percentage: byMonth[m].total > 0 ? Math.round(((byMonth[m].present + byMonth[m].late) / byMonth[m].total) * 100) : 0,
      }))
      setInsightData({ stats: data.stats, recent: data.attendance.slice(0, 10), trend })
    } catch {
      toast.error('Failed to load student insight')
    } finally {
      setInsightLoading(false)
    }
  }

  const toggleLowSelect = (id) => setSelectedLowIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const clearLowSelection = () => setSelectedLowIds(new Set())

  const sendLowAlerts = async () => {
    if (selectedLowIds.size === 0) { toast.error('Select at least one student first!'); return }
    try {
      setSendingLowAlerts(true)
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/email/low-attendance-alert`,
        { studentIds: Array.from(selectedLowIds) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(data.message || 'Alerts sent!')
      clearLowSelection()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send alerts')
    } finally {
      setSendingLowAlerts(false)
    }
  }

  const applyFilter = (data, fc, fs, fy, fses) => data.filter(a => {
    const ac = a.studentId?.class || a.class
    const as_ = a.studentId?.section || a.section
    const ay = a.studentId?.year || a.year
    const ases = a.studentId?.session || a.session
    return (!fc || ac === fc) && (!fs || as_ === fs) && (!fy || ay === fy) && (!fses || ases === fses)
  })

  const applySummaryFilter = (data, fc, fs, fy, fses) => data.filter(s =>
    (!fc || s.class === fc) && (!fs || s.section === fs) && (!fy || s.year === fy) && (!fses || s.session === fses)
  )

  const filteredDaily = applyFilter(allDailyData, filterClass, filterSection, filterYear, filterSession)
    .filter(a => !dailySearch ||
      (a.studentId?.name || '').toLowerCase().includes(dailySearch.toLowerCase()) ||
      (a.studentId?.rollNo || '').toLowerCase().includes(dailySearch.toLowerCase()))

  const presentCount = filteredDaily.filter(a => a.status === 'Present').length
  const absentCount = filteredDaily.filter(a => a.status === 'Absent').length
  const lateCount = filteredDaily.filter(a => a.status === 'Late').length
  const unmarkedCount = filteredDaily.filter(a => a.status === 'Unmarked').length

  const filteredWeekData = weekData.map(d => {
    const fd = applyFilter(d.rawData || [], wFilterClass, wFilterSection, wFilterYear, wFilterSession)
    return {
      ...d,
      present: fd.filter(a => a.status === 'Present').length,
      absent: fd.filter(a => a.status === 'Absent').length,
      late: fd.filter(a => a.status === 'Late').length,
      unmarked: fd.filter(a => a.status === 'Unmarked').length,
      total: fd.length,
    }
  })

  const currentWeekPct = (() => {
    const totalPresent = filteredWeekData.reduce((s, d) => s + d.present + d.late, 0)
    const totalSlots = filteredWeekData.reduce((s, d) => s + d.total, 0)
    return totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : 0
  })()

  const bestWorstDay = (() => {
    const withData = filteredWeekData.filter(d => d.total > 0)
    if (!withData.length) return null
    const best = withData.reduce((a, b) => (b.present / b.total) > (a.present / a.total) ? b : a)
    const worst = withData.reduce((a, b) => (b.present / b.total) < (a.present / a.total) ? b : a)
    return {
      best: { ...best, pct: Math.round((best.present / best.total) * 100) },
      worst: { ...worst, pct: Math.round((worst.present / worst.total) * 100) },
    }
  })()

  const filteredMonthlySummary = (allMonthlyData
    ? applySummaryFilter(allMonthlyData.studentSummary || [], mFilterClass, mFilterSection, mFilterYear, mFilterSession)
    : []
  ).filter(s => !monthlySearch ||
    (s.name || '').toLowerCase().includes(monthlySearch.toLowerCase()) ||
    (s.rollNo || '').toLowerCase().includes(monthlySearch.toLowerCase()))

  const monthlyTotalPresent = filteredMonthlySummary.reduce((s, x) => s + (x.present || 0), 0)
  const monthlyTotalAbsent = filteredMonthlySummary.reduce((s, x) => s + (x.absent || 0), 0)
  const monthlyTotalLate = filteredMonthlySummary.reduce((s, x) => s + (x.late || 0), 0)
  const monthlyTotalUnmarked = filteredMonthlySummary.reduce((s, x) => s + (x.unmarked || 0), 0)
  const monthlyLowCount = filteredMonthlySummary.filter(s => s.isLowAttendance).length

  const currentMonthPct = (() => {
    const denom = monthlyTotalPresent + monthlyTotalAbsent + monthlyTotalLate
    return denom > 0 ? Math.round(((monthlyTotalPresent + monthlyTotalLate) / denom) * 100) : 0
  })()

  const filteredLowData = allLowData
    ? applySummaryFilter(
        (allLowData.studentSummary || []).filter(s => s.isLowAttendance),
        lFilterClass, lFilterSection, lFilterYear, lFilterSession
      )
    : []

  const buildFilterLabel = (fc, fs, fy, fses) => {
    const parts = []
    if (fc) parts.push(`Class: ${fc}`)
    if (fs) parts.push(`Section: ${fs}`)
    if (fy) parts.push(`Year: ${fy}`)
    if (fses) parts.push(`Session: ${fses}`)
    return parts.length ? parts.join(' | ') : 'All Classes & Sections'
  }

  const sendEmailReport = async () => {
    try {
      setEmailLoading(true)
      let subject = '', htmlContent = ''
      if (activeTab === 'daily') {
        subject = `📅 Daily Attendance Report — ${dailyDate} | ${user?.name}`
        htmlContent = buildDailyEmailHtml(filteredDaily, dailyDate)
      } else if (activeTab === 'weekly') {
        subject = `📆 Weekly Attendance Report | ${user?.name}`
        htmlContent = buildWeeklyEmailHtml(filteredWeekData)
      } else if (activeTab === 'monthly') {
        subject = `📊 Monthly Attendance Report — ${month} | ${user?.name}`
        htmlContent = buildMonthlyEmailHtml(filteredMonthlySummary, month)
      } else if (activeTab === 'low') {
        subject = `⚠️ Low Attendance Alert — ${lowDate} | ${user?.name}`
        htmlContent = buildLowEmailHtml(filteredLowData, lowDate)
      }
      await axios.post(`${import.meta.env.VITE_API_URL}/email/send-report`, {
        to: user?.email, subject, html: htmlContent,
      }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success(`📧 Report sent to ${user?.email}!`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email. Check email configuration.')
    } finally { setEmailLoading(false) }
  }

  const buildDailyEmailHtml = (data, date) => `
    <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;padding:20px;background:#f8fafc">
    <div style="max-width:750px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">📅 Daily Attendance Report</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">${date} | ${user?.name} | ${user?.subject || '-'}</p>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px">${buildFilterLabel(filterClass, filterSection, filterYear, filterSession)}</p>
      </div>
      <div style="padding:20px">
        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
          ${[['Present', data.filter(a=>a.status==='Present').length,'#16a34a','#f0fdf4','#bbf7d0'],
             ['Absent', data.filter(a=>a.status==='Absent').length,'#dc2626','#fef2f2','#fecaca'],
             ['Late', data.filter(a=>a.status==='Late').length,'#d97706','#fffbeb','#fde68a'],
             ['Unmarked', data.filter(a=>a.status==='Unmarked').length,'#6b7280','#f9fafb','#e5e7eb'],
             ['Total', data.length,'#4f46e5','#eef2ff','#c7d2fe']].map(([l,v,c,bg,br]) =>
            `<div style="flex:1;min-width:80px;background:${bg};border:1px solid ${br};border-radius:8px;padding:12px;text-align:center">
              <p style="font-size:22px;font-weight:800;color:${c};margin:0">${v}</p>
              <p style="color:#6b7280;font-size:11px;margin:4px 0 0">${l}</p>
            </div>`).join('')}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#4f46e5">
            ${['#','Name','Email','Roll No','Class','Year','Session','Status','Time'].map(h=>`<th style="padding:8px 10px;color:#fff;text-align:left">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${data.map((a,i)=>`
            <tr style="background:${i%2===0?'#f9fafb':'#fff'}">
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${i+1}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600">${a.studentId?.name||'-'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${a.studentId?.email||'-'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${a.studentId?.rollNo||'-'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${a.studentId?.class||a.class||'-'}${a.studentId?.section?`-${a.studentId.section}`:''}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${a.studentId?.year||a.year||'-'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${a.studentId?.session||a.session||'-'}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:${a.status==='Present'?'#16a34a':a.status==='Absent'?'#dc2626':a.status==='Late'?'#d97706':'#6b7280'};font-weight:700">${a.status}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${a.time}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div></body></html>`

  const buildWeeklyEmailHtml = (data) => `
    <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;padding:20px;background:#f8fafc">
    <div style="max-width:650px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
      <div style="background:linear-gradient(135deg,#0891b2,#0284c7);padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">📆 Weekly Attendance Report</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">Teacher: ${user?.name}</p>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px">${buildFilterLabel(wFilterClass,wFilterSection,wFilterYear,wFilterSession)}</p>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px">Week: ${weekStartDate} to ${data[data.length-1]?.date||''}</p>
      </div>
      <div style="padding:20px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#0891b2">
            ${['Day','Date','Total','Present','Absent','Late','Unmarked','%'].map(h=>`<th style="padding:8px 10px;color:#fff;text-align:left">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${data.map((d,i)=>{const pct=d.total>0?Math.round((d.present/d.total)*100):0;return`
            <tr style="background:${i%2===0?'#f9fafb':'#fff'}">
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:700">${d.day}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${d.fullDate}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${d.total}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#16a34a;font-weight:700">${d.present}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:700">${d.absent}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#d97706;font-weight:700">${d.late}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:700">${d.unmarked}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${pct>=75?'#16a34a':'#dc2626'}">${pct}%</td>
            </tr>`}).join('')}
          </tbody>
        </table>
      </div>
    </div></body></html>`

  const buildMonthlyEmailHtml = (data, month) => `
    <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;padding:20px;background:#f8fafc">
    <div style="max-width:780px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
      <div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">📊 Monthly Attendance Report — ${month}</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">Teacher: ${user?.name}</p>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px">${buildFilterLabel(mFilterClass,mFilterSection,mFilterYear,mFilterSession)}</p>
      </div>
      <div style="padding:20px">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:#059669">
            ${['#','Name','Email','Class','Year','Session','Present','Absent','Late','Unmarked','%','Status'].map(h=>`<th style="padding:7px 8px;color:#fff;text-align:left">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${data.map((s,i)=>`
            <tr style="background:${i%2===0?'#f9fafb':'#fff'}">
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${i+1}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-weight:600">${s.name}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${s.email||'-'}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${s.class||'-'}${s.section?`-${s.section}`:''}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${s.year||'-'}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb">${s.session||'-'}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#16a34a;font-weight:700">${s.present||0}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:700">${s.absent||0}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#d97706;font-weight:700">${s.late||0}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:700">${s.unmarked||0}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${s.percentage>=75?'#16a34a':s.percentage>=50?'#d97706':'#dc2626'}">${s.percentage}%</td>
              <td style="padding:7px 8px;border-bottom:1px solid #e5e7eb;color:${s.isLowAttendance?'#dc2626':'#16a34a'};font-weight:700">${s.isLowAttendance?'⚠️ Low':'✅ Good'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div></body></html>`

  const buildLowEmailHtml = (data, month) => `
    <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;padding:20px;background:#f8fafc">
    <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
      <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">⚠️ Low Attendance Alert — ${month}</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">${data.length} students below 75% | Teacher: ${user?.name}</p>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px">${buildFilterLabel(lFilterClass,lFilterSection,lFilterYear,lFilterSession)}</p>
      </div>
      <div style="padding:20px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#dc2626">
            ${['#','Name','Email','Class','Year','Session','Present','Absent','%'].map(h=>`<th style="padding:8px;color:#fff;text-align:left">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${data.map((s,i)=>`
            <tr style="background:${i%2===0?'#fef2f2':'#fff'}">
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca">${i+1}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca;font-weight:600">${s.name}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca">${s.email||'-'}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca">${s.class||'-'}${s.section?`-${s.section}`:''}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca">${s.year||'-'}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca">${s.session||'-'}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca;color:#16a34a;font-weight:700">${s.present||0}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca;color:#dc2626;font-weight:700">${s.absent||0}</td>
              <td style="padding:7px 8px;border-bottom:1px solid #fecaca;font-weight:800;color:#dc2626">${s.percentage}%</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div></body></html>`

  // ── Export functions ──
  const exportDailyExcel = () => {
    if (!filteredDaily.length) { toast.error('No data!'); return }
    const filterInfo = buildFilterLabel(filterClass, filterSection, filterYear, filterSession)
    const ws = XLSX.utils.aoa_to_sheet([
      ['Daily Attendance Report'],
      [`Date: ${dailyDate}`],
      [`Teacher: ${user?.name} | Subject: ${user?.subject || '-'}`],
      [`Filter: ${filterInfo}`],
      [],
      ['Sr', 'Name', 'Email', 'Roll No', 'Class', 'Section', 'Year', 'Session', 'Status', 'Time'],
      ...filteredDaily.map((a, i) => [
        i+1,
        a.studentId?.name||'-',
        a.studentId?.email||'-',
        a.studentId?.rollNo||'-',
        a.studentId?.class||a.class||'-',
        a.studentId?.section||a.section||'-',
        a.studentId?.year||a.year||'-',
        a.studentId?.session||a.session||'-',
        a.status, a.time
      ])
    ])
    ws['!cols'] = [5,20,25,10,10,10,8,10,10,8].map(w=>({wch:w}))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Daily')
    XLSX.writeFile(wb, `daily_${dailyDate}_${filterClass||'all'}.xlsx`)
    toast.success('Excel exported!')
  }

  const exportDailyPDF = () => {
    if (!filteredDaily.length) { toast.error('No data!'); return }
    const filterInfo = buildFilterLabel(filterClass, filterSection, filterYear, filterSession)
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(16); doc.setTextColor(79,70,229)
    doc.text('Daily Attendance Report', 14, 16)
    doc.setFontSize(9); doc.setTextColor(80)
    doc.text(`Date: ${dailyDate}`, 14, 24)
    doc.text(`Teacher: ${user?.name} | Subject: ${user?.subject||'-'}`, 14, 30)
    doc.text(`Filter: ${filterInfo}`, 14, 36)
    doc.text(`Present: ${presentCount} | Absent: ${absentCount} | Late: ${lateCount} | Unmarked: ${unmarkedCount} | Total: ${filteredDaily.length}`, 14, 42)
    autoTable(doc, {
      startY: 47,
      head: [['#','Name','Email','Roll No','Class','Section','Year','Session','Status','Time']],
      body: filteredDaily.map((a,i)=>[
        i+1,
        a.studentId?.name||'-',
        a.studentId?.email||'-',
        a.studentId?.rollNo||'-',
        a.studentId?.class||a.class||'-',
        a.studentId?.section||a.section||'-',
        a.studentId?.year||a.year||'-',
        a.studentId?.session||a.session||'-',
        a.status, a.time
      ]),
      headStyles:{fillColor:[79,70,229],textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      styles:{fontSize:7.5},
    })
    doc.save(`daily_${dailyDate}_${filterClass||'all'}.pdf`)
    toast.success('PDF exported!')
  }

  const exportWeeklyExcel = () => {
    if (!filteredWeekData.length) { toast.error('No data!'); return }
    const filterInfo = buildFilterLabel(wFilterClass,wFilterSection,wFilterYear,wFilterSession)
    const ws = XLSX.utils.aoa_to_sheet([
      ['Weekly Attendance Report'],
      [`Week: ${weekStartDate} to ${filteredWeekData[filteredWeekData.length-1]?.date||''}`],
      [`Teacher: ${user?.name}`],
      [`Filter: ${filterInfo}`],
      [],
      ['Day','Date','Total','Present','Absent','Late','Unmarked','Attendance %'],
      ...filteredWeekData.map(d=>[
        d.day, d.fullDate, d.total, d.present, d.absent, d.late, d.unmarked,
        d.total>0?`${Math.round((d.present/d.total)*100)}%`:'0%'
      ])
    ])
    ws['!cols']=[8,12,8,8,8,8,10,12].map(w=>({wch:w}))
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'Weekly')
    XLSX.writeFile(wb,`weekly_${weekStartDate}_${wFilterClass||'all'}.xlsx`)
    toast.success('Excel exported!')
  }

  const exportWeeklyPDF = () => {
    if (!filteredWeekData.length) { toast.error('No data!'); return }
    const filterInfo = buildFilterLabel(wFilterClass,wFilterSection,wFilterYear,wFilterSession)
    const doc = new jsPDF()
    doc.setFontSize(16); doc.setTextColor(79,70,229)
    doc.text('Weekly Attendance Report', 14, 16)
    doc.setFontSize(9); doc.setTextColor(80)
    doc.text(`Week: ${weekStartDate} to ${filteredWeekData[filteredWeekData.length-1]?.date||''}`, 14, 24)
    doc.text(`Teacher: ${user?.name}`, 14, 30)
    doc.text(`Filter: ${filterInfo}`, 14, 36)
    autoTable(doc, {
      startY: 42,
      head:[['Day','Date','Total','Present','Absent','Late','Unmarked','Attendance %']],
      body:filteredWeekData.map(d=>[
        d.day, d.fullDate, d.total, d.present, d.absent, d.late, d.unmarked,
        d.total>0?`${Math.round((d.present/d.total)*100)}%`:'0%'
      ]),
      headStyles:{fillColor:[79,70,229],textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      styles:{fontSize:9},
    })
    doc.save(`weekly_${weekStartDate}_${wFilterClass||'all'}.pdf`)
    toast.success('PDF exported!')
  }

  const exportMonthlyExcel = () => {
    if (!filteredMonthlySummary.length) { toast.error('No data!'); return }
    const filterInfo = buildFilterLabel(mFilterClass,mFilterSection,mFilterYear,mFilterSession)
    const ws = XLSX.utils.aoa_to_sheet([
      ['Monthly Attendance Report'],
      [`Month: ${month}`],
      [`Teacher: ${user?.name} | Subject: ${user?.subject||'-'}`],
      [`Filter: ${filterInfo}`],
      [`Working Days: ${allMonthlyData?.workingDays||0}`],
      [],
      ['Sr','Name','Email','Class','Section','Year','Session','Present','Absent','Late','Unmarked','Total','Percentage','Status'],
      ...filteredMonthlySummary.map((s,i)=>[
        i+1, s.name, s.email||'-',
        s.class||'-', s.section||'-', s.year||'-', s.session||'-',
        s.present||0, s.absent||0, s.late||0, s.unmarked||0, s.total||0,
        `${s.percentage}%`,
        s.isLowAttendance?'LOW':'GOOD'
      ])
    ])
    ws['!cols']=[5,20,25,10,10,8,10,8,8,6,10,8,10,8].map(w=>({wch:w}))
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'Monthly')
    XLSX.writeFile(wb,`monthly_${month}_${mFilterClass||'all'}.xlsx`)
    toast.success('Excel exported!')
  }

  const exportMonthlyPDF = () => {
    if (!filteredMonthlySummary.length) { toast.error('No data!'); return }
    const filterInfo = buildFilterLabel(mFilterClass,mFilterSection,mFilterYear,mFilterSession)
    const doc = new jsPDF({orientation:'landscape'})
    doc.setFontSize(16); doc.setTextColor(79,70,229)
    doc.text('Monthly Attendance Report', 14, 16)
    doc.setFontSize(9); doc.setTextColor(80)
    doc.text(`Month: ${month}`, 14, 24)
    doc.text(`Teacher: ${user?.name} | Subject: ${user?.subject||'-'}`, 14, 30)
    doc.text(`Filter: ${filterInfo}`, 14, 36)
    doc.text(`Working Days: ${allMonthlyData?.workingDays||0} | Students: ${filteredMonthlySummary.length} | Low Attendance: ${monthlyLowCount}`, 14, 42)
    autoTable(doc, {
      startY: 48,
      head:[['#','Name','Email','Class','Section','Year','Session','Present','Absent','Late','Unmarked','%','Status']],
      body:filteredMonthlySummary.map((s,i)=>[
        i+1, s.name, s.email||'-',
        s.class||'-', s.section||'-', s.year||'-', s.session||'-',
        s.present||0, s.absent||0, s.late||0, s.unmarked||0,
        `${s.percentage}%`,
        s.isLowAttendance?'LOW':'GOOD'
      ]),
      headStyles:{fillColor:[79,70,229],textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      styles:{fontSize:7},
    })
    doc.save(`monthly_${month}_${mFilterClass||'all'}.pdf`)
    toast.success('PDF exported!')
  }

  const exportLowExcel = () => {
    if (!filteredLowData.length) { toast.error('No data!'); return }
    const filterInfo = buildFilterLabel(lFilterClass,lFilterSection,lFilterYear,lFilterSession)
    const ws = XLSX.utils.aoa_to_sheet([
      ['Low Attendance Report'],
      [`Month: ${lowDate}`],
      [`Teacher: ${user?.name}`],
      [`Filter: ${filterInfo}`],
      [`Students below 75%: ${filteredLowData.length}`],
      [],
      ['Sr','Name','Email','Class','Section','Year','Session','Present','Absent','Attendance %'],
      ...filteredLowData.map((s,i)=>[
        i+1, s.name, s.email||'-',
        s.class||'-', s.section||'-', s.year||'-', s.session||'-',
        s.present||0, s.absent||0, `${s.percentage}%`
      ])
    ])
    ws['!cols']=[5,20,25,10,10,8,10,8,8,12].map(w=>({wch:w}))
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'LowAttendance')
    XLSX.writeFile(wb,`low_attendance_${lowDate}_${lFilterClass||'all'}.xlsx`)
    toast.success('Excel exported!')
  }

  const exportLowPDF = () => {
    if (!filteredLowData.length) { toast.error('No data!'); return }
    const filterInfo = buildFilterLabel(lFilterClass,lFilterSection,lFilterYear,lFilterSession)
    const doc = new jsPDF()
    doc.setFontSize(16); doc.setTextColor(220,38,38)
    doc.text('Low Attendance Report', 14, 16)
    doc.setFontSize(9); doc.setTextColor(80)
    doc.text(`Month: ${lowDate}`, 14, 24)
    doc.text(`Teacher: ${user?.name}`, 14, 30)
    doc.text(`Filter: ${filterInfo}`, 14, 36)
    doc.text(`${filteredLowData.length} student(s) below 75% attendance threshold`, 14, 42)
    autoTable(doc, {
      startY: 48,
      head:[['#','Name','Email','Class','Section','Year','Session','Present','Absent','%']],
      body:filteredLowData.map((s,i)=>[
        i+1, s.name, s.email||'-',
        s.class||'-', s.section||'-', s.year||'-', s.session||'-',
        s.present||0, s.absent||0, `${s.percentage}%`
      ]),
      headStyles:{fillColor:[220,38,38],textColor:255},
      alternateRowStyles:{fillColor:[254,242,242]},
      styles:{fontSize:8.5},
    })
    doc.save(`low_attendance_${lowDate}_${lFilterClass||'all'}.pdf`)
    toast.success('PDF exported!')
  }

  // ── Print — now opens a clean, standalone window with ONLY the report,
  //    instead of printing the whole live page (sidebar/header included). ──
  const openPrintWindow = (html) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800')
    if (!printWindow) {
      toast.error('Please allow pop-ups to print the report')
      return
    }
    const printStyles = `<style>
      @media print {
        body { margin: 0; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        @page { margin: 14mm 10mm; }
      }
    </style></head>`
    const finalHtml = html.replace('</head>', printStyles)
    printWindow.document.open()
    printWindow.document.write(finalHtml)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
  }

  const handlePrint = () => {
    if (activeTab === 'daily') openPrintWindow(buildDailyEmailHtml(filteredDaily, dailyDate))
    else if (activeTab === 'weekly') openPrintWindow(buildWeeklyEmailHtml(filteredWeekData))
    else if (activeTab === 'monthly') openPrintWindow(buildMonthlyEmailHtml(filteredMonthlySummary, month))
    else if (activeTab === 'low') openPrintWindow(buildLowEmailHtml(filteredLowData, lowDate))
  }

  const tabs = [
    { id: 'daily', label: '📅 Daily' },
    { id: 'weekly', label: '📆 Weekly' },
    { id: 'monthly', label: '📊 Monthly' },
    { id: 'low', label: '⚠️ Low Attendance' },
  ]

  return (
    <div>
      <StudentInsightModal
        student={showInsight ? insightStudent : null}
        data={insightData}
        loading={insightLoading}
        dark={dark}
        onClose={() => setShowInsight(false)}
      />

      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-white">Reports</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your class attendance analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-black hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
            🖨️ Print
          </button>
          <button onClick={sendEmailReport} disabled={emailLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-sm font-black transition-all disabled:opacity-50">
            {emailLoading
              ? <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>Sending...</>
              : '📧 Email Report'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-5">📨 You'll automatically receive a weekly summary email every Monday at 8:00 AM.</p>

      <div className="flex gap-1.5 mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-1.5 shadow-sm">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && (
        <div>
          <div className="flex gap-3 mb-5 items-center flex-wrap">
            <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <input type="text" placeholder="Search student or roll no..." value={dailySearch} onChange={e => setDailySearch(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"/>
            <FilterBar allMyStudents={allMyStudents} fc={filterClass} sfc={setFilterClass} fs={filterSection} sfs={setFilterSection}
              fy={filterYear} sfy={setFilterYear} fses={filterSession} sfses={setFilterSession}/>
            <div className="flex gap-2 ml-auto">
              <button onClick={exportDailyExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">📊 Excel</button>
              <button onClick={exportDailyPDF} className="px-3 py-2 border border-red-500 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">📄 PDF</button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-5">
            {[
              { label:'Total', value:filteredDaily.length, color:'text-gray-700 dark:text-white', bg:'bg-gray-50 dark:bg-gray-700/50', border:'border-gray-200 dark:border-gray-600' },
              { label:'Present', value:presentCount, color:'text-green-600', bg:'bg-green-50 dark:bg-green-900/20', border:'border-green-200 dark:border-green-800' },
              { label:'Absent', value:absentCount, color:'text-red-500', bg:'bg-red-50 dark:bg-red-900/20', border:'border-red-200 dark:border-red-800' },
              { label:'Late', value:lateCount, color:'text-amber-600', bg:'bg-amber-50 dark:bg-amber-900/20', border:'border-amber-200 dark:border-amber-800' },
              { label:'Unmarked', value:unmarkedCount, color:'text-slate-500 dark:text-slate-300', bg:'bg-slate-50 dark:bg-slate-700/30', border:'border-slate-200 dark:border-slate-600' },
            ].map((card, i) => (
              <div key={i} className={`${card.bg} border ${card.border} rounded-2xl p-5 text-center shadow-sm`}>
                <p className={`text-4xl font-black ${card.color}`}>{card.value}</p>
                <p className="text-xs text-gray-400 font-bold mt-1.5">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            {loading ? <Spinner/> : filteredDaily.length === 0 ? (
              <div className="text-center py-16"><div className="text-4xl mb-3">📋</div><p className="text-gray-400 text-sm">No students match this filter</p></div>
            ) : (
              <>
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        {['#','Student','Roll No','Class','Year','Session','Status','Time'].map(h=>(
                          <th key={h} className={`px-5 py-3 font-black ${h==='Student'?'text-left':'text-center'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDaily.map((a, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                          onClick={() => openStudentInsight(a.studentId)}>
                          <td className="px-5 py-3 text-gray-400 text-xs text-center">{i+1}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              {a.studentId?.photo
                                ? <img src={a.studentId.photo} className="w-9 h-9 rounded-xl object-cover shadow-sm"/>
                                : <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xs font-black">
                                    {(a.studentId?.name||'?').charAt(0)}
                                  </div>}
                              <div>
                                <p className="font-black text-gray-800 dark:text-white text-sm">{a.studentId?.name||'-'}</p>
                                <p className="text-xs text-gray-400">{a.studentId?.email||'No email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs text-center">{a.studentId?.rollNo||'-'}</td>
                          <td className="px-5 py-3 text-center">
                            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-black border border-indigo-200 dark:border-indigo-800">
                              {a.studentId?.class||a.class}{a.studentId?.section?`-${a.studentId.section}`:''}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs text-center">{a.studentId?.year||a.year||'-'}</td>
                          <td className="px-5 py-3 text-gray-400 text-xs text-center">{a.studentId?.session||a.session||'-'}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                              a.status==='Present'?'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300':
                              a.status==='Absent'?'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300':
                              a.status==='Late'?'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300':
                              'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300'
                            }`}>{a.status}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs text-center">{a.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DailyMobileCards list={filteredDaily} onOpen={openStudentInsight} />
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'weekly' && (
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex gap-2.5 flex-wrap items-center">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20">
                <span className="text-indigo-500 text-xs font-black">📅 Week from</span>
                <input type="date" value={weekStartDate}
                  onChange={e => setWeekStartDate(e.target.value)}
                  className="bg-transparent text-indigo-700 dark:text-indigo-300 text-sm font-bold focus:outline-none"/>
              </div>
              {weekData.length > 0 && (
                <span className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-600">
                  to {weekData[weekData.length-1]?.fullDate}
                </span>
              )}
              <button onClick={toggleCompareWeekly}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all ${compareWeekly ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'}`}>
                📊 Compare with previous week
              </button>
              <FilterBar
                allMyStudents={allMyStudents}
                fc={wFilterClass} sfc={setWFilterClass}
                fs={wFilterSection} sfs={setWFilterSection}
                fy={wFilterYear} sfy={setWFilterYear}
                fses={wFilterSession} sfses={setWFilterSession}
                extra={
                  <button onClick={fetchWeekly}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all shadow-md flex items-center gap-1.5">
                    🔄 Refresh
                  </button>
                }
              />
            </div>
            <div className="flex gap-2">
              <button onClick={exportWeeklyExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">📊 Excel</button>
              <button onClick={exportWeeklyPDF} className="px-3 py-2 border border-red-500 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">📄 PDF</button>
            </div>
          </div>

          {compareWeekly && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm mb-5">
              {weekCompareLoading ? <span className="text-gray-400">Loading comparison...</span> : prevWeekPct !== null && (
                <>
                  <span className="text-gray-400 font-medium">This week: <strong className="text-gray-700 dark:text-gray-200">{currentWeekPct}%</strong> vs last week: <strong className="text-gray-700 dark:text-gray-200">{prevWeekPct}%</strong></span>
                  <span className={`font-black ${currentWeekPct >= prevWeekPct ? 'text-green-600' : 'text-red-500'}`}>
                    {currentWeekPct >= prevWeekPct ? '↑' : '↓'} {Math.abs(currentWeekPct - prevWeekPct)}%
                  </span>
                </>
              )}
            </div>
          )}

          {loading ? <Spinner/> : (
            <>
              {bestWorstDay && (
                <div className="flex gap-3 mb-5 flex-wrap">
                  <div className="flex-1 min-w-[200px] bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-xl">🏆</span>
                    <div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">Best Day</p>
                      <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">{bestWorstDay.best.day}, {bestWorstDay.best.fullDate} — {bestWorstDay.best.pct}%</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-xl">📉</span>
                    <div>
                      <p className="text-xs text-red-700 dark:text-red-300 font-bold">Lowest Day</p>
                      <p className="text-sm font-black text-red-800 dark:text-red-200">{bestWorstDay.worst.day}, {bestWorstDay.worst.fullDate} — {bestWorstDay.worst.pct}%</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-5 shadow-sm overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                  <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl"/>
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl"/>
                </div>

                <div className="flex items-start justify-between mb-5 relative z-10">
                  <div>
                    <h3 className="text-base font-black text-gray-800 dark:text-white">📆 Weekly Attendance Trend</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {weekData[0]?.fullDate} — {weekData[weekData.length-1]?.fullDate}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-end">
                    {[
                      { color:'bg-emerald-500', label:'Present' },
                      { color:'bg-red-500', label:'Absent' },
                      { color:'bg-amber-400', label:'Late' },
                      { color:'bg-slate-400', label:'Unmarked' },
                    ].map((item,i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`}/>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={filteredWeekData} barGap={3} barCategoryGap="28%"
                    margin={{ top: 8, right: 8, left: -18, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.9}/>
                      </linearGradient>
                      <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f87171" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9}/>
                      </linearGradient>
                      <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.9}/>
                      </linearGradient>
                      <linearGradient id="gUnmarked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.7}/>
                      </linearGradient>
                      <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.15"/>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke={dark?'#1f2937':'#f1f5f9'} vertical={false}/>
                    <XAxis dataKey="day"
                      tick={{ fontSize:12, fill:dark?'#9ca3af':'#6b7280', fontWeight:700 }}
                      axisLine={false} tickLine={false}/>
                    <YAxis
                      tick={{ fontSize:11, fill:dark?'#9ca3af':'#6b7280' }}
                      axisLine={false} tickLine={false}/>
                    <Tooltip content={<WeeklyTooltip/>} cursor={{ fill: dark?'rgba(99,102,241,0.08)':'rgba(99,102,241,0.05)', radius:10 }}/>
                    <Bar dataKey="present" fill="url(#gPresent)" name="Present" radius={[7,7,0,0]} filter="url(#barShadow)" maxBarSize={32}/>
                    <Bar dataKey="absent" fill="url(#gAbsent)" name="Absent" radius={[7,7,0,0]} filter="url(#barShadow)" maxBarSize={32}/>
                    <Bar dataKey="late" fill="url(#gLate)" name="Late" radius={[7,7,0,0]} filter="url(#barShadow)" maxBarSize={32}/>
                    <Bar dataKey="unmarked" fill="url(#gUnmarked)" name="Unmarked" radius={[7,7,0,0]} filter="url(#barShadow)" maxBarSize={32}/>
                  </BarChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-7 gap-1 mt-2 relative z-10">
                  {filteredWeekData.map((d, i) => {
                    const pct = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
                    return (
                      <div key={i} className="text-center">
                        <span className={`text-xs font-black ${pct>=75?'text-emerald-500':pct>=50?'text-amber-500':pct>0?'text-red-500':'text-gray-400'}`}>
                          {d.total > 0 ? `${pct}%` : '-'}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5">{d.total > 0 ? `${d.total} stu.` : ''}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      {['Day','Date','Total Students','Present','Absent','Late','Unmarked','Attendance %'].map((h,i)=>(
                        <th key={i} className={`px-5 py-3 font-black ${i<=1?'text-left':'text-center'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWeekData.map((d, i) => {
                      const pct = d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
                      return (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-5 py-3.5 font-black text-gray-700 dark:text-gray-200">{d.day}</td>
                          <td className="px-5 py-3.5 text-gray-400 text-xs font-medium">{d.fullDate}</td>
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300 font-black text-center">{d.total}</td>
                          <td className="px-5 py-3.5 text-emerald-600 font-black text-center">{d.present}</td>
                          <td className="px-5 py-3.5 text-red-500 font-black text-center">{d.absent}</td>
                          <td className="px-5 py-3.5 text-amber-500 font-black text-center">{d.late}</td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-black text-center">{d.unmarked}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5 justify-center">
                              <div className="w-20 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pct>=75?'bg-emerald-500':pct>=50?'bg-amber-500':pct>0?'bg-red-500':'bg-gray-300'}`}
                                  style={{width:`${pct}%`}}/>
                              </div>
                              <span className={`text-xs font-black min-w-[36px] ${pct>=75?'text-emerald-600':pct>=50?'text-amber-500':pct>0?'text-red-500':'text-gray-400'}`}>
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'monthly' && (
        <div>
          <div className="flex gap-3 mb-5 items-center flex-wrap">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <input type="text" placeholder="Search student or roll no..." value={monthlySearch} onChange={e => setMonthlySearch(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"/>
            <button onClick={toggleCompareMonthly}
              className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all ${compareMonthly ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'}`}>
              📊 Compare with previous month
            </button>
            <FilterBar allMyStudents={allMyStudents} fc={mFilterClass} sfc={setMFilterClass} fs={mFilterSection} sfs={setMFilterSection}
              fy={mFilterYear} sfy={setMFilterYear} fses={mFilterSession} sfses={setMFilterSession}/>
            <div className="flex gap-2 ml-auto">
              <button onClick={exportMonthlyExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">📊 Excel</button>
              <button onClick={exportMonthlyPDF} className="px-3 py-2 border border-red-500 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">📄 PDF</button>
            </div>
          </div>

          {compareMonthly && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm mb-5">
              {monthCompareLoading ? <span className="text-gray-400">Loading comparison...</span> : prevMonthPct !== null && (
                <>
                  <span className="text-gray-400 font-medium">This month: <strong className="text-gray-700 dark:text-gray-200">{currentMonthPct}%</strong> vs last month: <strong className="text-gray-700 dark:text-gray-200">{prevMonthPct}%</strong></span>
                  <span className={`font-black ${currentMonthPct >= prevMonthPct ? 'text-green-600' : 'text-red-500'}`}>
                    {currentMonthPct >= prevMonthPct ? '↑' : '↓'} {Math.abs(currentMonthPct - prevMonthPct)}%
                  </span>
                </>
              )}
            </div>
          )}

          {loading ? <Spinner/> : allMonthlyData ? (
            <>
              <div className="grid grid-cols-7 gap-3 mb-5">
                {[
                  { label:'Students', value:filteredMonthlySummary.length, color:'text-gray-700 dark:text-white', bg:'bg-white dark:bg-gray-800', border:'border-gray-200 dark:border-gray-700' },
                  { label:'Working Days', value:allMonthlyData.workingDays||0, color:'text-blue-600', bg:'bg-blue-50 dark:bg-blue-900/20', border:'border-blue-200 dark:border-blue-800' },
                  { label:'Total Present', value:monthlyTotalPresent, color:'text-green-600', bg:'bg-green-50 dark:bg-green-900/20', border:'border-green-200 dark:border-green-800' },
                  { label:'Total Absent', value:monthlyTotalAbsent, color:'text-red-500', bg:'bg-red-50 dark:bg-red-900/20', border:'border-red-200 dark:border-red-800' },
                  { label:'Total Late', value:monthlyTotalLate, color:'text-amber-600', bg:'bg-amber-50 dark:bg-amber-900/20', border:'border-amber-200 dark:border-amber-800' },
                  { label:'Unmarked', value:monthlyTotalUnmarked, color:'text-slate-500 dark:text-slate-300', bg:'bg-slate-50 dark:bg-slate-700/30', border:'border-slate-200 dark:border-slate-600' },
                  { label:'Low Attendance', value:monthlyLowCount, color:'text-red-600', bg:'bg-red-50 dark:bg-red-900/20', border:'border-red-200 dark:border-red-800' },
                ].map((card, i) => (
                  <div key={i} className={`${card.bg} border ${card.border} rounded-2xl p-4 text-center shadow-sm`}>
                    <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 leading-tight">{card.label}</p>
                  </div>
                ))}
              </div>

              <CalendarHeatmap month={month} dailySummary={allMonthlyData.dailySummary || []} />

              {allMonthlyData.dailySummary?.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-5 shadow-sm overflow-hidden relative">
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                    <div className="absolute -top-12 -right-12 w-52 h-52 bg-green-500/5 dark:bg-green-500/10 rounded-full blur-3xl"/>
                    <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-red-500/5 dark:bg-red-500/10 rounded-full blur-3xl"/>
                  </div>
                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div>
                      <h3 className="text-base font-black text-gray-800 dark:text-white">📈 Daily Attendance Trend — {month}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Present, Absent, Late & Unmarked throughout the month</p>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-end">
                      {[
                        {color:'bg-emerald-500',label:'Present'},
                        {color:'bg-red-500',label:'Absent'},
                        {color:'bg-amber-400',label:'Late'},
                        {color:'bg-slate-400',label:'Unmarked'},
                      ].map((item,i)=>(
                        <div key={i} className="flex items-center gap-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${item.color}`}/>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={allMonthlyData.dailySummary} margin={{top:10,right:8,left:-18,bottom:5}}>
                      <defs>
                        {[
                          ['mPresent','#22c55e'],
                          ['mAbsent','#ef4444'],
                          ['mLate','#f59e0b'],
                          ['mUnmarked','#94a3b8'],
                        ].map(([id,color])=>(
                          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.45}/>
                            <stop offset="100%" stopColor={color} stopOpacity={0.02}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="2 6" stroke={dark?'#1f2937':'#f1f5f9'} vertical={false}/>
                      <XAxis dataKey="date"
                        tick={{fontSize:10,fill:dark?'#9ca3af':'#6b7280',fontWeight:600}}
                        tickFormatter={d=>d.split('-')[2]} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10,fill:dark?'#9ca3af':'#6b7280'}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<MonthlyTooltip/>}/>
                      <Area type="monotone" dataKey="present" stroke="#22c55e" strokeWidth={2.5}
                        fill="url(#mPresent)" dot={false}
                        activeDot={{r:6,fill:'#22c55e',strokeWidth:2,stroke:'#fff'}} name="Present"/>
                      <Area type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2.5}
                        fill="url(#mAbsent)" dot={false}
                        activeDot={{r:6,fill:'#ef4444',strokeWidth:2,stroke:'#fff'}} name="Absent"/>
                      <Area type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2}
                        fill="url(#mLate)" dot={false}
                        activeDot={{r:5,fill:'#f59e0b',strokeWidth:2,stroke:'#fff'}} name="Late"/>
                      <Area type="monotone" dataKey="unmarked" stroke="#94a3b8" strokeWidth={1.5}
                        fill="url(#mUnmarked)" dot={false}
                        activeDot={{r:5,fill:'#94a3b8',strokeWidth:2,stroke:'#fff'}} name="Unmarked"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-700 dark:text-gray-200">👥 Student Summary</h3>
                  <span className="text-xs text-gray-400 font-medium">{filteredMonthlySummary.length} students</span>
                </div>
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        {['#','Student','Class','Year','Session','Present','Absent','Late','Unmarked','%','Status'].map((h,i)=>(
                          <th key={i} className={`px-4 py-3 font-black ${i===1?'text-left':'text-center'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMonthlySummary.map((s, i) => (
                        <tr key={i} className={`border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer ${s.isLowAttendance?'border-l-4 border-l-red-400':''}`}
                          onClick={() => openStudentInsight({ _id: s.studentId, name: s.name, rollNo: s.rollNo, class: s.class, section: s.section, year: s.year, session: s.session, email: s.email, phone: s.phone, photo: s.photo })}>
                          <td className="px-4 py-3 text-gray-400 text-xs text-center">{i+1}</td>
                          <td className="px-4 py-3">
                            <p className="font-black text-gray-800 dark:text-white">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.email || 'No email'}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-black border border-indigo-200 dark:border-indigo-800">
                              {s.class}{s.section?`-${s.section}`:''}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs text-center">{s.year||'-'}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs text-center">{s.session||'-'}</td>
                          <td className="px-4 py-3 text-emerald-600 font-black text-base text-center">{s.present||0}</td>
                          <td className="px-4 py-3 text-red-500 font-black text-base text-center">{s.absent||0}</td>
                          <td className="px-4 py-3 text-amber-500 font-black text-base text-center">{s.late||0}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-black text-base text-center">{s.unmarked||0}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div className={`h-full rounded-full ${s.percentage>=75?'bg-emerald-500':s.percentage>=50?'bg-amber-500':'bg-red-500'}`}
                                  style={{width:`${Math.min(100,s.percentage)}%`}}/>
                              </div>
                              <span className={`text-sm font-black min-w-[42px] ${s.percentage>=75?'text-emerald-600':s.percentage>=50?'text-amber-500':'text-red-500'}`}>
                                {s.percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                              s.isLowAttendance?'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300':'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            }`}>
                              {s.isLowAttendance?'⚠️ Low':'✅ Good'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <MonthlyMobileCards list={filteredMonthlySummary} onOpen={openStudentInsight} />
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-400 text-sm font-medium">Select a month to load the report</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'low' && (
        <div>
          <div className="flex gap-3 mb-5 items-center flex-wrap">
            <input type="month" value={lowDate} onChange={e => setLowDate(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <FilterBar allMyStudents={allMyStudents} fc={lFilterClass} sfc={setLFilterClass} fs={lFilterSection} sfs={setLFilterSection}
              fy={lFilterYear} sfy={setLFilterYear} fses={lFilterSession} sfses={setLFilterSession}
              extra={
                <button onClick={fetchLow}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all shadow-md">
                  🔄 Load
                </button>
              }
            />
            <div className="flex gap-2 ml-auto">
              <button onClick={exportLowExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">📊 Excel</button>
              <button onClick={exportLowPDF} className="px-3 py-2 border border-red-500 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">📄 PDF</button>
            </div>
          </div>

          {selectedLowIds.size > 0 && (
            <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 mb-5 flex-wrap gap-3">
              <p className="text-sm font-black text-red-700 dark:text-red-300">{selectedLowIds.size} student{selectedLowIds.size !== 1 ? 's' : ''} selected</p>
              <div className="flex gap-2">
                <button onClick={clearLowSelection} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all">Clear</button>
                <button onClick={sendLowAlerts} disabled={sendingLowAlerts}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all disabled:opacity-50 flex items-center gap-1.5">
                  {sendingLowAlerts ? (<><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> Sending...</>) : '📧 Send Alert to Selected'}
                </button>
              </div>
            </div>
          )}

          {loading ? <Spinner/> : filteredLowData.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-6xl mb-4">🎉</div>
              <p className="font-black text-green-600 text-xl">All students doing great!</p>
              <p className="text-sm text-gray-400 mt-2">No student below 75% for {lowDate}</p>
            </div>
          ) : (
            <>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-5">
                <p className="text-red-700 dark:text-red-300 font-black">
                  ⚠️ {filteredLowData.length} student{filteredLowData.length!==1?'s':''} need immediate attention — below 75% attendance
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <th className="px-5 py-3 font-black text-center w-10">
                          <input type="checkbox"
                            checked={filteredLowData.length > 0 && filteredLowData.every(s => selectedLowIds.has(s.studentId))}
                            onChange={() => {
                              const allSelected = filteredLowData.every(s => selectedLowIds.has(s.studentId))
                              setSelectedLowIds(prev => {
                                const next = new Set(prev)
                                filteredLowData.forEach(s => allSelected ? next.delete(s.studentId) : next.add(s.studentId))
                                return next
                              })
                            }}
                            className="w-4 h-4 rounded accent-red-600 cursor-pointer"/>
                        </th>
                        {['#','Student','Class','Year','Session','Present','Absent','Attendance %'].map((h,i)=>(
                          <th key={i} className={`px-5 py-3 font-black ${i===1?'text-left':'text-center'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLowData.sort((a,b)=>a.percentage-b.percentage).map((s,i)=>(
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-red-50/50 dark:hover:bg-red-900/10 border-l-4 border-l-red-400 transition-colors">
                          <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedLowIds.has(s.studentId)} onChange={() => toggleLowSelect(s.studentId)}
                              className="w-4 h-4 rounded accent-red-600 cursor-pointer"/>
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs text-center">{i+1}</td>
                          <td className="px-5 py-3">
                            <p className="font-black text-gray-800 dark:text-white">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.email||'No email'}</p>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg text-xs font-black">
                              {s.class}{s.section?`-${s.section}`:''}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-400 text-xs text-center">{s.year||'-'}</td>
                          <td className="px-5 py-3 text-gray-400 text-xs text-center">{s.session||'-'}</td>
                          <td className="px-5 py-3 text-emerald-600 font-black text-base text-center">{s.present||0}</td>
                          <td className="px-5 py-3 text-red-500 font-black text-base text-center">{s.absent||0}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3 justify-center">
                              <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div className={`h-full rounded-full ${s.percentage<50?'bg-red-500':'bg-amber-500'}`}
                                  style={{width:`${Math.min(100,s.percentage)}%`}}/>
                              </div>
                              <span className="text-base font-black text-red-500">{s.percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <LowMobileCards list={filteredLowData} selectedIds={selectedLowIds} onToggle={toggleLowSelect} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default TReports