<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import backtestApi from '@/api/backtest'
import strategyApi from '@/api/strategy'
import { useThemeStore } from '@/stores/themeStore'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, GridComponent, MarkLineComponent])

const themeStore = useThemeStore()
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

function pct(v) {
  if (v === undefined || v === null) return '--'
  return `${Number(v).toFixed(2)}%`
}

// 主题感知颜色
const gridLineColor = computed(() => themeStore.theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')
const labelColor = computed(() => themeStore.theme === 'dark' ? '#6b7280' : '#9ca3af')

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
      backgroundColor: themeStore.theme === 'dark' ? '#1f2937' : '#fff',
      borderColor: themeStore.theme === 'dark' ? '#374151' : '#e5e7eb',
      textStyle: { color: themeStore.theme === 'dark' ? '#e5e7eb' : '#374151', fontSize: 12 },
      formatter: (params) => {
        const p = params[0]
        const profit = (p.value - initial).toFixed(2)
        const pctVal = (((p.value - initial) / initial) * 100).toFixed(2)
        return `<div style="font-size:11px;color:${labelColor.value}">${p.axisValue}</div>
                <div style="margin-top:4px">净值: <b>¥${p.value.toLocaleString()}</b></div>
                <div>盈亏: <b style="color:${Number(profit) >= 0 ? '#ef4444' : '#10b981'}">¥${profit} (${pctVal}%)</b></div>`
      }
    },
    grid: { top: 20, bottom: 28, left: 65, right: 80 },
    xAxis: {
      type: 'category', data: dates, boundaryGap: false,
      axisLabel: { color: labelColor.value, fontSize: 10 },
      axisLine: { lineStyle: { color: gridLineColor.value } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: labelColor.value, fontSize: 10, formatter: v => `¥${(v / 10000).toFixed(1)}万` },
      splitLine: { lineStyle: { color: gridLineColor.value, type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      symbol: 'circle', symbolSize: 4, showSymbol: false,
      lineStyle: { color: isProfit ? '#ef4444' : '#10b981', width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: isProfit ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' },
            { offset: 1, color: 'rgba(0,0,0,0)' }
          ]
        }
      },
      markLine: {
        silent: true,
        data: [{ yAxis: initial, lineStyle: { color: '#94a3b8', type: 'dashed', width: 1 }, label: { formatter: '初始资金', color: '#94a3b8', fontSize: 10 } }]
      }
    }]
  }
})

async function loadBaseData() {
  loading.value = true
  try {
    const [strategyRes, backtestRes] = await Promise.all([strategyApi.list(), backtestApi.list()])
    strategies.value = strategyRes.data || []
    histories.value = backtestRes.data || []
    if (!runForm.strategyId && strategies.value.length) runForm.strategyId = strategies.value[0]._id
    if (histories.value.length && !selectedBacktest.value) selectedBacktest.value = histories.value[0]
  } catch (err) {
    ElMessage.error(err.message || '加载回测数据失败')
  } finally {
    loading.value = false
  }
}

async function runBacktest() {
  if (!runForm.strategyId) { ElMessage.warning('请先选择策略'); return }
  running.value = true
  try {
    await backtestApi.run({ strategyId: runForm.strategyId, dateRange: { start: runForm.start, end: runForm.end }, initialCapital: Number(runForm.initialCapital) })
    ElMessage.success('回测已完成')
    const listRes = await backtestApi.list()
    histories.value = listRes.data || []
    if (histories.value.length) selectedBacktest.value = histories.value[0]
  } catch (err) {
    ElMessage.error(err.message || '执行回测失败')
  } finally {
    running.value = false
  }
}

function selectBacktest(row) { selectedBacktest.value = row }

onMounted(loadBaseData)

// 指标卡片定义
const metricCards = computed(() => {
  const m = selectedBacktest.value?.metrics
  if (!m) return []
  return [
    { label: '总收益率', value: pct(m.totalReturn), color: (m.totalReturn || 0) >= 0 ? 'text-red-500' : 'text-green-500', accent: 'border-t-red-400' },
    { label: '年化收益', value: pct(m.annualReturn), color: (m.annualReturn || 0) >= 0 ? 'text-red-500' : 'text-green-500', accent: 'border-t-orange-400' },
    { label: '最大回撤', value: pct(m.maxDrawdown), color: 'text-amber-500', accent: 'border-t-amber-400' },
    { label: '夏普比率', value: m.sharpeRatio?.toFixed(2) ?? '--', color: '', accent: 'border-t-blue-400' },
    { label: '胜率', value: pct(m.winRate), color: '', accent: 'border-t-teal-400' },
    { label: '盈亏比', value: m.profitLossRatio?.toFixed(2) ?? '--', color: '', accent: 'border-t-purple-400' },
    { label: '交易次数', value: String(m.totalTrades ?? '--'), color: '', accent: 'border-t-cyan-400' },
    { label: '初始资金', value: `¥${(selectedBacktest.value?.initialCapital || 0).toLocaleString()}`, color: '', accent: 'border-t-gray-400' },
  ]
})
</script>

