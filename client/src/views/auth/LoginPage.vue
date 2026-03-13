<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useThemeStore } from '@/stores/themeStore'
import { ElMessage } from 'element-plus'
import { User, Lock, Message } from '@element-plus/icons-vue'
import TechBackground from '@/components/TechBackground.vue'
import AiRobot from '@/components/AiRobot.vue'
import LoginSlogan from '@/components/LoginSlogan.vue'

const router = useRouter()
const userStore = useUserStore()
const themeStore = useThemeStore()
const isRegister = ref(false)
const loading = ref(false)
const form = ref({ username: '', password: '', confirmPassword: '', nickname: '' })
const rememberMe = ref(false)
const layoutRef = ref(null)
const sloganRef = ref(null)
const loginCardRef = ref(null)
const pcRobotStyle = ref({})
let layoutResizeObserver = null

function updatePcRobotPosition() {
  if (window.innerWidth < 1024) return
  if (!layoutRef.value || !loginCardRef.value || !sloganRef.value) return
  const layoutRect = layoutRef.value.getBoundingClientRect()
  const sloganRect = sloganRef.value.getBoundingClientRect()
  const cardRect = loginCardRef.value.getBoundingClientRect()
  const leftBound = sloganRect.right - layoutRect.left
  const rightBound = cardRect.left - layoutRect.left
  const robotSize = Math.max(220, Math.min(280, layoutRect.width * 0.16))
  const gapFromCard = 32
  const gapFromSlogan = 12
  const availableLeft = leftBound + gapFromSlogan
  const availableRight = rightBound - gapFromCard - robotSize
  const preferredLeft = leftBound + (rightBound - leftBound) * 0.24
  const left = Math.max(0, Math.min(layoutRect.width - robotSize, Math.min(availableRight, Math.max(availableLeft, preferredLeft))))
  const top = Math.max(8, sloganRect.top - layoutRect.top - 24)
  pcRobotStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${robotSize}px`,
    height: `${robotSize}px`
  }
}

onMounted(async () => {
  themeStore.setTheme('light')
  const savedUser = localStorage.getItem('remember_user')
  if (savedUser) {
    const { username, password } = JSON.parse(savedUser)
    form.value.username = username
    form.value.password = password
    rememberMe.value = true
  }
  await nextTick()
  updatePcRobotPosition()
  window.addEventListener('resize', updatePcRobotPosition)
  if (window.ResizeObserver) {
    layoutResizeObserver = new ResizeObserver(updatePcRobotPosition)
    if (layoutRef.value) layoutResizeObserver.observe(layoutRef.value)
    if (sloganRef.value) layoutResizeObserver.observe(sloganRef.value)
    if (loginCardRef.value) layoutResizeObserver.observe(loginCardRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePcRobotPosition)
  if (layoutResizeObserver) {
    layoutResizeObserver.disconnect()
    layoutResizeObserver = null
  }
})

const formRef = ref(null)

const validatePass2 = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== form.value.password) {
    callback(new Error('两次输入密码不一致!'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '长度在 6 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validatePass2, trigger: 'blur' }
  ]
}

async function handleSubmit() {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    loading.value = true
    
    if (isRegister.value) {
      await userStore.register(form.value.username, form.value.password, form.value.nickname)
      ElMessage.success('注册成功')
    } else {
      await userStore.login(form.value.username, form.value.password)
      ElMessage.success('登录成功')
      
      if (rememberMe.value) {
        localStorage.setItem('remember_user', JSON.stringify({
          username: form.value.username,
          password: form.value.password
        }))
      } else {
        localStorage.removeItem('remember_user')
      }
    }
    router.push('/dashboard')
  } catch (err) {
    if (err.message) {
      ElMessage.error(err.message || '操作失败')
    }
  } finally {
    loading.value = false
  }
}

function handleForgotPassword() {
  ElMessage.info('请联系管理员重置密码')
}
</script>

<template>
  <div class="login-page min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#050505] transition-colors duration-300 relative overflow-hidden">
    
    <!-- SVG 科技背景 -->
    <TechBackground />
    
    <!-- 背景动态光斑 (叠加在 TechBackground 上，但透明度降低，作为氛围光) -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-blob mix-blend-multiply filter dark:mix-blend-normal dark:bg-blue-500/10"></div>
      <div class="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-blob animation-delay-2000 mix-blend-multiply filter dark:mix-blend-normal dark:bg-purple-500/10"></div>
      <div class="absolute -bottom-32 left-1/3 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-blob animation-delay-4000 mix-blend-multiply filter dark:mix-blend-normal dark:bg-teal-500/10"></div>
    </div>

    <div class="lg:hidden absolute top-16 right-4 w-[90px] h-[90px] z-[120] opacity-90 pointer-events-auto">
      <AiRobot />
    </div>

    <!-- 登录框容器 -->
    <div ref="layoutRef" class="relative w-full flex justify-center lg:justify-between items-center z-30 px-4 md:px-6 lg:px-[5%] xl:px-[4%] 2xl:px-[3%] max-w-[1700px] mx-auto">
      <div class="hidden lg:block absolute z-[140] pointer-events-auto" :style="pcRobotStyle">
        <AiRobot />
      </div>
      
      <!-- 左侧 Slogan (仅 PC 显示) -->
      <div ref="sloganRef" class="hidden lg:flex lg:flex-1 lg:justify-center relative z-30">
        <div class="relative w-fit">
          <LoginSlogan />
        </div>
      </div>

      <!-- 右侧 登录框 -->
      <div ref="loginCardRef" class="w-full max-w-[420px] lg:ml-auto rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.15)] dark:shadow-[0_0_40px_rgba(6,182,212,0.2)] bg-white/80 dark:bg-[#141414]/90 backdrop-blur-sm">
        <div class="rounded-2xl overflow-hidden p-[2.5px] relative">
          <!-- 旋转光影 -->
          <div class="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_310deg,#06b6d4_330deg,#8b5cf6_345deg,#06b6d4_360deg)] animate-[spin_6s_linear_infinite] opacity-80 blur-md"></div>
          
          <div class="relative flex flex-col justify-center p-10 min-h-[500px] bg-white dark:bg-[#141414] rounded-xl shadow-2xl transition-all duration-300">
            <h1 class="text-2xl font-bold text-center mb-2 -mt-6 bg-gradient-to-r from-blue-500 via-purple-500 to-teal-400 bg-clip-text text-transparent animate-text-gradient bg-300%">
              {{ isRegister ? '账户注册' : '欢迎登录' }}
            </h1>
            <p class="text-center text-gray-500 dark:text-gray-400 text-sm mb-8">AI 量化分析系统</p>

            <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleSubmit" size="large">
              <el-form-item prop="username">
                <el-input 
                  v-model="form.username" 
                  placeholder="用户名" 
                  :prefix-icon="User"
                  class="custom-input duration-300"
                />
              </el-form-item>
              <el-form-item v-if="isRegister" prop="nickname">
                <el-input 
                  v-model="form.nickname" 
                  placeholder="昵称 (可选)" 
                  :prefix-icon="Message"
                  class="custom-input duration-300"
                />
              </el-form-item>
              <el-form-item prop="password">
                <el-input 
                  v-model="form.password" 
                  placeholder="密码" 
                  :prefix-icon="Lock"
                  show-password 
                  @keyup.enter="handleSubmit" 
                  class="custom-input duration-300"
                />
              </el-form-item>
              <el-form-item v-if="isRegister" prop="confirmPassword">
                <el-input 
                  v-model="form.confirmPassword" 
                  placeholder="确认密码" 
                  :prefix-icon="Lock"
                  show-password 
                  class="custom-input duration-300"
                />
              </el-form-item>
              
              <div v-if="!isRegister" class="flex justify-between items-center mb-6 px-1">
                <el-checkbox v-model="rememberMe">记住密码</el-checkbox>
                <el-link type="primary" :underline="false" @click="handleForgotPassword" class="hover:text-blue-400 transition-colors">忘记密码？</el-link>
              </div>

              <el-button 
                type="primary" 
                :loading="loading" 
                @click="handleSubmit" 
                class="w-full font-bold group/btn mt-8" 
                size="large"
              >
                {{ isRegister ? '注 册' : '登 录' }}
              </el-button>
            </el-form>

            <div class="flex justify-end mt-4 text-sm">
              <span class="text-gray-500 dark:text-gray-400">
                {{ isRegister ? '已有账户？' : '没有账户？' }}
              </span>
              <span 
                @click="isRegister = !isRegister" 
                class="ml-1 cursor-pointer text-blue-500 hover:text-blue-400 transition-colors font-medium"
              >
                {{ isRegister ? '去登录 >' : '去注册 >' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 适配 Element Plus 输入框的深色模式 */
:deep(.el-input__wrapper) {
  background-color: #ffffff;
  box-shadow: 0 0 0 1px #d1d5db inset;
  transition: all 0.3s ease;
}

/* 输入框 Focus 效果 */
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3b82f6 inset, 0 0 8px rgba(59, 130, 246, 0.5) !important;
}

/* 动画定义 */
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}

@keyframes gradient-xy {
  0%, 100% {
    background-size: 400% 400%;
    background-position: 0% 0%;
  }
  50% {
    background-size: 200% 200%;
    background-position: 100% 100%;
  }
}
.animate-gradient-xy {
  animation: gradient-xy 6s ease infinite;
}

@keyframes text-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.animate-text-gradient {
  background-size: 300% auto;
  animation: text-gradient 5s ease infinite;
}
.bg-300\% {
  background-size: 300% auto;
}
</style>

<style>
/* 全局覆盖深色模式下的输入框样式 */
html.dark .login-page .el-input__wrapper {
  background-color: #1f1f1f !important;
  box-shadow: 0 0 0 1px #333333 inset !important;
}
html.dark .login-page .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px #3b82f6 inset, 0 0 8px rgba(59, 130, 246, 0.5) !important;
}
</style>
