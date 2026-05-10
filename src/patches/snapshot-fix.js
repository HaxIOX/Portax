// 📝 快照功能修复补丁
// 用于支持 uPlot (Canvas) 的快照功能

/**
 * 修改 App.jsx 中的 handleChartSnapshot 函数
 *
 * 原因：uPlot 使用 Canvas 渲染，不能直接使用 SVG 序列化
 * 解决方案：直接从 Canvas 获取图像数据
 */

// ============================================
// 方案一：简化版（推荐）
// ============================================
const handleChartSnapshot = useCallback(() => {
  // 查找 uPlot 的 Canvas 元素
  const canvas = document.querySelector('.uplot canvas');

  if (!canvas) {
    setCopyFeedback("No Chart");
    setTimeout(() => setCopyFeedback(null), 1000);
    return;
  }

  try {
    // 直接从 Canvas 获取 PNG 数据
    const pngUrl = canvas.toDataURL('image/png');

    // 获取当前数据点
    const lastPoint = plotData[plotData.length - 1];
    const meta = {
      timestamp: new Date().toLocaleString(),
      values: lastPoint ? lastPoint.values : []
    };

    // 保存快照
    setSnapshots(prev => [...prev, { id: Date.now(), url: pngUrl, meta }]);
    setCopyFeedback("Snapshot Stored");
    setTimeout(() => setCopyFeedback(null), 1000);
  } catch (error) {
    console.error('Snapshot failed:', error);
    setCopyFeedback("Snapshot Failed");
    setTimeout(() => setCopyFeedback(null), 1000);
  }
}, [plotData]);


// ============================================
// 方案二：增强版（带网格和标注）
// ============================================
const handleChartSnapshot = useCallback(() => {
  const canvas = document.querySelector('.uplot canvas');

  if (!canvas) {
    setCopyFeedback("No Chart");
    setTimeout(() => setCopyFeedback(null), 1000);
    return;
  }

  try {
    // 创建新的 Canvas 用于合成
    const outputCanvas = document.createElement('canvas');
    const scale = 2; // 高清输出
    const padding = 40;

    outputCanvas.width = canvas.width * scale + padding * 2;
    outputCanvas.height = canvas.height * scale + padding * 2;

    const ctx = outputCanvas.getContext('2d');

    // 1. 填充背景
    ctx.fillStyle = isDark ? "#1E1F20" : "#FFFFFF";
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

    // 2. 绘制网格
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    const cols = 10;
    const rows = 6;
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    const startX = padding;
    const startY = padding;

    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(startX + (drawW / cols) * i, startY);
      ctx.lineTo(startX + (drawW / cols) * i, startY + drawH);
      ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(startX, startY + (drawH / rows) * i);
      ctx.lineTo(startX + drawW, startY + (drawH / rows) * i);
      ctx.stroke();
    }

    // 3. 绘制图表
    ctx.drawImage(canvas, startX, startY, drawW, drawH);

    // 4. 绘制图例
    const lastPoint = plotData[plotData.length - 1];
    if (lastPoint) {
      let legendY = padding + 10;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "right";

      seriesConfig.forEach((conf, idx) => {
        if (conf.visible) {
          ctx.fillStyle = SERIES_COLORS[idx % 4];
          const val = lastPoint.values[idx]?.toFixed(2) || '--';
          ctx.fillText(`${conf.name}: ${val}`, outputCanvas.width - padding - 10, legendY);
          legendY += 20;
        }
      });
    }

    // 5. 保存快照
    const pngUrl = outputCanvas.toDataURL('image/png');
    const meta = {
      timestamp: new Date().toLocaleString(),
      values: lastPoint ? lastPoint.values : []
    };

    setSnapshots(prev => [...prev, { id: Date.now(), url: pngUrl, meta }]);
    setCopyFeedback("Snapshot Stored");
    setTimeout(() => setCopyFeedback(null), 1000);
  } catch (error) {
    console.error('Snapshot failed:', error);
    setCopyFeedback("Snapshot Failed");
    setTimeout(() => setCopyFeedback(null), 1000);
  }
}, [isDark, plotData, seriesConfig]);


// ============================================
// 使用说明
// ============================================

/**
 * 1. 在 App.jsx 中找到 handleChartSnapshot 函数
 * 2. 替换为上面的方案一（简化版）或方案二（增强版）
 * 3. 确保依赖项正确：
 *    - 方案一：[plotData]
 *    - 方案二：[isDark, plotData, seriesConfig]
 * 4. 测试快照功能
 */

// ============================================
// 注意事项
// ============================================

/**
 * 1. Canvas 跨域问题
 *    - 如果图表包含外部图片，可能会有跨域限制
 *    - 解决方案：确保所有资源同源或配置 CORS
 *
 * 2. 高 DPI 屏幕
 *    - 使用 scale = 2 可以在高 DPI 屏幕上获得更清晰的图像
 *    - 可以根据 window.devicePixelRatio 动态调整
 *
 * 3. 性能考虑
 *    - 方案一更快，适合频繁快照
 *    - 方案二更美观，适合导出报告
 */

export { handleChartSnapshot };
