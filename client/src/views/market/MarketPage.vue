<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import request from '@/api/request'
import marketApi from '@/api/market'
import { ElMessage } from 'element-plus'
import { useThemeStore } from '@/stores/themeStore'

const router = useRouter()
const themeStore = useThemeStore()
const stocks = ref([])
const total = ref(0)
const loading = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(30)
const syncLoading = ref(false)
const calcLoading = ref(false)
const calcProgress = ref(null)
const calcElapsed = ref(0)
let calcTimer = null
let calcPollTimer = null
const refreshListLoading = ref(false)
const refreshProgress = ref(null) // { percent, totalCodes, processedCodes, validStocks }
const refreshElapsed = ref(0)
let refreshTimer = null
let refreshPollTimer = null
const syncStatus = ref(null)
const syncScope = ref('all')
const customCodes = ref('')
const syncLogs = ref([])
const lastHandledFinishedAt = ref('')
const showSyncProgressCard = ref(false)
let progressHideTimer = null
let syncTimer = null

const isDark = computed(() => {
  if (themeStore.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return themeStore.theme === 'dark'
})

const tableHeaderStyle = computed(() => ({
  background: isDark.value ? '#111827' : '#f8fafc',
  color: isDark.value ? '#94a3b8' : '#475569',
  borderColor: isDark.value ? '#2a3a52' : '#e2e8f0'
}))

const tableCellStyle = computed(() => ({
  borderColor: isDark.value ? '#1f2937' : '#e2e8f0'
}))

const marketCardClass = computed(() => (
  isDark.value ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
))

const rowClassName = computed(() => (
  isDark.value ? 'cursor-pointer hover:bg-gray-800/50' : 'cursor-pointer hover:bg-blue-50/70'
))
const cardTitleClass = computed(() => (isDark.value ? 'text-gray-100' : 'text-slate-800'))
const codeTextClass = computed(() => (isDark.value ? 'text-blue-400 font-mono' : 'text-blue-700 font-mono'))
const countTextClass = computed(() => (isDark.value ? 'text-gray-500' : 'text-slate-500'))
const syncProgressPercent = computed(() => Number(syncStatus.value?.progress?.percent || 0))
const isSyncRunning = computed(() => Boolean(syncStatus.value?.running))
const shouldShowSyncProgressCard = computed(() => {
  if (isSyncRunning.value) return true
  return showSyncProgressCard.value && Boolean(syncStatus.value?.finishedAt)
})
const syncScopeOptions = [
  { label: '全部股票', value: 'all' },
  { label: '当前页股票', value: 'current_page' },
  { label: '自定义代码', value: 'custom' }
]
const syncProgressStatus = computed(() => {
  if (!syncStatus.value) return ''
  if (syncStatus.value.running) return ''
  if (syncStatus.value.error) return 'exception'
  return 'success'
})
const syncProgressText = computed(() => {
  if (!syncStatus.value) return ''
  const p = syncStatus.value.progress || {}
  const processed = Number(p.processedCodes || 0)
  const totalCodes = Number(p.totalCodes || 0)
  const totalRows = Number(p.totalRows || 0)
  const scopeLabel = syncStatus.value.scopeLabel || '全部股票'
  if (syncStatus.value.running) {
    return `同步中（${scopeLabel}）：${processed}/${totalCodes || '--'} 只，已写入 ${totalRows} 条K线`
  }
  if (syncStatus.value.error) {
    return `同步失败：${syncStatus.value.error}`
  }
  return `同步完成（${scopeLabel}）：${processed}/${totalCodes || '--'} 只，新增/更新 ${totalRows} 条K线`
})
const customCodeCount = computed(() => parseInputCodes(customCodes.value).length)

function addSyncLog(level, message) {
  syncLogs.value.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    level,
    message,
    time: new Date().toLocaleTimeString()
  })
  if (syncLogs.value.length > 20) {
    syncLogs.value = syncLogs.value.slice(0, 20)
  }
}

function scheduleProgressAutoHide() {
  if (progressHideTimer) {
    clearTimeout(progressHideTimer)
  }
  progressHideTimer = setTimeout(() => {
    showSyncProgressCard.value = false
  }, 12000)
}

