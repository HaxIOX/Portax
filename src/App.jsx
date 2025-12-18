// import React, { useState, useRef, useEffect } from 'react';
// import { 
//   Terminal, 
//   Settings, 
//   Download, 
//   Trash2, 
//   Play, 
//   Square, 
//   Highlighter, 
//   Send,
//   AlertCircle,
//   Zap,
//   Activity,
//   Cpu,
//   Command,
//   Radio,
//   Binary,
//   Copy,
//   Plus,
//   X,
//   Pause,
//   Edit2,
//   Save,
//   RefreshCw,
//   MoreHorizontal,
//   Plug,
//   Search,
//   Usb,
//   Monitor,
//   Unplug,
//   Hash,
//   Filter,
//   ChevronDown,
//   Check,
//   ArrowUp,
//   ArrowDown
// } from 'lucide-react';

// export default function App() {
//   // --- 状态定义 ---

//   // 串口相关
//   const [port, setPort] = useState(null);
//   const [availablePorts, setAvailablePorts] = useState([]); 
//   const [isConnected, setIsConnected] = useState(false);
  
//   // 核心引用
//   const readerRef = useRef(null);
//   const writerRef = useRef(null);
//   const readableStreamClosedRef = useRef(null);
//   const writableStreamClosedRef = useRef(null);
//   const baudRef = useRef(null);
//   const bufferRef = useRef('');
  
//   // 界面交互状态
//   const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
//   const [isBaudDropdownOpen, setIsBaudDropdownOpen] = useState(false);
//   const [portSearchQuery, setPortSearchQuery] = useState('');
//   const [isPaused, setIsPaused] = useState(false);
//   const isPausedRef = useRef(false);

//   // 日志相关
//   const [logs, setLogs] = useState([]);
//   const [autoScroll, setAutoScroll] = useState(true);
//   const logsEndRef = useRef(null);
//   const [viewMode, setViewMode] = useState('ascii'); // 'ascii' | 'hex'
//   const [logFilter, setLogFilter] = useState('');

//   // --- 持久化状态 (localStorage) - 增强版 ---
//   const usePersistedState = (key, defaultValue) => {
//     const [state, setState] = useState(() => {
//       try {
//         const storedValue = localStorage.getItem(key);
//         return storedValue ? JSON.parse(storedValue) : defaultValue;
//       } catch (error) {
//         console.error(`Error parsing localStorage key "${key}":`, error);
//         return defaultValue;
//       }
//     });

//     useEffect(() => {
//       try {
//         localStorage.setItem(key, JSON.stringify(state));
//       } catch (error) {
//         console.error(`Error setting localStorage key "${key}":`, error);
//       }
//     }, [key, state]);

//     return [state, setState];
//   };

//   // 使用持久化状态
//   const [baudRate, setBaudRate] = usePersistedState('serial_baudrate', 115200);
//   const [highlightKeyword, setHighlightKeyword] = usePersistedState('serial_highlight_kw', '');
//   const [highlightColor, setHighlightColor] = usePersistedState('serial_highlight_color', 'text-amber-400 bg-amber-400/10 border-amber-400/20');
//   const [quickCommands, setQuickCommands] = usePersistedState('serial_quick_cmds', [
//     { id: 1, label: 'AT Test', cmd: 'AT' },
//     { id: 2, label: 'Reset', cmd: 'AT+RST' },
//     { id: 3, label: 'Version', cmd: 'AT+GMR' },
//     { id: 4, label: 'Scan', cmd: 'AT+CWLAP' },
//     { id: 5, label: 'IP Addr', cmd: 'AT+CIFSR' },
//   ]);
//   const [useHexSend, setUseHexSend] = usePersistedState('serial_use_hex_send', false);
//   const [lineEnding, setLineEnding] = usePersistedState('serial_line_ending', '\\n'); // none, \n, \r, \r\n

//   // 发送相关
//   const [inputText, setInputText] = useState('');
//   const [showTimestamp, setShowTimestamp] = useState(true);
//   const [isEditingCmds, setIsEditingCmds] = useState(false);
//   const [copyFeedback, setCopyFeedback] = useState(null);

//   // 历史记录相关
//   const [sendHistory, setSendHistory] = useState([]);
//   const [historyIndex, setHistoryIndex] = useState(-1); // -1 表示当前输入

//   // 浏览器兼容性
//   const isWebSerialSupported = 'serial' in navigator;

//   // --- Effect Hooks ---

//   useEffect(() => {
//     document.title = "SerialFlux - Pro Web Debugger";
//   }, []);

//   useEffect(() => {
//     isPausedRef.current = isPaused;
//   }, [isPaused]);

//   // 点击外部关闭波特率下拉
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (baudRef.current && !baudRef.current.contains(event.target)) {
//         setIsBaudDropdownOpen(false);
//       }
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, []);

//   // 端口监听
//   useEffect(() => {
//     if (!isWebSerialSupported) return;
//     const updatePorts = async () => {
//       try {
//         const ports = await navigator.serial.getPorts();
//         setAvailablePorts(ports);
//       } catch (e) { console.error(e); }
//     };
//     updatePorts();
//     const handleConnectEvent = () => updatePorts();
//     const handleDisconnectEvent = (e) => {
//       updatePorts();
//       if (port === e.target) disconnectPort();
//     };
//     navigator.serial.addEventListener('connect', handleConnectEvent);
//     navigator.serial.addEventListener('disconnect', handleDisconnectEvent);
//     return () => {
//       navigator.serial.removeEventListener('connect', handleConnectEvent);
//       navigator.serial.removeEventListener('disconnect', handleDisconnectEvent);
//     };
//   }, [port]);

//   // 自动滚动
//   useEffect(() => {
//     if (autoScroll && !isPaused && logsEndRef.current && !logFilter) {
//       logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
//     }
//   }, [logs, autoScroll, viewMode, isPaused, logFilter]);

//   // --- 核心逻辑 ---

//   const openPort = async (selectedPort) => {
//     try {
//       if (!selectedPort) return;
//       if (port && isConnected) await disconnectPort();

//       // 确保 baudRate 是数字，防止从 localStorage 读到奇怪的东西导致连接失败
//       const baud = parseInt(baudRate) || 115200;
//       await selectedPort.open({ baudRate: baud });
      
//       setPort(selectedPort);
//       setIsConnected(true);
//       setIsPaused(false);
//       setIsConnectModalOpen(false);
//       bufferRef.current = '';

//       const ports = await navigator.serial.getPorts();
//       setAvailablePorts(ports);
      
//       const textDecoder = new TextDecoderStream();
//       const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
//       readableStreamClosedRef.current = readableStreamClosed;
//       const reader = textDecoder.readable.getReader();
//       readerRef.current = reader;

//       const textEncoder = new TextEncoderStream();
//       const writableStreamClosed = textEncoder.readable.pipeTo(selectedPort.writable);
//       writableStreamClosedRef.current = writableStreamClosed;
//       const writer = textEncoder.writable.getWriter();
//       writerRef.current = writer;

//       readLoop();
//     } catch (error) {
//       console.error('Connection failed:', error);
//       alert('Connection failed: ' + error.message);
//     }
//   };

//   const readLoop = async () => {
//     try {
//       while (true) {
//         const { value, done } = await readerRef.current.read();
//         if (done) {
//           readerRef.current.releaseLock();
//           break;
//         }
//         if (value) processIncomingData(value);
//       }
//     } catch (error) { console.error('Read error:', error); }
//   };

//   const processIncomingData = (chunk) => {
//     bufferRef.current += chunk;
//     if (bufferRef.current.includes('\n')) {
//       const lines = bufferRef.current.split(/\r?\n/);
//       const completeLines = lines.slice(0, -1);
//       bufferRef.current = lines[lines.length - 1];
//       if (!isPausedRef.current && completeLines.length > 0) {
//         addLogs(completeLines, 'rx');
//       }
//     }
//   };

//   const disconnectPort = async () => {
//     try {
//       if (readerRef.current) {
//         await readerRef.current.cancel();
//         await readableStreamClosedRef.current.catch(() => {});
//         readerRef.current = null;
//       }
//       if (writerRef.current) {
//         await writerRef.current.close();
//         await writableStreamClosedRef.current;
//         writerRef.current = null;
//       }
//       if (port) {
//         await port.close();
//         setPort(null);
//         setIsConnected(false);
//       }
//     } catch (error) { console.error('Disconnect error:', error); }
//   };

//   const addLogs = (newLines, type) => {
//     setLogs(prev => {
//       const newEntries = newLines.map(text => ({
//         id: Date.now() + Math.random(),
//         timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 }),
//         text: text,
//         type: type 
//       }));
//       const updated = [...prev, ...newEntries];
//       if (updated.length > 2000) return updated.slice(-2000);
//       return updated;
//     });
//   };

//   // --- 导出数据功能 (修复 ReferenceError) ---
//   const exportData = () => {
//     const content = logs.map(l => `[${l.timestamp}] ${l.type === 'tx' ? 'TX' : 'RX'}: ${l.text}`).join('\n');
//     const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement('a');
//     link.href = url;
//     link.download = `serial_log_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   // --- 发送逻辑 ---

//   const sendData = async (textToSend = null) => {
//     const rawData = textToSend !== null ? textToSend : inputText;
//     if (!port || !writerRef.current || !rawData) return;

//     if (textToSend === null && rawData.trim() !== '') {
//         setSendHistory(prev => {
//             const newHistory = [rawData, ...prev].slice(0, 50); 
//             return newHistory;
//         });
//         setHistoryIndex(-1); 
//     }

//     try {
//       if (useHexSend) {
//           // HEX 模式简单模拟
//           alert("提示：当前 Web 架构主要针对文本调试。HEX 模式发送暂未完全实装 (需重写底层流管道)。");
//       } else {
//           // ASCII 模式发送
//           let finalData = rawData;
//           if (lineEnding === '\\n') finalData += '\n';
//           else if (lineEnding === '\\r') finalData += '\r';
//           else if (lineEnding === '\\r\\n') finalData += '\r\n';
          
//           await writerRef.current.write(finalData);
//           addLogs([finalData.replace(/\r/g, '').replace(/\n/g, '')], 'tx'); 
//       }
      
//       if (textToSend === null) setInputText(''); 
//     } catch (error) {
//       console.error('Send failed:', error);
//     }
//   };

//   const handleInputKeyDown = (e) => {
//     if (e.key === 'Enter') {
//         if (e.ctrlKey) {
//             sendData();
//         }
//     } else if (e.key === 'ArrowUp') {
//         e.preventDefault();
//         if (sendHistory.length > 0) {
//             const nextIndex = Math.min(historyIndex + 1, sendHistory.length - 1);
//             setHistoryIndex(nextIndex);
//             setInputText(sendHistory[nextIndex]);
//         }
//     } else if (e.key === 'ArrowDown') {
//         e.preventDefault();
//         if (historyIndex > 0) {
//             const nextIndex = historyIndex - 1;
//             setHistoryIndex(nextIndex);
//             setInputText(sendHistory[nextIndex]);
//         } else if (historyIndex === 0) {
//             setHistoryIndex(-1);
//             setInputText(''); 
//         }
//     }
//   };

//   // --- 辅助函数 ---

//   const forgetPort = async (e, portToForget) => {
//     e.stopPropagation();
//     try {
//         if (portToForget === port && isConnected) await disconnectPort();
//         await portToForget.forget();
//         const ports = await navigator.serial.getPorts();
//         setAvailablePorts(ports);
//     } catch (error) {
//         alert('Could not forget port. Require Chrome 103+.');
//     }
//   };

//   const requestNewPort = async () => {
//     try {
//       const selectedPort = await navigator.serial.requestPort();
//       openPort(selectedPort);
//     } catch (error) { console.log('User cancelled'); }
//   };

//   const toHexDisplay = (str) => {
//     let result = '';
//     for (let i = 0; i < str.length; i++) {
//       const hex = str.charCodeAt(i).toString(16).toUpperCase().padStart(2, '0');
//       result += hex + ' ';
//     }
//     return result.trim();
//   };

//   const copyToClipboard = (text) => {
//     navigator.clipboard.writeText(text);
//     setCopyFeedback(text.substring(0, 20) + '...');
//     setTimeout(() => setCopyFeedback(null), 1500);
//   };

//   const renderLogContent = (text) => {
//     // 强制转换为字符串，防止对象渲染错误
//     const safeText = String(text);
    
//     const contentToRender = viewMode === 'hex' ? toHexDisplay(safeText) : safeText;
//     if (!highlightKeyword || viewMode === 'hex') return contentToRender;
//     const parts = contentToRender.split(new RegExp(`(${highlightKeyword})`, 'gi'));
//     return (
//       <span>
//         {parts.map((part, i) => 
//           part.toLowerCase() === highlightKeyword.toLowerCase() ? (
//             <span key={i} className={`${highlightColor} font-bold px-1.5 py-0.5 rounded border text-[11px] tracking-wide mx-0.5 shadow-[0_0_10px_rgba(0,0,0,0.2)]`}>
//               {part}
//             </span>
//           ) : (part)
//         )}
//       </span>
//     );
//   };

//   // 格式化相关
//   const getPortInfo = (port, index) => {
//     const info = port.getInfo();
//     if (info.usbVendorId && info.usbProductId) {
//       const vid = info.usbVendorId.toString(16).toUpperCase().padStart(4, '0');
//       const pid = info.usbProductId.toString(16).toUpperCase().padStart(4, '0');
//       return { name: `USB Serial Device`, meta: `VID:${vid} PID:${pid}`, id: `${vid}:${pid}` };
//     }
//     return { name: `Serial Port ${index + 1}`, meta: 'Generic Device', id: `generic-${index}` };
//   };

//   const filteredPorts = availablePorts.filter((p, index) => {
//     if (!portSearchQuery) return true;
//     const info = getPortInfo(p, index);
//     const searchLower = portSearchQuery.toLowerCase();
//     return info.name.toLowerCase().includes(searchLower) || info.meta.toLowerCase().includes(searchLower);
//   });

//   const filteredLogs = logs.filter(log => {
//     if (!logFilter) return true;
//     // 强制转换防止崩溃
//     return String(log.text).toLowerCase().includes(logFilter.toLowerCase());
//   });

//   const updateQuickCommand = (id, field, value) => {
//     setQuickCommands(prev => prev.map(cmd => cmd.id === id ? { ...cmd, [field]: value } : cmd));
//   };
//   const addQuickCommand = () => {
//     const newId = Math.max(0, ...quickCommands.map(c => c.id)) + 1;
//     setQuickCommands([...quickCommands, { id: newId, label: 'Cmd', cmd: '' }]);
//   };
//   const deleteQuickCommand = (id) => {
//     setQuickCommands(prev => prev.filter(c => c.id !== id));
//   };

//   if (!isWebSerialSupported) {
//     return (
//       <div className="flex h-screen items-center justify-center bg-zinc-950 text-white font-sans">
//         <div className="text-center p-8 bg-zinc-900/50 rounded-2xl border border-white/10 shadow-2xl max-w-md backdrop-blur-xl">
//           <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6 opacity-80" strokeWidth={1.5} />
//           <h2 className="text-2xl font-bold mb-3 tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Browser Not Supported</h2>
//           <p className="text-zinc-500 leading-relaxed text-sm">Web Serial API is required. Please use Chrome or Edge.</p>
//         </div>
//       </div>
//     );
//   }

//   const COMMON_BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600, 1000000, 2000000];

//   return (
//     <div className="flex h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-hidden relative">
      
//       {/* Background - 略微增加网格透明度 */}
//       <div className="absolute inset-0 bg-zinc-950 pointer-events-none z-0">
//          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-900/10 via-zinc-950 to-zinc-950 opacity-50"></div>
//          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
//       </div>
      
//       {/* Copy Feedback */}
//       {copyFeedback && (
//         <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-zinc-800/90 backdrop-blur border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full shadow-xl text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none flex items-center gap-2">
//           <Copy size={14} />
//           {copyFeedback}
//         </div>
//       )}

//       {/* Connect Modal */}
//       {isConnectModalOpen && (
//         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
//             <div className="relative w-[600px] group transition-all duration-300 transform scale-100">
//                 <div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-emerald-500/50 rounded-2xl opacity-40 group-hover:opacity-60 transition duration-1000 blur-sm bg-[length:200%_auto] animate-gradient"></div>
//                 <div className="relative w-full bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
//                   <div className="p-8 border-b border-white/5 flex items-center justify-between bg-zinc-900/80">
//                       <div className="flex items-center gap-5">
//                           <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center ring-1 ring-white/5 shadow-inner">
//                             <Plug size={24} className="text-emerald-400" />
//                           </div>
//                           <div>
//                             <h3 className="text-lg font-bold text-zinc-100 tracking-tight">Device Manager</h3>
//                             <p className="text-sm text-zinc-500 mt-0.5 font-medium">Connect or manage serial devices</p>
//                           </div>
//                       </div>
//                       <button onClick={() => setIsConnectModalOpen(false)} className="p-2.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
//                   </div>

//                   {availablePorts.length > 0 && (
//                      <div className="px-8 py-5 border-b border-white/5 bg-zinc-900/30">
//                         <div className="relative group/search">
//                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within/search:text-emerald-400 transition-colors" />
//                            <input type="text" placeholder="Filter devices..." value={portSearchQuery} onChange={(e) => setPortSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 placeholder-zinc-600 transition-all" />
//                         </div>
//                      </div>
//                   )}

//                   <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-[280px] bg-black/20">
//                       {availablePorts.length === 0 ? (
//                         <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 py-12 border-2 border-dashed border-zinc-800/50 rounded-xl bg-zinc-900/20 mx-2">
//                             <div className="w-16 h-16 rounded-full bg-zinc-900/80 flex items-center justify-center mb-5 shadow-lg ring-1 ring-white/5"><Usb size={32} className="opacity-30" /></div>
//                             <p className="text-base font-medium text-zinc-400">No authorized devices</p>
//                             <p className="text-xs opacity-50 mt-1 max-w-[240px] text-center leading-relaxed">Browser security requires manual authorization for new devices.</p>
//                         </div>
//                       ) : (
//                         <>
//                           <div className="flex items-center justify-between px-2 mb-1 mt-1"><div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Authorized Devices ({filteredPorts.length})</div></div>
//                           {filteredPorts.map((p, index) => {
//                             const info = getPortInfo(p, index);
//                             const isCurrent = port === p && isConnected;
//                             return (
//                               <div key={index} onClick={() => openPort(p)} className={`w-full text-left p-4 rounded-xl border transition-all group/item relative overflow-hidden cursor-pointer flex items-center justify-between ${isCurrent ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/60 border-white/5 hover:border-emerald-500/20 hover:bg-zinc-800'}`}>
//                                  <div className="flex items-center gap-5 relative z-10">
//                                     <div className={`w-12 h-12 rounded-lg flex items-center justify-center border transition-colors ${isCurrent ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-black/50 border-white/5 text-zinc-600 group-hover/item:text-emerald-400 group-hover/item:border-emerald-500/20'}`}><Usb size={20} /></div>
//                                     <div>
//                                       <div className={`text-base font-semibold transition-colors ${isCurrent ? 'text-emerald-400' : 'text-zinc-300 group-hover/item:text-white'}`}>{info.name}</div>
//                                       <div className="text-xs font-mono text-zinc-600 group-hover/item:text-zinc-500 flex items-center gap-3 mt-1"><span>{info.meta}</span>{isCurrent && <span className="text-emerald-500 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 leading-none">Active</span>}</div>
//                                     </div>
//                                  </div>
//                                  <div className="flex items-center gap-3 relative z-10">
//                                    <button onClick={(e) => forgetPort(e, p)} className="p-2.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover/item:opacity-100 transition-all" title="Forget Device"><Trash2 size={16} /></button>
//                                    {!isCurrent && <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0 translate-x-4 transition-all duration-300"><Zap size={16} /></div>}
//                                  </div>
//                               </div>
//                             );
//                           })}
//                         </>
//                       )}
//                   </div>
//                   <div className="p-6 border-t border-white/5 bg-zinc-900/50">
//                      <button onClick={requestNewPort} className="relative w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold tracking-widest transition-all shadow-lg shadow-emerald-900/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-3 group/btn overflow-hidden">
//                         <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
//                         <Search size={18} strokeWidth={2.5} className="relative z-10" />
//                         <span className="relative z-10">SCAN FOR NEW DEVICES</span>
//                      </button>
//                   </div>
//                 </div>
//             </div>
//         </div>
//       )}

//       {/* Main Content */}
//       <main className="flex-1 flex flex-col min-w-0 relative z-10">
        
