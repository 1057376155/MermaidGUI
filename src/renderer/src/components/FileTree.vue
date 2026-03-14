<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FileNode } from '../env.d'
import ContextMenu from './ContextMenu.vue'
import type { MenuItem } from './ContextMenu.vue'

const props = defineProps<{
  nodes: FileNode[]
  selected?: string
  level?: number
  expandedPaths?: Set<string>
}>()

const emit = defineEmits<{
  select: [path: string]
  'open-new-window': [path: string]
  'load-children': [path: string]
  'copy-path': [path: string]
  'delete-file': [path: string]
  'reveal-in-folder': [path: string]
  'open-floating-preview': [path: string]
  'load-all-children': [paths: string[]]
  'toggle-expand': [path: string]
}>()

const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const contextMenuTarget = ref<string>('')

const fileMenuItems: MenuItem[] = [
  {
    label: '悬浮预览',
    icon: '🔍',
    shortcut: 'Space',
    action: () => {
      if (contextMenuTarget.value) {
        emit('open-floating-preview', contextMenuTarget.value)
      }
    }
  },
  { divider: true },
  {
    label: '在文件夹中显示',
    icon: '📂',
    action: () => {
      if (contextMenuTarget.value) {
        emit('reveal-in-folder', contextMenuTarget.value)
      }
    }
  },
  {
    label: '复制路径',
    icon: '📋',
    shortcut: 'Ctrl+C',
    action: () => {
      if (contextMenuTarget.value) {
        emit('copy-path', contextMenuTarget.value)
      }
    }
  },
  {
    label: '在新窗口打开',
    icon: '🪟',
    action: () => {
      if (contextMenuTarget.value) {
        emit('open-new-window', contextMenuTarget.value)
      }
    }
  },
  { divider: true },
  {
    label: '删除',
    icon: '🗑️',
    shortcut: 'Del',
    action: () => {
      if (contextMenuTarget.value) {
        emit('delete-file', contextMenuTarget.value)
      }
    }
  }
]

const dirMenuItems: MenuItem[] = [
  {
    label: '在文件夹中显示',
    icon: '📂',
    action: () => {
      if (contextMenuTarget.value) {
        emit('reveal-in-folder', contextMenuTarget.value)
      }
    }
  },
  {
    label: '复制路径',
    icon: '📋',
    shortcut: 'Ctrl+C',
    action: () => {
      if (contextMenuTarget.value) {
        emit('copy-path', contextMenuTarget.value)
      }
    }
  }
]

const loading = ref<Set<string>>(new Set())

// 使用 props 中的 expandedPaths，如果没有则使用本地状态
const expanded = computed(() => props.expandedPaths ?? new Set<string>())

async function toggleExpand(node: FileNode) {
  emit('toggle-expand', node.path)
}

function handleClick(node: FileNode, event: MouseEvent) {
  if (node.type === 'directory') {
    toggleExpand(node)
  } else {
    emit('select', node.path)
  }
}

function handleContextMenu(node: FileNode, event: MouseEvent) {
  event.preventDefault()
  contextMenuTarget.value = node.path
  contextMenuRef.value?.show(event.clientX, event.clientY)
}

// 根据文件扩展名获取图标
function getFileIcon(node: FileNode): string {
  if (node.type === 'directory') return '📁'
  const ext = node.name.split('.').pop()?.toLowerCase()
  if (ext === 'md') return '📝'
  if (ext === 'mmd' || ext === 'mermaid') return '📊'
  return '📄'
}

// 计算子文件夹中的文件数量（遍历第一层子文件夹）
function getFileCount(node: FileNode): number {
  if (node.type !== 'directory' || !node.children || node.children.length === 0) {
    return 0
  }
  let count = 0
  for (const child of node.children) {
    if (child.type === 'file') {
      count++
    }
  }
  return count
}

// 检查文件夹是否需要加载子内容来显示数量
function needsLoadChildren(node: FileNode): boolean {
  return node.type === 'directory' && !node.children
}

// 暴露方法让父组件可以更新加载状态
function setLoading(path: string, isLoading: boolean) {
  if (isLoading) {
    loading.value.add(path)
  } else {
    loading.value.delete(path)
  }
}

defineExpose({ setLoading })

const level = props.level ?? 0
</script>

<template>
  <ul class="file-tree" :style="{ paddingLeft: `${level * 2}px` }">
    <li
      v-for="node in nodes"
      :key="node.path"
      class="tree-node"
      :class="{
        'is-directory': node.type === 'directory',
        'is-file': node.type === 'file',
        'is-selected': selected === node.path,
        'is-expanded': expanded.has(node.path)
      }"
    >
      <div
        class="node-content"
        @click="handleClick(node, $event)"
        @contextmenu="handleContextMenu(node, $event)"
        :title="node.path"
      >
        <!-- 展开/折叠图标 -->
        <span v-if="node.type === 'directory'" class="expand-icon">
          <span v-if="loading.has(node.path)" class="loading-spinner">⏳</span>
          <span v-else>{{ expanded.has(node.path) ? '▼' : '▶' }}</span>
        </span>
        <span v-else class="expand-icon placeholder"></span>
        
        <!-- 文件/文件夹图标 -->
        <span class="node-icon">
          {{ getFileIcon(node) }}
        </span>
        
        <!-- 名称 -->
        <span class="node-name">{{ node.name }}</span>
        <!-- 文件数量（仅对含有文件的文件夹显示） -->
        <span v-if="node.type === 'directory' && node.children && getFileCount(node) > 0" class="file-count">
          {{ getFileCount(node) }}
        </span>
        <!-- 加载中状态（需要加载子内容时显示） -->
        <span v-else-if="node.type === 'directory' && needsLoadChildren(node)" class="loading-dots">...</span>
      </div>
      
      <!-- 子节点 -->
      <div v-if="node.type === 'directory' && expanded.has(node.path) && node.children" class="children">
        <FileTree
          :nodes="node.children"
          :selected="selected"
          :level="level + 1"
          :expanded-paths="expandedPaths"
          @select="(path) => emit('select', path)"
          @open-new-window="(path) => emit('open-new-window', path)"
          @load-children="(path) => emit('load-children', path)"
          @load-all-children="(paths) => emit('load-all-children', paths)"
          @copy-path="(path) => emit('copy-path', path)"
          @delete-file="(path) => emit('delete-file', path)"
          @reveal-in-folder="(path) => emit('reveal-in-folder', path)"
          @open-floating-preview="(path) => emit('open-floating-preview', path)"
          @toggle-expand="(path) => emit('toggle-expand', path)"
        />
      </div>
    </li>
  </ul>

  <!-- 右键菜单 -->
  <ContextMenu ref="contextMenuRef" :items="contextMenuTarget && nodes.find(n => n.path === contextMenuTarget)?.type === 'directory' ? dirMenuItems : fileMenuItems" />
</template>

<style scoped>
.file-count {
  margin-left: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.loading-dots {
  margin-left: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}
</style>