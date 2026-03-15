<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import aiApi from '@/api/ai'
import { compressImage } from '@/utils/imageCompress'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt()
const imageFile = ref(null)
const imagePreview = ref('')
const scene = ref('kline')
const analyzing = ref(false)
const result = ref('')
const visionModel = ref('qwen_vl_lite')
const aiParams = ref({})
const statusText = ref('')       // 状态提示
const elapsed = ref(0)           // 已用时(秒)
const errorMsg = ref('')         // 错误信息
let currentStream = null         // 当前流对象(用于 abort)
let elapsedTimer = null          // 计时器

const visionModels = ref([
  { label: 'Qwen2.5-VL 7B (Lite版，推荐)', value: 'qwen_vl_lite' },
  { label: 'Qwen2.5-VL 72B (标准版)', value: 'qwen_vl' },
  { label: 'Qwen3.5-397B-A17B (多模态)', value: 'qwen_plus' },
])

const scenes = [
  { value: 'kline',     label: 'K线形态识别',    icon: '📊', desc: '识别K线图技术形态并分析趋势' },
  { value: 'portfolio', label: '持仓/交割单识别', icon: '💼', desc: '提取持仓数据并生成诊断报告' },
  { value: 'detail',    label: '个股详情提取',    icon: '📋', desc: '提取指标数据并综合分析' },
  { value: 'news',      label: '新闻/研报摘要',   icon: '📰', desc: '提取关键要点并分析影响' },
]

// 尝试解析 JSON 结果
const structuredData = computed(() => {
  if (!result.value) return null
  try {
    const jsonMatch = result.value.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch) return JSON.parse(jsonMatch[1])
    const firstBrace = result.value.indexOf('{')
    const lastBrace = result.value.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(result.value.slice(firstBrace, lastBrace + 1))
    }
    return null
  } catch { return null }
})

const renderedAnalysis = computed(() => {
  const text = structuredData.value?.analysis || ''
  if (text && text.length > 30) return md.render(text)
  return ''
})

// 判断 analysis 是否有实质内容（不是"见下文"之类的占位）
const hasRealAnalysis = computed(() => {
  const text = structuredData.value?.analysis || ''
  return text.length > 30 && !text.includes('见下文') && !text.includes('详见') && !text.includes('如下')
})

// 当 structuredData 解析成功但 analysis 太短时，提取 JSON 之外的纯文本部分作为降级
const fallbackText = computed(() => {
  if (!result.value || !structuredData.value) return ''
  // 移除 JSON 代码块，保留前后的纯文本
  const cleaned = result.value
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/\{[\s\S]*\}/g, '')
    .trim()
  return cleaned.length > 20 ? cleaned : ''
})

// 格式化已用时间
const elapsedText = computed(() => {
  const s = elapsed.value
  if (s < 60) return `${s}秒`
  return `${Math.floor(s / 60)}分${s % 60}秒`
})

function handleFileChange(file) {
  if (!file) return
  const raw = file.raw || file
  if (raw.size > 10 * 1024 * 1024) { ElMessage.warning('图片大小不能超过 10MB'); return }
  imageFile.value = raw
  imagePreview.value = URL.createObjectURL(raw)
  result.value = ''
  errorMsg.value = ''
}

function handlePaste(event) {
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      imageFile.value = file
      imagePreview.value = URL.createObjectURL(file)
      result.value = ''
      errorMsg.value = ''
      ElMessage.success('已粘贴截图')
      break
    }
  }
}

async function loadAiSettings() {
  try {
    const { data } = await aiApi.getSettings()
    aiParams.value = data.params || {}
    const customVisionModels = (data.models || [])
      .filter(m => m.enabled && m.isVision)
      .map(m => ({ label: `${m.name}${m.ownerName ? `（${m.ownerName}）` : ''}`, value: m.modelRef || m.id }))
    if (customVisionModels.length) {
      const base = visionModels.value.filter(m => !String(m.value).startsWith('custom_'))
      visionModels.value = [...base, ...customVisionModels]
    }
    if (data.defaults?.visionModel) visionModel.value = data.defaults.visionModel
  } catch {}
}

