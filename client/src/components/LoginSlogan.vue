<template>
  <div class="relative w-[500px] h-[400px] flex items-center justify-center select-none pointer-events-none">
    <!-- 同心圆球体 -->
    <div class="absolute inset-0 flex items-center justify-center">
      <!-- 最外层光晕 -->
      <div class="absolute w-[500px] h-[500px] rounded-full bg-gradient-radial from-blue-100/40 to-transparent dark:from-cyan-500/[0.06] dark:to-transparent"></div>
      <!-- 外圈 -->
      <div class="absolute w-[500px] h-[500px] rounded-full border-[1.5px] border-blue-300/25 dark:border-cyan-400/[0.12]"></div>
      <!-- 中圈 -->
      <div class="absolute w-[380px] h-[380px] rounded-full border-[1.5px] border-blue-300/30 dark:border-cyan-400/[0.15]"></div>
      <!-- 内层星球 -->
      <div class="absolute w-[260px] h-[260px] rounded-full sphere-body opacity-75 dark:opacity-80"></div>
      <!-- 球面网格纹理 (暗色模式) -->
      <div class="absolute w-[260px] h-[260px] rounded-full sphere-grid hidden dark:block"></div>
      <!-- 星球表面光泽 -->
      <div class="absolute w-[260px] h-[260px] rounded-full sphere-shine"></div>
    </div>

    <!-- 轨道和行星动画 -->
    <div class="absolute inset-0 z-0">
      <svg class="w-full h-full" viewBox="0 0 500 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="orbit-grad-light" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.05" />
            <stop offset="50%" stop-color="#3b82f6" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05" />
          </linearGradient>
          <linearGradient id="orbit-grad-dark" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.05" />
            <stop offset="50%" stop-color="#67e8f9" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.05" />
          </linearGradient>
        </defs>
        
        <g transform="rotate(-15, 250, 200)">
          <!-- 轨道线 -->
          <path 
            id="orbitPath" 
            d="M 50,200 A 200,60 0 1,1 450,200 A 200,60 0 1,1 50,200" 
            fill="none" 
            class="orbit-stroke"
            stroke-width="1.5" 
          />
          
          <!-- 主行星 -->
          <circle r="6" class="planet-main">
            <animateMotion dur="8s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#orbitPath"/>
            </animateMotion>
          </circle>

          <!-- 小行星（更快，反向） -->
          <circle r="3" class="planet-small">
            <animateMotion dur="12s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
              <mpath href="#orbitPath"/>
            </animateMotion>
          </circle>
        </g>
      </svg>
    </div>

    <!-- 文字内容 -->
    <div class="relative z-10 text-center transform translate-y-[-10px]">
      <h1 class="text-4xl font-bold text-gray-700 dark:text-gray-200 tracking-wider mb-3 font-sans">
        让 世 界 享 受 <span class="text-blue-500 font-extrabold mx-1">A.I.</span> 的 乐 趣
      </h1>
      <p class="text-xs text-gray-400 dark:text-gray-500 tracking-[0.4em] uppercase font-light pl-1">
        Let the world enjoy the fun of AI
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400 tracking-[0.2em] font-normal mt-4 pl-1 opacity-90">
        开发者：李邦奎
      </p>
    </div>
  </div>
</template>

<style scoped>
/* ===== 星球主体 ===== */
/* 浅色模式 - 冰蓝通透 */
.sphere-body {
  background: radial-gradient(circle at 35% 35%,
    #f0f6ff 0%,
    #dbe8f8 30%,
    #c4d9f2 60%,
    #b0cde8 100%
  );
  box-shadow:
    inset -6px -6px 18px rgba(0,0,0,0.04),
    inset 4px 4px 14px rgba(255,255,255,0.7),
    0 0 50px rgba(59,130,246,0.08),
    0 0 100px rgba(59,130,246,0.04);
}
/* 暗色模式 - 深海蓝球体 + 青色边缘光 (对标参考图) */
:root.dark .sphere-body,
html.dark .sphere-body {
  background: radial-gradient(circle at 38% 32%,
    rgba(103,232,249,0.15) 0%,
    #164e63 20%,
    #0c4a6e 45%,
    #082f49 70%,
    #0a1628 100%
  );
  box-shadow:
    inset -8px -8px 24px rgba(0,0,0,0.4),
    inset 6px 6px 16px rgba(103,232,249,0.06),
    0 0 60px rgba(34,211,238,0.1),
    0 0 120px rgba(34,211,238,0.04);
}

/* ===== 球面网格纹理 (暗色模式独有) ===== */
.sphere-grid {
  background:
    repeating-conic-gradient(
      rgba(103,232,249,0.04) 0deg 2deg,
      transparent 2deg 15deg
    ),
    repeating-radial-gradient(
      circle at 50% 50%,
      transparent 0px,
      transparent 18px,
      rgba(103,232,249,0.04) 19px,
      transparent 20px
    );
  mask-image: radial-gradient(circle, black 45%, transparent 65%);
  -webkit-mask-image: radial-gradient(circle, black 45%, transparent 65%);
  animation: grid-rotate 40s linear infinite;
}
@keyframes grid-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== 星球表面光泽 ===== */
/* 浅色模式 */
.sphere-shine {
  background: radial-gradient(circle at 30% 25%,
    rgba(255,255,255,0.5) 0%,
    rgba(255,255,255,0.1) 30%,
    transparent 60%
  );
}
/* 暗色模式 - 青白高光 */
:root.dark .sphere-shine,
html.dark .sphere-shine {
  background:
    radial-gradient(circle at 32% 22%,
      rgba(207,250,254,0.2) 0%,
      rgba(103,232,249,0.06) 25%,
      transparent 55%
    ),
    radial-gradient(circle at 65% 75%,
      rgba(34,211,238,0.04) 0%,
      transparent 40%
    );
}

/* ===== 轨道 ===== */
.orbit-stroke { stroke: url(#orbit-grad-light); }
:root.dark .orbit-stroke,
html.dark .orbit-stroke { stroke: url(#orbit-grad-dark); }

/* ===== 行星 ===== */
.planet-main {
  fill: #3b82f6;
  filter: drop-shadow(0 0 8px rgba(59,130,246,0.7));
}
:root.dark .planet-main,
html.dark .planet-main {
  fill: #67e8f9;
  filter: drop-shadow(0 0 10px rgba(103,232,249,0.8));
}

.planet-small {
  fill: #8b5cf6;
  filter: drop-shadow(0 0 5px rgba(139,92,246,0.6));
  opacity: 0.7;
}
:root.dark .planet-small,
html.dark .planet-small {
  fill: #22d3ee;
  filter: drop-shadow(0 0 6px rgba(34,211,238,0.6));
  opacity: 0.6;
}
</style>
