import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const EyeIcon = ({ show, toggle }) => (
  <button type="button" onClick={toggle}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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

const categoryConfig = {
  Student: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
  Attendance: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' },
  Auth: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', dot: 'bg-purple-500' },
  System: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', dot: 'bg-gray-500' },
}

const actionIcons = {
  STUDENT_ADD: '➕', STUDENT_EDIT: '✏️', STUDENT_DELETE: '🗑️', BULK_IMPORT: '📊',
  ATTENDANCE_MARK: '✅', ATTENDANCE_UPDATE: '🔄',
  LOGIN: '🔑', LOGOUT: '🚪', LOGIN_FAILED: '⚠️',
  USER_REGISTER: '👤', PROFILE_UPDATE: '📝', PASSWORD_CHANGE: '🔐',
  FACE_REGISTER: '🤖',
}

const Settings = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  const token = user?.token

  const [activeTab, setActiveTab] = useState('profile')

  // Profile states
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '' })
  const [profileLoading, setProfileLoading] = useState(false)

  // Password states
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false })
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Activity Log states
  const [logs, setLogs] = useState([])
  const [logStats, setLogStats] = useState(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logFilter, setLogFilter] = useState({ category: '', action: '', startDate: '', endDate: '' })
  const [logPage, setLogPage] = useState(1)
  const [logTotal, setLogTotal] = useState(0)
  const [logTotalPages, setLogTotalPages] = useState(1)
  const LOG_LIMIT = 20

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchLogs()
      fetchLogStats()
    }
  }, [activeTab, logPage, logFilter])

  const fetchLogs = async () => {
    try {
      setLogsLoading(true)
      const params = new URLSearchParams({
        limit: LOG_LIMIT,
        page: logPage,
        ...(logFilter.category && { category: logFilter.category }),
        ...(logFilter.action && { action: logFilter.action }),
        ...(logFilter.startDate && { startDate: logFilter.startDate }),
        ...(logFilter.endDate && { endDate: logFilter.endDate }),
      })
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/activity?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setLogs(data.logs)
      setLogTotal(data.total)
      setLogTotalPages(data.totalPages)
    } catch (err) {
      toast.error('Failed to load activity logs!')
    } finally {
      setLogsLoading(false)
    }
  }

  const fetchLogStats = async () => {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/activity/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setLogStats(data)
    } catch (err) {
      console.log('Stats error:', err.message)
    }
  }

  const clearOldLogs = async () => {
    if (!window.confirm('Delete all logs older than 30 days?')) return
    try {
      const { data } = await axios.delete(
        `${import.meta.env.VITE_API_URL}/activity/clear-old`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(data.message)
      fetchLogs()
      fetchLogStats()
    } catch (err) {
      toast.error('Failed to clear logs!')
    }
  }

  const exportLogs = () => {
    if (logs.length === 0) { toast.error('No logs to export!'); return }
    const exportData = logs.map((log, i) => ({
      'Sr No': i + 1,
      'Action': log.action,
      'Category': log.category,
      'Description': log.description,
      'Performed By': log.performedByName || log.performedBy?.name || '-',
      'Target': log.targetName || '-',
      'IP Address': log.ip || '-',
      'Date': new Date(log.createdAt).toLocaleDateString('en-IN'),
      'Time': new Date(log.createdAt).toLocaleTimeString('en-IN'),
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    ws['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 50 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs')
    XLSX.writeFile(wb, `activity_logs_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`)
    toast.success('Logs exported successfully!')
  }

  const handleProfileUpdate = async () => {
    if (!profileForm.name) { toast.error('Name is required!'); return }
    try {
      setProfileLoading(true)
      const { data } = await axios.put(
        `${import.meta.env.VITE_API_URL}/auth/profile`,
        profileForm,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const updatedUser = { ...user, name: data.name, email: data.email }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      toast.success('Profile updated successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error occurred!')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) { toast.error('All fields are required!'); return }
    if (passwordForm.newPassword.length < 6) { toast.error('New password must be at least 6 characters!'); return }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match!'); return }
    try {
      setPasswordLoading(true)
      await axios.put(
        `${import.meta.env.VITE_API_URL}/auth/change-password`,
        { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Password changed successfully!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error occurred!')
    } finally {
      setPasswordLoading(false)
    }
  }

  const tabs = [
    { id: 'profile', label: '👤 Profile', icon: '👤' },
    { id: 'password', label: '🔐 Password', icon: '🔐' },
    { id: 'activity', label: '📋 Activity Log', icon: '📋' },
    { id: 'system', label: 'ℹ️ System', icon: 'ℹ️' },
  ]

  const timeAgo = (date) => {
    const now = new Date()
    const d = new Date(date)
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your profile and system preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-2 space-y-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                <span>{tab.icon}</span>
                <span>{tab.label.split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
          </div>

          {/* User Card */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
            <span className="mt-2 inline-block px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold capitalize">
              {user?.role || 'Admin'}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-lg">👤</div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white">Profile Settings</h3>
                  <p className="text-xs text-gray-400">Update your name and email address</p>
                </div>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">{user?.name}</p>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                  <span className="mt-1 inline-block px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                    ● Active
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Full Name</label>
                  <input type="text" value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Email Address</label>
                  <input type="email" value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
                <button onClick={handleProfileUpdate} disabled={profileLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {profileLoading ? (
                    <><span className="animate-spin">⏳</span> Updating...</>
                  ) : (
                    <><span>💾</span> Save Changes</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── PASSWORD TAB ── */}
          {activeTab === 'password' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 text-lg">🔐</div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white">Change Password</h3>
                  <p className="text-xs text-gray-400">Keep your account secure with a strong password</p>
                </div>
              </div>

              {/* Password Strength Tips */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-5">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">💡 Password Tips</p>
                <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                  <li>• At least 6 characters long</li>
                  <li>• Mix of letters, numbers and symbols</li>
                  <li>• Avoid common passwords</li>
                </ul>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Current Password', key: 'currentPassword', showKey: 'current', placeholder: 'Enter current password' },
                  { label: 'New Password', key: 'newPassword', showKey: 'new', placeholder: 'Enter new password' },
                  { label: 'Confirm New Password', key: 'confirmPassword', showKey: 'confirm', placeholder: 'Confirm new password' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{field.label}</label>
                    <div className="relative">
                      <input
                        type={showPass[field.showKey] ? 'text' : 'password'}
                        value={passwordForm[field.key]}
                        onChange={(e) => setPasswordForm({ ...passwordForm, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                      />
                      <EyeIcon show={showPass[field.showKey]} toggle={() => setShowPass({ ...showPass, [field.showKey]: !showPass[field.showKey] })} />
                    </div>
                    {/* Password match indicator */}
                    {field.key === 'confirmPassword' && passwordForm.confirmPassword && (
                      <p className={`text-xs mt-1 ${passwordForm.newPassword === passwordForm.confirmPassword ? 'text-green-500' : 'text-red-500'}`}>
                        {passwordForm.newPassword === passwordForm.confirmPassword ? '✅ Passwords match' : '❌ Passwords do not match'}
                      </p>
                    )}
                  </div>
                ))}
                <button onClick={handlePasswordChange} disabled={passwordLoading}
                  className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {passwordLoading ? (
                    <><span className="animate-spin">⏳</span> Changing...</>
                  ) : (
                    <><span>🔐</span> Change Password</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── ACTIVITY LOG TAB ── */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              {/* Stats Row */}
              {logStats && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Logs', value: logStats.totalLogs, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: '📋' },
                    { label: "Today's Activity", value: logStats.todayLogs, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: '📅' },
                    { label: 'Categories', value: logStats.categoryStats?.length || 0, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', icon: '🏷️' },
                  ].map((card, i) => (
                    <div key={i} className={`${card.bg} border ${card.border} rounded-2xl p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{card.label}</p>
                        <span className="text-lg">{card.icon}</span>
                      </div>
                      <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Filters + Actions */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white">Activity Log</h3>
                  <div className="flex gap-2">
                    <button onClick={exportLogs}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500 text-green-600 rounded-lg text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">
                      📊 Export Excel
                    </button>
                    <button onClick={clearOldLogs}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                      🗑️ Clear Old
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  <select value={logFilter.category}
                    onChange={(e) => { setLogFilter(prev => ({ ...prev, category: e.target.value })); setLogPage(1) }}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Categories</option>
                    <option value="Student">Student</option>
                    <option value="Attendance">Attendance</option>
                    <option value="Auth">Auth</option>
                    <option value="System">System</option>
                  </select>
                  <select value={logFilter.action}
                    onChange={(e) => { setLogFilter(prev => ({ ...prev, action: e.target.value })); setLogPage(1) }}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All Actions</option>
                    <option value="STUDENT_ADD">Student Add</option>
                    <option value="STUDENT_EDIT">Student Edit</option>
                    <option value="STUDENT_DELETE">Student Delete</option>
                    <option value="BULK_IMPORT">Bulk Import</option>
                    <option value="ATTENDANCE_MARK">Attendance Mark</option>
                    <option value="ATTENDANCE_UPDATE">Attendance Update</option>
                    <option value="LOGIN">Login</option>
                    <option value="LOGOUT">Logout</option>
                    <option value="LOGIN_FAILED">Login Failed</option>
                    <option value="PASSWORD_CHANGE">Password Change</option>
                    <option value="PROFILE_UPDATE">Profile Update</option>
                  </select>
                  <input type="date" value={logFilter.startDate}
                    onChange={(e) => { setLogFilter(prev => ({ ...prev, startDate: e.target.value })); setLogPage(1) }}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input type="date" value={logFilter.endDate}
                    onChange={(e) => { setLogFilter(prev => ({ ...prev, endDate: e.target.value })); setLogPage(1) }}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {(logFilter.category || logFilter.action || logFilter.startDate || logFilter.endDate) && (
                    <button onClick={() => { setLogFilter({ category: '', action: '', startDate: '', endDate: '' }); setLogPage(1) }}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                      ✕ Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Logs Table */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {logsLoading ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-3xl mb-2 animate-spin">⏳</div>
                    <p className="text-sm">Loading activity logs...</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="font-medium text-sm">No activity logs found!</p>
                    <p className="text-xs mt-1">Logs will appear as you use the system.</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Performed By</th>
                          <th className="px-4 py-3">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log, i) => {
                          const catConfig = categoryConfig[log.category] || categoryConfig.System
                          return (
                            <tr key={i} className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{actionIcons[log.action] || '📌'}</span>
                                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 font-mono">
                                    {log.action}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 max-w-xs">
                                <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{log.description}</p>
                                {log.targetName && (
                                  <p className="text-xs text-gray-400 mt-0.5">→ {log.targetName}</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${catConfig.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${catConfig.dot}`} />
                                  {log.category}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {(log.performedByName || log.performedBy?.name || '?').charAt(0)}
                                  </div>
                                  <span className="text-xs text-gray-600 dark:text-gray-300">
                                    {log.performedByName || log.performedBy?.name || '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                  {timeAgo(log.createdAt)}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        Showing {((logPage - 1) * LOG_LIMIT) + 1}–{Math.min(logPage * LOG_LIMIT, logTotal)} of {logTotal} logs
                      </p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all">
                          ← Prev
                        </button>
                        {Array.from({ length: Math.min(5, logTotalPages) }, (_, i) => {
                          const page = logPage <= 3 ? i + 1 : logPage - 2 + i
                          if (page > logTotalPages) return null
                          return (
                            <button key={page} onClick={() => setLogPage(page)}
                              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                                logPage === page
                                  ? 'bg-blue-600 text-white'
                                  : 'border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}>
                              {page}
                            </button>
                          )
                        })}
                        <button onClick={() => setLogPage(p => Math.min(logTotalPages, p + 1))} disabled={logPage === logTotalPages}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all">
                          Next →
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── SYSTEM INFO TAB ── */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              {/* System Cards */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg">ℹ️</div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">System Information</h3>
                    <p className="text-xs text-gray-400">Technical details about this system</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Project Name', value: 'Virtual Attendance System', icon: '🏫' },
                    { label: 'Version', value: '1.0.0', icon: '🔖' },
                    { label: 'Frontend', value: 'React + Vite + Tailwind', icon: '⚛️' },
                    { label: 'Backend', value: 'Node.js + Express', icon: '🟢' },
                    { label: 'Database', value: 'MongoDB Atlas', icon: '🍃' },
                    { label: 'AI Service', value: 'Python FastAPI + face_recognition', icon: '🤖' },
                    { label: 'Storage', value: 'Cloudinary', icon: '☁️' },
                    { label: 'Admin', value: user?.name || 'Admin', icon: '👤' },
                  ].map((info, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <span className="text-xl">{info.icon}</span>
                      <div>
                        <p className="text-xs text-gray-400">{info.label}</p>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{info.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tech Stack Badges */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'React 18', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
                    { label: 'Vite', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
                    { label: 'Tailwind CSS', color: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' },
                    { label: 'Node.js', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
                    { label: 'Express.js', color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
                    { label: 'MongoDB', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
                    { label: 'Mongoose', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
                    { label: 'Python 3.11', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
                    { label: 'FastAPI', color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' },
                    { label: 'face_recognition', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
                    { label: 'JWT Auth', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
                    { label: 'Cloudinary', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
                    { label: 'Nodemailer', color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' },
                    { label: 'Recharts', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
                  ].map((tech, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${tech.color}`}>
                      {tech.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Server Status */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Service Status</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Node.js Backend', port: '5000', status: 'running' },
                    { label: 'React Frontend', port: '5173', status: 'running' },
                    { label: 'Python AI Service', port: '8000', status: 'running' },
                    { label: 'MongoDB Atlas', port: 'Cloud', status: 'running' },
                  ].map((service, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{service.label}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">:{service.port}</span>
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

export default Settings