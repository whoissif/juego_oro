/**
 * PerformanceDashboard.tsx — Equity curve + portfolio metrics + CSV export.
 */
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Award, Download, Activity } from 'lucide-react';
import { TradeLog, EquityPoint } from '../types';

interface Props {
  tradeLogs: TradeLog[];
  vaultBalance: number;
  equityCurve: EquityPoint[];
}

function computeMetrics(logs: TradeLog[], currentBalance: number) {
  const closed = logs.filter(l => l.status === 'CLOSED' && l.pnl !== undefined);
  const winners = closed.filter(l => (l.pnl ?? 0) > 0);
  const losers  = closed.filter(l => (l.pnl ?? 0) <= 0);
  const winRate = closed.length ? (winners.length / closed.length) * 100 : 0;
  const avgWin  = winners.length ? winners.reduce((s, l) => s + (l.pnl ?? 0), 0) / winners.length : 0;
  const avgLoss = losers.length  ? losers.reduce((s,  l) => s + (l.pnl ?? 0), 0) / losers.length  : 0;
  const totalPnL = closed.reduce((s, l) => s + (l.pnl ?? 0), 0);
  return { closed: closed.length, winRate, avgWin, avgLoss, totalPnL, winners: winners.length, losers: losers.length };
}

function exportCSV(logs: TradeLog[]) {
  const closed = logs.filter(l => l.status === 'CLOSED');
  const header = 'Timestamp,Symbol,Side,Quantity(oz),Leverage,Entry Price,Close Price,PnL,Status\n';
  const rows = closed.map(l =>
    [l.timestamp, 'XAU/USD', l.side, l.quantity.toFixed(2), l.leverage,
     l.price.toFixed(2), (l.closePrice ?? l.price).toFixed(2),
     (l.pnl ?? 0).toFixed(2), l.status].join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'aurum_trades.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function PerformanceDashboard({ tradeLogs, vaultBalance, equityCurve }: Props) {
  const m = useMemo(() => computeMetrics(tradeLogs, vaultBalance), [tradeLogs, vaultBalance]);

  // SVG equity curve
  const curve = useMemo(() => {
    if (equityCurve.length < 2) return null;
    const values = equityCurve.map(p => p.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const W = 600; const H = 100;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 10) - 5;
      return `${x},${y}`;
    });
    const positive = values[values.length - 1] >= values[0];
    return { pts: pts.join(' '), color: positive ? '#3dbf7a' : '#e05555', min, max, last: values[values.length - 1] };
  }, [equityCurve]);

  const statCard = (label: string, value: string, sub?: string, accent?: string) => (
    <div className="glass-panel p-4 flex flex-col gap-1">
      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-display">{label}</span>
      <span className={`font-mono text-lg font-bold ${accent ?? 'text-on-surface'}`}>{value}</span>
      {sub && <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase">{sub}</span>}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col gap-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCard('Total operaciones', m.closed.toString(), 'CERRADAS')}
        {statCard('Win rate', `${m.winRate.toFixed(1)}%`, `${m.winners}W / ${m.losers}L`,
          m.winRate >= 50 ? 'text-green-400' : 'text-red-400')}
        {statCard('P&L neto', `${m.totalPnL >= 0 ? '+' : ''}$${m.totalPnL.toFixed(2)}`, 'REALIZADO',
          m.totalPnL >= 0 ? 'text-green-400' : 'text-red-400')}
        {statCard('Promedio ganancia', `+$${m.avgWin.toFixed(2)}`, `PÉRD. PROM. $${Math.abs(m.avgLoss).toFixed(2)}`)}
      </div>

      {/* Equity curve */}
      <div className="glass-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-xs text-primary uppercase tracking-wider">Curva de capital</span>
          </div>
          {curve && (
            <span className="font-mono text-xs text-on-surface-variant">
              ${curve.min.toFixed(0)} – ${curve.max.toFixed(0)}
            </span>
          )}
        </div>

        {curve ? (
          <div className="overflow-x-auto">
            <svg viewBox="0 0 600 110" className="w-full" style={{ minWidth: 280 }}>
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map(f => (
                <line key={f} x1={0} y1={f * 100 + 5} x2={600} y2={f * 100 + 5}
                  stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              ))}
              {/* Area fill */}
              <defs>
                <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={curve.color} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={curve.color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon
                points={`0,105 ${curve.pts} 600,105`}
                fill="url(#eq-fill)"
              />
              {/* Line */}
              <polyline
                points={curve.pts}
                fill="none"
                stroke={curve.color}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              {/* Last point dot */}
              {(() => {
                const lastPt = curve.pts.split(' ').pop()!.split(',');
                return <circle cx={parseFloat(lastPt[0])} cy={parseFloat(lastPt[1])} r={3} fill={curve.color} />;
              })()}
            </svg>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-xs text-on-surface-variant/50">
            Ejecuta y cierra operaciones para ver la evolución del capital.
          </div>
        )}
      </div>

      {/* Export button */}
      {tradeLogs.some(l => l.status === 'CLOSED') && (
        <div className="flex justify-end">
          <button
            onClick={() => exportCSV(tradeLogs)}
            className="flex items-center gap-2 bg-surface-container border border-outline-variant/40 hover:border-primary/40 text-on-surface-variant hover:text-primary text-xs font-mono uppercase tracking-wider px-4 py-2 rounded cursor-pointer transition-colors outline-none"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar historial CSV
          </button>
        </div>
      )}

      {m.closed === 0 && (
        <div className="glass-panel p-10 text-center text-xs text-on-surface-variant/50">
          Abre y cierra posiciones para ver métricas de rendimiento.
        </div>
      )}
    </div>
  );
}
