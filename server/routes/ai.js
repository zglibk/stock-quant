const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const visionLimit = require('../middleware/visionLimit');
const llmGateway = require('../services/ai/llmGateway');
const promptEngine = require('../services/ai/promptEngine');
const imageProcessor = require('../services/ai/imageProcessor');
const { AiConversation, VisionAnalysis } = require('../models/Ai');
const User = require('../models/User');
const { encryptText, decryptText, maskSecret } = require('../utils/secureConfig');
const logger = require('../utils/logger');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

function getDefaultAiSettings() {
  return {
    models: [],
    defaults: {
      chatModel: '',
      analysisModel: '',
      visionModel: ''
    }
  };
}

function getDefaultModelParams() {
  return {
    maxTokens: 4096,
    temperature: 1,
    topP: 0.95,
    topK: 20,
    minP: 0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    repetitionPenalty: 1,
    enableThinking: false,
    systemPrompt: ''
  };
}

function buildModelRef(ownerId, modelId) {
  if (!ownerId || !modelId) return modelId || '';
  return `${ownerId}::${modelId}`;
}

function parseModelRef(modelRef = '') {
  const text = String(modelRef || '');
  if (text.includes('::')) {
    const [ownerId, modelId] = text.split('::');
    return { ownerId, modelId };
  }
  return { ownerId: '', modelId: text };
}

function normalizeAiSettings(raw = {}) {
  const defaults = getDefaultAiSettings();
  const legacyParams = raw.params || getDefaultModelParams();
  const models = Array.isArray(raw.models) ? raw.models.slice(0, 20).map((m, idx) => ({
    id: m.id || `custom_${idx + 1}`,
    name: m.name || m.model || `自定义模型 ${idx + 1}`,
    providerType: m.providerType === 'anthropic' ? 'anthropic' : 'openai',
    model: m.model || '',
    baseURL: m.baseURL || '',
    apiKey: m.apiKey || '',
    apiKeyEnc: m.apiKeyEnc || '',
    apiKeyPreview: m.apiKeyPreview || '',
    enabled: m.enabled !== false,
    isVision: !!m.isVision,
    ownerId: m.ownerId || '',
    ownerName: m.ownerName || '',
    params: { ...getDefaultModelParams(), ...(m.params || legacyParams) }
  })) : [];
  return {
    models,
    defaults: { ...defaults.defaults, ...(raw.defaults || {}) }
  };
}

function sanitizeAiSettings(settings) {
  return {
    ...settings,
    models: (settings.models || []).map((m) => ({
      id: m.id,
      name: m.name,
      providerType: m.providerType,
      model: m.model,
      baseURL: m.baseURL,
      apiKeyPreview: m.apiKeyPreview,
      hasApiKey: !!m.apiKeyEnc,
      enabled: m.enabled,
      isVision: m.isVision,
      ownerId: m.ownerId,
      ownerName: m.ownerName,
      modelRef: buildModelRef(m.ownerId, m.id),
      params: m.params || getDefaultModelParams()
    }))
  };
}

async function getAccessibleModels(req) {
  const selfSettings = normalizeAiSettings(req.user?.settings?.ai || {});
  const selfModels = (selfSettings.models || []).map((m) => ({
    ...m,
    ownerId: m.ownerId || String(req.userId),
    ownerName: m.ownerName || req.user.nickname || req.user.username || '当前用户'
  }));
  if (req.user.role !== 'admin') return selfModels;
  const users = await User.find({ isActive: true }, { username: 1, nickname: 1, settings: 1 }).lean();
  const all = [];
  for (const u of users) {
    const userModels = normalizeAiSettings(u.settings?.ai || {}).models || [];
    for (const m of userModels) {
      all.push({
        ...m,
        ownerId: m.ownerId || String(u._id),
        ownerName: m.ownerName || u.nickname || u.username || String(u._id)
      });
    }
  }
  const dedup = new Map();
  for (const m of [...selfModels, ...all]) {
    dedup.set(buildModelRef(m.ownerId, m.id), m);
  }
  return [...dedup.values()];
}

