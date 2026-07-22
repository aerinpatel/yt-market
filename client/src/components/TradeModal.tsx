import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { X, ArrowRightLeft } from 'lucide-react';

interface TradeModalProps {
    channel: any;
    currentPrice: number;
    ownedShares: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const TradeModal = ({ channel, currentPrice, ownedShares, isOpen, onClose, onSuccess }: TradeModalProps) => {
    const { user, refreshPortfolio } = useAuth();
    const [amount, setAmount] = useState<number | ''>('');
    const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !channel) return null;

    const numAmount = Number(amount);
    const LIQUIDITY_DEPTH = 10000;
    
    // Simulate Bonding Curve pricing
    let totalCost = 0;
    let newMarketPrice = currentPrice;
    
    if (numAmount > 0) {
        if (tradeType === 'BUY') {
            totalCost = currentPrice * LIQUIDITY_DEPTH * (Math.exp(numAmount / LIQUIDITY_DEPTH) - 1);
            newMarketPrice = currentPrice * Math.exp(numAmount / LIQUIDITY_DEPTH);
        } else {
            totalCost = currentPrice * LIQUIDITY_DEPTH * (1 - Math.exp(-numAmount / LIQUIDITY_DEPTH));
            newMarketPrice = currentPrice * Math.exp(-numAmount / LIQUIDITY_DEPTH);
        }
    }

    const canAfford = tradeType === 'BUY' ? (user?.walletBalance || 0) >= totalCost : true;
    const canSell = tradeType === 'SELL' ? ownedShares >= numAmount : true;
    const isValid = numAmount > 0 && canAfford && canSell;

    const priceImpact = numAmount > 0 ? ((newMarketPrice - currentPrice) / currentPrice) * 100 : 0;

    const handleTrade = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setLoading(true);
        setError('');
        try {
            await axios.post('http://localhost:3000/api/trade', {
                channelId: channel.id,
                type: tradeType,
                amount: numAmount
            }, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                }
            });
            await refreshPortfolio();
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || "Trade failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#050505]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 selection:bg-primary/20">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-500"></div>
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h2 className="text-2xl font-extrabold text-white flex items-center gap-3 tracking-tight">
                        <ArrowRightLeft className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        Trade {channel.name}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-2 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow-inner">
                            <div className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-widest">Market Price</div>
                            <div className="text-2xl font-black text-white font-mono tracking-tight">${currentPrice.toFixed(2)}</div>
                        </div>
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow-inner">
                            <div className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-widest">Your Position</div>
                            <div className="text-2xl font-black text-primary font-mono tracking-tight">{ownedShares} <span className="text-sm font-medium">Shares</span></div>
                        </div>
                    </div>

                    <div className="flex bg-white/5 rounded-xl p-1.5 mb-6 border border-white/10 shadow-inner">
                        <button
                            type="button"
                            className={`flex-1 py-3 text-sm font-black tracking-widest uppercase rounded-lg transition-all ${tradeType === 'BUY' ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_4px_15px_rgba(16,185,129,0.2)] transform -translate-y-0.5' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                            onClick={() => setTradeType('BUY')}
                        >
                            BUY
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-3 text-sm font-black tracking-widest uppercase rounded-lg transition-all ${tradeType === 'SELL' ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_4px_15px_rgba(239,68,68,0.2)] transform -translate-y-0.5' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                            onClick={() => setTradeType('SELL')}
                        >
                            SELL
                        </button>
                    </div>

                    {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl mb-6 text-sm font-bold shadow-inner">{error}</div>}

                    <form onSubmit={handleTrade}>
                        <div className="mb-6">
                            <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Order Quantity</label>
                            <input
                                type="number"
                                min="1"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-3xl font-mono text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-inner transition-all tracking-tight"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value === '' ? '' : parseInt(e.target.value))}
                                placeholder="0"
                            />
                        </div>

                        {numAmount > 0 && (
                            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Est. Market Impact</span>
                                    <span className={`text-sm font-mono font-bold ${priceImpact > 0 ? 'text-primary' : priceImpact < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {priceImpact > 0 ? '+' : ''}{priceImpact.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">New Market Price</span>
                                    <span className="text-white text-sm font-mono font-bold">
                                        ${newMarketPrice.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center mb-8 px-2">
                            <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Total {tradeType === 'BUY' ? 'Cost' : 'Return'}:</span>
                            <span className={`text-3xl font-black font-mono tracking-tighter ${tradeType === 'BUY' ? (!canAfford ? 'text-red-500' : 'text-white') : 'text-white'}`}>
                                ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>

                        <button 
                            type="submit" 
                            disabled={!isValid || loading}
                            className={`w-full py-5 rounded-2xl font-black text-lg tracking-widest uppercase transition-all shadow-xl ${
                                !isValid || loading 
                                    ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed hidden-shadow' 
                                    : tradeType === 'BUY' 
                                        ? 'bg-primary hover:bg-primary-dark text-black shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_10px_40px_rgba(16,185,129,0.4)] transform hover:-translate-y-1'
                                        : 'bg-red-500 hover:bg-red-600 text-white shadow-[0_10px_30px_rgba(239,68,68,0.3)] hover:shadow-[0_10px_40px_rgba(239,68,68,0.4)] transform hover:-translate-y-1'
                            }`}
                        >
                            {loading ? 'Executing...' : `Confirm ${tradeType}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TradeModal;
