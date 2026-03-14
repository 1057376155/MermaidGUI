<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MermaidViewer from './MermaidViewer.vue'
import MarkdownViewer from './MarkdownViewer.vue'

const filePath = ref<string>('')
const fileContent = ref<string>('')

// 完整文件名
const fileName = computed(() => filePath.value.split('/').pop() || '')

// 父目录路径
const parentDir = computed(() => {
  const parts = filePath.value.split('/')
  parts.pop()
  return parts.join('/') || '/'
})

// 根据父目录路径生成颜色标识
const dirColor = computed(() => {
  const dir = parentDir.value
  // 使用简单的哈希算法生成颜色
  let hash = 0
  for (let i = 0; i < dir.length; i++) {
    hash = dir.charCodeAt(i) + ((hash << 5) - hash)
  }
  // 生成柔和的颜色（HSL 色彩空间）
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 60%, 45%)`
})

// 目录标识（显示最后两级目录）
const dirLabel = computed(() => {
  const parts = parentDir.value.split('/').filter(Boolean)
  if (parts.length === 0) return '/'
  if (parts.length === 1) return parts[0]
  return parts.slice(-2).join('/')
})

const fileType = computed(() => {
  const ext = fileName.value.split('.').pop()?.toLowerCase()
  if (ext === 'md') return 'markdown'
  if (ext === 'mmd' || ext === 'mermaid') return 'mermaid'
  return null
})

// 解析 hash 获取文件路径
onMounted(async () => {
  const hash = window.location.hash
  const match = hash.match(/preview=([^&]+)/)
  if (match) {
    filePath.value = decodeURIComponent(match[1])
    await loadContent()
  }
})

async function loadContent() {
  if (!filePath.value) return
  const content = await window.api.readFile(filePath.value)
  if (content !== null) {
    fileContent.value = content
  }
}

// 窗口控制
async function closeWindow() {
  await window.api.closeWindow()
}

async function minimizeWindow() {
  await window.api.minimizeWindow()
}

// 拖拽移动
let isDragging = false
let startX = 0
let startY = 0

function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.window-btn')) return
  isDragging = true
  startX = e.screenX
  startY = e.screenY
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging) return
  // 使用 IPC 移动窗口
  window.api.moveWindow(e.screenX - startX, e.screenY - startY)
  startX = e.screenX
  startY = e.screenY
}

function stopDrag() {
  isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}
</script>

<template>
  <div class="floating-preview">
    <!-- 简洁标题栏 -->
    <div class="preview-header" @mousedown="startDrag">
      <div class="header-left">
        <span class="file-icon">{{ fileType === 'mermaid' ? '📊' : '📝' }}</span>
        <div class="path-container">
          <span class="dir-badge" :style="{ backgroundColor: dirColor }" :title="parentDir">
            {{ dirLabel }}
          </span>
          <span class="file-name" :title="filePath">{{ fileName }}</span>
        </div>
      </div>
      <div class="header-right">
        <button class="window-btn minimize" @click="minimizeWindow" title="最小化">─</button>
        <button class="window-btn close" @click="closeWindow" title="关闭">✕</button>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="preview-content">
      <MermaidViewer
        v-if="fileContent && fileType === 'mermaid'"
        :content="fileContent"
        :file-path="filePath"
        floating
      />
      <MarkdownViewer
        v-else-if="fileContent && fileType === 'markdown'"
        :content="fileContent"
        :file-path="filePath"
        floating
      />
      <div v-else class="empty-state">
        <p>无法预览该文件</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floating-preview {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary, #1e1e1e);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-tertiary, #2d2d30);
  border-bottom: 1px solid var(--border-color, #3c3c3c);
  cursor: grab;
  -webkit-app-region: drag;
  user-select: none;
}

.preview-header:active {
  cursor: grabbing;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.file-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.path-container {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.dir-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #ccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.window-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary, #969696);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.window-btn:hover {
  background: var(--bg-secondary, #252526);
  color: var(--text-primary, #ccc);
}

.window-btn.close:hover {
  background: #e81123;
  color: white;
}

.preview-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.preview-content > * {
  height: 100%;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--text-secondary, #969696);
  font-size: 13px;
}
</style>
