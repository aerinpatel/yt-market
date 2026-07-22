import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { ArrowRight, TrendingUp, Users, Activity, BarChart2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const LandingPage = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX,
                y: e.clientY
            });
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    // Placeholder data for the floating cards
    const placeholderCreators = [
        { name: "MrBeast", price: 142.50, change: "+12.4%", logo: "https://yt3.googleusercontent.com/ytc/AIdro_k6T6L75N82F_n2vJt01bO8vM1A0T0NwqSgXk-44dD-1zI=s900-c-k-c0x00ffffff-no-rj" },
        { name: "MKBHD", price: 89.20, change: "+5.2%", logo: "https://yt3.googleusercontent.com/ytc/AIdro_nGE52mY4zM4lQ8OBy6LThfO4M_XwN3tXXG9_jB-Q=s900-c-k-c0x00ffffff-no-rj" },
        { name: "Fireship", price: 65.10, change: "+18.9%", logo: "https://yt3.googleusercontent.com/ytc/AIdro_kO3K7T3j93f5385C7tZ6L3T5vT9s0VbT9G30a6-A=s900-c-k-c0x00ffffff-no-rj" }
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/20 overflow-x-hidden relative">
            
            {/* Dynamic Interactive Background Glow */}
            <div 
                className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(16,185,129,0.05), transparent 40%)`
                }}
            />

            <Navbar />

            {/* Hero Section */}
            <main className="relative z-10">
                <div className="max-w-7xl mx-auto px-6 pt-32 pb-24 flex flex-col lg:flex-row items-center justify-between gap-16 relative">
                    
                    {/* Abstract Grid Background inside Hero */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50 z-0 mask-image-gradient"></div>

                    <div className="w-full lg:w-1/2 relative z-10 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in-up shadow-inner">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            <span className="text-xs font-bold tracking-widest uppercase text-gray-300">Market is Live</span>
                        </div>
                        
                        <h1 className="text-6xl md:text-[5.5rem] font-black mb-8 tracking-tighter leading-[1] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                            Trade The <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-green-400 to-blue-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                Creators
                            </span>
                            <br/> You Watch.
                        </h1>
                        <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium animate-fade-in-up tracking-tight" style={{ animationDelay: '200ms' }}>
                            Welcome to the world's first Creator Stock Market. Buy shares in your favorite YouTubers, track their growth, and build a digital empire.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                            <Link to="/auth" className="w-full sm:w-auto group relative px-8 py-5 bg-primary text-black rounded-2xl font-black text-lg tracking-widest uppercase transition-all hover:-translate-y-1 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_10px_50px_rgba(16,185,129,0.5)]">
                                <span className="flex items-center justify-center gap-3">
                                    Start Trading <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                            <Link to="/auth" className="w-full sm:w-auto px-8 py-5 bg-white/5 text-white border border-white/10 rounded-2xl font-bold text-lg tracking-widest uppercase transition-all hover:bg-white/10 hover:border-white/20 text-center shadow-inner hover:-translate-y-1">
                                View Leaderboards
                            </Link>
                        </div>
                    </div>

                    {/* Right side floating dummy cards */}
                    <div className="w-full lg:w-1/2 relative z-10 h-[500px] flex items-center justify-center animate-fade-in" style={{ animationDelay: '400ms' }}>
                        {/* Glow Blob behind the cards */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
                        
                        <div className="relative w-full max-w-md">
                            {placeholderCreators.map((creator, i) => (
                                <div 
                                    key={creator.name}
                                    className={`absolute w-full bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl transition-all duration-700 hover:border-primary/40 group`}
                                    style={{
                                        top: `${i * 120 - 150}px`,
                                        left: `${i % 2 === 0 ? '-20px' : '20px'}`,
                                        zIndex: 3 - i,
                                        transform: `scale(${1 - i * 0.05})`,
                                        animation: `float ${4 + i}s ease-in-out infinite alternate`
                                    }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none"></div>
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <img src={creator.logo} alt={creator.name} className="w-16 h-16 rounded-2xl border-2 border-white/10 shadow-lg object-cover" />
                                            <div>
                                                <h3 className="text-xl font-extrabold text-white tracking-tight">{creator.name}</h3>
                                                <p className="text-xs text-primary font-bold uppercase tracking-widest mt-1">Creator Stock</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black font-mono text-white">${creator.price.toFixed(2)}</div>
                                            <div className="text-sm font-bold text-primary tracking-tighter drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                                                {creator.change}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center relative z-10">
                                        <div className="h-10 flex-1 bg-white/5 rounded-lg mr-4 relative overflow-hidden">
                                            {/* Dummy mini chart line */}
                                            <svg className="absolute w-full h-full text-primary opacity-50" preserveAspectRatio="none" viewBox="0 0 100 20">
                                                <path d="M0 20 L20 15 L40 18 L60 5 L80 10 L100 2" stroke="currentColor" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
                                            </svg>
                                        </div>
                                        <button className="px-5 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-black hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all">
                                            Trade
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Bento Box Features Section */}
            <section className="relative z-10 max-w-7xl mx-auto px-6 py-32 border-t border-white/5">
                <div className="text-center mb-20 animate-fade-in-up">
                    <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">The Future of <span className="text-primary tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">Fandom</span></h2>
                    <p className="text-gray-400 font-medium max-w-2xl mx-auto text-lg">Stop just watching. Start investing in the creators you believe in before they go mainstream.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-[#0a0a0a] border border-white/5 p-10 md:p-14 rounded-[40px] relative overflow-hidden group hover:border-primary/20 transition-all shadow-2xl">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/20 transition-colors"></div>
                        <Activity className="w-12 h-12 text-primary mb-8 relative z-10 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-4 relative z-10 tracking-tight">Real-Time Market Engine</h3>
                        <p className="text-gray-400 relative z-10 text-lg leading-relaxed max-w-md">Our algorithm analyzes views, subscriber growth, and momentum to price channels realistically in real-time.</p>
                    </div>

                    <div className="bg-[#0a0a0a] border border-white/5 p-10 rounded-[40px] relative overflow-hidden group hover:border-white/10 transition-all shadow-xl hover:-translate-y-1">
                        <BarChart2 className="w-10 h-10 text-gray-300 mb-8 relative z-10" />
                        <h3 className="text-2xl font-bold text-white mb-4 relative z-10 tracking-tight">Pro Analytics</h3>
                        <p className="text-gray-400 relative z-10 leading-relaxed font-medium">Deep dive into historical charts, moving averages, and detailed PNL tracking.</p>
                    </div>

                    <div className="bg-[#0a0a0a] border border-white/5 p-10 rounded-[40px] relative overflow-hidden group hover:border-white/10 transition-all shadow-xl hover:-translate-y-1">
                        <Users className="w-10 h-10 text-gray-300 mb-8 relative z-10" />
                        <h3 className="text-2xl font-bold text-white mb-4 relative z-10 tracking-tight">Leaderboards</h3>
                        <p className="text-gray-400 relative z-10 leading-relaxed font-medium">Compete with other investors. Watch your net worth climb the ranks globally.</p>
                    </div>

                    <div className="md:col-span-2 bg-gradient-to-br from-primary/10 via-[#0a0a0a] to-[#0a0a0a] border border-primary/20 p-10 md:p-14 rounded-[40px] relative overflow-hidden group shadow-[0_0_40px_rgba(16,185,129,0.05)] hover:shadow-[0_0_50px_rgba(16,185,129,0.1)] transition-all">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent"></div>
                        <TrendingUp className="w-12 h-12 text-primary mb-8 relative z-10 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-4 relative z-10 tracking-tight">Zero Commissions</h3>
                        <p className="text-gray-300 relative z-10 text-lg leading-relaxed max-w-lg font-medium">Trade instantaneously directly from your Web3-inspired wallet without dealing with gas fees or hidden brokerage charges.</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 relative z-10 bg-[#050505]">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-xl font-bold text-white tracking-tight">
                        YT<span className="text-primary">Market</span>
                    </div>
                    <div className="text-gray-500 text-sm font-medium">
                        © {new Date().getFullYear()} YouTube Market. All rights reserved.
                    </div>
                </div>
            </footer>

            {/* Global Styles for Animations */}
            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px) scale(var(--tw-scale-x)); }
                    100% { transform: translateY(-20px) scale(var(--tw-scale-x)); }
                }
                .mask-image-gradient {
                    -webkit-mask-image: radial-gradient(circle at center, black, transparent 80%);
                    mask-image: radial-gradient(circle at center, black, transparent 80%);
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.8s ease-out forwards;
                    opacity: 0;
                    transform: translateY(20px);
                }
                .animate-fade-in {
                    animation: fadeIn 1s ease-out forwards;
                    opacity: 0;
                }
                @keyframes fadeInUp {
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