//         {/* Top Floating Toolbar */}
//         <div className="absolute top-6 left-8 right-8 z-20 flex items-center justify-between pointer-events-none">
//             <div className={`pointer-events-auto flex items-center gap-4 px-3 py-2 pr-5 rounded-full border backdrop-blur-md transition-all duration-500 ${isConnected ? 'bg-emerald-950/40 border-emerald-500/30 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]' : 'bg-zinc-900/60 border-white/10'}`}>
//               <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isConnected ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>{isConnected ? <Activity size={16} className="animate-pulse" /> : <Zap size={16} />}</div>
//               <div className="flex flex-col">
//                   <span className={`text-xs font-bold tracking-wider uppercase ${isConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>{isConnected ? 'Connected' : 'Offline'}</span>
//                   {isConnected && <span className="text-[10px] text-zinc-500 leading-none">{String(baudRate)} bps</span>}
//               </div>
//             </div>

//             <div className="pointer-events-auto flex items-center gap-4">
//                 <div className="relative group/search">
//                     <div className={`absolute inset-y-0 left-3 flex items-center pointer-events-none transition-colors ${logFilter ? 'text-emerald-400' : 'text-zinc-500'}`}><Filter size={16} /></div>
//                     <input type="text" value={logFilter} onChange={(e) => setLogFilter(e.target.value)} placeholder="Filter logs..." className={`h-12 pl-10 pr-4 rounded-full border text-sm bg-zinc-900/60 backdrop-blur-md transition-all outline-none w-40 focus:w-64 ${logFilter ? 'border-emerald-500/50 text-emerald-300' : 'border-white/10 text-zinc-300 focus:border-white/20'}`} />
//                     {logFilter && <button onClick={() => setLogFilter('')} className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-white"><X size={14} /></button>}
//                 </div>

//                 <div className="flex items-center p-2 rounded-full bg-zinc-900/60 border border-white/10 backdrop-blur-md shadow-xl gap-2">
//                     <div className="flex bg-black/20 rounded-full p-1 border border-white/5">
//                        <button onClick={() => setViewMode('ascii')} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${viewMode === 'ascii' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>ASCII</button>
//                        <button onClick={() => setViewMode('hex')} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${viewMode === 'hex' ? 'bg-emerald-600/20 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>HEX</button>
//                     </div>
//                     <div className="w-px h-5 bg-white/10 mx-1"></div>
//                     {isConnected && (
//                       <button onClick={() => setIsPaused(!isPaused)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`} title={isPaused ? "Resume View" : "Pause View"}>{isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}</button>
//                     )}
//                     <button onClick={exportData} disabled={logs.length === 0} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-emerald-400 transition-all disabled:opacity-30" title="Export Log"><Download size={16} strokeWidth={2} /></button>
//                     <button onClick={() => setLogs([])} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400 transition-all" title="Clear Console"><Trash2 size={16} strokeWidth={2} /></button>
//                 </div>
//             </div>
//         </div>

//         {/* Terminal Area */}
//         <div className="flex-1 pt-28 pb-10 px-10 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed relative">
//            {isPaused && <div className="fixed top-28 right-[420px] px-4 py-1.5 bg-amber-500/90 text-black text-xs font-bold rounded-lg shadow-lg z-30 pointer-events-none uppercase tracking-wider backdrop-blur-md">View Paused</div>}
//            {logs.length === 0 ? (
//              <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
//                 <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-emerald-500/20 to-transparent flex items-center justify-center mb-8 ring-1 ring-white/10"><Terminal size={56} className="text-emerald-400" strokeWidth={1} /></div>
//                 <p className="text-zinc-500 font-light tracking-wide text-base">READY TO CONNECT</p>
//              </div>
//            ) : (
//              <div className="space-y-1">
//                 {filteredLogs.map((log) => (
//                     <div key={log.id} onClick={() => copyToClipboard(log.text)} className="flex gap-6 hover:bg-white/[0.04] -mx-6 px-6 py-0.5 rounded transition-colors group cursor-pointer relative" title="Click to copy line">
//                         {showTimestamp && <span className="text-zinc-700 shrink-0 select-none text-xs pt-[4px] font-medium tracking-tighter group-hover:text-zinc-500 transition-colors font-sans">{log.timestamp}</span>}
//                         <div className={`tracking-tight whitespace-pre-wrap break-all flex-1 ${log.type === 'tx' ? 'text-indigo-300/80' : 'text-emerald-400 font-medium'}`}>{log.type === 'tx' && <span className="text-indigo-500 mr-3 text-xs align-middle inline-block font-bold select-none">TX</span>}{renderLogContent(log.text)}</div>
//                     </div>
//                 ))}
//                 {filteredLogs.length === 0 && logFilter && <div className="text-zinc-500 text-sm text-center py-12">No matching logs found for "{logFilter}"</div>}
//                 <div ref={logsEndRef} />
//              </div>
//            )}
//         </div>

//         {/* Footer Status */}
//         <div className="h-10 flex items-center justify-between px-8 text-xs text-zinc-600 select-none border-t border-white/[0.03]">
//             <div className="flex items-center gap-6 font-medium">
//                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> RX: {logs.filter(l => l.type === 'rx').length}</span>
//                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> TX: {logs.filter(l => l.type === 'tx').length}</span>
//             </div>
//             <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-400 transition-colors group">
//                 <div className={`w-2 h-2 rounded-full transition-colors ${autoScroll && !isPaused ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`}></div>
//                 <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="hidden" />
//                 AUTO-SCROLL
//             </label>
//         </div>
//       </main>

//       {/* Sidebar (Right) - 384px (w-96) */}
//       <aside className="w-96 bg-zinc-900/60 backdrop-blur-2xl border-l border-white/[0.06] flex flex-col z-20 relative shadow-2xl">
//         <div className="h-20 flex-none flex items-center px-8 border-b border-white/[0.06]">
//           <div className="flex items-center gap-4 opacity-90 hover:opacity-100 transition-opacity">
//             <Command size={24} className="text-emerald-400" />
//             <span className="text-xl font-bold text-zinc-100 tracking-wide">Serial<span className="font-light text-zinc-500">Flux</span> <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded ml-1.5 border border-emerald-500/20 align-top">PRO</span></span>
//           </div>
//         </div>

//         <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
//           {/* Connection Card */}
//           <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm">
//             <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Plug size={14} /> Connection</h3>
//             <div className="space-y-4">
//                <div className="relative w-full" ref={baudRef}>
//                   <div className="relative flex items-center group">
//                       <input type="text" inputMode="numeric" pattern="[0-9]*" value={baudRate} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setBaudRate(e.target.value); }} disabled={isConnected} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-50 hover:border-white/20 font-mono pr-10" placeholder="Custom Baud..." />
//                       <button onClick={() => !isConnected && setIsBaudDropdownOpen(!isBaudDropdownOpen)} disabled={isConnected} className="absolute right-3 p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-emerald-400 disabled:opacity-50 transition-colors"><ChevronDown size={16} className={`transition-transform ${isBaudDropdownOpen ? 'rotate-180' : ''}`} /></button>
//                   </div>
//                   {isBaudDropdownOpen && (
//                       <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
//                           {COMMON_BAUD_RATES.map(rate => (
//                               <button key={rate} onClick={() => { setBaudRate(rate); setIsBaudDropdownOpen(false); }} className={`w-full text-left px-5 py-2.5 text-xs font-mono hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors flex items-center justify-between border-b border-white/[0.02] last:border-none ${parseInt(baudRate) === rate ? 'text-emerald-400 bg-emerald-500/5' : 'text-zinc-400'}`}><span>{rate}</span>{parseInt(baudRate) === rate && <Check size={14} />}</button>
//                           ))}
//                       </div>
//                   )}
//                </div>
//                <button onClick={isConnected ? disconnectPort : () => setIsConnectModalOpen(true)} className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${isConnected ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:shadow-rose-500/10' : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-transparent hover:shadow-emerald-500/30'}`}>{isConnected ? 'DISCONNECT' : 'CONNECT DEVICE'}</button>
//             </div>
//           </div>

//           {/* Quick Actions Card */}
//           <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm">
//              <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Zap size={14} /> Quick Actions</h3>
//                 <button onClick={() => setIsEditingCmds(!isEditingCmds)} className={`p-1.5 rounded-lg transition-colors ${isEditingCmds ? 'bg-emerald-500 text-black' : 'hover:bg-white/10 text-zinc-600 hover:text-zinc-300'}`}>{isEditingCmds ? <Save size={14} /> : <Edit2 size={14} />}</button>
//              </div>
//              {isEditingCmds ? (
//                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
//                   {quickCommands.map((cmd) => (
//                     <div key={cmd.id} className="flex gap-2">
//                       <input type="text" value={cmd.label} onChange={(e) => updateQuickCommand(cmd.id, 'label', e.target.value)} className="w-1/3 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500/50 focus:outline-none" />
//                       <input type="text" value={cmd.cmd} onChange={(e) => updateQuickCommand(cmd.id, 'cmd', e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400/80 focus:border-emerald-500/50 focus:outline-none" />
//                       <button onClick={() => deleteQuickCommand(cmd.id)} className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"><Trash2 size={14} /></button>
//                     </div>
//                   ))}
//                   <button onClick={addQuickCommand} className="w-full py-2.5 border border-dashed border-white/10 rounded-lg text-xs text-zinc-500 hover:text-emerald-400 transition-colors"><Plus size={14} className="inline mr-1"/> Add</button>
//                </div>
//              ) : (
//                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
//                   {quickCommands.map((cmd) => (
//                     <button key={cmd.id} onClick={() => sendData(cmd.cmd)} disabled={!isConnected} className="flex-none whitespace-nowrap px-4 py-2.5 rounded-lg bg-black/40 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all text-xs font-medium text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed">{cmd.label}</button>
//                   ))}
//                </div>
//              )}
//           </div>

//           {/* Highlight Card */}
//           <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm">
//             <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Highlighter size={14} /> Highlight</h3>
//             <div className="flex flex-col gap-3">
//                 <input 
//                     type="text" 
//                     value={highlightKeyword} 
//                     onChange={(e) => setHighlightKeyword(e.target.value)} 
//                     placeholder="Enter keyword to highlight..." 
//                     className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-all" 
//                 />
//                 <div className="flex gap-2">
//                     {[
//                       {color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', bg: 'bg-amber-400'},
//                       {color: 'text-rose-400 bg-rose-400/10 border-rose-400/20', bg: 'bg-rose-500'},
//                       {color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', bg: 'bg-emerald-500'},
//                       {color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', bg: 'bg-cyan-500'},
//                       {color: 'text-violet-400 bg-violet-400/10 border-violet-400/20', bg: 'bg-violet-500'},
//                     ].map((item, idx) => (
//                         <button 
//                             key={idx} 
//                             onClick={() => setHighlightColor(item.color)} 
//                             className={`flex-1 h-8 rounded-lg ${item.bg} ${highlightColor === item.color ? 'ring-2 ring-white/20 scale-105 shadow-lg opacity-100' : 'opacity-20 hover:opacity-80'} transition-all`} 
//                         />
//                     ))}
//                 </div>
//             </div>
//           </div>
//         </div>

//         {/* Transmitter - Fixed Bottom */}
//         <div className="flex-none p-6 border-t border-white/5 bg-zinc-900/80 backdrop-blur-xl z-30">
//             <div className="flex flex-col gap-4">
//               <div className="relative group">
//                   <textarea 
//                       value={inputText}
//                       onChange={(e) => setInputText(e.target.value)}
//                       onKeyDown={handleInputKeyDown}
//                       placeholder="Input payload..."
//                       className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 resize-none placeholder-zinc-600 transition-all custom-scrollbar"
//                   />
//                   <div className="absolute bottom-3 right-3 flex gap-2">
//                      <button onClick={() => setUseHexSend(!useHexSend)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[10px] font-mono tracking-wide ${useHexSend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
//                         {useHexSend ? 'HEX' : 'ASCII'}
//                      </button>
//                      <div className="flex bg-white/5 border border-white/5 rounded-md overflow-hidden">
//                         {[
//                             { label: '\\n', val: '\\n' },
//                             { label: '\\r\\n', val: '\\r\\n' },
//                             { label: 'Ø', val: 'none' },
//                         ].map(opt => (
//                             <button key={opt.val} onClick={() => setLineEnding(opt.val)} className={`px-2 py-1 text-[10px] font-mono transition-all ${lineEnding === opt.val ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>{opt.label}</button>
//                         ))}
//                      </div>
//                   </div>
//               </div>
//               <button onClick={() => sendData()} disabled={!isConnected} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white text-sm font-bold tracking-wide rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:shadow-none flex items-center justify-center gap-2.5 group hover:scale-[1.01] active:scale-[0.99]">
//                   <Send size={16} className="group-hover:translate-x-0.5 transition-transform" />
//                   SEND PAYLOAD
//               </button>
//             </div>
//         </div>
//       </aside>

//       <style>{`
//         .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
//         .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
//         .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 5px; }
//         .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
//         .custom-scrollbar::-webkit-scrollbar-corner { background: transparent; }
//         @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
//         .animate-gradient { animation: gradient 3s ease infinite; }
//       `}</style>
//     </div>
//   );
// }


// import React, { useState, useRef, useEffect } from 'react';
// import { 
//   Terminal, 
//   Settings, 
//   Download, 
//   Trash2, 
//   Play, 
//   Square, 
//   Highlighter, 
//   Send,
//   AlertCircle,
//   Zap,
//   Activity,
//   Cpu,
//   Command,
//   Radio,
//   Binary,
//   Copy,
//   Plus,
//   X,
//   Pause,
//   Edit2,
//   Save,
//   RefreshCw,
//   MoreHorizontal,
//   Plug,
//   Search,
//   Usb,
//   Monitor,
//   Unplug,
//   Hash,
//   Filter,
//   ChevronDown,
//   Check,
//   ArrowUp,
//   ArrowDown,
//   Minimize2,
//   Maximize2
// } from 'lucide-react';

// export default function App() {
//   // --- 状态定义 ---

//   // 串口相关
//   const [port, setPort] = useState(null);
//   const [availablePorts, setAvailablePorts] = useState([]); 
//   const [isConnected, setIsConnected] = useState(false);
  
//   // 核心引用
//   const readerRef = useRef(null);
//   const writerRef = useRef(null);
//   const readableStreamClosedRef = useRef(null);
//   const writableStreamClosedRef = useRef(null);
//   const baudRef = useRef(null);
//   const bufferRef = useRef('');
  
//   // 界面交互状态
//   const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
//   const [isBaudDropdownOpen, setIsBaudDropdownOpen] = useState(false);
//   const [portSearchQuery, setPortSearchQuery] = useState('');
//   const [isPaused, setIsPaused] = useState(false);
//   const isPausedRef = useRef(false);

//   // 日志相关
//   const [logs, setLogs] = useState([]);
//   const [autoScroll, setAutoScroll] = useState(true);
//   const logsEndRef = useRef(null);
//   const [viewMode, setViewMode] = useState('ascii'); // 'ascii' | 'hex'
//   const [logFilter, setLogFilter] = useState('');

//   // --- 持久化状态 (localStorage) - 增强版 ---
//   const usePersistedState = (key, defaultValue) => {
//     const [state, setState] = useState(() => {
//       try {
//         const storedValue = localStorage.getItem(key);
//         return storedValue ? JSON.parse(storedValue) : defaultValue;
//       } catch (error) {
//         console.error(`Error parsing localStorage key "${key}":`, error);
//         return defaultValue;
//       }
//     });

//     useEffect(() => {
//       try {
//         localStorage.setItem(key, JSON.stringify(state));
//       } catch (error) {
//         console.error(`Error setting localStorage key "${key}":`, error);
//       }
//     }, [key, state]);

//     return [state, setState];
//   };

//   // 使用持久化状态
//   const [baudRate, setBaudRate] = usePersistedState('serial_baudrate', 115200);
//   const [highlightKeyword, setHighlightKeyword] = usePersistedState('serial_highlight_kw', '');
//   const [highlightColor, setHighlightColor] = usePersistedState('serial_highlight_color', 'text-amber-400 bg-amber-400/10 border-amber-400/20');
//   const [quickCommands, setQuickCommands] = usePersistedState('serial_quick_cmds', [
//     { id: 1, label: 'AT Test', cmd: 'AT' },
//     { id: 2, label: 'Reset', cmd: 'AT+RST' },
//     { id: 3, label: 'Version', cmd: 'AT+GMR' },
//     { id: 4, label: 'Scan', cmd: 'AT+CWLAP' },
//     { id: 5, label: 'IP Addr', cmd: 'AT+CIFSR' },
//   ]);
//   const [useHexSend, setUseHexSend] = usePersistedState('serial_use_hex_send', false);
//   const [lineEnding, setLineEnding] = usePersistedState('serial_line_ending', '\\n'); // none, \n, \r, \r\n

//   // 发送相关
//   const [inputText, setInputText] = useState('');
//   const [showTimestamp, setShowTimestamp] = useState(true);
//   const [isEditingCmds, setIsEditingCmds] = useState(false);
//   const [copyFeedback, setCopyFeedback] = useState(null);

//   // 历史记录相关
//   const [sendHistory, setSendHistory] = useState([]);
//   const [historyIndex, setHistoryIndex] = useState(-1); // -1 表示当前输入

//   // 浏览器兼容性
//   const isWebSerialSupported = 'serial' in navigator;

//   // --- Effect Hooks ---

//   useEffect(() => {
//     document.title = "SerialFlux - Pro Web Debugger";
//   }, []);

//   useEffect(() => {
//     isPausedRef.current = isPaused;
//   }, [isPaused]);

//   // 点击外部关闭波特率下拉
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (baudRef.current && !baudRef.current.contains(event.target)) {
//         setIsBaudDropdownOpen(false);
//       }
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, []);

//   // 端口监听
//   useEffect(() => {
//     if (!isWebSerialSupported) return;
//     const updatePorts = async () => {
//       try {
//         const ports = await navigator.serial.getPorts();
//         setAvailablePorts(ports);
//       } catch (e) { console.error(e); }
//     };
//     updatePorts();
//     const handleConnectEvent = () => updatePorts();
//     const handleDisconnectEvent = (e) => {
//       updatePorts();
//       if (port === e.target) disconnectPort();
//     };
//     navigator.serial.addEventListener('connect', handleConnectEvent);
//     navigator.serial.addEventListener('disconnect', handleDisconnectEvent);
//     return () => {
//       navigator.serial.removeEventListener('connect', handleConnectEvent);
//       navigator.serial.removeEventListener('disconnect', handleDisconnectEvent);
//     };
//   }, [port]);

//   // 自动滚动
//   useEffect(() => {
//     if (autoScroll && !isPaused && logsEndRef.current && !logFilter) {
//       logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
//     }
//   }, [logs, autoScroll, viewMode, isPaused, logFilter]);

//   // --- 核心逻辑 ---

//   const openPort = async (selectedPort) => {
//     try {
//       if (!selectedPort) return;
//       if (port && isConnected) await disconnectPort();

//       // 确保 baudRate 是数字，防止从 localStorage 读到奇怪的东西导致连接失败
//       const baud = parseInt(baudRate) || 115200;
//       await selectedPort.open({ baudRate: baud });
      
//       setPort(selectedPort);
//       setIsConnected(true);
//       setIsPaused(false);
//       setIsConnectModalOpen(false);
//       bufferRef.current = '';

//       const ports = await navigator.serial.getPorts();
//       setAvailablePorts(ports);
      
//       const textDecoder = new TextDecoderStream();
//       const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
//       readableStreamClosedRef.current = readableStreamClosed;
//       const reader = textDecoder.readable.getReader();
//       readerRef.current = reader;

//       const textEncoder = new TextEncoderStream();
//       const writableStreamClosed = textEncoder.readable.pipeTo(selectedPort.writable);
//       writableStreamClosedRef.current = writableStreamClosed;
//       const writer = textEncoder.writable.getWriter();
//       writerRef.current = writer;

//       readLoop();
//     } catch (error) {
//       console.error('Connection failed:', error);
//       alert('Connection failed: ' + error.message);
//     }
//   };

//   const readLoop = async () => {
//     try {
//       while (true) {
//         const { value, done } = await readerRef.current.read();
//         if (done) {
//           readerRef.current.releaseLock();
//           break;
//         }
//         if (value) processIncomingData(value);
//       }
//     } catch (error) { console.error('Read error:', error); }
//   };

//   const processIncomingData = (chunk) => {
//     bufferRef.current += chunk;
//     if (bufferRef.current.includes('\n')) {
//       const lines = bufferRef.current.split(/\r?\n/);
//       const completeLines = lines.slice(0, -1);
//       bufferRef.current = lines[lines.length - 1];
//       if (!isPausedRef.current && completeLines.length > 0) {
//         addLogs(completeLines, 'rx');
//       }
//     }
//   };

//   const disconnectPort = async () => {
//     try {
//       if (readerRef.current) {
//         await readerRef.current.cancel();
//         await readableStreamClosedRef.current.catch(() => {});
//         readerRef.current = null;
//       }
//       if (writerRef.current) {
//         await writerRef.current.close();
//         await writableStreamClosedRef.current;
//         writerRef.current = null;
//       }
//       if (port) {
//         await port.close();
//         setPort(null);
//         setIsConnected(false);
//       }
//     } catch (error) { console.error('Disconnect error:', error); }
//   };