async function getAiContext(req, scene, payloadModel, payloadParams) {
  const settings = normalizeAiSettings(req.user?.settings?.ai || {});
  const models = await getAccessibleModels(req);
  const sceneDefaultMap = {
    'chat-qa': settings.defaults.chatModel,
    'stock-analysis': settings.defaults.analysisModel,
    'stock-vision': settings.defaults.visionModel
  };
  const modelRef = payloadModel || sceneDefaultMap[scene] || '';
  const { ownerId, modelId } = parseModelRef(modelRef);
  const modelConfig = models.find((m) => {
    if (!m.enabled) return false;
    if (ownerId) return m.ownerId === ownerId && m.id === modelId;
    return m.id === modelId;
  });
  const customModel = modelConfig?.apiKeyEnc ? {
    id: modelConfig.id,
    name: modelConfig.name,
    providerType: modelConfig.providerType,
    model: modelConfig.model,
    baseURL: modelConfig.baseURL,
    apiKey: decryptText(modelConfig.apiKeyEnc),
    maxTokens: modelConfig?.params?.maxTokens || getDefaultModelParams().maxTokens
  } : null;
  const modelParams = modelConfig?.params || getDefaultModelParams();
  return {
    model: modelConfig ? modelConfig.id : (modelId || modelRef || undefined),
    modelRef: modelConfig ? buildModelRef(modelConfig.ownerId, modelConfig.id) : modelRef,
    ownerName: modelConfig?.ownerName || '',
    customModel,
    params: { ...modelParams, ...(payloadParams || {}) }
  };
}

