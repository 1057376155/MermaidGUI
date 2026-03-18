<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import mermaid from 'mermaid'
import hljs from 'highlight.js'

const props = defineProps<{
  content: string
  filePath?: string
  highlightLine?: number
  highlightText?: string
  highlightKey?: number
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const renderedContent = ref<string>('')
const renderError = ref<string>('')
const isRendering = ref(false)
const mermaidInitialized = ref(false)
const fullscreenMermaid = ref<{ code: string } | null>(null)
const fullscreenContainerRef = ref<HTMLDivElement | null>(null)

// Mermaid 计数器
let mermaidCounter = 0

// 初始化 mermaid
onMounted(() => {
  try {
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
    mermaidInitialized.value = true
    console.log('Mermaid 初始化成功')
    
    // 如果已经有内容，重新渲染
    if (props.content) {
      nextTick(() => renderMarkdown())
    }
  } catch (error) {
    console.error('Mermaid 初始化失败:', error)
  }
})

// 配置 marked
const renderer = new marked.Renderer()

// 自定义代码块渲染
renderer.code = function(token: any) {
  // marked v17: token = { type: 'code', lang?: string, text: string }
  const text = token.text || ''
  const lang = token.lang || ''
  
  console.log('renderer.code 被调用:', { lang, textLength: text.length, textPreview: text.substring(0, 50) })
  
  // 只有明确指定 mermaid 或 mmd 语言时才渲染为图表
  if (lang === 'mermaid' || lang === 'mmd') {
    console.log('检测到 mermaid 代码块')
    const id = `mermaid-${mermaidCounter++}`
    return `<div class="mermaid-block" data-mermaid-id="${id}" data-mermaid-code="${encodeURIComponent(text)}">
      <div class="mermaid-placeholder" id="${id}">Loading mermaid...</div>
    </div>`
  }
  
  // 其他代码块使用 highlight.js 高亮或纯文本显示
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(text, { language: lang }).value
      return `<pre class="code-block"><code class="hljs language-${lang}">${highlighted}</code></pre>`
    } catch {
      // 忽略错误
    }
  }
  
  // 默认显示为纯文本代码块
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<pre class="code-block"><code>${escaped}</code></pre>`
}

// 渲染 Markdown
async function renderMarkdown() {
  if (!props.content) return
  
  // 等待 mermaid 初始化完成
  if (!mermaidInitialized.value) {
    console.log('等待 Mermaid 初始化...')
    return
  }
  
  isRendering.value = true
  renderError.value = ''
  mermaidCounter = 0
  
  try {
    // 使用 marked 解析 Markdown
    const html = await marked(props.content, {
      renderer,
      gfm: true,
      breaks: true
    })
    
    console.log('生成的 HTML 片段:', html.substring(0, 500))
    console.log('HTML 中包含 mermaid-block:', html.includes('mermaid-block'))
    
    renderedContent.value = html
    
    // 等待 DOM 更新后渲染 mermaid 图表
    // 使用 setTimeout 确保 v-html 完全渲染
    setTimeout(async () => {
      await renderMermaidBlocks()
    }, 50)
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : '渲染失败'
    console.error('Markdown 渲染错误:', error)
  } finally {
    isRendering.value = false
  }
}

// 渲染所有 mermaid 代码块
async function renderMermaidBlocks() {
  if (!containerRef.value) {
    console.log('containerRef 为空')
    return
  }
  
  // 直接在 containerRef 中查找所有 mermaid-block（会递归查找子元素）
  const mermaidBlocks = containerRef.value.querySelectorAll('.mermaid-block')
  console.log(`找到 ${mermaidBlocks.length} 个 mermaid 代码块`)
  
  if (mermaidBlocks.length === 0) {
    console.log('containerRef.value.innerHTML:', containerRef.value.innerHTML.substring(0, 200))
  }
  
  for (let i = 0; i < mermaidBlocks.length; i++) {
    const block = mermaidBlocks[i]
    const placeholder = block.querySelector('.mermaid-placeholder')
    const code = block.getAttribute('data-mermaid-code')
    
    console.log(`处理第 ${i + 1} 个代码块:`, { hasPlaceholder: !!placeholder, hasCode: !!code })
    
    if (!placeholder || !code) {
      console.warn(`第 ${i + 1} 个代码块缺少必要元素`)
      continue
    }
    
    try {
      const mermaidCode = decodeURIComponent(code)
      console.log(`解码后的 mermaid 代码:`, mermaidCode.substring(0, 100))
      
      // 生成一个新的唯一 id 用于渲染，避免与 DOM 中的 id 冲突
      const renderId = `mermaid-render-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      console.log(`使用渲染 ID: ${renderId}`)
      
      const { svg } = await mermaid.render(renderId, mermaidCode)
      console.log(`第 ${i + 1} 个代码块渲染成功`)
      
      // 创建容器
      const container = document.createElement('div')
      container.className = 'mermaid-container-with-actions'
      
      // 创建全屏按钮
      const fullscreenBtn = document.createElement('button')
      fullscreenBtn.className = 'mermaid-fullscreen-btn'
      fullscreenBtn.innerHTML = '⛶'
      fullscreenBtn.title = '全屏查看'
      fullscreenBtn.onclick = () => {
        fullscreenMermaid.value = { code: mermaidCode }
      }
      
      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-svg-wrapper'
      wrapper.innerHTML = svg
      
      container.appendChild(fullscreenBtn)
      container.appendChild(wrapper)
      
      block.innerHTML = ''
      block.appendChild(container)
    } catch (error) {
      console.error(`第 ${i + 1} 个代码块渲染失败:`, error)
      const errorMsg = error instanceof Error ? error.message : '渲染失败'
      block.innerHTML = `<div class="mermaid-error">Mermaid 渲染错误: ${errorMsg}</div>`
    }
  }
}

