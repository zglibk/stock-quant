<script setup>
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import marketApi from '@/api/market'
import aiApi from '@/api/ai'

const router = useRouter()
const loading = ref(false)
const list = ref([])
const industries = ref([])
const aiScreening = ref(false)
const aiResult = ref('')
const showAiPanel = ref(false)
const aiStatusText = ref('')
const aiElapsed = ref(0)
const aiErrorMsg = ref('')
let aiStream = null
let aiTimer = null

const filters = reactive({
  q: '',
  industry: '',
  market: '',
  minChange: -11,
  maxChange: 11,
  minPe: 0,
  maxPe: 200,
  sortField: 'changePercent',
  sortOrder: 'desc'
})

const filteredList = computed(() => {
  let result = (list.value || []).filter((s) => {
    if (filters.market && s.market !== filters.market) return false
    const cp = Number(s.changePercent ?? 0)
    if (cp < Number(filters.minChange)) return false
    if (cp > Number(filters.maxChange)) return false
    const pe = Number(s.pe ?? 0)
    if (filters.minPe > 0 && pe < filters.minPe) return false
    if (filters.maxPe < 200 && pe > filters.maxPe) return false
    return true
  })

  if (filters.sortField) {
    result.sort((a, b) => {
      const va = Number(a[filters.sortField] ?? 0)
      const vb = Number(b[filters.sortField] ?? 0)
      return filters.sortOrder === 'desc' ? vb - va : va - vb
    })
  }
  return result
})

const aiElapsedText = computed(() => {
  const s = aiElapsed.value
  if (s < 60) return `${s}秒`
  return `${Math.floor(s / 60)}分${s % 60}秒`
})