//   const addLogs = (newLines, type) => {
//     setLogs(prev => {
//       const newEntries = newLines.map(text => ({
//         id: Date.now() + Math.random(),
//         timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 }),
//         text: text,
//         type: type 
//       }));
//       const updated = [...prev, ...newEntries];
//       if (updated.length > 2000) return updated.slice(-2000);
//       return updated;
//     });
//   };

//   // --- 导出数据功能 ---
//   const exportData = () => {
//     const content = logs.map(l => `[${l.timestamp}] ${l.type === 'tx' ? 'TX' : 'RX'}: ${l.text}`).join('\n');
//     const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement('a');
//     link.href = url;
//     link.download = `serial_log_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   // --- 发送逻辑 ---

//   const sendData = async (textToSend = null) => {
//     const rawData = textToSend !== null ? textToSend : inputText;
//     if (!port || !writerRef.current || !rawData) return;

//     if (textToSend === null && rawData.trim() !== '') {
//         setSendHistory(prev => {
//             const newHistory = [rawData, ...prev].slice(0, 50); 
//             return newHistory;
//         });
//         setHistoryIndex(-1); 
//     }

//     try {
//       if (useHexSend) {
//           alert("提示：当前 Web 架构主要针对文本调试。HEX 模式发送暂未完全实装 (需重写底层流管道)。");
//       } else {
//           // ASCII 模式发送
//           let finalData = rawData;
//           if (lineEnding === '\\n') finalData += '\n';
//           else if (lineEnding === '\\r') finalData += '\r';
//           else if (lineEnding === '\\r\\n') finalData += '\r\n';
          
//           await writerRef.current.write(finalData);
//           addLogs([finalData.replace(/\r/g, '').replace(/\n/g, '')], 'tx'); 
//       }
      
//       if (textToSend === null) setInputText(''); 
//     } catch (error) {
//       console.error('Send failed:', error);
//     }
//   };

//   const handleInputKeyDown = (e) => {
//     if (e.key === 'Enter') {
//         if (e.ctrlKey) {
//             sendData();
//         }
//     } else if (e.key === 'ArrowUp') {
//         e.preventDefault();
//         if (sendHistory.length > 0) {
//             const nextIndex = Math.min(historyIndex + 1, sendHistory.length - 1);
//             setHistoryIndex(nextIndex);
//             setInputText(sendHistory[nextIndex]);
//         }
//     } else if (e.key === 'ArrowDown') {
//         e.preventDefault();
//         if (historyIndex > 0) {
//             const nextIndex = historyIndex - 1;
//             setHistoryIndex(nextIndex);
//             setInputText(sendHistory[nextIndex]);
//         } else if (historyIndex === 0) {
//             setHistoryIndex(-1);
//             setInputText(''); 
//         }
//     }
//   };

//   // --- 辅助函数 ---

//   const forgetPort = async (e, portToForget) => {
//     e.stopPropagation();
//     try {
//         if (portToForget === port && isConnected) await disconnectPort();
//         await portToForget.forget();
//         const ports = await navigator.serial.getPorts();
//         setAvailablePorts(ports);
//     } catch (error) {
//         alert('Could not forget port. Require Chrome 103+.');
//     }
//   };

//   const requestNewPort = async () => {
//     try {
//       const selectedPort = await navigator.serial.requestPort();
//       openPort(selectedPort);
//     } catch (error) { console.log('User cancelled'); }
//   };

//   const toHexDisplay = (str) => {
//     let result = '';
//     for (let i = 0; i < str.length; i++) {
//       const hex = str.charCodeAt(i).toString(16).toUpperCase().padStart(2, '0');
//       result += hex + ' ';
//     }
//     return result.trim();
//   };

//   const copyToClipboard = (text) => {
//     navigator.clipboard.writeText(text);
//     setCopyFeedback(text.substring(0, 20) + '...');
//     setTimeout(() => setCopyFeedback(null), 1500);
//   };

//   const renderLogContent = (text) => {
//     // 强制转换为字符串，防止对象渲染错误
//     const safeText = String(text);
    
//     const contentToRender = viewMode === 'hex' ? toHexDisplay(safeText) : safeText;
//     if (!highlightKeyword || viewMode === 'hex') return contentToRender;
//     const parts = contentToRender.split(new RegExp(`(${highlightKeyword})`, 'gi'));
//     return (
//       <span>
//         {parts.map((part, i) => 
//           part.toLowerCase() === highlightKeyword.toLowerCase() ? (
//             <span key={i} className={`${highlightColor} font-bold px-1.5 py-0.5 rounded border text-[11px] tracking-wide mx-0.5 shadow-[0_0_10px_rgba(0,0,0,0.2)]`}>
//               {part}
//             </span>
//           ) : (part)
//         )}
//       </span>
//     );
//   };

//   // 格式化相关
//   const getPortInfo = (port, index) => {
//     const info = port.getInfo();
//     if (info.usbVendorId && info.usbProductId) {
//       const vid = info.usbVendorId.toString(16).toUpperCase().padStart(4, '0');
//       const pid = info.usbProductId.toString(16).toUpperCase().padStart(4, '0');
//       return { name: `USB Serial Device`, meta: `VID:${vid} PID:${pid}`, id: `${vid}:${pid}` };
//     }
//     return { name: `Serial Port ${index + 1}`, meta: 'Generic Device', id: `generic-${index}` };
//   };

//   const filteredPorts = availablePorts.filter((p, index) => {
//     if (!portSearchQuery) return true;
//     const info = getPortInfo(p, index);
//     const searchLower = portSearchQuery.toLowerCase();
//     return info.name.toLowerCase().includes(searchLower) || info.meta.toLowerCase().includes(searchLower);
//   });

//   const filteredLogs = logs.filter(log => {
//     if (!logFilter) return true;
//     // 强制转换防止崩溃
//     return String(log.text).toLowerCase().includes(logFilter.toLowerCase());
//   });

//   const updateQuickCommand = (id, field, value) => {
//     setQuickCommands(prev => prev.map(cmd => cmd.id === id ? { ...cmd, [field]: value } : cmd));
//   };
//   const addQuickCommand = () => {
//     const newId = Math.max(0, ...quickCommands.map(c => c.id)) + 1;
//     setQuickCommands([...quickCommands, { id: newId, label: 'Cmd', cmd: '' }]);
//   };
//   const deleteQuickCommand = (id) => {
//     setQuickCommands(prev => prev.filter(c => c.id !== id));
//   };

//   if (!isWebSerialSupported) {
//     return (
//       <div className="flex h-screen items-center justify-center bg-zinc-950 text-white font-sans">
//         <div className="text-center p-8 bg-zinc-900/50 rounded-2xl border border-white/10 shadow-2xl max-w-md backdrop-blur-xl">
//           <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6 opacity-80" strokeWidth={1.5} />
//           <h2 className="text-2xl font-bold mb-3 tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Browser Not Supported</h2>
//           <p className="text-zinc-500 leading-relaxed text-sm">Web Serial API is required. Please use Chrome or Edge.</p>
//         </div>
//       </div>
//     );
//   }

//   const COMMON_BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600, 1000000, 2000000];

//   return (
//     // 桌面环境容器 (模拟桌面)
//     <div className="flex h-screen w-full items-center justify-center bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-hidden relative">
      
//       {/* 桌面背景 - 极光网格 */}
//       <div className="absolute inset-0 pointer-events-none z-0">
//          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950/80 to-zinc-950"></div>
//          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
//          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
//       </div>

//       {/* 应用窗口 (Window Container) - 模拟实物面板 */}
//       <div className="relative w-[95vw] h-[90vh] max-w-[1280px] max-h-[850px] flex flex-col animate-in fade-in zoom-in-95 duration-500 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)]">
        
//         {/* 外壳边框 (Bezel) */}
//         <div className="absolute inset-0 rounded-2xl border border-white/5 bg-zinc-900/95 backdrop-blur-3xl z-0 box-border pointer-events-none ring-1 ring-white/5">
//             {/* 顶部高光 */}
//             <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
//         </div>

//         {/* 装饰性：螺丝孔位 */}
//         <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>

//         {/* 内容区域容器 */}
//         <div className="relative z-10 flex flex-col w-full h-full rounded-2xl overflow-hidden bg-transparent">
            
//             {/* Window Title Bar (Mac Style + Industrial Text) */}
//             <div className="h-10 bg-black/20 border-b border-white/5 flex items-center justify-between px-6 select-none flex-none z-50 backdrop-blur-sm">
//                 <div className="flex gap-2 group">
//                     <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/20 shadow-inner"></div>
//                     <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/20 shadow-inner"></div>
//                     <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/20 shadow-inner"></div>
//                 </div>
//                 <div className="text-xs font-bold text-zinc-500 tracking-widest uppercase flex items-center gap-2 opacity-80">
//                     <Command size={12} className="text-emerald-500" />
//                     SERIAL FLUX PRO <span className="text-[9px] px-1 bg-white/5 rounded text-zinc-600 font-mono">V1.0</span>
//                 </div>
//                 <div className="w-14"></div> 
//             </div>

//             {/* Inner Content Area */}
//             <div className="flex-1 flex overflow-hidden relative">
                
//                 {/* Copy Feedback Toast (Inside Window) */}
//                 {copyFeedback && (
//                     <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full shadow-2xl text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none flex items-center gap-2">
//                     <Copy size={14} />
//                     {copyFeedback}
//                     </div>
//                 )}

//                 {/* ... Connect Modal Component (Scoped) ... */}
//                 {isConnectModalOpen && (
//                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] animate-in fade-in duration-200">
//                         <div className="relative w-[500px] bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80%] ring-1 ring-white/10">
//                             {/* Modal Header */}
//                             <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
//                                 <div className="flex items-center gap-4">
//                                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center ring-1 ring-white/5 shadow-inner">
//                                         <Plug size={20} className="text-emerald-400" />
//                                     </div>
//                                     <div>
//                                         <h3 className="text-base font-bold text-zinc-100 tracking-tight">Device Manager</h3>
//                                         <p className="text-xs text-zinc-500 mt-0.5 font-medium">Select a serial port to connect</p>
//                                     </div>
//                                 </div>
//                                 <button onClick={() => setIsConnectModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
//                             </div>

//                             {/* Search */}
//                             {availablePorts.length > 0 && (
//                                 <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/30">
//                                     <div className="relative group/search">
//                                     <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within/search:text-emerald-400 transition-colors" />
//                                     <input type="text" placeholder="Filter devices..." value={portSearchQuery} onChange={(e) => setPortSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-lg pl-9 pr-4 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 placeholder-zinc-600 transition-all" />
//                                     </div>
//                                 </div>
//                             )}

//                             {/* List */}
//                             <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-[200px] bg-black/20">
//                                 {availablePorts.length === 0 ? (
//                                     <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 py-10">
//                                         <div className="w-12 h-12 rounded-full bg-zinc-900/80 flex items-center justify-center mb-4 shadow-lg ring-1 ring-white/5"><Usb size={20} className="opacity-30" /></div>
//                                         <p className="text-sm font-medium text-zinc-400">No devices found</p>
//                                         <p className="text-xs opacity-50 mt-1">Browser security requires manual authorization.</p>
//                                     </div>
//                                 ) : (
//                                     filteredPorts.map((p, index) => {
//                                         const info = getPortInfo(p, index);
//                                         const isCurrent = port === p && isConnected;
//                                         return (
//                                         <div key={index} onClick={() => openPort(p)} className={`w-full text-left p-3.5 rounded-xl border transition-all group/item relative overflow-hidden cursor-pointer flex items-center justify-between ${isCurrent ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/60 border-white/5 hover:border-emerald-500/20 hover:bg-zinc-800'}`}>
//                                             <div className="flex items-center gap-4 relative z-10">
//                                                 <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${isCurrent ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-black/50 border-white/5 text-zinc-600 group-hover/item:text-emerald-400 group-hover/item:border-emerald-500/20'}`}><Usb size={18} /></div>
//                                                 <div>
//                                                     <div className={`text-sm font-semibold transition-colors ${isCurrent ? 'text-emerald-400' : 'text-zinc-300 group-hover/item:text-white'}`}>{info.name}</div>
//                                                     <div className="text-[10px] font-mono text-zinc-600 group-hover/item:text-zinc-500 flex items-center gap-2 mt-0.5"><span>{info.meta}</span></div>
//                                                 </div>
//                                             </div>
//                                             <button onClick={(e) => forgetPort(e, p)} className="p-2 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover/item:opacity-100 transition-all z-20" title="Forget Device"><Trash2 size={14} /></button>
//                                         </div>
//                                         );
//                                     })
//                                 )}
//                             </div>

//                             {/* Footer */}
//                             <div className="p-5 border-t border-white/5 bg-zinc-900/50">
//                                 <button onClick={requestNewPort} className="relative w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold tracking-widest transition-all shadow-lg shadow-emerald-900/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-3 group/btn overflow-hidden">
//                                     <Search size={16} strokeWidth={2.5} className="relative z-10" />
//                                     <span className="relative z-10">SCAN FOR NEW DEVICES</span>
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 )}

//                 {/* Main Area - Left Panel */}
//                 <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
                    
//                     {/* Top Floating Toolbar */}
//                     <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between">
//                         <div className={`flex items-center gap-3 px-3 py-2 pr-5 rounded-full border backdrop-blur-md transition-all duration-500 ${isConnected ? 'bg-emerald-950/40 border-emerald-500/30 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]' : 'bg-black/40 border-white/10'}`}>
//                         <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isConnected ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>{isConnected ? <Activity size={14} className="animate-pulse" /> : <Zap size={14} />}</div>
//                         <div className="flex flex-col">
//                             <span className={`text-xs font-bold tracking-wider uppercase ${isConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>{isConnected ? 'Connected' : 'Offline'}</span>
//                             {isConnected && <span className="text-[9px] text-zinc-500 leading-none">{String(baudRate)} bps</span>}
//                         </div>
//                         </div>

//                         <div className="flex items-center gap-3">
//                             <div className="relative group/search">
//                                 <div className={`absolute inset-y-0 left-3 flex items-center pointer-events-none transition-colors ${logFilter ? 'text-emerald-400' : 'text-zinc-500'}`}><Filter size={14} /></div>
//                                 <input type="text" value={logFilter} onChange={(e) => setLogFilter(e.target.value)} placeholder="Search logs..." className={`h-11 pl-9 pr-4 rounded-full border text-xs bg-black/40 backdrop-blur-md transition-all outline-none w-32 focus:w-48 ${logFilter ? 'border-emerald-500/50 text-emerald-300' : 'border-white/10 text-zinc-300 focus:border-white/20'}`} />
//                                 {logFilter && <button onClick={() => setLogFilter('')} className="absolute inset-y-0 right-2 flex items-center text-zinc-500 hover:text-white"><X size={12} /></button>}
//                             </div>

//                             <div className="flex items-center p-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md shadow-xl gap-1">
//                                 <div className="flex bg-white/5 rounded-full p-0.5 border border-white/5">
//                                     <button onClick={() => setViewMode('ascii')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'ascii' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>ASC</button>
//                                     <button onClick={() => setViewMode('hex')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'hex' ? 'bg-emerald-600/20 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>HEX</button>
//                                 </div>
//                                 <div className="w-px h-4 bg-white/10 mx-1"></div>
//                                 {isConnected && (
//                                     <button onClick={() => setIsPaused(!isPaused)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`} title={isPaused ? "Resume View" : "Pause View"}>{isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}</button>
//                                 )}
//                                 <button onClick={exportData} disabled={logs.length === 0} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-emerald-400 transition-all disabled:opacity-30" title="Export Log"><Download size={14} strokeWidth={2} /></button>
//                                 <button onClick={() => setLogs([])} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400 transition-all" title="Clear Console"><Trash2 size={14} strokeWidth={2} /></button>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Terminal Area */}
//                     <div className="flex-1 pt-24 pb-8 px-8 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed relative">
//                         {isPaused && <div className="fixed top-36 right-[420px] px-3 py-1 bg-amber-500/90 text-black text-[10px] font-bold rounded-md shadow-lg z-30 pointer-events-none uppercase tracking-wider backdrop-blur-md">View Paused</div>}
//                         {logs.length === 0 ? (
//                             <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
//                                 <Terminal size={64} className="text-emerald-400 mb-4" strokeWidth={1} />
//                                 <p className="text-zinc-500 font-light tracking-wide text-base">READY TO CONNECT</p>
//                             </div>
//                         ) : (
//                             <div className="space-y-0.5">
//                                 {filteredLogs.map((log) => (
//                                     <div key={log.id} onClick={() => copyToClipboard(log.text)} className="flex gap-4 hover:bg-white/[0.04] -mx-4 px-4 py-0.5 rounded transition-colors group cursor-pointer relative" title="Click to copy line">
//                                         {showTimestamp && <span className="text-zinc-600 shrink-0 select-none text-[11px] pt-[3px] font-medium font-sans">{log.timestamp}</span>}
//                                         <div className={`tracking-tight whitespace-pre-wrap break-all flex-1 ${log.type === 'tx' ? 'text-indigo-300/80' : 'text-emerald-400'}`}>{log.type === 'tx' && <span className="text-indigo-500 mr-2 text-[10px] align-middle inline-block font-bold select-none">TX</span>}{renderLogContent(log.text)}</div>
//                                     </div>
//                                 ))}
//                                 {filteredLogs.length === 0 && logFilter && <div className="text-zinc-500 text-xs text-center py-10">No matching logs found for "{logFilter}"</div>}
//                                 <div ref={logsEndRef} />
//                             </div>
//                         )}
//                     </div>

//                     {/* Footer Status - With RX/TX Lights */}
//                     <div className="h-10 flex items-center justify-between px-8 text-xs text-zinc-500 select-none border-t border-white/[0.05] bg-black/20">
//                         <div className="flex items-center gap-6 font-medium">
//                             <span className="flex items-center gap-2">
//                                 <span className={`w-2 h-2 rounded-full transition-all duration-100 ${logs.length > 0 && logs[logs.length-1].type === 'rx' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-emerald-500/20'}`}></span>
//                                 RX: {logs.filter(l => l.type === 'rx').length}
//                             </span>
//                             <span className="flex items-center gap-2">
//                                 <span className={`w-2 h-2 rounded-full transition-all duration-100 ${logs.length > 0 && logs[logs.length-1].type === 'tx' ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-indigo-500/20'}`}></span>
//                                 TX: {logs.filter(l => l.type === 'tx').length}
//                             </span>
//                         </div>
//                         <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-300 transition-colors group">
//                             <div className={`w-2 h-2 rounded-full transition-colors ${autoScroll && !isPaused ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`}></div>
//                             <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="hidden" />
//                             AUTO-SCROLL
//                         </label>
//                     </div>
//                 </main>

//                 {/* Sidebar (Right) - 384px (w-96) */}
//                 <aside className="w-96 bg-black/20 backdrop-blur-xl border-l border-white/[0.06] flex flex-col z-20">
//                     {/* Content Area */}
//                     <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
//                         {/* Connection */}
//                         <div className="space-y-4">
//                             <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Plug size={12} /> Connection</h3>
//                             <div className="relative w-full" ref={baudRef}>
//                                 <div className="relative flex items-center group">
//                                     <input type="text" inputMode="numeric" pattern="[0-9]*" value={baudRate} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setBaudRate(e.target.value); }} disabled={isConnected} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-50 font-mono pr-10" placeholder="Custom Baud..." />
//                                     <button onClick={() => !isConnected && setIsBaudDropdownOpen(!isBaudDropdownOpen)} disabled={isConnected} className="absolute right-3 p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-emerald-400 disabled:opacity-50 transition-colors"><ChevronDown size={16} className={`transition-transform ${isBaudDropdownOpen ? 'rotate-180' : ''}`} /></button>
//                                 </div>
//                                 {isBaudDropdownOpen && (
//                                     <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
//                                         {COMMON_BAUD_RATES.map(rate => (
//                                             <button key={rate} onClick={() => { setBaudRate(rate); setIsBaudDropdownOpen(false); }} className={`w-full text-left px-5 py-2.5 text-xs font-mono hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors flex items-center justify-between border-b border-white/[0.02] last:border-none ${parseInt(baudRate) === rate ? 'text-emerald-400 bg-emerald-500/5' : 'text-zinc-400'}`}><span>{rate}</span>{parseInt(baudRate) === rate && <Check size={14} />}</button>
//                                         ))}
//                                     </div>
//                                 )}
//                             </div>
//                             <button onClick={isConnected ? disconnectPort : () => setIsConnectModalOpen(true)} className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${isConnected ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:shadow-rose-500/10' : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-transparent hover:shadow-emerald-500/30'}`}>{isConnected ? 'DISCONNECT' : 'CONNECT DEVICE'}</button>
//                         </div>

