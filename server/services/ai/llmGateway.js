/**
 * LLM 统一网关 - Provider Adapter 模式
 * 支持: Claude / OpenAI / DeepSeek
 * 支持: text chat + vision + streaming
 */
const aiConfig = require('../../config/ai.config');
const logger = require('../../utils/logger');

class LLMGateway {
  constructor() {
    this.providers = {};
    this._initProviders();
  }

  _initProviders() {
    // Claude
    if (process.env.CLAUDE_API_KEY) {
      const ClaudeAdapter = require('./providers/claudeAdapter');
      this.providers.claude = new ClaudeAdapter(process.env.CLAUDE_API_KEY, aiConfig.providers.claude);
      logger.info('  ├─ Claude adapter 已加载');
    }
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      const OpenAIAdapter = require('./providers/openaiAdapter');
      this.providers.openai = new OpenAIAdapter(process.env.OPENAI_API_KEY, aiConfig.providers.openai);
      logger.info('  ├─ OpenAI adapter 已加载');
    }
    // DeepSeek (OpenAI 兼容)
    if (process.env.DEEPSEEK_API_KEY) {
      const OpenAIAdapter = require('./providers/openaiAdapter');
      
      // 1. 注册 deepseek (文本)
      if (aiConfig.providers.deepseek) {
        this.providers.deepseek = new OpenAIAdapter(process.env.DEEPSEEK_API_KEY, aiConfig.providers.deepseek);
        logger.info('  ├─ DeepSeek V3 adapter 已加载');
      }
      
      // 注册 deepseek_r1 (推理)
      if (aiConfig.providers.deepseek_r1) {
        this.providers.deepseek_r1 = new OpenAIAdapter(process.env.DEEPSEEK_API_KEY, aiConfig.providers.deepseek_r1);
        logger.info('  ├─ DeepSeek R1 adapter 已加载');
      }

      // 注册 qwen_plus (长文本)
      if (aiConfig.providers.qwen_plus) {
        this.providers.qwen_plus = new OpenAIAdapter(process.env.DEEPSEEK_API_KEY, aiConfig.providers.qwen_plus);
        logger.info('  ├─ Qwen Plus adapter 已加载');
      }

      // 2. 注册 qwen_vl (图片)，复用 DEEPSEEK_API_KEY
      if (aiConfig.providers.qwen_vl) {
        // 注意: Qwen-VL 在 SiliconFlow 上也是通过 OpenAI SDK 调用，但 endpoint 可能略有不同，这里假设兼容
        this.providers.qwen_vl = new OpenAIAdapter(process.env.DEEPSEEK_API_KEY, aiConfig.providers.qwen_vl);
        logger.info('  ├─ Qwen-VL adapter 已加载 (Vision)');
      }

      // 注册 qwen_vl_lite (备用)
      if (aiConfig.providers.qwen_vl_lite) {
        this.providers.qwen_vl_lite = new OpenAIAdapter(process.env.DEEPSEEK_API_KEY, aiConfig.providers.qwen_vl_lite);
        logger.info('  ├─ Qwen-VL Lite adapter 已加载 (Vision Backup)');
      }
    }

    const count = Object.keys(this.providers).length;
    if (count === 0) {
      logger.warn('⚠️ 未配置任何 AI Provider API Key！请检查 .env 文件');
    } else {
      logger.info(`🧠 AI 网关初始化完成，已加载 ${count} 个 Provider`);
    }
  }

  _resolveProviderName(scene, modelOverride) {
    let providerName = modelOverride || aiConfig.routing[scene] || 'deepseek';
    const modelMap = {
      'deepseek-v3': 'deepseek',
      'deepseek-r1': 'deepseek_r1',
      'qwen-plus':   'qwen_plus',
      'claude':      'claude',
      'gpt-4':       'openai'
    };
    if (modelMap[providerName]) providerName = modelMap[providerName];
    return providerName;
  }

  _buildCustomProvider(customModel = {}) {
    const providerType = customModel.providerType || 'openai';
    const modelConfig = {
      model: customModel.model,
      baseURL: customModel.baseURL,
      maxTokens: customModel.maxTokens || 8192
    };
    if (providerType === 'anthropic') {
      const ClaudeAdapter = require('./providers/claudeAdapter');
      return new ClaudeAdapter(customModel.apiKey, modelConfig);
    }
    const OpenAIAdapter = require('./providers/openaiAdapter');
    return new OpenAIAdapter(customModel.apiKey, modelConfig);
  }

  _getProviderInfo(scene, modelOverride, customModel) {
    if (customModel?.apiKey && customModel?.model) {
      return {
        provider: this._buildCustomProvider(customModel),
        providerName: customModel.id || customModel.name || 'custom'
      };
    }
    const providerName = this._resolveProviderName(scene, modelOverride);
    const provider = this.providers[providerName];
    if (!provider) {
      const fallback = Object.values(this.providers)[0];
      if (!fallback) throw new Error('没有可用的 AI Provider，请配置 API Key');
      logger.warn(`Provider "${providerName}" 不可用，降级到 "${Object.keys(this.providers)[0]}"`);
      return { provider: fallback, providerName: Object.keys(this.providers)[0] };
    }
    return { provider, providerName };
  }

  // 根据场景获取 Provider (支持 model 参数动态覆盖)
  _getProvider(scene, modelOverride, customModel) {
    return this._getProviderInfo(scene, modelOverride, customModel).provider;
  }

  getProviderName(scene, modelOverride) {
    return this._resolveProviderName(scene, modelOverride);
  }

  // 普通对话 (非流式)
  async chat(scene, messages, options = {}) {
    const provider = this._getProvider(scene, options.model, options.customModel);
    return provider.chat(messages, options.params);
  }

  // 流式对话
  async *stream(scene, messages, options = {}) {
    const provider = this._getProvider(scene, options.model, options.customModel);
    yield* provider.stream(messages, options.params);
  }

  // 流式 Vision 分析
  async *streamVision(scene, prompt, image, options = {}) {
    const provider = this._getProvider(scene, options.model || image.model, options.customModel);
    const baseURL = provider?.config?.baseURL || 'default';
    logger.info(`Vision Request: Model=${provider.model}, BaseURL=${baseURL}`);
    
    const messages = provider.buildVisionMessages(prompt, image);
    yield* provider.stream(messages, options.params);
  }

  async vision(scene, prompt, image, options = {}) {
    const provider = this._getProvider(scene, options.model || image.model, options.customModel);
    const messages = provider.buildVisionMessages(prompt, image);
    return provider.chat(messages, options.params);
  }
}

module.exports = new LLMGateway();
