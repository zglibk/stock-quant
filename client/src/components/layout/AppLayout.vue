<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useThemeStore } from '@/stores/themeStore'
import ThemeToggle from './ThemeToggle.vue'
import { Fold, Expand, Setting, Monitor, TrendCharts, SetUp, DataAnalysis, Search, Camera, Bell, Close, Cpu } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const themeStore = useThemeStore()

const isCollapsed = ref(false)
const showMobileMenu = ref(false)

const menuItems = [
  { path: '/dashboard', icon: Monitor,    label: '仪表盘' },
  { path: '/market',    icon: TrendCharts, label: '行情中心' },
  { path: '/strategy',  icon: SetUp,       label: '策略管理' },
  { path: '/backtest',  icon: DataAnalysis, label: '回测中心' },
  { path: '/screener',  icon: Search,      label: '选股筛选' },
  { path: '/vision',    icon: Camera,      label: '图片分析' },
  { path: '/signals',   icon: Bell,        label: '信号提醒' },
]

const systemMenuItems = [
  { path: '/ai-settings', icon: Cpu, label: '模型设置' }
]

// 动态菜单背景色
const menuBgColor = computed(() => themeStore.theme === 'dark' ? '#111827' : '#f9fafb')
const menuTextColor = computed(() => themeStore.theme === 'dark' ? '#94a3b8' : '#64748b')
const menuActiveTextColor = computed(() => '#3b82f6')
const currentMenuTitle = computed(() => {
  const flat = [...menuItems, ...systemMenuItems, { path: '/admin', label: '系统管理' }]
  return flat.find(i => i.path === route.path)?.label || '控制台'
})

function toggleSidebar() {
  if (window.innerWidth < 768) {
    showMobileMenu.value = !showMobileMenu.value
  } else {
    isCollapsed.value = !isCollapsed.value
  }
}

function handleLogout() {
  userStore.logout(true) // 传入 true 表示主动退出
  router.push('/login')
}
</script>

<template>
  <el-container class="h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
    <!-- PC 端侧边栏 -->
    <el-aside 
      :width="isCollapsed ? '64px' : '220px'" 
      class="hidden md:flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition-all duration-300"
    >
      <div class="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-800 shrink-0">
        <span v-if="!isCollapsed" class="text-lg font-bold bg-gradient-to-r from-blue-500 to-teal-400 bg-clip-text text-transparent">
          量化分析系统
        </span>
        <span v-else class="text-xl">📊</span>
      </div>
      
      <el-scrollbar>
        <el-menu
          :default-active="route.path"
          :collapse="isCollapsed"
          router
          :background-color="menuBgColor"
          :text-color="menuTextColor"
          :active-text-color="menuActiveTextColor"
          class="border-none !bg-transparent"
        >
          <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.label }}</template>
          </el-menu-item>

          <el-sub-menu index="/system-settings">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>系统设置</span>
            </template>
            <el-menu-item v-for="item in systemMenuItems" :key="item.path" :index="item.path">
              <el-icon><component :is="item.icon" /></el-icon>
              <template #title>{{ item.label }}</template>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item v-if="userStore.user?.role === 'admin'" index="/admin">
            <el-icon><Setting /></el-icon>
            <template #title>系统管理</template>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <!-- 移动端侧边栏抽屉 -->
    <el-drawer
      v-model="showMobileMenu"
      direction="ltr"
      size="240px"
      :with-header="false"
      class="md:hidden !bg-gray-50 dark:!bg-gray-900"
    >
      <div class="h-16 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 mb-2 px-3">
        <span class="text-base font-bold bg-gradient-to-r from-blue-500 to-teal-400 bg-clip-text text-transparent">
          量化分析系统
        </span>
        <button
          @click="showMobileMenu = false"
          class="w-9 h-9 rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
          aria-label="关闭侧边栏"
        >
          <el-icon size="16"><Close /></el-icon>
        </button>
      </div>
      <el-menu
        :default-active="route.path"
        router
        :background-color="menuBgColor"
        :text-color="menuTextColor"
        :active-text-color="menuActiveTextColor"
        class="border-none !bg-transparent"
        @select="showMobileMenu = false"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span class="ml-2">{{ item.label }}</span>
        </el-menu-item>
        <el-sub-menu index="/system-settings-mobile">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span class="ml-2">系统设置</span>
          </template>
          <el-menu-item v-for="item in systemMenuItems" :key="item.path" :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span class="ml-2">{{ item.label }}</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-drawer>

    <!-- 主内容区 -->
    <el-container class="h-full flex flex-col overflow-hidden">
      <!-- 顶栏 -->
      <el-header class="h-16 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 bg-white dark:bg-gray-900 shrink-0">
        <div class="flex items-center">
          <button 
            @click="toggleSidebar"
            class="p-2 mr-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <el-icon size="20"><Fold v-if="!isCollapsed && !showMobileMenu" /><Expand v-else /></el-icon>
          </button>
          <h2 class="md:hidden text-sm font-semibold text-gray-700 dark:text-gray-200">
            {{ currentMenuTitle }}
          </h2>
        </div>

        <div class="flex items-center gap-2 md:gap-4">
          <ThemeToggle />
          
          <div class="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
            <div class="hidden md:flex flex-col items-end">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                {{ userStore.user?.nickname || userStore.user?.username }}
              </span>
              <el-tag size="small" effect="plain" :type="userStore.user?.role === 'admin' ? 'danger' : 'info'" class="scale-90 origin-right">
                {{ userStore.user?.role }}
              </el-tag>
            </div>
            
            <el-dropdown trigger="click" @command="(cmd) => cmd === 'logout' && handleLogout()">
              <div class="flex items-center gap-2 cursor-pointer">
                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {{ (userStore.user?.username || 'U')[0].toUpperCase() }}
                </div>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item class="md:hidden" disabled>
                    {{ userStore.user?.username }}
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" class="text-red-500">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>

      <!-- 页面内容 (可滚动) -->
      <el-main class="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-950">
        <div class="max-w-7xl mx-auto w-full">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
