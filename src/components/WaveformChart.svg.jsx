import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Activity } from 'lucide-react';
import { SERIES_COLORS } from '../constants/config';
import { isValidNumber } from '../utils/dataParser';

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
                        left: hoverXPct < 50 ? `calc(${hoverXPct}% + 40px)` : 'auto',
                        right: hoverXPct >= 50 ? `calc(${100 - hoverXPct}% + 4px)` : 'auto',
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

export default memo(WaveformChart);
