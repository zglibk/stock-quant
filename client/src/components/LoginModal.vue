<script setup>
import { ref, reactive } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

async function handleLogin() {
  if (!form.username || !form.password) {
    return ElMessage.warning('请填写用户名和密码')
  }
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    userStore.closeLogin()
  } catch (err) {
    ElMessage.error(err.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="userStore.showLoginModal"
    title="请重新登录"
    width="340px"
    :close-on-click-modal="false"
    :show-close="true"
    append-to-body
    center
    class="custom-login-modal"
  >
      <div class="relative rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.15)] dark:shadow-[0_0_30px_rgba(6,182,212,0.2)]">
       <div class="relative rounded-lg overflow-hidden p-[2px]">
        <div class="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_310deg,#06b6d4_330deg,#8b5cf6_345deg,#06b6d4_360deg)] animate-[spin_6s_linear_infinite] opacity-80 blur-md"></div>
        <div class="relative bg-white dark:bg-[#141414] rounded-lg p-2">
          <el-form @submit.prevent="handleLogin" label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input 
            v-model="form.password" 
            type="password" 
            placeholder="请输入密码" 
            size="large" 
            show-password 
            @keyup.enter="handleLogin" 
          />
        </el-form-item>
        <el-button 
          type="primary" 
          :loading="loading" 
          @click="handleLogin" 
          class="w-full mt-4 bg-teal-600 hover:bg-teal-500 border-none" 
          size="large"
        >
          立即登录
        </el-button>
      </el-form>
    </div>
    </div>
    </div>
  </el-dialog>
</template>

<style scoped>
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

:deep(.custom-login-modal) {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
:deep(.el-dialog__title) {
  color: #0f172a;
}
:deep(.el-form-item__label) {
  color: #64748b;
}
:deep(.el-input__wrapper) {
  background-color: #ffffff;
  box-shadow: 0 0 0 1px #e5e7eb inset;
}
:global(.dark) :deep(.custom-login-modal) {
  background-color: #141414;
  border: 1px solid #262626;
}
:global(.dark) :deep(.el-dialog__title) {
  color: #ffffff;
}
:global(.dark) :deep(.el-form-item__label) {
  color: #9ca3af;
}
:global(.dark) :deep(.el-input__wrapper) {
  background-color: #1f1f1f !important;
  box-shadow: 0 0 0 1px #333333 inset !important;
}
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3b82f6 inset, 0 0 8px rgba(59, 130, 246, 0.5) !important;
}
:global(.dark) :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3b82f6 inset, 0 0 8px rgba(59, 130, 246, 0.5) !important;
}
</style>
