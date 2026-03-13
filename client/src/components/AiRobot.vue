<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const containerRef = ref(null)
const isDragging = ref(false)
const isHover = ref(false)
const isPressed = ref(false)
const isActive = ref(false)
const showSpeech = ref(false)
const speechText = ref('')
const speechAlign = ref('right')
let startX = 0
let startY = 0
let initialX = 0
let initialY = 0
let currentX = 0
let currentY = 0
let activeTimer = null
let speechTimer = null
const uid = Math.random().toString(36).slice(2, 10)
const metalGradientId = `metal-gradient-${uid}`
const darkMetalGradientId = `dark-metal-gradient-${uid}`
const eyeGlowId = `eye-glow-${uid}`
const coreGlowId = `core-glow-${uid}`
const orbitGradientId = `orbit-gradient-${uid}`
const orbitPathId = `orbitPath-${uid}`
const tapPhrases = ['你好呀', '已收到', '一起分析吧', '今天也要加油', '准备就绪']
const hoverPhrases = ['嗨～', '点我互动', '我在这里', '有问题尽管问']

const updateSpeechAlign = () => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const safeWidth = 190
  const canExpandRight = window.innerWidth - rect.right >= safeWidth
  const canExpandLeft = rect.left >= safeWidth
  if (!canExpandRight && canExpandLeft) {
    speechAlign.value = 'left'
    return
  }
  if (!canExpandLeft && canExpandRight) {
    speechAlign.value = 'right'
    return
  }
  speechAlign.value = rect.left < window.innerWidth * 0.52 ? 'right' : 'left'
}

const speak = (text, duration = 1800) => {
  updateSpeechAlign()
  speechText.value = text
  showSpeech.value = true
  if (speechTimer) clearTimeout(speechTimer)
  speechTimer = setTimeout(() => {
    showSpeech.value = false
    speechTimer = null
  }, duration)
}

const speakRandom = (type = 'tap') => {
  const pool = type === 'hover' ? hoverPhrases : tapPhrases
  const text = pool[Math.floor(Math.random() * pool.length)]
  speak(text, type === 'hover' ? 1300 : 1800)
}

const activateEffect = () => {
  isActive.value = false
  speakRandom('tap')
  if (activeTimer) clearTimeout(activeTimer)
  requestAnimationFrame(() => {
    isActive.value = true
    activeTimer = setTimeout(() => {
      isActive.value = false
      activeTimer = null
    }, 320)
  })
}

const handleStart = (e) => {
  // 阻止默认拖拽行为（避免拖拽图片/SVG ghost）
  if (e.type === 'mousedown') e.preventDefault()
  
  isDragging.value = true
  isPressed.value = true
  activateEffect()
  const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX
  const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY
  startX = clientX
  startY = clientY
  
  // 记录当前的偏移量作为起始点
  initialX = currentX
  initialY = currentY
  
  // 改变鼠标样式
  if (containerRef.value) {
    containerRef.value.style.cursor = 'grabbing'
  }
}

const handleMove = (e) => {
  if (!isDragging.value) return
  
  // 阻止触摸移动时的默认滚动行为
  if (e.type === 'touchmove') {
    e.preventDefault()
  }
  
  const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX
  const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY
  
  const dx = clientX - startX
  const dy = clientY - startY
  
  currentX = initialX + dx
  currentY = initialY + dy
  
  if (containerRef.value) {
    containerRef.value.style.transform = `translate(${currentX}px, ${currentY}px)`
  }
  updateSpeechAlign()
}

const handleEnd = () => {
  isDragging.value = false
  isPressed.value = false
  if (containerRef.value) {
    containerRef.value.style.cursor = 'grab'
  }
}

const handleEnter = () => {
  isHover.value = true
  if (!showSpeech.value) speakRandom('hover')
}

const handleLeave = () => {
  isHover.value = false
}

const handleActivate = () => {
  activateEffect()
}

onMounted(() => {
  updateSpeechAlign()
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleEnd)
  window.addEventListener('touchmove', handleMove, { passive: false })
  window.addEventListener('touchend', handleEnd)
  window.addEventListener('resize', updateSpeechAlign)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleEnd)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleEnd)
  window.removeEventListener('resize', updateSpeechAlign)
  if (activeTimer) {
    clearTimeout(activeTimer)
    activeTimer = null
  }
  if (speechTimer) {
    clearTimeout(speechTimer)
    speechTimer = null
  }
})
</script>

