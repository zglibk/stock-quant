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

  // 图片识别 (非流式)
  vision: (file, scene) => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('scene', scene)
    return request.post('/ai/vision', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    })
  },

  // 图片识别 (SSE 流式，支持取消)
  visionStream: (file, scene, options = {}) => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('scene', scene)
    if (options.model) formData.append('model', options.model)
    if (options.params) formData.append('params', JSON.stringify(options.params))
    return fetchSSEFormData('/api/ai/vision', formData)
  },

  // Vision 历史记录
  getVisionHistory: (params) => request.get('/ai/vision/history', { params }),
  deleteVisionHistory: (id) => request.delete(`/ai/vision/history/${id}`),

  // 自选股
  getWatchlist: () => request.get('/ai/watchlist'),
  addToWatchlist: (code) => request.post('/ai/watchlist/add', { code }),
  removeFromWatchlist: (code) => request.post('/ai/watchlist/remove', { code }),
}

/**
 * SSE 流式请求封装 (JSON body)
 * 返回一个带 [Symbol.asyncIterator] 和 abort() 方法的对象
 */
function fetchSSE(url, body) {
  const userStore = useUserStore()
  const controller = new AbortController()
  const READ_TIMEOUT = 60000 // 60秒无数据则超时

  return {
    abort() { controller.abort() },
    async *[Symbol.asyncIterator]() {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userStore.accessToken}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        let errorMsg = `请求失败 (${response.status})`
        try {
          const json = await response.json()
          errorMsg = json.message || json.error || errorMsg
        } catch {}
        throw new Error(errorMsg)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          // 带超时的读取：60秒无数据自动终止
          const readPromise = reader.read()
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI 响应超时（60秒无数据），请检查模型配置或稍后重试')), READ_TIMEOUT)
          )
          const { done, value } = await Promise.race([readPromise, timeoutPromise])
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
                if (parsed.text) yield parsed.text
              } catch (e) {
                if (e.message && !e.message.includes('Unexpected')) throw e
              }
            }
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') return  // 用户主动取消，静默退出
        throw e
      }
    }
  }
}

/**
 * SSE FormData 请求 (用于 Vision，支持取消)
 */
function fetchSSEFormData(url, formData) {
  const userStore = useUserStore()
  const controller = new AbortController()
  const READ_TIMEOUT = 90000 // Vision 给90秒（图片分析更慢）

  return {
    abort() { controller.abort() },
    async *[Symbol.asyncIterator]() {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userStore.accessToken}` },
        body: formData,
        signal: controller.signal
      })

      if (!response.ok) {
        let errorMsg = `请求失败 (${response.status})`
        try {
          const json = await response.json()
          const traceId = json.traceId ? ` [${json.traceId}]` : ''
          errorMsg = `${json.message || json.error || errorMsg}${traceId}`
        } catch {}
        throw new Error(errorMsg)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const readPromise = reader.read()
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI 响应超时（90秒无数据），请检查模型配置或稍后重试')), READ_TIMEOUT)
          )
          const { done, value } = await Promise.race([readPromise, timeoutPromise])
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
                if (parsed.text) yield parsed.text
                if (parsed.error) throw new Error(parsed.error)
              } catch (e) {
                if (e.message && !e.message.includes('Unexpected')) throw e
              }
            }
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') return
        throw e
      }
    }
  }
}
