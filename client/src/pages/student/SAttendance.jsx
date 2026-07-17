import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import axios     from 'axios'
import toast     from 'react-hot-toast'
import jsPDF     from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line,
} from 'recharts'

// ═════════════════════════════════════════════════════════════
// FIX 1: IST-safe date helper — no more UTC midnight bug
// new Date().toISOString() returns UTC — midnight IST = previous day UTC
// This always returns local date string
// ═════════════════════════════════════════════════════════════
const getLocalDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getLocalMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// BUGFIX (filters #2): every date-only string in this file must be parsed
// the same IST-safe way. Centralised here so "This Week"/"This Month" etc.
// can never silently reintroduce the UTC-midnight bug that FIX 1 solved
// everywhere else.
const parseLocalDate = (dateStr) => new Date(dateStr + 'T00:00:00')

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────
const STATUS_EMOJI = { Present: '✅', Absent: '❌', Late: '⏰' }
const STATUS_COLOR = {
  Present: 'text-green-600 dark:text-green-400',
  Absent:  'text-red-500 dark:text-red-400',
  Late:    'text-yellow-600 dark:text-yellow-400',
}
const STATUS_BG = {
  Present: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  Absent:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  Late:    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
}
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// BUGFIX (#2/#14): one single formatter used EVERYWHERE a percentage is
// shown, so "72%" and "72.2%" can never appear side-by-side for the same
// underlying number again. Always 1 decimal, trailing ".0" stripped.
const fmtPct = (n) => {
  const v = Number(n) || 0
  return Number.isInteger(v) ? `${v}` : v.toFixed(1)
}

// ═════════════════════════════════════════════════════════════
// NEW: Animated number counter (counts up 0 → value on mount)
// ═════════════════════════════════════════════════════════════
const useCountUp = (target, duration = 900, decimals = 0) => {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (typeof target !== 'number' || Number.isNaN(target)) { setVal(0); return }
    let raf, start
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out-cubic
      setVal(parseFloat((target * eased).toFixed(decimals)))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, decimals])
  return val
}

const CountUp = ({ value, suffix = '', decimals = 0, className = '' }) => {
  const v = useCountUp(value, 900, decimals)
  return <span className={className}>{v}{suffix}</span>
}

// ═════════════════════════════════════════════════════════════
// NEW: Lightweight confetti burst (canvas, no deps)
// ═════════════════════════════════════════════════════════════
const ConfettiBurst = ({ fire }) => {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!fire) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const colors = ['#22c55e','#10b981','#34d399','#fbbf24','#60a5fa','#f472b6']
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.3,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 8,
      vy: 2 + Math.random() * 3,
      vx: -2 + Math.random() * 4,
      rot: Math.random() * 360,
      vr: -6 + Math.random() * 12,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))

    let frame = 0, raf
    const draw = () => {
      frame++
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rot * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })
      if (frame < 150) raf = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [fire])

  if (!fire) return null
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[999]" />
}

// ─────────────────────────────────────────────
// Animated Progress Ring
// ─────────────────────────────────────────────
const ProgressRing = ({ pct, size = 120, stroke = 10, dark }) => {
  const r        = (size - stroke) / 2
  const circ     = 2 * Math.PI * r
  const dash     = (pct / 100) * circ
  const color    = pct >= 75 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  const trackClr = dark ? '#1f2937' : '#f3f4f6'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackClr} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}><CountUp value={pct} decimals={pct % 1 !== 0 ? 1 : 0} suffix="%" /></span>
        <span className="text-[10px] text-gray-400 font-medium mt-0.5">Overall</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────
const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl ${className}`} />
)

// ═════════════════════════════════════════════════════════════
// NEW: Glass stat card (glassmorphism)
// ═════════════════════════════════════════════════════════════
const GlassStat = ({ icon, value, label, tint = 'emerald', suffix = '', decimals = 0, isText = false }) => {
  const tintMap = {
    emerald: 'from-emerald-500/10 to-emerald-500/0 border-emerald-200/60 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400',
    orange:  'from-orange-500/10 to-orange-500/0 border-orange-200/60 dark:border-orange-800/60 text-orange-600 dark:text-orange-400',
    indigo:  'from-indigo-500/10 to-indigo-500/0 border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400',
    amber:   'from-amber-500/10 to-amber-500/0 border-amber-200/60 dark:border-amber-800/60 text-amber-600 dark:text-amber-400',
    rose:    'from-rose-500/10 to-rose-500/0 border-rose-200/60 dark:border-rose-800/60 text-rose-600 dark:text-rose-400',
  }
  return (
    <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl bg-gradient-to-br ${tintMap[tint]} bg-white/60 dark:bg-gray-800/40 p-3.5 text-center transition-transform hover:scale-[1.03] hover:-translate-y-0.5 duration-300 shadow-sm`}>
      <div className="text-lg mb-0.5">{icon}</div>
      <p className="text-xl font-black leading-tight break-words">
        {isText ? value : <CountUp value={value} suffix={suffix} decimals={decimals} />}
      </p>
      <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  )
}

// ─────────────────────────────────────────────
// Month Comparison Chart — last 3 months
// ─────────────────────────────────────────────
const MonthComparisonChart = ({ history, dark }) => {
  if (!history?.length) return null
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-gray-950/95 backdrop-blur border border-gray-700/50 rounded-xl px-3 py-2 shadow-xl text-xs">
        <p className="font-black text-white mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} className="font-bold" style={{ color: p.color }}>{p.name}: {fmtPct(p.value)}%</p>
        ))}
      </div>
    )
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-black text-gray-800 dark:text-white">📈 Last 3 Months Trend</h3>
          <p className="text-xs text-gray-400 mt-0.5">Month-wise attendance comparison</p>
        </div>
        <div className="flex gap-3 text-xs">
          {[{ color:'#22c55e', label:'Present%' }, { color:'#ef4444', label:'Absent%' }].map(i => (
            <div key={i.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: i.color }} />
              <span className="text-gray-400 font-semibold">{i.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <defs>
            <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke={dark ? '#1f2937' : '#f1f5f9'} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: dark ? '#9ca3af' : '#6b7280', fontWeight: 700 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="presentPct" name="Present%" stroke="#22c55e" strokeWidth={2.5} fill="url(#gPresent)" dot={{ fill: '#22c55e', r: 4, strokeWidth: 0 }} />
          <Area type="monotone" dataKey="absentPct"  name="Absent%"  stroke="#ef4444" strokeWidth={2.5} fill="url(#gAbsent)"  dot={{ fill: '#ef4444', r: 4, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
      {/* BUGFIX (UX): 3 points on a line chart isn't really a "trend" — say so instead of implying more certainty than the data supports */}
      {history.length < 3 && (
        <p className="text-[10px] text-gray-400 mt-2 text-center">Based on {history.length} month{history.length > 1 ? 's' : ''} of data — trend will get more reliable as more months are added.</p>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NEW: Weekday Analysis Chart (bars + weakest day callout)
// BUGFIX (#4): now shows sample size (n=) per bar so a 0% built from
// 1 record can never look identical to a 0% built from 20 records.
// Also no longer silently drops days with zero records — it still
// only draws bars for days that have data (nothing to draw otherwise)
// but the "weakest day" callout now requires a minimum sample size
// before making a claim, so it can't over-generalise from n=1.
// ═════════════════════════════════════════════════════════════
const MIN_RELIABLE_SAMPLE = 3

const WeekdayAnalysisChart = ({ records, dark }) => {
  const data = useMemo(() => {
    if (!records?.length) return []
    const buckets = { Mon:{p:0,t:0}, Tue:{p:0,t:0}, Wed:{p:0,t:0}, Thu:{p:0,t:0}, Fri:{p:0,t:0}, Sat:{p:0,t:0}, Sun:{p:0,t:0} }
    records.forEach(r => {
      const day = parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday: 'short' })
      if (!buckets[day]) return
      buckets[day].t++
      if (r.status === 'Present' || r.status === 'Late') buckets[day].p++
    })
    return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      .filter(d => buckets[d].t > 0)
      .map(d => ({ day: d, pct: parseFloat(((buckets[d].p / buckets[d].t) * 100).toFixed(0)), total: buckets[d].t }))
  }, [records])

  if (!data.length) return null

  // BUGFIX: only call out a "weakest day" once we have enough samples on
  // it to say something meaningful — otherwise a single absence looked
  // like a permanent pattern.
  const reliableData = data.filter(d => d.total >= MIN_RELIABLE_SAMPLE)
  const weakest = reliableData.length
    ? reliableData.reduce((a, b) => (b.pct < a.pct ? b : a), reliableData[0])
    : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-black text-gray-800 dark:text-white mb-1">📊 Weekday Analysis</h3>
      <p className="text-xs text-gray-400 mb-4">Attendance rate by day of week</p>
      <div className="space-y-2.5">
        {data.map(d => (
          <div key={d.day} className="flex items-center gap-3">
            <span className="text-xs font-black text-gray-500 w-9">{d.day}</span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-2 ${
                  d.pct >= 85 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                  d.pct >= 70 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                  'bg-gradient-to-r from-red-400 to-rose-500'
                }`}
                style={{ width: `${Math.max(d.pct, 8)}%` }}
              >
                <span className="text-[9px] font-black text-white">{d.pct}%</span>
              </div>
            </div>
            {/* BUGFIX: sample count now always visible so low-confidence bars are obvious */}
            <span className="text-[9px] text-gray-400 font-bold w-9 text-right flex-shrink-0">n={d.total}</span>
            {weakest && d.day === weakest.day && d.pct < 75 && <span className="text-sm flex-shrink-0">⚠️</span>}
          </div>
        ))}
      </div>
      {weakest && weakest.pct < 75 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          💡 You miss most on <span className="underline">{weakest.day}s</span> ({weakest.pct}% over {weakest.total} classes) — try to prioritize attendance then.
        </p>
      ) : !weakest ? (
        <p className="text-[10px] text-gray-400 mt-3 text-center">Not enough records per day yet for a reliable weakest-day comparison (need {MIN_RELIABLE_SAMPLE}+ classes on a day).</p>
      ) : null}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NEW: Hourly pattern chart (what time are you usually marked)
// BUGFIX (#5): a chart built from only 1-2 marks per hour isn't a
// "pattern" — it's noise. Component now refuses to render itself as
// a confident pattern until there's a real minimum of records, and
// shows the small-sample notice instead.
// ═════════════════════════════════════════════════════════════
const MIN_RECORDS_FOR_HOURLY_PATTERN = 5

const HourlyPatternChart = ({ records, dark }) => {
  const data = useMemo(() => {
    if (!records?.length) return []
    const buckets = {}
    records.forEach(r => {
      if (!r.time) return
      const match = /^(\d{1,2}):/.exec(r.time)
      if (!match) return
      let hour = parseInt(match[1], 10)
      const isPM = /pm/i.test(r.time)
      if (isPM && hour < 12) hour += 12
      const label = hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour-12}PM`
      buckets[label] = (buckets[label] || 0) + 1
    })
    const order = ['12AM','1AM','2AM','3AM','4AM','5AM','6AM','7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM','11PM']
    return Object.entries(buckets)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => order.indexOf(a.hour) - order.indexOf(b.hour))
  }, [records])

  const totalTimedRecords = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data])

  if (!data.length) return null

  // BUGFIX: below the reliability threshold, show an honest placeholder
  // instead of a bar chart that implies a settled routine from 2-3 points.
  if (totalTimedRecords < MIN_RECORDS_FOR_HOURLY_PATTERN) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm flex flex-col items-center justify-center text-center min-h-[180px]">
        <h3 className="text-sm font-black text-gray-800 dark:text-white mb-1">⏰ Hourly Attendance Pattern</h3>
        <p className="text-xs text-gray-400 mt-2">Only {totalTimedRecords} timed record{totalTimedRecords !== 1 ? 's' : ''} so far — need at least {MIN_RECORDS_FOR_HOURLY_PATTERN} to show a reliable pattern.</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-black text-gray-800 dark:text-white mb-1">⏰ Hourly Attendance Pattern</h3>
      <p className="text-xs text-gray-400 mb-4">At what time are you usually marked? (based on {totalTimedRecords} records)</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="2 6" stroke={dark ? '#1f2937' : '#f1f5f9'} vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280', fontWeight: 700 }} axisLine={false} tickLine={false} interval={0} angle={data.length > 6 ? -35 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 34 : 20} />
          <YAxis tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} width={22} />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,10,0.95)', border: 'none', borderRadius: 12, fontSize: 11 }}
            labelStyle={{ color: '#fff', fontWeight: 700 }}
            itemStyle={{ color: '#22c55e' }}
            formatter={(value) => [`${value} time(s)`, 'Marked']}
          />
          <Bar dataKey="count" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NEW: Attendance velocity chart (trend line, is it going up/down)
