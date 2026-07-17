const ActivityLog = require('../models/ActivityLog')

// Get all activity logs with filters
exports.getLogs = async (req, res) => {
  try {
    const {
      category,
      action,
      startDate,
      endDate,
      limit = 100,
      page = 1,
    } = req.query

    const query = {}

    if (category) query.category = category
    if (action) query.action = action

    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query.createdAt.$lte = end
      }
    }

    const total = await ActivityLog.countDocuments(query)
    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('performedBy', 'name email')

    res.json({
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Clear old logs (older than 30 days)
exports.clearOldLogs = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: thirtyDaysAgo }
    })
    res.json({ message: `${result.deletedCount} old logs cleared!` })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get summary stats
exports.getLogStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const todayStart = new Date(today)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const [totalLogs, todayLogs, categoryStats] = await Promise.all([
      ActivityLog.countDocuments(),
      ActivityLog.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
      ActivityLog.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ])

    res.json({ totalLogs, todayLogs, categoryStats })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}