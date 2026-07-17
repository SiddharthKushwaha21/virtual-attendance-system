const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')
dns.setServers(['8.8.8.8', '8.8.4.4'])

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv')
const http = require('http')
const { Server } = require('socket.io')

dotenv.config()

const app = express()
const server = http.createServer(app)

// Socket.io — enables real-time live attendance sync between teachers
// who are marking the same class at the same time on different devices.
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

// Attach io to every request so controllers can emit events if needed.
app.use((req, _res, next) => { req.io = io; next() })

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log('✅ MongoDB connected!'))
  .catch(err => console.log('❌ MongoDB error:', err.message))

// Routes
app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/students', require('./routes/studentRoutes'))
app.use('/api/attendance', require('./routes/attendanceRoutes'))
app.use('/api/activity', require('./routes/activityRoutes'))
app.use('/api/teachers', require('./routes/teacherRoutes'))
app.use('/api/email', require('./routes/emailRoutes'))

app.get('/', (_req, res) => res.json({ message: '🎉 Attendance System Server is running!' }))

// Socket.io real-time events
io.on('connection', socket => {
  console.log(`🔌 Socket connected: ${socket.id}`)

  // Teacher joins a room for their specific class so only relevant updates are broadcast.
  socket.on('join-class', ({ classId }) => {
    socket.join(classId)
    console.log(`📡 Socket ${socket.id} joined room: ${classId}`)
  })

  // When a teacher marks one student, broadcast the update to all others in the same class room.
  socket.on('attendance-marked', ({ classId, studentId, status }) => {
    socket.to(classId).emit('attendance-update', { studentId, status })
  })

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`)
  })
})

const PORT = process.env.PORT || 5000

const { verifyEmailConnection } = require('./utils/emailService')
const { scheduleDailyReport, scheduleWeeklyTeacherReport } = require('./jobs/scheduledEmail')

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)
  await verifyEmailConnection()
  scheduleDailyReport()
  scheduleWeeklyTeacherReport()
})