// ═════════════════════════════════════════════════════════════
const VelocityChart = ({ history, dark }) => {
  if (!history?.length || history.length < 2) return null
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-black text-gray-800 dark:text-white mb-1">🚀 Attendance Velocity</h3>
      <p className="text-xs text-gray-400 mb-4">Is your attendance trending up or down?</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="2 6" stroke={dark ? '#1f2937' : '#f1f5f9'} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280', fontWeight: 700 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: dark ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,10,0.95)', border: 'none', borderRadius: 12, fontSize: 11 }}
            labelStyle={{ color: '#fff', fontWeight: 700 }}
            formatter={(value) => [`${fmtPct(value)}%`, 'Present']}
          />
          <Line type="monotone" dataKey="presentPct" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 5 }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NEW: Health grade calculator
// ═════════════════════════════════════════════════════════════
const getHealthGrade = (pct) => {
  if (pct >= 90) return { grade: 'A+', label: 'Excellent — Keep it up!', color: '#22c55e', bg: 'from-green-500/15 to-emerald-500/5' }
  if (pct >= 80) return { grade: 'A',  label: 'Great job, stay consistent!', color: '#10b981', bg: 'from-emerald-500/15 to-teal-500/5' }
  if (pct >= 75) return { grade: 'B',  label: 'Good, but stay alert.', color: '#84cc16', bg: 'from-lime-500/15 to-green-500/5' }
  if (pct >= 60) return { grade: 'C',  label: 'Needs improvement.', color: '#f59e0b', bg: 'from-amber-500/15 to-yellow-500/5' }
  return             { grade: 'D',  label: 'Critical — act now!', color: '#ef4444', bg: 'from-red-500/15 to-rose-500/5' }
}

