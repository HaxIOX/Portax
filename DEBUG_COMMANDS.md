# 🔍 浏览器控制台调试命令

## 请在浏览器控制台（F12 → Console）中依次运行以下命令：

### 1. 检查 uPlot 是否加载
```javascript
console.log('uPlot available:', typeof uPlot !== 'undefined');
```

### 2. 检查图表容器
```javascript
const containers = document.querySelectorAll('[class*="waveform"], [class*="chart"]');
console.log('Chart containers found:', containers.length);
containers.forEach((c, i) => {
  console.log(`Container ${i}:`, {
    width: c.offsetWidth,
    height: c.offsetHeight,
    display: window.getComputedStyle(c).display
  });
});
```

### 3. 检查 Canvas 元素
```javascript
const canvases = document.querySelectorAll('canvas');
console.log('Canvas elements found:', canvases.length);
canvases.forEach((c, i) => {
  console.log(`Canvas ${i}:`, {
    width: c.width,
    height: c.height,
    visible: c.offsetWidth > 0 && c.offsetHeight > 0
  });
});
```

### 4. 检查是否显示加载或无信号状态
```javascript
const loadingText = document.body.innerText;
console.log('Shows "Loading Chart":', loadingText.includes('Loading Chart'));
console.log('Shows "No Signal":', loadingText.includes('No Signal'));
```

### 5. 检查 React 组件状态
```javascript
// 查找所有文本内容
const allText = document.body.innerText;
console.log('Page contains:', {
  hasLoadingChart: allText.includes('Loading Chart'),
  hasNoSignal: allText.includes('No Signal'),
  hasMonitor: allText.includes('Monitor'),
  hasWaveform: allText.includes('Waveform')
});
```

---

## 📊 根据结果判断

### 如果看到 "Loading Chart..."
**原因**: uPlot 正在加载或加载失败
**解决方案**: 
1. 等待 5-10 秒
2. 如果仍然显示，说明 uPlot 加载失败
3. 检查网络连接
4. 尝试重新安装：`npm install uplot`

### 如果看到 "No Signal"
**原因**: 图表已加载，但没有数据
**解决方案**: 
1. 连接串口设备
2. 发送测试数据（例如：`25.5, 60.2`）
3. 或点击 "Simulate RX" 按钮

### 如果看到 Canvas 元素
**原因**: 图表已渲染
**解决方案**: 
1. 检查 Canvas 尺寸是否 > 0
2. 发送数据测试曲线显示

### 如果什么都没有
**原因**: 组件未渲染或容器隐藏
**解决方案**: 
1. 检查是否打开了 Monitor 视图
2. 点击左上角菜单 → Monitor

---

## 🎯 快速测试

### 测试 1: 打开 Monitor 视图
1. 点击左上角的菜单按钮（三条横线）
2. 点击 "Monitor"
3. 查看是否显示图表区域

### 测试 2: 模拟数据
1. 点击菜单 → "Simulate RX"
2. 查看是否出现曲线

### 测试 3: 发送真实数据
1. 在输入框输入：`25.5, 60.2`
2. 点击 "SEND COMMAND"
3. 查看是否出现曲线

---

## 📝 请告诉我

运行上述命令后，请告诉我：
1. **是否看到 "Loading Chart..." 或 "No Signal"？**
2. **Canvas 元素数量是多少？**
3. **Canvas 尺寸是多少？**
4. **是否打开了 Monitor 视图？**

这样我就能准确定位问题了！
