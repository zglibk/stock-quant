const mongoose = require('mongoose');

// ==================== 股票基础信息 ====================
const stockSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true, index: true },
  name:      { type: String, required: true },
  market:    { type: String, enum: ['SH', 'SZ', 'BJ'], required: true },
  industry:  { type: String, default: '' },
  listDate:  { type: String },
  
  // 基本面数据 (自动同步)
  price:          { type: Number }, // 最新价
  changePercent:  { type: Number }, // 涨跌幅
  pe:             { type: Number }, // 市盈率(动)
  pb:             { type: Number }, // 市净率
  marketCap:      { type: Number }, // 总市值
  floatMarketCap: { type: Number }, // 流通市值
  turnoverRate:   { type: Number }, // 换手率
  
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

// ==================== 日K线数据 ====================
const dailyKlineSchema = new mongoose.Schema({
  code:   { type: String, required: true },
  date:   { type: String, required: true },  // YYYY-MM-DD
  open:   { type: Number },
  high:   { type: Number },
  low:    { type: Number },
  close:  { type: Number },
  volume: { type: Number },  // 成交量(股)
  amount: { type: Number },  // 成交额(元)
}, { timestamps: false });
dailyKlineSchema.index({ code: 1, date: -1 }, { unique: true });

// ==================== 技术指标 ====================
const indicatorSchema = new mongoose.Schema({
  code: { type: String, required: true },
  date: { type: String, required: true },
  ma5: Number, ma10: Number, ma20: Number, ma60: Number,
  macd: { dif: Number, dea: Number, histogram: Number },
  rsi6: Number, rsi14: Number,
  boll: { upper: Number, mid: Number, lower: Number },
  kdj:  { k: Number, d: Number, j: Number },
}, { timestamps: false });
indicatorSchema.index({ code: 1, date: -1 }, { unique: true });

// ==================== 策略配置 ====================
const strategySchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:      { type: String, required: true },
  type:      { type: String, enum: ['manual', 'ai-generated'], default: 'manual' },
  conditions: {
    entry: [mongoose.Schema.Types.Mixed],   // 入场条件
    exit:  [mongoose.Schema.Types.Mixed],   // 出场条件
  },
  params: {
    stopLoss:   { type: Number },  // 止损比例
    takeProfit: { type: Number },  // 止盈比例
    position:   { type: Number, default: 100 },  // 仓位百分比
  },
  description:  { type: String },
  sourcePrompt: { type: String },  // AI 生成的原始描述
  version:      { type: Number, default: 1 },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });
strategySchema.index({ userId: 1 });

// ==================== 回测结果 ====================
const backtestSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  strategyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Strategy' },
  dateRange:  { start: String, end: String },
  initialCapital: { type: Number, default: 100000 },
  metrics: {
    totalReturn:   Number,  // 总收益率
    annualReturn:  Number,  // 年化收益率
    maxDrawdown:   Number,  // 最大回撤
    sharpeRatio:   Number,  // 夏普比率
    winRate:       Number,  // 胜率
    profitLossRatio: Number,  // 盈亏比
    totalTrades:   Number,  // 总交易次数
  },
  trades: [{
    code: String, type: String, date: String,
    price: Number, quantity: Number, amount: Number, pnl: Number
  }],
  equityCurve: [{ date: String, equity: Number }],
}, { timestamps: true });
backtestSchema.index({ strategyId: 1 });

// ==================== 选股信号 ====================
const signalSchema = new mongoose.Schema({
  code:      { type: String, required: true },
  name:      { type: String },
  type:      { type: String, enum: ['buy', 'sell', 'hold'], required: true },
  source:    { type: String, enum: ['strategy', 'ai', 'manual'], default: 'ai' },
  score:     { type: Number, min: 0, max: 100 },
  reasoning: { type: String },
  strategyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Strategy' },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isRead:    { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }  // TTL 30天
});
signalSchema.index({ userId: 1, createdAt: -1 });

module.exports = {
  Stock:      mongoose.model('Stock', stockSchema),
  DailyKline: mongoose.model('DailyKline', dailyKlineSchema),
  Indicator:  mongoose.model('Indicator', indicatorSchema),
  Strategy:   mongoose.model('Strategy', strategySchema),
  Backtest:   mongoose.model('Backtest', backtestSchema),
  Signal:     mongoose.model('Signal', signalSchema),
};
