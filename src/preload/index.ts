import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 文件树节点类型
interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

// 搜索结果类型
interface SearchResult {
  filePath: string
  fileName: string
  lineNumber: number
  columnNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

// 自定义 API
const api = {
  // 打开目录对话框
  openDirectory: (): Promise<string | null> => 
    ipcRenderer.invoke('dialog:openDirectory'),
  
  // 读取目录树（单层）
  readTree: (dirPath: string): Promise<FileNode[]> => 
    ipcRenderer.invoke('file:readTree', dirPath),
  
  // 读取文件内容
  readFile: (filePath: string): Promise<string | null> => 
    ipcRenderer.invoke('file:readContent', filePath),
  
  // 获取最近打开的目录
  getRecentDir: (): Promise<string | undefined> => 
    ipcRenderer.invoke('store:getRecentDir'),
  
  // 创建新窗口
  newWindow: (filePath?: string): Promise<number> => 
    ipcRenderer.invoke('window:new', filePath),
  
  // 监听目录打开事件
  onDirectoryOpened: (callback: (dirPath: string) => void) => {
    ipcRenderer.on('directory:opened', (_, dirPath) => callback(dirPath))
    return () => ipcRenderer.removeAllListeners('directory:opened')
  },

  // 窗口控制
  minimizeWindow: (): Promise<void> => 
    ipcRenderer.invoke('window:minimize'),
  
  maximizeWindow: (): Promise<void> => 
    ipcRenderer.invoke('window:maximize'),
  
  closeWindow: (): Promise<void> => 
    ipcRenderer.invoke('window:close'),

  // 监听窗口最大化状态变化
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_, isMaximized) => callback(isMaximized))
    return () => ipcRenderer.removeAllListeners('window:maximized')
  },

  // 文件操作
  revealInFolder: (filePath: string): Promise<void> => 
    ipcRenderer.invoke('file:revealInFolder', filePath),
  
  deleteFile: (filePath: string): Promise<boolean> => 
    ipcRenderer.invoke('file:deleteFile', filePath),

  // 悬浮预览窗口
  openFloatingPreview: (filePath: string): Promise<number> => 
    ipcRenderer.invoke('window:openFloatingPreview', filePath),

  // 移动窗口（用于悬浮窗拖拽）
  moveWindow: (deltaX: number, deltaY: number): Promise<void> => 
    ipcRenderer.invoke('window:moveBy', deltaX, deltaY),

  // 历史目录
  getRecentDirs: (): Promise<string[]> => 
    ipcRenderer.invoke('store:getRecentDirs'),
  
  openFromHistory: (dirPath: string): Promise<number> => 
    ipcRenderer.invoke('window:openFromHistory', dirPath),

  // 文件监听
  watchDirectory: (dirPath: string): Promise<void> => 
    ipcRenderer.invoke('file:watchDirectory', dirPath),
  
  unwatchDirectory: (): Promise<void> => 
    ipcRenderer.invoke('file:unwatchDirectory'),
  
  onDirectoryChanged: (callback: (dirPath: string) => void) => {
    ipcRenderer.on('directory:changed', (_, dirPath) => callback(dirPath))
    return () => ipcRenderer.removeAllListeners('directory:changed')
  },

  // 搜索文件内容
  searchInFiles: (dirPath: string, query: string, options?: { caseSensitive?: boolean; wholeWord?: boolean }): Promise<SearchResult[]> => 
    ipcRenderer.invoke('file:search', dirPath, query, options)
}

// 暴露给渲染进程
contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('electron', electronAPI)