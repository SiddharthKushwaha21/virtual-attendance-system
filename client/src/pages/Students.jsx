import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import Webcam from 'react-webcam'

// ─────────────────────────────────────────────
// Student Profile Page Component
// ─────────────────────────────────────────────
const StudentProfile = ({ student, onBack, token, onUpdate }) => {
  const [historyData, setHistoryData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: student.name, email: student.email || '',
    phone: student.phone || '', class: student.class,
    section: student.section || '', year: student.year || '',
    session: student.session || '', photo: ''
  })
  const [editPhotoPreview, setEditPhotoPreview] = useState(student.photo || null)
  const editFileRef = useRef(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/student/${student._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setHistoryData(data)
    } catch (err) {
      toast.error('History load failed!')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setEditPhotoPreview(reader.result)
      setEditForm(prev => ({ ...prev, photo: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleUpdate = async () => {
    if (!editForm.name) { toast.error('Name required!'); return }
    if (editForm.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(editForm.email)) { toast.error('Invalid email format!'); return }
    }
    if (editForm.phone) {
      const phoneRegex = /^[6-9]\d{9}$/
      if (!phoneRegex.test(editForm.phone)) { toast.error('Phone must be 10 digits!'); return }
    }
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/students/${student._id}`,
        editForm,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Student updated successfully!')
      setEditing(false)
      onUpdate()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed!')
    }
  }

  const pctColor = (p) => p >= 75 ? 'text-green-500' : p >= 50 ? 'text-yellow-500' : 'text-red-500'
  const pctBg = (p) => p >= 75 ? 'bg-green-500' : p >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  const statusStyle = (status) => {
    if (status === 'Present') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    if (status === 'Absent') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    if (status === 'Late') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
    return 'bg-gray-100 text-gray-500'
  }

  const monthlyBreakdown = historyData ? (() => {
    const months = {}
    historyData.attendance.forEach(a => {
      const month = new Date(a.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      if (!months[month]) months[month] = { present: 0, absent: 0, late: 0, total: 0 }
      months[month].total++
      if (a.status === 'Present') months[month].present++
      else if (a.status === 'Absent') months[month].absent++
      else if (a.status === 'Late') months[month].late++
    })
    return Object.entries(months).slice(-4)
  })() : []

  return (
    <div className="min-h-screen">
      {/* Back Button */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Students
      </button>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        {/* Cover Banner */}
        <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative">
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-10 mb-4">
            {/* Avatar */}
            <div className="relative">
              {student.photo || editPhotoPreview ? (
                <img src={editing ? editPhotoPreview : student.photo}
                  alt={student.name}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-lg" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{student.name.charAt(0)}</span>
                </div>
              )}
              {student.faceEncoding?.length > 0 && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                  <span className="text-white text-xs">🤖</span>
                </div>
              )}
            </div>

            {/* Edit Details Button */}
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Details
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setEditPhotoPreview(student.photo || null) }}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                  Cancel
                </button>
                <button onClick={handleUpdate}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {/* Name + Info OR Edit Form */}
          {!editing ? (
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{student.name}</h1>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Roll No: <span className="font-medium text-gray-700 dark:text-gray-300">{student.rollNo}</span></span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">{student.class}{student.section && ` - ${student.section}`}</span>
                    {student.year && <><span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" /><span className="text-sm text-gray-500 dark:text-gray-400">{student.year}</span></>}
                    {student.session && <><span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" /><span className="text-sm text-gray-500 dark:text-gray-400">{student.session}</span></>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {student.faceEncoding?.length > 0 && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                      🤖 Face Registered
                    </span>
                  )}
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                    Active Student
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {[
                  { icon: '✉️', label: 'Email', value: student.email || 'Not provided' },
                  { icon: '📱', label: 'Phone', value: student.phone || 'Not provided' },
                  { icon: '🏫', label: 'Class', value: `${student.class}${student.section ? ` - ${student.section}` : ''}` },
                  { icon: '📅', label: 'Session', value: student.session || 'Not provided' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">{item.icon} {item.label}</p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Edit Form */
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div onClick={() => editFileRef.current.click()}
                  className="w-12 h-12 rounded-xl border-2 border-dashed border-blue-400 flex items-center justify-center cursor-pointer overflow-hidden hover:border-blue-600 transition-colors">
                  {editPhotoPreview
                    ? <img src={editPhotoPreview} alt="preview" className="w-full h-full object-cover" />
                    : <span className="text-xl">📸</span>}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Change Photo</p>
                  <p className="text-xs text-gray-400">Click to upload</p>
                </div>
                <input ref={editFileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Full Name *', key: 'name', col: 2 },
                  { label: 'Class', key: 'class' }, { label: 'Section', key: 'section' },
                  { label: 'Year', key: 'year' }, { label: 'Session', key: 'session' },
                  { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' },
                ].map((field) => (
                  <div key={field.key} className={field.col === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
                    <input type="text" value={editForm[field.key]}
                      onChange={(e) => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Stats + History */}
      {historyLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400">
          <div className="text-3xl mb-2">⏳</div>
          <p className="text-sm">Loading attendance history...</p>
        </div>
      ) : historyData ? (
        <div className="space-y-5">
          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Total Days', value: historyData.stats.total, color: 'text-gray-700 dark:text-gray-200', bg: 'bg-white dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
              { label: 'Present', value: historyData.stats.present, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
              { label: 'Absent', value: historyData.stats.absent, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
              { label: 'Late', value: historyData.stats.late, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800' },
              { label: 'Attendance', value: `${historyData.stats.percentage}%`, color: pctColor(historyData.stats.percentage), bg: 'bg-white dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
            ].map((card, i) => (
              <div key={i} className={`${card.bg} border ${card.border} rounded-2xl p-4 text-center`}>
                <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                <p className="text-xs text-gray-400 mt-1 font-medium">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Attendance Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white">Overall Attendance</h3>
              <span className={`text-xl font-black ${pctColor(historyData.stats.percentage)}`}>
                {historyData.stats.percentage}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
              <div className={`h-3 rounded-full transition-all duration-1000 ${pctBg(historyData.stats.percentage)}`}
                style={{ width: `${historyData.stats.percentage}%` }} />
            </div>
            {historyData.stats.total > 0 && (
              <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
                historyData.stats.percentage >= 75
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
              }`}>
                <span>{historyData.stats.percentage >= 75 ? '✅' : '⚠️'}</span>
                <span>
                  {historyData.stats.percentage >= 75
                    ? 'Attendance is above 75%. Keep it up!'
                    : `Attendance is below 75%! Need ${Math.ceil((0.75 * historyData.stats.total - (historyData.stats.present + historyData.stats.late)) / 0.25)} more present days to reach 75%.`
                  }
                </span>
              </div>
            )}
          </div>

          {/* Monthly Breakdown */}
          {monthlyBreakdown.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Monthly Breakdown</h3>
              <div className="grid grid-cols-4 gap-3">
                {monthlyBreakdown.map(([month, data], i) => {
                  const pct = data.total > 0 ? Math.round(((data.present + data.late) / data.total) * 100) : 0
                  return (
                    <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{month}</p>
                      <p className={`text-lg font-black ${pctColor(pct)}`}>{pct}%</p>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-2 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${pctBg(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-green-500 font-medium">{data.present}P</span>
                        <span className="text-xs text-red-500 font-medium">{data.absent}A</span>
                        <span className="text-xs text-yellow-500 font-medium">{data.late}L</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Attendance History Table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Attendance History</h3>
                <p className="text-xs text-gray-400 mt-0.5">{historyData.attendance.length} records total</p>
              </div>
            </div>
            {historyData.attendance.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm">No attendance records yet!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Day</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Marked By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.attendance.map((a, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-700 dark:text-gray-200">
                          {new Date(a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs">
                            {new Date(a.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(a.status)}`}>
                            {a.status === 'Present' ? '✅' : a.status === 'Absent' ? '❌' : '⏰'} {a.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{a.time || '-'}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded text-xs">
                            {a.markedBy || 'Manual'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Students Component
// ─────────────────────────────────────────────
const Students = () => {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [years, setYears] = useState([])
  const [sessions, setSessions] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showFaceModal, setShowFaceModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [profileStudent, setProfileStudent] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [faceRegistering, setFaceRegistering] = useState(false)
  const [capturedPhotos, setCapturedPhotos] = useState([])
  const [registerStep, setRegisterStep] = useState('capture')
  const fileInputRef = useRef(null)
  const bulkFileRef = useRef(null)
  const webcamRef = useRef(null)

  const [form, setForm] = useState({
    name: '', rollNo: '', email: '', phone: '',
    class: '', section: '', year: '', session: '', photo: ''
  })

  const token = JSON.parse(localStorage.getItem('user'))?.token

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/students`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setStudents(data)
      setClasses([...new Set(data.map(s => s.class).filter(Boolean))])
      setYears([...new Set(data.map(s => s.year).filter(Boolean))])
      setSessions([...new Set(data.map(s => s.session).filter(Boolean))])
    } catch (err) {
      toast.error('Failed to load students!')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStudents() }, [])

  const handleClassFilter = (cls) => {
    setFilterClass(cls)
    setFilterSection('')
    if (cls) setSections([...new Set(students.filter(s => s.class === cls).map(s => s.section).filter(Boolean))])
    else setSections([])
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result)
      setForm(prev => ({ ...prev, photo: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleAdd = async () => {
    if (!form.name || form.name.trim().length < 2) { toast.error('Name must be at least 2 characters!'); return }
    if (!form.rollNo) { toast.error('Roll No is required!'); return }
    if (!form.class) { toast.error('Class is required!'); return }
    if (form.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Invalid email format!'); return }
    }
    if (form.phone) {
      if (!/^[6-9]\d{9}$/.test(form.phone)) { toast.error('Phone must be 10 digits!'); return }
    }
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/students`, form, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('Student added successfully!')
      setShowModal(false)
      setPhotoPreview(null)
      setForm({ name: '', rollNo: '', email: '', phone: '', class: '', section: '', year: '', session: '', photo: '' })
      fetchStudents()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error occurred!')
    }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this student?')) return
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/students/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('Student deleted!')
      fetchStudents()
    } catch (err) {
      toast.error('Delete failed!')
    }
  }

  const handleFaceRegister = (student, e) => {
    e.stopPropagation()
    setSelectedStudent(student)
    setFaceRegistering(false)
    setCapturedPhotos([])
    setRegisterStep('capture')
    setShowFaceModal(true)
  }

  const capturePhoto = () => {
    if (!webcamRef.current) return
    if (capturedPhotos.length >= 3) { toast.error('Maximum 3 photos!'); return }
    const imageSrc = webcamRef.current.getScreenshot({ width: 640, height: 480 })
    if (!imageSrc) { toast.error('Could not capture photo!'); return }
    setCapturedPhotos(prev => [...prev, imageSrc])
    toast.success(`Photo ${capturedPhotos.length + 1} captured! ✅`)
  }

  const captureAndRegister = async () => {
    if (capturedPhotos.length === 0) { toast.error('Capture at least 1 photo!'); return }
    try {
      setFaceRegistering(true)
      const formData = new FormData()
      for (let i = 0; i < capturedPhotos.length; i++) {
        const canvas = document.createElement('canvas')
        const img = new window.Image()
        await new Promise((resolve) => { img.onload = resolve; img.src = capturedPhotos[i] })
        canvas.width = img.width; canvas.height = img.height
        canvas.getContext('2d').drawImage(img, 0, 0)
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
        formData.append('files', blob, `face_${i}.png`)
      }
      const { data } = await axios.post(
        `http://localhost:8000/register-face-multiple/${selectedStudent._id}`,
        formData, { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      toast.success(data.message)
      setRegisterStep('done')
      setTimeout(() => { setShowFaceModal(false); setCapturedPhotos([]); fetchStudents() }, 1500)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Face registration failed!')
    } finally {
      setFaceRegistering(false)
    }
  }

  const handleBulkImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)
      const studentsData = rows.map(row => ({
        name: row['Name'] || row['name'],
        rollNo: String(row['Roll No'] || row['rollNo']),
        email: row['Email'] || row['email'] || '',
        phone: String(row['Phone'] || row['phone'] || ''),
        class: row['Class'] || row['class'],
        section: row['Section'] || row['section'] || '',
        year: row['Year'] || row['year'] || '',
        session: row['Session'] || row['session'] || '',
      }))
      const { data: result } = await axios.post(
        `${import.meta.env.VITE_API_URL}/students/bulk-import`,
        { students: studentsData },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(result.message)
      fetchStudents()
    } catch (err) {
      toast.error('Import failed!')
    }
  }

  const downloadTemplate = () => {
    const template = [{ Name: 'Rahul Sharma', 'Roll No': '101', Email: 'rahul@gmail.com', Phone: '9876543210', Class: 'MCA', Section: 'A', Year: '1st Year', Session: '2025-26' }]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, 'students_template.xlsx')
  }

  const exportStudents = () => {
    if (students.length === 0) { toast.error('No students to export!'); return }
    const exportData = students.map(s => ({
      Name: s.name, 'Roll No': s.rollNo, Email: s.email || '',
      Phone: s.phone || '', Class: s.class || '', Section: s.section || '',
      Year: s.year || '', Session: s.session || '',
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, `students_export_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`)
    toast.success('Students exported!')
  }

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNo.includes(search) ||
      (s.class && s.class.toLowerCase().includes(search.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase()))
    const matchClass = filterClass ? s.class === filterClass : true
    const matchSection = filterSection ? s.section === filterSection : true
    const matchYear = filterYear ? s.year === filterYear : true
    const matchSession = filterSession ? s.session === filterSession : true
    return matchSearch && matchClass && matchSection && matchYear && matchSession
  })

  // ── Student Profile View ──
  if (profileStudent) {
    return (
      <StudentProfile
        student={students.find(s => s._id === profileStudent._id) || profileStudent}
        onBack={() => setProfileStudent(null)}
        token={token}
        onUpdate={() => { fetchStudents(); setProfileStudent(null) }}
      />
    )
  }

  const faceStatusBadge = (s) => {
    if (!s.faceEncoding?.length) return null
    const count = s.faceCount || s.faceEncodings?.length || (s.faceEncoding?.length > 0 ? '✓' : null)
    return count
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Students</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{students.length} total students</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
            📥 Template
          </button>
          <button onClick={exportStudents}
            className="px-3 py-2 border border-purple-500 text-purple-600 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all">
            📤 Export
          </button>
          <button onClick={() => bulkFileRef.current.click()}
            className="px-3 py-2 border border-green-500 text-green-600 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">
            📊 Bulk Import
          </button>
          <input ref={bulkFileRef} type="file" accept=".xlsx,.xls" onChange={handleBulkImport} className="hidden" />
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all">
            + Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="text" placeholder="Search by name, roll no, class or email..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[220px] px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={filterClass} onChange={(e) => handleClassFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Sections</option>
          {(sections.length > 0 ? sections : [...new Set(students.map(s => s.section).filter(Boolean))]).map(s => (
            <option key={s} value={s}>Section {s}</option>
          ))}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Sessions</option>
          {sessions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">⏳</div>
            <p className="text-sm">Loading students...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">👥</div>
            <p className="font-medium">No students found!</p>
            <p className="text-sm mt-1">Try a different filter or add a new student.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Roll No</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Face ID</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s._id}
                  onClick={() => setProfileStudent(s)}
                  className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {s.photo ? (
                        <img src={s.photo} alt={s.name} className="w-9 h-9 rounded-xl object-cover ring-2 ring-gray-100 dark:ring-gray-700" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                          {s.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.email || 'No email'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg">{s.rollNo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
                      {s.class}{s.section && ` - ${s.section}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{s.year || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{s.session || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{s.phone || '—'}</td>
                  {/* Face ID Column — Professional */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {s.faceEncoding?.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            {s.faceCount ? `${s.faceCount} photos` : 'Active'}
                          </span>
                        </div>
                        <button onClick={(e) => handleFaceRegister(s, e)}
                          title="Add more face photos"
                          className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition-all text-xs font-bold">
                          +
                        </button>
                      </div>
                    ) : (
                      <button onClick={(e) => handleFaceRegister(s, e)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all">
                        <span className="text-xs">📷</span>
                        <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">Register</span>
                      </button>
                    )}
                  </td>
                  {/* Actions Column — Professional Icon Buttons */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {/* View Profile */}
                      <button
                        onClick={() => setProfileStudent(s)}
                        title="View Profile"
                        className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button
                        onClick={(e) => handleDelete(s._id, e)}
                        title="Delete Student"
                        className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 flex items-center justify-center transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Add New Student</h3>
              <button onClick={() => { setShowModal(false); setPhotoPreview(null) }}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-all">✕</button>
            </div>
            <div className="flex items-center gap-4 mb-5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div onClick={() => fileInputRef.current.click()}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-blue-400 flex items-center justify-center cursor-pointer overflow-hidden hover:border-blue-600 transition-colors">
                {photoPreview
                  ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  : <span className="text-2xl">📸</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Profile Photo</p>
                <p className="text-xs text-gray-400">Click to upload photo</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Full Name *', key: 'name', placeholder: 'Rahul Sharma', col: 2 },
                { label: 'Roll No *', key: 'rollNo', placeholder: '101' },
                { label: 'Class *', key: 'class', placeholder: 'MCA' },
                { label: 'Section', key: 'section', placeholder: 'A' },
                { label: 'Year', key: 'year', placeholder: '1st Year' },
                { label: 'Session', key: 'session', placeholder: '2025-26' },
                { label: 'Email', key: 'email', placeholder: 'rahul@gmail.com' },
                { label: 'Phone', key: 'phone', placeholder: '9876543210' },
              ].map((field) => (
                <div key={field.key} className={field.col === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{field.label}</label>
                  <input type="text" placeholder={field.placeholder} value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowModal(false); setPhotoPreview(null) }}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                Cancel
              </button>
              <button onClick={handleAdd}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all">
                Add Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Face Register Modal */}
      {showFaceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Face Registration</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selectedStudent?.name} — {capturedPhotos.length}/3 photos captured</p>
              </div>
              <button onClick={() => { setShowFaceModal(false); setCapturedPhotos([]) }}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm">✕</button>
            </div>

            {registerStep === 'capture' && (
              <>
                <div className="relative rounded-2xl overflow-hidden bg-black mb-4" style={{ aspectRatio: '4/3' }}>
                  <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover" mirrored={true} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-blue-400 rounded-full opacity-70" />
                  </div>
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">Keep face inside the circle</span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">{capturedPhotos.length}/3</span>
                  </div>
                </div>

                {/* Captured Photos Preview */}
                <div className="flex gap-2 mb-4">
                  {capturedPhotos.map((photo, i) => (
                    <div key={i} className="relative">
                      <img src={photo} alt={`photo ${i + 1}`} className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-400" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <button onClick={() => setCapturedPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✕</span>
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: 3 - capturedPhotos.length }).map((_, i) => (
                    <div key={i} className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                      <span className="text-gray-300 text-xl">📸</span>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2.5 mb-4">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    💡 <strong>Tip:</strong> Take 3 photos from different angles — front, slight left, slight right — for better accuracy!
                  </p>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => { setShowFaceModal(false); setCapturedPhotos([]) }}
                    className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                    Cancel
                  </button>
                  {capturedPhotos.length < 3 && (
                    <button onClick={capturePhoto}
                      className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all">
                      📸 Capture ({capturedPhotos.length}/3)
                    </button>
                  )}
                  {capturedPhotos.length > 0 && (
                    <button onClick={captureAndRegister} disabled={faceRegistering}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all">
                      {faceRegistering ? '⏳ Registering...' : `✅ Register (${capturedPhotos.length})`}
                    </button>
                  )}
                </div>
              </>
            )}

            {registerStep === 'done' && (
              <div className="text-center py-10">
                <div className="text-6xl mb-4">🎉</div>
                <p className="text-xl font-bold text-emerald-600">Face Registered!</p>
                <p className="text-sm text-gray-400 mt-2">{capturedPhotos.length} photos registered successfully</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Students