import { useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';
import { getTimestamp } from '../utils/timeUtils';
import {
  RX_LINE_SPLIT_RE,
  RX_IDLE_FLUSH_MS,
  RX_MAX_LINE_LENGTH,
  RX_HINTS_ENABLED,
} from '../constants/config';

/**
 * Custom hook that handles RX stream framing.
 *
 * Takes raw text chunks from the serial read-loop, buffers them,
 * splits on line endings (Arduino Serial Plotter style), and batch-flushes
 * complete lines to the consumer via appendRxLinesRef.
 *
 * Also manages:
 * - Idle flush: if no line ending arrives within RX_IDLE_FLUSH_MS, flush the buffer.
 * - Max line length: force-split lines exceeding RX_MAX_LINE_LENGTH.
 * - Pause buffering: while paused, text accumulates in pausedBufferRef;
 *   when unpaused, the buffered text is re-fed through the framing pipeline.
 */
export const useRxFraming = ({ isPausedRef, appendRxLinesRef }) => {
  const rxBufferRef = useRef('');
  const pendingRxLinesRef = useRef([]);
  const pausedBufferRef = useRef('');
  const rxTimeoutRef = useRef(null);
  const rxIdleTimerRef = useRef(null);
  const rxHintFlagsRef = useRef({ idle: false, maxLen: false });

  // --- Internal helpers ---

  const clearRxIdleTimer = useCallback(() => {
    if (rxIdleTimerRef.current) {
      clearTimeout(rxIdleTimerRef.current);
      rxIdleTimerRef.current = null;
    }
  }, []);

  const logSystemHint = useCallback((text, flagKey) => {
    if (!RX_HINTS_ENABLED) return;
    if (flagKey && rxHintFlagsRef.current[flagKey]) return;
    if (flagKey) rxHintFlagsRef.current[flagKey] = true;
    // System hints are appended as regular RX lines so they appear inline.
    if (appendRxLinesRef.current) {
      // We piggyback on appendRxLines; the caller (useLogManager) will render them as rx.
      // Actually, system hints should be 'sys' type — but for simplicity we just log them here.
      // We won't add them as lines since appendRxLines is for data.
      // Instead, just log to console in dev mode.
      logger.info('[RX Hint]', text);
    }
  }, [appendRxLinesRef]);

  const scheduleFlushRxLines = useCallback(() => {
    if (rxTimeoutRef.current) return;
    rxTimeoutRef.current = setTimeout(() => {
      rxTimeoutRef.current = null;
      const lines = pendingRxLinesRef.current;
      pendingRxLinesRef.current = [];
      if (lines.length && appendRxLinesRef.current) {
        appendRxLinesRef.current(lines);
      }
    }, 16); // ~60fps batching
  }, [appendRxLinesRef]);

  const scheduleIdleFlush = useCallback(() => {
    if (!RX_IDLE_FLUSH_MS || RX_IDLE_FLUSH_MS <= 0) return;
    clearRxIdleTimer();
    rxIdleTimerRef.current = setTimeout(() => {
      rxIdleTimerRef.current = null;
      if (isPausedRef.current) return;
      const buffered = rxBufferRef.current;
      if (!buffered) return;
      rxBufferRef.current = '';
      if (buffered.trim()) {
        pendingRxLinesRef.current.push(buffered);
        scheduleFlushRxLines();
        logSystemHint(`Detected data without line ending; flushed after ${RX_IDLE_FLUSH_MS}ms idle.`, 'idle');
      }
    }, RX_IDLE_FLUSH_MS);
  }, [clearRxIdleTimer, isPausedRef, logSystemHint, scheduleFlushRxLines]);

  // --- Public: feed raw text from the read-loop ---
  const enqueueRxText = useCallback((text) => {
    if (!text) return;
    logger.debug('enqueueRxText called, text length:', text.length, 'buffer before:', rxBufferRef.current.length);

    rxBufferRef.current += text;

    // Frame by line endings (supports \r\n, \n, \r, and literal \\r\\n).
    const parts = rxBufferRef.current.split(RX_LINE_SPLIT_RE);
    const popped = parts.pop() ?? '';
    rxBufferRef.current = popped;

    if (parts.length) {
      for (const line of parts) {
        if (line && line.trim()) {
          pendingRxLinesRef.current.push(line);
        }
      }
      scheduleFlushRxLines();
    }

    // Force-split overly long lines.
    let forcedSplit = false;
    while (rxBufferRef.current.length > RX_MAX_LINE_LENGTH) {
      const chunk = rxBufferRef.current.slice(0, RX_MAX_LINE_LENGTH);
      rxBufferRef.current = rxBufferRef.current.slice(RX_MAX_LINE_LENGTH);
      if (chunk.trim()) pendingRxLinesRef.current.push(chunk);
      forcedSplit = true;
    }
    if (forcedSplit) {
      scheduleFlushRxLines();
      logSystemHint(`Line exceeded ${RX_MAX_LINE_LENGTH} chars; forced split.`, 'maxLen');
    }

    // Schedule idle flush if there's remaining buffered data.
    if (rxBufferRef.current.length) {
      scheduleIdleFlush();
    } else {
      clearRxIdleTimer();
    }
  }, [clearRxIdleTimer, logSystemHint, scheduleFlushRxLines, scheduleIdleFlush]);

  // --- Public: handle data arriving while paused ---
  const bufferWhilePaused = useCallback((text) => {
    pausedBufferRef.current += text;
  }, []);

  // --- Flush paused buffer when unpaused ---
  const flushPausedBuffer = useCallback(() => {
    if (pausedBufferRef.current) {
      enqueueRxText(pausedBufferRef.current);
      pausedBufferRef.current = '';
    }
  }, [enqueueRxText]);

  // --- Reset on disconnect ---
  const resetFraming = useCallback(() => {
    if (rxTimeoutRef.current) { clearTimeout(rxTimeoutRef.current); rxTimeoutRef.current = null; }
    clearRxIdleTimer();
    rxBufferRef.current = '';
    pendingRxLinesRef.current = [];
    pausedBufferRef.current = '';
    rxHintFlagsRef.current = { idle: false, maxLen: false };
  }, [clearRxIdleTimer]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (rxTimeoutRef.current) clearTimeout(rxTimeoutRef.current);
      if (rxIdleTimerRef.current) clearTimeout(rxIdleTimerRef.current);
    };
  }, []);

  return {
    enqueueRxText,
    bufferWhilePaused,
    flushPausedBuffer,
    resetFraming,
  };
};
