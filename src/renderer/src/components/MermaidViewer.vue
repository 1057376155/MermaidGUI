<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import mermaid from 'mermaid'

const props = defineProps<{
  content: string
  filePath?: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const svgContainerRef = ref<HTMLDivElement | null>(null)
const svgContent = ref<string>('')
const renderError = ref<string>('')
const isRendering = ref(false)

// SVG 原始尺寸
const originalWidth = ref(0)
const originalHeight = ref(0)

// 缩放和平移状态
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartTranslateX = ref(0)
const dragStartTranslateY = ref(0)

// 缩放范围
const MIN_SCALE = 0.1
const MAX_SCALE = 5
const SCALE_STEP = 0.1

// 初始化 mermaid
onMounted(() => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true
    },
    sequence: {
      useMaxWidth: false
    },
    gantt: {
      useMaxWidth: false
    }
  })
})

// 渲染 mermaid 图表
async function renderMermaid() {
  if (!props.content || !containerRef.value) return

  isRendering.value = true
  renderError.value = ''

  try {
    // 生成唯一 ID
    const id = `mermaid-${Date.now()}`
    
    // 渲染
    const { svg } = await mermaid.render(id, props.content)
    svgContent.value = svg
    
    // 重置缩放和平移，并获取原始尺寸
    nextTick(() => {
      initSvgSize()
      resetView()
    })
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : '渲染失败'
    console.error('Mermaid 渲染错误:', error)
  } finally {
    isRendering.value = false
  }
}

