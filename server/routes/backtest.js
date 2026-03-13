const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { Backtest, Strategy } = require('../models/Market');

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function buildMockMetrics(seed, position) {
  const base = Number(seed % 100) / 100;
  const riskFactor = clamp(position / 100, 0.2, 1.5);
  const totalReturn = Number(((base * 18 - 4) * riskFactor).toFixed(2));
  const annualReturn = Number((totalReturn * 0.7).toFixed(2));
  const maxDrawdown = Number((clamp(6 + (1 - base) * 15, 4, 28)).toFixed(2));
  const winRate = Number((clamp(42 + base * 28, 35, 78)).toFixed(2));
  return {
    totalReturn,
    annualReturn,
    maxDrawdown,
    sharpeRatio: Number((clamp(0.6 + base * 1.1, 0.3, 2.2)).toFixed(2)),
    winRate,
    profitLossRatio: Number((clamp(0.9 + base * 1.3, 0.8, 3.2)).toFixed(2)),
    totalTrades: Math.round(clamp(18 + base * 70, 8, 120))
  };
}

function buildEquityCurve(start, end, initialCapital, totalReturn) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.max(1, Math.ceil((endDate - startDate) / (24 * 3600 * 1000)));
  const steps = Math.min(20, Math.max(6, Math.floor(days / 10)));
  const result = [];
  for (let i = 0; i <= steps; i += 1) {
    const ratio = i / steps;
    const swing = Math.sin(ratio * 6.28) * 0.03;
    const growth = (totalReturn / 100) * ratio + swing;
    const equity = Number((initialCapital * (1 + growth)).toFixed(2));
    const date = new Date(startDate.getTime() + ratio * (endDate - startDate));
    result.push({ date: date.toISOString().slice(0, 10), equity });
  }
  return result;
}

// POST /api/backtest/run - 执行回测
router.post('/run', auth, async (req, res) => {
  try {
    const { strategyId, dateRange, initialCapital = 100000 } = req.body || {};
    if (!strategyId) return res.status(400).json({ success: false, message: '缺少 strategyId' });
    const strategy = await Strategy.findOne({ _id: strategyId, userId: req.userId, isActive: true });
    if (!strategy) return res.status(404).json({ success: false, message: '策略不存在或无权限' });
    const start = dateRange?.start || '2024-01-01';
    const end = dateRange?.end || new Date().toISOString().slice(0, 10);
    const seed = Math.abs(Number(String(strategyId).slice(-6), 16) || Date.now());
    const metrics = buildMockMetrics(seed, Number(strategy?.params?.position || 100));
    const equityCurve = buildEquityCurve(start, end, Number(initialCapital), metrics.totalReturn);
    const backtest = await Backtest.create({
      userId: req.userId,
      strategyId,
      dateRange: { start, end },
      initialCapital: Number(initialCapital),
      metrics,
      trades: [],
      equityCurve
    });
    const populated = await Backtest.findById(backtest._id).populate('strategyId', 'name');
    res.json({ success: true, data: populated, message: '回测已完成（快速模式）' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/backtest - 回测历史
router.get('/', auth, async (req, res) => {
  try {
    const backtests = await Backtest.find({ userId: req.userId })
      .populate('strategyId', 'name')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, data: backtests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