<template>
  <div>
    <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">回测中心</h2>

    <!-- 回测配置栏 -->
    <div class="bt-card mb-4" v-loading="loading">
      <div class="bt-card-header">快速回测</div>
      <div class="p-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-gray-500 text-xs whitespace-nowrap">策略</span>
            <el-select v-model="runForm.strategyId" placeholder="选择策略" size="default" style="width: 160px">
              <el-option v-for="s in strategies" :key="s._id" :label="s.name" :value="s._id" />
            </el-select>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-gray-500 text-xs whitespace-nowrap">开始日期</span>
            <el-date-picker v-model="runForm.start" value-format="YYYY-MM-DD" type="date" size="default" style="width: 140px" />
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-gray-500 text-xs whitespace-nowrap">结束日期</span>
            <el-date-picker v-model="runForm.end" value-format="YYYY-MM-DD" type="date" size="default" style="width: 140px" />
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-gray-500 text-xs whitespace-nowrap">初始资金</span>
            <el-input-number v-model="runForm.initialCapital" :min="10000" :step="10000" size="default" style="width: 140px" />
          </div>
          <el-button type="primary" :loading="running" @click="runBacktest" size="default" class="!px-6">
            {{ running ? '执行中...' : '执行回测' }}
          </el-button>
        </div>
        <p v-if="!strategies.length" class="text-xs text-gray-400 mt-3">
          暂无策略，请先在<router-link to="/strategy" class="text-blue-400 mx-1">策略管理</router-link>中创建
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
      <!-- 左侧: 曲线 + 指标（占 3 列） -->
      <div class="xl:col-span-3 space-y-4">
        <!-- 收益曲线 -->
        <div v-if="selectedBacktest" class="bt-card">
          <div class="bt-card-header">
            <span>收益曲线 · {{ selectedBacktest.strategyId?.name || '未命名' }}</span>
            <span class="ml-auto text-xs text-gray-400 font-mono">{{ selectedBacktest.dateRange?.start }} ~ {{ selectedBacktest.dateRange?.end }}</span>
          </div>
          <div class="p-4">
            <div v-if="equityChartOption" class="h-64">
              <v-chart :option="equityChartOption" autoresize />
            </div>
            <div v-else class="h-64 flex items-center justify-center text-gray-400 text-sm">暂无曲线数据</div>
          </div>
        </div>

        <!-- 绩效指标 -->
        <div v-if="selectedBacktest?.metrics" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div v-for="(card, i) in metricCards" :key="i"
            class="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 border-t-2 p-3 text-center transition-shadow hover:shadow-sm"
            :class="card.accent"
          >
            <div class="text-[11px] text-gray-400 dark:text-gray-500 mb-1">{{ card.label }}</div>
            <div class="text-lg font-bold font-mono" :class="card.color || 'text-gray-800 dark:text-gray-200'">{{ card.value }}</div>
          </div>
        </div>
      </div>

      <!-- 右侧: 回测历史 -->
      <div>
        <div class="bt-card">
          <div class="bt-card-header">回测历史</div>
          <div class="p-2 space-y-1.5 max-h-[520px] overflow-y-auto">
            <div
              v-for="bt in histories" :key="bt._id"
              @click="selectBacktest(bt)"
              class="p-3 rounded-lg cursor-pointer transition-all text-sm"
              :class="selectedBacktest?._id === bt._id
                ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-400/50 dark:border-blue-500/30'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent'"
            >
              <div class="flex justify-between items-center">
                <span class="font-bold truncate text-gray-800 dark:text-gray-200">{{ bt.strategyId?.name || '未命名' }}</span>
                <span class="text-xs font-mono font-bold" :class="(bt.metrics?.totalReturn || 0) >= 0 ? 'text-red-500' : 'text-green-500'">
                  {{ pct(bt.metrics?.totalReturn) }}
                </span>
              </div>
              <div class="text-[11px] text-gray-400 mt-1">{{ bt.dateRange?.start }} ~ {{ bt.dateRange?.end }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5">
                回撤 {{ pct(bt.metrics?.maxDrawdown) }} · 胜率 {{ pct(bt.metrics?.winRate) }} · 夏普 {{ bt.metrics?.sharpeRatio?.toFixed(2) ?? '--' }}
              </div>
            </div>
            <div v-if="!histories.length" class="text-center py-10 text-gray-400 text-sm">暂无回测记录</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bt-card {
  background: white;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
}
.bt-card-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #f5f5f5;
}

:root.dark .bt-card, html.dark .bt-card { background: #111827; border-color: #1f2937; }
:root.dark .bt-card-header, html.dark .bt-card-header { color: #e5e7eb; border-bottom-color: #1f2937; }
</style>