// 监听内容变化
watch(() => props.content, () => {
  if (mermaidInitialized.value) {
    nextTick(() => renderMarkdown())
  }
}, { immediate: false })

// 滚动到并高亮指定文本
function scrollToHighlight() {
  if (!containerRef.value) return

  // 先移除之前的高亮
  const prevHighlighted = containerRef.value.querySelectorAll('.search-highlight-element')
  prevHighlighted.forEach(el => el.classList.remove('search-highlight-element'))

  if (!props.highlightText) return

  // 收集所有包含目标文本的元素及其位置
  const matches: { element: Element; offsetTop: number }[] = []
  const walker = document.createTreeWalker(
    containerRef.value,
    NodeFilter.SHOW_TEXT,
    null
  )

  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || ''
    if (text.includes(props.highlightText)) {
      const parent = node.parentElement
      if (parent) {
        matches.push({
          element: parent,
          offsetTop: parent.getBoundingClientRect().top - containerRef.value.getBoundingClientRect().top + containerRef.value.scrollTop
        })
      }
    }
  }

  if (matches.length === 0) {
    // 没有找到匹配，根据行号估算滚动
    if (props.highlightLine && props.highlightLine > 0) {
      const avgLineHeight = 24
      const scrollPosition = (props.highlightLine - 10) * avgLineHeight
      containerRef.value.scrollTop = Math.max(0, scrollPosition)
    }
    return
  }

  // 如果只有一个匹配，直接跳转
  if (matches.length === 1) {
    highlightElement(matches[0].element)
    return
  }

  // 多个匹配时，根据行号估算应该跳到哪个
  if (props.highlightLine && props.highlightLine > 0) {
    // 估算目标滚动位置
    const avgLineHeight = 24
    const estimatedScrollTop = (props.highlightLine - 10) * avgLineHeight

    // 找到最接近估算位置的匹配
    let closestMatch = matches[0]
    let minDistance = Math.abs(matches[0].offsetTop - estimatedScrollTop)

    for (const match of matches) {
      const distance = Math.abs(match.offsetTop - estimatedScrollTop)
      if (distance < minDistance) {
        minDistance = distance
        closestMatch = match
      }
    }

    highlightElement(closestMatch.element)
  } else {
    // 没有行号信息，跳转到第一个匹配
    highlightElement(matches[0].element)
  }
}

// 高亮元素并滚动
function highlightElement(element: Element) {
  if (!containerRef.value) return

  // 滚动到元素
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // 添加高亮效果
  element.classList.add('search-highlight-element')

  // 3秒后移除高亮
  setTimeout(() => {
    element.classList.remove('search-highlight-element')
  }, 3000)
}

// 监听高亮 key 变化（每次点击都会更新 key）
watch(() => props.highlightKey, () => {
  nextTick(() => {
    setTimeout(scrollToHighlight, 100)
  })
})

