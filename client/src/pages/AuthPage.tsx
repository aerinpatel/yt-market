import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const url = isLogin ? 'http://localhost:3000/api/auth/login' : 'http://localhost:3000/api/auth/register';
            const payload = isLogin ? { email, password } : { email, username, password };
            
            const { data } = await axios.post(url, payload);
            login(data.token, data.user);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Authentication failed');
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="bg-[#0a0a0a]/80 backdrop-blur-3xl p-10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-md border border-white/10 relative z-10">
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 text-center mb-8 tracking-tight">
                    {isLogin ? 'Welcome Back' : 'Join the Exchange'}
                </h1>
                
                {error && <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-gray-400 mb-1.5 text-sm font-medium">Email Address</label>
                        <input 
                            type="email" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    {!isLogin && (
                        <div>
                            <label className="block text-gray-400 mb-1.5 text-sm font-medium">Username</label>
                            <input 
                                type="text" 
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-gray-400 mb-1.5 text-sm font-medium">Password</label>
                        <input 
                            type="password" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-inner"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    
                    <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-black font-extrabold py-3 px-4 rounded-lg transition-colors shadow-lg hover:shadow-primary/20 transform hover:-translate-y-0.5 mt-2">
                        {isLogin ? 'Enter Market' : 'Create Portfolio'}
                    </button>
                </form>

                <div className="mt-8 text-center text-gray-500 text-sm">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={() => setIsLogin(!isLogin)} className="text-white hover:text-primary transition-colors font-medium ml-1">
                        {isLogin ? 'Sign up' : 'Log in'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
