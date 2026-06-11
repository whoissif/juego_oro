/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, PlusCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Position } from '../types';

interface PositionsListProps {
  positions: Position[];
  onClosePosition: (id: string, closingPrice: number) => void;
  currentSpotPrice: number;
}

export default function PositionsList({
  positions,
  onClosePosition,
  currentSpotPrice,
}: PositionsListProps) {
  return (
    <section className="glass-panel overflow-hidden flex flex-col min-h-[220px]">
      {/* Grid section Header */}
      <div className="px-4 py-2.5 border-b border-outline-variant bg-surface-container-high flex justify-between items-center select-none">
        <h3 className="font-display text-[10px] font-black text-white uppercase tracking-[0.22em] flex items-center gap-2">
          Institutional Portfolio Positions
          <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-sm normal-case font-mono font-bold">
            {positions.length} Active
          </span>
        </h3>
        <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.18em] flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-green-400" /> SECURE TRADING LEDGER
        </p>
      </div>

      {positions.length === 0 ? (
        /* Empty Portfolio State */
        <div className="flex-1 flex flex-col items-center justify-center p-8 select-none text-center">
          <LayersPlaceholder />
          <p className="text-sm font-semibold text-on-surface-variant max-w-sm">No active leveraged positions found in this session.</p>
          <p className="text-xs text-on-surface-variant/50 max-w-xs mt-1">Select contract quantity, configure leverage presets, and execute custom contracts on the trading desk.</p>
        </div>
      ) : (
        /* Positions Ledger Database Table */
        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse select-none">
            <thead>
              <tr className="text-left border-b border-outline-variant bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                <th className="px-4 py-2.5 font-display">Symbol</th>
                <th className="px-4 py-2.5 font-display text-center">CONTRACT TYPE</th>
                <th className="px-4 py-2.5 font-display text-right">SIZE (T-OZ)</th>
                <th className="px-4 py-2.5 font-display text-right">LEVERAGE</th>
                <th className="px-4 py-2.5 font-display text-right">ENTRY PRICE</th>
                <th className="px-4 py-2.5 font-display text-right">SPOT PRICE</th>
                <th className="px-4 py-2.5 font-display text-right">MARGIN AT COMMITTAL</th>
                <th className="px-4 py-2.5 font-display text-right text-red-400">LIQ THRESHOLD</th>
                <th className="px-4 py-2.5 font-display text-right">UNREALIZED P&L</th>
                <th className="px-4 py-2.5 font-display text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs text-on-surface/90">
              {positions.map((pos) => {
                const isBuy = pos.side === 'BUY';
                
                // Live recalculative PnL factoring leverage
                const priceDelta = currentSpotPrice - pos.entryPrice;
                const percentGains = priceDelta / pos.entryPrice;
                const livePnL = isBuy
                  ? priceDelta * pos.quantity
                  : -priceDelta * pos.quantity;
                
                // Highlighting danger status (within 1% of liquidation threshold)
                const percentToLiq = isBuy
                  ? (currentSpotPrice - pos.liquidationPrice) / currentSpotPrice
                  : (pos.liquidationPrice - currentSpotPrice) / currentSpotPrice;
                const isNearLiquidation = percentToLiq < 0.015;

                return (
                  <tr 
                    key={pos.id} 
                    className={`border-b border-outline-variant/20 hover:bg-surface-variant/20 transition-colors t-num ${
                      isNearLiquidation ? 'bg-red-950/20' : ''
                    }`}
                  >
                    {/* Symbol */}
                    <td className="px-4 py-3 font-semibold text-primary">{pos.symbol}</td>
                    
                    {/* Contract Type */}
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-xs text-[9px] font-bold tracking-widest ${
                        isBuy 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {isBuy ? 'LONG SPOT' : 'SHORT SPOT'}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="px-4 py-3 text-right font-medium">{pos.quantity.toFixed(2)} Oz</td>
                    
                    {/* Leverage */}
                    <td className="px-4 py-3 text-right font-semibold text-on-surface-variant">{pos.leverage}x</td>

                    {/* Entry Price */}
                    <td className="px-4 py-3 text-right text-on-surface-variant">${pos.entryPrice.toFixed(2)}</td>

                    {/* Spot Rate */}
                    <td className="px-4 py-3 text-right font-semibold text-on-surface">${currentSpotPrice.toFixed(2)}</td>

                    {/* Margin Commit */}
                    <td className="px-4 py-3 text-right text-on-surface-variant/80">${pos.margin.toFixed(2)}</td>

                    {/* Liquidation Threshold */}
                    <td className={`px-4 py-3 text-right font-medium ${isNearLiquidation ? 'text-red-400 text-shadow-red animate-pulse' : 'text-on-surface-variant/70'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {isNearLiquidation && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                        <span>${pos.liquidationPrice.toFixed(2)}</span>
                      </div>
                    </td>

                    {/* Running PnL */}
                    <td className={`px-4 py-3 text-right font-bold ${livePnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      <div className="flex items-center justify-end gap-0.5">
                        {livePnL >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                        <span>
                          {livePnL >= 0 ? '+' : ''}
                          ${livePnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>

                    {/* Quick Close Button */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onClosePosition(pos.id, currentSpotPrice)}
                        className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 uppercase text-[9px] font-bold tracking-widest rounded-xs transition-colors cursor-pointer outline-none flex items-center justify-center gap-1 mx-auto"
                        title="Instantly exit contract spot at current quote"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>CLOSE</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LayersPlaceholder() {
  return (
    <svg className="w-12 h-12 text-on-surface-variant/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
