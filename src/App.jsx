import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Terminal, Trash2, Play, Send,
  Activity, X, Pause, Edit2, Save, Plug, Usb, Filter,
  ChevronDown, Timer, Moon, Sun, Cpu, MoreHorizontal,
  BookmarkPlus, AlertCircle, ShieldAlert, List, ArrowUp, Trash, Check,
  LineChart, Settings2, Menu, Download, Maximize2, Minimize2, Eye, EyeOff, Zap,
  Camera, Image as ImageIcon, FileText, FileDown, ExternalLink
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

// --- Component: Multi-Series Waveform Chart ---
const SERIES_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899']; 
const isValidNumber = (v) => typeof v === 'number' && Number.isFinite(v);

const WaveformChart = ({ dataHistory, seriesConfig, scaleMode = 'per-series' }) => {
    const [hoverIndex, setHoverIndex] = useState(null);
    const chartAreaRef = useRef(null);
    const hoverRafRef = useRef(0);
    const pendingHoverIndexRef = useRef(null);
    const lastHoverIndexRef = useRef(null);
    const smoothMinRef = useRef(null);
    const smoothMaxRef = useRef(null);

    const hasData = Array.isArray(dataHistory) && dataHistory.length >= 2;

    useEffect(() => {
        // Avoid leaving a pending rAF behind if the chart unmounts.
        return () => {
            if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
        };
    }, []);

    useEffect(() => {
        // Reset autoscale smoothing when mode/data changes significantly.
        smoothMinRef.current = null;
        smoothMaxRef.current = null;
    }, [scaleMode, hasData]);

    // Derived chart data should not recompute on every hover event.
    const { seriesRanges, pointsBySeries } = useMemo(() => {
        if (!hasData) {
            return { seriesRanges: seriesConfig.map(() => null), pointsBySeries: [] };
        }

        const computePerSeriesRanges = () =>
            seriesConfig.map((conf, idx) => {
                if (!conf.visible) return null;

                let min = Infinity;
                let max = -Infinity;

                for (const point of dataHistory) {
                    const v = point?.values?.[idx];
                    if (!isValidNumber(v)) continue;
                    if (v < min) min = v;
                    if (v > max) max = v;
                }

                if (min === Infinity) return null;

                const rawRange = max - min;
                const range = rawRange === 0 ? 1 : rawRange;

                return { min, max, range };
            });

        // Arduino-like global scaling: one Y axis for all visible series, with "fast expand, slow shrink".
        const computeGlobalRange = () => {
            let min = Infinity;
            let max = -Infinity;

            for (const point of dataHistory) {
                const vals = point?.values;
                if (!Array.isArray(vals)) continue;
                for (let idx = 0; idx < seriesConfig.length; idx++) {
                    if (!seriesConfig[idx]?.visible) continue;
                    const v = vals[idx];
                    if (!isValidNumber(v)) continue;
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
            }

            if (min === Infinity) return null;

            // Add some headroom so peaks don't instantly "compress" everything.
            const rawRange = max - min;
            const margin = rawRange === 0 ? 1 : rawRange * 0.05;
            const targetMin = min - margin;
            const targetMax = max + margin;

            let sMin = smoothMinRef.current ?? targetMin;
            let sMax = smoothMaxRef.current ?? targetMax;

            const alphaShrink = 0.05; // slower return
            if (targetMin < sMin) sMin = targetMin; else sMin = sMin + (targetMin - sMin) * alphaShrink;
            if (targetMax > sMax) sMax = targetMax; else sMax = sMax + (targetMax - sMax) * alphaShrink;

            // Prevent collapse.
            if (sMax - sMin < 1e-9) sMax = sMin + 1;

            smoothMinRef.current = sMin;
            smoothMaxRef.current = sMax;

            return { min: sMin, max: sMax, range: sMax - sMin };
        };

        const globalRange = scaleMode === 'arduino' ? computeGlobalRange() : null;
        const ranges = scaleMode === 'arduino' ? seriesConfig.map(() => globalRange) : computePerSeriesRanges();

        // Precompute points strings per series (forward-fill missing samples to avoid drop-to-min spikes).
        const points = seriesConfig.map((conf, idx) => {
            const r = ranges[idx];
            if (!conf.visible || !r) return '';

            let last = r.min;
            const out = new Array(dataHistory.length);

            for (let i = 0; i < dataHistory.length; i++) {
                const v = dataHistory[i]?.values?.[idx];
                if (isValidNumber(v)) last = v;

                const x = (i / (dataHistory.length - 1)) * 100;
                const y = 100 - ((last - r.min) / r.range) * 100;
                out[i] = `${x},${y}`;
            }

            return out.join(' ');
        });

        return { seriesRanges: ranges, pointsBySeries: points };
    }, [hasData, dataHistory, seriesConfig, scaleMode]);

    // Interaction Handlers - NOW BOUND TO THE INNER CHART AREA
    const handleMouseMove = useCallback((e) => {
        if (!chartAreaRef.current) return;
        const rect = chartAreaRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        if (width <= 0) return;
        
        // Map pixel x to data index (0 to length-1)
        const nextIdx = Math.min(
            Math.max(0, Math.round((x / width) * (dataHistory.length - 1))),
            dataHistory.length - 1
        );

        // Throttle to rAF to avoid re-rendering the whole chart on every mousemove.
        pendingHoverIndexRef.current = nextIdx;
        if (hoverRafRef.current) return;
        hoverRafRef.current = requestAnimationFrame(() => {
            hoverRafRef.current = 0;
            const idx = pendingHoverIndexRef.current;
            if (idx === null || idx === undefined) return;
            if (idx === lastHoverIndexRef.current) return;
            lastHoverIndexRef.current = idx;
            setHoverIndex(idx);
        });
    }, [dataHistory.length]);

    const handleMouseLeave = () => {
        pendingHoverIndexRef.current = null;
        lastHoverIndexRef.current = null;
        setHoverIndex(null);
    };

    // Calculate hover data
    const hoverData = hoverIndex !== null ? dataHistory[hoverIndex] : null;
    const hoverXPct = hoverIndex !== null ? (hoverIndex / (dataHistory.length - 1)) * 100 : 0;

    // Safety check for dataHistory (after hooks)
    if (!hasData) {
        return (
            <div className="flex flex-col items-center justify-center h-full opacity-30 select-none relative z-10">
                <Activity size={32} strokeWidth={1} />
                <span className="mt-2 text-[10px] uppercase tracking-widest font-bold">No Signal</span>
                <span className="text-[9px] text-center max-w-[200px] mt-1">
                    Configure keywords or send numbers like "25.5, 60"
                </span>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full select-none bg-black/5 dark:bg-black/20 rounded-lg">
            {/* 1. Axis Labels */}
            {scaleMode === 'arduino' ? (
                <div className="absolute inset-y-2 left-1 w-10 flex flex-col justify-between text-[8px] opacity-70 font-mono pointer-events-none z-10 text-right pr-1 text-zinc-700 dark:text-zinc-300">
                    {(() => {
                        const r = seriesRanges.find(Boolean);
                        if (!r) return null;
                        const { min, max, range } = r;
                        return (
                            <>
                                <span className="font-bold">{max.toFixed(1)}</span>
                                <span className="opacity-70">{(min + range * 0.75).toFixed(1)}</span>
                                <span className="opacity-70">{(min + range * 0.5).toFixed(1)}</span>
                                <span className="opacity-70">{(min + range * 0.25).toFixed(1)}</span>
                                <span className="font-bold">{min.toFixed(1)}</span>
                            </>
                        );
                    })()}
                </div>
            ) : (
                <div className="absolute inset-y-2 left-1 w-10 flex flex-col justify-between text-[8px] opacity-80 font-mono pointer-events-none z-10 text-right pr-1">
                    {seriesConfig.map((conf, idx) => {
                        if (!conf.visible || !seriesRanges[idx]) return null;
                        const { min, max } = seriesRanges[idx];
                        return (
                            <div key={idx} className="flex flex-col gap-0.5" style={{ color: SERIES_COLORS[idx % 4] }}>
                                <span className="font-bold">{max.toFixed(1)}</span>
                                <span className="opacity-60">{min.toFixed(1)}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 2. Inner Chart Area Wrapper (Adjusted left margin for multi-axis) */}
            <div
                ref={chartAreaRef}
                className="absolute left-12 right-4 top-2 bottom-2 z-20 cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* Grid Lines (Background) */}
                <div className="absolute inset-0 border-l border-b border-black/10 dark:border-white/10 pointer-events-none"></div>

                {/* SVG Layer - ID for Snapshot */}
                <svg id="waveform-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible pointer-events-none">
                    {seriesConfig.map((conf, idx) => (
                        conf.visible && seriesRanges[idx] && (
                            <polyline
                                key={idx}
                                points={pointsBySeries[idx]}
                                fill="none"
                                stroke={SERIES_COLORS[idx % 4]}
                                strokeWidth="1.5"
                                vectorEffect="non-scaling-stroke"
                                className="opacity-95"
                            />
                        )
                    ))}
                </svg>

                {/* Interaction Overlay Layer (Dots & Line) */}
                {hoverIndex !== null && hoverData && (
                    <div className="absolute inset-0 pointer-events-none">
                        {/* Vertical Cursor Line */}
                        <div
                            className="absolute top-0 bottom-0 border-l border-white/40 shadow-[0_0_4px_rgba(255,255,255,0.3)]"
                            style={{ left: `${hoverXPct}%` }}
                        />

                        {/* Data Points Dots */}
                        {seriesConfig.map((conf, idx) => {
                            if (!conf.visible || !seriesRanges[idx]) return null;
                            const val = hoverData.values[idx];
                            if (val === undefined || val === null || isNaN(val)) return null;

                            // Y position using per-series range
                            const { min, range } = seriesRanges[idx];
                            const y = 100 - ((val - min) / range) * 100;

                            return (
                                <div
                                    key={idx}
                                    className="absolute size-2.5 rounded-full border-[1.5px] border-white shadow-md z-30 transition-transform duration-75"
                                    style={{
                                        left: `${hoverXPct}%`,
                                        top: `${y}%`,
                                        backgroundColor: SERIES_COLORS[idx % 4],
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 3. Floating Tooltip (Global relative to chart container) */}
            {hoverIndex !== null && hoverData && (
                <div 
                    className="absolute bg-zinc-900/95 backdrop-blur border border-white/10 rounded-lg p-2.5 shadow-2xl text-[10px] font-mono whitespace-nowrap z-50 pointer-events-none"
                    style={{ 
                        left: hoverXPct < 50 ? `calc(${hoverXPct}% + 40px)` : 'auto', // Offset from cursor
                        right: hoverXPct >= 50 ? `calc(${100 - hoverXPct}% + 4px)` : 'auto', // Offset from right
                        top: '10px',
                    }}
                >
                    <div className="text-zinc-400 mb-1.5 border-b border-white/10 pb-1 flex justify-between gap-4">
                        <span>IDX: {hoverIndex}</span>
                        <span>{new Date(hoverData.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {seriesConfig.map((conf, idx) => {
                            if (!conf.visible) return null;
                            const val = hoverData.values[idx];
                            return (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 w-16">
                                        <div className="size-1.5 rounded-full" style={{ backgroundColor: SERIES_COLORS[idx % 4] }}></div>
                                        <span className="text-zinc-300 truncate">{conf.name || `S${idx+1}`}</span>
                                    </div>
                                    <span className="font-bold text-white ml-auto font-mono text-xs">
                                        {val !== undefined && val !== null ? val.toFixed(2) : '--'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* 4. Legend (Always Visible for Snapshot) */}
            {hoverIndex === null && (
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none z-20 transition-opacity duration-200">
                    {seriesConfig.map((conf, idx) => {
                        if (!conf.visible) return null;
                        const lastPoint = dataHistory[dataHistory.length - 1];
                        const lastVal = (lastPoint && lastPoint.values) ? lastPoint.values[idx] : null;
                        
                        return (
                            <div key={idx} className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono shadow-sm border border-white/10">
                                <span className="opacity-80 text-[9px] uppercase tracking-wide text-white">{conf.name || `Series ${idx+1}`}</span>
                                <span className="font-bold" style={{ color: SERIES_COLORS[idx % 4] }}>
                                    {lastVal !== undefined && lastVal !== null ? lastVal.toFixed(2) : '--'}
                                </span>
                                <div className="size-1.5 rounded-full" style={{ backgroundColor: SERIES_COLORS[idx % 4] }}></div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default function App() {
  const usePersistedState = (key, defaultValue) => {
    const [state, setState] = useState(() => {
      try {
          const item = localStorage.getItem(key + '_v4');
          return item ? JSON.parse(item) : defaultValue;
      } catch { return defaultValue; }
    });
    useEffect(() => {
      try {
        localStorage.setItem(key + '_v4', JSON.stringify(state));
      } catch (e) {
        console.error('localStorage write failed:', e);
      }
    }, [key, state]);
    return [state, setState];
  };

  const [port, setPort] = useState(null);
  const portRef = useRef(null);
  const [availablePorts, setAvailablePorts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSerialAllowed, setIsSerialAllowed] = useState(true);
  const readerRef = useRef(null);
  const readableStreamClosedRef = useRef(null);
  const closingRef = useRef(false);
  const baudRef = useRef(null);
  // Incomplete tail of the incoming RX stream (used for line framing).
  const rxBufferRef = useRef('');
  const pendingRxLinesRef = useRef([]);
  const pausedBufferRef = useRef(''); // Buffer for data received while paused
  const rxTimeoutRef = useRef(null);
  const logContainerRef = useRef(null);

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isBaudDropdownOpen, setIsBaudDropdownOpen] = useState(false);
  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
  const [isSnapshotGalleryOpen, setIsSnapshotGalleryOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPdfLibraryLoaded, setIsPdfLibraryLoaded] = useState(false); // Track PDF lib

  const [isPlotterOpen, setIsPlotterOpen] = useState(false);
  const [isPlotterFullscreen, setIsPlotterFullscreen] = useState(false);
  const [isPlotterSettingsOpen, setIsPlotterSettingsOpen] = useState(false);
  
  const [plotData, setPlotData] = useState([]);
  const [snapshots, setSnapshots] = useState([]);

  const [seriesConfig, setSeriesConfig] = useState([
      { id: 0, name: 'Current', keyword: '', visible: true },
      { id: 1, name: 'Voltage', keyword: '', visible: true },
      { id: 2, name: 'Power', keyword: '', visible: false },
      { id: 3, name: 'Temp', keyword: '', visible: false },
  ]);

  // Plot scaling mode: Arduino-like global Y axis or per-series independent scaling.
  const [plotScaleMode, setPlotScaleMode] = usePersistedState('sf_plot_scale', 'arduino');

  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCmdStr, setEditCmdStr] = useState('');

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveMacroName, setSaveMacroName] = useState('');

  const [logs, setLogs] = useState([]);
  const [inputText, setInputText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState('ascii');
  const [logFilter, setLogFilter] = useState('');
  const [lastActivity, setLastActivity] = useState({ type: null, time: 0 });
  const [copyFeedback, setCopyFeedback] = useState(null);
  
  const [sendHistory, setSendHistory] = usePersistedState('sf_history', []);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [baudRate, setBaudRate] = usePersistedState('sf_baud', 115200);
  const [encoding, setEncoding] = usePersistedState('sf_enc', 'utf-8');
  const [highlightKeyword, setHighlightKeyword] = usePersistedState('sf_hl_kw', '');
  const [highlightColor, setHighlightColor] = usePersistedState('sf_hl_col', 'bg-[#f4d03f] text-black border-[#f4d03f]'); 
  const [quickCommands, setQuickCommands] = usePersistedState('sf_cmds', [
    { id: 1, label: 'STATUS', cmd: 'AT+STATUS?' },
    { id: 2, label: 'RESET', cmd: 'AT+RST' },
    { id: 3, label: 'VERSION', cmd: 'AT+GMR' },
    { id: 4, label: 'WIFI', cmd: 'AT+CWMODE=1' },
  ]);
  const [useHexSend, setUseHexSend] = usePersistedState('sf_hex_send', false);
  const [lineEnding, setLineEnding] = usePersistedState('sf_eol', '\\n');
  const [appendCRC, setAppendCRC] = usePersistedState('sf_crc', false);
  const [showTimestamp, setShowTimestamp] = usePersistedState('sf_show_ts', true);
  const [theme, setTheme] = usePersistedState('sf_theme', 'light');
  const isDark = theme === 'dark';

  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerInterval, setTimerInterval] = usePersistedState('sf_timer_ms', 1000);
  const timerRef = useRef(null);
  const inputTextRef = useRef('');

  const isWebSerialSupported = 'serial' in navigator;

  // Load jsPDF dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => setIsPdfLibraryLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => { portRef.current = port; }, [port]);
  useEffect(() => { inputTextRef.current = inputText; }, [inputText]);

  // -- Refs for Stale Closure Fixes (Pause & AddLog) --
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // Create a ref for addLog to ensure the loop calls the latest version (with current props)
  const addLogRef = useRef(null);
  
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
    if (rxTimeoutRef.current) { clearTimeout(rxTimeoutRef.current); rxTimeoutRef.current = null; }
    try {
      if (readerRef.current) await readerRef.current.cancel();
      const closed = readableStreamClosedRef.current;
      readableStreamClosedRef.current = null;
      if (closed) await closed.catch(() => {});
      const currentPort = portRef.current;
      if (currentPort) await currentPort.close();
    } catch (e) { console.error(e); }
    setPort(null);
    portRef.current = null;
    setIsConnected(false);
    rxBufferRef.current = '';
    pendingRxLinesRef.current = [];
    pausedBufferRef.current = '';
    closingRef.current = false;
    updatePorts();
  }, [updatePorts]);

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

  const getTimestamp = useCallback(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}.${String(now.getMilliseconds()).padStart(3,'0')}`;
  }, []);

  const parseDataForChart = useCallback((text) => {
      let extractedValues = [];
      let foundKeyword = false;
      seriesConfig.forEach((conf, idx) => {
          if (!conf.visible) { extractedValues[idx] = null; return; }
          if (conf.keyword && conf.keyword.trim() !== '') {
              const escapedKey = conf.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`${escapedKey}\\s*[:=-]?\\s*(-?\\d+(\\.\\d+)?)`, 'i');
              const match = text.match(regex);
              if (match) { extractedValues[idx] = parseFloat(match[1]); foundKeyword = true; } 
              else { extractedValues[idx] = null; }
          }
      });
      const hasAnyKeywords = seriesConfig.some(s => s.keyword && s.keyword.trim() !== '');
      if (!hasAnyKeywords && !foundKeyword) {
          const allNumbers = text.match(/-?\d+(\.\d+)?/g);
          if (allNumbers) {
              const nums = allNumbers.map(Number);
              seriesConfig.forEach((conf, idx) => {
                  if (idx < nums.length) {
                      if (conf.visible) extractedValues[idx] = nums[idx];
                      else extractedValues[idx] = null;
                  } else extractedValues[idx] = null;
              });
              return extractedValues;
          }
      }
      if (extractedValues.every(v => v === null)) return [];
      return extractedValues;
  }, [seriesConfig]);

  const addLog = useCallback((newLog) => {
    if (newLog.type === 'rx') {
        const vals = parseDataForChart(newLog.text);
        if (vals && vals.length > 0) {
            setPlotData(prev => [...prev, { values: vals, timestamp: Date.now() }].slice(-150));
        }
    }
    setLogs(prev => [...prev, { ...newLog, _ts: Date.now() }]);
  }, [parseDataForChart]);

  // Update refs whenever addLog changes
  useEffect(() => {
      addLogRef.current = addLog;
  }, [addLog]);

  // Batch append framed RX lines: reduces React state churn under high baud/data rate.
  const appendRxLines = useCallback((lines) => {
      const safeLines = Array.isArray(lines) ? lines : [];
      const filtered = safeLines.map(l => (typeof l === 'string' ? l.trim() : '')).filter(Boolean);
      if (filtered.length === 0) return;

      // 1) Logs (single state update)
      setLogs(prev => [
          ...prev,
          ...filtered.map(text => ({ id: Math.random(), timestamp: getTimestamp(), text, type: 'rx', _ts: Date.now() }))
      ]);

      // 2) Plot data (single state update)
      setPlotData(prev => {
          const next = [...prev];
          for (const text of filtered) {
              const vals = parseDataForChart(text);
              if (vals && vals.length > 0) next.push({ values: vals, timestamp: Date.now() });
          }
          return next.slice(-150);
      });
  }, [getTimestamp, parseDataForChart]);

  const appendRxLinesRef = useRef(null);
  useEffect(() => { appendRxLinesRef.current = appendRxLines; }, [appendRxLines]);

  const scheduleFlushRxLines = useCallback(() => {
      if (rxTimeoutRef.current) return;
      rxTimeoutRef.current = setTimeout(() => {
          rxTimeoutRef.current = null;
          const lines = pendingRxLinesRef.current;
          pendingRxLinesRef.current = [];
          if (lines.length && appendRxLinesRef.current) appendRxLinesRef.current(lines);
      }, 16); // ~60fps batching
  }, []);

  const enqueueRxText = useCallback((text) => {
      if (!text) return;
      rxBufferRef.current += text;

      // Frame: one line = one sample (Arduino Serial Plotter style).
      const parts = rxBufferRef.current.split(/\r?\n/);
      rxBufferRef.current = parts.pop() ?? '';

      if (parts.length) {
          // Keep raw content (minus linebreak), ignore empty lines.
          for (const line of parts) {
              if (line && line.trim()) pendingRxLinesRef.current.push(line);
          }
          scheduleFlushRxLines();
      }
  }, [scheduleFlushRxLines]);

  // --- Flush buffer when unpaused ---
  useEffect(() => {
      if (!isPaused && pausedBufferRef.current) {
          // Add accumulated data back into the framing buffer and process as normal.
          enqueueRxText(pausedBufferRef.current);
          pausedBufferRef.current = '';
          
          scheduleFlushRxLines();
      }
  }, [isPaused, enqueueRxText, scheduleFlushRxLines]);

  const simulateRxData = () => {
      let fakeText = "";
      const hasKeywords = seriesConfig.some(s => s.keyword);
      if (hasKeywords) {
          fakeText = seriesConfig.filter(s => s.visible && s.keyword).map(s => `${s.keyword} ${(Math.random() * 100).toFixed(1)}`).join(', ');
      } else {
          fakeText = Array(4).fill(0).map(() => (Math.random() * 100).toFixed(1)).join(', ');
      }
      if(!fakeText) fakeText = "No series visible or config";
      addLog({ id: Math.random(), timestamp: getTimestamp(), text: fakeText, type: 'rx' });
  };

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
      setLastActivity({ type: 'tx', time: Date.now() });
      addLog({ id: Math.random(), timestamp: getTimestamp(), text: display, type: 'tx' });
    } catch (e) { console.error(e); } finally { writer.releaseLock(); }
  }, [appendCRC, getTimestamp, lineEnding, port, useHexSend, addLog]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timerEnabled && isConnected) {
      timerRef.current = setInterval(() => { if (inputTextRef.current) sendDataDirect(inputTextRef.current); }, timerInterval);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerEnabled, isConnected, timerInterval, sendDataDirect]);

  // --- Read Loop with Caching Logic ---
  const readLoop = async (selectedPort) => {
    const textDecoder = new TextDecoderStream(encoding);
    const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
    readableStreamClosedRef.current = readableStreamClosed;
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          // If paused, accumulate in pausedBufferRef
          if (isPausedRef.current) {
              pausedBufferRef.current += value;
          } else {
              // Not paused: frame by lines (Arduino Serial Plotter style) and batch-flush.
              enqueueRxText(value);
          }
        }
      }
    } catch (error) {
      // Cancel/close is expected during disconnect; avoid noisy logs.
      if (!closingRef.current) console.error("Read Error: ", error);
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
    } catch (error) { alert(`Connection failed: ${error.message}`); }
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
      setLastActivity({ type: 'tx', time: Date.now() });
      addLog({ id: Math.random(), timestamp: getTimestamp(), text: display, type: 'tx' });
      if (textOverride === null) {
        setSendHistory(prev => { const filtered = prev.filter(h => h !== text); return [text, ...filtered].slice(0, 50); });
        setHistoryIndex(-1); setInputText('');
      }
    } catch (e) { alert(`Send failed: ${e.message}`); } finally { writer.releaseLock(); }
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
      if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){ source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"'); }
      if(!source.match(/^<svg[^>]+xmlns:xlink/)){ source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'); }
      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

      const url = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(source);

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

          // 1. Fill Background
          ctx.fillStyle = isDark ? "#1E1F20" : "#FFFFFF";
          ctx.fillRect(0, 0, width, height);

          // 2. Calculate ranges (match on-screen scaling mode)
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

          // 3. Draw Grid
          ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
          ctx.lineWidth = 1;
          const cols = 10; const rows = 6;
          const drawW = bbox.width * scale;
          const drawH = bbox.height * scale;
          const startX = padding;
          const startY = padding;

          for(let i=0; i<=cols; i++) { ctx.beginPath(); ctx.moveTo(startX + (drawW/cols)*i, startY); ctx.lineTo(startX + (drawW/cols)*i, startY + drawH); ctx.stroke(); }
          for(let i=0; i<=rows; i++) { ctx.beginPath(); ctx.moveTo(startX, startY + (drawH/rows)*i); ctx.lineTo(startX + drawW, startY + (drawH/rows)*i); ctx.stroke(); }

          // 4. Draw Chart Image
          ctx.drawImage(img, startX, startY, drawW, drawH);

          // 5. Draw Data Values (Smart Sampling) - using per-series scaling
          const labelStep = Math.max(1, Math.floor(plotData.length / 25));

          plotData.forEach((p, i) => {
              if (i % labelStep !== 0 && i !== plotData.length - 1) return; // Always draw last point

              seriesConfig.forEach((conf, sIdx) => {
                  if (!conf.visible || !seriesRanges[sIdx]) return;
                  const val = p.values[sIdx];
                  if (val === undefined || val === null || isNaN(val)) return;

                  const x = startX + (i / (plotData.length - 1)) * drawW;
                  const { min, range } = seriesRanges[sIdx];
                  const y = startY + drawH - ((val - min) / range) * drawH;

                  // Draw Point
                  ctx.fillStyle = SERIES_COLORS[sIdx % 4];
                  ctx.beginPath();
                  ctx.arc(x, y, 3, 0, Math.PI * 2);
                  ctx.fill();

                  // Draw Label
                  ctx.fillStyle = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
                  ctx.font = "bold 10px monospace";
                  const text = val.toFixed(1);
                  const textWidth = ctx.measureText(text).width;

                  // Smart position
                  let tx = x - textWidth / 2;
                  let ty = y - 8;

                  if (ty < startY + 10) ty = y + 15;

                  ctx.fillText(text, tx, ty);
              });
          });

          // 6. Draw Legend
          const lastPoint = plotData[plotData.length - 1];
          if(lastPoint) {
              let legendY = padding + 10;
              ctx.font = "bold 14px monospace";
              ctx.textAlign = "right";
              seriesConfig.forEach((conf, idx) => {
                 if(conf.visible) {
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

  // --- HTML Report Export (Enhanced Formatting) ---
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
                .card-header { background: #f1f5f9; px-6 py-3; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .card-header h3 { margin: 0; font-size: 14px; color: #0f172a; font-weight: 600; }
                .card-header .ts { font-family: monospace; font-size: 12px; color: #64748b; }
                .card-body { padding: 20px; }
                /* Image adjustment: max-width 100%, centered */
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
                            <h3>Snapshot #${i+1}</h3>
                            <span class="ts">${s.meta.timestamp}</span>
                        </div>
                        <div class="card-body">
                            <div class="img-wrapper">
                                <img src="${s.url}" />
                            </div>
                            <div class="data-grid">
                                ${s.meta.values.map((v, idx) => seriesConfig[idx]?.visible ? `
                                    <div class="data-item">
                                        <span class="data-label" style="color:${SERIES_COLORS[idx%4]}">● ${seriesConfig[idx].name}</span>
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

  // --- JS PDF Export Logic (Enhanced) ---
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

    // Title Section
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
        // Calculate dimensions to check for page breaks
        const imgProps = doc.getImageProperties(s.url);
        // Constrain image width to 80% of content width to keep it tidy
        const imgDisplayWidth = contentWidth * 0.8; 
        const imgDisplayHeight = (imgProps.height * imgDisplayWidth) / imgProps.width;
        
        const metaHeight = 15; 
        const dataHeight = (Math.ceil(s.meta.values.length / 2) * 6) + 15; // Approx height for data grid
        const totalBlockHeight = metaHeight + imgDisplayHeight + dataHeight + 15; // + padding

        // Page break check
        if (y + totalBlockHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }

        // --- Block Header (Grey Bar) ---
        doc.setFillColor(248, 250, 252); // Very light grey
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

        // --- Image (Centered) ---
        const xOffset = margin + (contentWidth - imgDisplayWidth) / 2;
        doc.addImage(s.url, 'PNG', xOffset, y, imgDisplayWidth, imgDisplayHeight);
        doc.setDrawColor(226, 232, 240);
        doc.rect(xOffset, y, imgDisplayWidth, imgDisplayHeight); // Border around image
        y += imgDisplayHeight + 5;

        // --- Data Values (Two-Column Grid) ---
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
                 const nameStr = conf.name || `Series ${idx+1}`;
                 
                 doc.setTextColor(100, 116, 139); // Label color
                 doc.text(`${nameStr}:`, xPos, y);
                 doc.setTextColor(15, 23, 42); // Value color
                 doc.text(`${valStr}`, xPos + 35, y);
                 
                 // Simple separator line
                 doc.setDrawColor(241, 245, 249);
                 doc.line(xPos, y + 2, xPos + colWidth - 10, y + 2);

                 if (col === 1) {
                     col = 0;
                     y += 6;
                 } else {
                     col = 1;
                 }
            }
        });
        if (col === 1) y += 6; // Finish last row if odd number

        // Spacer between blocks
        y += 10;
    });

    doc.save(`Portax_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const handleViewReport = () => {
     if(snapshots.length === 0) return;
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
    a.download = `Portax_Logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const moveToTop = (index) => { if (index === 0) return; const newCmds = [...quickCommands]; const item = newCmds.splice(index, 1)[0]; newCmds.unshift(item); setQuickCommands(newCmds); };
  const startEditing = (cmd) => { setEditingId(cmd.id); setEditLabel(cmd.label); setEditCmdStr(cmd.cmd); };
  const saveEdit = () => { if(!editLabel.trim() || !editCmdStr.trim()) return; setQuickCommands(prev => prev.map(c => c.id === editingId ? { ...c, label: editLabel, cmd: editCmdStr } : c)); setEditingId(null); };
  const deleteMacro = (id) => { setQuickCommands(prev => prev.filter(c => c.id !== id)); };
  const cycleLineEnding = () => { if (lineEnding === '\\n') setLineEnding('\\r\\n'); else if (lineEnding === '\\r\\n') setLineEnding(''); else setLineEnding('\\n'); };
  const getLineEndingLabel = () => lineEnding === '\\n' ? '\\n' : lineEnding === '\\r\\n' ? '\\r\\n' : 'NONE';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendData(); }
    else if (e.key === 'ArrowUp') { if (sendHistory.length > 0 && !e.shiftKey) { e.preventDefault(); const next = Math.min(historyIndex + 1, sendHistory.length - 1); setHistoryIndex(next); setInputText(sendHistory[next]); } }
    else if (e.key === 'ArrowDown') { if (historyIndex >= 0) { e.preventDefault(); const next = historyIndex - 1; setHistoryIndex(next); if (next === -1) setInputText(''); else setInputText(sendHistory[next]); } }
  };

  const renderContent = (text) => {
    const safeText = String(text || '');
    if (viewMode === 'hex' || !highlightKeyword) return safeText;
    const parts = safeText.split(new RegExp(`(${String(highlightKeyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) => part.toLowerCase() === highlightKeyword.toLowerCase() ? <span key={i} className={`rounded-sm px-0.5 ${highlightColor}`}>{part}</span> : part);
  };

  useEffect(() => {
    if (autoScroll && logContainerRef.current && !logFilter) { const container = logContainerRef.current; requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; }); }
  }, [logs, autoScroll, logFilter]);

  const HIGHLIGHT_PRESETS = [ 'bg-[#ecf0f1] text-black border-[#ecf0f1]', 'bg-[#e74c3c] text-white border-[#e74c3c]', 'bg-[#1abc9c] text-white border-[#1abc9c]', 'bg-[#f4d03f] text-black border-[#f4d03f]', 'bg-[#3b82f6] text-white border-[#3b82f6]' ];
  const COMMON_BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
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
                            <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${t.textTertiary}`}>View</div>
                            <button onClick={() => { setIsPlotterOpen(false); setIsMainMenuOpen(false); }} className={`px-4 py-2 text-left text-xs hover:${t.hoverBg} flex items-center gap-2 ${!isPlotterOpen ? 'text-emerald-500' : t.textPrimary}`}><Terminal size={14} /> Terminal</button>
                            <button onClick={() => { setIsPlotterOpen(true); setIsMainMenuOpen(false); }} className={`px-4 py-2 text-left text-xs hover:${t.hoverBg} flex items-center gap-2 ${isPlotterOpen ? 'text-emerald-500' : t.textPrimary}`}><LineChart size={14} /> Monitor</button>
                            <div className={`h-px ${t.border} my-1`}></div>
                            <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${t.textTertiary}`}>Tools</div>
                            <button onClick={() => { simulateRxData(); setIsMainMenuOpen(false); }} className={`px-4 py-2 text-left text-xs hover:${t.hoverBg} flex items-center gap-2 ${t.textPrimary}`}><Zap size={14} /> Simulate RX</button>
                            <button onClick={() => { handleExportLogs(); setIsMainMenuOpen(false); }} className={`px-4 py-2 text-left text-xs hover:${t.hoverBg} flex items-center gap-2 ${t.textPrimary}`}><Download size={14} /> Export CSV</button>
                        </div>
                    )}
                </div>
                <span className={`text-sm font-semibold tracking-tight ${t.textPrimary}`}>Port<span className="opacity-50 font-normal">ax</span></span>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setIsSnapshotGalleryOpen(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${t.border} ${t.hoverBg} ${t.textSecondary} text-[10px] transition-colors`}><ImageIcon size={12}/> Gallery ({snapshots.length})</button>
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
                    <span className={`text-xs font-bold uppercase tracking-wider ${isConnected ? 'text-emerald-500' : t.textTertiary}`}>{isConnected ? 'Connected' : 'Offline'}</span>
                </div>
                <div className={`h-5 w-px ${isDark ? 'bg-white/10' : 'bg-black/10'}`}></div>
                <div className="flex-1 flex items-center gap-3">
                    <Filter size={14} className={t.textTertiary} />
                    <input value={logFilter} onChange={e => setLogFilter(e.target.value)} placeholder="Search logs..." className={`bg-transparent border-none outline-none text-xs font-medium w-full ${t.textPrimary} placeholder:${t.textTertiary}`} />
                </div>
                <div className={`flex border ${t.border} rounded-full p-1 ${t.inputBg}`}>
                    <button onClick={()=>setViewMode('ascii')} className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all ${viewMode==='ascii' ? `${t.accentFill} ${t.accentText} shadow-sm` : `${t.textSecondary} hover:${t.textPrimary}`}`}>TXT</button>
                    <button onClick={()=>setViewMode('hex')} className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all ${viewMode==='hex' ? `${t.accentFill} ${t.accentText} shadow-sm` : `${t.textSecondary} hover:${t.textPrimary}`}`}>HEX</button>
                </div>
                <div className="flex gap-2">
                     <button onClick={() => setIsPaused(!isPaused)} className={`size-8 flex items-center justify-center rounded-full border ${t.border} hover:${t.hoverBg} transition-colors ${isPaused ? 'text-amber-500 border-amber-500/50' : t.textSecondary}`}>{isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} />}</button>
                     <button onClick={() => setLogs([])} className={`size-8 flex items-center justify-center rounded-full border ${t.border} hover:${t.hoverBg} ${t.textSecondary} hover:text-rose-500 transition-colors`}><Trash2 size={14} /></button>
                </div>
            </div>

            {/* Split Content */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                <div ref={logContainerRef} className={`flex-1 p-6 overflow-y-auto custom-scrollbar font-mono text-[12px] leading-relaxed transition-all duration-300 ${isPlotterOpen ? 'basis-2/3' : 'basis-full'}`}>
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center select-none opacity-30">
                            <Terminal size={64} className="text-emerald-500" strokeWidth={1.5} />
                            <span className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-500/80">Ready to Receive</span>
                            {!isWebSerialSupported && <div className="mt-2 text-rose-500 text-[10px]">Browser Not Supported</div>}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2"> 
                            {logs.filter(l => !logFilter || String(l.text).toLowerCase().includes(logFilter.toLowerCase())).map((log) => (
                                <div key={log.id} onClick={() => navigator.clipboard.writeText(String(log.text))} className={`flex gap-3 px-3 py-1 items-start rounded-lg cursor-pointer hover:${t.hoverBg} group transition-colors`}>
                                    {showTimestamp && <span className={`shrink-0 text-[11px] ${t.textTertiary} select-none font-medium opacity-60 pt-[2px]`}>{log.timestamp}</span>}
                                    {/* Kept w-10 but ensured no flex shrinkage */}
                                    <span className={`shrink-0 text-[10px] font-bold w-10 text-center select-none rounded border px-0.5 pt-0.5 mt-[1px] ${log.type === 'tx' ? (isDark ? 'text-blue-400 border-blue-400/50' : 'text-blue-600 border-blue-600/30') : (isDark ? 'text-emerald-400 border-emerald-400/50' : 'text-emerald-600 border-emerald-600/30')}`}>{log.type === 'tx' ? 'TX' : 'RX'}</span>
                                    {/* Added min-w-0 to prevent text overflow issues */}
                                    <span className={`break-all whitespace-pre-wrap min-w-0 ${log.type === 'tx' ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-emerald-400' : 'text-emerald-600')} opacity-90`}>{renderContent(log.text)}</span>
                                </div>
                            ))}
                        </div>
                    )}
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
                                            <button onClick={() => {const n=[...seriesConfig];n[i].visible=!n[i].visible;setSeriesConfig(n)}}>{conf.visible ? <Eye size={12} style={{color: SERIES_COLORS[i]}}/> : <EyeOff size={12} className={t.textTertiary}/>}</button>
                                            <input value={conf.name} onChange={e=>{const n=[...seriesConfig];n[i].name=e.target.value;setSeriesConfig(n)}} className={`w-12 bg-transparent border-b ${t.border} outline-none ${t.textPrimary}`} placeholder="Name"/>
                                            <input value={conf.keyword} onChange={e=>{const n=[...seriesConfig];n[i].keyword=e.target.value;setSeriesConfig(n)}} className={`flex-1 bg-transparent border-b ${t.border} outline-none ${t.textTertiary}`} placeholder="Keyword (opt)"/>
                                        </div>
                                    ))}
                                </div>
                                <div className={`mt-3 pt-3 border-t ${t.border}`}>
                                    <div className="text-[10px] font-bold uppercase mb-2 text-zinc-500">Y Scale</div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPlotScaleMode('arduino')}
                                            className={`flex-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                                plotScaleMode === 'arduino' ? `${t.accentFill} ${t.accentText} border-transparent` : `${t.border} ${t.textTertiary} hover:${t.textSecondary}`
                                            }`}
                                        >
                                            Arduino
                                        </button>
                                        <button
                                            onClick={() => setPlotScaleMode('per-series')}
                                            className={`flex-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                                plotScaleMode === 'per-series' ? `${t.accentFill} ${t.accentText} border-transparent` : `${t.border} ${t.textTertiary} hover:${t.textSecondary}`
                                            }`}
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
                    <button onClick={()=>setAutoScroll(!autoScroll)} className={`flex items-center gap-2 hover:${t.textPrimary} transition-colors group`}>AutoScroll <div className={`size-1.5 rounded-full transition-colors ${autoScroll ? 'bg-emerald-500' : 'bg-neutral-400'}`}></div></button>
                    <button onClick={()=>setShowTimestamp(!showTimestamp)} className={`flex items-center gap-2 hover:${t.textPrimary} transition-colors group`}>Time <div className={`size-1.5 rounded-full transition-colors ${showTimestamp ? 'bg-emerald-500' : 'bg-neutral-400'}`}></div></button>
                </div>
            </div>
          </main>

          {/* Right: Sidebar */}
          <aside className={`w-[260px] border-l ${t.border} flex flex-col z-20 ${t.panelBg}`}>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                <div className="space-y-3">
                    <h3 className={`text-[11px] font-bold uppercase tracking-widest ${t.textTertiary} flex items-center gap-2 px-1`}><Plug size={12} /> Connection</h3>
                    <div className="flex flex-col gap-3">
                        <div className={`relative border ${t.border} rounded-2xl ${t.inputBg} transition-colors hover:${t.borderHover}`} ref={baudRef}>
                             <button onClick={() => !isConnected && setIsBaudDropdownOpen(!isBaudDropdownOpen)} disabled={isConnected} className={`w-full h-11 flex items-center justify-between px-4 text-xs font-mono font-medium ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}><span>{baudRate} BAUD</span><ChevronDown size={14} className={t.textTertiary} /></button>
                             {isBaudDropdownOpen && !isConnected && (<div className={`absolute top-full left-0 right-0 mt-2 z-50 border ${t.border} ${t.windowBg} shadow-2xl rounded-xl max-h-48 overflow-y-auto custom-scrollbar p-1`}>{COMMON_BAUD_RATES.map(r => (<button key={r} onClick={() => { setBaudRate(r); setIsBaudDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-mono rounded-lg hover:${t.hoverBg} transition-colors`}>{r}</button>))}</div>)}
                        </div>
                        <button onClick={isConnected ? disconnectPort : () => setIsConnectModalOpen(true)} className={`w-full h-11 rounded-2xl text-xs font-bold tracking-wide border transition-all active:scale-[0.98] ${isConnected ? `border-neutral-500/20 text-neutral-500 hover:bg-neutral-500/10` : `${t.accentFill} ${t.accentText} border-transparent shadow-md hover:opacity-90`}`}>{isConnected ? 'DISCONNECT' : 'CONNECT DEVICE'}</button>
                    </div>
                </div>
                <div className={`h-px w-full ${t.border}`}></div>
                <div className="space-y-2">
                    <h3 className={`text-[11px] font-bold uppercase tracking-widest ${t.textTertiary} px-1`}>Highlight</h3>
                    <div className="flex flex-col gap-2">
                        <input value={highlightKeyword} onChange={e => setHighlightKeyword(e.target.value)} placeholder="Keyword..." className={`w-full px-3 py-1.5 rounded-lg border ${t.border} ${t.inputBg} ${t.textPrimary} text-xs focus:border-neutral-500 outline-none placeholder:${t.textTertiary} transition-colors`}/>
                        <div className="flex gap-2">{HIGHLIGHT_PRESETS.map((c, i) => (<button key={i} onClick={() => setHighlightColor(c)} className={`h-7 flex-1 rounded-lg border text-[10px] font-bold transition-transform hover:scale-105 ${c.split(' ')[0]} ${c.split(' ')[1]} ${c.split(' ')[2]}`}></button>))}</div>
                    </div>
                </div>
                <div className={`h-px w-full ${t.border}`}></div>
                <div className="space-y-3 flex-1">
                     <div className="flex items-center justify-between px-1"><h3 className={`text-[11px] font-bold uppercase tracking-widest ${t.textTertiary} flex items-center gap-2`}><Cpu size={12} /> Fixed Cmds</h3></div>
                     <div className="space-y-3">
                        {quickCommands.slice(0, 3).map(cmd => (
                            <button key={cmd.id} onClick={() => sendData(cmd.cmd)} disabled={!isConnected} className={`w-full group flex items-center justify-between p-3.5 rounded-2xl border ${t.border} ${t.inputBg} hover:border-neutral-500/30 transition-all disabled:opacity-50 text-left shadow-sm active:scale-[0.98] overflow-hidden`}><span className={`text-[11px] font-bold ${t.textPrimary} shrink-0`}>{cmd.label}</span><span className={`text-[10px] font-mono ${t.textTertiary} group-hover:${t.textSecondary} transition-colors truncate ml-2`}>{cmd.cmd}</span></button>
                        ))}
                     </div>
                </div>
            </div>

            {/* Bottom Input Area */}
            <div className={`p-4 border-t ${t.border} bg-transparent flex flex-col gap-3 relative`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                         <button onClick={() => setTimerEnabled(!timerEnabled)} className={`size-6 flex items-center justify-center rounded-md border ${t.border} ${timerEnabled ? 'text-amber-500 border-amber-500 bg-amber-500/10' : t.textTertiary} hover:${t.textPrimary} transition-colors`}><Timer size={12} /></button>
                        <input type="number" value={timerInterval} onChange={e=>setTimerInterval(e.target.value)} className={`w-10 bg-transparent text-[10px] font-mono outline-none text-center ${t.textPrimary} border-b border-dashed border-neutral-500/30`} /><span className={`text-[9px] ${t.textTertiary}`}>ms</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setUseHexSend(!useHexSend)} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${useHexSend ? `${t.accentFill} ${t.accentText} border-transparent` : `${t.border} ${t.textTertiary} hover:${t.textSecondary}`}`}>HEX</button>
                        <button onClick={() => setAppendCRC(!appendCRC)} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${appendCRC ? `${t.accentFill} ${t.accentText} border-transparent` : `${t.border} ${t.textTertiary} hover:${t.textSecondary}`}`}>CRC</button>
                        <button onClick={cycleLineEnding} className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors ${lineEnding !== '' ? `${t.accentFill} ${t.accentText} border-transparent` : `${t.border} ${t.textTertiary} hover:${t.textSecondary}`}`}>{getLineEndingLabel()}</button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button onClick={saveToMacro} className={`flex-1 py-1.5 rounded-md border ${t.border} ${t.textTertiary} hover:${t.textPrimary} hover:${t.hoverBg} transition-colors text-[10px] font-bold flex items-center justify-center gap-1.5`} title="Save as Macro"><BookmarkPlus size={12} /> <span className="uppercase tracking-wider">Save</span></button>
                    <button onClick={() => setIsMacroModalOpen(true)} className={`flex-1 py-1.5 rounded-md border ${t.border} ${t.textTertiary} hover:${t.textPrimary} hover:${t.hoverBg} transition-colors text-[10px] font-bold flex items-center justify-center gap-1.5`} title="Manage Macros"><List size={12} /> <span className="uppercase tracking-wider">Macros</span></button>
                </div>
                <textarea value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown} className={`w-full h-20 p-3 rounded-xl border ${t.border} ${t.inputBg} ${t.textPrimary} text-xs font-mono outline-none focus:border-neutral-500 transition-all resize-none placeholder:${t.textTertiary} shadow-sm group-hover:${t.borderHover}`} placeholder="Type command..." />
                <button onClick={() => sendData()} disabled={!isConnected} className={`w-full py-2.5 rounded-xl ${t.accentFill} ${t.accentText} ${t.accentHover} text-[11px] font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2`}><Send size={14} /> SEND COMMAND</button>
            </div>
          </aside>
        </div>

        {/* --- Save Macro Modal --- */}
        {isSaveModalOpen && (
            <div className={`absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200`}>
                <div className={`w-[320px] ${t.windowBg} border ${t.border} rounded-2xl shadow-2xl overflow-hidden`}>
                    <div className={`px-5 py-3 border-b ${t.border} flex items-center justify-between ${t.panelBg}`}>
                        <h3 className={`text-xs font-bold uppercase tracking-widest ${t.textPrimary}`}>Save Macro</h3>
                        <button onClick={() => setIsSaveModalOpen(false)} className={t.textTertiary}><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className={`text-[10px] font-bold uppercase ${t.textTertiary} mb-1.5 block`}>Name</label>
                            <input value={saveMacroName} onChange={e => setSaveMacroName(e.target.value)} autoFocus className={`w-full px-3 py-2 rounded-lg border ${t.border} ${t.inputBg} ${t.textPrimary} text-xs outline-none focus:border-neutral-500`} placeholder="Enter macro name"/>
                        </div>
                        <div>
                            <label className={`text-[10px] font-bold uppercase ${t.textTertiary} mb-1.5 block`}>Command</label>
                            <code className={`block w-full px-3 py-2 rounded-lg ${t.inputBg} border ${t.border} text-[10px] ${t.textSecondary} font-mono truncate`}>{inputText}</code>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setIsSaveModalOpen(false)} className={`flex-1 py-2 rounded-lg border ${t.border} ${t.textSecondary} hover:${t.hoverBg} text-xs font-bold`}>Cancel</button>
                            <button onClick={confirmSaveMacro} className={`flex-1 py-2 rounded-lg ${t.accentFill} ${t.accentText} text-xs font-bold hover:opacity-90`}>Save</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- Macro Manager Modal --- */}
        {isMacroModalOpen && (
            <div className={`absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200`}>
                <div className={`w-[500px] h-[600px] ${t.windowBg} border ${t.border} rounded-3xl shadow-2xl flex flex-col overflow-hidden`}>
                    <div className={`px-6 py-4 border-b ${t.border} flex items-center justify-between ${t.panelBg}`}><h3 className={`text-sm font-bold uppercase tracking-widest ${t.textPrimary}`}>Macro Manager</h3><button onClick={() => setIsMacroModalOpen(false)} className={t.textTertiary}><X size={20} /></button></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
                        {quickCommands.map((cmd, index) => (
                            <div key={cmd.id} className={`flex items-center gap-3 p-3 rounded-xl border ${t.border} ${t.inputBg}`}>
                                <div className={`flex flex-col flex-1 min-w-0`}>
                                    {editingId === cmd.id ? (
                                        <div className="flex flex-col gap-2"><input value={editLabel} onChange={e => setEditLabel(e.target.value)} className={`px-2 py-1 rounded border ${t.border} ${t.inputBg} ${t.textPrimary} text-xs outline-none focus:border-neutral-500`} placeholder="Label"/><input value={editCmdStr} onChange={e => setEditCmdStr(e.target.value)} className={`px-2 py-1 rounded border ${t.border} ${t.inputBg} ${t.textPrimary} text-xs outline-none focus:border-neutral-500 font-mono`} placeholder="Command"/></div>
                                    ) : (
                                        <><div className="flex items-center gap-2 mb-1">{index < 3 && <span className={`text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold uppercase`}>Fixed</span>}<span className={`text-xs font-bold ${t.textPrimary}`}>{cmd.label}</span></div><code className={`text-[10px] ${t.textTertiary} truncate`}>{cmd.cmd}</code></>
                                    )}
                                </div>
                                {editingId === cmd.id ? (<><button onClick={saveEdit} className={`p-2 rounded-lg ${t.accentFill} ${t.accentText} hover:opacity-90`}><Check size={14}/></button><button onClick={() => setEditingId(null)} className={`p-2 rounded-lg border ${t.border} ${t.hoverBg} ${t.textSecondary}`}><X size={14}/></button></>) : (<><button onClick={() => sendData(cmd.cmd)} className={`p-2 rounded-lg ${t.accentFill} ${t.accentText} hover:opacity-90`}><Send size={14}/></button><button onClick={() => startEditing(cmd)} className={`p-2 rounded-lg border ${t.border} ${t.hoverBg} ${t.textSecondary}`}><Edit2 size={14}/></button><button onClick={() => moveToTop(index)} disabled={index === 0} className={`p-2 rounded-lg border ${t.border} ${t.hoverBg} ${t.textSecondary} disabled:opacity-30`}><ArrowUp size={14}/></button><button onClick={() => deleteMacro(cmd.id)} className={`p-2 rounded-lg border ${t.border} hover:bg-rose-400/10 text-rose-400`}><Trash size={14}/></button></>)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* --- Snapshot Gallery Modal --- */}
        {isSnapshotGalleryOpen && (
            <div className={`absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200`}>
                <div className={`w-[90vw] max-w-[1000px] h-[80vh] ${t.windowBg} border ${t.border} rounded-3xl shadow-2xl flex flex-col overflow-hidden`}>
                    {/* Fixed Header Layout */}
                    <div className={`px-8 pt-10 pb-4 border-b ${t.border} flex items-center justify-between ${t.panelBg}`}>
                        <div className="flex items-center gap-3"><h3 className={`text-sm font-bold uppercase tracking-widest ${t.textPrimary}`}>Snapshot Gallery</h3><span className={`px-2 py-0.5 rounded-full ${t.inputBg} border ${t.border} text-[10px] ${t.textSecondary}`}>{snapshots.length} items</span></div>
                        <button onClick={() => setIsSnapshotGalleryOpen(false)} className={t.textTertiary}><X size={20} /></button>
                    </div>
                    {/* Fixed Grid Layout (md:grid-cols-3) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 grid grid-cols-2 md:grid-cols-3 gap-6 content-start">
                        {snapshots.map(s => (
                            <div key={s.id} className={`group relative rounded-2xl border ${t.border} overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-black/5`}>
                                <div className="aspect-video relative overflow-hidden bg-white/5">
                                    <img src={s.url} alt="Snapshot" className="w-full h-full object-contain" />
                                </div>
                                <div className={`px-4 py-3 border-t ${t.border} ${t.panelBg} flex items-center justify-between`}>
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] font-bold ${t.textPrimary}`}>Snapshot #{s.id.toString().slice(-4)}</span>
                                        <span className={`text-[9px] ${t.textTertiary}`}>{s.timestamp}</span>
                                    </div>
                                    <div className="flex gap-2">
                                         <a href={s.url} download={`snapshot-${s.id}.png`} className={`p-2 rounded-lg border ${t.border} hover:${t.hoverBg} ${t.textPrimary}`} title="Download Image"><FileDown size={14}/></a>
                                         <button onClick={() => setSnapshots(prev => prev.filter(snap => snap.id !== s.id))} className={`p-2 rounded-lg border ${t.border} hover:bg-rose-500/10 text-rose-500`} title="Delete"><Trash size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {snapshots.length === 0 && <div className={`col-span-1 md:col-span-3 py-20 text-center ${t.textTertiary} text-sm flex flex-col items-center gap-3 opacity-50`}><Camera size={48} strokeWidth={1} /><span>Gallery is empty. Capture snapshots from the monitor view.</span></div>}
                    </div>
                    <div className={`px-8 py-4 border-t ${t.border} ${t.panelBg} flex justify-end gap-3`}>
                        <button onClick={() => setSnapshots([])} className={`px-5 py-2.5 text-xs text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors font-medium`}>Clear Gallery</button>
                        <button onClick={handleViewReport} className={`px-6 py-2.5 rounded-xl border ${t.border} ${t.textSecondary} hover:${t.textPrimary} hover:${t.hoverBg} text-xs font-bold flex items-center gap-2 transition-all`}><ExternalLink size={14}/> View HTML</button>
                        <button onClick={handleExportPdf} disabled={snapshots.length===0} className={`px-6 py-2.5 ${t.accentFill} ${t.accentText} text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all`}><FileText size={14}/> Export PDF</button>
                    </div>
                </div>
            </div>
        )}

        {isConnectModalOpen && (
            <div className={`absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200`}>
                <div className={`w-[420px] ${t.windowBg} border ${t.border} rounded-3xl shadow-2xl p-8`}>
                    <div className="flex items-center justify-between mb-8"><h3 className={`text-sm font-bold uppercase tracking-widest ${t.textPrimary}`}>Hardware Connection</h3><button onClick={() => setIsConnectModalOpen(false)} className={t.textTertiary}><X size={20} /></button></div>
                    <div className="space-y-2 mb-8 max-h-[240px] overflow-y-auto custom-scrollbar">
                        {!isWebSerialSupported ? (<div className={`text-center py-8 bg-rose-500/10 border border-rose-500/20 rounded-xl`}><div className="text-rose-500 font-bold text-xs mb-1">BROWSER NOT SUPPORTED</div></div>) : !isSerialAllowed ? (<div className={`text-center py-8 bg-amber-500/10 border border-amber-500/20 rounded-xl`}><div className="text-amber-500 font-bold text-xs mb-1">PERMISSION BLOCKED</div></div>) : availablePorts.length === 0 ? (<div className={`text-center py-10 border-2 border-dashed ${t.border} rounded-2xl opacity-60`}><div className={`text-xs ${t.textTertiary} font-bold`}>NO GRANTED DEVICES</div><div className={`text-[10px] ${t.textTertiary} mt-2`}>Click SCAN below to authorize a device</div></div>) : availablePorts.map((p, i) => (
                            <button key={i} onClick={() => openPort(p)} className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${t.border} ${t.hoverBg} text-left group transition-all`}>
                                <div className={`size-10 rounded-full flex items-center justify-center ${t.inputBg} border ${t.border} group-hover:border-neutral-500/50 transition-colors`}><Usb size={18} className={t.textPrimary}/></div>
                                <div><div className={`text-xs font-bold ${t.textPrimary}`}>PORT {i+1}</div><div className={`text-[10px] font-mono ${t.textTertiary}`}>ID: {p.getInfo().usbVendorId?.toString(16)}:{p.getInfo().usbProductId?.toString(16)}</div></div>
                            </button>
                        ))}
                    </div>
                    <button onClick={() => { navigator.serial.requestPort().then(p => { openPort(p); updatePorts(); }).catch((e)=>{console.log(e)}); }} disabled={!isWebSerialSupported || !isSerialAllowed} className={`w-full py-3.5 ${t.accentFill} ${t.accentText} ${t.accentHover} rounded-xl text-xs font-bold tracking-widest uppercase hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md`}>SCAN FOR DEVICES</button>
                </div>
            </div>
        )}

        {copyFeedback && (<div className={`absolute bottom-8 left-8 px-5 py-2.5 ${t.accentFill} ${t.accentText} text-[11px] font-bold tracking-widest uppercase rounded-full shadow-2xl z-[110] animate-in fade-in slide-in-from-bottom-2`}>{copyFeedback}</div>)}
      </div>
    </div>
  );
}
