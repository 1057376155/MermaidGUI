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
}>()

const expanded = ref<Set<string>>(new Set())

function toggleExpand(path: string) {
  if (expanded.value.has(path)) {
    expanded.value.delete(path)
  } else {
    expanded.value.add(path)
  }
}

function handleClick(node: FileNode, event: MouseEvent) {
  if (node.type === 'directory') {
    toggleExpand(node.path)
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

const level = props.level ?? 0
</script>

<template>
  <ul class="file-tree" :style="{ paddingLeft: `${level * 16}px` }">
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
          {{ expanded.has(node.path) ? '▼' : '▶' }}
        </span>
        <span v-else class="expand-icon placeholder"></span>
        
        <!-- 文件/文件夹图标 -->
        <span class="node-icon">
          {{ node.type === 'directory' ? '📁' : '📄' }}
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
        />
      </div>
    </li>
  </ul>
</template>