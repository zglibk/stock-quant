/**
 * Claude Provider Adapter (Anthropic SDK)
 */
const Anthropic = require('@anthropic-ai/sdk');

class ClaudeAdapter {
  constructor(apiKey, config) {
    this.config = config;
    this.client = new Anthropic({ apiKey });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;
  }

  async chat(messages, params = {}) {
    const { system, userMessages } = this._separateSystem(messages);
    const response = await this.client.messages.create({
      model: params.model || this.model,
      max_tokens: params.maxTokens || this.maxTokens,
      temperature: params.temperature,
      top_p: params.topP,
      system: system || undefined,
      messages: userMessages,
    });
    return response.content[0].text;
  }

  async *stream(messages, params = {}) {
    const { system, userMessages } = this._separateSystem(messages);
    const stream = this.client.messages.stream({
      model: params.model || this.model,
      max_tokens: params.maxTokens || this.maxTokens,
      temperature: params.temperature,
      top_p: params.topP,
      system: system || undefined,
      messages: userMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  buildVisionMessages(prompt, { base64, mediaType }) {
    return [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 }
        },
        { type: 'text', text: prompt }
      ]
    }];
  }

  _separateSystem(messages) {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    return { system: systemMsg?.content, userMessages };
  }
}

module.exports = ClaudeAdapter;
