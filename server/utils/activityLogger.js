const ActivityLog = require('../models/ActivityLog')

const logActivity = async ({
  action,
  category,
  description,
  performedBy,
  performedByName,
  targetId = null,
  targetName = null,
  metadata = null,
  ip = null,
}) => {
  try {
    await ActivityLog.create({
      action,
      category,
      description,
      performedBy,
      performedByName,
      targetId,
      targetName,
      metadata,
      ip,
    })
  } catch (err) {
    // Silent fail — log error nahi rokna chahiye main flow ko
    console.log('Activity log error:', err.message)
  }
}

module.exports = { logActivity }