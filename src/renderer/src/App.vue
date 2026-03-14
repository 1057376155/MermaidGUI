<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import FileTree from './components/FileTree.vue'
import MermaidViewer from './components/MermaidViewer.vue'
import MarkdownViewer from './components/MarkdownViewer.vue'
import type { FileNode } from '../env.d'

const currentDir = ref<string>('')
const fileTree = ref<FileNode[]>([])
const selectedFile = ref<string>('')
const fileContent = ref<string>('')
const isLoading = ref(false)

// 根据文件扩展名判断文件类型
const fileType = computed(() => {
  if (!selectedFile.value) return null
  const ext = selectedFile.value.split('.').pop()?.toLowerCase()
  if (ext === 'md') return 'markdown'
  if (ext === 'mmd' || ext === 'mermaid') return 'mermaid'
  return null
})

// 加载目录树（根目录）
async function loadDirectory(dirPath: string) {
  currentDir.value = dirPath
  isLoading.value = true
  try {
    fileTree.value = await window.api.readTree(dirPath)
  } finally {
    isLoading.value = false
  }
}

// 递归查找并更新节点
function findAndUpdateNode(nodes: FileNode[], targetPath: string, newChildren: FileNode[]): boolean {
  for (const node of nodes) {
    if (node.path === targetPath) {
      node.children = newChildren
      return true
    }
    if (node.children && node.children.length > 0) {
      if (findAndUpdateNode(node.children, targetPath, newChildren)) {
        return true
      }
    }
  }
  return false
}

// 加载子目录
async function loadChildren(dirPath: string) {
  try {
    const children = await window.api.readTree(dirPath)
    findAndUpdateNode(fileTree.value, dirPath, children)
  } catch (error) {
    console.error('加载子目录失败:', error)
  }
}

// 打开目录选择对话框
async function openDirectory() {
  const dir = await window.api.openDirectory()
  if (dir) {
    await loadDirectory(dir)
  }
}

// 选择文件
async function selectFile(filePath: string) {
  selectedFile.value = filePath
  fileContent.value = ''  // 先清空内容，避免组件用旧内容渲染
  const content = await window.api.readFile(filePath)
  if (content !== null) {
    fileContent.value = content
  }
}

// 在新窗口打开
async function openInNewWindow(filePath: string) {
  await window.api.newWindow(filePath)
}

// 新建窗口
async function createNewWindow() {
  await window.api.newWindow()
}

// 监听菜单打开目录事件
let unsubscribe: (() => void) | undefined

onMounted(async () => {
  // 监听目录打开事件
  unsubscribe = window.api.onDirectoryOpened((dirPath) => {
    loadDirectory(dirPath)
  })
  
  // 尝试加载最近打开的目录
  const recentDir = await window.api.getRecentDir()
  if (recentDir) {
    await loadDirectory(recentDir)
  }
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <div class="app-container">
    <!-- 顶部工具栏 -->
    <header class="toolbar">
      <button class="btn" @click="openDirectory">
        <span class="icon">📁</span>
        打开目录
      </button>
      <button class="btn" @click="createNewWindow" title="新建窗口">
        <span class="icon">🪟</span>
        新建窗口
      </button>
      <span v-if="currentDir" class="current-path">{{ currentDir }}</span>
    </header>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 左侧文件树 -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h3>文件列表</h3>
          <span v-if="isLoading" class="loading">加载中...</span>
        </div>
        <FileTree
          v-if="fileTree.length > 0"
          :nodes="fileTree"
          :selected="selectedFile"
          @select="selectFile"
          @open-new-window="openInNewWindow"
          @load-children="loadChildren"
        />
        <div v-else class="empty-state">
          <p>请打开一个包含 .mmd 或 .md 文件的目录</p>
        </div>
      </aside>

      <!-- 右侧渲染区 -->
      <section class="viewer">
        <MermaidViewer
          v-if="fileContent && fileType === 'mermaid'"
          :content="fileContent"
          :file-path="selectedFile"
        />
        <MarkdownViewer
          v-else-if="fileContent && fileType === 'markdown'"
          :content="fileContent"
          :file-path="selectedFile"
        />
        <div v-else class="empty-viewer">
          <div class="placeholder">
            <span class="icon-large">📊</span>
            <p>选择一个 .mmd 或 .md 文件查看渲染结果</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>