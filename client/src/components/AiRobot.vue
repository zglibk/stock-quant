<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const containerRef = ref(null)
const isDragging = ref(false)
const isHover = ref(false)
const isPressed = ref(false)
const isActive = ref(false)
const isWaving = ref(false)
const showSpeech = ref(false)
const speechText = ref('')
const speechAlign = ref('right')
let startX = 0, startY = 0, initialX = 0, initialY = 0, currentX = 0, currentY = 0
let activeTimer = null, speechTimer = null, waveTimer = null, idleTimer = null
const uid = Math.random().toString(36).slice(2, 10)
const metalGradientId = `mg-${uid}`
const darkMetalGradientId = `dmg-${uid}`
const eyeGlowId = `eg-${uid}`
const coreGlowId = `cg-${uid}`
const tapPhrases = ['你好呀 👋', '已收到！', '一起分析吧 📊', '今天也要加油 💪', '准备就绪 ✨', '交给我吧！']
const hoverPhrases = ['嗨～', '点我互动 👆', '我在这里', '有问题尽管问 🤖']
const idlePhrases = ['在吗？👀', '好安静啊...', '需要帮忙吗？']

const updateSpeechAlign = () => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const safe = 190
  const canR = window.innerWidth - rect.right >= safe
  const canL = rect.left >= safe
  if (!canR && canL) { speechAlign.value = 'left'; return }
  if (!canL && canR) { speechAlign.value = 'right'; return }
  speechAlign.value = rect.left < window.innerWidth * 0.52 ? 'right' : 'left'
}

const speak = (text, duration = 2000) => {
  updateSpeechAlign()
  speechText.value = text
  showSpeech.value = true
  if (speechTimer) clearTimeout(speechTimer)
  speechTimer = setTimeout(() => { showSpeech.value = false; speechTimer = null }, duration)
}

const speakRandom = (type = 'tap') => {
  const pool = type === 'hover' ? hoverPhrases : (type === 'idle' ? idlePhrases : tapPhrases)
  speak(pool[Math.floor(Math.random() * pool.length)], type === 'hover' ? 1400 : 2200)
}

const activateEffect = () => {
  isActive.value = false
  speakRandom('tap')
  if (activeTimer) clearTimeout(activeTimer)
  isWaving.value = true
  if (waveTimer) clearTimeout(waveTimer)
  waveTimer = setTimeout(() => { isWaving.value = false; waveTimer = null }, 1200)
  requestAnimationFrame(() => {
    isActive.value = true
    activeTimer = setTimeout(() => { isActive.value = false; activeTimer = null }, 500)
  })
}

const startIdleCheck = () => {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (!isHover.value && !isDragging.value && !showSpeech.value) {
      speakRandom('idle')
      isWaving.value = true
      setTimeout(() => { isWaving.value = false }, 1000)
    }
    startIdleCheck()
  }, 15000 + Math.random() * 10000)
}

const handleStart = (e) => {
  if (e.type === 'mousedown') e.preventDefault()
  isDragging.value = true; isPressed.value = true; activateEffect()
  const cx = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX
  const cy = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY
  startX = cx; startY = cy; initialX = currentX; initialY = currentY
  if (containerRef.value) containerRef.value.style.cursor = 'grabbing'
  startIdleCheck()
}

const handleMove = (e) => {
  if (!isDragging.value) return
  if (e.type === 'touchmove') e.preventDefault()
  const cx = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX
  const cy = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY
  currentX = initialX + (cx - startX); currentY = initialY + (cy - startY)
  if (containerRef.value) containerRef.value.style.transform = `translate(${currentX}px, ${currentY}px)`
  updateSpeechAlign()
}

const handleEnd = () => {
  isDragging.value = false; isPressed.value = false
  if (containerRef.value) containerRef.value.style.cursor = 'grab'
}

const handleEnter = () => { isHover.value = true; if (!showSpeech.value) speakRandom('hover'); startIdleCheck() }
const handleLeave = () => { isHover.value = false }
const handleActivate = () => { activateEffect(); startIdleCheck() }

onMounted(() => {
  updateSpeechAlign()
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleEnd)
  window.addEventListener('touchmove', handleMove, { passive: false })
  window.addEventListener('touchend', handleEnd)
  window.addEventListener('resize', updateSpeechAlign)
  startIdleCheck()
})
onUnmounted(() => {
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleEnd)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleEnd)
  window.removeEventListener('resize', updateSpeechAlign)
  ;[activeTimer, speechTimer, waveTimer, idleTimer].forEach(t => t && clearTimeout(t))
})
</script>

