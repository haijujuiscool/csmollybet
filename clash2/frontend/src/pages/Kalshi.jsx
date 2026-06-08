import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const renderFormattedTitle = (title) => {
    if (!title) return '';
    const parts = title.split('**');
    return parts.map((part, index) => {
        if (index % 2 === 1) {
            return <strong key={index} style={{ color: 'var(--accent-gold)' }}>{part}</strong>;
        }
        return part;
    });
};

const getCommonTitle = (titles) => {
    if (!titles || titles.length === 0) return '';
    if (titles.length === 1) return titles[0];
    
    // Find longest common prefix
    let prefix = titles[0];
    for (let i = 1; i < titles.length; i++) {
        while (titles[i].indexOf(prefix) !== 0) {
            prefix = prefix.substring(0, prefix.length - 1);
            if (prefix === '') break;
        }
    }
    
    // Find longest common suffix
    let suffix = titles[0];
    for (let i = 1; i < titles.length; i++) {
        const str = titles[i];
        while (suffix !== '' && !str.endsWith(suffix)) {
            suffix = suffix.substring(1);
        }
    }
    
    if (prefix === titles[0]) return prefix;
    
    const cleanedPrefix = prefix.trim();
    const cleanedSuffix = suffix.trim();
    
    if (cleanedPrefix === '' && cleanedSuffix === '') {
        return titles[0];
    }
    
    let result = '';
    if (cleanedPrefix) result += cleanedPrefix;
    if (cleanedPrefix && cleanedSuffix) {
        result += ' ... ';
    } else if (cleanedPrefix || cleanedSuffix) {
        result += '...';
    }
    if (cleanedSuffix) result += cleanedSuffix;
    
    result = result.replace(/\s+/g, ' ');
    return result;
};

