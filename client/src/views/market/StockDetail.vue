<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import request from '@/api/request'
import aiApi from '@/api/ai'
import { createChart } from 'lightweight-charts'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import { useThemeStore } from '@/stores/themeStore'

const md = new MarkdownIt()
const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const code = String(route.params.code || '')
  .trim()
  .replace(/^(sh|sz|bj)/i, '')
  .replace(/\.(SH|SZ|BJ)$/i, '')
  .toUpperCase()
const stock = ref(null)
const klines = ref([])
const indicators = ref([])
const chartContainer = ref(null)
const aiResult = ref('')
const aiLoading = ref(false)
const aiModel = ref('deepseek-v3')
const aiMode = ref('comprehensive')
const aiParams = ref({})
const isDark = computed(() => {
  if (themeStore.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return themeStore.theme === 'dark'
})
const cardClass = computed(() => (isDark.value ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'))
const subtleTextClass = computed(() => (isDark.value ? 'text-gray-400' : 'text-gray-600'))
const minorTextClass = computed(() => (isDark.value ? 'text-gray-300' : 'text-slate-700'))
const emptyTextClass = computed(() => (isDark.value ? 'text-gray-600' : 'text-slate-500'))
const aiInsightBoxClass = computed(() => (isDark.value ? 'bg-gray-800/50 p-3 rounded border-l-2 border-orange-400' : 'bg-orange-50 p-3 rounded border-l-2 border-orange-400'))
const aiLevelBoxClass = computed(() => (isDark.value ? 'grid grid-cols-2 gap-2 text-center bg-gray-800/30 p-2 rounded' : 'grid grid-cols-2 gap-2 text-center bg-slate-100 p-2 rounded'))
const aiMarkdownClass = computed(() => (isDark.value ? 'prose prose-invert prose-sm max-w-none text-gray-400 text-xs leading-6' : 'prose prose-slate prose-sm max-w-none text-slate-700 text-xs leading-6'))
const aiAssistantBubbleClass = computed(() => (isDark.value ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-slate-700'))

function goBack() {
  const hasBack = typeof window !== 'undefined' && window.history?.state?.back
  if (hasBack) {
    router.back()
    return
  }
  router.push('/market')
}

const aiModels = ref([
  { label: 'DeepSeek V3 (通用)', value: 'deepseek-v3' },
  { label: 'DeepSeek R1 (推理)', value: 'deepseek-r1' },
  { label: 'Qwen3.5-397B (长文)', value: 'qwen-plus' },
  { label: 'Claude 3.5 (高级)', value: 'claude' },
])

const aiModes = [
  { label: '综合诊断', value: 'comprehensive' },
  { label: '短线博弈', value: 'short-term' },
  { label: '长线价值', value: 'long-term' },
]

const aiData = computed(() => {
  if (!aiResult.value) return null
  try {
    // 1. 尝试匹配 Markdown 代码块中的 JSON
    const jsonMatch = aiResult.value.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }
    
    // 2. 尝试直接解析整个字符串 (如果 AI 只返回了 JSON)
    // 过滤掉可能的非 JSON 前缀/后缀
    const firstBrace = aiResult.value.indexOf('{')
    const lastBrace = aiResult.value.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const potentialJson = aiResult.value.slice(firstBrace, lastBrace + 1)
      return JSON.parse(potentialJson)
    }
    
    return null
  } catch (e) {
    return null
  }
})

const chatMessage = ref('')
const chatMessages = ref([])
let chart = null

// 最新一条技术指标
const latestIndicator = computed(() => {
  if (!indicators.value.length) return null
  return indicators.value[indicators.value.length - 1]
})

function rsiColor(val) {
  if (val == null) return minorTextClass.value
  if (val >= 70) return 'text-red-400'
  if (val <= 30) return 'text-green-400'
  return minorTextClass.value
}

onMounted(async () => {
  try {
    // 加载股票信息
    const stockRes = await request.get(`/stocks/${code}`)
    stock.value = stockRes.data

    // 加载K线数据
    const klineRes = await request.get(`/market/kline/${code}`, { params: { limit: 250 } })
    klines.value = klineRes.data

    // 加载技术指标
    try {
      const indRes = await request.get(`/market/indicators/${code}`, { params: { limit: 250 } })
      indicators.value = indRes.data || []
    } catch { indicators.value = [] }

    // 渲染图表
    await nextTick()
    if (chartContainer.value && klines.value.length > 0) {
      renderChart()
    }
    const { data: aiSettings } = await aiApi.getSettings()
    aiParams.value = aiSettings.params || {}
    const customModels = (aiSettings.models || [])
      .filter(m => m.enabled)
      .map(m => ({ label: `${m.name}${m.ownerName ? `（${m.ownerName}）` : ''}`, value: m.modelRef || m.id }))
    if (customModels.length) {
      const base = aiModels.value.filter(m => !String(m.value).startsWith('custom_'))
      aiModels.value = [...base, ...customModels]
    }
    if (aiSettings.defaults?.analysisModel) {
      aiModel.value = aiSettings.defaults.analysisModel
    }
  } catch (e) {
    console.error(e)
  }
})

onUnmounted(() => {
  if (chart) chart.remove()
})

function renderChart() {
  chart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: 420,
    layout: {
      background: { color: isDark.value ? '#0a0e17' : '#ffffff' },
      textColor: isDark.value ? '#94a3b8' : '#475569',
      fontSize: 12,
    },
    grid: {
      vertLines: { color: isDark.value ? '#1f2937' : '#e2e8f0' },
      horzLines: { color: isDark.value ? '#1f2937' : '#e2e8f0' },
    },
    crosshair: { mode: 0 },
    timeScale: {
      borderColor: isDark.value ? '#2a3a52' : '#cbd5e1',
      timeVisible: false,
    },
    rightPriceScale: { borderColor: isDark.value ? '#2a3a52' : '#cbd5e1' },
  })

  // 蜡烛图
  const candleSeries = chart.addCandlestickSeries({
    upColor: '#ef4444',       // A股涨红
    downColor: '#10b981',     // A股跌绿
    borderUpColor: '#ef4444',
    borderDownColor: '#10b981',
    wickUpColor: '#ef4444',
    wickDownColor: '#10b981',
  })

  const chartData = klines.value.map(k => ({
    time: k.date,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
  }))
  candleSeries.setData(chartData)

  // 成交量
  const volumeSeries = chart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
  })
  chart.priceScale('volume').applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  })
  volumeSeries.setData(klines.value.map(k => ({
    time: k.date,
    value: k.volume,
    color: k.close >= k.open ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
  })))

  chart.timeScale().fitContent()

  // MA 均线叠加 (从 indicators 数据)
  if (indicators.value.length > 0) {
    const indMap = new Map(indicators.value.map(ind => [ind.date, ind]))

    const addMaLine = (field, color, title) => {
      const data = klines.value
        .map(k => {
          const ind = indMap.get(k.date)
          const val = ind?.[field]
          return val != null ? { time: k.date, value: val } : null
        })
        .filter(Boolean)
      if (data.length > 0) {
        const series = chart.addLineSeries({
          color,
          lineWidth: 1,
          title,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        series.setData(data)
      }
    }

    addMaLine('ma5',  '#f59e0b', 'MA5')
    addMaLine('ma20', '#3b82f6', 'MA20')
    addMaLine('ma60', '#8b5cf6', 'MA60')
  }
}

watch(isDark, () => {
  if (!chart) return
  chart.applyOptions({
    layout: {
      background: { color: isDark.value ? '#0a0e17' : '#ffffff' },
      textColor: isDark.value ? '#94a3b8' : '#475569',
      fontSize: 12
    },
    grid: {
      vertLines: { color: isDark.value ? '#1f2937' : '#e2e8f0' },
      horzLines: { color: isDark.value ? '#1f2937' : '#e2e8f0' }
    },
    timeScale: { borderColor: isDark.value ? '#2a3a52' : '#cbd5e1' },
    rightPriceScale: { borderColor: isDark.value ? '#2a3a52' : '#cbd5e1' }
  })
})

const observer = new ResizeObserver(() => {
  if (chart && chartContainer.value) {
    chart.applyOptions({ width: chartContainer.value.clientWidth })
  }
})
if (chartContainer.value) {
  observer.observe(chartContainer.value)
}

// 注册销毁回调
onUnmounted(() => {
  observer.disconnect()
  if (chart) {
    chart.remove()
    chart = null
  }
})

// AI 一键分析
async function aiAnalyze() {
  aiLoading.value = true
  aiResult.value = ''
  try {
    const stream = aiApi.analyze(code, 'stock-analysis', { 
      model: aiModel.value, 
      mode: aiMode.value,
      params: aiParams.value
    })
    for await (const chunk of stream) {
      aiResult.value += chunk
    }
  } catch (e) {
    ElMessage.error('AI 分析失败: ' + (e.message || ''))
  } finally {
    aiLoading.value = false
  }
}

// AI 对话
async function sendChat() {
  if (!chatMessage.value.trim()) return
  const msg = chatMessage.value
  chatMessages.value.push({ role: 'user', content: msg })
  chatMessage.value = ''

  const aiMsg = { role: 'assistant', content: '' }
  chatMessages.value.push(aiMsg)

  try {
    const stream = aiApi.chat(msg, null, { stockCode: code, stockName: stock.value?.name }, {
      model: aiModel.value,
      params: aiParams.value
    })
    for await (const chunk of stream) {
      aiMsg.content += chunk
    }
  } catch (e) {
    aiMsg.content = '分析出错: ' + (e.message || '')
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <el-button
          type="primary"
          plain
          round
          class="!h-9 !px-3 !text-[14px] !font-medium dark:!border-blue-500/50 dark:!text-blue-300"
          @click="goBack"
        >
          <el-icon class="mr-1"><ArrowLeft /></el-icon>
          返回
        </el-button>
        <div>
          <h2 class="sq-list-title flex items-center gap-2" v-if="stock">
            <span class="text-blue-400 font-mono">{{ stock.code }}</span>
            {{ stock.name }}
            <el-tag size="small" effect="plain">{{ stock.industry || stock.market }}</el-tag>
          </h2>
          <!-- 基本面数据跑马灯 -->
          <div v-if="stock" class="flex items-center gap-4 text-xs mt-1 font-mono" :class="subtleTextClass">
            <span>现价: <span :class="stock.changePercent >= 0 ? 'text-red-500' : 'text-green-500'">{{ stock.price }} ({{ stock.changePercent }}%)</span></span>
            <span>PE: <span :class="minorTextClass">{{ stock.pe || '--' }}</span></span>
            <span>PB: <span :class="minorTextClass">{{ stock.pb || '--' }}</span></span>
            <span>市值: <span :class="minorTextClass">{{ (stock.marketCap / 100000000).toFixed(2) }}亿</span></span>
            <span>换手: <span :class="minorTextClass">{{ stock.turnoverRate }}%</span></span>
          </div>
        </div>
      </div>
      <el-button type="warning" :loading="aiLoading" @click="aiAnalyze">🧠 AI 分析</el-button>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <!-- K线图 -->
      <div class="xl:col-span-2">
        <el-card :class="cardClass" shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="sq-section-title">K线图 · 日线</span>
              <span class="text-xs" :class="subtleTextClass">{{ klines.length }} 根K线</span>
            </div>
          </template>
          <div ref="chartContainer" class="w-full" style="min-height: 420px">
            <div v-if="klines.length === 0" class="flex items-center justify-center h-96" :class="emptyTextClass">
              暂无K线数据，请先在行情中心同步数据
            </div>
          </div>
        </el-card>

        <!-- 技术指标摘要 -->
        <el-card v-if="latestIndicator" :class="cardClass" shadow="never" class="mt-3">
          <template #header><span class="sq-section-title">📐 技术指标 · {{ latestIndicator.date }}</span></template>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <div :class="subtleTextClass">MACD</div>
              <div>DIF: <span :class="(latestIndicator.macd?.dif || 0) >= 0 ? 'text-red-400' : 'text-green-400'">{{ latestIndicator.macd?.dif ?? '--' }}</span></div>
              <div>DEA: <span :class="minorTextClass">{{ latestIndicator.macd?.dea ?? '--' }}</span></div>
              <div>柱: <span :class="(latestIndicator.macd?.histogram || 0) >= 0 ? 'text-red-400' : 'text-green-400'">{{ latestIndicator.macd?.histogram ?? '--' }}</span></div>
            </div>
            <div>
              <div :class="subtleTextClass">RSI</div>
              <div>RSI6: <span :class="rsiColor(latestIndicator.rsi6)">{{ latestIndicator.rsi6 ?? '--' }}</span></div>
              <div>RSI14: <span :class="rsiColor(latestIndicator.rsi14)">{{ latestIndicator.rsi14 ?? '--' }}</span></div>
            </div>
            <div>
              <div :class="subtleTextClass">BOLL</div>
              <div>上轨: <span :class="minorTextClass">{{ latestIndicator.boll?.upper ?? '--' }}</span></div>
              <div>中轨: <span :class="minorTextClass">{{ latestIndicator.boll?.mid ?? '--' }}</span></div>
              <div>下轨: <span :class="minorTextClass">{{ latestIndicator.boll?.lower ?? '--' }}</span></div>
            </div>
            <div>
              <div :class="subtleTextClass">KDJ</div>
              <div>K: <span :class="minorTextClass">{{ latestIndicator.kdj?.k ?? '--' }}</span></div>
              <div>D: <span :class="minorTextClass">{{ latestIndicator.kdj?.d ?? '--' }}</span></div>
              <div>J: <span :class="(latestIndicator.kdj?.j || 50) > 80 ? 'text-red-400' : (latestIndicator.kdj?.j || 50) < 20 ? 'text-green-400' : minorTextClass">{{ latestIndicator.kdj?.j ?? '--' }}</span></div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧 AI 面板 -->
      <div class="space-y-4">
        <!-- AI 分析结果 -->
        <el-card v-if="aiResult || aiLoading" :class="cardClass" shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-orange-400">🧠 AI 深度诊断</span>
              <span v-if="aiLoading" class="text-xs animate-pulse" :class="subtleTextClass">分析中...</span>
            </div>
          </template>
          
          <div v-if="aiData" class="space-y-5">
            <!-- 评分与信号 -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <el-progress type="dashboard" :percentage="aiData.score" :color="aiData.score >= 70 ? '#f56c6c' : '#e6a23c'" :width="70">
                  <template #default="{ percentage }">
                    <span class="text-xl font-bold">{{ percentage }}</span>
                  </template>
                </el-progress>
                <div>
                  <div class="text-xs" :class="subtleTextClass">综合评分</div>
                  <el-tag class="mt-1" :type="aiData.signal === 'buy' ? 'danger' : (aiData.signal === 'sell' ? 'success' : 'warning')" effect="dark">
                    {{ aiData.signal === 'buy' ? '强烈看多' : (aiData.signal === 'sell' ? '看空' : '观望') }}
                  </el-tag>
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs" :class="subtleTextClass">置信度</div>
                <div class="text-lg font-mono">{{ (aiData.confidence * 100).toFixed(0) }}%</div>
              </div>
            </div>

            <!-- 五维雷达 (用进度条模拟) -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div v-for="(val, key) in aiData.radar" :key="key">
                <div class="flex justify-between mb-1" :class="subtleTextClass">
                  <span>{{ {valuation:'估值', growth:'成长', profit:'盈利', technical:'技术', capital:'资金'}[key] }}</span>
                  <span>{{ val }}/10</span>
                </div>
                <el-progress :percentage="val * 10" :show-text="false" :color="val >= 7 ? '#f56c6c' : '#409eff'" />
              </div>
            </div>

            <!-- 核心观点 -->
            <div :class="aiInsightBoxClass">
              <div class="text-orange-400 text-xs font-bold mb-1">💡 核心观点</div>
              <p class="text-sm leading-relaxed" :class="minorTextClass">{{ aiData.summary }}</p>
            </div>

            <!-- 详细分析 -->
            <el-tabs class="demo-tabs">
              <el-tab-pane label="技术面" name="tech">
                <div :class="aiMarkdownClass" v-html="md.render(aiData.technicalView || '')"></div>
              </el-tab-pane>
              <el-tab-pane label="基本面" name="fund">
                <div :class="aiMarkdownClass" v-html="md.render(aiData.fundamentalView || '')"></div>
              </el-tab-pane>
            </el-tabs>

            <!-- 关键点位 -->
            <div :class="aiLevelBoxClass">
              <div>
                <div class="text-xs" :class="subtleTextClass">支撑位</div>
                <div class="text-green-400 font-mono">{{ aiData.keyLevels?.support || '--' }}</div>
              </div>
              <div>
                <div class="text-xs" :class="subtleTextClass">压力位</div>
                <div class="text-red-400 font-mono">{{ aiData.keyLevels?.resistance || '--' }}</div>
              </div>
            </div>
          </div>

          <!-- 降级文本展示 -->
          <div v-else-if="aiResult" class="text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto" :class="minorTextClass">
            {{ aiResult }}
          </div>
          
          <!-- 空状态 -->
          <div v-else class="text-center py-8" :class="emptyTextClass">
            <p>点击上方按钮开始深度诊断</p>
          </div>
        </el-card>

        <!-- AI 对话 -->
        <el-card :class="cardClass" shadow="never">
          <template #header><span class="sq-section-title">💬 AI 问答</span></template>
          <div class="space-y-3 max-h-72 overflow-y-auto mb-3">
            <div v-for="(msg, i) in chatMessages" :key="i"
              class="text-sm p-2 rounded-lg"
              :class="msg.role === 'user' ? 'bg-blue-500/10 text-blue-300' : aiAssistantBubbleClass"
            >
              <span class="text-xs" :class="subtleTextClass">{{ msg.role === 'user' ? '你' : 'AI' }}:</span>
              <div class="mt-1 whitespace-pre-wrap">{{ msg.content }}</div>
            </div>
            <div v-if="chatMessages.length === 0" class="text-center text-xs py-4" :class="emptyTextClass">
              向 AI 提问关于 {{ stock?.name || code }} 的问题
            </div>
          </div>
          <div class="flex gap-2">
            <el-input v-model="chatMessage" placeholder="输入问题..." size="small" @keyup.enter="sendChat" />
            <el-button type="primary" size="small" @click="sendChat" :disabled="!chatMessage.trim()">发送</el-button>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>
