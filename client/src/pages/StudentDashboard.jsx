import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import toast                   from 'react-hot-toast'
import SDashboard              from './student/SDashboard'
import SAttendance             from './student/SAttendance'
import SProfile                from './student/SProfile'

const StudentDashboard = ({ dark, setDark }) => {
  const navigate = useNavigate()
  const [student, setStudent]         = useState(null)
  const [activePage, setActivePage]   = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('student')
    if (!stored) { navigate('/'); return }
    try {
      const parsed = JSON.parse(stored)
      if (parsed.role !== 'student') { toast.error('Access denied!'); navigate('/'); return }
      setStudent(parsed)
    } catch { navigate('/') }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('student')
    toast.success('Logged out successfully!')
    navigate('/')
  }

  const navItems = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard'   },
    { id: 'attendance', icon: '📅', label: 'My Attendance' },
    { id: 'profile',    icon: '👤', label: 'My Profile'   },
  ]

  if (!student) return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">

      {/* ── Navbar ── */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
        px-5 py-3 flex items-center gap-3 flex-shrink-0 z-30 shadow-sm">

        {/* Hamburger */}
        <button onClick={() => setSidebarOpen(p => !p)}
          className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center
            justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
            transition-all flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center
            justify-center text-white font-bold text-sm shadow-md">
            🎓
          </div>
          <div className="hidden sm:block">
            <p className="font-black text-gray-800 dark:text-white text-sm leading-none">Student Panel</p>
            <p className="text-xs text-gray-400 mt-0.5">Attendance System</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Class badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20
          border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <span className="text-xs">🎓</span>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            {student.class}{student.section ? `-${student.section}` : ''}
            {student.year ? ` • Year ${student.year}` : ''}
          </span>
        </div>

        {/* Dark mode */}
        <button onClick={() => setDark(p => !p)}
          className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center
            justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
            transition-all flex-shrink-0">
          <span className="text-base">{dark ? '☀️' : '🌙'}</span>
        </button>

        {/* Student info */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200 dark:border-gray-700">
          {student?.photo
            ? <img src={student.photo}
                className="w-8 h-8 rounded-full object-cover shadow ring-2 ring-emerald-500/30 flex-shrink-0" />
            : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center
                justify-center text-white text-xs font-black shadow flex-shrink-0">
                {student?.name?.charAt(0)}
              </div>
          }
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 leading-none">{student?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">Roll: {student?.rollNo}</p>
          </div>
        </div>

        {/* Logout */}
        <button onClick={handleLogout}
          className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500
            hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-bold transition-all
            border border-red-200 dark:border-red-800 flex-shrink-0">
          Logout
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className={`${sidebarOpen ? 'w-56' : 'w-0'} transition-all duration-300
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          flex flex-col overflow-hidden flex-shrink-0`}>

          <div className="flex-1 px-3 py-4 overflow-y-auto
            [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700
            [&::-webkit-scrollbar-thumb]:rounded-full">

            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 mb-3">Menu</p>

            {navItems.map(item => (
              <button key={item.id} onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                  font-semibold transition-all mb-1 ${
                  activePage === item.id
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200'
                }`}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {activePage === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Student card at bottom */}
          <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20
              dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                {student?.photo
                  ? <img src={student.photo} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  : <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600
                      flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                      {student?.name?.charAt(0)}
                    </div>
                }
                <div className="min-w-0">
                  <p className="text-xs font-black text-gray-700 dark:text-gray-200 truncate">{student?.name}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                    {student?.class}{student?.section ? `-${student.section}` : ''} • Roll {student?.rollNo}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Active Student</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-auto p-5
          [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-emerald-300 dark:[&::-webkit-scrollbar-thumb]:bg-emerald-700
          [&::-webkit-scrollbar-thumb]:rounded-full">
          {activePage === 'dashboard'  && <SDashboard  student={student} setActivePage={setActivePage} dark={dark} />}
          {activePage === 'attendance' && <SAttendance student={student} dark={dark} />}
          {activePage === 'profile'    && <SProfile    student={student} setStudent={setStudent} dark={dark} />}
        </main>
      </div>
    </div>
  )
}

export default StudentDashboard