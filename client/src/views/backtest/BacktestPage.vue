<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import backtestApi from '@/api/backtest'
import strategyApi from '@/api/strategy'

const loading = ref(false)
const running = ref(false)
const histories = ref([])
const strategies = ref([])

const runForm = reactive({
  strategyId: '',
  start: '2024-01-01',
  end: new Date().toISOString().slice(0, 10),
  initialCapital: 100000
})

function formatDate(v) {
  if (!v) return '--'
  return new Date(v).toLocaleString('zh-CN', { hour12: false })
}

function pct(v) {
  if (v === undefined || v === null) return '--'
  return `${Number(v).toFixed(2)}%`
}

async function loadBaseData() {
  loading.value = true
  try {
    const [strategyRes, backtestRes] = await Promise.all([
      strategyApi.list(),
      backtestApi.list()
    ])
    strategies.value = strategyRes.data || []
    histories.value = backtestRes.data || []
    if (!runForm.strategyId && strategies.value.length) {
      runForm.strategyId = strategies.value[0]._id
    }
  } catch (err) {
    ElMessage.error(err.message || '加载回测数据失败')
  } finally {
    loading.value = false
  }
}

async function runBacktest() {
  if (!runForm.strategyId) {
    ElMessage.warning('请先选择策略')
    return
  }
  running.value = true
  try {
    await backtestApi.run({
      strategyId: runForm.strategyId,
      dateRange: { start: runForm.start, end: runForm.end },
      initialCapital: Number(runForm.initialCapital)
    })
    ElMessage.success('回测任务已完成')
    const res = await backtestApi.list()
    histories.value = res.data || []
  } catch (err) {
    ElMessage.error(err.message || '执行回测失败')
  } finally {
    running.value = false
  }
}

onMounted(loadBaseData)
</script>

<template>
  <div>
    <h2 class="sq-list-title mb-4">回测中心</h2>
    <el-card v-loading="loading" class="mb-4 sq-list-card">
      <template #header>
        <div class="sq-section-title">快速回测</div>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <el-select v-model="runForm.strategyId" placeholder="选择策略">
          <el-option v-for="s in strategies" :key="s._id" :label="s.name" :value="s._id" />
        </el-select>
        <el-date-picker v-model="runForm.start" value-format="YYYY-MM-DD" type="date" placeholder="开始日期" />
        <el-date-picker v-model="runForm.end" value-format="YYYY-MM-DD" type="date" placeholder="结束日期" />
        <el-input-number v-model="runForm.initialCapital" :min="10000" :step="10000" :max="100000000" />
      </div>
      <div class="mt-3">
        <el-button type="primary" :loading="running" @click="runBacktest">执行回测</el-button>
      </div>
    </el-card>

    <el-card class="sq-list-card">
      <template #header>
        <div class="sq-section-title">回测历史</div>
      </template>
      <el-table :data="histories" stripe class="sq-list-table">
        <el-table-column label="策略" min-width="180">
          <template #default="{ row }">{{ row.strategyId?.name || '未命名策略' }}</template>
        </el-table-column>
        <el-table-column label="区间" min-width="200">
          <template #default="{ row }">{{ row.dateRange?.start }} ~ {{ row.dateRange?.end }}</template>
        </el-table-column>
        <el-table-column label="总收益" width="110">
          <template #default="{ row }">
            <span :class="Number(row.metrics?.totalReturn || 0) >= 0 ? 'text-red-500' : 'text-green-500'">
              {{ pct(row.metrics?.totalReturn) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最大回撤" width="110">
          <template #default="{ row }">{{ pct(row.metrics?.maxDrawdown) }}</template>
        </el-table-column>
        <el-table-column label="胜率" width="110">
          <template #default="{ row }">{{ pct(row.metrics?.winRate) }}</template>
        </el-table-column>
        <el-table-column label="夏普" width="90">
          <template #default="{ row }">{{ row.metrics?.sharpeRatio?.toFixed?.(2) ?? '--' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
