<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import request from '@/api/request'
import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, GaugeChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, PieChart, GaugeChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const router = useRouter()
const userStore = useUserStore()
const health = ref(null)
const overview = ref(null)
const currentTime = ref('')
const liveUptime = ref(0)
let clockTimer = null
let startUptime = 0
let startedAt = 0

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}天${h}时${m}分`
  if (h > 0) return `${h}时${m}分${s}秒`
  return `${m}分${s}秒`
}

function startClock() {
  const tick = () => {
    currentTime.value = formatTime(new Date())
    if (startUptime > 0) {
      const elapsed = (Date.now() - startedAt) / 1000
      liveUptime.value = startUptime + elapsed
    }
  }
  tick()
  clockTimer = setInterval(tick, 1000)
}

onUnmounted(() => { if (clockTimer) clearInterval(clockTimer) })

const sentimentOption = ref({})
const industryOption = ref({})
const distributionOption = ref({})
const watchlist = ref([])

onMounted(async () => {
  startClock()
  try {
    const [h, o, wl] = await Promise.all([
      request.get('/health'),
      request.get('/market/overview').catch(() => ({ data: { up: 0, down: 0, flat: 0, sentiment: 50, industries: [] } })),
      request.get('/ai/watchlist').catch(() => ({ data: [] }))
    ])
    health.value = h
    startUptime = h.uptime || 0
    startedAt = Date.now()
    liveUptime.value = startUptime
    overview.value = o.data || { up: 0, down: 0, flat: 0, sentiment: 50, industries: [] }
    watchlist.value = wl.data || []
    updateCharts(overview.value)
  } catch (e) {
    console.error(e)
  }
})

function updateCharts(data) {
  sentimentOption.value = {
    series: [{
      type: 'gauge',
      center: ['50%', '68%'],
      radius: '95%',
      startAngle: 180, endAngle: 0,
      min: 0, max: 100, splitNumber: 5,
      axisLine: { lineStyle: { width: 10, color: [[0.3, '#10b981'], [0.7, '#e6a23c'], [1, '#f56c6c']] } },
      pointer: { width: 4, length: '50%', itemStyle: { color: 'auto' } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { color: 'auto', width: 1.5 } },
      axisLabel: { distance: 12, fontSize: 10, color: '#9ca3af' },
      title: { offsetCenter: [0, '25%'], fontSize: 12, color: '#9ca3af' },
      detail: { fontSize: 28, offsetCenter: [0, '-15%'], formatter: '{value}', valueAnimation: true, color: 'auto', fontWeight: 700 },
      data: [{ value: data.sentiment || 50, name: '情绪指数' }]
    }]
  }

  const topInd = data.industries || []
  industryOption.value = {
    tooltip: { trigger: 'axis' },
    grid: { top: 8, bottom: 16, left: 75, right: 50 },
    xAxis: { type: 'value', splitLine: { show: false }, axisLabel: { fontSize: 10, color: '#9ca3af' } },
    yAxis: { type: 'category', data: topInd.map(i => i.name), axisLabel: { color: '#9ca3af', fontSize: 11 }, axisTick: { show: false }, axisLine: { show: false } },
    series: [{
      type: 'bar', barWidth: 14,
      data: topInd.map(i => i.avgChange),
      itemStyle: { color: params => params.value > 0 ? '#f56c6c' : '#10b981', borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', formatter: '{c}%', fontSize: 10, color: 'inherit' }
    }]
  }

  distributionOption.value = {
    tooltip: { trigger: 'item' },
    legend: { top: '2%', left: 'center', textStyle: { color: '#9ca3af', fontSize: 11 }, itemWidth: 10, itemHeight: 10, itemGap: 16 },
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '58%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [
        { value: data.up, name: '上涨', itemStyle: { color: '#f56c6c' } },
        { value: data.flat, name: '平盘', itemStyle: { color: '#c0c4cc' } },
        { value: data.down, name: '下跌', itemStyle: { color: '#10b981' } }
      ]
    }]
  }
}

const quickActions = [
  { icon: '📊', label: '行情中心', path: '/market',   desc: 'A股行情与K线',       color: 'from-blue-500/10 to-blue-600/5' },
  { icon: '📸', label: '图片分析', path: '/vision',   desc: '截图AI识别分析',     color: 'from-teal-500/10 to-teal-600/5' },
  { icon: '⚙️', label: '策略管理', path: '/strategy', desc: '创建管理交易策略',   color: 'from-purple-500/10 to-purple-600/5' },
  { icon: '📈', label: '策略回测', path: '/backtest', desc: '历史数据验证策略',   color: 'from-orange-500/10 to-orange-600/5' },
  { icon: '🔍', label: '选股筛选', path: '/screener', desc: 'AI多因子智能选股',   color: 'from-cyan-500/10 to-cyan-600/5' },
  { icon: '🔔', label: '信号提醒', path: '/signals',  desc: '选股信号与AI提醒',   color: 'from-amber-500/10 to-amber-600/5' },
]
</script>

<template>
  <div>
    <!-- 顶部欢迎栏 -->
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white text-lg font-bold shadow">
          {{ (userStore.user?.username || 'U')[0].toUpperCase() }}
        </div>
        <div>
          <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">{{ userStore.user?.nickname || userStore.user?.username }}，你好</h2>
          <p class="text-xs text-gray-400 dark:text-gray-500">量化分析系统 · {{ currentTime.slice(5, 16) }}</p>
        </div>
      </div>
      <div v-if="health" class="hidden md:flex items-center gap-4 text-[11px] text-gray-400 font-mono">
        <span>v{{ health.version }}</span>
        <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>{{ formatUptime(liveUptime) }}</span>
        <span>{{ health.memory }}</span>
      </div>
    </div>

    <!-- 图表三栏 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
      <div class="dash-card">
        <div class="dash-card-header"><span class="dash-dot bg-amber-500"></span>市场情绪</div>
        <div class="h-44"><v-chart :option="sentimentOption" autoresize /></div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header">
          <span class="dash-dot bg-blue-500"></span>涨跌分布
          <span class="ml-auto text-xs font-mono"><span class="text-red-500">{{ overview?.up || 0 }}</span><span class="mx-1 text-gray-400">:</span><span class="text-green-500">{{ overview?.down || 0 }}</span></span>
        </div>
        <div class="h-44"><v-chart :option="distributionOption" autoresize /></div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header"><span class="dash-dot bg-red-500"></span>领涨行业</div>
        <div class="h-44"><v-chart :option="industryOption" autoresize /></div>
      </div>
    </div>

    <!-- 自选股 -->
    <div v-if="watchlist.length > 0" class="dash-card mb-5">
      <div class="dash-card-header">
        <span class="dash-dot bg-yellow-500"></span>我的自选
        <el-button text size="small" class="ml-auto !text-xs !text-gray-400" @click="router.push('/market')">查看全部 →</el-button>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4 pt-0">
        <div v-for="s in watchlist" :key="s.code" @click="router.push(`/market/${s.code}`)"
          class="p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all text-center">
          <div class="text-[10px] text-blue-400 font-mono">{{ s.code }}</div>
          <div class="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{{ s.name }}</div>
          <div class="text-xs font-mono mt-0.5" :class="(s.changePercent||0)>=0?'text-red-500':'text-green-500'">
            {{ s.price||'--' }} <span class="text-[10px]">{{ (s.changePercent||0)>=0?'+':'' }}{{ (s.changePercent||0).toFixed(2) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
      <div v-for="action in quickActions" :key="action.label" @click="router.push(action.path)"
        class="group cursor-pointer rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-400/40 dark:hover:border-blue-500/30 hover:shadow-md transition-all p-3 text-center">
        <div class="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center text-xl bg-gradient-to-br" :class="action.color">{{ action.icon }}</div>
        <div class="text-xs font-bold text-gray-700 dark:text-gray-200 group-hover:text-blue-500 transition-colors">{{ action.label }}</div>
        <div class="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 leading-tight">{{ action.desc }}</div>
      </div>
    </div>

    <!-- 底部状态条 -->
    <div class="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-600 px-1 py-2 border-t border-gray-100 dark:border-gray-800 font-mono">
      <div class="flex items-center gap-4">
        <span v-if="health">v{{ health.version }}</span>
        <span v-if="health" class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>运行 {{ formatUptime(liveUptime) }}</span>
        <span v-if="health">{{ health.memory }}</span>
      </div>
      <span>{{ currentTime }}</span>
    </div>
  </div>
</template>

<style scoped>
.dash-card {
  background: white;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.dash-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.dash-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #f5f5f5;
}
.dash-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

:root.dark .dash-card, html.dark .dash-card { background: #111827; border-color: #1f2937; }
:root.dark .dash-card:hover, html.dark .dash-card:hover { box-shadow: 0 2px 16px rgba(0,0,0,0.2); }
:root.dark .dash-card-header, html.dark .dash-card-header { color: #e5e7eb; border-bottom-color: #1f2937; }
</style>
