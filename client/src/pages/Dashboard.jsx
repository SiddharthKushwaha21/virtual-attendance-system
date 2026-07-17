import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import Students from './Students'
import Teachers from './Teachers'
import MarkAttendance from './MarkAttendance'
import Reports from './Reports'
import Settings from './Settings'

const Dashboard = ({ dark, setDark }) => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [activePage, setActivePage] = useState('dashboard')
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    avgPercentage: 0,
    last7Days: [],
    recentAttendance: [],
  })
  const [loading, setLoading] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef(null)

  const token = JSON.parse(localStorage.getItem('user'))?.token

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) { navigate('/'); return }
    setUser(JSON.parse(userData))
    fetchStats()
  }, [])

  useEffect(() => {
    if (activePage === 'dashboard') fetchStats()
  }, [activePage])

  // Notifications panel band karo bahar click karne par
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setStats(data)
      generateNotifications(data)
    } catch (err) {
      console.log('Stats load nahi hue:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateNotifications = (data) => {
    const notifs = []

    // Unmarked students alert
    const unmarked = data.totalStudents - data.presentToday - data.absentToday
    if (unmarked > 0) {
      notifs.push({
        id: 1,
        type: 'warning',
        icon: '⏰',
        title: 'Unmarked Students',
        message: `${unmarked} students ki aaj attendance mark nahi hui!`,
        time: 'Abhi',
        action: 'attendance',
      })
    }

    // Low attendance alert
    if (data.avgPercentage > 0 && data.avgPercentage < 75) {
      notifs.push({
        id: 2,
        type: 'danger',
        icon: '⚠️',
        title: 'Low Attendance Alert',
        message: `Aaj ki attendance ${data.avgPercentage}% hai — 75% se kam!`,
        time: 'Abhi',
        action: 'reports',
      })
    }

    // Absent students
    if (data.absentToday > 0) {
      notifs.push({
        id: 3,
        type: 'info',
        icon: '❌',
        title: 'Absent Students',
        message: `${data.absentToday} students aaj absent hain.`,
        time: 'Aaj',
        action: 'reports',
      })
    }

    // Good attendance
    if (data.avgPercentage >= 90) {
      notifs.push({
        id: 4,
        type: 'success',
        icon: '🎉',
        title: 'Excellent Attendance!',
        message: `Aaj ki attendance ${data.avgPercentage}% hai — bahut badhiya!`,
        time: 'Aaj',
        action: null,
      })
    }

    // Recent attendance
    if (data.recentAttendance.length > 0) {
      notifs.push({
        id: 5,
        type: 'success',
        icon: '✅',
        title: 'Recent Attendance',
        message: `${data.recentAttendance.length} students ki attendance aaj mark hui.`,
        time: 'Aaj',
        action: 'attendance',
      })
    }

    setNotifications(notifs)
    setUnreadCount(notifs.filter(n => n.type === 'warning' || n.type === 'danger').length)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    toast.success('Logged out!')
    navigate('/')
  }

  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'attendance', icon: '📷', label: 'Mark Attendance' },
    { id: 'students', icon: '👥', label: 'Students' },
    { id: 'teachers', icon: '👨‍🏫', label: 'Teachers' },
    { id: 'reports', icon: '📈', label: 'Reports' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  const statusStyle = (status) => {
    if (status === 'Present') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    if (status === 'Absent') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
  }

  const notifStyle = (type) => {
    if (type === 'danger') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    if (type === 'warning') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    if (type === 'success') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  }

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, sub: 'Registered', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: '👥' },
    { label: 'Present Today', value: stats.presentToday, sub: `${stats.avgPercentage}% attendance`, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', icon: '✅' },
    { label: 'Absent Today', value: stats.absentToday, sub: 'Not marked', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: '❌' },
    { label: 'Avg Attendance', value: `${stats.avgPercentage}%`, sub: 'Today', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: '📈' },
  ]

  const unmarked = stats.totalStudents - stats.presentToday - stats.absentToday
  const pieData = [
    { name: 'Present', value: stats.presentToday, color: '#22c55e' },
    { name: 'Absent', value: stats.absentToday, color: '#ef4444' },
    { name: 'Unmarked', value: unmarked > 0 ? unmarked : 0, color: '#94a3b8' },
  ].filter(d => d.value > 0)

  const barData = stats.last7Days.map(d => ({
    day: d.day,
    Present: d.present,
    Total: d.total,
    percentage: d.percentage,
  }))

  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-xs">
          <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
          <p className="text-green-600">Present: {payload[0]?.value}</p>
          <p className="text-gray-400">Attendance: {payload[0]?.payload?.percentage}%</p>
        </div>
      )
    }
    return null
  }

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-xs">
          <p className="font-semibold text-gray-700 dark:text-gray-200">{payload[0].name}</p>
          <p style={{ color: payload[0].payload.color }}>{payload[0].value} students</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">

      {/* Navbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow">
          A
        </div>
        <span className="font-semibold text-gray-800 dark:text-white flex-1 text-base">
          Attendance System
        </span>

        <button
          onClick={fetchStats}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Refresh"
        >
          🔄
        </button>

        <button
          onClick={() => setDark(!dark)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {dark ? '☀️ Light' : '🌙 Dark'}
        </button>

        {/* 🔔 Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); setUnreadCount(0) }}
            className="relative w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔔</span>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Notifications</h3>
                </div>
                <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                  {notifications.length} alerts
                </span>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                {notifications.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <div className="text-4xl mb-2">🔔</div>
                    <p className="text-sm">Koi notification nahi!</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => { if (notif.action) setActivePage(notif.action); setShowNotifications(false) }}
                      className={`flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        notif.type === 'danger' ? 'border-l-4 border-red-500' :
                        notif.type === 'warning' ? 'border-l-4 border-yellow-500' :
                        notif.type === 'success' ? 'border-l-4 border-green-500' :
                        'border-l-4 border-blue-500'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                        notif.type === 'danger' ? 'bg-red-100 dark:bg-red-900/30' :
                        notif.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        notif.type === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
                        'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        {notif.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{notif.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{notif.message}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{notif.time}</p>
                      </div>
                      {notif.action && (
                        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-300">→</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                <button
                  onClick={() => { fetchStats(); setShowNotifications(false) }}
                  className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-semibold shadow">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-none">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-medium transition-all"
        >
          Logout
        </button>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 py-4 flex flex-col sticky top-14 h-[calc(100vh-56px)]">
          <div className="flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all ${
                  activePage === item.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-r-2 border-blue-600'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div className="px-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">AI Face Recognition</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Active ✅</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-auto">
          {activePage === 'dashboard' && (
            <div>
              {/* Welcome */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
                    Welcome back, {user?.name}! 👋
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => setActivePage('attendance')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                >
                  📷 Mark Attendance
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {statCards.map((card, i) => (
                  <div key={i} className={`rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${card.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                      <span className="text-xl">{card.icon}</span>
                    </div>
                    <p className={`text-2xl font-bold ${card.color}`}>
                      {loading ? '...' : card.value}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Bar Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
                    📊 Last 7 Days — Attendance Trend
                  </h3>
                  {barData.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Koi data nahi!</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={barData} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#374151' : '#f0f0f0'} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: dark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: dark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="Present" radius={[6, 6, 0, 0]}>
                          {barData.map((entry, i) => (
                            <Cell key={i} fill={
                              entry.percentage >= 75 ? '#22c55e' :
                              entry.percentage >= 50 ? '#f59e0b' :
                              entry.percentage > 0 ? '#ef4444' : '#e5e7eb'
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Pie Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
                    🥧 Today's Attendance Breakdown
                  </h3>
                  {stats.totalStudents === 0 ? (
                    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Koi student nahi!</div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <ResponsiveContainer width="60%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-3 pl-2">
                        {[
                          { label: 'Present', value: stats.presentToday, color: '#22c55e' },
                          { label: 'Absent', value: stats.absentToday, color: '#ef4444' },
                          { label: 'Unmarked', value: unmarked > 0 ? unmarked : 0, color: '#94a3b8' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                              <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{item.value}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Total</span>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{stats.totalStudents}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-400">Attendance</span>
                            <span className={`text-xs font-bold ${
                              stats.avgPercentage >= 75 ? 'text-green-600' :
                              stats.avgPercentage >= 50 ? 'text-yellow-500' : 'text-red-500'
                            }`}>{stats.avgPercentage}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-2 gap-6">
                {/* Recent Attendance */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Today's Recent Attendance</h3>
                    <button onClick={() => setActivePage('attendance')} className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                      Mark Attendance →
                    </button>
                  </div>
                  {stats.recentAttendance.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <div className="text-3xl mb-2">📋</div>
                      <p className="text-sm">Aaj koi attendance mark nahi hui!</p>
                      <button onClick={() => setActivePage('attendance')}
                        className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                        Mark Now
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <th className="pb-2 pr-3 min-w-[140px]">Student</th>
                            <th className="pb-2 pr-3 min-w-[55px]">Class</th>
                            <th className="pb-2 pr-3 min-w-[65px]">Section</th>
                            <th className="pb-2 pr-3 min-w-[70px]">Status</th>
                            <th className="pb-2 min-w-[60px]">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentAttendance.map((a, i) => (
                            <tr key={i} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                              <td className="py-2 pr-3 font-medium text-gray-700 dark:text-gray-200 min-w-[140px]">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 text-xs font-semibold flex-shrink-0">
                                    {(a.studentId?.name || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="whitespace-nowrap">{a.studentId?.name || 'Unknown'}</span>
                                </div>
                              </td>
                              <td className="py-2 pr-3 text-gray-400 text-xs whitespace-nowrap">{a.studentId?.class || a.class || '-'}</td>
                              <td className="py-2 pr-3 text-gray-400 text-xs whitespace-nowrap">{a.studentId?.section || a.section || '-'}</td>
                              <td className="py-2 pr-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle(a.status)}`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="py-2 text-gray-400 text-xs whitespace-nowrap">{a.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Last 7 Days + Alerts */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Last 7 Days Attendance</h3>
                  {stats.last7Days.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <div className="text-3xl mb-2">📈</div>
                      <p className="text-sm">Koi data nahi!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stats.last7Days.map((day, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-8 text-right">{day.day}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all duration-500 ${
                                day.percentage >= 75 ? 'bg-green-500' :
                                day.percentage >= 50 ? 'bg-yellow-500' :
                                day.percentage > 0 ? 'bg-red-500' : 'bg-gray-300'
                              }`}
                              style={{ width: `${day.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{day.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {stats.avgPercentage > 0 && stats.avgPercentage < 75 && (
                    <div className="mt-4 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
                      <span className="text-red-500 text-base mt-0.5">⚠️</span>
                      <div>
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">Low Attendance Alert!</p>
                        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                          Aaj ki attendance {stats.avgPercentage}% hai — 75% se kam hai!
                        </p>
                      </div>
                    </div>
                  )}

                  {stats.avgPercentage >= 75 && (
                    <div className="mt-4 flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2.5">
                      <span className="text-base">✅</span>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Attendance {stats.avgPercentage}% — Acha hai! 🎉
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-green-600">{stats.presentToday}</p>
                      <p className="text-xs text-gray-400">Present</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-red-500">{stats.absentToday}</p>
                      <p className="text-xs text-gray-400">Absent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-500">
                        {stats.totalStudents - stats.presentToday - stats.absentToday}
                      </p>
                      <p className="text-xs text-gray-400">Unmarked</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'students' && <Students />}
          {activePage === 'teachers' && <Teachers />}
          {activePage === 'attendance' && <MarkAttendance />}
          {activePage === 'reports' && <Reports />}
          {activePage === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  )
}

export default Dashboard