import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Cascading filter options — each dropdown's choices narrow based on the OTHER selected filters
const getCascadingOptions = (list, { fc, fs, fy, fses }) => {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort()
  return {
    classOptions: uniq(list.filter(s => (!fs || s.section === fs) && (!fy || s.year === fy) && (!fses || s.session === fses)).map(s => s.class)),
    sectionOptions: uniq(list.filter(s => (!fc || s.class === fc) && (!fy || s.year === fy) && (!fses || s.session === fses)).map(s => s.section)),
    yearOptions: uniq(list.filter(s => (!fc || s.class === fc) && (!fs || s.section === fs) && (!fses || s.session === fses)).map(s => s.year)),
    sessionOptions: uniq(list.filter(s => (!fc || s.class === fc) && (!fs || s.section === fs) && (!fy || s.year === fy)).map(s => s.session)),
  }
}

// Phone → WhatsApp deeplink format (assumes 10-digit Indian numbers, prepends 91)
const formatWhatsapp = (phone) => {
  const digits = String(phone).replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

// Wraps the matching part of `text` in <mark> so search hits are visually highlighted
const highlightMatch = (text, query) => {
  const str = String(text ?? '')
  if (!query || !str) return str
  const idx = str.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return str
  return (
    <>
      {str.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded px-0.5">{str.slice(idx, idx + query.length)}</mark>
      {str.slice(idx + query.length)}
    </>
  )
}

const TStudents = ({ user }) => {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [filterAttendance, setFilterAttendance] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentAttendance, setStudentAttendance] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [viewMode, setViewMode] = useState('table')
  const [attendanceStats, setAttendanceStats] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [brokenImages, setBrokenImages] = useState(new Set())
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [sendingAlerts, setSendingAlerts] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  const token = JSON.parse(localStorage.getItem('user'))?.token
  const assignedClasses = user?.assignedClasses || []

  // Cascading filter options — memoized so they don't recompute on every render
  const { classOptions, sectionOptions, yearOptions, sessionOptions } = useMemo(
    () => getCascadingOptions(students, { fc: filterClass, fs: filterSection, fy: filterYear, fses: filterSession }),
    [students, filterClass, filterSection, filterYear, filterSession]
  )

  useEffect(() => { fetchStudents() }, [])

  // Close profile modal on Escape key
  useEffect(() => {
    if (!showProfile) return
    const handleKey = (e) => { if (e.key === 'Escape') setShowProfile(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showProfile])

  // Lock background scroll while profile modal is open
  useEffect(() => {
    document.body.style.overflow = showProfile ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showProfile])

  // Reset to page 1 whenever filters/search/sort/page-size/view change
  useEffect(() => {
    setPage(1)
  }, [search, filterClass, filterSection, filterYear, filterSession, filterAttendance, sortBy, perPage, viewMode])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const my = data.filter(s =>
        assignedClasses.some(c => c.class === s.class && (!c.section || c.section === s.section))
      )
      setStudents(my)
      fetchAllStats(my)
    } catch (err) { toast.error('Failed to load students!') }
    finally { setLoading(false) }
  }

  // ── Bulk attendance fetch — ONE API call for everyone instead of one-per-student ──
  // Uses POST /attendance/bulk-stats { studentIds }, which the backend resolves
  // with a single DB query ($in) and returns stats keyed by student id.
  const fetchAllStats = async (list) => {
    if (!list.length) { setAttendanceStats({}); return }
    try {
      setStatsLoading(true)
      const ids = list.map(s => s._id)
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/attendance/bulk-stats`,
        { studentIds: ids },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setAttendanceStats(data.stats || {})
    } catch (err) {
      toast.error('Failed to load attendance stats!')
    } finally {
      setStatsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStudents()
    setRefreshing(false)
    toast.success('Refreshed!')
  }

  const openProfile = async (student) => {
    setSelectedStudent(student)
    setShowProfile(true)
    setProfileLoading(true)
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/attendance/student/${student._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setStudentAttendance(data)
    } catch (err) { toast.error('Failed to load attendance!') }
    finally { setProfileLoading(false) }
  }

  const markImageBroken = (id) => setBrokenImages(prev => new Set(prev).add(id))

  // ── Bulk selection (checkboxes) for the low-attendance email blast ──
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleSelectAll = (list) => {
    const allSelected = list.length > 0 && list.every(s => selectedIds.has(s._id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      list.forEach(s => allSelected ? next.delete(s._id) : next.add(s._id))
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const toggleGroup = (key) => setCollapsedGroups(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  // ── Send "low attendance" email to every selected student in one go ──
  const sendBulkAlerts = async () => {
    if (selectedIds.size === 0) { toast.error('Pehle students select karo!'); return }
    try {
      setSendingAlerts(true)
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/email/low-attendance-alert`,
        { studentIds: Array.from(selectedIds) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(data.message || 'Alerts bhej diye gaye!')
      if (data.skipped?.length) {
        toast(`${data.skipped.length} student(s) ki email nahi mili, unhe skip kiya gaya`, { icon: '⚠️' })
      }
      clearSelection()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email bhejne mein error aaya!')
    } finally {
      setSendingAlerts(false)
    }
  }

  // Human-readable label of the currently applied filters — shown in PDF/Excel exports
  const getFilterLabel = () => {
    if (filterClass || filterSection || filterYear || filterSession || filterAttendance) {
      const parts = []
      parts.push(filterClass ? `${filterClass}${filterSection ? `-${filterSection}` : ''}` : 'All Classes')
      if (filterYear) parts.push(`Year ${filterYear}`)
      if (filterSession) parts.push(filterSession)
      if (filterAttendance) parts.push(filterAttendance === 'low' ? 'Low Attendance Only' : 'Good Attendance Only')
      return parts.join(' • ')
    }
    const allClasses = [...new Set(assignedClasses.map(c => `${c.class}${c.section ? `-${c.section}` : ''}`))]
    return `All Assigned Classes (${allClasses.join(', ') || 'N/A'})`
  }

  const filterSlug = () => {
    const parts = []
    if (filterClass) parts.push(filterClass.replace(/\s+/g, ''))
    if (filterSection) parts.push(filterSection)
    if (filterYear) parts.push(filterYear)
    if (filterSession) parts.push(filterSession.replace(/[\/\s]/g, '-'))
    return parts.length ? parts.join('_') : 'all-classes'
  }

  const exportExcel = () => {
    if (!sorted.length) { toast.error('No data!'); return }
    const data = sorted.map((s, i) => ({
      'Sr No': i + 1, 'Name': s.name, 'Email': s.email || '-',
      'Roll No': s.rollNo || '-', 'Class': s.class || '-',
      'Section': s.section || '-', 'Year': s.year || '-', 'Session': s.session || '-',
      'Phone': s.phone || '-',
      'Present': attendanceStats[s._id]?.present || 0,
      'Absent': attendanceStats[s._id]?.absent || 0,
      'Total': attendanceStats[s._id]?.total || 0,
      'Attendance %': attendanceStats[s._id] ? `${attendanceStats[s._id].percentage}%` : '-',
    }))
    const ws = XLSX.utils.json_to_sheet(data, { origin: 'A3' })
    XLSX.utils.sheet_add_aoa(ws, [
      [`My Students Report — ${getFilterLabel()}`],
      [`Teacher: ${user?.name} | Generated: ${new Date().toLocaleDateString('en-IN')} | Total: ${sorted.length} students`],
    ], { origin: 'A1' })
    ws['!cols'] = [6,22,28,12,10,10,8,12,14,8,8,8,14].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, `my_students_${filterSlug()}_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`)
    toast.success('Excel exported!')
  }

  const exportPDF = () => {
    if (!sorted.length) { toast.error('No data!'); return }
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(16); doc.setTextColor(79, 70, 229); doc.text('My Students List', 14, 18)
    doc.setFontSize(10); doc.setTextColor(100)
    doc.text(`Class: ${getFilterLabel()}`, 14, 26)
    doc.text(`Teacher: ${user?.name} | Generated: ${new Date().toLocaleDateString('en-IN')} | Total: ${sorted.length} students`, 14, 32)
    autoTable(doc, {
      startY: 38,
      head: [['#', 'Name', 'Email', 'Roll No', 'Class', 'Year', 'Session', 'Present', 'Absent', 'Attendance %']],
      body: sorted.map((s, i) => [
        i + 1, s.name, s.email || '-', s.rollNo || '-',
        `${s.class}${s.section ? `-${s.section}` : ''}`,
        s.year || '-', s.session || '-',
        attendanceStats[s._id]?.present || 0,
        attendanceStats[s._id]?.absent || 0,
        attendanceStats[s._id] ? `${attendanceStats[s._id].percentage}%` : '-',
      ]),
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8 },
    })
    doc.save(`my_students_${filterSlug()}_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`)
    toast.success('PDF exported!')
  }

  const getPctColor = (pct) => pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-500' : 'text-red-500'
  const getPctBg = (pct) => pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  const isLow = (id) => { const s = attendanceStats[id]; return s && s.total > 0 && s.percentage < 75 }

  const getStudentStat = (student) => {
    const st = attendanceStats[student._id]
    const pct = parseFloat(st?.percentage || 0)
    const low = isLow(student._id)
    return { st, pct, low }
  }

  const filtered = useMemo(() => students.filter(s => {
    const q = search.toLowerCase()
    const ms = !search || s.name.toLowerCase().includes(q) ||
      (s.rollNo && s.rollNo.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q))
    const mc = !filterClass || s.class === filterClass
    const msec = !filterSection || s.section === filterSection
    const my = !filterYear || s.year === filterYear
    const mses = !filterSession || s.session === filterSession
    const mAtt = !filterAttendance ? true : filterAttendance === 'low' ? isLow(s._id) : !isLow(s._id)
    return ms && mc && msec && my && mses && mAtt
  }), [students, search, filterClass, filterSection, filterYear, filterSession, filterAttendance, attendanceStats])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'name') arr.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'roll') arr.sort((a, b) => (a.rollNo || '').localeCompare(b.rollNo || ''))
    else if (sortBy === 'attendance-high') arr.sort((a, b) => (attendanceStats[b._id]?.percentage || 0) - (attendanceStats[a._id]?.percentage || 0))
    else if (sortBy === 'attendance-low') arr.sort((a, b) => (attendanceStats[a._id]?.percentage || 0) - (attendanceStats[b._id]?.percentage || 0))
    return arr
  }, [filtered, sortBy, attendanceStats])

  // Group students by Class-Section (used by the "Group by Class" view)
  const grouped = useMemo(() => {
    const map = {}
    sorted.forEach(s => {
      const key = `${s.class}${s.section ? `-${s.section}` : ''}`
      if (!map[key]) map[key] = []
      map[key].push(s)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [sorted])

  const lowCount = students.filter(s => isLow(s._id)).length

  const effectivePerPage = perPage === 'all' ? Math.max(sorted.length, 1) : perPage
  const totalPages = Math.max(1, Math.ceil(sorted.length / effectivePerPage))
  const paginated = sorted.slice((page - 1) * effectivePerPage, page * effectivePerPage)

  const hasActiveFilters = search || filterClass || filterSection || filterYear || filterSession || filterAttendance
  const clearAllFilters = () => {
    setSearch(''); setFilterClass(''); setFilterSection('')
    setFilterYear(''); setFilterSession(''); setFilterAttendance('')
  }

  // ── Skeleton loaders — shown while data is loading instead of a plain spinner ──
  const SkeletonRows = ({ count = 6 }) => (
    <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
          <div className="w-10 h-10 rounded-2xl bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-2.5 w-1/4 bg-gray-100 dark:bg-gray-700/60 rounded" />
          </div>
          <div className="h-2.5 w-20 bg-gray-200 dark:bg-gray-700 rounded hidden sm:block" />
          <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg hidden sm:block" />
        </div>
      ))}
    </div>
  )

  const SkeletonGrid = ({ count = 6 }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
          <div className="flex gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-gray-700/60 rounded" />
            </div>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      ))}
    </div>
  )

  const EmptyState = () => (
    <div className="text-center py-16"><div className="text-5xl mb-4">👥</div><p className="font-black text-gray-500 dark:text-gray-400">No students found</p></div>
  )

  // ── Desktop table — reused both for the main Table view and inside each Group panel ──
  const StudentTable = ({ list }) => (
    <div className="overflow-x-auto hidden md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <th className="px-4 py-3 font-black text-center w-10">
              <input type="checkbox"
                checked={list.length > 0 && list.every(s => selectedIds.has(s._id))}
                onChange={() => toggleSelectAll(list)}
                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
            </th>
            <th className="px-5 py-3 font-black text-left">Student</th>
            <th className="px-5 py-3 font-black text-center">Roll No</th>
            <th className="px-5 py-3 font-black text-center">Class</th>
            <th className="px-5 py-3 font-black text-center">Year</th>
            <th className="px-5 py-3 font-black text-center">Session</th>
            <th className="px-5 py-3 font-black text-center">Contact</th>
            <th className="px-5 py-3 font-black text-center">Attendance</th>
            <th className="px-5 py-3 font-black text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {list.map((student) => {
            const { st, pct, low } = getStudentStat(student)
            const imgOk = student.photo && !brokenImages.has(student._id)
            const checked = selectedIds.has(student._id)
            return (
              <tr key={student._id}
                className={`border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer ${low ? 'border-l-4 border-l-red-400' : ''} ${checked ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                onClick={() => openProfile(student)}>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSelect(student._id)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    {imgOk ? (
                      <img src={student.photo} onError={() => markImageBroken(student._id)}
                        className="w-10 h-10 rounded-2xl object-cover flex-shrink-0 shadow-sm" />
                    ) : (
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm ${
                        low ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
                      }`}>{(student.name || '?').charAt(0)}</div>
                    )}
                    <div>
                      <p className="font-black text-gray-800 dark:text-white">{highlightMatch(student.name, search)}</p>
                      <p className="text-xs text-gray-400">{highlightMatch(student.email || 'No email', search)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-sm font-medium text-center">{highlightMatch(student.rollNo || '-', search)}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                    low ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' :
                    'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                  }`}>
                    {student.class}{student.section ? `-${student.section}` : ''}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs font-medium text-center">{student.year || '-'}</td>
                <td className="px-5 py-3 text-gray-400 text-xs font-medium text-center">{student.session || '-'}</td>
                <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    {student.phone && (
                      <a href={`tel:${student.phone}`} title="Call" className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all text-xs">📞</a>
                    )}
                    {student.phone && (
                      <a href={`https://wa.me/${formatWhatsapp(student.phone)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 flex items-center justify-center hover:bg-green-100 dark:hover:bg-green-900/40 transition-all text-xs">💬</a>
                    )}
                    {student.email && (
                      <a href={`mailto:${student.email}`} title="Email" className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all text-xs">✉️</a>
                    )}
                    {!student.phone && !student.email && <span className="text-xs text-gray-300">-</span>}
                  </div>
                </td>
                <td className="px-5 py-3">
                  {st && st.total > 0 ? (
                    <div className="flex items-center gap-2.5 justify-center">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 w-24 overflow-hidden">
                        <div className={`h-full rounded-full ${getPctBg(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className={`text-xs font-black min-w-[42px] ${getPctColor(pct)}`}>{pct}%</span>
                      {low && <span className="text-xs">⚠️</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300 dark:text-gray-600 font-medium text-center block">
                      {statsLoading ? 'Loading...' : 'No data'}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openProfile(student)}
                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-black transition-all">
                    Profile
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  // ── Mobile card layout — shown instead of the table on small screens ──
  const StudentCards = ({ list }) => (
    <div className="md:hidden space-y-3 p-3">
      {list.map(student => {
        const { st, pct, low } = getStudentStat(student)
        const imgOk = student.photo && !brokenImages.has(student._id)
        const checked = selectedIds.has(student._id)
        return (
          <div key={student._id} onClick={() => openProfile(student)}
            className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 cursor-pointer ${low ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} ${checked ? 'ring-2 ring-indigo-400' : ''}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={checked} onClick={e => e.stopPropagation()} onChange={() => toggleSelect(student._id)}
                className="w-4 h-4 mt-2 rounded accent-indigo-600 cursor-pointer flex-shrink-0" />
              {imgOk ? (
                <img src={student.photo} onError={() => markImageBroken(student._id)} className="w-12 h-12 rounded-2xl object-cover flex-shrink-0 shadow-sm" />
              ) : (
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black flex-shrink-0 shadow-sm ${low ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'}`}>
                  {(student.name || '?').charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-800 dark:text-white">{highlightMatch(student.name, search)}</p>
                <p className="text-xs text-gray-400 truncate">{highlightMatch(student.email || 'No email', search)}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${low ? 'bg-red-50 dark:bg-red-900/20 text-red-700' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700'}`}>
                    {student.class}{student.section ? `-${student.section}` : ''}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-500">Roll {student.rollNo || '-'}</span>
                  {low && <span className="text-xs">⚠️</span>}
                </div>
              </div>
            </div>

            {(student.phone || student.email) && (
              <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
                {student.phone && <a href={`tel:${student.phone}`} className="flex-1 text-center py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-bold">📞 Call</a>}
                {student.phone && <a href={`https://wa.me/${formatWhatsapp(student.phone)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 text-xs font-bold">💬 WhatsApp</a>}
                {student.email && <a href={`mailto:${student.email}`} className="flex-1 text-center py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-xs font-bold">✉️ Email</a>}
              </div>
            )}

            {st && st.total > 0 ? (
              <div className="mt-3">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-400 font-medium">Attendance</span>
                  <span className={`text-xs font-black ${getPctColor(pct)}`}>{pct}%</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${getPctBg(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-3">{statsLoading ? 'Loading...' : 'No data'}</p>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div>
      {/* Profile Modal — backdrop click / Escape to close, avatar no longer gets clipped */}
      {showProfile && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfile(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col relative"
            onClick={e => e.stopPropagation()}>

            {/* Cover */}
            <div className="h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 relative flex-shrink-0">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)', backgroundSize: '12px 12px' }} />
              <button onClick={() => setShowProfile(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm transition-all z-20">✕</button>
              {isLow(selectedStudent._id) && (
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-red-500/20 text-red-200 border border-red-400/30 rounded-full text-xs font-black">⚠️ Low Attendance</span>
                </div>
              )}
            </div>

            {/* Avatar — positioned outside the scroll container so it never gets clipped */}
            <div className="absolute left-6 top-20 z-10">
              {selectedStudent.photo && !brokenImages.has(`modal-${selectedStudent._id}`) ? (
                <img src={selectedStudent.photo} alt={selectedStudent.name}
                  onError={() => markImageBroken(`modal-${selectedStudent._id}`)}
                  className="w-24 h-24 rounded-3xl object-cover border-4 border-white dark:border-gray-800 shadow-2xl" />
              ) : (
                <div className={`w-24 h-24 rounded-3xl border-4 border-white dark:border-gray-800 shadow-2xl flex items-center justify-center text-white text-4xl font-black ${
                  isLow(selectedStudent._id)
                    ? 'bg-gradient-to-br from-red-500 to-rose-600'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                }`}>
                  {(selectedStudent.name || '?').charAt(0)}
                </div>
              )}
            </div>

            {/* Scrollable content — premium scrollbar, extra top padding to clear the avatar */}
            <div className="overflow-y-auto flex-1 px-6 pb-6 pt-14
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-indigo-300
              [&::-webkit-scrollbar-thumb]:dark:bg-indigo-700
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:hover:bg-indigo-400">

              <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{selectedStudent.name}</h2>
              <p className="text-sm text-gray-400 mt-1">
                Roll No: {selectedStudent.rollNo || 'N/A'} •{' '}
                {selectedStudent.email ? (
                  <a href={`mailto:${selectedStudent.email}`} className="text-indigo-500 hover:underline">{selectedStudent.email}</a>
                ) : 'No email'}
              </p>

              {/* Quick contact actions */}
              {(selectedStudent.phone || selectedStudent.email) && (
                <div className="flex gap-2 mt-3">
                  {selectedStudent.phone && <a href={`tel:${selectedStudent.phone}`} className="flex-1 text-center py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-bold">📞 Call</a>}
                  {selectedStudent.phone && <a href={`https://wa.me/${formatWhatsapp(selectedStudent.phone)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 text-xs font-bold">💬 WhatsApp</a>}
                  {selectedStudent.email && <a href={`mailto:${selectedStudent.email}`} className="flex-1 text-center py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-xs font-bold">✉️ Email</a>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'Class', value: `${selectedStudent.class}${selectedStudent.section ? `-${selectedStudent.section}` : ''}`, icon: '🏫' },
                  { label: 'Year', value: selectedStudent.year || 'N/A', icon: '📚' },
                  { label: 'Session', value: selectedStudent.session || 'N/A', icon: '🗓️' },
                  { label: 'Phone', value: selectedStudent.phone || 'N/A', icon: '📱' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-3.5 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 mb-1 font-medium">{item.icon} {item.label}</p>
                    <p className="text-sm font-black text-gray-700 dark:text-gray-200">{item.value}</p>
                  </div>
                ))}
              </div>

              {profileLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : studentAttendance && (
                <div className="mt-5">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Attendance Overview</p>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: 'Total', value: studentAttendance.stats.total, color: 'text-gray-700 dark:text-gray-200' },
                      { label: 'Present', value: studentAttendance.stats.present, color: 'text-green-600' },
                      { label: 'Absent', value: studentAttendance.stats.absent, color: 'text-red-500' },
                      { label: '%', value: `${studentAttendance.stats.percentage}%`, color: getPctColor(parseFloat(studentAttendance.stats.percentage)) },
                    ].map((item, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-3 text-center border border-gray-100 dark:border-gray-700">
                        <p className={`text-xl font-black ${item.color}`}>{item.value}</p>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-gray-500">Attendance Progress</span>
                      <span className={`text-xs font-black ${getPctColor(parseFloat(studentAttendance.stats.percentage))}`}>
                        {studentAttendance.stats.percentage}%
                      </span>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${getPctBg(parseFloat(studentAttendance.stats.percentage))}`}
                        style={{ width: `${Math.min(100, parseFloat(studentAttendance.stats.percentage))}%` }} />
                    </div>
                    {parseFloat(studentAttendance.stats.percentage) < 75 && (
                      <p className="text-xs text-red-500 mt-2 font-black">⚠️ Below 75% — Needs immediate attention!</p>
                    )}
                  </div>

                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 mt-4">Recent Records</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto
                    [&::-webkit-scrollbar]:w-1.5
                    [&::-webkit-scrollbar-track]:bg-transparent
                    [&::-webkit-scrollbar-thumb]:bg-indigo-200
                    [&::-webkit-scrollbar-thumb]:dark:bg-indigo-800
                    [&::-webkit-scrollbar-thumb]:rounded-full">
                    {studentAttendance.attendance.slice(0, 15).map((rec, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2.5 border border-gray-100 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                          {new Date(rec.date).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' })}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                          rec.status === 'Present' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                          rec.status === 'Absent' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        }`}>{rec.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-white">My Students</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {students.length} students •
            {lowCount > 0 ? <span className="text-red-500 font-bold"> {lowCount} low attendance</span> : ' all attendance good'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50">
            <span className={refreshing ? 'animate-spin inline-block' : 'inline-block'}>🔄</span> Refresh
          </button>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
            {[{ id: 'table', icon: '☰', label: 'Table' }, { id: 'grid', icon: '⊞', label: 'Grid' }, { id: 'group', icon: '🏫', label: 'Group' }].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)} title={v.label}
                className={`px-3 py-1.5 rounded-lg text-sm font-black transition-all ${viewMode === v.id ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-800 dark:text-white' : 'text-gray-400'}`}>
                {v.icon}
              </button>
            ))}
          </div>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-bold hover:bg-green-50 transition-all">📊 Excel</button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 border border-red-500 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all">📄 PDF</button>
        </div>
      </div>

      {/* Low Attendance Banner */}
      {lowCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xl">⚠️</div>
            <div>
              <p className="text-sm font-black text-red-700 dark:text-red-300">{lowCount} student{lowCount !== 1 ? 's' : ''} with low attendance!</p>
              <p className="text-xs text-red-500 mt-0.5">Below 75% — requires immediate attention</p>
            </div>
          </div>
          <button onClick={() => setFilterAttendance(filterAttendance === 'low' ? '' : 'low')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${filterAttendance === 'low' ? 'bg-red-600 text-white' : 'bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200'}`}>
            {filterAttendance === 'low' ? '✕ Clear' : 'View Only'}
          </button>
        </div>
      )}

      {/* Bulk selection action bar — appears when checkboxes are checked */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3 mb-4 flex-wrap gap-3">
          <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">{selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected</p>
          <div className="flex gap-2">
            <button onClick={clearSelection} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all">Clear</button>
            <button onClick={sendBulkAlerts} disabled={sendingAlerts}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all disabled:opacity-50 flex items-center gap-1.5">
              {sendingAlerts ? (<><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>) : '⚠️ Send Low Attendance Alert'}
            </button>
          </div>
        </div>
      )}

      {/* Filters — cascading: selecting Class narrows Section/Year/Session to valid combinations */}
      <div className="flex gap-3 mb-3 flex-wrap items-center">
        <input type="text" placeholder="Search by name, roll no, email, phone..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {[
          { value: filterClass, onChange: v => { setFilterClass(v); setFilterSection(''); setFilterYear(''); setFilterSession('') }, opts: classOptions, ph: 'All Classes' },
          { value: filterSection, onChange: v => { setFilterSection(v); setFilterYear(''); setFilterSession('') }, opts: sectionOptions, ph: 'All Sections' },
          { value: filterYear, onChange: v => { setFilterYear(v); setFilterSession('') }, opts: yearOptions, ph: 'All Years' },
          { value: filterSession, onChange: setFilterSession, opts: sessionOptions, ph: 'All Sessions' },
          { value: filterAttendance, onChange: setFilterAttendance, opts: ['low', 'good'], ph: 'All Attendance' },
        ].map((f, i) => (
          <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">{f.ph}</option>
            {f.opts.map(o => <option key={o} value={o}>{o === 'low' ? 'Low (<75%)' : o === 'good' ? 'Good (≥75%)' : o}</option>)}
          </select>
        ))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="name">Sort: Name (A-Z)</option>
          <option value="roll">Sort: Roll No</option>
          <option value="attendance-high">Sort: Attendance (High-Low)</option>
          <option value="attendance-low">Sort: Attendance (Low-High)</option>
        </select>
        {hasActiveFilters && (
          <button onClick={clearAllFilters}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">✕ Clear</button>
        )}
      </div>

      <p className="text-xs text-gray-400 font-medium mb-4">
        Showing {sorted.length} of {students.length} students
        {statsLoading && (
          <span className="inline-flex items-center gap-1.5 ml-2 text-indigo-500 font-bold">
            <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block" />
            Loading attendance...
          </span>
        )}
      </p>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          {loading ? <SkeletonRows /> : paginated.length === 0 ? <EmptyState /> : (
            <>
              <StudentTable list={paginated} />
              <StudentCards list={paginated} />
            </>
          )}
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        loading ? <SkeletonGrid /> : paginated.length === 0 ? <EmptyState /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(student => {
              const { st, pct, low } = getStudentStat(student)
              const imgOk = student.photo && !brokenImages.has(student._id)
              const checked = selectedIds.has(student._id)
              return (
                <div key={student._id}
                  className={`bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 relative ${
                    low ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
                  } ${checked ? 'ring-2 ring-indigo-400' : ''}`}>
                  <input type="checkbox" checked={checked} onClick={e => e.stopPropagation()} onChange={() => toggleSelect(student._id)}
                    className="absolute top-3 right-3 w-4 h-4 rounded accent-indigo-600 cursor-pointer z-10" />
                  <div onClick={() => openProfile(student)} className="cursor-pointer">
                    <div className={`h-1.5 ${low ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`} />
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-4">
                        {imgOk ? (
                          <img src={student.photo} onError={() => markImageBroken(student._id)}
                            className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 shadow-md" />
                        ) : (
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black flex-shrink-0 shadow-md ${
                            low ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                          }`}>{(student.name || '?').charAt(0)}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-gray-800 dark:text-white text-sm truncate">{highlightMatch(student.name, search)}</h3>
                          <p className="text-xs text-gray-400 truncate">{highlightMatch(student.email || 'No email', search)}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                              low ? 'bg-red-50 dark:bg-red-900/20 text-red-700' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700'
                            }`}>{student.class}{student.section ? `-${student.section}` : ''}</span>
                            {low && <span>⚠️</span>}
                          </div>
                        </div>
                      </div>
                      {st && st.total > 0 ? (
                        <div>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs text-gray-400 font-medium">Attendance</span>
                            <span className={`text-sm font-black ${getPctColor(pct)}`}>{pct}%</span>
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden mb-2">
                            <div className={`h-full rounded-full ${getPctBg(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-green-600 font-black">{st.present}P</span>
                            <span className="text-red-500 font-black">{st.absent}A</span>
                            <span className="text-gray-400 font-medium">{st.total} Total</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-300 dark:text-gray-600">{statsLoading ? 'Loading...' : 'No data'}</p>
                      )}
                    </div>
                  </div>
                  {(student.phone || student.email) && (
                    <div className="flex items-center gap-2 px-4 pb-4" onClick={e => e.stopPropagation()}>
                      {student.phone && <a href={`tel:${student.phone}`} className="flex-1 text-center py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-bold">📞</a>}
                      {student.phone && <a href={`https://wa.me/${formatWhatsapp(student.phone)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 text-xs font-bold">💬</a>}
                      {student.email && <a href={`mailto:${student.email}`} className="flex-1 text-center py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-xs font-bold">✉️</a>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* GROUP BY CLASS VIEW */}
      {viewMode === 'group' && (
        loading ? <SkeletonRows /> : grouped.length === 0 ? <EmptyState /> : (
          <div className="space-y-4">
            {grouped.map(([key, groupStudents]) => {
              const groupLow = groupStudents.filter(s => isLow(s._id)).length
              const isCollapsed = collapsedGroups.has(key)
              return (
                <div key={key} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <button onClick={() => toggleGroup(key)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">{isCollapsed ? '▶' : '▼'}</span>
                      <span className="font-black text-gray-800 dark:text-white">🏫 {key}</span>
                      <span className="text-xs text-gray-400 font-medium">{groupStudents.length} students</span>
                      {groupLow > 0 && <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg text-xs font-black">⚠️ {groupLow} low</span>}
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      <StudentTable list={groupStudents} />
                      <StudentCards list={groupStudents} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Pagination — only shown for Table/Grid; Group view shows everything at once */}
      {!loading && sorted.length > 0 && viewMode !== 'group' && (
        <div className="flex items-center justify-between flex-wrap gap-3 mt-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span>Show</span>
            <select value={perPage} onChange={e => setPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value="all">All</option>
            </select>
            <span>per page</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
              ← Prev
            </button>
            <span className="text-xs text-gray-400 font-bold px-2">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TStudents