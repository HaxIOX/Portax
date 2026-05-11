import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Terminal, Trash2, Play, Send,
  Activity, X, Pause, Edit2, Save, Plug, Usb, Filter,
  ChevronDown, Timer, Moon, Sun, Cpu, MoreHorizontal,
  BookmarkPlus, AlertCircle, ShieldAlert, List, ArrowUp, Trash, Check,
  LineChart, Settings2, Menu, Download, Maximize2, Minimize2, Eye, EyeOff, Zap,
  Camera, Image as ImageIcon, FileText, FileDown, ExternalLink
} from 'lucide-react';

// Import utilities and components
import { calculateCRC16, parseHexString, bufferToHex } from './utils/serialUtils';
import { getTimestamp } from './utils/timeUtils';
import { logger } from './utils/logger';
import { usePersistedState } from './hooks/usePersistedState';
import { useLogManager } from './hooks/useLogManager';
import { useRxFraming } from './hooks/useRxFraming';
import WaveformChart from './components/WaveformChart';
import LogViewer from './components/LogViewer';
import Sidebar from './components/Sidebar';
import SaveMacroModal from './components/modals/SaveMacroModal';
import MacroManagerModal from './components/modals/MacroManagerModal';
import SnapshotGalleryModal from './components/modals/SnapshotGalleryModal';
import ConnectModal from './components/modals/ConnectModal';
import {
  SERIES_COLORS,
  HIGHLIGHT_PRESETS,
  COMMON_BAUD_RATES,
  DEFAULT_BAUD_RATE,
  DEFAULT_ENCODING,
  DEFAULT_LINE_ENDING,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_QUICK_COMMANDS,
  DEFAULT_SERIES_CONFIG,
  DEFAULT_TIMER_INTERVAL,
  MAX_SEND_HISTORY,
  STORAGE_KEYS,
} from './constants/config';

