const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { Strategy } = require('../models/Market');

// GET /api/strategy - 我的策略列表
router.get('/', auth, async (req, res) => {
  try {
    const strategies = await Strategy.find({ userId: req.userId, isActive: true }).sort({ updatedAt: -1 });
    res.json({ success: true, data: strategies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/strategy - 创建策略
router.post('/', auth, async (req, res) => {
  try {
    const strategy = await Strategy.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: strategy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/strategy/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const strategy = await Strategy.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: req.body, $inc: { version: 1 } },
      { new: true }
    );
    if (!strategy) return res.status(404).json({ success: false, message: '策略不存在' });
    res.json({ success: true, data: strategy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/strategy/:id (软删除)
router.delete('/:id', auth, async (req, res) => {
  try {
    await Strategy.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { isActive: false });
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
