import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Webcam from 'react-webcam'

const MarkAttendance = () => {
  const [students, setStudents] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [loading, setLoading] = useState(false)
  const [scanMode, setScanMode] = useState(false)
  const [detectedStudent, setDetectedStudent] = useState(null)
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [years, setYears] = useState([])
  const [sessions, setSessions] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [faceStatus, setFaceStatus] = useState('idle')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkStatus, setBulkStatus] = useState('Present')
  const [selectedStudents, setSelectedStudents] = useState([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const detectIntervalRef = useRef(null)

  const token = JSON.parse(localStorage.getItem('user'))?.token
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  useEffect(() => {
    fetchStudents()
    fetchTodayAttendance()
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current)
    }
  }, [])

  const fetchStudents = async () => {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/students`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setStudents(data)
      setClasses([...new Set(data.map(s => s.class).filter(Boolean))])
      setYears([...new Set(data.map(s => s.year).filter(Boolean))])
      setSessions([...new Set(data.map(s => s.session).filter(Boolean))])
    } catch (err) {
      toast.error('Failed to load students!')
    }
  }

  const fetchTodayAttendance = async () => {
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/today`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTodayAttendance(data)
    } catch (err) {
      console.log('Attendance load error:', err.message)
    }
  }

  const markAttendance = async (studentId, status) => {
    try {
      setLoading(true)
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/attendance/mark`,
        { studentId, status, markedBy: 'Manual' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(data.message)
      fetchTodayAttendance()
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred!')
    } finally {
      setLoading(false)
    }
  }

  const updateAttendance = async (studentId, newStatus) => {
    try {
      setLoading(true)
      const att = todayAttendance.find(a =>
        a.studentId?._id === studentId || a.studentId === studentId
      )
      if (!att) return
      await axios.put(
        `${import.meta.env.VITE_API_URL}/attendance/${att._id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('✅ Attendance updated successfully!')
      setEditingId(null)
      fetchTodayAttendance()
    } catch (err) {
      toast.error('Failed to update attendance!')
    } finally {
      setLoading(false)
    }
  }

  const markByFace = async (studentId) => {
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/attendance/mark`,
        { studentId, status: 'Present', markedBy: 'Face Recognition' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success(`✅ ${data.message}`)
      fetchTodayAttendance()
    } catch (err) {
      if (err.response?.data?.message?.includes('already')) {
        toast(`ℹ️ ${err.response.data.message}`)
      }
    }
  }

  // ─────────────────────────────────────────────
  // Bulk Attendance
  // ─────────────────────────────────────────────
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const selectAll = () => {
    const unmarkedIds = filtered.filter(s => !getStudentStatus(s._id)).map(s => s._id)
    setSelectedStudents(unmarkedIds)
  }

  const clearSelection = () => setSelectedStudents([])

  const markBulkAttendance = async () => {
    if (selectedStudents.length === 0) { toast.error('Please select at least one student!'); return }
    try {
      setBulkLoading(true)
      let successCount = 0
      let failCount = 0
      for (const studentId of selectedStudents) {
        try {
          await axios.post(
            `${import.meta.env.VITE_API_URL}/attendance/mark`,
            { studentId, status: bulkStatus, markedBy: 'Manual' },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          successCount++
        } catch (err) {
          failCount++
        }
      }
      toast.success(`✅ ${successCount} students marked as ${bulkStatus}!${failCount > 0 ? ` (${failCount} already marked)` : ''}`)
      setSelectedStudents([])
      setBulkMode(false)
      fetchTodayAttendance()
    } catch (err) {
      toast.error('Bulk attendance failed!')
    } finally {
      setBulkLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // Print Attendance Sheet
  // ─────────────────────────────────────────────
  const printAttendance = () => {
    const presentCount = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length
    const absentCount = todayAttendance.filter(a => a.status === 'Absent').length
    const notMarkedCount = students.length - todayAttendance.length

    const rows = filtered.map((s, i) => {
      const status = getStudentStatus(s._id)
      const time = getStudentTime(s._id)
      const statusColor = status === 'Present' ? '#16a34a' : status === 'Absent' ? '#dc2626' : status === 'Late' ? '#d97706' : '#6b7280'
      const statusBg = status === 'Present' ? '#dcfce7' : status === 'Absent' ? '#fee2e2' : status === 'Late' ? '#fef3c7' : '#f3f4f6'
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; font-size: 13px; color: #374151;">${i + 1}</td>
          <td style="padding: 10px 12px; font-size: 13px; font-weight: 600; color: #111827;">${s.name}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${s.rollNo}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${s.class}${s.section ? ` - ${s.section}` : ''}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${s.year || '-'}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${s.session || '-'}</td>
          <td style="padding: 10px 12px;">
            <span style="background: ${statusBg}; color: ${statusColor}; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;">
              ${status || 'Not Marked'}
            </span>
          </td>
          <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${time || '-'}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #9ca3af;">__________</td>
        </tr>
      `
    }).join('')

    const filterInfo = [
      filterClass && `Class: ${filterClass}`,
      filterSection && `Section: ${filterSection}`,
      filterYear && `Year: ${filterYear}`,
      filterSession && `Session: ${filterSession}`,
    ].filter(Boolean).join(' | ')

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Attendance Sheet - ${today}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; padding: 30px; }
          @media print {
            body { padding: 15px; }
            .no-print { display: none !important; }
          }
          table { width: 100%; border-collapse: collapse; }
          thead tr { background: #1d4ed8; }
          thead th { color: white; padding: 10px 12px; font-size: 12px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
          tbody tr:nth-child(even) { background: #f9fafb; }
          tbody tr:hover { background: #eff6ff; }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1d4ed8;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #1d4ed8; margin-bottom: 4px;">📋 Attendance Sheet</h1>
            <p style="font-size: 13px; color: #6b7280;">${today}</p>
            ${filterInfo ? `<p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Filter: ${filterInfo}</p>` : ''}
          </div>
          <div style="text-align: right;">
            <p style="font-size: 12px; color: #6b7280;">Generated by <strong>Attendance System</strong></p>
            <p style="font-size: 12px; color: #6b7280; margin-top: 2px;">Printed on: ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>

        <!-- Stats Row -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="font-size: 22px; font-weight: 800; color: #16a34a;">${presentCount}</p>
            <p style="font-size: 11px; color: #6b7280; margin-top: 2px;">Present</p>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="font-size: 22px; font-weight: 800; color: #dc2626;">${absentCount}</p>
            <p style="font-size: 11px; color: #6b7280; margin-top: 2px;">Absent</p>
          </div>
          <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="font-size: 22px; font-weight: 800; color: #d97706;">${todayAttendance.filter(a => a.status === 'Late').length}</p>
            <p style="font-size: 11px; color: #6b7280; margin-top: 2px;">Late</p>
          </div>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center;">
            <p style="font-size: 22px; font-weight: 800; color: #6b7280;">${notMarkedCount}</p>
            <p style="font-size: 11px; color: #6b7280; margin-top: 2px;">Not Marked</p>
          </div>
        </div>

        <!-- Attendance % Bar -->
        ${students.length > 0 ? `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 12px; font-weight: 600; color: #374151;">Overall Attendance</span>
            <span style="font-size: 12px; font-weight: 700; color: ${presentCount / students.length >= 0.75 ? '#16a34a' : '#dc2626'};">
              ${students.length > 0 ? ((presentCount / students.length) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div style="background: #e5e7eb; border-radius: 999px; height: 8px; overflow: hidden;">
            <div style="background: ${presentCount / students.length >= 0.75 ? '#22c55e' : '#ef4444'}; width: ${students.length > 0 ? ((presentCount / students.length) * 100).toFixed(1) : 0}%; height: 100%; border-radius: 999px;"></div>
          </div>
        </div>
        ` : ''}

        <!-- Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">Sr</th>
              <th>Student Name</th>
              <th>Roll No</th>
              <th>Class</th>
              <th>Year</th>
              <th>Session</th>
              <th>Status</th>
              <th>Time</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <!-- Footer -->
        <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
          <div style="text-align: center; padding-top: 40px; border-top: 1px solid #374151;">
            <p style="font-size: 12px; color: #6b7280;">Class Teacher Signature</p>
          </div>
          <div style="text-align: center; padding-top: 40px; border-top: 1px solid #374151;">
            <p style="font-size: 12px; color: #6b7280;">HOD Signature</p>
          </div>
          <div style="text-align: center; padding-top: 40px; border-top: 1px solid #374151;">
            <p style="font-size: 12px; color: #6b7280;">Principal Signature</p>
          </div>
        </div>

        <div style="margin-top: 20px; text-align: center; padding: 10px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <p style="font-size: 11px; color: #9ca3af;">This is a system-generated attendance sheet — Attendance System</p>
        </div>

        <!-- Print Button -->
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="background: #1d4ed8; color: white; border: none; padding: 10px 30px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-right: 10px;">
            🖨️ Print
          </button>
          <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 10px 30px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
            ✕ Close
          </button>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=1000,height=700')
    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  // ─────────────────────────────────────────────
  // Face Detection Box
  // ─────────────────────────────────────────────
  const drawFaceBox = (faceLocation, color, label) => {
    const canvas = canvasRef.current
    const video = webcamRef.current?.video
    if (!canvas || !video) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!faceLocation) return
    const [top, right, bottom, left] = faceLocation
    const x = left, y = top, w = right - left, h = bottom - top
    const mirroredX = canvas.width - x - w
    ctx.strokeStyle = color; ctx.lineWidth = 3
    ctx.strokeRect(mirroredX, y, w, h)
    const cornerSize = 20; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(mirroredX, y + cornerSize); ctx.lineTo(mirroredX, y); ctx.lineTo(mirroredX + cornerSize, y); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mirroredX + w - cornerSize, y); ctx.lineTo(mirroredX + w, y); ctx.lineTo(mirroredX + w, y + cornerSize); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mirroredX, y + h - cornerSize); ctx.lineTo(mirroredX, y + h); ctx.lineTo(mirroredX + cornerSize, y + h); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mirroredX + w - cornerSize, y + h); ctx.lineTo(mirroredX + w, y + h); ctx.lineTo(mirroredX + w, y + h - cornerSize); ctx.stroke()
    if (label) {
      ctx.fillStyle = color
      const textWidth = ctx.measureText(label).width + 16
      ctx.fillRect(mirroredX, y - 28, textWidth, 24)
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial'
      ctx.fillText(label, mirroredX + 8, y - 10)
    }
  }

  const captureFrame = async () => {
    if (!webcamRef.current) return null
    const video = webcamRef.current.video
    if (!video) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  }

  const startFaceScan = () => {
    setScanMode(true); setDetectedStudent(null); setFaceStatus('detecting')
    toast('📷 Face scanner started!', { icon: '🤖' })
    detectIntervalRef.current = setInterval(async () => {
      try {
        const blob = await captureFrame(); if (!blob) return
        const formData = new FormData(); formData.append('file', blob, 'detect.png')
        const { data } = await axios.post('http://localhost:8000/detect', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        if (data.face_location) { setFaceStatus('found'); drawFaceBox(data.face_location, '#22c55e', 'Face Detected') }
        else { setFaceStatus('idle'); const canvas = canvasRef.current; if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height) }
      } catch (err) {}
    }, 500)
    scanIntervalRef.current = setInterval(async () => {
      try {
        const blob = await captureFrame(); if (!blob) return
        const formData = new FormData(); formData.append('file', blob, 'scan.png')
        const { data } = await axios.post('http://localhost:8000/recognize', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        if (data.success) { setDetectedStudent(data); drawFaceBox(null, '#22c55e', null); await markByFace(data.student_id) }
        else if (data.face_location) { drawFaceBox(data.face_location, '#ef4444', 'Unknown') }
      } catch (err) { console.log('Scan error:', err.message) }
    }, 3000)
  }

  const stopFaceScan = () => {
    setScanMode(false); setDetectedStudent(null); setFaceStatus('idle')
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    if (detectIntervalRef.current) clearInterval(detectIntervalRef.current)
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    toast('Face scanner stopped!', { icon: '⏹️' })
  }

  const getStudentStatus = (studentId) => {
    const att = todayAttendance.find(a => a.studentId?._id === studentId || a.studentId === studentId)
    return att ? att.status : null
  }

  const getStudentTime = (studentId) => {
    const att = todayAttendance.find(a => a.studentId?._id === studentId || a.studentId === studentId)
    return att ? att.time : null
  }

  const handleClassFilter = (cls) => {
    setFilterClass(cls)
    setFilterSection('')
    if (cls) {
      setSections([...new Set(students.filter(s => s.class === cls).map(s => s.section).filter(Boolean))])
    } else {
      setSections([])
    }
  }

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.rollNo.includes(search)
    const matchClass = filterClass ? s.class === filterClass : true
    const matchSection = filterSection ? s.section === filterSection : true
    const matchYear = filterYear ? s.year === filterYear : true
    const matchSession = filterSession ? s.session === filterSession : true
    return matchSearch && matchClass && matchSection && matchYear && matchSession
  })

  const presentCount = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length
  const absentCount = todayAttendance.filter(a => a.status === 'Absent').length
  const notMarked = students.length - todayAttendance.length

  const statusStyle = (status) => {
    if (status === 'Present') return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    if (status === 'Absent') return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    if (status === 'Late') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Mark Attendance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{today}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={printAttendance}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-700 transition-all"
          >
            🖨️ Print Sheet
          </button>
          <button
            onClick={() => { setBulkMode(!bulkMode); setSelectedStudents([]) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              bulkMode ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {bulkMode ? '✕ Cancel Bulk' : '☑️ Bulk Mark'}
          </button>
          <button
            onClick={scanMode ? stopFaceScan : startFaceScan}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              scanMode ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {scanMode ? '⏹️ Stop Scanner' : '🤖 Start Face Scanner'}
          </button>
        </div>
      </div>

      {/* Bulk Attendance Panel */}
      {bulkMode && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300">☑️ Bulk Attendance Mode</h3>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">{selectedStudents.length} students selected</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {['Present', 'Absent', 'Late'].map(s => (
                  <button key={s} onClick={() => setBulkStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      bulkStatus === s
                        ? s === 'Present' ? 'bg-green-500 text-white' : s === 'Absent' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {s === 'Present' ? '✅' : s === 'Absent' ? '❌' : '⏰'} {s}
                  </button>
                ))}
              </div>
              <button onClick={selectAll} className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-200">Select All Unmarked</button>
              <button onClick={clearSelection} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200">Clear</button>
              <button onClick={markBulkAttendance} disabled={bulkLoading || selectedStudents.length === 0}
                className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                {bulkLoading ? '⏳ Marking...' : `Mark ${selectedStudents.length} Students`}
              </button>
            </div>
          </div>
          <p className="text-xs text-orange-500 dark:text-orange-400">💡 Tip: Select students by clicking checkboxes, then choose status and click Mark.</p>
        </div>
      )}

      {/* Face Scanner */}
      {scanMode && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex gap-4">
            <div className="relative rounded-xl overflow-hidden bg-black flex-shrink-0" style={{ width: '400px', aspectRatio: '4/3' }}>
              <Webcam ref={webcamRef} className="w-full h-full object-cover" mirrored={true} style={{ display: 'block' }} />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
              <div className="absolute top-2 left-2">
                <span className={`text-white text-xs px-2 py-1 rounded-full font-medium ${
                  faceStatus === 'found' ? 'bg-green-500' : faceStatus === 'detecting' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'
                }`}>
                  {faceStatus === 'found' ? '🟢 Face Found' : faceStatus === 'detecting' ? '🔴 Scanning...' : '⚪ Waiting'}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Detection Result</h3>
              {detectedStudent ? (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">{detectedStudent.name?.charAt(0)}</div>
                    <div>
                      <p className="font-semibold text-green-700 dark:text-green-300">{detectedStudent.name}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">Roll No: {detectedStudent.rollNo}</p>
                    </div>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900/50 rounded-lg p-2">
                    <div className="flex justify-between text-xs text-green-700 dark:text-green-300 mb-1"><span>Confidence</span><span>{detectedStudent.confidence}%</span></div>
                    <div className="h-2 bg-green-200 rounded-full"><div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${detectedStudent.confidence}%` }} /></div>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 text-center">✅ Attendance Marked Successfully!</p>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 text-center">
                  <div className="text-4xl mb-2">👤</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Please face the camera...</p>
                  <p className="text-xs text-gray-400 mt-1">Scans every 3 seconds</p>
                </div>
              )}
              {todayAttendance.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recently Marked</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {todayAttendance.slice(-5).reverse().map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-300">{a.studentId?.name || 'Unknown'}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded-full ${statusStyle(a.status)}`}>{a.status}</span>
                          <span className="text-gray-400">{a.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-semibold text-green-600">{presentCount}</p>
          <p className="text-xs text-gray-400 mt-1">Present</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-semibold text-red-500">{absentCount}</p>
          <p className="text-xs text-gray-400 mt-1">Absent</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-semibold text-gray-400">{notMarked}</p>
          <p className="text-xs text-gray-400 mt-1">Not Marked</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={filterClass} onChange={(e) => handleClassFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sections</option>
          {(sections.length > 0 ? sections : [...new Set(students.map(s => s.section).filter(Boolean))]).map(s => (
            <option key={s} value={s}>Section {s}</option>
          ))}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterSession} onChange={(e) => setFilterSession(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sessions</option>
          {sessions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">👥</div>
            <p>No students found!</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                {bulkMode && <th className="px-4 py-3 w-10">☑</th>}
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Roll No</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const status = getStudentStatus(s._id)
                const time = getStudentTime(s._id)
                const isSelected = selectedStudents.includes(s._id)
                return (
                  <tr
                    key={s._id}
                    className={`border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors ${
                      bulkMode && !status ? 'cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/10' : ''
                    } ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
                    onClick={() => bulkMode && !status && toggleStudentSelection(s._id)}
                  >
                    {bulkMode && (
                      <td className="px-4 py-3">
                        {!status ? (
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-gray-600'}`}>
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700" />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.photo ? (
                          <img src={s.photo} alt={s.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 text-xs font-semibold">{s.name.charAt(0)}</div>
                        )}
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-200">{s.name}</span>
                          {s.faceEncoding && s.faceEncoding.length > 0 && <span className="ml-1 text-xs text-green-500">🤖</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.rollNo}</td>
                    <td className="px-4 py-3 text-gray-500">{s.class}{s.section && ` - ${s.section}`}</td>
                    <td className="px-4 py-3 text-gray-500">{s.year || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.session || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle(status)}`}>{status || 'Not Marked'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{time || '-'}</td>
                    <td className="px-4 py-3">
                      {status && editingId !== s._id ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${status === 'Present' ? 'text-green-500' : status === 'Absent' ? 'text-red-500' : 'text-yellow-500'}`}>✓ Done</span>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(s._id) }}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-600">
                            ✏️ Edit
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => status ? updateAttendance(s._id, 'Present') : markAttendance(s._id, 'Present')} disabled={loading}
                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50">P</button>
                          <button onClick={() => status ? updateAttendance(s._id, 'Late') : markAttendance(s._id, 'Late')} disabled={loading}
                            className="px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600 disabled:opacity-50">L</button>
                          <button onClick={() => status ? updateAttendance(s._id, 'Absent') : markAttendance(s._id, 'Absent')} disabled={loading}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50">A</button>
                          {status && (
                            <button onClick={() => setEditingId(null)}
                              className="px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-200 rounded text-xs hover:bg-gray-400">✕</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default MarkAttendance