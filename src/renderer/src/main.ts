import { createApp } from 'vue'
import App from './App.vue'
import FloatingPreview from './components/FloatingPreview.vue'
import './styles.css'

// 根据 hash 判断是主窗口还是悬浮预览
const hash = window.location.hash
const isFloatingPreview = hash.includes('preview=')

if (isFloatingPreview) {
  createApp(FloatingPreview).mount('#app')
} else {
  createApp(App).mount('#app')
}