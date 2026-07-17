import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'
import useTodayDate from '../../hooks/useTodayDate'

// ── Animated counter ──────────────────────────────────────────────────────────
const useCountUp = (target, duration = 700) => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target])
  return count
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-24 mb-4" />
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-16 mb-2" />
    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full w-32" />
  </div>
)

// ── Helper links ──────────────────────────────────────────────────────────────
const gmailLink = (email) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`
const waLink = (phone) => {
  const digits = String(phone).replace(/\D/g, '')
  return `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`
}

// ── Shared premium scrollbar classes (used everywhere a scroll area exists) ───
const premiumScrollbar = `
  [&::-webkit-scrollbar]:w-1.5
  [&::-webkit-scrollbar-track]:bg-transparent
  [&::-webkit-scrollbar-thumb]:bg-gradient-to-b
  [&::-webkit-scrollbar-thumb]:from-indigo-400
  [&::-webkit-scrollbar-thumb]:to-purple-500
  dark:[&::-webkit-scrollbar-thumb]:from-indigo-600
  dark:[&::-webkit-scrollbar-thumb]:to-purple-700
  [&::-webkit-scrollbar-thumb]:rounded-full
  [&::-webkit-scrollbar-thumb:hover]:from-indigo-500
  [&::-webkit-scrollbar-thumb:hover]:to-purple-600