<template>
  <div
    ref="containerRef"
    class="ai-robot-container w-full h-full cursor-grab touch-none select-none pointer-events-auto will-change-transform"
    :class="{ 'is-hover': isHover, 'is-pressed': isPressed, 'is-active': isActive }"
    @mousedown="handleStart" @touchstart="handleStart"
    @mouseenter="handleEnter" @mouseleave="handleLeave"
    @click="handleActivate" @dragstart.prevent
  >
    <div class="robot-halo"></div>
    <div v-show="showSpeech" :class="['robot-speech', speechAlign === 'left' ? 'speech-left' : 'speech-right']">{{ speechText }}</div>
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" class="w-full h-full filter drop-shadow-2xl overflow-visible pointer-events-none">
      <defs>
        <linearGradient :id="metalGradientId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f0f9ff"/><stop offset="50%" stop-color="#cbe4f7"/><stop offset="100%" stop-color="#93c5fd"/>
        </linearGradient>
        <linearGradient :id="darkMetalGradientId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <radialGradient :id="eyeGlowId" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#67e8f9" stop-opacity="1"/><stop offset="80%" stop-color="#06b6d4" stop-opacity="0.8"/><stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>
        </radialGradient>
        <radialGradient :id="coreGlowId" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#3b82f6"/>
        </radialGradient>
      </defs>

      <g class="animate-robot-float robot-stage" transform="scale(0.8) translate(40, 40)">
        <!-- 身体（呼吸感） -->
        <g transform="translate(100, 150)">
          <g class="robot-torso">
            <path d="M 40 20 Q 100 0 160 20 L 170 120 Q 100 140 30 120 Z" :fill="`url(#${metalGradientId})`" stroke="#60a5fa" stroke-width="2"/>
            <circle cx="100" cy="70" r="25" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
            <circle cx="100" cy="70" r="18" :fill="`url(#${coreGlowId})`" class="animate-core-breathe"/>
            <circle cx="65" cy="42" r="4" fill="#3b82f6" class="animate-chest-light-1"/>
            <circle cx="135" cy="42" r="4" fill="#3b82f6" class="animate-chest-light-2"/>
            <circle cx="20" cy="40" r="15" :fill="`url(#${darkMetalGradientId})`"/>
            <circle cx="180" cy="40" r="15" :fill="`url(#${darkMetalGradientId})`"/>
          </g>
        </g>

        <!-- 头部（好奇歪头 + 点头） -->
        <g :class="['animate-head-bob', { 'head-curious': isHover, 'head-nod': isActive }]" transform-origin="200 140">
          <g transform="translate(100, 40)">
            <line x1="100" y1="0" x2="100" y2="-30" stroke="#94a3b8" stroke-width="4"/>
            <circle cx="100" cy="-35" r="8" fill="#ef4444" class="animate-ping-slow"/>
            <circle cx="100" cy="-35" r="5" fill="#ef4444"/>
            <rect x="20" y="0" width="160" height="110" rx="45" ry="45" :fill="`url(#${metalGradientId})`" stroke="#60a5fa" stroke-width="2"/>
            <rect x="35" y="25" width="130" height="70" rx="30" ry="30" fill="#0f172a" stroke="#334155" stroke-width="2"/>
            <g :class="['eyes', { 'eyes-excited': isActive }]">
              <ellipse cx="75" cy="60" rx="18" ry="22" :fill="`url(#${eyeGlowId})`" class="animate-blink"/>
              <ellipse cx="125" cy="60" rx="18" ry="22" :fill="`url(#${eyeGlowId})`" class="animate-blink"/>
              <circle cx="80" cy="55" r="4" fill="white" opacity="0.6"/>
              <circle cx="130" cy="55" r="4" fill="white" opacity="0.6"/>
            </g>
            <g transform="translate(100, 85)" :class="['mouth-bars', { 'mouth-speaking': showSpeech }]">
              <rect x="-20" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-1"/>
              <rect x="-10" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-2"/>
              <rect x="0" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-3"/>
              <rect x="10" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-2"/>
              <rect x="20" y="0" width="4" height="4" rx="2" fill="#3b82f6" class="animate-wave-1"/>
            </g>
          </g>
        </g>

        <!-- 左手 -->
        <g transform="translate(120, 190)">
          <g :class="['robot-arm-left', { 'robot-arm-left-burst': isActive || isPressed, 'robot-arm-left-wave': isWaving }]">
            <path d="M 0 0 Q -30 40 -10 70" :stroke="`url(#${metalGradientId})`" stroke-width="15" fill="none" stroke-linecap="round"/>
            <circle cx="-10" cy="75" r="12" :fill="`url(#${darkMetalGradientId})`"/>
            <circle cx="-14" cy="85" r="5" :fill="`url(#${darkMetalGradientId})`" opacity="0.7"/>
          </g>
        </g>

        <!-- 右手 -->
        <g transform="translate(280, 190)">
          <g :class="['robot-arm-right', { 'robot-arm-right-burst': isActive || isPressed, 'robot-arm-right-wave': isWaving }]">
            <g class="animate-wave-hand" style="transform-origin: 0px 0px">
              <path d="M 0 0 Q 30 40 10 70" :stroke="`url(#${metalGradientId})`" stroke-width="15" fill="none" stroke-linecap="round"/>
              <circle cx="10" cy="75" r="12" :fill="`url(#${darkMetalGradientId})`"/>
              <circle cx="14" cy="85" r="5" :fill="`url(#${darkMetalGradientId})`" opacity="0.7"/>
            </g>
          </g>
        </g>
      </g>

      <ellipse cx="200" cy="350" rx="60" ry="10" fill="#000" opacity="0.2" class="animate-shadow-scale"/>
    </svg>
  </div>
