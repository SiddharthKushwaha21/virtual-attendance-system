import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import TDashboard      from './teacher/TDashboard'
import TMarkAttendance from './teacher/TMarkAttendance'
import TStudents       from './teacher/TStudents'
import TReports        from './teacher/TReports'
import TSettings       from './teacher/TSettings'

const TeacherDashboard = ({ dark, setDark }) => {
  const navigate = useNavigate()
  const [user, setUser]               = useState(null)
  const [activePage, setActivePage]   = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) { navigate('/'); return }
    const parsed = JSON.parse(userData)
    if (parsed.role !== 'teacher') { toast.error('Access denied!'); navigate('/'); return }
    setUser(parsed)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    toast.success('Logged out successfully!')
    navigate('/')
  }

  const navItems = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard'       },
    { id: 'attendance', icon: '📷', label: 'Mark Attendance' },
    { id: 'students',   icon: '👥', label: 'My Students'     },
    { id: 'reports',    icon: '📈', label: 'Reports'         },
    { id: 'settings',   icon: '⚙️', label: 'Settings'        },
  ]

  if (!user) return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    /*
     * LAYOUT FIX:
     * Old code used min-h-screen which lets the page grow beyond the viewport,
     * causing the browser window itself to scroll. When the window scrolls,
     * the sidebar scrolls with it even if it is styled "sticky".
     *
     * Fix: Use h-screen + overflow-hidden on the root so the browser window
     * never scrolls. Only the <main> element gets overflow-auto, so only the
     * main content area scrolls while the sidebar stays perfectly in place.
     */
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">

      {/* ── Navbar — flex-shrink-0 so it never squishes ── */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
        px-5 py-3 flex items-center gap-3 flex-shrink-0 z-30 shadow-sm">

        <button onClick={() => setSidebarOpen(p => !p)}
          className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600
            flex items-center justify-center text-gray-500 dark:text-gray-300
            hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl
            flex items-center justify-center text-white font-bold text-sm shadow-md">
            👨‍🏫
          </div>
          <div className="hidden sm:block">
            <p className="font-black text-gray-800 dark:text-white text-sm leading-none">Teacher Panel</p>
            <p className="text-xs text-gray-400 mt-0.5">Attendance System</p>
          </div>
        </div>

        <div className="flex-1" />

        {user?.assignedClasses?.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5
            bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800
            rounded-xl">
            <span className="text-xs">🏫</span>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
              {user.assignedClasses.map(c => `${c.class}${c.section ? `-${c.section}` : ''}`).join(', ')}
            </span>
          </div>
        )}

        <button onClick={() => setDark(p => !p)}
          className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600
            flex items-center justify-center text-gray-500 dark:text-gray-300
            hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex-shrink-0">
          <span className="text-base">{dark ? '☀️' : '🌙'}</span>
        </button>

        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200 dark:border-gray-700">
          {user?.photo
            ? <img src={user.photo}
                className="w-8 h-8 rounded-full object-cover shadow ring-2 ring-indigo-500/30 flex-shrink-0" />
            : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                flex items-center justify-center text-white text-xs font-black shadow flex-shrink-0">
                {user?.name?.charAt(0)}
              </div>
          }
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 leading-none">{user?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.subject || 'Teacher'}</p>
          </div>
        </div>

        <button onClick={handleLogout}
          className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500
            hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-bold transition-all
            border border-red-200 dark:border-red-800 flex-shrink-0">
          Logout
        </button>
      </header>

      {/* ── Body row — fills all remaining height ── */}
      <div className="flex flex-1 overflow-hidden">

        {/*
         * SIDEBAR FIX:
         * The sidebar now just uses flex layout (no sticky/fixed positioning needed)
         * because the parent is h-screen overflow-hidden. The sidebar takes the full
         * height of the content row. Its nav items area has overflow-y-auto so it
         * can scroll independently if there are many items.
         * The teacher card at the bottom uses flex-shrink-0 to always stay visible.
         */}
        <aside className={`${sidebarOpen ? 'w-56' : 'w-0'} transition-all duration-300
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          flex flex-col overflow-hidden flex-shrink-0`}>

          {/* Nav items — scrollable if list grows */}
          <div className="flex-1 px-3 py-4 overflow-y-auto
            [&::-webkit-scrollbar]:w-1
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-gray-200
            [&::-webkit-scrollbar-thumb]:dark:bg-gray-700
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb:hover]:bg-indigo-300">

            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 mb-3">
              Menu
            </p>

            {navItems.map(item => (
              <button key={item.id} onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                  font-semibold transition-all mb-1 ${
                  activePage === item.id
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
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

          {/* Teacher card — always at bottom, never scrolled away */}
          <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50
              dark:from-indigo-900/20 dark:to-purple-900/20
              border border-indigo-200 dark:border-indigo-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                {user?.photo
                  ? <img src={user.photo} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  : <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600
                      flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                      {user?.name?.charAt(0)}
                    </div>
                }
                <div className="min-w-0">
                  <p className="text-xs font-black text-gray-700 dark:text-gray-200 truncate">{user?.name}</p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 truncate">
                    {user?.subject || 'Teacher'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">Active</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content — only this scrolls ── */}
        <main className="flex-1 overflow-auto p-5
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-indigo-300
          [&::-webkit-scrollbar-thumb]:dark:bg-indigo-700
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb:hover]:bg-indigo-400">

          {activePage === 'dashboard'  && <TDashboard user={user} setActivePage={setActivePage} dark={dark} />}
          {activePage === 'attendance' && <TMarkAttendance user={user} dark={dark} />}
          {activePage === 'students'   && <TStudents user={user} />}
          {activePage === 'reports'    && <TReports user={user} dark={dark} />}
          {activePage === 'settings'   && <TSettings user={user} setUser={setUser} dark={dark} setDark={setDark} />}
        </main>
      </div>
    </div>
  )
}

export default TeacherDashboard