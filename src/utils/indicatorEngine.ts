/**
 * indicatorEngine.ts — RSI, MACD, Bollinger Bands
 */
import { Candle } from '../types';

// ── RSI (14) ──────────────────────────────────────────────────────────────
export function calculateRSI(candles: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (candles.length < period + 1) return candles.map(() => null);

  let avgGain = 0;
  let avgLoss = 0;

  // Seed with first period
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < period; i++) result.push(null);
  const firstRS = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push(parseFloat(firstRS.toFixed(2)));

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push(parseFloat(rsi.toFixed(2)));
  }
  return result;
}

// ── EMA helper ────────────────────────────────────────────────────────────
function emaOfArray(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) result.push(NaN);
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

// ── MACD (12, 26, signal 9) ────────────────────────────────────────────
export interface MACDPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function calculateMACD(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9
): MACDPoint[] {
  const closes = candles.map(c => c.close);
  const emaFast = emaOfArray(closes, fast);
  const emaSlow = emaOfArray(closes, slow);

  const macdLine = closes.map((_, i) =>
    isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]
  );

  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalRaw = emaOfArray(validMacd, signal);

  // Align signal back to full length
  const firstValid = macdLine.findIndex(v => !isNaN(v));
  const signalAligned: (number | null)[] = macdLine.map(() => null);
  let sIdx = 0;
  for (let i = firstValid; i < macdLine.length; i++) {
    if (sIdx < signalRaw.length && !isNaN(signalRaw[sIdx])) {
      signalAligned[i] = parseFloat(signalRaw[sIdx].toFixed(4));
    }
    sIdx++;
  }

  return macdLine.map((m, i) => {
    if (isNaN(m)) return { macd: null, signal: null, histogram: null };
    const sig = signalAligned[i];
    return {
      macd: parseFloat(m.toFixed(4)),
      signal: sig,
      histogram: sig !== null ? parseFloat((m - sig).toFixed(4)) : null,
    };
  });
}

// ── Bollinger Bands (20, 2σ) ────────────────────────────────────────────
export interface BollingerPoint {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export function calculateBollinger(
  candles: Candle[],
  period = 20,
  multiplier = 2
): BollingerPoint[] {
  return candles.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const slice = candles.slice(i - period + 1, i + 1).map(c => c.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper: parseFloat((mean + multiplier * std).toFixed(2)),
      middle: parseFloat(mean.toFixed(2)),
      lower: parseFloat((mean - multiplier * std).toFixed(2)),
    };
  });
}
