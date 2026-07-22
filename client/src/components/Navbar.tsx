import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Briefcase, TrendingUp, Bell, Shield, Rocket } from 'lucide-react';


const Navbar = () => {
    const { user, logout } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const fetchNotifications = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;
            try {
                const { data } = await axios.get('http://localhost:3000/api/notifications', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setNotifications(data);
                // Simple logic: all fetched are considered new if we haven't seen them yet, but the user spec just says build the Bell. 
                // We'll mark them unread if they were created in the last 24h just for simulation.
                const recent = data.filter((n: any) => (Date.now() - new Date(n.createdAt).getTime()) < 24 * 60 * 60 * 1000);
                setUnreadCount(recent.length);
            } catch (err) {
                console.error(err);
            }
        };

        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 60000); // Check every minute
            return () => clearInterval(interval);
        }
    }, [user]);

    return (
        <nav className="bg-[#050505]/60 backdrop-blur-xl border-b border-white/10 p-4 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-2 group">
                    <TrendingUp className="text-primary w-6 h-6 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <Link to={user ? "/dashboard" : "/"} className="text-xl font-bold text-white tracking-tight">
                        YT<span className="text-primary">Market</span>
                    </Link>
                </div>

                {user ? (
                    <>
                        <div className="flex items-center space-x-6">
                            <Link to="/dashboard" className="text-gray-300 hover:text-white flex items-center space-x-1 transition-colors">
                                <LayoutDashboard className="w-4 h-4" />
                                <span>Exchange</span>
                            </Link>
                            <Link to="/portfolio" className="text-gray-300 hover:text-white flex items-center space-x-1 transition-colors">
                                <Briefcase className="w-4 h-4" />
                                <span>Portfolio</span>
                            </Link>
                            <Link to="/creator" className="text-primary hover:text-primary-light flex items-center space-x-1 transition-colors font-semibold">
                                <Rocket className="w-4 h-4" />
                                <span>Creator Portal</span>
                            </Link>
                            {user?.role === 'ADMIN' && (

                                <Link to="/admin" className="text-purple-400 hover:text-purple-300 flex items-center space-x-1 transition-colors">
                                    <Shield className="w-4 h-4" />
                                    <span>Admin</span>
                                </Link>
                            )}
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setShowNotifications(!showNotifications);
                                        setUnreadCount(0); // mark read on click
                                    }}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors relative"
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                    )}
                                </button>

                                {showNotifications && (
                                    <div className="absolute right-0 mt-2 w-80 bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden z-50">
                                        <div className="p-3 border-b border-white/10 font-bold text-white flex items-center justify-between">
                                            Notifications
                                            {unreadCount > 0 && <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">{unreadCount} New</span>}
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-4 text-center text-gray-500 text-sm">No notifications.</div>
                                            ) : (
                                                notifications.map((n) => (
                                                    <div key={n.id} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                                                        <div className="text-gray-200 text-sm mb-1">{n.message}</div>
                                                        <div className="text-primary/70 text-xs">{new Date(n.createdAt).toLocaleString()}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Link to="/dashboard" className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-sm font-bold transition-all mr-2">
                                Go to Dashboard
                            </Link>

                            <div className="text-right border-l border-white/10 pl-4">
                                <div className="text-sm text-gray-400 tracking-tight">@{user?.username}</div>
                                <div className="text-primary font-bold drop-shadow-[0_0_5px_rgba(16,185,129,0.4)]">${user?.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            
                            <button 
                                onClick={logout}
                                className="p-2 ml-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-full transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center space-x-4">
                        <Link to="/auth" className="text-gray-300 hover:text-white font-medium transition-colors">
                            Sign In
                        </Link>
                        <Link to="/auth" className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-black rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-primary/40 transform hover:-translate-y-0.5">
                            Get Started
                        </Link>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
