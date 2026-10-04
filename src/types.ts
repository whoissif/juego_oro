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
  quantity: number;
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
  size: number;
  total: number;
  percentage: number;
}

export interface TradeLog {
  id: string;
  timestamp: string;
  side: OrderSide;
  price: number;
  closePrice?: number;
  quantity: number;
  leverage: number;
  pnl?: number;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  /** ISO string for equity curve sorting */
  closedAt?: string;
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

/** A pending conditional order waiting to trigger */
export interface PendingOrder {
  id: string;
  type: 'LIMIT' | 'STOP_LOSS';
  side: OrderSide;
  quantity: number;
  leverage: number;
  triggerPrice: number;
  createdAt: string;
  positionId?: string;
}

/** A point on the portfolio equity curve */
export interface EquityPoint {
  timestamp: string;
  balance: number;
}
