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
      watchDirectory: (dirPath: string) => Promise<void>
      unwatchDirectory: () => Promise<void>
      onDirectoryChanged: (callback: (dirPath: string) => void) => () => void
      searchInFiles: (dirPath: string, query: string, options?: { caseSensitive?: boolean; wholeWord?: boolean }) => Promise<SearchResult[]>
    }
  }
}

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface SearchResult {
  filePath: string
  fileName: string
  lineNumber: number
  columnNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

export type { FileNode, SearchResult }