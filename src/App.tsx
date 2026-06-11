/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  TrendingUp, 
  Layers, 
  AlertOctagon, 
  X, 
  Coins, 
  CheckCircle2, 
  Sparkles, 
  Sliders, 
  Info, 
  Flame,
  ShieldCheck,
  RotateCcw,
  Globe,
  Wifi
} from 'lucide-react';
import { Candle, Position, TradeLog, TickerInfo, OrderSide } from './types';
import { generateInitialCandles, generateOrderBook, simulateTickUpdate, calculateLiquidationPrice } from './utils/marketSim';

// Import components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MarketTicker from './components/MarketTicker';
import TradingChart from './components/TradingChart';
import OrderBook from './components/OrderBook';
import ExecutionPanel from './components/ExecutionPanel';
import PositionsList from './components/PositionsList';

const timeframeToMinutes = (tf: string): number => {
  switch (tf) {
    case '1M': return 1;
    case '5M': return 5;
    case '15M': return 15;
    case '1H': return 60;
    default: return 5;
  }
};

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [vaultBalance, setVaultBalance] = useState<number>(750000.00);
  const [serverConnected, setServerConnected] = useState<boolean>(true);
  
  // Gold Real API connectivity states
  const [isRealApiActive, setIsRealApiActive] = useState<boolean>(true);
  const [apiStatus, setApiStatus] = useState<'connected' | 'error' | 'loading'>('loading');
  const [currentSystemTime, setCurrentSystemTime] = useState<string>('');

  // Market states initializations - Gold Spot (XAU/USD)
  const [currentSpotPrice, setCurrentSpotPrice] = useState<number>(2045.24);
  const [previousPrice, setPreviousPrice] = useState<number>(2045.20);
  
  const [volatilityMultiplier, setVolatilityMultiplier] = useState<number>(1.0);
  const [timeframe, setTimeframe] = useState<string>('5M');
  const [candles, setCandles] = useState<Candle[]>([]);
  
  // Leveraged portfolio states
  const [positions, setPositions] = useState<Position[]>([]);
  const [depositModalOpen, setDepositModalOpen] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('50000');
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Settings customizable parameters
  const [autoTicksEnabled, setAutoTicksEnabled] = useState<boolean>(true);
  const [showDemoBanner, setShowDemoBanner] = useState<boolean>(true);

  // Initial order book ticker log (Exactly matches mock HTML table timestamps and values)
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([
    { id: 'mock-1', timestamp: '14:25:01', side: 'BUY', price: 2045.24, quantity: 10, leverage: 25, status: 'OPEN' },
    { id: 'mock-2', timestamp: '14:24:58', side: 'BUY', price: 2045.20, quantity: 10, leverage: 25, status: 'OPEN' },
    { id: 'mock-3', timestamp: '14:24:55', side: 'SELL', price: 2045.18, quantity: 15, leverage: 10, status: 'CLOSED' },
    { id: 'mock-4', timestamp: '14:24:10', side: 'BUY', price: 2044.80, quantity: 20, leverage: 5, status: 'CLOSED' },
    { id: 'mock-5', timestamp: '14:23:45', side: 'SELL', price: 2045.10, quantity: 8, leverage: 50, status: 'CLOSED' },
  ]);

  const [ticker, setTicker] = useState<TickerInfo>({
    symbol: 'XAU/USD',
    bid: 2045.24,
    ask: 2046.12,
    lastPrice: 2045.24,
    changePercent: 0.45,
    volume24h: 1200000,
    high24h: 2048.10,
    low24h: 2043.20,
  });

  // Calculate free institutional margin (Balance - total initial margin committed to active trades)
  const initialMarginOfOpenPositions = positions.reduce((sum, pos) => sum + pos.margin, 0);
  const freeMargin = Math.max(0, vaultBalance - initialMarginOfOpenPositions);

  // Trigger Toast Notification Alert
  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Real-time system clock updates
  useEffect(() => {
    setCurrentSystemTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const timer = setInterval(() => {
      setCurrentSystemTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate initial historical data based on spot baseline (resolving live price from Coinbase API)
  useEffect(() => {
    let active = true;
    async function initRealPrice() {
      if (isRealApiActive) {
        setApiStatus('loading');
        try {
          const response = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
          if (!response.ok) throw new Error('API server busy or rate limited');
          const result = await response.json();
          const basePrice = parseFloat(result?.data?.amount);
          
          if (active && !isNaN(basePrice) && basePrice > 0) {
            setCurrentSpotPrice(basePrice);
            setPreviousPrice(basePrice - 0.12);
            setApiStatus('connected');
            
            // Generate historical data scaled around current genuine gold spot price
            const historicalSize = 80;
            const initialHistory = generateInitialCandles(historicalSize, basePrice - 4.50, timeframeToMinutes(timeframe));
            setCandles(initialHistory);
            
            setTicker(prev => ({
              ...prev,
              lastPrice: basePrice,
              bid: parseFloat((basePrice - 0.44).toFixed(2)),
              ask: parseFloat((basePrice + 0.44).toFixed(2)),
              high24h: parseFloat((basePrice + 12.80).toFixed(2)),
              low24h: parseFloat((basePrice - 8.40).toFixed(2))
            }));
            return;
          }
        } catch (err) {
          console.warn('Unable to contact live Coinbase Gold endpoints. Transitioning to fallback simulator.', err);
          if (active) {
            setApiStatus('error');
          }
        }
      }
      
      // Fallback or Simulated Mode
      if (active) {
        const historicalSize = 80;
        const initialHistory = generateInitialCandles(historicalSize, 2042.80, timeframeToMinutes(timeframe));
        setCandles(initialHistory);
        
        const finalCandle = initialHistory[initialHistory.length - 1];
        setCurrentSpotPrice(finalCandle.close);
        setPreviousPrice(finalCandle.close - 0.12);
        
        if (isRealApiActive) {
          setApiStatus('error');
        } else {
          setApiStatus('connected');
        }
      }
    }
    
    initRealPrice();
    return () => {
      active = false;
    };
  }, [timeframe, isRealApiActive]);

  // MARKET TICK INTERVAL - Simulates live fluctuations OR fetches real-time API spot quotes
  useEffect(() => {
    if (!autoTicksEnabled) return;

    // Unified price update handler
    const handlePriceUpdate = (newPrice: number, priceDelta: number) => {
      setPreviousPrice(currentSpotPrice);
      setCurrentSpotPrice(newPrice);

      // Reevaluate standard ticker Bid/Ask spread (around $0.88 standard deviation)
      const bid = parseFloat((newPrice - 0.44).toFixed(2));
      const ask = parseFloat((newPrice + 0.44).toFixed(2));
      
      // Update Daily High/Low parameters
      const newHigh = newPrice > ticker.high24h ? newPrice : ticker.high24h;
      const newLow = newPrice < ticker.low24h ? newPrice : ticker.low24h;

      // Update ticker states
      setTicker(prev => ({
        ...prev,
        lastPrice: newPrice,
        bid,
        ask,
        high24h: newHigh,
        low24h: newLow,
        changePercent: prev.changePercent + (priceDelta / prev.lastPrice) * 100
      }));

      // Update current live candlestick
      if (candles.length > 0) {
        const { updatedCandles } = simulateTickUpdate(candles, newPrice, priceDelta);
        setCandles(updatedCandles);
      }

      // Append random mock institutional orders to ticker desk log (every 3rd tick)
      if (Math.random() > 0.65) {
        const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const randomSide: OrderSide = Math.random() > 0.5 ? 'BUY' : 'SELL';
        const randomQty = parseFloat((5 + Math.random() * 45).toFixed(1));
        const randomLeverage = [5, 10, 25, 50][Math.floor(Math.random() * 4)];
        
        setTradeLogs(prev => [
          {
            id: `fill-${Date.now()}`,
            timestamp: logTime,
            side: randomSide,
            price: newPrice,
            quantity: randomQty,
            leverage: randomLeverage,
            status: 'CLOSED'
          },
          ...prev.slice(0, 50) // keep memory footprint compact
        ]);
      }
    };

    let tickInterval: NodeJS.Timeout | null = null;

    if (isRealApiActive) {
      // API Mode: Polling interval (every 4.5 seconds for fresh, live rates)
      tickInterval = setInterval(async () => {
        try {
          const response = await fetch('https://api.coinbase.com/v2/prices/PAXG-USD/spot');
          if (!response.ok) throw new Error('API server busy');
          const result = await response.json();
          const apiPrice = parseFloat(result?.data?.amount);
          
          if (!isNaN(apiPrice) && apiPrice > 0) {
            setApiStatus('connected');
            const priceDelta = apiPrice - currentSpotPrice;
            // Only update if there is actually a change to avoid zero ticks
            if (priceDelta !== 0) {
              handlePriceUpdate(apiPrice, parseFloat(priceDelta.toFixed(2)));
            } else {
              // Add tiny sub-cent noise to indicate active terminal even on flat API moments
              const tinyDelta = parseFloat(((Math.random() - 0.5) * 0.04).toFixed(2));
              handlePriceUpdate(parseFloat((currentSpotPrice + tinyDelta).toFixed(2)), tinyDelta);
            }
          }
        } catch (err) {
          console.warn('API update failed during live feed, falling back briefly to simulate:', err);
          setApiStatus('error');
          // Brief brownian fallback step during connection drops so terminal doesn't halt
          const fluctuationDirection = Math.random() - 0.48;
          const priceDelta = parseFloat((fluctuationDirection * 0.15 * volatilityMultiplier).toFixed(2));
          const newSpotPrice = parseFloat((currentSpotPrice + priceDelta).toFixed(2));
          handlePriceUpdate(newSpotPrice, priceDelta);
        }
      }, 4500);
    } else {
      // Fully Simulated Mode (every 2.5 seconds)
      tickInterval = setInterval(() => {
        const fluctuationDirection = Math.random() - 0.48; // slight upward drift for gold inflation
        const priceDelta = parseFloat((fluctuationDirection * 0.15 * volatilityMultiplier).toFixed(2));
        const newSpotPrice = parseFloat((currentSpotPrice + priceDelta).toFixed(2));
        handlePriceUpdate(newSpotPrice, priceDelta);
      }, 2500);
    }

    return () => {
      if (tickInterval) clearInterval(tickInterval);
    };
  }, [currentSpotPrice, autoTicksEnabled, volatilityMultiplier, candles, ticker, isRealApiActive]);

  // REAL-TIME DERIVATIVE POSITION LIQUIDATION GUARD
  useEffect(() => {
    if (positions.length === 0) return;

    const checkedPositions = [...positions];
    let isModified = false;
    let totalLiquidationDeductions = 0;

    for (let i = checkedPositions.length - 1; i >= 0; i--) {
      const pos = checkedPositions[i];
      const isBuy = pos.side === 'BUY';
      
      // Test liquidation trigger
      const breachedLong = isBuy && currentSpotPrice <= pos.liquidationPrice;
      const breachedShort = !isBuy && currentSpotPrice >= pos.liquidationPrice;

      if (breachedLong || breachedShort) {
        // LIQUIDATED! Institutional margin is forfeit
        totalLiquidationDeductions += pos.margin;
        checkedPositions.splice(i, 1);
        isModified = true;

        // Log liquidation
        const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setTradeLogs(prev => [
          {
            id: `liq-${Date.now()}-${i}`,
            timestamp: logTime,
            side: pos.side,
            price: currentSpotPrice,
            quantity: pos.quantity,
            leverage: pos.leverage,
            status: 'LIQUIDATED'
          },
          ...prev
        ]);

        triggerToast(`MARGIN CALL: Position ${pos.symbol} ${pos.side} [qty ${pos.quantity}oz] was LIQUIDATED at $${currentSpotPrice.toFixed(2)}.`, 'error');
      }
    }

    if (isModified) {
      setPositions(checkedPositions);
      setVaultBalance(prev => Math.max(0, prev - totalLiquidationDeductions));
    }
  }, [currentSpotPrice, positions]);

  // EXECUTE AN ORDER FROM FORM TICKET
  const handleExecuteTrade = (side: OrderSide, qty: number, leverage: number, price: number) => {
    const notional = price * qty;
    const requiredMargin = notional / leverage;

    if (requiredMargin > freeMargin) {
      triggerToast('Trade rejected: Insufficient free margin in corporate vault.', 'error');
      return;
    }

    // Prepare derivative positions item
    const liquidationVal = calculateLiquidationPrice(side, price, leverage);
    const newPosition: Position = {
      id: `pos-${Date.now()}`,
      side,
      symbol: 'XAU/USD (Spot Gold)',
      quantity: qty,
      leverage,
      entryPrice: price,
      currentPrice: price,
      margin: requiredMargin,
      liquidationPrice: liquidationVal,
      pnl: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setPositions(prev => [...prev, newPosition]);
    
    // Append transaction fill to log ledger
    const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTradeLogs(prev => [
      {
        id: `execution-${Date.now()}`,
        timestamp: logTime,
        side,
        price,
        quantity: qty,
        leverage,
        status: 'OPEN'
      },
      ...prev
    ]);

    triggerToast(`CONTRACT FILLED: Opened ${side} Spot Contract for ${qty} Oz @ $${price.toFixed(2)} [Leverage: ${leverage}x]`, 'success');
  };

  // EXITS / CLOSES POSITION FROM PORTFOLIO
  const handleClosePosition = (id: string, closingPrice: number) => {
    const target = positions.find(pos => pos.id === id);
    if (!target) return;

    // Realize floating profits & losses onto corporate balance sheet
    const isBuy = target.side === 'BUY';
    const delta = closingPrice - target.entryPrice;
    const realizedPnL = isBuy
      ? delta * target.quantity
      : -delta * target.quantity;

    // Return the margin committed + PnL realized (with absolute floor safety)
    const balanceAdjustment = target.margin + realizedPnL;
    
    setVaultBalance(prev => parseFloat(Math.max(0, prev + realizedPnL).toFixed(2)));
    setPositions(prev => prev.filter(pos => pos.id !== id));

    // Append Closed Log
    const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTradeLogs(prev => [
      {
        id: `close-${Date.now()}`,
        timestamp: logTime,
        side: target.side,
        price: closingPrice,
        quantity: target.quantity,
        leverage: target.leverage,
        pnl: realizedPnL,
        status: 'CLOSED'
      },
      ...prev
    ]);

    if (realizedPnL >= 0) {
      triggerToast(`CONTRACT EXITED: Closed ${target.side} Position [qty ${target.quantity}oz]. Realized profit: +$${realizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'success');
    } else {
      triggerToast(`CONTRACT EXITED: Closed ${target.side} Position [qty ${target.quantity}oz]. Realized loss: -$${Math.abs(realizedPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'info');
    }
  };

  // MANUALLY TRIGGER RANDOM FEED REGENERATIONS
  const handleRegenerateMarketFeeds = () => {
    const spread = 0.88;
    const initialHistory = generateInitialCandles(75, 2043.50 + (Math.random() - 0.5) * 8, timeframeToMinutes(timeframe));
    setCandles(initialHistory);
    const lastPrice = initialHistory[initialHistory.length - 1].close;
    setCurrentSpotPrice(lastPrice);
    
    setTicker(prev => ({
      ...prev,
      lastPrice,
      bid: parseFloat((lastPrice - 0.44).toFixed(2)),
      ask: parseFloat((lastPrice + 0.44).toFixed(2)),
      high24h: lastPrice + 4.5,
      low24h: lastPrice - 3.8
    }));

    triggerToast('Institutional quote feeds flushed. Order depth regenerated.', 'success');
  };

  // CAPITAL INJECTION (DEPOSIT MODAL)
  const handleDepositCapital = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(depositAmount);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      setVaultBalance(prev => parseFloat((prev + parsedAmount).toFixed(2)));
      triggerToast(`DEPOSIT RECEIVED: Injected $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD into institutional Desk reserves.`, 'success');
      setDepositModalOpen(false);
    }
  };

  // Demo asset values
  const totalFloatingPnL = positions.reduce((sum, pos) => {
    const isBuy = pos.side === 'BUY';
    const delta = currentSpotPrice - pos.entryPrice;
    return sum + (isBuy ? delta * pos.quantity : -delta * pos.quantity);
  }, 0);

  const mockBidsAsks = generateOrderBook(currentSpotPrice, 0.88, 10);

  return (
    <div className="h-screen w-full flex flex-col bg-background text-on-surface overflow-hidden relative font-sans">
      
      {/* Alert toast notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-bounce shadow-2xl rounded-lg border flex items-start gap-3 p-4 max-w-sm glass-panel text-xs">
          <div className={`p-1.5 rounded-full ${
            toastMessage.type === 'success' ? 'bg-green-500/10 text-green-400' :
            toastMessage.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'
          }`}>
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertOctagon className="w-5 h-5" />}
          </div>
          <div>
            <p className="font-bold uppercase tracking-wider text-primary text-[10px]">AURUM LEDGER MESSAGE</p>
            <p className="text-on-surface-variant/90 leading-relaxed mt-0.5">{toastMessage.text}</p>
          </div>
        </div>
      )}

      {/* Institutional Demo banner warning */}
      {showDemoBanner && (
        <div className="bg-primary/15 border-b border-primary/25 px-4 py-1.5 text-center text-[11px] font-mono select-none text-primary/95 flex justify-between items-center transition-all">
          <div className="flex-1 flex justify-center items-center gap-1.5">
            <Sparkles className="w-4.5 h-4.5 animate-spin text-primary" />
            <span>INSTITUTIONAL SIMULATED ENVIRONMENT - Gold desk allocations are simulated. No live capital is committed.</span>
          </div>
          <button onClick={() => setShowDemoBanner(false)} className="hover:text-white cursor-pointer inline-flex p-0.5 outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navigation */}
      <Header 
        currentView={activeView}
        onViewChange={(view) => setActiveView(view)}
        serverConnected={serverConnected}
        onTradeNowClick={() => triggerToast('Select an order parameters on the right and execute to enter spot contracts!', 'info')}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar navigation */}
        <Sidebar 
          currentView={activeView}
          onViewChange={(view) => setActiveView(view)}
          vaultBalance={vaultBalance}
          freeMargin={freeMargin}
          serverConnected={serverConnected}
          onDepositClick={() => setDepositModalOpen(true)}
          onLogoutClick={() => triggerToast('Exiting terminal session requires high-clearance tokens. Refresh the webpage to restart.', 'error')}
        />

        {/* Dynamic Panel Renders */}
        <div className="flex-1 overflow-y-auto bg-transparent p-4 md:p-6 flex flex-col gap-5">
          
          {/* VIEW RENDER: PANEL 1) MAIN TRADING DASHBOARD (Mock layout exactly mirrored) */}
          {activeView === 'dashboard' && (
            <>
              {/* Gold Ticker Banner */}
              <MarketTicker 
                ticker={ticker}
                previousPrice={previousPrice}
                isRealApiActive={isRealApiActive}
                apiStatus={apiStatus}
              />

              <div className="flex flex-col xl:flex-row gap-5 flex-1 items-stretch">
                {/* Visual Chart core column block */}
                <div className="flex-1 flex flex-col gap-5 min-w-0">
                  <TradingChart 
                    candles={candles}
                    timeframe={timeframe}
                    onTimeframeChange={(tf) => setTimeframe(tf)}
                    currentSpotPrice={currentSpotPrice}
                  />

                  {/* Active derivative contracts list */}
                  <PositionsList 
                    positions={positions}
                    onClosePosition={handleClosePosition}
                    currentSpotPrice={currentSpotPrice}
                  />

                  {/* Order book ledger table list */}
                  <OrderBook 
                    bids={mockBidsAsks.bids}
                    asks={mockBidsAsks.asks}
                    recentFills={tradeLogs}
                    onRefreshFeed={handleRegenerateMarketFeeds}
                    spread={0.88}
                  />
                </div>

                {/* Right desk Execution Ticket panel Form */}
                <div className="w-full xl:w-auto h-full xl:sticky xl:top-0">
                  <ExecutionPanel 
                    currentSpotPrice={currentSpotPrice}
                    freeMargin={freeMargin}
                    onExecuteTrade={handleExecuteTrade}
                  />
                </div>
              </div>
            </>
          )}

          {/* VIEW RENDER: PANEL 2) TECHNICAL CHART ONLY */}
          {activeView === 'analysis' && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="glass-panel p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="font-display font-semibold text-base text-primary uppercase">Advanced charting workshop</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Wide technical drawing canvas for 9-period EMA overlay and 20-period SMA validation.</p>
                </div>
                <div className="bg-surface-container border border-outline-variant/35 rounded-lg px-4 py-2 flex gap-6 text-xs font-mono">
                  <div>
                    <span className="text-on-surface-variant">Live Spot:</span>{' '}
                    <strong className="text-primary">${currentSpotPrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-on-surface-variant">24h Range:</span>{' '}
                    <strong className="text-on-surface">${ticker.low24h} - ${ticker.high24h}</strong>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex min-h-[500px]">
                <TradingChart 
                  candles={candles}
                  timeframe={timeframe}
                  onTimeframeChange={(tf) => setTimeframe(tf)}
                  currentSpotPrice={currentSpotPrice}
                />
              </div>
            </div>
          )}

          {/* VIEW RENDER: PANEL 3) PORTFOLIO & AUDITOR LEDGER LOGS */}
          {activeView === 'trades' && (
            <div className="flex-1 flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Stat block 1 */}
                <div className="glass-panel p-4 flex flex-col">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Simulated capital reserves</span>
                  <span className="font-mono text-xl md:text-2xl font-bold text-primary mt-2">
                    ${vaultBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase mt-1">TOTAL INSTITUTIONAL NET POSITION</span>
                </div>
                
                {/* Stat block 2 */}
                <div className="glass-panel p-4 flex flex-col">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Unrealized profit/losses</span>
                  <span className={`font-mono text-xl md:text-2xl font-bold mt-2 ${totalFloatingPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalFloatingPnL >= 0 ? '+' : ''}
                    ${totalFloatingPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase mt-1">FLOATING METALS VALUATION</span>
                </div>

                {/* Stat block 3 */}
                <div className="glass-panel p-4 flex flex-col">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Available free margin</span>
                  <span className="font-mono text-xl md:text-2xl font-bold text-on-surface mt-2">
                    ${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase mt-1">RESERVES LIQUIDITY RATIO</span>
                </div>
              </div>

              {/* Focus list on active positions */}
              <PositionsList 
                positions={positions}
                onClosePosition={handleClosePosition}
                currentSpotPrice={currentSpotPrice}
              />

              {/* Complete transaction ledger audit history */}
              <div className="glass-panel rounded-lg overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant/30 flex justify-between items-center">
                  <h4 className="font-display font-semibold text-xs text-primary uppercase tracking-wider">Institutional desk executions history audit</h4>
                  <button 
                    onClick={() => {
                      setTradeLogs([]);
                      triggerToast('Audit traces reset.', 'success');
                    }}
                    className="text-on-surface-variant hover:text-red-400 font-mono text-[10px] flex items-center gap-1 cursor-pointer outline-none uppercase font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear desk trace
                  </button>
                </div>
                {tradeLogs.length === 0 ? (
                  <div className="p-10 text-center text-xs text-on-surface-variant/60 font-medium">No order traces recorded in this cycle. Execute spot contracts to record logs.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-left border-b border-outline-variant bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          <th className="px-4 py-3 font-display">TIMESTAMP</th>
                          <th className="px-4 py-3 font-display">SYMBOL</th>
                          <th className="px-4 py-3 font-display text-center">TYPE</th>
                          <th className="px-4 py-3 font-display text-right">VOLUME SIZE</th>
                          <th className="px-4 py-3 font-display text-right">LEVERAGE CODE</th>
                          <th className="px-4 py-3 font-display text-right">FILL QUOTE</th>
                          <th className="px-4 py-3 font-display text-right">REALISED TRADING NET PnL</th>
                          <th className="px-4 py-3 font-display text-center">AUDIT STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-xs text-on-surface/90">
                        {tradeLogs.map((log) => {
                          const isBuy = log.side === 'BUY';
                          const statusColors = 
                            log.status === 'OPEN' ? 'text-primary/95 bg-primary/5 border border-primary/20' :
                            log.status === 'CLOSED' ? 'text-green-400 bg-green-400/5 border border-green-400/20' :
                            'text-red-400 bg-red-400/5 border border-red-500/25 animate-pulse';

                          return (
                            <tr key={log.id} className="border-b border-outline-variant/15 hover:bg-surface-variant/25 transition-colors t-num">
                              <td className="px-4 py-2.5 text-on-surface-variant">{log.timestamp}</td>
                              <td className="px-4 py-2.5 text-on-surface font-semibold">XAU/USD</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                                  {isBuy ? 'LONG' : 'SHORT'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">{log.quantity.toFixed(1)} Oz</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-on-surface-variant/90">{log.leverage}x</td>
                              <td className="px-4 py-2.5 text-right">${log.price.toFixed(2)}</td>
                              <td className={`px-4 py-2.5 text-right font-medium ${
                                log.pnl === undefined ? 'text-on-surface-variant/60' :
                                log.pnl >= 0 ? 'text-green-450 text-green-400' : 'text-red-400'
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

          {/* VIEW RENDER: PANEL 4) TERMINAL SETTINGS CONTROLS */}
          {activeView === 'settings' && (
            <div className="flex-1 flex flex-col gap-5 max-w-4xl mx-auto w-full">
              <div className="glass-panel p-6 flex flex-col gap-6 rounded-lg select-none">
                <div>
                  <h3 className="font-display font-semibold text-base text-primary uppercase">Terminal Operations settings</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Configure live simulated Brownian random-walk drift triggers and corporate desk liquidity presets.</p>
                </div>
                
                {/* Volatility Settings */}
                <div className="space-y-3 pt-4 border-t border-outline-variant/20">
                  <span className="font-display text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" /> Gold spot quote simulated variables setup
                  </span>
                  
                  <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-lg space-y-4">
                    <div>
                      <div className="flex justify-between items-center text-xs text-on-surface font-semibold mb-2">
                        <span>Volatility multiplier</span>
                        <span className="font-mono text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded text-[11px] font-bold">
                          {volatilityMultiplier === 0 ? 'STATIC' : `${volatilityMultiplier.toFixed(1)}x Vol`}
                        </span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="3"
                        step="0.5"
                        value={volatilityMultiplier}
                        onChange={(e) => setVolatilityMultiplier(parseFloat(e.target.value))}
                        className="w-full accent-primary bg-background h-1.5 rounded cursor-pointer border border-outline-variant/20 focus:outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-on-surface-variant/60 font-semibold mt-1">
                        <span>Static Flat (0x)</span>
                        <span>Low Noise (0.5x - 1x)</span>
                        <span>High Volatility / Interest Rate News Shocks (2.5x - 3x)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-outline-variant/15 pt-3">
                      <div className="text-xs text-on-surface-variant flex flex-col gap-0.5 pr-4">
                        <span className="font-bold text-on-surface">Auto Tick Generation</span>
                        <span>Enables constant quotes updates. Disable to stop the charts from ticking live.</span>
                      </div>
                      <button 
                        onClick={() => setAutoTicksEnabled(!autoTicksEnabled)}
                        className={`font-semibold text-[11px] p-2 rounded px-4 font-mono font-bold uppercase transition-all cursor-pointer outline-none border ${
                          autoTicksEnabled 
                            ? 'bg-green-500/15 border-green-500/35 text-green-400' 
                            : 'bg-red-500/15 border-red-500/35 text-red-500'
                        }`}
                      >
                        {autoTicksEnabled ? 'LIVE FEED ACTIVE' : 'FEED PAUSED'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Real-World API Synchronization Settings */}
                <div className="space-y-3 pt-4 border-t border-outline-variant/20">
                  <span className="font-display text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Globe className="w-4 h-4" /> Live Market API Integration Desk
                  </span>
                  
                  <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-lg space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="text-xs text-on-surface-variant flex flex-col gap-0.5">
                        <span className="font-bold text-on-surface">Data Feed Source Selection</span>
                        <span>Choose whether prices derive from real-time physical spot metal backing or our Brownian mock engine.</span>
                      </div>
                      
                      <div className="flex bg-background border border-outline-variant p-0.5 rounded-sm text-[10px] uppercase font-bold tracking-wider">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRealApiActive(false);
                            triggerToast('Switched to Aurum Brownian-Walk Simulation Engine.', 'info');
                          }}
                          className={`px-3 py-1.5 cursor-pointer rounded-xs transition-colors ${
                            !isRealApiActive ? 'bg-primary text-on-primary font-black' : 'text-on-surface-variant hover:text-on-surface font-bold'
                          }`}
                        >
                          Simulator
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRealApiActive(true);
                            triggerToast('Establishing Link to Live Coinbase API Gold Feed...', 'success');
                          }}
                          className={`px-3 py-1.5 cursor-pointer rounded-xs transition-colors flex items-center gap-1 ${
                            isRealApiActive ? 'bg-primary text-on-primary font-black' : 'text-on-surface-variant hover:text-on-surface font-bold'
                          }`}
                        >
                          Coinbase API (PAXG)
                        </button>
                      </div>
                    </div>

                    {isRealApiActive && (
                      <div className="border-t border-outline-variant/15 pt-3.5 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-on-surface-variant">API Channel Status:</span>
                          <span className={`px-2.5 py-0.5 font-mono text-[10px] font-bold rounded-sm uppercase flex items-center gap-1.5 border ${
                            apiStatus === 'connected' 
                              ? 'bg-green-500/10 border-green-500/25 text-green-400' 
                              : apiStatus === 'loading'
                                ? 'bg-primary/10 border-primary/25 text-primary animate-pulse'
                                : 'bg-red-500/10 border-red-500/25 text-red-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              apiStatus === 'connected' 
                                ? 'bg-green-400 animate-pulse' 
                                : apiStatus === 'loading'
                                  ? 'bg-primary animate-pulse'
                                  : 'bg-red-400'
                            }`}></span>
                            {apiStatus === 'connected' ? 'LIVE DEEP SYNC - 200 OK' : apiStatus === 'loading' ? 'RESOLVING GATEWAY...' : 'API SECURE FALLBACK'}
                          </span>
                        </div>
                        
                        <div className="p-3 bg-background/40 border border-outline-variant/15 text-[11px] text-on-surface-variant rounded space-y-1.5 leading-relaxed">
                          <p>
                            <strong className="text-primary uppercase tracking-wide">Secure Spot Resolution:</strong> This terminal connects directly via secure JSON request pipelines to <code className="text-on-surface font-mono font-medium">api.coinbase.com/v2/prices/PAXG-USD/spot</code>. 
                          </p>
                          <p>
                            PAX Gold (PAXG) currency spot vectors are backed 1:1 by one fine troy ounce of London Good Delivery gold, delivering physical gold rates with absolute transparency and zero brokerage commissions.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Risk Management Configuration */}
                <div className="space-y-3 pt-4 border-t border-outline-variant/35">
                  <span className="font-display text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Institutional risk limits protection
                  </span>
                  <div className="p-4 bg-surface-container border border-outline-variant/30 rounded-lg space-y-2 text-xs text-on-surface-variant leading-relaxed">
                    <div className="flex justify-between border-b border-outline-variant/15 pb-2">
                      <span className="font-semibold text-on-surface">Leverage Desk Cap limit:</span>
                      <span className="font-mono text-primary font-bold">50.00x Maximum</span>
                    </div>
                    <div className="flex justify-between border-b border-outline-variant/15 pb-2">
                      <span className="font-semibold text-on-surface">Margin Maintenance limit:</span>
                      <span className="font-mono text-red-400 font-bold">90% of Required Margin</span>
                    </div>
                    <div className="flex justify-between col-span-2 pt-1 text-[11px]">
                      <span>Institutional traders must lock sufficient collateral in the vault. Maintenance procedures run every 2500ms synchronous with quote engine updates.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-outline-variant/35 bg-surface-container-low px-4 md:px-10 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] font-black shrink-0 relative z-30 select-none">
        <div className="flex gap-6 flex-wrap leading-none">
          <span className="text-on-surface-variant">API Sync Feed: <span className={isRealApiActive ? "text-green-500 font-black animate-pulse" : "text-primary"}>{isRealApiActive ? "CONNECTED LIVE" : "SIMULATION"}</span></span>
          <span className="hidden md:inline text-on-surface-variant">Source Protocol: <span className="text-on-surface">{isRealApiActive ? "Coinbase PAXG-USD Spot Feed" : "Simulated Brownian-Walk Engine"}</span></span>
          <span className="hidden sm:inline text-on-surface-variant">API Gateway: <span className="text-green-500 font-mono">14ms TLS v1.3</span></span>
        </div>
        <div className="text-on-surface-variant">
          SYSTEM CLOCK: <span className="text-on-surface font-mono font-bold">{currentSystemTime}</span> • 22 MAY 2026
        </div>
      </footer>

      {/* DEPOSIT RESERVE FUNDS DIALOG/MODAL */}
      {depositModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#060f16]/85 backdrop-filter backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel p-5 md:p-6 rounded-lg text-xs relative select-none animate-bounce">
            <button
              onClick={() => setDepositModalOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-white cursor-pointer outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 bg-primary/10 border border-primary/30 text-primary rounded-full flex items-center justify-center mb-4">
              <Coins className="w-5.5 h-5.5" />
            </div>

            <h3 className="font-display font-semibold text-base text-primary uppercase mb-1">
              Deposit simulated reserves
            </h3>
            <p className="text-on-surface-variant leading-relaxed mb-4">
              Inject instant simulated funds into your institutional vault to expand your leverage margin limits.
            </p>

            <form onSubmit={handleDepositCapital} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Deposit amount (USD)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="5000000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="bg-surface-container-lowest border border-outline-variant rounded p-3 text-sm font-mono font-bold text-primary focus:outline-none focus:border-primary w-full text-center select-text"
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {['25000', '100000', '500000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className="py-1.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/35 font-mono text-center cursor-pointer transition-colors rounded-xs text-[11px] font-semibold"
                  >
                    +${parseInt(amt).toLocaleString()}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-on-primary py-3 font-bold uppercase tracking-wider text-[11px] hover:bg-primary/95 transition-all active:scale-[0.98] cursor-pointer rounded-xs"
              >
                CONFIRM INJECTION
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