function startElapsedTimer() {
  elapsed.value = 0
  elapsedTimer = setInterval(() => { elapsed.value++ }, 1000)
}
function stopElapsedTimer() {
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
}

async function startAnalysis() {
  if (!imageFile.value) return ElMessage.warning('请先上传或粘贴图片')

  analyzing.value = true
  result.value = ''
  errorMsg.value = ''
  statusText.value = '正在压缩图片...'
  startElapsedTimer()

  try {
    const compressedFile = await compressImage(imageFile.value, 2, 2048)
    statusText.value = '图片已上传，等待 AI 响应...'

    const stream = aiApi.visionStream(compressedFile, scene.value, {
      model: visionModel.value,
      params: aiParams.value
    })
    currentStream = stream  // 保存引用用于 abort

    let chunkCount = 0
    for await (const chunk of stream) {
      chunkCount++
      if (chunkCount === 1) statusText.value = 'AI 正在分析中...'
      result.value += chunk
    }

    statusText.value = chunkCount > 0 ? `分析完成 (${elapsedText.value})` : '未收到有效响应'
    if (chunkCount === 0) {
      errorMsg.value = 'AI 未返回任何内容，可能是模型不支持当前图片格式或请求被拒绝，请尝试切换模型'
    }
  } catch (err) {
    if (err.name === 'AbortError' || String(err.message).includes('abort')) {
      statusText.value = `已取消 (${elapsedText.value})`
      ElMessage.info('已取消分析')
    } else {
      const msg = String(err?.message || '未知错误')
      errorMsg.value = msg
      statusText.value = `分析失败 (${elapsedText.value})`
      if (msg.includes('403')) {
        ElMessage.error('模型权限受限 (403)，请检查 API Key 或切换模型')
      } else if (msg.includes('400')) {
        ElMessage.error('请求格式不被接受 (400)，请切换模型后重试')
      } else if (msg.includes('503')) {
        ElMessage.error('服务器忙 (503)，请稍后重试')
      } else {
        ElMessage.error(msg)
      }
    }
  } finally {
    analyzing.value = false
    currentStream = null
    stopElapsedTimer()
  }
}

function cancelAnalysis() {
  if (currentStream?.abort) {
    currentStream.abort()
  }
}

// === Vision 历史记录 ===
const historyList = ref([])
const historyLoading = ref(false)
const showHistory = ref(false)

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await aiApi.getVisionHistory({ limit: 15 })
    historyList.value = res.data?.records || []
  } catch {} finally { historyLoading.value = false }
}

async function deleteHistory(id) {
  try {
    await aiApi.deleteVisionHistory(id)
    historyList.value = historyList.value.filter(h => h._id !== id)
    ElMessage.success('已删除')
  } catch (err) { ElMessage.error(err.message || '删除失败') }
}

function viewHistory(record) {
  result.value = record.rawText || ''
  scene.value = record.scene || 'kline'
  showHistory.value = false
}

function formatHistoryDate(v) {
  if (!v) return '--'
  return new Date(v).toLocaleString('zh-CN', { hour12: false })
}

const sceneLabel = (s) => {
  const map = { kline: 'K线形态', portfolio: '持仓识别', detail: '个股详情', news: '研报摘要', auto: '自动识别' }
  return map[s] || s
}

onMounted(() => { loadAiSettings(); loadHistory() })
onUnmounted(stopElapsedTimer)
</script>

