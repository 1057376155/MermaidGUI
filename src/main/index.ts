import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readdir, readFile, stat } from 'fs/promises'
import Store from 'electron-store'

// 禁用 macOS 智能缩放和其他触摸手势
app.commandLine.appendSwitch('disable-pinch')
app.commandLine.appendSwitch('disable-features', 'TouchpadAndWheelScrollLatching')

// 存储最近打开的目录
const store = new Store<{ recentDir: string }>()

// 窗口管理
const windows = new Map<string, BrowserWindow>()

async function createWindow(filePath?: string): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
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
    mainWindow.webContents.setLayoutZoomLevelLimits(0, 0)
    // 开发模式下自动打开开发者工具
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })
  
  // 确保页面加载后也禁用缩放
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1)
    mainWindow.webContents.setLayoutZoomLevelLimits(0, 0)
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

// 递归读取目录结构
async function readDirectory(dirPath: string, maxDepth = 3, currentDepth = 0): Promise<FileNode[]> {
  if (currentDepth >= maxDepth) return []

  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    // 忽略隐藏文件和 node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

    const fullPath = join(dirPath, entry.name)
    
    if (entry.isDirectory()) {
      const children = await readDirectory(fullPath, maxDepth, currentDepth + 1)
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children
      })
    } else if (entry.isFile() && (entry.name.endsWith('.mmd') || entry.name.endsWith('.mermaid'))) {
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

// IPC 处理
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  
  if (result.filePaths.length > 0) {
    const dir = result.filePaths[0]
    store.set('recentDir', dir)
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

ipcMain.handle('file:readContent', async (_, filePath: string) => {
  try {
    return await readFile(filePath, 'utf-8')
  } catch (error) {
    console.error('读取文件失败:', error)
    return null
  }
})

ipcMain.handle('store:getRecentDir', () => {
  return store.get('recentDir')
})

// 创建新窗口
ipcMain.handle('window:new', async (_, filePath?: string) => {
  const win = await createWindow(filePath)
  return win.id
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