#!/bin/bash

echo "🔍 Portax 项目结构验证"
echo "================================"
echo ""

echo "📁 检查目录结构..."
for dir in src/components src/hooks src/utils src/constants src/types src/contexts src/components/modals; do
  if [ -d "$dir" ]; then
    echo "✅ $dir"
  else
    echo "❌ $dir (缺失)"
  fi
done

echo ""
echo "📄 检查关键文件..."
files=(
  "src/components/WaveformChart.jsx"
  "src/components/LogViewer.jsx"
  "src/components/Sidebar.jsx"
  "src/components/ErrorBoundary.jsx"
  "src/components/modals/SaveMacroModal.jsx"
  "src/components/modals/MacroManagerModal.jsx"
  "src/components/modals/SnapshotGalleryModal.jsx"
  "src/components/modals/ConnectModal.jsx"
  "src/hooks/usePersistedState.js"
  "src/utils/serialUtils.js"
  "src/utils/timeUtils.js"
  "src/utils/dataParser.js"
  "src/utils/logger.js"
  "src/constants/config.js"
  ".prettierrc"
  ".prettierignore"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file" 2>/dev/null || echo "0")
    echo "✅ $file ($lines 行)"
  else
    echo "❌ $file (缺失)"
  fi
done

echo ""
echo "📊 代码统计..."
echo "App.jsx: $(wc -l < src/App.jsx 2>/dev/null || echo '0') 行"
echo "组件总数: $(find src/components -name "*.jsx" 2>/dev/null | wc -l)"
echo "工具函数: $(find src/utils -name "*.js" 2>/dev/null | wc -l)"
echo "Hooks: $(find src/hooks -name "*.js" 2>/dev/null | wc -l)"

echo ""
echo "✨ 验证完成！"