<template>
  <div @paste="handlePaste">
    <div class="flex items-center justify-between mb-4">
      <h2 class="sq-list-title">📸 图片识别分析</h2>
      <el-button text @click="showHistory = !showHistory">
        {{ showHistory ? '返回分析' : `📋 历史记录 (${historyList.length})` }}
      </el-button>
    </div>

    <!-- 历史记录面板 -->
    <div v-if="showHistory">
      <el-card class="sq-list-card" v-loading="historyLoading">
        <template #header><span class="sq-section-title">分析历史</span></template>
        <div v-if="historyList.length === 0" class="text-center py-8 text-gray-500">暂无历史记录</div>
        <div v-else class="space-y-2">
          <div v-for="h in historyList" :key="h._id"
            class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer"
            @click="viewHistory(h)"
          >
            <div>
              <el-tag size="small" effect="plain" class="mr-2">{{ sceneLabel(h.scene) }}</el-tag>
              <span class="text-xs text-gray-500">{{ formatHistoryDate(h.createdAt) }}</span>
              <span v-if="h.provider" class="text-xs text-gray-500 ml-2">{{ h.provider }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">{{ h.rawText?.slice(0, 40) }}...</span>
              <el-button text size="small" type="danger" @click.stop="deleteHistory(h._id)">删除</el-button>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 左侧: 上传 + 场景选择 -->
      <div class="space-y-4">
        <!-- 场景选择 -->
        <el-card class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="sq-section-title">分析配置</span>
            </div>
          </template>
          
          <div class="mb-4">
            <div class="text-xs sq-subtle-text mb-2">选择模型</div>
            <el-select v-model="visionModel" placeholder="选择 AI 模型" class="w-full">
              <el-option
                v-for="m in visionModels"
                :key="m.value"
                :label="m.label"
                :value="m.value"
              />
            </el-select>
          </div>

          <div class="text-xs sq-subtle-text mb-2">选择场景</div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="s in scenes" :key="s.value"
              @click="scene = s.value"
              class="p-3 rounded-lg border cursor-pointer transition-all text-center"
              :class="scene === s.value ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'"
            >
              <div class="text-2xl mb-1">{{ s.icon }}</div>
              <div class="text-xs font-bold">{{ s.label }}</div>
            </div>
          </div>
        </el-card>

        <!-- 图片上传 -->
        <el-card class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <template #header><span class="sq-section-title">上传图片 (支持 Ctrl+V 粘贴)</span></template>
          <el-upload
            drag
            :auto-upload="false"
            :show-file-list="false"
            accept="image/*"
            @change="handleFileChange"
            class="w-full"
          >
            <div v-if="imagePreview" class="p-2">
              <img :src="imagePreview" class="max-h-64 mx-auto rounded shadow-md" />
            </div>
            <div v-else class="py-8">
              <p class="sq-subtle-text">拖拽图片到此处 / 点击选择 / Ctrl+V 粘贴截图</p>
              <p class="sq-muted-text text-xs mt-2">支持 JPG/PNG/WebP，最大 10MB</p>
            </div>
          </el-upload>

          <!-- 操作按钮区 -->
          <div class="mt-4 space-y-2">
            <div v-if="!analyzing" class="flex gap-2">
              <el-button type="primary" @click="startAnalysis" class="flex-1 font-bold" :disabled="!imageFile" size="large">
                开始分析
              </el-button>
            </div>
            <div v-else class="flex gap-2">
              <el-button type="primary" loading class="flex-1" size="large" disabled>
                {{ statusText }} ({{ elapsedText }})
              </el-button>
              <el-button type="danger" plain size="large" @click="cancelAnalysis">取消</el-button>
            </div>

            <!-- 状态提示 -->
            <div v-if="statusText && !analyzing" class="text-xs text-center" :class="errorMsg ? 'text-red-400' : 'text-green-400'">
              {{ statusText }}
            </div>
            <!-- 错误详情 -->
            <el-alert v-if="errorMsg" type="error" :title="errorMsg" show-icon closable @close="errorMsg = ''" class="!py-1" />
          </div>
        </el-card>
      </div>

      <!-- 右侧: 分析结果 -->
      <el-card class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 min-h-96 relative shadow-sm">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="sq-section-title">分析结果</span>
            <span v-if="analyzing" class="text-xs text-teal-500 animate-pulse">{{ statusText }} · {{ elapsedText }}</span>
            <span v-else-if="statusText && !errorMsg" class="text-xs text-green-500">{{ statusText }}</span>
          </div>
        </template>

        <!-- 结构化结果展示 -->
        <div v-if="structuredData" class="space-y-6">
          
          <!-- ============ 场景 1: K线形态识别 ============ -->
          <template v-if="scene === 'kline'">
            <!-- 头部信息 -->
            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h3 class="text-2xl font-bold text-gray-900 dark:text-white">{{ structuredData.stock || '未知标的' }}</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">识别场景: K线形态识别</p>
              </div>
              <div class="text-right">
                <el-tag :type="structuredData.trend === 'up' ? 'danger' : (structuredData.trend === 'down' ? 'success' : 'info')" effect="dark" size="large">
                  {{ structuredData.trend === 'up' ? '📈 上升趋势' : (structuredData.trend === 'down' ? '📉 下降趋势' : '➡️ 震荡整理') }}
                </el-tag>
                <div class="mt-2 text-xs sq-subtle-text">置信度: {{ (structuredData.confidence * 100).toFixed(0) }}%</div>
              </div>
            </div>

            <!-- 关键指标卡片 -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700/30">
                <div class="text-gray-500 dark:text-gray-400 text-xs mb-1">形态识别</div>
                <div class="text-teal-600 dark:text-teal-400 font-bold">{{ structuredData.pattern || '无明显形态' }}</div>
              </div>
              <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700/30">
                <div class="text-gray-500 dark:text-gray-400 text-xs mb-1">操作信号</div>
                <div class="font-bold" :class="{
                  'text-red-500': structuredData.signal === 'buy',
                  'text-green-500': structuredData.signal === 'sell',
                  'text-yellow-600 dark:text-yellow-500': structuredData.signal === 'hold'
                }">
                  {{ structuredData.signal === 'buy' ? '买入信号' : (structuredData.signal === 'sell' ? '卖出信号' : '观望') }}
                </div>
              </div>
            </div>
          </template>

          <!-- ============ 场景 2: 持仓/交割单识别 ============ -->
          <template v-if="scene === 'portfolio'">
            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h3 class="text-2xl font-bold text-gray-900 dark:text-white">持仓诊断报告</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">总资产: <span class="text-amber-500 dark:text-amber-400 font-mono">{{ structuredData.totalAssets?.toLocaleString() || '--' }}</span></p>
              </div>
              <div class="text-right">
                <div class="text-xl font-bold font-mono" :class="structuredData.totalPnl > 0 ? 'text-red-500' : 'text-green-500'">
                  {{ structuredData.totalPnl > 0 ? '+' : '' }}{{ structuredData.totalPnl?.toLocaleString() }}
                </div>
                <el-tag class="mt-1" :type="structuredData.riskLevel === 'high' ? 'danger' : (structuredData.riskLevel === 'medium' ? 'warning' : 'success')" size="small">
                  {{ structuredData.riskLevel === 'high' ? '高风险' : (structuredData.riskLevel === 'medium' ? '中风险' : '低风险') }}
                </el-tag>
              </div>
            </div>

            <!-- 持仓列表 -->
            <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700/50">
              <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead class="text-xs text-gray-700 dark:text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-3 py-2">标的</th>
                    <th class="px-3 py-2 text-right">持仓/成本</th>
                    <th class="px-3 py-2 text-right">现价</th>
                    <th class="px-3 py-2 text-right">盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, idx) in structuredData.holdings" :key="idx" class="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td class="px-3 py-2">
                      <div class="text-gray-900 dark:text-white font-bold">{{ item.name }}</div>
                      <div class="text-xs">{{ item.code }}</div>
                    </td>
                    <td class="px-3 py-2 text-right font-mono">
                      <div>{{ item.quantity }}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-600">{{ item.costPrice }}</div>
                    </td>
                    <td class="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">{{ item.currentPrice }}</td>
                    <td class="px-3 py-2 text-right font-mono" :class="item.pnl > 0 ? 'text-red-500' : 'text-green-500'">
                      <div>{{ item.pnl > 0 ? '+' : '' }}{{ item.pnl }}</div>
                      <div class="text-xs">{{ item.pnlPercent }}%</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 建议列表 -->
            <div class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3">
              <div class="text-amber-600 dark:text-amber-500 text-xs font-bold mb-2">💡 优化建议</div>
              <ul class="list-disc list-inside text-sm text-amber-700 dark:text-amber-200/80 space-y-1">
                <li v-for="(s, i) in structuredData.suggestions" :key="i">{{ s }}</li>
              </ul>
            </div>
          </template>

          <!-- ============ 场景 3: 个股详情提取 ============ -->
          <template v-if="scene === 'detail'">
            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h3 class="text-2xl font-bold text-gray-900 dark:text-white">{{ structuredData.stock || '未知标的' }}</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm mt-1 font-mono">{{ structuredData.price }}</p>
              </div>
              <div class="flex gap-2">
                <div class="text-center px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                  <div class="text-xs sq-subtle-text">估值</div>
                  <div class="font-bold text-teal-500 dark:text-teal-400">{{ structuredData.score?.valuation || 0 }}/10</div>
                </div>
                <div class="text-center px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                  <div class="text-xs sq-subtle-text">技术</div>
                  <div class="font-bold text-purple-500 dark:text-purple-400">{{ structuredData.score?.technical || 0 }}/10</div>
                </div>
                <div class="text-center px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                  <div class="text-xs sq-subtle-text">综合</div>
                  <div class="font-bold text-orange-500 dark:text-orange-400">{{ structuredData.score?.total || 0 }}/10</div>
                </div>
              </div>
            </div>

            <!-- 指标网格 -->
            <div class="grid grid-cols-3 gap-2 text-center">
              <div v-for="(val, key) in structuredData.indicators" :key="key" class="bg-gray-50 dark:bg-gray-800/30 p-2 rounded border border-gray-200 dark:border-gray-700/30">
                <div class="text-[10px] sq-subtle-text uppercase">{{ key }}</div>
                <div class="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{{ val }}</div>
              </div>
            </div>
          </template>

          <!-- ============ 场景 4: 新闻/研报摘要 ============ -->
          <template v-if="scene === 'news'">
            <div class="border-b border-gray-100 dark:border-gray-800 pb-4">
              <div class="flex items-center gap-2 mb-2">
                <el-tag :type="structuredData.sentiment === '利好' ? 'danger' : (structuredData.sentiment === '利空' ? 'success' : 'info')" effect="dark">
                  {{ structuredData.sentiment }}
                </el-tag>
                <span class="sq-subtle-text text-sm">影响标的:</span>
                <el-tag v-for="t in structuredData.targets" :key="t" size="small" type="info">{{ t }}</el-tag>
              </div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-white leading-relaxed">{{ structuredData.summary }}</h3>
            </div>

            <!-- 核心要点 -->
            <div class="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
              <div class="text-blue-600 dark:text-blue-400 text-xs font-bold mb-3">📌 核心要点</div>
              <ul class="space-y-2">
                <li v-for="(p, i) in structuredData.points" :key="i" class="flex items-start text-sm text-gray-700 dark:text-gray-300">
                  <span class="mr-2 text-blue-500">•</span>
                  <span>{{ p }}</span>
                </li>
              </ul>
            </div>

            <!-- 影响评估 -->
            <div class="bg-gray-50 dark:bg-gray-800/30 p-3 rounded border-l-2 border-purple-500">
              <div class="text-purple-600 dark:text-purple-400 text-xs font-bold mb-1">📉 市场影响</div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ structuredData.impact }}</p>
            </div>
          </template>

          <!-- 详细分析 (Markdown) - 通用 -->
          <div class="mt-6">
            <h4 class="sq-section-title mb-3 flex items-center">
              <span class="mr-2">📝</span> 深度分析
            </h4>
            <div class="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-5 border border-gray-200 dark:border-gray-700/50">
              <div v-if="hasRealAnalysis" v-html="renderedAnalysis" class="vision-md"></div>
              <div v-else-if="fallbackText" v-html="md.render(fallbackText)" class="vision-md"></div>
              <div v-else v-html="md.render(result || '')" class="vision-md"></div>
            </div>
          </div>
        </div>

        <!-- 降级展示: JSON解析失败时直接渲染全文 Markdown -->
        <div v-else-if="result" v-html="md.render(result)" class="vision-md p-1"></div>

        <!-- 空状态 -->
        <div v-else class="flex flex-col items-center justify-center h-64 sq-subtle-text">
          <div class="text-4xl mb-4 opacity-20">🤖</div>
          <p>上传图片并点击"开始分析"</p>
          <p class="text-xs mt-2 opacity-80">AI 将自动识别 K线形态、持仓数据等</p>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