//                         <div className="h-px bg-white/5 w-full"></div>

//                         {/* Quick Actions */}
//                         <div className="space-y-4">
//                             <div className="flex items-center justify-between">
//                                 <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Quick Actions</h3>
//                                 <button onClick={() => setIsEditingCmds(!isEditingCmds)} className={`p-1.5 rounded-lg transition-colors ${isEditingCmds ? 'bg-emerald-500 text-black' : 'hover:bg-white/10 text-zinc-600 hover:text-zinc-300'}`}>{isEditingCmds ? <Save size={12} /> : <Edit2 size={12} />}</button>
//                             </div>
//                             {isEditingCmds ? (
//                                 <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
//                                     {quickCommands.map((cmd) => (
//                                         <div key={cmd.id} className="flex gap-2">
//                                         <input type="text" value={cmd.label} onChange={(e) => updateQuickCommand(cmd.id, 'label', e.target.value)} className="w-1/3 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500/50 focus:outline-none" />
//                                         <input type="text" value={cmd.cmd} onChange={(e) => updateQuickCommand(cmd.id, 'cmd', e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400/80 focus:border-emerald-500/50 focus:outline-none" />
//                                         <button onClick={() => deleteQuickCommand(cmd.id)} className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"><Trash2 size={14} /></button>
//                                         </div>
//                                     ))}
//                                     <button onClick={addQuickCommand} className="w-full py-2.5 border border-dashed border-white/10 rounded-lg text-xs text-zinc-500 hover:text-emerald-400 transition-colors"><Plus size={14} className="inline mr-1"/> Add</button>
//                                 </div>
//                             ) : (
//                                 <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
//                                     {quickCommands.map((cmd) => (
//                                         <button key={cmd.id} onClick={() => sendData(cmd.cmd)} disabled={!isConnected} className="flex-none whitespace-nowrap px-4 py-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all text-xs font-medium text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed">{cmd.label}</button>
//                                     ))}
//                                 </div>
//                             )}
//                         </div>

//                         <div className="h-px bg-white/5 w-full"></div>

//                         {/* Highlight - Vertical Layout */}
//                         <div className="space-y-4">
//                             <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Highlighter size={12} /> Highlight</h3>
//                             <div className="flex flex-col gap-3">
//                                 <input type="text" value={highlightKeyword} onChange={(e) => setHighlightKeyword(e.target.value)} placeholder="Enter keyword to highlight..." className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-all" />
//                                 <div className="flex gap-2">
//                                     {[
//                                     {color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', bg: 'bg-amber-400'},
//                                     {color: 'text-rose-400 bg-rose-400/10 border-rose-400/20', bg: 'bg-rose-500'},
//                                     {color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', bg: 'bg-emerald-500'},
//                                     {color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', bg: 'bg-cyan-500'},
//                                     {color: 'text-violet-400 bg-violet-400/10 border-violet-400/20', bg: 'bg-violet-500'},
//                                     ].map((item, idx) => (
//                                         <button key={idx} onClick={() => setHighlightColor(item.color)} className={`flex-1 h-8 rounded-lg ${item.bg} ${highlightColor === item.color ? 'ring-2 ring-white/20 scale-105 shadow-lg opacity-100' : 'opacity-20 hover:opacity-80'} transition-all`} />
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Transmitter - Fixed Bottom */}
//                     <div className="flex-none p-6 border-t border-white/5 bg-black/40 z-30">
//                         <div className="flex flex-col gap-4">
//                         <div className="relative group">
//                             <textarea 
//                                 value={inputText}
//                                 onChange={(e) => setInputText(e.target.value)}
//                                 onKeyDown={handleInputKeyDown}
//                                 placeholder="Input payload..."
//                                 className="w-full h-32 bg-black/30 border border-white/10 rounded-xl p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 resize-none placeholder-zinc-600 transition-all custom-scrollbar"
//                             />
//                             <div className="absolute bottom-3 right-3 flex gap-2">
//                                 <button onClick={() => setUseHexSend(!useHexSend)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[10px] font-mono tracking-wide ${useHexSend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
//                                     {useHexSend ? 'HEX' : 'ASCII'}
//                                 </button>
//                                 <div className="flex bg-white/5 border border-white/5 rounded-md overflow-hidden">
//                                     {[
//                                         { label: '\\n', val: '\\n' },
//                                         { label: '\\r\\n', val: '\\r\\n' },
//                                         { label: 'Ø', val: 'none' },
//                                     ].map(opt => (
//                                         <button key={opt.val} onClick={() => setLineEnding(opt.val)} className={`px-2 py-1 text-[10px] font-mono transition-all ${lineEnding === opt.val ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>{opt.label}</button>
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                         <button onClick={() => sendData()} disabled={!isConnected} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white text-sm font-bold tracking-wide rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:shadow-none flex items-center justify-center gap-2.5 group hover:scale-[1.01] active:scale-[0.99]">
//                             <Send size={16} className="group-hover:translate-x-0.5 transition-transform" />
//                             SEND PAYLOAD
//                         </button>
//                         </div>
//                     </div>
//                 </aside>
//             </div>
//         </div>
//       </div>

//       <style>{`
//         .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
//         .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
//         .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 5px; }
//         .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
//         .custom-scrollbar::-webkit-scrollbar-corner { background: transparent; }
//         @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
//         .animate-gradient { animation: gradient 3s ease infinite; }
//       `}</style>
//     </div>
//   );
// }





// import React, { useState, useRef, useEffect } from 'react';
// import { 
//   Terminal, 
//   Settings, 
//   Download, 
//   Trash2, 
//   Play, 
//   Square, 
//   Highlighter, 
//   Send,
//   AlertCircle,
//   Zap,
//   Activity,
//   Cpu,
//   Command,
//   Radio,
//   Binary,
//   Copy,
//   Plus,
//   X,
//   Pause,
//   Edit2,
//   Save,
//   Plug,
//   Search,
//   Usb,
//   Monitor,
//   Unplug,
//   Hash,
//   Filter,
//   ChevronDown,
//   Check,
//   ArrowUp,
//   ArrowDown,
//   Minimize2,
//   Maximize2
// } from 'lucide-react';

// export default function App() {
//   // --- 状态定义 ---

//   // 串口相关
//   const [port, setPort] = useState(null);
//   const [availablePorts, setAvailablePorts] = useState([]); 
//   const [isConnected, setIsConnected] = useState(false);
  
//   // 核心引用
//   const readerRef = useRef(null);
//   const writerRef = useRef(null);
//   const readableStreamClosedRef = useRef(null);
//   const writableStreamClosedRef = useRef(null);
//   const baudRef = useRef(null);
//   const bufferRef = useRef('');
  
//   // 界面交互状态
//   const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
//   const [isBaudDropdownOpen, setIsBaudDropdownOpen] = useState(false);
//   const [portSearchQuery, setPortSearchQuery] = useState('');
//   const [isPaused, setIsPaused] = useState(false);
//   const isPausedRef = useRef(false);

//   // 日志相关
//   const [logs, setLogs] = useState([]);
//   const [autoScroll, setAutoScroll] = useState(true);
//   const logsEndRef = useRef(null);
//   const [viewMode, setViewMode] = useState('ascii'); // 'ascii' | 'hex'
//   const [logFilter, setLogFilter] = useState('');

//   // --- 持久化状态 (localStorage) - 增强版 ---
//   const usePersistedState = (key, defaultValue) => {
//     const [state, setState] = useState(() => {
//       try {
//         const storedValue = localStorage.getItem(key);
//         return storedValue ? JSON.parse(storedValue) : defaultValue;
//       } catch (error) {
//         console.error(`Error parsing localStorage key "${key}":`, error);
//         return defaultValue;
//       }
//     });

//     useEffect(() => {
//       try {
//         localStorage.setItem(key, JSON.stringify(state));
//       } catch (error) {
//         console.error(`Error setting localStorage key "${key}":`, error);
//       }
//     }, [key, state]);

//     return [state, setState];
//   };

//   // 使用持久化状态
//   const [baudRate, setBaudRate] = usePersistedState('serial_baudrate', 115200);
//   const [highlightKeyword, setHighlightKeyword] = usePersistedState('serial_highlight_kw', '');
//   const [highlightColor, setHighlightColor] = usePersistedState('serial_highlight_color', 'text-amber-400 bg-amber-400/10 border-amber-400/20');
//   const [quickCommands, setQuickCommands] = usePersistedState('serial_quick_cmds', [
//     { id: 1, label: 'AT Test', cmd: 'AT' },
//     { id: 2, label: 'Reset', cmd: 'AT+RST' },
//     { id: 3, label: 'Version', cmd: 'AT+GMR' },
//     { id: 4, label: 'Scan', cmd: 'AT+CWLAP' },
//     { id: 5, label: 'IP Addr', cmd: 'AT+CIFSR' },
//   ]);
//   const [useHexSend, setUseHexSend] = usePersistedState('serial_use_hex_send', false);
//   const [lineEnding, setLineEnding] = usePersistedState('serial_line_ending', '\\n'); // none, \n, \r, \r\n

//   // 发送相关
//   const [inputText, setInputText] = useState('');
//   const [showTimestamp, setShowTimestamp] = useState(true);
//   const [isEditingCmds, setIsEditingCmds] = useState(false);
//   const [copyFeedback, setCopyFeedback] = useState(null);

//   // 历史记录相关
//   const [sendHistory, setSendHistory] = useState([]);
//   const [historyIndex, setHistoryIndex] = useState(-1); // -1 表示当前输入

//   // 浏览器兼容性
//   const isWebSerialSupported = 'serial' in navigator;

//   // --- Effect Hooks ---

//   useEffect(() => {
//     document.title = "SerialFlux - Pro Web Debugger";
//   }, []);

//   useEffect(() => {
//     isPausedRef.current = isPaused;
//   }, [isPaused]);

//   // 点击外部关闭波特率下拉
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (baudRef.current && !baudRef.current.contains(event.target)) {
//         setIsBaudDropdownOpen(false);
//       }
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, []);

//   // 端口监听
//   useEffect(() => {
//     if (!isWebSerialSupported) return;
//     const updatePorts = async () => {
//       try {
//         const ports = await navigator.serial.getPorts();
//         setAvailablePorts(ports);
//       } catch (e) { console.error(e); }
//     };
//     updatePorts();
//     const handleConnectEvent = () => updatePorts();
//     const handleDisconnectEvent = (e) => {
//       updatePorts();
//       if (port === e.target) disconnectPort();
//     };
//     navigator.serial.addEventListener('connect', handleConnectEvent);
//     navigator.serial.addEventListener('disconnect', handleDisconnectEvent);
//     return () => {
//       navigator.serial.removeEventListener('connect', handleConnectEvent);
//       navigator.serial.removeEventListener('disconnect', handleDisconnectEvent);
//     };
//   }, [port]);

//   // 自动滚动
//   useEffect(() => {
//     if (autoScroll && !isPaused && logsEndRef.current && !logFilter) {
//       logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
//     }
//   }, [logs, autoScroll, viewMode, isPaused, logFilter]);

//   // --- 核心逻辑 ---

//   const openPort = async (selectedPort) => {
//     try {
//       if (!selectedPort) return;
//       if (port && isConnected) await disconnectPort();

//       // 确保 baudRate 是数字，防止从 localStorage 读到奇怪的东西导致连接失败
//       const baud = parseInt(baudRate) || 115200;
//       await selectedPort.open({ baudRate: baud });
      
//       setPort(selectedPort);
//       setIsConnected(true);
//       setIsPaused(false);
//       setIsConnectModalOpen(false);
//       bufferRef.current = '';

//       const ports = await navigator.serial.getPorts();
//       setAvailablePorts(ports);
      
//       const textDecoder = new TextDecoderStream();
//       const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
//       readableStreamClosedRef.current = readableStreamClosed;
//       const reader = textDecoder.readable.getReader();
//       readerRef.current = reader;

//       const textEncoder = new TextEncoderStream();
//       const writableStreamClosed = textEncoder.readable.pipeTo(selectedPort.writable);
//       writableStreamClosedRef.current = writableStreamClosed;
//       const writer = textEncoder.writable.getWriter();
//       writerRef.current = writer;

//       readLoop();
//     } catch (error) {
//       console.error('Connection failed:', error);
//       alert('Connection failed: ' + error.message);
//     }
//   };

//   const readLoop = async () => {
//     try {
//       while (true) {
//         const { value, done } = await readerRef.current.read();
//         if (done) {
//           readerRef.current.releaseLock();
//           break;
//         }
//         if (value) processIncomingData(value);
//       }
//     } catch (error) { console.error('Read error:', error); }
//   };

//   const processIncomingData = (chunk) => {
//     bufferRef.current += chunk;
//     if (bufferRef.current.includes('\n')) {
//       const lines = bufferRef.current.split(/\r?\n/);
//       const completeLines = lines.slice(0, -1);
//       bufferRef.current = lines[lines.length - 1];
//       if (!isPausedRef.current && completeLines.length > 0) {
//         addLogs(completeLines, 'rx');
//       }
//     }
//   };

//   const disconnectPort = async () => {
//     try {
//       if (readerRef.current) {
//         await readerRef.current.cancel();
//         await readableStreamClosedRef.current.catch(() => {});
//         readerRef.current = null;
//       }
//       if (writerRef.current) {
//         await writerRef.current.close();
//         await writableStreamClosedRef.current;
//         writerRef.current = null;
//       }
//       if (port) {
//         await port.close();
//         setPort(null);
//         setIsConnected(false);
//       }
//     } catch (error) { console.error('Disconnect error:', error); }
//   };

//   const addLogs = (newLines, type) => {
//     setLogs(prev => {
//       const newEntries = newLines.map(text => ({
//         id: Date.now() + Math.random(),
//         timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 }),
//         text: text,
//         type: type 
//       }));
//       const updated = [...prev, ...newEntries];
//       if (updated.length > 2000) return updated.slice(-2000);
//       return updated;
//     });
//   };

//   // --- 导出数据功能 ---
//   const exportData = () => {
//     const content = logs.map(l => `[${l.timestamp}] ${l.type === 'tx' ? 'TX' : 'RX'}: ${l.text}`).join('\n');
//     const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement('a');
//     link.href = url;
//     link.download = `serial_log_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   // --- 发送逻辑 ---

//   const sendData = async (textToSend = null) => {
//     const rawData = textToSend !== null ? textToSend : inputText;
//     if (!port || !writerRef.current || !rawData) return;

//     if (textToSend === null && rawData.trim() !== '') {
//         setSendHistory(prev => {
//             const newHistory = [rawData, ...prev].slice(0, 50); 
//             return newHistory;
//         });
//         setHistoryIndex(-1); 
//     }

//     try {
//       if (useHexSend) {
//           alert("提示：当前 Web 架构主要针对文本调试。HEX 模式发送暂未完全实装 (需重写底层流管道)。");
//       } else {
//           // ASCII 模式发送
//           let finalData = rawData;
//           if (lineEnding === '\\n') finalData += '\n';
//           else if (lineEnding === '\\r') finalData += '\r';
//           else if (lineEnding === '\\r\\n') finalData += '\r\n';
          
//           await writerRef.current.write(finalData);
//           addLogs([finalData.replace(/\r/g, '').replace(/\n/g, '')], 'tx'); 
//       }
      
//       if (textToSend === null) setInputText(''); 
//     } catch (error) {
//       console.error('Send failed:', error);
//     }
//   };

//   const handleInputKeyDown = (e) => {
//     if (e.key === 'Enter') {
//         if (e.ctrlKey) {
//             sendData();
//         }
//     } else if (e.key === 'ArrowUp') {
//         e.preventDefault();
//         if (sendHistory.length > 0) {
//             const nextIndex = Math.min(historyIndex + 1, sendHistory.length - 1);
//             setHistoryIndex(nextIndex);
//             setInputText(sendHistory[nextIndex]);
//         }
//     } else if (e.key === 'ArrowDown') {
//         e.preventDefault();
//         if (historyIndex > 0) {
//             const nextIndex = historyIndex - 1;
//             setHistoryIndex(nextIndex);
//             setInputText(sendHistory[nextIndex]);
//         } else if (historyIndex === 0) {
//             setHistoryIndex(-1);
//             setInputText(''); 
//         }
//     }
//   };

//   // --- 辅助函数 ---

//   const forgetPort = async (e, portToForget) => {
//     e.stopPropagation();
//     try {
//         if (portToForget === port && isConnected) await disconnectPort();
//         await portToForget.forget();
//         const ports = await navigator.serial.getPorts();
//         setAvailablePorts(ports);
//     } catch (error) {
//         alert('Could not forget port. Require Chrome 103+.');
//     }
//   };

//   const requestNewPort = async () => {
//     try {
//       const selectedPort = await navigator.serial.requestPort();
//       openPort(selectedPort);
//     } catch (error) { console.log('User cancelled'); }
//   };

//   const toHexDisplay = (str) => {
//     let result = '';
//     for (let i = 0; i < str.length; i++) {
//       const hex = str.charCodeAt(i).toString(16).toUpperCase().padStart(2, '0');
//       result += hex + ' ';
//     }
//     return result.trim();
//   };

//   const copyToClipboard = (text) => {
//     navigator.clipboard.writeText(text);
//     setCopyFeedback(text.substring(0, 20) + '...');
//     setTimeout(() => setCopyFeedback(null), 1500);
//   };

//   const renderLogContent = (text) => {
//     // 强制转换为字符串，防止对象渲染错误
//     const safeText = String(text);
    
//     const contentToRender = viewMode === 'hex' ? toHexDisplay(safeText) : safeText;
//     if (!highlightKeyword || viewMode === 'hex') return contentToRender;
//     const parts = contentToRender.split(new RegExp(`(${highlightKeyword})`, 'gi'));
//     return (
//       <span>
//         {parts.map((part, i) => 
//           part.toLowerCase() === highlightKeyword.toLowerCase() ? (
//             <span key={i} className={`${highlightColor} font-bold px-1.5 py-0.5 rounded border text-[11px] tracking-wide mx-0.5 shadow-[0_0_10px_rgba(0,0,0,0.2)]`}>
//               {part}
//             </span>
//           ) : (part)
//         )}
//       </span>
//     );
//   };

//   // 格式化相关
//   const getPortInfo = (port, index) => {
//     const info = port.getInfo();
//     if (info.usbVendorId && info.usbProductId) {
//       const vid = info.usbVendorId.toString(16).toUpperCase().padStart(4, '0');
//       const pid = info.usbProductId.toString(16).toUpperCase().padStart(4, '0');
//       return { name: `USB Serial Device`, meta: `VID:${vid} PID:${pid}`, id: `${vid}:${pid}` };
//     }
//     return { name: `Serial Port ${index + 1}`, meta: 'Generic Device', id: `generic-${index}` };
//   };

//   const filteredPorts = availablePorts.filter((p, index) => {
//     if (!portSearchQuery) return true;
//     const info = getPortInfo(p, index);
//     const searchLower = portSearchQuery.toLowerCase();
//     return info.name.toLowerCase().includes(searchLower) || info.meta.toLowerCase().includes(searchLower);
//   });

//   const filteredLogs = logs.filter(log => {
//     if (!logFilter) return true;
//     // 强制转换防止崩溃
//     return String(log.text).toLowerCase().includes(logFilter.toLowerCase());
//   });

//   const updateQuickCommand = (id, field, value) => {
//     setQuickCommands(prev => prev.map(cmd => cmd.id === id ? { ...cmd, [field]: value } : cmd));
//   };
//   const addQuickCommand = () => {
//     const newId = Math.max(0, ...quickCommands.map(c => c.id)) + 1;
//     setQuickCommands([...quickCommands, { id: newId, label: 'Cmd', cmd: '' }]);
//   };
//   const deleteQuickCommand = (id) => {
//     setQuickCommands(prev => prev.filter(c => c.id !== id));
//   };

//   if (!isWebSerialSupported) {
//     return (
//       <div className="flex h-screen items-center justify-center bg-zinc-950 text-white font-sans">
//         <div className="text-center p-8 bg-zinc-900/50 rounded-2xl border border-white/10 shadow-2xl max-w-md backdrop-blur-xl">
//           <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6 opacity-80" strokeWidth={1.5} />
//           <h2 className="text-2xl font-bold mb-3 tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Browser Not Supported</h2>
//           <p className="text-zinc-500 leading-relaxed text-sm">Web Serial API is required. Please use Chrome or Edge.</p>
//         </div>
//       </div>
//     );
//   }

//   const COMMON_BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600, 1000000, 2000000];

//   return (
//     // 桌面环境容器 (模拟桌面)
//     <div className="flex h-screen w-full items-center justify-center bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-hidden relative">
      
