/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Bell, Wifi, User, Compass, TrendingUp, History, Info } from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
  serverConnected: boolean;
  onTradeNowClick: () => void;
}

export default function Header({
  currentView,
  onViewChange,
  serverConnected,
  onTradeNowClick,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const navItems = [
    { id: 'dashboard', label: 'Markets', icon: Compass },
    { id: 'analysis', label: 'Assets', icon: TrendingUp },
    { id: 'trades', label: 'Activity', icon: History },
  ];

  return (
    <header className="z-50 relative border-b border-outline-variant bg-surface-container-low flex justify-between items-center px-4 md:px-10 w-full h-16">
      <div className="flex items-center gap-6 md:gap-10">
        <h1 
          onClick={() => onViewChange('dashboard')}
          className="font-display text-2xl md:text-3xl font-black tracking-tighter text-primary uppercase cursor-pointer select-none hover:opacity-90 transition-opacity"
        >
          Aureus<span className="text-white font-light lowercase">Terminal</span>
        </h1>
        
        <nav className="hidden md:flex gap-8 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.25em] cursor-pointer border-b transition-all active:opacity-80 outline-none ${
                  isActive
                    ? 'text-primary border-primary font-black'
                    : 'text-on-surface-variant border-transparent hover:text-on-surface hover:border-outline-variant/50'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Field */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface-container text-body-sm text-on-surface placeholder-on-surface-variant/50 pl-10 pr-4 py-1.5 border border-outline-variant focus:outline-none focus:border-primary w-64 rounded text-xs select-text"
            placeholder="Search Instruments (e.g., XAU, USD)..."
          />
        </div>

        {/* Trade Now Quick Trigger */}
        <button
          onClick={onTradeNowClick}
          className="bg-primary text-on-primary px-4 py-2 font-bold uppercase tracking-wider text-[11px] hover:bg-primary/90 transition-all active:scale-95 cursor-pointer rounded-sm"
        >
          Trade Now
        </button>

        {/* Network and Profile Indicators */}
        <div className="flex items-center gap-2 md:gap-4">
          <span className="hidden sm:inline text-[10px] font-mono font-bold tracking-wider text-green-500 bg-green-500/5 px-2.5 py-1 border border-green-500/10 rounded">
            ● SERVER LIVE: 14ms
          </span>

          <button 
            title="Notifications"
            className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer relative"
          >
            <Bell className="w-4 h-4 md:w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
          </button>
          
          <button 
            title={serverConnected ? 'Live Market Feed Connected' : 'Market Feed Offline'}
            className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <Wifi className={`w-4 h-4 md:w-5 h-5 ${serverConnected ? 'text-primary' : 'text-red-500 animate-pulse'}`} />
          </button>

          <div className="h-4 w-px bg-outline-variant hidden sm:block"></div>

          <button 
            title="Institutional Account Settings"
            className="p-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <User className="w-4 h-4 md:w-5 h-5 text-primary" />
            <span className="hidden sm:inline text-xs text-on-surface-variant font-semibold tracking-wide">AUREUS_MD_01</span>
          </button>
        </div>
      </div>
    </header>
  );
}