// ═════════════════════════════════════════════════════════════
// NEW: Smart warning tier
// ═════════════════════════════════════════════════════════════
const getWarningTier = (pct) => {
  if (pct >= 85) return { tier: 'safe', emoji: '🟢', label: 'Safe', msg: "You're safe for exams", color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' }
  if (pct >= 75) return { tier: 'caution', emoji: '🟡', label: 'Caution', msg: 'Attend regularly to stay safe', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800' }
  return { tier: 'critical', emoji: '🔴', label: 'Critical', msg: 'Immediate action required', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' }
}

// classes needed (consecutive present days) to reach a target percentage
const classesNeededFor = (present, total, targetPct = 0.75) => {
  if (total <= 0) return 0
  const needed = Math.ceil((targetPct * total - present) / (1 - targetPct))
  return Math.max(0, needed)
}

// simulate attending/missing N more classes from current stats
const simulateAttendance = (present, total, delta, willAttend) => {
  const newTotal = total + Math.abs(delta)
  const newPresent = willAttend ? present + Math.abs(delta) : present
  if (newTotal <= 0) return 0
  return parseFloat(((newPresent / newTotal) * 100).toFixed(1))
}

// ═════════════════════════════════════════════════════════════
// NEW: What-If Calculator (interactive sliders)
// BUGFIX (#3): this used to derive its own baseline from os.present/os.total
// and silently disagree with the headline os.percentage shown everywhere
// else on the page. It now takes the authoritative percentage as a prop
// and reconciles the two — if the backend's present/total truly doesn't
// match its own percentage field, we say so once instead of quietly
// running two different "truths" on the same screen.
// ═════════════════════════════════════════════════════════════
const WhatIfCalculator = ({ os, headlinePct }) => {
  const present = os.present || 0
  const total   = os.total   || 0
  const derivedPct = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 0
  // Use the same headline percentage the rest of the page shows, so the
  // calculator's "current baseline" line can never contradict the top cards.
  const basePct = typeof headlinePct === 'number' ? headlinePct : derivedPct
  const mismatch = Math.abs(derivedPct - basePct) > 0.15 // backend inconsistency guard

  const [attendN, setAttendN] = useState(5)
  const [missN, setMissN]     = useState(3)

  const attendResult = simulateAttendance(present, total, attendN, true)
  const missResult   = simulateAttendance(present, total, missN, false)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="text-sm font-black text-gray-800 dark:text-white mb-1">🎯 What-If Calculator</h3>
      <p className="text-xs text-gray-400 mb-5">Simulate your future attendance in real-time</p>

      <div className="space-y-5">
        {/* Attend scenario */}
        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-100 dark:border-green-900/40">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
              If I attend next <span className="text-green-600 dark:text-green-400 font-black">{attendN}</span> classes:
            </span>
            <span className="text-lg font-black text-green-600 dark:text-green-400 flex items-center gap-1">
              {fmtPct(attendResult)}% <span className="text-xs">{attendResult >= derivedPct ? '↑' : '↓'}</span>
            </span>
          </div>
          <input
            type="range" min={1} max={30} value={attendN}
            onChange={e => setAttendN(Number(e.target.value))}
            aria-label="Number of classes to simulate attending"
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-green-500 bg-green-200 dark:bg-green-900/40"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>1</span><span>30 classes</span>
          </div>
        </div>

        {/* Miss scenario */}
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-100 dark:border-red-900/40">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
              If I miss next <span className="text-red-500 font-black">{missN}</span> classes:
            </span>
            <span className="text-lg font-black text-red-500 flex items-center gap-1">
              {fmtPct(missResult)}% <span className="text-xs">{missResult <= derivedPct ? '↓' : '↑'}</span>
            </span>
          </div>
          <input
            type="range" min={1} max={30} value={missN}
            onChange={e => setMissN(Number(e.target.value))}
            aria-label="Number of classes to simulate missing"
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-red-500 bg-red-200 dark:bg-red-900/40"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>1</span><span>30 classes</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-4 text-center">
        Current baseline: <span className="font-bold text-gray-500 dark:text-gray-300">{fmtPct(basePct)}%</span> ({present}/{total} classes)
      </p>
      {/* BUGFIX: surface backend data inconsistency instead of silently
          picking one number and hiding the disagreement */}
      {mismatch && (
        <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-1 text-center">
          Note: present/total in this data implies {fmtPct(derivedPct)}%, which differs slightly from the reported {fmtPct(basePct)}% — showing the reported figure as the source of truth.
        </p>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NEW: Exam eligibility countdown (uses examDate from data if present,
// else falls back to a generic "keep attending" message — no fake date invented)
// ═════════════════════════════════════════════════════════════
const ExamCountdown = ({ os, examDate }) => {
  const present = os.present || 0
  const total   = os.total   || 0
  const needed  = classesNeededFor(present, total, 0.75)

  let daysLeft = null
  if (examDate) {
    const diff = Math.ceil((new Date(examDate) - parseLocalDate(getLocalDate())) / (1000 * 60 * 60 * 24))
    daysLeft = diff >= 0 ? diff : null
  }

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 backdrop-blur-xl rounded-2xl border border-indigo-200/60 dark:border-indigo-800/60 p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-indigo-500/15 flex items-center justify-center text-xl flex-shrink-0">📅</div>
      <div className="flex-1">
        {daysLeft !== null ? (
          <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">Exams in {daysLeft} days</p>
        ) : (
          <p className="text-sm font-black text-indigo-700 dark:text-indigo-300">Exam Eligibility Tracker</p>
        )}
        <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
          {needed > 0
            ? `You need ${needed} more present day${needed > 1 ? 's' : ''} to be eligible (75% rule)`
            : "You're already eligible — attendance is above the 75% requirement ✓"}
        </p>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NEW: Achievement badges (computed from real record data only)
// ═════════════════════════════════════════════════════════════
const computeAchievements = (records, streak, os, monthHistory) => {
  const badges = []
  if (!records?.length) return badges

  // Perfect week: look at the most recent 5 weekday (Mon-Fri) records, all present
  const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date))
  const lastWeekdayRecords = sorted.filter(r => {
    const day = parseLocalDate(r.date).getDay()
    return day >= 1 && day <= 5
  }).slice(0, 5)
  if (lastWeekdayRecords.length === 5 && lastWeekdayRecords.every(r => r.status === 'Present')) {
    badges.push({ icon: '🏆', label: 'Perfect Week', desc: '5/5 present this week' })
  }

  if (streak >= 10) {
    badges.push({ icon: '🔥', label: 'Hot Streak', desc: `${streak}+ consecutive days` })
  }

  if ((os.percentage || 0) >= 90) {
    badges.push({ icon: '📚', label: 'Scholar', desc: '90%+ overall attendance' })
  }

  if (monthHistory?.length >= 2) {
    const change = monthHistory[monthHistory.length - 1].presentPct - monthHistory[monthHistory.length - 2].presentPct
    if (change >= 10) {
      badges.push({ icon: '⚡', label: 'Comeback', desc: `Improved ${change.toFixed(0)}% this month` })
    }
  }

  return badges
}

// ═════════════════════════════════════════════════════════════
// NEW: Week View (detailed strip for the currently selected week)
// ═════════════════════════════════════════════════════════════
const WeekView = ({ calendar, dark, onSelect, selected }) => {
  const [weekOffset, setWeekOffset] = useState(0)

  const weeks = useMemo(() => {
    if (!calendar?.length) return []
    const chunks = []
    let current = []
    calendar.forEach((c, i) => {
      const dow = parseLocalDate(c.date).getDay()
      if (dow === 0 && current.length) { chunks.push(current); current = [] }
      current.push(c)
      if (i === calendar.length - 1) chunks.push(current)
    })
    return chunks
  }, [calendar])

  // BUGFIX: reset to a valid week whenever the month (and thus the weeks
  // array) changes, instead of possibly pointing at an out-of-range index.
  useEffect(() => { setWeekOffset(0) }, [calendar])

  const maxOffset = Math.max(weeks.length - 1, 0)
  const clampedOffset = Math.min(weekOffset, maxOffset)
  const week = weeks[clampedOffset] || []

  if (!calendar?.length) return <p className="text-sm text-gray-400 text-center py-8">No data for this month.</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
          disabled={clampedOffset === 0}
          className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700"
        >←</button>
        <span className="text-xs font-black text-gray-500">Week {clampedOffset + 1} of {weeks.length}</span>
        <button
          onClick={() => setWeekOffset(o => Math.min(maxOffset, o + 1))}
          disabled={clampedOffset === maxOffset}
          className="w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700"
        >→</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map(cell => {
          const isSel = selected?.date === cell.date
          return (
            <button
              key={cell.date}
              onClick={() => onSelect(isSel ? null : cell)}
              className={`rounded-xl p-2.5 flex flex-col items-center gap-1 transition-all border ${
                isSel ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-800 scale-105' : 'border-transparent'
              } ${
                cell.status === 'Present' ? 'bg-green-100 dark:bg-green-900/40' :
                cell.status === 'Absent'  ? 'bg-red-100 dark:bg-red-900/40' :
                cell.status === 'Late'    ? 'bg-yellow-100 dark:bg-yellow-900/40' :
                'bg-gray-50 dark:bg-gray-700/30'
              }`}
            >
              <span className="text-[9px] font-black text-gray-400">
                {parseLocalDate(cell.date).toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
              <span className="text-lg">{STATUS_EMOJI[cell.status] || '·'}</span>
              <span className="text-[9px] text-gray-400 font-bold">{cell.time || '—'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NEW: Month mini-map (tiny dot grid, whole month at a glance)
// BUGFIX (#8): dots were 2px and unreadable once a month had 28-31 of
// them in a wrapped flex row. Bumped size, added spacing, and capped
// row width so the shape stays legible instead of blurring together.
// ═════════════════════════════════════════════════════════════
const MonthMiniMap = ({ calendar }) => {
  if (!calendar?.length) return null
  const colorFor = (status) =>
    status === 'Present' ? 'bg-green-400' :
    status === 'Absent'  ? 'bg-red-400'   :
    status === 'Late'    ? 'bg-yellow-400' : 'bg-gray-200 dark:bg-gray-700'
  return (
    <div className="grid grid-cols-7 gap-[3px] w-[126px]">
      {calendar.map(c => (
        <div
          key={c.date}
          title={`${c.date}: ${c.status || 'No class'}`}
          className={`w-4 h-4 rounded-[3px] ${colorFor(c.status)}`}
        />
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NEW: Hover card for a calendar cell (desktop mouseover popup)
// BUGFIX: clamp position so the card can't render off-screen when
// hovering cells near the right or bottom edge of the viewport.
// ═════════════════════════════════════════════════════════════
const HoverCard = ({ cell, position }) => {
  if (!cell) return null
  const CARD_W = 192 // matches w-48
  const CARD_H = 110 // approx rendered height
  const left = typeof window !== 'undefined' ? Math.min(position.x + 12, window.innerWidth - CARD_W - 12) : position.x + 12
  const top  = typeof window !== 'undefined' ? Math.min(position.y + 12, window.innerHeight - CARD_H - 12) : position.y + 12
  return (
    <div
      className="fixed z-50 bg-gray-950/95 backdrop-blur border border-gray-700/50 rounded-xl px-3.5 py-2.5 shadow-2xl text-xs pointer-events-none w-48"
      style={{ left, top }}
    >
      <p className="font-black text-white mb-1">
        📅 {parseLocalDate(cell.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
      </p>
      <p className="font-bold" style={{ color: cell.status === 'Present' ? '#4ade80' : cell.status === 'Absent' ? '#f87171' : cell.status === 'Late' ? '#fbbf24' : '#9ca3af' }}>
        Status: {cell.status || 'No class'} {STATUS_EMOJI[cell.status] || ''}
      </p>
      {cell.time && <p className="text-gray-300 mt-0.5">Time: {cell.time}</p>}
      {cell.markedBy && <p className="text-gray-400">Marked by: {cell.markedBy}</p>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════
const SAttendance = ({ student, dark }) => {
  // FIX 2: useState with initialiser fn — runs once, never stale
  const [month, setMonth]         = useState(getLocalMonth)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [monthChanging, setMonthChanging] = useState(false) // FIX 10: overlay spinner
  const [selected, setSelected]   = useState(null)
  const [focusedDate, setFocusedDate] = useState(null) // FIX 9: keyboard nav
  const [monthHistory, setMonthHistory] = useState([]) // Feature 16
  const calendarRef               = useRef(null)
  const token                     = student?.token

  // ═══ NEW STATE: calendar view mode, filters, search, sort, pagination, hover ═══
  const [calView, setCalView]         = useState('month') // 'month' | 'week' | 'list'
  const [statusFilter, setStatusFilter] = useState('All')
  const [quickFilter, setQuickFilter] = useState('All')
  const [searchDateRaw, setSearchDateRaw] = useState('') // BUGFIX: raw input, debounced below
  const [searchDate, setSearchDate]   = useState('')     // BUGFIX: debounced value actually used for filtering
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [sortKey, setSortKey]         = useState('date')
  const [sortDir, setSortDir]         = useState('desc')
  const [expandedRow, setExpandedRow] = useState(null)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [page, setPage]               = useState(1)
  const [hoverCell, setHoverCell]     = useState(null)
  const [hoverPos, setHoverPos]       = useState({ x: 0, y: 0 })
  const [bottomSheetCell, setBottomSheetCell] = useState(null) // mobile bottom sheet
  const [confettiFired, setConfettiFired] = useState(false)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const ROWS_PER_PAGE = 8

  // BUGFIX (#5 filters): debounce the search box so every keystroke doesn't
  // re-run filter+sort over the full record set.
  useEffect(() => {
    const t = setTimeout(() => setSearchDate(searchDateRaw), 250)
    return () => clearTimeout(t)
  }, [searchDateRaw])

  // FIX 3: currentMonth derived from state, not stale closure
  const currentMonthStr = getLocalMonth()
  const todayStr        = getLocalDate() // FIX 4: IST today

  // ── Fetch this month ─────────────────────────────────────────────
  const fetchAttendance = useCallback(async (targetMonth, isMonthChange = false) => {
    try {
      if (isMonthChange) setMonthChanging(true)
      else setLoading(true)

      const { data: res } = await axios.get(
        `${import.meta.env.VITE_API_URL}/students/me/attendance?month=${targetMonth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setData(res)
      setSelected(null)
    } catch {
      toast.error('Failed to load attendance.')
    } finally {
      setLoading(false)
      setMonthChanging(false)
    }
  }, [token])

  useEffect(() => {
    fetchAttendance(month)
  }, [month, fetchAttendance])

  // ── Fetch last 3 months history for comparison chart ─────────────
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const results = []
        for (let i = 2; i >= 0; i--) {
          const d  = new Date()
          d.setMonth(d.getMonth() - i)
          const m  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const mn = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
          const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/students/me/attendance?month=${m}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const ms = res.data?.monthStats
          results.push({
            month:      mn,
            presentPct: ms?.percentage   || 0,
            absentPct:  ms?.total > 0 ? parseFloat((ms.absent / ms.total * 100).toFixed(1)) : 0,
          })
        }
        setMonthHistory(results)
      } catch { /* optional feature */ }
    }
    fetchHistory()
  }, [token])

  // ── Month navigation ─────────────────────────────────────────────
  const changeMonth = useCallback((dir) => {
    setMonth(prevMonth => {
      const [y, m] = prevMonth.split('-').map(Number)
      const d      = new Date(y, m - 1 + dir, 1)
      const nm     = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      // FIX 3+8: compare against IST current month, not UTC
      if (nm > currentMonthStr) return prevMonth
      fetchAttendance(nm, true)
      return nm
    })
  }, [currentMonthStr, fetchAttendance])

  // ── FIX 6: useMemo for calendar grid ─────────────────────────────
  const calendarGrid = useMemo(() => {
    if (!data?.calendar) return []
    const firstDay = parseLocalDate(data.startDate).getDay()
    const grid     = []
    for (let i = 0; i < firstDay; i++) grid.push(null)
    grid.push(...data.calendar)
    return grid
  }, [data])

  // All non-null cells for keyboard nav
  const dateCells = useMemo(() =>
    (data?.calendar || []).map(c => c.date),
    [data]
  )

  // ── FIX 9: Keyboard navigation ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!data?.calendar?.length) return
      // BUGFIX: don't hijack arrow keys/Enter/Escape while the user is
      // typing in a text/date/search input (search box, date range pickers).
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const idx = focusedDate ? dateCells.indexOf(focusedDate) : -1

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const next = Math.min(idx + 1, dateCells.length - 1)
        setFocusedDate(dateCells[next])
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const prev = Math.max(idx - 1, 0)
        setFocusedDate(dateCells[prev])
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min(idx + 7, dateCells.length - 1)
        setFocusedDate(dateCells[next])
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = Math.max(idx - 7, 0)
        setFocusedDate(dateCells[prev])
      } else if (e.key === 'Enter' && focusedDate) {
        const cell = data.calendar.find(c => c.date === focusedDate)
        if (cell) setSelected(prev => prev?.date === cell.date ? null : cell)
      } else if (e.key === 'Escape') {
        setSelected(null)
        setFocusedDate(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusedDate, dateCells, data])

  // ═══ NEW: Swipe gestures on calendar container (mobile) ═══
  // BUGFIX: removed the dead "|| true" branch — swipe-right always tried
  // to go to the previous month; the `month < currentMonthStr` condition
  // was checked but its own OR'd `true` made it unconditional anyway,
  // which was misleading dead logic left in from an earlier draft.
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) changeMonth(1)   // swipe left → next month
      else changeMonth(-1)         // swipe right → prev month
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  // ── Export Excel ─────────────────────────────────────────────────
  const exportExcel = () => {
    if (!data?.records?.length) { toast.error('No data to export.'); return }
    const ws = XLSX.utils.aoa_to_sheet([
      ['Attendance Report'],
      [`Student: ${student.name} | Roll: ${student.rollNo} | ${student.class}${student.section ? `-${student.section}` : ''}`],
      [`Month: ${month} | Month %: ${fmtPct(data.monthStats?.percentage)}% | Overall %: ${fmtPct(data.overallStats?.percentage)}%`],
      [],
      // FIX 12: Remark column added
      ['Date', 'Day', 'Status', 'Time', 'Marked By', 'Remark'],
      ...data.records.map(r => [
        r.date,
        parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday: 'long' }),
        r.status, r.time || '-', r.markedBy || '-', r.remark || '-',
      ]),
    ])
    ws['!cols'] = [12, 12, 10, 8, 18, 22].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `attendance_${student.rollNo}_${month}.xlsx`)
    toast.success('Excel exported!')
  }

  // ═══ NEW: Export only selected rows (bulk export with selection) ═══
  const exportSelectedExcel = () => {
    if (!selectedRows.size) { toast.error('No rows selected.'); return }
    const rows = data.records.filter(r => selectedRows.has(r.date))
    const ws = XLSX.utils.aoa_to_sheet([
      ['Attendance Report — Selected Records'],
      [`Student: ${student.name} | Roll: ${student.rollNo}`],
      [],
      ['Date', 'Day', 'Status', 'Time', 'Marked By', 'Remark'],
      ...rows.map(r => [
        r.date,
        parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday: 'long' }),
        r.status, r.time || '-', r.markedBy || '-', r.remark || '-',
      ]),
    ])
    ws['!cols'] = [12, 12, 10, 8, 18, 22].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Selected')
    XLSX.writeFile(wb, `attendance_selected_${student.rollNo}_${month}.xlsx`)
    toast.success(`${rows.length} record(s) exported!`)
  }

  // ── Export PDF — FIX 5: null check + monthStats only ─────────────
  const exportPDF = () => {
    if (!data?.records?.length) { toast.error('No data to export.'); return }
    const ms = data.monthStats   || {}
    const os = data.overallStats || {}
    const doc = new jsPDF()
    doc.setFontSize(16); doc.setTextColor(16, 185, 129)
    doc.text('My Attendance Report', 14, 18)
    doc.setFontSize(10); doc.setTextColor(100)
    doc.text(
      `${student.name} | Roll: ${student.rollNo} | ${student.class}${student.section ? `-${student.section}` : ''}`,
      14, 27
    )
    // FIX 5: safe optional chaining + fallback 0
    doc.text(
      `Month: ${month} | Present: ${ms.present ?? 0} | Absent: ${ms.absent ?? 0} | Late: ${ms.late ?? 0} | Month %: ${fmtPct(ms.percentage)}%`,
      14, 34
    )
    doc.text(`Overall Attendance: ${fmtPct(os.percentage)}% (${os.total ?? 0} total classes)`, 14, 41)
    autoTable(doc, {
      startY: 47,
      // FIX 12: Remark column added
      head:  [['Date', 'Day', 'Status', 'Time', 'Marked By', 'Remark']],
      body:   data.records.map(r => [
        r.date,
        parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday: 'short' }),
        r.status, r.time || '-', r.markedBy || '-', r.remark || '-',
      ]),
      headStyles:          { fillColor: [16, 185, 129], textColor: 255 },
      alternateRowStyles:  { fillColor: [240, 253, 244] },
      styles:              { fontSize: 8.5 },
      columnStyles:        { 5: { cellWidth: 35 } },
    })
    doc.save(`attendance_${student.rollNo}_${month}.pdf`)
    toast.success('PDF exported!')
  }

  // ═══ NEW: Copy to clipboard (text summary) ═══
  const copySummary = async () => {
    const ms = data?.monthStats || {}
    const os = data?.overallStats || {}
    const text = `📅 Attendance Summary — ${student.name} (Roll ${student.rollNo})
Month: ${month}
Present: ${ms.present ?? 0} | Absent: ${ms.absent ?? 0} | Late: ${ms.late ?? 0}
Month %: ${fmtPct(ms.percentage)}%
Overall: ${fmtPct(os.percentage)}% (${os.total ?? 0} total classes)
Status: ${(os.percentage || 0) >= 75 ? 'Above requirement ✓' : 'Below 75% requirement ⚠️'}`
    // BUGFIX: navigator.clipboard requires a secure context (https/localhost)
    // and can be missing entirely in some in-app/webview browsers — added a
    // manual-copy fallback instead of only showing a dead-end error toast.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        toast.success('Summary copied to clipboard!')
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus(); ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (ok) toast.success('Summary copied to clipboard!')
        else toast.error('Could not copy — please copy manually.')
      }
    } catch {
      toast.error('Could not copy — clipboard not available.')
    }
  }

  // ═══ NEW: WhatsApp share (uses wa.me share intent, opens in new tab) ═══
  const shareWhatsApp = () => {
    const os = data?.overallStats || {}
    const text = encodeURIComponent(
      `📅 My Attendance: ${fmtPct(os.percentage)}% overall (${student.name}, Roll ${student.rollNo}) — ${month}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  // ═══ NEW: Email share (mailto) ═══
  const shareEmail = () => {
    const ms = data?.monthStats || {}
    const os = data?.overallStats || {}
    const subject = encodeURIComponent(`Attendance Report — ${student.name} (${month})`)
    const body = encodeURIComponent(
      `Month: ${month}\nPresent: ${ms.present ?? 0} | Absent: ${ms.absent ?? 0} | Late: ${ms.late ?? 0}\nMonth %: ${fmtPct(ms.percentage)}%\nOverall %: ${fmtPct(os.percentage)}%`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  // ── Share / Download Summary Card as PNG ─────────────────────────
  const shareCard = async () => {
    const ms       = data?.monthStats || {}
    const os       = data?.overallStats || {}
    const canvas   = document.createElement('canvas')
    canvas.width   = 800; canvas.height = 420
    const ctx      = canvas.getContext('2d')

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 800, 420)
    grad.addColorStop(0, '#064e3b'); grad.addColorStop(1, '#065f46')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 800, 420)

    // Header band
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, 800, 80)

    // Title
    ctx.fillStyle = '#6ee7b7'; ctx.font = 'bold 14px sans-serif'
    ctx.fillText('VIRTUAL ATTENDANCE SYSTEM', 40, 32)
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px sans-serif'
    ctx.fillText('My Attendance Card', 40, 58)

    // Student info
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '13px sans-serif'
    ctx.fillText(`${student.name}  •  Roll: ${student.rollNo}  •  ${student.class}${student.section ? `-${student.section}` : ''}`, 40, 100)
    ctx.fillText(`Month: ${parseLocalDate(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`, 40, 120)

    // Big percentage
    const pct   = ms.percentage || 0
    const color = pct >= 75 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#f87171'
    ctx.fillStyle = color; ctx.font = 'bold 88px sans-serif'
    ctx.fillText(`${fmtPct(pct)}%`, 40, 230)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '14px sans-serif'
    ctx.fillText('Monthly Attendance', 40, 255)

    // Stats row
    const stats = [
      { label: 'Present',       value: ms.present  || 0, x: 40  },
      { label: 'Absent',        value: ms.absent   || 0, x: 200 },
      { label: 'Late',          value: ms.late     || 0, x: 360 },
      { label: 'Overall %',     value: `${fmtPct(os.percentage)}%`, x: 520 },
    ]
    stats.forEach(s => {
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 32px sans-serif'
      ctx.fillText(String(s.value), s.x, 320)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px sans-serif'
      ctx.fillText(s.label, s.x, 342)
    })

    // Status badge
    const badgeColor = pct >= 75 ? '#059669' : '#dc2626'
    const badgeText  = pct >= 75 ? '✓ Above Requirement' : '✗ Below Requirement'
    ctx.fillStyle = badgeColor; ctx.roundRect(40, 365, 200, 30, 8); ctx.fill()
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif'
    ctx.fillText(badgeText, 55, 385)

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(0, 400, 800, 20)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px sans-serif'
    ctx.fillText(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 40, 415)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('Virtual Attendance System', 620, 415)

    // Download
    const link    = document.createElement('a')
    link.download = `attendance_card_${student.rollNo}_${month}.png`
    link.href     = canvas.toDataURL('image/png')
    link.click()
    toast.success('Attendance card downloaded!')
  }

  // ── Derived values ────────────────────────────────────────────────
  const ms  = data?.monthStats   || {}
  const os  = data?.overallStats || {}
  // BUGFIX (#2/#14): pct is now the single source of truth for the
  // headline percentage everywhere (rounded for display via fmtPct),
  // instead of separate components each formatting os.percentage
  // slightly differently.
  const pct = os.percentage || 0

  // Feature 14: Streak from recent activity
  const streak = useMemo(() => {
    if (!data?.records) return 0
    const sorted = [...data.records].sort((a, b) => new Date(b.date) - new Date(a.date))
    let s = 0
    for (const r of sorted) {
      if (r.status === 'Present' || r.status === 'Late') s++
      else break
    }
    return s
  }, [data])

  const monthName = parseLocalDate(month + '-01')
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  // ═══ NEW: Best month from history ═══
  const bestMonth = useMemo(() => {
    if (!monthHistory.length) return null
    return monthHistory.reduce((a, b) => (b.presentPct > a.presentPct ? b : a), monthHistory[0])
  }, [monthHistory])

  // ═══ NEW: Health grade + warning tier ═══
  const health  = useMemo(() => getHealthGrade(pct), [pct])
  const warning = useMemo(() => getWarningTier(pct), [pct])

  // ═══ NEW: Class rank — ONLY rendered if backend actually supplies it.
  // No fake classmates / leaderboard data is invented; if data.classRank or
  // data.leaderboard is absent, these UI sections simply don't render. ═══
  const classRank   = data?.classRank || null       // e.g. { rank: 5, totalStudents: 40 }
  const leaderboard = data?.leaderboard || null      // e.g. [{ name, percentage }, ...] — real API data only
  const examDate    = data?.examDate || null         // real date string from backend if available

  // ═══ NEW: Achievements ═══
  const achievements = useMemo(
    () => computeAchievements(data?.records, streak, os, monthHistory),
    [data, streak, os, monthHistory]
  )

  // ═══ NEW: Confetti trigger — fires once per month load when pct >= 75 ═══
  useEffect(() => {
    if (!loading && !monthChanging && pct >= 75 && pct > 0) {
      setConfettiFired(true)
      const t = setTimeout(() => setConfettiFired(false), 3000)
      return () => clearTimeout(t)
    }
  }, [loading, monthChanging, month]) // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ NEW: Filtered + searched + sorted records (for table + list view) ═══
  // BUGFIX (#1 filters): statusFilter (dropdown) and quickFilter (chips) used
  // to both apply independently and could silently cancel each other out
  // (e.g. dropdown=Present + chip=Absent => always empty, no explanation).
  // Quick-filter chips now ALWAYS drive status when a status-type chip is
  // active, and selecting a status chip resets the dropdown to "All" so
  // there is only ever one active status filter at a time (see chip
  // onClick handlers below). This memo also now uses parseLocalDate
  // everywhere instead of new Date(r.date) to stay IST-safe.
  const filteredRecords = useMemo(() => {
    let rows = [...(data?.records || [])]

    // status filter (dropdown) — only applied when no status-type quick
    // filter chip is overriding it, so the two can't fight each other.
    const quickIsStatus = ['Present', 'Absent', 'Late'].includes(quickFilter)
    if (!quickIsStatus && statusFilter !== 'All') {
      rows = rows.filter(r => r.status === statusFilter)
    }

    // quick filter chips
    const today = parseLocalDate(todayStr)
    if (quickFilter === 'This Week') {
      const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7)
      rows = rows.filter(r => parseLocalDate(r.date) >= weekAgo)
    } else if (quickFilter === 'This Month') {
      rows = rows.filter(r => r.date.startsWith(month))
    } else if (quickFilter === 'Last Month') {
      const [y, m] = month.split('-').map(Number)
      // BUGFIX (#3 filters): Date(y, -1, 1) rolling into December of the
      // previous year is correct JS behaviour, but it was undocumented and
      // fragile-looking. Made the year-rollover explicit so it can't be
      // "fixed" into a bug by a future refactor.
      const lmYear  = m === 1 ? y - 1 : y
      const lmMonth = m === 1 ? 12 : m - 1
      const lm = `${lmYear}-${String(lmMonth).padStart(2, '0')}`
      rows = rows.filter(r => r.date.startsWith(lm))
    } else if (quickIsStatus) {
      rows = rows.filter(r => r.status === quickFilter)
    }

    // date range picker
    if (dateFrom) rows = rows.filter(r => r.date >= dateFrom)
    if (dateTo)   rows = rows.filter(r => r.date <= dateTo)

    // search by date/text (debounced value)
    if (searchDate.trim()) {
      const q = searchDate.trim().toLowerCase()
      rows = rows.filter(r =>
        r.date.includes(q) ||
        (r.markedBy || '').toLowerCase().includes(q) ||
        (r.remark || '').toLowerCase().includes(q) ||
        parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday: 'long' }).toLowerCase().includes(q)
      )
    }

    // sort
    rows.sort((a, b) => {
      let av, bv
      if (sortKey === 'date')        { av = a.date; bv = b.date }
      else if (sortKey === 'day')    { av = parseLocalDate(a.date).getDay(); bv = parseLocalDate(b.date).getDay() }
      else if (sortKey === 'status') { av = a.status || ''; bv = b.status || '' }
      else if (sortKey === 'time')   { av = a.time || ''; bv = b.time || '' }
      else if (sortKey === 'markedBy') { av = a.markedBy || ''; bv = b.markedBy || '' }
      else { av = a.date; bv = b.date }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [data, statusFilter, quickFilter, dateFrom, dateTo, searchDate, sortKey, sortDir, month, todayStr])

  // reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [statusFilter, quickFilter, dateFrom, dateTo, searchDate, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ROWS_PER_PAGE))
  const clampedPage = Math.min(page, totalPages)
  const pagedRecords = filteredRecords.slice((clampedPage - 1) * ROWS_PER_PAGE, clampedPage * ROWS_PER_PAGE)

  // BUGFIX (#4 filters): sort direction now defaults sensibly per column
  // instead of always keeping whatever "asc/desc" was last used for a
  // totally different field (e.g. Status "Desc" meaningfully reversed
  // alphabetical order with no relation to severity/priority before).
  const toggleSort = (key) => {
    if (sortKey === key) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return }
    setSortKey(key)
    // date/time: newest first by default. status/markedBy: A→Z first by default.
    setSortDir(key === 'date' || key === 'time' ? 'desc' : 'asc')
  }

  // BUGFIX: quick-filter chip clicks that represent a status now clear the
  // status dropdown back to "All" (and vice versa) so the two controls
  // can never point at contradictory values at the same time.
  const handleQuickFilterClick = (chip) => {
    setQuickFilter(chip)
    if (['Present', 'Absent', 'Late'].includes(chip)) setStatusFilter('All')
  }
  const handleStatusDropdownChange = (value) => {
    setStatusFilter(value)
    if (value !== 'All' && ['Present', 'Absent', 'Late'].includes(quickFilter)) setQuickFilter('All')
  }

  const toggleRowSelect = (date) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedRows.size === pagedRecords.length && pagedRecords.length > 0) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(pagedRecords.map(r => r.date)))
    }
  }

  const clearAllFilters = () => {
    setDateFrom(''); setDateTo(''); setSearchDateRaw(''); setSearchDate('')
    setStatusFilter('All'); setQuickFilter('All')
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-9" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  )

  return (
    <div className="space-y-5 relative">
      <ConfettiBurst fire={confettiFired} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-white">📅 My Attendance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {student.class}{student.section ? `-${student.section}` : ''} • Roll {student.rollNo}
            {streak > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-[10px] font-black">
                🔥 {streak} day streak
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportExcel}
            className="h-9 px-3 rounded-xl border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all hover:scale-105 active:scale-95">
            📊 Excel
          </button>
          <button onClick={exportPDF}
            className="h-9 px-3 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all hover:scale-105 active:scale-95">
            📄 PDF
          </button>
          <button onClick={shareCard}
            className="h-9 px-3 rounded-xl border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all hover:scale-105 active:scale-95">
            🖼️ Card
          </button>
          <button onClick={copySummary}
            className="h-9 px-3 rounded-xl border border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all hover:scale-105 active:scale-95">
            📋 Copy
          </button>
          <button onClick={shareWhatsApp}
            className="h-9 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all hover:scale-105 active:scale-95">
            📱 WhatsApp
          </button>
          <button onClick={shareEmail}
            className="h-9 px-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-xs font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:scale-105 active:scale-95">
            📧 Email
          </button>
        </div>
      </div>

      {/* ═══ NEW: Smart Analytics Dashboard — 5-metric score card ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <GlassStat icon="🎯" value={pct} suffix="%" decimals={pct % 1 !== 0 ? 1 : 0} label="Overall" tint="emerald" />
        <GlassStat icon="🔥" value={streak} label="Streak" tint="orange" />
        {/* BUGFIX (#1): rank card is now hidden entirely (not shown as a
            permanent dead "—") when the backend hasn't supplied classRank,
            since a metric that can never populate shouldn't occupy a slot
            in a "5-metric" dashboard implying 5 live numbers. */}
        {classRank ? (
          <GlassStat icon="🏅" value={`#${classRank.rank}/${classRank.totalStudents}`} label="Rank" tint="indigo" isText />
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-3.5 text-center flex flex-col items-center justify-center opacity-60">
            <div className="text-lg mb-0.5">🏅</div>
            <p className="text-[10px] text-gray-400 font-bold">Rank unavailable</p>
          </div>
        )}
        <GlassStat
          icon="📅"
          value={classesNeededFor(os.present || 0, os.total || 0, 0.75) > 0
            ? `${classesNeededFor(os.present || 0, os.total || 0, 0.75)}d`
            : '✓'}
          label="To 75%" tint="amber" isText
        />
        <GlassStat
          icon="⭐"
          value={bestMonth ? `${fmtPct(bestMonth.presentPct)}%` : '—'}
          label={bestMonth ? `Best (${bestMonth.month})` : 'Best Month'} tint="rose" isText
        />
      </div>

      {/* ═══ NEW: Attendance Health Score ═══ */}
      <div className={`rounded-2xl border p-5 bg-gradient-to-br ${health.bg} border-gray-200 dark:border-gray-700 backdrop-blur-xl relative overflow-hidden`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0 shadow-lg"
            style={{ backgroundColor: `${health.color}22`, color: health.color, border: `2px solid ${health.color}55` }}>
            {health.grade}
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-gray-800 dark:text-white">
              Your Attendance Health: <span style={{ color: health.color }}>{health.grade}</span> ({fmtPct(pct)}%)
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{health.label}</p>
          </div>
        </div>
      </div>

      {/* ═══ NEW: Smart 3-level warning banner (replaces the old single banner, keeps same logic) ═══ */}
      <div className={`rounded-2xl p-4 border flex items-start gap-3 ${warning.bg} ${warning.border}`}>
        <span className="text-2xl flex-shrink-0">{warning.emoji}</span>
        <div className="flex-1">
          <p className={`text-sm font-black ${warning.color}`}>
            {warning.label} — Your overall attendance is {fmtPct(pct)}%
          </p>
          <p className={`text-xs mt-0.5 ${warning.color} opacity-90`}>
            {warning.msg}.
            {pct < 75 && (() => {
              const needed = classesNeededFor(os.present || 0, os.total || 0, 0.75)
              return needed > 0 ? ` Attend ${needed} more consecutive classes to reach 75%.` : ''
            })()}
          </p>
          <div className="mt-2 bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: warning.tier === 'safe' ? '#22c55e' : warning.tier === 'caution' ? '#f59e0b' : '#ef4444' }} />
          </div>
        </div>
      </div>

      {/* ── Top Summary Row — Progress Ring + Stats ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Feature 13: Animated Progress Ring */}
          <ProgressRing pct={pct} size={110} stroke={10} dark={dark} />

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:'Month Present', value:ms.present||0, color:'text-green-600', bg:'bg-green-50 dark:bg-green-900/20' },
              { label:'Month Absent',  value:ms.absent||0,  color:'text-red-500',   bg:'bg-red-50 dark:bg-red-900/20'   },
              { label:'Month Late',    value:ms.late||0,    color:'text-yellow-600', bg:'bg-yellow-50 dark:bg-yellow-900/20' },
              { label:'Month %',       value:`${fmtPct(ms.percentage)}%`,
                color: (ms.percentage||0)>=75?'text-green-600':'text-red-500',
                bg:'bg-indigo-50 dark:bg-indigo-900/20' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-xl p-3 text-center transition-transform hover:scale-105 duration-300`}>
                <p className={`text-2xl font-black ${s.color}`}>
                  {typeof s.value === 'number' ? <CountUp value={s.value} /> : s.value}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-500 font-medium">Overall Progress ({os.total||0} total classes)</span>
            <span className={`font-black ${pct>=75?'text-green-600':pct>=60?'text-yellow-500':'text-red-500'}`}>{fmtPct(pct)}%</span>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            {/* 75% marker */}
            <div className="relative h-full">
              <div className={`h-full rounded-full transition-all duration-1000 ${
                pct>=75?'bg-gradient-to-r from-green-400 to-emerald-500':
                pct>=60?'bg-gradient-to-r from-yellow-400 to-amber-500':
                'bg-gradient-to-r from-red-400 to-rose-500'
              }`} style={{ width:`${Math.min(pct, 100)}%` }} />
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>0%</span>
            <span className="text-orange-400 font-bold">← 75% Required</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* ═══ NEW: Exam Eligibility Countdown ═══ */}
      <ExamCountdown os={os} examDate={examDate} />

      {/* ═══ NEW: What-If Calculator ═══ */}
      <WhatIfCalculator os={os} headlinePct={pct} />

      {/* ═══ NEW: Achievement Badges (only shows if any earned) ═══ */}
      {achievements.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 dark:text-white mb-4">🏆 Achievement Badges</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {achievements.map((a, i) => (
              <div key={i} className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 text-center transition-transform hover:scale-105 duration-300">
                <div className="text-2xl mb-1">{a.icon}</div>
                <p className="text-xs font-black text-gray-700 dark:text-gray-200">{a.label}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ NEW: Leaderboard — ONLY renders if backend actually provides data.leaderboard.
           No fake classmate names/scores are fabricated. ═══ */}
      {leaderboard?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 dark:text-white mb-4">🏅 Your Class Ranking</h3>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((entry, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
              const isMe = entry.name === student.name || entry.isCurrentUser
              return (
                <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                  isMe ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-50 dark:bg-gray-700/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black w-7">{medal}</span>
                    <span className={`text-sm font-bold ${isMe ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-300'}`}>
                      {isMe ? `${entry.name} (You)` : entry.name}
                    </span>
                  </div>
                  <span className={`text-sm font-black ${isMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                    {fmtPct(entry.percentage)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ NEW: Ultra Smart Filters Bar ═══
          BUGFIX: status dropdown and quick chips are now cross-wired via
          handleStatusDropdownChange/handleQuickFilterClick so they can never
          silently contradict each other and produce an unexplained empty list. */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={statusFilter} onChange={e => handleStatusDropdownChange(e.target.value)}
            className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-bold text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <option value="All">All Status</option>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Late">Late</option>
          </select>
          <select value={sortKey} onChange={e => toggleSort(e.target.value)}
            className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-bold text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <option value="date">Sort: Date</option>
            <option value="status">Sort: Status</option>
            <option value="time">Sort: Time</option>
            <option value="markedBy">Sort: Teacher</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortKey === 'status' || sortKey === 'markedBy' ? 'A→Z / Z→A' : 'Oldest↔Newest'}
            className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
          <div className="relative flex-1 min-w-[160px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">🔍</span>
            <input
              value={searchDateRaw} onChange={e => setSearchDateRaw(e.target.value)}
              placeholder="Search by date, teacher, remark..."
              className="w-full h-9 pl-8 pr-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-medium text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Quick filter chips */}
        <div className="flex flex-wrap gap-2">
          {['All','Present','Absent','Late','This Week','This Month','Last Month'].map(chip => (
            <button key={chip} onClick={() => handleQuickFilterClick(chip)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                quickFilter === chip
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              {chip}
            </button>
          ))}
        </div>

        {/* Date range picker */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
          <span className="text-[11px] text-gray-400 font-bold">Range:</span>
          {/* BUGFIX (#6): native date input placeholder format is
              browser/locale-dependent ("dd-mm-yyyy" was just Chrome's
              default rendering, not something the app controls) — added
              an explicit label so the expected format is unambiguous
              regardless of browser. */}
          <label className="flex items-center gap-1 text-[11px] text-gray-400">
            From
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="h-8 px-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-[11px] text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </label>
          <span className="text-[11px] text-gray-400">to</span>
          <label className="flex items-center gap-1 text-[11px] text-gray-400">
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="h-8 px-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-[11px] text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </label>
          {(dateFrom || dateTo || searchDateRaw || statusFilter !== 'All' || quickFilter !== 'All') && (
            <button onClick={clearAllFilters}
              className="ml-auto text-[11px] font-bold text-red-500 hover:text-red-600">
              ✕ Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Month Navigator + Calendar (multi-view) ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

        {/* View switcher */}
        <div className="flex items-center justify-between px-5 pt-4 flex-wrap gap-2">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1">
            {['month','week','list'].map(v => (
              <button key={v} onClick={() => setCalView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black capitalize transition-all ${
                  calView === v ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-400'
                }`}>
                {v} View
              </button>
            ))}
          </div>
          {/* Mini-map (desktop only, month view) */}
          {calView === 'month' && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-bold">Month at a glance:</span>
              <MonthMiniMap calendar={data?.calendar} />
            </div>
          )}
        </div>

        {/* Month nav header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 mt-1">
          <button onClick={() => changeMonth(-1)}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold text-lg active:scale-90">
            ←
          </button>
          <div className="text-center">
            <h3 className="text-base font-black text-gray-800 dark:text-white">{monthName}</h3>
            {/* FIX 10: Month-change overlay hint */}
            {monthChanging && (
              <div className="flex items-center gap-1.5 justify-center mt-0.5">
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-emerald-500 font-medium">Loading...</span>
              </div>
            )}
          </div>
          <button onClick={() => changeMonth(1)}
            // FIX 3+8: IST-safe future month block
            disabled={month >= currentMonthStr}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-90">
            →
          </button>
        </div>

        {/* Keyboard + swipe hint */}
        <div className="px-5 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
          <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">⌨️</span>
          <span className="text-xs text-indigo-500 dark:text-indigo-400 hidden sm:inline">
            Use arrow keys to navigate dates · Enter to select · Esc to close
          </span>
          <span className="text-xs text-indigo-500 dark:text-indigo-400 sm:hidden">
            👆 Swipe left/right to change month
          </span>
        </div>

        <div
          className={`p-5 transition-opacity duration-200 ${monthChanging ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* ═══ MONTH VIEW (original grid, enhanced with hover cards + bottom sheet) ═══ */}
          {calView === 'month' && (
            <>
              {/* Day labels */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1" ref={calendarRef}>
                {calendarGrid.map((cell, i) => {
                  if (!cell) return <div key={i} />
                  const isSel     = selected?.date === cell.date
                  // FIX 4+7: IST today, not UTC
                  const isToday   = cell.date === todayStr
                  const isFocused = focusedDate === cell.date
                  // BUGFIX (#7): future dates (after today, with no status
                  // yet recorded) now get a visually distinct "upcoming"
                  // look instead of blending into the same flat grey as
                  // "no data"/holiday cells — so an empty month doesn't
                  // look broken.
                  const isFuture  = !cell.status && cell.date > todayStr

                  return (
                    <button key={i}
                      onClick={() => {
                        setSelected(isSel ? null : cell)
                        setFocusedDate(cell.date)
                        setBottomSheetCell(cell) // mobile bottom sheet
                      }}
                      onFocus={() => setFocusedDate(cell.date)}
                      onMouseEnter={(e) => { setHoverCell(cell); setHoverPos({ x: e.clientX, y: e.clientY }) }}
                      onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoverCell(null)}
                      tabIndex={0}
                      className={`
                        aspect-square rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5
                        focus:outline-none hover:scale-105
                        ${isSel     ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-800 scale-110 z-10' : ''}
                        ${isFocused && !isSel ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-800' : ''}
                        ${isToday   ? 'ring-1 ring-indigo-500 ring-offset-1' : ''}
                        ${cell.status === 'Present' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 hover:bg-green-200 dark:hover:bg-green-900/60' :
                          cell.status === 'Absent'  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 hover:bg-red-200 dark:hover:bg-red-900/60' :
                          cell.status === 'Late'    ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-900/60' :
                          isFuture                  ? 'bg-white dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-default' :
                          cell.isWeekend            ? 'bg-gray-100 dark:bg-gray-700/30 text-gray-300 dark:text-gray-600 cursor-default' :
                          'bg-gray-50 dark:bg-gray-700/20 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/40'
                        }
                      `}>
                      <span className={`text-[10px] leading-none font-black ${isToday ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                        {cell.day}
                      </span>
                      <span className="text-[9px] leading-none">
                        {STATUS_EMOJI[cell.status] || ''}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mt-3 justify-center flex-wrap">
                {[
                  ['bg-green-200 dark:bg-green-900/60','Present'],
                  ['bg-red-200 dark:bg-red-900/60','Absent'],
                  ['bg-yellow-200 dark:bg-yellow-900/60','Late'],
                  ['bg-gray-100 dark:bg-gray-700/30','No Class'],
                  ['bg-white dark:bg-gray-800/40 border border-dashed border-gray-300 dark:border-gray-600','Upcoming'],
                  ['ring-1 ring-indigo-500 bg-white dark:bg-gray-800','Today'],
                ].map(([cls, label]) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-3.5 h-3.5 rounded-md ${cls}`} />
                    <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                  </div>
                ))}
              </div>

              {/* Selected date detail popup (desktop) */}
              {selected && (
                <div className={`mt-4 p-4 rounded-xl border hidden sm:flex items-start justify-between gap-3 ${STATUS_BG[selected.status] || 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 text-gray-500'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{STATUS_EMOJI[selected.status] || '📅'}</span>
                    <div>
                      <p className="text-sm font-black text-gray-800 dark:text-white">
                        {parseLocalDate(selected.date).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
                      </p>
                      <p className={`text-xs font-bold mt-0.5 ${STATUS_COLOR[selected.status] || 'text-gray-400'}`}>
                        {selected.status || 'No Class / Holiday'}
                      </p>
                      {selected.time     && <p className="text-xs text-gray-400 mt-0.5">⏰ Time: {selected.time}</p>}
                      {selected.markedBy && <p className="text-xs text-gray-400">👤 Marked by: {selected.markedBy}</p>}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="text-gray-400 hover:text-gray-600 font-bold text-lg flex-shrink-0 leading-none">✕</button>
                </div>
              )}
            </>
          )}

          {/* ═══ WEEK VIEW ═══ */}
          {calView === 'week' && (
            <WeekView calendar={data?.calendar} dark={dark} onSelect={setSelected} selected={selected} />
          )}

          {/* ═══ LIST VIEW ═══ */}
          {calView === 'list' && (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {filteredRecords.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No records match your filters.</p>
              )}
              {filteredRecords.map(r => (
                <button key={r.date} onClick={() => setSelected(prev => prev?.date === r.date ? null : r)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                    selected?.date === r.date ? 'ring-2 ring-emerald-500' : 'border-gray-100 dark:border-gray-700'
                  } ${
                    r.status === 'Present' ? 'bg-green-50/60 dark:bg-green-900/10' :
                    r.status === 'Absent'  ? 'bg-red-50/60 dark:bg-red-900/10' :
                    'bg-yellow-50/60 dark:bg-yellow-900/10'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{STATUS_EMOJI[r.status]}</span>
                    <div>
                      <p className="text-xs font-black text-gray-700 dark:text-gray-200">
                        {parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' })}
                      </p>
                      <p className="text-[10px] text-gray-400">{r.markedBy || 'Not marked'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">{r.time || '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ NEW: Hover card (desktop only, appears near cursor) ═══ */}
      <div className="hidden sm:block">
        <HoverCard cell={hoverCell} position={hoverPos} />
      </div>

      {/* ═══ NEW: Mobile bottom sheet for date details ═══ */}
      {bottomSheetCell && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end" onClick={() => setBottomSheetCell(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" />
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full bg-white dark:bg-gray-800 rounded-t-3xl p-5 pb-8 shadow-2xl animate-[slideUp_0.25s_ease]"
          >
            <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <div className="flex items-start gap-3">
              <span className="text-3xl flex-shrink-0">{STATUS_EMOJI[bottomSheetCell.status] || '📅'}</span>
              <div className="flex-1">
                <p className="text-base font-black text-gray-800 dark:text-white">
                  {parseLocalDate(bottomSheetCell.date).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
                </p>
                <p className={`text-sm font-bold mt-1 ${STATUS_COLOR[bottomSheetCell.status] || 'text-gray-400'}`}>
                  {bottomSheetCell.status || 'No Class / Holiday'}
                </p>
                {bottomSheetCell.time     && <p className="text-xs text-gray-400 mt-1.5">⏰ Time: {bottomSheetCell.time}</p>}
                {bottomSheetCell.markedBy && <p className="text-xs text-gray-400 mt-0.5">👤 Marked by: {bottomSheetCell.markedBy}</p>}
                {bottomSheetCell.remark   && <p className="text-xs text-gray-400 mt-0.5">📝 {bottomSheetCell.remark}</p>}
              </div>
            </div>
            <button onClick={() => setBottomSheetCell(null)}
              className="mt-5 w-full h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Feature 16: Month Comparison Chart */}
      {monthHistory.length > 0 && (
        <MonthComparisonChart history={monthHistory} dark={dark} />
      )}

      {/* ═══ NEW: Velocity chart ═══ */}
      <VelocityChart history={monthHistory} dark={dark} />

      {/* ═══ NEW: Weekday analysis + hourly pattern (side-by-side on desktop) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WeekdayAnalysisChart records={data?.records} dark={dark} />
        <HourlyPatternChart records={data?.records} dark={dark} />
      </div>

      {/* FIX 11: Trend card — null-safe fallback */}
      {data?.trend ? (
        <div className={`rounded-2xl p-4 border flex items-center gap-3 ${
          data.trend.improving
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <span className="text-2xl">{data.trend.improving ? '📈' : '📉'}</span>
          <div>
            {/* BUGFIX (#11): "declined -45.3%" read as a confusing double
                negative. Now always shows a plain magnitude with the
                direction stated in words once, never a signed number
                next to a word that already implies the sign. */}
            <p className={`text-sm font-black ${data.trend.improving ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {data.trend.improving ? 'Great! Attendance improved' : 'Attention! Attendance declined'} by {fmtPct(Math.abs(data.trend.change))}% vs last month
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Last month: {fmtPct(data.trend.previousMonth)}% → This month: {fmtPct(data.trend.currentMonth)}%
            </p>
          </div>
        </div>
      ) : (
        // FIX 11: graceful fallback if trend data missing
        <div className="rounded-2xl p-4 border bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <span className="text-xl">📊</span>
          <p className="text-sm text-gray-500 dark:text-gray-400">Trend data not available for this month.</p>
        </div>
      )}

      {/* ═══ NEW: Alert Center — consolidates smart alerts ═══
          BUGFIX (#10): the "3 same-weekday absences in a row" check used
          to require 3 records on the SAME weekday before it could ever
          fire — meaningless this early in a semester. It's now a
          "2+ absences on the same weekday, most recent occurrences"
          check, which can actually trigger on realistic small data sets
          while staying meaningful (still requires a genuine repeat, not
          just one absence). */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-800 dark:text-white mb-3">🔔 Alert Center</h3>
        <div className="space-y-2">
          {pct < 75 && pct > 0 && (
            <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl px-3.5 py-2.5">
              <span className="text-base flex-shrink-0">🔴</span>
              <p className="text-xs font-bold text-red-600 dark:text-red-400">
                Critical: {classesNeededFor(os.present||0, os.total||0, 0.75)} more present day(s) needed to stay exam-eligible
              </p>
            </div>
          )}
          {(() => {
            if (!data?.records?.length) return null
            const sorted = [...data.records].sort((a,b) => new Date(b.date) - new Date(a.date))
            const byDay = {}
            sorted.forEach(r => {
              const d = parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday: 'long' })
              if (!byDay[d]) byDay[d] = []
              byDay[d].push(r.status)
            })
            for (const [day, statuses] of Object.entries(byDay)) {
              const recentAbsences = statuses.filter(s => s === 'Absent').length
              if (statuses.length >= 2 && recentAbsences >= 2 && recentAbsences === statuses.length) {
                return (
                  <div key={day} className="flex items-center gap-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-3.5 py-2.5">
                    <span className="text-base flex-shrink-0">🟡</span>
                    <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400">
                      Warning: Absent on all {recentAbsences} recorded {day}s so far
                    </p>
                  </div>
                )
              }
            }
            return null
          })()}
          {bestMonth && monthHistory.length > 0 && bestMonth.month === monthHistory[monthHistory.length - 1].month && pct >= 75 && (
            <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl px-3.5 py-2.5">
              <span className="text-base flex-shrink-0">🟢</span>
              <p className="text-xs font-bold text-green-700 dark:text-green-400">
                Good: Best attendance month so far — keep the momentum!
              </p>
            </div>
          )}
          {pct >= 75 && (
            <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl px-3.5 py-2.5">
              <span className="text-base flex-shrink-0">🟢</span>
              <p className="text-xs font-bold text-green-700 dark:text-green-400">
                You're currently in good standing at {fmtPct(pct)}% attendance
              </p>
            </div>
          )}
          {pct === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No alerts yet — check back once attendance is recorded.</p>
          )}
        </div>
      </div>

      {/* Overall stats */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-800 dark:text-white mb-4">📊 All-Time Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:'Total Classes', value: os.total   || 0,           color:'text-indigo-600' },
            { label:'Present',       value: os.present || 0,           color:'text-green-600'  },
            { label:'Absent',        value: os.absent  || 0,           color:'text-red-500'    },
            { label:'Overall %',     value: `${fmtPct(os.percentage)}%`,  color: pct>=75?'text-green-600':'text-red-500' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3.5 text-center border border-gray-100 dark:border-gray-700 transition-transform hover:scale-105 duration-300">
              <p className={`text-2xl font-black ${s.color}`}>
                {typeof s.value === 'number' ? <CountUp value={s.value} /> : s.value}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Records Table — sortable, filterable, expandable, selectable, paginated ═══ */}
      {data?.records?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-black text-gray-800 dark:text-white">📋 Daily Records — {monthName}</h3>
            <div className="flex items-center gap-3">
              {selectedRows.size > 0 && (
                <button onClick={exportSelectedExcel}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all">
                  📤 Export Selected ({selectedRows.size})
                </button>
              )}
              <span className="text-xs text-gray-400">{filteredRecords.length} entries</span>
            </div>
          </div>
          <div className="overflow-x-auto
            [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-emerald-200 dark:[&::-webkit-scrollbar-thumb]:bg-emerald-800
            [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-400 font-black">
                  <th className="px-3 py-3 text-center">
                    <input type="checkbox"
                      checked={selectedRows.size === pagedRecords.length && pagedRecords.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort('date')}>
                    Date {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort('day')}>
                    Day {sortKey === 'day' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort('status')}>
                    Status {sortKey === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort('time')}>
                    Time {sortKey === 'time' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300" onClick={() => toggleSort('markedBy')}>
                    Marked By {sortKey === 'markedBy' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  {/* FIX 12 */}
                  <th className="px-4 py-3 text-left">Remark</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {/* BUGFIX (#6): table body now shows an explicit empty state
                    when filters legitimately return zero rows, instead of
                    silently rendering a header with nothing underneath. */}
                {pagedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                      No records match your current filters. <button onClick={clearAllFilters} className="text-emerald-600 dark:text-emerald-400 font-bold underline ml-1">Clear filters</button>
                    </td>
                  </tr>
                ) : pagedRecords.map((r) => (
                  <>
                    <tr key={r.date}
                      className={`border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors cursor-pointer ${
                        r.status === 'Absent'  ? 'bg-red-50/40 dark:bg-red-900/5 hover:bg-red-50 dark:hover:bg-red-900/10' :
                        r.status === 'Late'    ? 'bg-yellow-50/40 dark:bg-yellow-900/5 hover:bg-yellow-50 dark:hover:bg-yellow-900/10' :
                        'hover:bg-gray-50 dark:hover:bg-gray-700/20'
                      }`}
                      onClick={() => setExpandedRow(prev => prev === r.date ? null : r.date)}>
                      <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedRows.has(r.date)} onChange={() => toggleRowSelect(r.date)}
                          className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200">{r.date}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday:'long' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${STATUS_BG[r.status] || ''}`}>
                          {STATUS_EMOJI[r.status]} {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 text-center">{r.time || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{r.markedBy || '—'}</td>
                      {/* FIX 12 */}
                      <td className="px-4 py-3 text-xs text-gray-400">{r.remark || '—'}</td>
                      <td className="px-2 py-3 text-center text-gray-300 text-xs">
                        {expandedRow === r.date ? '▲' : '▼'}
                      </td>
                    </tr>
                    {expandedRow === r.date && (
                      <tr className="bg-gray-50/70 dark:bg-gray-900/30">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div><span className="text-gray-400 font-bold block mb-0.5">Full Date</span>
                              <span className="text-gray-700 dark:text-gray-200 font-semibold">
                                {parseLocalDate(r.date).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
                              </span></div>
                            <div><span className="text-gray-400 font-bold block mb-0.5">Teacher</span>
                              <span className="text-gray-700 dark:text-gray-200 font-semibold">{r.markedBy || 'Not recorded'}</span></div>
                            <div><span className="text-gray-400 font-bold block mb-0.5">Time Marked</span>
                              <span className="text-gray-700 dark:text-gray-200 font-semibold">{r.time || 'Not recorded'}</span></div>
                            <div><span className="text-gray-400 font-bold block mb-0.5">Remark</span>
                              <span className="text-gray-700 dark:text-gray-200 font-semibold">{r.remark || 'None'}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={clampedPage === 1}
                className="text-xs font-bold text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                ← Previous
              </button>
              <span className="text-xs text-gray-400 font-medium">Page {clampedPage} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={clampedPage === totalPages}
                className="text-xs font-bold text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  )
}

export default SAttendance