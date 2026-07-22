import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWebSocket } from '../context/WebSocketContext';
import Navbar from '../components/Navbar';
import TradeModal from '../components/TradeModal';
import { Activity, Star, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const [channels, setChannels] = useState<any[]>([]);
    const { priceUpdates } = useWebSocket();
    const [selectedChannel, setSelectedChannel] = useState<any>(null);
    const [flashing, setFlashing] = useState<Record<string, 'up' | 'down'>>({});
    const [watchlistChannels, setWatchlistChannels] = useState<any[]>([]);
    const [newWatchlistHandle, setNewWatchlistHandle] = useState("");
    const [viewMode, setViewMode] = useState<'all' | 'watchlist'>('all');
    
    // Portfolio owned stats
    const [ownedStats, setOwnedStats] = useState<Record<string, number>>({});
    const [leaderboards, setLeaderboards] = useState<any>(null);

    const fetchChannels = async () => {
        try {
            const { data } = await axios.get('http://localhost:3000/api/market/channels');
            setChannels(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchLeaderboards = async () => {
        try {
            const { data } = await axios.get('http://localhost:3000/api/market/leaderboards');
            setLeaderboards(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchWatchlist = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const { data } = await axios.get('http://localhost:3000/api/market/watchlist', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWatchlistChannels(data);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleWatchlist = async (handle: string) => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            await axios.post('http://localhost:3000/api/market/watchlist/toggle', 
                { channelId: handle }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchWatchlist();
            setNewWatchlistHandle("");
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to toggle watchlist");
        }
    };

    const fetchPortfolio = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const { data } = await axios.get('http://localhost:3000/api/market/portfolio', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const stats: Record<string, number> = {};
            data.portfolios.forEach((p: any) => {
                stats[p.channelId] = p.sharesOwned;
            });
            setOwnedStats(stats);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchChannels();
        fetchLeaderboards();
        fetchPortfolio();
        fetchWatchlist();
    }, []);

    // Merge websocket prices into channels list and flash row
    useEffect(() => {
        if (Object.keys(priceUpdates).length === 0) return;

        setChannels(prev => prev.map(ch => {
            if (priceUpdates[ch.id] && priceUpdates[ch.id] !== ch.currentPrice) {
                const isUp = priceUpdates[ch.id] > ch.currentPrice;
                
                setFlashing(f => ({ ...f, [ch.id]: isUp ? 'up' : 'down' }));
                setTimeout(() => {
                    setFlashing(f => {
                        const next = { ...f };
                        delete next[ch.id];
                        return next;
                    });
                }, 1000);

                return { ...ch, currentPrice: priceUpdates[ch.id] };
            }
            return ch;
        }));

        setWatchlistChannels(prev => prev.map(ch => {
            if (priceUpdates[ch.id] && priceUpdates[ch.id] !== ch.currentPrice) {
                return { ...ch, currentPrice: priceUpdates[ch.id] };
            }
            return ch;
        }));
    }, [priceUpdates]);

    const displayChannels = viewMode === 'watchlist' ? watchlistChannels : channels;

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/20">
            <Navbar />
            
            <main className="max-w-7xl mx-auto p-6 relative z-10">
                <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold mb-1 flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
                            <Activity className="text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Live Market Exchange
                        </h1>
                        <p className="text-gray-400 font-medium">Trade fractional shares of top YouTube creators in real-time.</p>
                    </div>

                    <Link 
                        to="/creator" 
                        className="px-5 py-2.5 bg-gradient-to-r from-primary/20 to-blue-500/20 hover:from-primary/30 hover:to-blue-500/30 text-white border border-primary/30 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center gap-2 group"
                    >
                        <Rocket className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                        <span>Are you a Creator? Launch your IPO &rarr;</span>
                    </Link>
                </div>

                {/* Leaderboards Section */}
                {leaderboards && (
                    <div className="mb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-2xl hover:border-primary/30 transition-colors group">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary/60 group-hover:bg-primary transition-colors shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> Top Gainers
                            </h3>
                            <div className="space-y-4">
                                {leaderboards.topGainers.map((ch: any) => (
                                    <div key={`gainer-${ch.id}`} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-200 font-medium truncate max-w-[120px]" title={ch.name}>{ch.name}</span>
                                        <span className="text-primary font-bold font-mono bg-primary/10 px-2 py-0.5 rounded shadow-inner">+{ch.percentageChange.toFixed(2)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-2xl hover:border-red-500/30 transition-colors group">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500/60 group-hover:bg-red-500 transition-colors shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span> Top Losers
                            </h3>
                            <div className="space-y-4">
                                {leaderboards.topLosers.map((ch: any) => (
                                    <div key={`loser-${ch.id}`} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-200 font-medium truncate max-w-[120px]" title={ch.name}>{ch.name}</span>
                                        <span className="text-red-400 font-bold font-mono bg-red-500/10 px-2 py-0.5 rounded shadow-inner">{ch.percentageChange.toFixed(2)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-2xl hover:border-blue-500/30 transition-colors group">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500/60 group-hover:bg-blue-500 transition-colors shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span> Most Traded
                            </h3>
                            <div className="space-y-4">
                                {leaderboards.mostTraded.map((item: any) => (
                                    <div key={`traded-${item.channel.id}`} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-200 font-medium truncate max-w-[100px]" title={item.channel.name}>{item.channel.name}</span>
                                        <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded shadow-inner">{item.volume}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 shadow-2xl hover:border-purple-500/30 transition-colors group">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500/60 group-hover:bg-purple-500 transition-colors shadow-[0_0_8px_rgba(168,85,247,0.5)]"></span> Highest Market Cap
                            </h3>
                            <div className="space-y-4">
                                {leaderboards.highestMarketCap.map((ch: any) => (
                                    <div key={`mcap-${ch.id}`} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-200 font-medium truncate max-w-[100px]" title={ch.name}>{ch.name}</span>
                                        <span className="text-white font-mono bg-white/5 px-2 py-0.5 rounded shadow-inner tracking-tight">${(ch.marketCap >= 1e9 ? (ch.marketCap / 1e9).toFixed(1) + 'B' : ch.marketCap >= 1e6 ? (ch.marketCap / 1e6).toFixed(1) + 'M' : ch.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 }))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* My Watchlist Grid Section */}
                <div className="mb-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                            <h2 className="text-2xl font-bold text-white tracking-tight">My Watchlist</h2>
                        </div>
                        
                        <div className="flex gap-2 w-full sm:w-auto relative">
                            <input 
                                type="text"
                                placeholder="Track by channel handle or ID..."
                                className="w-full sm:w-64 bg-white/5 text-white px-4 py-2 rounded-xl border border-white/10 outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm shadow-inner transition-all"
                                value={newWatchlistHandle}
                                onChange={(e) => setNewWatchlistHandle(e.target.value)}
                            />
                            <button
                                onClick={() => newWatchlistHandle && toggleWatchlist(newWatchlistHandle)} 
                                className="bg-primary/20 hover:bg-primary text-primary hover:text-black px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-lg"
                            >
                                Track
                            </button>
                        </div>
                    </div>

                    {watchlistChannels.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {watchlistChannels.map(ch => {
                                const isUp = flashing[ch.id] === 'up';
                                const isDown = flashing[ch.id] === 'down';
                                return (
                                    <div key={`wl-${ch.id}`} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all hover:-translate-y-1 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        
                                        <div className="flex justify-between items-start relative z-10">
                                            <div>
                                                <div className="font-extrabold text-white text-lg max-w-[140px] truncate" title={ch.name}>{ch.name}</div>
                                                <div className="text-xs text-primary font-mono font-medium">@{ch.handle || ch.id}</div>
                                            </div>
                                            <button 
                                                onClick={() => toggleWatchlist(ch.id)}
                                                className="text-yellow-400 hover:text-red-500 text-lg bg-yellow-400/10 hover:bg-red-500/10 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                                                title="Remove from Watchlist"
                                            >
                                                ★
                                            </button>
                                        </div>
                                        <div className="mt-6 flex justify-between items-end relative z-10">
                                            <div className={`font-mono text-2xl font-black tracking-tight transition-colors ${
                                                isUp ? 'text-primary drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : isDown ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'text-gray-100'
                                            }`}>
                                                ${ch.currentPrice?.toFixed(2)}
                                            </div>
                                            <button 
                                                onClick={() => setSelectedChannel(ch)}
                                                className="text-xs bg-white/10 hover:bg-primary hover:text-black text-white px-4 py-2 rounded-lg transition-all font-bold shadow-lg"
                                            >
                                                Trade
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-6 bg-[#0a0a0a] border border-white/5 rounded-2xl text-center text-gray-500 text-sm">
                            Your watchlist is empty. Click the star (<span className="text-yellow-400">★</span>) icon on any creator in the market table below to track them.
                        </div>
                    )}
                </div>

                {/* Filter Tabs & Exchange Table */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                        <button
                            onClick={() => setViewMode('all')}
                            className={`px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${viewMode === 'all' ? 'bg-primary text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            All Listed Creators ({channels.length})
                        </button>
                        <button
                            onClick={() => setViewMode('watchlist')}
                            className={`px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${viewMode === 'watchlist' ? 'bg-primary text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Watchlist Only ({watchlistChannels.length})
                        </button>
                    </div>
                </div>

                <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5 text-gray-400 text-xs uppercase tracking-widest font-bold">
                                <th className="p-5 pl-8">Creator</th>
                                <th className="p-5 hidden md:table-cell">Market Cap</th>
                                <th className="p-5 hidden sm:table-cell">Alg Score</th>
                                <th className="p-5 text-right pr-6">Current Price</th>
                                <th className="p-5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {displayChannels.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center text-gray-500 font-medium">
                                        {viewMode === 'watchlist' ? 'No channels in your watchlist.' : 'No creators listed on the exchange yet.'}
                                    </td>
                                </tr>
                            )}
                            {displayChannels.map((ch) => {
                                const flashState = flashing[ch.id];
                                const isFlashingUp = flashState === 'up';
                                const isFlashingDown = flashState === 'down';
                                const isWatched = watchlistChannels.some(w => w.id === ch.id);
                                
                                return (
                                    <tr 
                                        key={ch.id} 
                                        className={`transition-all duration-500 ease-out hover:bg-white/5 group ${
                                            isFlashingUp ? 'bg-primary/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.3)]' : isFlashingDown ? 'bg-red-500/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.3)]' : ''
                                        }`}
                                    >
                                        <td className="p-5 pl-8">
                                            <div className="font-extrabold text-lg text-white group-hover:text-primary transition-colors">{ch.name}</div>
                                            <div className="text-xs text-gray-500 font-medium tracking-wide uppercase">@{ch.handle || ch.id}</div>
                                        </td>
                                        <td className="p-5 hidden md:table-cell text-gray-300 font-medium">
                                            <span className="bg-white/5 px-2 py-1 rounded shadow-inner">
                                                ${(ch.marketCap || (ch.currentPrice * 10000)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        </td>
                                        <td className="p-5 hidden sm:table-cell">
                                            <div className="flex items-center gap-3">
                                                <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-primary to-[#00E1FF] shadow-[0_0_8px_rgba(16,185,129,0.8)]" 
                                                        style={{ width: `${ch.creatorScore}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-bold text-gray-300">{ch.creatorScore?.toFixed(0)}</span>
                                            </div>
                                        </td>
                                        <td className={`p-5 text-right pr-6 font-mono text-2xl font-black tracking-tight transition-colors ${
                                            isFlashingUp ? 'text-primary drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]' : isFlashingDown ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : 'text-gray-100'
                                        }`}>
                                            ${ch.currentPrice?.toFixed(2)}
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <button 
                                                    onClick={() => setSelectedChannel(ch)}
                                                    className="bg-primary hover:bg-primary-dark text-black px-6 py-2 rounded-xl font-extrabold transition-all shadow-lg hover:shadow-primary/20 transform hover:-translate-y-0.5"
                                                >
                                                    Trade
                                                </button>
                                                <button 
                                                    onClick={() => toggleWatchlist(ch.id)}
                                                    className={`p-2.5 rounded-xl transition-all shadow-inner font-bold text-lg leading-none ${isWatched ? 'text-yellow-400 bg-white/10 hover:bg-white/20' : 'text-gray-500 bg-white/5 hover:text-yellow-400 hover:bg-white/10'}`}
                                                    title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
                                                >
                                                    ★
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </main>

            {selectedChannel && (
                <TradeModal 
                    channel={selectedChannel}
                    currentPrice={selectedChannel.currentPrice}
                    ownedShares={ownedStats[selectedChannel.id] || 0}
                    isOpen={!!selectedChannel}
                    onClose={() => setSelectedChannel(null)}
                    onSuccess={fetchPortfolio}
                />
            )}
        </div>
    );
};

export default Dashboard;
