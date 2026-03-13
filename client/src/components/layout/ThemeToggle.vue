<script setup>
import { useThemeStore } from '@/stores/themeStore'
import { Moon, Sunny } from '@element-plus/icons-vue'

const themeStore = useThemeStore()
</script>

<template>
  <button 
    @click="themeStore.toggleTheme()"
    class="p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
    title="切换主题"
  >
    <el-icon v-if="themeStore.theme === 'dark'" :size="20"><Moon /></el-icon>
    <el-icon v-else :size="20"><Sunny /></el-icon>
  </button>
</template>
