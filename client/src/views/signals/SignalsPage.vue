<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import signalsApi from '@/api/signals'

const loading = ref(false)
const unreadOnly = ref(false)
const signals = ref([])

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

onMounted(loadSignals)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="sq-list-title">信号提醒</h2>
      <div class="flex items-center gap-2">
        <el-switch v-model="unreadOnly" active-text="仅未读" @change="loadSignals" />
        <el-button @click="markAllRead">全部已读</el-button>
      </div>
    </div>
    <el-card v-loading="loading" class="sq-list-card">
      <el-table :data="signals" stripe class="sq-list-table">
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.isRead ? 'info' : 'warning'">{{ row.isRead ? '已读' : '未读' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标的" min-width="140">
          <template #default="{ row }">{{ row.code }} {{ row.name || '' }}</template>
        </el-table-column>
        <el-table-column label="信号" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="typeTag(row.type)">{{ typeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="90">
          <template #default="{ row }">{{ row.score ?? '--' }}</template>
        </el-table-column>
        <el-table-column prop="reasoning" label="原因" min-width="260" show-overflow-tooltip />
        <el-table-column label="时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button v-if="!row.isRead" link type="primary" @click="markRead(row)">标记已读</el-button>
            <span v-else class="text-gray-400 dark:text-gray-500 text-xs">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
