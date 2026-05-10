import React, { useRef, useEffect, useState, memo } from 'react';
import { Activity } from 'lucide-react';
import { SERIES_COLORS } from '../constants/config';
import { isValidNumber } from '../utils/dataParser';

/**
 * High-performance waveform chart using uPlot (Canvas-based)
 * Supports 10000+ data points with smooth rendering
 *
 * Note: Requires 'uplot' package to be installed
 */
const WaveformChart = ({ dataHistory, seriesConfig, scaleMode = 'per-series' }) => {
  const chartRef = useRef(null);
  const plotRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [uPlotLoaded, setUPlotLoaded] = useState(false);
  const [uPlot, setUPlot] = useState(null);

  const hasData = Array.isArray(dataHistory) && dataHistory.length >= 2;

  // Dynamically import uPlot
  useEffect(() => {
    const loadUPlot = async () => {
      try {
        const uPlotModule = await import('uplot');
        await import('uplot/dist/uPlot.min.css');
        setUPlot(() => uPlotModule.default);
        setUPlotLoaded(true);
      } catch (error) {
        console.error('Failed to load uPlot. Please install it: npm install uplot', error);
        setUPlotLoaded(false);
      }
    };
    loadUPlot();
  }, []);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };

    // Initial size
    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Create/update chart
  useEffect(() => {
    if (!uPlot || !uPlotLoaded || !chartRef.current || !hasData || dimensions.width === 0 || dimensions.height === 0) {
      return;
    }

    // Prepare data for uPlot
    // uPlot expects: [timestamps, series1, series2, ...]
    const timestamps = dataHistory.map(d => d.timestamp / 1000); // Convert to seconds

    // Only include visible series
    const visibleSeriesIndices = seriesConfig
      .map((conf, idx) => (conf.visible ? idx : -1))
      .filter(idx => idx !== -1);

    const seriesData = visibleSeriesIndices.map(idx =>
      dataHistory.map(d => {
        const val = d?.values?.[idx];
        return isValidNumber(val) ? val : null;
      })
    );

    const data = [timestamps, ...seriesData];

    // Calculate Y-axis ranges
    let yScales = {};

    if (scaleMode === 'arduino') {
      // Global range for all visible series
      let min = Infinity;
      let max = -Infinity;

      seriesData.forEach(series => {
        series.forEach(val => {
          if (isValidNumber(val)) {
            if (val < min) min = val;
            if (val > max) max = val;
          }
        });
      });

      if (min !== Infinity) {
        const range = max - min;
        const margin = range === 0 ? 1 : range * 0.05;
        yScales.y = {
          auto: false,
          range: [min - margin, max + margin]
        };
      }
    } else {
      // Per-series scaling
      yScales.y = { auto: true };
    }

    // Configure series (only visible ones)
    const series = [
      {}, // X-axis (empty config for time axis)
      ...visibleSeriesIndices.map(idx => {
        const conf = seriesConfig[idx];
        return {
          label: conf.name || `Series ${idx + 1}`,
          stroke: SERIES_COLORS[idx % 4],
          width: 2,
          spanGaps: true,
          points: { show: false },
        };
      })
    ];

    // uPlot options
    const opts = {
      width: dimensions.width,
      height: dimensions.height,
      series,
      scales: {
        x: {
          time: true,
        },
        ...yScales
      },
      axes: [
        {
          stroke: 'rgba(128, 128, 128, 0.5)',
          grid: {
            show: true,
            stroke: 'rgba(128, 128, 128, 0.1)',
            width: 1,
          },
        },
        {
          stroke: 'rgba(128, 128, 128, 0.5)',
          grid: {
            show: true,
            stroke: 'rgba(128, 128, 128, 0.1)',
            width: 1,
          },
        }
      ],
      cursor: {
        drag: {
          x: true,
          y: false,
        },
        points: {
          show: true,
          size: 8,
          width: 2,
        }
      },
      legend: {
        show: false,
      },
    };

    // Destroy existing plot
    if (plotRef.current) {
      plotRef.current.destroy();
      plotRef.current = null;
    }

    // Create new plot
    try {
      plotRef.current = new uPlot(opts, data, chartRef.current);
    } catch (error) {
      console.error('Failed to create uPlot chart:', error);
      console.log('Data:', data);
      console.log('Options:', opts);
    }

    return () => {
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [uPlot, uPlotLoaded, dataHistory, seriesConfig, scaleMode, dimensions, hasData]);

  // Loading state
  if (!uPlotLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-full opacity-30 select-none">
        <Activity size={32} strokeWidth={1} className="animate-pulse" />
        <span className="mt-2 text-[10px] uppercase tracking-widest font-bold">Loading Chart...</span>
        <span className="text-[9px] text-center max-w-[200px] mt-1 text-red-500">
          If this persists, run: npm install uplot
        </span>
      </div>
    );
  }

  // No data state
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
    <div ref={containerRef} className="relative w-full h-full select-none">
      {/* Chart container */}
      <div
        ref={chartRef}
        className="w-full h-full"
        style={{ minHeight: '100px' }}
      />

      {/* Custom legend overlay */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none z-20">
        {seriesConfig.map((conf, idx) => {
          if (!conf.visible) return null;
          const lastPoint = dataHistory[dataHistory.length - 1];
          const lastVal = lastPoint?.values?.[idx];

          return (
            <div
              key={idx}
              className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono shadow-sm border border-white/10"
            >
              <span className="opacity-80 text-[9px] uppercase tracking-wide text-white">
                {conf.name || `Series ${idx + 1}`}
              </span>
              <span className="font-bold" style={{ color: SERIES_COLORS[idx % 4] }}>
                {isValidNumber(lastVal) ? lastVal.toFixed(2) : '--'}
              </span>
              <div className="size-1.5 rounded-full" style={{ backgroundColor: SERIES_COLORS[idx % 4] }} />
            </div>
          );
        })}
      </div>

      {/* Instructions overlay */}
      <div className="absolute bottom-2 left-2 text-[9px] opacity-40 pointer-events-none font-mono">
        <div>Drag to pan • Scroll to zoom • Double-click to reset</div>
      </div>
    </div>
  );
};

export default memo(WaveformChart);