//       {/* 桌面背景 - 极光网格 */}
//       <div className="absolute inset-0 pointer-events-none z-0">
//          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950/80 to-zinc-950"></div>
//          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
//          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
//       </div>

//       {/* 应用窗口 (Window Container) - 模拟实物面板 */}
//       <div className="relative w-[95vw] h-[90vh] max-w-[1280px] max-h-[850px] flex flex-col animate-in fade-in zoom-in-95 duration-500 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)]">
        
//         {/* 外壳边框 (Bezel) */}
//         <div className="absolute inset-0 rounded-2xl border border-white/5 bg-zinc-900/95 backdrop-blur-3xl z-0 box-border pointer-events-none ring-1 ring-white/5">
//             {/* 顶部高光 */}
//             <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
//         </div>

//         {/* 装饰性：螺丝孔位 */}
//         <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>

//         {/* 内容区域容器 */}
//         <div className="relative z-10 flex flex-col w-full h-full rounded-2xl overflow-hidden bg-transparent">
            
//             {/* Window Title Bar (Mac Style + Industrial Text) */}
//             <div className="h-10 bg-black/20 border-b border-white/5 flex items-center justify-between px-6 select-none flex-none z-50 backdrop-blur-sm">
//                 <div className="flex gap-2 group">
//                     <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/20 shadow-inner"></div>
//                     <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/20 shadow-inner"></div>
//                     <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/20 shadow-inner"></div>
//                 </div>
//                 <div className="text-xs font-bold text-zinc-500 tracking-widest uppercase flex items-center gap-2 opacity-80">
//                     <Command size={12} className="text-emerald-500" />
//                     SERIAL FLUX PRO <span className="text-[9px] px-1 bg-white/5 rounded text-zinc-600 font-mono">V1.0</span>
//                 </div>
//                 <div className="w-14"></div> 
//             </div>

//             {/* Inner Content Area */}
//             <div className="flex-1 flex overflow-hidden relative">
                
//                 {/* Copy Feedback Toast (Inside Window) */}
//                 {copyFeedback && (
//                     <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full shadow-2xl text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none flex items-center gap-2">
//                     <Copy size={14} />
//                     {copyFeedback}
//                     </div>
//                 )}

//                 {/* ... Connect Modal Component (Scoped) ... */}
//                 {isConnectModalOpen && (
//                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] animate-in fade-in duration-200">
//                         <div className="relative w-[500px] bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80%] ring-1 ring-white/10">
//                             {/* Modal Header */}
//                             <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
//                                 <div className="flex items-center gap-4">
//                                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center ring-1 ring-white/5 shadow-inner">
//                                         <Plug size={20} className="text-emerald-400" />
//                                     </div>
//                                     <div>
//                                         <h3 className="text-base font-bold text-zinc-100 tracking-tight">Device Manager</h3>
//                                         <p className="text-xs text-zinc-500 mt-0.5 font-medium">Select a serial port to connect</p>
//                                     </div>
//                                 </div>
//                                 <button onClick={() => setIsConnectModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
//                             </div>

//                             {/* Search */}
//                             {availablePorts.length > 0 && (
//                                 <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/30">
//                                     <div className="relative group/search">
//                                     <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within/search:text-emerald-400 transition-colors" />
//                                     <input type="text" placeholder="Filter devices..." value={portSearchQuery} onChange={(e) => setPortSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-lg pl-9 pr-4 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 placeholder-zinc-600 transition-all" />
//                                     </div>
//                                 </div>
//                             )}

//                             {/* List */}
//                             <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-[200px] bg-black/20">
//                                 {availablePorts.length === 0 ? (
//                                     <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 py-10">
//                                         <div className="w-12 h-12 rounded-full bg-zinc-900/80 flex items-center justify-center mb-4 shadow-lg ring-1 ring-white/5"><Usb size={20} className="opacity-30" /></div>
//                                         <p className="text-sm font-medium text-zinc-400">No devices found</p>
//                                         <p className="text-xs opacity-50 mt-1">Browser security requires manual authorization.</p>
//                                     </div>
//                                 ) : (
//                                     filteredPorts.map((p, index) => {
//                                         const info = getPortInfo(p, index);
//                                         const isCurrent = port === p && isConnected;
//                                         return (
//                                         <div key={index} onClick={() => openPort(p)} className={`w-full text-left p-3.5 rounded-xl border transition-all group/item relative overflow-hidden cursor-pointer flex items-center justify-between ${isCurrent ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/60 border-white/5 hover:border-emerald-500/20 hover:bg-zinc-800'}`}>
//                                             <div className="flex items-center gap-4 relative z-10">
//                                                 <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${isCurrent ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-black/50 border-white/5 text-zinc-600 group-hover/item:text-emerald-400 group-hover/item:border-emerald-500/20'}`}><Usb size={18} /></div>
//                                                 <div>
//                                                     <div className={`text-sm font-semibold transition-colors ${isCurrent ? 'text-emerald-400' : 'text-zinc-300 group-hover/item:text-white'}`}>{info.name}</div>
//                                                     <div className="text-[10px] font-mono text-zinc-600 group-hover/item:text-zinc-500 flex items-center gap-2 mt-0.5"><span>{info.meta}</span></div>
//                                                 </div>
//                                             </div>
//                                             <button onClick={(e) => forgetPort(e, p)} className="p-2 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover/item:opacity-100 transition-all z-20" title="Forget Device"><Trash2 size={14} /></button>
//                                         </div>
//                                         );
//                                     })
//                                 )}
//                             </div>

//                             {/* Footer */}
//                             <div className="p-5 border-t border-white/5 bg-zinc-900/50">
//                                 <button onClick={requestNewPort} className="relative w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold tracking-widest transition-all shadow-lg shadow-emerald-900/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-3 group/btn overflow-hidden">
//                                     <Search size={16} strokeWidth={2.5} className="relative z-10" />
//                                     <span className="relative z-10">SCAN FOR NEW DEVICES</span>
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 )}

//                 {/* Main Area - Left Panel */}
//                 <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
                    
//                     {/* Top Floating Toolbar */}
//                     <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between">
//                         <div className={`flex items-center gap-3 px-3 py-2 pr-5 rounded-full border backdrop-blur-md transition-all duration-500 ${isConnected ? 'bg-emerald-950/40 border-emerald-500/30 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]' : 'bg-black/40 border-white/10'}`}>
//                         <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isConnected ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>{isConnected ? <Activity size={14} className="animate-pulse" /> : <Zap size={14} />}</div>
//                         <div className="flex flex-col">
//                             <span className={`text-xs font-bold tracking-wider uppercase ${isConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>{isConnected ? 'Connected' : 'Offline'}</span>
//                             {isConnected && <span className="text-[9px] text-zinc-500 leading-none">{String(baudRate)} bps</span>}
//                         </div>
//                         </div>

//                         <div className="flex items-center gap-3">
//                             <div className="relative group/search">
//                                 <div className={`absolute inset-y-0 left-3 flex items-center pointer-events-none transition-colors ${logFilter ? 'text-emerald-400' : 'text-zinc-500'}`}><Filter size={14} /></div>
//                                 <input type="text" value={logFilter} onChange={(e) => setLogFilter(e.target.value)} placeholder="Search logs..." className={`h-11 pl-9 pr-4 rounded-full border text-xs bg-black/40 backdrop-blur-md transition-all outline-none w-32 focus:w-48 ${logFilter ? 'border-emerald-500/50 text-emerald-300' : 'border-white/10 text-zinc-300 focus:border-white/20'}`} />
//                                 {logFilter && <button onClick={() => setLogFilter('')} className="absolute inset-y-0 right-2 flex items-center text-zinc-500 hover:text-white"><X size={12} /></button>}
//                             </div>

//                             <div className="flex items-center p-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md shadow-xl gap-1">
//                                 <div className="flex bg-white/5 rounded-full p-0.5 border border-white/5">
//                                     <button onClick={() => setViewMode('ascii')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'ascii' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>ASC</button>
//                                     <button onClick={() => setViewMode('hex')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'hex' ? 'bg-emerald-600/20 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>HEX</button>
//                                 </div>
//                                 <div className="w-px h-4 bg-white/10 mx-1"></div>
//                                 {isConnected && (
//                                     <button onClick={() => setIsPaused(!isPaused)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`} title={isPaused ? "Resume View" : "Pause View"}>{isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}</button>
//                                 )}
//                                 <button onClick={exportData} disabled={logs.length === 0} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-emerald-400 transition-all disabled:opacity-30" title="Export Log"><Download size={14} strokeWidth={2} /></button>
//                                 <button onClick={() => setLogs([])} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400 transition-all" title="Clear Console"><Trash2 size={14} strokeWidth={2} /></button>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Terminal Area */}
//                     <div className="flex-1 pt-24 pb-8 px-8 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed relative">
//                         {isPaused && (
//                             <div className="fixed top-24 left-1/2 -translate-x-1/2 mt-12 px-3 py-1 bg-amber-500/90 text-black text-[10px] font-bold rounded-md shadow-lg z-30 pointer-events-none uppercase tracking-wider backdrop-blur-md">
//                                 View Paused
//                             </div>
//                         )}
//                         {logs.length === 0 ? (
//                             <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
//                                 <Terminal size={64} className="text-emerald-400 mb-4" strokeWidth={1} />
//                                 <p className="text-zinc-500 font-light tracking-wide text-base">READY TO CONNECT</p>
//                             </div>
//                         ) : (
//                             <div className="space-y-0.5">
//                                 {filteredLogs.map((log) => (
//                                     <div key={log.id} onClick={() => copyToClipboard(log.text)} className="flex gap-4 hover:bg-white/[0.04] -mx-4 px-4 py-0.5 rounded transition-colors group cursor-pointer relative" title="Click to copy line">
//                                         {showTimestamp && <span className="text-zinc-600 shrink-0 select-none text-[11px] pt-[3px] font-medium font-sans">{log.timestamp}</span>}
//                                         <div className={`tracking-tight whitespace-pre-wrap break-all flex-1 ${log.type === 'tx' ? 'text-indigo-300/80' : 'text-emerald-400'}`}>{log.type === 'tx' && <span className="text-indigo-500 mr-2 text-[10px] align-middle inline-block font-bold select-none">TX</span>}{renderLogContent(log.text)}</div>
//                                     </div>
//                                 ))}
//                                 {filteredLogs.length === 0 && logFilter && <div className="text-zinc-500 text-xs text-center py-10">No matching logs found for "{logFilter}"</div>}
//                                 <div ref={logsEndRef} />
//                             </div>
//                         )}
//                     </div>

//                     {/* Footer Status - With RX/TX Lights */}
//                     <div className="h-10 flex items-center justify-between px-8 text-xs text-zinc-500 select-none border-t border-white/[0.05] bg-black/20">
//                         <div className="flex items-center gap-6 font-medium">
//                             <span className="flex items-center gap-2">
//                                 <span className={`w-2 h-2 rounded-full transition-all duration-100 ${logs.length > 0 && logs[logs.length-1].type === 'rx' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-emerald-500/20'}`}></span>
//                                 RX: {logs.filter(l => l.type === 'rx').length}
//                             </span>
//                             <span className="flex items-center gap-2">
//                                 <span className={`w-2 h-2 rounded-full transition-all duration-100 ${logs.length > 0 && logs[logs.length-1].type === 'tx' ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-indigo-500/20'}`}></span>
//                                 TX: {logs.filter(l => l.type === 'tx').length}
//                             </span>
//                         </div>
//                         <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-300 transition-colors group">
//                             <div className={`w-2 h-2 rounded-full transition-colors ${autoScroll && !isPaused ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`}></div>
//                             <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="hidden" />
//                             AUTO-SCROLL
//                         </label>
//                     </div>
//                 </main>

//                 {/* Sidebar (Right) - 384px (w-96) */}
//                 <aside className="w-96 bg-black/20 backdrop-blur-xl border-l border-white/[0.06] flex flex-col z-20">
//                     {/* Content Area */}
//                     <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
//                         {/* Connection */}
//                         <div className="space-y-4">
//                             <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Plug size={12} /> Connection</h3>
//                             <div className="relative w-full" ref={baudRef}>
//                                 <div className="relative flex items-center group">
//                                     <input type="text" inputMode="numeric" pattern="[0-9]*" value={baudRate} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setBaudRate(e.target.value); }} disabled={isConnected} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-50 font-mono pr-10" placeholder="Custom Baud..." />
//                                     <button onClick={() => !isConnected && setIsBaudDropdownOpen(!isBaudDropdownOpen)} disabled={isConnected} className="absolute right-3 p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-emerald-400 disabled:opacity-50 transition-colors"><ChevronDown size={16} className={`transition-transform ${isBaudDropdownOpen ? 'rotate-180' : ''}`} /></button>
//                                 </div>
//                                 {isBaudDropdownOpen && (
//                                     <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
//                                         {COMMON_BAUD_RATES.map(rate => (
//                                             <button key={rate} onClick={() => { setBaudRate(rate); setIsBaudDropdownOpen(false); }} className={`w-full text-left px-5 py-2.5 text-xs font-mono hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors flex items-center justify-between border-b border-white/[0.02] last:border-none ${parseInt(baudRate) === rate ? 'text-emerald-400 bg-emerald-500/5' : 'text-zinc-400'}`}><span>{rate}</span>{parseInt(baudRate) === rate && <Check size={14} />}</button>
//                                         ))}
//                                     </div>
//                                 )}
//                             </div>
//                             <button onClick={isConnected ? disconnectPort : () => setIsConnectModalOpen(true)} className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${isConnected ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:shadow-rose-500/10' : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-transparent hover:shadow-emerald-500/30'}`}>{isConnected ? 'DISCONNECT' : 'CONNECT DEVICE'}</button>
//                         </div>

//                         <div className="h-px bg-white/5 w-full"></div>

//                         {/* Quick Actions */}
//                         <div className="space-y-4">
//                             <div className="flex items-center justify-between">
//                                 <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Quick Actions</h3>
//                                 <button onClick={() => setIsEditingCmds(!isEditingCmds)} className={`p-1.5 rounded-lg transition-colors ${isEditingCmds ? 'bg-emerald-500 text-black' : 'hover:bg-white/10 text-zinc-600 hover:text-zinc-300'}`}>{isEditingCmds ? <Save size={12} /> : <Edit2 size={12} />}</button>
//                             </div>
//                             {isEditingCmds ? (
//                                 <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
//                                     {quickCommands.map((cmd) => (
//                                         <div key={cmd.id} className="flex gap-2">
//                                         <input type="text" value={cmd.label} onChange={(e) => updateQuickCommand(cmd.id, 'label', e.target.value)} className="w-1/3 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500/50 focus:outline-none" />
//                                         <input type="text" value={cmd.cmd} onChange={(e) => updateQuickCommand(cmd.id, 'cmd', e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400/80 focus:border-emerald-500/50 focus:outline-none" />
//                                         <button onClick={() => deleteQuickCommand(cmd.id)} className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"><Trash2 size={14} /></button>
//                                         </div>
//                                     ))}
//                                     <button onClick={addQuickCommand} className="w-full py-2.5 border border-dashed border-white/10 rounded-lg text-xs text-zinc-500 hover:text-emerald-400 transition-colors"><Plus size={14} className="inline mr-1"/> Add</button>
//                                 </div>
//                             ) : (
//                                 <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
//                                     {quickCommands.map((cmd) => (
//                                         <button key={cmd.id} onClick={() => sendData(cmd.cmd)} disabled={!isConnected} className="flex-none whitespace-nowrap px-4 py-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all text-xs font-medium text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed">{cmd.label}</button>
//                                     ))}
//                                 </div>
//                             )}
//                         </div>

//                         <div className="h-px bg-white/5 w-full"></div>

//                         {/* Highlight - Vertical Layout */}
//                         <div className="space-y-4">
//                             <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Highlighter size={12} /> Highlight</h3>
//                             <div className="flex flex-col gap-3">
//                                 <input type="text" value={highlightKeyword} onChange={(e) => setHighlightKeyword(e.target.value)} placeholder="Enter keyword to highlight..." className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-all" />
//                                 <div className="flex gap-2">
//                                     {[
//                                     {color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', bg: 'bg-amber-400'},
//                                     {color: 'text-rose-400 bg-rose-400/10 border-rose-400/20', bg: 'bg-rose-500'},
//                                     {color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', bg: 'bg-emerald-500'},
//                                     {color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', bg: 'bg-cyan-500'},
//                                     {color: 'text-violet-400 bg-violet-400/10 border-violet-400/20', bg: 'bg-violet-500'},
//                                     ].map((item, idx) => (
//                                         <button key={idx} onClick={() => setHighlightColor(item.color)} className={`flex-1 h-8 rounded-lg ${item.bg} ${highlightColor === item.color ? 'ring-2 ring-white/20 scale-105 shadow-lg opacity-100' : 'opacity-20 hover:opacity-80'} transition-all`} />
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Transmitter - Fixed Bottom */}
//                     <div className="flex-none p-6 border-t border-white/5 bg-black/40 z-30">
//                         <div className="flex flex-col gap-4">
//                         <div className="relative group">
//                             <textarea 
//                                 value={inputText}
//                                 onChange={(e) => setInputText(e.target.value)}
//                                 onKeyDown={handleInputKeyDown}
//                                 placeholder="Input payload..."
//                                 className="w-full h-32 bg-black/30 border border-white/10 rounded-xl p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 resize-none placeholder-zinc-600 transition-all custom-scrollbar"
//                             />
//                             <div className="absolute bottom-3 right-3 flex gap-2">
//                                 <button onClick={() => setUseHexSend(!useHexSend)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[10px] font-mono tracking-wide ${useHexSend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>
//                                     {useHexSend ? 'HEX' : 'ASCII'}
//                                 </button>
//                                 <div className="flex bg-white/5 border border-white/5 rounded-md overflow-hidden">
//                                     {[
//                                         { label: '\\n', val: '\\n' },
//                                         { label: '\\r\\n', val: '\\r\\n' },
//                                         { label: 'Ø', val: 'none' },
//                                     ].map(opt => (
//                                         <button key={opt.val} onClick={() => setLineEnding(opt.val)} className={`px-2 py-1 text-[10px] font-mono transition-all ${lineEnding === opt.val ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>{opt.label}</button>
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                         <button onClick={() => sendData()} disabled={!isConnected} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white text-sm font-bold tracking-wide rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:shadow-none flex items-center justify-center gap-2.5 group hover:scale-[1.01] active:scale-[0.99]">
//                             <Send size={16} className="group-hover:translate-x-0.5 transition-transform" />
//                             SEND PAYLOAD
//                         </button>
//                         </div>
//                     </div>
//                 </aside>
//             </div>
//         </div>
//       </div>

//       <style>{`
//         .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
//         .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
//         .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 5px; }
//         .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
//         .custom-scrollbar::-webkit-scrollbar-corner { background: transparent; }
//         @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
//         .animate-gradient { animation: gradient 3s ease infinite; }
//       `}</style>
//     </div>
//   );
// }

//---------------------------------------------------------------------------------

// import React, { useState, useRef, useEffect } from 'react';
// import { 
//   Terminal, Settings, Download, Trash2, Play, Square, Highlighter, Send, 
//   AlertCircle, Zap, Activity, Cpu, Command, Radio, Binary, Copy, Plus, X, 
//   Pause, Edit2, Save, Plug, Search, Usb, Monitor, Unplug, Hash, Filter, 
//   ChevronDown, Check, ArrowUp, ArrowDown, ShieldCheck, Languages
// } from 'lucide-react';

// export default function App() {
//   // --- 状态定义 ---

//   // 串口核心
//   const [port, setPort] = useState(null);
//   const [availablePorts, setAvailablePorts] = useState([]); 
//   const [isConnected, setIsConnected] = useState(false);
//   const readerRef = useRef(null);
//   const writerRef = useRef(null);
//   const closingRef = useRef(false); // 标记是否正在关闭
  
//   // 关键引用
//   const baudRef = useRef(null); 
//   const bufferRef = useRef('');
  
//   // 界面交互状态
//   const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
//   const [isBaudDropdownOpen, setIsBaudDropdownOpen] = useState(false);
//   const [portSearchQuery, setPortSearchQuery] = useState('');
//   const [isPaused, setIsPaused] = useState(false);
//   const isPausedRef = useRef(false);

//   // 日志数据 (环形缓冲)
//   const [logs, setLogs] = useState([]);
//   const logsEndRef = useRef(null);
//   const [autoScroll, setAutoScroll] = useState(true);
//   const [viewMode, setViewMode] = useState('ascii'); // 'ascii' | 'hex'
//   const [logFilter, setLogFilter] = useState('');
//   const filterInputRef = useRef(null);

//   // --- 持久化状态 (localStorage) - 增强版 ---
//   const usePersistedState = (key, defaultValue) => {
//     const [state, setState] = useState(() => {
//       try {
//         const item = localStorage.getItem(key);
//         return item ? JSON.parse(item) : defaultValue;
//       } catch (error) {
//         console.warn(`Resetting state for ${key} due to parse error.`);
//         return defaultValue;
//       }
//     });