</template>

<style scoped>
.ai-robot-container { position: relative; transition: filter 0.2s ease; }

.robot-halo {
  position: absolute; inset: 16%; border-radius: 9999px;
  background: radial-gradient(circle, rgba(6,182,212,0.25) 0%, rgba(59,130,246,0.08) 45%, rgba(59,130,246,0) 75%);
  opacity: 0; transform: scale(0.88); transition: opacity 0.25s ease, transform 0.25s ease; pointer-events: none;
}

.robot-speech {
  position: absolute; top: 6%; transform: translateY(-100%);
  padding: 7px 14px; border-radius: 9999px; font-size: 12px; line-height: 1;
  color: #0f172a; background: rgba(255,255,255,0.92);
  border: 1px solid rgba(59,130,246,0.35); box-shadow: 0 6px 20px rgba(14,165,233,0.2);
  backdrop-filter: blur(6px); white-space: nowrap; pointer-events: none; z-index: 5;
  animation: speech-pop 0.28s cubic-bezier(0.34,1.56,0.64,1);
}
.speech-right { left: 60%; } .speech-left { right: 60%; }
.robot-speech::after {
  content: ''; position: absolute; bottom: -6px; width: 10px; height: 10px;
  background: rgba(255,255,255,0.92);
  border-right: 1px solid rgba(59,130,246,0.35); border-bottom: 1px solid rgba(59,130,246,0.35);
  transform: rotate(45deg);
}
.speech-right::after { left: 16%; } .speech-left::after { right: 16%; }

.robot-stage { transform-origin: 200px 220px; }

/* 呼吸感躯干 */
.robot-torso { transform-origin: 100px 80px; animation: torso-breathe 4s ease-in-out infinite; }

/* 手臂 - 待机自然摆动 */
.robot-arm-left { transform-origin: 20px 20px; animation: arm-sway-left 3.2s ease-in-out infinite; }
.robot-arm-right { transform-origin: 0px 20px; animation: arm-sway-right 3.2s ease-in-out infinite; }

/* 点击双臂爆发挥舞 */
.robot-arm-left-burst { animation: arm-wave-burst-left 0.5s cubic-bezier(0.36,1.8,0.4,0.8) 2 !important; }
.robot-arm-right-burst { animation: arm-wave-burst-right 0.5s cubic-bezier(0.36,1.8,0.4,0.8) 2 !important; }

/* 主动招手 */
.robot-arm-right-wave { animation: arm-hello-wave 0.4s ease-in-out 3 !important; }
.robot-arm-left-wave { animation: arm-hello-tuck 0.6s ease-in-out 1 !important; }

/* Hover / Active */
.ai-robot-container.is-hover { filter: drop-shadow(0 10px 22px rgba(14,165,233,0.32)); }
.ai-robot-container.is-hover .robot-halo { opacity: 1; transform: scale(1); }
.ai-robot-container.is-pressed { transform: scale(0.94); transition: transform 0.08s ease; }
.ai-robot-container.is-active .robot-halo { opacity: 1; transform: scale(1.22); }
.ai-robot-container.is-hover .robot-torso { animation-duration: 2s; }
.ai-robot-container.is-hover .robot-arm-left,
.ai-robot-container.is-hover .robot-arm-right { animation-duration: 1.5s; }

