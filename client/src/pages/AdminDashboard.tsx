import { useState, useEffect } from "react";
import axios from "axios";

export const AdminDashboard = () => {
    const [pendingChannels, setPendingChannels] = useState([]);
    const [users, setUsers] = useState([]);
    const [trades, setTrades] = useState([]);
    const [allChannels, setAllChannels] = useState([]);
    const [loading, setLoading] = useState(true);

    const token = localStorage.getItem("token");

    const fetchData = async () => {
        try {
            setLoading(true);
            const headers = { Authorization: `Bearer ${token}` };
            const [pendingRes, usersRes, tradesRes, channelsRes] = await Promise.all([
                axios.get("http://localhost:3000/api/admin/channels/pending", { headers }),
                axios.get("http://localhost:3000/api/admin/users", { headers }),
                axios.get("http://localhost:3000/api/admin/trades", { headers }),
                axios.get("http://localhost:3000/api/market/channels") // Public route
            ]);
            setPendingChannels(pendingRes.data);
            setUsers(usersRes.data);
            setTrades(tradesRes.data);
            setAllChannels(channelsRes.data);
        } catch (error) {
            console.error("Failed to fetch admin data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]);

    const handleApprove = async (id: string) => {
        try {
            await axios.post(`http://localhost:3000/api/admin/channels/${id}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (e) {
            alert("Failed to approve channel");
        }
    };

    const handleTogglePause = async (id: string) => {
        try {
            await axios.post(`http://localhost:3000/api/admin/channels/${id}/pause`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (e) {
            alert("Failed to pause/resume channel");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this channel?")) return;
        try {
            await axios.delete(`http://localhost:3000/api/admin/channels/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (e) {
            alert("Failed to delete channel");
        }
    };

    if (!token) return <div className="p-8 text-center text-white">Unauthorized. Admin access required.</div>;
    if (loading) return <div className="p-8 text-center text-white">Loading Admin Dashboard...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-10 text-white font-sans selection:bg-primary/20">
            <h1 className="text-5xl font-black mb-10 text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400 tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                Admin Control Room
            </h1>

            {/* Pending Channels */}
            <div className="bg-[#0a0a0a] rounded-3xl p-8 mb-10 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none"></div>
                <h2 className="text-2xl font-bold mb-6 tracking-tight relative z-10">Pending IPO Approvals</h2>
                {pendingChannels.length === 0 ? (
                    <p className="text-gray-400">No pending channels.</p>
                ) : (
                    <div className="grid gap-4">
                        {pendingChannels.map((ch: any) => (
                            <div key={ch.id} className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all shadow-inner relative z-10">
                                <div className="flex items-center gap-5">
                                    <img src={ch.logo} className="w-12 h-12 rounded-full border-2 border-white/10 shadow-lg" alt={ch.name} />
                                    <div>
                                        <p className="font-extrabold text-lg text-white">{ch.name}</p>
                                        <p className="text-xs text-primary font-bold tracking-widest uppercase">{ch.handle}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleApprove(ch.id)}
                                    className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-black rounded-xl text-sm font-black tracking-widest uppercase transition-all shadow-lg hover:shadow-primary/20 transform hover:-translate-y-0.5"
                                >
                                    Approve IPO
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Active Channels Management */}
            <div className="bg-[#0a0a0a] rounded-3xl p-8 mb-10 border border-white/5 shadow-2xl relative overflow-hidden">
                <h2 className="text-2xl font-bold mb-6 tracking-tight relative z-10">Market Channels Control</h2>
                <div className="grid gap-4 relative z-10">
                    {allChannels.map((ch: any) => (
                        <div key={ch.id} className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/10 shadow-inner">
                            <div className="flex items-center gap-5">
                                <span className={ch.isTradingPaused ? 'text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase border border-red-500/20' : 'text-primary bg-primary/10 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase border border-primary/20'}>
                                    {ch.isTradingPaused ? 'PAUSED' : 'LIVE'}
                                </span>
                                <div>
                                    <p className="font-extrabold text-lg text-white">{ch.name}</p>
                                    <p className="text-xs text-gray-400 font-mono font-medium">${ch.currentPrice.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => handleTogglePause(ch.id)}
                                    className="px-5 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded-xl text-sm font-bold transition-all shadow-inner"
                                >
                                    {ch.isTradingPaused ? 'Resume Trade' : 'Pause Trade'}
                                </button>
                                <button 
                                    onClick={() => handleDelete(ch.id)}
                                    className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-sm font-bold transition-all shadow-inner"
                                >
                                    Delist
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Users List */}
                <div className="bg-[#0a0a0a] rounded-3xl p-8 border border-white/5 shadow-2xl overflow-x-auto relative">
                    <h2 className="text-2xl font-bold mb-6 tracking-tight">User Base</h2>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-500 text-xs font-bold uppercase tracking-widest">
                                <th className="pb-2">User</th>
                                <th className="pb-2">Wallet</th>
                                <th className="pb-2">Trades</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u: any) => (
                                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                    <td className="py-4">
                                        <div className="font-bold text-white">{u.username}</div>
                                        <div className="text-xs text-primary font-bold tracking-widest mt-0.5">{u.role}</div>
                                    </td>
                                    <td className="py-4 font-mono font-bold text-gray-300 tracking-tight">${u.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="py-4 text-white font-bold">{u._count.trades} <span className="text-gray-500 text-xs font-normal">tx</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Global Trade Ledger */}
                <div className="bg-[#0a0a0a] rounded-3xl p-8 border border-white/5 shadow-2xl overflow-x-auto">
                    <h2 className="text-2xl font-bold mb-6 tracking-tight">Global Trade Ledger</h2>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {trades.map((t: any) => (
                            <div key={t.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl shadow-inner border-l-4 transition-all hover:bg-white/10" style={{ borderLeftColor: t.type === 'BUY' ? '#10B981' : '#EF4444' }}>
                                <div>
                                    <span className="font-bold text-sm text-gray-300">{t.user.username}</span>
                                    <span className="mx-2 text-xs text-gray-500 font-bold uppercase tracking-widest">traded</span>
                                    <span className="font-extrabold text-white">{t.channel.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold font-mono tracking-tight ${t.type === 'BUY' ? 'text-primary' : 'text-red-500'}`}>
                                        {t.type} {t.shares} shares
                                    </div>
                                    <div className="text-xs text-gray-400 font-medium">@ ${t.price.toFixed(2)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