/* Vision 分析结果 Markdown 排版 - 增强版 */
.vision-md {
  font-size: 14px;
  line-height: 1.9;
  color: #4b5563;
  word-break: break-word;
  letter-spacing: 0.01em;
}

/* ── 标题体系 ── */
.vision-md :deep(h1) {
  font-size: 1.25em;
  font-weight: 800;
  margin: 1.6em 0 0.6em;
  padding: 8px 0 8px 14px;
  border-left: 4px solid #14b8a6;
  border-bottom: none;
  background: linear-gradient(90deg, rgba(20,184,166,0.06) 0%, transparent 60%);
  border-radius: 0 6px 6px 0;
  color: #1e293b;
}
.vision-md :deep(h2) {
  font-size: 1.1em;
  font-weight: 700;
  margin: 1.5em 0 0.5em;
  padding: 6px 0 6px 12px;
  border-left: 3px solid #3b82f6;
  border-bottom: none;
  background: linear-gradient(90deg, rgba(59,130,246,0.05) 0%, transparent 50%);
  border-radius: 0 4px 4px 0;
  color: #1e293b;
}
.vision-md :deep(h3) {
  font-size: 1em;
  font-weight: 700;
  margin: 1.2em 0 0.4em;
  padding: 0;
  border: none;
  color: #334155;
  position: relative;
  padding-left: 10px;
}
.vision-md :deep(h3)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: #f59e0b;
  border-radius: 2px;
}
.vision-md :deep(h4) {
  font-size: 0.95em;
  font-weight: 600;
  margin: 1em 0 0.3em;
  padding: 0;
  border: none;
  color: #6366f1;
}