`

// ── Student Profile Modal ─────────────────────────────────────────────────────
// Premium version: gradient header with photo, clickable Gmail/Phone/WhatsApp
// contact cards, Academic Details grid (Class/Section/Year/Session),
// Attendance Stats cards, overall % progress bar, Last 30 Days mini heatmap,
// and a "Close Profile (Esc)" button — matches the uploaded reference design.
const StudentProfileModal = ({ student, onClose }) => {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!student) return null

  const pct       = student.percentage ?? null
  const present   = student.present ?? 0
  const absent    = student.absent  ?? 0
  const late      = student.late    ?? 0
  const total     = student.total   ?? (present + absent + late)
  const todayStatus = student.todayStatus ?? null
  const last30      = student.last30Days  ?? []

  const heatColor = (p) => {
    if (p === undefined || p === null) return 'bg-gray-700/40'
    if (p === 'Present') return 'bg-green-500'
    if (p === 'Absent')  return 'bg-red-500'
    if (p === 'Late')    return 'bg-yellow-500'
    return 'bg-gray-700/40'
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-gray-900 dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden
        max-h-[90vh] flex flex-col border border-white/10"
        onClick={e => e.stopPropagation()}>

        {/* Scrollable content */}
        <div className={`overflow-y-auto ${premiumScrollbar}`}>

          {/* Gradient header */}
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 p-5 relative">
            <button onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30
                flex items-center justify-center text-white text-sm transition-all">
              ✕
            </button>

            <div className="flex items-start gap-4">
              {student.photo ? (
                <div className="w-20 h-20 rounded-2xl border-2 border-white/30 shadow-xl overflow-hidden bg-white flex-shrink-0">
                  <img src={student.photo} alt={student.name} className="w-full h-full object-cover object-top" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl border-2 border-white/30 shadow-xl
                  bg-white/15 flex items-center justify-center text-white text-3xl font-black flex-shrink-0">
                  {(student.name || '?').charAt(0)}
                </div>
              )}
              <div className="pt-1">
                <h3 className="text-xl font-black text-white leading-tight">{student.name}</h3>
                <p className="text-sm text-white/80 mt-0.5">Roll No: <span className="font-bold">{student.rollNo || '-'}</span></p>
                <p className="text-xs text-white/70 mt-1">
                  {[
                    student.class ? `${student.class}${student.section ? `-${student.section}` : ''}` : null,
                    student.year ? `Year ${student.year}` : null,
                    student.session || null,
                  ].filter(Boolean).join(' • ')}
                </p>
              </div>
            </div>

            {todayStatus && (
              <div className="mt-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black ${
                  todayStatus === 'Present' ? 'bg-green-500/20 text-green-300 border border-green-400/30' :
                  todayStatus === 'Absent'  ? 'bg-red-500/20 text-red-300 border border-red-400/30' :
                  'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30'
                }`}>
                  {todayStatus === 'Present' ? '✅' : todayStatus === 'Absent' ? '❌' : '⏰'} Today: {todayStatus}
                </span>
              </div>
            )}
          </div>

          <div className="p-5 space-y-5">

            {/* Contact */}
            {(student.email || student.phone) && (
              <div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  📇 Contact
                </p>
                <div className="space-y-2">
                  {student.email && (
                    <a href={gmailLink(student.email)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-red-500/10 border border-red-500/20
                        hover:bg-red-500/20 transition-all group">
                      <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        📧
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Gmail</p>
                        <p className="text-sm text-white font-semibold truncate">{student.email}</p>
                      </div>
                      <span className="text-gray-500 group-hover:text-white transition-all flex-shrink-0">↗</span>
                    </a>
                  )}
                  {student.phone && (
                    <>
                      <a href={`tel:${student.phone}`}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20
                          hover:bg-blue-500/20 transition-all group">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          📞
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Phone</p>
                          <p className="text-sm text-white font-semibold truncate">{student.phone}</p>
                        </div>
                        <span className="text-gray-500 group-hover:text-white transition-all flex-shrink-0">↗</span>
                      </a>
                      <a href={waLink(student.phone)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-green-500/10 border border-green-500/20
                          hover:bg-green-500/20 transition-all group">
                        <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          💬
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">WhatsApp</p>
                          <p className="text-sm text-white font-semibold truncate">{student.phone}</p>
                        </div>
                        <span className="text-gray-500 group-hover:text-white transition-all flex-shrink-0">↗</span>
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Academic Details */}
            <div>
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                🎓 Academic Details
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Class',   value: student.class   || '-' },
                  { label: 'Section', value: student.section || '-' },
                  { label: 'Year',    value: student.year    || '-' },
                  { label: 'Session', value: student.session || '-' },
                ].map((item, i) => (
                  <div key={i} className="px-3.5 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wide">{item.label}</p>
                    <p className="text-base text-white font-black mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Stats */}
            {pct !== null && (
              <div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  📊 Attendance Stats
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Present', value: present, color: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/10' },
                    { label: 'Absent',  value: absent,  color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10' },
                    { label: 'Late',    value: late,    color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
                    { label: 'Total',   value: total,   color: 'text-indigo-300', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
                  ].map((s, i) => (
                    <div key={i} className={`${s.bg} ${s.border} border rounded-2xl p-2.5 text-center`}>
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5 font-semibold">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 px-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400 font-semibold">Overall Attendance</span>
                    <span className={`text-sm font-black ${pct >= 75 ? 'text-green-400' : 'text-red-400'}`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${
                      pct >= 75 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-rose-500'
                    }`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Last 30 Days mini heatmap */}
            {last30.length > 0 && (
              <div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  🗓️ Last 30 Days
                </p>
                <div className="grid grid-cols-10 gap-1.5 bg-white/5 rounded-2xl p-3 border border-white/10">
                  {last30.map((status, i) => (
                    <div key={i} className={`w-full aspect-square rounded-md ${heatColor(status)}`} />
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {[['bg-green-500','Present'],['bg-red-500','Absent'],['bg-yellow-500','Late'],['bg-gray-700/40','No Data']].map(([c,l]) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-sm ${c}`} />
                      <span className="text-[10px] text-gray-400">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Close button */}
        <div className="p-4 pt-0">
          <button onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white
              text-sm font-black hover:opacity-90 transition-all shadow-lg shadow-indigo-500/20">
            Close Profile <span className="opacity-70 font-bold">(Esc)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Quick Mark Panel ──────────────────────────────────────────────────────────
// UPGRADES in this version:
//  - Cascading Class -> Section -> Year -> Session filters (derived from the
//    teacher's own assignedClasses + the fetched student list, so options
//    only ever show what's actually relevant to this teacher)
//  - Student rows now show Section / Year / Session, not just Roll No
//  - Keyboard shortcuts: Up/Down to move focus, P/A/L to mark focused
//    student, Ctrl+Z to clear the focused student's *unsaved* selection,
//    Enter to open that student's profile, Esc handled globally to close
//  - Row click / Enter opens the premium StudentProfileModal
//  - Premium scrollbar + subtle row focus ring
const QuickMarkPanel = ({ user, onDone, onClose, token }) => {
  const assignedClasses = user?.assignedClasses || []

  // ── Filter state ────────────────────────────────────────────────────────
  const [selectedClass,   setSelectedClass]   = useState(assignedClasses[0]?.class || null)
  const [selectedSection, setSelectedSection] = useState(assignedClasses[0]?.section || null)
  const [selectedYear,    setSelectedYear]    = useState(assignedClasses[0]?.year || null)
  const [selectedSession, setSelectedSession] = useState(assignedClasses[0]?.session || null)

  const [allStudents, setAllStudents] = useState([])   // full fetched list (fetched once)
  const [marks, setMarks]             = useState({})
  const [loading, setLoading]         = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [profileStudent, setProfileStudent] = useState(null)

  const [focusedIdx, setFocusedIdx] = useState(-1)
  const rowRefs = useRef([])

  // ── Fetch all of this teacher's students once ──────────────────────────
  useEffect(() => { fetchStudents() }, [])

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      // Keep only students that belong to one of the teacher's assigned classes
      const mine = data.filter(s =>
        assignedClasses.some(c => c.class === s.class && (!c.section || c.section === s.section))
      )
      setAllStudents(mine)
    } catch { toast.error('Failed to load students.') }
    finally { setLoading(false) }
  }

  // ── Cascading filter option lists ──────────────────────────────────────
  // Classes available = the classes this teacher is actually assigned to
  const classOptions = useMemo(() =>
    [...new Set(assignedClasses.map(c => c.class))], [assignedClasses])

  // Sections available = only sections assigned to teacher for the selected class
  const sectionOptions = useMemo(() => {
    if (!selectedClass) return []
    return [...new Set(
      assignedClasses.filter(c => c.class === selectedClass && c.section).map(c => c.section)
    )]
  }, [assignedClasses, selectedClass])

  // Year / Session options derived from the actual fetched students matching
  // class + section so far chosen — keeps these grounded in real data
  const yearOptions = useMemo(() => {
    return [...new Set(
      allStudents
        .filter(s => (!selectedClass || s.class === selectedClass) && (!selectedSection || s.section === selectedSection))
        .map(s => s.year)
        .filter(Boolean)
    )]
  }, [allStudents, selectedClass, selectedSection])

  const sessionOptions = useMemo(() => {
    return [...new Set(
      allStudents
        .filter(s =>
          (!selectedClass   || s.class   === selectedClass) &&
          (!selectedSection || s.section === selectedSection) &&
          (!selectedYear    || s.year    === selectedYear)
        )
        .map(s => s.session)
        .filter(Boolean)
    )]
  }, [allStudents, selectedClass, selectedSection, selectedYear])

  // When class changes, reset section/year/session to the first valid option
  const handleClassSelect = (cls) => {
    setSelectedClass(cls)
    const firstAssignment = assignedClasses.find(c => c.class === cls)
    setSelectedSection(firstAssignment?.section || null)
    setSelectedYear(null)
    setSelectedSession(null)
    setFocusedIdx(-1)
  }
  const handleSectionSelect = (sec) => {
    setSelectedSection(prev => prev === sec ? null : sec)
    setSelectedYear(null)
    setSelectedSession(null)
    setFocusedIdx(-1)
  }
  const handleYearSelect = (yr) => {
    setSelectedYear(prev => prev === yr ? null : yr)
    setSelectedSession(null)
    setFocusedIdx(-1)
  }
  const handleSessionSelect = (ses) => {
    setSelectedSession(prev => prev === ses ? null : ses)
    setFocusedIdx(-1)
  }

  // ── Filtered student list for current filter selection ─────────────────
  const students = useMemo(() => {
    return allStudents.filter(s =>
      (!selectedClass   || s.class   === selectedClass) &&
      (!selectedSection || s.section === selectedSection) &&
      (!selectedYear    || s.year    === selectedYear) &&
      (!selectedSession || s.session === selectedSession)
    )
  }, [allStudents, selectedClass, selectedSection, selectedYear, selectedSession])

  // Initialize marks (default Present) whenever the filtered list changes
  useEffect(() => {
    const init = {}
    students.forEach(s => { init[s._id] = 'Present' })
    setMarks(init)
    setFocusedIdx(students.length > 0 ? 0 : -1)
  }, [students])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (profileStudent) return // profile modal handles its own Escape

      if (e.key === 'Escape') { onClose(); return }

      if (!students.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx(prev => {
          const next = Math.min(prev + 1, students.length - 1)
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx(prev => {
          const next = Math.max(prev - 1, 0)
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          return next
        })
      } else if (e.key === 'Enter') {
        if (focusedIdx >= 0 && students[focusedIdx]) {
          setProfileStudent(students[focusedIdx])
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Ctrl+Z — clear the focused student's *unsaved* local selection only
        e.preventDefault()
        if (focusedIdx >= 0 && students[focusedIdx]) {
          const sid = students[focusedIdx]._id
          setMarks(prev => {
            const updated = { ...prev }
            delete updated[sid]
            return updated
          })
          toast('↩️ Selection cleared for ' + students[focusedIdx].name, { icon: '↩️' })
        }
      } else if (['p', 'P'].includes(e.key)) {
        if (focusedIdx >= 0 && students[focusedIdx]) {
          setMarks(prev => ({ ...prev, [students[focusedIdx]._id]: 'Present' }))
        }
      } else if (['a', 'A'].includes(e.key)) {
        if (focusedIdx >= 0 && students[focusedIdx]) {
          setMarks(prev => ({ ...prev, [students[focusedIdx]._id]: 'Absent' }))
        }
      } else if (['l', 'L'].includes(e.key)) {
        if (focusedIdx >= 0 && students[focusedIdx]) {
          setMarks(prev => ({ ...prev, [students[focusedIdx]._id]: 'Late' }))
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [students, focusedIdx, profileStudent, onClose])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const today   = new Date().toISOString().split('T')[0]
      const records = students.map(s => ({ studentId: s._id, status: marks[s._id] || 'Present' }))
      await axios.post(
        `${import.meta.env.VITE_API_URL}/attendance/bulk-mark`,
        { records, date: today, markedBy: `Teacher: ${user?.name}` },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const label = [selectedClass, selectedSection].filter(Boolean).join('-')
      toast.success(`✅ Attendance marked for ${label}!`)
      onDone()
    } catch { toast.error('Failed to submit.') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-200 dark:border-indigo-800 overflow-hidden shadow-lg">

      {profileStudent && (
        <StudentProfileModal student={profileStudent} onClose={() => setProfileStudent(null)} />
      )}

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 pt-3.5 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h3 className="text-white font-black text-sm">⚡ Quick Mark Attendance</h3>
            <p className="text-indigo-200 text-xs mt-0.5">Mark without leaving dashboard</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-sm font-black flex-shrink-0 ml-4 transition-all"
            title="Close (Esc)">
            ✕
          </button>
        </div>

        {/* Class filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {classOptions.map((cls, i) => (
            <button key={i} onClick={() => handleClassSelect(cls)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                selectedClass === cls
                  ? 'bg-white text-indigo-700'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}>
              {cls}
            </button>
          ))}
        </div>

        {/* Cascading: Section / Year / Session — only shown when options exist */}
        {(sectionOptions.length > 0 || yearOptions.length > 0 || sessionOptions.length > 0) && (
          <div className="flex items-center gap-3 flex-wrap mt-2.5 pt-2.5 border-t border-white/15">
            {sectionOptions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-indigo-200 font-bold uppercase">Section</span>
                {sectionOptions.map((sec, i) => (
                  <button key={i} onClick={() => handleSectionSelect(sec)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                      selectedSection === sec ? 'bg-white text-indigo-700' : 'bg-white/15 text-white hover:bg-white/25'
                    }`}>
                    {sec}
                  </button>
                ))}
              </div>
            )}
            {yearOptions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-indigo-200 font-bold uppercase">Year</span>
                {yearOptions.map((yr, i) => (
                  <button key={i} onClick={() => handleYearSelect(yr)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                      selectedYear === yr ? 'bg-white text-indigo-700' : 'bg-white/15 text-white hover:bg-white/25'
                    }`}>
                    {yr}
                  </button>
                ))}
              </div>
            )}
            {sessionOptions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-indigo-200 font-bold uppercase">Session</span>
                {sessionOptions.map((ses, i) => (
                  <button key={i} onClick={() => handleSessionSelect(ses)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                      selectedSession === ses ? 'bg-white text-indigo-700' : 'bg-white/15 text-white hover:bg-white/25'
                    }`}>
                    {ses}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-6 text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">Bulk:</span>
            {['Present','Absent','Late'].map(status => (
              <button key={status}
                onClick={() => { const b = {}; students.forEach(s => { b[s._id] = status }); setMarks(b) }}
                className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all ${
                  status === 'Present' ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300' :
                  status === 'Absent'  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300' :
                  'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                }`}>
                {status === 'Present' ? '✅' : status === 'Absent' ? '❌' : '⏰'} All {status}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400">{students.length} students</span>
          </div>

          {/* Shortcut hint bar */}
          {students.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap mb-3 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/15 border border-indigo-100 dark:border-indigo-900/30">
              <span className="text-[10px] text-indigo-400 dark:text-indigo-300 font-bold flex items-center gap-1">⌨️ Shortcuts:</span>
              {[['↑↓','Move'],['P','Present'],['A','Absent'],['L','Late'],['Enter','Profile'],['Ctrl+Z','Undo'],['Esc','Close']].map(([k,l]) => (
                <span key={k} className="text-[10px] text-indigo-500 dark:text-indigo-300 font-semibold flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 font-black">{k}</kbd>
                  {l}
                </span>
              ))}
            </div>
          )}

          <div className={`max-h-56 overflow-y-auto space-y-1.5 mb-4 ${premiumScrollbar}`}>
            {students.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">🔍</div>
                <p className="text-xs">No students match these filters</p>
              </div>
            ) : students.map((s, i) => (
              <div key={s._id}
                ref={el => rowRefs.current[i] = el}
                onClick={() => setProfileStudent(s)}
                tabIndex={0}
                className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                  i === focusedIdx
                    ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-800'
                    : ''
                } ${
                marks[s._id] === 'Absent' ? 'bg-red-50 dark:bg-red-900/10' :
                marks[s._id] === 'Late'   ? 'bg-yellow-50 dark:bg-yellow-900/10' :
                marks[s._id] === 'Present' ? 'bg-gray-50 dark:bg-gray-700/30' :
                'bg-gray-100/70 dark:bg-gray-700/10 border border-dashed border-gray-300 dark:border-gray-600'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {s.photo ? (
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={s.photo} className="w-full h-full object-cover object-center" alt={s.name} />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                      {s.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {[
                        s.rollNo || '-',
                        s.section ? `Sec ${s.section}` : null,
                        s.year ? `Yr ${s.year}` : null,
                        s.session || null,
                      ].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {[['P','Present'],['A','Absent'],['L','Late']].map(([btn, fs]) => (
                    <button key={btn}
                      onClick={() => setMarks(p => ({ ...p, [s._id]: fs }))}
                      className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all border ${
                        marks[s._id] === fs
                          ? fs === 'Present' ? 'bg-green-500 text-white border-green-500' :
                            fs === 'Absent'  ? 'bg-red-500 text-white border-red-500' :
                            'bg-yellow-500 text-white border-yellow-500'
                          : 'bg-white dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600'
                      }`}>
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSubmit} disabled={submitting || !students.length}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-black hover:opacity-90 disabled:opacity-50 shadow-md transition-all">
            {submitting ? 'Submitting...' : `✅ Submit Attendance (${students.length})`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Mini Heatmap ──────────────────────────────────────────────────────────────
const MiniCalendar = ({ data, dark }) => {
  const getColor = (pct) => {
    if (pct === undefined || pct === null || pct === 0) return dark ? '#1f2937' : '#f3f4f6'
    if (pct >= 90) return '#16a34a'
    if (pct >= 75) return '#22c55e'
    if (pct >= 60) return '#f59e0b'
    if (pct >= 40) return '#f97316'
    return '#ef4444'
  }
  return (
    <div>
      <div className="grid grid-cols-10 gap-1.5 mb-2">
        {(data || []).map((d, i) => (
          <div key={i}
            title={`${d.date}: ${d.percentage}% (${(d.present || 0) + (d.late || 0)}/${d.total})`}
            style={{ backgroundColor: getColor(d.percentage) }}
            className="w-full aspect-square rounded-md transition-all hover:scale-110 cursor-default" />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>30 days ago</span>
        <div className="flex items-center gap-2">
          {[['#ef4444','Low'],['#f59e0b','Mid'],['#22c55e','Good'],['#16a34a','Great']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: c }} />
              <span>{l}</span>
            </div>
          ))}
        </div>
        <span>Today</span>
      </div>
    </div>
  )
}

// ── Main TDashboard ───────────────────────────────────────────────────────────
const TDashboard = ({ user, setActivePage, dark }) => {
  const [stats, setStats]                           = useState(null)
  const [loading, setLoading]                       = useState(true)
  const [selectedClass, setSelectedClass]           = useState(null)
  const [showQuickMark, setShowQuickMark]           = useState(false)
  const [lastUpdated, setLastUpdated]               = useState(null)

  // ── Midnight auto-refresh ────────────────────────────────────────────────
  // "today" used to be calculated once and stored straight into selectedDate's
  // initial state, so it silently went stale if the tab stayed open past
  // midnight. useTodayDate() recomputes it automatically at midnight; the
  // callback resets selectedDate + selectedClass, and the existing
  // `useEffect(() => { fetchData(selectedDate) }, [selectedDate])` below
  // picks that change up and refetches the new day's data automatically.
  const today = useTodayDate((newDate) => {
    setSelectedDate(newDate)
    setSelectedClass(null)
  }, true)
  const [selectedDate, setSelectedDate]             = useState(today)
  const [profileStudent, setProfileStudent]         = useState(null)
  const [pinnedNotes, setPinnedNotes]               = useState(() => {
    try { return JSON.parse(localStorage.getItem(`notes_${user?._id}`) || '{}') } catch { return {} }
  })
  const [editingNote, setEditingNote]               = useState(null)
  const [noteText, setNoteText]                     = useState('')

  const [activeSection, setActiveSection]               = useState(null)
  const [focusedAttentionIdx, setFocusedAttentionIdx]   = useState(-1)
  const [focusedRecentIdx, setFocusedRecentIdx]         = useState(-1)
  const attentionListRef = useRef(null)
  const recentListRef    = useRef(null)

  const token           = JSON.parse(localStorage.getItem('user'))?.token
  const assignedClasses = user?.assignedClasses || []

  const fetchData = useCallback(async (date) => {
    try {
      setLoading(true)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/teacher-stats?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setStats(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Dashboard error:', err.message)
      toast.error('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchData(selectedDate) }, [selectedDate])

  const handleDateChange = e => {
    const val = e.target.value
    if (val > today) return
    setSelectedDate(val)
  }

  const saveNote = key => {
    const updated = { ...pinnedNotes, [key]: noteText }
    setPinnedNotes(updated)
    localStorage.setItem(`notes_${user?._id}`, JSON.stringify(updated))
    setEditingNote(null); setNoteText('')
    toast.success('Note saved!')
  }
  const deleteNote = key => {
    const updated = { ...pinnedNotes }; delete updated[key]
    setPinnedNotes(updated)
    localStorage.setItem(`notes_${user?._id}`, JSON.stringify(updated))
  }

  const classKey = selectedClass
    ? `${selectedClass.class}${selectedClass.section ? `-${selectedClass.section}` : ''}`
    : null

  const bd = classKey ? stats?.classBreakdown?.[classKey] : null

  const presentCount  = bd ? bd.present   : (stats?.presentToday  || 0)
  const lateCount     = bd ? bd.late      : (stats?.lateToday     || 0)
  const absentCount   = bd ? bd.absent    : (stats?.absentToday   || 0)
  const totalStudents = bd ? bd.total     : (stats?.myStudents    || 0)
  const markedToday   = bd ? bd.marked    : (stats?.markedToday   || 0)
  const unmarkedCount = bd ? bd.unmarked  : (stats?.unmarkedToday || 0)
  const attendancePct = totalStudents > 0
    ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0

  const barData = (bd?.last7Days || stats?.last7Days || []).map(d => ({
    day: d.day, date: d.date, fullDate: d.fullDate,
    Present: d.present, Absent: d.absent, Late: d.late,
    percentage: d.percentage, total: d.total,
  }))

  const heatmapData = bd?.last30Days || stats?.last30Days || []

  const donutData = [
    { name:'Present',  value:presentCount,  color:'#22c55e' },
    { name:'Absent',   value:absentCount,   color:'#ef4444' },
    { name:'Late',     value:lateCount,     color:'#f59e0b' },
    { name:'Unmarked', value:unmarkedCount, color:'#6b7280' },
  ].filter(d => d.value > 0)

  const classComparison = assignedClasses.map(cls => {
    const key = `${cls.class}${cls.section ? `-${cls.section}` : ''}`
    const cbd = stats?.classBreakdown?.[key]
    const pct = cbd?.pct ?? 0
    return {
      name: key, pct,
      present: cbd?.present || 0,
      total:   cbd?.total   || 0,
      marked:  cbd?.marked  || 0,
      color: pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : pct > 0 ? '#ef4444' : '#6b7280',
    }
  })

  const lowAttendanceStudents = stats?.lowAttendance || []
  const trendingDown          = stats?.trendingDown  || []
  const needsUrgent           = lowAttendanceStudents.filter(s => s.needsImmediateAttention)

  const attentionItems = [...needsUrgent, ...lowAttendanceStudents.filter(s => !s.needsImmediateAttention)].slice(0, 7)
  const recentItems    = (stats?.recentAttendance || []).slice(0, 10)

  useEffect(() => {
    const handleKey = e => {
      if (e.key === 'Escape') {
        if (profileStudent) { setProfileStudent(null); return }
      }
      if (profileStudent) return

      if (activeSection === 'attention' && attentionItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setFocusedAttentionIdx(prev => {
            const next = Math.min(prev + 1, attentionItems.length - 1)
            attentionListRef.current?.children[next]?.scrollIntoView({ block:'nearest', behavior:'smooth' })
            return next
          })
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setFocusedAttentionIdx(prev => {
            const next = Math.max(prev - 1, 0)
            attentionListRef.current?.children[next]?.scrollIntoView({ block:'nearest', behavior:'smooth' })
            return next
          })
        } else if (e.key === 'Enter' && focusedAttentionIdx >= 0) {
          const s = attentionItems[focusedAttentionIdx]
          if (s) setProfileStudent(s)
        }
      }

      if (activeSection === 'recent' && recentItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setFocusedRecentIdx(prev => {
            const next = Math.min(prev + 1, recentItems.length - 1)
            recentListRef.current?.children[next]?.scrollIntoView({ block:'nearest', behavior:'smooth' })
            return next
          })
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setFocusedRecentIdx(prev => {
            const next = Math.max(prev - 1, 0)
            recentListRef.current?.children[next]?.scrollIntoView({ block:'nearest', behavior:'smooth' })
            return next
          })
        } else if (e.key === 'Enter' && focusedRecentIdx >= 0) {
          const a = recentItems[focusedRecentIdx]
          if (a) setProfileStudent({ ...(a.studentId || {}), percentage: null })
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [profileStudent, activeSection, focusedAttentionIdx, focusedRecentIdx, attentionItems, recentItems])

  const animPresent = useCountUp(presentCount)
  const animAbsent  = useCountUp(absentCount)
  const animLate    = useCountUp(lateCount)
  const animPct     = useCountUp(attendancePct)

  const exportPDF = useCallback(() => {
    const doc  = new jsPDF({ orientation: 'landscape' })
    const date = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday:'long', year:'numeric', month:'long', day:'numeric',
    })
    doc.setFontSize(20); doc.setTextColor(79,70,229)
    doc.text('Teacher Dashboard Snapshot', 14, 18)
    doc.setFontSize(10); doc.setTextColor(100)
    doc.text(`Teacher: ${user?.name} | Date: ${date}`, 14, 27)
    doc.text(`Classes: ${assignedClasses.map(c=>`${c.class}${c.section?`-${c.section}`:''}`).join(', ')}`, 14, 34)
    doc.setFontSize(12); doc.setTextColor(79,70,229)
    doc.text("Today's Summary", 14, 44)
    autoTable(doc, {
      startY:48, tableWidth:100, margin:{left:14},
      head:[['Metric','Value']],
      body:[
        ['Total Students', totalStudents],
        ['Present', presentCount], ['Absent', absentCount], ['Late', lateCount],
        ['Unmarked', unmarkedCount], ['Attendance %', `${attendancePct}%`],
        ['Streak', `${stats?.teacherStreak||0} days`],
        ['Monthly %', `${stats?.monthlyOverview?.percentage||0}%`],
      ],
      headStyles:{fillColor:[79,70,229],textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      styles:{fontSize:9},
    })
    if (classComparison.length > 0) {
      doc.setFontSize(12); doc.setTextColor(79,70,229); doc.text('Class Comparison', 130, 44)
      autoTable(doc, {
        startY:48, margin:{left:130},
        head:[['Class','Present','Total','%']],
        body:classComparison.map(c=>[c.name,c.present,c.total,`${c.pct}%`]),
        headStyles:{fillColor:[79,70,229],textColor:255},
        alternateRowStyles:{fillColor:[248,250,252]},
        styles:{fontSize:9},
      })
    }
    if (lowAttendanceStudents.length > 0) {
      const y = doc.lastAutoTable?.finalY || 120
      doc.setFontSize(12); doc.setTextColor(220,38,38)
      doc.text(`Low Attendance (${lowAttendanceStudents.length})`, 14, y+12)
      autoTable(doc, {
        startY:y+16,
        head:[['Name','Class','Year','Session','Present','Absent','%','Status']],
        body:lowAttendanceStudents.slice(0,15).map(s=>[
          s.name, `${s.class}${s.section?`-${s.section}`:''}`,
          s.year||'-', s.session||'-', s.present, s.absent, `${s.percentage}%`,
          s.needsImmediateAttention?'URGENT':'Low',
        ]),
        headStyles:{fillColor:[220,38,38],textColor:255},
        alternateRowStyles:{fillColor:[254,242,242]},
        styles:{fontSize:8},
      })
    }
    doc.save(`dashboard_${selectedDate}.pdf`)
    toast.success('PDF exported!')
  }, [stats, lowAttendanceStudents, classComparison, user, assignedClasses,
      presentCount, absentCount, lateCount, unmarkedCount, attendancePct, totalStudents, selectedDate])

  const hour       = new Date().getHours()
  const greeting   = hour<12?'Good Morning':hour<17?'Good Afternoon':'Good Evening'
  const greetEmoji = hour<12?'🌅':hour<17?'☀️':'🌙'

  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="bg-gray-950/95 backdrop-blur border border-gray-700/50 rounded-2xl px-4 py-3 shadow-2xl min-w-[160px]">
        <p className="font-black text-white text-sm mb-2">{label} — {d?.fullDate||d?.date}</p>
        <div className="space-y-1">
          {[{color:'#22c55e',label:'Present',val:d?.Present},
            {color:'#ef4444',label:'Absent', val:d?.Absent},
            {color:'#f59e0b',label:'Late',   val:d?.Late}].map(item => (
            <div key={item.label} className="flex items-center justify-between gap-4">
              <span className="text-gray-400 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{background:item.color}} />
                {item.label}
              </span>
              <span className="font-black text-xs" style={{color:item.color}}>{item.val||0}</span>
            </div>
          ))}
          <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between">
            <span className="text-gray-400 text-xs">Attendance</span>
            <span className={`text-xs font-black ${d?.percentage>=75?'text-green-400':d?.percentage>=50?'text-yellow-400':'text-red-400'}`}>
              {d?.percentage}%
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-56 animate-pulse" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-36 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_,i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
      </div>
    </div>
  )

  return (
    <div className="space-y-5">

      {profileStudent && (
        <StudentProfileModal student={profileStudent} onClose={() => setProfileStudent(null)} />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-2xl">{greetEmoji}</span>
            <h2 className="text-2xl font-black text-gray-800 dark:text-white">
              {greeting}, {user?.name?.split(' ')[0]}!
            </h2>
          </div>
          <div className="flex items-center gap-3 ml-9">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday:'long', year:'numeric', month:'long', day:'numeric',
              })}
            </p>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                • Updated {lastUpdated.toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {(stats?.teacherStreak||0) > 0 && (
            <div className="h-9 flex items-center gap-2 px-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
              <span className="text-base">🔥</span>
              <div>
                <p className="text-xs font-black text-orange-600 dark:text-orange-400 leading-none">{stats.teacherStreak} day streak!</p>
                <p className="text-[10px] text-orange-400 leading-none mt-0.5">Consecutive marking</p>
              </div>
            </div>
          )}

          <input type="date" value={selectedDate} max={today}
            onChange={handleDateChange}
            className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-600
              bg-white dark:bg-gray-800 text-gray-700 dark:text-white text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <button onClick={() => fetchData(selectedDate)} title="Refresh"
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200
              dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400
              hover:bg-gray-50 dark:hover:bg-gray-700 hover:rotate-180 transition-all duration-300 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button onClick={exportPDF}
            className="h-9 flex items-center gap-1.5 px-3 border border-red-300 dark:border-red-700
              text-red-600 dark:text-red-400 rounded-xl text-xs font-bold bg-white dark:bg-gray-800
              hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
            📄 Export PDF
          </button>

          <button onClick={() => setShowQuickMark(p => !p)}
            className={`h-9 flex items-center gap-2 px-4 rounded-xl text-sm font-black transition-all ${
              showQuickMark
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
            }`}>
            ⚡ Quick Mark
          </button>

          <button onClick={() => setActivePage('attendance')}
            className="h-9 flex items-center gap-2 px-4 bg-white dark:bg-gray-800
              border border-indigo-300 dark:border-indigo-700
              text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-black
              hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
            📷 Full Mark
          </button>
        </div>
      </div>

      {showQuickMark && (
        <QuickMarkPanel
          user={user} token={token}
          onClose={() => setShowQuickMark(false)}
          onDone={() => { setShowQuickMark(false); fetchData(selectedDate) }}
        />
      )}

      {/* Trending Down Alert */}
      {trendingDown.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📉</span>
            <p className="text-sm font-black text-orange-700 dark:text-orange-300">
              Trending Down — {trendingDown.length} student{trendingDown.length!==1?'s':''} declining
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingDown.map((s, i) => (
              <button key={i} onClick={() => setProfileStudent(s)}
                className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30
                  border border-orange-300 dark:border-orange-700 rounded-xl hover:scale-105 transition-all">
                <div className="w-5 h-5 rounded-full bg-orange-400 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">
                  {s.name?.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-orange-800 dark:text-orange-200">{s.name}</p>
                  <p className="text-[10px] text-orange-500">
                    {s.class}{s.section?`-${s.section}`:''} • ↓ {s.overallPct}% → {s.recentPct}%
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Classes */}
      {assignedClasses.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">My Assigned Classes</p>
            {selectedClass && (
              <button onClick={() => setSelectedClass(null)}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full text-xs hover:bg-gray-200 transition-all">
                ✕ Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {assignedClasses.map((cls, i) => {
              const isSel  = selectedClass?.class===cls.class && selectedClass?.section===cls.section
              const key    = `${cls.class}${cls.section||''}`
              const cbd    = stats?.classBreakdown?.[`${cls.class}${cls.section?`-${cls.section}`:''}`]
              const clsPct = cbd?.pct ?? null
              const note   = pinnedNotes[key]

              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <button onClick={() => setSelectedClass(isSel?null:cls)}
                    className={`flex items-center gap-3 rounded-2xl px-5 py-3.5 border transition-all duration-200 ${
                      isSel
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 border-transparent text-white shadow-lg shadow-indigo-500/25 scale-105'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:shadow-md'
                    }`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-base shadow-md ${
                      isSel?'bg-white/20 text-white':'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                    }`}>
                      {cls.class?.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className={`font-black text-sm ${isSel?'text-white':'text-gray-800 dark:text-white'}`}>
                        {cls.class}{cls.section?` - ${cls.section}`:''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className={`text-xs ${isSel?'text-white/70':'text-gray-400'}`}>
                          {[cls.year,cls.session].filter(Boolean).join(' • ')}
                        </p>
                        {clsPct!==null && (
                          <span className={`text-xs font-black ${isSel?'text-white':clsPct>=75?'text-green-500':'text-red-500'}`}>
                            {clsPct}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isSel?'bg-white':'bg-green-500'}`} />
                  </button>

                  {editingNote===key ? (
                    <div className="flex gap-1.5">
                      <input value={noteText} onChange={e=>setNoteText(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')saveNote(key);if(e.key==='Escape')setEditingNote(null)}}
                        placeholder="Type note..." autoFocus
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700
                          bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      <button onClick={()=>saveNote(key)} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold">✓</button>
                      <button onClick={()=>setEditingNote(null)} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-lg text-xs">✕</button>
                    </div>
                  ) : note ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl max-w-[220px]">
                      <span className="text-xs text-yellow-700 dark:text-yellow-300 truncate flex-1">📌 {note}</span>
                      <button onClick={()=>{setNoteText(note);setEditingNote(key)}} className="text-yellow-500 hover:text-yellow-700 text-xs">✎</button>
                      <button onClick={()=>deleteNote(key)} className="text-yellow-400 hover:text-red-500 text-xs">✕</button>
                    </div>
                  ) : (
                    <button onClick={()=>{setNoteText('');setEditingNote(key)}}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-gray-400 hover:text-indigo-500 transition-all">
                      📌 Pin note
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {selectedClass && (
            <div className="mt-3 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                📌 Filtered: <strong>{selectedClass.class}{selectedClass.section?` - ${selectedClass.section}`:''}</strong>
                &nbsp;— bar chart and heatmap showing class-specific data
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Today's Present", value:animPresent, icon:'✅', color:'text-emerald-500', bg:'from-emerald-500/15 to-green-500/5', border:'border-emerald-200 dark:border-emerald-800', sub:`${animPct}% attendance`, subColor:attendancePct>=75?'text-emerald-500':'text-red-500' },
          { label:"Today's Absent",  value:animAbsent,  icon:'❌', color:'text-rose-500',    bg:'from-rose-500/15 to-red-500/5',    border:'border-rose-200 dark:border-rose-800',    sub:animLate>0?`${animLate} came late`:'No late marks' },
          { label:'Monthly', value:`${stats?.monthlyOverview?.percentage||0}%`, icon:'🗓️', color:'text-blue-500', bg:'from-blue-500/15 to-indigo-500/5', border:'border-blue-200 dark:border-blue-800', sub:`${stats?.monthlyOverview?.workingDays||0} working days` },
          { label:'My Classes', value:assignedClasses.length, icon:'🏫', color:'text-purple-500', bg:'from-purple-500/15 to-violet-500/5', border:'border-purple-200 dark:border-purple-800', sub:'Assigned by admin' },
        ].map((card,i) => (
          <div key={i} className={`bg-gradient-to-br ${card.bg} border ${card.border} rounded-2xl p-5 hover:shadow-lg transition-all duration-200`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{card.label}</p>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className={`text-4xl font-black ${card.color} mb-1`}>{card.value}</p>
            {card.sub && <p className={`text-xs font-semibold ${card.subColor||'text-gray-400'}`}>{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Class Comparison */}
      {classComparison.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-700 dark:text-gray-200 mb-4">🏆 Class Comparison — Today</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {classComparison.map((cls, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-black text-gray-800 dark:text-white">{cls.name}</span>
                  <span className="text-sm font-black" style={{color:cls.color}}>{cls.pct}%</span>
                </div>
                <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{width:`${Math.min(100,cls.pct)}%`,backgroundColor:cls.color}} />
                </div>
                <p className="text-xs text-gray-400">{cls.present} present of {cls.marked} marked</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-5">

        {/* Bar Chart */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-purple-500/5 rounded-full blur-3xl" />
          </div>
          <div className="flex items-start justify-between mb-5 relative z-10">
            <div>
              <h3 className="text-sm font-black text-gray-800 dark:text-white">📊 Last 7 Days Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Present, Absent &amp; Late per day
                {selectedClass?` — ${selectedClass.class}${selectedClass.section?`-${selectedClass.section}`:''}`:' — all classes'}
              </p>
            </div>
            <div className="flex gap-3 text-xs flex-wrap">
              {[{color:'#22c55e',label:'Present'},{color:'#ef4444',label:'Absent'},{color:'#f59e0b',label:'Late'}].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:item.color}} />
                  <span className="text-gray-500 dark:text-gray-400 font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          {barData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm">No data yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} barGap={3} barCategoryGap="30%"
                  margin={{top:8,right:8,left:-18,bottom:5}}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={1} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.85} />
                    </linearGradient>
                    <filter id="bShadow">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke={dark?'#1f2937':'#f1f5f9'} vertical={false} />
                  <XAxis dataKey="day" tick={{fontSize:12,fill:dark?'#9ca3af':'#6b7280',fontWeight:700}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:11,fill:dark?'#9ca3af':'#6b7280'}} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} cursor={{fill:'rgba(99,102,241,0.05)',radius:8}} />
                  <Bar dataKey="Present" fill="url(#gP)" radius={[7,7,0,0]} filter="url(#bShadow)" maxBarSize={28} />
                  <Bar dataKey="Absent"  fill="url(#gA)" radius={[7,7,0,0]} filter="url(#bShadow)" maxBarSize={28} />
                  <Bar dataKey="Late"    fill="url(#gL)" radius={[7,7,0,0]} filter="url(#bShadow)" maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-7 gap-1 mt-1">
                {barData.map((d, i) => (
                  <div key={i} className="text-center">
                    <span className={`text-[10px] font-black ${d.percentage>=75?'text-green-500':d.percentage>=50?'text-yellow-500':d.percentage>0?'text-red-500':'text-gray-400'}`}>
                      {d.total>0?`${d.percentage}%`:'—'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Radial Donut */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-black text-gray-700 dark:text-gray-200">🍩 Today's Breakdown</h3>
            <p className="text-xs text-gray-400 mt-0.5">{markedToday} students marked</p>
          </div>
          {markedToday === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-xs text-center font-medium mb-3">No attendance yet</p>
              <button onClick={() => setActivePage('attendance')}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-black hover:opacity-90 shadow-md">
                Mark Now
              </button>
            </div>
          ) : (
            <>
              <div className="relative flex-shrink-0">
                <ResponsiveContainer width="100%" height={160}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="90%"
                    data={[{name:'Attendance',value:attendancePct,
                      fill:attendancePct>=75?'#22c55e':attendancePct>=50?'#f59e0b':'#ef4444'}]}
                    startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0,100]} angleAxisId={0} tick={false} />
                    <RadialBar background={{fill:dark?'#374151':'#f3f4f6'}} dataKey="value" angleAxisId={0} cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className={`text-3xl font-black ${attendancePct>=75?'text-green-500':attendancePct>=50?'text-yellow-500':'text-red-500'}`}>
                      {attendancePct}%
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Today</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 mt-2 flex-1">
                {donutData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:item.color}} />
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{width:`${totalStudents>0?(item.value/totalStudents*100):0}%`,backgroundColor:item.color}} />
                      </div>
                      <span className="text-xs font-black text-gray-700 dark:text-gray-200 w-5 text-right">{item.value}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${
                      attendancePct>=75?'bg-gradient-to-r from-green-400 to-emerald-500':
                      attendancePct>=50?'bg-gradient-to-r from-yellow-400 to-orange-500':
                      'bg-gradient-to-r from-red-400 to-rose-500'
                    }`} style={{width:`${attendancePct}%`}} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Heatmap */}
      {heatmapData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-gray-800 dark:text-white">🗓️ Last 30 Days — Heatmap</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Daily attendance rate overview
                {selectedClass?` — ${selectedClass.class}${selectedClass.section?`-${selectedClass.section}`:''}`:' — all classes'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-indigo-600">{stats?.monthlyOverview?.percentage||0}%</p>
              <p className="text-xs text-gray-400">This month</p>
            </div>
          </div>
          <MiniCalendar data={heatmapData} dark={dark} />
        </div>
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-5">

        {/* Attention List */}
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
          onMouseEnter={() => { setActiveSection('attention'); setFocusedAttentionIdx(prev => prev<0?0:prev) }}
          onMouseLeave={() => setActiveSection(null)}>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-200">
                {needsUrgent.length>0?'🚨':'⚠️'} Attention Required
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {needsUrgent.length>0
                  ?`${needsUrgent.length} need immediate attention`
                  :`${lowAttendanceStudents.length} below 75%`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeSection==='attention' && attentionItems.length>0 && (
                <span className="text-[10px] text-gray-300 dark:text-gray-600 font-medium hidden sm:block">↑↓ Enter</span>
              )}
              <button onClick={()=>setActivePage('reports')} className="text-xs text-indigo-500 hover:text-indigo-600 font-bold">View All →</button>
            </div>
          </div>

          {lowAttendanceStudents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-sm font-black text-green-500">All students above 75%</p>
              <p className="text-xs text-gray-400 mt-1">Excellent attendance!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1
              [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700
              [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-indigo-300"
              ref={attentionListRef}>

              {needsUrgent.length > 0 && (
                <div className="px-2 py-1.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl mb-2">
                  <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                    🚨 Needs Immediate Attention
                  </p>
                </div>
              )}

              {attentionItems.map((s, i) => (
                <div key={i}
                  onClick={() => setProfileStudent(s)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-all ${
                    i===focusedAttentionIdx && activeSection==='attention'
                      ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-800'
                      : ''
                  } ${
                    s.needsImmediateAttention
                      ? 'bg-red-50 dark:bg-red-900/15 border border-red-300 dark:border-red-800 hover:scale-[1.01]'
                      : 'bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 hover:scale-[1.01]'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm ${
                      s.needsImmediateAttention
                        ?'bg-gradient-to-br from-red-500 to-rose-600'
                        :'bg-gradient-to-br from-orange-400 to-amber-500'
                    }`}>
                      {s.name?.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-gray-800 dark:text-white">{s.name}</p>
                        {s.needsImmediateAttention && (
                          <span className="text-[9px] bg-red-500 text-white px-1.5 rounded-full font-black">URGENT</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {s.class}{s.section?`-${s.section}`:''}
                        {s.year    ? ` • ${s.year}`    : ''}
                        {s.session ? ` • ${s.session}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${s.percentage<50?'text-red-600':'text-orange-500'}`}>{s.percentage}%</p>
                    <p className="text-xs text-gray-400">{s.present}P / {s.absent}A</p>
                  </div>
                </div>
              ))}

              {lowAttendanceStudents.length > 7 && (
                <p className="text-xs text-center text-gray-400 pt-1">+{lowAttendanceStudents.length-7} more</p>
              )}
            </div>
          )}
        </div>

        {/* Recent Attendance */}
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
          onMouseEnter={() => { setActiveSection('recent'); setFocusedRecentIdx(prev => prev<0?0:prev) }}
          onMouseLeave={() => setActiveSection(null)}>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-200">📋 Recent Attendance Today</h3>
              <p className="text-xs text-gray-400 mt-0.5">{stats?.markedToday||0} records</p>
            </div>
            <div className="flex items-center gap-2">
              {activeSection==='recent' && recentItems.length>0 && (
                <span className="text-[10px] text-gray-300 dark:text-gray-600 font-medium hidden sm:block">↑↓ Enter</span>
              )}
              <button onClick={()=>setActivePage('attendance')} className="text-xs text-indigo-500 hover:text-indigo-600 font-bold">Mark More →</button>
            </div>
          </div>

          {(stats?.markedToday||0) === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-sm text-gray-400 font-medium mb-3">No attendance marked today</p>
              <button onClick={() => setShowQuickMark(true)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-black hover:opacity-90 shadow-md">
                ⚡ Quick Mark
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1
              [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700
              [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-indigo-300"
              ref={recentListRef}>

              {recentItems.map((a, i) => {
                const s = a.studentId || {}
                return (
                  <div key={i}
                    onClick={() => setProfileStudent({ ...s, percentage: null })}
                    className={`flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50
                      last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-xl px-2 transition-all cursor-pointer ${
                      i===focusedRecentIdx && activeSection==='recent'
                        ?'ring-2 ring-indigo-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-800'
                        :''
                    }`}>
                    <div className="flex items-center gap-2.5">
                      {s.photo ? (
                        <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                          <img src={s.photo} className="w-full h-full object-cover object-center" alt={s.name} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                          {(s.name||'U').charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-gray-800 dark:text-white">{s.name||'Unknown'}</p>
                        <p className="text-[10px] text-gray-400">
                          {[
                            s.class?`${s.class}${s.section?`-${s.section}`:''}`:null,
                            s.year    ? `Yr ${s.year}` : null,
                            s.session || null,
                            a.time    || null,
                          ].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                      a.status==='Present'?'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300':
                      a.status==='Absent' ?'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300':
                      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    }`}>{a.status}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TDashboard