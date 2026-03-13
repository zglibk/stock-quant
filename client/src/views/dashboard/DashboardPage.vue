<script setup>
import { ref, onMounted } from 'vue'
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

const sentimentOption = ref({})
const industryOption = ref({})
const distributionOption = ref({})

onMounted(async () => {
  try {
    const [h, o] = await Promise.all([
      request.get('/health'),
      request.get('/market/overview')
    ])
    health.value = h
    overview.value = o.data
    
    updateCharts(o.data)
  } catch (e) {
    console.error(e)
  }
})

function updateCharts(data) {
  // 1. 市场情绪仪表盘
  sentimentOption.value = {
    series: [{
      type: 'gauge',
      center: ['50%', '70%'],
      radius: '100%',
      startAngle: 180, endAngle: 0,
      min: 0, max: 100,
      splitNumber: 5,
      axisLine: {
        lineStyle: { width: 10, color: [[0.3, '#10b981'], [0.7, '#e6a23c'], [1, '#f56c6c']] }
      },
      pointer: { width: 4, length: '50%', itemStyle: { color: 'auto' } },
      title: { offsetCenter: [0, '30%'], fontSize: 14, color: '#9ca3af' }, // 标题下移
      detail: { fontSize: 30, offsetCenter: [0, '-20%'], formatter: '{value}', valueAnimation: true, color: 'auto' }, // 数值上移
      data: [{ value: data.sentiment || 50, name: '情绪指数' }]
    }]
  }

  // 2. 行业涨幅 (Top 6)
  const topInd = data.industries || []
  industryOption.value = {
    tooltip: { trigger: 'axis' },
    grid: { top: 10, bottom: 20, left: 80, right: 40 }, // 右侧留空防止数值截断
    xAxis: { type: 'value', splitLine: { show: false } },
    yAxis: { 
      type: 'category', 
      data: topInd.map(i => i.name),
      axisLabel: { color: '#9ca3af' }
    },
    series: [{
      type: 'bar',
      data: topInd.map(i => i.avgChange),
      itemStyle: { color: params => params.value > 0 ? '#f56c6c' : '#10b981', borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', formatter: '{c}%', color: 'inherit' }
    }]
  }

  // 3. 涨跌分布
  distributionOption.value = {
    tooltip: { trigger: 'item' },
    legend: { top: '5%', left: 'center', textStyle: { color: '#9ca3af' } },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '60%'], // 下移一点避开 legend
      itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 1 },
      label: { show: false },
      data: [
        { value: data.up, name: '上涨', itemStyle: { color: '#f56c6c' } },
        { value: data.flat, name: '平盘', itemStyle: { color: '#909399' } },
        { value: data.down, name: '下跌', itemStyle: { color: '#10b981' } }
      ]
    }]
  }
}

const quickActions = [
  { icon: '📊', label: '行情中心', path: '/market',   desc: '查看A股行情与K线图' },
  { icon: '📸', label: '图片分析', path: '/vision',   desc: '截图交易APP让AI识别分析' },
  { icon: '⚙️', label: '策略管理', path: '/strategy', desc: '创建和管理交易策略' },
  { icon: '📈', label: '策略回测', path: '/backtest', desc: '历史数据验证策略效果' },
  { icon: '🔍', label: '选股筛选', path: '/screener', desc: 'AI多因子智能选股' },
  { icon: '🔔', label: '信号提醒', path: '/signals',  desc: '选股信号与AI提醒' },
]
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="sq-page-title">👋 {{ userStore.user?.nickname || userStore.user?.username }}，你好</h2>
        <p class="sq-subtle-text text-sm mt-1">量化分析系统</p>
      </div>
      <el-tag v-if="health" type="success" effect="plain" size="small">系统正常 · {{ health.memory }}</el-tag>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <!-- 市场情绪 -->
      <el-card class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm" shadow="hover">
        <template #header><span class="sq-section-title">市场情绪</span></template>
        <div class="h-48">
          <v-chart :option="sentimentOption" autoresize />
        </div>
      </el-card>

      <!-- 涨跌分布 -->
      <el-card class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm" shadow="hover">
        <template #header>
          <div class="flex justify-between">
            <span class="sq-section-title">涨跌分布</span>
            <span class="text-xs text-gray-500">
              <span class="text-red-500">{{ overview?.up }}</span> : 
              <span class="text-green-500">{{ overview?.down }}</span>
            </span>
          </div>
        </template>
        <div class="h-48">
          <v-chart :option="distributionOption" autoresize />
        </div>
      </el-card>

      <!-- 热门行业 -->
      <el-card class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm" shadow="hover">
        <template #header><span class="sq-section-title">领涨行业</span></template>
        <div class="h-48">
          <v-chart :option="industryOption" autoresize />
        </div>
      </el-card>
    </div>

    <!-- 快捷入口 -->
    <h3 class="sq-section-title mb-3 uppercase tracking-wider">快捷入口</h3>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
      <div
        v-for="action in quickActions" :key="action.label"
        @click="router.push(action.path)"
        class="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-blue-500/30 cursor-pointer transition-all group shadow-sm"
      >
        <div class="text-2xl mb-2">{{ action.icon }}</div>
        <div class="text-sm font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-500 transition-colors">{{ action.label }}</div>
        <div class="text-xs text-gray-500 dark:text-gray-600 mt-1">{{ action.desc }}</div>
      </div>
    </div>

    <!-- 系统信息 -->
    <el-card v-if="health" class="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm" shadow="never">
      <template #header><span class="sq-section-title">系统状态</span></template>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span class="text-gray-500 dark:text-gray-400">版本: </span><span class="text-gray-700 dark:text-gray-200">{{ health.version }}</span></div>
        <div><span class="text-gray-500 dark:text-gray-400">运行: </span><span class="text-gray-700 dark:text-gray-200">{{ Math.round(health.uptime / 60) }} 分钟</span></div>
        <div><span class="text-gray-500 dark:text-gray-400">内存: </span><span class="text-gray-700 dark:text-gray-200">{{ health.memory }}</span></div>
        <div><span class="text-gray-500 dark:text-gray-400">时间: </span><span class="text-gray-700 dark:text-gray-200">{{ health.timestamp?.slice(0, 19) }}</span></div>
      </div>
    </el-card>
  </div>
</template>
