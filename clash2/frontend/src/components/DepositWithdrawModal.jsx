import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { X, Gem, RefreshCw, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function DepositWithdrawModal({ isOpen, onClose, initialTab }) {
    const { user, refreshBalance } = useAuth();
    const [activeTab, setActiveTab] = useState('deposit');

    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    
    // Deposit state
    const [inventory, setInventory] = useState([]);
    const [selectedItems, setSelectedItems] = useState({});

    // Withdraw state
    const [botInventory, setBotInventory] = useState([]);


    // Simulated trade bot flow state
    const [activeTradeOffer, setActiveTradeOffer] = useState(null);
    const [tradeOfferStep, setTradeOfferStep] = useState('inspect'); // 'inspect' | 'mobile_confirm' | 'success' | 'real_pending'
    const [tradeCheckbox, setTradeCheckbox] = useState(false);

    // Trade URL input states
    const [tradeUrlInput, setTradeUrlInput] = useState('');
    const [savingTradeUrl, setSavingTradeUrl] = useState(false);

    // Initialize trade URL input when user profile is loaded
    useEffect(() => {
        if (user?.trade_url) {
            setTradeUrlInput(user.trade_url);
        }
    }, [user]);

    // Polling effect for real trade offer status updates
    useEffect(() => {
        let interval;
        if (activeTradeOffer && tradeOfferStep === 'real_pending') {
            interval = setInterval(async () => {
                try {
                    const token = localStorage.getItem('token');
                    const headers = { Authorization: `Bearer ${token}` };
                    const res = await axios.get(`/api/deposit/status/${activeTradeOffer.id}`, { headers });
                    if (res.data.status === 'accepted') {
                        clearInterval(interval);
                        setMessage(`Real trade offer #${activeTradeOffer.id} accepted! Items have been added to your inventory.`);
                        setTradeOfferStep('success');
                        refreshBalance();
                        fetchData();
                    }
                } catch (err) {
                    console.error('Polling error:', err);
                }
            }, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTradeOffer, tradeOfferStep]);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            if (activeTab === 'deposit') {
                const res = await axios.get('/api/inventory', { headers });
                setInventory(res.data);
                setSelectedItems({});
            } else if (activeTab === 'withdraw') {
                const res = await axios.get('/api/bot-inventory', { headers });
                setBotInventory(res.data);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Toggle item selection for deposit (use idx as unique key to avoid duplicates)
    const handleSelectItem = (item, idx) => {
        setSelectedItems(prev => {
            const next = { ...prev };
            const key = `item_${idx}`;
            if (next[key]) {
                delete next[key];
            } else {
                next[key] = item;
            }
            return next;
        });
    };

    // Calculate values of selected items
    const selectedList = Object.values(selectedItems);
    const totalValue = selectedList.reduce((sum, item) => sum + item.value, 0);


    // Save trade URL to database
    const handleSaveTradeUrl = async () => {
        if (!tradeUrlInput.startsWith('https://steamcommunity.com/tradeoffer/new/')) {
            setError('Invalid Steam Trade URL. Must start with https://steamcommunity.com/tradeoffer/new/');
            return;
        }
        setSavingTradeUrl(true);
        setError('');
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post('/api/user/trade-url', { tradeUrl: tradeUrlInput }, { headers });
            setMessage('Trade URL saved successfully.');
            refreshBalance();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save trade URL');
        } finally {
            setSavingTradeUrl(false);
        }
    };

    // Submit deposit (initiates simulated or real trade offer)
    const handleDeposit = async () => {
        if (selectedList.length === 0) return;
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/deposit', {
                items: selectedList
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveTradeOffer({
                id: res.data.tradeOfferId,
                items: res.data.items
            });
            if (res.data.isRealTrade) {
                setTradeOfferStep('real_pending');
            } else {
                setTradeOfferStep('inspect');
            }
            setTradeCheckbox(false);
            setSelectedItems({});
        } catch (err) {
            setError(err.response?.data?.error || 'Deposit failed');
        } finally {
            setLoading(false);
        }
    };

    // Confirm simulated trade offer via backend
    const handleConfirmTradeOffer = async () => {
        if (!activeTradeOffer) return;
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/deposit/confirm', {
                tradeOfferId: activeTradeOffer.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setTradeOfferStep('success');
            refreshBalance();
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to confirm trade offer');
            setTradeOfferStep('inspect');
        } finally {
            setLoading(false);
        }
    };

    // Submit withdrawal
    const handleWithdraw = async (itemId, itemValue, itemName) => {
        if (!confirm(`Are you sure you want to withdraw ${itemName} for ${itemValue} gems?`)) return;
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/withdraw', { itemId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message || "An admin will review your withdrawal.");
            setMessage(res.data.message);
            refreshBalance();
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Withdrawal failed');
        } finally {
            setLoading(false);
        }
    };


    if (activeTradeOffer) {
        return (
            <div className="modal-overlay" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1100,
                backdropFilter: 'blur(10px)'
            }}>
                <div className="steam-trade-modal" style={{
                    background: '#1b2838', // Steam Dark Blue/Grey
                    color: '#c6d4df',
                    fontFamily: '"Motiva Sans", Sans-Serif, Arial',
                    border: '1px solid #3d4450',
                    borderRadius: '4px',
                    width: '820px',
                    maxWidth: '95%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
                    overflow: 'hidden'
                }}>
                    {/* Steam Window Header */}
                    <div style={{
                        background: 'linear-gradient(to right, #171a21 0%, #1b2838 100%)',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #3a3f4c'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_01.png" alt="Steam Logo" style={{ height: '16px' }} />
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px' }}>STEAM DEPOSIT</span>
                        </div>
                        <button 
                            onClick={() => {
                                if (tradeOfferStep === 'success' || confirm('Cancel this trade offer? The skins will remain in a pending state.')) {
                                    setActiveTradeOffer(null);
                                    setError('');
                                    setMessage('');
                                }
                            }}
                            style={{ background: 'none', border: 'none', color: '#66c0f4', cursor: 'pointer', fontSize: '16px' }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Steam Trade Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                        {tradeOfferStep === 'inspect' && (
                            <div>
                                {/* Info Box */}
                                <div style={{
                                    backgroundColor: '#263645',
                                    border: '1px solid #4f6071',
                                    borderRadius: '3px',
                                    padding: '12px 16px',
                                    marginBottom: '20px',
                                    color: '#acb2b8',
                                    fontSize: '13px',
                                    lineHeight: '1.5'
                                }}>
                                    <strong style={{ color: '#fff' }}>Trade Offer from csmolly.bet Tradebot #1</strong><br />
                                    This is a simulated Steam trade offer. To proceed with the deposit, review the items you are giving, check the confirmation box, and accept the trade.
                                </div>

                                {/* Main Trade Grid */}
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    {/* Left Column - Your Items */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Items You Will Give (Deposit)
                                        </div>
                                        <div style={{
                                            backgroundColor: '#101822',
                                            border: '1px solid #3d4450',
                                            borderRadius: '4px',
                                            padding: '12px',
                                            minHeight: '220px',
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                                            gap: '10px'
                                        }}>
                                            {activeTradeOffer.items.map((item, idx) => {
                                                const rarityColors = {
                                                    'Consumer': '#b0c3d9',
                                                    'Industrial': '#5e98d9',
                                                    'Mil-Spec': '#4b69ff',
                                                    'Restricted': '#8847ff',
                                                    'Classified': '#d32cee',
                                                    'Covert': '#eb4b4b',
                                                    'Special': '#ffd700',
                                                    'Rare': '#ffd700',
                                                    'Extraordinary': '#ffd700',
                                                    'Contraband': '#ffaf00'
                                                };
                                        const rarityHex = rarityColors[item.rarity] || '#8f98a0';
                                        const rarityBg = rarityHex + '15';
                                        const wearMatch = item.name.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/);
                                        const wearShort = wearMatch ? {
                                            'Factory New': 'FN',
                                            'Minimal Wear': 'MW',
                                            'Field-Tested': 'FT',
                                            'Well-Worn': 'WW',
                                            'Battle-Scarred': 'BS'
                                        }[wearMatch[1]] : '';
                                        return (
                                        <div 
                                            key={idx}
                                            style={{
                                                background: `radial-gradient(ellipse at center, ${rarityBg} 0%, transparent 70%), #1b2838`,
                                                border: `3px solid ${rarityHex}`,
                                                borderRadius: '3px',
                                                padding: '8px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                textAlign: 'center',
                                                justifyContent: 'space-between',
                                                position: 'relative',
                                                boxShadow: `0 0 15px ${rarityHex}, 0 0 30px ${rarityHex}77`
                                            }}
                                                >
                                                    {wearShort && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '4px',
                                                            left: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 'bold',
                                                            color: '#fff',
                                                            background: 'rgba(0,0,0,0.75)',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            lineHeight: 1,
                                                            zIndex: 1
                                                        }}>
                                                            {wearShort}
                                                        </div>
                                                    )}
                                                    <img src={item.image_url} alt={item.name} style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                                                    <div style={{ fontSize: '9px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '24px', marginTop: '4px', color: '#c6d4df' }}>
                                                        {item.name}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#4ade80', fontWeight: 'bold', marginTop: '4px' }}>
                                                        ${item.value.toFixed(2)}
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Right Column - Receive Items */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Items You Will Receive
                                        </div>
                                        <div style={{
                                            backgroundColor: '#101822',
                                            border: '1px solid #3d4450',
                                            borderRadius: '4px',
                                            padding: '20px',
                                            minHeight: '220px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            textAlign: 'center',
                                            color: '#8f98a0',
                                            fontSize: '13px'
                                        }}>
                                            <div style={{ fontSize: '40px', marginBottom: '10px', color: '#8f98a0' }}>🎁</div>
                                            <div style={{ fontWeight: 'bold', color: '#c6d4df', marginBottom: '4px' }}>This is a Gift</div>
                                            You will receive no items from this trade.<br />
                                            (The items you give will be deposited into your account as Gems).
                                        </div>
                                    </div>
                                </div>

                                {/* Checkbox and Accept Section */}
                                <div style={{
                                    marginTop: '25px',
                                    borderTop: '1px solid #3d4450',
                                    paddingTop: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '15px'
                                }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#c6d4df' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={tradeCheckbox}
                                            onChange={(e) => setTradeCheckbox(e.target.checked)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <span>Ready to trade? Click here to confirm the trade contents.</span>
                                    </label>

                                    <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                        <button
                                            disabled={!tradeCheckbox || loading}
                                            onClick={() => setTradeOfferStep('mobile_confirm')}
                                            style={{
                                                background: tradeCheckbox ? 'linear-gradient(to bottom, #a4d007 0%, #536f00 100%)' : '#3d4450',
                                                border: '1px solid #2f3e00',
                                                borderRadius: '2px',
                                                color: tradeCheckbox ? '#fff' : '#8f98a0',
                                                padding: '10px 30px',
                                                fontSize: '15px',
                                                fontWeight: 'bold',
                                                cursor: tradeCheckbox ? 'pointer' : 'not-allowed',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                                            }}
                                        >
                                            Accept Trade Offer
                                        </button>
                                        <button
                                            onClick={() => {
                                                setActiveTradeOffer(null);
                                                setError('');
                                                setMessage('');
                                            }}
                                            style={{
                                                backgroundColor: '#3d4450',
                                                border: 'none',
                                                color: '#fff',
                                                padding: '10px 20px',
                                                fontSize: '15px',
                                                borderRadius: '2px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancel Trade
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tradeOfferStep === 'mobile_confirm' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
                                {/* Simulated Phone Device */}
                                <div style={{
                                    border: '12px solid #000',
                                    borderRadius: '36px',
                                    width: '300px',
                                    height: '460px',
                                    backgroundColor: '#171a21',
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    fontFamily: 'system-ui, -apple-system, sans-serif'
                                }}>
                                    {/* Mobile Screen Header */}
                                    <div style={{ backgroundColor: '#212429', padding: '15px', borderBottom: '1px solid #333a42', textAlign: 'center' }}>
                                        <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <span style={{ color: '#66c0f4', fontSize: '18px' }}>🛡️</span> STEAM GUARD
                                        </div>
                                    </div>

                                    {/* Mobile Screen Content */}
                                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
                                        <div style={{ marginTop: '20px' }}>
                                            <div style={{ fontSize: '50px', marginBottom: '15px' }}>📲</div>
                                            <div style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Confirm Trade Offer</div>
                                            <div style={{ color: '#8f98a0', fontSize: '12px', lineHeight: '1.4' }}>
                                                A trade offer with csmolly.bet Bot #1 (Offer ID: {activeTradeOffer.id}) is waiting for your confirmation.
                                            </div>
                                        </div>

                                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                            <div style={{
                                                backgroundColor: '#1b2838',
                                                border: '1px solid #3d4450',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                color: '#c6d4df'
                                            }}>
                                                Giving: {activeTradeOffer.items.length} items<br />
                                                Total value: ${activeTradeOffer.items.reduce((sum, i) => sum + i.value, 0).toFixed(2)}
                                            </div>

                                            <button
                                                onClick={handleConfirmTradeOffer}
                                                disabled={loading}
                                                style={{
                                                    backgroundColor: '#66c0f4',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    color: '#fff',
                                                    padding: '12px',
                                                    fontWeight: 'bold',
                                                    fontSize: '14px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                {loading ? <RefreshCw size={14} className="animate-spin" /> : 'Confirm Trade'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setTradeOfferStep('inspect')}
                                    style={{
                                        marginTop: '20px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#66c0f4',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    ← Back to Trade Offer details
                                </button>
                            </div>
                        )}

                        {tradeOfferStep === 'real_pending' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', textAlign: 'center' }}>
                                <div style={{ fontSize: '60px', marginBottom: '20px', animation: 'bounce 2s infinite' }}>📨</div>
                                <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>REAL TRADE OFFER SENT!</h3>
                                <div style={{ color: '#acb2b8', fontSize: '14px', maxWidth: '500px', lineHeight: '1.6', marginBottom: '30px' }}>
                                    We sent a real Steam trade offer to your account (Offer ID: <strong style={{ color: '#fff' }}>{activeTradeOffer.id}</strong>).
                                    <br />
                                    Please open the trade offer on Steam and accept it to finalize your deposit.
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', width: '100%', maxWidth: '350px' }}>
                                    <a
                                        href={`https://steamcommunity.com/tradeoffer/${activeTradeOffer.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            background: 'linear-gradient(to bottom, #a4d007 0%, #536f00 100%)',
                                            border: '1px solid #2f3e00',
                                            borderRadius: '2px',
                                            color: '#fff',
                                            padding: '12px 24px',
                                            fontSize: '15px',
                                            fontWeight: 'bold',
                                            textDecoration: 'none',
                                            width: '100%',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                            display: 'inline-block',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Open Trade Offer on Steam
                                    </a>
                                    
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        gap: '10px', 
                                        color: '#66c0f4', 
                                        fontSize: '13px',
                                        backgroundColor: '#101822',
                                        padding: '10px 16px',
                                        borderRadius: '4px',
                                        border: '1px solid #3d4450',
                                        width: '100%'
                                    }}>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Waiting for you to accept on Steam...</span>
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            setActiveTradeOffer(null);
                                            setError('');
                                            setMessage('');
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#f87171',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            textDecoration: 'underline',
                                            marginTop: '10px'
                                        }}
                                    >
                                        Cancel & Go Back
                                    </button>
                                </div>
                            </div>
                        )}

                        {tradeOfferStep === 'success' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', textAlign: 'center' }}>
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(74, 222, 128, 0.1)',
                                    border: '3px solid #4ade80',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '40px',
                                    color: '#4ade80',
                                    marginBottom: '20px'
                                }}>
                                    ✓
                                </div>
                                <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>TRADE SUCCESSFUL</h3>
                                <div style={{ color: '#acb2b8', fontSize: '14px', maxWidth: '400px', lineHeight: '1.5', marginBottom: '30px' }}>
                                    {message || 'The trade was successfully completed! All items have been added to your inventory.'}
                                </div>
                                <button
                                    onClick={() => {
                                        setActiveTradeOffer(null);
                                        setError('');
                                        setMessage('');
                                    }}
                                    style={{
                                        background: 'linear-gradient(to bottom, #a4d007 0%, #536f00 100%)',
                                        border: '1px solid #2f3e00',
                                        borderRadius: '2px',
                                        color: '#fff',
                                        padding: '12px 40px',
                                        fontSize: '15px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            backdropFilter: 'blur(8px)'
        }}>
            <div className="modal-content" style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                width: '850px',
                maxWidth: '90%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
            }}>
                {/* Modal Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    background: 'rgba(30, 41, 59, 0.4)'
                }}>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Gem size={20} className="text-primary" /> Steam Inventory Tradebot
                    </h3>
                    <button onClick={onClose} style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        transition: 'all 0.2s'
                    }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.5)'}>
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div style={{
                    display: 'flex',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    padding: '10px 24px 0'
                }}>
                    {[
                        { id: 'deposit', label: 'Deposit skins', icon: <ArrowDownLeft size={16} /> },
                        { id: 'withdraw', label: 'Withdraw skins', icon: <ArrowUpRight size={16} /> },
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid var(--accent-green)' : '2px solid transparent',
                                color: activeTab === tab.id ? '#fff' : 'rgba(255, 255, 255, 0.4)',
                                padding: '12px 18px',
                                cursor: 'pointer',
                                fontSize: '15px',
                                fontWeight: activeTab === tab.id ? 600 : 500,
                                transition: 'all 0.2s',
                                outline: 'none'
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Notifications & Status messages */}
                {(error || message) && (
                    <div style={{ padding: '12px 24px 0' }}>
                        {error && (
                            <div style={{ 
                                backgroundColor: (activeTab === 'withdraw' && error.toLowerCase().includes('wager')) ? '#f97316' : 'rgba(239, 68, 68, 0.1)', 
                                border: (activeTab === 'withdraw' && error.toLowerCase().includes('wager')) ? 'none' : '1px solid rgba(239, 68, 68, 0.2)', 
                                color: (activeTab === 'withdraw' && error.toLowerCase().includes('wager')) ? '#fff' : '#f87171', 
                                padding: '10px 14px', 
                                borderRadius: '8px', 
                                fontSize: '14px',
                                fontWeight: (activeTab === 'withdraw' && error.toLowerCase().includes('wager')) ? '600' : 'normal'
                            }}>
                                {error}
                            </div>
                        )}
                        {message && <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' }}>{message}</div>}
                    </div>
                )}

                {/* Scrollable Content Body */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '250px'
                }}>
                    {loading && (
                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
                            <RefreshCw size={24} className="animate-spin" />
                            Loading inventory...
                        </div>
                    )}

                    {!loading && activeTab === 'deposit' && (
                        <>
                            {/* Trade URL Configuration */}
                            <div style={{
                                backgroundColor: 'rgba(30, 41, 59, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '16px',
                                marginBottom: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>Steam Trade URL</span>
                                    <a 
                                        href="https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        style={{ fontSize: '11px', color: '#66c0f4', textDecoration: 'none' }}
                                    >
                                        Find your Trade URL here
                                    </a>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input 
                                        type="text" 
                                        value={tradeUrlInput}
                                        onChange={(e) => setTradeUrlInput(e.target.value)}
                                        placeholder="https://steamcommunity.com/tradeoffer/new/?partner=..."
                                        style={{
                                            flex: 1,
                                            backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '6px',
                                            padding: '8px 12px',
                                            color: '#fff',
                                            fontSize: '13px',
                                            outline: 'none'
                                        }}
                                    />
                                    <button 
                                        onClick={handleSaveTradeUrl}
                                        disabled={savingTradeUrl}
                                        className="btn-secondary"
                                        style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        {savingTradeUrl ? <RefreshCw size={14} className="animate-spin" /> : 'Save URL'}
                                    </button>
                                </div>

                            </div>

                            {inventory.length === 0 ? (
                                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'rgba(255, 255, 255, 0.3)', padding: '40px 0' }}>
                                    No tradable skins found in your Steam Inventory.
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                    gap: '16px',
                                    marginBottom: '20px'
                                }}>
                                    {inventory.map((item, idx) => {
                                        const isSelected = !!selectedItems[`item_${idx}`];
                                        // Rarity glow colors
                                        const rarityColors = {
                                            'Consumer': '#b0c3d9',
                                            'Industrial': '#5e98d9',
                                            'Mil-Spec': '#4b69ff',
                                            'Restricted': '#8847ff',
                                            'Classified': '#d32cee',
                                            'Covert': '#eb4b4b',
                                            'Special': '#ffd700',
                                            'Rare': '#ffd700',
                                            'Extraordinary': '#ffd700',
                                            'Contraband': '#ffaf00'
                                        };
                                                const rarityHex = rarityColors[item.rarity] || '#8f98a0';
                                                const rarityBg = rarityHex + '15';
                                        // Extract wear from name
                                        const wearMatch = item.name.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/);
                                        const wearShort = wearMatch ? {
                                            'Factory New': 'FN',
                                            'Minimal Wear': 'MW',
                                            'Field-Tested': 'FT',
                                            'Well-Worn': 'WW',
                                            'Battle-Scarred': 'BS'
                                        }[wearMatch[1]] : '';
                                        return (
                                            <div 
                                                key={idx}
                                                onClick={() => handleSelectItem(item, idx)}
                                                style={{
                                                    background: `radial-gradient(ellipse at center, ${rarityBg} 0%, transparent 70%), ${isSelected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(30, 41, 59, 0.3)'}`,
                                                    border: `3px solid ${rarityHex}`,
                                                    borderRadius: '12px',
                                                    padding: '12px',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    transition: 'all 0.2s',
                                                    position: 'relative',
                                                    boxShadow: `0 0 20px ${rarityHex}, 0 0 40px ${rarityHex}77`
                                                }}
                                            >
                                                {/* Wear badge (top left) */}
                                                {wearShort && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '6px',
                                                        left: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold',
                                                        color: '#fff',
                                                        background: 'rgba(0,0,0,0.75)',
                                                        padding: '3px 7px',
                                                        borderRadius: '5px',
                                                        lineHeight: 1,
                                                        zIndex: 1
                                                    }}>
                                                        {wearShort}
                                                    </div>
                                                )}
                                                {/* Checkbox badge */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '4px',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    background: isSelected ? 'var(--accent-green)' : 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '10px',
                                                    color: '#000',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {isSelected && '✓'}
                                                </div>

                                                <img 
                                                    src={item.image_url || 'https://via.placeholder.com/90?text=Skin'} 
                                                    alt={item.name}
                                                    style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '8px' }}
                                                />
                                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '32px', marginBottom: '6px' }}>
                                                    {item.name}
                                                </div>
                                                <div style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Gem size={12} /> {item.value.toFixed(2)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {!loading && activeTab === 'withdraw' && (
                        <>
                            {botInventory.length === 0 ? (
                                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'rgba(255, 255, 255, 0.3)', padding: '40px 0' }}>
                                    The Tradebot currently has no items in its inventory. Check back later!
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                    gap: '16px'
                                }}>
                                    {botInventory.map((item) => (
                                        <div 
                                            key={item.id}
                                            style={{
                                                background: 'rgba(30, 41, 59, 0.3)',
                                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                                borderRadius: '12px',
                                                padding: '12px',
                                                textAlign: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <img 
                                                src={item.image_url || 'https://via.placeholder.com/90?text=Skin'} 
                                                alt={item.item_name}
                                                style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '8px' }}
                                            />
                                            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '32px', marginBottom: '4px' }}>
                                                {item.item_name}
                                            </div>
                                            {item.float_value !== undefined && item.float_value !== null && (
                                                <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '4px' }}>
                                                    Float: {item.float_value.toFixed(4)}
                                                </div>
                                            )}
                                            <div style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                                                <Gem size={12} /> {item.item_value.toFixed(2)}
                                            </div>
                                            <button 
                                                onClick={() => handleWithdraw(item.id, item.item_value, item.item_name)}
                                                disabled={user.gems < item.item_value}
                                                className="btn-primary"
                                                style={{ 
                                                    fontSize: '11px', 
                                                    padding: '6px 12px', 
                                                    width: '100%',
                                                    opacity: user.gems < item.item_value ? 0.4 : 1,
                                                    cursor: user.gems < item.item_value ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                {user.gems < item.item_value ? 'Too expensive' : 'Withdraw'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}


                </div>

                {/* Modal Footer (only visible in Deposit Tab to finalize selection) */}
                {activeTab === 'deposit' && selectedList.length > 0 && (
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        background: 'rgba(30, 41, 59, 0.4)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items Selected</div>
                                <div style={{ color: '#fff', fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>{selectedList.length} skins</div>
                            </div>
                            <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)' }}></div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Value</div>
                                <div style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: '15px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Gem size={14} /> {totalValue.toFixed(2)}
                                </div>
                            </div>
                            <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)' }}></div>
                            <div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goes to Inventory</div>
                                <div style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                                    Items
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={handleDeposit}
                            disabled={loading}
                            className="btn-primary"
                            style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
                        >
                            Deposit Selected
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
