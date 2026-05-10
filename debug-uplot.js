// 在浏览器控制台运行这个命令来检查详细错误

// 1. 检查是否有模块加载错误
console.log('=== 检查错误 ===');
const errors = [];
window.addEventListener('error', (e) => {
  errors.push(e);
  console.error('Error caught:', e.message);
});

// 2. 尝试手动导入 uPlot
console.log('=== 尝试手动导入 ===');
import('uplot')
  .then(module => {
    console.log('✅ uPlot 导入成功:', module);
    console.log('uPlot constructor:', module.default);
  })
  .catch(err => {
    console.error('❌ uPlot 导入失败:', err);
    console.error('错误详情:', err.message);
    console.error('错误堆栈:', err.stack);
  });

// 3. 检查 node_modules
console.log('=== 检查模块路径 ===');
fetch('/node_modules/uplot/package.json')
  .then(r => r.json())
  .then(pkg => console.log('✅ uPlot package.json:', pkg.version))
  .catch(e => console.error('❌ 无法访问 uPlot package.json:', e));