<template>
  <div 
    ref="containerRef"
    class="ai-robot-container w-full h-full cursor-grab touch-none select-none pointer-events-auto will-change-transform"
    :class="{ 'is-hover': isHover, 'is-pressed': isPressed, 'is-active': isActive }"
    @mousedown="handleStart"
    @touchstart="handleStart"
    @mouseenter="handleEnter"
    @mouseleave="handleLeave"
    @click="handleActivate"
    @dragstart.prevent
  >
    <div class="robot-halo"></div>
    <div v-show="showSpeech" :class="['robot-speech', speechAlign === 'left' ? 'speech-left' : 'speech-right']">{{ speechText }}</div>
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" class="w-full h-full filter drop-shadow-2xl overflow-visible pointer-events-none">
      <defs>
        <!-- 金属渐变 -->
          <linearGradient :id="metalGradientId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f0f9ff" />
          <stop offset="50%" stop-color="#cbe4f7" />
          <stop offset="100%" stop-color="#93c5fd" />
        </linearGradient>
        
        <!-- 深色金属渐变 -->
          <linearGradient :id="darkMetalGradientId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>

        <!-- 眼睛发光渐变 -->
        <radialGradient :id="eyeGlowId" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#67e8f9" stop-opacity="1" />
          <stop offset="80%" stop-color="#06b6d4" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#06b6d4" stop-opacity="0" />
        </radialGradient>

        <!-- 核心能量渐变 -->
        <radialGradient :id="coreGlowId" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#a855f7" />
          <stop offset="100%" stop-color="#3b82f6" />
        </radialGradient>
        <linearGradient :id="orbitGradientId" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.1" />
          <stop offset="50%" stop-color="#3b82f6" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.1" />
        </linearGradient>
      </defs>

      <!-- 悬浮动画组 -->
      <g class="animate-robot-float robot-stage" transform="scale(0.8) translate(40, 40)">
        <!-- 身体部分 -->
        <g transform="translate(100, 150)">
          <g class="robot-torso">
            <!-- 躯干 -->
            <path d="M 40 20 Q 100 0 160 20 L 170 120 Q 100 140 30 120 Z" :fill="`url(#${metalGradientId})`" stroke="#60a5fa" stroke-width="2" />
            <!-- 核心能量反应堆 -->
            <circle cx="100" cy="70" r="25" fill="#1e293b" stroke="#3b82f6" stroke-width="2" />
            <circle cx="100" cy="70" r="18" :fill="`url(#${coreGlowId})`" class="animate-pulse-slow" />
            
            <!-- 手臂连接处 -->
            <circle cx="20" cy="40" r="15" :fill="`url(#${darkMetalGradientId})`" />
            <circle cx="180" cy="40" r="15" :fill="`url(#${darkMetalGradientId})`" />
          </g>
        </g>

        <!-- 头部部分 (包含摇头动画) -->
        <g class="animate-head-bob" transform-origin="200 140">
          <g transform="translate(100, 40)">
            <!-- 天线 -->
            <line x1="100" y1="0" x2="100" y2="-30" stroke="#94a3b8" stroke-width="4" />
            <circle cx="100" cy="-35" r="8" fill="#ef4444" class="animate-ping-slow" />
            <circle cx="100" cy="-35" r="5" fill="#ef4444" />

            <!-- 头盔主体 -->
            <rect x="20" y="0" width="160" height="110" rx="45" ry="45" :fill="`url(#${metalGradientId})`" stroke="#60a5fa" stroke-width="2" />
            
            <!-- 面部屏幕 -->
            <rect x="35" y="25" width="130" height="70" rx="30" ry="30" fill="#0f172a" stroke="#334155" stroke-width="2" />
            
            <!-- 眼睛 -->
            <g class="eyes">
              <!-- 左眼 -->
              <ellipse cx="75" cy="60" rx="18" ry="22" :fill="`url(#${eyeGlowId})`" class="animate-blink" />
              <!-- 右眼 -->
              <ellipse cx="125" cy="60" rx="18" ry="22" :fill="`url(#${eyeGlowId})`" class="animate-blink" />
            </g>

            <!-- 嘴巴/语音波纹 -->
            <g transform="translate(100, 85)" class="opacity-50">
              <rect x="-20" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-1" />
              <rect x="-10" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-2" />
              <rect x="0" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-3" />
              <rect x="10" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-2" />
              <rect x="20" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-1" />
            </g>
          </g>
        </g>

        <!-- 左手 -->
        <g transform="translate(120, 190)">
          <g :class="['robot-arm-left', { 'robot-arm-left-burst': isActive || isPressed }]">
            <path d="M 0 0 Q -30 40 -10 70" :stroke="`url(#${metalGradientId})`" stroke-width="15" fill="none" stroke-linecap="round" />
            <circle cx="-10" cy="75" r="12" :fill="`url(#${darkMetalGradientId})`" />
          </g>
        </g>

        <!-- 右手 (挥手动画) -->
        <g transform="translate(280, 190)">
          <g :class="['robot-arm-right', { 'robot-arm-right-burst': isActive || isPressed }]">
            <g class="animate-wave-hand" style="transform-origin: 0px 0px">
              <path d="M 0 0 Q 30 40 10 70" :stroke="`url(#${metalGradientId})`" stroke-width="15" fill="none" stroke-linecap="round" />
              <circle cx="10" cy="75" r="12" :fill="`url(#${darkMetalGradientId})`" />
            </g>
          </g>
        </g>
      </g>
      
      <!-- 底部阴影 -->
      <ellipse cx="200" cy="350" rx="60" ry="10" fill="#000" opacity="0.2" class="animate-shadow-scale" />
    </svg>
  </div>