export default function App() {
  // --- Serial port state (still inline — useSerialPort hook exists but App doesn't use it yet) ---
  const [port, setPort] = useState(null);
  const portRef = useRef(null);
  const [availablePorts, setAvailablePorts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSerialAllowed, setIsSerialAllowed] = useState(true);
  const readerRef = useRef(null);
  const readableStreamClosedRef = useRef(null);
  const closingRef = useRef(false);
  const baudRef = useRef(null);
  const logContainerRef = useRef(null);

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isBaudDropdownOpen, setIsBaudDropdownOpen] = useState(false);
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
  const [isSnapshotGalleryOpen, setIsSnapshotGalleryOpen] = useState(false);
  const [isPdfLibraryLoaded, setIsPdfLibraryLoaded] = useState(false);

  const [isPlotterOpen, setIsPlotterOpen] = useState(false);
  const [isPlotterFullscreen, setIsPlotterFullscreen] = useState(false);
  const [isPlotterSettingsOpen, setIsPlotterSettingsOpen] = useState(false);

  const [snapshots, setSnapshots] = useState([]);
  const [seriesConfig, setSeriesConfig] = useState(DEFAULT_SERIES_CONFIG);
  const [plotScaleMode, setPlotScaleMode] = usePersistedState(STORAGE_KEYS.PLOT_SCALE_MODE, 'arduino');

  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCmdStr, setEditCmdStr] = useState('');

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveMacroName, setSaveMacroName] = useState('');

  const [inputText, setInputText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState('ascii');
  const [logFilter, setLogFilter] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(null);

  const [sendHistory, setSendHistory] = usePersistedState(STORAGE_KEYS.SEND_HISTORY, []);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [baudRate, setBaudRate] = usePersistedState(STORAGE_KEYS.BAUD_RATE, DEFAULT_BAUD_RATE);
  const [encoding, setEncoding] = usePersistedState(STORAGE_KEYS.ENCODING, DEFAULT_ENCODING);
  const [highlightKeyword, setHighlightKeyword] = usePersistedState(STORAGE_KEYS.HIGHLIGHT_KEYWORD, '');
  const [highlightColor, setHighlightColor] = usePersistedState(STORAGE_KEYS.HIGHLIGHT_COLOR, DEFAULT_HIGHLIGHT_COLOR);
  const [quickCommands, setQuickCommands] = usePersistedState(STORAGE_KEYS.QUICK_COMMANDS, DEFAULT_QUICK_COMMANDS);
  const [useHexSend, setUseHexSend] = usePersistedState(STORAGE_KEYS.USE_HEX_SEND, false);
  const [lineEnding, setLineEnding] = usePersistedState(STORAGE_KEYS.LINE_ENDING, DEFAULT_LINE_ENDING);
  const [appendCRC, setAppendCRC] = usePersistedState(STORAGE_KEYS.APPEND_CRC, false);
  const [showTimestamp, setShowTimestamp] = usePersistedState(STORAGE_KEYS.SHOW_TIMESTAMP, true);
  const [theme, setTheme] = usePersistedState(STORAGE_KEYS.THEME, 'light');
  const isDark = theme === 'dark';

  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerInterval, setTimerInterval] = usePersistedState(STORAGE_KEYS.TIMER_INTERVAL, DEFAULT_TIMER_INTERVAL);
  const timerRef = useRef(null);
  const inputTextRef = useRef('');

  const isWebSerialSupported = 'serial' in navigator;

  // ===== Custom Hooks =====

  const {
    logs, plotData, isPaused, lastActivity,
    setIsPaused, setPlotData,
    isPausedRef, appendRxLinesRef,
    addLog, appendRxLines, clearLogs, markActivity,
  } = useLogManager({ seriesConfig });

  const {
    enqueueRxText, bufferWhilePaused, flushPausedBuffer, resetFraming,
  } = useRxFraming({ isPausedRef, appendRxLinesRef });

  // ===== Effects =====

  // Load jsPDF dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => setIsPdfLibraryLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => { portRef.current = port; }, [port]);
  useEffect(() => { inputTextRef.current = inputText; }, [inputText]);

  // Flush paused buffer when unpaused
  useEffect(() => {
    if (!isPaused) flushPausedBuffer();
  }, [isPaused, flushPausedBuffer]);

  // ===== Serial Port Logic =====

  const updatePorts = useCallback(async () => {
    if (!isWebSerialSupported) return;
    try {
      const ports = await navigator.serial.getPorts();
      setAvailablePorts(ports);
      setIsSerialAllowed(true);
    } catch (e) { setIsSerialAllowed(false); }
  }, [isWebSerialSupported]);

  const disconnectPort = useCallback(async () => {
    closingRef.current = true;
    setTimerEnabled(false);
    if (timerRef.current) clearInterval(timerRef.current);
    resetFraming();

    const reader = readerRef.current;
    readerRef.current = null;
    const closed = readableStreamClosedRef.current;
    readableStreamClosedRef.current = null;
    const currentPort = portRef.current;
    try { if (reader) await reader.cancel(); } catch {}
    try { if (reader) reader.releaseLock(); } catch {}
    try { if (closed) await closed.catch(() => {}); } catch {}
    try { if (currentPort) await currentPort.close(); } catch (e) { console.error(e); }
    setPort(null);
    portRef.current = null;
    setIsConnected(false);
    closingRef.current = false;
    updatePorts();
  }, [updatePorts, resetFraming]);

  useEffect(() => {
    if (!isWebSerialSupported) return;
    const handleConnect = () => { updatePorts(); };
    const handleDisconnect = (e) => { updatePorts(); if (portRef.current === e.target) disconnectPort(); };
    updatePorts();
    navigator.serial.addEventListener('connect', handleConnect);
    navigator.serial.addEventListener('disconnect', handleDisconnect);
    return () => {
      navigator.serial.removeEventListener('connect', handleConnect);
      navigator.serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, [isWebSerialSupported, updatePorts, disconnectPort]);

  // ===== Send helpers =====

  const sendDataDirect = useCallback(async (text) => {
    if (!port?.writable || !text) return;
    const writer = port.writable.getWriter();
    try {
      let data;
      let display;
      if (useHexSend) {
        const bytes = parseHexString(text);
        if (!bytes) { writer.releaseLock(); return; }
        data = bytes;
        display = bufferToHex(bytes);
      } else {
        let str = text;
        if (lineEnding === '\\n') str += '\n'; else if (lineEnding === '\\r\\n') str += '\r\n';
        data = new TextEncoder().encode(str);
        display = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      }
      if (appendCRC) {
        const crc = calculateCRC16(data);
        const merged = new Uint8Array(data.length + 2); merged.set(data); merged.set(crc, data.length);
        data = merged; display += ` [CRC16]`;
      }
      await writer.write(data);
      markActivity('tx');
      addLog({ id: Math.random(), timestamp: getTimestamp(), text: display, type: 'tx' });
    } catch (e) { console.error(e); } finally { writer.releaseLock(); }
  }, [appendCRC, lineEnding, port, useHexSend, addLog, markActivity]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timerEnabled && isConnected) {
      timerRef.current = setInterval(() => { if (inputTextRef.current) sendDataDirect(inputTextRef.current); }, timerInterval);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerEnabled, isConnected, timerInterval, sendDataDirect]);

  // ===== Read Loop =====

  const readLoop = async (selectedPort) => {
    logger.debug('readLoop started, encoding:', encoding);
    const textDecoder = new TextDecoderStream(encoding);
    const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
    readableStreamClosedRef.current = readableStreamClosed;
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          if (isPausedRef.current) {
            bufferWhilePaused(value);
          } else {
            enqueueRxText(value);
          }
        }
      }
    } catch (error) {
      if (!closingRef.current) logger.error("Read Error: ", error);
    } finally {
      try { reader.releaseLock(); } catch {}
      if (readerRef.current === reader) readerRef.current = null;
      try { await readableStreamClosed; } catch {}
      if (readableStreamClosedRef.current === readableStreamClosed) readableStreamClosedRef.current = null;
    }
  };

  const openPort = async (selectedPort) => {
    try {
      await selectedPort.open({ baudRate: parseInt(baudRate) || 115200 });
      setPort(selectedPort);
      portRef.current = selectedPort;
      setIsConnected(true);
      setIsConnectModalOpen(false);
      closingRef.current = false;
      readLoop(selectedPort);
    } catch (error) {
      logger.error('Port open failed:', error);
      alert(`Connection failed: ${error.message}`);
    }
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
        if (lineEnding === '\\n') str += '\n'; else if (lineEnding === '\\r\\n') str += '\r\n';
        data = new TextEncoder().encode(str);
        display = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
      }
      if (appendCRC) {
        const crc = calculateCRC16(data);
        const merged = new Uint8Array(data.length + 2); merged.set(data); merged.set(crc, data.length);
        data = merged; display += ` [CRC16]`;
      }
      await writer.write(data);
      markActivity('tx');
      addLog({ id: Math.random(), timestamp: getTimestamp(), text: display, type: 'tx' });
      if (textOverride === null) {
        setSendHistory(prev => { const filtered = prev.filter(h => h !== text); return [text, ...filtered].slice(0, 50); });
        setHistoryIndex(-1); setInputText('');
      }
    } catch (e) { alert(`Send failed: ${e.message}`); } finally { writer.releaseLock(); }
  };

  // ===== Misc actions =====

  const simulateRxData = () => {
    let fakeText = "";
    const hasKeywords = seriesConfig.some(s => s.keyword);
    if (hasKeywords) {
      fakeText = seriesConfig.filter(s => s.visible && s.keyword).map(s => `${s.keyword} ${(Math.random() * 100).toFixed(1)}`).join(', ');
    } else {
      fakeText = Array(4).fill(0).map(() => (Math.random() * 100).toFixed(1)).join(', ');
    }
    if (!fakeText) fakeText = "No series visible or config";
    addLog({ id: Math.random(), timestamp: getTimestamp(), text: fakeText, type: 'rx' });
  };

  const saveToMacro = () => {
    if (!inputText.trim()) return;
    setSaveMacroName(`CMD ${quickCommands.length + 1}`);
    setIsSaveModalOpen(true);
  };

  const confirmSaveMacro = () => {
    if (!saveMacroName.trim() || !inputText.trim()) return;
    const newMacro = { id: Date.now(), label: saveMacroName.trim(), cmd: inputText.trim() };
    setQuickCommands([...quickCommands, newMacro]);
    setIsSaveModalOpen(false);
    setSaveMacroName('');
    setCopyFeedback("Saved Macro");
    setTimeout(() => setCopyFeedback(null), 1000);
  };

  const handleChartSnapshot = useCallback(() => {
    const svgElement = document.querySelector("#waveform-chart-svg");
    if (!svgElement) { setCopyFeedback("No Chart"); setTimeout(() => setCopyFeedback(null), 1000); return; }

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) { source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"'); }
    if (!source.match(/^<svg[^>]+xmlns:xlink/)) { source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'); }
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const bbox = svgElement.getBoundingClientRect();
      const scale = 2;
      const padding = 40;
      const width = bbox.width * scale + padding * 2;
      const height = bbox.height * scale + padding * 2;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = isDark ? "#1E1F20" : "#FFFFFF";
      ctx.fillRect(0, 0, width, height);

      let seriesRanges = [];
      if (plotScaleMode === 'arduino') {
        let gMin = Infinity;
        let gMax = -Infinity;
        plotData.forEach(p => {
          seriesConfig.forEach((conf, idx) => {
            if (!conf.visible) return;
            const v = p?.values?.[idx];
            if (v == null || isNaN(v)) return;
            if (v < gMin) gMin = v;
            if (v > gMax) gMax = v;
          });
        });
        if (gMin === Infinity) {
          seriesRanges = seriesConfig.map(() => null);
        } else {
          const rawRange = gMax - gMin;
          const margin = rawRange === 0 ? 1 : rawRange * 0.05;
          const min = gMin - margin;
          const max = gMax + margin;
          const range = max - min || 1;
          const g = { min, max, range };
          seriesRanges = seriesConfig.map(conf => (conf.visible ? g : null));
        }
      } else {
        seriesRanges = seriesConfig.map((conf, idx) => {
          if (!conf.visible) return null;
          let values = [];
          plotData.forEach(p => {
            const v = p?.values?.[idx];
            if (v != null && !isNaN(v)) values.push(v);
          });
          if (values.length === 0) return null;
          const max = Math.max(...values);
          const min = Math.min(...values);
          const range = max - min || 1;
          return { min, max, range };
        });
      }

      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      const cols = 10; const rows = 6;
      const drawW = bbox.width * scale;
      const drawH = bbox.height * scale;
      const startX = padding;
      const startY = padding;

      for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(startX + (drawW / cols) * i, startY); ctx.lineTo(startX + (drawW / cols) * i, startY + drawH); ctx.stroke(); }
      for (let i = 0; i <= rows; i++) { ctx.beginPath(); ctx.moveTo(startX, startY + (drawH / rows) * i); ctx.lineTo(startX + drawW, startY + (drawH / rows) * i); ctx.stroke(); }

      ctx.drawImage(img, startX, startY, drawW, drawH);

      const labelStep = Math.max(1, Math.floor(plotData.length / 25));
      plotData.forEach((p, i) => {
        if (i % labelStep !== 0 && i !== plotData.length - 1) return;
        seriesConfig.forEach((conf, sIdx) => {
          if (!conf.visible || !seriesRanges[sIdx]) return;
          const val = p.values[sIdx];
          if (val === undefined || val === null || isNaN(val)) return;

          const x = startX + (i / (plotData.length - 1)) * drawW;
          const { min, range } = seriesRanges[sIdx];
          const y = startY + drawH - ((val - min) / range) * drawH;

          ctx.fillStyle = SERIES_COLORS[sIdx % 4];
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
          ctx.font = "bold 10px monospace";
          const text = val.toFixed(1);
          const textWidth = ctx.measureText(text).width;

          let tx = x - textWidth / 2;
          let ty = y - 8;
          if (ty < startY + 10) ty = y + 15;
          ctx.fillText(text, tx, ty);
        });
      });

      const lastPoint = plotData[plotData.length - 1];
      if (lastPoint) {
        let legendY = padding + 10;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "right";
        seriesConfig.forEach((conf, idx) => {
          if (conf.visible) {
            ctx.fillStyle = SERIES_COLORS[idx % 4];
            const val = lastPoint.values[idx]?.toFixed(2) || '--';
            ctx.fillText(`${conf.name}: ${val}`, width - padding - 10, legendY);
            legendY += 20;
          }
        });
      }

      const meta = { timestamp: new Date().toLocaleString(), values: lastPoint ? lastPoint.values : [] };
      const pngUrl = canvas.toDataURL("image/png");
      setSnapshots(prev => [...prev, { id: Date.now(), url: pngUrl, meta }]);
      setCopyFeedback("Snapshot Stored");
      setTimeout(() => setCopyFeedback(null), 1000);
    };
    img.src = url;
  }, [isDark, plotData, plotScaleMode, seriesConfig]);

  // --- HTML Report Export ---
  const generateReportHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Portax Waveform Report</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; background: #f8fafc; color: #334155; }
              .container { max-width: 1280px; margin: 0 auto; }
              h1 { text-align: center; color: #0f172a; margin-bottom: 8px; font-size: 24px; font-weight: 700; }
              .meta { text-align: center; color: #64748b; font-size: 13px; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0; }
              .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 30px; overflow: hidden; page-break-inside: avoid; }
              .card-header { background: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
              .card-header h3 { margin: 0; font-size: 14px; color: #0f172a; font-weight: 600; }
              .card-header .ts { font-family: monospace; font-size: 12px; color: #64748b; }
              .card-body { padding: 20px; }
              .img-wrapper { text-align: center; margin-bottom: 20px; background: #fafafa; border-radius: 8px; padding: 5px; border: 1px solid #f1f5f9; }
              .card img { width: 100%; height: auto; display: block; }
              .data-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
              .data-item { display: flex; justify-content: space-between; font-size: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
              .data-label { color: #64748b; }
              .data-val { font-family: monospace; font-weight: 700; color: #0f172a; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Portax Report</h1>
              <div class="meta">Generated: ${new Date().toLocaleString()} &bull; Total Snapshots: ${snapshots.length}</div>
              ${snapshots.map((s, i) => `
                  <div class="card">
                      <div class="card-header">
                          <h3>Snapshot #${i + 1}</h3>
                          <span class="ts">${s.meta.timestamp}</span>
                      </div>
                      <div class="card-body">
                          <div class="img-wrapper">
                              <img src="${s.url}" />
                          </div>
                          <div class="data-grid">
                              ${s.meta.values.map((v, idx) => seriesConfig[idx]?.visible ? `
                                  <div class="data-item">
                                      <span class="data-label" style="color:${SERIES_COLORS[idx % 4]}">● ${seriesConfig[idx].name}</span>
                                      <span class="data-val">${v !== null ? v.toFixed(3) : 'N/A'}</span>
                                  </div>` : '').join('')}
                          </div>
                      </div>
                  </div>
              `).join('')}
          </div>
      </body>
      </html>`;
  };

  // --- PDF Export ---
  const handleExportPdf = () => {
    if (!window.jspdf) { alert("PDF Library loading..."); return; }
    if (snapshots.length === 0) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(33, 33, 33);
    doc.text("Portax Report", pageWidth / 2, y + 5, { align: "center" });
    y += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: "center" });
    doc.setDrawColor(220);
    doc.line(margin, y + 5, pageWidth - margin, y + 5);
    y += 15;

    snapshots.forEach((s, i) => {
      const imgProps = doc.getImageProperties(s.url);
      const imgDisplayWidth = contentWidth * 0.8;
      const imgDisplayHeight = (imgProps.height * imgDisplayWidth) / imgProps.width;

      const metaHeight = 15;
      const dataHeight = (Math.ceil(s.meta.values.length / 2) * 6) + 15;
      const totalBlockHeight = metaHeight + imgDisplayHeight + dataHeight + 15;

      if (y + totalBlockHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }

      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 8, 'S');

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(`Snapshot #${i + 1}`, margin + 3, y + 5.5);

      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(s.meta.timestamp, pageWidth - margin - 3, y + 5.5, { align: "right" });

      y += 12;

      const xOffset = margin + (contentWidth - imgDisplayWidth) / 2;
      doc.addImage(s.url, 'PNG', xOffset, y, imgDisplayWidth, imgDisplayHeight);
      doc.setDrawColor(226, 232, 240);
      doc.rect(xOffset, y, imgDisplayWidth, imgDisplayHeight);
      y += imgDisplayHeight + 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("Captured Values:", margin, y + 4);
      y += 8;

      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);

      let col = 0;
      const colWidth = contentWidth / 2;

      s.meta.values.forEach((v, idx) => {
        const conf = seriesConfig[idx];
        if (conf && conf.visible) {
          const xPos = col === 0 ? margin + 5 : margin + colWidth + 5;
          const valStr = v !== null ? v.toFixed(3) : 'N/A';
          const nameStr = conf.name || `Series ${idx + 1}`;

          doc.setTextColor(100, 116, 139);
          doc.text(`${nameStr}:`, xPos, y);
          doc.setTextColor(15, 23, 42);
          doc.text(`${valStr}`, xPos + 35, y);

          doc.setDrawColor(241, 245, 249);
          doc.line(xPos, y + 2, xPos + colWidth - 10, y + 2);

          if (col === 1) { col = 0; y += 6; } else { col = 1; }
        }
      });
      if (col === 1) y += 6;
      y += 10;
    });

    doc.save(`Portax_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleViewReport = () => {
    if (snapshots.length === 0) return;
    const html = generateReportHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleExportLogs = () => {
    if (logs.length === 0) return;
    const header = 'Timestamp,Type,Content\n';
    const csv = logs.map(l => `"${l.timestamp}","${l.type}","${String(l.text).replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Portax_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const moveToTop = (index) => { if (index === 0) return; const newCmds = [...quickCommands]; const item = newCmds.splice(index, 1)[0]; newCmds.unshift(item); setQuickCommands(newCmds); };
  const startEditing = (cmd) => { setEditingId(cmd.id); setEditLabel(cmd.label); setEditCmdStr(cmd.cmd); };
  const saveEdit = () => { if (!editLabel.trim() || !editCmdStr.trim()) return; setQuickCommands(prev => prev.map(c => c.id === editingId ? { ...c, label: editLabel, cmd: editCmdStr } : c)); setEditingId(null); };
  const deleteMacro = (id) => { setQuickCommands(prev => prev.filter(c => c.id !== id)); };
  const cycleLineEnding = () => { if (lineEnding === '\\n') setLineEnding('\\r\\n'); else if (lineEnding === '\\r\\n') setLineEnding(''); else setLineEnding('\\n'); };
  const getLineEndingLabel = () => lineEnding === '\\n' ? '\\n' : lineEnding === '\\r\\n' ? '\\r\\n' : 'NONE';

  const handleScanDevices = () => {
    navigator.serial.requestPort().then(p => {
      openPort(p);
      updatePorts();
    }).catch((e) => {
      logger.error(e);
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendData(); }
    else if (e.key === 'ArrowUp') { if (sendHistory.length > 0 && !e.shiftKey) { e.preventDefault(); const next = Math.min(historyIndex + 1, sendHistory.length - 1); setHistoryIndex(next); setInputText(sendHistory[next]); } }
    else if (e.key === 'ArrowDown') { if (historyIndex >= 0) { e.preventDefault(); const next = historyIndex - 1; setHistoryIndex(next); if (next === -1) setInputText(''); else setInputText(sendHistory[next]); } }
  };

  const highlightRegex = useMemo(() => {
    if (!highlightKeyword) return null;
    const escapedKeyword = String(highlightKeyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(${escapedKeyword})`, 'gi');
  }, [highlightKeyword]);

  const renderContent = useCallback((text) => {
    const safeText = String(text || '');
    if (viewMode === 'hex' || !highlightKeyword || !highlightRegex) return safeText;

    const parts = safeText.split(highlightRegex);
    return parts.map((part, i) =>
      part.toLowerCase() === highlightKeyword.toLowerCase()
        ? <span key={i} className={`rounded-sm px-0.5 ${highlightColor}`}>{part}</span>
        : part
    );
  }, [viewMode, highlightKeyword, highlightRegex, highlightColor]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current && !logFilter) { const container = logContainerRef.current; requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; }); }
  }, [logs, autoScroll, logFilter]);

  const t = {
    pageBg: isDark ? 'bg-[#000000]' : 'bg-[#FAFAFA]',
    windowBg: isDark ? 'bg-[#09090b]' : 'bg-[#FFFFFF]',
    textPrimary: isDark ? 'text-[#E4E4E7]' : 'text-[#18181B]',
    textSecondary: isDark ? 'text-[#A1A1AA]' : 'text-[#52525B]',
    textTertiary: isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]',
    border: isDark ? 'border-[#27272A]' : 'border-[#E4E4E7]',
    borderHover: isDark ? 'border-[#52525B]' : 'border-[#D4D4D8]',
    panelBg: isDark ? 'bg-[#18181B]' : 'bg-[#FFFFFF]',
    inputBg: isDark ? 'bg-[#000000]' : 'bg-[#F4F4F5]',
    hoverBg: isDark ? 'hover:bg-[#27272A]' : 'hover:bg-[#F4F4F5]',
    accentFill: isDark ? 'bg-[#10b981]' : 'bg-[#059669]',
    accentText: 'text-white',
    accentHover: isDark ? 'hover:bg-[#34d399]' : 'hover:bg-[#047857]',
  };

  return (
    <div className={`flex h-screen w-full items-center justify-center ${t.pageBg} ${t.textPrimary} font-sans selection:bg-emerald-500/30 overflow-hidden relative transition-colors duration-500`}>
      <style>{`
        .font-sans { font-family: 'Inter', system-ui, sans-serif; letter-spacing: -0.01em; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${isDark ? '#27272A' : '#D4D4D8'}; border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${isDark ? '#52525B' : '#A1A1AA'}; }

        .bg-grid-pattern {
            background-image: linear-gradient(to right, ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} 1px, transparent 1px),
                              linear-gradient(to bottom, ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} 1px, transparent 1px);
            background-size: 40px 40px;
        }
      `}</style>

      {/* Main Window */}
      <div className={`relative w-[80vw] h-[75vh] max-w-[1000px] flex flex-col shadow-xl z-10
        rounded-3xl ${t.border} border ${t.windowBg} overflow-hidden transition-all duration-300`}>
        {/* --- Header --- */}
        <div className={`h-12 border-b ${t.border} flex items-center justify-between px-6 select-none flex-none ${t.panelBg}`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setIsMainMenuOpen(!isMainMenuOpen)} className={`p-1.5 rounded-lg hover:${t.hoverBg} ${t.textSecondary} transition-colors`}><Menu size={18} /></button>
              {isMainMenuOpen && (
                <div className={`absolute top-full left-0 mt-2 w-48 rounded-xl border ${t.border} ${t.windowBg} shadow-xl py-2 z-[100] flex flex-col`}>
                  <div className={`px-4 py-2 text-xs font-bold uppercase tracking-widest ${t.textTertiary}`}>View</div>
                  <button onClick={() => { setIsPlotterOpen(false); setIsMainMenuOpen(false); }} className={`px-4 py-2 text-left text-sm hover:${t.hoverBg} flex items-center gap-2 ${!isPlotterOpen ? 'text-emerald-500' : t.textPrimary}`}><Terminal size={14} /> Terminal</button>
                  <button onClick={() => { setIsPlotterOpen(true); setIsMainMenuOpen(false); }} className={`px-4 py-2 text-left text-sm hover:${t.hoverBg} flex items-center gap-2 ${isPlotterOpen ? 'text-emerald-500' : t.textPrimary}`}><LineChart size={14} /> Monitor</button>
                  <div className={`h-px ${t.border} my-1`}></div>
                  <div className={`px-4 py-2 text-xs font-bold uppercase tracking-widest ${t.textTertiary}`}>Tools</div>
                  <button onClick={() => { simulateRxData(); setIsMainMenuOpen(false); }} className={`px-4 py-2 text-left text-sm hover:${t.hoverBg} flex items-center gap-2 ${t.textPrimary}`}><Zap size={14} /> Simulate RX</button>
                  <button onClick={() => { handleExportLogs(); setIsMainMenuOpen(false); }} className={`px-4 py-2 text-left text-sm hover:${t.hoverBg} flex items-center gap-2 ${t.textPrimary}`}><Download size={14} /> Export CSV</button>
                </div>
              )}
            </div>
            <span className={`text-sm font-semibold tracking-tight ${t.textPrimary}`}>Port<span className="opacity-50 font-normal">ax</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSnapshotGalleryOpen(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${t.border} ${t.hoverBg} ${t.textSecondary} text-[10px] transition-colors`}><ImageIcon size={12} /> Gallery ({snapshots.length})</button>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`size-8 flex items-center justify-center rounded-full border ${t.border} ${t.hoverBg} ${t.textSecondary} transition-colors`}>{isDark ? <Sun size={14} /> : <Moon size={14} />}</button>
          </div>
        </div>

        {/* --- Body --- */}
        <div className="flex-1 flex overflow-hidden">
          <main className={`flex-1 flex flex-col min-w-0 relative ${t.windowBg}`}>
            {/* Toolbar */}
            <div className={`h-12 border-b ${t.border} flex items-center px-6 gap-4 ${t.panelBg}`}>
              <div className={`flex items-center gap-2 pl-3 pr-4 py-1.5 rounded-full border transition-all duration-300 ${isConnected ? 'border-emerald-500/30 bg-emerald-500/5' : `${t.border} bg-transparent`}`}>
                <div className="relative flex items-center justify-center size-2.5"><Activity size={14} className={`${isConnected ? 'text-emerald-500 animate-pulse' : t.textTertiary}`} /></div>
                <span className={`text-sm font-bold uppercase tracking-wider ${isConnected ? 'text-emerald-500' : t.textTertiary}`}>{isConnected ? 'Connected' : 'Offline'}</span>
              </div>
              <div className={`h-5 w-px ${isDark ? 'bg-white/10' : 'bg-black/10'}`}></div>
              <div className="flex-1 flex items-center gap-3">
                <Filter size={14} className={t.textTertiary} />
                <input value={logFilter} onChange={e => setLogFilter(e.target.value)} placeholder="Search logs..." className={`bg-transparent border-none outline-none text-sm font-medium w-full ${t.textPrimary} placeholder:${t.textTertiary}`} />
              </div>
              <div className={`flex border ${t.border} rounded-full p-1 ${t.inputBg}`}>
                <button onClick={() => setViewMode('ascii')} className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all ${viewMode === 'ascii' ? `${t.accentFill} ${t.accentText} shadow-sm` : `${t.textSecondary} hover:${t.textPrimary}`}`}>TXT</button>
                <button onClick={() => setViewMode('hex')} className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all ${viewMode === 'hex' ? `${t.accentFill} ${t.accentText} shadow-sm` : `${t.textSecondary} hover:${t.textPrimary}`}`}>HEX</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsPaused(!isPaused)} className={`size-8 flex items-center justify-center rounded-full border ${t.border} hover:${t.hoverBg} transition-colors ${isPaused ? 'text-amber-500 border-amber-500/50' : t.textSecondary}`}>{isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} />}</button>
                <button onClick={clearLogs} className={`size-8 flex items-center justify-center rounded-full border ${t.border} hover:${t.hoverBg} ${t.textSecondary} hover:text-rose-500 transition-colors`}><Trash2 size={14} /></button>
              </div>
            </div>

            {/* Split Content */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              <div ref={logContainerRef} className={`flex-1 p-6 overflow-y-auto custom-scrollbar font-mono text-sm leading-relaxed transition-all duration-300 ${isPlotterOpen ? 'basis-2/3' : 'basis-full'}`}>
                <LogViewer
                  logs={logs}
                  logFilter={logFilter}
                  showTimestamp={showTimestamp}
                  isDark={isDark}
                  textTheme={t}
                  renderContent={renderContent}
                  isWebSerialSupported={isWebSerialSupported}
                />
              </div>

              {isPlotterOpen && (
                <div className={`transition-all duration-300 border-t ${t.border} bg-black/5 flex flex-col ${isPlotterFullscreen ? `absolute inset-0 z-50 ${isDark ? 'bg-black/90' : 'bg-white/90'} backdrop-blur-md bg-grid-pattern` : 'basis-1/3 min-h-[160px]'}`}>
                  <div className={`h-8 px-4 flex items-center justify-between ${t.panelBg} border-b ${t.border} bg-opacity-80`}>
                    <div className="flex items-center gap-2"><Activity size={12} className={t.textTertiary} /><span className={`text-[10px] font-bold uppercase ${t.textSecondary}`}>Waveform</span></div>
                    <div className="flex items-center gap-4">
                      <button onClick={handleChartSnapshot} className={`${t.textTertiary} hover:${t.textPrimary}`} title="Snapshot"><Camera size={12} /></button>
                      <button onClick={() => setIsPlotterSettingsOpen(!isPlotterSettingsOpen)} className={`${t.textTertiary} hover:${t.textPrimary}`}><Settings2 size={12} /></button>
                      <button onClick={() => setIsPlotterFullscreen(!isPlotterFullscreen)} className={`${t.textTertiary} hover:${t.textPrimary}`}>{isPlotterFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}</button>
                    </div>
                  </div>
                  {isPlotterSettingsOpen && (
                    <div className={`absolute top-9 right-4 z-[60] p-3 rounded-xl border ${t.border} ${t.inputBg} shadow-xl w-56`}>
                      <div className="text-[10px] font-bold uppercase mb-2 text-zinc-500">Series Config</div>
                      <div className="space-y-2">
                        {seriesConfig.map((conf, i) => (
                          <div key={i} className={`flex items-center gap-2 text-[11px]`}>
                            <button onClick={() => { const n = [...seriesConfig]; n[i].visible = !n[i].visible; setSeriesConfig(n) }}>{conf.visible ? <Eye size={12} style={{ color: SERIES_COLORS[i] }} /> : <EyeOff size={12} className={t.textTertiary} />}</button>
                            <input value={conf.name} onChange={e => { const n = [...seriesConfig]; n[i].name = e.target.value; setSeriesConfig(n) }} className={`w-12 bg-transparent border-b ${t.border} outline-none ${t.textPrimary}`} placeholder="Name" />
                            <input value={conf.keyword} onChange={e => { const n = [...seriesConfig]; n[i].keyword = e.target.value; setSeriesConfig(n) }} className={`flex-1 bg-transparent border-b ${t.border} outline-none ${t.textTertiary}`} placeholder="Keyword (opt)" />
                          </div>
                        ))}
                      </div>
                      <div className={`mt-3 pt-3 border-t ${t.border}`}>
                        <div className="text-[10px] font-bold uppercase mb-2 text-zinc-500">Y Scale</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPlotScaleMode('arduino')}
                            className={`flex-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${plotScaleMode === 'arduino' ? `${t.accentFill} ${t.accentText} border-transparent` : `${t.border} ${t.textTertiary} hover:${t.textSecondary}`}`}
                          >
                            Arduino
                          </button>
                          <button
                            onClick={() => setPlotScaleMode('per-series')}
                            className={`flex-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${plotScaleMode === 'per-series' ? `${t.accentFill} ${t.accentText} border-transparent` : `${t.border} ${t.textTertiary} hover:${t.textSecondary}`}`}
                          >
                            Per-Series
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 p-2 relative"><WaveformChart dataHistory={plotData} seriesConfig={seriesConfig} scaleMode={plotScaleMode} /></div>
                </div>
              )}
            </div>

            {/* Footer Stats */}
            <div className={`h-10 border-t ${t.border} flex items-center justify-between px-6 text-[11px] font-medium ${t.textSecondary} ${t.panelBg}`}>
              <div className="flex gap-6">
                <div className="flex items-center gap-2"><div className={`size-1.5 rounded-full transition-all duration-300 ${Date.now() - lastActivity.time < 150 && lastActivity.type === 'rx' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] scale-150' : 'bg-emerald-500/40'}`}></div><span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>RX <span className={t.textPrimary}>{logs.filter(l => l.type === 'rx').length}</span></span></div>
                <div className="flex items-center gap-2"><div className={`size-1.5 rounded-full transition-all duration-300 ${Date.now() - lastActivity.time < 150 && lastActivity.type === 'tx' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] scale-150' : 'bg-blue-500/40'}`}></div><span className={isDark ? 'text-blue-400' : 'text-blue-600'}>TX <span className={t.textPrimary}>{logs.filter(l => l.type === 'tx').length}</span></span></div>
              </div>
              <div className="flex gap-6">
                <button onClick={() => setAutoScroll(!autoScroll)} className={`flex items-center gap-2 hover:${t.textPrimary} transition-colors group`}>AutoScroll <div className={`size-1.5 rounded-full transition-colors ${autoScroll ? 'bg-emerald-500' : 'bg-neutral-400'}`}></div></button>
                <button onClick={() => setShowTimestamp(!showTimestamp)} className={`flex items-center gap-2 hover:${t.textPrimary} transition-colors group`}>Time <div className={`size-1.5 rounded-full transition-colors ${showTimestamp ? 'bg-emerald-500' : 'bg-neutral-400'}`}></div></button>
              </div>
            </div>
          </main>

          {/* Right: Sidebar */}
          <Sidebar
            isConnected={isConnected}
            baudRate={baudRate}
            setBaudRate={setBaudRate}
            isBaudDropdownOpen={isBaudDropdownOpen}
            setIsBaudDropdownOpen={setIsBaudDropdownOpen}
            onConnect={() => setIsConnectModalOpen(true)}
            onDisconnect={disconnectPort}
            highlightKeyword={highlightKeyword}
            setHighlightKeyword={setHighlightKeyword}
            highlightColor={highlightColor}
            setHighlightColor={setHighlightColor}
            quickCommands={quickCommands}
            onSendCommand={sendData}
            timerEnabled={timerEnabled}
            setTimerEnabled={setTimerEnabled}
            timerInterval={timerInterval}
            setTimerInterval={setTimerInterval}
            useHexSend={useHexSend}
            setUseHexSend={setUseHexSend}
            appendCRC={appendCRC}
            setAppendCRC={setAppendCRC}
            lineEnding={lineEnding}
            cycleLineEnding={cycleLineEnding}
            getLineEndingLabel={getLineEndingLabel}
            inputText={inputText}
            setInputText={setInputText}
            onSendData={() => sendData()}
            onSaveToMacro={saveToMacro}
            onOpenMacroManager={() => setIsMacroModalOpen(true)}
            handleKeyDown={handleKeyDown}
            theme={t}
            baudRef={baudRef}
          />
        </div>

        {/* Modals */}
        <SaveMacroModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          saveMacroName={saveMacroName}
          setSaveMacroName={setSaveMacroName}
          inputText={inputText}
          onConfirm={confirmSaveMacro}
          theme={t}
        />

        <MacroManagerModal
          isOpen={isMacroModalOpen}
          onClose={() => setIsMacroModalOpen(false)}
          quickCommands={quickCommands}
          editingId={editingId}
          editLabel={editLabel}
          setEditLabel={setEditLabel}
          editCmdStr={editCmdStr}
          setEditCmdStr={setEditCmdStr}
          onSaveEdit={saveEdit}
          onStartEditing={startEditing}
          onSendCommand={sendData}
          onMoveToTop={moveToTop}
          onDelete={deleteMacro}
          theme={t}
        />

        <SnapshotGalleryModal
          isOpen={isSnapshotGalleryOpen}
          onClose={() => setIsSnapshotGalleryOpen(false)}
          snapshots={snapshots}
          onDeleteSnapshot={(id) => setSnapshots(prev => prev.filter(snap => snap.id !== id))}
          onClearAll={() => setSnapshots([])}
          onViewReport={handleViewReport}
          onExportPdf={handleExportPdf}
          theme={t}
        />

        <ConnectModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
          isWebSerialSupported={isWebSerialSupported}
          isSerialAllowed={isSerialAllowed}
          availablePorts={availablePorts}
          onOpenPort={openPort}
          onScanDevices={handleScanDevices}
          theme={t}
        />

        {copyFeedback && (<div className={`absolute bottom-8 left-8 px-5 py-2.5 ${t.accentFill} ${t.accentText} text-[11px] font-bold tracking-widest uppercase rounded-full shadow-2xl z-[110] animate-in fade-in slide-in-from-bottom-2`}>{copyFeedback}</div>)}
      </div>
    </div>
  );
}
