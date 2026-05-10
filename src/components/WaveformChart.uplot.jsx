import React, { useRef, useEffect, useState, memo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { Activity } from 'lucide-react';
import { SERIES_COLORS } from '../constants/config';
import { isValidNumber } from '../utils/dataParser';

/**
 * High-performance waveform chart using uPlot (Canvas-based)
 * Supports 10000+ data points with smooth rendering
 */
const WaveformChart = ({ dataHistory, seriesConfig, scaleMode = 'per-series' }) => {
  const chartRef = useRef(null);
  const plotRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const hasData = Array.isArray(dataHistory) && dataHistory.length >= 2;

  // Handle resize
  useEffect(() => {
    if (!chartRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(chartRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Create/update chart
  useEffect(() => {
    if (!chartRef.current || !hasData || dimensions.width === 0 || dimensions.height === 0) {
      return;
    }

    // Prepare data for uPlot
    // uPlot expects: [timestamps, series1, series2, ...]
    const timestamps = dataHistory.map(d => d.timestamp / 1000); // Convert to seconds

    const seriesData = seriesConfig.map((conf, idx) =>
      dataHistory.map(d => {
        const val = d?.values?.[idx];
        return isValidNumber(val) ? val : null;
      })
    );

    const data = [timestamps, ...seriesData];

    // Calculate Y-axis ranges
    let yScales = {};

    if (scaleMode === 'arduino') {
      // Global range for all series
      let min = Infinity;
      let max = -Infinity;

      seriesConfig.forEach((conf, idx) => {
        if (!conf.visible) return;
        seriesData[idx].forEach(val => {
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

    // Configure series
    const series = [
      { label: 'Time' }, // X-axis
      ...seriesConfig.map((conf, idx) => ({
        label: conf.name || `Series ${idx + 1}`,
        stroke: SERIES_COLORS[idx % 4],
        width: 2,
        show: conf.visible,
        spanGaps: true, // Handle null values gracefully
        points: { show: false }, // Hide points for performance
      }))
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
          ticks: {
            show: true,
            stroke: 'rgba(128, 128, 128, 0.3)',
          }
        },
        {
          stroke: 'rgba(128, 128, 128, 0.5)',
          grid: {
            show: true,
            stroke: 'rgba(128, 128, 128, 0.1)',
            width: 1,
          },
          ticks: {
            show: true,
            stroke: 'rgba(128, 128, 128, 0.3)',
          }
        }
      ],
      cursor: {
        drag: {
          x: true,
          y: false,
        },
        sync: {
          key: 'portax-chart',
        },
        points: {
          show: true,
          size: 8,
          width: 2,
        }
      },
      legend: {
        show: false, // We'll use custom legend
      },
      padding: [10, 10, 0, 0],
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
      console.error('Failed to create uPlot:', error);
    }

    return () => {
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [dataHistory, seriesConfig, scaleMode, dimensions, hasData]);

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
    <div className="relative w-full h-full select-none">
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
