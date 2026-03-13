<script setup>
import { onMounted, ref } from 'vue'

// 生成随机的电路路径
const paths = ref([])
const particles = ref([])

onMounted(() => {
  // 生成一些随机的电路板线条
  for (let i = 0; i < 15; i++) {
    const startX = Math.random() * 100
    const startY = Math.random() * 100
    const length = 10 + Math.random() * 20
    const isHorizontal = Math.random() > 0.5
    
    let d = `M ${startX} ${startY}`
    if (isHorizontal) {
      d += ` h ${length}`
      if (Math.random() > 0.5) d += ` v ${Math.random() * 10 - 5}`
    } else {
      d += ` v ${length}`
      if (Math.random() > 0.5) d += ` h ${Math.random() * 10 - 5}`
    }
    
    paths.value.push({
      d,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 5
    })
  }

  // 生成浮动粒子
  for (let i = 0; i < 20; i++) {
    particles.value.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: 10 + Math.random() * 20,
      delay: Math.random() * 5
    })
  }
})
</script>

<template>
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <!-- 基础网格背景 -->
    <svg class="w-full h-full opacity-[0.03] dark:opacity-[0.05]" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" class="fill-current text-blue-500" />
        </pattern>
        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#smallGrid)" />
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" stroke-width="0.5" class="text-blue-500" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>

    <!-- 动态电路图元素 -->
    <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g class="stroke-blue-500/20 dark:stroke-blue-400/30" stroke-width="0.2" fill="none">
        <path v-for="(path, index) in paths" :key="index" :d="path.d" class="circuit-path" 
              :style="{ animationDelay: `-${path.delay}s`, animationDuration: `${path.duration}s` }" />
      </g>
      
      <!-- 数据流光点 -->
      <g class="fill-blue-400/40 dark:fill-blue-300/50">
        <circle v-for="(p, index) in particles" :key="`p-${index}`" :cx="p.x" :cy="p.y" :r="0.3" 
                class="animate-float"
                :style="{ animationDelay: `-${p.delay}s`, animationDuration: `${p.duration}s` }" />
      </g>
    </svg>

    <!-- 装饰性圆环 -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-blue-500/5 rounded-full animate-[spin_60s_linear_infinite]"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-purple-500/5 rounded-full animate-[spin_40s_linear_infinite_reverse]"></div>
  </div>
</template>

<style scoped>
.circuit-path {
  stroke-dasharray: 10;
  stroke-dashoffset: 10;
  animation: draw-circuit linear infinite;
}

@keyframes draw-circuit {
  0% {
    stroke-dashoffset: 10;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: -10;
    opacity: 0;
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0); opacity: 0.3; }
  50% { transform: translateY(-10px); opacity: 0.8; }
}

.animate-float {
  animation: float ease-in-out infinite;
}
</style>