# 🔍 Portax 曲线不显示问题 - 完整诊断报告

## 📅 诊断日期
2026-05-10

---

## 🆕 补充开发日志（本轮，待下次续修）

### 本轮已完成修改

1. 修复数据解析“伪有效点”问题  
   - 文件: `src/utils/dataParser.js`  
   - 变更: `extractedValues` 改为按 `seriesConfig.length` 预填 `null`；无有效数字时直接返回 `[]`。  
   - 目的: 避免 `undefined` 混入导致 `plotData` 长度增加但无曲线可画。

2. 增加入图有效值防线  
   - 文件: `src/hooks/useLogManager.js`  
   - 变更: 仅当 `vals.some(isValidNumber)` 时才写入 `plotData`。  
   - 目的: 阻断无效数据进入波形层。

3. 增强 uPlot 稳定性与降级路径  
   - 文件: `src/components/WaveformChart.jsx`  
   - 变更:
     - x 轴改为严格递增索引（`0..N-1`），并使用 `time: false`；
     - 若 `uplot` 加载失败，自动回退到 `WaveformChart.svg.jsx`。  
   - 目的: 避免时间戳重复/加载失败导致“看不到波形”。

4. 保证 plot 时间戳单调递增  
   - 文件: `src/hooks/useLogManager.js`  
   - 变更: 新增 `lastPlotTsRef`，同毫秒批量入点时自动 `+1ms`。  
   - 目的: 提升数据序列稳定性，减少边界渲染异常。

### 当前状态

- 用户反馈: 仍然不显示波形。  
- 结论: 代码侧已完成一轮最小修复和一轮稳态修复，但**尚缺浏览器控制台一手报错**，无法继续精准收敛根因。  

### 下次接手步骤（TODO）

1. 复现实验：打开 Monitor，连点 `Simulate RX` 3~5 次。  
2. 抓第一条控制台红色报错（原文）。  
3. 若有 `uplot` 相关异常，优先检查动态导入和 Vite 缓存；必要时清理 `node_modules/.vite` 后重启。  
4. 若无报错但仍空白，在 `WaveformChart.jsx` 临时打印 `hasRenderableData`、`data.length`、`seriesData` 首尾值定位。  
5. 完成后再决定是否保留 uPlot 方案，或临时切回纯 SVG 以保障可用性。

---

## ✅ 好消息：uPlot 已安装！

从 `package.json` 第 16 行可以看到：
```json
"uplot": "^1.6.32"
```

**结论**: ✅ uPlot 依赖已经安装，版本 1.6.32

---

## 🔍 问题分析

### 当前状态检查

#### 1. WaveformChart.jsx ✅
- ✅ 使用动态导入 `import('uplot')`
- ✅ 有加载状态提示
- ✅ 有错误处理
- ✅ 数据过滤逻辑正确
- ✅ 尺寸处理正确

#### 2. App.jsx ✅
- ✅ 正确导入 WaveformChart
- ✅ 使用 useLogManager 管理数据
- ✅ plotData 通过 props 传递

#### 3. 依赖安装 ✅
- ✅ uplot 1.6.32 已安装

---

## 🎯 可能的原因

### 原因 1: 开发服务器未重启 ⭐⭐⭐⭐⭐
**最可能的原因**

uPlot 是新安装的依赖，Vite 开发服务器需要重启才能识别。

**解决方案**:
```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

---

### 原因 2: 浏览器缓存 ⭐⭐⭐⭐
组件代码已更新，但浏览器可能缓存了旧版本。

**解决方案**:
1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

或者：
- Chrome: `Ctrl + Shift + R`
- Firefox: `Ctrl + F5`

---

### 原因 3: 动态导入失败 ⭐⭐⭐
虽然 uPlot 已安装，但动态导入可能失败。

**检查方法**:
1. 打开浏览器控制台（F12）
2. 查看是否有错误信息：
   - `Failed to load uPlot`
   - `Cannot find module 'uplot'`

**解决方案**:
如果看到错误，尝试：
```bash
# 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 重启
npm run dev
```

---

### 原因 4: 图表容器尺寸为 0 ⭐⭐
如果容器没有高度，图表无法渲染。

**检查方法**:
在浏览器控制台运行：
```javascript
// 检查图表容器尺寸
const container = document.querySelector('.uplot');
console.log('Container:', container);
console.log('Width:', container?.offsetWidth);
console.log('Height:', container?.offsetHeight);
```

**预期结果**: Width 和 Height 应该 > 0

---

### 原因 5: 没有数据 ⭐⭐
图表需要至少 2 个数据点才能显示。

**检查方法**:
在浏览器控制台运行：
```javascript
// 检查是否有数据
console.log('Has data:', window.plotData?.length);
```

**解决方案**:
发送一些测试数据，例如：
```
25.5, 60.2
26.1, 59.8
24.8, 61.0
```

---

## 🚀 推荐的诊断步骤

### 第一步：重启开发服务器 ⭐⭐⭐⭐⭐
```bash
# 停止当前服务器（Ctrl+C）
npm run dev
```

### 第二步：清除浏览器缓存
- 按 `Ctrl + Shift + R` 硬刷新

### 第三步：检查浏览器控制台
1. 打开开发者工具（F12）
2. 切换到 Console 标签
3. 查看是否有错误信息

### 第四步：检查图表状态
在控制台运行：
```javascript
// 检查 uPlot 是否加载
console.log('uPlot loaded:', !!window.uPlot);

