declare global {
  interface Window {
    api: {
      openDirectory: () => Promise<string | null>
      readTree: (dirPath: string) => Promise<FileNode[]>
      readFile: (filePath: string) => Promise<string | null>
      getRecentDir: () => Promise<string | undefined>
      newWindow: (filePath?: string) => Promise<number>
      onDirectoryOpened: (callback: (dirPath: string) => void) => () => void
      minimizeWindow: () => Promise<void>
      maximizeWindow: () => Promise<void>
      closeWindow: () => Promise<void>
      onWindowMaximized: (callback: (isMaximized: boolean) => void) => () => void
      revealInFolder: (filePath: string) => Promise<void>
      deleteFile: (filePath: string) => Promise<boolean>
      openFloatingPreview: (filePath: string) => Promise<number>
      moveWindow: (deltaX: number, deltaY: number) => Promise<void>
      getRecentDirs: () => Promise<string[]>
      openFromHistory: (dirPath: string) => Promise<number>
    }
  }
}

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export type { FileNode }