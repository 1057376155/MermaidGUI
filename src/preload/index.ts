import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 文件树节点类型
interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

// 自定义 API
const api = {
  // 打开目录对话框
  openDirectory: (): Promise<string | null> => 
    ipcRenderer.invoke('dialog:openDirectory'),
  
  // 读取目录树
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
  }
}

// 暴露给渲染进程
contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('electron', electronAPI)