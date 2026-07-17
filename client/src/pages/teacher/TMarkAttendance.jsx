import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { io } from 'socket.io-client'
import useTodayDate from '../../hooks/useTodayDate'

// ─────────────────────────────────────────────
// QR Scanner Modal
// ─────────────────────────────────────────────
const QRScannerModal = ({ onClose, onScan }) => {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [scanning, setScanning]       = useState(false)
  const [scannedText, setScannedText] = useState('')

  useEffect(() => {
    let interval
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setScanning(true)
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          interval = setInterval(async () => {
            if (!videoRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0) {
                setScannedText(codes[0].rawValue)
                onScan(codes[0].rawValue)
                clearInterval(interval)
              }
            } catch { }
          }, 500)
        }
      } catch {
        toast.error('Camera access denied. Please allow camera permission.')
        onClose()
      }
    }
    start()
    return () => {
      clearInterval(interval)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between">
          <h3 className="text-white font-black text-base">📷 Scan Student QR Code</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl font-bold">✕</button>
        </div>
        <div className="p-4">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-square mb-4">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-white/60 rounded-2xl relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
              </div>
            </div>
          </div>
          {scannedText
            ? <p className="text-center text-green-600 font-black text-sm">✅ Scanned: {scannedText}</p>
            : <p className="text-center text-gray-400 text-sm">{scanning ? 'Point camera at student QR code...' : 'Starting camera...'}</p>
          }
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Student Profile Modal
// Opens on row click or Enter key press.
// Closes on Esc or backdrop click.
// Shows full details + clickable Gmail / Phone / WhatsApp + stats + 30-day heatmap.
// ─────────────────────────────────────────────
const StudentProfileModal = ({ student, attendanceStatus, historyStats, onClose }) => {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const stats    = historyStats || { total: 0, present: 0, absent: 0, late: 0, recent: [] }
  const pct      = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0
  const isAtRisk = stats.total > 0 && pct < 75

  const statusEmoji  = attendanceStatus === 'Present' ? '✅' : attendanceStatus === 'Absent' ? '❌' : attendanceStatus === 'Late' ? '⏰' : '—'
  const statusColor  = attendanceStatus === 'Present' ? 'text-green-600 dark:text-green-400'
                     : attendanceStatus === 'Absent'  ? 'text-red-600 dark:text-red-400'
                     : attendanceStatus === 'Late'    ? 'text-yellow-600 dark:text-yellow-400'
                     : 'text-slate-500'
  const statusBadge  = attendanceStatus === 'Present' ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700'
                     : attendanceStatus === 'Absent'  ? 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700'
                     : attendanceStatus === 'Late'    ? 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700'
                     : 'bg-slate-100 dark:bg-slate-700/40 border-slate-300 dark:border-slate-600'

  // 30-day heatmap grid
  const today     = new Date()
  const days      = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })
  const statusMap = {}
  ;(stats.recent || []).forEach(r => { statusMap[r.date] = r.status })

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg shadow-2xl
        max-h-[92vh] overflow-y-auto
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:bg-indigo-300 dark:[&::-webkit-scrollbar-thumb]:bg-indigo-700
        [&::-webkit-scrollbar-thumb]:rounded-full">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 p-6">
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm font-bold transition-all"
            title="Close (Esc)">✕</button>

          <div className="flex items-start gap-4">
            {student.photo
              ? <img src={student.photo} className="w-20 h-20 rounded-2xl object-cover shadow-lg border-2 border-white/30 flex-shrink-0" />
              : <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-3xl shadow-lg border-2 border-white/30 flex-shrink-0">
                  {student.name.charAt(0)}
                </div>
            }
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="text-xl font-black text-white leading-tight truncate">{student.name}</h2>
              <p className="text-indigo-200 text-sm mt-0.5 font-medium">
                Roll No: <span className="text-white font-bold">{student.rollNo || '—'}</span>
              </p>
              <p className="text-indigo-200 text-sm mt-0.5">
                {student.class}{student.section ? `-${student.section}` : ''}
                {student.year ? ` • Year ${student.year}` : ''}
                {student.session ? ` • ${student.session}` : ''}
              </p>
              <div className={`inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full text-xs font-black border ${statusBadge}`}>
                <span>{statusEmoji}</span>
                <span className={statusColor}>Today: {attendanceStatus || 'Not Marked'}</span>
              </div>
            </div>
          </div>

          {isAtRisk && (
            <div className="mt-4 bg-red-500/20 border border-red-400/40 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <p className="text-red-200 text-xs font-bold">
                Low attendance — {pct}% (below 75%). May face exam debarment.
              </p>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">

          {/* Contact — all clickable */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2.5">📬 Contact</p>
            <div className="space-y-2">

              {/* Gmail */}
              {student.email ? (
                <a href={`mailto:${student.email}`}
                  className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 text-lg">📧</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-0.5">Gmail</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{student.email}</p>
                  </div>
                  <span className="text-gray-300 group-hover:text-red-400 text-sm font-bold flex-shrink-0">↗</span>
                </a>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/20 rounded-xl border border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-lg">📧</div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Gmail</p>
                    <p className="text-sm text-gray-400">No email on record</p>
                  </div>
                </div>
              )}

              {/* Phone */}
              {student.phone ? (
                <a href={`tel:${student.phone}`}
                  className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 text-lg">📞</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-0.5">Phone</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{student.phone}</p>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-400 text-sm font-bold flex-shrink-0">↗</span>
                </a>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/20 rounded-xl border border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-lg">📞</div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Phone</p>
                    <p className="text-sm text-gray-400">No phone on record</p>
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              {student.phone ? (
                <a href={`https://wa.me/91${student.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0 text-lg">💬</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-0.5">WhatsApp</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{student.phone}</p>
                  </div>
                  <span className="text-gray-300 group-hover:text-green-400 text-sm font-bold flex-shrink-0">↗</span>
                </a>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/20 rounded-xl border border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-lg">💬</div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">WhatsApp</p>
                    <p className="text-sm text-gray-400">No phone on record</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Academic Details */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2.5">🎓 Academic Details</p>
            <div className="grid grid-cols-2 gap-2">
              {[['Class', student.class||'—'], ['Section', student.section||'—'], ['Year', student.year||'—'], ['Session', student.session||'—']].map(([label, value]) => (
                <div key={label} className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2.5 border border-indigo-100 dark:border-indigo-800">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase">{label}</p>
                  <p className="text-sm font-black text-gray-800 dark:text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance Stats */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2.5">📊 Attendance Stats</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label:'Present', value:stats.present||0, color:'text-green-600', bg:'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
                { label:'Absent',  value:stats.absent||0,  color:'text-red-500',   bg:'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' },
                { label:'Late',    value:stats.late||0,    color:'text-yellow-600', bg:'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800' },
                { label:'Total',   value:stats.total||0,   color:'text-indigo-600', bg:'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800' },
              ].map(card => (
                <div key={card.label} className={`${card.bg} border rounded-xl p-2.5 text-center`}>
                  <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 font-medium">Overall Attendance</span>
                <span className={`text-sm font-black ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>{pct}%</span>
              </div>
              <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* 30-day heatmap */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2.5">🗓️ Last 30 Days</p>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-3 border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-10 gap-1.5 mb-3">
                {days.map(d => {
                  const s = statusMap[d]
                  return (
                    <div key={d} title={`${d}: ${s || 'No Data'}`}
                      className={`w-full aspect-square rounded-md transition-all ${
                        s === 'Present' ? 'bg-green-400 hover:bg-green-500' :
                        s === 'Absent'  ? 'bg-red-400 hover:bg-red-500' :
                        s === 'Late'    ? 'bg-yellow-400 hover:bg-yellow-500' :
                        'bg-gray-200 dark:bg-gray-600'
                      }`} />
                  )
                })}
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                {[['bg-green-400','Present'],['bg-red-400','Absent'],['bg-yellow-400','Late'],['bg-gray-300 dark:bg-gray-600','No Data']].map(([cls, label]) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded ${cls}`} />
                    <span className="text-[10px] text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Close button */}
          <button onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl text-sm font-black hover:opacity-90 transition-all shadow-lg">
            Close Profile <span className="text-indigo-300 text-xs ml-1">(Esc)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Heatmap Modal — standalone (from Last 3 Days column)
// ─────────────────────────────────────────────
const HeatmapModal = ({ student, history, onClose }) => {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const today = new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })
  const statusMap = {}
  ;(history || []).forEach(r => { statusMap[r.date] = r.status })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-gray-800 dark:text-white">{student.name}</h3>
            <p className="text-xs text-gray-400">Last 30 days attendance heatmap</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="grid grid-cols-10 gap-1.5 mb-4">
          {days.map(d => {
            const s = statusMap[d]
            return (
              <div key={d} title={`${d}: ${s || 'No Data'}`}
                className={`w-full aspect-square rounded-md ${
                  s === 'Present' ? 'bg-green-400' :
                  s === 'Absent'  ? 'bg-red-400' :
                  s === 'Late'    ? 'bg-yellow-400' :
                  'bg-gray-100 dark:bg-gray-700'
                }`} />
            )
          })}
        </div>
        <div className="flex gap-4 justify-center text-xs text-gray-500">
          {[['bg-green-400','Present'],['bg-red-400','Absent'],['bg-yellow-400','Late'],['bg-gray-200 dark:bg-gray-600','No Data']].map(([cls,label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${cls}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Edit Locked Record Modal
// ─────────────────────────────────────────────
const EditModal = ({ student, currentStatus, attendanceId, onClose, onSave }) => {
  const [newStatus, setNewStatus] = useState(currentStatus)
  const [reason, setReason]       = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const handleSave = async () => {
    if (!reason.trim()) { toast.error('Please enter a reason for editing.'); return }
    setSaving(true)
    await onSave(attendanceId, newStatus, reason)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6">
        <h3 className="font-black text-gray-800 dark:text-white mb-1">Edit Attendance</h3>
        <p className="text-xs text-gray-400 mb-5">{student.name} — change locked status</p>
        <div className="flex gap-2 mb-4">
          {['Present','Absent','Late'].map(s => (
            <button key={s} onClick={() => setNewStatus(s)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border ${
                newStatus === s
                  ? s === 'Present' ? 'bg-green-500 text-white border-green-500'
                    : s === 'Absent' ? 'bg-red-500 text-white border-red-500'
                    : 'bg-yellow-500 text-white border-yellow-500'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}>
              {s === 'Present' ? '✅' : s === 'Absent' ? '❌' : '⏰'} {s}
            </button>
          ))}
        </div>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Reason for editing (required)..."
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-black hover:opacity-90 disabled:opacity-50 transition-all">
            {saving ? 'Saving...' : '✓ Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TMarkAttendance = ({ user, dark }) => {
  const [allStudents, setAllStudents]             = useState([])
  const [loading, setLoading]                     = useState(false)
  const [attendance, setAttendance]               = useState({})
  const [remarks, setRemarks]                     = useState({})
  const [submitting, setSubmitting]               = useState(false)
  const [search, setSearch]                       = useState('')
  const [filterClass, setFilterClass]             = useState('')
  const [filterSection, setFilterSection]         = useState('')
  const [filterYear, setFilterYear]               = useState('')
  const [filterSession, setFilterSession]         = useState('')
  const [todayMarked, setTodayMarked]             = useState({})
  const [lockedStudents, setLockedStudents]       = useState({})
  const [attendanceIds, setAttendanceIds]         = useState({})
  const [showSummary, setShowSummary]             = useState(false)
  const [summaryData, setSummaryData]             = useState(null)
  // ── Midnight auto-refresh ────────────────────────────────────────────────
  // TODAY used to be a module-level constant computed once when the file
  // first loaded, so it silently went stale if the tab was left open past
  // midnight. useTodayDate() recomputes it automatically at midnight and
  // fires the callback below, which resets the page to the new day.
  const TODAY = useTodayDate((newDate) => {
    setDate(newDate)
    const reset = {}
    allStudents.forEach(s => { reset[s._id] = 'Present' })
    setAttendance(reset)
    setRemarks({})
    setUndoStack([])
    setDraftLoaded(false)
  }, true)
  const [date, setDate]                           = useState(TODAY)
  const [bulkHistory, setBulkHistory]             = useState({})
  const [undoStack, setUndoStack]                 = useState([])
  const [compactMode, setCompactMode]             = useState(false)
  const [showQR, setShowQR]                       = useState(false)
  const [heatmapStudent, setHeatmapStudent]       = useState(null)
  const [editRecord, setEditRecord]               = useState(null)
  const [profileStudent, setProfileStudent]       = useState(null)
  const [savingDraft, setSavingDraft]             = useState(false)
  const [draftLoaded, setDraftLoaded]             = useState(false)
  const [showCopyYesterday, setShowCopyYesterday] = useState(false)
  const [streaks, setStreaks]                     = useState({})
  const socketRef                                 = useRef(null)

  const token           = JSON.parse(localStorage.getItem('user'))?.token
  const assignedClasses = user?.assignedClasses || []

  // ── Cascading filter options ───────────────────────────────────────────────
  // Each dropdown shows only values relevant to what is already selected.
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort()

  const classOptions = uniq(
    allStudents.filter(s =>
      (!filterSection || s.section === filterSection) &&
      (!filterYear    || s.year    === filterYear)    &&
      (!filterSession || s.session === filterSession)
    ).map(s => s.class)
  )
  const sectionOptions = uniq(
    allStudents.filter(s =>
      (!filterClass   || s.class   === filterClass)   &&
      (!filterYear    || s.year    === filterYear)    &&
      (!filterSession || s.session === filterSession)
    ).map(s => s.section)
  )
  const yearOptions = uniq(
    allStudents.filter(s =>
      (!filterClass   || s.class   === filterClass)   &&
      (!filterSection || s.section === filterSection) &&
      (!filterSession || s.session === filterSession)
    ).map(s => s.year)
  )
  const sessionOptions = uniq(
    allStudents.filter(s =>
      (!filterClass   || s.class   === filterClass)   &&
      (!filterSection || s.section === filterSection) &&
      (!filterYear    || s.year    === filterYear)
    ).map(s => s.session)
  )

  // ── Filtered list — ABOVE all useEffects to fix TDZ error ─────────────────
  const filtered = allStudents.filter(s => {
    const ms   = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.rollNo && s.rollNo.toLowerCase().includes(search.toLowerCase())) ||
      (s.email  && s.email.toLowerCase().includes(search.toLowerCase()))
    const mc   = !filterClass   || s.class   === filterClass
    const msec = !filterSection || s.section === filterSection
    const my   = !filterYear    || s.year    === filterYear
    const mses = !filterSession || s.session === filterSession
    return ms && mc && msec && my && mses
  })

  const alreadyMarked = filtered.filter(s => lockedStudents[s._id]).length
  const pendingCount  = filtered.length - alreadyMarked
  const progressPct   = filtered.length > 0 ? Math.round((alreadyMarked / filtered.length) * 100) : 0
  const countByStatus = status =>
    filtered.filter(s => (todayMarked[s._id] || attendance[s._id] || 'Present') === status).length

  // ── Socket.io ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const base   = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'
    socketRef.current = io(base)
    const roomId = assignedClasses.map(c => `${c.class}-${c.section}`).join('_')
    socketRef.current.emit('join-class', { classId: roomId })
    socketRef.current.on('attendance-update', ({ studentId, status }) => {
      setTodayMarked(p  => ({ ...p, [studentId]: status }))
      setLockedStudents(p => ({ ...p, [studentId]: true }))
      setAttendance(p   => ({ ...p, [studentId]: status }))
      toast(`📡 Live: ${studentId} marked ${status} by another teacher.`, { icon: '🔄' })
    })
    return () => socketRef.current?.disconnect()
  }, [])

  // ── Fetch students on mount ────────────────────────────────────────────────
  useEffect(() => { fetchAllStudents() }, [])

  // ── Re-fetch on date change — reset locked state first ────────────────────
  useEffect(() => {
    if (allStudents.length > 0) fetchDateAttendance()
  }, [date, allStudents])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  // filtered is declared above all useEffects — no TDZ error.
  // ↑↓ and Enter work on ALL rows (locked or not).
  // P / A / L only work on unlocked rows.
  useEffect(() => {
    const handleKey = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      const idx = parseInt(e.target?.dataset?.studentIndex)
      if (isNaN(idx)) return
      const student = filtered[idx]
      if (!student) return

      // ↑↓ — always navigate (works even on locked rows)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        document.querySelector(`[data-student-index="${idx + 1}"]`)?.focus()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        document.querySelector(`[data-student-index="${idx - 1}"]`)?.focus()
        return
      }

      // Enter — open profile (always works, locked or not)
      if (e.key === 'Enter') {
        e.preventDefault()
        setProfileStudent(student)
        return
      }

      // Ctrl+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
        return
      }

      // P / A / L — only on unlocked rows
      if (lockedStudents[student._id]) return
      if (e.key === 'p' || e.key === 'P') quickMark(student._id, 'Present')
      if (e.key === 'a' || e.key === 'A') quickMark(student._id, 'Absent')
      if (e.key === 'l' || e.key === 'L') quickMark(student._id, 'Late')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [filtered, attendance, lockedStudents])

  // ── Auto-save draft every 30 seconds ──────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (Object.keys(attendance).length > 0) autoSaveDraft()
    }, 30000)
    return () => clearInterval(iv)
  }, [attendance, remarks, date])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const quickMark = (studentId, status) => {
    setUndoStack(p => [...p.slice(-19), { studentId, prevStatus: attendance[studentId] || 'Present' }])
    setAttendance(p => ({ ...p, [studentId]: status }))
  }

  const handleUndo = useCallback(() => {
    if (!undoStack.length) { toast('Nothing to undo.'); return }
    const last = undoStack[undoStack.length - 1]
    setAttendance(p => ({ ...p, [last.studentId]: last.prevStatus }))
    setUndoStack(p => p.slice(0, -1))
    toast('↩️ Undo successful.')
  }, [undoStack])

  // ── API calls ──────────────────────────────────────────────────────────────
  const fetchAllStudents = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const my = data.filter(s =>
        assignedClasses.some(c => c.class === s.class && (!c.section || c.section === s.section))
      )
      setAllStudents(my)
      const init = {}
      my.forEach(s => { init[s._id] = 'Present' })
      setAttendance(init)
      loadDraft(my)
      fetchBulkHistory(my)
    } catch { toast.error('Failed to load students.') }
    finally   { setLoading(false) }
  }

  // FIX: fetches attendance for the SELECTED date, not always today
  // FIX: resets locked state first so switching dates works correctly
  const fetchDateAttendance = async () => {
    try {
      setLockedStudents({})
      setTodayMarked({})
      setAttendanceIds({})
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/date/${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const marked = {}, locked = {}, ids = {}
      data.forEach(a => {
        const sid = a.studentId?._id || a.studentId
        if (sid) { marked[sid] = a.status; locked[sid] = true; ids[sid] = a._id }
      })
      setTodayMarked(marked)
      setLockedStudents(locked)
      setAttendanceIds(ids)
      setAttendance(p => ({ ...p, ...marked }))
    } catch { console.error('Failed to fetch date attendance.') }
  }

  // FIX: one bulk API call instead of N individual calls
  const fetchBulkHistory = async (students) => {
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/attendance/bulk-stats`,
        { studentIds: students.map(s => s._id) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setBulkHistory(data.stats || {})
      const streakMap = {}
      Object.entries(data.stats || {}).forEach(([sid, s]) => {
        let streak = 0
        for (const r of (s.recent || []).slice().reverse()) {
          if (r.status === 'Present' || r.status === 'Late') streak++
          else break
        }
        streakMap[sid] = streak
      })
      setStreaks(streakMap)
    } catch { console.error('Failed to fetch bulk history.') }
  }

  // ── Draft ──────────────────────────────────────────────────────────────────
  const autoSaveDraft = () => {
    localStorage.setItem(
      `attendance_draft_${user?._id}`,
      JSON.stringify({ attendance, remarks, date, savedAt: new Date().toISOString() })
    )
    setSavingDraft(true)
    setTimeout(() => setSavingDraft(false), 1000)
  }

  const loadDraft = (students) => {
    try {
      const raw = localStorage.getItem(`attendance_draft_${user?._id}`)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.date !== TODAY) return
      const validIds = new Set(students.map(s => s._id))
      const valid = {}
      Object.entries(draft.attendance || {}).forEach(([id, status]) => {
        if (validIds.has(id)) valid[id] = status
      })
      if (Object.keys(valid).length > 0) {
        setAttendance(p => ({ ...p, ...valid }))
        setRemarks(draft.remarks || {})
        setDraftLoaded(true)
        toast('📝 Draft restored from auto-save.', { icon: '💾' })
      }
    } catch { }
  }

  const clearDraft = () => {
    localStorage.removeItem(`attendance_draft_${user?._id}`)
    setDraftLoaded(false)
  }

  // ── Copy yesterday ─────────────────────────────────────────────────────────
  const copyYesterdayAttendance = async () => {
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/date/${yesterday.toISOString().split('T')[0]}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!data.length) { toast.error('No attendance found for yesterday.'); return }
      const copied = {}
      data.forEach(a => {
        const sid = a.studentId?._id || a.studentId
        if (sid && !lockedStudents[sid]) copied[sid] = a.status
      })
      setAttendance(p => ({ ...p, ...copied }))
      setShowCopyYesterday(false)
      toast.success(`✅ Copied ${Object.keys(copied).length} records from yesterday.`)
    } catch { toast.error('Failed to copy yesterday\'s attendance.') }
  }

  // ── Edit locked record ─────────────────────────────────────────────────────
  const handleEditSave = async (attendanceId, newStatus, reason) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/attendance/${attendanceId}`,
        { status: newStatus, editReason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTodayMarked(p => ({ ...p, [editRecord.student._id]: newStatus }))
      setAttendance(p  => ({ ...p, [editRecord.student._id]: newStatus }))
      toast.success(`✅ ${editRecord.student.name} updated to ${newStatus}.`)
    } catch { toast.error('Failed to update attendance.') }
  }

  // ── QR ─────────────────────────────────────────────────────────────────────
  const handleQRScan = value => {
    const student = allStudents.find(s => s.rollNo === value || s._id === value || s.email === value)
    if (!student) { toast.error(`No student found for: ${value}`); setShowQR(false); return }
    if (lockedStudents[student._id]) { toast(`${student.name} is already marked.`); setShowQR(false); return }
    quickMark(student._id, 'Present')
    toast.success(`✅ ${student.name} marked Present via QR.`)
    setShowQR(false)
  }

  // ── Submit (bulk) ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const unmarked = filtered.filter(s => !lockedStudents[s._id])
    if (!unmarked.length) { toast.error('All visible students are already marked.'); return }
    try {
      setSubmitting(true)
      const records = unmarked.map(s => ({
        studentId: s._id,
        status: attendance[s._id] || 'Present',
        remark: remarks[s._id] || '',
      }))
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/attendance/bulk-mark`,
        { records, date, markedBy: `Teacher: ${user?.name}` },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const newLocked = {}, newMarked = {}
      unmarked.forEach(s => { newLocked[s._id] = true; newMarked[s._id] = attendance[s._id] || 'Present' })
      setLockedStudents(p => ({ ...p, ...newLocked }))
      setTodayMarked(p   => ({ ...p, ...newMarked }))
      const roomId = assignedClasses.map(c => `${c.class}-${c.section}`).join('_')
      records.forEach(r => socketRef.current?.emit('attendance-marked', { classId: roomId, studentId: r.studentId, status: r.status }))
      const present = records.filter(r => r.status === 'Present').length
      const absent  = records.filter(r => r.status === 'Absent').length
      const late    = records.filter(r => r.status === 'Late').length
      setSummaryData({ success: data.saved, present, absent, late, total: records.length })
      setShowSummary(true)
      clearDraft()
    } catch { toast.error('Submission failed. Please try again.') }
    finally  { setSubmitting(false) }
  }

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const present = filtered.filter(s => (todayMarked[s._id]||attendance[s._id]||'Present')==='Present').length
    const absent  = filtered.filter(s => (todayMarked[s._id]||attendance[s._id])==='Absent').length
    const late    = filtered.filter(s => (todayMarked[s._id]||attendance[s._id])==='Late').length
    const rows = filtered.map((s, i) => {
      const st = todayMarked[s._id] || attendance[s._id] || 'Present'
      return `<tr><td>${i+1}</td><td>${s.name}</td><td>${s.email||'-'}</td><td>${s.rollNo||'-'}</td><td>${s.class||'-'}${s.section?`-${s.section}`:''}</td><td>${s.year||'-'}</td><td>${s.session||'-'}</td><td class="${st.charAt(0)}">${st}</td><td>${remarks[s._id]||'-'}</td><td style="min-width:70px"></td></tr>`
    }).join('')
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Attendance Sheet</title>
    <style>body{font-family:'Segoe UI',Arial,sans-serif;padding:24px;color:#111}h2{color:#4f46e5;margin:0 0 6px;font-size:22px;font-weight:800}.meta{color:#6b7280;font-size:12px;margin-bottom:16px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}.stat{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px;text-align:center}.stat-num{font-size:22px;font-weight:800;margin:0}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#4f46e5;color:#fff;padding:10px 12px;text-align:left;font-size:11px}td{padding:9px 12px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.P{color:#16a34a;font-weight:700}.A{color:#dc2626;font-weight:700}.L{color:#d97706;font-weight:700}.footer{display:flex;justify-content:space-between;margin-top:48px}.sig{border-top:1px solid #374151;text-align:center;padding-top:6px;font-size:11px;color:#6b7280;min-width:140px;display:inline-block}</style></head><body>
    <h2>📋 Attendance Sheet</h2>
    <div class="meta">Date: ${new Date(date).toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} | Teacher: ${user?.name} | Subject: ${user?.subject||'-'}${filterClass?` | Class: ${filterClass}${filterSection?`-${filterSection}`:''}`:''}</div>
    <div class="stats"><div class="stat"><p class="stat-num" style="color:#374151">${filtered.length}</p><p>Total</p></div><div class="stat"><p class="stat-num" style="color:#16a34a">${present}</p><p>Present</p></div><div class="stat"><p class="stat-num" style="color:#dc2626">${absent}</p><p>Absent</p></div><div class="stat"><p class="stat-num" style="color:#d97706">${late}</p><p>Late</p></div></div>
    <table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Roll No</th><th>Class</th><th>Year</th><th>Session</th><th>Status</th><th>Remark</th><th>Signature</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer"><span class="sig">Teacher's Signature</span><span class="sig">HOD's Signature</span><span class="sig">Principal's Signature</span></div></body></html>`)
    win.document.close(); win.print()
  }, [filtered, attendance, todayMarked, remarks, date, filterClass, filterSection, user])

  // ── Excel ──────────────────────────────────────────────────────────────────
  const exportExcel = useCallback(() => {
    if (!filtered.length) { toast.error('No data to export.'); return }
    const label = [filterClass?`Class:${filterClass}`:'',filterSection?`Section:${filterSection}`:'',filterYear?`Year:${filterYear}`:'',filterSession?`Session:${filterSession}`:''].filter(Boolean).join(' | ')||'All Classes'
    const ws = XLSX.utils.aoa_to_sheet([
      ['Attendance Report'],
      [`Date: ${date}  |  Teacher: ${user?.name}  |  Subject: ${user?.subject||'-'}`],
      [`Filter: ${label}`],
      [],
      ['#','Name','Email','Roll No','Class','Section','Year','Session','Status','Remark'],
      ...filtered.map((s,i)=>[i+1,s.name,s.email||'-',s.rollNo||'-',s.class||'-',s.section||'-',s.year||'-',s.session||'-',todayMarked[s._id]||attendance[s._id]||'Present',remarks[s._id]||'-']),
    ])
    ws['!cols']=[4,22,26,10,10,10,8,10,10,20].map(w=>({wch:w}))
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Attendance')
    XLSX.writeFile(wb,`attendance_${date}_${filterClass||'all'}.xlsx`)
    toast.success('Excel exported!')
  }, [filtered,attendance,todayMarked,remarks,date,filterClass,filterSection,filterYear,filterSession,user])

  // ── PDF ────────────────────────────────────────────────────────────────────
  const exportPDF = useCallback(() => {
    if (!filtered.length) { toast.error('No data to export.'); return }
    const label = [filterClass?`Class:${filterClass}`:'',filterSection?`Section:${filterSection}`:'',filterYear?`Year:${filterYear}`:'',filterSession?`Session:${filterSession}`:''].filter(Boolean).join(' | ')||'All Classes'
    const doc = new jsPDF({orientation:'landscape'})
    doc.setFontSize(16); doc.setTextColor(79,70,229); doc.text('Attendance Sheet',14,16)
    doc.setFontSize(9); doc.setTextColor(80)
    doc.text(`Date: ${date}  |  Teacher: ${user?.name}  |  Subject: ${user?.subject||'-'}`,14,24)
    doc.text(`Filter: ${label}`,14,30)
    const p=filtered.filter(s=>(todayMarked[s._id]||attendance[s._id]||'Present')==='Present').length
    const a=filtered.filter(s=>(todayMarked[s._id]||attendance[s._id])==='Absent').length
    const l=filtered.filter(s=>(todayMarked[s._id]||attendance[s._id])==='Late').length
    doc.text(`Total:${filtered.length} | Present:${p} | Absent:${a} | Late:${l}`,14,36)
    autoTable(doc,{
      startY:42,
      head:[['#','Name','Email','Roll No','Class','Section','Year','Session','Status','Remark']],
      body:filtered.map((s,i)=>[i+1,s.name,s.email||'-',s.rollNo||'-',s.class||'-',s.section||'-',s.year||'-',s.session||'-',todayMarked[s._id]||attendance[s._id]||'Present',remarks[s._id]||'-']),
      headStyles:{fillColor:[79,70,229],textColor:255},
      alternateRowStyles:{fillColor:[248,250,252]},
      styles:{fontSize:7.5},
    })
    doc.save(`attendance_${date}_${filterClass||'all'}.pdf`)
    toast.success('PDF exported!')
  }, [filtered,attendance,todayMarked,remarks,date,filterClass,filterSection,filterYear,filterSession,user])

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  const shareWhatsApp = useCallback(() => {
    const absentList = filtered.filter(s=>(todayMarked[s._id]||attendance[s._id])==='Absent').map((s,i)=>`${i+1}. ${s.name} (${s.rollNo||'-'})`).join('\n')
    const present = filtered.filter(s=>(todayMarked[s._id]||attendance[s._id]||'Present')==='Present').length
    const absent  = filtered.filter(s=>(todayMarked[s._id]||attendance[s._id])==='Absent').length
    const msg = `📋 *Attendance — ${date}*\nTeacher: ${user?.name}\nClass: ${filterClass||'All'}${filterSection?`-${filterSection}`:''}\n\nTotal: ${filtered.length} | Present: ${present} | Absent: ${absent}\n\n${absentList?`*Absent Students:*\n${absentList}`:'✅ All students are present!'}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }, [filtered,attendance,todayMarked,date,filterClass,filterSection,user])

  // ── Status button style ────────────────────────────────────────────────────
  const statusBtnStyle = (current, target) => {
    const active = (current || 'Present') === target
    if (!active) return 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 border border-transparent'
    if (target === 'Present') return 'bg-gradient-to-b from-green-400 to-green-600 text-white shadow-md shadow-green-500/30 border border-green-500'
    if (target === 'Absent')  return 'bg-gradient-to-b from-red-400 to-red-600 text-white shadow-md shadow-red-500/30 border border-red-500'
    return 'bg-gradient-to-b from-yellow-400 to-yellow-600 text-white shadow-md shadow-yellow-500/30 border border-yellow-500'
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Modals ── */}
      {showQR && <QRScannerModal onClose={() => setShowQR(false)} onScan={handleQRScan} />}

      {profileStudent && (
        <StudentProfileModal
          student={profileStudent}
          attendanceStatus={todayMarked[profileStudent._id] || attendance[profileStudent._id] || 'Not Marked'}
          historyStats={bulkHistory[profileStudent._id]}
          onClose={() => setProfileStudent(null)}
        />
      )}

      {heatmapStudent && !profileStudent && (
        <HeatmapModal
          student={heatmapStudent}
          history={bulkHistory[heatmapStudent._id]?.recent || []}
          onClose={() => setHeatmapStudent(null)}
        />
      )}

      {editRecord && (
        <EditModal
          student={editRecord.student}
          currentStatus={editRecord.currentStatus}
          attendanceId={editRecord.attendanceId}
          onClose={() => setEditRecord(null)}
          onSave={handleEditSave}
        />
      )}

      {showCopyYesterday && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCopyYesterday(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-black text-gray-800 dark:text-white mb-2">📋 Copy Yesterday's Attendance</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Pre-fills all unmarked students with yesterday's status. You can still change them before submitting.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowCopyYesterday(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">Cancel</button>
              <button onClick={copyYesterdayAttendance}
                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-black shadow-lg hover:opacity-90 transition-all">Copy</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummary && summaryData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-7 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">🎉</div>
            <h3 className="text-xl font-black text-gray-800 dark:text-white mb-1">Attendance Submitted!</h3>
            <p className="text-sm text-gray-400 mb-5">{summaryData.success} of {summaryData.total} records saved</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label:'Present', value:summaryData.present, color:'text-green-600', bg:'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' },
                { label:'Absent',  value:summaryData.absent,  color:'text-red-500',   bg:'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' },
                { label:'Late',    value:summaryData.late,    color:'text-yellow-600', bg:'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' },
              ].map((item, i) => (
                <div key={i} className={`${item.bg} rounded-2xl p-3`}>
                  <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={exportExcel} className="flex-1 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20">📊 Excel</button>
              <button onClick={exportPDF}   className="flex-1 py-2 border border-red-500 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20">📄 PDF</button>
            </div>
            <button onClick={() => setShowSummary(false)}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl text-sm font-black hover:opacity-90 shadow-lg">
              ✓ Done
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-white">Mark Attendance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {filtered.length} students • {pendingCount} pending
            {savingDraft && <span className="ml-2 text-indigo-400 text-xs animate-pulse">💾 Auto-saving...</span>}
            {draftLoaded && !savingDraft && <span className="ml-2 text-green-500 text-xs">📝 Draft loaded</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* FIX: max={TODAY} prevents selecting future dates */}
          <input type="date" value={date} max={TODAY}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={() => setCompactMode(p => !p)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
            {compactMode ? '⊞ Expand' : '⊟ Compact'}
          </button>
          <button onClick={() => setShowQR(true)}
            className="px-3 py-2 border border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-bold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all">
            📷 QR Scan
          </button>
          <button onClick={() => setShowCopyYesterday(true)}
            className="px-3 py-2 border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
            📋 Copy Yesterday
          </button>
          <button onClick={handleUndo} disabled={!undoStack.length}
            title="Ctrl+Z"
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all">
            ↩️ Undo
          </button>
          <button onClick={handlePrint}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
            🖨️ Print
          </button>
          <button onClick={exportExcel}
            className="px-3 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">
            📊 Excel
          </button>
          <button onClick={exportPDF}
            className="px-3 py-2 border border-red-500 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
            📄 PDF
          </button>
          <button onClick={shareWhatsApp}
            className="px-3 py-2 border border-green-400 text-green-600 rounded-xl text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-all">
            📲 WhatsApp
          </button>
          <button onClick={handleSubmit} disabled={submitting || pendingCount === 0}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-black shadow-lg hover:opacity-90 disabled:opacity-50 transition-all">
            {submitting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</>
              : '✅ Submit'}
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-2 mb-4 flex items-center gap-3 flex-wrap">
        <span className="text-indigo-600 dark:text-indigo-400 text-xs font-black">⌨️ Shortcuts:</span>
        {[['P','Present'],['A','Absent'],['L','Late'],['↑↓','Navigate (always)'],['Enter','Profile'],['Ctrl+Z','Undo']].map(([key,label]) => (
          <span key={key} className="text-xs text-indigo-500 dark:text-indigo-400">
            <kbd className="bg-white dark:bg-gray-700 border border-indigo-200 dark:border-indigo-700 rounded px-1.5 py-0.5 font-mono font-bold text-indigo-700 dark:text-indigo-300">{key}</kbd> {label}
          </span>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-5">
            {/* Live donut ring */}
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={dark?'#1f2937':'#f1f5f9'} strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3.5"
                  strokeDasharray={`${progressPct} ${100-progressPct}`} strokeLinecap="round"
                  style={{ transition:'stroke-dasharray 0.6s ease' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-indigo-600">{progressPct}%</span>
              </div>
            </div>
            <div className="flex gap-5 flex-wrap">
              {[
                { label:'Total',   value:filtered.length,          color:'text-gray-700 dark:text-gray-200' },
                { label:'Marked',  value:alreadyMarked,            color:'text-indigo-600' },
                { label:'Pending', value:pendingCount,             color:'text-orange-500' },
                { label:'Present', value:countByStatus('Present'), color:'text-green-500' },
                { label:'Absent',  value:countByStatus('Absent'),  color:'text-red-500' },
                { label:'Late',    value:countByStatus('Late'),    color:'text-yellow-500' },
              ].map((item,i) => (
                <div key={i} className="text-center">
                  <p className={`text-xl font-black ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Bulk mark */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-bold">Bulk:</span>
            {['Present','Absent','Late'].map(status => (
              <button key={status}
                onClick={() => {
                  const bulk = {}
                  filtered.filter(s => !lockedStudents[s._id]).forEach(s => { bulk[s._id] = status })
                  setAttendance(p => ({ ...p, ...bulk }))
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                  status === 'Present' ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300' :
                  status === 'Absent'  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300' :
                  'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                }`}>
                {status === 'Present' ? '✅' : status === 'Absent' ? '❌' : '⏰'} All {status}
              </button>
            ))}
          </div>
        </div>
        {filtered.length > 0 && (
          <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-700"
              style={{ width:`${progressPct}%` }} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <input type="text" placeholder="Search by name, roll no or email..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

        {/* Class — resets all downstream */}
        <select value={filterClass}
          onChange={e => { setFilterClass(e.target.value); setFilterSection(''); setFilterYear(''); setFilterSession('') }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Classes</option>
          {classOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Section — resets Year and Session */}
        <select value={filterSection}
          onChange={e => { setFilterSection(e.target.value); setFilterYear(''); setFilterSession('') }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Sections</option>
          {sectionOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Year — resets Session */}
        <select value={filterYear}
          onChange={e => { setFilterYear(e.target.value); setFilterSession('') }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Years</option>
          {yearOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Session */}
        <select value={filterSession}
          onChange={e => setFilterSession(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Sessions</option>
          {sessionOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {(filterClass || filterSection || filterYear || filterSession) && (
          <button onClick={() => { setFilterClass(''); setFilterSection(''); setFilterYear(''); setFilterSession('') }}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all border border-gray-200 dark:border-gray-600">
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading students...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">👥</div>
            <p className="font-bold text-gray-500 dark:text-gray-400">No students found</p>
          </div>
        ) : (
          <div className="overflow-x-auto
            [&::-webkit-scrollbar]:h-1.5
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-indigo-300 dark:[&::-webkit-scrollbar-thumb]:bg-indigo-600
            [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-4 py-3 font-black text-center">#</th>
                  <th className="px-4 py-3 font-black text-left">Student</th>
                  {!compactMode && <th className="px-4 py-3 font-black text-center">Roll No</th>}
                  <th className="px-4 py-3 font-black text-center">Class</th>
                  {!compactMode && <th className="px-4 py-3 font-black text-center">Year</th>}
                  {!compactMode && <th className="px-4 py-3 font-black text-center">Session</th>}
                  <th className="px-4 py-3 font-black text-center">Last 3</th>
                  <th className="px-4 py-3 font-black text-center">Status</th>
                  <th className="px-4 py-3 font-black text-center">Mark</th>
                  {!compactMode && <th className="px-4 py-3 font-black text-left">Remark</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, i) => {
                  const isLocked      = !!lockedStudents[student._id]
                  const currentStatus = todayMarked[student._id] || attendance[student._id] || 'Present'
                  const history       = bulkHistory[student._id]
                  const recent        = history?.recent || []
                  const totalPct      = history?.total > 0
                    ? Math.round(((history.present + history.late) / history.total) * 100)
                    : null
                  const isAtRisk = totalPct !== null && totalPct < 75
                  const streak   = streaks[student._id] || 0

                  return (
                    <tr key={student._id}
                      tabIndex={0}
                      data-student-index={i}
                      onClick={() => setProfileStudent(student)}
                      className={`border-b border-gray-50 dark:border-gray-700/50 last:border-0
                        outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400
                        cursor-pointer transition-colors
                        ${isLocked
                          ? 'opacity-75 bg-gray-50/50 dark:bg-gray-700/20 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10'
                          : currentStatus === 'Absent'
                          ? 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : currentStatus === 'Late'
                          ? 'bg-yellow-50/40 dark:bg-yellow-900/10 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                          : 'hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10'
                        }`}>

                      <td className="px-4 py-3 text-gray-400 text-xs text-center" onClick={e => e.stopPropagation()}>
                        {i + 1}
                      </td>

                      {/* Student cell — clicking opens profile */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {student.photo
                            ? <img src={student.photo} className={`${compactMode?'w-8 h-8':'w-10 h-10'} rounded-xl object-cover flex-shrink-0 shadow-sm`} />
                            : <div className={`${compactMode?'w-8 h-8':'w-10 h-10'} rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm text-sm`}>
                                {student.name.charAt(0)}
                              </div>
                          }
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className={`font-bold text-gray-800 dark:text-white leading-tight ${compactMode?'text-xs':'text-sm'}`}>{student.name}</p>
                              {isAtRisk && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md font-black">⚠️ At Risk</span>}
                              {streak >= 3 && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-md font-black">🔥{streak}</span>}
                            </div>
                            {!compactMode && <p className="text-xs text-gray-400">{student.email || 'No email'}</p>}
                            {isLocked && <p className="text-xs text-green-500 font-bold">✓ Marked</p>}
                            {totalPct !== null && (
                              <span className={`text-[10px] font-bold ${totalPct>=75?'text-green-500':'text-red-500'}`}>Overall: {totalPct}%</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {!compactMode && (
                        <td className="px-4 py-3 text-gray-400 text-xs text-center" onClick={e => e.stopPropagation()}>
                          {student.rollNo || '-'}
                        </td>
                      )}

                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-black border border-indigo-200 dark:border-indigo-800">
                          {student.class}{student.section?`-${student.section}`:''}
                        </span>
                      </td>

                      {!compactMode && (
                        <td className="px-4 py-3 text-gray-400 text-xs text-center" onClick={e => e.stopPropagation()}>
                          {student.year || '-'}
                        </td>
                      )}
                      {!compactMode && (
                        <td className="px-4 py-3 text-gray-400 text-xs text-center" onClick={e => e.stopPropagation()}>
                          {student.session || '-'}
                        </td>
                      )}

                      {/* Last 3 days — click opens heatmap, stopPropagation so row click doesn't fire */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          {recent.length > 0
                            ? recent.slice(0,3).map((rec,j) => (
                              <div key={j}
                                title={`${rec.date}: ${rec.status}`}
                                onClick={e => { e.stopPropagation(); setHeatmapStudent(student) }}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black cursor-pointer hover:scale-110 transition-transform ${
                                  rec.status==='Present'?'bg-green-100 dark:bg-green-900/30 text-green-600':
                                  rec.status==='Absent' ?'bg-red-100 dark:bg-red-900/30 text-red-500':
                                  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
                                }`}>
                                {rec.status.charAt(0)}
                              </div>
                            ))
                            : <span onClick={e=>{e.stopPropagation();setHeatmapStudent(student)}}
                                className="text-xs text-gray-300 dark:text-gray-600 cursor-pointer">—</span>
                          }
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                          currentStatus==='Present'?'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300':
                          currentStatus==='Absent' ?'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300':
                          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        }`}>{currentStatus}</span>
                      </td>

                      {/* Mark buttons OR Locked */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {isLocked ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            {attendanceIds[student._id] && (
                              <button
                                onClick={e => { e.stopPropagation(); setEditRecord({ student, currentStatus:todayMarked[student._id], attendanceId:attendanceIds[student._id] }) }}
                                className="text-xs text-indigo-500 hover:text-indigo-700 font-bold px-1.5 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                                title="Edit this record">
                                ✏️
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-center">
                            {[['P','Present'],['A','Absent'],['L','Late']].map(([btn, fullStatus]) => (
                              <button key={btn}
                                onClick={e => { e.stopPropagation(); quickMark(student._id, fullStatus) }}
                                className={`${compactMode?'w-7 h-7 text-[10px]':'w-9 h-9 text-xs'} rounded-xl font-black transition-all ${statusBtnStyle(attendance[student._id], fullStatus)}`}>
                                {btn}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Remark */}
                      {!compactMode && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="text" placeholder="Add remark..."
                            value={remarks[student._id] || ''}
                            onChange={e => setRemarks(p => ({ ...p, [student._id]: e.target.value }))}
                            disabled={isLocked}
                            className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed" />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default TMarkAttendance