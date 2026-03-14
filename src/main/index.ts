import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join, relative } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readdir, readFile, stat, unlink } from 'fs/promises'
import { watch, FSWatcher } from 'fs'
import Store from 'electron-store'

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

// 禁用 macOS 智能缩放和其他触摸手势
app.commandLine.appendSwitch('disable-pinch')
app.commandLine.appendSwitch('disable-features', 'TouchpadAndWheelScrollLatching')

// 存储最近打开的目录
const store = new Store<{ recentDir: string; recentDirs: string[] }>()

// 最大历史记录数
const MAX_RECENT_DIRS = 10

// 获取历史记录列表
function getRecentDirs(): string[] {
  return store.get('recentDirs', [])
}

// 添加目录到历史记录
function addRecentDir(dirPath: string) {
  if (!dirPath) return
  let dirs = getRecentDirs()
  // 移除已存在的相同路径
  dirs = dirs.filter(d => d !== dirPath)
  // 添加到开头
  dirs.unshift(dirPath)
  // 限制数量
  dirs = dirs.slice(0, MAX_RECENT_DIRS)
  store.set('recentDirs', dirs)
  // 同时更新最近一个
  store.set('recentDir', dirPath)
}

// 窗口管理
const windows = new Map<string, BrowserWindow>()

// 文件监听器管理（窗口ID -> 监听器）
const watchers = new Map<number, FSWatcher>()

// 防抖定时器
let debounceTimer: NodeJS.Timeout | null = null

// 开始监听目录变化
function startWatching(win: BrowserWindow, dirPath: string) {
  // 先停止之前的监听
  stopWatching(win.id)

  try {
    // 使用 recursive: true 递归监听整个目录树（macOS/Windows 支持）
    const watcher = watch(dirPath, { persistent: true, recursive: true }, (eventType, filename) => {
      // 忽略隐藏文件和 node_modules
      if (filename && !filename.startsWith('.') && !filename.includes('node_modules')) {
        // 防抖：300ms 内只触发一次刷新
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        debounceTimer = setTimeout(() => {
          win.webContents.send('directory:changed', dirPath)
          debounceTimer = null
        }, 300)
      }
    })
    watchers.set(win.id, watcher)
  } catch (error) {
    console.error('监听目录失败:', dirPath, error)
  }
}

// 停止监听
function stopWatching(winId: number) {
  const watcher = watchers.get(winId)
  if (watcher) {
    watcher.close()
    watchers.delete(winId)
  }
}

async function createWindow(filePath?: string): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    frame: false, // 隐藏默认标题栏，使用自定义标题栏
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      zoomFactor: 1,
      minimumFontSize: 0
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // 禁用视觉缩放（包括双指双击智能缩放）
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1)
    // 开发模式下自动打开开发者工具
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  // 监听最大化状态变化，通知渲染进程
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized', true)
  })
  
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized', false)
  })

  // 窗口关闭时停止监听文件变化
  mainWindow.on('closed', () => {
    stopWatching(mainWindow.id)
  })
  
  // 确保页面加载后也禁用缩放
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1)
    mainWindow.webContents.setZoomFactor(1)
  })

  // 加载渲染进程
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    if (filePath) {
      url.searchParams.set('file', filePath)
    }
    mainWindow.loadURL(url.toString())
  } else {
    const deepLink = filePath ? `file://${filePath}` : undefined
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: deepLink ? `file=${encodeURIComponent(filePath!)}` : undefined
    })
  }

  return mainWindow
}

// 文件树节点类型
interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

// 读取单层目录结构（按需加载）
async function readDirectory(dirPath: string): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    // 忽略隐藏文件和 node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

    const fullPath = join(dirPath, entry.name)
    
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children: [] // 子节点按需加载
      })
    } else if (entry.isFile() && (entry.name.endsWith('.mmd') || entry.name.endsWith('.mermaid') || entry.name.endsWith('.md'))) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'file'
      })
    }
  }

  // 排序：目录在前，文件在后，按名称排序
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

