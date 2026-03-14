<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import backtestApi from '@/api/backtest'
import strategyApi from '@/api/strategy'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, GridComponent, MarkLineComponent])

const loading = ref(false)
const running = ref(false)
const histories = ref([])
const strategies = ref([])
const selectedBacktest = ref(null)

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

// 收益曲线图表配置
const equityChartOption = computed(() => {
  const bt = selectedBacktest.value
  if (!bt?.equityCurve?.length) return null

  const dates = bt.equityCurve.map(p => p.date)
  const values = bt.equityCurve.map(p => p.equity)
  const initial = bt.initialCapital || 100000
  const finalVal = values[values.length - 1] || initial
  const isProfit = finalVal >= initial

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        const profit = (p.value - initial).toFixed(2)
        const pctVal = (((p.value - initial) / initial) * 100).toFixed(2)
        return `${p.axisValue}<br/>净值: ¥${p.value.toLocaleString()}<br/>盈亏: ¥${profit} (${pctVal}%)`
      }
    },
    grid: { top: 30, bottom: 30, left: 70, right: 80 },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#9ca3af', fontSize: 11 } },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9ca3af', formatter: v => `¥${(v / 10000).toFixed(1)}万` },
      splitLine: { lineStyle: { color: '#1f2937' } }
    },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      lineStyle: { color: isProfit ? '#ef4444' : '#10b981', width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: isProfit ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)' },
            { offset: 1, color: 'rgba(0,0,0,0)' }
          ]
        }
      },
      markLine: {
        silent: true,
        data: [{ yAxis: initial, lineStyle: { color: '#6b7280', type: 'dashed' }, label: { formatter: '初始资金', color: '#6b7280' } }]
      }
    }]
  }
})

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
    // 自动选中最新一条
    if (histories.value.length && !selectedBacktest.value) {
      selectedBacktest.value = histories.value[0]
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
    const res = await backtestApi.run({
      strategyId: runForm.strategyId,
      dateRange: { start: runForm.start, end: runForm.end },
      initialCapital: Number(runForm.initialCapital)
    })
    ElMessage.success('回测已完成')
    // 刷新并选中新结果
    const listRes = await backtestApi.list()
    histories.value = listRes.data || []
    if (histories.value.length) {
      selectedBacktest.value = histories.value[0]
    }
  } catch (err) {
    ElMessage.error(err.message || '执行回测失败')
  } finally {
    running.value = false
  }
}

function selectBacktest(row) {
  selectedBacktest.value = row
}

onMounted(loadBaseData)
</script>

