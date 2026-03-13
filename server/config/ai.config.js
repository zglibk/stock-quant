/**
 * AI 模型路由与预算配置
 */
module.exports = {
  // 场景 → 模型路由
  routing: {
    'stock-analysis': 'deepseek', // 文本分析用 DeepSeek-V3
    'strategy-gen':   'deepseek',
    'chat-qa':        'deepseek',
    'market-read':    'deepseek',
    'stock-vision':   'qwen_vl_lite',
  },

  // 模型配置
  providers: {
    claude: {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
    },
    openai: {
      model: 'gpt-4o-mini',
      maxTokens: 4096,
    },
    // SiliconFlow (DeepSeek V3) - 文本增强版
    deepseek: {
      model: 'deepseek-ai/DeepSeek-V3',
      baseURL: 'https://api.siliconflow.cn/v1',
      maxTokens: 4096,
    },
    // SiliconFlow (DeepSeek R1) - 推理增强版
    deepseek_r1: {
      model: 'deepseek-ai/DeepSeek-R1',
      baseURL: 'https://api.siliconflow.cn/v1',
      maxTokens: 8192,
      apiKeyEnv: 'DEEPSEEK_API_KEY'
    },
    // SiliconFlow (Qwen3.5-397B-A17B) - 多模态增强版
    qwen_plus: {
      model: 'Qwen/Qwen3.5-397B-A17B',
      baseURL: 'https://api.siliconflow.cn/v1',
      maxTokens: 8192,
      apiKeyEnv: 'DEEPSEEK_API_KEY'
    },
    // SiliconFlow (Qwen2.5-VL) - 视觉增强版 (最新稳定版)
    qwen_vl: {
      model: 'Qwen/Qwen2.5-VL-72B-Instruct', 
      baseURL: 'https://api.siliconflow.cn/v1',
      maxTokens: 4096,
      apiKeyEnv: 'DEEPSEEK_API_KEY'
    },
    // SiliconFlow (Qwen2.5-VL-7B) - 备用小模型
    qwen_vl_lite: {
      model: 'Pro/Qwen/Qwen2.5-VL-7B-Instruct',
      baseURL: 'https://api.siliconflow.cn/v1',
      maxTokens: 4096,
      apiKeyEnv: 'DEEPSEEK_API_KEY'
    }
  },

  // 成本控制
  limits: {
    dailyTokenLimit: parseInt(process.env.AI_DAILY_TOKEN_LIMIT) || 500000,
    visionDailyLimit: parseInt(process.env.AI_VISION_DAILY_LIMIT) || 30,
    maxConcurrentVision: 2,  // 2G 内存限制并发
  }
};