function upDownClass(value) {
  const n = Number(value || 0)
  if (n > 0) return isDark.value ? 'text-red-400 font-semibold' : 'text-red-600 font-semibold'
  if (n < 0) return isDark.value ? 'text-emerald-400 font-semibold' : 'text-emerald-600 font-semibold'
  return isDark.value ? 'text-gray-400' : 'text-slate-500'
}

function upDownSymbol(value) {
  const n = Number(value || 0)
  if (n > 0) return '▲'
  if (n < 0) return '▼'
  return '■'
}

function industryTagType(industry) {
  if (!industry) return 'info'
  const v = String(industry)
  if (v.includes('半导体') || v.includes('电子') || v.includes('AI')) return 'primary'
  if (v.includes('医药') || v.includes('生物')) return 'success'
  if (v.includes('银行') || v.includes('保险') || v.includes('证券')) return 'warning'
  return 'info'
}

function parseInputCodes(input) {
  return String(input || '')
    .split(/[\s,，;；]+/)
    .map((s) => String(s || '').trim().replace(/^(sh|sz|bj)/i, '').replace(/\.(SH|SZ|BJ)$/i, '').toUpperCase())
    .filter(Boolean)
}

async function fetchStocks() {
  loading.value = true
  try {
    const res = await request.get('/stocks', {
      params: { keyword: keyword.value, page: page.value, limit: pageSize.value }
    })
    stocks.value = res.data.stocks
    total.value = res.data.total
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function handleSyncCommand(command) {
  syncScope.value = command
  if (command === 'custom') return  // 展开自定义输入框，用户手动点"开始同步"
  syncData()
}

async function syncData() {
  syncLoading.value = true
  try {
    showSyncProgressCard.value = true
    if (progressHideTimer) {
      clearTimeout(progressHideTimer)
      progressHideTimer = null
    }
    let payload = { scope: 'all', scopeLabel: '全部股票' }
    if (syncScope.value === 'current_page') {
      const pageCodes = (stocks.value || []).map(s => s.code).filter(Boolean)
      if (!pageCodes.length) {
        ElMessage.warning('当前页没有可同步的股票代码')
        return
      }
      payload = { scope: 'codes', scopeLabel: '当前页股票', codes: pageCodes }
    } else if (syncScope.value === 'custom') {
      const codes = parseInputCodes(customCodes.value)
      if (!codes.length) {
        ElMessage.warning('请先输入要同步的股票代码')
        return
      }
      payload = { scope: 'codes', scopeLabel: `自定义(${codes.length}只)`, codes }
    }
    const res = await request.post('/market/sync', payload)
    addSyncLog('info', `已触发同步（${payload.scopeLabel}）`)
    ElMessage.success(res.message || '已开始后台同步')
    await fetchSyncStatus()
    startSyncPolling()
  } catch (e) {
    ElMessage.error('同步失败: ' + (e.message || ''))
  } finally {
    syncLoading.value = false
  }
}

function stopSyncPolling() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

async function fetchSyncStatus() {
  try {
    const res = await request.get('/market/sync/status')
    syncStatus.value = res.data || null
    if (
      syncStatus.value &&
      syncStatus.value.running === false &&
      syncStatus.value.finishedAt &&
      syncStatus.value.finishedAt !== lastHandledFinishedAt.value
    ) {
      lastHandledFinishedAt.value = syncStatus.value.finishedAt
      showSyncProgressCard.value = true
      stopSyncPolling()
      if (syncStatus.value.error) {
        ElMessage.error('同步失败: ' + syncStatus.value.error)
        addSyncLog('error', `同步失败（${syncStatus.value.scopeLabel || '全部股票'}）：${syncStatus.value.error}`)
      } else {
        const total = Number(syncStatus.value.result?.total || 0)
        if (total > 0) {
          ElMessage.success(`同步完成：新增/更新 ${total} 条K线`)
          addSyncLog('success', `同步完成（${syncStatus.value.scopeLabel || '全部股票'}）：新增/更新 ${total} 条K线`)
        } else {
          ElMessage.warning('同步完成，但未拉取到K线数据，请稍后重试')
          addSyncLog('warning', `同步完成（${syncStatus.value.scopeLabel || '全部股票'}）：未拉取到K线数据`)
        }
      }
      scheduleProgressAutoHide()
      await fetchStocks()
    }
  } catch {}
}

function startSyncPolling() {
  stopSyncPolling()
  syncTimer = setInterval(fetchSyncStatus, 3000)
}

function handleSearch() {
  page.value = 1
  fetchStocks()
}

async function calcIndicators() {
  calcLoading.value = true
  calcProgress.value = { percent: 0, total: 0, success: 0, failed: 0 }
  calcElapsed.value = 0
  calcTimer = setInterval(() => { calcElapsed.value++ }, 1000)

  try {
    await marketApi.calcIndicators()
    startCalcPolling()
  } catch (err) {
    if (!String(err.message).includes('timeout')) {
      stopCalcPolling()
      calcLoading.value = false
      ElMessage.error('指标计算失败: ' + (err.message || ''))
    } else {
      startCalcPolling()
    }
  }
}

function startCalcPolling() {
  if (calcPollTimer) return
  calcPollTimer = setInterval(async () => {
    try {
      const res = await marketApi.getCalcStatus()
      const st = res.data
      if (st?.progress) calcProgress.value = st.progress
      if (!st?.running) {
        stopCalcPolling()
        calcLoading.value = false
        if (st?.error) {
          ElMessage.error('指标计算失败: ' + st.error)
          addSyncLog('error', `指标计算失败: ${st.error}`)
        } else {
          const r = st?.result || st?.progress || {}
          ElMessage.success(`指标计算完成: 成功 ${r.success || 0} 只, 失败 ${r.failed || 0} 只`)
          addSyncLog('success', `指标计算完成: ${r.success || 0}/${r.total || 0}`)
        }
      }
    } catch {}
  }, 2000)
}

function stopCalcPolling() {
  if (calcPollTimer) { clearInterval(calcPollTimer); calcPollTimer = null }
  if (calcTimer) { clearInterval(calcTimer); calcTimer = null }
}

async function refreshStockList() {
  refreshListLoading.value = true
  refreshProgress.value = { percent: 0, totalCodes: 0, processedCodes: 0, validStocks: 0 }
  refreshElapsed.value = 0
  refreshTimer = setInterval(() => { refreshElapsed.value++ }, 1000)

  try {
    await marketApi.syncStockList()
    // 开始轮询进度
    startRefreshPolling()
  } catch (err) {
    // 如果请求本身就失败了（非超时）
    if (!String(err.message).includes('timeout')) {
      stopRefreshPolling()
      refreshListLoading.value = false
      ElMessage.error('刷新失败: ' + (err.message || ''))
    } else {
      // timeout 可能是因为后端还在处理（已改为异步），继续轮询
      startRefreshPolling()
    }
  }
}

function startRefreshPolling() {
  if (refreshPollTimer) return
  refreshPollTimer = setInterval(async () => {
    try {
      const res = await marketApi.getStockListStatus()
      const st = res.data
      if (st?.progress) refreshProgress.value = st.progress

      if (!st?.running) {
        stopRefreshPolling()
        refreshListLoading.value = false
        if (st?.error) {
          ElMessage.error('刷新失败: ' + st.error)
          addSyncLog('error', `股票列表刷新失败: ${st.error}`)
        } else {
          const count = st?.result?.updated || st?.progress?.validStocks || 0
          ElMessage.success(`股票列表已刷新: ${count} 只`)
          addSyncLog('success', `股票列表刷新: ${count} 只`)
          await fetchStocks()
        }
      }
    } catch {}
  }, 1500)
}

function stopRefreshPolling() {
  if (refreshPollTimer) { clearInterval(refreshPollTimer); refreshPollTimer = null }
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
}

function goDetail(code) {
  router.push(`/market/${code}`)
}

onMounted(async () => {
  await fetchStocks()
  await fetchSyncStatus()
  if (syncStatus.value?.running) {
    showSyncProgressCard.value = true
    startSyncPolling()
  }
})
onUnmounted(() => {
  stopSyncPolling()
  if (progressHideTimer) clearTimeout(progressHideTimer)
})
watch(page, fetchStocks)
</script>

<template>
  <div>
    <!-- 顶部：标题 + 搜索 + 操作按钮 -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
      <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap shrink-0">行情中心</h2>
      <div class="flex flex-wrap items-center gap-2">
        <!-- 搜索框 -->
        <el-input
          v-model="keyword"
          placeholder="搜索代码或名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix><span class="text-gray-400">🔍</span></template>
        </el-input>
        <el-button @click="handleSearch">搜索</el-button>

        <!-- 分隔 -->
        <div class="hidden md:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

        <!-- 数据操作按钮组 -->
        <el-button :loading="refreshListLoading" @click="refreshStockList">🔄 刷新列表</el-button>
        <el-dropdown trigger="click" @command="handleSyncCommand">
          <el-button type="warning" :loading="syncLoading || isSyncRunning">
            {{ isSyncRunning ? '同步中...' : '同步K线 ▾' }}
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">同步全部股票K线</el-dropdown-item>
              <el-dropdown-item command="current_page">同步当前页股票</el-dropdown-item>
              <el-dropdown-item command="custom" divided>自定义股票代码...</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="success" :loading="calcLoading" @click="calcIndicators">📐 计算指标</el-button>
      </div>
    </div>

    <!-- 自定义代码输入区（仅点击"自定义股票代码"后显示） -->
    <div v-if="syncScope === 'custom'" class="mb-3 flex items-center gap-2">
      <el-input
        v-model="customCodes"
        placeholder="输入股票代码，逗号或空格分隔，如: 603612 000001 300750"
        clearable
        style="max-width: 500px"
      />
      <span class="text-xs whitespace-nowrap" :class="countTextClass">已识别 {{ customCodeCount }} 只</span>
      <el-button type="warning" size="small" :loading="syncLoading || isSyncRunning" @click="syncData">开始同步</el-button>
      <el-button size="small" @click="syncScope = 'all'">取消</el-button>
    </div>

    <!-- 刷新列表进度条 -->
    <div v-if="refreshListLoading" class="mb-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
          <span class="text-sm font-medium text-blue-700 dark:text-blue-300">正在刷新A股列表...</span>
        </div>
        <span class="text-xs text-blue-500 font-mono">{{ refreshElapsed }}s</span>
      </div>
      <el-progress
        :percentage="refreshProgress?.percent || 0"
        :stroke-width="6"
        :show-text="false"
        color="#3b82f6"
        class="!mb-1"
      />
      <div class="flex justify-between text-[11px] text-blue-500 dark:text-blue-400 font-mono mt-1">
        <span>已探测 {{ (refreshProgress?.processedCodes || 0).toLocaleString() }} / {{ (refreshProgress?.totalCodes || 0).toLocaleString() }} 代码</span>
        <span>发现 {{ (refreshProgress?.validStocks || 0).toLocaleString() }} 只有效股票</span>
      </div>
    </div>

    <!-- 指标计算进度条 -->
    <div v-if="calcLoading" class="mb-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
          <span class="text-sm font-medium text-green-700 dark:text-green-300">正在计算技术指标...</span>
        </div>
        <span class="text-xs text-green-500 font-mono">{{ calcElapsed }}s</span>
      </div>
      <el-progress
        :percentage="calcProgress?.percent || 0"
        :stroke-width="6"
        :show-text="false"
        color="#10b981"
        class="!mb-1"
      />
      <div class="flex justify-between text-[11px] text-green-500 dark:text-green-400 font-mono mt-1">
        <span>进度 {{ calcProgress?.percent || 0 }}% · 共 {{ (calcProgress?.total || 0).toLocaleString() }} 只</span>
        <span>成功 {{ calcProgress?.success || 0 }} · 失败 {{ calcProgress?.failed || 0 }}</span>
      </div>
    </div>

    <el-alert
      v-if="syncStatus?.running || syncStatus?.error"
      :type="syncStatus?.running ? 'info' : 'error'"
      :title="syncStatus?.running
        ? 'K线同步进行中，请稍候...'
        : `最近一次同步失败：${syncStatus?.error || ''}`"
      show-icon :closable="false" class="mb-3"
    />
    <el-card v-if="shouldShowSyncProgressCard" :class="['sq-list-card', marketCardClass]" shadow="never" class="mb-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold" :class="cardTitleClass">同步进度</span>
        <div class="flex items-center gap-2">
          <span class="text-xs" :class="countTextClass">{{ syncProgressPercent }}%</span>
          <el-button
            v-if="!isSyncRunning"
            text
            size="small"
            @click="showSyncProgressCard = false"
          >
            收起
          </el-button>
        </div>
      </div>
      <el-progress
        :percentage="syncProgressPercent"
        :status="syncProgressStatus"
        :stroke-width="16"
        :striped="isSyncRunning"
        :striped-flow="isSyncRunning"
        :duration="8"
      />
      <div class="mt-2 text-xs" :class="countTextClass">{{ syncProgressText }}</div>
      <div v-if="syncStatus?.progress" class="mt-1 text-xs" :class="countTextClass">
        有数据 {{ syncStatus.progress.codesWithData || 0 }} · 无数据 {{ syncStatus.progress.noDataCodes || 0 }} · 失败 {{ syncStatus.progress.failedCodes || 0 }}
      </div>
    </el-card>
    <div
      v-else-if="syncStatus?.finishedAt && !isSyncRunning"
      class="mb-3 text-xs flex items-center justify-between px-1"
      :class="countTextClass"
    >
      <span>同步结果已归档到操作日志</span>
      <el-button text size="small" @click="showSyncProgressCard = true">查看最近进度</el-button>
    </div>

    <el-card v-if="syncLogs.length" :class="['sq-list-card', marketCardClass]" shadow="never" class="mb-3">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold" :class="cardTitleClass">操作日志</span>
          <el-button text size="small" @click="syncLogs = []">清空</el-button>
        </div>
      </template>
      <div class="space-y-1 text-xs">
        <div v-for="log in syncLogs.slice(0, 8)" :key="log.id" class="flex items-center gap-2" :class="countTextClass">
          <span class="font-mono">[{{ log.time }}]</span>
          <span :class="log.level === 'error' ? 'text-red-500' : (log.level === 'warning' ? 'text-amber-500' : (log.level === 'success' ? 'text-emerald-500' : 'text-blue-500'))">
            {{ log.message }}
          </span>
        </div>
      </div>
    </el-card>

    <el-card :class="['sq-list-card', marketCardClass]" shadow="never">
      <el-table
        class="sq-list-table"
        :data="stocks"
        v-loading="loading"
        stripe
        style="width: 100%"
        :header-cell-style="tableHeaderStyle"
        :cell-style="tableCellStyle"
        @row-click="(row) => goDetail(row.code)"
        :row-class-name="rowClassName"
      >
        <el-table-column prop="code" label="代码" width="100">
          <template #default="{ row }">
            <span :class="codeTextClass">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" width="120" />
        <el-table-column prop="changePercent" label="涨跌幅" width="110">
          <template #default="{ row }">
            <span :class="upDownClass(row.changePercent)">
              {{ upDownSymbol(row.changePercent) }} {{ Number(row.changePercent || 0).toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="market" label="市场" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.market === 'SH' ? 'danger' : 'primary'" effect="plain">
              {{ row.market === 'SH' ? '沪' : '深' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="industry" label="行业" min-width="100">
          <template #default="{ row }">
            <el-tag
              v-if="row.industry"
              size="small"
              :type="industryTagType(row.industry)"
              :effect="isDark ? 'plain' : 'light'"
            >
              {{ row.industry }}
            </el-tag>
            <span v-else class="text-gray-300 dark:text-gray-700 text-xs">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button text size="small" type="primary" @click.stop="goDetail(row.code)">K线</el-button>
            <el-button text size="small" type="warning" @click.stop="$router.push('/vision')">AI分析</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex justify-between items-center mt-4">
        <span class="text-sm" :class="countTextClass">共 {{ total }} 只股票</span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          background
          small
        />
      </div>
    </el-card>

    <div v-if="total === 0 && !loading" class="text-center py-12">
      <p class="text-gray-600 dark:text-gray-400 mb-4">暂无股票数据，请先同步</p>
      <el-button type="primary" :loading="syncLoading" @click="syncData">同步 A 股列表</el-button>
    </div>
  </div>
</template>
