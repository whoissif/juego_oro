/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RefreshCw, TrendingUp, Layers, ListCollapse, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { OrderBookEntry, TradeLog } from '../types';

interface OrderBookProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  recentFills: TradeLog[];
  onRefreshFeed: () => void;
  spread: number;
}

export default function OrderBook({
  bids,
  asks,
  recentFills,
  onRefreshFeed,
  spread,
}: OrderBookProps) {
  const [activeTab, setActiveTab] = useState<'depth' | 'history'>('history');
  const [isRotating, setIsRotating] = useState(false);

  const triggerRefresh = () => {
    setIsRotating(true);
    onRefreshFeed();
    setTimeout(() => setIsRotating(false), 800);
  };

  return (
    <section className="glass-panel overflow-hidden flex flex-col min-h-[300px]">
      {/* Title Panel & Tab Switcher */}
      <div className="px-4 py-2 border-b border-outline-variant bg-surface-container-high flex justify-between items-center select-none">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center py-1">
          <h3 className="font-display text-[10px] font-black text-white uppercase tracking-[0.22em] flex items-center gap-2">
            Order Book Desk
          </h3>
          <div className="flex bg-surface-container/60 border border-outline-variant/20 rounded-sm p-0.5 text-[9px] font-black uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 cursor-pointer rounded-sm transition-colors flex items-center gap-1.5 ${
                activeTab === 'history' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface font-bold'
              }`}
            >
              <ListCollapse className="w-3 h-3" />
              <span>Ticker History</span>
            </button>
            <button
              onClick={() => setActiveTab('depth')}
              className={`px-3 py-1 cursor-pointer rounded-sm transition-colors flex items-center gap-1.5 ${
                activeTab === 'depth' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface font-bold'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Market Depth</span>
            </button>
          </div>
        </div>
        
        <button
          onClick={triggerRefresh}
          className="text-primary hover:text-primary-fixed-dim transition-colors cursor-pointer outline-none"
          title="Regenerate Order Liquidity"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* RENDER VIEW: TICKER TACTICAL HISTORY (Exactly matches mockup layout) */}
      {activeTab === 'history' && (
        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse select-none">
            <thead>
              <tr className="text-left border-b border-outline-variant bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                <th className="px-4 py-2.5 font-display text-left">Time (Local Corp)</th>
                <th className="px-4 py-2.5 font-display text-right">Compra Bid (Long)</th>
                <th className="px-4 py-2.5 font-display text-right">Venta Ask (Short)</th>
                <th className="px-4 py-2.5 font-display text-right">Spread Margin</th>
                <th className="px-4 py-2.5 font-display text-right">Direction</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs text-on-surface/90">
              {recentFills.slice(0, 8).map((fill) => {
                const isBuy = fill.side === 'BUY';
                return (
                  <tr 
                    key={fill.id} 
                    className="border-b border-outline-variant/20 hover:bg-surface-variant/25 transition-colors cursor-pointer t-num"
                  >
                    <td className="px-4 py-2 text-on-surface-variant">{fill.timestamp}</td>
                    <td className={`px-4 py-2 text-right font-medium ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                      ${fill.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right text-on-surface-variant/80">
                      ${(fill.price + spread).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right text-on-surface-variant/60">${spread.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right flex items-center justify-end gap-1.5 font-bold ${
                      isBuy ? 'text-green-400/80' : 'text-red-400/80'
                    }`}>
                      {isBuy ? (
                        <>
                          <ArrowUpCircle className="w-3 h-3 text-green-400" />
                          <span className="text-[10px]">UP</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownCircle className="w-3 h-3 text-red-400" />
                          <span className="text-[10px]">DOWN</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* RENDER VIEW: LIVE DEPTH MATRIX (Bids & Asks visualization with side margins) */}
      {activeTab === 'depth' && (
        <div className="p-3 grid grid-cols-2 gap-4 flex-1 select-none">
          {/* BIDS SIDE (Left, Green background bars) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-green-400 border-b border-outline-variant/20 pb-1">
              <span>Bids Total (Oz)</span>
              <span>Bid Price</span>
            </div>
            {bids.slice(0, 7).map((entry, index) => (
              <div 
                key={`bid-${index}`} 
                className="relative flex justify-between items-center h-6 px-1.5 text-[11px] font-mono rounded-xs overflow-hidden hover:bg-green-500/10 transition-colors"
              >
                {/* Visual bar width representation */}
                <div 
                  style={{ width: `${entry.percentage}%` }} 
                  className="absolute right-0 top-0 bottom-0 bg-green-500/5 border-r border-green-500/20 transition-all duration-500"
                />
                
                <span className="z-10 text-on-surface-variant/85 t-num">{entry.total.toFixed(1)}</span>
                <span className="z-10 text-green-400 font-semibold t-num">${entry.price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* ASKS SIDE (Right, Red background bars) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-red-400 border-b border-outline-variant/20 pb-1">
              <span>Ask Price</span>
              <span>Asks Total (Oz)</span>
            </div>
            {asks.slice(0, 7).map((entry, index) => (
              <div 
                key={`ask-${index}`} 
                className="relative flex justify-between items-center h-6 px-1.5 text-[11px] font-mono rounded-xs overflow-hidden hover:bg-red-500/10 transition-colors"
              >
                {/* Visual bar width representation */}
                <div 
                  style={{ width: `${entry.percentage}%` }} 
                  className="absolute left-0 top-0 bottom-0 bg-red-500/5 border-l border-red-500/20 transition-all duration-500"
                />
                
                <span className="z-10 text-red-400 font-semibold t-num">${entry.price.toFixed(2)}</span>
                <span className="z-10 text-on-surface-variant/85 t-num">{entry.total.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
