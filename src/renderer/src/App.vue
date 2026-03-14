<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import TitleBar from './components/TitleBar.vue'
import FileTree from './components/FileTree.vue'
import MermaidViewer from './components/MermaidViewer.vue'
import MarkdownViewer from './components/MarkdownViewer.vue'
import RecentDirs from './components/RecentDirs.vue'
import type { FileNode } from '../env.d'

const currentDir = ref<string>('')
const fileTree = ref<FileNode[]>([])
const selectedFile = ref<string>('')
const fileContent = ref<string>('')
const isLoading = ref(false)
const recentDirsRef = ref<InstanceType<typeof RecentDirs> | null>(null)
const expandedPaths = ref<Set<string>>(new Set())
const sidebarCollapsed = ref(false)

// 根据文件扩展名判断文件类型
const fileType = computed(() => {
  if (!selectedFile.value) return null
  const ext = selectedFile.value.split('.').pop()?.toLowerCase()
  if (ext === 'md') return 'markdown'
  if (ext === 'mmd' || ext === 'mermaid') return 'mermaid'
  return null
})

// 递归加载所有子目录
async function loadAllSubDirectories(nodes: FileNode[]) {
  const dirsToLoad = nodes.filter(n => n.type === 'directory')
  
  await Promise.all(
    dirsToLoad.map(async (dir) => {
      try {
        const children = await window.api.readTree(dir.path)
        dir.children = children
        // 递归加载子目录
        await loadAllSubDirectories(children)
      } catch (error) {
        console.error('加载子目录失败:', dir.path, error)
      }
    })
  )
}