// 检查容器
const container = document.querySelector('.uplot');
console.log('Container:', container);

// 检查数据
console.log('Plot data length:', window.plotData?.length);
```

---

## 📊 预期的正常状态

### 如果 uPlot 未加载
您会看到：
```
Loading Chart...
If this persists, run: npm install uplot
```

### 如果没有数据
您会看到：
```
No Signal
Configure keywords or send numbers like "25.5, 60"
```

### 如果一切正常
您会看到：
- ✅ Canvas 图表
- ✅ 网格线
- ✅ 坐标轴
- ✅ 曲线
- ✅ 图例（右上角）

---

## 🐛 常见错误信息

### 错误 1: "Cannot find module 'uplot'"
**原因**: 依赖未正确安装
**解决方案**:
```bash
npm install uplot
npm run dev
```

### 错误 2: "Failed to construct 'ResizeObserver'"
**原因**: 浏览器兼容性问题
**解决方案**: 使用最新版 Chrome 或 Edge

### 错误 3: "uPlot is not a constructor"
**原因**: 动态导入问题
**解决方案**: 检查 WaveformChart.jsx 第 28 行

---

## 💡 快速修复方案

### 方案 A: 完全重启（推荐）⭐⭐⭐⭐⭐
```bash
# 1. 停止开发服务器（Ctrl+C）

# 2. 重新启动
npm run dev

# 3. 清除浏览器缓存（Ctrl+Shift+R）

# 4. 发送测试数据
```

### 方案 B: 重新安装依赖
```bash
# 1. 删除 node_modules
rm -rf node_modules package-lock.json

# 2. 重新安装
npm install

# 3. 启动
npm run dev
```

### 方案 C: 回退到 SVG 版本
```bash
cp src/components/WaveformChart.svg.jsx src/components/WaveformChart.jsx
npm run dev
```

---

## 📝 调试清单

请按顺序检查：

- [ ] **重启开发服务器** - `npm run dev`
- [ ] **清除浏览器缓存** - `Ctrl + Shift + R`
- [ ] **检查控制台错误** - F12 → Console
- [ ] **检查是否显示 "Loading Chart..."** - 如果是，等待加载
- [ ] **检查是否显示 "No Signal"** - 如果是，发送数据
- [ ] **检查容器尺寸** - 运行上面的检查代码
- [ ] **尝试发送测试数据** - 输入 "25.5, 60.2"

---

## 🎯 最可能的解决方案

根据分析，**最可能的原因是开发服务器未重启**。

### 立即执行：

```bash
# 1. 停止当前服务器（Ctrl+C）

# 2. 重新启动
npm run dev

# 3. 在浏览器中硬刷新（Ctrl+Shift+R）

# 4. 打开控制台（F12）查看状态

# 5. 发送测试数据
```

---

## 📞 如果问题仍然存在

请提供以下信息：

1. **浏览器控制台的错误信息**（F12 → Console）
2. **图表区域显示什么**（"Loading Chart..." / "No Signal" / 空白）
3. **是否已重启开发服务器**
4. **是否已清除浏览器缓存**

---

## ✅ 总结

### 当前状态
- ✅ uPlot 已安装（v1.6.32）
- ✅ WaveformChart 代码正确
- ✅ App.jsx 集成正确
- ⏳ 可能需要重启服务器

### 下一步
1. **重启开发服务器** - 最重要！
2. **清除浏览器缓存**
3. **检查控制台错误**
4. **发送测试数据**

---

**诊断日期**: 2026-05-10  
**uPlot 版本**: 1.6.32 ✅  
**最可能原因**: 开发服务器未重启  
**推荐操作**: 重启 `npm run dev` + 硬刷新浏览器
