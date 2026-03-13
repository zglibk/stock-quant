<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import request from '@/api/request'
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
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
      <h2 class="sq-list-title whitespace-nowrap shrink-0">📊 行情中心</h2>
      <div class="flex flex-wrap gap-2">
        <el-select v-model="syncScope" style="width: 130px">
          <el-option v-for="opt in syncScopeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-input
          v-if="syncScope === 'custom'"
          v-model="customCodes"
          placeholder="输入代码，逗号或空格分隔"
          clearable
          style="width: 260px"
        />
        <el-input
          v-model="keyword"
          placeholder="搜索股票代码或名称"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-button @click="handleSearch">搜索</el-button>
        <el-button type="warning" :loading="syncLoading || isSyncRunning" @click="syncData">
          {{ isSyncRunning ? '同步中' : '同步数据' }}
        </el-button>
      </div>
    </div>
    <div v-if="syncScope === 'custom'" class="text-xs mb-2" :class="countTextClass">
      已识别 {{ customCodeCount }} 只股票代码
    </div>
    <el-alert
      v-if="syncStatus?.running || syncStatus?.error"
      :type="syncStatus?.running ? 'info' : 'error'"
      :title="syncStatus?.running
        ? 'K线同步进行中，请稍候...'
        : `最近一次同步失败：${syncStatus?.error || ''}`"
      show-icon
      :closable="false"
      class="mb-3"
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
        <el-table-column prop="industry" label="行业" min-width="120">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="industryTagType(row.industry)"
              :effect="isDark ? 'plain' : 'light'"
            >
              {{ row.industry || '未分类' }}
            </el-tag>
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