//     useEffect(() => {
//       try {
//         localStorage.setItem(key, JSON.stringify(state));
//       } catch (e) { console.error(e); }
//     }, [key, state]);

//     return [state, setState];
//   };

//   const [baudRate, setBaudRate] = usePersistedState('sf_baud', 115200);
//   const [encoding, setEncoding] = usePersistedState('sf_encoding', 'utf-8'); 
//   const [highlightKeyword, setHighlightKeyword] = usePersistedState('sf_hl_kw', '');
//   const [highlightColor, setHighlightColor] = usePersistedState('sf_hl_col', 'text-amber-400 bg-amber-400/10 border-amber-400/20');
//   const [quickCommands, setQuickCommands] = usePersistedState('sf_cmds', [
//     { id: 1, label: 'AT Test', cmd: 'AT' },
//     { id: 2, label: 'Reset', cmd: 'AT+RST' },
//     { id: 3, label: 'Version', cmd: 'AT+GMR' },
//   ]);
//   const [useHexSend, setUseHexSend] = usePersistedState('sf_hex_send', false);
//   const [lineEnding, setLineEnding] = usePersistedState('sf_eol', '\\n'); 
//   const [appendCRC, setAppendCRC] = usePersistedState('sf_crc', false);

//   // 发送相关
//   const [inputText, setInputText] = useState('');
//   const [sendHistory, setSendHistory] = useState([]);
//   const [historyIndex, setHistoryIndex] = useState(-1);
//   const [isEditingCmds, setIsEditingCmds] = useState(false);
//   const [copyFeedback, setCopyFeedback] = useState(null);
  
//   // 状态定义补充
//   const [showTimestamp, setShowTimestamp] = useState(true);

//   const isWebSerialSupported = 'serial' in navigator;

//   // --- Effect Hooks ---

//   useEffect(() => { document.title = "SerialFlux Pro"; }, []);
//   useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

//   // 全局快捷键
//   useEffect(() => {
//     const handleGlobalKeyDown = (e) => {
//       if (e.ctrlKey && e.key === 'l') { 
//         e.preventDefault();
//         setLogs([]);
//       }
//       if (e.ctrlKey && e.key === 'f') { 
//         e.preventDefault();
//         filterInputRef.current?.focus();
//       }
//     };
//     window.addEventListener('keydown', handleGlobalKeyDown);
//     return () => window.removeEventListener('keydown', handleGlobalKeyDown);
//   }, []);

//   // 点击外部关闭下拉
//   useEffect(() => {
//     const closeDropdown = (e) => {
//       if (baudRef.current && !baudRef.current.contains(e.target)) setIsBaudDropdownOpen(false);
//     };
//     document.addEventListener('mousedown', closeDropdown);
//     return () => document.removeEventListener('mousedown', closeDropdown);
//   }, []);

//   // 端口监听
//   useEffect(() => {
//     if (!isWebSerialSupported) return;
//     const updatePorts = async () => {
//       try { setAvailablePorts(await navigator.serial.getPorts()); } catch (e) { console.error(e); }
//     };
//     updatePorts();
//     navigator.serial.addEventListener('connect', updatePorts);
//     navigator.serial.addEventListener('disconnect', (e) => {
//       updatePorts();
//       if (port === e.target) disconnectPort();
//     });
//     return () => {}; 
//   }, [port]);

//   // 自动滚动
//   useEffect(() => {
//     if (autoScroll && !isPaused && logsEndRef.current && !logFilter) {
//       logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
//     }
//   }, [logs, autoScroll, viewMode, isPaused, logFilter]);

//   // --- 辅助工具函数 ---
//   const calculateCRC16 = (buffer) => {
//     let crc = 0xFFFF;
//     for (let pos = 0; pos < buffer.length; pos++) {
//       crc ^= buffer[pos];
//       for (let i = 8; i !== 0; i--) {
//         if ((crc & 0x0001) !== 0) {
//           crc >>= 1;
//           crc ^= 0xA001;
//         } else {
//           crc >>= 1;
//         }
//       }
//     }
//     return new Uint8Array([crc & 0xFF, (crc >> 8) & 0xFF]);
//   };

//   const parseHexString = (str) => {
//     const cleanStr = str.replace(/[^0-9a-fA-F]/g, '');
//     const byteArray = new Uint8Array(cleanStr.length / 2);
//     for (let i = 0; i < cleanStr.length; i += 2) {
//       byteArray[i / 2] = parseInt(cleanStr.substring(i, i + 2), 16);
//     }
//     return byteArray;
//   };

//   const bufferToHex = (buffer) => {
//     return Array.from(new Uint8Array(buffer))
//       .map(b => b.toString(16).padStart(2, '0').toUpperCase())
//       .join(' ');
//   };

//   // --- 核心逻辑 ---

//   const openPort = async (selectedPort) => {
//     if (!selectedPort) return;
//     if (port && isConnected) await disconnectPort();

//     try {
//       await selectedPort.open({ baudRate: parseInt(baudRate) || 115200 });
//       setPort(selectedPort);
//       setIsConnected(true);
//       setIsPaused(false);
//       setIsConnectModalOpen(false);
//       closingRef.current = false;
//       setAvailablePorts(await navigator.serial.getPorts());

//       readLoop(selectedPort);
      
//     } catch (error) {
//       console.error('Connection failed:', error);
//       alert(`Connection failed: ${error.message}`);
//     }
//   };

//   const readLoop = async (currentPort) => {
//     if (!currentPort?.readable) return;
    
//     try {
//         readerRef.current = currentPort.readable.getReader();
//     } catch(e) {
//         console.error("Failed to get reader", e);
//         return;
//     }

//     try {
//       while (true) {
//         const { value, done } = await readerRef.current.read();
//         if (done) {
//           readerRef.current.releaseLock();
//           break;
//         }
//         if (value && !closingRef.current) {
//           processIncomingData(value);
//         }
//       }
//     } catch (error) {
//       if (!closingRef.current) console.error('Read error:', error);
//     } finally {
//         try { readerRef.current?.releaseLock(); } catch(e){}
//     }
//   };

//   const processIncomingData = (uint8Chunk) => {
//     if (isPausedRef.current) return;

//     const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
    
//     let textContent = '';
//     if (viewMode === 'hex') {
//         textContent = bufferToHex(uint8Chunk);
//     } else {
//         try {
//             const decoder = new TextDecoder(encoding); 
//             textContent = decoder.decode(uint8Chunk, { stream: true });
//         } catch (e) {
//             textContent = `[Decode Error] ${bufferToHex(uint8Chunk)}`;
//         }
//     }

//     setLogs(prev => {
//         const newLog = {
//             id: Date.now() + Math.random(),
//             timestamp,
//             text: textContent,
//             raw: uint8Chunk,
//             type: 'rx'
//         };
//         const newLogs = [...prev, newLog];
//         if (newLogs.length > 1000) return newLogs.slice(-1000);
//         return newLogs;
//     });
//   };

//   const disconnectPort = async () => {
//     closingRef.current = true;
//     try {
//       if (readerRef.current) {
//         await readerRef.current.cancel(); 
//         readerRef.current = null;
//       }
//       if (writerRef.current) {
//         writerRef.current.releaseLock();
//         writerRef.current = null;
//       }
//       if (port) {
//         await port.close();
//         setPort(null);
//         setIsConnected(false);
//       }
//     } catch (error) {
//       console.error('Disconnect error:', error);
//       setPort(null);
//       setIsConnected(false);
//     }
//   };

//   const sendData = async (textToSend = null) => {
//     const rawInput = textToSend !== null ? textToSend : inputText;
//     if (!port || !port.writable || !rawInput) return;

//     if (textToSend === null && rawInput.trim() !== '') {
//         setSendHistory(prev => [rawInput, ...prev].slice(0, 50));
//         setHistoryIndex(-1);
//     }

//     try {
//         const writer = port.writable.getWriter();
//         writerRef.current = writer;

//         let dataToSend;
//         let logDisplay;

//         if (useHexSend) {
//             const rawBytes = parseHexString(rawInput);
//             if (appendCRC) {
//                 const crc = calculateCRC16(rawBytes);
//                 const merged = new Uint8Array(rawBytes.length + 2);
//                 merged.set(rawBytes);
//                 merged.set(crc, rawBytes.length);
//                 dataToSend = merged;
//             } else {
//                 dataToSend = rawBytes;
//             }
//             logDisplay = bufferToHex(dataToSend);

//         } else {
//             let str = rawInput;
//             if (lineEnding === '\\n') str += '\n';
//             else if (lineEnding === '\\r') str += '\r';
//             else if (lineEnding === '\\r\\n') str += '\r\n';

//             const encoder = new TextEncoder(); 
//             let rawBytes = encoder.encode(str);
            
//             if (appendCRC) {
//                  const crc = calculateCRC16(rawBytes);
//                  const merged = new Uint8Array(rawBytes.length + 2);
//                  merged.set(rawBytes);
//                  merged.set(crc, rawBytes.length);
//                  dataToSend = merged;
//                  logDisplay = `${str} [CRC]`;
//             } else {
//                  dataToSend = rawBytes;
//                  logDisplay = str.replace(/\r/g, 'CR').replace(/\n/g, 'LF');
//             }
//         }

//         await writer.write(dataToSend);
//         writer.releaseLock();
//         writerRef.current = null;

//         setLogs(prev => {
//             const newLog = {
//                 id: Date.now() + Math.random(),
//                 timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 }),
//                 text: logDisplay,
//                 type: 'tx'
//             };
//             const newLogs = [...prev, newLog];
//             if (newLogs.length > 1000) return newLogs.slice(-1000);
//             return newLogs;
//         });

//         if (textToSend === null) setInputText('');

//     } catch (error) {
//         console.error('Send failed:', error);
//         if (writerRef.current) writerRef.current.releaseLock();
//     }
//   };

//   // --- 辅助功能 ---

//   const handleInputKeyDown = (e) => {
//     if (e.key === 'Enter') {
//         if (e.ctrlKey) sendData();
//     } else if (e.key === 'ArrowUp') {
//         e.preventDefault();
//         if (sendHistory.length > 0) {
//             const nextIndex = Math.min(historyIndex + 1, sendHistory.length - 1);
//             setHistoryIndex(nextIndex);
//             setInputText(sendHistory[nextIndex]);
//         }
//     } else if (e.key === 'ArrowDown') {
//         e.preventDefault();
//         if (historyIndex > 0) {
//             const nextIndex = historyIndex - 1;
//             setHistoryIndex(nextIndex);
//             setInputText(sendHistory[nextIndex]);
//         } else if (historyIndex === 0) {
//             setHistoryIndex(-1);
//             setInputText(''); 
//         }
//     }
//   };

//   const copyToClipboard = (text) => {
//     navigator.clipboard.writeText(text);
//     setCopyFeedback(text.substring(0, 20) + '...');
//     setTimeout(() => setCopyFeedback(null), 1500);
//   };

//   const exportData = () => {
//     const content = logs.map(l => `[${l.timestamp}] ${l.type === 'tx' ? 'TX' : 'RX'}: ${l.text}`).join('\n');
//     const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement('a');
//     link.href = url;
//     link.download = `serial_log_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const renderLogContent = (text) => {
//     // 强制转换为字符串，防止对象渲染错误
//     const safeText = String(text);
    
//     if (viewMode === 'hex') return safeText; 
//     if (!highlightKeyword) return safeText;
    
//     const parts = safeText.split(new RegExp(`(${highlightKeyword})`, 'gi'));
//     return (
//       <span>
//         {parts.map((part, i) => 
//           part.toLowerCase() === highlightKeyword.toLowerCase() ? (
//             <span key={i} className={`${highlightColor} font-bold px-1 rounded border border-current shadow-sm`}>{part}</span>
//           ) : (part)
//         )}
//       </span>
//     );
//   };

//   // 格式化相关
//   const getPortInfo = (port, index) => {
//     const info = port.getInfo();
//     if (info.usbVendorId && info.usbProductId) {
//       return { name: `USB Device`, meta: `${info.usbVendorId.toString(16).padStart(4,'0')}:${info.usbProductId.toString(16).padStart(4,'0')}` };
//     }
//     return { name: `Serial Port ${index + 1}`, meta: 'Generic' };
//   };

//   // *** 修复点：添加 filteredPorts 定义 ***
//   const filteredPorts = availablePorts.filter((p, index) => {
//     if (!portSearchQuery) return true;
//     const info = getPortInfo(p, index);
//     const searchLower = portSearchQuery.toLowerCase();
//     return info.name.toLowerCase().includes(searchLower) || info.meta.toLowerCase().includes(searchLower);
//   });

//   const filteredLogs = logs.filter(log => {
//       if(!logFilter) return true;
//       return String(log.text).toLowerCase().includes(logFilter.toLowerCase());
//   });

//   const forgetPort = async (e, portToForget) => {
//     e.stopPropagation();
//     try {
//         if (portToForget === port && isConnected) await disconnectPort();
//         await portToForget.forget();
//         setAvailablePorts(await navigator.serial.getPorts());
//     } catch (error) {
//         alert('Could not forget port. Require Chrome 103+.');
//     }
//   };

//   const requestNewPort = async () => {
//     try {
//       const selectedPort = await navigator.serial.requestPort();
//       openPort(selectedPort);
//     } catch (error) { console.log('User cancelled'); }
//   };

//   const updateQuickCommand = (id, field, value) => {
//     setQuickCommands(prev => prev.map(cmd => cmd.id === id ? { ...cmd, [field]: value } : cmd));
//   };
//   const addQuickCommand = () => {
//     const newId = Math.max(0, ...quickCommands.map(c => c.id)) + 1;
//     setQuickCommands([...quickCommands, { id: newId, label: 'Cmd', cmd: '' }]);
//   };
//   const deleteQuickCommand = (id) => {
//     setQuickCommands(prev => prev.filter(c => c.id !== id));
//   };

//   const COMMON_BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 460800, 921600, 1000000, 2000000];

//   return (
//     <div className="flex h-screen w-full items-center justify-center bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-hidden relative">
      
//       {/* 桌面背景 */}
//       <div className="absolute inset-0 pointer-events-none z-0">
//          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950/80 to-zinc-950"></div>
//          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
//          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
//       </div>

//       {/* 窗口容器 (Window Mode) */}
//       <div className="relative w-[95vw] h-[90vh] max-w-[1280px] max-h-[850px] flex flex-col animate-in fade-in zoom-in-95 duration-500 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)]">
        
//         {/* 外壳边框 */}
//         <div className="absolute inset-0 rounded-2xl border border-white/5 bg-zinc-900/95 backdrop-blur-3xl z-0 box-border pointer-events-none ring-1 ring-white/5">
//             <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
//         </div>

//         {/* 螺丝装饰 */}
//         <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>
//         <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-black/60 border border-white/5 z-20 pointer-events-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] opacity-40"></div>

//         {/* 内容 */}
//         <div className="relative z-10 flex flex-col w-full h-full rounded-2xl overflow-hidden bg-transparent">
            
//             {/* Title Bar */}
//             <div className="h-10 bg-black/20 border-b border-white/5 flex items-center justify-between px-6 select-none flex-none z-50 backdrop-blur-sm">
//                 <div className="flex gap-2 group">
//                     <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/20 shadow-inner"></div>
//                     <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/20 shadow-inner"></div>
//                     <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/20 shadow-inner"></div>
//                 </div>
//                 <div className="text-xs font-bold text-zinc-500 tracking-widest uppercase flex items-center gap-2 opacity-80">
//                     <Command size={12} className="text-emerald-500" />
//                     SERIAL FLUX PRO <span className="text-[9px] px-1 bg-white/5 rounded text-zinc-600 font-mono">V1.0</span>
//                 </div>
//                 <div className="w-14"></div> 
//             </div>

//             {/* Main + Sidebar */}
//             <div className="flex-1 flex overflow-hidden relative">
                
//                 {/* Copy Feedback */}
//                 {copyFeedback && (
//                     <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full shadow-2xl text-xs font-medium animate-in fade-in slide-in-from-top-2 pointer-events-none flex items-center gap-2">
//                     <Copy size={14} />
//                     {copyFeedback}
//                     </div>
//                 )}

//                 {/* Connect Modal */}
//                 {isConnectModalOpen && (
//                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] animate-in fade-in duration-200">
//                         <div className="relative w-[500px] bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80%] ring-1 ring-white/10">
//                             <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
//                                 <div className="flex items-center gap-4">
//                                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center ring-1 ring-white/5 shadow-inner">
//                                         <Plug size={20} className="text-emerald-400" />
//                                     </div>
//                                     <div>
//                                         <h3 className="text-base font-bold text-zinc-100 tracking-tight">Device Manager</h3>
//                                         <p className="text-xs text-zinc-500 mt-0.5 font-medium">Select a serial port to connect</p>
//                                     </div>
//                                 </div>
//                                 <button onClick={() => setIsConnectModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
//                             </div>
                            
//                             {/* Search */}
//                             {availablePorts.length > 0 && (
//                                 <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/30">
//                                     <div className="relative group/search">
//                                     <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within/search:text-emerald-400 transition-colors" />
//                                     <input type="text" placeholder="Filter devices..." value={portSearchQuery} onChange={(e) => setPortSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-lg pl-9 pr-4 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 placeholder-zinc-600 transition-all" />
//                                     </div>
//                                 </div>
//                             )}

//                             {/* List */}
//                             <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-[200px] bg-black/20">
//                                 {availablePorts.length === 0 ? (
//                                     <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 py-10">
//                                         <div className="w-12 h-12 rounded-full bg-zinc-900/80 flex items-center justify-center mb-4 shadow-lg ring-1 ring-white/5"><Usb size={20} className="opacity-30" /></div>
//                                         <p className="text-sm font-medium text-zinc-400">No devices found</p>
//                                         <p className="text-xs opacity-50 mt-1">Browser security requires manual authorization.</p>
//                                     </div>
//                                 ) : (
//                                     filteredPorts.map((p, index) => {
//                                         const info = getPortInfo(p, index);
//                                         const isCurrent = port === p && isConnected;
//                                         return (
//                                         <div key={index} onClick={() => openPort(p)} className={`w-full text-left p-3.5 rounded-xl border transition-all group/item relative overflow-hidden cursor-pointer flex items-center justify-between ${isCurrent ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/60 border-white/5 hover:border-emerald-500/20 hover:bg-zinc-800'}`}>
//                                             <div className="flex items-center gap-4 relative z-10">
//                                                 <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${isCurrent ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-black/50 border-white/5 text-zinc-600 group-hover/item:text-emerald-400 group-hover/item:border-emerald-500/20'}`}><Usb size={18} /></div>
//                                                 <div>
//                                                     <div className={`text-sm font-semibold transition-colors ${isCurrent ? 'text-emerald-400' : 'text-zinc-300 group-hover/item:text-white'}`}>{info.name}</div>
//                                                     <div className="text-[10px] font-mono text-zinc-600 group-hover/item:text-zinc-500 flex items-center gap-2 mt-0.5"><span>{info.meta}</span></div>
//                                                 </div>
//                                             </div>
//                                             <button onClick={(e) => forgetPort(e, p)} className="p-2 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover/item:opacity-100 transition-all z-20" title="Forget Device"><Trash2 size={14} /></button>
//                                         </div>
//                                         );
//                                     })
//                                 )}
//                             </div>

//                             <div className="p-5 border-t border-white/5 bg-zinc-900/50">
//                                 <button onClick={requestNewPort} className="relative w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold tracking-widest transition-all shadow-lg shadow-emerald-900/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-3 group/btn overflow-hidden">
//                                     <Search size={16} strokeWidth={2.5} className="relative z-10" /><span className="relative z-10">SCAN FOR NEW DEVICES</span>
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 )}

//                 {/* Left Panel */}
//                 <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
//                     {/* Top Toolbar */}
//                     <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between">
//                         <div className={`flex items-center gap-3 px-3 py-2 pr-5 rounded-full border backdrop-blur-md transition-all duration-500 ${isConnected ? 'bg-emerald-950/40 border-emerald-500/30 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]' : 'bg-black/40 border-white/10'}`}>
//                         <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isConnected ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>{isConnected ? <Activity size={14} className="animate-pulse" /> : <Zap size={14} />}</div>
//                         <div className="flex flex-col">
//                             <span className={`text-xs font-bold tracking-wider uppercase ${isConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>{isConnected ? 'Connected' : 'Offline'}</span>
//                             {isConnected && <span className="text-[9px] text-zinc-500 leading-none">{String(baudRate)} bps</span>}
//                         </div>
//                         </div>