// 初始化 SVG 尺寸
function initSvgSize() {
  if (!svgContainerRef.value) return
  
  const svg = svgContainerRef.value.querySelector('svg')
  if (!svg) return
  
  // 获取 SVG 的原始尺寸
  const bbox = svg.getBBox()
  const widthAttr = svg.getAttribute('width')
  const heightAttr = svg.getAttribute('height')
  
  // 解析原始宽高
  originalWidth.value = widthAttr ? parseFloat(widthAttr) : bbox.width + bbox.x * 2
  originalHeight.value = heightAttr ? parseFloat(heightAttr) : bbox.height + bbox.y * 2
  
  // 设置 viewBox 以支持缩放
  svg.setAttribute('viewBox', `0 0 ${originalWidth.value} ${originalHeight.value}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = `${originalWidth.value}px`
  svg.style.height = `${originalHeight.value}px`
}

// 监听内容变化
watch(() => props.content, () => {
  nextTick(() => renderMermaid())
}, { immediate: true })

// 更新 SVG 尺寸
function updateSvgTransform() {
  if (!svgContainerRef.value) return
  
  const svg = svgContainerRef.value.querySelector('svg')
  if (!svg) return
  
  // 使用 CSS transform 只用于平移，缩放通过修改 SVG 尺寸实现
  const newWidth = originalWidth.value * scale.value
  const newHeight = originalHeight.value * scale.value
  
  svg.style.width = `${newWidth}px`
  svg.style.height = `${newHeight}px`
  svg.style.transform = `translate(${translateX.value}px, ${translateY.value}px)`
}

// 缩放功能
function zoomIn() {
  scale.value = Math.min(scale.value + SCALE_STEP, MAX_SCALE)
  updateSvgTransform()
}

function zoomOut() {
  scale.value = Math.max(scale.value - SCALE_STEP, MIN_SCALE)
  updateSvgTransform()
}

function resetView() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
  updateSvgTransform()
}

function fitToContainer() {
  if (!containerRef.value || !svgContainerRef.value || originalWidth.value === 0) return
  
  const container = containerRef.value
  
  // 获取容器尺寸
  const containerWidth = container.clientWidth - 40
  const containerHeight = container.clientHeight - 40
  
  // 计算适合容器的缩放比例
  const scaleX = containerWidth / originalWidth.value
  const scaleY = containerHeight / originalHeight.value
  const fitScale = Math.min(scaleX, scaleY, 1)
  
  scale.value = fitScale
  translateX.value = 0
  translateY.value = 0
  updateSvgTransform()
}

// 鼠标滚轮缩放
function handleWheel(event: WheelEvent) {
  event.preventDefault()
  
  const delta = event.deltaY > 0 ? -SCALE_STEP : SCALE_STEP
  const newScale = Math.max(MIN_SCALE, Math.min(scale.value + delta, MAX_SCALE))
  
  if (newScale === scale.value) return
  
  // 以鼠标位置为中心缩放
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    
    // 计算缩放前鼠标在内容上的位置
    const contentX = (mouseX - translateX.value) / scale.value
    const contentY = (mouseY - translateY.value) / scale.value
    
    // 更新缩放
    scale.value = newScale
    
    // 调整平移以保持鼠标位置不变
    translateX.value = mouseX - contentX * newScale
    translateY.value = mouseY - contentY * newScale
    
    updateSvgTransform()
  }
}

// 拖拽功能
function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragStartTranslateX.value = translateX.value
  dragStartTranslateY.value = translateY.value
  
  if (containerRef.value) {
    containerRef.value.style.cursor = 'grabbing'
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  
  const deltaX = event.clientX - dragStartX.value
  const deltaY = event.clientY - dragStartY.value
  
  translateX.value = dragStartTranslateX.value + deltaX
  translateY.value = dragStartTranslateY.value + deltaY
  
  updateSvgTransform()
}

function handleMouseUp() {
  isDragging.value = false
  
  if (containerRef.value) {
    containerRef.value.style.cursor = 'grab'
  }
}

// 下载 SVG
function downloadSvg() {
  if (!svgContent.value) return
  
  const blob = new Blob([svgContent.value], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.filePath?.split('/').pop()?.replace('.mmd', '') || 'diagram'}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

// 复制 SVG 代码
async function copySvg() {
  if (!svgContent.value) return
  
  try {
    await navigator.clipboard.writeText(svgContent.value)
    alert('SVG 代码已复制到剪贴板')
  } catch {
    alert('复制失败')
  }
}

// 清理事件监听
onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

// 添加全局事件监听
onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div class="mermaid-viewer">
    <!-- 工具栏 -->
    <div class="viewer-toolbar">
      <span class="file-name">{{ filePath?.split('/').pop() }}</span>
      <div class="toolbar-actions">
        <!-- 缩放控制 -->
        <div class="zoom-controls">
          <button class="btn-small" @click="zoomOut" title="缩小">
            −
          </button>
          <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
          <button class="btn-small" @click="zoomIn" title="放大">
            +
          </button>
          <button class="btn-small" @click="resetView" title="重置">
            重置
          </button>
          <button class="btn-small" @click="fitToContainer" title="适应窗口">
            适应
          </button>
        </div>
        <div class="toolbar-divider"></div>
        <button class="btn-small" @click="downloadSvg" :disabled="!svgContent">
          下载 SVG
        </button>
        <button class="btn-small" @click="copySvg" :disabled="!svgContent">
          复制 SVG
        </button>
      </div>
    </div>
    
    <!-- 渲染区域 -->
    <div 
      ref="containerRef" 
      class="mermaid-container"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
    >
      <div v-if="isRendering" class="loading-overlay">
        <span>渲染中...</span>
      </div>
      
      <div v-else-if="renderError" class="error-display">
        <h4>渲染错误</h4>
        <pre>{{ renderError }}</pre>
      </div>
      
      <div 
        v-else 
        ref="svgContainerRef"
        class="mermaid-svg-container"
      >
        <div class="mermaid-svg" v-html="svgContent"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mermaid-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.viewer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--success-color);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-level {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 45px;
  text-align: center;
  user-select: none;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 4px;
}

.mermaid-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  cursor: grab;
  background: var(--bg-primary);
}

.mermaid-container:active {
  cursor: grabbing;
}

.mermaid-svg-container {
  display: inline-block;
  padding: 20px;
}

.mermaid-svg {
  display: inline-block;
}

.mermaid-svg :deep(svg) {
  display: block;
  max-width: none;
  transform-origin: 0 0;
}

.loading-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--text-secondary);
}

.error-display {
  background: rgba(241, 76, 76, 0.1);
  border: 1px solid var(--error-color);
  border-radius: 4px;
  padding: 16px;
  max-width: 600px;
  margin: 20px;
}

.error-display h4 {
  color: var(--error-color);
  margin-bottom: 8px;
}

.error-display pre {
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>