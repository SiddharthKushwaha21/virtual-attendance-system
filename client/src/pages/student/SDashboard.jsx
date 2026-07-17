import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import toast  from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'

const TODAY = new Date().toISOString().split('T')[0]

const useCountUp = (target, duration = 700) => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target])
  return count
}

const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-24 mb-4" />
    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-16 mb-2" />
    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full w-32" />
  </div>
)

const SDashboard = ({ student, setActivePage, dark }) => {
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const token = student?.token

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/students/me/dashboard`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setStats(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Dashboard error:', err.message)
      toast.error('Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  // Derived
  const pct         = stats?.percentage || 0
  const present     = stats?.present    || 0
  const absent      = stats?.absent     || 0
  const late        = stats?.late       || 0
  const total       = stats?.totalClasses || 0
  const streak      = stats?.streak     || 0
  const classRank   = stats?.classRank  || null
  const todayStatus = stats?.todayStatus

  const animPct     = useCountUp(pct)
  const animPresent = useCountUp(present)
  const animAbsent  = useCountUp(absent)

  // Status color helpers
  const statusColor = (s) =>
    s === 'Present' ? 'text-green-600 dark:text-green-400' :
    s === 'Absent'  ? 'text-red-500 dark:text-red-400' :
    s === 'Late'    ? 'text-yellow-600 dark:text-yellow-400' :
    'text-gray-400'

  const statusBg = (s) =>
    s === 'Present' ? 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800' :
    s === 'Absent'  ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800' :
    s === 'Late'    ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800' :
    'bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'

  const statusEmoji = (s) =>
    s === 'Present' ? '✅' : s === 'Absent' ? '❌' : s === 'Late' ? '⏰' : '—'

  // Heatmap color
  const heatColor = (s) => {
    if (!s) return dark ? '#1f2937' : '#f3f4f6'
    if (s === 'Present') return '#22c55e'
    if (s === 'Absent')  return '#ef4444'
    if (s === 'Late')    return '#f59e0b'
    return dark ? '#1f2937' : '#f3f4f6'
  }

  // Bar chart — 7 days
  const barData = (stats?.last7Days || []).map(d => ({
    day:    d.day,
    date:   d.date,
    value:  d.status === 'Present' ? 1 : d.status === 'Late' ? 0.5 : d.status === 'Absent' ? -1 : 0,
    status: d.status,
    color:  d.status === 'Present' ? '#22c55e' : d.status === 'Absent' ? '#ef4444' :
            d.status === 'Late'    ? '#f59e0b' : '#6b7280',
  }))

  const hour       = new Date().getHours()
  const greeting   = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const greetEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙'

  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="bg-gray-950/95 backdrop-blur border border-gray-700/50 rounded-xl px-3 py-2 shadow-xl text-xs">
        <p className="font-black text-white mb-1">{label} — {d?.date}</p>
        <p className={`font-bold ${statusColor(d?.status)}`}>
          {statusEmoji(d?.status)} {d?.status || 'No Class'}
        </p>
      </div>
    )
  }

  if (loading) return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-56 animate-pulse" />
        <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-xl w-28 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_,i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
      </div>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-2xl">{greetEmoji}</span>
            <h2 className="text-2xl font-black text-gray-800 dark:text-white">
              {greeting}, {student?.name?.split(' ')[0]}!
            </h2>
          </div>
          <div className="flex items-center gap-3 ml-9">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </p>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                • Updated {lastUpdated.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
              </span>
            )}
          </div>
        </div>
        <button onClick={fetchDashboard}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200
            dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400
            hover:bg-gray-50 dark:hover:bg-gray-700 hover:rotate-180 transition-all duration-300">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* ── Debarment Warning ── */}
      {stats?.debarmentWarning && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-black text-red-700 dark:text-red-300 mb-1">
                Attendance Warning — {stats.debarmentWarning.currentPct}%
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                {stats.debarmentWarning.message}
              </p>
              <div className="mt-2 bg-red-200 dark:bg-red-900/40 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, stats.debarmentWarning.currentPct)}%` }} />
              </div>
              <p className="text-[10px] text-red-400 mt-1">
                Need 75% to sit in exams — you are at {stats.debarmentWarning.currentPct}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Today's Status Banner ── */}
      <div className={`rounded-2xl p-4 border flex items-center justify-between ${
        todayStatus ? statusBg(todayStatus) : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{statusEmoji(todayStatus)}</span>
          <div>
            <p className={`font-black text-base ${statusColor(todayStatus)}`}>
              {todayStatus ? `You're ${todayStatus} Today!` : 'Not Marked Yet'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats?.todayTime ? `Marked at ${stats.todayTime}` : 'Class attendance not recorded yet'}
              {stats?.todayMarkedBy ? ` by ${stats.todayMarkedBy}` : ''}
            </p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-xl">
            <span className="text-base">🔥</span>
            <div>
              <p className="text-xs font-black text-orange-600 dark:text-orange-400 leading-none">{streak} day streak!</p>
              <p className="text-[10px] text-orange-400 leading-none mt-0.5">Consecutive present</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Overall Attendance', value: `${animPct}%`, icon: '📊',
            color: pct >= 75 ? 'text-emerald-500' : pct >= 60 ? 'text-yellow-500' : 'text-red-500',
            bg:    pct >= 75 ? 'from-emerald-500/10 to-green-500/5' : pct >= 60 ? 'from-yellow-500/10 to-amber-500/5' : 'from-red-500/10 to-rose-500/5',
            border: pct >= 75 ? 'border-emerald-200 dark:border-emerald-800' : pct >= 60 ? 'border-yellow-200 dark:border-yellow-800' : 'border-red-200 dark:border-red-800',
            sub: pct >= 75 ? '✅ Above requirement' : `⚠️ Need ${(75 - pct).toFixed(1)}% more`,
            subColor: pct >= 75 ? 'text-emerald-500' : 'text-red-500',
          },
          {
            label: 'Days Present', value: animPresent, icon: '✅',
            color: 'text-green-500',
            bg: 'from-green-500/10 to-emerald-500/5',
            border: 'border-green-200 dark:border-green-800',
            sub: `out of ${total} classes`,
          },
          {
            label: 'Days Absent', value: animAbsent, icon: '❌',
            color: 'text-red-500',
            bg: 'from-red-500/10 to-rose-500/5',
            border: 'border-red-200 dark:border-red-800',
            sub: late > 0 ? `+ ${late} late` : 'No late entries',
          },
          {
            label: 'Class Rank', icon: '🏆',
            value: classRank ? `#${classRank.rank}` : '—',
            color: classRank?.rank <= 3 ? 'text-yellow-500' : 'text-purple-500',
            bg: 'from-purple-500/10 to-violet-500/5',
            border: 'border-purple-200 dark:border-purple-800',
            sub: classRank ? `of ${classRank.total} students` : 'Calculating...',
          },
        ].map((card, i) => (
          <div key={i} className={`bg-gradient-to-br ${card.bg} border ${card.border} rounded-2xl p-5
            hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{card.label}</p>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className={`text-4xl font-black ${card.color} mb-1`}>{card.value}</p>
            {card.sub && <p className={`text-xs font-semibold ${card.subColor || 'text-gray-400'}`}>{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Last 7 Days Bar Chart */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-black text-gray-800 dark:text-white">📊 My Last 7 Days</h3>
              <p className="text-xs text-gray-400 mt-0.5">Personal attendance trend</p>
            </div>
            <div className="flex gap-3 text-xs">
              {[{color:'#22c55e',label:'Present'},{color:'#ef4444',label:'Absent'},{color:'#f59e0b',label:'Late'}].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:item.color}} />
                  <span className="text-gray-500 dark:text-gray-400 font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          {barData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm">No attendance data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={32} margin={{top:5,right:5,left:-20,bottom:5}}>
                <defs>
                  <filter id="sShadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke={dark?'#1f2937':'#f1f5f9'} vertical={false} />
                <XAxis dataKey="day" tick={{fontSize:12,fill:dark?'#9ca3af':'#6b7280',fontWeight:700}} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<BarTooltip />} cursor={{fill:'rgba(16,185,129,0.05)',radius:8}} />
                <Bar dataKey="value" radius={[8,8,0,0]} filter="url(#sShadow)" maxBarSize={36}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-around mt-1">
            {barData.map((d, i) => (
              <div key={i} className="text-center">
                <span className="text-base">{statusEmoji(d.status)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Radial Attendance Ring */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-black text-gray-700 dark:text-gray-200">📈 Overall</h3>
            <p className="text-xs text-gray-400 mt-0.5">{total} total classes</p>
          </div>
          <div className="relative flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="45%" outerRadius="90%"
                data={[{name:'Attendance', value:pct,
                  fill: pct>=75?'#22c55e':pct>=60?'#f59e0b':'#ef4444'}]}
                startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0,100]} angleAxisId={0} tick={false} />
                <RadialBar background={{fill:dark?'#374151':'#f3f4f6'}} dataKey="value" angleAxisId={0} cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className={`text-3xl font-black ${pct>=75?'text-green-500':pct>=60?'text-yellow-500':'text-red-500'}`}>{pct}%</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Overall</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            {[
              {label:'Present', value:present, color:'#22c55e', bg:'bg-green-500'},
              {label:'Absent',  value:absent,  color:'#ef4444', bg:'bg-red-500'},
              {label:'Late',    value:late,    color:'#f59e0b', bg:'bg-yellow-500'},
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${item.bg}`} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-14 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${item.bg}`}
                      style={{width:`${total>0?(item.value/total*100):0}%`}} />
                  </div>
                  <span className="text-xs font-black text-gray-700 dark:text-gray-200 w-4 text-right">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 30-Day Heatmap ── */}
      {stats?.last30Days?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-gray-800 dark:text-white">🗓️ Last 30 Days — My Calendar</h3>
              <p className="text-xs text-gray-400 mt-0.5">Personal attendance heatmap</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-emerald-600">{stats?.monthlyOverview?.percentage || 0}%</p>
              <p className="text-xs text-gray-400">This month</p>
            </div>
          </div>
          <div className="grid grid-cols-10 gap-1.5 mb-2">
            {stats.last30Days.map((d, i) => (
              <div key={i}
                title={`${d.date}: ${d.status || 'No Class'}`}
                style={{ backgroundColor: heatColor(d.status) }}
                className="w-full aspect-square rounded-md transition-all hover:scale-110 cursor-default" />
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>30 days ago</span>
            <div className="flex items-center gap-2">
              {[['#22c55e','Present'],['#ef4444','Absent'],['#f59e0b','Late'],['#e5e7eb','No Class']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{backgroundColor:c}} />
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <span>Today</span>
          </div>
        </div>
      )}

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Monthly Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-200">📅 This Month</h3>
              <p className="text-xs text-gray-400 mt-0.5">{stats?.monthlyOverview?.workingDays || 0} working days</p>
            </div>
            <button onClick={() => setActivePage('attendance')}
              className="text-xs text-emerald-500 hover:text-emerald-600 font-bold">
              Full History →
            </button>
          </div>
          <div className="text-center py-4">
            <p className={`text-5xl font-black mb-2 ${
              (stats?.monthlyOverview?.percentage||0) >= 75 ? 'text-emerald-500' :
              (stats?.monthlyOverview?.percentage||0) >= 60 ? 'text-yellow-500' : 'text-red-500'
            }`}>{stats?.monthlyOverview?.percentage || 0}%</p>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden mb-2">
              <div className={`h-full rounded-full transition-all duration-700 ${
                (stats?.monthlyOverview?.percentage||0)>=75?'bg-gradient-to-r from-emerald-400 to-green-500':
                (stats?.monthlyOverview?.percentage||0)>=60?'bg-gradient-to-r from-yellow-400 to-amber-500':
                'bg-gradient-to-r from-red-400 to-rose-500'
              }`} style={{width:`${stats?.monthlyOverview?.percentage||0}%`}} />
            </div>
            <p className="text-xs text-gray-400">
              {(stats?.monthlyOverview?.percentage||0) >= 75
                ? '✅ You\'re meeting the requirement!'
                : `⚠️ Below 75% — attend more classes`
              }
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-gray-700 dark:text-gray-200">📋 Recent Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">Your last 5 records</p>
            </div>
            <button onClick={() => setActivePage('attendance')}
              className="text-xs text-emerald-500 hover:text-emerald-600 font-bold">
              View All →
            </button>
          </div>
          {(stats?.recentActivity || []).length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-xs text-gray-400">No attendance records yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(stats?.recentActivity || []).slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b
                  border-gray-50 dark:border-gray-700/50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{statusEmoji(r.status)}</span>
                    <div>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', {
                          weekday:'short', day:'2-digit', month:'short',
                        })}
                      </p>
                      <p className="text-[10px] text-gray-400">{r.time || ''}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                    r.status==='Present'?'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300':
                    r.status==='Absent' ?'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300':
                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SDashboard