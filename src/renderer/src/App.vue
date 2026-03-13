<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import FileTree from './components/FileTree.vue'
import MermaidViewer from './components/MermaidViewer.vue'
import type { FileNode } from '../env.d'

const currentDir = ref<string>('')
const fileTree = ref<FileNode[]>([])
const selectedFile = ref<string>('')
const fileContent = ref<string>('')
const isLoading = ref(false)

// 加载目录树
async function loadDirectory(dirPath: string) {
  currentDir.value = dirPath
  isLoading.value = true
  try {
    fileTree.value = await window.api.readTree(dirPath)
  } finally {
    isLoading.value = false
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
  const content = await window.api.readFile(filePath)
  if (content !== null) {
    fileContent.value = content
  }
}

// 在新窗口打开
async function openInNewWindow(filePath: string) {
  await window.api.newWindow(filePath)
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
      <button class="btn" @click="() => window.api.newWindow()" title="新建窗口">
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
        />
        <div v-else class="empty-state">
          <p>请打开一个包含 .mmd 文件的目录</p>
        </div>
      </aside>

      <!-- 右侧渲染区 -->
      <section class="viewer">
        <MermaidViewer
          v-if="fileContent"
          :content="fileContent"
          :file-path="selectedFile"
        />
        <div v-else class="empty-viewer">
          <div class="placeholder">
            <span class="icon-large">📊</span>
            <p>选择一个 .mmd 文件查看渲染结果</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>