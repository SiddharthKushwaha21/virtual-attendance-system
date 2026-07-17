import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Area, AreaChart, ReferenceLine
} from 'recharts'

const Reports = () => {
  const [attendance, setAttendance] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSession, setFilterSession] = useState('')
  const [searchStudent, setSearchStudent] = useState('')
  
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [years, setYears] = useState([])
  const [sessions, setSessions] = useState([])
  
  const [activeTab, setActiveTab] = useState('daily')

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [monthlyData, setMonthlyData] = useState(null)
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  const [lowAttendanceData, setLowAttendanceData] = useState(null)
  const [lowLoading, setLowLoading] = useState(false)

  const [trendsData, setTrendsData] = useState([])
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsRawData, setTrendsRawData] = useState([]) // raw data for filtering

  const token = JSON.parse(localStorage.getItem('user'))?.token

  useEffect(() => {
    fetchStudents()
    fetchAttendance(selectedDate)
  }, [])

  useEffect(() => {
    if (activeTab === 'monthly') fetchMonthlyData(selectedMonth)
    if (activeTab === 'low') fetchLowAttendance()
    if (activeTab === 'trends') fetchTrendsData()
  }, [activeTab])

  // Re-filter trends when filters change
  useEffect(() => {
    if (trendsRawData.length > 0) applyTrendsFilter(trendsRawData)
  }, [filterClass, filterSection, filterYear, filterSession, trendsRawData])

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

  const fetchAttendance = async (date) => {
    try {
      setLoading(true)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/date/${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setAttendance(data)
    } catch (err) {
      toast.error('Failed to load attendance!')
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyData = async (month) => {
    try {
      setMonthlyLoading(true)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/monthly?month=${month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setMonthlyData(data)
    } catch (err) {
      toast.error('Failed to load monthly data!')
    } finally {
      setMonthlyLoading(false)
    }
  }

  const fetchLowAttendance = async () => {
    try {
      setLowLoading(true)
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/attendance/low-attendance`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setLowAttendanceData(data)
    } catch (err) {
      toast.error('Failed to load low attendance data!')
    } finally {
      setLowLoading(false)
    }
  }

  const applyTrendsFilter = (rawData) => {
    const totalStudents = students.length || 1
    const formatted = rawData.map(({ date, data }) => {
      // Apply filters
      const filteredData = data.filter(a => {
        if (filterClass && a.class !== filterClass) return false
        if (filterSection && a.section !== filterSection) return false
        if (filterYear && a.studentId?.year !== filterYear) return false
        if (filterSession && a.studentId?.session !== filterSession) return false
        return true
      })

      const present = filteredData.filter(a => a.status === 'Present' || a.status === 'Late').length
      const absent = filteredData.filter(a => a.status === 'Absent').length
      const late = filteredData.filter(a => a.status === 'Late').length
      const pct = filteredData.length > 0 ? Math.round((present / filteredData.length) * 100) : 0
      const d = new Date(date)

      // Collect unique class/section/year/session info
      const classInfo = [...new Set(filteredData.map(a => a.class).filter(Boolean))].join(', ')
      const sectionInfo = [...new Set(filteredData.map(a => a.section).filter(Boolean))].join(', ')
      const yearInfo = [...new Set(filteredData.map(a => a.studentId?.year).filter(Boolean))].join(', ')
      const sessionInfo = [...new Set(filteredData.map(a => a.studentId?.session).filter(Boolean))].join(', ')

      return {
        date,
        day: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        present,
        absent,
        late,
        percentage: pct,
        total: filteredData.length,
        classInfo,
        sectionInfo,
        yearInfo,
        sessionInfo,
      }
    }).filter(d => d.total > 0)

    setTrendsData(formatted)
  }

  const fetchTrendsData = async () => {
    try {
      setTrendsLoading(true)
      const last30Days = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        last30Days.push(date.toISOString().split('T')[0])
      }

      const results = await Promise.all(
        last30Days.map(date =>
          axios.get(
            `${import.meta.env.VITE_API_URL}/attendance/date/${date}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(res => ({ date, data: res.data }))
           .catch(() => ({ date, data: [] }))
        )
      )

      const rawWithData = results.filter(r => r.data.length > 0)
      setTrendsRawData(rawWithData)
      applyTrendsFilter(rawWithData)
    } catch (err) {
      toast.error('Failed to load trends data!')
    } finally {
      setTrendsLoading(false)
    }
  }

  const handleDateChange = (e) => { setSelectedDate(e.target.value); fetchAttendance(e.target.value) }
  const handleMonthChange = (e) => { setSelectedMonth(e.target.value); fetchMonthlyData(e.target.value) }

  const handleClassChange = (e) => {
    const cls = e.target.value
    setFilterClass(cls)
    setFilterSection('')
    if (cls) {
      setSections([...new Set(students.filter(s => s.class === cls).map(s => s.section).filter(Boolean))])
    } else {
      setSections([])
    }
  }

  const filteredDaily = attendance.filter(a => {
    if (filterClass && a.class !== filterClass) return false
    if (filterSection && a.section !== filterSection) return false
    if (filterYear && a.studentId?.year !== filterYear) return false
    if (filterSession && a.studentId?.session !== filterSession) return false
    if (searchStudent && !a.studentId?.name?.toLowerCase().includes(searchStudent.toLowerCase())) return false
    return true
  })

  const presentCount = filteredDaily.filter(a => a.status === 'Present' || a.status === 'Late').length
  const absentCount = filteredDaily.filter(a => a.status === 'Absent').length
  const lateCount = filteredDaily.filter(a => a.status === 'Late').length
  const percentage = filteredDaily.length > 0 ? ((presentCount / filteredDaily.length) * 100).toFixed(1) : 0

  const classwiseData = classes
    .filter(cls => !filterClass || cls === filterClass)
    .map(cls => {
      const clsAttendance = attendance.filter(a => {
        if (a.class !== cls) return false
        if (filterSection && a.section !== filterSection) return false
        if (filterYear && a.studentId?.year !== filterYear) return false
        if (filterSession && a.studentId?.session !== filterSession) return false
        return true
      })
      const clsStudents = students.filter(s => {
        if (s.class !== cls) return false
        if (filterSection && s.section !== filterSection) return false
        if (filterYear && s.year !== filterYear) return false
        if (filterSession && s.session !== filterSession) return false
        return true
      })
      const sectionBreakdown = [...new Set(clsStudents.map(s => s.section).filter(Boolean))].map(sec => {
        const secAtt = clsAttendance.filter(a => a.section === sec)
        const secPresent = secAtt.filter(a => a.status === 'Present' || a.status === 'Late').length
        const secAbsent = secAtt.filter(a => a.status === 'Absent').length
        const secTotal = secAtt.length
        const secPct = secTotal > 0 ? ((secPresent / secTotal) * 100).toFixed(1) : 0
        return { section: sec, present: secPresent, absent: secAbsent, total: secTotal, percentage: secPct }
      })
      const present = clsAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length
      const absent = clsAttendance.filter(a => a.status === 'Absent').length
      const late = clsAttendance.filter(a => a.status === 'Late').length
      const total = clsAttendance.length
      const pct = total > 0 ? ((present / total) * 100).toFixed(1) : 0
      return { class: cls, present, absent, late, total, percentage: pct, sectionBreakdown, totalStudents: clsStudents.length, filteredAttendance: clsAttendance }
    }).filter(c => c.total > 0)

  const filteredMonthlySummary = monthlyData ? monthlyData.studentSummary.filter(s => {
    if (filterClass && s.class !== filterClass) return false
    if (filterSection && s.section !== filterSection) return false
    if (filterYear && s.year !== filterYear) return false
    if (filterSession && s.session !== filterSession) return false
    return true
  }) : []

  const monthlyStats = {
    totalStudents: filteredMonthlySummary.length,
    workingDays: monthlyData?.workingDays || 0,
    totalPresent: filteredMonthlySummary.reduce((acc, curr) => acc + curr.present, 0),
    totalAbsent: filteredMonthlySummary.reduce((acc, curr) => acc + curr.absent, 0),
    lowAttendanceCount: filteredMonthlySummary.filter(s => s.isLowAttendance).length
  }

  const filteredLowAttendance = lowAttendanceData ? lowAttendanceData.lowAttendance.filter(s => {
    if (filterClass && s.class !== filterClass) return false
    if (filterSection && s.section !== filterSection) return false
    if (filterYear && s.year !== filterYear) return false
    if (filterSession && s.session !== filterSession) return false
    return true
  }) : []

  const statusStyle = (status) => {
    if (status === 'Present') return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    if (status === 'Absent') return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
  }

  const pctColor = (p) => {
    if (p >= 75) return 'text-green-500'
    if (p >= 50) return 'text-yellow-500'
    return 'text-red-500'
  }

  const pctBg = (p) => {
    if (p >= 75) return 'bg-green-500'
    if (p >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const exportExcel = () => {
    if (filteredDaily.length === 0) { toast.error('No data to export!'); return }
    const exportData = filteredDaily.map((a, i) => ({
      'Sr No': i + 1, 'Name': a.studentId?.name || '-', 'Roll No': a.studentId?.rollNo || '-',
      'Class': a.class || '-', 'Section': a.section || '-', 'Year': a.studentId?.year || '-',
      'Session': a.studentId?.session || '-', 'Status': a.status, 'Time': a.time || '-',
      'Date': selectedDate, 'Marked By': a.markedBy || 'Manual',
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    ws['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 15 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `attendance_${selectedDate}${filterClass ? `_${filterClass}` : ''}${filterSection ? `_${filterSection}` : ''}.xlsx`)
    toast.success('Excel exported successfully!')
  }

  const exportPDF = () => {
    if (filteredDaily.length === 0) { toast.error('No data to export!'); return }
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(18); doc.setTextColor(37, 99, 235); doc.text('Attendance Report', 14, 18)
    doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.text(`Date: ${selectedDate}`, 14, 28)
    if (filterClass) doc.text(`Class: ${filterClass}${filterSection ? ` - ${filterSection}` : ''}`, 14, 35)
    doc.text(`Present: ${presentCount}  |  Absent: ${absentCount}  |  Late: ${lateCount}  |  Attendance: ${percentage}%`, 14, filterClass ? 42 : 35)
    autoTable(doc, {
      startY: filterClass ? 48 : 42,
      head: [['Sr', 'Name', 'Roll No', 'Class', 'Year', 'Session', 'Status', 'Time', 'Marked By']],
      body: filteredDaily.map((a, i) => [i + 1, a.studentId?.name || '-', a.studentId?.rollNo || '-', `${a.class || '-'}${a.section ? ` - ${a.section}` : ''}`, a.studentId?.year || '-', a.studentId?.session || '-', a.status, a.time || '-', a.markedBy || 'Manual']),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Generated by Attendance System • Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 8) }
    doc.save(`attendance_${selectedDate}${filterClass ? `_${filterClass}` : ''}.pdf`)
    toast.success('PDF exported successfully!')
  }

  const exportClasswiseExcel = () => {
    if (classwiseData.length === 0) { toast.error('No data to export!'); return }
    const summaryData = classwiseData.map(c => ({ 'Class': c.class, 'Total Students': c.totalStudents, 'Present': c.present, 'Absent': c.absent, 'Late': c.late, 'Total Marked': c.total, 'Attendance %': `${c.percentage}%` }))
    const detailData = []
    classwiseData.forEach(cls => { cls.filteredAttendance.forEach((a, i) => { detailData.push({ 'Sr No': i + 1, 'Class': a.class || '-', 'Section': a.section || '-', 'Name': a.studentId?.name || '-', 'Roll No': a.studentId?.rollNo || '-', 'Year': a.studentId?.year || '-', 'Session': a.studentId?.session || '-', 'Status': a.status, 'Time': a.time || '-', 'Marked By': a.markedBy || 'Manual' }) }) })
    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary')
    const ws2 = XLSX.utils.json_to_sheet(detailData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Detailed')
    XLSX.writeFile(wb, `classwise_report_${selectedDate}.xlsx`)
    toast.success('Class-wise Excel exported successfully!')
  }

  const exportClasswisePDF = () => {
    if (classwiseData.length === 0) { toast.error('No data to export!'); return }
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(18); doc.setTextColor(37, 99, 235); doc.text('Class-wise Attendance Report', 14, 18)
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Date: ${selectedDate}`, 14, 28)
    autoTable(doc, { startY: 34, head: [['Class', 'Total Students', 'Present', 'Absent', 'Late', 'Total Marked', 'Attendance %']], body: classwiseData.map(c => [c.class, c.totalStudents, c.present, c.absent, c.late || 0, c.total, `${c.percentage}%`]), styles: { fontSize: 10, cellPadding: 4 }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248, 250, 252] } })
    classwiseData.forEach(cls => {
      if (cls.filteredAttendance.length === 0) return
      doc.addPage()
      doc.setFontSize(14); doc.setTextColor(37, 99, 235); doc.text(`${cls.class} — Detailed Attendance`, 14, 18)
      doc.setFontSize(9); doc.setTextColor(100); doc.text(`Present: ${cls.present}  |  Absent: ${cls.absent}  |  Attendance: ${cls.percentage}%`, 14, 26)
      autoTable(doc, { startY: 32, head: [['Sr', 'Name', 'Roll No', 'Section', 'Year', 'Session', 'Status', 'Time', 'Marked By']], body: cls.filteredAttendance.map((a, i) => [i + 1, a.studentId?.name || '-', a.studentId?.rollNo || '-', a.section || '-', a.studentId?.year || '-', a.studentId?.session || '-', a.status, a.time || '-', a.markedBy || 'Manual']), styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248, 250, 252] } })
    })
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Generated by Attendance System • Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 8) }
    doc.save(`classwise_report_${selectedDate}.pdf`)
    toast.success('Class-wise PDF exported successfully!')
  }

  const exportMonthlyExcel = () => {
    if (!monthlyData || filteredMonthlySummary.length === 0) { toast.error('No data to export!'); return }
    const wb = XLSX.utils.book_new()
    const summaryData = filteredMonthlySummary.map((s, i) => ({ 'Sr No': i + 1, 'Name': s.name, 'Roll No': s.rollNo, 'Class': s.class, 'Section': s.section || '-', 'Year': s.year || '-', 'Session': s.session || '-', 'Present': s.present, 'Absent': s.absent, 'Late': s.late, 'Total Days': s.total, 'Attendance %': `${s.percentage}%`, 'Status': s.isLowAttendance ? '⚠️ Low Attendance' : '✅ Good' }))
    const ws1 = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Student Summary')
    const dailyData = monthlyData.dailySummary.map((d, i) => ({ 'Sr No': i + 1, 'Date': d.date, 'Present': d.present, 'Absent': d.absent, 'Total Students': d.total, 'Attendance %': `${d.percentage}%` }))
    const ws2 = XLSX.utils.json_to_sheet(dailyData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Daily Summary')
    XLSX.writeFile(wb, `monthly_report_${selectedMonth}.xlsx`)
    toast.success('Monthly Excel exported successfully!')
  }

  const exportMonthlyPDF = () => {
    if (!monthlyData || filteredMonthlySummary.length === 0) { toast.error('No data to export!'); return }
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(18); doc.setTextColor(37, 99, 235); doc.text('Monthly Attendance Report', 14, 18)
    doc.setFontSize(10); doc.setTextColor(100)
    doc.text(`Month: ${selectedMonth}  |  Working Days: ${monthlyStats.workingDays}  |  Total Students: ${monthlyStats.totalStudents}`, 14, 28)
    doc.text(`Total Present: ${monthlyStats.totalPresent}  |  Total Absent: ${monthlyStats.totalAbsent}  |  Low Attendance: ${monthlyStats.lowAttendanceCount}`, 14, 35)
    autoTable(doc, {
      startY: 42,
      head: [['Sr', 'Name', 'Roll No', 'Class', 'Section', 'Year', 'Session', 'Present', 'Absent', 'Late', 'Total', 'Attendance %']],
      body: filteredMonthlySummary.map((s, i) => [i + 1, s.name, s.rollNo, s.class, s.section || '-', s.year || '-', s.session || '-', s.present, s.absent, s.late, s.total, `${s.percentage}%`]),
      styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => { if (data.column.index === 11 && data.section === 'body') { const val = parseFloat(data.cell.raw); if (val < 75) data.cell.styles.textColor = [220, 38, 38]; else data.cell.styles.textColor = [22, 163, 74] } }
    })
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Generated by Attendance System • Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 8) }
    doc.save(`monthly_report_${selectedMonth}.pdf`)
    toast.success('Monthly PDF exported successfully!')
  }

  const exportLowAttendanceExcel = () => {
    if (!lowAttendanceData || filteredLowAttendance.length === 0) { toast.error('No data to export!'); return }
    const exportData = filteredLowAttendance.map((s, i) => ({ 'Sr No': i + 1, 'Name': s.name, 'Roll No': s.rollNo, 'Class': s.class, 'Section': s.section || '-', 'Year': s.year || '-', 'Session': s.session || '-', 'Email': s.email || '-', 'Present': s.present, 'Absent': s.absent, 'Late': s.late, 'Total Days': s.total, 'Attendance %': `${s.percentage}%` }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Low Attendance')
    XLSX.writeFile(wb, `low_attendance_report.xlsx`)
    toast.success('Low attendance Excel exported!')
  }

  const exportTrendsExcel = () => {
    if (trendsData.length === 0) { toast.error('No trends data to export!'); return }
    const exportData = trendsData.map((d, i) => ({
      'Sr No': i + 1, 'Date': d.date, 'Day': d.weekday,
      'Class': d.classInfo || '-', 'Section': d.sectionInfo || '-',
      'Year': d.yearInfo || '-', 'Session': d.sessionInfo || '-',
      'Present': d.present, 'Absent': d.absent, 'Late': d.late || 0,
      'Total Marked': d.total, 'Attendance %': `${d.percentage}%`,
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Trends')
    XLSX.writeFile(wb, `attendance_trends_last30days.xlsx`)
    toast.success('Trends Excel exported successfully!')
  }

  // Trends stats
  const trendsBest = trendsData.length > 0 ? trendsData.reduce((a, b) => a.percentage > b.percentage ? a : b) : null
  const trendsWorst = trendsData.length > 0 ? trendsData.reduce((a, b) => a.percentage < b.percentage ? a : b) : null
  const trendsAvg = trendsData.length > 0 ? Math.round(trendsData.reduce((sum, d) => sum + d.percentage, 0) / trendsData.length) : 0

  // Custom Tooltips
  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = trendsData.find(t => t.day === label)
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 shadow-2xl text-xs">
          <p className="font-bold text-white mb-2">{d?.date || label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400" /><span className="text-gray-300">Attendance:</span><span className="text-blue-400 font-bold">{payload[0]?.value}%</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400" /><span className="text-gray-300">Present:</span><span className="text-green-400 font-bold">{d?.present}</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-gray-300">Absent:</span><span className="text-red-400 font-bold">{d?.absent}</span></div>
            {d?.late > 0 && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400" /><span className="text-gray-300">Late:</span><span className="text-yellow-400 font-bold">{d?.late}</span></div>}
            {d?.classInfo && <div className="border-t border-gray-700 pt-1 mt-1"><span className="text-gray-400">Class: </span><span className="text-gray-200">{d.classInfo}</span></div>}
            {d?.sectionInfo && <div><span className="text-gray-400">Section: </span><span className="text-gray-200">{d.sectionInfo}</span></div>}
          </div>
        </div>
      )
    }
    return null
  }

  const CustomLineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = trendsData.find(t => t.day === label)
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 shadow-2xl text-xs">
          <p className="font-bold text-white mb-2">{d?.date || label} ({d?.weekday})</p>
          {payload.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-gray-300">{p.name}:</span>
              <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
            </div>
          ))}
          {d?.classInfo && <div className="border-t border-gray-700 pt-1 mt-1"><span className="text-gray-400">Class: </span><span className="text-gray-200">{d.classInfo}</span></div>}
        </div>
      )
    }
    return null
  }

  // Bar color based on percentage
  const getBarColor = (percentage) => {
    if (percentage >= 75) return '#22c55e'
    if (percentage >= 50) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Reports</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">View and export attendance reports</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'daily' && (<><button onClick={exportExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/20">📊 Excel</button><button onClick={exportPDF} className="px-3 py-2 border border-red-500 text-red-600 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20">📄 PDF</button></>)}
          {activeTab === 'classwise' && (<><button onClick={exportClasswiseExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/20">📊 Excel</button><button onClick={exportClasswisePDF} className="px-3 py-2 border border-red-500 text-red-600 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20">📄 PDF</button></>)}
          {activeTab === 'monthly' && (<><button onClick={exportMonthlyExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/20">📊 Excel</button><button onClick={exportMonthlyPDF} className="px-3 py-2 border border-red-500 text-red-600 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20">📄 PDF</button></>)}
          {activeTab === 'low' && (<button onClick={exportLowAttendanceExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/20">📊 Excel</button>)}
          {activeTab === 'trends' && (<button onClick={exportTrendsExcel} className="px-3 py-2 border border-green-500 text-green-600 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/20">📊 Excel</button>)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
        {[
          { id: 'daily', label: '📋 Daily Report' },
          { id: 'classwise', label: '🏫 Class-wise' },
          { id: 'monthly', label: '📅 Monthly Summary' },
          { id: 'low', label: '⚠️ Low Attendance' },
          { id: 'trends', label: '📈 Trends' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
          >{tab.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        {(activeTab === 'daily' || activeTab === 'classwise') && (
          <input type="date" value={selectedDate} onChange={handleDateChange}
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {activeTab === 'monthly' && (
          <input type="month" value={selectedMonth} onChange={handleMonthChange}
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {activeTab === 'daily' && (
          <input type="text" placeholder="Search student..." value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        )}
        <select value={filterClass} onChange={handleClassChange}
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

      {/* ── DAILY REPORT TAB ── */}
      {activeTab === 'daily' && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Present', value: presentCount, color: 'text-green-600' },
              { label: 'Absent', value: absentCount, color: 'text-red-500' },
              { label: 'Late', value: lateCount, color: 'text-yellow-500' },
              { label: 'Attendance %', value: `${percentage}%`, color: pctColor(percentage) },
            ].map((card, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (<div className="text-center py-12 text-gray-400">Loading...</div>
            ) : filteredDaily.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">📋</div><p>No attendance records found!</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {['Sr', 'Student', 'Roll No', 'Class', 'Year', 'Session', 'Status', 'Time', 'Marked By'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredDaily.map((a, i) => (
                    <tr key={a._id} className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 text-xs font-semibold">{a.studentId?.name?.charAt(0) || '?'}</div><span className="font-medium text-gray-700 dark:text-gray-200">{a.studentId?.name || '-'}</span></div></td>
                      <td className="px-4 py-3 text-gray-500">{a.studentId?.rollNo || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{a.class}{a.section && ` - ${a.section}`}</td>
                      <td className="px-4 py-3 text-gray-500">{a.studentId?.year || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{a.studentId?.session || '-'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle(a.status)}`}>{a.status}</span></td>
                      <td className="px-4 py-3 text-gray-400">{a.time || '-'}</td>
                      <td className="px-4 py-3 text-gray-400">{a.markedBy || 'Manual'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── CLASS-WISE REPORT TAB ── */}
      {activeTab === 'classwise' && (
        <div>
          {loading ? (<div className="text-center py-12 text-gray-400">Loading...</div>
          ) : classwiseData.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">🏫</div><p>No attendance records found!</p></div>
          ) : (
            <div className="space-y-4">
              {classwiseData.map((cls) => (
                <div key={cls.class} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold text-sm">{cls.class.charAt(0)}</div>
                      <div><h3 className="text-sm font-semibold text-gray-800 dark:text-white">{cls.class}</h3><p className="text-xs text-gray-400">{cls.totalStudents} students filtered</p></div>
                    </div>
                    <div className="flex items-center gap-6">
                      {[{ label: 'Present', value: cls.present, color: 'text-green-600' }, { label: 'Absent', value: cls.absent, color: 'text-red-500' }, { label: 'Late', value: cls.late || 0, color: 'text-yellow-500' }, { label: 'Attendance', value: `${cls.percentage}%`, color: pctColor(cls.percentage) }].map((item, i) => (
                        <div key={i} className="text-center"><p className={`text-sm font-semibold ${item.color}`}>{item.value}</p><p className="text-xs text-gray-400">{item.label}</p></div>
                      ))}
                    </div>
                  </div>
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-2 rounded-full transition-all duration-700 ${pctBg(cls.percentage)}`} style={{ width: `${cls.percentage}%` }} />
                    </div>
                  </div>
                  {cls.sectionBreakdown.length > 0 && (
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-400 mb-2">Section Breakdown</p>
                      <div className="flex flex-wrap gap-2">
                        {cls.sectionBreakdown.map(sec => (
                          <div key={sec.section} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Section {sec.section}</span>
                            <span className="text-xs text-green-600 font-medium">{sec.present}P</span>
                            <span className="text-xs text-red-500 font-medium">{sec.absent}A</span>
                            <span className={`text-xs font-bold ${pctColor(sec.percentage)}`}>{sec.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="px-5 py-3">
                    <p className="text-xs font-medium text-gray-400 mb-2">Student Details</p>
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-gray-400 border-b border-gray-100 dark:border-gray-700">{['Name', 'Roll No', 'Section', 'Year', 'Session', 'Status', 'Time', 'Marked By'].map(h => <th key={h} className="pb-2 pr-3">{h}</th>)}</tr></thead>
                      <tbody>
                        {cls.filteredAttendance.map((a, i) => (
                          <tr key={i} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                            <td className="py-2 pr-3 font-medium text-gray-700 dark:text-gray-200">{a.studentId?.name || '-'}</td>
                            <td className="py-2 pr-3 text-gray-500">{a.studentId?.rollNo || '-'}</td>
                            <td className="py-2 pr-3 text-gray-500">{a.section || '-'}</td>
                            <td className="py-2 pr-3 text-gray-500">{a.studentId?.year || '-'}</td>
                            <td className="py-2 pr-3 text-gray-500">{a.studentId?.session || '-'}</td>
                            <td className="py-2 pr-3"><span className={`px-2 py-0.5 rounded-full font-medium ${statusStyle(a.status)}`}>{a.status}</span></td>
                            <td className="py-2 pr-3 text-gray-400">{a.time || '-'}</td>
                            <td className="py-2 text-gray-400">{a.markedBy || 'Manual'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MONTHLY SUMMARY TAB ── */}
      {activeTab === 'monthly' && (
        <div>
          {monthlyLoading ? (<div className="text-center py-12 text-gray-400"><div className="text-3xl mb-2">⏳</div><p>Loading monthly data...</p></div>
          ) : !monthlyData ? (
            <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">📅</div><p>Select a month to view summary</p></div>
          ) : filteredMonthlySummary.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">📅</div><p>No monthly records match the selected filters!</p></div>
          ) : (
            <div>
              <div className="grid grid-cols-5 gap-4 mb-6">
                {[{ label: 'Total Students', value: monthlyStats.totalStudents, color: 'text-blue-600' }, { label: 'Working Days', value: monthlyStats.workingDays, color: 'text-purple-600' }, { label: 'Total Present', value: monthlyStats.totalPresent, color: 'text-green-600' }, { label: 'Total Absent', value: monthlyStats.totalAbsent, color: 'text-red-500' }, { label: 'Low Attendance', value: monthlyStats.lowAttendanceCount, color: 'text-orange-500' }].map((card, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                    <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{card.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Student-wise Monthly Summary</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Month: {selectedMonth} • {monthlyStats.workingDays} working days</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">{['Student', 'Roll No', 'Class', 'Year', 'Session', 'Present', 'Absent', 'Late', 'Total', 'Attendance %', 'Status'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                    <tbody>
                      {filteredMonthlySummary.map((s, i) => (
                        <tr key={i} className={`border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${s.isLowAttendance ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 text-xs font-semibold">{s.name?.charAt(0) || '?'}</div><span className="font-medium text-gray-700 dark:text-gray-200">{s.name}</span></div></td>
                          <td className="px-4 py-3 text-gray-500">{s.rollNo}</td>
                          <td className="px-4 py-3 text-gray-500">{s.class}{s.section && ` - ${s.section}`}</td>
                          <td className="px-4 py-3 text-gray-500">{s.year || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{s.session || '-'}</td>
                          <td className="px-4 py-3 text-green-600 font-medium">{s.present}</td>
                          <td className="px-4 py-3 text-red-500 font-medium">{s.absent}</td>
                          <td className="px-4 py-3 text-yellow-500 font-medium">{s.late}</td>
                          <td className="px-4 py-3 text-gray-500">{s.total}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-1.5 rounded-full ${pctBg(s.percentage)}`} style={{ width: `${s.percentage}%` }} /></div><span className={`text-xs font-semibold ${pctColor(s.percentage)}`}>{s.percentage}%</span></div></td>
                          <td className="px-4 py-3">{s.isLowAttendance ? <span className="px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-medium">⚠️ Low</span> : <span className="px-2 py-0.5 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">✅ Good</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOW ATTENDANCE TAB ── */}
      {activeTab === 'low' && (
        <div>
          {lowLoading ? (<div className="text-center py-12 text-gray-400"><div className="text-3xl mb-2">⏳</div><p>Loading low attendance data...</p></div>
          ) : !lowAttendanceData ? (
            <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">⚠️</div><p>No data available</p></div>
          ) : filteredLowAttendance.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">🎉</div><p className="text-green-600 font-medium">No students with low attendance match the current filters!</p></div>
          ) : (
            <div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">{filteredLowAttendance.length} students have attendance below 75%</p>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">These students need immediate attention.</p>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">{['Student', 'Roll No', 'Class', 'Year', 'Session', 'Present', 'Absent', 'Total', 'Attendance %', 'Shortfall'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredLowAttendance.map((s, i) => {
                      const needed = Math.ceil((0.75 * s.total - (s.present + (s.late || 0))) / 0.25)
                      return (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-red-50/30 dark:hover:bg-red-900/10">
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-600 text-xs font-semibold">{s.name?.charAt(0) || '?'}</div><div><p className="font-medium text-gray-700 dark:text-gray-200">{s.name}</p>{s.email && <p className="text-xs text-gray-400">{s.email}</p>}</div></div></td>
                          <td className="px-4 py-3 text-gray-500">{s.rollNo}</td>
                          <td className="px-4 py-3 text-gray-500">{s.class}{s.section && ` - ${s.section}`}</td>
                          <td className="px-4 py-3 text-gray-500">{s.year || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{s.session || '-'}</td>
                          <td className="px-4 py-3 text-green-600 font-medium">{s.present}</td>
                          <td className="px-4 py-3 text-red-500 font-medium">{s.absent}</td>
                          <td className="px-4 py-3 text-gray-500">{s.total}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pctColor(s.percentage)} bg-red-100 dark:bg-red-900/30`}>{s.percentage}%</span></td>
                          <td className="px-4 py-3">{needed > 0 ? <span className="text-xs text-red-500 font-medium">Need {needed} more days</span> : <span className="text-xs text-gray-400">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE TRENDS TAB ── */}
      {activeTab === 'trends' && (
        <div>
          {trendsLoading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3 animate-spin">⏳</div>
              <p className="text-sm font-medium">Loading trends data...</p>
              <p className="text-xs mt-1 text-gray-500">Fetching last 30 days attendance</p>
            </div>
          ) : trendsData.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">📈</div>
              <p className="text-sm font-medium">No attendance data available for trends!</p>
              <p className="text-xs mt-1 text-gray-500">Mark some attendance to see trends here.</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Best Day', value: trendsBest?.day, sub: `${trendsBest?.percentage}% attendance`, color: 'text-green-500', bg: 'from-green-500/10 to-emerald-500/5', border: 'border-green-500/20', icon: '🏆', badge: `${trendsBest?.date}` },
                  { label: 'Worst Day', value: trendsWorst?.day, sub: `${trendsWorst?.percentage}% attendance`, color: 'text-red-500', bg: 'from-red-500/10 to-rose-500/5', border: 'border-red-500/20', icon: '📉', badge: `${trendsWorst?.date}` },
                  { label: 'Avg Attendance', value: `${trendsAvg}%`, sub: `Over ${trendsData.length} working days`, color: trendsAvg >= 75 ? 'text-green-500' : trendsAvg >= 50 ? 'text-yellow-500' : 'text-red-500', bg: 'from-blue-500/10 to-indigo-500/5', border: 'border-blue-500/20', icon: '📊', badge: trendsAvg >= 75 ? 'Good' : 'Low' },
                  { label: 'Days Tracked', value: trendsData.length, sub: 'Last 30 days data', color: 'text-purple-500', bg: 'from-purple-500/10 to-violet-500/5', border: 'border-purple-500/20', icon: '📅', badge: `${30 - trendsData.length} days no data` },
                ].map((card, i) => (
                  <div key={i} className={`rounded-2xl border ${card.border} bg-gradient-to-br ${card.bg} p-5 relative overflow-hidden`}>
                    <div className="absolute top-3 right-3 text-2xl opacity-80">{card.icon}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">{card.label}</p>
                    <p className={`text-2xl font-black ${card.color} mb-1`}>{card.value}</p>
                    <p className="text-xs text-gray-400">{card.sub}</p>
                    {card.badge && (
                      <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${card.color} bg-white/10`}>{card.badge}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Bar Chart — Premium */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Daily Attendance Trend</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Last 30 days • Color coded by threshold</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-gray-500">≥75% Good</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-yellow-500" /><span className="text-gray-500">50-74% Average</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-gray-500">&lt;50% Critical</span></div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={trendsData} barSize={18} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                        <stop offset="100%" stopColor="#16a34a" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barYellow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: '75%', position: 'right', fontSize: 10, fill: '#22c55e' }} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(156,163,175,0.1)' }} />
                    <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={30}>
                      {trendsData.map((entry, i) => (
                        <rect key={i} fill={entry.percentage >= 75 ? 'url(#barGreen)' : entry.percentage >= 50 ? 'url(#barYellow)' : 'url(#barRed)'} />
                      ))}
                      {trendsData.map((entry, index) => {
                        const color = entry.percentage >= 75 ? '#22c55e' : entry.percentage >= 50 ? '#f59e0b' : '#ef4444'
                        return <rect key={index} fill={color} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Area Chart — Present vs Absent Premium */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Present vs Absent Overview</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Student count trend over last 30 days</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-gray-500">Present</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-gray-500">Absent</span></div>
                    {trendsData.some(d => d.late > 0) && <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-yellow-500" /><span className="text-gray-500">Late</span></div>}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="areaRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="areaYellow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomLineTooltip />} cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="present" name="Present" stroke="#22c55e" strokeWidth={2.5} fill="url(#areaGreen)" dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="absent" name="Absent" stroke="#ef4444" strokeWidth={2.5} fill="url(#areaRed)" dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
                    {trendsData.some(d => d.late > 0) && (
                      <Area type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={2} fill="url(#areaYellow)" dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Day-wise Breakdown Table — Premium with Class/Section/Year/Session */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Day-wise Detailed Breakdown</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{trendsData.length} days with attendance data</p>
                  </div>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                    Avg: {trendsAvg}%
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Day</th>
                        <th className="px-5 py-3">Class</th>
                        <th className="px-5 py-3">Section</th>
                        <th className="px-5 py-3">Year</th>
                        <th className="px-5 py-3">Session</th>
                        <th className="px-5 py-3">Present</th>
                        <th className="px-5 py-3">Absent</th>
                        <th className="px-5 py-3">Late</th>
                        <th className="px-5 py-3">Total</th>
                        <th className="px-5 py-3 min-w-[160px]">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendsData.slice().reverse().map((d, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-5 py-3 font-medium text-gray-700 dark:text-gray-200">{d.date}</td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs font-medium">{d.weekday}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{d.classInfo || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{d.sectionInfo || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{d.yearInfo || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{d.sessionInfo || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 text-green-600 font-bold text-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{d.present}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 text-red-500 font-bold text-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{d.absent}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 text-yellow-500 font-bold text-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />{d.late || 0}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 font-medium">{d.total}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden min-w-[80px]">
                                <div
                                  className={`h-2 rounded-full transition-all duration-700 ${pctBg(d.percentage)}`}
                                  style={{ width: `${d.percentage}%` }}
                                />
                              </div>
                              <span className={`text-xs font-black min-w-[36px] ${pctColor(d.percentage)}`}>{d.percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Reports