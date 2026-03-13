const mongoose = require('mongoose');

// ==================== AI 分析结果 ====================
const aiAnalysisSchema = new mongoose.Schema({
  stockCode: { type: String, required: true },
  scene:     { type: String, required: true },
  provider:  { type: String, required: true },
  model:     { type: String },
  result:    { type: mongoose.Schema.Types.Mixed },  // JSON 结构化结果
  rawText:   { type: String },
  tokens:    { input: Number, output: Number },
  costEstimate: { type: Number },  // 预估成本(元)
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
aiAnalysisSchema.index({ stockCode: 1, createdAt: -1 });

// ==================== AI 对话历史 ====================
const aiConversationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, default: '新对话' },
  messages: [{
    role:    { type: String, enum: ['user', 'assistant', 'system'] },
    content: { type: String },
    hasImage: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  context: {
    stockCode: String,
    scene: String,
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
aiConversationSchema.index({ userId: 1, updatedAt: -1 });

// ==================== Prompt 模板 ====================
const promptTemplateSchema = new mongoose.Schema({
  scene:    { type: String, required: true, unique: true },
  name:     { type: String, required: true },
  category: { type: String, enum: ['text', 'vision'], default: 'text' },
  template: { type: String, required: true },  // Handlebars 模板
  version:  { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// ==================== 图片分析记录 ====================
const visionAnalysisSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scene:      { type: String, enum: ['kline', 'portfolio', 'detail', 'news', 'auto'], required: true },
  provider:   { type: String },
  model:      { type: String },
  imageHash:  { type: String, index: true },  // MD5 用于缓存去重
  imageSize:  { type: Number },  // 压缩后字节数
  result:     { type: mongoose.Schema.Types.Mixed },
  rawText:    { type: String },
  tokens:     { input: Number, output: Number },
  costEstimate: { type: Number },
}, { timestamps: true });
visionAnalysisSchema.index({ userId: 1, createdAt: -1 });

// ==================== AI 用量日志 ====================
const aiUsageLogSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider: { type: String },
  model:    { type: String },
  scene:    { type: String },
  type:     { type: String, enum: ['text', 'vision'], default: 'text' },
  tokens:   { input: Number, output: Number },
  costEstimate: { type: Number },
  createdAt: { type: Date, default: Date.now, expires: 7776000 }  // TTL 90天
});

module.exports = {
  AiAnalysis:      mongoose.model('AiAnalysis', aiAnalysisSchema),
  AiConversation:  mongoose.model('AiConversation', aiConversationSchema),
  PromptTemplate:  mongoose.model('PromptTemplate', promptTemplateSchema),
  VisionAnalysis:  mongoose.model('VisionAnalysis', visionAnalysisSchema),
  AiUsageLog:      mongoose.model('AiUsageLog', aiUsageLogSchema),
};