async function loadStocks() {
  loading.value = true
  try {
    const res = await marketApi.getStocks({
      keyword: filters.q || undefined,
      industry: filters.industry || undefined,
      page: 1,
      limit: 500
    })
    const stocks = Array.isArray(res?.data)
      ? res.data
      : (Array.isArray(res?.data?.stocks) ? res.data.stocks : [])
    list.value = stocks
    const set = new Set((list.value || []).map(s => s.industry).filter(Boolean))
    industries.value = [...set].sort()
  } catch (err) {
    ElMessage.error(err.message || '加载股票失败')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.q = ''
  filters.industry = ''
  filters.market = ''
  filters.minChange = -11
  filters.maxChange = 11
  filters.minPe = 0
  filters.maxPe = 200
  loadStocks()
}

function toDetail(code) {
  router.push(`/market/${code}`)
}

function handleSortChange({ prop, order }) {
  filters.sortField = prop || 'changePercent'
  filters.sortOrder = order === 'ascending' ? 'asc' : 'desc'
}

// AI 智能选股
async function aiScreen() {
  if (filteredList.value.length === 0) { ElMessage.warning('筛选结果为空，请先调整条件'); return }

  aiScreening.value = true
  aiResult.value = ''
  aiErrorMsg.value = ''
  showAiPanel.value = true
  aiStatusText.value = '正在构建分析上下文...'
  aiElapsed.value = 0
  aiTimer = setInterval(() => { aiElapsed.value++ }, 1000)

  try {
    const topList = filteredList.value.slice(0, 20).map(s => `${s.code} ${s.name} 涨幅${s.changePercent}% PE=${s.pe} PB=${s.pb}`).join('\n')
    const prompt = `当前筛选出的股票列表（前20只）:\n${topList}\n\n请从中选出最值得关注的3-5只股票，给出理由和操作建议。分析每只股票的技术面和基本面，最后给出综合评分(1-100)。`

    aiStatusText.value = '等待 AI 响应...'
    const stream = aiApi.chat(prompt)
    aiStream = stream

    let chunkCount = 0
    for await (const chunk of stream) {
      chunkCount++
      if (chunkCount === 1) aiStatusText.value = 'AI 正在分析中...'
      aiResult.value += chunk
    }

    aiStatusText.value = chunkCount > 0 ? `分析完成 (${aiElapsedText.value})` : 'AI 未返回有效内容'
    if (chunkCount === 0) {
      aiErrorMsg.value = '未收到 AI 响应，请检查模型配置或稍后重试'
    }
  } catch (err) {
    if (err.name === 'AbortError' || String(err.message).includes('abort')) {
      aiStatusText.value = `已取消 (${aiElapsedText.value})`
      ElMessage.info('已取消 AI 选股')
    } else {
      aiErrorMsg.value = err.message || '未知错误'
      aiStatusText.value = `分析失败 (${aiElapsedText.value})`
      ElMessage.error('AI选股失败: ' + (err.message || ''))
    }
  } finally {
    aiScreening.value = false
    aiStream = null
    if (aiTimer) { clearInterval(aiTimer); aiTimer = null }
  }
}

function cancelAiScreen() {
  if (aiStream?.abort) aiStream.abort()
}

onMounted(loadStocks)
onUnmounted(() => { if (aiTimer) clearInterval(aiTimer) })
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="sq-list-title">🔍 选股筛选</h2>
      <div class="flex items-center gap-2">
        <el-button v-if="!aiScreening" type="warning" @click="aiScreen">🧠 AI 智能选股</el-button>
        <template v-else>
          <el-button type="warning" loading disabled>{{ aiStatusText }} ({{ aiElapsedText }})</el-button>
          <el-button type="danger" plain @click="cancelAiScreen">取消</el-button>
        </template>
      </div>
    </div>

    <!-- 筛选条件 -->
    <el-card class="mb-4 sq-list-card">
      <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
        <el-input v-model="filters.q" placeholder="代码或名称" clearable @keyup.enter="loadStocks" @clear="loadStocks" />
        <el-select v-model="filters.industry" placeholder="行业" clearable filterable @change="loadStocks">
          <el-option label="全部行业" value="" />
          <el-option v-for="i in industries" :key="i" :label="i" :value="i" />
        </el-select>
        <el-select v-model="filters.market" placeholder="市场" clearable>
          <el-option label="全部市场" value="" />
          <el-option label="沪市" value="SH" />
          <el-option label="深市" value="SZ" />
        </el-select>
        <div class="flex items-center gap-1 text-xs">
          <span class="text-gray-500 whitespace-nowrap">涨幅:</span>
          <el-input-number v-model="filters.minChange" :min="-11" :max="11" :step="1" size="small" controls-position="right" />
          <span>~</span>
          <el-input-number v-model="filters.maxChange" :min="-11" :max="11" :step="1" size="small" controls-position="right" />
        </div>
        <div class="flex items-center gap-1 text-xs">
          <span class="text-gray-500 whitespace-nowrap">PE:</span>
          <el-input-number v-model="filters.minPe" :min="0" :max="200" :step="5" size="small" controls-position="right" />
          <span>~</span>
          <el-input-number v-model="filters.maxPe" :min="0" :max="200" :step="5" size="small" controls-position="right" />
        </div>
        <div class="flex gap-2">
          <el-button type="primary" @click="loadStocks">筛选</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>
      <div class="mt-2 text-xs text-gray-500">
        筛选结果: <span class="text-blue-400 font-bold">{{ filteredList.length }}</span> 只
      </div>
    </el-card>

    <!-- AI 选股结果 -->
    <el-card v-if="showAiPanel" class="mb-4 sq-list-card">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="sq-section-title text-orange-400">🧠 AI 智能选股结果</span>
          <div class="flex items-center gap-2">
            <span v-if="aiScreening" class="text-xs text-teal-500 animate-pulse">{{ aiStatusText }} · {{ aiElapsedText }}</span>
            <span v-else-if="aiStatusText && !aiErrorMsg" class="text-xs text-green-500">{{ aiStatusText }}</span>
            <el-button text size="small" @click="showAiPanel = false">收起</el-button>
          </div>
        </div>
      </template>
      <el-alert v-if="aiErrorMsg" type="error" :title="aiErrorMsg" show-icon closable @close="aiErrorMsg = ''" class="!mb-3 !py-1" />
      <div v-if="aiResult" class="text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto text-gray-700 dark:text-gray-300">
        {{ aiResult }}
      </div>
      <div v-else-if="aiScreening" class="text-center py-6 text-gray-500">
        <div class="animate-pulse mb-2">{{ aiStatusText }}</div>
        <div class="text-xs">已用时: {{ aiElapsedText }}</div>
      </div>
      <div v-else class="text-center py-4 text-gray-500">点击"AI 智能选股"开始分析</div>
    </el-card>

    <!-- 股票列表 -->
    <el-card v-loading="loading" class="sq-list-card">
      <el-table :data="filteredList" stripe class="sq-list-table" @sort-change="handleSortChange" :default-sort="{ prop: 'changePercent', order: 'descending' }">
        <el-table-column prop="code" label="代码" width="110">
          <template #default="{ row }">
            <span class="text-blue-400 font-mono cursor-pointer hover:underline" @click="toDetail(row.code)">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="industry" label="行业" min-width="100">
          <template #default="{ row }">
            <span class="text-gray-400 text-xs">{{ row.industry || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="最新价" width="100" sortable="custom">
          <template #default="{ row }">{{ row.price ?? '--' }}</template>
        </el-table-column>
        <el-table-column prop="changePercent" label="涨跌幅" width="110" sortable="custom">
          <template #default="{ row }">
            <span :class="Number(row.changePercent || 0) >= 0 ? 'text-red-500 font-bold' : 'text-green-500 font-bold'">
              {{ Number(row.changePercent || 0).toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="pe" label="PE" width="90" sortable="custom">
          <template #default="{ row }">{{ row.pe ?? '--' }}</template>
        </el-table-column>
        <el-table-column prop="pb" label="PB" width="90" sortable="custom">
          <template #default="{ row }">{{ row.pb ?? '--' }}</template>
        </el-table-column>
        <el-table-column prop="turnoverRate" label="换手率" width="100" sortable="custom">
          <template #default="{ row }">{{ row.turnoverRate ? `${row.turnoverRate}%` : '--' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="toDetail(row.code)">K线</el-button>
            <el-button link type="warning" size="small" @click="$router.push('/vision')">AI</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