router.get('/settings', auth, async (req, res) => {
  try {
    const selfSettings = normalizeAiSettings(req.user?.settings?.ai || {});
    const ownModels = (selfSettings.models || []).map((m) => ({
      ...m,
      ownerId: m.ownerId || String(req.userId),
      ownerName: m.ownerName || req.user.nickname || req.user.username || '当前用户'
    }));
    let models = ownModels;
    if (req.user.role === 'admin') {
      const allModels = await getAccessibleModels(req);
      models = allModels;
    }
    const payload = sanitizeAiSettings({ ...selfSettings, models });
    res.json({ success: true, data: payload });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/settings', auth, async (req, res) => {
  try {
    const incoming = normalizeAiSettings(req.body || {});
    const existing = normalizeAiSettings(req.user?.settings?.ai || {});
    const existingMap = new Map(existing.models.map((m) => [m.id, m]));
    const mergedModels = incoming.models.map((m) => {
      const old = existingMap.get(m.id);
      const next = { ...m };
      if (m.apiKey) {
        next.apiKeyEnc = encryptText(m.apiKey);
        next.apiKeyPreview = maskSecret(m.apiKey);
      } else if (old?.apiKeyEnc) {
        next.apiKeyEnc = old.apiKeyEnc;
        next.apiKeyPreview = old.apiKeyPreview;
      }
      next.ownerId = String(req.userId);
      next.ownerName = req.user.nickname || req.user.username || '当前用户';
      delete next.apiKey;
      return next;
    });
    const finalSettings = {
      ...incoming,
      models: mergedModels
    };
    const user = await User.findByIdAndUpdate(req.userId, {
      $set: { 'settings.ai': finalSettings }
    }, { new: true, runValidators: true });
    res.json({ success: true, data: sanitizeAiSettings(normalizeAiSettings(user.settings?.ai || {})) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/settings/test', auth, async (req, res) => {
  try {
    const { modelRef, modelConfig, params } = req.body || {};
    let testContext = null;
    if (modelConfig?.model && modelConfig?.apiKey) {
      testContext = {
        model: modelConfig.id || modelConfig.model,
        customModel: {
          id: modelConfig.id || modelConfig.model,
          name: modelConfig.name || modelConfig.model,
          providerType: modelConfig.providerType || 'openai',
          model: modelConfig.model,
          baseURL: modelConfig.baseURL || '',
          apiKey: modelConfig.apiKey,
          maxTokens: params?.maxTokens || 1024
        },
        params: { ...getDefaultModelParams(), ...(params || {}) }
      };
    } else {
      testContext = await getAiContext(req, 'chat-qa', modelRef, params);
    }
    const text = await llmGateway.chat('chat-qa', [{ role: 'user', content: '请仅回复“OK”。' }], testContext);
    res.json({
      success: true,
      data: {
        model: testContext.model,
        ownerName: testContext.ownerName || '',
        preview: String(text || '').slice(0, 80)
      }
    });
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    res.status(status).json({ success: false, message: err?.message || '连通性测试失败' });
  }
});

// ==================== 智能问答 (SSE 流式) ====================
// POST /api/ai/chat
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, conversationId, context, model, params } = req.body;

    // SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const systemPrompt = await promptEngine.render('chat-system', context || {});
    const aiContext = await getAiContext(req, 'chat-qa', model, params);
    const systemContent = aiContext.params.systemPrompt || systemPrompt;
    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: message }
    ];

    // 如果有历史对话，加载上下文
    if (conversationId) {
      const conv = await AiConversation.findById(conversationId);
      if (conv) {
        const history = conv.messages.slice(-10).map(m => ({
          role: m.role, content: m.content
        }));
        messages.splice(1, 0, ...history);
      }
    }

    let fullResponse = '';
    const stream = llmGateway.stream('chat-qa', messages, aiContext);
    for await (const chunk of stream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    // 保存对话记录
    await saveConversation(req.userId, conversationId, message, fullResponse, context);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    logger.error('AI Chat 错误:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ==================== 个股分析 ====================
// POST /api/ai/analyze
router.post('/analyze', auth, async (req, res) => {
  try {
    const { code, scene = 'stock-analysis', model, mode = 'comprehensive', params } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 上下文构建器: 从 DB 获取行情数据
    const contextBuilder = require('../services/ai/contextBuilder');
    const context = await contextBuilder.buildStockContext(code);
    context.mode = mode; // 传递分析模式

    const prompt = await promptEngine.render(scene, context);
    const aiContext = await getAiContext(req, scene, model, params);
    const messages = [{ role: 'user', content: prompt }];

    let fullResponse = '';
    const stream = llmGateway.stream(scene, messages, aiContext);
    for await (const chunk of stream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    logger.error('AI Analyze 错误:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ==================== 图片识别分析 (Vision) ====================
// POST /api/ai/vision
router.post('/vision', auth, visionLimit, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '请上传图片' });

    const { scene = 'auto', model, params: paramsRaw } = req.body;
    const payloadParams = typeof paramsRaw === 'string' ? JSON.parse(paramsRaw || '{}') : (paramsRaw || {});

    // 图片处理: 压缩 + Base64
    const { base64, mediaType, size } = await imageProcessor.process(req.file.buffer);

    // 缓存检查: 同一图片不重复分析
    const imageHash = crypto.createHash('md5').update(req.file.buffer).digest('hex');
    const cached = await VisionAnalysis.findOne({ imageHash, scene, createdAt: { $gte: new Date(Date.now() - 4 * 3600 * 1000) } });
    if (cached) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ text: cached.rawText })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // SSE 流式
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const prompt = await promptEngine.render(`vision-${scene}`, {});

    let fullResponse = '';
    const aiContext = await getAiContext(req, 'stock-vision', model, payloadParams);
    let usedModel = aiContext.model || llmGateway.getProviderName('stock-vision');
    const triedModels = [];

    const runVision = async (targetModel, customModel) => {
      let output = '';
      const stream = llmGateway.streamVision('stock-vision', prompt, { base64, mediaType, model: targetModel }, {
        model: targetModel,
        customModel,
        params: aiContext.params
      });
      for await (const chunk of stream) {
        output += chunk;
      }
      return output;
    };

    const runWithFallback = async () => {
      const firstModel = usedModel;
      triedModels.push(firstModel);
      try {
        return await runVision(firstModel, aiContext.customModel);
      } catch (err) {
        const status = err?.status;
        const canFallback = status === 400 || status === 403;
        const fallbackModel = firstModel === 'qwen_vl_lite' ? 'qwen_vl' : 'qwen_vl_lite';
        if (!canFallback || firstModel === fallbackModel) throw err;
        logger.warn(`Vision 模型 ${firstModel} 请求失败(${status})，自动切换到 ${fallbackModel}`);
        usedModel = fallbackModel;
        triedModels.push(fallbackModel);
        return runVision(fallbackModel, null);
      }
    };

    fullResponse = await runWithFallback();

    res.write(`data: ${JSON.stringify({ text: fullResponse })}\n\n`);

    // 保存分析记录 (不存图片)
    await VisionAnalysis.create({
      userId: req.userId, scene, imageHash, imageSize: size,
      provider: usedModel,
      rawText: fullResponse
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    const traceId = err?.headers?.['x-siliconcloud-trace-id'];
    logger.error('AI Vision 错误:', {
      status,
      message: err?.message,
      traceId,
      stack: err?.stack
    });
    if (!res.headersSent) {
      res.status(status).json({
        success: false,
        message: err?.message || 'Vision 分析失败',
        traceId
      });
    } else {
      res.write(`data: ${JSON.stringify({
        error: err?.message || 'Vision 分析失败',
        status,
        traceId
      })}\n\n`);
      res.end();
    }
  }
});

// ==================== 策略生成 ====================
// POST /api/ai/generate-strategy
router.post('/generate-strategy', auth, async (req, res) => {
  try {
    const { description } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const prompt = await promptEngine.render('strategy-gen', { description });
    const messages = [{ role: 'user', content: prompt }];

    const stream = llmGateway.stream('strategy-gen', messages);
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    logger.error('AI Strategy Gen 错误:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// 保存对话
async function saveConversation(userId, convId, userMsg, aiMsg, context) {
  if (convId) {
    await AiConversation.findByIdAndUpdate(convId, {
      $push: {
        messages: [
          { role: 'user', content: userMsg },
          { role: 'assistant', content: aiMsg }
        ]
      }
    });
  } else {
    await AiConversation.create({
      userId, context,
      title: userMsg.slice(0, 30),
      messages: [
        { role: 'user', content: userMsg },
        { role: 'assistant', content: aiMsg }
      ]
    });
  }
}

// ==================== Vision 历史记录 ====================
// GET /api/ai/vision/history
router.get('/vision/history', auth, async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      VisionAnalysis.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      VisionAnalysis.countDocuments({ userId: req.userId })
    ]);
    res.json({ success: true, data: { records, total, page: Number(page), limit: Number(limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/ai/vision/history/:id
router.delete('/vision/history/:id', auth, async (req, res) => {
  try {
    await VisionAnalysis.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true, message: '已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== 自选股管理 ====================
// GET /api/ai/watchlist
router.get('/watchlist', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('settings.watchlist').lean();
    const codes = user?.settings?.watchlist || [];
    // 拉取自选股的基础信息
    if (codes.length > 0) {
      const { Stock } = require('../models/Market');
      const stocks = await Stock.find({ code: { $in: codes }, isActive: true })
        .select('code name market industry price changePercent pe pb')
        .lean();
      // 按 watchlist 顺序排列
      const stockMap = new Map(stocks.map(s => [s.code, s]));
      const ordered = codes.map(c => stockMap.get(c)).filter(Boolean);
      res.json({ success: true, data: ordered });
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/ai/watchlist/add
router.post('/watchlist/add', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: '请提供股票代码' });
    await User.findByIdAndUpdate(req.userId, { $addToSet: { 'settings.watchlist': code } });
    res.json({ success: true, message: '已加入自选' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/ai/watchlist/remove
router.post('/watchlist/remove', auth, async (req, res) => {
  try {
    const { code } = req.body;
    await User.findByIdAndUpdate(req.userId, { $pull: { 'settings.watchlist': code } });
    res.json({ success: true, message: '已移除自选' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