// 递归搜索文件内容
async function searchInDirectory(
  dirPath: string,
  query: string,
  options: { caseSensitive: boolean; wholeWord: boolean },
  results: SearchResult[] = []
): Promise<SearchResult[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    // 忽略隐藏文件和 node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      await searchInDirectory(fullPath, query, options, results)
    } else if (entry.isFile() && (entry.name.endsWith('.mmd') || entry.name.endsWith('.mermaid') || entry.name.endsWith('.md'))) {
      try {
        const content = await readFile(fullPath, 'utf-8')
        const lines = content.split('\n')

        // 构建正则表达式
        let pattern: RegExp
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (options.wholeWord) {
          pattern = new RegExp(`\\b${escapedQuery}\\b`, options.caseSensitive ? 'g' : 'gi')
        } else {
          pattern = new RegExp(escapedQuery, options.caseSensitive ? 'g' : 'gi')
        }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          let match: RegExpExecArray | null
          pattern.lastIndex = 0 // 重置正则状态

          while ((match = pattern.exec(line)) !== null) {
            results.push({
              filePath: fullPath,
              fileName: entry.name,
              lineNumber: i + 1,
              columnNumber: match.index + 1,
              lineContent: line,
              matchStart: match.index,
              matchEnd: match.index + match[0].length
            })
          }
        }
      } catch (error) {
        console.error('搜索文件失败:', fullPath, error)
      }
    }
  }

  return results
}

// IPC 处理
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (result.filePaths.length > 0) {
    const dir = result.filePaths[0]
    addRecentDir(dir)
    return dir
  }
  return null
})

ipcMain.handle('file:readTree', async (_, dirPath: string) => {
  try {
    return await readDirectory(dirPath)
  } catch (error) {
    console.error('读取目录失败:', error)
    return []
  }
})

// 开始监听目录变化
ipcMain.handle('file:watchDirectory', (event, dirPath: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    startWatching(win, dirPath)
  }
})

// 停止监听目录变化
ipcMain.handle('file:unwatchDirectory', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    stopWatching(win.id)
  }
})

ipcMain.handle('file:readContent', async (_, filePath: string) => {
  try {
    return await readFile(filePath, 'utf-8')
  } catch (error) {
    console.error('读取文件失败:', error)
    return null
  }
})

// 搜索文件内容
ipcMain.handle('file:search', async (_, dirPath: string, query: string, options?: { caseSensitive?: boolean; wholeWord?: boolean }) => {
  try {
    if (!query.trim()) return []
    return await searchInDirectory(dirPath, query, {
      caseSensitive: options?.caseSensitive ?? false,
      wholeWord: options?.wholeWord ?? false
    })
  } catch (error) {
    console.error('搜索失败:', error)
    return []
  }
})

ipcMain.handle('store:getRecentDir', () => {
  return store.get('recentDir')
})

// 获取历史目录列表
ipcMain.handle('store:getRecentDirs', () => {
  return getRecentDirs()
})

// 从历史记录打开目录（在新窗口）
ipcMain.handle('window:openFromHistory', async (_, dirPath: string) => {
  const win = await createWindow()
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('directory:opened', dirPath)
  })
  addRecentDir(dirPath)
  return win.id
})

// 创建新窗口
ipcMain.handle('window:new', async (_, filePath?: string) => {
  const win = await createWindow(filePath)
  return win.id
})

// 窗口控制 IPC
ipcMain.handle('window:minimize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.minimize()
})

ipcMain.handle('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  }
})

ipcMain.handle('window:close', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.close()
})

// 在文件夹中显示文件
ipcMain.handle('file:revealInFolder', (_, filePath: string) => {
  shell.showItemInFolder(filePath)
})

// 删除文件
ipcMain.handle('file:deleteFile', async (_, filePath: string) => {
  try {
    await unlink(filePath)
    return true
  } catch (error) {
    console.error('删除文件失败:', error)
    return false
  }
})

// 悬浮预览窗口集合
const floatingWindows = new Set<number>()

// 创建悬浮预览窗口
ipcMain.handle('window:openFloatingPreview', async (_, filePath: string) => {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    transparent: true,
    backgroundColor: '#1e1e1ecc',
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  floatingWindows.add(win.id)

  win.on('closed', () => {
    floatingWindows.delete(win.id)
  })

  // 加载预览页面
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    url.hash = `preview=${encodeURIComponent(filePath)}`
    win.loadURL(url.toString())
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: `preview=${encodeURIComponent(filePath)}`
    })
  }

  return win.id
})

// 移动窗口
ipcMain.handle('window:moveBy', async (_, deltaX: number, deltaY: number) => {
  const win = BrowserWindow.getFocusedWindow()
  if (win && floatingWindows.has(win.id)) {
    const bounds = win.getBounds()
    win.setBounds({
      x: bounds.x + deltaX,
      y: bounds.y + deltaY,
      width: bounds.width,
      height: bounds.height
    })
  }
})

// 应用启动
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.mermaid.gui')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 创建菜单
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开目录',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openDirectory']
            })
            if (result.filePaths.length > 0) {
              const win = BrowserWindow.getFocusedWindow()
              if (win) {
                win.webContents.send('directory:opened', result.filePaths[0])
              }
            }
          }
        },
        {
          label: '新建窗口',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})