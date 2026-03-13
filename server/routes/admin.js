const router = require('express').Router();
const { auth, rbac } = require('../middleware/auth');
const User = require('../models/User');
const { Stock, Strategy, Backtest, Signal } = require('../models/Market');
const { AiConversation, VisionAnalysis } = require('../models/Ai');

// GET /api/admin/stats - 系统统计
router.get('/stats', auth, rbac('admin'), async (req, res) => {
  try {
    const [
      usersTotal,
      activeUsers,
      stocksTotal,
      strategiesTotal,
      backtestsTotal,
      unreadSignals,
      aiConversations,
      visionAnalyses
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Stock.countDocuments({ isActive: true }),
      Strategy.countDocuments({ isActive: true }),
      Backtest.countDocuments(),
      Signal.countDocuments({ isRead: false }),
      AiConversation.countDocuments({ isActive: true }),
      VisionAnalysis.countDocuments()
    ]);
    res.json({
      success: true,
      data: {
        usersTotal,
        activeUsers,
        stocksTotal,
        strategiesTotal,
        backtestsTotal,
        unreadSignals,
        aiConversations,
        visionAnalyses
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
