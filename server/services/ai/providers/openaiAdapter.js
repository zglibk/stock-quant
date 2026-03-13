/**
 * OpenAI / DeepSeek Provider Adapter
 * DeepSeek API 兼容 OpenAI 格式，共用此 Adapter
 */
const OpenAI = require('openai');

class OpenAIAdapter {
  constructor(apiKey, config) {
    this.config = config; // 保存配置以供后续访问
    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseURL || undefined,  // DeepSeek 需要设置 baseURL
    });
    this.model = config.model || 'gpt-4o-mini';
    this.maxTokens = config.maxTokens || 4096;
  }

  _buildRequest(messages, params = {}) {
    const payload = {
      model: params.model || this.model,
      max_tokens: params.maxTokens || this.maxTokens,
      messages,
    };
    if (params.temperature !== undefined) payload.temperature = params.temperature;
    if (params.topP !== undefined) payload.top_p = params.topP;
    if (params.presencePenalty !== undefined) payload.presence_penalty = params.presencePenalty;
    if (params.frequencyPenalty !== undefined) payload.frequency_penalty = params.frequencyPenalty;
    const extraBody = {};
    if (params.topK !== undefined) extraBody.top_k = params.topK;
    if (params.minP !== undefined) extraBody.min_p = params.minP;
    if (params.repetitionPenalty !== undefined) extraBody.repetition_penalty = params.repetitionPenalty;
    if (params.enableThinking !== undefined) extraBody.enable_thinking = params.enableThinking;
    if (Object.keys(extraBody).length) payload.extra_body = extraBody;
    return payload;
  }

  async chat(messages, params = {}) {
    const response = await this.client.chat.completions.create(this._buildRequest(messages, params));
    return response.choices[0].message.content;
  }

  async *stream(messages, params = {}) {
    const stream = await this.client.chat.completions.create({
      ...this._buildRequest(messages, params),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  buildVisionMessages(prompt, { base64, mediaType }) {
    // 构造图片 URL 对象
    // SiliconFlow / Qwen-VL 不支持 detail 参数，必须移除
    const imageUrl = { url: `data:${mediaType};base64,${base64}` };
    
    // 仅针对 OpenAI 官方 GPT-4 模型添加 detail 参数
    if (this.model.includes('gpt-4')) {
      imageUrl.detail = 'auto';
    }

    return [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: imageUrl },
        { type: 'text', text: prompt }
      ]
    }];
  }
}

module.exports = OpenAIAdapter;
