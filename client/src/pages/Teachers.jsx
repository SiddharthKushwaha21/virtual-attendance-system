import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Eye Icon ───
const EyeIcon = ({ show, toggle }) => (
  <button type="button" onClick={toggle}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
    {show ? (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )}
  </button>
)

// ─── Image Crop Modal ───
const ImageCropModal = ({ imageSrc, onCrop, onCancel }) => {
  const canvasRef = useRef(null)
  const [crop, setCrop] = useState({ x: 50, y: 50, size: 200 })
  const [imgLoaded, setImgLoaded] = useState(false)
  const imgRef = useRef(new Image())
  const isDragging = useRef(false)
  const dragStart = useRef({})

  useEffect(() => {
    const img = imgRef.current
    img.onload = () => {
      setImgLoaded(true)
      setCrop({ x: img.width / 2 - 100, y: img.height / 2 - 100, size: Math.min(200, img.width, img.height) })
    }
    img.src = imageSrc
  }, [imageSrc])

  useEffect(() => {
    if (!imgLoaded) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imgRef.current
    const scale = Math.min(500 / img.width, 400 / img.height)
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const sx = crop.x * scale, sy = crop.y * scale, ss = crop.size * scale
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.clearRect(sx, sy, ss, ss)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(sx, sy, ss, ss)
    // Corner handles
    const hs = 8
    ctx.fillStyle = '#3b82f6'
    ;[[sx,sy],[sx+ss-hs,sy],[sx,sy+ss-hs],[sx+ss-hs,sy+ss-hs]].forEach(([hx,hy]) => {
      ctx.fillRect(hx, hy, hs, hs)
    })
  }, [crop, imgLoaded])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const img = imgRef.current
    const scale = Math.min(500 / img.width, 400 / img.height)
    const touch = e.touches ? e.touches[0] : e
    return {
      x: (touch.clientX - rect.left) / scale,
      y: (touch.clientY - rect.top) / scale
    }
  }

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    const pos = getPos(e, canvas)
    isDragging.current = true
    dragStart.current = { mx: pos.x, my: pos.y, cx: crop.x, cy: crop.y }
  }

  const handleMouseMove = (e) => {
    if (!isDragging.current) return
    const canvas = canvasRef.current
    const pos = getPos(e, canvas)
    const img = imgRef.current
    const dx = pos.x - dragStart.current.mx
    const dy = pos.y - dragStart.current.my
    const newX = Math.max(0, Math.min(img.width - crop.size, dragStart.current.cx + dx))
    const newY = Math.max(0, Math.min(img.height - crop.size, dragStart.current.cy + dy))
    setCrop(prev => ({ ...prev, x: newX, y: newY }))
  }

  const handleMouseUp = () => { isDragging.current = false }

  const handleCrop = () => {
    const img = imgRef.current
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = 300
    outputCanvas.height = 300
    outputCanvas.getContext('2d').drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, 300, 300)
    onCrop(outputCanvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-black text-gray-800 dark:text-white">Crop Profile Photo</h3>
            <p className="text-xs text-gray-400 mt-0.5">Drag to reposition • Square crop</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-sm">✕</button>
        </div>
        <div className="p-4">
          <div className="bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: 200 }}>
            {!imgLoaded ? (
              <div className="text-gray-400 text-sm">Loading...</div>
            ) : (
              <canvas ref={canvasRef} style={{ maxWidth: '100%', cursor: 'move', userSelect: 'none' }}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                onTouchStart={e => { e.preventDefault(); handleMouseDown(e) }}
                onTouchMove={e => { e.preventDefault(); handleMouseMove(e) }}
                onTouchEnd={handleMouseUp}
              />
            )}
          </div>
          <div className="mt-3">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              Crop Size: {Math.round(crop.size)}px
            </label>
            <input type="range" min={80} max={imgLoaded ? Math.min(imgRef.current.width, imgRef.current.height) : 300}
              value={crop.size}
              onChange={e => {
                const size = parseInt(e.target.value)
                const img = imgRef.current
                setCrop(prev => ({
                  size,
                  x: Math.max(0, Math.min(img.width - size, prev.x)),
                  y: Math.max(0, Math.min(img.height - size, prev.y)),
                }))
              }}
              className="w-full accent-blue-600"
            />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
          <button onClick={handleCrop} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all">✂️ Apply Crop</button>
        </div>
      </div>
    </div>
  )
}

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your primary school?",
  "What is your favorite childhood movie?",
]

