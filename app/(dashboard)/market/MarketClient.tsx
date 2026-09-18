"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import TopNav from '@/components/TopNav';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Activity,
  ArrowUpRight,
  Layers,
  Flame,
  LogIn,
} from 'lucide-react';

export interface MarketCreator {
  id: string;
  channelName: string;
  ticker: string;
  currentPrice: number;
  ipoPrice: number;
  totalShares: string;
  floatShares: string;
  marketCap: number;
  changePercent: number;
  latestScore?: number;
  createdAt: string;
}

export interface MarketTrade {
  id: string;
  creator: { channelName: string };
  quantity: number;
  price: number;
  executedAt: string;
}

export interface MarketHolding {
  id: string;
  creatorId: string;
  name: string;
  ticker: string;
  quantity: number;
  value: number;
  pnlPercent: number;
}

interface MarketClientProps {
  initialCreators: MarketCreator[];
  initialTrades: MarketTrade[];
  user: { email: string; walletBalance: string } | null;
  initialHoldings: MarketHolding[];
  initialTotalValue: number;
  sort: string;
}

export default function MarketClient({
  initialCreators,
  initialTrades,
  user,
  initialHoldings,
  initialTotalValue,
  sort,
}: MarketClientProps) {
  const [creators, setCreators] = useState<MarketCreator[]>(initialCreators);
  const [recentTrades, setRecentTrades] = useState<MarketTrade[]>(initialTrades);
  const [priceFlashes, setPriceFlashes] = useState<Record<string, 'up' | 'down' | null>>({});

  // Connect to global market WebSocket feed
  useEffect(() => {
    const socket = io({ path: '/socket.io' });

    socket.on('connect', () => {
      socket.emit('subscribe_market');
    });

    socket.on('global_trade', (trade: {
      id: string;
      creatorId: string;
      channelName: string;
      price: number;
      quantity: number;
      executedAt: number;
    }) => {
      // 1. Prepend new trade to live Exchange Tape
      setRecentTrades((prev) => [
        {
          id: trade.id,
          creator: { channelName: trade.channelName },
          quantity: trade.quantity,
          price: trade.price,
          executedAt: new Date(trade.executedAt).toISOString(),
        },
        ...prev,
      ].slice(0, 8));

      // 2. Update Creator price & compute flash
      setCreators((prev) =>
        prev.map((c) => {
          if (c.id === trade.creatorId) {
            const oldPrice = c.currentPrice;
            const ipoPrice = c.ipoPrice || 1;
            const changePercent = ((trade.price - ipoPrice) / ipoPrice) * 100;
            const marketCap = trade.price * Number(c.totalShares);

            // Flash badge
            setPriceFlashes((f) => ({
              ...f,
              [trade.creatorId]: trade.price >= oldPrice ? 'up' : 'down',
            }));

            setTimeout(() => {
              setPriceFlashes((f) => ({ ...f, [trade.creatorId]: null }));
            }, 1200);

            return {
              ...c,
              currentPrice: trade.price,
              marketCap,
              changePercent,
            };
          }
          return c;
        })
      );
    });

    return () => {
      socket.emit('unsubscribe_market');
      socket.disconnect();
    };
  }, []);

  // Sorted creators based on current live state & active filter tab
  const sortedCreators = useMemo(() => {
    return [...creators].sort((a, b) => {
      if (sort === 'gainers') return b.changePercent - a.changePercent;
      if (sort === 'score') return (b.latestScore || 0) - (a.latestScore || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [creators, sort]);

  // Aggregate Market Stats dynamically recalculated on live ticks
  const totalMarketCap = useMemo(() => {
    return creators.reduce((sum, c) => sum + (c.currentPrice * Number(c.totalShares)), 0);
  }, [creators]);

  const topGainer = useMemo(() => {
    return [...creators].sort((a, b) => b.changePercent - a.changePercent)[0];
  }, [creators]);

  // Real-time calculated holdings value based on latest creator prices
  const { liveHoldings, liveTotalValue } = useMemo(() => {
    let totalVal = 0;
    const priceMap = new Map(creators.map((c) => [c.id, c.currentPrice]));

    const updated = initialHoldings.map((h) => {
      const currentPrice = priceMap.get(h.creatorId) ?? (h.value / (h.quantity || 1));
      const val = currentPrice * h.quantity;
      totalVal += val;
      return {
        ...h,
        value: val,
      };
    });

    return { liveHoldings: updated, liveTotalValue: totalVal };
  }, [creators, initialHoldings]);

  return (
    <div className="flex w-full h-full bg-[#08080a] text-zinc-100">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
        <TopNav />

        {/* Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Market Hero Telemetry Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm relative overflow-hidden group hover:border-white/[0.12] transition-all">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-mono mb-2">
                <span>TOTAL MARKET CAP</span>
                <Activity size={14} className="text-zinc-400" />
              </div>
              <p className="text-2xl font-mono font-bold text-white tracking-tight">
                ${totalMarketCap > 1000000
                  ? (totalMarketCap / 1000000).toFixed(2) + 'M'
                  : totalMarketCap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] font-mono text-zinc-500 mt-1">Across all listed creator equities</p>
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] rounded-full blur-xl pointer-events-none" />
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm relative overflow-hidden group hover:border-white/[0.12] transition-all">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-mono mb-2">
                <span>ACTIVE LISTINGS</span>
                <Layers size={14} className="text-zinc-400" />
              </div>
              <p className="text-2xl font-mono font-bold text-white tracking-tight">
                {creators.length} <span className="text-xs text-zinc-500 font-normal">CHANNELS</span>
              </p>
              <p className="text-[11px] font-mono text-emerald-400/80 mt-1">Live WebSocket Ticker Active</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm relative overflow-hidden group hover:border-white/[0.12] transition-all">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-mono mb-2">
                <span>TOP PERFORMER</span>
                <Flame size={14} className="text-amber-400" />
              </div>
              <p className="text-lg font-semibold text-white truncate">
                {topGainer ? topGainer.channelName : '—'}
              </p>
              <p className="text-[11px] font-mono text-emerald-400 mt-1 font-semibold">
                {topGainer
                  ? `${topGainer.changePercent >= 0 ? '+' : ''}${topGainer.changePercent.toFixed(2)}% Session`
                  : 'No data'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm relative overflow-hidden group hover:border-white/[0.12] transition-all">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-mono mb-2">
                <span>ORDER ENGINE</span>
                <Sparkles size={14} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-mono font-bold text-white tracking-tight">
                FIFO <span className="text-xs text-emerald-400 font-normal">Streaming</span>
              </p>
              <p className="text-[11px] font-mono text-zinc-500 mt-1">Real-time Global Executions</p>
            </div>
          </div>

          {/* Section Header & Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white tracking-tight">Listed Creator Equities</h2>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Feeds
                </span>
              </div>
              <p className="text-xs text-zinc-500">Live order books backed by continuous liquidity.</p>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Link
                href="?sort=recent"
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  sort === 'recent' ? 'bg-white/[0.1] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Recent IPOs
              </Link>
              <Link
                href="?sort=gainers"
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  sort === 'gainers'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Top Gainers
              </Link>
              <Link
                href="?sort=score"
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  sort === 'score'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Highest Valuation Score
              </Link>
            </div>
          </div>

          {/* Creator Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sortedCreators.length === 0 ? (
              <div className="col-span-full py-16 text-center border border-white/[0.06] border-dashed rounded-2xl bg-white/[0.01]">
                <p className="text-sm text-zinc-400 font-medium mb-1">No channels found</p>
                <p className="text-xs text-zinc-600">Launch a creator IPO from the Studio to start trading.</p>
              </div>
            ) : (
              sortedCreators.map((creator) => {
                const formattedPrice = creator.currentPrice.toFixed(2);
                const formattedMarketCap =
                  creator.marketCap > 1000000
                    ? (creator.marketCap / 1000000).toFixed(1) + 'M'
                    : (creator.marketCap / 1000).toFixed(1) + 'K';

                const isPositive = creator.changePercent >= 0;
                const isZero = creator.changePercent === 0;
                const changeStr = `${isPositive && !isZero ? '+' : ''}${creator.changePercent.toFixed(2)}%`;
                const flash = priceFlashes[creator.id];

                return (
                  <Link href={`/creator/${creator.id}`} key={creator.id} className="group">
                    <div className="p-5 rounded-2xl bg-[#101014] border border-white/[0.07] hover:border-emerald-500/30 hover:bg-[#131318] transition-all duration-200 relative overflow-hidden shadow-lg hover:shadow-2xl flex flex-col justify-between h-full">
                      {/* Top Row: Avatar + Names + Price */}
                      <div>
                        <div className="flex items-start justify-between mb-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08] flex items-center justify-center font-mono font-bold text-xs text-white group-hover:border-emerald-500/40 group-hover:text-emerald-400 transition-all shadow-inner">
                              {creator.ticker.substring(0, 2)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm text-zinc-100 group-hover:text-white transition-colors truncate max-w-[140px]">
                                {creator.channelName}
                              </h3>
                              <span className="text-[11px] font-mono text-zinc-500">${creator.ticker}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <p
                              className={`font-mono font-bold text-lg tracking-tight transition-colors duration-300 ${
                                flash === 'up'
                                  ? 'text-emerald-400 scale-105'
                                  : flash === 'down'
                                  ? 'text-rose-400 scale-105'
                                  : 'text-white'
                              }`}
                            >
                              ${formattedPrice}
                            </p>
                            <div
                              className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                                isZero
                                  ? 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                                  : isPositive
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {!isZero && (isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
                              {changeStr}
                            </div>
                          </div>
                        </div>

                        {/* Middle Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] my-2">
                          <div>
                            <span className="text-zinc-500 block text-[9px] font-mono uppercase tracking-wider">
                              Mkt Cap
                            </span>
                            <span className="font-mono font-semibold text-xs text-zinc-200">
                              ${formattedMarketCap}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[9px] font-mono uppercase tracking-wider">
                              Public Float
                            </span>
                            <span className="font-mono font-semibold text-xs text-zinc-300">
                              {Number(creator.floatShares).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[9px] font-mono uppercase tracking-wider">
                              IPO Price
                            </span>
                            <span className="font-mono font-semibold text-xs text-zinc-400">
                              ${creator.ipoPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Footer Row */}
                      <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                        <span className="flex items-center gap-1.5 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Live Stream
                        </span>

                        <span className="text-xs font-medium text-zinc-400 group-hover:text-emerald-400 transition-colors flex items-center gap-0.5">
                          Trade{' '}
                          <ArrowUpRight
                            size={13}
                            className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                          />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Live Portfolio & Global Tape */}
      <div className="w-80 shrink-0 bg-[#09090c] flex flex-col border-l border-white/[0.06] hidden xl:flex">
        {/* Header */}
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="font-semibold text-xs font-mono uppercase tracking-wider text-zinc-400">
            Portfolio Quick-View
          </h2>
          <Link
            href="/portfolio"
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
          >
            Full <ArrowUpRight size={12} />
          </Link>
        </div>

        {!user ? (
          <div className="p-8 flex flex-col items-center justify-center flex-1 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 mb-4">
              <LogIn size={20} />
            </div>
            <p className="text-xs text-zinc-400 font-medium mb-1">Portfolio Locked</p>
            <p className="text-[11px] text-zinc-500 mb-5">Sign in to trade and manage your assets.</p>
            <Link
              href="/login"
              className="w-full py-2.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-all text-center"
            >
              Sign In
            </Link>
          </div>
        ) : (
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            {/* Quick Metrics */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Estimated Net Worth
              </span>
              <p className="text-xl font-mono font-bold text-white mt-0.5">
                ${(liveTotalValue + Number(user.walletBalance)).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <div className="flex items-center justify-between text-[11px] font-mono mt-3 pt-3 border-t border-white/[0.04]">
                <span className="text-zinc-500">Cash:</span>
                <span className="text-zinc-200 font-medium">${Number(user.walletBalance).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                <span className="text-zinc-500">Equities:</span>
                <span className="text-zinc-200 font-medium">${liveTotalValue.toFixed(2)}</span>
              </div>
            </div>

            {/* Holdings Mini List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Top Positions</h3>
                <span className="text-[10px] font-mono text-zinc-600">{liveHoldings.length} ASSETS</span>
              </div>

              <div className="space-y-2">
                {liveHoldings.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-4">No active positions</p>
                ) : (
                  liveHoldings.slice(0, 4).map((h) => (
                    <Link
                      href={`/creator/${h.creatorId}`}
                      key={h.id}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all group"
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-200 group-hover:text-white">{h.name}</p>
                        <p className="text-[10px] font-mono text-zinc-500">{h.quantity} Shares</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-medium text-white">${h.value.toFixed(2)}</p>
                        <p className={`text-[10px] font-mono ${h.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {h.pnlPercent >= 0 ? '+' : ''}
                          {h.pnlPercent.toFixed(1)}%
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Live Exchange Tape */}
            <div className="pt-4 border-t border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Live Exchange Tape</h3>
                </div>
                <span className="text-[9px] font-mono text-emerald-400/80">Streaming</span>
              </div>

              <div className="space-y-2">
                {recentTrades.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-4">No recent executions</p>
                ) : (
                  recentTrades.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-[11px] font-mono p-2 rounded-lg bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="text-zinc-300 truncate max-w-[90px]">{t.creator.channelName}</span>
                      <span className="text-zinc-400">{t.quantity} sh</span>
                      <span className="text-emerald-400 font-medium">${t.price.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
