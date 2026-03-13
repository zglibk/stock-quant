import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref(JSON.parse(localStorage.getItem('sq_user') || 'null'))
  const accessToken = ref(localStorage.getItem('sq_token') || '')
  const refreshToken = ref(localStorage.getItem('sq_refresh') || '')
  
  // 登录模态框控制
  const showLoginModal = ref(false)
  const openLogin = () => showLoginModal.value = true
  const closeLogin = () => showLoginModal.value = false

  // 标记是否为用户主动退出，用于防止 request.js 弹出"登录过期"提示
  const isUserInitiatedLogout = ref(false)

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value)

  async function login(username, password) {
    const { data } = await api.login(username, password)
    setAuth(data)
    return data
  }

  async function register(username, password, nickname) {
    const { data } = await api.register(username, password, nickname)
    setAuth(data)
    return data
  }

  async function refreshProfile() {
    const { data } = await api.getProfile()
    user.value = data
    localStorage.setItem('sq_user', JSON.stringify(data))
    return data
  }

  async function updateProfile(payload) {
    const { data } = await api.updateProfile(payload)
    user.value = data
    localStorage.setItem('sq_user', JSON.stringify(data))
    return data
  }

  function setAuth(data) {
    user.value = data.user
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    localStorage.setItem('sq_user', JSON.stringify(data.user))
    localStorage.setItem('sq_token', data.accessToken)
    localStorage.setItem('sq_refresh', data.refreshToken)
  }

  function logout(userInitiated = false) {
    if (userInitiated) {
      isUserInitiatedLogout.value = true
      // 2秒后重置，防止永久屏蔽
      setTimeout(() => {
        isUserInitiatedLogout.value = false
      }, 2000)
    }
    user.value = null
    accessToken.value = ''
    refreshToken.value = ''
    localStorage.removeItem('sq_user')
    localStorage.removeItem('sq_token')
    localStorage.removeItem('sq_refresh')
  }

  return { 
    user, accessToken, refreshToken, isLoggedIn, 
    showLoginModal, openLogin, closeLogin, isUserInitiatedLogout,
    login, register, logout, setAuth, refreshProfile, updateProfile 
  }
})