const MAX_PHOTO_SIZE = 300 * 1024

// ─── TEACHER FORM — defined OUTSIDE Teachers component to fix input bug ───
const TeacherFormContent = ({
  formData, updateForm, classInp, setClassInp, type,
  showPass, setShowPass, photoPrev, photoRefEl,
  classOptions, sectionOptions, yearOptions, sessionOptions,
  onAddClass, onRemoveClass, onPhotoChange
}) => (
  <div className="space-y-6">
    {/* Photo */}
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Profile Photo</p>
      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
        <div onClick={() => photoRefEl.current?.click()}
          className="w-20 h-20 rounded-2xl border-2 border-dashed border-blue-400 flex items-center justify-center cursor-pointer overflow-hidden hover:border-blue-600 transition-all flex-shrink-0 bg-white dark:bg-gray-700">
          {photoPrev
            ? <img src={photoPrev} alt="preview" className="w-full h-full object-cover" />
            : <div className="text-center"><div className="text-3xl">📸</div><p className="text-xs text-gray-400 mt-1">Upload</p></div>}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Profile Photo</p>
          <p className="text-xs text-gray-400 mt-0.5">Max: <span className="text-orange-500 font-bold">300KB</span> • JPG/PNG</p>
          <p className="text-xs text-blue-500 mt-1">📐 Crop tool will open after selection</p>
          <button type="button" onClick={() => photoRefEl.current?.click()}
            className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-bold underline underline-offset-2">Choose File</button>
        </div>
        <input ref={photoRefEl} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
      </div>
    </div>

    {/* Basic Info */}
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Basic Information</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Full Name *</label>
          <input type="text" placeholder="Dr. Rajesh Kumar"
            value={formData.name}
            onChange={e => updateForm('name', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {[
          { label: 'Email *', key: 'email', placeholder: 'rajesh@college.edu', type: 'email' },
          { label: 'Phone', key: 'phone', placeholder: '9876543210', type: 'text' },
          { label: 'Subject', key: 'subject', placeholder: 'Mathematics', type: 'text' },
          { label: 'Qualification', key: 'qualification', placeholder: 'M.Tech, PhD', type: 'text' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{f.label}</label>
            <input type={f.type} placeholder={f.placeholder}
              value={formData[f.key]}
              onChange={e => updateForm(f.key, e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
    </div>

    {/* Password */}
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
        {type === 'add' ? 'Set Password' : 'Change Password (optional)'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
            {type === 'add' ? 'Password *' : 'New Password'}
          </label>
          <div className="relative">
            <input type={showPass.password ? 'text' : 'password'} placeholder="Min 6 characters"
              value={formData.password}
              onChange={e => updateForm('password', e.target.value)}
              className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <EyeIcon show={showPass.password} toggle={() => setShowPass(p => ({ ...p, password: !p.password }))} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Confirm Password</label>
          <div className="relative">
            <input type={showPass.confirm ? 'text' : 'password'} placeholder="Re-enter password"
              value={formData.confirmPassword}
              onChange={e => updateForm('confirmPassword', e.target.value)}
              className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <EyeIcon show={showPass.confirm} toggle={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))} />
          </div>
          {formData.confirmPassword && (
            <p className={`text-xs mt-1 font-medium ${formData.password === formData.confirmPassword ? 'text-green-500' : 'text-red-500'}`}>
              {formData.password === formData.confirmPassword ? '✅ Passwords match' : '❌ Do not match'}
            </p>
          )}
        </div>
      </div>
    </div>

    {/* Security Question */}
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Security Question</p>
      <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl">
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">🔒 Used for password recovery verification</p>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Select Question *</label>
          <select value={formData.securityQuestion}
            onChange={e => updateForm('securityQuestion', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Your Answer *</label>
          <input type="text" placeholder="Enter your answer"
            value={formData.securityAnswer}
            onChange={e => updateForm('securityAnswer', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>

    {/* Assigned Classes */}
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Assign Classes</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { key: 'class', opts: classOptions, ph: 'Select Class' },
          { key: 'section', opts: sectionOptions, ph: 'Select Section' },
          { key: 'year', opts: yearOptions, ph: 'Select Year' },
          { key: 'session', opts: sessionOptions, ph: 'Select Session' },
        ].map(f => (
          <select key={f.key} value={classInp[f.key]}
            onChange={e => setClassInp(prev => ({ ...prev, [f.key]: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{f.ph}</option>
            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>
      <button type="button" onClick={onAddClass}
        className="w-full py-2.5 border-2 border-dashed border-blue-400 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all mb-3">
        + Add Class Assignment
      </button>
      {formData.assignedClasses.length > 0 ? (
        <div className="space-y-2">
          {formData.assignedClasses.map((cls, i) => (
            <div key={i} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-lg text-xs font-bold">{cls.class}</span>
                {cls.section && <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Sec: {cls.section}</span>}
                {cls.year && <span className="text-xs text-gray-500">{cls.year}</span>}
                {cls.session && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-400 px-2 py-0.5 rounded">{cls.session}</span>}
              </div>
              <button type="button" onClick={() => onRemoveClass(i)}
                className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center text-xs hover:bg-red-200 transition-all flex-shrink-0 font-bold">✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-400 font-medium">No classes assigned yet</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">Select above and click Add</p>
        </div>
      )}
    </div>
  </div>
)

// ─── MAIN COMPONENT ───
const Teachers = () => {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 })

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSession, setFilterSession] = useState('')

  const [classOptions, setClassOptions] = useState([])
  const [sectionOptions, setSectionOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [sessionOptions, setSessionOptions] = useState([])

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showCropModal, setShowCropModal] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState(null)
  const [cropTarget, setCropTarget] = useState('add')

  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [securityAnswer, setSecurityAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [passwordStep, setPasswordStep] = useState('security')

  const makeEmptyForm = () => ({
    name: '', email: '', password: '', confirmPassword: '', phone: '',
    subject: '', qualification: '', photo: '',
    securityQuestion: SECURITY_QUESTIONS[0], securityAnswer: '',
    assignedClasses: []
  })

  const [form, setForm] = useState(makeEmptyForm())
  const [editForm, setEditForm] = useState(makeEmptyForm())
  const [showFormPass, setShowFormPass] = useState({ password: false, confirm: false })
  const [showEditPass, setShowEditPass] = useState({ password: false, confirm: false })
  const [classInput, setClassInput] = useState({ class: '', section: '', year: '', session: '' })
  const [editClassInput, setEditClassInput] = useState({ class: '', section: '', year: '', session: '' })
  const [photoPreview, setPhotoPreview] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState(null)

  const photoRef = useRef(null)
  const editPhotoRef = useRef(null)
  const token = JSON.parse(localStorage.getItem('user'))?.token

  useEffect(() => {
    fetchTeachers()
    fetchStats()
    fetchStudentOptions()
  }, [])

  const fetchStudentOptions = async () => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/students`, { headers: { Authorization: `Bearer ${token}` } })
      setClassOptions([...new Set(data.map(s => s.class).filter(Boolean))])
      setSectionOptions([...new Set(data.map(s => s.section).filter(Boolean))])
      setYearOptions([...new Set(data.map(s => s.year).filter(Boolean))])
      setSessionOptions([...new Set(data.map(s => s.session).filter(Boolean))])
    } catch (err) { console.log('Options error:', err.message) }
  }

  const fetchTeachers = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/teachers`, { headers: { Authorization: `Bearer ${token}` } })
      setTeachers(data)
    } catch (err) { toast.error('Failed to load teachers!') }
    finally { setLoading(false) }
  }

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/teachers/stats`, { headers: { Authorization: `Bearer ${token}` } })
      setStats(data)
    } catch (err) { console.log('Stats error:', err.message) }
  }

  const handlePhotoFileSelect = (e, type) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_PHOTO_SIZE) {
      toast.error('Photo must be 300KB or less!')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setCropImageSrc(reader.result)
      setCropTarget(type)
      setShowCropModal(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCropDone = (croppedDataUrl) => {
    setShowCropModal(false)
    if (cropTarget === 'add') {
      setPhotoPreview(croppedDataUrl)
      setForm(prev => ({ ...prev, photo: croppedDataUrl }))
    } else {
      setEditPhotoPreview(croppedDataUrl)
      setEditForm(prev => ({ ...prev, photo: croppedDataUrl }))
    }
  }

  const handleAdd = async () => {
    if (!form.name || form.name.trim().length < 2) { toast.error('Name must be at least 2 characters!'); return }
    if (!form.email) { toast.error('Email is required!'); return }
    if (!form.password || form.password.length < 6) { toast.error('Password must be at least 6 characters!'); return }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match!'); return }
    if (!form.securityAnswer.trim()) { toast.error('Security answer is required!'); return }
    try {
      setActionLoading(true)
      const payload = { ...form }
      delete payload.confirmPassword
      await axios.post(`${import.meta.env.VITE_API_URL}/teachers`, payload, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('Teacher added! Welcome email sent. ✉️')
      setShowAddModal(false)
      setForm(makeEmptyForm())
      setPhotoPreview(null)
      setClassInput({ class: '', section: '', year: '', session: '' })
      fetchTeachers(); fetchStats()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error occurred!')
    } finally { setActionLoading(false) }
  }

  const handleUpdate = async () => {
    if (!editForm.name || editForm.name.trim().length < 2) { toast.error('Name must be at least 2 characters!'); return }
    if (editForm.password && editForm.password.length < 6) { toast.error('Password must be at least 6 characters!'); return }
    if (editForm.password && editForm.password !== editForm.confirmPassword) { toast.error('Passwords do not match!'); return }
    try {
      setActionLoading(true)
      const payload = { ...editForm }
      delete payload.confirmPassword
      if (!payload.password) delete payload.password
      await axios.put(`${import.meta.env.VITE_API_URL}/teachers/${selectedTeacher._id}`, payload, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('Teacher updated! Notification email sent. ✉️')
      setShowEditModal(false)
      fetchTeachers(); fetchStats()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error occurred!')
    } finally { setActionLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this teacher? This cannot be undone.')) return
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/teachers/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('Teacher deleted!')
      if (showProfileModal) setShowProfileModal(false)
      fetchTeachers(); fetchStats()
    } catch (err) { toast.error('Delete failed!') }
  }

  const handleToggleStatus = async (teacher) => {
    try {
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/teachers/${teacher._id}/toggle-status`, {}, { headers: { Authorization: `Bearer ${token}` } })
      toast.success(data.message)
      if (showProfileModal) setShowProfileModal(false)
      fetchTeachers(); fetchStats()
    } catch (err) { toast.error('Status update failed!') }
  }

  const handleSecurityCheck = () => {
    if (!securityAnswer.trim()) { toast.error('Please enter security answer!'); return }
    if (!selectedTeacher?.securityAnswer) { setPasswordStep('reset'); return }
    if (securityAnswer.trim().toLowerCase() !== selectedTeacher.securityAnswer.toLowerCase()) {
      toast.error('Incorrect security answer!'); return
    }
    setPasswordStep('reset')
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters!'); return }
    if (newPassword !== confirmNewPassword) { toast.error('Passwords do not match!'); return }
    try {
      setActionLoading(true)
      const { data } = await axios.put(
        `${import.meta.env.VITE_API_URL}/teachers/${selectedTeacher._id}/reset-password`,
        { newPassword }, { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(data.message + ' Email sent! ✉️')
      setShowPasswordModal(false)
      setSecurityAnswer(''); setNewPassword(''); setConfirmNewPassword('')
      setPasswordStep('security')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password reset failed!')
    } finally { setActionLoading(false) }
  }

  const openEdit = (teacher) => {
    setSelectedTeacher(teacher)
    setEditForm({
      name: teacher.name || '', email: teacher.email || '',
      password: '', confirmPassword: '',
      phone: teacher.phone || '', subject: teacher.subject || '',
      qualification: teacher.qualification || '', photo: '',
      securityQuestion: teacher.securityQuestion || SECURITY_QUESTIONS[0],
      securityAnswer: teacher.securityAnswer || '',
      assignedClasses: teacher.assignedClasses ? [...teacher.assignedClasses] : [],
    })
    setEditPhotoPreview(teacher.photo || null)
    setEditClassInput({ class: '', section: '', year: '', session: '' })
    setShowEditPass({ password: false, confirm: false })
    setShowEditModal(true)
  }

  const addClassToForm = (type) => {
    const input = type === 'add' ? classInput : editClassInput
    const setInput = type === 'add' ? setClassInput : setEditClassInput
    const currentClasses = type === 'add' ? form.assignedClasses : editForm.assignedClasses
    if (!input.class) { toast.error('Class is required!'); return }
    if (currentClasses.some(c => c.class === input.class && c.section === input.section)) {
      toast.error('This class-section already added!'); return
    }
    const entry = { class: input.class, section: input.section, year: input.year, session: input.session }
    if (type === 'add') setForm(prev => ({ ...prev, assignedClasses: [...prev.assignedClasses, entry] }))
    else setEditForm(prev => ({ ...prev, assignedClasses: [...prev.assignedClasses, entry] }))
    setInput({ class: '', section: '', year: '', session: '' })
  }

  const removeClassFromForm = (index, type) => {
    if (type === 'add') setForm(prev => ({ ...prev, assignedClasses: prev.assignedClasses.filter((_, i) => i !== index) }))
    else setEditForm(prev => ({ ...prev, assignedClasses: prev.assignedClasses.filter((_, i) => i !== index) }))
  }

  const exportPDF = () => {
    if (filtered.length === 0) { toast.error('No data!'); return }
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(18); doc.setTextColor(37, 99, 235); doc.text('Teachers Report', 14, 18)
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} | Total: ${filtered.length}`, 14, 28)
    autoTable(doc, {
      startY: 34,
      head: [['Name', 'Email', 'Phone', 'Subject', 'Qualification', 'Assigned Classes', 'Status', 'Joined']],
      body: filtered.map(t => [t.name, t.email, t.phone || '-', t.subject || '-', t.qualification || '-', t.assignedClasses?.map(c => `${c.class}${c.section ? `-${c.section}` : ''}`).join(', ') || '-', t.isActive ? 'Active' : 'Inactive', new Date(t.createdAt).toLocaleDateString('en-IN')]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
    const pc = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pc; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Generated by Attendance System • Page ${i} of ${pc}`, 14, doc.internal.pageSize.height - 8) }
    doc.save(`teachers_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`)
    toast.success('PDF exported!')
  }

  const exportExcel = () => {
    if (filtered.length === 0) { toast.error('No data!'); return }
    const exportData = filtered.map((t, i) => ({ 'Sr No': i + 1, 'Name': t.name, 'Email': t.email, 'Phone': t.phone || '-', 'Subject': t.subject || '-', 'Qualification': t.qualification || '-', 'Assigned Classes': t.assignedClasses?.map(c => `${c.class}${c.section ? `-${c.section}` : ''}`).join(', ') || '-', 'Status': t.isActive ? 'Active' : 'Inactive', 'Joined': new Date(t.createdAt).toLocaleDateString('en-IN') }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    ws['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 14 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Teachers')
    XLSX.writeFile(wb, `teachers_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`)
    toast.success('Excel exported!')
  }

  const filtered = teachers.filter(t => {
    const ms = t.name.toLowerCase().includes(search.toLowerCase()) || t.email.toLowerCase().includes(search.toLowerCase()) || (t.subject && t.subject.toLowerCase().includes(search.toLowerCase()))
    const mst = !filterStatus ? true : filterStatus === 'active' ? t.isActive : !t.isActive
    const mc = !filterClass ? true : t.assignedClasses?.some(c => c.class === filterClass)
    const msec = !filterSection ? true : t.assignedClasses?.some(c => c.section === filterSection)
    const my = !filterYear ? true : t.assignedClasses?.some(c => c.year === filterYear)
    const mses = !filterSession ? true : t.assignedClasses?.some(c => c.session === filterSession)
    return ms && mst && mc && msec && my && mses
  })

  const sharedFormProps = (type) => ({
    classOptions, sectionOptions, yearOptions, sessionOptions,
    onAddClass: () => addClassToForm(type),
    onRemoveClass: (i) => removeClassFromForm(i, type),
    onPhotoChange: (e) => handlePhotoFileSelect(e, type),
  })

  return (
    <div>
      {/* Crop Modal */}
      {showCropModal && cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onCrop={handleCropDone}
          onCancel={() => setShowCropModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Teachers</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{stats.total} total · {stats.active} active</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">📊 Excel</button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 border border-red-500 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">📄 PDF</button>
          <button onClick={() => { setForm(makeEmptyForm()); setPhotoPreview(null); setClassInput({ class: '', section: '', year: '', session: '' }); setShowFormPass({ password: false, confirm: false }); setShowAddModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Teacher
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Teachers', value: stats.total, color: 'text-blue-600', bg: 'from-blue-500/10 to-indigo-500/5', border: 'border-blue-200 dark:border-blue-800', icon: '👨‍🏫', sub: 'Registered' },
          { label: 'Active', value: stats.active, color: 'text-emerald-600', bg: 'from-emerald-500/10 to-green-500/5', border: 'border-emerald-200 dark:border-emerald-800', icon: '✅', sub: 'Currently active' },
          { label: 'Inactive', value: stats.inactive, color: 'text-rose-500', bg: 'from-rose-500/10 to-red-500/5', border: 'border-rose-200 dark:border-rose-800', icon: '🚫', sub: 'Deactivated' },
        ].map((card, i) => (
          <div key={i} className={`bg-gradient-to-br ${card.bg} border ${card.border} rounded-2xl p-6 flex items-center justify-between`}>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
              <p className={`text-4xl font-black ${card.color} mb-1`}>{card.value}</p>
              <p className="text-xs text-gray-400">{card.sub}</p>
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border ${card.border} bg-white/60 dark:bg-gray-800/60 shadow-sm`}>{card.icon}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input type="text" placeholder="Search by name, email or subject..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {[
          { v: filterStatus, s: setFilterStatus, opts: ['active', 'inactive'], ph: 'All Status' },
          { v: filterClass, s: setFilterClass, opts: classOptions, ph: 'All Classes' },
          { v: filterSection, s: setFilterSection, opts: sectionOptions, ph: 'All Sections' },
          { v: filterYear, s: setFilterYear, opts: yearOptions, ph: 'All Years' },
          { v: filterSession, s: setFilterSession, opts: sessionOptions, ph: 'All Sessions' },
        ].map((f, i) => (
          <select key={i} value={f.v} onChange={e => f.s(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{f.ph}</option>
            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {(filterStatus || filterClass || filterSection || filterYear || filterSession) && (
          <button onClick={() => { setFilterStatus(''); setFilterClass(''); setFilterSection(''); setFilterYear(''); setFilterSession('') }}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl text-sm hover:bg-gray-200 transition-all">✕ Clear</button>
        )}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading teachers...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">👨‍🏫</div>
          <p className="font-bold text-gray-600 dark:text-gray-300 text-lg">No teachers found!</p>
          <p className="text-sm text-gray-400 mt-1">Add a teacher to get started.</p>
          <button onClick={() => setShowAddModal(true)} className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all">+ Add Teacher</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(teacher => (
            <div key={teacher._id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
              {/* Cover */}
              <div className="relative h-24 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)', backgroundSize: '12px 12px' }} />
                <div className="absolute top-3 right-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-sm ${teacher.isActive ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30' : 'bg-red-500/20 text-red-100 border-red-400/30'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${teacher.isActive ? 'bg-emerald-300 animate-pulse' : 'bg-red-300'}`} />
                    {teacher.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="absolute bottom-3 left-5">
                  <p className="text-white/70 text-xs font-semibold">{teacher.assignedClasses?.length || 0} class{teacher.assignedClasses?.length !== 1 ? 'es' : ''}</p>
                </div>
              </div>

              <div className="px-5 pb-5">
                {/* Avatar row */}
                <div className="flex items-start justify-between -mt-8 mb-3">
                  <div className="flex-shrink-0">
                    {teacher.photo ? (
                      <img src={teacher.photo} alt={teacher.name} className="w-16 h-16 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-lg" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 border-4 border-white dark:border-gray-800 flex items-center justify-center text-white text-xl font-black shadow-lg">
                        {teacher.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-9">
                    <button onClick={() => openEdit(teacher)} title="Edit"
                      className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(teacher._id)} title="Delete"
                      className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-500 border border-red-200 dark:border-red-800 flex items-center justify-center transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>

                <h3 className="font-black text-gray-900 dark:text-white text-base leading-tight">{teacher.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{teacher.email}</p>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {teacher.subject && <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold">📚 {teacher.subject}</span>}
                  {teacher.qualification && <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold">🎓 {teacher.qualification}</span>}
                  {teacher.phone && <span className="px-2.5 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg text-xs">📱 {teacher.phone}</span>}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assigned Classes</p>
                  {teacher.assignedClasses?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {teacher.assignedClasses.map((cls, i) => (
                        <span key={i} className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold">
                          {cls.class}{cls.section ? ` - ${cls.section}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-400 italic">No classes assigned</p>}
                </div>

                <button onClick={() => { setSelectedTeacher(teacher); setShowProfileModal(true) }}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Full Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ADD MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div>
                <h3 className="text-base font-black text-gray-800 dark:text-white">Add New Teacher</h3>
                <p className="text-xs text-gray-400">Photo max 300KB • Welcome email will be sent</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <TeacherFormContent
                formData={form}
                updateForm={(key, val) => setForm(prev => ({ ...prev, [key]: val }))}
                classInp={classInput} setClassInp={setClassInput}
                type="add" showPass={showFormPass} setShowPass={setShowFormPass}
                photoPrev={photoPreview} photoRefEl={photoRef}
                {...sharedFormProps('add')}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">Cancel</button>
              <button onClick={handleAdd} disabled={actionLoading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all">
                {actionLoading ? '⏳ Adding...' : '+ Add Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {showEditModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div>
                <h3 className="text-base font-black text-gray-800 dark:text-white">Edit Teacher</h3>
                <p className="text-xs text-gray-400">{selectedTeacher.name} • Update email will be sent</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <TeacherFormContent
                formData={editForm}
                updateForm={(key, val) => setEditForm(prev => ({ ...prev, [key]: val }))}
                classInp={editClassInput} setClassInp={setEditClassInput}
                type="edit" showPass={showEditPass} setShowPass={setShowEditPass}
                photoPrev={editPhotoPreview} photoRefEl={editPhotoRef}
                {...sharedFormProps('edit')}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">Cancel</button>
              <button onClick={handleUpdate} disabled={actionLoading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all">
                {actionLoading ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {showProfileModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="h-32 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative flex-shrink-0">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)', backgroundSize: '12px 12px' }} />
              <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm transition-all">✕</button>
              <div className="absolute bottom-4 left-6">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-sm ${selectedTeacher.isActive ? 'bg-emerald-500/25 text-emerald-100 border-emerald-400/40' : 'bg-red-500/25 text-red-100 border-red-400/40'}`}>
                  <span className={`w-2 h-2 rounded-full ${selectedTeacher.isActive ? 'bg-emerald-300 animate-pulse' : 'bg-red-300'}`} />
                  {selectedTeacher.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 pb-6">
              <div className="-mt-12 mb-5 flex items-end justify-between">
                <div>
                  {selectedTeacher.photo ? (
                    <img src={selectedTeacher.photo} alt={selectedTeacher.name} className="w-24 h-24 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-2xl" />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 border-4 border-white dark:border-gray-800 flex items-center justify-center text-white text-4xl font-black shadow-2xl">
                      {selectedTeacher.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{selectedTeacher.name}</h2>
              <p className="text-sm text-gray-400 mt-1">{selectedTeacher.email}</p>

              <div className="flex flex-wrap gap-2 mt-3">
                {selectedTeacher.subject && <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold">📚 {selectedTeacher.subject}</span>}
                {selectedTeacher.qualification && <span className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold">🎓 {selectedTeacher.qualification}</span>}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'Phone', value: selectedTeacher.phone || 'Not provided', icon: '📱' },
                  { label: 'Joined', value: new Date(selectedTeacher.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), icon: '📅' },
                  { label: 'Classes', value: `${selectedTeacher.assignedClasses?.length || 0} assigned`, icon: '🏫' },
                  { label: 'Status', value: selectedTeacher.isActive ? '● Active' : '● Inactive', icon: '🔘' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">{item.icon} {item.label}</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assigned Classes</p>
                {selectedTeacher.assignedClasses?.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTeacher.assignedClasses.map((cls, i) => (
                      <div key={i} className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-black flex-shrink-0">{cls.class?.charAt(0)}</div>
                        <div>
                          <p className="text-sm font-black text-indigo-800 dark:text-indigo-200">{cls.class}{cls.section ? ` - ${cls.section}` : ''}</p>
                          <p className="text-xs text-indigo-500 dark:text-indigo-400">{[cls.year, cls.session].filter(Boolean).join(' • ') || 'No year/session'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-400">No classes assigned</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5">
                <button onClick={() => { setShowProfileModal(false); setShowPasswordModal(true); setSecurityAnswer(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordStep('security') }}
                  className="col-span-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all">
                  🔐 Reset Password
                </button>
                <button onClick={() => handleToggleStatus(selectedTeacher)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedTeacher.isActive ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-600 hover:bg-orange-100' : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100'}`}>
                  {selectedTeacher.isActive ? '🚫 Deactivate' : '✅ Activate'}
                </button>
                <button onClick={() => handleDelete(selectedTeacher._id)}
                  className="py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-500 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold transition-all">
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {showPasswordModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-black text-gray-800 dark:text-white">Reset Password</h3>
                <p className="text-xs text-gray-400">{selectedTeacher.name}</p>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-sm">✕</button>
            </div>

            <div className="flex items-center mb-5">
              {['Security Check', 'New Password'].map((step, i) => (
                <div key={i} className="flex items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${(i === 0 && passwordStep === 'security') || (i === 1 && passwordStep === 'reset') ? 'bg-blue-600 text-white shadow-md' : i === 0 && passwordStep === 'reset' ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                    {i === 0 && passwordStep === 'reset' ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs font-semibold ml-1.5 ${(i === 0 && passwordStep === 'security') || (i === 1 && passwordStep === 'reset') ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{step}</span>
                  {i === 0 && <div className="flex-1 mx-2 h-0.5 bg-gray-200 dark:bg-gray-700 rounded" />}
                </div>
              ))}
            </div>

            {passwordStep === 'security' ? (
              <div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">🔒 Identity Verification</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Answer security question to proceed.</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-4 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-400 mb-1">Question:</p>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{selectedTeacher.securityQuestion || 'No security question set'}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Your Answer</label>
                  <input type="text" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSecurityCheck()}
                    placeholder="Enter your answer"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                  <button onClick={handleSecurityCheck} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all">Verify →</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 mb-4">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">✅ Verified! Set new password below.</p>
                </div>
                <div className="space-y-3 mb-4">
                  {[
                    { label: 'New Password', val: newPassword, set: setNewPassword, show: showNewPass, toggle: () => setShowNewPass(p => !p) },
                    { label: 'Confirm Password', val: confirmNewPassword, set: setConfirmNewPassword, show: showConfirmPass, toggle: () => setShowConfirmPass(p => !p) },
                  ].map((f, i) => (
                    <div key={i}>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{f.label}</label>
                      <div className="relative">
                        <input type={f.show ? 'text' : 'password'} value={f.val} onChange={e => f.set(e.target.value)} placeholder="Min 6 characters"
                          className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <EyeIcon show={f.show} toggle={f.toggle} />
                      </div>
                    </div>
                  ))}
                  {confirmNewPassword && (
                    <p className={`text-xs font-medium ${newPassword === confirmNewPassword ? 'text-emerald-500' : 'text-red-500'}`}>
                      {newPassword === confirmNewPassword ? '✅ Passwords match' : '❌ Do not match'}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setPasswordStep('security')} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all">← Back</button>
                  <button onClick={handleResetPassword} disabled={actionLoading} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all">
                    {actionLoading ? '⏳...' : '🔐 Reset'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Teachers