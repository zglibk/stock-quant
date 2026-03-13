import request from './request'
import { useUserStore } from '@/stores/userStore'

export default {
  // 智能问答 (SSE)
  chat: (message, conversationId, context, options = {}) => {
    return fetchSSE('/api/ai/chat', { message, conversationId, context, ...options })
  },

  // 个股分析 (SSE)
  analyze: (code, scene = 'stock-analysis', options = {}) => {
    return fetchSSE('/api/ai/analyze', { code, scene, ...options })
  },

  // 策略生成 (SSE)
  generateStrategy: (description) => {
    return fetchSSE('/api/ai/generate-strategy', { description })
  },
  getSettings: () => request.get('/ai/settings'),
  updateSettings: (data) => request.put('/ai/settings', data),
  testSettings: (data) => request.post('/ai/settings/test', data),

  // 图片识别 (SSE or JSON)
  vision: (file, scene) => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('scene', scene)
    return request.post('/ai/vision', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    })
  },

  // 图片识别 (SSE 流式)
  visionStream: (file, scene, options = {}) => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('scene', scene)
    if (options.model) formData.append('model', options.model)
    if (options.params) formData.append('params', JSON.stringify(options.params))
    return fetchSSEFormData('/api/ai/vision', formData)
  }
}

// SSE 流式请求封装
function fetchSSE(url, body) {
  const userStore = useUserStore()
  return {
    async *[Symbol.asyncIterator]() {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userStore.accessToken}`
        },
        body: JSON.stringify(body)
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return
            try {
              const parsed = JSON.parse(data)
              if (parsed.error) throw new Error(parsed.error)
              yield parsed.text
            } catch (e) {
              if (e.message !== 'Unexpected end of JSON input') throw e
            }
          }
        }
      }
    }
  }
}

// SSE FormData 请求 (用于 Vision)
function fetchSSEFormData(url, formData) {
  const userStore = useUserStore()
  return {
    async *[Symbol.asyncIterator]() {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userStore.accessToken}` },
        body: formData
      })

      if (!response.ok) {
        let errorMsg = `请求失败 (${response.status})`
        try {
          const json = await response.json()
          const traceId = json.traceId ? `, traceId=${json.traceId}` : ''
          errorMsg = `${json.message || json.error || errorMsg}${traceId}`
        } catch {}
        throw new Error(errorMsg)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return
            try {
              yield JSON.parse(data).text
            } catch {}
          }
        }
      }
    }
  }
}
