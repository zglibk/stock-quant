<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import adminApi from '@/api/admin'

const loading = ref(false)
const stats = ref({})

const cards = [
  { key: 'usersTotal', label: '总用户数', icon: '👥' },
  { key: 'activeUsers', label: '活跃用户', icon: '✅' },
  { key: 'stocksTotal', label: '股票总数', icon: '📈' },
  { key: 'strategiesTotal', label: '策略总数', icon: '🧠' },
  { key: 'backtestsTotal', label: '回测记录', icon: '📊' },
  { key: 'unreadSignals', label: '未读信号', icon: '🔔' },
  { key: 'aiConversations', label: 'AI 对话', icon: '💬' },
  { key: 'visionAnalyses', label: '图片分析', icon: '🖼️' }
]

async function loadStats() {
  loading.value = true
  try {
    const res = await adminApi.stats()
    stats.value = res.data || {}
  } catch (err) {
    ElMessage.error(err.message || '加载系统统计失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="sq-list-title">系统管理</h2>
      <el-button @click="loadStats">刷新</el-button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" v-loading="loading">
      <el-card v-for="c in cards" :key="c.key" shadow="hover">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-600 dark:text-gray-400">{{ c.label }}</div>
            <div class="text-2xl font-bold mt-1">{{ stats[c.key] ?? 0 }}</div>
          </div>
          <div class="text-2xl">{{ c.icon }}</div>
        </div>
      </el-card>
    </div>
  </div>
</template>
