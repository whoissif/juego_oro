/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, OrderBookEntry, TickerInfo } from '../types';

/**
 * Generates historical candlestick data mimicking Gold Spot prices (XAU/USD).
 * Gold prices are typically in the range of $2000 - $2100.
 */
export function generateInitialCandles(
  count: number = 80,
  startPrice: number = 2040.50,
  timeframeMinutes: number = 5
): Candle[] {
  const candles: Candle[] = [];
  let currentPrice = startPrice;
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const candleTime = new Date(now.getTime() - i * timeframeMinutes * 60 * 1000);
    const timeStr = candleTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Simulate standard brownian walk with slight upward bias for Gold
    const change = (Math.random() - 0.46) * 4.2; 
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * 1.8;
    const low = Math.min(open, close) - Math.random() * 1.8;
    const volume = Math.round(5000 + Math.random() * 15000);

    candles.push({
      time: timeStr,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

/**
 * Computes the Simple Moving Average (SMA) for an array of candles.
 */
export function calculateSMA(candles: Candle[], period: number): (number | null)[] {
  const sma: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].close;
      }
      sma.push(parseFloat((sum / period).toFixed(2)));
    }
  }
  return sma;
}

/**
 * Computes the Exponential Moving Average (EMA) for an array of candles.
 */
export function calculateEMA(candles: Candle[], period: number): (number | null)[] {
  const ema: (number | null)[] = [];
  if (candles.length === 0) return [];

  let k = 2 / (period + 1);
  let currentEma = candles[0].close;
  ema.push(currentEma);

  for (let i = 1; i < candles.length; i++) {
    currentEma = candles[i].close * k + currentEma * (1 - k);
    if (i < period - 1) {
      ema.push(null);
    } else {
      ema.push(parseFloat(currentEma.toFixed(2)));
    }
  }
  return ema;
}

/**
 * Generates stable and reactive Order Book bids and asks centered on the spot price.
 */
export function generateOrderBook(midPrice: number, spread: number = 0.88, depth: number = 8): {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
} {
  const bids: OrderBookEntry[] = [];
  const asks: OrderBookEntry[] = [];

  let cumulativeBidTotal = 0;
  let cumulativeAskTotal = 0;

  // Generate Bids (Buy orders, below midPrice)
  for (let i = 0; i < depth; i++) {
    const offset = spread / 2 + i * 0.12 + Math.random() * 0.05;
    const price = parseFloat((midPrice - offset).toFixed(2));
    const size = parseFloat((20 + Math.random() * 80).toFixed(1));
    cumulativeBidTotal += size;

    bids.push({
      price,
      size,
      total: parseFloat(cumulativeBidTotal.toFixed(1)),
      percentage: 0, // Calculated after finding max total
    });
  }

  // Generate Asks (Sell orders, above midPrice)
  for (let i = 0; i < depth; i++) {
    const offset = spread / 2 + i * 0.12 + Math.random() * 0.05;
    const price = parseFloat((midPrice + offset).toFixed(2));
    const size = parseFloat((20 + Math.random() * 80).toFixed(1));
    cumulativeAskTotal += size;

    asks.push({
      price,
      size,
      total: parseFloat(cumulativeAskTotal.toFixed(1)),
      percentage: 0,
    });
  }

  // Calculate percentages for render sizing
  const maxBidTotal = bids[bids.length - 1]?.total || 1;
  const maxAskTotal = asks[asks.length - 1]?.total || 1;

  bids.forEach(b => b.percentage = (b.total / maxBidTotal) * 100);
  asks.forEach(a => a.percentage = (a.total / maxAskTotal) * 100);

  return { bids, asks };
}

/**
 * Simulates a single tick update on a set of active candles.
 * Returns the updated candle list and a boolean if a new bar has rolled over.
 */
export function simulateTickUpdate(
  candles: Candle[],
  lastPrice: number,
  change: number,
  maxBars: number = 200
): { updatedCandles: Candle[]; newLastPrice: number } {
  if (candles.length === 0) return { updatedCandles: [], newLastPrice: lastPrice };

  const copy = [...candles];
  const lastCandle = { ...copy[copy.length - 1] };
  const newPrice = parseFloat((lastPrice + change).toFixed(2));

  // Edit current candle
  lastCandle.close = newPrice;
  if (newPrice > lastCandle.high) lastCandle.high = newPrice;
  if (newPrice < lastCandle.low) lastCandle.low = newPrice;
  lastCandle.volume += Math.round(Math.random() * 150);

  copy[copy.length - 1] = lastCandle;

  return {
    updatedCandles: copy,
    newLastPrice: newPrice,
  };
}

/**
 * Calculates liquidation price for derivative contracts:
 * Buying long requires margin. Margin call/liquidation triggers when the position value drops
 * below the maintenance margin (or basically when loss exceeds available margin).
 * Sell short triggers when the price rises too high.
 */
export function calculateLiquidationPrice(
  side: 'BUY' | 'SELL',
  entryPrice: number,
  leverage: number
): number {
  if (side === 'BUY') {
    // Standard long liquidation margin approximation: entryPrice * (1 - 1 / leverage + maintenanceMarginMultiplier)
    // We'll use a standard terminal formula for intuitive feedback:
    return parseFloat((entryPrice * (1 - 0.9 / leverage)).toFixed(2));
  } else {
    return parseFloat((entryPrice * (1 + 0.9 / leverage)).toFixed(2));
  }
}