// 暴露方法供父组件调用
defineExpose({
  scrollToHighlight
})

// 关闭全屏
function closeFullscreen() {
  fullscreenMermaid.value = null
}

// 渲染全屏 mermaid
async function renderFullscreenMermaid() {
  if (!fullscreenMermaid.value || !fullscreenContainerRef.value) return
  
  try {
    const renderId = `mermaid-fullscreen-${Date.now()}`
    const { svg } = await mermaid.render(renderId, fullscreenMermaid.value.code)
    fullscreenContainerRef.value.innerHTML = svg
    
    // 初始化 mermaid 的缩放和平移功能
    const svgElement = fullscreenContainerRef.value.querySelector('svg')
    if (svgElement) {
      // 启用 mermaid 的交互功能
      svgElement.style.cursor = 'grab'
      enableSvgPanZoom(svgElement)
    }
  } catch (error) {
    console.error('全屏 mermaid 渲染失败:', error)
    if (fullscreenContainerRef.value) {
      fullscreenContainerRef.value.innerHTML = `<div class="mermaid-error">渲染失败: ${error instanceof Error ? error.message : '未知错误'}</div>`
    }
  }
}

// 启用 SVG 的平移和缩放功能
function enableSvgPanZoom(svg: SVGElement) {
  let isPanning = false
  let startX = 0
  let startY = 0
  let translateX = 0
  let translateY = 0
  let scale = 1
  
  const viewBox = svg.viewBox.baseVal
  const originalWidth = viewBox.width
  const originalHeight = viewBox.height
  
  svg.addEventListener('mousedown', (e) => {
    isPanning = true
    startX = e.clientX - translateX
    startY = e.clientY - translateY
    svg.style.cursor = 'grabbing'
  })
  
  svg.addEventListener('mousemove', (e) => {
    if (!isPanning) return
    translateX = e.clientX - startX
    translateY = e.clientY - startY
    updateTransform()
  })
  
  svg.addEventListener('mouseup', () => {
    isPanning = false
    svg.style.cursor = 'grab'
  })
  
  svg.addEventListener('mouseleave', () => {
    isPanning = false
    svg.style.cursor = 'grab'
  })
  
  svg.addEventListener('wheel', (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    scale *= delta
    scale = Math.max(0.1, Math.min(scale, 10))
    updateTransform()
  })
  
  function updateTransform() {
    svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
  }
}

// 监听全屏状态变化，渲染 mermaid
watch(() => fullscreenMermaid.value, (newVal) => {
  if (newVal) {
    nextTick(() => renderFullscreenMermaid())
  }
})
</script>

<template>
  <div class="markdown-viewer">
    <!-- 工具栏 -->
    <div class="viewer-toolbar">
      <span class="file-name">{{ filePath?.split('/').pop() }}</span>
      <div class="toolbar-actions">
        <span class="file-type-badge">Markdown</span>
      </div>
    </div>
    
    <!-- 渲染区域 -->
    <div class="markdown-container" ref="containerRef">
      <div v-if="isRendering" class="loading-overlay">
        <span>渲染中...</span>
      </div>
      
      <div v-else-if="renderError" class="error-display">
        <h4>渲染错误</h4>
        <pre>{{ renderError }}</pre>
      </div>
      
      <article v-else class="markdown-content" v-html="renderedContent"></article>
    </div>
    
    <!-- 全屏查看 Mermaid -->
    <div v-if="fullscreenMermaid" class="mermaid-fullscreen-overlay" @click="closeFullscreen">
      <div class="mermaid-fullscreen-content" @click.stop>
        <button class="mermaid-close-btn" @click="closeFullscreen">✕</button>
        <div class="mermaid-fullscreen-svg" ref="fullscreenContainerRef"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.markdown-viewer {
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

.file-type-badge {
  padding: 2px 8px;
  background: var(--accent-color);
  border-radius: 3px;
  font-size: 11px;
  color: white;
}

.markdown-container {
  flex: 1;
  overflow: auto;
  padding: 20px 40px;
  background: var(--bg-primary);
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

/* Markdown 内容样式 */
.markdown-content {
  max-width: 900px;
  margin: 0 auto;
  color: var(--text-primary);
  line-height: 1.6;
}

.markdown-content :deep(h1) {
  font-size: 2em;
  font-weight: 600;
  margin: 0.67em 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-color);
}

.markdown-content :deep(h2) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 0.83em 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-color);
}

