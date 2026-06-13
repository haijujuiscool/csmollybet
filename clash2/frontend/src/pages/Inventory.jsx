import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Package, Gem, Loader2, ShoppingCart, ArrowUpFromLine } from 'lucide-react';

export default function Inventory() {
    const { user, loading: authLoading, refreshBalance } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hoveredId, setHoveredId] = useState(null);
    const [actionMsg, setActionMsg] = useState('');

    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        loadInventory();
    }, [user, authLoading]);

    const loadInventory = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/user-inventory', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setItems(res.data.filter(i => i.status === 'available'));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    const handleSell = async (itemId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/inventory/sell', { itemId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActionMsg(res.data.message);
            refreshBalance();
            loadInventory();
            setTimeout(() => setActionMsg(''), 4000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to sell item');
            setTimeout(() => setError(''), 4000);
        }
    };

    const handleWithdraw = async (itemId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/inventory/withdraw', { itemId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActionMsg(res.data.message);
            loadInventory();
            setTimeout(() => setActionMsg(''), 4000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to withdraw item');
            setTimeout(() => setError(''), 4000);
        }
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Package size={24} color="#000" />
                </div>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0' }}>Inventory</h1>
                    <p style={{ color: '#888', fontSize: '13px', margin: '2px 0 0' }}>
                        {items.length} item{items.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            {actionMsg && (
                <div style={{
                    padding: '12px 16px', background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)',
                    borderRadius: '10px', color: 'var(--accent-green)', fontSize: '13px', marginBottom: '16px'
                }}>{actionMsg}</div>
            )}

            {error && (
                <div style={{
                    padding: '12px 16px', background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)',
                    borderRadius: '10px', color: '#f44336', fontSize: '13px', marginBottom: '16px'
                }}>{error}</div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#666' }} />
                </div>
            ) : items.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '80px 20px',
                    background: 'rgba(30,30,30,0.4)', borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <Package size={48} style={{ color: '#444', marginBottom: '16px' }} />
                    <div style={{ fontSize: '16px', color: '#888', marginBottom: '8px' }}>Your inventory is empty</div>
                    <div style={{ fontSize: '13px', color: '#666' }}>Deposit CS2 skins to add items here.</div>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '16px'
                }}>
                    {items.map(item => (
                        <div
                            key={item.id}
                            style={{
                                position: 'relative',
                                background: 'rgba(30,30,30,0.6)',
                                borderRadius: '12px',
                                border: hoveredId === item.id ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                padding: '16px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            <img src={item.image_url || 'https://via.placeholder.com/90?text=Skin'}
                                alt={item.item_name}
                                style={{ width: '100%', height: '110px', objectFit: 'contain', borderRadius: '8px' }}
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/90?text=Skin'; }}
                            />
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e0e0e0', textAlign: 'center', lineHeight: '1.3', wordBreak: 'break-word' }}>
                                {item.item_name}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--accent-gold)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Gem size={14} />{item.item_value.toFixed(2)}
                            </div>

                            {hoveredId === item.id && (
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    display: 'flex', gap: '4px', padding: '8px',
                                    background: 'rgba(0,0,0,0.85)',
                                    backdropFilter: 'blur(4px)'
                                }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleSell(item.id); }}
                                        style={{
                                            flex: 1, padding: '8px 4px', borderRadius: '6px',
                                            background: 'linear-gradient(135deg, #4CAF50, #66BB6A)',
                                            color: '#fff', border: 'none', cursor: 'pointer',
                                            fontWeight: 700, fontSize: '12px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                        }}
                                    >
                                        <ShoppingCart size={12} /> Sell
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleWithdraw(item.id); }}
                                        style={{
                                            flex: 1, padding: '8px 4px', borderRadius: '6px',
                                            background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                                            color: '#000', border: 'none', cursor: 'pointer',
                                            fontWeight: 700, fontSize: '12px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                        }}
                                    >
                                        <ArrowUpFromLine size={12} /> Withdraw
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
