import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import Login           from './pages/Login'
import Dashboard       from './pages/Dashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'

function App() {
  const [dark, setDark] = useState(localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: '12px', fontWeight: 600, fontSize: '13px' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/"          element={<Login />} />
        <Route path="/dashboard" element={<Dashboard dark={dark} setDark={setDark} />} />
        <Route path="/teacher"   element={<TeacherDashboard dark={dark} setDark={setDark} />} />
        {/* NEW: Student Panel route */}
        <Route path="/student"   element={<StudentDashboard dark={dark} setDark={setDark} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App