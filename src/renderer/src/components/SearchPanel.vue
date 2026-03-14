<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { SearchResult } from '../env.d'

const props = defineProps<{
  currentDir: string
}>()

const emit = defineEmits<{
  'select-result': [result: SearchResult]
  close: []
}>()

const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)
const caseSensitive = ref(false)
const wholeWord = ref(false)
const selectedIndex = ref(-1)

// 按文件分组的结果
const groupedResults = computed(() => {
  const groups: Map<string, SearchResult[]> = new Map()
  for (const result of searchResults.value) {
    if (!groups.has(result.filePath)) {
      groups.set(result.filePath, [])
    }
    groups.get(result.filePath)!.push(result)
  }
  return groups
})

// 搜索防抖
let searchTimeout: NodeJS.Timeout | null = null

watch(searchQuery, () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    performSearch()
  }, 300)
})

// 执行搜索
async function performSearch() {
  if (!props.currentDir || !searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  selectedIndex.value = -1

  try {
    const results = await window.api.searchInFiles(
      props.currentDir,
      searchQuery.value,
      {
        caseSensitive: caseSensitive.value,
        wholeWord: wholeWord.value
      }
    )
    searchResults.value = results
  } catch (error) {
    console.error('搜索失败:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

// 选择搜索结果
function selectResult(result: SearchResult) {
  emit('select-result', result)
}

// 高亮匹配文本
function highlightMatch(line: string, start: number, end: number): string {
  const before = escapeHtml(line.slice(0, start))
  const match = escapeHtml(line.slice(start, end))
  const after = escapeHtml(line.slice(end))
  return `${before}<mark class="search-highlight">${match}</mark>${after}`
}

// 转义 HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 键盘导航
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < searchResults.value.length - 1) {
      selectedIndex.value++
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    }
  } else if (e.key === 'Enter' && selectedIndex.value >= 0) {
    e.preventDefault()
    selectResult(searchResults.value[selectedIndex.value])
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

// 清空搜索
function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  selectedIndex.value = -1
}
</script>

<template>
  <div class="search-panel">
    <div class="search-header">
      <div class="search-input-wrapper">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索文档内容..."
          @keydown="handleKeydown"
        />
        <button v-if="searchQuery" class="clear-btn" @click="clearSearch" title="清空">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="search-options">
        <button
          class="option-btn"
          :class="{ active: caseSensitive }"
          @click="caseSensitive = !caseSensitive; performSearch()"
          title="区分大小写"
        >
          Aa
        </button>
        <button
          class="option-btn"
          :class="{ active: wholeWord }"
          @click="wholeWord = !wholeWord; performSearch()"
          title="全词匹配"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v10M21 7v10M7 3v18M17 3v18"/>
          </svg>
        </button>
      </div>
      <button class="close-btn" @click="$emit('close')" title="关闭">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div class="search-results">
      <div v-if="isSearching" class="search-status">
        <span class="loading-spinner"></span>
        搜索中...
      </div>

      <div v-else-if="searchQuery && searchResults.length === 0" class="search-status empty">
        未找到匹配结果
      </div>

      <div v-else-if="searchResults.length > 0" class="results-list">
        <div class="results-count">
          共 {{ searchResults.length }} 个结果
        </div>

        <template v-for="[filePath, results] in groupedResults" :key="filePath">
          <div class="file-group">
            <div class="file-header">
              <span class="file-icon">📄</span>
              <span class="file-name">{{ results[0].fileName }}</span>
              <span class="result-count">{{ results.length }}</span>
            </div>
            <div
              v-for="(result, idx) in results"
              :key="`${result.filePath}-${result.lineNumber}-${idx}`"
              class="result-item"
              :class="{ selected: selectedIndex === searchResults.indexOf(result) }"
              @click="selectResult(result)"
            >
              <span class="line-number">{{ result.lineNumber }}</span>
              <span
                class="line-content"
                v-html="highlightMatch(result.lineContent, result.matchStart, result.matchEnd)"
              ></span>
            </div>
          </div>
        </template>
      </div>

      <div v-else class="search-hint">
        输入关键词搜索文档内容
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  max-height: 500px;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border-radius: 4px;
  padding: 0 8px;
}

.search-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 2px;
}

.clear-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.search-options {
  display: flex;
  gap: 4px;
}

.option-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.option-btn:hover {
  background: var(--bg-hover);
}

.option-btn.active {
  background: var(--accent-color);
  color: white;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  min-height: 100px;
  max-height: 400px;
}

.search-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--text-secondary);
}

.search-status.empty {
  color: var(--text-secondary);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 13px;
}

.results-list {
  padding: 8px 0;
}

.results-count {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.file-group {
  margin-bottom: 4px;
}

.file-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--text-primary);
  position: sticky;
  top: 0;
}

.file-icon {
  font-size: 12px;
}

.file-name {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-count {
  background: var(--accent-color);
  color: white;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
}

.result-item {
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.result-item:hover {
  background: var(--bg-hover);
}

.result-item.selected {
  background: var(--bg-active);
}

.line-number {
  flex-shrink: 0;
  width: 30px;
  color: var(--text-secondary);
  font-size: 11px;
  text-align: right;
  font-family: 'Fira Code', monospace;
}

.line-content {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  font-family: 'Fira Code', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.search-highlight) {
  background: rgba(255, 200, 0, 0.3);
  color: #ffc800;
  padding: 0 2px;
  border-radius: 2px;
}
</style>