//                         <div className="flex items-center gap-3">
//                             <div className="relative group/search">
//                                 <div className={`absolute inset-y-0 left-3 flex items-center pointer-events-none transition-colors ${logFilter ? 'text-emerald-400' : 'text-zinc-500'}`}><Filter size={14} /></div>
//                                 <input ref={filterInputRef} type="text" value={logFilter} onChange={(e) => setLogFilter(e.target.value)} placeholder="Search logs..." className={`h-11 pl-9 pr-4 rounded-full border text-xs bg-black/40 backdrop-blur-md transition-all outline-none w-32 focus:w-48 ${logFilter ? 'border-emerald-500/50 text-emerald-300' : 'border-white/10 text-zinc-300 focus:border-white/20'}`} />
//                                 {logFilter && <button onClick={() => setLogFilter('')} className="absolute inset-y-0 right-2 flex items-center text-zinc-500 hover:text-white"><X size={12} /></button>}
//                             </div>

//                             <div className="flex items-center p-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md shadow-xl gap-1">
//                                 <div className="flex bg-white/5 rounded-full p-0.5 border border-white/5">
//                                     <button onClick={() => setViewMode('ascii')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'ascii' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>ASC</button>
//                                     <button onClick={() => setViewMode('hex')} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${viewMode === 'hex' ? 'bg-emerald-600/20 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>HEX</button>
//                                 </div>
//                                 <div className="w-px h-4 bg-white/10 mx-1"></div>
//                                 {isConnected && (
//                                     <button onClick={() => setIsPaused(!isPaused)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPaused ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`} title={isPaused ? "Resume View" : "Pause View"}>{isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}</button>
//                                 )}
//                                 <button onClick={exportData} disabled={logs.length === 0} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-white/10 hover:text-emerald-400 transition-all disabled:opacity-30" title="Export Log"><Download size={14} strokeWidth={2} /></button>
//                                 <button onClick={() => setLogs([])} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400 transition-all" title="Clear Console"><Trash2 size={14} strokeWidth={2} /></button>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Terminal */}
//                     <div className="flex-1 pt-24 pb-8 px-8 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed relative">
//                         {isPaused && <div className="fixed top-36 right-[420px] px-3 py-1 bg-amber-500/90 text-black text-[10px] font-bold rounded-md shadow-lg z-30 pointer-events-none uppercase tracking-wider backdrop-blur-md">View Paused</div>}
//                         {logs.length === 0 ? (
//                             <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
//                                 <Terminal size={64} className="text-emerald-400 mb-4" strokeWidth={1} />
//                                 <p className="text-zinc-500 font-light tracking-wide text-base">READY TO CONNECT</p>
//                             </div>
//                         ) : (
//                             <div className="space-y-0.5">
//                                 {filteredLogs.map((log) => (
//                                     <div key={log.id} onClick={() => copyToClipboard(log.text)} className="flex gap-4 hover:bg-white/[0.04] -mx-4 px-4 py-0.5 rounded transition-colors group cursor-pointer relative" title="Click to copy line">
//                                         {showTimestamp && <span className="text-zinc-600 shrink-0 select-none text-[11px] pt-[3px] font-medium font-sans">{log.timestamp}</span>}
//                                         <div className={`tracking-tight whitespace-pre-wrap break-all flex-1 ${log.type === 'tx' ? 'text-indigo-300/80' : 'text-emerald-400'}`}>{log.type === 'tx' && <span className="text-indigo-500 mr-2 text-[10px] align-middle inline-block font-bold select-none">TX</span>}{renderLogContent(log.text)}</div>
//                                     </div>
//                                 ))}
//                                 {filteredLogs.length === 0 && logFilter && <div className="text-zinc-500 text-xs text-center py-10">No matching logs found for "{logFilter}"</div>}
//                                 <div ref={logsEndRef} />
//                             </div>
//                         )}
//                     </div>

//                     {/* Footer Status - With RX/TX Lights */}
//                     <div className="h-10 flex items-center justify-between px-8 text-xs text-zinc-500 select-none border-t border-white/[0.05] bg-black/20">
//                         <div className="flex items-center gap-6 font-medium">
//                             <span className="flex items-center gap-2">
//                                 <span className={`w-2 h-2 rounded-full transition-all duration-100 ${logs.length > 0 && logs[logs.length-1].type === 'rx' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-emerald-500/20'}`}></span>
//                                 RX: {logs.filter(l => l.type === 'rx').length}
//                             </span>
//                             <span className="flex items-center gap-2">
//                                 <span className={`w-2 h-2 rounded-full transition-all duration-100 ${logs.length > 0 && logs[logs.length-1].type === 'tx' ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-indigo-500/20'}`}></span>
//                                 TX: {logs.filter(l => l.type === 'tx').length}
//                             </span>
//                         </div>
//                         <label className="flex items-center gap-2 cursor-pointer hover:text-zinc-300 transition-colors group">
//                             <div className={`w-2 h-2 rounded-full transition-colors ${autoScroll && !isPaused ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`}></div>
//                             <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="hidden" />
//                             AUTO-SCROLL
//                         </label>
//                     </div>
//                 </main>

//                 {/* Right Sidebar */}
//                 <aside className="w-96 bg-black/20 backdrop-blur-xl border-l border-white/[0.06] flex flex-col z-20">
//                     <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
//                         {/* Connection */}
//                         <div className="space-y-4">
//                             <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Plug size={12} /> Connection</h3>
//                             <div className="flex justify-between items-center mb-2">
//                                 {/* Encoding Toggle */}
//                                 <button onClick={() => setEncoding(encoding === 'utf-8' ? 'gbk' : 'utf-8')} className="text-[10px] px-2 py-0.5 rounded bg-black/40 border border-white/10 text-zinc-400 hover:text-white transition-colors flex items-center gap-1" title="Toggle Encoding">
//                                     <Languages size={10} /> {encoding.toUpperCase()}
//                                 </button>
//                             </div>
//                             <div className="relative w-full" ref={baudRef}>
//                                 <div className="relative flex items-center group">
//                                     <input type="text" inputMode="numeric" pattern="[0-9]*" value={baudRate} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setBaudRate(e.target.value); }} disabled={isConnected} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-50 font-mono pr-10" placeholder="Custom Baud..." />
//                                     <button onClick={() => !isConnected && setIsBaudDropdownOpen(!isBaudDropdownOpen)} disabled={isConnected} className="absolute right-3 p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-emerald-400 disabled:opacity-50 transition-colors"><ChevronDown size={16} className={`transition-transform ${isBaudDropdownOpen ? 'rotate-180' : ''}`} /></button>
//                                 </div>
//                                 {isBaudDropdownOpen && (
//                                     <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
//                                         {COMMON_BAUD_RATES.map(rate => (
//                                             <button key={rate} onClick={() => { setBaudRate(rate); setIsBaudDropdownOpen(false); }} className={`w-full text-left px-5 py-2.5 text-xs font-mono hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors flex items-center justify-between border-b border-white/[0.02] last:border-none ${parseInt(baudRate) === rate ? 'text-emerald-400 bg-emerald-500/5' : 'text-zinc-400'}`}><span>{rate}</span>{parseInt(baudRate) === rate && <Check size={14} />}</button>
//                                         ))}
//                                     </div>
//                                 )}
//                             </div>
//                             <button onClick={isConnected ? disconnectPort : () => setIsConnectModalOpen(true)} className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${isConnected ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:shadow-rose-500/10' : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-transparent hover:shadow-emerald-500/30'}`}>{isConnected ? 'DISCONNECT' : 'CONNECT DEVICE'}</button>
//                         </div>
//                         <div className="h-px bg-white/5 w-full"></div>
//                         {/* Quick Actions */}
//                         <div className="space-y-4">
//                             <div className="flex items-center justify-between">
//                                 <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Quick Actions</h3>
//                                 <button onClick={() => setIsEditingCmds(!isEditingCmds)} className={`p-1.5 rounded-lg transition-colors ${isEditingCmds ? 'bg-emerald-500 text-black' : 'hover:bg-white/10 text-zinc-600 hover:text-zinc-300'}`}>{isEditingCmds ? <Save size={12} /> : <Edit2 size={12} />}</button>
//                             </div>
//                             {isEditingCmds ? (
//                                 <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
//                                     {quickCommands.map((cmd) => (
//                                         <div key={cmd.id} className="flex gap-2">
//                                         <input type="text" value={cmd.label} onChange={(e) => { const n = [...quickCommands]; n.find(c=>c.id===cmd.id).label = e.target.value; setQuickCommands(n); }} className="w-1/3 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500/50 focus:outline-none" />
//                                         <input type="text" value={cmd.cmd} onChange={(e) => { const n = [...quickCommands]; n.find(c=>c.id===cmd.id).cmd = e.target.value; setQuickCommands(n); }} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400/80 focus:border-emerald-500/50 focus:outline-none" />
//                                         <button onClick={() => setQuickCommands(prev => prev.filter(c => c.id !== cmd.id))} className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"><Trash2 size={14} /></button>
//                                         </div>
//                                     ))}
//                                     <button onClick={() => setQuickCommands([...quickCommands, { id: Date.now(), label: 'Cmd', cmd: '' }])} className="w-full py-2.5 border border-dashed border-white/10 rounded-lg text-xs text-zinc-500 hover:text-emerald-400 transition-colors"><Plus size={14} className="inline mr-1"/> Add</button>
//                                 </div>
//                             ) : (
//                                 <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
//                                     {quickCommands.map((cmd) => (
//                                         <button key={cmd.id} onClick={() => sendData(cmd.cmd)} disabled={!isConnected} className="flex-none whitespace-nowrap px-4 py-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all text-xs font-medium text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed">{cmd.label}</button>
//                                     ))}
//                                 </div>
//                             )}
//                         </div>
//                         <div className="h-px bg-white/5 w-full"></div>
//                         {/* Highlight */}
//                         <div className="space-y-4">
//                             <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Highlighter size={12} /> Highlight</h3>
//                             <div className="flex flex-col gap-3">
//                                 <input type="text" value={highlightKeyword} onChange={(e) => setHighlightKeyword(e.target.value)} placeholder="Enter keyword..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-all" />
//                                 <div className="flex gap-2">
//                                     {['text-amber-400 bg-amber-400/10 border-amber-400/20', 'text-rose-400 bg-rose-400/10 border-rose-400/20', 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', 'text-violet-400 bg-violet-400/10 border-violet-400/20'].map((colorClass, idx) => (
//                                         <button key={idx} onClick={() => setHighlightColor(colorClass)} className={`flex-1 h-8 rounded-lg ${colorClass.split(' ')[1]} ${highlightColor === colorClass ? 'ring-2 ring-white/20 scale-105 shadow-lg opacity-100' : 'opacity-20 hover:opacity-80'} transition-all`} />
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                     {/* Transmitter */}
//                     <div className="flex-none p-6 border-t border-white/5 bg-black/40 z-30">
//                         <div className="flex flex-col gap-4">
//                         <div className="relative group">
//                             <textarea 
//                                 value={inputText}
//                                 onChange={(e) => setInputText(e.target.value)}
//                                 onKeyDown={handleInputKeyDown}
//                                 placeholder="Input payload..."
//                                 className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 resize-none placeholder-zinc-600 transition-all custom-scrollbar"
//                             />
//                             <div className="absolute bottom-3 right-3 flex gap-2">
//                                 <button onClick={() => setAppendCRC(!appendCRC)} className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-[10px] font-mono tracking-wide ${appendCRC ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300'}`} title="Append CRC16-Modbus"><ShieldCheck size={10} /> CRC</button>
//                                 <button onClick={() => setUseHexSend(!useHexSend)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[10px] font-mono tracking-wide ${useHexSend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300'}`}>{useHexSend ? 'HEX' : 'ASCII'}</button>
//                                 <div className="flex bg-white/5 border border-white/5 rounded-md overflow-hidden">
//                                     {[{ label: '\\n', val: '\\n' }, { label: '\\r\\n', val: '\\r\\n' }, { label: 'Ø', val: 'none' }].map(opt => (
//                                         <button key={opt.val} onClick={() => setLineEnding(opt.val)} className={`px-2 py-1 text-[10px] font-mono transition-all ${lineEnding === opt.val ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}>{opt.label}</button>
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                         <button onClick={() => sendData()} disabled={!isConnected} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white text-sm font-bold tracking-wide rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:shadow-none flex items-center justify-center gap-2.5 group hover:scale-[1.01] active:scale-[0.99]"><Send size={16} className="group-hover:translate-x-0.5 transition-transform" /> SEND PAYLOAD</button>
//                         </div>
//                     </div>
//                 </aside>
//             </div>
//         </div>
//       </div>

//       <style>{`
//         .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
//         .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
//         .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 5px; }
//         .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
//         .custom-scrollbar::-webkit-scrollbar-corner { background: transparent; }
//         @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
//         .animate-gradient { animation: gradient 3s ease infinite; }
//       `}</style>
//     </div>
//   );
// }




import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, Download, Trash2, Play, Highlighter, Send, 
  AlertCircle, Zap, Activity, Command, Copy, Plus, X, 
  Pause, Edit2, Save, Plug, Search, Usb, Filter, 
  ChevronDown, Check, ShieldCheck, Languages, Cpu, List, Monitor,
  PlayCircle, ChevronRight, Settings2
} from 'lucide-react';

