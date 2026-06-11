/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Eye, TrendingUp, Sparkles, Activity, Maximize2 } from 'lucide-react';
import { Candle } from '../types';
import { calculateEMA, calculateSMA } from '../utils/marketSim';

interface TradingChartProps {
  candles: Candle[];
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  currentSpotPrice: number;
}

export default function TradingChart({
  candles,
  timeframe,
  onTimeframeChange,
  currentSpotPrice,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 350 });
  
  // Toggles for visual overlays
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [showEMA, setShowEMA] = useState(true);
  const [showSMA, setShowSMA] = useState(false);
  
  // Interactive Crosshair Mouse State
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });

  // Update chart size responsive to window/sidebar changes safely
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 300),
          height: Math.max(height, 350),
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute indicators dynamically
  const emaValues = showEMA ? calculateEMA(candles, 9) : [];
  const smaValues = showSMA ? calculateSMA(candles, 20) : [];

  // Find min/max values to fit the dataset vertically in the viewbox nicely
  const paddingPercent = 0.08;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  let maxVal = Math.max(...highs, ...emaValues.filter(e => e !== null) as number[], ...smaValues.filter(s => s !== null) as number[]);
  let minVal = Math.min(...lows, ...emaValues.filter(e => e !== null) as number[], ...smaValues.filter(s => s !== null) as number[]);
  
  // Guard against division by zero
  if (maxVal === minVal) {
    maxVal += 10;
    minVal -= 10;
  }
  
  const valRange = maxVal - minVal;
  const yMax = maxVal + valRange * paddingPercent;
  const yMin = minVal - valRange * paddingPercent;
  const finalRange = yMax - yMin;

  // Chart coordinate mapping helpers
  const getX = (index: number) => {
    if (candles.length <= 1) return 0;
    return (index / (candles.length - 1)) * (dimensions.width - 60) + 15;
  };

  const getY = (price: number) => {
    return dimensions.height - 40 - ((price - yMin) / finalRange) * (dimensions.height - 70);
  };

  // Hover detection mapping
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMouseCoords({ x, y });

    // Map X coordinate back to closest Candlestick Index
    const chartContentWidth = dimensions.width - 60;
    const paddingLeft = 15;
    const relativeX = x - paddingLeft;
    
    if (relativeX < 0 || relativeX > chartContentWidth) {
      setHoveredIndex(null);
      return;
    }

    const index = Math.round((relativeX / chartContentWidth) * (candles.length - 1));
    if (index >= 0 && index < candles.length) {
      setHoveredIndex(index);
    } else {
      setHoveredIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Determine active Candle values (either hovered, or fallback to latest tick)
  const activeCandle = hoveredIndex !== null ? candles[hoveredIndex] : candles[candles.length - 1];

  // Render Horizontal Grid Line Coordinates
  const gridLineCount = 5;
  const gridPrices = Array.from({ length: gridLineCount }).map((_, i) => {
    return yMin + (finalRange * i) / (gridLineCount - 1);
  });

  // SVG Render Elements
  // Create a beautiful SVG Path for Area Line chart
  const createAreaPath = () => {
    if (candles.length === 0) return '';
    let d = `M ${getX(0)} ${getY(candles[0].close)}`;
    for (let i = 1; i < candles.length; i++) {
      d += ` L ${getX(i)} ${getY(candles[i].close)}`;
    }
    // Close the area loop (bottom line)
    d += ` L ${getX(candles.length - 1)} ${dimensions.height - 40}`;
    d += ` L ${getX(0)} ${dimensions.height - 40} Z`;
    return d;
  };

  const createLinePath = () => {
    if (candles.length === 0) return '';
    let d = `M ${getX(0)} ${getY(candles[0].close)}`;
    for (let i = 1; i < candles.length; i++) {
      d += ` L ${getX(i)} ${getY(candles[i].close)}`;
    }
    return d;
  };

  const createIndicatorPath = (values: (number | null)[]) => {
    let d = '';
    let started = false;
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (val !== null) {
        if (!started) {
          d = `M ${getX(i)} ${getY(val)}`;
          started = true;
        } else {
          d += ` L ${getX(i)} ${getY(val)}`;
        }
      }
    }
    return d;
  };

  return (
    <section className="glass-panel flex-1 min-h-[420px] flex flex-col p-4 relative overflow-hidden select-none">
      {/* HUD Header Bar showing current Selected/Hovered Candle stats */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-3 border-b border-outline-variant/20 pb-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-secondary font-display font-semibold text-xs tracking-wider uppercase flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            XAU/USD
          </span>
          <div className="flex items-center gap-2 text-[11px] font-mono text-on-surface-variant/85 bg-surface-container/60 px-2.5 py-1 border border-outline-variant/30 rounded t-num">
            <span>O: <strong className="text-on-surface">{activeCandle?.open.toFixed(2)}</strong></span>
            <span>H: <strong className="text-green-400">{activeCandle?.high.toFixed(2)}</strong></span>
            <span>L: <strong className="text-red-400">{activeCandle?.low.toFixed(2)}</strong></span>
            <span>C: <strong className="text-on-surface">{activeCandle?.close.toFixed(2)}</strong></span>
            <span>VOL: <strong className="text-[#a5b4fc]">{activeCandle?.volume.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart visual representations */}
          <div className="flex bg-surface-container border border-outline-variant/50 rounded p-0.5 text-[10px] font-bold">
            <button
              onClick={() => setChartType('candle')}
              className={`px-2 py-0.5 uppercase cursor-pointer rounded-xs transition-colors ${
                chartType === 'candle' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Candles
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-0.5 uppercase cursor-pointer rounded-xs transition-colors ${
                chartType === 'line' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Line Area
            </button>
          </div>

          {/* Technical overrides */}
          <div className="flex items-center gap-1.5 bg-surface-container border border-outline-variant/50 rounded p-0.5 text-[11px] text-on-surface-variant">
            <button
              onClick={() => setShowEMA(!showEMA)}
              className={`px-2 py-0.5 font-semibold cursor-pointer rounded-xs transition-all ${
                showEMA ? 'bg-[#97b0ff]/20 text-[#97b0ff] border border-[#97b0ff]/30' : 'hover:text-on-surface border border-transparent'
              }`}
              title="9-period Exponential Moving Average"
            >
              EMA(9)
            </button>
            <button
              onClick={() => setShowSMA(!showSMA)}
              className={`px-2 py-0.5 font-semibold cursor-pointer rounded-xs transition-all ${
                showSMA ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:text-on-surface border border-transparent'
              }`}
              title="20-period Simple Moving Average"
            >
              SMA(20)
            </button>
          </div>

          {/* Timeframe selector buttons */}
          <div className="flex bg-surface-container border border-outline-variant/50 rounded p-0.5 text-[10px] font-bold">
            {['1M', '5M', '15M', '1H'].map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2.5 py-0.5 cursor-pointer rounded-xs transition-colors ${
                  timeframe === tf ? 'bg-primary/80 text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Canvas Workspace wrapper */}
      <div ref={containerRef} className="flex-1 w-full relative mt-2 select-none">
        
        {/* Relative absolute labels for pricing axis on the right */}
        {gridPrices.map((price, i) => (
          <div
            key={i}
            style={{ top: `${getY(price) - 8}px` }}
            className="absolute right-0 text-[10px] font-mono text-on-surface-variant/70 bg-background/60 px-1 py-0.5 border border-outline-variant/10 rounded t-num select-none"
          >
            ${price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
        ))}

        <svg
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-crosshair chart-glow"
        >
          {/* DEFINITIONS for gradient backgrounds */}
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2ca50" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f2ca50" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="volGradientUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="volGradientDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {gridPrices.map((price, i) => (
            <line
              key={i}
              x1={0}
              y1={getY(price)}
              x2={dimensions.width - 60}
              y2={getY(price)}
              stroke="var(--color-outline-variant)"
              strokeOpacity={0.25}
              strokeWidth={0.7}
              strokeDasharray="4,4"
            />
          ))}

          {/* Vertical Grid lines (Interval spacing) */}
          {Array.from({ length: 6 }).map((_, i) => {
            const index = Math.round((candles.length - 1) * i / 5);
            const x = getX(index);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={dimensions.height - 40}
                  stroke="var(--color-outline-variant)"
                  strokeOpacity={0.15}
                  strokeWidth={0.7}
                />
                <text
                  x={x}
                  y={dimensions.height - 18}
                  textAnchor="middle"
                  fill="var(--color-on-surface-variant)"
                  fillOpacity={0.6}
                  className="font-mono text-[9px] font-semibold"
                >
                  {candles[index]?.time || ''}
                </text>
              </g>
            );
          })}

          {/* VOLUME BARS (Drawn first to sit in background) */}
          {candles.map((candle, i) => {
            const barWidth = Math.max(1.5, (dimensions.width - 60) / candles.length * 0.55);
            const maxVol = Math.max(...candles.map(c => c.volume));
            const volHeight = (candle.volume / maxVol) * 45; // Max 45px tall
            const volY = dimensions.height - 40 - volHeight;
            const volX = getX(i) - barWidth / 2;
            const isGreen = candle.close >= candle.open;

            return (
              <rect
                key={`vol-${i}`}
                x={volX}
                y={volY}
                width={barWidth}
                height={volHeight}
                fill={isGreen ? 'url(#volGradientUp)' : 'url(#volGradientDown)'}
                stroke={isGreen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}
                strokeWidth={0.5}
              />
            );
          })}

          {/* LINE AREA REPRESENTATION */}
          {chartType === 'line' && (
            <>
              {/* Fade Area fill */}
              <path
                d={createAreaPath()}
                fill="url(#areaGradient)"
              />
              {/* Line stroke */}
              <path
                d={createLinePath()}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* STANDARD CANDLESTICK REPRESENTATION */}
          {chartType === 'candle' && candles.map((candle, i) => {
            const x = getX(i);
            const openY = getY(candle.open);
            const closeY = getY(candle.close);
            const highY = getY(candle.high);
            const lowY = getY(candle.low);
            
            const isGreen = candle.close >= candle.open;
            const strokeColor = isGreen ? '#10b981' : '#ef4444';
            const bodyColor = isGreen ? '#10b981' : '#ef4444';
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.2, Math.abs(openY - closeY));
            const bodyWidth = Math.max(2, (dimensions.width - 60) / candles.length * 0.65);

            return (
              <g key={`candle-${i}`}>
                {/* Candle Wick line */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={strokeColor}
                  strokeWidth={1.2}
                />
                {/* Candle Body rectangle */}
                <rect
                  x={x - bodyWidth / 2}
                  y={bodyY}
                  width={bodyWidth}
                  height={bodyHeight}
                  fill={bodyColor}
                  stroke={strokeColor}
                  strokeWidth={0.5}
                />
              </g>
            );
          })}

          {/* TECHNICAL INDICATORS OVERLAY PLOTS */}
          {showEMA && (
            <path
              d={createIndicatorPath(emaValues)}
              className="transition-all"
              fill="none"
              stroke="#97b0ff" // Blue-periwinkle color
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray="1,1" // subtle dotted look
            />
          )}

          {showSMA && (
            <path
              d={createIndicatorPath(smaValues)}
              className="transition-all"
              fill="none"
              stroke="var(--color-primary-container)" // Golden-amber
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          )}

          {/* ACTIVE CURRENT SPOT BID PRICE DASHED HORIZONTAL LINE */}
          <line
            x1={0}
            y1={getY(currentSpotPrice)}
            x2={dimensions.width - 60}
            y2={getY(currentSpotPrice)}
            stroke="var(--color-primary)"
            strokeWidth={1}
            strokeDasharray="4,4"
            className="animate-pulse"
          />
          <g transform={`translate(${dimensions.width - 55}, ${getY(currentSpotPrice) - 8})`}>
            {/* Background pill */}
            <rect
              width={50}
              height={16}
              rx={2}
              fill="var(--color-primary-container)"
            />
            {/* Value overlay */}
            <text
              x={25}
              y={11}
              textAnchor="middle"
              className="font-mono text-[9px] text-[#241a00] font-bold"
            >
              {currentSpotPrice.toFixed(2)}
            </text>
          </g>

          {/* PORT INTERACTIVE CROSSHAIRS & FOCUS HIGHLIGHTS */}
          {hoveredIndex !== null && (
            <g>
              {/* Vertical line crosshair */}
              <line
                x1={getX(hoveredIndex)}
                y1={0}
                x2={getX(hoveredIndex)}
                y2={dimensions.height - 40}
                stroke="var(--color-outline)"
                strokeOpacity={0.65}
                strokeWidth={0.7}
                strokeDasharray="3,3"
              />
              {/* Horizontal line crosshair */}
              <line
                x1={0}
                y1={mouseCoords.y}
                x2={dimensions.width - 60}
                y2={mouseCoords.y}
                stroke="var(--color-outline)"
                strokeOpacity={0.65}
                strokeWidth={0.7}
                strokeDasharray="3,3"
              />

              {/* Data Dot snapping on closing price of target candle */}
              <circle
                cx={getX(hoveredIndex)}
                cy={getY(candles[hoveredIndex].close)}
                r={4}
                className="animate-ping"
                fill="var(--color-primary)"
                opacity={0.7}
              />
              <circle
                cx={getX(hoveredIndex)}
                cy={getY(candles[hoveredIndex].close)}
                r={3}
                fill="var(--color-primary)"
                stroke="#241a00"
                strokeWidth={0.7}
              />
            </g>
          )}
        </svg>
      </div>
    </section>
  );
}
