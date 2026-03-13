const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { Stock, DailyKline, Indicator } = require('../models/Market');

// GET /api/stocks - 股票列表 (支持搜索)
router.get('/', auth, async (req, res) => {
  try {
    const { keyword, industry, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (keyword) {
      query.$or = [
        { code: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } }
      ];
    }
    if (industry) query.industry = industry;

    const total = await Stock.countDocuments(query);
    const stocks = await Stock.find(query)
      .sort({ code: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, data: { stocks, total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/stocks/:code - 个股详情
router.get('/:code', auth, async (req, res) => {
  try {
    const stock = await Stock.findOne({ code: req.params.code });
    if (!stock) return res.status(404).json({ success: false, message: '股票不存在' });
    res.json({ success: true, data: stock });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
