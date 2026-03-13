import axios from 'axios'
import { useUserStore } from '@/stores/userStore'
import { ElMessageBox } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

// 请求拦截器 - 注入 Token
request.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (userStore.accessToken) {
    config.headers.Authorization = `Bearer ${userStore.accessToken}`
  }
  return config
})

// 响应拦截器 - Token 过期自动刷新
request.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const userStore = useUserStore()
    // 如果是用户主动退出，不进行后续处理（避免弹出"登录过期"提示）
    if (userStore.isUserInitiatedLogout) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED') {
      if (!userStore.refreshToken) {
        userStore.logout()
        handleLoginExpired(userStore)
        return Promise.reject(error.response?.data || error)
      }
      try {
        const { data } = await axios.post('/api/auth/refresh', {
          refreshToken: userStore.refreshToken
        }, {
          timeout: 10000
        })
        userStore.setAuth({ user: userStore.user, ...data.data })
        error.config.headers.Authorization = `Bearer ${data.data.accessToken}`
        return request(error.config)
      } catch (refreshError) {
        userStore.logout()
        handleLoginExpired(userStore)
        return Promise.reject(refreshError.response?.data || refreshError)
      }
    } else if (error.response?.status === 401) {
      userStore.logout()
      handleLoginExpired(userStore)
    }
    return Promise.reject(error.response?.data || error)
  }
)

let isShowingLogout = false
function handleLoginExpired(userStore) {
  if (isShowingLogout) return
  isShowingLogout = true
  
  ElMessageBox.confirm('登录状态已过期，请重新登录', '系统提示', {
    confirmButtonText: '确定',
    showCancelButton: false,
    type: 'warning'
  }).then(() => {
    isShowingLogout = false
    userStore.openLogin()
  })
}

export default request
