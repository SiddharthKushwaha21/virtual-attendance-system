import { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const EyeIcon = ({ show, toggle }) => (
  <button type="button" onClick={toggle}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors">
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

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your primary school?",
  "What is your favorite childhood movie?",
]

const Toggle = ({ checked, onChange }) => (
  <button type="button" onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
)

const TSettings = ({ user, setUser, dark, setDark }) => {
  const [activeTab, setActiveTab] = useState('profile')
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [securityForm, setSecurityForm] = useState({
    currentAnswer: '',
    newQuestion: user?.securityQuestion || SECURITY_QUESTIONS[0],
    newAnswer: '',
  })
  const [securityLoading, setSecurityLoading] = useState(false)
  const [notifications, setNotifications] = useState({
    lowAttendance: true,
    dailySummary: true,
    markingReminder: false,
    emailAlerts: true,
  })

  const token = JSON.parse(localStorage.getItem('user'))?.token

  const handleProfileUpdate = async () => {
    if (!profileForm.name || profileForm.name.trim().length < 2) { toast.error('Name must be at least 2 chars!'); return }
    try {
      setProfileLoading(true)
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/profile`, profileForm, { headers: { Authorization: `Bearer ${token}` } })
      const updated = { ...user, name: data.name, email: data.email }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      toast.success('✅ Profile updated successfully!')
    } catch (err) { toast.error(err.response?.data?.message || 'Error!') }
    finally { setProfileLoading(false) }
  }

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) { toast.error('All fields required!'); return }
    if (passwordForm.newPassword.length < 6) { toast.error('Min 6 characters!'); return }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match!'); return }
    try {
      setPasswordLoading(true)
      await axios.put(`${import.meta.env.VITE_API_URL}/auth/change-password`,
        { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('🔐 Password changed!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) { toast.error(err.response?.data?.message || 'Error!') }
    finally { setPasswordLoading(false) }
  }

  const handleSecurityUpdate = async () => {
    if (!securityForm.currentAnswer.trim()) { toast.error('Enter current security answer!'); return }
    if (securityForm.currentAnswer.trim().toLowerCase() !== (user?.securityAnswer || '').toLowerCase()) {
      toast.error('Current security answer is incorrect!')
      return
    }
    if (!securityForm.newAnswer.trim()) { toast.error('Enter new security answer!'); return }
    try {
      setSecurityLoading(true)
      await axios.put(`${import.meta.env.VITE_API_URL}/auth/profile`,
        { ...profileForm, securityQuestion: securityForm.newQuestion, securityAnswer: securityForm.newAnswer },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const updated = { ...user, securityQuestion: securityForm.newQuestion, securityAnswer: securityForm.newAnswer }
      localStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      toast.success('🛡️ Security question updated!')
      setSecurityForm({ currentAnswer: '', newQuestion: SECURITY_QUESTIONS[0], newAnswer: '' })
    } catch (err) { toast.error(err.response?.data?.message || 'Error!') }
    finally { setSecurityLoading(false) }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'password', label: 'Password', icon: '🔐' },
    { id: 'security', label: 'Security', icon: '🛡️' },
    { id: 'classes', label: 'My Classes', icon: '🏫' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-black text-gray-800 dark:text-white">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your profile and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0 space-y-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-2 space-y-1 shadow-sm">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* User card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 text-center shadow-sm">
            {user?.photo ? (
              <img src={user.photo} className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3 shadow-md" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black mx-auto mb-3 shadow-md">
                {user?.name?.charAt(0) || 'T'}
              </div>
            )}
            <p className="text-sm font-black text-gray-800 dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
            <div className="flex flex-col gap-1 mt-2.5">
              <span className="px-2.5 py-1 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-black">
                👨‍🏫 Teacher
              </span>
            </div>
            {user?.subject && <p className="text-xs text-gray-400 mt-2 font-medium">📚 {user.subject}</p>}
            {user?.qualification && <p className="text-xs text-gray-400 font-medium">🎓 {user.qualification}</p>}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">

          {/* ── PROFILE ── */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xl shadow-sm">👤</div>
                <div>
                  <h3 className="text-sm font-black text-gray-800 dark:text-white">Profile Settings</h3>
                  <p className="text-xs text-gray-400">Update your display name and email address</p>
                </div>
              </div>

              {/* Avatar preview */}
              <div className="flex items-center gap-5 mb-6 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                {user?.photo ? (
                  <img src={user.photo} className="w-20 h-20 rounded-2xl object-cover shadow-lg flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-lg flex-shrink-0">
                    {user?.name?.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-black text-gray-800 dark:text-white text-base">{user?.name}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {user?.subject && <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-black border border-blue-200 dark:border-blue-800">📚 {user.subject}</span>}
                    {user?.qualification && <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-black border border-purple-200 dark:border-purple-800">🎓 {user.qualification}</span>}
                    {user?.phone && <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium">📱 {user.phone}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-bold">Active Account</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Full Name</label>
                  <input type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Email Address</label>
                  <input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <button onClick={handleProfileUpdate} disabled={profileLoading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl text-sm font-black disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/25">
                  {profileLoading ? '⏳ Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ── PASSWORD ── */}
          {activeTab === 'password' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xl shadow-sm">🔐</div>
                <div>
                  <h3 className="text-sm font-black text-gray-800 dark:text-white">Change Password</h3>
                  <p className="text-xs text-gray-400">Keep your account secure with a strong password</p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-5">
                <p className="text-xs font-black text-amber-700 dark:text-amber-300 mb-2">💡 Password Security Tips</p>
                <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                  <li>• Use at least 6 characters</li>
                  <li>• Mix uppercase, lowercase, numbers & symbols</li>
                  <li>• Never share your password with anyone</li>
                  <li>• Use a unique password for this account</li>
                </ul>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Current Password', key: 'currentPassword', sk: 'current', ph: 'Enter current password' },
                  { label: 'New Password', key: 'newPassword', sk: 'new', ph: 'Minimum 6 characters' },
                  { label: 'Confirm New Password', key: 'confirmPassword', sk: 'confirm', ph: 'Re-enter new password' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{field.label}</label>
                    <div className="relative">
                      <input type={showPass[field.sk] ? 'text' : 'password'} placeholder={field.ph}
                        value={passwordForm[field.key]}
                        onChange={e => setPasswordForm({ ...passwordForm, [field.key]: e.target.value })}
                        className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      />
                      <EyeIcon show={showPass[field.sk]} toggle={() => setShowPass(prev => ({ ...prev, [field.sk]: !prev[field.sk] }))} />
                    </div>
                    {field.key === 'confirmPassword' && passwordForm.confirmPassword && (
                      <p className={`text-xs mt-1.5 font-black ${passwordForm.newPassword === passwordForm.confirmPassword ? 'text-green-500' : 'text-red-500'}`}>
                        {passwordForm.newPassword === passwordForm.confirmPassword ? '✅ Passwords match' : '❌ Do not match'}
                      </p>
                    )}
                  </div>
                ))}
                <button onClick={handlePasswordChange} disabled={passwordLoading}
                  className="w-full py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:opacity-90 text-white rounded-xl text-sm font-black disabled:opacity-50 transition-all shadow-lg shadow-red-500/25">
                  {passwordLoading ? '⏳ Changing...' : '🔐 Change Password'}
                </button>
              </div>
            </div>
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl shadow-sm">🛡️</div>
                <div>
                  <h3 className="text-sm font-black text-gray-800 dark:text-white">Security Question</h3>
                  <p className="text-xs text-gray-400">Used for identity verification during password reset</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-5">
                <p className="text-xs font-black text-blue-700 dark:text-blue-300 mb-2">Current Security Question:</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-bold">{user?.securityQuestion || 'Not set — please set one below'}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Verify — Current Answer *</label>
                  <input type="text" placeholder="Enter your current security answer"
                    value={securityForm.currentAnswer}
                    onChange={e => setSecurityForm({ ...securityForm, currentAnswer: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">New Security Question</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Select Question *</label>
                      <select value={securityForm.newQuestion}
                        onChange={e => setSecurityForm({ ...securityForm, newQuestion: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                        {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">New Answer *</label>
                      <input type="text" placeholder="Enter your new answer"
                        value={securityForm.newAnswer}
                        onChange={e => setSecurityForm({ ...securityForm, newAnswer: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button onClick={handleSecurityUpdate} disabled={securityLoading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white rounded-xl text-sm font-black disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25">
                  {securityLoading ? '⏳ Updating...' : '🛡️ Update Security Question'}
                </button>
              </div>
            </div>
          )}

          {/* ── MY CLASSES ── */}
          {activeTab === 'classes' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xl shadow-sm">🏫</div>
                <div>
                  <h3 className="text-sm font-black text-gray-800 dark:text-white">My Assigned Classes</h3>
                  <p className="text-xs text-gray-400">{user?.assignedClasses?.length || 0} classes assigned by admin</p>
                </div>
              </div>

              {/* Teacher Info */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: 'Subject', value: user?.subject || 'Not set', icon: '📚' },
                  { label: 'Qualification', value: user?.qualification || 'Not set', icon: '🎓' },
                  { label: 'Phone', value: user?.phone || 'Not set', icon: '📱' },
                  { label: 'Joined', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A', icon: '📅' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 mb-1.5 font-medium">{item.icon} {item.label}</p>
                    <p className="text-sm font-black text-gray-700 dark:text-gray-200">{item.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Assigned Classes</p>
              {user?.assignedClasses?.length > 0 ? (
                <div className="space-y-3">
                  {user.assignedClasses.map((cls, i) => (
                    <div key={i} className="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-5 py-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg flex-shrink-0">
                        {cls.class?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-indigo-800 dark:text-indigo-200 text-lg">{cls.class}{cls.section ? ` — Section ${cls.section}` : ''}</p>
                        <div className="flex gap-2 flex-wrap mt-1">
                          {cls.year && <span className="px-2 py-0.5 bg-white/70 dark:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-700">{cls.year}</span>}
                          {cls.session && <span className="px-2 py-0.5 bg-white/70 dark:bg-gray-700/50 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-700">{cls.session}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-green-600 dark:text-green-400 font-black">Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-600">
                  <div className="text-4xl mb-3">🏫</div>
                  <p className="font-black text-gray-500 dark:text-gray-400">No classes assigned yet</p>
                  <p className="text-xs text-gray-400 mt-1">Contact admin to assign classes to you</p>
                </div>
              )}
            </div>
          )}

          {/* ── PREFERENCES ── */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Appearance */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl shadow-sm">🎨</div>
                  <div>
                    <h3 className="text-sm font-black text-gray-800 dark:text-white">Appearance</h3>
                    <p className="text-xs text-gray-400">Customize your visual experience</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 dark:from-yellow-400 dark:to-amber-500 flex items-center justify-center text-xl shadow-sm">
                      {dark ? '☀️' : '🌙'}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-700 dark:text-gray-200">{dark ? 'Dark Mode Active' : 'Light Mode Active'}</p>
                      <p className="text-xs text-gray-400">Click toggle to switch theme</p>
                    </div>
                  </div>
                  <Toggle checked={dark} onChange={(v) => setDark && setDark(v)} />
                </div>
              </div>

              {/* Notifications */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="w-11 h-11 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-xl shadow-sm">🔔</div>
                  <div>
                    <h3 className="text-sm font-black text-gray-800 dark:text-white">Notification Preferences</h3>
                    <p className="text-xs text-gray-400">Control which alerts you receive</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { key: 'lowAttendance', label: 'Low Attendance Alerts', desc: 'When students fall below 75% threshold', icon: '⚠️' },
                    { key: 'dailySummary', label: 'Daily Summary', desc: 'End-of-day attendance summary report', icon: '📊' },
                    { key: 'markingReminder', label: 'Marking Reminder', desc: 'Reminder to mark attendance daily', icon: '📋' },
                    { key: 'emailAlerts', label: 'Email Notifications', desc: 'Receive alerts via email address', icon: '📧' },
                  ].map(pref => (
                    <div key={pref.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-600 flex items-center justify-center text-lg shadow-sm flex-shrink-0">{pref.icon}</div>
                        <div>
                          <p className="text-sm font-black text-gray-700 dark:text-gray-200">{pref.label}</p>
                          <p className="text-xs text-gray-400">{pref.desc}</p>
                        </div>
                      </div>
                      <Toggle checked={notifications[pref.key]} onChange={(v) => setNotifications(prev => ({ ...prev, [pref.key]: v }))} />
                    </div>
                  ))}
                </div>
                <button onClick={() => toast.success('✅ Preferences saved!')}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-500/25">
                  💾 Save Preferences
                </button>
              </div>

              {/* Account Info */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl shadow-sm">ℹ️</div>
                  <div>
                    <h3 className="text-sm font-black text-gray-800 dark:text-white">Account Information</h3>
                    <p className="text-xs text-gray-400">Your account details and system info</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Account Type', value: 'Teacher', icon: '👨‍🏫' },
                    { label: 'Account Status', value: user?.isActive ? '● Active' : '● Inactive', icon: '🔘' },
                    { label: 'Assigned Classes', value: `${user?.assignedClasses?.length || 0} class${user?.assignedClasses?.length !== 1 ? 'es' : ''}`, icon: '🏫' },
                    { label: 'System Version', value: 'Attendance v1.0', icon: '🖥️' },
                  ].map((item, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-400 mb-1.5 font-medium">{item.icon} {item.label}</p>
                      <p className="text-sm font-black text-gray-700 dark:text-gray-200">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TSettings