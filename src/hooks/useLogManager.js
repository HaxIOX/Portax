import { useState, useCallback, useRef, useEffect } from 'react';
import { parseDataForChart, isValidNumber } from '../utils/dataParser';
import { getTimestamp } from '../utils/timeUtils';
import { MAX_PLOT_DATA_POINTS } from '../constants/config';

/**
 * Custom hook for managing logs, plot data, and pause/resume state.
 *
 * Consolidates log-related state that was previously spread across App.jsx:
 * - logs / setLogs
 * - plotData / setPlotData
 * - isPaused / setIsPaused  (+ isPausedRef for async read-loop)
 * - lastActivity
 * - addLog  (single-line helper used by TX, system messages, etc.)
 * - appendRxLines (batch-append used by the RX framing pipeline)
 */
export const useLogManager = ({ seriesConfig }) => {
  const [logs, setLogs] = useState([]);
  const [plotData, setPlotData] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [lastActivity, setLastActivity] = useState({ type: null, time: 0 });
  const lastPlotTsRef = useRef(0);

  // Ref kept in sync so async code (read-loop) can check pause state without stale closures.
  const isPausedRef = useRef(false);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // --- addLog: append a single log entry (TX / SYS / manual RX) ---
  const addLog = useCallback((newLog) => {
    if (newLog.type === 'rx') {
      const vals = parseDataForChart(newLog.text, seriesConfig);
      if (vals && vals.length > 0 && vals.some(isValidNumber)) {
        const now = Date.now();
        const ts = now <= lastPlotTsRef.current ? lastPlotTsRef.current + 1 : now;
        lastPlotTsRef.current = ts;
        setPlotData(prev => [...prev, { values: vals, timestamp: ts }].slice(-MAX_PLOT_DATA_POINTS));
      }
    }
    setLogs(prev => [...prev, { ...newLog, _ts: Date.now() }]);
  }, [seriesConfig]);

  // --- appendRxLines: batch-append framed RX lines (called from useRxFraming) ---
  const appendRxLines = useCallback((lines) => {
    const safe = Array.isArray(lines) ? lines : [];
    const filtered = safe.map(l => (typeof l === 'string' ? l.trim() : '')).filter(Boolean);
    if (filtered.length === 0) return;

    // Single state update for logs
    setLogs(prev => [
      ...prev,
      ...filtered.map(text => ({
        id: Math.random(),
        timestamp: getTimestamp(),
        text,
        type: 'rx',
        _ts: Date.now(),
      })),
    ]);

    // Single state update for plot data
    setPlotData(prev => {
      const next = [...prev];
      for (const text of filtered) {
        const vals = parseDataForChart(text, seriesConfig);
        if (vals && vals.length > 0 && vals.some(isValidNumber)) {
          const now = Date.now();
          const ts = now <= lastPlotTsRef.current ? lastPlotTsRef.current + 1 : now;
          lastPlotTsRef.current = ts;
          next.push({ values: vals, timestamp: ts });
        }
      }
      return next.slice(-MAX_PLOT_DATA_POINTS);
    });
  }, [seriesConfig]);

  // Stable ref so the framing pipeline always calls the latest version.
  const appendRxLinesRef = useRef(null);
  useEffect(() => { appendRxLinesRef.current = appendRxLines; }, [appendRxLines]);

  const clearLogs = useCallback(() => setLogs([]), []);
  const clearPlotData = useCallback(() => setPlotData([]), []);

  const markActivity = useCallback((type) => {
    setLastActivity({ type, time: Date.now() });
  }, []);

  return {
    // State
    logs,
    plotData,
    isPaused,
    lastActivity,

    // Setters
    setIsPaused,
    setPlotData,

    // Refs (for async consumers)
    isPausedRef,
    appendRxLinesRef,

    // Actions
    addLog,
    appendRxLines,
    clearLogs,
    clearPlotData,
    markActivity,
  };
};