.markdown-content :deep(h3) {
  font-size: 1.25em;
  font-weight: 600;
  margin: 1em 0;
}

.markdown-content :deep(h4) {
  font-size: 1em;
  font-weight: 600;
  margin: 1.33em 0;
}

.markdown-content :deep(h5) {
  font-size: 0.875em;
  font-weight: 600;
  margin: 1.67em 0;
}

.markdown-content :deep(h6) {
  font-size: 0.85em;
  font-weight: 600;
  margin: 2.33em 0;
  color: var(--text-secondary);
}

.markdown-content :deep(p) {
  margin: 1em 0;
}

.markdown-content :deep(a) {
  color: var(--accent-hover);
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(strong) {
  font-weight: 600;
}

.markdown-content :deep(em) {
  font-style: italic;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 1em 0;
  padding-left: 2em;
}

.markdown-content :deep(li) {
  margin: 0.25em 0;
}

.markdown-content :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid var(--accent-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.markdown-content :deep(blockquote p) {
  margin: 0.5em 0;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 2em 0;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--bg-secondary);
  font-weight: 600;
}

.markdown-content :deep(tr:nth-child(even)) {
  background: var(--bg-secondary);
}

/* 代码块样式 */
.markdown-content :deep(.code-block) {
  background: #1a1a2e;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 1em 0;
}

.markdown-content :deep(.code-block code) {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
}

/* 行内代码样式 */
.markdown-content :deep(code:not(.hljs)) {
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

/* Mermaid 图表样式 */
.markdown-content :deep(.mermaid-block) {
  margin: 1em 0;
  text-align: center;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  position: relative;
}

.markdown-content :deep(.mermaid-container-with-actions) {
  position: relative;
  display: inline-block;
  width: 100%;
}

.markdown-content :deep(.mermaid-fullscreen-btn) {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.2s;
}

.markdown-content :deep(.mermaid-fullscreen-btn:hover) {
  background: rgba(0, 0, 0, 0.8);
}

.markdown-content :deep(.mermaid-svg-wrapper) {
  display: inline-block;
}

.markdown-content :deep(.mermaid-svg-wrapper svg) {
  max-width: 100%;
  height: auto;
}

.markdown-content :deep(.mermaid-placeholder) {
  color: var(--text-secondary);
  padding: 20px;
}

.markdown-content :deep(.mermaid-error) {
  color: var(--error-color);
  padding: 16px;
  text-align: left;
  background: rgba(241, 76, 76, 0.1);
  border-radius: 4px;
  font-size: 13px;
}

/* 全屏查看样式 */
.mermaid-fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.mermaid-fullscreen-content {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mermaid-close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(241, 76, 76, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.mermaid-close-btn:hover {
  background: rgba(241, 76, 76, 1);
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(241, 76, 76, 0.4);
}

.mermaid-fullscreen-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  overflow: hidden;
  width: 100%;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.2);
}

.mermaid-fullscreen-svg :deep(svg) {
  max-width: 100%;
  height: auto;
  transition: transform 0.1s ease-out;
  transform-origin: center center;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

/* 图片样式 */
.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 1em 0;
}

/* Highlight.js 主题调整 */
.markdown-content :deep(.hljs) {
  background: transparent;
}

.markdown-content :deep(.hljs-keyword),
.markdown-content :deep(.hljs-selector-tag) {
  color: #c678dd;
}

.markdown-content :deep(.hljs-string),
.markdown-content :deep(.hljs-attr) {
  color: #98c379;
}

.markdown-content :deep(.hljs-number) {
  color: #d19a66;
}

.markdown-content :deep(.hljs-function) {
  color: #61afef;
}

.markdown-content :deep(.hljs-comment) {
  color: #5c6370;
  font-style: italic;
}

/* 搜索高亮效果 */
.markdown-content :deep(.search-highlight-element) {
  background: rgba(255, 200, 0, 0.3);
  border-radius: 2px;
  animation: highlight-pulse 0.5s ease-out;
  transition: background 0.3s ease;
}

@keyframes highlight-pulse {
  0% {
    background: rgba(255, 200, 0, 0.6);
  }
  100% {
    background: rgba(255, 200, 0, 0.3);
  }
}
</style>