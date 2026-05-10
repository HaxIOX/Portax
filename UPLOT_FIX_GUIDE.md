# 🔧 uPlot 模块解析失败 - 解决方案

## 🐛 问题确认

错误信息：`Failed to resolve module specifier 'uplot'`

**原因分析**：
- ✅ uPlot 已安装（v1.6.32）
- ✅ node_modules/uplot 存在
- ❌ Vite 开发服务器无法解析模块

**根本原因**：Vite 开发服务器在 uPlot 安装**之前**启动，缓存了模块列表。

---

## ✅ 解决方案

### 方案 A：完全重启（推荐）⭐⭐⭐⭐⭐

```bash
# 1. 停止开发服务器（Ctrl+C）

# 2. 删除 Vite 缓存
rm -rf node_modules/.vite

# 3. 重新启动
npm run dev
```

### 方案 B：重新安装依赖

```bash
# 1. 停止开发服务器（Ctrl+C）

# 2. 删除 node_modules 和缓存
rm -rf node_modules package-lock.json

# 3. 重新安装
npm install

# 4. 启动
npm run dev
```

### 方案 C：使用 SVG 版本（当前）

```bash
# SVG 版本已恢复，无需操作
# 刷新浏览器即可看到曲线
```

---

## 🎯 推荐操作

### 立即执行（最简单）：

```bash
# 1. 停止开发服务器（在终端按 Ctrl+C）

# 2. 删除 Vite 缓存
rm -rf node_modules/.vite

# 3. 重新启动
npm run dev

# 4. 刷新浏览器（Ctrl+Shift+R）
```

---

## 📊 为什么会这样？

Vite 使用预构建优化来加速开发：
1. 首次启动时，Vite 扫描 `node_modules` 并预构建依赖
2. 预构建结果缓存在 `node_modules/.vite/`
3. 如果在服务器运行时安装新依赖，Vite 不会自动重新预构建
4. 导致新依赖无法被解析

**解决方法**：删除缓存，强制 Vite 重新预构建。

---

## 🔄 当前状态

- ✅ SVG 版本已恢复（可以正常使用）
- ✅ uPlot 已安装
- ⏳ 需要删除 Vite 缓存并重启

---

## 💡 两个选择

### 选择 1：继续使用 SVG 版本
- ✅ 立即可用
- ✅ 稳定可靠
- ❌ 性能较低（1000+ 数据点会卡顿）
- ❌ 无缩放和平移功能

### 选择 2：修复 uPlot 版本
- ✅ 性能提升 30-120 倍
- ✅ 支持 10000+ 数据点
- ✅ 拖拽、缩放功能
- ⏳ 需要删除缓存并重启（1 分钟）

---

## 🚀 如果选择修复 uPlot

请执行：

```bash
# 停止服务器（Ctrl+C）
rm -rf node_modules/.vite
npm run dev
```

然后在浏览器控制台验证：

```javascript
import('uplot').then(m => console.log('✅ 成功:', m.default));
```

应该看到 `✅ 成功: function uPlot(...)`

---

**当前建议**：先使用 SVG 版本，等有时间再修复 uPlot（只需 1 分钟）

**SVG 版本状态**：✅ 已恢复，刷新浏览器即可使用