<template>
  <div>
    <h2 class="sq-list-title mb-4">📈 回测中心</h2>

    <!-- 回测配置 -->
    <el-card v-loading="loading" class="mb-4 sq-list-card">
      <template #header><div class="sq-section-title">快速回测</div></template>
      <div class="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <el-form-item label="策略" class="!mb-0">
          <el-select v-model="runForm.strategyId" placeholder="选择策略" class="w-full">
            <el-option v-for="s in strategies" :key="s._id" :label="s.name" :value="s._id" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期" class="!mb-0">
          <el-date-picker v-model="runForm.start" value-format="YYYY-MM-DD" type="date" class="!w-full" />
        </el-form-item>
        <el-form-item label="结束日期" class="!mb-0">
          <el-date-picker v-model="runForm.end" value-format="YYYY-MM-DD" type="date" class="!w-full" />
        </el-form-item>
        <el-form-item label="初始资金" class="!mb-0">
          <el-input-number v-model="runForm.initialCapital" :min="10000" :step="10000" class="!w-full" />
        </el-form-item>
        <el-button type="primary" :loading="running" @click="runBacktest" class="h-8">执行回测</el-button>
      </div>
      <p v-if="!strategies.length" class="text-xs text-gray-500 mt-2">
        暂无策略，请先在<router-link to="/strategy" class="text-blue-400 mx-1">策略管理</router-link>中创建
      </p>
    </el-card>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <!-- 左侧: 收益曲线 + 指标 -->
      <div class="xl:col-span-2 space-y-4">
        <!-- 收益曲线 -->
        <el-card v-if="selectedBacktest" class="sq-list-card">
          <template #header>
            <div class="flex justify-between items-center">
              <span class="sq-section-title">收益曲线 · {{ selectedBacktest.strategyId?.name || '未命名' }}</span>
              <span class="text-xs text-gray-500">{{ selectedBacktest.dateRange?.start }} ~ {{ selectedBacktest.dateRange?.end }}</span>
            </div>
          </template>
          <div v-if="equityChartOption" class="h-72">
            <v-chart :option="equityChartOption" autoresize />
          </div>
          <div v-else class="h-72 flex items-center justify-center text-gray-500">暂无曲线数据</div>
        </el-card>

        <!-- 核心指标仪表盘 -->
        <el-card v-if="selectedBacktest?.metrics" class="sq-list-card">
          <template #header><span class="sq-section-title">绩效指标</span></template>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
              <div class="text-xs text-gray-500 mb-1">总收益率</div>
              <div class="text-xl font-bold font-mono" :class="selectedBacktest.metrics.totalReturn >= 0 ? 'text-red-500' : 'text-green-500'">
                {{ pct(selectedBacktest.metrics.totalReturn) }}
              </div>
            </div>
            <div class="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
              <div class="text-xs text-gray-500 mb-1">年化收益</div>
              <div class="text-xl font-bold font-mono" :class="selectedBacktest.metrics.annualReturn >= 0 ? 'text-red-500' : 'text-green-500'">
                {{ pct(selectedBacktest.metrics.annualReturn) }}
              </div>
            </div>
            <div class="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
              <div class="text-xs text-gray-500 mb-1">最大回撤</div>
              <div class="text-xl font-bold font-mono text-orange-500">{{ pct(selectedBacktest.metrics.maxDrawdown) }}</div>
            </div>
            <div class="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
              <div class="text-xs text-gray-500 mb-1">夏普比率</div>
              <div class="text-xl font-bold font-mono">{{ selectedBacktest.metrics.sharpeRatio?.toFixed(2) ?? '--' }}</div>
            </div>
            <div class="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
              <div class="text-xs text-gray-500 mb-1">胜率</div>
              <div class="text-xl font-bold font-mono">{{ pct(selectedBacktest.metrics.winRate) }}</div>
            </div>
            <div class="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
              <div class="text-xs text-gray-500 mb-1">盈亏比</div>
              <div class="text-xl font-bold font-mono">{{ selectedBacktest.metrics.profitLossRatio?.toFixed(2) ?? '--' }}</div>
            </div>
            <div class="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
              <div class="text-xs text-gray-500 mb-1">交易次数</div>
              <div class="text-xl font-bold font-mono">{{ selectedBacktest.metrics.totalTrades ?? '--' }}</div>
            </div>
            <div class="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">
              <div class="text-xs text-gray-500 mb-1">初始资金</div>
              <div class="text-xl font-bold font-mono">¥{{ (selectedBacktest.initialCapital || 0).toLocaleString() }}</div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧: 回测历史列表 -->
      <div>
        <el-card class="sq-list-card">
          <template #header><span class="sq-section-title">回测历史</span></template>
          <div class="space-y-2 max-h-[600px] overflow-y-auto">
            <div
              v-for="bt in histories" :key="bt._id"
              @click="selectBacktest(bt)"
              class="p-3 rounded-lg border cursor-pointer transition-all"
              :class="selectedBacktest?._id === bt._id
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'"
            >
              <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-bold truncate">{{ bt.strategyId?.name || '未命名' }}</span>
                <span class="text-xs font-mono" :class="(bt.metrics?.totalReturn || 0) >= 0 ? 'text-red-500' : 'text-green-500'">
                  {{ pct(bt.metrics?.totalReturn) }}
                </span>
              </div>
              <div class="text-xs text-gray-500">
                {{ bt.dateRange?.start }} ~ {{ bt.dateRange?.end }}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                回撤 {{ pct(bt.metrics?.maxDrawdown) }} · 胜率 {{ pct(bt.metrics?.winRate) }} · 夏普 {{ bt.metrics?.sharpeRatio?.toFixed(2) ?? '--' }}
              </div>
            </div>
            <div v-if="!histories.length" class="text-center py-8 text-gray-500 text-sm">
              暂无回测记录，执行一次回测试试
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>
