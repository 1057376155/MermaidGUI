<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const recentDirs = ref<string[]>([])
const isExpanded = ref(false)

const emit = defineEmits<{
  'open-dir': [dirPath: string]
}>()

onMounted(async () => {
  await loadRecentDirs()
})

async function loadRecentDirs() {
  try {
    recentDirs.value = await window.api.getRecentDirs()
  } catch (error) {
    console.error('加载历史目录失败:', error)
  }
}

function getDirName(path: string): string {
  return path.split('/').pop() || path
}

function getDirParent(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

async function openDir(dirPath: string) {
  await window.api.openFromHistory(dirPath)
}

function clearHistory() {
  recentDirs.value = []
}

defineExpose({ loadRecentDirs })
</script>

<template>
  <div class="recent-dirs" v-if="recentDirs.length > 0">
    <div class="recent-header" @click="isExpanded = !isExpanded">
      <span class="recent-icon">🕐</span>
      <span class="recent-title">最近打开</span>
      <span class="recent-count">{{ recentDirs.length }}</span>
      <span class="expand-icon">{{ isExpanded ? '▼' : '▶' }}</span>
    </div>
    
    <Transition name="slide">
      <div v-show="isExpanded" class="recent-list">
        <div
          v-for="dir in recentDirs"
          :key="dir"
          class="recent-item"
          @click="openDir(dir)"
          :title="dir"
        >
          <span class="item-icon">📁</span>
          <div class="item-info">
            <span class="item-name">{{ getDirName(dir) }}</span>
            <span class="item-path">{{ getDirParent(dir) }}</span>
          </div>
        </div>
        <button class="clear-btn" @click.stop="clearHistory">
          <span>🗑️</span>
          清空历史
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.recent-dirs {
  border-top: 1px solid var(--border-color, #3c3c3c);
  background: var(--bg-secondary, #252526);
}

.recent-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s;
  user-select: none;
}

.recent-header:hover {
  background: var(--bg-tertiary, #2d2d30);
}

.recent-icon {
  font-size: 12px;
}

.recent-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #969696);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.recent-count {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--bg-tertiary, #2d2d30);
  border-radius: 10px;
  color: var(--text-secondary, #969696);
}

.expand-icon {
  font-size: 8px;
  color: var(--text-secondary, #969696);
  margin-left: auto;
}

.recent-list {
  padding: 4px;
}

.recent-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.recent-item:hover {
  background: var(--bg-tertiary, #2d2d30);
}

.item-icon {
  font-size: 14px;
  margin-top: 1px;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
}

.item-name {
  font-size: 12px;
  color: var(--text-primary, #ccc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-path {
  font-size: 10px;
  color: var(--text-secondary, #969696);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: calc(100% - 8px);
  margin: 4px;
  padding: 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary, #969696);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(241, 76, 76, 0.1);
  color: var(--error-color, #f14c4c);
}

/* 展开动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
