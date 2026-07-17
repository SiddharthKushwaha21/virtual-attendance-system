import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import axios                   from 'axios'
import toast                   from 'react-hot-toast'

// ── Animated Background Orbs ─────────────────────────────────────────────────
const Orbs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
    <div className="absolute top-1/3 -right-32 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
    <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-900/20 rounded-full blur-3xl" />
    <div className="absolute inset-0 opacity-5"
      style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
  </div>
)

const Login = () => {
  const navigate = useNavigate()

  // ── Tab: 'staff' (admin/teacher) or 'student' ──
  const [activeTab, setActiveTab]   = useState('staff')

  // ── Staff form ──
  const [staffForm, setStaffForm]   = useState({ email: '', password: '' })

  // ── Student form ──
  const [studentForm, setStudentForm] = useState({ email: '', phone: '' })

  const [loading, setLoading]       = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [mounted, setMounted]       = useState(false)
  const [loginStep, setLoginStep]   = useState('idle') // idle | loading | success | error

  useEffect(() => {
    setMounted(true)
    // Already logged in — redirect
    const userData    = localStorage.getItem('user')
    const studentData = localStorage.getItem('student')
    if (userData) {
      const u = JSON.parse(userData)
      if (u.role === 'admin')   navigate('/dashboard')
      if (u.role === 'teacher') navigate('/teacher')
    }
    if (studentData) {
      const s = JSON.parse(studentData)
      if (s.role === 'student') navigate('/student')
    }
  }, [])

  // Reset step on tab change
  useEffect(() => {
    setLoginStep('idle')
    setFocusedField(null)
  }, [activeTab])

  // ── Staff Login (Admin + Teacher) ─────────────────────────────────────────
  const handleStaffLogin = async (e) => {
    e.preventDefault()
    if (!staffForm.email.trim()) { toast.error('Please enter your email!');    return }
    if (!staffForm.password)     { toast.error('Please enter your password!'); return }
    try {
      setLoading(true); setLoginStep('loading')
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        { email: staffForm.email.trim().toLowerCase(), password: staffForm.password }
      )
      localStorage.setItem('user', JSON.stringify(data))
      setLoginStep('success')
      setTimeout(() => {
        if (data.role === 'admin') {
          toast.success(`Welcome back, ${data.name}! 👋`)
          navigate('/dashboard')
        } else if (data.role === 'teacher') {
          toast.success(`Welcome, ${data.name}! 👋`)
          navigate('/teacher')
        } else {
          toast.error('Access denied. Contact admin.')
          localStorage.removeItem('user')
          setLoginStep('idle')
        }
      }, 600)
    } catch (err) {
      setLoginStep('error')
      toast.error(err.response?.data?.message || 'Login failed. Try again.')
      setTimeout(() => setLoginStep('idle'), 1500)
    } finally {
      setLoading(false)
    }
  }

  // ── Student Login ─────────────────────────────────────────────────────────
  const handleStudentLogin = async (e) => {
    e.preventDefault()
    if (!studentForm.email.trim()) { toast.error('Please enter your email!');        return }
    if (!studentForm.phone.trim()) { toast.error('Please enter your phone number!'); return }
    try {
      setLoading(true); setLoginStep('loading')
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/students/login`,
        { email: studentForm.email.trim().toLowerCase(), password: studentForm.phone.trim() }
      )
      // Student data alag key mein store karo
      localStorage.setItem('student', JSON.stringify(data))
      setLoginStep('success')
      setTimeout(() => {
        toast.success(`Welcome, ${data.name}! 🎓`)
        navigate('/student')
      }, 600)
    } catch (err) {
      setLoginStep('error')
      toast.error(err.response?.data?.message || 'Login failed. Check your email & phone.')
      setTimeout(() => setLoginStep('idle'), 1500)
    } finally {
      setLoading(false)
    }
  }

  const btnStyle = {
    idle:    activeTab === 'student'
               ? 'from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-700'
               : 'from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-700',
    loading: 'from-blue-400 via-indigo-400 to-purple-500 cursor-wait',
    success: 'from-emerald-500 via-green-500 to-teal-500',
    error:   'from-red-500 via-rose-500 to-pink-500',
  }

  return (
    <div className="min-h-screen bg-[#070b1a] flex items-center justify-center p-4 relative overflow-hidden">
      <Orbs />

      <div className={`w-full max-w-md relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* ── Logo + Title ── */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-60 scale-110" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <span className="text-4xl">🎓</span>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            Attendance
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> System</span>
          </h1>
          <p className="text-blue-300/70 text-sm mt-2 font-medium">Sign in to continue to your dashboard</p>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex gap-2 mb-6 p-1.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
          {[
            { id: 'staff',   label: 'Staff Login',   icon: '👨‍💼', desc: 'Admin & Teacher' },
            { id: 'student', label: 'Student Login',  icon: '🎓', desc: 'Students' },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === tab.id
                  ? tab.id === 'student'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-blue-300/60 hover:text-blue-300/90 hover:bg-white/5'
              }`}>
              <span className="text-base">{tab.icon}</span>
              <div className="text-left hidden sm:block">
                <p className="leading-none text-xs font-black">{tab.label}</p>
                <p className="leading-none text-[10px] opacity-70 mt-0.5">{tab.desc}</p>
              </div>
              <p className="sm:hidden text-xs font-black">{tab.label}</p>
            </button>
          ))}
        </div>

        {/* ── Card ── */}
        <div className="relative">
          <div className={`absolute -inset-0.5 rounded-3xl blur-sm ${
            activeTab === 'student'
              ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30'
              : 'bg-gradient-to-br from-blue-500/30 to-purple-500/30'
          }`} />

          <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">

            {/* ── Card Header ── */}
            <div className="mb-7">
              {activeTab === 'student' ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🎓</span>
                    <h2 className="text-xl font-black text-white">Student Portal</h2>
                  </div>
                  <p className="text-sm text-emerald-300/60">Login with your registered email & phone number</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black text-white">Welcome Back 👋</h2>
                  <p className="text-sm text-blue-300/60 mt-1">Enter your credentials to access your panel</p>
                </>
              )}
            </div>

            {/* ══════════════════════════════════════
                STAFF LOGIN FORM (Admin + Teacher)
            ══════════════════════════════════════ */}
            {activeTab === 'staff' && (
              <form onSubmit={handleStaffLogin} className="space-y-5">

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-blue-200/70 mb-2 uppercase tracking-wider">Email Address</label>
                  <div className={`relative transition-all duration-200 ${focusedField === 'email' ? 'scale-[1.01]' : ''}`}>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input type="email" placeholder="Enter your email"
                      value={staffForm.email}
                      onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm text-white placeholder-blue-300/30 transition-all duration-200 focus:outline-none border ${
                        focusedField === 'email'
                          ? 'bg-white/10 border-blue-400/60 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-blue-200/70 mb-2 uppercase tracking-wider">Password</label>
                  <div className={`relative transition-all duration-200 ${focusedField === 'password' ? 'scale-[1.01]' : ''}`}>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input type={showPass ? 'text' : 'password'} placeholder="Enter your password"
                      value={staffForm.password}
                      onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full pl-11 pr-12 py-3.5 rounded-2xl text-sm text-white placeholder-blue-300/30 transition-all duration-200 focus:outline-none border ${
                        focusedField === 'password'
                          ? 'bg-white/10 border-blue-400/60 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300/50 hover:text-blue-300 transition-colors">
                      {showPass ? (
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
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className={`w-full py-4 rounded-2xl text-white font-black text-sm transition-all duration-300 bg-gradient-to-r shadow-lg relative overflow-hidden mt-2 ${btnStyle[loginStep]}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
                    style={{ animation: loginStep === 'idle' ? 'shimmer 2.5s infinite' : 'none' }} />
                  <span className="relative flex items-center justify-center gap-2">
                    {loginStep === 'loading' && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {loginStep === 'success' && <span>✅</span>}
                    {loginStep === 'error'   && <span>❌</span>}
                    {loginStep === 'idle'    && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                    )}
                    {loginStep === 'loading' ? 'Signing in...' :
                     loginStep === 'success' ? 'Redirecting...' :
                     loginStep === 'error'   ? 'Login Failed'  : 'Sign In'}
                    {loginStep === 'idle' && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    )}
                  </span>
                </button>
              </form>
            )}

            {/* ══════════════════════════════════════
                STUDENT LOGIN FORM
            ══════════════════════════════════════ */}
            {activeTab === 'student' && (
              <form onSubmit={handleStudentLogin} className="space-y-5">

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-emerald-200/70 mb-2 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className={`relative transition-all duration-200 ${focusedField === 'semail' ? 'scale-[1.01]' : ''}`}>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input type="email" placeholder="Enter your registered email"
                      value={studentForm.email}
                      onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                      onFocus={() => setFocusedField('semail')}
                      onBlur={() => setFocusedField(null)}
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm text-white placeholder-emerald-300/30 transition-all duration-200 focus:outline-none border ${
                        focusedField === 'semail'
                          ? 'bg-white/10 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`} />
                  </div>
                </div>

                {/* Phone Number as Password */}
                <div>
                  <label className="block text-xs font-bold text-emerald-200/70 mb-2 uppercase tracking-wider">
                    Phone Number <span className="text-emerald-400/60 normal-case font-normal">(your password)</span>
                  </label>
                  <div className={`relative transition-all duration-200 ${focusedField === 'sphone' ? 'scale-[1.01]' : ''}`}>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input type={showPass ? 'text' : 'password'}
                      placeholder="Enter your 10-digit phone number"
                      value={studentForm.phone}
                      onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })}
                      onFocus={() => setFocusedField('sphone')}
                      onBlur={() => setFocusedField(null)}
                      maxLength={10}
                      inputMode="numeric"
                      className={`w-full pl-11 pr-12 py-3.5 rounded-2xl text-sm text-white placeholder-emerald-300/30 transition-all duration-200 focus:outline-none border ${
                        focusedField === 'sphone'
                          ? 'bg-white/10 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300/50 hover:text-emerald-300 transition-colors">
                      {showPass ? (
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
                  </div>
                  <p className="text-[10px] text-emerald-400/40 mt-1.5 ml-1">
                    💡 Your registered phone number is your password
                  </p>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading}
                  className={`w-full py-4 rounded-2xl text-white font-black text-sm transition-all duration-300 bg-gradient-to-r shadow-lg relative overflow-hidden mt-2 ${btnStyle[loginStep]}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
                    style={{ animation: loginStep === 'idle' ? 'shimmer 2.5s infinite' : 'none' }} />
                  <span className="relative flex items-center justify-center gap-2">
                    {loginStep === 'loading' && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {loginStep === 'success' && <span>✅</span>}
                    {loginStep === 'error'   && <span>❌</span>}
                    {loginStep === 'idle'    && <span className="text-base">🎓</span>}
                    {loginStep === 'loading' ? 'Signing in...'  :
                     loginStep === 'success' ? 'Redirecting...' :
                     loginStep === 'error'   ? 'Login Failed'   : 'Access Student Portal'}
                    {loginStep === 'idle' && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    )}
                  </span>
                </button>
              </form>
            )}

            {/* ── Divider ── */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-blue-300/40 font-medium">System Roles</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* ── Role Pills — all 3 roles ── */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label:'Admin',   icon:'👑', desc:'Full Access',   color:'from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-300',   active: activeTab==='staff' },
                { label:'Teacher', icon:'👨‍🏫', desc:'Class Access',  color:'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300',          active: activeTab==='staff' },
                { label:'Student', icon:'🎓', desc:'View Access',   color:'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300',   active: activeTab==='student' },
              ].map(role => (
                <div key={role.label}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border bg-gradient-to-br transition-all ${role.color} ${
                    role.active ? 'opacity-100 scale-[1.02]' : 'opacity-50'
                  }`}>
                  <span className="text-xl">{role.icon}</span>
                  <div className="text-center">
                    <p className="text-xs font-black leading-none">{role.label}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">{role.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Security Note ── */}
            <div className="mt-5 flex items-center gap-2 px-4 py-3 bg-white/3 border border-white/8 rounded-2xl">
              <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-xs text-blue-200/40 leading-tight">Secured with JWT Authentication • Data encrypted</p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-blue-400/30 text-xs mt-8 font-medium">
          Virtual Attendance System • {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}

export default Login