/* ── 段落与文本 ── */
.vision-md :deep(p) {
  margin: 0.55em 0;
}
.vision-md :deep(strong) {
  font-weight: 700;
  color: #0f172a;
  background: linear-gradient(180deg, transparent 60%, rgba(251,191,36,0.18) 60%);
  padding: 0 2px;
  border-radius: 2px;
}

/* ── 列表 ── */
.vision-md :deep(ul),
.vision-md :deep(ol) {
  padding-left: 1.4em;
  margin: 0.5em 0;
}
.vision-md :deep(li) {
  margin: 0.35em 0;
  padding-left: 4px;
}
.vision-md :deep(ul) { list-style: none; }
.vision-md :deep(ul > li)::before {
  content: '▸';
  color: #14b8a6;
  font-weight: 700;
  margin-right: 6px;
  margin-left: -1.2em;
  display: inline-block;
  width: 1em;
}
.vision-md :deep(ol) { list-style: decimal; }
.vision-md :deep(li > ul),
.vision-md :deep(li > ol) { margin: 0.15em 0; }
/* 嵌套列表用圆点 */
.vision-md :deep(li > ul > li)::before {
  content: '•';
  color: #94a3b8;
}

/* ── 代码 ── */
.vision-md :deep(pre) {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 18px;
  margin: 1em 0;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.65;
}
.vision-md :deep(code) {
  font-family: 'JetBrains Mono','Menlo','Consolas',monospace;
  font-size: 0.87em;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #e11d48;
}
.vision-md :deep(pre code) {
  padding: 0;
  background: none;
  color: inherit;
}

