# App Icons

请将图标文件放入此目录：

- `icon.png` - Linux 图标 (推荐 512x512 或 1024x1024)
- `icon.ico` - Windows 图标 (推荐 256x256 多尺寸 ICO)
- `icon.icns` - macOS 图标 (推荐 1024x1024 ICNS)

## 图标规格

### Linux (icon.png)
- 格式: PNG
- 尺寸: 512x512 或 1024x1024
- 背景: 透明

### Windows (icon.ico)
- 格式: ICO (多尺寸)
- 推荐包含尺寸: 16x16, 32x32, 48x48, 256x256
- 背景: 透明

### macOS (icon.icns)
- 格式: ICNS
- 尺寸: 1024x1024 (会生成所有需要的尺寸)
- 背景: 透明

## 生成工具

可以使用以下工具生成图标：
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [app-icon](https://www.npmjs.com/package/app-icon)
- 在线 ICO 转换器

## 快捷生成命令

如果你有一张 1024x1024 的基础图标 `icon.png`，可以使用以下命令生成所有平台图标：

```bash
# 使用 electron-icon-builder
npx electron-icon-builder --input=./build/icon.png --output=./build
```