// --- Utility: CRC16 Modbus Calculation ---
const calculateCRC16 = (buffer) => {
  let crc = 0xFFFF;
  for (let pos = 0; pos < buffer.length; pos++) {
    crc ^= buffer[pos];
    for (let i = 8; i !== 0; i--) {
      if ((crc & 0x0001) !== 0) {
        crc >>= 1;
        crc ^= 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return new Uint8Array([crc & 0xFF, (crc >> 8) & 0xFF]);
};

// --- Utility: HEX String Parsing ---
const parseHexString = (str) => {
  const cleanStr = str.replace(/[^0-9a-fA-F]/g, '');
  if (!cleanStr || cleanStr.length % 2 !== 0) return null;
  const byteArray = new Uint8Array(cleanStr.length / 2);
  for (let i = 0; i < cleanStr.length; i += 2) {
    byteArray[i / 2] = parseInt(cleanStr.substring(i, i + 2), 16);
  }
  return byteArray;
};

const bufferToHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
};

export default function App() {
  // --- States ---
  const [port, setPort] = useState(null);
  const [availablePorts, setAvailablePorts] = useState([]); 
  const [isConnected, setIsConnected] = useState(false);
  const readerRef = useRef(null);
  const closingRef = useRef(false);
  const baudRef = useRef(null);
  
  // Buffering Logic
  const rxBufferRef = useRef('');
  const rxTimeoutRef = useRef(null);
  const logContainerRef = useRef(null); // Ref for log scroll container

  // Interaction States
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isBaudDropdownOpen, setIsBaudDropdownOpen] = useState(false);
  const [portSearchQuery, setPortSearchQuery] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  // Log Management
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState('ascii'); 
  const [logFilter, setLogFilter] = useState('');

  // Persisted Config
  const usePersistedState = (key, defaultValue) => {
    const [state, setState] = useState(() => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (e) { return defaultValue; }
    });
    useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);
    return [state, setState];
  };

  const [baudRate, setBaudRate] = usePersistedState('sf_baud', 115200);
  const [encoding, setEncoding] = usePersistedState('sf_enc', 'utf-8'); 
  const [highlightKeyword, setHighlightKeyword] = usePersistedState('sf_hl_kw', '');
  const [highlightColor, setHighlightColor] = usePersistedState('sf_hl_col', 'text-amber-400 bg-amber-400/25 border-amber-400/50');
  const [quickCommands, setQuickCommands] = usePersistedState('sf_cmds', [
    { id: 1, label: 'Status', cmd: 'AT+STATUS?' },
    { id: 2, label: 'Reset', cmd: 'AT+RST' },
    { id: 3, label: 'Info', cmd: 'AT+GMR' },
  ]);
  const [useHexSend, setUseHexSend] = usePersistedState('sf_hex_send', false);
  const [lineEnding, setLineEnding] = usePersistedState('sf_eol', '\\n'); 
  const [appendCRC, setAppendCRC] = usePersistedState('sf_crc', false);

  const [inputText, setInputText] = useState('');
  const [sendHistory, setSendHistory] = usePersistedState('sf_history', []);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isEditingCmds, setIsEditingCmds] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [lastActivity, setLastActivity] = useState({ type: null, time: 0 });

  const isWebSerialSupported = 'serial' in navigator;

  // --- Logic ---
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const updatePorts = async () => {
    if (!isWebSerialSupported) return;
    try { setAvailablePorts(await navigator.serial.getPorts()); } catch (e) {}
  };

  useEffect(() => {
    updatePorts();
    if (!isWebSerialSupported) return;
    navigator.serial.addEventListener('connect', updatePorts);
    navigator.serial.addEventListener('disconnect', (e) => {
      updatePorts();
      if (port === e.target) disconnectPort();
    });
  }, [port]);

  const openPort = async (selectedPort) => {
    try {
      await selectedPort.open({ baudRate: parseInt(baudRate) || 115200 });
      setPort(selectedPort);
      setIsConnected(true);
      setIsConnectModalOpen(false);
      closingRef.current = false;
      readLoop(selectedPort);
    } catch (error) {
      alert(`Connection failed: ${error.message}`);
    }
  };

  const flushBuffer = () => {
    if (rxBufferRef.current.length > 0) {
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
      const content = rxBufferRef.current;
      setLogs(prev => [...prev, { id: Math.random(), timestamp, text: content, type: 'rx' }].slice(-1500));
      rxBufferRef.current = '';
    }
  };

  const readLoop = async (p) => {
    const decoder = new TextDecoder(encoding);
    readerRef.current = p.readable.getReader();
    try {
      while (true) {
        const { value, done } = await readerRef.current.read();
        if (done) break;
        if (value && !isPausedRef.current) {
          setLastActivity({ type: 'rx', time: Date.now() });
          
          if (viewMode === 'hex') {
            const hexContent = bufferToHex(value);
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
            setLogs(prev => [...prev, { id: Math.random(), timestamp, text: hexContent, type: 'rx' }].slice(-1500));
          } else {
            const decoded = decoder.decode(value, { stream: true });
            rxBufferRef.current += decoded;

            if (rxTimeoutRef.current) clearTimeout(rxTimeoutRef.current);

            if (rxBufferRef.current.includes('\n')) {
              const lines = rxBufferRef.current.split('\n');
              rxBufferRef.current = lines.pop(); 
              const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
              const newEntries = lines.map(line => ({ 
                id: Math.random(), timestamp, text: line.replace('\r', ''), type: 'rx' 
              }));
              setLogs(prev => [...prev, ...newEntries].slice(-1500));
            }
            rxTimeoutRef.current = setTimeout(flushBuffer, 50);
          }
        }
      }
    } catch (e) {
      if (!closingRef.current) console.error(e);
    } finally {
      if (readerRef.current) {
        try { readerRef.current.releaseLock(); } catch(e) {}
      }
    }
  };

  const disconnectPort = async () => {
    closingRef.current = true;
    try {
      if (readerRef.current) await readerRef.current.cancel();
      if (port) await port.close();
    } catch (e) { console.error(e); }
    setPort(null);
    setIsConnected(false);
  };

  const sendData = async (textOverride = null) => {
    const text = textOverride !== null ? textOverride : inputText;
    if (!port?.writable || !text) return;

    const writer = port.writable.getWriter();
    try {
      let data;
      let display;

      if (useHexSend) {
        const bytes = parseHexString(text);
        if (!bytes) throw new Error("Invalid HEX String");
        data = bytes;
        display = bufferToHex(bytes);
      } else {
        let str = text;
        if (lineEnding === '\\n') str += '\n';
        else if (lineEnding === '\\r') str += '\r';
        else if (lineEnding === '\\r\\n') str += '\r\n';
        data = new TextEncoder().encode(str);
        display = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      }

      if (appendCRC) {
        const crc = calculateCRC16(data);
        const merged = new Uint8Array(data.length + 2);
        merged.set(data);
        merged.set(crc, data.length);
        data = merged;
        display += ` [CRC16]`;
      }

      await writer.write(data);
      setLastActivity({ type: 'tx', time: Date.now() });
      setLogs(prev => [...prev, { 
        id: Math.random(), 
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 }), 
        text: display, 
        type: 'tx' 
      }].slice(-1500));

      if (textOverride === null) {
        setSendHistory(prev => {
          const filtered = prev.filter(h => h !== text);
          return [text, ...filtered].slice(0, 50);
        });
        setHistoryIndex(-1);
        setInputText('');
      }
    } catch (e) {
      alert(`Send failed: ${e.message}`);
    } finally {
      writer.releaseLock();
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      sendData();
    } else if (e.key === 'ArrowUp') {
      if (sendHistory.length > 0 && !e.shiftKey) {
        e.preventDefault();
        const nextIndex = Math.min(historyIndex + 1, sendHistory.length - 1);
        setHistoryIndex(nextIndex);
        setInputText(sendHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex >= 0) {
        e.preventDefault();
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        if (nextIndex === -1) setInputText('');
        else setInputText(sendHistory[nextIndex]);
      }
    }
  };

  const renderContent = (text) => {
    const safeText = String(text || '');
    if (viewMode === 'hex' || !highlightKeyword) return safeText;
    const parts = safeText.split(new RegExp(`(${highlightKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlightKeyword.toLowerCase() 
        ? <span key={i} className={`${highlightColor} font-bold px-0.5 rounded-sm border border-current shadow-[0_0_8px_rgba(255,255,255,0.1)]`}>{part}</span>
        : part
    );
  };

  // Fixed Auto-Scroll without shifting page
  useEffect(() => {
    if (autoScroll && logContainerRef.current && !logFilter) {
      const container = logContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [logs, autoScroll, logFilter]);

  const HIGHLIGHT_PRESETS = [
    'text-emerald-400 bg-emerald-400/25 border-emerald-400/50',
    'text-amber-400 bg-amber-400/25 border-amber-400/50',
    'text-rose-400 bg-rose-400/25 border-rose-400/50',
    'text-cyan-400 bg-cyan-400/25 border-cyan-400/50',
    'text-fuchsia-400 bg-fuchsia-400/25 border-fuchsia-400/50',
    'text-blue-400 bg-blue-400/25 border-blue-400/50',
    'text-orange-400 bg-orange-400/25 border-orange-400/50',
    'text-lime-400 bg-lime-400/25 border-lime-400/50',
  ];

  const COMMON_BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#010101] text-zinc-100 font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      
      {/* Background Layer */}
      <div className="absolute inset-0 pointer-events-none z-0">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-900/10 via-zinc-950/90 to-zinc-950 opacity-80"></div>
         <div className="absolute top-[20%] left-[-10%] size-[800px] bg-emerald-500/5 blur-[150px] rounded-full animate-pulse transition-all duration-[8000ms]"></div>
         <div className="absolute bottom-[-10%] right-[-10%] size-[600px] bg-emerald-600/5 blur-[120px] rounded-full transition-all"></div>
         <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
         <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Main Window */}
      <div className="relative w-[75vw] h-[72vh] max-w-[960px] max-h-[640px] flex flex-col animate-in fade-in zoom-in-95 duration-700 
        shadow-[0_0_80px_-20px_rgba(16,185,129,0.2),0_40px_100px_-20px_rgba(0,0,0,1)] 
        rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-3xl overflow-hidden ring-1 ring-white/10">
        
        <div className="absolute inset-0 pointer-events-none border border-emerald-500/10 rounded-2xl opacity-40 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]"></div>

        {/* Title Bar */}
        <div className="h-8 bg-black/40 border-b border-white/10 flex items-center justify-between px-4 select-none flex-none z-50">
            <div className="flex gap-2">
                <div className="size-2.5 rounded-full bg-[#FF5F56] shadow-[0_0_6px_rgba(255,95,86,0.3)]"></div>
                <div className="size-2.5 rounded-full bg-[#FFBD2E] shadow-[0_0_6px_rgba(255,189,46,0.3)]"></div>
                <div className="size-2.5 rounded-full bg-[#27C93F] shadow-[0_0_6px_rgba(39,201,63,0.3)]"></div>
            </div>
            <div className="text-[9px] font-black text-zinc-500 tracking-[0.4em] uppercase flex items-center gap-2 opacity-60 group">
                <Command size={11} className="text-emerald-400 group-hover:scale-110 transition-transform duration-500" />
                SERIAL FLUX PRO <span className="text-[7px] px-1.5 py-0.5 bg-emerald-500/10 rounded text-emerald-400 font-mono tracking-normal shadow-[0_0_10px_rgba(52,211,153,0.2)]">STABLE_V2.2</span>
            </div>
            <div className="w-12"></div> 
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Log Area */}
          <main className="flex-1 flex flex-col min-w-0 relative bg-black/5">
            
            {/* Top Toolbar */}
            <div className="absolute top-2.5 left-4 z-20 flex items-center gap-3 px-3 py-1.5 pr-5 rounded-full border border-white/10 backdrop-blur-md bg-zinc-900/80 shadow-xl ring-1 ring-white/5 scale-90 origin-left">
              <div className={`size-6 rounded-full flex items-center justify-center transition-all ${isConnected ? 'bg-emerald-500 text-black shadow-[0_0:15px_rgba(16,185,129,0.5)]' : 'bg-zinc-800 text-zinc-500'}`}>
                {isConnected ? <Activity size={12} className="animate-pulse" /> : <Zap size={12} />}
              </div>
              <div className="flex flex-col leading-none">
                  <span className={`text-[10px] font-black tracking-widest uppercase ${isConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {isConnected ? 'Active' : 'Offline'}
                  </span>
                  {isConnected && <span className="text-[8px] text-zinc-400 font-mono mt-0.5 uppercase opacity-60">{baudRate} BAUD</span>}
              </div>
            </div>

            {/* View Controls */}
            <div className="absolute top-2.5 right-4 z-20 flex items-center gap-2 scale-90 origin-right">
                <div className="relative group">
                    <Filter size={12} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${logFilter ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <input type="text" value={logFilter} onChange={e => setLogFilter(e.target.value)} placeholder="Live Filter..." className="h-8 pl-9 pr-3 rounded-full border border-white/10 bg-black/60 text-[10px] w-28 focus:w-48 transition-all outline-none focus:border-emerald-500/40 shadow-inner placeholder:opacity-30" />
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="flex bg-black/70 border border-white/10 rounded-full p-0.5 shadow-lg ring-1 ring-white/5">
                        <button onClick={() => setViewMode('ascii')} className={`w-12 py-1 rounded-full text-[10px] font-black tracking-wider transition-all ${viewMode === 'ascii' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>ASC</button>
                        <button onClick={() => setViewMode('hex')} className={`w-12 py-1 rounded-full text-[10px] font-black tracking-wider transition-all ${viewMode === 'hex' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>HEX</button>
                    </div>
                    <div className="flex bg-black/70 border border-white/10 rounded-full p-0.5 shadow-lg ring-1 ring-white/5">
                        <button onClick={() => setEncoding('utf-8')} className={`w-15 py-1 rounded-full text-[10px] font-black tracking-wider transition-all ${encoding === 'utf-8' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}>UTF-8</button>
                        <button onClick={() => setEncoding('gbk')} className={`w-15 py-1 rounded-full text-[10px] font-black tracking-wider transition-all ${encoding === 'gbk' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}>GBK</button>
                    </div>
                </div>
                <button onClick={() => setLogs([])} className="size-8 rounded-full flex items-center justify-center bg-black/60 border border-white/10 text-zinc-400 hover:text-rose-400 transition-all shadow-lg"><Trash2 size={14} /></button>
            </div>

            {/* Terminal Feed */}
            <div ref={logContainerRef} className="flex-1 pt-14 pb-2 px-5 overflow-y-auto custom-scrollbar font-mono text-[13px] leading-relaxed">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 select-none transition-all">
                    <Terminal size={56} className="text-emerald-400 mb-4 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]" strokeWidth={1.5} />
                    <p className="tracking-[0.6em] font-black text-sm uppercase text-emerald-500/60">STANDBY_PROBE</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {logs.filter(l => !logFilter || String(l.text).toLowerCase().includes(logFilter.toLowerCase())).map((log) => (
                    <div key={log.id} onClick={() => { navigator.clipboard.writeText(String(log.text)); setCopyFeedback("COPIED!"); setTimeout(()=>setCopyFeedback(null), 1000); }} className="flex hover:bg-white/[0.04] -mx-4 px-4 py-0.5 rounded cursor-pointer group transition-colors border border-transparent">
                      <span className="text-[10px] text-zinc-600 shrink-0 font-sans pt-1 select-none opacity-40 min-w-[70px]">{log.timestamp}</span>
                      <div className={`flex-1 break-all ${log.type === 'tx' ? 'text-zinc-400 italic' : 'text-emerald-300 font-medium'}`}>
                        {log.type === 'tx' && <span className="inline-block text-emerald-400/80 mr-2 text-[10px] font-black opacity-80 bg-emerald-500/10 px-1.5 rounded-sm border border-emerald-500/20 min-w-[22px] text-center not-italic shadow-[0_0_5px_rgba(16,185,129,0.1)]">TX</span>}
                        {log.type === 'rx' && <span className="inline-block text-emerald-500 mr-2 text-[10px] font-black opacity-80 bg-emerald-500/10 px-1.5 rounded-sm border border-emerald-500/20 min-w-[22px] text-center shadow-[0_0_5px_rgba(52,211,153,0.2)]">RX</span>}
                        {renderContent(log.text)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Footer */}
            <div className="h-8 flex items-center justify-between px-5 text-[10px] text-zinc-500 select-none border-t border-white/5 bg-black/40">
                <div className="flex items-center gap-8 font-black uppercase tracking-tight opacity-70">
                    <span className="flex items-center gap-3"><span className={`size-1.5 rounded-full transition-all duration-200 ${Date.now() - lastActivity.time < 100 && lastActivity.type === 'rx' ? 'bg-emerald-400 shadow-[0_0:12px_rgba(52,211,153,1)] scale-110' : 'bg-emerald-950'}`}></span> RX: {logs.filter(l => l.type === 'rx').length}</span>
                    <span className="flex items-center gap-3"><span className={`size-1.5 rounded-full transition-all duration-200 ${Date.now() - lastActivity.time < 100 && lastActivity.type === 'tx' ? 'bg-emerald-500 shadow-[0_0:12px_rgba(16,185,129,1)] scale-110' : 'bg-emerald-900'}`}></span> TX: {logs.filter(l => l.type === 'tx').length}</span>
                </div>
                <label className="flex items-center gap-3 cursor-pointer hover:text-zinc-300 transition-colors group scale-90 origin-right">
                    <div className={`size-2 rounded-full transition-colors ${autoScroll ? 'bg-emerald-500 shadow-[0_0:8px_rgba(16,185,129,0.8)]' : 'bg-zinc-800'}`}></div>
                    <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="hidden" />
                    <span className="font-bold tracking-widest uppercase text-[9px]">AutoScroll</span>
                </label>
            </div>
          </main>

          {/* Right Sidebar - Compact 240px */}
          <aside className="w-[240px] bg-[#0a0a0c] border-l border-white/10 flex flex-col z-20 relative p-3.5 space-y-3.5 overflow-y-auto custom-scrollbar shadow-[-10px_0:30px_rgba(0,0,0,0.5)]">
            
            {/* Session Card */}
            <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Plug size={12} className="text-emerald-400" /> Session</h3>
                <div className="space-y-2.5">
                   <div className="relative w-full" ref={baudRef}>
                      <button onClick={() => !isConnected && setIsBaudDropdownOpen(!isBaudDropdownOpen)} className="w-full h-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono font-bold flex items-center justify-between hover:bg-zinc-800 transition-all shadow-lg group">
                        <span className="text-zinc-500 group-hover:text-zinc-200">{baudRate}</span>
                        <ChevronDown size={11} className={isBaudDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                      </button>
                      {isBaudDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/20 rounded-lg shadow-[0:10px_30px_rgba(0,0,0,0.9)] z-50 max-h-40 overflow-y-auto ring-1 ring-white/10 custom-scrollbar">
                              {COMMON_BAUD_RATES.map(rate => (
                                  <button key={rate} onClick={() => { setBaudRate(rate); setIsBaudDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-[11px] font-mono font-bold hover:bg-emerald-500/20 transition-colors border-b border-white/5 last:border-0">{rate}</button>
                              ))}
                          </div>
                      )}
                   </div>
                   <button 
                    onClick={isConnected ? disconnectPort : () => setIsConnectModalOpen(true)} 
                    className={`w-full py-2.5 rounded-lg font-black text-[10px] tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] ${isConnected ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/10'}`}
                   >
                    {isConnected ? 'DISCONNECT' : 'CONNECT'}
                   </button>
                </div>
            </div>

            {/* Macros Card */}
            <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                 <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2"><List size={12} className="text-emerald-400" /> Macros</h3>
                    <button onClick={() => setIsEditingCmds(!isEditingCmds)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 transition-all border border-white/5 shadow-sm">{isEditingCmds ? <Save size={12} /> : <Edit2 size={12} />}</button>
                 </div>
                 
                 <div className="space-y-2">
                 {isEditingCmds ? (
                   <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                      {quickCommands.map(cmd => (
                        <div key={cmd.id} className="flex flex-col gap-1 p-2 bg-black/40 rounded-lg border border-white/10 relative border-l-2 border-l-emerald-500/50">
                          <div className="flex gap-1.5">
                             <input type="text" placeholder="Lbl" value={cmd.label} onChange={e => {const n=[...quickCommands]; n.find(c=>c.id===cmd.id).label=e.target.value; setQuickCommands(n);}} className="w-14 bg-zinc-800 border border-white/10 rounded px-1.5 py-0.5 text-[10px] focus:border-emerald-500/40 outline-none font-bold text-zinc-300" />
                             <input type="text" placeholder="Cmd" value={cmd.cmd} onChange={e => {const n=[...quickCommands]; n.find(c=>c.id===cmd.id).cmd=e.target.value; setQuickCommands(n);}} className="flex-1 bg-zinc-800 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 focus:border-emerald-500/40 outline-none" />
                             <button onClick={() => setQuickCommands(prev => prev.filter(c => c.id !== cmd.id))} className="size-5 bg-rose-600/10 text-rose-500 rounded flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"><X size={10}/></button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => setQuickCommands([...quickCommands, {id: Date.now(), label:'NEW', cmd:''}])} className="w-full py-1.5 border border-dashed border-white/20 rounded-lg text-[9px] text-zinc-500 hover:text-emerald-400 transition-all font-black uppercase">+ ADD MACRO</button>
                   </div>
                 ) : (
                   <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {quickCommands.map(cmd => (
                        <button 
                            key={cmd.id} 
                            onClick={() => sendData(cmd.cmd)} 
                            disabled={!isConnected} 
                            className="group flex items-center justify-between p-2.5 px-3 bg-black/60 border border-white/5 rounded-lg hover:border-emerald-500/60 hover:bg-zinc-800/80 transition-all disabled:opacity-20 active:translate-x-1 shadow-md text-left"
                        >
                           <div className="overflow-hidden">
                               <div className="text-[11px] font-black text-zinc-200 uppercase tracking-widest truncate">{cmd.label}</div>
                               <div className="text-[9px] font-mono text-zinc-500 truncate opacity-60 mt-1">{cmd.cmd}</div>
                           </div>
                           <ChevronRight size={12} className="text-zinc-800 group-hover:text-emerald-400 transition-colors shrink-0" />
                        </button>
                      ))}
                   </div>
                 )}
                 </div>
            </div>

            {/* Highlighter Card */}
            <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2.5 flex items-center gap-2"><Highlighter size={12} className="text-emerald-400" /> Highlighting</h3>
                <div className="space-y-3">
                    <input type="text" value={highlightKeyword} onChange={e => setHighlightKeyword(e.target.value)} placeholder="Keyword..." className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-500/40 transition-all font-bold text-emerald-400" />
                    <div className="flex gap-1.5 justify-between px-0.5">
                        {HIGHLIGHT_PRESETS.map((c, i) => (
                            <button 
                                key={i} 
                                onClick={() => setHighlightColor(c)} 
                                className={`size-5 rounded-sm transition-all border-2 ${c.split(' ')[1]} ${highlightColor === c ? 'border-white scale-110 shadow-[0_0:12px_rgba(255,255,255,0.2)]' : 'border-transparent opacity-30 hover:opacity-100 hover:scale-105'}`}
                            ></button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Transmitter Section - Optimized Layout */}
            <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex gap-2">
                        <button onClick={() => setAppendCRC(!appendCRC)} className={`px-2 py-0.5 rounded border text-[8px] font-black transition-all ${appendCRC ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-zinc-600 border-white/5'}`}>CRC16</button>
                        <button onClick={() => setUseHexSend(!useHexSend)} className={`px-2 py-0.5 rounded border text-[8px] font-black transition-all ${useHexSend ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-zinc-600 border-white/5'}`}>HEX</button>
                    </div>
                    <div className="flex bg-black/40 border border-white/5 rounded overflow-hidden">
                        {[ {label:'\\n', val:'\\n'}, {label:'Ø', val:'none'} ].map(opt => (
                            <button key={opt.val} onClick={() => setLineEnding(opt.val)} className={`px-2 py-0.5 text-[8px] font-black transition-all ${lineEnding === opt.val ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-600 hover:text-zinc-500'}`}>{opt.label}</button>
                        ))}
                    </div>
                </div>
                
                <div className="relative group">
                    <textarea 
                        value={inputText} 
                        onChange={e => setInputText(e.target.value)} 
                        onKeyDown={handleKeyDown} 
                        placeholder="Type payload here... (↑/↓ History)" 
                        className="w-full h-32 bg-black/60 border border-white/10 rounded-xl p-3 text-[12px] font-mono focus:outline-none focus:border-emerald-500/40 transition-all resize-none placeholder:opacity-20 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] text-emerald-100" 
                    />
                </div>

                <button 
                  onClick={() => sendData()} 
                  disabled={!isConnected} 
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-black tracking-[0.3em] rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2.5 active:scale-95 group"
                >
                    <Send size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /> SEND DATA
                </button>
            </div>
          </aside>
        </div>

        {/* Feedback Toast */}
        {copyFeedback && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-zinc-800 border border-emerald-500/40 text-emerald-400 px-6 py-2 rounded-full text-[11px] font-black tracking-[0.3em] shadow-[0_15px_40px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-4">
                {copyFeedback}
            </div>
        )}
      </div>

      {/* Hardware Access Modal - Fixed Scan logic */}
      {isConnectModalOpen && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-[540px] bg-[#0c0c0e] border border-white/20 rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-white/10">
                <div className="p-8 border-b border-white/10 flex items-center justify-between bg-zinc-900/40">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                            <Usb className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-sm tracking-[0.3em] uppercase">Hardware Hub</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 opacity-60">Authorize port sessions</p>
                        </div>
                    </div>
                    <button onClick={() => setIsConnectModalOpen(false)} className="p-3 bg-white/5 hover:bg-rose-500/20 hover:text-rose-500 rounded-full text-zinc-500 transition-all border border-white/5 flex items-center justify-center"><X size={18} /></button>
                </div>
                
                <div className="p-8 bg-black/20">
                    <div className="relative group mb-8">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                        <input type="text" placeholder="Filter authorized devices..." value={portSearchQuery} onChange={e => setPortSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-xs outline-none focus:border-emerald-500/40 transition-all shadow-inner tracking-wider" />
                    </div>

                    <div className="max-h-80 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-2">
                        {availablePorts.length === 0 ? (
                            <div className="text-center py-16">
                                <Monitor size={64} className="mx-auto text-zinc-800 mb-6 opacity-30" />
                                <div className="text-zinc-600 text-[10px] font-black tracking-[0.4em] uppercase opacity-40">No Hardware Linked</div>
                            </div>
                        ) : (
                            availablePorts.map((p, i) => (
                                <button key={i} onClick={() => openPort(p)} className="w-full text-left p-5 bg-zinc-900/40 border border-white/5 hover:border-emerald-500/50 rounded-3xl group transition-all flex items-center justify-between shadow-lg hover:bg-zinc-800/60">
                                    <div className="flex items-center gap-6">
                                        <div className="w-11 h-11 rounded-2xl bg-black/60 flex items-center justify-center group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-all border border-white/5">
                                            <Usb size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-black group-hover:text-emerald-400 transition-colors uppercase tracking-tight">Endpoint #{i+1}</div>
                                            <div className="text-[10px] font-mono text-zinc-500 mt-2 uppercase tracking-tight opacity-70">VID:{p.getInfo().usbVendorId?.toString(16).padStart(4,'0') || '0000'} &nbsp; PID:{p.getInfo().usbProductId?.toString(16).padStart(4,'0') || '0000'}</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-zinc-800 group-hover:text-emerald-400 transition-all group-hover:translate-x-2" />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-8 bg-[#0a0a0c] border-t border-white/10">
                    <button 
                      onClick={() => {
                        // Crucial: Synchronous browser trigger for security policy
                        navigator.serial.requestPort()
                          .then(p => {
                            openPort(p);
                            updatePorts();
                          })
                          .catch(() => {});
                      }} 
                      className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.5rem] text-[11px] font-black tracking-[0.4em] transition-all shadow-2xl shadow-emerald-900/40 flex items-center justify-center gap-4 hover:scale-[1.01] active:scale-98"
                    >
                        <Search size={20} /> SCAN FOR HARDWARE
                    </button>
                </div>
            </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; height: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.08); border-radius: 10px; border: 1px solid transparent; background-clip: padding-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.25); }
      `}</style>
    </div>
  );
}