export default function Kalshi() {
    const { user, refreshBalance } = useAuth();
    const [markets, setMarkets] = useState([]);
    const [bets, setBets] = useState([]);
    const [activeTab, setActiveTab] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal state
    const [selectedMarket, setSelectedMarket] = useState(null);
    const [position, setPosition] = useState('yes');
    const [contracts, setContracts] = useState(10);
    const [buyLoading, setBuyLoading] = useState(false);
    const [buyError, setBuyError] = useState('');
    const [buySuccess, setBuySuccess] = useState('');

    // General state
    const [loading, setLoading] = useState(true);
    const [sellLoading, setSellLoading] = useState(null);

    const categories = ['All', 'Crypto', 'Politics', 'Economy', 'Tech & Science', 'Pop Culture', 'Weather', 'Sports', 'Other'];

    const fetchMarkets = async () => {
        try {
            const res = await axios.get('/api/kalshi/markets');
            setMarkets(res.data.markets || []);
        } catch (err) {
            console.error('Error fetching Kalshi markets:', err);
        }
    };

    const fetchBets = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await axios.get('/api/kalshi/my-bets', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBets(res.data.bets || []);
        } catch (err) {
            console.error('Error fetching Kalshi bets:', err);
        }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            await Promise.all([fetchMarkets(), fetchBets()]);
            setLoading(false);
        };
        loadInitialData();

        // Keep prices and bets updated every 10s
        const interval = setInterval(() => {
            fetchMarkets();
            fetchBets();
        }, 10000);

        return () => clearInterval(interval);
    }, [user]);

    const handleBuy = async (e) => {
        e.preventDefault();
        if (!user) return alert('Please login to place bets.');
        if (contracts <= 0) return setBuyError('Contracts must be at least 1');
        
        setBuyLoading(true);
        setBuyError('');
        setBuySuccess('');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/kalshi/buy', {
                ticker: selectedMarket.ticker,
                position,
                contracts: parseInt(contracts)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setBuySuccess(res.data.message);
            refreshBalance();
            fetchBets();
            fetchMarkets();
            
            setTimeout(() => {
                setSelectedMarket(null);
                setBuySuccess('');
            }, 1500);
        } catch (err) {
            setBuyError(err.response?.data?.error || 'Purchase failed');
        } finally {
            setBuyLoading(false);
        }
    };

    const handleSell = async (betId) => {
        setSellLoading(betId);
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/kalshi/sell', { betId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            refreshBalance();
            fetchBets();
            fetchMarkets();
        } catch (err) {
            alert(err.response?.data?.error || 'Cashout failed');
        } finally {
            setSellLoading(null);
        }
    };

    // Filters
    const filteredMarkets = markets.filter(m => {
        const matchesTab = activeTab === 'All' || m.category === activeTab;
        const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.ticker.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    // Group filtered markets by event_ticker
    const groupedEvents = [];
    const eventGroups = {};

    filteredMarkets.forEach(market => {
        const eventId = market.event_ticker || market.ticker;
        if (!eventGroups[eventId]) {
            eventGroups[eventId] = {
                id: eventId,
                title: market.title,
                category: market.category,
                expiration_date: market.expiration_date,
                markets: []
            };
            groupedEvents.push(eventGroups[eventId]);
        }
        eventGroups[eventId].markets.push(market);
    });

    const activeBets = bets.filter(b => b.status === 'active');
    const pastBets = bets.filter(b => b.status !== 'active');

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                    <h1 style={{ color: 'var(--accent-gold)', fontSize: '2.5rem', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        📈 Kalshi Prediction Markets
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        Bet your Gems on real-world events and cash out early as probability shifts!
                    </p>
                </div>
            </div>

            {/* Navigation Tabs and Search Bar */}
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '25px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: '1 1 500px', scrollbarWidth: 'none' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveTab(cat)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                backgroundColor: activeTab === cat ? 'var(--accent-gold)' : 'var(--bg-panel)',
                                color: activeTab === cat ? '#000' : 'var(--text-main)',
                                border: `1px solid ${activeTab === cat ? 'var(--accent-gold)' : '#333'}`,
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <input
                    type="text"
                    placeholder="Search markets..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        color: '#fff',
                        width: '250px',
                        outline: 'none'
                    }}
                />
            </div>

            {/* Main Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', alignItems: 'start' }}>
                
                {/* Left Side: Market List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h2 style={{ fontSize: '1.5rem', borderBottom: '2px solid #333', paddingBottom: '10px', color: '#fff' }}>
                        Active Events ({groupedEvents.length})
                    </h2>
                    
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>Loading markets...</div>
                    ) : groupedEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid #333' }}>
                            No prediction markets found.
                        </div>
                    ) : (
                        groupedEvents.map(event => {
                            const commonTitle = getCommonTitle(event.markets.map(m => m.title));
                            const isMultiOutcome = event.markets.length > 1;

                            return (
                                <div
                                    key={event.id}
                                    style={{
                                        backgroundColor: 'var(--bg-panel)',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        border: '1px solid #333',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '15px',
                                        transition: 'transform 0.2s, border-color 0.2s',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'var(--accent-gold)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = '#333';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Card Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem', backgroundColor: '#333', padding: '3px 8px', borderRadius: '4px', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                            {event.category}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Expires: {new Date(event.expiration_date).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {/* Main Event Title */}
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: '0', lineHeight: '1.4' }}>
                                        {renderFormattedTitle(commonTitle)}
                                    </h3>

                                    {/* Outcomes List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
                                        {event.markets.map(market => {
                                            let probability = 50;
                                            if (market.yes_ask > 0 && market.no_ask > 0) {
                                                probability = Math.round((market.yes_ask / (market.yes_ask + market.no_ask)) * 100);
                                            } else if (market.last_price > 0) {
                                                probability = market.last_price;
                                            } else if (market.yes_ask > 0) {
                                                probability = market.yes_ask;
                                            }
                                            if (probability < 1) probability = 1;
                                            if (probability > 99) probability = 99;

                                            const isYesDisabled = !market.yes_ask || market.yes_ask <= 0;
                                            const isNoDisabled = !market.no_ask || market.no_ask <= 0;

                                            const outcomeLabel = market.yes_sub_title || 'Yes';

                                            return (
                                                <div
                                                    key={market.ticker}
                                                    style={{
                                                        backgroundColor: '#161616',
                                                        border: '1px solid #2a2a2a',
                                                        borderRadius: '8px',
                                                        padding: '12px 16px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        flexWrap: 'wrap',
                                                        gap: '12px',
                                                        transition: 'border-color 0.2s',
                                                    }}
                                                >
                                                    {/* Outcome Label & Implied Prob */}
                                                    <div style={{ flex: '1 1 200px' }}>
                                                        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                                                            {outcomeLabel}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Probability:</span>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 'bold' }}>{probability}%</span>
                                                            <div style={{ width: '60px', height: '4px', backgroundColor: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${probability}%`, height: '100%', backgroundColor: 'var(--accent-green)', transition: 'width 0.3s' }}></div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Buttons */}
                                                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                        <button
                                                            disabled={isYesDisabled}
                                                            onClick={() => {
                                                                setSelectedMarket(market);
                                                                setPosition('yes');
                                                            }}
                                                            style={{
                                                                padding: '8px 16px',
                                                                borderRadius: '6px',
                                                                backgroundColor: isYesDisabled ? '#222' : 'rgba(76, 175, 80, 0.1)',
                                                                border: `1px solid ${isYesDisabled ? '#333' : 'var(--accent-green)'}`,
                                                                color: isYesDisabled ? '#555' : 'var(--accent-green)',
                                                                fontWeight: 'bold',
                                                                cursor: isYesDisabled ? 'not-allowed' : 'pointer',
                                                                fontSize: '0.85rem',
                                                                transition: 'all 0.2s',
                                                                width: '100px',
                                                                textAlign: 'center'
                                                            }}
                                                            onMouseEnter={e => {
                                                                if (!isYesDisabled) {
                                                                    e.currentTarget.style.backgroundColor = 'var(--accent-green)';
                                                                    e.currentTarget.style.color = '#000';
                                                                }
                                                            }}
                                                            onMouseLeave={e => {
                                                                if (!isYesDisabled) {
                                                                    e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
                                                                    e.currentTarget.style.color = 'var(--accent-green)';
                                                                }
                                                            }}
                                                        >
                                                            {isYesDisabled ? 'YES N/A' : `YES ${probability}`}
                                                        </button>
                                                        
                                                        <button
                                                            disabled={isNoDisabled}
                                                            onClick={() => {
                                                                setSelectedMarket(market);
                                                                setPosition('no');
                                                            }}
                                                            style={{
                                                                padding: '8px 16px',
                                                                borderRadius: '6px',
                                                                backgroundColor: isNoDisabled ? '#222' : 'rgba(244, 67, 54, 0.1)',
                                                                border: `1px solid ${isNoDisabled ? '#333' : 'var(--accent-red)'}`,
                                                                color: isNoDisabled ? '#555' : 'var(--accent-red)',
                                                                fontWeight: 'bold',
                                                                cursor: isNoDisabled ? 'not-allowed' : 'pointer',
                                                                fontSize: '0.85rem',
                                                                transition: 'all 0.2s',
                                                                width: '100px',
                                                                textAlign: 'center'
                                                            }}
                                                            onMouseEnter={e => {
                                                                if (!isNoDisabled) {
                                                                    e.currentTarget.style.backgroundColor = 'var(--accent-red)';
                                                                    e.currentTarget.style.color = '#000';
                                                                }
                                                            }}
                                                            onMouseLeave={e => {
                                                                if (!isNoDisabled) {
                                                                    e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
                                                                    e.currentTarget.style.color = 'var(--accent-red)';
                                                                }
                                                            }}
                                                        >
                                                            {isNoDisabled ? 'NO N/A' : `NO ${100 - probability}`}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Right Side: Portfolio Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', position: 'sticky', top: '90px' }}>
                    
                    {/* Active Portfolio */}
                    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                        <h2 style={{ fontSize: '1.3rem', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '15px', color: '#fff' }}>
                            💼 Active Positions ({activeBets.length})
                        </h2>
                        
                        {activeBets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                No active prediction bets.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {activeBets.map(bet => {
                                    // Try to find the latest prices from markets cache
                                    const m = markets.find(x => x.ticker === bet.market_ticker);
                                    const currentBid = m ? (bet.position === 'yes' ? m.yes_bid : m.no_bid) : bet.buy_price;
                                    const cashoutVal = bet.contracts * currentBid;
                                    const profit = cashoutVal - bet.total_cost;
                                    const profitColor = profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                                    
                                    return (
                                        <div
                                            key={bet.id}
                                            style={{
                                                backgroundColor: '#151515',
                                                border: '1px solid #333',
                                                borderRadius: '8px',
                                                padding: '15px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px'
                                            }}
                                        >
                                            <h4 style={{ fontSize: '0.95rem', margin: '0', color: '#fff' }}>{bet.market_title}</h4>
                                            
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span>Position:</span>
                                                <span style={{ color: bet.position === 'yes' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                    {bet.position}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#888' }}>
                                                <span>Contracts:</span>
                                                <span>{bet.contracts} @ {bet.buy_price} Gems</span>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#888' }}>
                                                <span>Total Cost:</span>
                                                <span>{bet.total_cost} Gems</span>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid #222', paddingTop: '8px', marginTop: '2px' }}>
                                                <span>Current Bid Price:</span>
                                                <span style={{ color: '#fff', fontWeight: 'bold' }}>{currentBid} Gems</span>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span>Return / P&L:</span>
                                                <span style={{ color: profitColor, fontWeight: 'bold' }}>
                                                    {cashoutVal} Gems ({profit >= 0 ? `+${profit}` : profit})
                                                </span>
                                            </div>

                                            <button
                                                disabled={sellLoading === bet.id}
                                                onClick={() => handleSell(bet.id)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    borderRadius: '6px',
                                                    backgroundColor: profit >= 0 ? 'var(--accent-green)' : '#2a2a2a',
                                                    color: profit >= 0 ? '#000' : 'var(--accent-red)',
                                                    border: 'none',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    marginTop: '8px',
                                                    transition: 'opacity 0.2s'
                                                }}
                                            >
                                                {sellLoading === bet.id ? 'Cashing out...' : `Instant Cashout: ${cashoutVal} Gems`}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Resolved History */}
                    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                        <h2 style={{ fontSize: '1.3rem', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '15px', color: '#fff' }}>
                            📜 Settle History ({pastBets.length})
                        </h2>
                        
                        {pastBets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                No resolved prediction history.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                                {pastBets.map(bet => {
                                    let outcomeLabel = 'L';
                                    let outcomeColor = 'var(--accent-red)';
                                    let payoutText = `0 Gems (Loss)`;

                                    if (bet.status === 'settled_win') {
                                        outcomeLabel = 'W';
                                        outcomeColor = 'var(--accent-green)';
                                        payoutText = `+${bet.payout_amount} Gems (Win)`;
                                    } else if (bet.status === 'cashed_out') {
                                        outcomeLabel = 'T';
                                        outcomeColor = '#ffc107';
                                        payoutText = `+${bet.payout_amount} Gems (Trade)`;
                                    } else if (bet.status === 'void') {
                                        outcomeLabel = 'V';
                                        outcomeColor = '#888';
                                        payoutText = `+${bet.payout_amount} Gems (Refund)`;
                                    }

                                    return (
                                        <div
                                            key={bet.id}
                                            style={{
                                                backgroundColor: '#151515',
                                                borderRadius: '6px',
                                                padding: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                border: '1px solid #222'
                                            }}
                                        >
                                            <div style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                backgroundColor: outcomeColor,
                                                color: '#000',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                fontWeight: 'bold',
                                                fontSize: '0.85rem',
                                                flexShrink: '0'
                                            }}>
                                                {outcomeLabel}
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <h5 style={{ margin: '0', fontSize: '0.85rem', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                    {bet.market_title}
                                                </h5>
                                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {bet.position.toUpperCase()} @ {bet.buy_price} | Payout: <span style={{ color: outcomeColor, fontWeight: 'bold' }}>{payoutText}</span>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Buy Modal */}
            {selectedMarket && (() => {
                // Compute normalized probability for the modal (same logic as the card)
                let modalProb = 50;
                if (selectedMarket.yes_ask > 0 && selectedMarket.no_ask > 0) {
                    modalProb = Math.round((selectedMarket.yes_ask / (selectedMarket.yes_ask + selectedMarket.no_ask)) * 100);
                } else if (selectedMarket.last_price > 0) {
                    modalProb = selectedMarket.last_price;
                } else if (selectedMarket.yes_ask > 0) {
                    modalProb = selectedMarket.yes_ask;
                }
                if (modalProb < 1) modalProb = 1;
                if (modalProb > 99) modalProb = 99;
                const contractPrice = position === 'yes' ? modalProb : (100 - modalProb);
                const multiplierPotential = contractPrice > 0 ? (100 / contractPrice).toFixed(2) : '0.00';

                return (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999,
                        backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{
                            backgroundColor: 'var(--bg-panel)',
                            borderRadius: '16px',
                            padding: '30px',
                            maxWidth: '550px',
                            width: '90%',
                            border: '2px solid var(--accent-gold)',
                            boxShadow: '0 0 30px rgba(255,193,7,0.15)',
                            position: 'relative'
                        }}>
                            <button
                                onClick={() => setSelectedMarket(null)}
                                style={{
                                    position: 'absolute',
                                    top: '15px',
                                    right: '20px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: '#888',
                                    fontSize: '24px',
                                    cursor: 'pointer'
                                }}
                            >
                                &times;
                            </button>

                            <h3 style={{ color: 'var(--accent-gold)', fontSize: '1.4rem', marginBottom: '10px' }}>
                                Trade Prediction Position
                            </h3>

                            <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.4' }}>
                                {selectedMarket.title}
                            </p>

                            <form onSubmit={handleBuy} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                
                                {/* Position Selector */}
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setPosition('yes')}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '8px',
                                            backgroundColor: position === 'yes' ? 'var(--accent-green)' : '#222',
                                            color: position === 'yes' ? '#000' : '#888',
                                            border: position === 'yes' ? '1px solid var(--accent-green)' : '1px solid #333',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        BUY YES
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPosition('no')}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '8px',
                                            backgroundColor: position === 'no' ? 'var(--accent-red)' : '#222',
                                            color: position === 'no' ? '#000' : '#888',
                                            border: position === 'no' ? '1px solid var(--accent-red)' : '1px solid #333',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        BUY NO
                                    </button>
                                </div>

                                {/* Buy Info */}
                                <div style={{ backgroundColor: '#151515', padding: '15px', borderRadius: '8px', border: '1px solid #333', fontSize: '0.9rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Contract price:</span>
                                        <span style={{ fontWeight: 'bold', color: '#fff' }}>
                                            {contractPrice} Gems
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Multiplier potential:</span>
                                        <span style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                                            {multiplierPotential}x
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Current Gem balance:</span>
                                        <span style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>
                                            {(Math.floor((user?.gems || 0) * 100) / 100).toFixed(2)} Gems
                                        </span>
                                    </div>
                                </div>

                                {/* Contracts Count Input */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#888' }}>Number of Contracts</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="input-field"
                                        style={{ margin: 0 }}
                                        value={contracts}
                                        onChange={e => setContracts(parseInt(e.target.value) || '')}
                                    />
                                </div>

                                {/* Leverage & Cost Summaries */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                                        <span>Total Cost:</span>
                                        <span style={{ fontWeight: 'bold', color: '#fff' }}>
                                            {contracts * contractPrice} Gems
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                                        <span>Potential Payout:</span>
                                        <span style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>
                                            {contracts * 100} Gems
                                        </span>
                                    </div>
                                </div>

                                {buyError && <div style={{ color: 'var(--accent-red)', fontSize: '0.9rem', textAlign: 'center' }}>{buyError}</div>}
                                {buySuccess && <div style={{ color: 'var(--accent-green)', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>{buySuccess}</div>}

                                <button
                                    type="submit"
                                    disabled={buyLoading}
                                    className="btn-primary"
                                    style={{
                                        padding: '15px',
                                        fontSize: '18px',
                                        borderRadius: '8px',
                                        width: '100%',
                                        marginTop: '5px'
                                    }}
                                >
                                    {buyLoading ? 'Purchasing...' : `Buy contracts for ${contracts * contractPrice} Gems`}
                                </button>
                            </form>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
