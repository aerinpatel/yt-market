import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Link } from 'react-router-dom';

const Portfolio = () => {
    const { user } = useAuth();
    const { priceUpdates } = useWebSocket();
    const [portfolios, setPortfolios] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                const { data } = await axios.get('http://localhost:3000/api/market/portfolio');
                setPortfolios(data.portfolios);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchPortfolio();
    }, []);

    // Merge WS updates
    const activePortfolios = portfolios.map(p => {
        const currentPrice = priceUpdates[p.channel.id] || p.channel.currentPrice;
        const investedAmount = p.averageBuyPrice * p.sharesOwned;
        const totalValue = currentPrice * p.sharesOwned;
        const profit = totalValue - investedAmount;
        
        return {
            ...p,
            currentPrice,
            totalValue,
            investedAmount,
            profit
        };
    }).filter(p => p.sharesOwned > 0);

    const totalAssetValue = activePortfolios.reduce((sum, p) => sum + p.totalValue, 0);
    const walletBalance = user?.walletBalance || 0;
    const netWorth = walletBalance + totalAssetValue;
    const totalInvested = activePortfolios.reduce((sum, p) => sum + p.investedAmount, 0);
    const totalProfit = totalAssetValue - totalInvested;

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/20">
            <Navbar />
            
            <main className="max-w-7xl mx-auto p-6 relative z-10">
                <div className="mb-10">
                    <h1 className="text-4xl font-extrabold mb-8 flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
                        <Briefcase className="text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> My Portfolio
                    </h1>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                        <div className="bg-gradient-to-br from-primary/20 to-[#0a0a0a] p-8 rounded-3xl border border-primary/30 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/30 rounded-full blur-[50px]"></div>
                            <div className="text-primary-dark mb-2 text-xs font-bold tracking-widest uppercase relative z-10">Total Net Worth</div>
                            <div className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] relative z-10">
                                ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/5 shadow-2xl">
                            <div className="text-gray-500 mb-2 text-xs font-bold tracking-widest uppercase">Available Cash</div>
                            <div className="text-4xl font-extrabold text-primary tracking-tighter drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                                ${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/5 shadow-2xl">
                            <div className="text-gray-500 mb-2 text-xs font-bold tracking-widest uppercase">Invested Capital</div>
                            <div className="text-4xl font-extrabold text-white tracking-tighter">
                                ${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-32 h-32 ${totalProfit >= 0 ? 'bg-primary/10' : 'bg-red-500/10'} rounded-full blur-[40px] pointer-events-none`}></div>
                            <div className="text-gray-500 mb-2 text-xs font-bold tracking-widest uppercase">Unrealized P&L</div>
                            <div className={`text-4xl font-extrabold tracking-tighter drop-shadow-md ${totalProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold mb-6 text-white tracking-tight">Active Holdings</h2>
                    
                    {loading ? (
                        <div className="text-center p-12 text-gray-500 font-medium">Scanning ledger...</div>
                    ) : activePortfolios.length === 0 ? (
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-16 text-center shadow-2xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent blur-3xl pointer-events-none"></div>
                            <Briefcase className="w-16 h-16 text-gray-600 mx-auto mb-6 relative z-10" />
                            <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight relative z-10">Portfolio Empty</h3>
                            <p className="mb-8 text-gray-400 max-w-sm mx-auto relative z-10">You haven't acquired any creator shares yet. Head to the market to build your empire.</p>
                            <Link to="/dashboard" className="inline-block bg-primary hover:bg-primary-dark text-black font-extrabold py-3 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-primary/40 transform hover:-translate-y-0.5 relative z-10">
                                Enter Market
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {activePortfolios.map((p) => (
                                <Link to={`/analytics/${encodeURIComponent(p.channel.id)}`} key={p.id} className="block group">
                                    <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-7 hover:border-primary/40 transition-all cursor-pointer shadow-2xl h-full flex flex-col relative overflow-hidden hover:-translate-y-1">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                        
                                        <div className="flex justify-between items-start mb-8 relative z-10">
                                            <div>
                                                <div className="font-extrabold text-2xl text-white group-hover:text-primary transition-colors tracking-tight">{p.channel.name}</div>
                                                <div className="text-xs text-gray-500 font-medium tracking-wide uppercase mt-1">
                                                    {p.channel.id}
                                                </div>
                                            </div>
                                            <div className="bg-primary/10 text-primary text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-primary/20 shadow-inner">
                                                {p.sharesOwned} SHARES
                                            </div>
                                        </div>
                                        
                                        <div className="mt-auto space-y-4 relative z-10">
                                            <div className="flex justify-between text-sm items-center">
                                                <span className="text-gray-500 font-medium">Market Price</span>
                                                <span className="text-white font-mono font-bold tracking-tight">${p.currentPrice.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm items-center border-t border-white/5 pt-3">
                                                <span className="text-gray-500 font-medium">Avg Entry</span>
                                                <span className="text-white font-mono tracking-tight">${p.averageBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between text-sm items-center border-t border-white/5 pt-3">
                                                <span className="text-gray-500 font-medium">Position Value</span>
                                                <span className="text-white font-mono font-extrabold tracking-tight">${p.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between text-sm items-center border-t border-white/5 pt-3">
                                                <span className="text-gray-500 font-medium">Unrealized PNL</span>
                                                <span className={`font-mono font-black tracking-tight ${p.profit >= 0 ? 'text-primary drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`}>
                                                    {p.profit >= 0 ? '+' : ''}${p.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Portfolio;
