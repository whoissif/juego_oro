/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Minus, Info, AlertOctagon, TrendingUp, Sparkles } from 'lucide-react';
import { OrderSide } from '../types';
import { calculateLiquidationPrice } from '../utils/marketSim';

interface ExecutionPanelProps {
  currentSpotPrice: number;
  freeMargin: number;
  onExecuteTrade: (side: OrderSide, quantity: number, leverage: number, price: number) => void;
}

export default function ExecutionPanel({
  currentSpotPrice,
  freeMargin,
  onExecuteTrade,
}: ExecutionPanelProps) {
  const [activeSide, setActiveSide] = useState<OrderSide>('BUY');
  const [quantity, setQuantity] = useState<number>(10.00);
  const [leverage, setLeverage] = useState<number>(25);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const leveragePresets = [5, 10, 25, 50];

  // Quantities stepper handlers
  const handleQuantityIncrement = () => {
    setQuantity((prev) => parseFloat((prev + 1.0).toFixed(2)));
  };

  const handleQuantityDecrement = () => {
    setQuantity((prev) => Math.max(0.1, parseFloat((prev - 1.0).toFixed(2))));
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      setQuantity(val);
    }
  };

  // Live Metric Formulas
  const notionalValue = currentSpotPrice * quantity;
  const marginRequired = notionalValue / leverage;
  const estLiquidationPrice = calculateLiquidationPrice(activeSide, currentSpotPrice, leverage);
  
  // Custom institutional fees: 0.012% of total notional size
  const tradingFee = notionalValue * 0.0012;

  // Validate margin requirements on adjustments
  useEffect(() => {
    if (marginRequired > freeMargin) {
      setErrorMessage(`Insufficient Free Margin. Require $${marginRequired.toLocaleString('en-US', { maximumFractionDigits: 2 })} (Available: $${freeMargin.toLocaleString('en-US', { maximumFractionDigits: 2 })})`);
    } else {
      setErrorMessage(null);
    }
  }, [quantity, leverage, activeSide, currentSpotPrice, freeMargin]);

  const handleTriggerSubmission = (overrideSide?: OrderSide) => {
    const side = overrideSide || activeSide;
    const finalMarginRequired = (currentSpotPrice * quantity) / leverage;

    if (finalMarginRequired > freeMargin) {
      setErrorMessage('Trade blocked: Insufficient institutional margin reserves.');
      return;
    }

    if (quantity <= 0) {
      setErrorMessage('Trade blocked: Quantity must be greater than zero.');
      return;
    }

    // Fire actual trade execution to App state
    onExecuteTrade(side, quantity, leverage, currentSpotPrice);
    
    // Quick success animation reset feedback
    setErrorMessage(null);
  };

  return (
    <aside className="w-full xl:w-80 glass-panel border-l border-outline-variant/35 flex flex-col p-4 md:p-6 select-none shrink-0 rounded-lg">
      <h2 className="font-display font-black text-sm uppercase tracking-[0.18em] text-primary mb-4 flex items-center justify-between border-b border-outline-variant pb-2">
        Executive Order
        <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-sm uppercase tracking-widest font-mono font-bold">
          Spot Contract
        </span>
      </h2>

      {/* Buy/Sell tab selectors */}
      <div className="flex gap-2 rounded bg-surface-container-low p-0.5 border border-outline-variant/20 mb-5">
        <button
          onClick={() => setActiveSide('BUY')}
          className={`flex-1 py-2.5 font-black uppercase tracking-[0.18em] text-[10px] transition-all cursor-pointer rounded-sm outline-none ${
            activeSide === 'BUY'
              ? 'bg-primary text-on-primary shadow-lg shadow-primary/10'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Limit Buy
        </button>
        <button
          onClick={() => setActiveSide('SELL')}
          className={`flex-1 py-2.5 font-black uppercase tracking-[0.18em] text-[10px] transition-all cursor-pointer rounded-sm outline-none ${
            activeSide === 'SELL'
              ? 'bg-red-600 text-white font-black shadow-lg shadow-red-600/10'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Limit Sell
        </button>
      </div>

      <div className="space-y-4 flex-1">
        {/* Quantity Selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex justify-between items-center">
            <span>QUANTITY (T-OUNCES)</span>
            <span className="text-[9px] font-mono font-normal">Notional: ${notionalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          </label>
          <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded p-1">
            <button
              onClick={handleQuantityDecrement}
              className="w-10 h-10 flex items-center justify-center hover:bg-surface-variant rounded-sm transition-colors text-on-surface cursor-pointer outline-none"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={quantity}
              onChange={handleQuantityChange}
              step="0.5"
              min="0.1"
              className="flex-1 bg-transparent border-none text-center font-mono font-semibold text-lg text-primary focus:outline-none focus:ring-0 select-text"
            />
            <button
              onClick={handleQuantityIncrement}
              className="w-10 h-10 flex items-center justify-center hover:bg-surface-variant rounded-sm transition-colors text-on-surface cursor-pointer outline-none"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Leverage Presets Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            LEVERAGE MULTIPLIER
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {leveragePresets.map((preset) => {
              const isSelected = leverage === preset;
              return (
                <button
                  key={preset}
                  onClick={() => setLeverage(preset)}
                  className={`py-2 text-xs font-mono font-semibold border transition-all cursor-pointer outline-none rounded-xs ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary font-bold'
                      : 'bg-surface-container border-outline-variant/40 text-on-surface-variant hover:border-outline hover:text-on-surface'
                  }`}
                >
                  {preset}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Margin Calculations */}
        <div className="pt-4 space-y-2.5 border-t border-outline-variant/30 text-xs">
          <div className="flex justify-between items-center text-on-surface-variant">
            <span>Margin Reserves Req:</span>
            <span className="text-on-surface font-mono font-medium t-num">
              ${marginRequired.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between items-center text-on-surface-variant">
            <span>Est. Liquidation Price:</span>
            <span className="text-red-400 font-mono font-medium t-num">
              ${estLiquidationPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between items-center text-on-surface-variant">
            <span>Trading Execution Fee (0.012%):</span>
            <span className="text-on-surface font-mono font-medium t-num">
              ${tradingFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Safety alert message banners */}
      {errorMessage && (
        <div className="mt-4 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[11px] font-medium leading-relaxed flex items-start gap-1.5">
          <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Trigger CTA triggers */}
      <div className="mt-5 space-y-2.5">
        <button
          onClick={() => handleTriggerSubmission('BUY')}
          disabled={!!errorMessage}
          className={`w-full py-4 rounded-sm font-black uppercase tracking-[0.22em] text-[12px] transition-all cursor-pointer outline-none ${
            !!errorMessage 
              ? 'bg-[#182028] text-on-surface-variant/30 cursor-not-allowed border border-outline-variant/10 shadow-none'
              : 'bg-green-600 hover:bg-green-500 text-white hover:scale-[1.01] active:scale-[0.98]'
          }`}
        >
          LONG POSITION
        </button>
        <button
          onClick={() => handleTriggerSubmission('SELL')}
          disabled={!!errorMessage}
          className={`w-full py-4 rounded-sm font-black uppercase tracking-[0.22em] text-[12px] transition-all cursor-pointer outline-none ${
            !!errorMessage
              ? 'bg-[#182028]/50 text-on-surface-variant/30 border border-outline-variant/10 cursor-not-allowed'
              : 'bg-red-650 hover:bg-red-500 bg-red-600 hover:scale-[1.01] text-white active:scale-[0.98]'
          }`}
        >
          SHORT POSITION
        </button>
      </div>

      {/* Premium static image of real shiny gold bar */}
      <div className="mt-5 pt-3.5 border-t border-outline-variant/20">
        <div className="relative overflow-hidden h-24 rounded-lg bg-surface-container border border-outline-variant/30 group">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAoaW5EcldJZ4FUAKD0IadWTbV1RxVAr7w2zDhNtKmmIfPDcCigthi-q_P_JGebmPOWNbHXU0rhadhBdIkSltKAxJ8EnMK3zqvYAuwyPbpXZdcezLPEZIAsHhS1QuS6AbV7guQc-qw7rsd5OlVpQEgkfP4pCJi0UEhFbEam5wFo0P3e1tIGyeej0NTOv6962gValh1sn4TcgIXlSgtSAMUB-IIBaxcvdjy3tXTEi2i1P5W_bmDQ_Err8Brv3McltFt-bbe4TQxHYA"
            referrerPolicy="no-referrer"
            alt="Gold Bar Close-up"
            className="w-full h-full object-cover filter brightness-[0.75] grayscale group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f14]/85 to-transparent flex items-end p-2.5">
            <span className="font-display font-bold text-[9px] uppercase tracking-widest text-primary/80">
              Aureus Bullion Reserve 999.9
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
