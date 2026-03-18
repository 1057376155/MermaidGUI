# MermaidGUI 项目打包指南

本文档详细介绍 MermaidGUI 项目的环境配置、依赖安装、编译和打包流程。

---

## 目录

1. [环境要求](#环境要求)
2. [获取项目](#获取项目)
3. [安装依赖](#安装依赖)
4. [编译项目](#编译项目)
5. [打包应用](#打包应用)
6. [常见问题](#常见问题)

---

## 环境要求

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18.x | 推荐使用 LTS 版本 |
| npm | >= 9.x | 随 Node.js 安装 |
| Git | 最新版 | 用于克隆项目 |

### 检查环境

```bash
# 检查 Node.js 版本
node -v

# 检查 npm 版本
npm -v

# 检查 Git 版本
git -v
```

---

## 获取项目

### 克隆仓库

```bash
git clone https://github.com/1057376155/MermaidGUI.git
```

### 进入项目目录

```bash
cd MermaidGUI
```

---

## 安装依赖

### 国内用户镜像配置（推荐）

由于 Electron 二进制文件托管在 GitHub，国内下载速度较慢或无法访问，需要配置镜像源。

#### 方法一：临时设置环境变量（推荐）

**Windows PowerShell:**
```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm install
```

**Windows CMD:**
```cmd
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

**macOS / Linux:**
```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

#### 方法二：配置 npm 镜像源

```bash
# 设置 npm 镜像源
npm config set registry https://registry.npmmirror.com

# 设置 Electron 镜像源
npm config set electron_mirror https://npmmirror.com/mirrors/electron/

# 安装依赖
npm install
```

#### 方法三：创建 .npmrc 文件

在项目根目录创建 `.npmrc` 文件：

```
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
```

然后执行：

```bash
npm install
```

### 安装依赖

```bash
npm install
```

安装完成后，项目结构如下：

```
MermaidGUI/
├── build/              # 构建资源（图标等）
├── node_modules/       # 依赖包
├── src/                # 源代码
│   ├── main/          # 主进程代码
│   ├── preload/       # 预加载脚本
│   └── renderer/      # 渲染进程（Vue 前端）
├── electron.vite.config.ts
├── package.json
└── tsconfig.json
```

---

## 编译项目

打包前必须先编译项目，将 TypeScript 源代码编译为 JavaScript。

### 编译命令

```bash
npm run build
```

### 编译输出

编译完成后会生成 `out` 目录：

```
out/
├── main/              # 主进程编译输出
│   └── index.js
├── preload/           # 预加载脚本编译输出
│   └── index.js
└── renderer/          # 渲染进程编译输出
    ├── assets/
    └── index.html
```

---

## 打包应用

### 打包命令

项目提供了多个打包命令：

| 命令 | 说明 | 输出格式 |
|------|------|----------|
| `npm run dist` | 打包当前平台 | 自动检测 |
| `npm run dist:win` | 打包 Windows 版本 | NSIS 安装包 (.exe) |
| `npm run dist:mac` | 打包 macOS 版本 | DMG |
| `npm run dist:linux` | 打包 Linux 版本 | AppImage / deb |
| `npm run dist:all` | 打包所有平台 | 全部格式 |

### Windows 打包

```bash
npm run dist:win
```

**输出文件：**
- `release/MermaidGUI Setup 1.0.0.exe` - 安装包
- `release/win-unpacked/` - 免安装版本

### macOS 打包

```bash
npm run dist:mac
```

**输出文件：**
- `release/MermaidGUI-1.0.0.dmg` - DMG 安装镜像
- `release/mac-arm64/` 或 `release/mac-x64/` - 应用程序包

### Linux 打包

```bash
npm run dist:linux
```

**输出文件：**
- `release/MermaidGUI-1.0.0.AppImage` - AppImage 格式
- `release/mermaid-gui_1.0.0_amd64.deb` - Debian 包

### 完整打包流程

**推荐流程（一键执行）：**

```bash
# Windows
npm run build && npm run dist:win

# macOS
npm run build && npm run dist:mac

# Linux
npm run build && npm run dist:linux
```

> **注意：** `electron-builder` 会自动检测 `out` 目录是否存在，如果不存在会自动执行编译。但建议显式执行 `npm run build` 以确保编译正确。

---

## 常见问题

### 1. 依赖安装失败 - 网络超时

**错误信息：**
```
npm error RequestError: read ECONNRESET
```

**解决方案：**
配置国内镜像源，参见 [安装依赖](#安装依赖) 章节。

### 2. 打包失败 - 找不到入口文件

**错误信息：**
```
Error: "out\main\index.js" was not found in this archive
```

**原因：** 未先编译项目，`out` 目录不存在。

**解决方案：**
```bash
npm run build
npm run dist:win
```

### 3. Windows 打包缺少图标

**错误信息：**
```
Error: Application icon is not defined
```

**解决方案：**
在 `build` 目录下放置 `icon.ico` 文件（Windows 图标格式）。

### 4. macOS 打包签名问题

**错误信息：**
```
Error: No identity found for signing
```

**解决方案：**
开发测试时可跳过签名，在 `package.json` 的 `build` 配置中添加：

```json
{
  "build": {
    "mac": {
      "identity": null
    }
  }
}
```

### 5. 清理重新构建

如果遇到奇怪的构建问题，可以尝试清理后重新构建：

```bash
# Windows PowerShell
Remove-Item -Recurse -Force node_modules, out, release -ErrorAction SilentlyContinue
npm install
npm run build
npm run dist:win

# macOS / Linux
rm -rf node_modules out release
npm install
npm run build
npm run dist:win
```

### 6. Electron 下载慢

**解决方案：**
使用镜像源或手动下载：

```bash
# 设置镜像
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

# 或手动下载后放到缓存目录
# Windows: %LOCALAPPDATA%\electron\Cache
# macOS: ~/Library/Caches/electron
# Linux: ~/.cache/electron
```

---

## 项目配置说明

### package.json 关键配置

```json
{
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.mermaid.gui",
    "productName": "MermaidGUI",
    "directories": {
      "output": "release",
      "buildResources": "build"
    }
  }
}
```

### 目录说明

| 目录 | 说明 |
|------|------|
| `src/main` | Electron 主进程代码 |
| `src/preload` | 预加载脚本 |
| `src/renderer` | Vue 前端代码 |
| `build` | 构建资源（图标、安装程序背景等） |
| `out` | 编译输出目录 |
| `release` | 打包输出目录 |

---

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **Vue 3** - 前端框架
- **TypeScript** - 类型安全的 JavaScript
- **electron-vite** - Electron 构建工具
- **electron-builder** - 打包工具
- **Mermaid** - 流程图渲染库

---

## 相关链接

- [Electron 官方文档](https://www.electronjs.org/docs)
- [electron-builder 文档](https://www.electron.build/)
- [electron-vite 文档](https://electron-vite.org/)
- [Vue 3 文档](https://vuejs.org/)
- [Mermaid 文档](https://mermaid.js.org/)