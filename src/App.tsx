/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Aurum Terminal — Enhanced edition
 * Improvements: localStorage persistence, LIMIT/STOP_LOSS order engine,
 * Gemini AI panel, Performance dashboard with equity curve, CSV export.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, TrendingUp, Layers, AlertOctagon, X, Coins, CheckCircle2,
  Sparkles, Sliders, RotateCcw, Wifi, Activity, Trash2, Brain,
} from 'lucide-react';

import { Candle, Position, TradeLog, TickerInfo, OrderSide, PendingOrder, EquityPoint } from './types';
import {
  generateInitialCandles, generateOrderBook, simulateTickUpdate, calculateLiquidationPrice,
} from './utils/marketSim';
import { evaluateOrders, createPendingOrder } from './utils/orderExecutor';
import { usePersistentState, clearAurumStorage } from './utils/usePersistentState';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MarketTicker from './components/MarketTicker';
import TradingChart from './components/TradingChart';
import OrderBook from './components/OrderBook';
import ExecutionPanel from './components/ExecutionPanel';
import PositionsList from './components/PositionsList';
import AiPanel from './components/AiPanel';
import PerformanceDashboard from './components/PerformanceDashboard';

const timeframeToMinutes = (tf: string): number => {
  switch (tf) { case '1M': return 1; case '5M': return 5; case '15M': return 15; case '1H': return 60; default: return 5; }
};

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [showAiPanel, setShowAiPanel] = useState(false);

  // ── Persistent state (localStorage) ─────────────────────────────────────
  const [vaultBalance, setVaultBalance] = usePersistentState<number>('aurum_balance', 750000.00);
  const [positions, setPositions] = usePersistentState<Position[]>('aurum_positions', []);
  const [tradeLogs, setTradeLogs] = usePersistentState<TradeLog[]>('aurum_logs', []);
  const [pendingOrders, setPendingOrders] = usePersistentState<PendingOrder[]>('aurum_pending', []);
  const [equityCurve, setEquityCurve] = usePersistentState<EquityPoint[]>('aurum_equity', []);

  // ── Market state ─────────────────────────────────────────────────────────
  const [serverConnected, setServerConnected] = useState(true);
  const [apiStatus, setApiStatus] = useState<'connected' | 'error' | 'loading'>('loading');
  const [currentSystemTime, setCurrentSystemTime] = useState('');
  const [currentSpotPrice, setCurrentSpotPrice] = useState(2045.24);
  const [previousPrice, setPreviousPrice] = useState(2045.20);
  const [volatilityMultiplier, setVolatilityMultiplier] = useState(1.0);
  const [timeframe, setTimeframe] = useState('5M');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [autoTicksEnabled, setAutoTicksEnabled] = useState(true);
  const [showDemoBanner, setShowDemoBanner] = useState(true);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('50000');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // ── API key for Gemini (from env) ─────────────────────────────────────
  const geminiApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).__GEMINI_API_KEY__ || '';

  const [ticker, setTicker] = useState<TickerInfo>({
    symbol: 'XAU/USD', bid: 2045.24, ask: 2046.12, lastPrice: 2045.24,
    changePercent: 0.45, volume24h: 1200000, high24h: 2048.10, low24h: 2043.20,
  });

  const initialMarginOfOpenPositions = positions.reduce((sum, pos) => sum + pos.margin, 0);
  const freeMargin = Math.max(0, vaultBalance - initialMarginOfOpenPositions);
  const totalFloatingPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

  const triggerToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  }, []);

  // ── System clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setCurrentSystemTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Initial price fetch (Coinbase PAXG as gold proxy) ────────────────────
  useEffect(() => {
    let active = true;
    async function initRealPrice() {
      setApiStatus('loading');
      try {
        const res = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
        if (!res.ok) throw new Error('rate limited');
        const data = await res.json();
        const basePrice = parseFloat(data?.data?.amount);
        if (active && !isNaN(basePrice) && basePrice > 0) {
          setCurrentSpotPrice(basePrice);
          setPreviousPrice(basePrice - 0.12);
          setApiStatus('connected');
          setCandles(generateInitialCandles(80, basePrice - 4.50, timeframeToMinutes(timeframe)));
          setTicker(prev => ({
            ...prev, lastPrice: basePrice,
            bid: parseFloat((basePrice - 0.44).toFixed(2)),
            ask: parseFloat((basePrice + 0.44).toFixed(2)),
            high24h: parseFloat((basePrice + 12.80).toFixed(2)),
            low24h: parseFloat((basePrice - 8.40).toFixed(2)),
          }));
          return;
        }
      } catch { /* fallback */ }
      if (active) {
        setApiStatus('error');
        const hist = generateInitialCandles(80, 2042.80, timeframeToMinutes(timeframe));
        setCandles(hist);
        const last = hist[hist.length - 1];
        setCurrentSpotPrice(last.close);
        setPreviousPrice(last.close - 0.12);
      }
    }
    initRealPrice();
    return () => { active = false; };
  }, [timeframe]);

  // ── Market tick + order evaluation ───────────────────────────────────────
  useEffect(() => {
    if (!autoTicksEnabled) return;
    const interval = setInterval(() => {
      setCandles(prev => {
        if (prev.length === 0) return prev;
        const drift = (Math.random() - 0.48) * 0.35 * volatilityMultiplier;
        const { updatedCandles, newLastPrice } = simulateTickUpdate(prev, prev[prev.length - 1].close, drift);
        const newPrice = newLastPrice;

        setPreviousPrice(currentSpotPrice);
        setCurrentSpotPrice(newPrice);

        // Update ticker
        setTicker(p => ({
          ...p, lastPrice: newPrice,
          bid: parseFloat((newPrice - 0.44).toFixed(2)),
          ask: parseFloat((newPrice + 0.44).toFixed(2)),
          changePercent: parseFloat(((newPrice - p.low24h) / p.low24h * 100).toFixed(2)),
          high24h: newPrice > p.high24h ? newPrice : p.high24h,
          low24h: newPrice < p.low24h ? newPrice : p.low24h,
        }));

        // Update position PnLs
        setPositions(prev => prev.map(pos => {
          const pnl = pos.side === 'BUY'
            ? (newPrice - pos.entryPrice) * pos.quantity * pos.leverage
            : (pos.entryPrice - newPrice) * pos.quantity * pos.leverage;
          return { ...pos, currentPrice: newPrice, pnl: parseFloat(pnl.toFixed(2)) };
        }));

        // Evaluate pending orders
        setPendingOrders(prevOrders => {
          if (prevOrders.length === 0) return prevOrders;
          const { triggered, remaining } = evaluateOrders(prevOrders, newPrice);
          triggered.forEach(order => {
            if (order.positionId) {
              // It's a stop-loss — close the position
              setPositions(pp => {
                const pos = pp.find(p => p.id === order.positionId);
                if (!pos) return pp;
                const pnl = pos.side === 'BUY'
                  ? (newPrice - pos.entryPrice) * pos.quantity * pos.leverage
                  : (pos.entryPrice - newPrice) * pos.quantity * pos.leverage;
                setVaultBalance(b => parseFloat((b + pos.margin + pnl).toFixed(2)));
                setTradeLogs(tl => tl.map(t => t.id === pos.id
                  ? { ...t, status: 'CLOSED', pnl: parseFloat(pnl.toFixed(2)), closePrice: newPrice, closedAt: new Date().toISOString() }
                  : t));
                setEquityCurve(eq => [...eq, { timestamp: new Date().toISOString(), balance: vaultBalance + pos.margin + pnl }]);
                triggerToast(`Stop-loss ejecutado: ${pos.side} ${pos.quantity}oz | PnL ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, pnl >= 0 ? 'success' : 'error');
                return pp.filter(p => p.id !== order.positionId);
              });
            } else {
              // It's a limit order — open a new position
              const notional = newPrice * order.quantity;
              const margin = notional / order.leverage;
              const liq = calculateLiquidationPrice(order.side, newPrice, order.leverage);
              const newPos: Position = {
                id: `pos-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                side: order.side, symbol: 'XAU/USD',
                quantity: order.quantity, leverage: order.leverage,
                entryPrice: newPrice, currentPrice: newPrice,
                margin, liquidationPrice: liq, pnl: 0,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              };
              setPositions(pp => [...pp, newPos]);
              setVaultBalance(b => parseFloat((b - margin).toFixed(2)));
              setTradeLogs(tl => [{ id: newPos.id, timestamp: newPos.timestamp, side: order.side, price: newPrice, quantity: order.quantity, leverage: order.leverage, status: 'OPEN' }, ...tl]);
              triggerToast(`Límite ejecutado: ${order.side} ${order.quantity}oz @ $${newPrice.toFixed(2)}`, 'success');
            }
          });
          return remaining;
        });

        return updatedCandles;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [autoTicksEnabled, volatilityMultiplier, currentSpotPrice, vaultBalance]);

  // ── Trade execution ───────────────────────────────────────────────────────
  const handleExecuteTrade = useCallback((
    side: OrderSide,
    quantity: number,
    leverage: number,
    price: number,
    orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' = 'MARKET',
    triggerPrice?: number
  ) => {
    if (orderType === 'LIMIT' || orderType === 'STOP_LOSS') {
      const tp = triggerPrice ?? price;
      const order = createPendingOrder(orderType, side, quantity, leverage, tp);
      setPendingOrders(prev => [...prev, order]);
      triggerToast(`Orden ${orderType} registrada @ $${tp.toFixed(2)}`, 'info');
      return;
    }

    // Market order
    const notional = price * quantity;
    const margin = notional / leverage;
    if (margin > freeMargin) {
      triggerToast('Margen insuficiente para esta operación.', 'error');
      return;
    }
    const liq = calculateLiquidationPrice(side, price, leverage);
    const newPos: Position = {
      id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      side, symbol: 'XAU/USD', quantity, leverage,
      entryPrice: price, currentPrice: price,
      margin, liquidationPrice: liq, pnl: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setPositions(prev => [...prev, newPos]);
    setVaultBalance(prev => parseFloat((prev - margin).toFixed(2)));
    setTradeLogs(prev => [{
      id: newPos.id, timestamp: newPos.timestamp,
      side, price, quantity, leverage, status: 'OPEN',
    }, ...prev]);
    triggerToast(`${side} ${quantity}oz XAU/USD @ $${price.toFixed(2)} x${leverage}`, 'success');
  }, [freeMargin, vaultBalance]);

  const handleClosePosition = useCallback((positionId: string) => {
    const pos = positions.find(p => p.id === positionId);
    if (!pos) return;
    const closePnL = pos.pnl;
    setVaultBalance(prev => parseFloat((prev + pos.margin + closePnL).toFixed(2)));
    setPositions(prev => prev.filter(p => p.id !== positionId));
    setTradeLogs(prev => prev.map(t => t.id === positionId
      ? { ...t, status: 'CLOSED', pnl: parseFloat(closePnL.toFixed(2)), closePrice: currentSpotPrice, closedAt: new Date().toISOString() }
      : t));
    setEquityCurve(prev => [...prev, { timestamp: new Date().toISOString(), balance: vaultBalance + pos.margin + closePnL }]);
    triggerToast(`Cerrado: ${pos.side} ${pos.quantity}oz | PnL ${closePnL >= 0 ? '+' : ''}$${closePnL.toFixed(2)}`, closePnL >= 0 ? 'success' : 'error');
  }, [positions, currentSpotPrice, vaultBalance]);

  // Mocked order book
  const mockBidsAsks = generateOrderBook(currentSpotPrice);

  const handleRegenerateMarketFeeds = () => {
    triggerToast('Market feed actualizado.', 'info');
  };

  // Hard reset
  const handleHardReset = () => {
    clearAurumStorage();
    window.location.reload();
  };

  // Market snapshot for Gemini
  const marketSnap = {
    currentPrice: currentSpotPrice,
    changePercent: ticker.changePercent,
    recentCandles: candles.slice(-50),
    positions,
    vaultBalance,
    high24h: ticker.high24h,
    low24h: ticker.low24h,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface font-sans">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          currentSpotPrice={currentSpotPrice}
          previousPrice={previousPrice}
          vaultBalance={vaultBalance}
          freeMargin={freeMargin}
          currentSystemTime={currentSystemTime}
          apiStatus={apiStatus}
          onDepositClick={() => setDepositModalOpen(true)}
        />

        <MarketTicker ticker={ticker} />

        <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Demo banner */}
          {showDemoBanner && (
            <div className="bg-primary/8 border border-primary/20 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-xs flex-wrap">
              <span className="text-on-surface/80 font-medium">
                <span className="text-primary font-bold">AURUM PRO</span> — Persistencia activa · Órdenes condicionales · Gemini AI · Dashboard de rendimiento
              </span>
              <div className="flex items-center gap-3">
                {geminiApiKey && (
                  <button
                    onClick={() => setShowAiPanel(v => !v)}
                    className="flex items-center gap-1.5 text-primary font-bold hover:text-primary/80 cursor-pointer outline-none"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    {showAiPanel ? 'Ocultar IA' : 'Abrir Gemini AI'}
                  </button>
                )}
                <button onClick={() => setShowDemoBanner(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer outline-none"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* ── DASHBOARD VIEW ── */}
          {activeView === 'dashboard' && (
            <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                <TradingChart
                  candles={candles}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  currentSpotPrice={currentSpotPrice}
                />
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 min-w-0">
                    <OrderBook
                      bids={mockBidsAsks.bids}
                      asks={mockBidsAsks.asks}
                      recentFills={tradeLogs}
                      onRefreshFeed={handleRegenerateMarketFeeds}
                      spread={0.88}
                    />
                  </div>
                  <div className="w-full lg:w-auto">
                    <ExecutionPanel
                      currentSpotPrice={currentSpotPrice}
                      freeMargin={freeMargin}
                      onExecuteTrade={handleExecuteTrade}
                    />
                  </div>
                </div>

                {/* Pending orders widget */}
                {pendingOrders.length > 0 && (
                  <div className="glass-panel rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant/30 flex justify-between items-center">
                      <h4 className="font-display font-semibold text-xs text-primary uppercase tracking-wider">
                        Órdenes pendientes ({pendingOrders.length})
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs font-mono">
                        <thead>
                          <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant bg-surface-container-low">
                            <th className="px-4 py-2 text-left">Tipo</th>
                            <th className="px-4 py-2 text-left">Dir.</th>
                            <th className="px-4 py-2 text-right">Vol.</th>
                            <th className="px-4 py-2 text-right">Precio trigger</th>
                            <th className="px-4 py-2 text-right">Lev.</th>
                            <th className="px-4 py-2 text-center">Cancelar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingOrders.map(o => (
                            <tr key={o.id} className="border-b border-outline-variant/15 hover:bg-surface-variant/20">
                              <td className="px-4 py-2 text-on-surface-variant font-semibold">{o.type}</td>
                              <td className={`px-4 py-2 font-bold ${o.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{o.side}</td>
                              <td className="px-4 py-2 text-right">{o.quantity.toFixed(1)} Oz</td>
                              <td className="px-4 py-2 text-right text-primary font-bold">${o.triggerPrice.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right">{o.leverage}x</td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => setPendingOrders(prev => prev.filter(x => x.id !== o.id))}
                                  className="text-on-surface-variant hover:text-red-400 cursor-pointer outline-none"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Panel sidebar */}
              {showAiPanel && geminiApiKey && (
                <div className="w-full xl:w-96 flex-shrink-0 h-full xl:min-h-[600px]">
                  <AiPanel apiKey={geminiApiKey} snap={marketSnap} onClose={() => setShowAiPanel(false)} />
                </div>
              )}
            </div>
          )}

          {/* ── ANALYSIS VIEW ── */}
          {activeView === 'analysis' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="glass-panel p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="font-display font-semibold text-base text-primary uppercase">Gráfico técnico avanzado</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">EMA(9), SMA(20), RSI(14), MACD(12,26,9), Bollinger Bands(20,2σ).</p>
                </div>
                <div className="bg-surface-container border border-outline-variant/35 rounded-lg px-4 py-2 flex gap-6 text-xs font-mono">
                  <div><span className="text-on-surface-variant">Spot:</span> <strong className="text-primary">${currentSpotPrice.toFixed(2)}</strong></div>
                  <div><span className="text-on-surface-variant">24h:</span> <strong className="text-on-surface">${ticker.low24h} – ${ticker.high24h}</strong></div>
                </div>
              </div>
              <div className="flex-1 flex min-h-[500px]">
                <TradingChart candles={candles} timeframe={timeframe} onTimeframeChange={setTimeframe} currentSpotPrice={currentSpotPrice} />
              </div>
            </div>
          )}

          {/* ── TRADES / PORTFOLIO VIEW ── */}
          {activeView === 'trades' && (
            <div className="flex-1 flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel p-4 flex flex-col">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Capital total</span>
                  <span className="font-mono text-xl font-bold text-primary mt-2">${vaultBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase mt-1">VAULT BALANCE</span>
                </div>
                <div className="glass-panel p-4 flex flex-col">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">P&L flotante</span>
                  <span className={`font-mono text-xl font-bold mt-2 ${totalFloatingPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalFloatingPnL >= 0 ? '+' : ''}${totalFloatingPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase mt-1">POSICIONES ABIERTAS</span>
                </div>
                <div className="glass-panel p-4 flex flex-col">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Margen libre</span>
                  <span className="font-mono text-xl font-bold text-on-surface mt-2">${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase mt-1">DISPONIBLE</span>
                </div>
              </div>

              <PositionsList positions={positions} onClosePosition={handleClosePosition} currentSpotPrice={currentSpotPrice} />

              {/* Trade log */}
              <div className="glass-panel rounded-lg overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant/30 flex justify-between items-center">
                  <h4 className="font-display font-semibold text-xs text-primary uppercase tracking-wider">Historial de operaciones</h4>
                  <button
                    onClick={() => setTradeLogs([])}
                    className="text-on-surface-variant hover:text-red-400 font-mono text-[10px] flex items-center gap-1 cursor-pointer outline-none uppercase font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Limpiar
                  </button>
                </div>
                {tradeLogs.length === 0 ? (
                  <div className="p-10 text-center text-xs text-on-surface-variant/60">Sin operaciones registradas.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-left border-b border-outline-variant bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          <th className="px-4 py-3">Hora</th>
                          <th className="px-4 py-3">Símbolo</th>
                          <th className="px-4 py-3 text-center">Dir.</th>
                          <th className="px-4 py-3 text-right">Vol.</th>
                          <th className="px-4 py-3 text-right">Lev.</th>
                          <th className="px-4 py-3 text-right">Precio</th>
                          <th className="px-4 py-3 text-right">PnL</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-xs text-on-surface/90">
                        {tradeLogs.map(log => {
                          const isBuy = log.side === 'BUY';
                          const statusColors =
                            log.status === 'OPEN'       ? 'text-primary/95 bg-primary/5 border border-primary/20' :
                            log.status === 'CLOSED'     ? 'text-green-400 bg-green-400/5 border border-green-400/20' :
                            'text-red-400 bg-red-400/5 border border-red-500/25 animate-pulse';
                          return (
                            <tr key={log.id} className="border-b border-outline-variant/15 hover:bg-surface-variant/25 transition-colors">
                              <td className="px-4 py-2.5 text-on-surface-variant">{log.timestamp}</td>
                              <td className="px-4 py-2.5 font-semibold">XAU/USD</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`text-[9px] font-bold uppercase ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                                  {isBuy ? 'LONG' : 'SHORT'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">{log.quantity.toFixed(1)} Oz</td>
                              <td className="px-4 py-2.5 text-right text-on-surface-variant/90">{log.leverage}x</td>
                              <td className="px-4 py-2.5 text-right">${log.price.toFixed(2)}</td>
                              <td className={`px-4 py-2.5 text-right font-medium ${
                                log.pnl === undefined ? 'text-on-surface-variant/60' :
                                log.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {log.pnl === undefined ? '--' : `${log.pnl >= 0 ? '+' : ''}$${log.pnl.toFixed(2)}`}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`px-2.5 py-0.5 rounded-sm text-[9px] uppercase tracking-wider font-bold ${statusColors}`}>
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PERFORMANCE VIEW ── */}
          {activeView === 'performance' && (
            <PerformanceDashboard tradeLogs={tradeLogs} vaultBalance={vaultBalance} equityCurve={equityCurve} />
          )}

          {/* ── SETTINGS VIEW ── */}
          {activeView === 'settings' && (
            <div className="flex-1 flex flex-col gap-5 max-w-4xl mx-auto w-full">
              <div className="glass-panel p-6 flex flex-col gap-6 rounded-lg">
                <div>
                  <h3 className="font-display font-semibold text-base text-primary uppercase">Configuración del terminal</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Volatilidad, Gemini AI y persistencia de datos.</p>
                </div>

                {/* Volatility */}
                <div className="space-y-3 pt-4 border-t border-outline-variant/20">
                  <span className="font-display text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" /> Simulación de mercado
                  </span>
                  <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-lg space-y-4">
                    <div>
                      <div className="flex justify-between items-center text-xs text-on-surface font-semibold mb-2">
                        <span>Multiplicador de volatilidad</span>
                        <span className="font-mono text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded text-[11px] font-bold">
                          {volatilityMultiplier === 0 ? 'ESTÁTICO' : `${volatilityMultiplier.toFixed(1)}x`}
                        </span>
                      </div>
                      <input type="range" min="0" max="3" step="0.5" value={volatilityMultiplier}
                        onChange={e => setVolatilityMultiplier(parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5 rounded cursor-pointer" />
                      <div className="flex justify-between text-[10px] text-on-surface-variant/60 font-semibold mt-1">
                        <span>Plano (0x)</span><span>Normal (1x)</span><span>Alta volatilidad (3x)</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-on-surface">Ticks automáticos</span>
                      <button
                        onClick={() => setAutoTicksEnabled(v => !v)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer outline-none border ${autoTicksEnabled ? 'bg-primary/30 border-primary/50' : 'bg-surface-container-high border-outline-variant/40'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${autoTicksEnabled ? 'translate-x-4 bg-primary' : 'translate-x-1 bg-on-surface-variant/40'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gemini */}
                <div className="space-y-3 pt-4 border-t border-outline-variant/20">
                  <span className="font-display text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Gemini AI
                  </span>
                  <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-lg text-xs text-on-surface-variant space-y-2">
                    {geminiApiKey ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>API key detectada — Gemini AI activo</span>
                      </div>
                    ) : (
                      <>
                        <p>Configura la variable de entorno <code className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">VITE_GEMINI_API_KEY</code> en el archivo <code className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">.env.local</code> para activar el asistente IA.</p>
                        <p className="font-mono text-[11px] bg-surface-container-high border border-outline-variant/30 rounded p-2">VITE_GEMINI_API_KEY=tu_clave_aqui</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Persistence / Reset */}
                <div className="space-y-3 pt-4 border-t border-outline-variant/20">
                  <span className="font-display text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Coins className="w-4 h-4" /> Datos persistentes
                  </span>
                  <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-lg flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-xs text-on-surface-variant">
                      <p className="mb-1">Posiciones, historial y saldo se guardan automáticamente.</p>
                      <p className="text-green-400/80">● Persistencia activa — los datos sobreviven al recargar</p>
                    </div>
                    <button
                      onClick={handleHardReset}
                      className="flex items-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[11px] font-mono uppercase font-bold px-3 py-2 rounded cursor-pointer outline-none transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Reset completo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border text-xs font-semibold shadow-xl transition-all ${
          toastMessage.type === 'success' ? 'bg-green-900/90 border-green-500/40 text-green-300' :
          toastMessage.type === 'error'   ? 'bg-red-900/90 border-red-500/40 text-red-300' :
          'bg-surface-container border-primary/40 text-primary'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {toastMessage.type === 'error'   && <AlertOctagon className="w-4 h-4" />}
          {toastMessage.type === 'info'    && <Bell className="w-4 h-4" />}
          {toastMessage.text}
        </div>
      )}

      {/* Deposit Modal */}
      {depositModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-display font-semibold text-primary uppercase text-sm mb-4">Depósito de capital</h3>
            <input
              type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant/40 rounded px-3 py-2 text-sm font-mono text-on-surface outline-none focus:border-primary/50 mb-4"
              placeholder="Cantidad en USD"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setVaultBalance(v => v + parseFloat(depositAmount || '0')); setDepositModalOpen(false); triggerToast(`Depósito de $${parseFloat(depositAmount).toLocaleString()} procesado.`, 'success'); }}
                className="flex-1 bg-primary/15 border border-primary/30 hover:bg-primary/25 text-primary text-xs font-bold uppercase py-2 rounded cursor-pointer outline-none transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={() => setDepositModalOpen(false)}
                className="flex-1 bg-surface-container-high border border-outline-variant/30 text-on-surface-variant text-xs font-bold uppercase py-2 rounded cursor-pointer outline-none transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
