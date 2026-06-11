/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';
import { TickerInfo } from '../types';

interface MarketTickerProps {
  ticker: TickerInfo;
  previousPrice: number;
  isRealApiActive?: boolean;
  apiStatus?: 'connected' | 'error' | 'loading';
}

export default function MarketTicker({ 
  ticker, 
  previousPrice,
  isRealApiActive = true,
  apiStatus = 'connected'
}: MarketTickerProps) {
  const priceRef = useRef<HTMLSpanElement>(null);
  
  // Track price directions for flashing effects
  const priceDirection = ticker.lastPrice > previousPrice 
    ? 'up' 
    : ticker.lastPrice < previousPrice 
      ? 'down' 
      : 'stable';

  const spread = parseFloat((ticker.ask - ticker.bid).toFixed(2));
  const isPositive = ticker.changePercent >= 0;

  return (
    <section className="glass-panel p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 select-none">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        <div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-black text-4xl md:text-5xl text-white tracking-tighter">
                XAU/USD
              </h2>
              {isRealApiActive ? (
                <span className={`text-[9px] font-black px-2.5 py-0.5 border rounded-sm uppercase tracking-[0.15em] flex items-center gap-1.5 ${
                  apiStatus === 'connected'
                    ? 'bg-green-500/10 text-green-400 border-green-500/25'
                    : apiStatus === 'loading'
                      ? 'bg-primary/10 text-primary border-primary/25 animate-pulse'
                      : 'bg-red-500/10 text-red-400 border-red-500/25'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-primary animate-pulse'}`} />
                  Coinbase API Live
                </span>
              ) : (
                <span className="bg-[#D4AF37]/10 text-[#D4AF37] text-[9px] font-black px-2 py-0.5 border border-[#D4AF37]/25 rounded-sm uppercase tracking-[0.15em]">
                  Simulation Desk
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.25em] mt-1 text-primary">Institutional Grade Gold Spot</p>
          </div>
          
          <div className="flex gap-6 md:gap-10 mt-4 border-t border-outline-variant/10 pt-3">
            <div className="flex flex-col">
              <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Bid price</span>
              <span className={`font-mono text-lg md:text-xl font-semibold text-on-surface t-num transition-colors duration-300 ${
                priceDirection === 'up' 
                  ? 'text-green-400 ticker-pulse-green' 
                  : priceDirection === 'down' 
                    ? 'text-red-400 ticker-pulse-red' 
                    : 'text-on-surface'
              }`}>
                ${ticker.bid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Ask price</span>
              <span className="font-mono text-lg md:text-xl font-semibold text-on-surface t-num">
                ${ticker.ask.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Spread</span>
              <span className="font-mono text-sm font-semibold text-on-surface-variant/80 mt-1 uppercase tracking-wide">
                ${spread.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:flex items-center gap-4 sm:gap-8 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-outline-variant/20 sm:border-t-0">
        <div className="flex flex-col sm:items-end">
          <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">24h High</span>
          <span className="font-mono text-xs md:text-sm font-semibold text-on-surface t-num mt-1">
            ${ticker.high24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex flex-col sm:items-end">
          <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">24h Low</span>
          <span className="font-mono text-xs md:text-sm font-semibold text-on-surface-variant t-num mt-1">
            ${ticker.low24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex flex-col sm:items-end">
          <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Daily Volume</span>
          <span className="font-mono text-xs md:text-sm font-semibold text-on-surface t-num mt-1">
            {(ticker.volume24h / 1000000).toFixed(2)}M Oz
          </span>
        </div>

        <div className="flex flex-col items-start sm:items-end col-span-2 sm:col-span-1">
          <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Price Change</span>
          <div className={`font-mono text-sm md:text-base font-semibold flex items-center gap-0.5 mt-0.5 ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPositive ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            <span className="t-num">
              {isPositive ? '+' : ''}
              {ticker.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
