/**
 * orderExecutor.ts — Cola de órdenes LIMIT y STOP_LOSS pendientes.
 * Se evalúa en cada tick del motor de mercado.
 */
import { OrderSide, OrderType } from '../types';

export interface PendingOrder {
  id: string;
  type: 'LIMIT' | 'STOP_LOSS';
  side: OrderSide;
  quantity: number;
  leverage: number;
  triggerPrice: number;
  createdAt: string;
  /** For STOP_LOSS: the position ID it should close */
  positionId?: string;
}

/**
 * Check which pending orders should trigger at the current price.
 * Returns triggered orders and the remaining queue.
 */
export function evaluateOrders(
  orders: PendingOrder[],
  currentPrice: number
): { triggered: PendingOrder[]; remaining: PendingOrder[] } {
  const triggered: PendingOrder[] = [];
  const remaining: PendingOrder[] = [];

  for (const order of orders) {
    let shouldTrigger = false;

    if (order.type === 'LIMIT') {
      // BUY LIMIT: buy when price drops TO or BELOW trigger
      // SELL LIMIT: sell when price rises TO or ABOVE trigger
      if (order.side === 'BUY' && currentPrice <= order.triggerPrice) shouldTrigger = true;
      if (order.side === 'SELL' && currentPrice >= order.triggerPrice) shouldTrigger = true;
    } else if (order.type === 'STOP_LOSS') {
      // STOP_LOSS for long position: trigger when price falls to level
      // STOP_LOSS for short position: trigger when price rises to level
      if (order.side === 'SELL' && currentPrice <= order.triggerPrice) shouldTrigger = true;
      if (order.side === 'BUY' && currentPrice >= order.triggerPrice) shouldTrigger = true;
    }

    if (shouldTrigger) triggered.push(order);
    else remaining.push(order);
  }

  return { triggered, remaining };
}

export function createPendingOrder(
  type: 'LIMIT' | 'STOP_LOSS',
  side: OrderSide,
  quantity: number,
  leverage: number,
  triggerPrice: number,
  positionId?: string
): PendingOrder {
  return {
    id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    side,
    quantity,
    leverage,
    triggerPrice,
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    positionId,
  };
}