/* 头部动态 class */
.head-curious { animation: head-curious 0.6s ease forwards !important; }
.head-nod { animation: head-nod 0.4s ease 2 !important; }
.eyes-excited ellipse { animation: eye-excited 0.5s ease 2 !important; }
.mouth-speaking .animate-wave-1,
.mouth-speaking .animate-wave-2,
.mouth-speaking .animate-wave-3 { animation-duration: 0.35s !important; }
.mouth-bars { opacity: 0.5; transition: opacity 0.2s; }
.mouth-speaking { opacity: 1; }

/* 循环基础动画 */
.animate-robot-float { animation: robot-float 4s ease-in-out infinite; }
.animate-head-bob { animation: head-bob 5s ease-in-out infinite; }
.animate-blink { animation: blink 3.5s infinite; }
.animate-ping-slow { animation: ping 3s cubic-bezier(0,0,0.2,1) infinite; }
.animate-wave-hand { animation: wave-hand 3s ease-in-out infinite; }
.animate-shadow-scale { animation: shadow-scale 4s ease-in-out infinite; }
.animate-core-breathe { animation: core-breathe 3s ease-in-out infinite; }
.animate-chest-light-1 { animation: chest-blink 2s ease-in-out infinite; }
.animate-chest-light-2 { animation: chest-blink 2s ease-in-out infinite 1s; }

/* ===== Keyframes ===== */
@keyframes robot-float {
  0%,100% { transform: translateY(0) scale(0.8); }
  50% { transform: translateY(-14px) scale(0.8); }
}
@keyframes torso-breathe {
  0%,100% { transform: scaleY(1) rotate(0deg); }
  30% { transform: scaleY(1.015) rotate(1.5deg); }
  60% { transform: scaleY(0.99) rotate(-1.5deg); }
}
@keyframes arm-sway-left {
  0%,100% { transform: rotate(0deg); }
  40% { transform: rotate(-5deg) translateY(-2px); }
  70% { transform: rotate(2deg); }
}
@keyframes arm-sway-right {
  0%,100% { transform: rotate(0deg); }
  40% { transform: rotate(5deg) translateY(-2px); }
  70% { transform: rotate(-2deg); }
}
@keyframes arm-wave-burst-left {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(-25deg) translateY(-6px); }
  50% { transform: rotate(10deg); }
  80% { transform: rotate(-15deg); }
  100% { transform: rotate(0deg); }
}
@keyframes arm-wave-burst-right {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(25deg) translateY(-6px); }
  50% { transform: rotate(-10deg); }
  80% { transform: rotate(15deg); }
  100% { transform: rotate(0deg); }
}
@keyframes arm-hello-wave {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(-35deg) translateY(-10px); }
  50% { transform: rotate(-15deg) translateY(-6px); }
  75% { transform: rotate(-30deg) translateY(-8px); }
  100% { transform: rotate(0deg); }
}
@keyframes arm-hello-tuck {
  0%,100% { transform: rotate(0deg); }
  50% { transform: rotate(5deg) translateY(3px); }
}
@keyframes head-bob {
  0%,100% { transform: rotate(0deg); }
  25% { transform: rotate(1.8deg); }
  75% { transform: rotate(-1.8deg); }
}
@keyframes head-curious {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(-6deg) translateY(-2px); }
}
@keyframes head-nod {
  0%,100% { transform: rotate(0deg) translateY(0); }
  50% { transform: rotate(0deg) translateY(6px); }
}
@keyframes blink {
  0%,42%,58%,100% { transform: scaleY(1); }
  50% { transform: scaleY(0.08); }
}
@keyframes eye-excited {
  0%,100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
@keyframes wave-hand {
  0%,100% { transform: rotate(0deg); }
  50% { transform: rotate(-8deg) translateY(-4px); }
}
@keyframes shadow-scale {
  0%,100% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(0.75); opacity: 0.08; }
}
@keyframes core-breathe {
  0%,100% { transform: scale(1); opacity: 0.85; filter: brightness(1); }
  50% { transform: scale(1.1); opacity: 1; filter: brightness(1.3); }
}
@keyframes chest-blink {
  0%,100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes wave-bar {
  0%,100% { height: 4px; transform: translateY(0); }
  50% { height: 14px; transform: translateY(-5px); }
}
@keyframes speech-pop {
  0% { opacity: 0; transform: translateY(4px) scale(0.9); }
  100% { opacity: 1; transform: translateY(-100%) scale(1); }
}
.animate-wave-1 { animation: wave-bar 1s ease-in-out infinite; }
.animate-wave-2 { animation: wave-bar 1s ease-in-out infinite 0.12s; }
.animate-wave-3 { animation: wave-bar 1s ease-in-out infinite 0.24s; }
</style>
