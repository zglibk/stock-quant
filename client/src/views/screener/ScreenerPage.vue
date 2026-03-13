<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import marketApi from '@/api/market'

const router = useRouter()
const loading = ref(false)
const list = ref([])
const industries = ref([])

const filters = reactive({
  q: '',
  industry: '',
  market: '',
  minChange: -100,
  maxChange: 100
})

const filteredList = computed(() => {
  return (list.value || []).filter((s) => {
    if (filters.market && s.market !== filters.market) return false
    const cp = Number(s.changePercent ?? 0)
    if (cp < Number(filters.minChange)) return false
    if (cp > Number(filters.maxChange)) return false
    return true
  })
})

async function loadStocks() {
  loading.value = true
  try {
    const res = await marketApi.getStocks({
      q: filters.q || undefined,
      industry: filters.industry || undefined,
      page: 1,
      limit: 300
    })
    list.value = res.data || []
    const set = new Set((list.value || []).map(s => s.industry).filter(Boolean))
    industries.value = [...set]
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
  filters.minChange = -100
  filters.maxChange = 100
  loadStocks()
}

function toDetail(code) {
  router.push(`/market/${code}`)
}

onMounted(loadStocks)
</script>

<template>
  <div>
    <h2 class="sq-list-title mb-4">选股筛选</h2>
    <el-card class="mb-4 sq-list-card">
      <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
        <el-input v-model="filters.q" placeholder="代码或名称关键词" @keyup.enter="loadStocks" />
        <el-select v-model="filters.industry" placeholder="行业">
          <el-option label="全部行业" value="" />
          <el-option v-for="i in industries" :key="i" :label="i" :value="i" />
        </el-select>
        <el-select v-model="filters.market" placeholder="市场">
          <el-option label="全部市场" value="" />
          <el-option label="沪市" value="SH" />
          <el-option label="深市" value="SZ" />
          <el-option label="北交所" value="BJ" />
        </el-select>
        <el-input-number v-model="filters.minChange" :min="-100" :max="100" :step="0.5" />
        <el-input-number v-model="filters.maxChange" :min="-100" :max="100" :step="0.5" />
        <div class="flex gap-2">
          <el-button type="primary" @click="loadStocks">筛选</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>
    </el-card>

    <el-card v-loading="loading" class="sq-list-card">
      <el-table :data="filteredList" stripe class="sq-list-table">
        <el-table-column prop="code" label="代码" width="110" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="industry" label="行业" min-width="130" />
        <el-table-column prop="market" label="市场" width="90" />
        <el-table-column label="最新价" width="110">
          <template #default="{ row }">{{ row.price ?? '--' }}</template>
        </el-table-column>
        <el-table-column label="涨跌幅" width="110">
          <template #default="{ row }">
            <span :class="Number(row.changePercent || 0) >= 0 ? 'text-red-500' : 'text-green-500'">
              {{ Number(row.changePercent || 0).toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="PE" width="100">
          <template #default="{ row }">{{ row.pe ?? '--' }}</template>
        </el-table-column>
        <el-table-column label="PB" width="100">
          <template #default="{ row }">{{ row.pb ?? '--' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="toDetail(row.code)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
