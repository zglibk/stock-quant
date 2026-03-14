<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref(null)
let ctx = null
let animId = null
let particles = []
let pulses = []
let w = 0, h = 0
const PARTICLE_COUNT = 60
const CONNECT_DIST = 120
const PULSE_INTERVAL = 3000

class Particle {
  constructor() { this.reset() }
  reset() {
    this.x = Math.random() * w
    this.y = Math.random() * h
    this.vx = (Math.random() - 0.5) * 0.25
    this.vy = (Math.random() - 0.5) * 0.25
    this.r = Math.random() * 1.5 + 0.5
    this.alpha = Math.random() * 0.4 + 0.15
    this.twinkle = Math.random() * Math.PI * 2
    this.twinkleSpeed = 0.01 + Math.random() * 0.02
  }
  update() {
    this.x += this.vx
    this.y += this.vy
    this.twinkle += this.twinkleSpeed
    if (this.x < -10) this.x = w + 10
    if (this.x > w + 10) this.x = -10
    if (this.y < -10) this.y = h + 10
    if (this.y > h + 10) this.y = -10
  }
  draw() {
    const flicker = 0.5 + 0.5 * Math.sin(this.twinkle)
    const a = this.alpha * flicker
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(147, 197, 253, ${a})`
    ctx.fill()
    // 光晕
    if (this.r > 1.2) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(147, 197, 253, ${a * 0.15})`
      ctx.fill()
    }
  }
}

// 流光脉冲：沿两点间路径移动的光点
class Pulse {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2
    this.t = 0
    this.speed = 0.008 + Math.random() * 0.012
    this.alive = true
  }
  update() {
    this.t += this.speed
    if (this.t >= 1) this.alive = false
  }
  draw() {
    const x = this.x1 + (this.x2 - this.x1) * this.t
    const y = this.y1 + (this.y2 - this.y1) * this.t
    const a = Math.sin(this.t * Math.PI) * 0.9 // 中间最亮
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 6)
    grad.addColorStop(0, `rgba(96, 165, 250, ${a})`)
    grad.addColorStop(1, `rgba(96, 165, 250, 0)`)
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
  }
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < CONNECT_DIST) {
        const a = (1 - dist / CONNECT_DIST) * 0.12
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = `rgba(147, 197, 253, ${a})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }
  }
}

function spawnPulse() {
  // 从连接线中随机选一条生成流光
  if (particles.length < 2) return
  const pairs = []
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      if (Math.sqrt(dx * dx + dy * dy) < CONNECT_DIST) {
        pairs.push([i, j])
      }
    }
  }
  if (pairs.length === 0) return
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)]
  pulses.push(new Pulse(particles[a].x, particles[a].y, particles[b].x, particles[b].y))
}

function animate() {
  ctx.clearRect(0, 0, w, h)

  // 更新与绘制粒子
  particles.forEach(p => { p.update(); p.draw() })

  // 连线
  drawConnections()

  // 流光脉冲
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

let pulseTimer = null

onMounted(() => {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  resize()

  // 初始化粒子
  particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle())

  animate()

  // 定时生成流光
  pulseTimer = setInterval(spawnPulse, PULSE_INTERVAL)

  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId)
  if (pulseTimer) clearInterval(pulseTimer)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <!-- Canvas 粒子星空 + 连线网络 -->
    <canvas ref="canvasRef" class="w-full h-full"></canvas>

    <!-- 装饰性轨道圆环（保留） -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-blue-500/[0.04] rounded-full animate-[spin_80s_linear_infinite]"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-purple-500/[0.04] rounded-full animate-[spin_50s_linear_infinite_reverse]"></div>
  </div>
</template>
