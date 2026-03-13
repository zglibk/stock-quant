<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import signalsApi from '@/api/signals'

const router = useRouter()
const loading = ref(false)
const unreadOnly = ref(false)
const signals = ref([])

const stats = computed(() => {
  const all = signals.value || []
  return {
    total: all.length,
    unread: all.filter(s => !s.isRead).length,
    buy: all.filter(s => s.type === 'buy').length,
    sell: all.filter(s => s.type === 'sell').length,
    hold: all.filter(s => s.type === 'hold').length,
  }
})

function formatDate(v) {
  if (!v) return '--'
  return new Date(v).toLocaleString('zh-CN', { hour12: false })
}

function typeText(v) {
  if (v === 'buy') return '买入'
  if (v === 'sell') return '卖出'
  return '观望'
}

function typeTag(v) {
  if (v === 'buy') return 'danger'
  if (v === 'sell') return 'success'
  return 'info'
}

function sourceText(v) {
  if (v === 'ai') return 'AI'
  if (v === 'strategy') return '策略'
  return '手动'
}

async function loadSignals() {
  loading.value = true
  try {
    const res = await signalsApi.list({ unreadOnly: unreadOnly.value })
    signals.value = res.data || []
  } catch (err) {
    ElMessage.error(err.message || '加载信号失败')
  } finally {
    loading.value = false
  }
}

async function markRead(row) {
  try {
    await signalsApi.markRead(row._id)
    row.isRead = true
    ElMessage.success('已标记已读')
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  }
}

async function markAllRead() {
  try {
    await signalsApi.markAllRead()
    signals.value = signals.value.map(s => ({ ...s, isRead: true }))
    ElMessage.success('已全部标记已读')
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  }
}

function goStock(code) {
  if (code) router.push(`/market/${code}`)
}

onMounted(loadSignals)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="sq-list-title">🔔 信号提醒</h2>
      <div class="flex items-center gap-3">
        <el-switch v-model="unreadOnly" active-text="仅未读" @change="loadSignals" />
        <el-button size="small" @click="loadSignals">刷新</el-button>
        <el-button size="small" @click="markAllRead" :disabled="stats.unread === 0">全部已读</el-button>
      </div>
    </div>

    <!-- 统计摘要 -->
    <div class="grid grid-cols-5 gap-3 mb-4">
      <el-card class="sq-list-card" shadow="never">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-400">{{ stats.total }}</div>
          <div class="text-xs text-gray-500">总信号</div>
        </div>
      </el-card>
      <el-card class="sq-list-card" shadow="never">
        <div class="text-center">
          <div class="text-2xl font-bold text-orange-400">{{ stats.unread }}</div>
          <div class="text-xs text-gray-500">未读</div>
        </div>
      </el-card>
      <el-card class="sq-list-card" shadow="never">
        <div class="text-center">
          <div class="text-2xl font-bold text-red-400">{{ stats.buy }}</div>
          <div class="text-xs text-gray-500">买入信号</div>
        </div>
      </el-card>
      <el-card class="sq-list-card" shadow="never">
        <div class="text-center">
          <div class="text-2xl font-bold text-green-400">{{ stats.sell }}</div>
          <div class="text-xs text-gray-500">卖出信号</div>
        </div>
      </el-card>
      <el-card class="sq-list-card" shadow="never">
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-400">{{ stats.hold }}</div>
          <div class="text-xs text-gray-500">观望</div>
        </div>
      </el-card>
    </div>

    <!-- 信号列表 -->
    <el-card v-loading="loading" class="sq-list-card">
      <el-table :data="signals" stripe class="sq-list-table" :row-class-name="(r) => r.row.isRead ? '' : 'font-semibold'">
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.isRead ? 'info' : 'warning'" effect="dark">
              {{ row.isRead ? '已读' : '未读' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标的" min-width="150">
          <template #default="{ row }">
            <span class="text-blue-400 font-mono cursor-pointer hover:underline" @click="goStock(row.code)">
              {{ row.code }}
            </span>
            <span class="ml-1 text-gray-400">{{ row.name || '' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="信号" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="typeTag(row.type)" effect="dark">{{ typeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="80">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ sourceText(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="80">
          <template #default="{ row }">
            <span v-if="row.score != null" class="font-mono" :class="row.score >= 70 ? 'text-red-400' : (row.score >= 40 ? 'text-orange-400' : 'text-gray-400')">
              {{ row.score }}
            </span>
            <span v-else class="text-gray-500">--</span>
          </template>
        </el-table-column>
        <el-table-column prop="reasoning" label="原因" min-width="280" show-overflow-tooltip />
        <el-table-column label="时间" width="170">
          <template #default="{ row }">
            <span class="text-xs text-gray-500">{{ formatDate(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button v-if="!row.isRead" link type="primary" size="small" @click="markRead(row)">已读</el-button>
            <el-button link type="info" size="small" @click="goStock(row.code)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!signals.length && !loading" class="text-center py-12 text-gray-500">
        <p class="text-lg mb-2">📭 暂无信号</p>
        <p class="text-sm">AI 分析或策略触发后会在此显示信号提醒</p>
      </div>
    </el-card>
  </div>
</template>
