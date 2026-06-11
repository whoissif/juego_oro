/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS';
export type OrderSide = 'BUY' | 'SELL';

export interface Position {
  id: string;
  side: OrderSide;
  symbol: string;
  quantity: number; // in ounces
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  margin: number;
  liquidationPrice: number;
  pnl: number;
  timestamp: string;
}

export interface OrderBookEntry {
  price: number;
  size: number; // Quantity in ounces
  total: number;
  percentage: number; // For rendering cumulative size indicators
}

export interface TradeLog {
  id: string;
  timestamp: string;
  side: OrderSide;
  price: number;
  quantity: number;
  leverage: number;
  pnl?: number; // Filled if close
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
}

export interface MarketNews {
  id: string;
  time: string;
  title: string;
  source: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  url?: string;
}

export interface TickerInfo {
  symbol: string;
  bid: number;
  ask: number;
  lastPrice: number;
  changePercent: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}
