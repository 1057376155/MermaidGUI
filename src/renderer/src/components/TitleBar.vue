<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isMaximized = ref(false)
let unsubscribe: (() => void) | undefined

// 窗口控制函数
async function minimizeWindow() {
  await window.api.minimizeWindow()
}

async function maximizeWindow() {
  await window.api.maximizeWindow()
}

async function closeWindow() {
  await window.api.closeWindow()
}

onMounted(() => {
  // 监听窗口最大化状态变化
  unsubscribe = window.api.onWindowMaximized((maximized) => {
    isMaximized.value = maximized
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <div class="window-controls">
    <button class="window-btn minimize" @click="minimizeWindow" title="最小化">
      <svg width="10" height="10" viewBox="0 0 12 12">
        <rect x="1" y="5.5" width="10" height="1" fill="currentColor"/>
      </svg>
    </button>
    <button class="window-btn maximize" @click="maximizeWindow" title="最大化/还原">
      <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 12 12">
        <rect x="1" y="1" width="10" height="10" stroke="currentColor" fill="none" stroke-width="1.5"/>
      </svg>
      <svg v-else width="10" height="10" viewBox="0 0 12 12">
        <path d="M1 3h8v8H1V3zm2-2h8v8H3V1z" stroke="currentColor" fill="none" stroke-width="1.5"/>
      </svg>
    </button>
    <button class="window-btn close" @click="closeWindow" title="关闭">
      <svg width="10" height="10" viewBox="0 0 12 12">
        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.window-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.window-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary, #a0a0a0);
  cursor: pointer;
  transition: all 0.2s ease;
}

.window-btn:hover {
  background: var(--bg-hover, #3d3d4a);
  color: var(--text-primary, #e0e0e0);
}

.window-btn.close:hover {
  background: #e81123;
  color: white;
}

.window-btn svg {
  pointer-events: none;
}
</style>
