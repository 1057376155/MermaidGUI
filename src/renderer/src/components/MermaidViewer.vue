<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import mermaid from 'mermaid'

const props = defineProps<{
  content: string
  filePath?: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const svgContent = ref<string>('')
const renderError = ref<string>('')
const isRendering = ref(false)

// 初始化 mermaid
onMounted(() => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true
    },
    sequence: {
      useMaxWidth: true
    },
    gantt: {
      useMaxWidth: true
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
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : '渲染失败'
    console.error('Mermaid 渲染错误:', error)
  } finally {
    isRendering.value = false
  }
}

// 监听内容变化
watch(() => props.content, () => {
  nextTick(() => renderMermaid())
}, { immediate: true })

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
</script>

<template>
  <div class="mermaid-viewer">
    <!-- 工具栏 -->
    <div class="viewer-toolbar">
      <span class="file-name">{{ filePath?.split('/').pop() }}</span>
      <div class="toolbar-actions">
        <button class="btn-small" @click="downloadSvg" :disabled="!svgContent">
          下载 SVG
        </button>
        <button class="btn-small" @click="copySvg" :disabled="!svgContent">
          复制 SVG
        </button>
      </div>
    </div>
    
    <!-- 渲染区域 -->
    <div ref="containerRef" class="mermaid-container">
      <div v-if="isRendering" class="loading-overlay">
        <span>渲染中...</span>
      </div>
      
      <div v-else-if="renderError" class="error-display">
        <h4>渲染错误</h4>
        <pre>{{ renderError }}</pre>
      </div>
      
      <div v-else class="mermaid-svg" v-html="svgContent"></div>
    </div>
  </div>
</template>