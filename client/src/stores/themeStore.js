import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // 'dark' | 'light' | 'system'
  const theme = ref(localStorage.getItem('sq_theme') || 'light')

  function setTheme(newTheme) {
    theme.value = newTheme
  }

  function toggleTheme() {
    if (theme.value === 'dark') {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  function applyTheme() {
    const root = document.documentElement
    const isDark = theme.value === 'dark' || 
      (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    
    localStorage.setItem('sq_theme', theme.value)
  }

  // 监听变化自动应用
  watch(theme, applyTheme, { immediate: true })

  return { theme, setTheme, toggleTheme }
})
