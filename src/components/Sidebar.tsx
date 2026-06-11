/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  History, 
  Settings, 
  Wallet, 
  HelpCircle, 
  LogOut, 
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  vaultBalance: number;
  freeMargin: number;
  serverConnected: boolean;
  onDepositClick: () => void;
  onLogoutClick: () => void;
}

export default function Sidebar({
  currentView,
  onViewChange,
  vaultBalance,
  freeMargin,
  serverConnected,
  onDepositClick,
  onLogoutClick,
}: SidebarProps) {
  
  const navLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analysis', label: 'Technical Analysis', icon: TrendingUp },
    { id: 'trades', label: 'Positions & Logs', icon: History },
    { id: 'settings', label: 'Terminal Settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col h-full py-6 bg-surface-container border-r border-outline-variant w-64 select-none shrink-0">
      
      {/* Institutional Wallet Metadata */}
      <div className="px-4 mb-6">
        <div className="p-3.5 bg-surface-container-low border border-outline-variant/30 rounded-lg">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 bg-primary/10 border border-primary/30 rounded flex items-center justify-center text-primary">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display font-bold text-xs uppercase tracking-wider text-primary">INSTITUTIONAL DESK</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${serverConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">
                  {serverConnected ? 'Live Connection' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-1.5 pt-1.5 border-t border-outline-variant/20">
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface-variant">Vault Balance:</span>
              <span className="text-primary font-mono font-semibold t-num">
                ${vaultBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface-variant">Free Margin:</span>
              <span className="text-on-surface font-mono t-num">
                ${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Sidebar Links */}
      <nav className="flex-1 space-y-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = currentView === link.id;
          return (
            <button
              key={link.id}
              onClick={() => onViewChange(link.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 text-sm font-semibold tracking-wide transition-all cursor-pointer outline-none text-left border-l-4 ${
                isActive
                  ? 'text-primary border-primary bg-primary/5 font-bold'
                  : 'text-on-surface-variant border-transparent hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              <span className="font-display text-xs uppercase tracking-wider">{link.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Deposit Funds CTA */}
      <div className="px-4 mb-6">
        <button
          onClick={onDepositClick}
          className="w-full bg-primary/10 text-primary py-2.5 font-display text-xs font-bold uppercase tracking-wider border border-primary hover:bg-primary hover:text-on-primary transition-all active:scale-95 cursor-pointer rounded-sm"
        >
          Deposit Funds
        </button>
      </div>

      {/* Terminal Footer Actions */}
      <footer className="border-t border-outline-variant/50 pt-4">
        <button 
          onClick={() => onViewChange('support')}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer text-left"
        >
          <HelpCircle className="w-4.5 h-4.5 text-on-surface-variant" />
          <span className="font-display uppercase tracking-wider">Support Docs</span>
        </button>
        
        <button
          onClick={onLogoutClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer text-left"
        >
          <LogOut className="w-4.5 h-4.5 text-on-surface-variant" />
          <span className="font-display uppercase tracking-wider">Exit Terminal</span>
        </button>
      </footer>
    </aside>
  );
}