/* ── 分隔线 ── */
.vision-md :deep(hr) {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(148,163,184,0.3), transparent);
  margin: 1.5em 0;
}

/* ── 引用 ── */
.vision-md :deep(blockquote) {
  border-left: 3px solid #8b5cf6;
  padding: 8px 14px;
  margin: 1em 0;
  background: linear-gradient(90deg, rgba(139,92,246,0.04), transparent);
  border-radius: 0 8px 8px 0;
  font-style: italic;
  color: #64748b;
}

/* ── 表格 ── */
.vision-md :deep(table) {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  margin: 1em 0;
  font-size: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.vision-md :deep(th) {
  background: linear-gradient(180deg, #f8fafc, #f1f5f9);
  font-weight: 600;
  padding: 8px 12px;
  border-bottom: 2px solid #e2e8f0;
  color: #334155;
  text-align: left;
}
.vision-md :deep(td) {
  padding: 7px 12px;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
}
.vision-md :deep(tr:last-child td) { border-bottom: none; }
.vision-md :deep(tr:hover td) { background: rgba(59,130,246,0.03); }

/* ══════ 暗色模式 ══════ */
:root.dark .vision-md,
html.dark .vision-md { color: #c9d1d9; }

:root.dark .vision-md :deep(h1),
html.dark .vision-md :deep(h1) {
  color: #e2e8f0;
  background: linear-gradient(90deg, rgba(20,184,166,0.1) 0%, transparent 60%);
}
:root.dark .vision-md :deep(h2),
html.dark .vision-md :deep(h2) {
  color: #e2e8f0;
  background: linear-gradient(90deg, rgba(59,130,246,0.08) 0%, transparent 50%);
}
:root.dark .vision-md :deep(h3),
html.dark .vision-md :deep(h3) { color: #cbd5e1; }
:root.dark .vision-md :deep(h4),
html.dark .vision-md :deep(h4) { color: #a5b4fc; }

:root.dark .vision-md :deep(strong),
html.dark .vision-md :deep(strong) {
  color: #f1f5f9;
  background: linear-gradient(180deg, transparent 60%, rgba(251,191,36,0.12) 60%);
}
:root.dark .vision-md :deep(ul > li)::before { color: #2dd4bf; }
:root.dark .vision-md :deep(pre),
html.dark .vision-md :deep(pre) {
  background: rgba(255,255,255,0.03);
  border-color: rgba(255,255,255,0.06);
}
:root.dark .vision-md :deep(code),
html.dark .vision-md :deep(code) {
  background: rgba(255,255,255,0.07);
  color: #fb923c;
}
:root.dark .vision-md :deep(blockquote),
html.dark .vision-md :deep(blockquote) {
  background: linear-gradient(90deg, rgba(139,92,246,0.08), transparent);
  color: #94a3b8;
}
:root.dark .vision-md :deep(table),
html.dark .vision-md :deep(table) { border-color: rgba(255,255,255,0.08); }
:root.dark .vision-md :deep(th),
html.dark .vision-md :deep(th) {
  background: rgba(255,255,255,0.04);
  border-bottom-color: rgba(255,255,255,0.08);
  color: #e2e8f0;
}
:root.dark .vision-md :deep(td),
html.dark .vision-md :deep(td) { border-bottom-color: rgba(255,255,255,0.04); }
:root.dark .vision-md :deep(tr:hover td),
html.dark .vision-md :deep(tr:hover td) { background: rgba(255,255,255,0.02); }
:root.dark .vision-md :deep(hr),
html.dark .vision-md :deep(hr) { background: linear-gradient(90deg, transparent, rgba(148,163,184,0.15), transparent); }
</style>
