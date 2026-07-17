import { useState } from 'react'
import axios from 'axios'
import toast  from 'react-hot-toast'

const SProfile = ({ student, setStudent, dark }) => {
  const [editing, setEditing]       = useState(false)
  const [phone, setPhone]           = useState(student?.phone || '')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoBase64, setPhotoBase64]   = useState(null)
  const [saving, setSaving]         = useState(false)

  // Password change state
  const [showPwForm, setShowPwForm] = useState(false)
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [pwSaving, setPwSaving]     = useState(false)

  const token = student?.token

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be less than 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoPreview(reader.result)
      setPhotoBase64(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async () => {
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Enter a valid 10-digit Indian phone number!')
      return
    }
    setSaving(true)
    try {
      const payload = { phone }
      if (photoBase64) payload.photo = photoBase64

      const { data } = await axios.put(
        `${import.meta.env.VITE_API_URL}/students/me/profile`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Update stored student data
      const updated = { ...student, phone: data.phone, photo: data.photo || student.photo }
      setStudent(updated)
      localStorage.setItem('student', JSON.stringify(updated))
      toast.success('Profile updated!')
      setEditing(false)
      setPhotoPreview(null)
      setPhotoBase64(null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { toast.error('All fields are required!'); return }
    if (newPw.length < 6) { toast.error('New password must be at least 6 characters!'); return }
    if (newPw !== confirmPw) { toast.error('Passwords do not match!'); return }
    setPwSaving(true)
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/auth/change-password`,
        { currentPassword: currentPw, newPassword: newPw },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Password changed successfully!')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setShowPwForm(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to change password.')
    } finally {
      setPwSaving(false)
    }
  }

  const currentPhoto = photoPreview || student?.photo

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-gray-800 dark:text-white">👤 My Profile</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Manage your personal information
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">

        {/* Gradient header */}
        <div className="h-28 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 relative">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage:'repeating-linear-gradient(45deg,white 0,white 1px,transparent 0,transparent 50%)', backgroundSize:'14px 14px' }} />
        </div>

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="relative">
              {currentPhoto
                ? <img src={currentPhoto} alt={student.name}
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-lg" />
                : <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600
                    border-4 border-white dark:border-gray-800 shadow-lg flex items-center
                    justify-center text-white text-3xl font-black">
                    {student?.name?.charAt(0)}
                  </div>
              }
              {editing && (
                <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 hover:bg-emerald-600
                  rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-all">
                  <span className="text-white text-xs">📷</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              )}
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="h-9 px-4 rounded-xl border border-emerald-300 dark:border-emerald-700
                  text-emerald-600 dark:text-emerald-400 text-sm font-bold bg-white dark:bg-gray-800
                  hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                ✏️ Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setPhone(student?.phone||''); setPhotoPreview(null); setPhotoBase64(null) }}
                  className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                  Cancel
                </button>
                <button onClick={handleSaveProfile} disabled={saving}
                  className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-black hover:opacity-90 disabled:opacity-50 shadow-md transition-all">
                  {saving ? 'Saving...' : '✓ Save'}
                </button>
              </div>
            )}
          </div>

          {/* Name + badges */}
          <h3 className="text-xl font-black text-gray-900 dark:text-white">{student?.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-black rounded-lg">
              Roll: {student?.rollNo}
            </span>
            <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-black rounded-lg">
              {student?.class}{student?.section?`-${student.section}`:''}
            </span>
            {student?.year && (
              <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-black rounded-lg">
                Year {student.year}
              </span>
            )}
            <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-black rounded-lg flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Personal Details */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <h4 className="text-sm font-black text-gray-700 dark:text-gray-200 mb-4">📋 Personal Details</h4>
        <div className="space-y-3">
          {/* Email — read only */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-base flex-shrink-0">📧</div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase leading-none">Email</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-0.5">
                  {student?.email || 'Not provided'}
                </p>
              </div>
            </div>
            <span className="text-[10px] text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg font-bold">Read only</span>
          </div>

          {/* Phone — editable */}
          <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-base flex-shrink-0">📞</div>
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-0.5">Phone</p>
                {editing ? (
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="Enter 10-digit phone number"
                    maxLength={10}
                    className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                ) : (
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {student?.phone || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Academic Details — read only */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black text-gray-700 dark:text-gray-200">🎓 Academic Details</h4>
          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg font-bold">Admin controlled</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Class',   student?.class   || '—'],
            ['Section', student?.section || '—'],
            ['Year',    student?.year    || '—'],
            ['Session', student?.session || '—'],
            ['Roll No', student?.rollNo  || '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2.5 border border-indigo-100 dark:border-indigo-800">
              <p className="text-[10px] text-indigo-400 font-bold uppercase leading-none">{label}</p>
              <p className="text-sm font-black text-gray-800 dark:text-white mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black text-gray-700 dark:text-gray-200">🔐 Change Password</h4>
          <button onClick={() => setShowPwForm(p => !p)}
            className="text-xs text-emerald-500 hover:text-emerald-600 font-bold transition-colors">
            {showPwForm ? 'Cancel' : 'Change →'}
          </button>
        </div>

        {!showPwForm ? (
          <p className="text-xs text-gray-400">Default password is your Roll Number. Change it to something secure.</p>
        ) : (
          <div className="space-y-3">
            {[
              { label:'Current Password', value:currentPw, setter:setCurrentPw },
              { label:'New Password',     value:newPw,     setter:setNewPw },
              { label:'Confirm Password', value:confirmPw, setter:setConfirmPw },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">{label}</label>
                <input type="password" value={value} onChange={e => setter(e.target.value)}
                  placeholder={label}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600
                    bg-white dark:bg-gray-700 text-gray-700 dark:text-white text-sm
                    focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            ))}
            <button onClick={handleChangePassword} disabled={pwSaving}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl
                text-sm font-black hover:opacity-90 disabled:opacity-50 shadow-md transition-all mt-2">
              {pwSaving ? 'Updating...' : '🔐 Update Password'}
            </button>
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-xs text-gray-400 text-center">
          For any changes to your academic details, please contact your class teacher or admin.
          Your roll number is your default login password.
        </p>
      </div>
    </div>
  )
}

export default SProfile