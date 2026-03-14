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
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const renderedContent = ref<string>('')
const renderError = ref<string>('')
const isRendering = ref(false)

// Mermaid 计数器
let mermaidCounter = 0

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

// 配置 marked
const renderer = new marked.Renderer()

// 自定义代码块渲染
renderer.code = function(token: any) {
  // marked v17: token = { type: 'code', lang?: string, text: string }
  const text = token.text || ''
  const lang = token.lang || ''
  
  // 只有明确指定 mermaid 或 mmd 语言时才渲染为图表
  if (lang === 'mermaid' || lang === 'mmd') {
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
    
    renderedContent.value = html
    
    // 等待 DOM 更新后渲染 mermaid 图表
    await nextTick()
    await renderMermaidBlocks()
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : '渲染失败'
    console.error('Markdown 渲染错误:', error)
  } finally {
    isRendering.value = false
  }
}

// 渲染所有 mermaid 代码块
async function renderMermaidBlocks() {
  if (!containerRef.value) return
  
  const mermaidBlocks = containerRef.value.querySelectorAll('.mermaid-block')
  
  for (const block of mermaidBlocks) {
    const placeholder = block.querySelector('.mermaid-placeholder')
    const code = block.getAttribute('data-mermaid-code')
    
    if (!placeholder || !code) continue
    
    try {
      const mermaidCode = decodeURIComponent(code)
      const id = placeholder.id
      const { svg } = await mermaid.render(id, mermaidCode)
      
      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-svg-wrapper'
      wrapper.innerHTML = svg
      
      block.innerHTML = ''
      block.appendChild(wrapper)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '渲染失败'
      block.innerHTML = `<div class="mermaid-error">Mermaid 渲染错误: ${errorMsg}</div>`
    }
  }
}

// 监听内容变化
watch(() => props.content, () => {
  nextTick(() => renderMarkdown())
}, { immediate: true })

// 滚动到并高亮指定文本
function scrollToHighlight() {
  if (!containerRef.value || !props.highlightText) return

  // 使用 TreeWalker 查找包含目标文本的元素
  const walker = document.createTreeWalker(
    containerRef.value,
    NodeFilter.SHOW_TEXT,
    null
  )

  let found = false
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || ''
    const index = text.indexOf(props.highlightText)
    if (index !== -1) {
      found = true
      const parent = node.parentElement
      if (parent) {
        // 滚动到元素
        parent.scrollIntoView({ behavior: 'smooth', block: 'center' })

        // 添加高亮效果
        parent.classList.add('search-highlight-element')

        // 3秒后移除高亮
        setTimeout(() => {
          parent.classList.remove('search-highlight-element')
        }, 3000)
      }
      break
    }
  }

  if (!found) {
    // 如果精确匹配失败，尝试滚动到大概位置（基于行号估算）
    if (props.highlightLine && props.highlightLine > 0) {
      // 估算滚动位置
      const avgLineHeight = 24 // 估算的行高
      const scrollPosition = (props.highlightLine - 10) * avgLineHeight
      if (containerRef.value) {
        containerRef.value.scrollTop = Math.max(0, scrollPosition)
      }
    }
  }
}

// 监听高亮文本变化
watch(() => props.highlightText, () => {
  nextTick(() => {
    setTimeout(scrollToHighlight, 100)
  })
})

// 暴露方法供父组件调用
defineExpose({
  scrollToHighlight
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
  margin: 1.5em 0;
  text-align: center;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  overflow-x: auto;
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