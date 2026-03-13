<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
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

  // 排序
  if (filters.sortField) {
    result.sort((a, b) => {
      const va = Number(a[filters.sortField] ?? 0)
      const vb = Number(b[filters.sortField] ?? 0)
      return filters.sortOrder === 'desc' ? vb - va : va - vb
    })
  }

  return result
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
  aiScreening.value = true
  aiResult.value = ''
  showAiPanel.value = true
  try {
    const topList = filteredList.value.slice(0, 20).map(s => `${s.code} ${s.name} 涨幅${s.changePercent}% PE=${s.pe} PB=${s.pb}`).join('\n')
    const prompt = `当前筛选出的股票列表（前20只）:\n${topList}\n\n请从中选出最值得关注的3-5只股票，给出理由和操作建议。分析每只股票的技术面和基本面，最后给出综合评分(1-100)。`
    const stream = aiApi.chat(prompt)
    for await (const chunk of stream) {
      aiResult.value += chunk
    }
  } catch (err) {
    ElMessage.error('AI选股失败: ' + (err.message || ''))
  } finally {
    aiScreening.value = false
  }
}

onMounted(loadStocks)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="sq-list-title">🔍 选股筛选</h2>
      <el-button type="warning" :loading="aiScreening" @click="aiScreen">🧠 AI 智能选股</el-button>
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
          <el-button text size="small" @click="showAiPanel = false">收起</el-button>
        </div>
      </template>
      <div v-if="aiResult" class="text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto text-gray-300">
        {{ aiResult }}
      </div>
      <div v-else-if="aiScreening" class="text-center py-6 text-gray-500 animate-pulse">AI 正在分析中...</div>
      <div v-else class="text-center py-4 text-gray-500">点击"AI 智能选股"开始</div>
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
