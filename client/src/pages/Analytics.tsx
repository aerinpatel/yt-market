import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { ArrowLeft, LineChart as ChartIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWebSocket } from '../context/WebSocketContext';

const Analytics = () => {
    const { channelId } = useParams();
    const [history, setHistory] = useState<any[]>([]);
    const [channelInfo, setChannelInfo] = useState<any>(null);
    const [timeframe, setTimeframe] = useState<'1D' | '7D' | '30D' | '3M' | '1Y' | 'ALL'>('ALL');
    const { priceUpdates } = useWebSocket();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [histRes, chanRes] = await axios.all([
                    axios.get(`http://localhost:3000/api/market/history/${encodeURIComponent(channelId!)}`),
                    axios.get('http://localhost:3000/api/market/channels')
                ]);
                
                const formattedHistory = histRes.data.map((item: any) => ({
                    ...item,
                    date: new Date(item.createdAt).toLocaleString(),
                    rawDate: new Date(item.createdAt).getTime()
                }));
                
                setHistory(formattedHistory);
                
                const currentChan = chanRes.data.find((c: any) => c.id === channelId);
                setChannelInfo(currentChan);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, [channelId]);

    // Handle incoming websockets to dynamically append to chart
    useEffect(() => {
        if (priceUpdates[channelId!] && history.length > 0) {
            const currentLatest = history[history.length - 1];
            if (currentLatest.price !== priceUpdates[channelId!]) {
                const newPoint = {
                    price: priceUpdates[channelId!],
                    date: new Date().toLocaleString(),
                    rawDate: Date.now()
                };
                setHistory(prev => [...prev, newPoint]);
                setChannelInfo((prev: any) => prev ? { ...prev, currentPrice: priceUpdates[channelId!] } : prev);
            }
        }
    }, [priceUpdates, channelId]);

    const filteredHistory = history.filter(item => {
        if (timeframe === 'ALL') return true;
        const now = Date.now();
        const diff = now - item.rawDate;
        if (timeframe === '1D') return diff <= 24 * 60 * 60 * 1000;
        if (timeframe === '7D') return diff <= 7 * 24 * 60 * 60 * 1000;
        if (timeframe === '30D') return diff <= 30 * 24 * 60 * 60 * 1000;
        if (timeframe === '3M') return diff <= 90 * 24 * 60 * 60 * 1000;
        if (timeframe === '1Y') return diff <= 365 * 24 * 60 * 60 * 1000;
        return true;
    });

    const isPositive = history.length > 1 && history[0].price <= history[history.length - 1].price;

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/20">
            <Navbar />
            
            <main className="max-w-7xl mx-auto p-6 relative z-10">
                <Link to="/dashboard" className="inline-flex items-center space-x-2 text-gray-500 hover:text-primary transition-colors mb-8 font-bold tracking-tight">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Exchange</span>
                </Link>

                <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 relative z-10">
                        <div>
                            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">{channelInfo?.name || channelId}</h1>
                            <div className="text-sm text-gray-500 mb-6 font-bold tracking-widest uppercase">{channelId}</div>
                            
                            <div className="flex items-end gap-3">
                                <div className={`text-6xl font-black font-mono tracking-tighter ${isPositive ? 'text-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}>
                                    ${channelInfo?.currentPrice?.toFixed(2) || '0.00'}
                                </div>
                            </div>
                        </div>

                        <div className="flex bg-white/5 p-1.5 rounded-xl border border-white/5">
                            {['1D', '7D', '30D', '3M', '1Y', 'ALL'].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf as any)}
                                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                        timeframe === tf 
                                            ? 'bg-primary text-black shadow-lg hover:shadow-primary/20 transform -translate-y-0.5' 
                                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[450px] w-full relative z-10">
                        {filteredHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={filteredHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="2%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.4}/>
                                            <stop offset="98%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                                        </linearGradient>
                                        <filter id="glow">
                                            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                                            <feMerge>
                                                <feMergeNode in="coloredBlur"/>
                                                <feMergeNode in="SourceGraphic"/>
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                    <XAxis 
                                        dataKey="date" 
                                        tick={{fill: '#52525b', fontSize: 11, fontWeight: 600}} 
                                        tickLine={false}
                                        axisLine={false}
                                        minTickGap={60}
                                    />
                                    <YAxis 
                                        domain={['auto', 'auto']} 
                                        tick={{fill: '#52525b', fontSize: 11, fontWeight: 600}}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value.toFixed(0)}`}
                                        width={80}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                        itemStyle={{ color: '#fff', fontWeight: '900', fontSize: '18px', fontFamily: 'monospace' }}
                                        labelStyle={{ color: '#71717a', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="price" 
                                        stroke={isPositive ? "#10b981" : "#ef4444"} 
                                        strokeWidth={4}
                                        fillOpacity={1} 
                                        fill="url(#colorPrice)" 
                                        style={{ filter: 'url(#glow)' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center flex-col text-gray-500">
                                <ChartIcon className="w-12 h-12 mb-2 text-gray-700" />
                                <div>No charting data available for this timeframe</div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Analytics;
