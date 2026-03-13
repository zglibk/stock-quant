<script setup>
import { ref, computed, onMounted } from 'vue'
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
    // 1. 尝试匹配 Markdown 代码块中的 JSON
    const jsonMatch = result.value.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }
    
    // 2. 尝试直接解析整个字符串 (如果 AI 只返回了 JSON)
    // 过滤掉可能的非 JSON 前缀/后缀
    const firstBrace = result.value.indexOf('{')
    const lastBrace = result.value.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const potentialJson = result.value.slice(firstBrace, lastBrace + 1)
      return JSON.parse(potentialJson)
    }
    
    return null
  } catch (e) {
    return null
  }
})

// 渲染 analysis 字段的 Markdown
const renderedAnalysis = computed(() => {
  if (structuredData.value && structuredData.value.analysis) {
    return md.render(structuredData.value.analysis)
  }
  return ''
})

function handleFileChange(file) {
  if (!file) return
  const raw = file.raw || file
  if (raw.size > 10 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 10MB')
    return
  }
  imageFile.value = raw
  imagePreview.value = URL.createObjectURL(raw)
  result.value = ''
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
    if (data.defaults?.visionModel) {
      visionModel.value = data.defaults.visionModel
    }
  } catch {}
}

async function startAnalysis() {
  if (!imageFile.value) return ElMessage.warning('请先上传或粘贴图片')

  try {
    analyzing.value = true
    result.value = ''

    console.log('开始压缩图片...')
    // 1. 压缩图片 (最大 2MB)
    const compressedFile = await compressImage(imageFile.value, 2, 2048)
    console.log('图片压缩完成:', compressedFile.size)
    
    // 2. 上传分析
    console.log('发起 Vision 请求:', scene.value, 'Model:', visionModel.value)
    const stream = aiApi.visionStream(compressedFile, scene.value, {
      model: visionModel.value,
      params: aiParams.value
    })
    for await (const chunk of stream) {
      console.log('收到 chunk:', chunk)
      result.value += chunk
    }
    console.log('流接收完成')
  } catch (err) {
    console.error('Vision 错误:', err)
    const msg = String(err?.message || '')
    if (msg.includes('403')) {
      ElMessage.error('模型权限受限（403），已建议使用 Lite 模型或检查 API Key 权限')
    } else if (msg.includes('400')) {
      ElMessage.error('当前模型请求格式不被接受（400），请切换模型后重试')
    } else {
      ElMessage.error(err.message || '分析失败')
    }
  } finally {
    analyzing.value = false
  }
}

onMounted(loadAiSettings)
</script>

<template>
  <div @paste="handlePaste">
    <h2 class="sq-list-title mb-4">📸 图片识别分析</h2>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          <el-button
            type="primary"
            :loading="analyzing"
            @click="startAnalysis"
            class="w-full mt-4 font-bold"
            :disabled="!imageFile"
            size="large"
          >
            {{ analyzing ? 'AI 分析中...' : '开始分析' }}
          </el-button>
        </el-card>
      </div>

      <!-- 右侧: 分析结果 -->
      <el-card class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 min-h-96 relative shadow-sm">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="sq-section-title">分析结果</span>
            <span v-if="analyzing" class="text-xs text-teal-500 animate-pulse">AI 正在思考...</span>
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
              <div v-html="renderedAnalysis" class="prose dark:prose-invert prose-sm max-w-none text-gray-700 dark:text-gray-200 leading-7"></div>
            </div>
          </div>
        </div>

        <!-- 降级展示: 纯文本结果 (流传输中或解析失败) -->
        <div v-else-if="result" class="prose dark:prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {{ result }}
        </div>

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
