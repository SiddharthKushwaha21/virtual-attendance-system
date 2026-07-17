const express = require('express')
const router = express.Router()
const { getLogs, clearOldLogs, getLogStats } = require('../controllers/activityController')
const { protect } = require('../middleware/authMiddleware')

router.get('/', protect, getLogs)
router.get('/stats', protect, getLogStats)
router.delete('/clear-old', protect, clearOldLogs)

module.exports = router