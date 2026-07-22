import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { Rocket, ShieldCheck, Clock, CheckCircle2, Search, Sparkles } from 'lucide-react';

export const CreatorPortal = () => {
    const { user, login } = useAuth();
    const [myChannel, setMyChannel] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activatingRole, setActivatingRole] = useState(false);

    const fetchMyChannel = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            if (!token) return;
            const { data } = await axios.get('http://localhost:3000/api/creator/my-channel', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMyChannel(data.channel);
        } catch (err) {
            console.error("Failed to fetch creator channel:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchMyChannel();
        }
    }, [user]);

    const handleBecomeCreator = async () => {
        try {
            setActivatingRole(true);
            const token = localStorage.getItem("token");
            const { data } = await axios.post('http://localhost:3000/api/auth/become-creator', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            login(data.token, data.user);
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to activate creator role");
        } finally {
            setActivatingRole(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            const { data } = await axios.get(`http://localhost:3000/api/market/search?q=${encodeURIComponent(query)}`);
            setSearchResults(data);
        } catch (err) {
            console.error("Search failed:", err);
        }
    };

    const handleLaunchIPO = async () => {
        if (!selectedChannel) return;
        try {
            setIsSubmitting(true);
            const token = localStorage.getItem("token");
            await axios.post('http://localhost:3000/api/ipo', 
                { handle: selectedChannel.channelId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("IPO Application Submitted Successfully! It is now pending Admin approval.");
            setSelectedChannel(null);
            setSearchResults([]);
            setSearchQuery("");
            fetchMyChannel();
        } catch (err: any) {
            alert(err.response?.data?.error || "Failed to submit IPO application");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isCreatorRole = user?.role === 'CREATOR' || user?.role === 'ADMIN';

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/20">
            <Navbar />

            <main className="max-w-6xl mx-auto p-6 relative z-10">
                {/* Header Banner */}
                <div className="mb-10 p-8 rounded-3xl bg-gradient-to-r from-[#0d0d0d] via-[#121212] to-[#0a0a0a] border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-extrabold uppercase tracking-widest mb-3">
                                <Sparkles className="w-3.5 h-3.5" /> Creator Studio
                            </div>
                            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
                                Launch & Manage Your Channel IPO
                            </h1>
                            <p className="text-gray-400 text-sm max-w-xl">
                                List your YouTube channel on the stock exchange. Retain creator equity, boost community engagement, and let fans invest in your growth.
                            </p>
                        </div>

                        {!isCreatorRole && (
                            <button
                                onClick={handleBecomeCreator}
                                disabled={activatingRole}
                                className="px-6 py-3.5 bg-primary hover:bg-primary-dark text-black rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-primary/50 transform hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                <Rocket className="w-4 h-4" />
                                {activatingRole ? "Activating..." : "Activate Creator Account"}
                            </button>
                        )}
                    </div>
                </div>

                {!isCreatorRole ? (
                    <div className="p-12 bg-[#0a0a0a] border border-white/5 rounded-3xl text-center shadow-2xl max-w-2xl mx-auto">
                        <ShieldCheck className="w-16 h-16 text-primary mx-auto mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                        <h2 className="text-2xl font-bold text-white mb-2">Creator Account Required</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            To list a YouTube channel and initiate an Initial Public Offering (IPO), please activate your Creator profile.
                        </p>
                        <button
                            onClick={handleBecomeCreator}
                            disabled={activatingRole}
                            className="px-8 py-3.5 bg-primary text-black rounded-xl font-extrabold text-sm uppercase tracking-wider shadow-lg hover:shadow-primary/30 transition-all"
                        >
                            {activatingRole ? "Processing..." : "Upgrade to Creator Profile"}
                        </button>
                    </div>
                ) : loading ? (
                    <div className="p-12 text-center text-gray-400">Loading Creator Portal...</div>
                ) : myChannel ? (
                    /* Existing Channel Status Display */
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/10">
                            <div className="flex items-center gap-5">
                                {myChannel.logo ? (
                                    <img src={myChannel.logo} alt={myChannel.name} className="w-20 h-20 rounded-2xl border-2 border-white/10 shadow-xl" />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                                        {/* <Youtube className="w-10 h-10 text-red-500" /> */}
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-3xl font-extrabold text-white">{myChannel.name}</h2>
                                    <p className="text-sm text-primary font-mono font-bold mt-1">@{myChannel.handle}</p>
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                                {myChannel.isApproved ? (
                                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                        <CheckCircle2 className="w-5 h-5 text-primary" /> IPO Live on Exchange
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-sm shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                                        <Clock className="w-5 h-5 text-yellow-400 animate-pulse" /> Pending Admin Verification
                                    </div>
                                )}
                            </div>
                        </div>

                        {!myChannel.isApproved && (
                            <div className="mt-6 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 text-yellow-300 text-sm flex items-center gap-3">
                                <Clock className="w-5 h-5 flex-shrink-0" />
                                <span>Your IPO submission has been logged! Admin review is in progress. Once verified, trading will automatically go live.</span>
                            </div>
                        )}

                        {/* Channel Performance Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Current Share Price</div>
                                <div className="text-2xl font-black font-mono text-primary">${myChannel.currentPrice.toFixed(2)}</div>
                            </div>
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Creator Score</div>
                                <div className="text-2xl font-black font-mono text-white">{myChannel.creatorScore.toFixed(0)} / 100</div>
                            </div>
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Subscribers</div>
                                <div className="text-2xl font-black font-mono text-white">{myChannel.subscriberCount.toLocaleString()}</div>
                            </div>
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Views</div>
                                <div className="text-2xl font-black font-mono text-white">{myChannel.viewCount.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Launch New IPO Form */
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <div className="max-w-2xl mx-auto text-center mb-8">
                            <h2 className="text-2xl font-extrabold text-white mb-2">Claim & Submit Your Channel for IPO</h2>
                            <p className="text-sm text-gray-400">
                                Search for your YouTube Channel to initiate your initial share offering.
                            </p>
                        </div>

                        {/* Search Input */}
                        <div className="relative max-w-xl mx-auto mb-8">
                            <Search className="w-5 h-5 absolute left-4 top-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search YouTube channel name or handle..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="w-full bg-white/5 text-white pl-12 pr-4 py-3.5 rounded-2xl border border-white/10 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-sm"
                            />
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && !selectedChannel && (
                            <div className="max-w-xl mx-auto bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl mb-8 divide-y divide-white/5">
                                {searchResults.map((res) => (
                                    <div
                                        key={res.channelId}
                                        onClick={() => setSelectedChannel(res)}
                                        className="p-4 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <img src={res.thumbnail} alt={res.title} className="w-12 h-12 rounded-full border border-white/10" />
                                            <div>
                                                <div className="font-extrabold text-white text-sm">{res.title}</div>
                                                <div className="text-xs text-gray-400 truncate max-w-xs">{res.description}</div>
                                            </div>
                                        </div>
                                        <button className="px-4 py-1.5 bg-primary/20 text-primary text-xs font-extrabold rounded-lg hover:bg-primary hover:text-black transition-all">
                                            Select
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Selected Channel Preview */}
                        {selectedChannel && (
                            <div className="max-w-xl mx-auto bg-gradient-to-b from-white/5 to-white/[0.02] border border-primary/30 rounded-2xl p-6 shadow-2xl mb-8 relative">
                                <button
                                    onClick={() => setSelectedChannel(null)}
                                    className="absolute top-4 right-4 text-xs text-gray-400 hover:text-white bg-white/5 px-2.5 py-1 rounded-full"
                                >
                                    Change
                                </button>
                                <div className="flex items-center gap-4 mb-4">
                                    <img src={selectedChannel.thumbnail} alt="" className="w-16 h-16 rounded-full border-2 border-primary/50 shadow-lg" />
                                    <div>
                                        <h3 className="font-extrabold text-lg text-white">{selectedChannel.title}</h3>
                                        <p className="text-xs text-gray-400 line-clamp-2">{selectedChannel.description}</p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                                    <div className="text-xs text-gray-400">
                                        Status: <span className="text-yellow-400 font-bold">Ready to Submit for Approval</span>
                                    </div>
                                    <button
                                        onClick={handleLaunchIPO}
                                        disabled={isSubmitting}
                                        className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-black rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2"
                                    >
                                        <Rocket className="w-4 h-4" />
                                        {isSubmitting ? "Submitting..." : "Submit IPO Application"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default CreatorPortal;