// 加载目录树（根目录）
async function loadDirectory(dirPath: string) {
  currentDir.value = dirPath
  isLoading.value = true
  try {
    fileTree.value = await window.api.readTree(dirPath)
    // 递归加载所有子目录以显示文件数量
    await loadAllSubDirectories(fileTree.value)
    // 重新加载已展开的文件夹
    for (const expandedPath of expandedPaths.value) {
      await loadChildren(expandedPath)
    }
    // 刷新历史记录
    recentDirsRef.value?.loadRecentDirs()
    // 开始监听目录变化
    await window.api.watchDirectory(dirPath)
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

// 加载子目录（同时递归加载所有子文件夹）
async function loadChildren(dirPath: string) {
  try {
    const children = await window.api.readTree(dirPath)
    // 递归加载所有子文件夹
    await loadAllSubDirectories(children)
    findAndUpdateNode(fileTree.value, dirPath, children)
  } catch (error) {
    console.error('加载子目录失败:', error)
  }
}

// 切换文件夹展开状态
async function toggleExpand(dirPath: string) {
  if (expandedPaths.value.has(dirPath)) {
    expandedPaths.value.delete(dirPath)
  } else {
    expandedPaths.value.add(dirPath)
    // 展开时加载子目录
    await loadChildren(dirPath)
  }
}

// 刷新文件树（保持展开状态）
async function refreshFileTree() {
  if (!currentDir.value) return
  isLoading.value = true
  try {
    fileTree.value = await window.api.readTree(currentDir.value)
    // 递归加载所有子目录
    await loadAllSubDirectories(fileTree.value)
    // 重新加载已展开的文件夹
    for (const expandedPath of expandedPaths.value) {
      await loadChildren(expandedPath)
    }
  } finally {
    isLoading.value = false
  }
}

// 切换侧边栏折叠状态
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// 批量加载多个子目录（用于统计文件数量）
async function loadAllChildren(dirPaths: string[]) {
  try {
    await Promise.all(
      dirPaths.map(async (dirPath) => {
        const children = await window.api.readTree(dirPath)
        // 递归加载所有子文件夹
        await loadAllSubDirectories(children)
        findAndUpdateNode(fileTree.value, dirPath, children)
      })
    )
  } catch (error) {
    console.error('批量加载子目录失败:', error)
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

// 复制文件路径到剪贴板
async function copyPath(filePath: string) {
  try {
    await navigator.clipboard.writeText(filePath)
    console.log('路径已复制:', filePath)
  } catch (error) {
    console.error('复制路径失败:', error)
  }
}

// 删除文件
async function deleteFile(filePath: string) {
  if (!confirm(`确定要删除 ${filePath.split('/').pop()} 吗？`)) {
    return
  }

  const success = await window.api.deleteFile(filePath)
  if (success) {
    // 如果删除的是当前选中的文件，清空内容
    if (selectedFile.value === filePath) {
      selectedFile.value = ''
      fileContent.value = ''
    }
    // 刷新目录树
    if (currentDir.value) {
      await loadDirectory(currentDir.value)
    }
  } else {
    alert('删除文件失败')
  }
}

// 在文件夹中显示
async function revealInFolder(filePath: string) {
  await window.api.revealInFolder(filePath)
}

// 打开悬浮预览窗口
async function openFloatingPreview(filePath: string) {
  await window.api.openFloatingPreview(filePath)
}

// 监听菜单打开目录事件
let unsubscribe: (() => void) | undefined
let unsubscribeDirChanged: (() => void) | undefined

onMounted(async () => {
  // 监听目录打开事件
  unsubscribe = window.api.onDirectoryOpened((dirPath) => {
    loadDirectory(dirPath)
  })

  // 监听目录变化事件
  unsubscribeDirChanged = window.api.onDirectoryChanged(() => {
    // 刷新当前目录
    if (currentDir.value) {
      loadDirectory(currentDir.value)
    }
  })

  // 尝试加载最近打开的目录
  const recentDir = await window.api.getRecentDir()
  if (recentDir) {
    await loadDirectory(recentDir)
  }
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribeDirChanged?.()
  // 停止监听文件变化
  window.api.unwatchDirectory()
})
</script>

<template>
  <div class="app-container">
    <!-- 顶部工具栏（包含窗口控制） -->
    <header class="toolbar">
      <div class="toolbar-left">
        <span class="app-icon">📊</span>
        <span class="app-title">MermaidGUI</span>
        <div class="toolbar-divider"></div>
        <button class="btn" @click="openDirectory">
          <span class="icon">📁</span>
          打开目录
        </button>
        <button class="btn" @click="createNewWindow" title="新建窗口">
          <span class="icon">🪟</span>
          新建窗口
        </button>
      </div>
      <div class="toolbar-right">
        <span v-if="currentDir" class="current-path">{{ currentDir }}</span>
        <TitleBar />
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 左侧文件树 -->
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="sidebar-header">
          <h3 v-if="!sidebarCollapsed">文件列表</h3>
          <div class="sidebar-actions">
            <button v-if="!sidebarCollapsed" class="sidebar-btn" @click="refreshFileTree" title="刷新">
              🔄
            </button>
            <button class="sidebar-btn" @click="toggleSidebar" :title="sidebarCollapsed ? '展开' : '收起'">
              {{ sidebarCollapsed ? '▶' : '◀' }}
            </button>
          </div>
        </div>
        <template v-if="!sidebarCollapsed">
          <span v-if="isLoading" class="loading">加载中...</span>
          <FileTree
            v-if="fileTree.length > 0"
            :nodes="fileTree"
            :selected="selectedFile"
            :expanded-paths="expandedPaths"
            @select="selectFile"
            @open-new-window="openInNewWindow"
            @load-children="loadChildren"
            @load-all-children="loadAllChildren"
            @copy-path="copyPath"
            @delete-file="deleteFile"
            @reveal-in-folder="revealInFolder"
            @open-floating-preview="openFloatingPreview"
            @toggle-expand="toggleExpand"
          />
          <div v-else class="empty-state">
            <p>请打开一个包含 .mmd 或 .md 文件的目录</p>
          </div>
          
          <!-- 最近打开的历史记录 -->
          <RecentDirs ref="recentDirsRef" />
        </template>
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