const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { Signal } = require('../models/Market');

router.get('/', auth, async (req, res) => {
  try {
    const { unreadOnly } = req.query;
    const query = { userId: req.userId };
    if (String(unreadOnly) === 'true') query.isRead = false;
    const data = await Signal.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/read', auth, async (req, res) => {
  try {
    const signal = await Signal.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isRead: true },
      { new: true }
    );
    if (!signal) return res.status(404).json({ success: false, message: '信号不存在' });
    res.json({ success: true, data: signal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/read-all', auth, async (req, res) => {
  try {
    await Signal.updateMany({ userId: req.userId, isRead: false }, { isRead: true });
    res.json({ success: true, message: '已全部标记已读' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
