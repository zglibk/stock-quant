<script setup>
import { useUserStore } from '@/stores/userStore'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoginModal from '@/components/LoginModal.vue'

const userStore = useUserStore()
</script>

<template>
  <AppLayout v-if="userStore.isLoggedIn" />
  <router-view v-else />
  
  <LoginModal />
</template>
