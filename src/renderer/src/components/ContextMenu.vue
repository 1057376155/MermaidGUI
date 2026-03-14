<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

export interface MenuItem {
  label: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  divider?: boolean
  action?: () => void
}

const props = defineProps<{
  items: MenuItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLDivElement | null>(null)
const position = ref({ x: 0, y: 0 })
const isVisible = ref(false)

// 显示菜单
function show(x: number, y: number) {
  position.value = { x, y }
  isVisible.value = true

  // 等待 DOM 更新后调整位置
  setTimeout(() => {
    adjustPosition()
  }, 0)
}

// 隐藏菜单
function hide() {
  isVisible.value = false
  emit('close')
}

// 调整菜单位置，确保不超出视口
function adjustPosition() {
  if (!menuRef.value) return

  const menu = menuRef.value
  const rect = menu.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let { x, y } = position.value

  // 水平方向调整
  if (x + rect.width > viewportWidth) {
    x = viewportWidth - rect.width - 8
  }

  // 垂直方向调整
  if (y + rect.height > viewportHeight) {
    y = y - rect.height
  }

  position.value = { x, y }
}

// 处理菜单项点击
function handleItemClick(item: MenuItem) {
  if (item.disabled || item.divider) return

  item.action?.()
  hide()
}

// 点击外部关闭菜单
function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    hide()
  }
}

// 监听全局点击
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('scroll', hide, true)
  document.addEventListener('resize', hide)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('scroll', hide, true)
  document.removeEventListener('resize', hide)
})

defineExpose({ show, hide })
</script>

<template>
  <Teleport to="body">
    <Transition name="menu-fade">
      <div
        v-if="isVisible"
        ref="menuRef"
        class="context-menu"
        :style="{ left: position.x + 'px', top: position.y + 'px' }"
        @contextmenu.prevent
      >
        <template v-for="(item, index) in items" :key="index">
          <div v-if="item.divider" class="menu-divider"></div>
          <button
            v-else
            class="menu-item"
            :class="{ disabled: item.disabled }"
            @click="handleItemClick(item)"
          >
            <span v-if="item.icon" class="menu-icon">{{ item.icon }}</span>
            <span class="menu-label">{{ item.label }}</span>
            <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  min-width: 160px;
  max-width: 280px;
  background: var(--bg-secondary, #252526);
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 6px;
  padding: 4px 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 10000;
  user-select: none;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary, #cccccc);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.menu-item:hover:not(.disabled) {
  background: var(--accent-color, #0e639c);
}

.menu-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-icon {
  width: 16px;
  text-align: center;
  font-size: 12px;
}

.menu-label {
  flex: 1;
}

.menu-shortcut {
  font-size: 11px;
  color: var(--text-secondary, #969696);
  margin-left: 16px;
}

.menu-item:hover:not(.disabled) .menu-shortcut {
  color: rgba(255, 255, 255, 0.8);
}

.menu-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--border-color, #3c3c3c);
}

/* 过渡动画 */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
