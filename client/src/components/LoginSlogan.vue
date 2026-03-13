<template>
  <div class="relative w-[500px] h-[400px] flex items-center justify-center select-none pointer-events-none">
    <!-- 同心圆背景 -->
    <div class="absolute inset-0 flex items-center justify-center">
      <!-- 最外层淡圈 -->
      <div class="absolute w-[500px] h-[500px] rounded-full border border-gray-200 dark:border-gray-800 opacity-30"></div>
      <!-- 中层圈 -->
      <div class="absolute w-[380px] h-[380px] rounded-full border border-gray-200 dark:border-gray-800 opacity-40"></div>
      <!-- 内层实体圈 -->
      <div class="absolute w-[260px] h-[260px] rounded-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)] opacity-80"></div>
    </div>

    <!-- 轨道和行星动画 -->
    <div class="absolute inset-0 z-0">
      <svg class="w-full h-full" viewBox="0 0 500 400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="orbit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.1" />
            <stop offset="50%" stop-color="#3b82f6" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.1" />
          </linearGradient>
        </defs>
        
        <!-- 轨道和行星动画 -->
        <g transform="rotate(-15, 250, 200)">
          <!-- 轨道线 -->
          <path 
            id="orbitPath" 
            d="M 50,200 A 200,60 0 1,1 450,200 A 200,60 0 1,1 50,200" 
            fill="none" 
            stroke="url(#orbit-gradient)" 
            stroke-width="1.5" 
          />
          
          <!-- 运行的行星 -->
          <circle r="6" fill="#3b82f6" class="filter drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]">
            <animateMotion 
              dur="8s" 
              repeatCount="indefinite" 
              keyPoints="0;1" 
              keyTimes="0;1"
              calcMode="linear"
            >
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
/* 增加一点微弱的呼吸效果 */
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.02); opacity: 0.4; }
}
</style>