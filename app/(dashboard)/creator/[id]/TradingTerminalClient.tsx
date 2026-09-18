"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  ArrowDown, 
  ArrowUp, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock, 
  Sliders, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  Layers,
  Sparkles,
  Info,
  Video
} from 'lucide-react';
import Link from 'next/link';

interface CreatorScore {
  id: string;
  subscribers: string;
  totalViews: string;
  videoCount: number;
  uploadConsistency: number;
  computedScore: number;
  recordedAt: string;
}

interface CreatorProps {
  id: string;
  userId: string;
  channelName: string;
  youtubeChannelId: string;
  ticker: string;
  currentPrice: number;
  ipoPrice: number;
  ipoStatus: string;
  totalShares: string;
  floatShares: string;
  ownerShares: string;
  listedAt?: string;
  scores?: CreatorScore[];
}

interface OrderBookSnapshot {
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
}

export default function TradingTerminalClient({ 
  creator, 
  initialTrades 
}: { 
  creator: CreatorProps; 
  initialTrades: any[];
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<any[]>(initialTrades || []);
  const [currentPrice, setCurrentPrice] = useState<number>(creator.currentPrice);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  
  // Order Entry State
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [type, setType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [price, setPrice] = useState<string>(creator.currentPrice > 0 ? creator.currentPrice.toString() : '');
  const [quantity, setQuantity] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Terminal Tab State (Chart vs Fundamentals)
  const [activeTab, setActiveTab] = useState<'chart' | 'fundamentals'>('chart');
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | '1M' | 'ALL'>('24H');
  const [chartMode, setChartMode] = useState<'area' | 'candles'>('area');

  const { user, refreshUser } = useAuth();

  // Connect to WebSocket Server
  useEffect(() => {
    const socketIo = io({
      path: '/socket.io',
    });
    
    setSocket(socketIo);

    socketIo.on('connect', () => {
      socketIo.emit('subscribe', creator.id);
      if (user?.id) {
        socketIo.emit('subscribe_user', user.id);
      }
    });

    socketIo.on('depth', (snapshot: OrderBookSnapshot) => {
      setOrderBook(snapshot);
    });

    socketIo.on('trade', (trade) => {
      if (trade.creatorId === creator.id) {
        setRecentTrades((prev) => [trade, ...prev].slice(0, 50));
        setCurrentPrice((prev) => {
          if (trade.price > prev) setPriceFlash('up');
          else if (trade.price < prev) setPriceFlash('down');
          setTimeout(() => setPriceFlash(null), 1000);
          return trade.price;
        });
      }
    });

    socketIo.on('stp_alert', (alertData: { creatorId: string; count: number; message: string }) => {
      setFeedback({
        type: 'warning',
        text: `🛡️ ${alertData.message}`
      });
      refreshUser();
    });

    return () => {
      socketIo.disconnect();
    };
  }, [creator.id, user?.id]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: creator.id,
          side,
          type,
          price: type === 'LIMIT' ? Number(price) : undefined,
          quantity: Number(quantity)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      
      let successMsg = `Order submitted: ${side} ${quantity} ${creator.ticker} (${data.executedTrades} immediate matches)`;
      if (data.stpCancelled && data.stpCancelled > 0) {
        successMsg += ` • 🛡️ Self-Trade Prevention: ${data.stpCancelled} resting order(s) cancelled & refunded.`;
      }

      setFeedback({
        type: data.stpCancelled > 0 ? 'warning' : 'success',
        text: successMsg
      });
      setQuantity('');
      await refreshUser();
    } catch (error: any) {
      setFeedback({
        type: 'error',
        text: error.message || 'Execution error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Process and sort order book levels
  const bidsArray = useMemo(() => [...orderBook.bids].sort((a, b) => b.price - a.price), [orderBook.bids]);
  const asksArray = useMemo(() => [...orderBook.asks].sort((a, b) => a.price - b.price), [orderBook.asks]);

  // Compute depth volume scaling for visual ladder bars
  const maxBidVolume = useMemo(() => Math.max(...bidsArray.map(b => b.quantity), 1), [bidsArray]);
  const maxAskVolume = useMemo(() => Math.max(...asksArray.map(a => a.quantity), 1), [asksArray]);
  const maxTotalVolume = Math.max(maxBidVolume, maxAskVolume, 10);

  // Quick percentage balance fill helper
  const handleQuickPercent = (pct: number) => {
    if (!user) return;
    if (side === 'BUY') {
      const targetPrice = type === 'LIMIT' && Number(price) > 0 ? Number(price) : currentPrice || 1;
      const maxAffordable = Math.floor((Number(user.walletBalance) * (pct / 100)) / targetPrice);
      setQuantity(Math.max(1, maxAffordable).toString());
    } else {
      // Selling (if holding exists, default to 10 or float max)
      setQuantity(Math.floor(100 * (pct / 100)).toString());
    }
  };

  const estimatedTotal = (Number(price || currentPrice) * Number(quantity || 0)).toFixed(2);
  const latestScore = creator.scores?.[0];

  return (
    <div className="flex flex-col h-full bg-[#08080a] text-zinc-100 overflow-hidden">
      
      {/* Top Header Bar */}
      <header className="h-[72px] flex items-center justify-between px-8 border-b border-white/[0.06] bg-[#0c0c10]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center font-mono font-bold text-sm text-white">
              {creator.ticker.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-base text-white tracking-tight">{creator.channelName}</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-medium">
                  {creator.ipoStatus}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                <span>${creator.ticker}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Video size={12} className="text-rose-500" />
                  {creator.youtubeChannelId}
                </span>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-white/[0.06] hidden md:block" />

          {/* Quick Metrics */}
          <div className="hidden md:flex items-center gap-8 text-xs font-mono">
            <div>
              <span className="text-[10px] text-zinc-500 block">LAST PRICE</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-base font-bold transition-colors ${
                  priceFlash === 'up' ? 'text-emerald-400' : priceFlash === 'down' ? 'text-rose-400' : 'text-white'
                }`}>
                  ${currentPrice.toFixed(2)}
                </span>
                {priceFlash === 'up' && <ArrowUp size={12} className="text-emerald-400" />}
                {priceFlash === 'down' && <ArrowDown size={12} className="text-rose-400" />}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-zinc-500 block">IPO PRICE</span>
              <span className="text-zinc-300 font-medium">${creator.ipoPrice.toFixed(2)}</span>
            </div>

            <div>
              <span className="text-[10px] text-zinc-500 block">TOTAL FLOAT</span>
              <span className="text-zinc-300 font-medium">{Number(creator.floatShares).toLocaleString()} sh</span>
            </div>

            {latestScore && (
              <div>
                <span className="text-[10px] text-zinc-500 block">FUNDAMENTAL SCORE</span>
                <span className="text-indigo-400 font-bold">
                  {latestScore.computedScore > 1000000 
                    ? (latestScore.computedScore / 1000000).toFixed(2) + 'M' 
                    : latestScore.computedScore.toFixed(0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Navigation */}
        <div className="flex items-center gap-3">
          <Link 
            href="/market"
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ← Market
          </Link>
        </div>
      </header>

      {/* Main Terminal Three-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Column: Interactive Chart & Fundamentals & Trades Tape */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06] bg-[#09090c]">
          
          {/* View Tabs */}
          <div className="h-12 border-b border-white/[0.06] px-6 flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('chart')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'chart' 
                    ? 'bg-white/[0.08] text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Price Action
              </button>
              <button
                onClick={() => setActiveTab('fundamentals')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  activeTab === 'fundamentals' 
                    ? 'bg-white/[0.08] text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Channel Fundamentals
              </button>
            </div>

            {activeTab === 'chart' && (
              <div className="flex items-center gap-3">
                {/* Chart Style Toggle */}
                <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.06]">
                  <button
                    onClick={() => setChartMode('area')}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                      chartMode === 'area' ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartMode('candles')}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                      chartMode === 'candles' ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Candles
                  </button>
                </div>

                {/* Timeframe Selector */}
                <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.06]">
                  {(['1H', '24H', '7D', '1M', 'ALL'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        timeframe === tf ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'chart' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 bg-[#101014] border border-white/[0.06] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shadow-xl">
                  {/* Chart Header Meta */}
                  <div className="flex items-center justify-between mb-4 z-10">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        Realtime Execution Curve ({timeframe})
                      </span>
                      <p className="text-xl font-mono font-bold text-white">${currentPrice.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <Activity size={13} />
                      Live Stream
                    </div>
                  </div>

                  {/* Interactive Chart Canvas */}
                  <div className="flex-1 relative w-full flex items-center justify-center min-h-[260px]">
                    <InteractiveTradingChart 
                      currentPrice={currentPrice} 
                      ipoPrice={creator.ipoPrice} 
                      recentTrades={recentTrades}
                      timeframe={timeframe}
                      chartMode={chartMode}
                      ticker={creator.ticker}
                      listedAt={creator.listedAt}
                    />
                  </div>

                  {/* Chart Footer Indicator */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-3 border-t border-white/[0.04] z-10">
                    <span>Live trade updates</span>
                    <span>Orderbook Depth Synchronized</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fundamentals' && (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-[#101014] border border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Video size={16} className="text-rose-500" />
                    YouTube Channel Performance Facts
                  </h3>

                  {latestScore ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">Subscribers</span>
                        <p className="text-lg font-mono font-bold text-white mt-1">
                          {Number(latestScore.subscribers).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Views</span>
                        <p className="text-lg font-mono font-bold text-white mt-1">
                          {Number(latestScore.totalViews).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">Video Count</span>
                        <p className="text-lg font-mono font-bold text-white mt-1">
                          {latestScore.videoCount}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">Upload Consistency</span>
                        <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
                          {(latestScore.uploadConsistency * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 font-mono py-6 text-center">
                      No score report recorded yet. The scoring engine periodically synchronizes facts from YouTube.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Stream: Live Recent Trades */}
          <div className="h-44 border-t border-white/[0.06] bg-[#0c0c10] p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Live Trade Tape</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-600">Last 50 Executions</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02] text-[11px] font-mono">
              {recentTrades.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-6">No recent trades recorded.</p>
              ) : (
                recentTrades.map((t, idx) => (
                  <div key={t.id || idx} className="flex items-center justify-between py-1.5 hover:bg-white/[0.02] px-2 rounded">
                    <span className="text-zinc-500">
                      {new Date(t.executedAt).toLocaleTimeString()}
                    </span>
                    <span className="text-zinc-300">{Number(t.quantity)} shares</span>
                    <span className="text-emerald-400 font-semibold">${Number(t.price).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Middle Column: Visual Order Book Depth Ladder */}
        <div className="w-72 border-r border-white/[0.06] bg-[#09090c] flex flex-col shrink-0 select-none">
          
          <div className="p-3.5 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Order Book</span>
            <span className="text-[10px] font-mono text-zinc-500">Depth</span>
          </div>

          {/* Book Header */}
          <div className="grid grid-cols-2 px-3 py-1.5 text-[10px] font-mono text-zinc-500 border-b border-white/[0.04]">
            <span>PRICE (USDT)</span>
            <span className="text-right">SIZE (SHARES)</span>
          </div>

          {/* Order Book Depth Rows */}
          <div className="flex-1 overflow-y-auto flex flex-col justify-between font-mono text-xs p-2">
            
            {/* ASKS (Top half, inverted so lowest ask is near spread) */}
            <div className="flex flex-col-reverse justify-end gap-1 flex-1">
              {asksArray.slice(0, 15).map((ask) => {
                const depthPct = Math.min(100, Math.round((ask.quantity / maxTotalVolume) * 100));
                return (
                  <div 
                    key={ask.price} 
                    onClick={() => setPrice(ask.price.toString())}
                    className="relative flex justify-between items-center px-2 py-1 rounded cursor-pointer group hover:bg-rose-500/10 transition-colors"
                  >
                    <div 
                      className="absolute right-0 top-0 bottom-0 bg-rose-500/[0.08] rounded-r pointer-events-none transition-all duration-300"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="text-rose-400 font-medium relative z-10">${ask.price.toFixed(2)}</span>
                    <span className="text-zinc-400 relative z-10">{ask.quantity}</span>
                  </div>
                );
              })}
              {asksArray.length === 0 && (
                <p className="text-[11px] text-zinc-600 text-center py-4">No Sell Orders</p>
              )}
            </div>

            {/* Price Spread Divider */}
            <div className="py-2.5 px-3 my-1 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-mono text-[10px]">SPREAD</span>
              <span className="font-mono font-bold text-white text-sm">${currentPrice.toFixed(2)}</span>
            </div>

            {/* BIDS (Bottom half) */}
            <div className="flex flex-col gap-1 flex-1">
              {bidsArray.slice(0, 15).map((bid) => {
                const depthPct = Math.min(100, Math.round((bid.quantity / maxTotalVolume) * 100));
                return (
                  <div 
                    key={bid.price} 
                    onClick={() => setPrice(bid.price.toString())}
                    className="relative flex justify-between items-center px-2 py-1 rounded cursor-pointer group hover:bg-emerald-500/10 transition-colors"
                  >
                    <div 
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/[0.08] rounded-r pointer-events-none transition-all duration-300"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="text-emerald-400 font-medium relative z-10">${bid.price.toFixed(2)}</span>
                    <span className="text-zinc-400 relative z-10">{bid.quantity}</span>
                  </div>
                );
              })}
              {bidsArray.length === 0 && (
                <p className="text-[11px] text-zinc-600 text-center py-4">No Buy Orders</p>
              )}
            </div>

          </div>

        </div>

        {/* Right Column: Pro Order Ticket */}
        <div className="w-80 bg-[#0c0c10] p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div>
            
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white tracking-tight">Order Ticket</h2>
              {user && (
                <span className="text-[11px] font-mono text-zinc-400">
                  Bal: ${Number(user.walletBalance).toFixed(2)}
                </span>
              )}
            </div>

            {/* Buy / Sell Toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-5">
              <button 
                type="button"
                onClick={() => setSide('BUY')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  side === 'BUY' 
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Buy {creator.ticker}
              </button>
              <button 
                type="button"
                onClick={() => setSide('SELL')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  side === 'SELL' 
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sell {creator.ticker}
              </button>
            </div>

            {/* Limit / Market Order Switcher */}
            <div className="flex items-center gap-2 mb-5">
              <button
                type="button"
                onClick={() => setType('LIMIT')}
                className={`flex-1 py-1.5 text-xs font-mono rounded-lg border transition-all ${
                  type === 'LIMIT' 
                    ? 'bg-white/[0.08] text-white border-white/20' 
                    : 'bg-transparent text-zinc-500 border-white/[0.06] hover:text-zinc-300'
                }`}
              >
                Limit
              </button>
              <button
                type="button"
                onClick={() => setType('MARKET')}
                className={`flex-1 py-1.5 text-xs font-mono rounded-lg border transition-all ${
                  type === 'MARKET' 
                    ? 'bg-white/[0.08] text-white border-white/20' 
                    : 'bg-transparent text-zinc-500 border-white/[0.06] hover:text-zinc-300'
                }`}
              >
                Market
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
              
              {/* Price Input (if Limit) */}
              {type === 'LIMIT' ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                    <span>LIMIT PRICE</span>
                    <span>USDT</span>
                  </div>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/[0.03] focus:bg-white/[0.06] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none transition-all"
                  />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-mono text-zinc-400 flex items-center gap-2">
                  <Info size={14} className="text-zinc-500" />
                  Executed immediately at best available resting price.
                </div>
              )}

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                  <span>QUANTITY</span>
                  <span>SHARES</span>
                </div>
                <input 
                  type="number" 
                  step="1"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white/[0.03] focus:bg-white/[0.06] border border-white/[0.08] focus:border-white/20 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none transition-all"
                />
              </div>

              {/* Quick Percent Presets */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleQuickPercent(pct)}
                    className="py-1 rounded-md bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-mono text-zinc-400 hover:text-white transition-all"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Order Estimation Summary */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Est. Total</span>
                  <span className="text-white font-bold">${estimatedTotal} USDT</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-[10px]">
                  <span>Exchange Fee</span>
                  <span>0.00%</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-[10px]">
                  <span>Max Position Cap</span>
                  <span>5% of float</span>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={loading || !user}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 cursor-pointer ${
                  side === 'BUY' 
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20' 
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Executing...
                  </span>
                ) : (
                  `${side} ${creator.ticker}`
                )}
              </button>

              {/* Status Feedback Toast */}
              {feedback && (
                <div className={`p-3 rounded-xl text-xs font-mono flex items-start gap-2 ${
                  feedback.type === 'success' 
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                    : feedback.type === 'warning'
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  {feedback.type === 'success' && <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-400" />}
                  {feedback.type === 'warning' && <ShieldAlert size={15} className="shrink-0 mt-0.5 text-amber-400" />}
                  {feedback.type === 'error' && <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />}
                  <span>{feedback.text}</span>
                </div>
              )}

              {!user && (
                <p className="text-xs text-rose-400 text-center pt-2 font-mono">
                  Sign in required to execute orders.
                </p>
              )}
            </form>

          </div>

          <div className="pt-6 border-t border-white/[0.06] text-center text-[10px] font-mono text-zinc-600">
            Escrow protected via PostgreSQL $transaction
          </div>

        </div>

      </div>

    </div>
  );
}

// Professional Interactive Trading Chart (Area Curve + Candlesticks + Crosshair)
function InteractiveTradingChart({ 
  currentPrice, 
  ipoPrice,
  recentTrades,
  timeframe = '24H',
  chartMode = 'area',
  ticker = 'STOCK',
  listedAt
}: { 
  currentPrice: number; 
  ipoPrice: number;
  recentTrades: any[];
  timeframe: '1H' | '24H' | '7D' | '1M' | 'ALL';
  chartMode: 'area' | 'candles';
  ticker?: string;
  listedAt?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    price: number;
    time: number;
  } | null>(null);

  // 1. Calculate Timeframe Bounds
  const { startTime, endTime, durationMs } = useMemo(() => {
    const now = Date.now();
    let dur = 24 * 3600 * 1000;
    if (timeframe === '1H') dur = 3600 * 1000;
    else if (timeframe === '24H') dur = 24 * 3600 * 1000;
    else if (timeframe === '7D') dur = 7 * 24 * 3600 * 1000;
    else if (timeframe === '1M') dur = 30 * 24 * 3600 * 1000;
    else if (timeframe === 'ALL') {
      const listingTime = listedAt ? new Date(listedAt).getTime() : 0;
      const oldestTrade = recentTrades.length > 0 ? Number(recentTrades[recentTrades.length - 1].executedAt) : now;
      const earliest = listingTime > 0 ? listingTime : oldestTrade;
      dur = Math.max(24 * 3600 * 1000, now - earliest);
    }
    return { startTime: now - dur, endTime: now, durationMs: dur };
  }, [timeframe, listedAt, recentTrades]);

  // 2. Filter & Chronologically Sort Trades in Timeframe Window
  const tradesInWindow = useMemo(() => {
    return recentTrades
      .filter((t) => Number(t.executedAt) >= startTime)
      .sort((a, b) => Number(a.executedAt) - Number(b.executedAt));
  }, [recentTrades, startTime]);

  // 3. Build Genuine Price Series (No fake zig-zags!)
  const { series, minPrice, maxPrice, isUp } = useMemo(() => {
    const fallbackPrice = ipoPrice > 0 ? ipoPrice : (currentPrice > 0 ? currentPrice : 1.0);

    let pts: Array<{ time: number; price: number }> = [];

    if (tradesInWindow.length === 0) {
      // Clean flat baseline if 0 trades have occurred (honest real-time display)
      pts = [
        { time: startTime, price: fallbackPrice },
        { time: startTime + durationMs * 0.25, price: fallbackPrice },
        { time: startTime + durationMs * 0.50, price: fallbackPrice },
        { time: startTime + durationMs * 0.75, price: fallbackPrice },
        { time: endTime, price: currentPrice > 0 ? currentPrice : fallbackPrice }
      ];
    } else {
      // Historical real-time execution curve
      pts = [
        { time: startTime, price: fallbackPrice },
        ...tradesInWindow.map((t) => ({ time: Number(t.executedAt), price: Number(t.price) })),
        { time: endTime, price: currentPrice }
      ];
    }

    const prices = pts.map((p) => p.price);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const range = rawMax - rawMin;

    // Headroom padding so lines never smash into the top/bottom borders
    const delta = Math.max(0.40, range * 0.18 || rawMax * 0.08);
    const min = Math.max(0.01, Number((rawMin - delta).toFixed(2)));
    const max = Number((rawMax + delta).toFixed(2));

    const firstPrice = pts[0]?.price || fallbackPrice;
    const isBullish = currentPrice >= firstPrice;

    return { series: pts, minPrice: min, maxPrice: max, isUp: isBullish };
  }, [tradesInWindow, startTime, endTime, durationMs, ipoPrice, currentPrice]);

  // 4. SVG Layout & Coordinate Mapping
  const width = 800;
  const height = 280;
  const padLeft = 14;
  const padRight = 72; // Width reserved for Y-axis price labels
  const padTop = 22;
  const padBottom = 30; // Height reserved for X-axis time labels

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const getX = (t: number) => padLeft + Math.min(plotW, Math.max(0, ((t - startTime) / durationMs) * plotW));
  const getY = (p: number) => padTop + plotH - Math.min(plotH, Math.max(0, ((p - minPrice) / (maxPrice - minPrice || 1)) * plotH));

  // Area & Line Path Strings
  const linePoints = series.map((s) => `${getX(s.time).toFixed(1)},${getY(s.price).toFixed(1)}`).join(' ');
  const areaPoints = `${padLeft.toFixed(1)},${(padTop + plotH).toFixed(1)} ${linePoints} ${(padLeft + plotW).toFixed(1)},${(padTop + plotH).toFixed(1)}`;

  const mainColor = isUp ? '#10b981' : '#f43f5e';
  const gradientId = `chartGrad_${ticker}`;

  // Y-Axis Price Levels (5 Horizontal Grid Levels)
  const yLevels = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const priceVal = minPrice + (maxPrice - minPrice) * (1 - pct);
    const y = padTop + pct * plotH;
    return { priceVal, y };
  });

  // X-Axis Timestamp Levels (5 Time Markers)
  const xLevels = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const timeVal = startTime + pct * durationMs;
    const x = padLeft + pct * plotW;
    let label = '';
    const d = new Date(timeVal);
    if (timeframe === '1H') {
      label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else if (timeframe === '24H') {
      label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return { label, x };
  });

  // Candlestick Aggregation (for 'candles' mode)
  const candles = useMemo(() => {
    if (chartMode !== 'candles') return [];
    const numBuckets = 24;
    const bucketDur = durationMs / numBuckets;
    const candleList = [];
    let lastClose = ipoPrice > 0 ? ipoPrice : currentPrice;

    for (let i = 0; i < numBuckets; i++) {
      const bStart = startTime + i * bucketDur;
      const bEnd = bStart + bucketDur;
      const bTrades = tradesInWindow.filter((t) => Number(t.executedAt) >= bStart && Number(t.executedAt) < bEnd);

      let o = lastClose;
      let c = lastClose;
      let h = lastClose;
      let l = lastClose;

      if (bTrades.length > 0) {
        o = Number(bTrades[0].price);
        c = Number(bTrades[bTrades.length - 1].price);
        h = Math.max(...bTrades.map((t) => Number(t.price)));
        l = Math.min(...bTrades.map((t) => Number(t.price)));
        lastClose = c;
      }

      candleList.push({
        x: padLeft + (i + 0.5) * (plotW / numBuckets),
        width: Math.max(3, (plotW / numBuckets) * 0.65),
        open: o,
        close: c,
        high: h,
        low: l,
        isBull: c >= o,
      });
    }
    return candleList;
  }, [chartMode, durationMs, startTime, plotW, padLeft, tradesInWindow, ipoPrice, currentPrice]);

  // Mouse Crosshair Tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mousePixelX = e.clientX - rect.left;
    const scaleX = width / rect.width;
    const svgX = mousePixelX * scaleX;

    if (svgX < padLeft || svgX > padLeft + plotW) {
      setHoverData(null);
      return;
    }

    const mouseTime = startTime + ((svgX - padLeft) / plotW) * durationMs;

    // Find nearest series point
    let closest = series[0];
    let closestDiff = Math.abs(series[0].time - mouseTime);
    for (let i = 1; i < series.length; i++) {
      const diff = Math.abs(series[i].time - mouseTime);
      if (diff < closestDiff) {
        closest = series[i];
        closestDiff = diff;
      }
    }

    setHoverData({
      x: svgX,
      y: getY(closest.price),
      price: closest.price,
      time: closest.time,
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  const currentY = getY(currentPrice);

  return (
    <div className="w-full h-full flex flex-col justify-center relative select-none">
      <svg
        ref={svgRef}
        className="w-full h-[260px] overflow-visible cursor-crosshair"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={mainColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={mainColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* 1. Horizontal Grid Lines & Right Y-Axis Price Labels */}
        {yLevels.map((lvl, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={lvl.y}
              x2={padLeft + plotW}
              y2={lvl.y}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
            />
            <text
              x={padLeft + plotW + 10}
              y={lvl.y + 3.5}
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
            >
              ${lvl.priceVal.toFixed(2)}
            </text>
          </g>
        ))}

        {/* 2. Vertical Grid & Bottom X-Axis Time Labels */}
        {xLevels.map((lvl, idx) => (
          <g key={idx}>
            <line
              x1={lvl.x}
              y1={padTop}
              x2={lvl.x}
              y2={padTop + plotH}
              stroke="rgba(255,255,255,0.03)"
              strokeDasharray="4 4"
            />
            <text
              x={lvl.x}
              y={padTop + plotH + 20}
              fill="#71717a"
              fontSize="9"
              fontFamily="monospace"
              textAnchor={idx === 0 ? 'start' : idx === xLevels.length - 1 ? 'end' : 'middle'}
            >
              {lvl.label}
            </text>
          </g>
        ))}

        {/* 3. Real-Time Price Reference Dashed Line */}
        <line
          x1={padLeft}
          y1={currentY}
          x2={padLeft + plotW}
          y2={currentY}
          stroke={mainColor}
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.5"
        />

        {/* 4. Current Price Badge on Right Y-Axis */}
        <g transform={`translate(${padLeft + plotW + 4}, ${currentY - 9})`}>
          <rect
            width="64"
            height="18"
            rx="4"
            fill={mainColor}
            className="shadow-md"
          />
          <text
            x="32"
            y="12.5"
            fill={isUp ? '#000000' : '#ffffff'}
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            ${currentPrice.toFixed(2)}
          </text>
        </g>

        {/* 5. Chart Visualization (Area or Candlesticks) */}
        {chartMode === 'area' ? (
          <>
            {/* Area Gradient Fill */}
            <polygon points={areaPoints} fill={`url(#${gradientId})`} />

            {/* Polyline Path */}
            <polyline
              fill="none"
              stroke={mainColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={linePoints}
            />

            {/* Glowing Live Node at Right Edge */}
            <circle
              cx={getX(endTime)}
              cy={currentY}
              r="4.5"
              fill={mainColor}
              className="animate-pulse"
            />
          </>
        ) : (
          /* Candlestick Visualization */
          <g>
            {candles.map((c, idx) => {
              const candleColor = c.isBull ? '#10b981' : '#f43f5e';
              const highY = getY(c.high);
              const lowY = getY(c.low);
              const openY = getY(c.open);
              const closeY = getY(c.close);
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(2, Math.abs(closeY - openY));

              return (
                <g key={idx}>
                  {/* High-Low Wick Line */}
                  <line
                    x1={c.x}
                    y1={highY}
                    x2={c.x}
                    y2={lowY}
                    stroke={candleColor}
                    strokeWidth="1.2"
                  />
                  {/* Candle Body Rect */}
                  <rect
                    x={c.x - c.width / 2}
                    y={bodyTop}
                    width={c.width}
                    height={bodyHeight}
                    fill={c.isBull ? candleColor : candleColor}
                    stroke={candleColor}
                    strokeWidth="1"
                    rx="1"
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* 6. Interactive Crosshair & Hover Tooltip */}
        {hoverData && (
          <g>
            {/* Vertical Line */}
            <line
              x1={hoverData.x}
              y1={padTop}
              x2={hoverData.x}
              y2={padTop + plotH}
              stroke="rgba(255,255,255,0.4)"
              strokeDasharray="2 2"
            />
            {/* Horizontal Line */}
            <line
              x1={padLeft}
              y1={hoverData.y}
              x2={padLeft + plotW}
              y2={hoverData.y}
              stroke="rgba(255,255,255,0.4)"
              strokeDasharray="2 2"
            />
            {/* Hover Snapped Node */}
            <circle
              cx={hoverData.x}
              cy={hoverData.y}
              r="5"
              fill={mainColor}
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Hover Price Badge on Right Y-Axis */}
            <g transform={`translate(${padLeft + plotW + 4}, ${hoverData.y - 9})`}>
              <rect width="64" height="18" rx="4" fill="#27272a" stroke="#52525b" strokeWidth="1" />
              <text x="32" y="12.5" fill="#f4f4f5" fontSize="10" fontFamily="monospace" textAnchor="middle">
                ${hoverData.price.toFixed(2)}
              </text>
            </g>

            {/* Floating Info Tooltip */}
            <g transform={`translate(${Math.min(hoverData.x + 10, width - 170)}, ${Math.max(padTop + 10, hoverData.y - 45)})`}>
              <rect width="150" height="40" rx="8" fill="#18181b" stroke="rgba(255,255,255,0.15)" strokeWidth="1" className="shadow-2xl" />
              <text x="10" y="17" fill="#ffffff" fontSize="11" fontFamily="monospace" fontWeight="bold">
                ${hoverData.price.toFixed(2)}
              </text>
              <text x="10" y="31" fill="#a1a1aa" fontSize="9" fontFamily="monospace">
                {new Date(hoverData.time).toLocaleTimeString()}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
