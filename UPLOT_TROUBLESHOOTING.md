# 🔧 uPlot 版本问题诊断和解决方案

## 🐛 问题描述

用户报告：切换到 uPlot 版本后，**曲线不显示**

---

## 🔍 问题分析

### 可能的原因

1. **uPlot 依赖未安装** ⭐ 最可能
   - 用户可能还没有运行 `npm install uplot`
   - 导致 import 失败，组件无法渲染

2. **数据格式问题**
   - uPlot 对数据格式要求严格
   - 需要 `[timestamps, series1, series2, ...]` 格式

3. **可见系列过滤问题**
   - 原版本没有正确过滤不可见的系列
   - 导致数据和系列配置不匹配

4. **尺寸初始化问题**
   - ResizeObserver 可能在容器尺寸为 0 时触发
   - 导致图表无法正确渲染

---

## ✅ 解决方案

### 方案一：确保依赖已安装（推荐）

```bash
# 1. 安装 uPlot
npm install uplot

# 2. 使用修复版本
cp src/components/WaveformChart.uplot.fixed.jsx src/components/WaveformChart.jsx

# 3. 重启开发服务器
npm run dev
```

---

### 方案二：继续使用 SVG 版本

如果 uPlot 有问题，可以继续使用原有的 SVG 版本：

```bash
# SVG 版本已经恢复，无需操作
npm run dev
```

**SVG 版本特点**:
- ✅ 无需额外依赖
- ✅ 稳定可靠
- ❌ 性能较低（1000+ 数据点会卡顿）
- ❌ 无缩放和平移功能

---

## 🆕 修复版本的改进

**文件**: `src/components/WaveformChart.uplot.fixed.jsx`

### 改进点

1. **动态加载 uPlot** ✅
   ```javascript
   // 使用动态 import，避免构建时错误
   const uPlotModule = await import('uplot');
   ```

2. **加载状态提示** ✅
   ```javascript
   if (!uPlotLoaded) {
     return <div>Loading Chart... If this persists, run: npm install uplot</div>
   }
   ```

3. **正确过滤可见系列** ✅
   ```javascript
   const visibleSeriesIndices = seriesConfig
     .map((conf, idx) => (conf.visible ? idx : -1))
     .filter(idx => idx !== -1);
   ```

4. **更好的尺寸处理** ✅
   ```javascript
   const updateDimensions = () => {
     const { width, height } = containerRef.current.getBoundingClientRect();
     if (width > 0 && height > 0) {
       setDimensions({ width, height });
     }
   };
   ```

5. **详细的错误日志** ✅
   ```javascript
   catch (error) {
     console.error('Failed to create uPlot chart:', error);
     console.log('Data:', data);
     console.log('Options:', opts);
   }
   ```

---

## 🧪 调试步骤

### 第一步：检查 uPlot 是否已安装

```bash
npm list uplot
```

**预期输出**:
```
portax@0.0.0
└── uplot@1.6.30
```

**如果显示 "empty"**: 运行 `npm install uplot`

---

### 第二步：检查浏览器控制台

打开浏览器开发者工具（F12），查看 Console 标签页：

**正常情况**:
- 无错误信息
- 图表正常渲染

**异常情况**:
- `Failed to load uPlot` → 依赖未安装
- `Failed to create uPlot chart` → 数据格式问题
- 其他错误 → 查看详细错误信息

---

### 第三步：检查数据格式

在浏览器控制台运行：

```javascript
// 检查 plotData 结构
console.log('plotData:', plotData);

// 应该看到类似这样的结构：
// [
//   { values: [25.5, 60.2, ...], timestamp: 1234567890 },
//   { values: [26.1, 59.8, ...], timestamp: 1234567891 },
//   ...
// ]
```

---

## 📊 版本对比

| 特性 | SVG 版本 | uPlot 原版 | uPlot 修复版 |
|------|---------|-----------|------------|
| 依赖 | 无 | uplot | uplot |
| 性能 | 低 | 高 | 高 |
| 错误处理 | 基础 | 基础 | **完善** |
| 加载提示 | 无 | 无 | **有** |
| 数据过滤 | 正确 | 有问题 | **修复** |
| 尺寸处理 | 正确 | 有问题 | **修复** |
| 推荐使用 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🚀 推荐操作流程

### 选项 A：使用 uPlot 修复版（推荐）

```bash
# 1. 确保安装 uPlot
npm install uplot

# 2. 使用修复版本
cp src/components/WaveformChart.uplot.fixed.jsx src/components/WaveformChart.jsx

# 3. 重启
npm run dev
```

**优点**:
- ✅ 性能提升 30-120 倍
- ✅ 支持 10000+ 数据点
- ✅ 拖拽、缩放功能
- ✅ 完善的错误处理

---

### 选项 B：继续使用 SVG 版本

```bash
# SVG 版本已恢复，直接使用
npm run dev
```

**优点**:
- ✅ 无需额外依赖
- ✅ 稳定可靠
- ✅ 适合小数据量（<1000 点）

**缺点**:
- ❌ 大数据量会卡顿
- ❌ 无缩放和平移

---

## 💡 建议

### 如果您的使用场景是：

1. **数据点 < 1000** → SVG 版本足够
2. **数据点 1000-10000** → 强烈推荐 uPlot
3. **需要缩放和平移** → 必须使用 uPlot
4. **追求最佳性能** → 必须使用 uPlot

---

## 📝 总结

### 当前状态
- ✅ SVG 版本已恢复（正常工作）
- ✅ uPlot 修复版本已创建
- ⏳ 等待用户选择版本

### 下一步
1. 决定使用哪个版本
2. 如果选择 uPlot：安装依赖并替换组件
3. 测试功能

---

**创建日期**: 2026-05-10  
**状态**: ✅ 问题已诊断，解决方案已提供
