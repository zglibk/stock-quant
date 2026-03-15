<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref(null)
let ctx = null
let animId = null
let particles = []
let pulses = []
let w = 0, h = 0
let mouseX = -1000, mouseY = -1000  // 鼠标位置
const PARTICLE_COUNT = 110
const CONNECT_DIST = 140
const PULSE_INTERVAL = 1800
const MOUSE_RADIUS = 180     // 鼠标影响半径
const MOUSE_FORCE = 0.02     // 吸引力强度

function isDark() {
  return document.documentElement.classList.contains('dark')
}

function colors() {
  if (isDark()) {
    return {
      particle: [103, 232, 249], line: [103, 232, 249], pulse: [34, 211, 238], halo: [103, 232, 249],
      pAlphaBase: 0.15, pAlphaRange: 0.4, lineAlpha: 0.1, pulseAlpha: 0.85,
      mouseGlow: [34, 211, 238],
    }
  }
  return {
    particle: [59, 130, 246], line: [100, 116, 139], pulse: [59, 130, 246], halo: [96, 165, 250],
    pAlphaBase: 0.2, pAlphaRange: 0.45, lineAlpha: 0.1, pulseAlpha: 0.7,
    mouseGlow: [59, 130, 246],
  }
}

class Particle {
  constructor() { this.reset() }
  reset() {
    const c = colors()
    this.x = Math.random() * w
    this.y = Math.random() * h
    this.vx = (Math.random() - 0.5) * 0.3
    this.vy = (Math.random() - 0.5) * 0.3
    this.baseVx = this.vx
    this.baseVy = this.vy
    this.r = Math.random() * 1.8 + 0.6
    this.alpha = Math.random() * c.pAlphaRange + c.pAlphaBase
    this.twinkle = Math.random() * Math.PI * 2
    this.twinkleSpeed = 0.01 + Math.random() * 0.025
  }
  update() {
    // 鼠标吸引力
    const dx = mouseX - this.x
    const dy = mouseY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < MOUSE_RADIUS && dist > 1) {
      const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE
      this.vx += (dx / dist) * force
      this.vy += (dy / dist) * force
    }
    // 阻尼回归自然速度
    this.vx += (this.baseVx - this.vx) * 0.02
    this.vy += (this.baseVy - this.vy) * 0.02

    this.x += this.vx
    this.y += this.vy
    this.twinkle += this.twinkleSpeed
    if (this.x < -10) this.x = w + 10
    if (this.x > w + 10) this.x = -10
    if (this.y < -10) this.y = h + 10
    if (this.y > h + 10) this.y = -10
  }
  draw() {
    const c = colors()
    const [r, g, b] = c.particle
    const flicker = 0.5 + 0.5 * Math.sin(this.twinkle)
    // 靠近鼠标的粒子更亮更大
    const dx = mouseX - this.x
    const dy = mouseY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const proximity = dist < MOUSE_RADIUS ? (1 - dist / MOUSE_RADIUS) : 0
    const a = this.alpha * flicker + proximity * 0.35
    const drawR = this.r + proximity * 1.5

    ctx.beginPath()
    ctx.arc(this.x, this.y, drawR, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(a, 1)})`
    ctx.fill()
    if (drawR > 1.5) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, drawR * 3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${c.halo[0]},${c.halo[1]},${c.halo[2]},${Math.min(a * 0.15, 0.2)})`
      ctx.fill()
    }
  }
}

class Pulse {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2
    this.t = 0; this.speed = 0.008 + Math.random() * 0.014; this.alive = true
  }
  update() { this.t += this.speed; if (this.t >= 1) this.alive = false }
  draw() {
    const c = colors()
    const [r, g, b] = c.pulse
    const x = this.x1 + (this.x2 - this.x1) * this.t
    const y = this.y1 + (this.y2 - this.y1) * this.t
    const a = Math.sin(this.t * Math.PI) * c.pulseAlpha
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 7)
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
  }
}

function drawConnections() {
  const c = colors()
  const [r, g, b] = c.line
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < CONNECT_DIST) {
        // 鼠标附近的连线更亮
        const midX = (particles[i].x + particles[j].x) / 2
        const midY = (particles[i].y + particles[j].y) / 2
        const mDist = Math.sqrt((mouseX - midX) ** 2 + (mouseY - midY) ** 2)
        const mBoost = mDist < MOUSE_RADIUS ? (1 - mDist / MOUSE_RADIUS) * 0.15 : 0
        const a = (1 - dist / CONNECT_DIST) * c.lineAlpha + mBoost

        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(a, 0.35)})`
        ctx.lineWidth = 0.6 + mBoost * 2
        ctx.stroke()
      }
    }
  }
}

// 鼠标附近画一圈淡淡的光晕
function drawMouseGlow() {
  if (mouseX < 0 || mouseY < 0) return
  const c = colors()
  const [r, g, b] = c.mouseGlow
  const grad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, MOUSE_RADIUS * 0.6)
  grad.addColorStop(0, `rgba(${r},${g},${b},0.04)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.beginPath()
  ctx.arc(mouseX, mouseY, MOUSE_RADIUS * 0.6, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
}

function spawnPulse() {
  if (particles.length < 2) return
  const pairs = []
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      if (Math.sqrt(dx * dx + dy * dy) < CONNECT_DIST) pairs.push([i, j])
    }
  }
  if (!pairs.length) return
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)]
  pulses.push(new Pulse(particles[a].x, particles[a].y, particles[b].x, particles[b].y))
}

function animate() {
  ctx.clearRect(0, 0, w, h)
  drawMouseGlow()
  particles.forEach(p => { p.update(); p.draw() })
  drawConnections()
  pulses.forEach(p => { p.update(); p.draw() })
  pulses = pulses.filter(p => p.alive)
  animId = requestAnimationFrame(animate)
}

function resize() {
  if (!canvasRef.value) return
  const dpr = window.devicePixelRatio || 1
  w = canvasRef.value.offsetWidth
  h = canvasRef.value.offsetHeight
  canvasRef.value.width = w * dpr
  canvasRef.value.height = h * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function handleMouseMove(e) {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top
}
function handleMouseLeave() {
  mouseX = -1000; mouseY = -1000
}

let pulseTimer = null

onMounted(() => {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  resize()
  particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle())
  animate()
  pulseTimer = setInterval(spawnPulse, PULSE_INTERVAL)
  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseleave', handleMouseLeave)
})

onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId)
  if (pulseTimer) clearInterval(pulseTimer)
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseleave', handleMouseLeave)
})
</script>

<template>
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <canvas ref="canvasRef" class="w-full h-full pointer-events-auto"></canvas>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-blue-400/[0.08] dark:border-cyan-400/[0.06] rounded-full animate-[spin_80s_linear_infinite]"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-purple-400/[0.08] dark:border-cyan-500/[0.05] rounded-full animate-[spin_50s_linear_infinite_reverse]"></div>
  </div>
</template>