</template>

<style scoped>
.ai-robot-container {
  position: relative;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.robot-halo {
  position: absolute;
  inset: 16%;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.08) 45%, rgba(59, 130, 246, 0) 75%);
  opacity: 0;
  transform: scale(0.88);
  transition: opacity 0.22s ease, transform 0.22s ease;
  pointer-events: none;
}

.robot-speech {
  position: absolute;
  top: 8%;
  transform: translateY(-100%);
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 12px;
  line-height: 1;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(59, 130, 246, 0.35);
  box-shadow: 0 6px 20px rgba(14, 165, 233, 0.2);
  backdrop-filter: blur(6px);
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  animation: speech-pop 0.24s ease;
}

.speech-right {
  left: 60%;
}

.speech-left {
  right: 60%;
}

.robot-speech::after {
  content: '';
  position: absolute;
  bottom: -6px;
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.9);
  border-right: 1px solid rgba(59, 130, 246, 0.35);
  border-bottom: 1px solid rgba(59, 130, 246, 0.35);
  transform: rotate(45deg);
}

.speech-right::after {
  left: 16%;
}

.speech-left::after {
  right: 16%;
}

.robot-stage {
  transform-origin: 200px 220px;
}

.robot-torso {
  transform-origin: 100px 80px;
  animation: torso-twist 3.4s ease-in-out infinite;
}

.robot-arm-left {
  transform-origin: 20px 20px;
  animation: arm-sway-left 2.8s ease-in-out infinite;
}

.robot-arm-right {
  transform-origin: 0px 20px;
  animation: arm-sway-right 2.8s ease-in-out infinite;
}

.robot-arm-left-burst {
  animation: arm-wave-burst-left 0.55s ease-in-out 2 !important;
}

.robot-arm-right-burst {
  animation: arm-wave-burst-right 0.55s ease-in-out 2 !important;
}

.ai-robot-container.is-hover {
  filter: drop-shadow(0 10px 18px rgba(14, 165, 233, 0.28));
}

.ai-robot-container.is-hover .robot-halo {
  opacity: 1;
  transform: scale(1);
}

.ai-robot-container.is-pressed {
  transform: scale(0.96);
}

.ai-robot-container.is-active .robot-halo {
  opacity: 1;
  transform: scale(1.18);
}

.ai-robot-container.is-hover .robot-torso,
.ai-robot-container.is-active .robot-torso {
  animation-duration: 1.6s;
}

.ai-robot-container.is-hover .robot-arm-left,
.ai-robot-container.is-hover .robot-arm-right,
.ai-robot-container.is-active .robot-arm-left,
.ai-robot-container.is-active .robot-arm-right {
  animation-duration: 1.3s;
}

.animate-robot-float {
  animation: robot-float 4s ease-in-out infinite;
}

.animate-head-bob {
  animation: head-bob 5s ease-in-out infinite;
}

.animate-blink {
  animation: blink 4s infinite;
}

.animate-ping-slow {
  animation: ping 3s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-wave-hand {
  animation: wave-hand 3s ease-in-out infinite;
}

.animate-shadow-scale {
  animation: shadow-scale 4s ease-in-out infinite;
}

@keyframes robot-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

@keyframes torso-twist {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(2deg); }
  50% { transform: rotate(0deg); }
  75% { transform: rotate(-2deg); }
}

@keyframes arm-sway-left {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-6deg) translateY(-1px); }
}

@keyframes arm-sway-right {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(6deg) translateY(-1px); }
}

@keyframes arm-wave-burst-left {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(-20deg) translateY(-2px); }
  50% { transform: rotate(8deg); }
  75% { transform: rotate(-14deg); }
  100% { transform: rotate(0deg); }
}

@keyframes arm-wave-burst-right {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(20deg) translateY(-2px); }
  50% { transform: rotate(-8deg); }
  75% { transform: rotate(14deg); }
  100% { transform: rotate(0deg); }
}

@keyframes head-bob {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(2deg); }
  75% { transform: rotate(-2deg); }
}

@keyframes blink {
  0%, 48%, 52%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.1); }
}

@keyframes wave-hand {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-10deg) translateY(-5px); }
}

@keyframes shadow-scale {
  0%, 100% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(0.8); opacity: 0.1; }
}

@keyframes wave-bar {
  0%, 100% { height: 4px; transform: translateY(0); }
  50% { height: 12px; transform: translateY(-4px); }
}

@keyframes speech-pop {
  0% { opacity: 0; transform: translate(-50%, -2px) scale(0.92); }
  100% { opacity: 1; transform: translate(-50%, -8px) scale(1); }
}

.animate-wave-1 { animation: wave-bar 1s ease-in-out infinite; }
.animate-wave-2 { animation: wave-bar 1s ease-in-out infinite 0.1s; }
.animate-wave-3 { animation: wave-bar 1s ease-in-out infinite 0.2s; }
</style>
