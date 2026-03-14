<script setup lang="ts">
import { ref } from 'vue'
import type { FileNode } from '../env.d'

const props = defineProps<{
  nodes: FileNode[]
  selected?: string
  level?: number
}>()

const emit = defineEmits<{
  select: [path: string]
  'open-new-window': [path: string]
  'load-children': [path: string]
}>()

const expanded = ref<Set<string>>(new Set())
const loading = ref<Set<string>>(new Set())

async function toggleExpand(node: FileNode) {
  const path = node.path
  
  if (expanded.value.has(path)) {
    expanded.value.delete(path)
  } else {
    // 如果子节点未加载，先加载
    if (node.type === 'directory' && (!node.children || node.children.length === 0)) {
      loading.value.add(path)
      emit('load-children', path)
      // 等待加载完成（通过 watch 或其他方式）
    }
    expanded.value.add(path)
  }
}

function handleClick(node: FileNode, event: MouseEvent) {
  if (node.type === 'directory') {
    toggleExpand(node)
  } else {
    emit('select', node.path)
  }
}

function handleContextMenu(node: FileNode, event: MouseEvent) {
  if (node.type === 'file') {
    event.preventDefault()
    emit('open-new-window', node.path)
  }
}

// 根据文件扩展名获取图标
function getFileIcon(node: FileNode): string {
  if (node.type === 'directory') return '📁'
  const ext = node.name.split('.').pop()?.toLowerCase()
  if (ext === 'md') return '📝'
  if (ext === 'mmd' || ext === 'mermaid') return '📊'
  return '📄'
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
      </div>
      
      <!-- 子节点 -->
      <div v-if="node.type === 'directory' && expanded.has(node.path) && node.children" class="children">
        <FileTree
          :nodes="node.children"
          :selected="selected"
          :level="level + 1"
          @select="(path) => emit('select', path)"
          @open-new-window="(path) => emit('open-new-window', path)"
          @load-children="(path) => emit('load-children', path)"
        />
      </div>
    </li>
  </ul>
</template>