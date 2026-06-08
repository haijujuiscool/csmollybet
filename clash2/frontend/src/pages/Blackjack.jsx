import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import sounds from '../utils/sounds';
import dealerImg from '../assets/dealer.png';

const calculateHandValue = (hand) => {
    let value = 0;
    let aces = 0;
    for (const card of hand) {
        if (card.hidden) continue;
        if (card.rank === 'A') {
            aces += 1;
            value += 11;
        } else if (['J', 'Q', 'K'].includes(card.rank)) {
            value += 10;
        } else {
            value += parseInt(card.rank);
        }
    }
    while (value > 21 && aces > 0) {
        value -= 10;
        aces -= 1;
    }
    return value;
};

const Card = ({ card, index, isDealer }) => {
    const isHidden = !!card.hidden;
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const suitSymbol = card.suit ? { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit] : '';

    let delay = 0;
    if (isDealer) {
        if (index < 2) delay = (index * 0.3) + 0.6; // Dealer initial cards after player
        else delay = 0; // Handled by React timeouts
    } else {
        if (index < 2) delay = index * 0.3; // Player initial cards fast
        else delay = 0; // Player hits appear instantly
    }

    return (
        <div style={{
            width: '80px', height: '115px', 
            margin: '0 -20px 0 0', position: 'relative',
            perspective: '1000px',
            animation: `cardDeal 0.5s ease-out ${delay}s both`
        }}>
            <div style={{
                width: '100%', height: '100%', position: 'relative',
                transition: 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                transformStyle: 'preserve-3d',
                transform: isHidden ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}>
                {/* Front Face (0deg) */}
                <div style={{
                    position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                    borderRadius: '8px', backgroundColor: '#fff', border: '1px solid #ccc',
                    display: 'flex', flexDirection: 'column', padding: '5px', boxSizing: 'border-box',
                    boxShadow: '2px 2px 5px rgba(0,0,0,0.5)', color: isRed ? '#F44336' : '#111'
                }}>
                    <div style={{ fontSize: '20px', fontWeight: '900', lineHeight: 1, color: isRed ? '#F44336' : '#111' }}>{card.rank}</div>
                    <div style={{ fontSize: '18px', lineHeight: 1, color: isRed ? '#F44336' : '#111' }}>{suitSymbol}</div>
                    <div style={{ fontSize: '30px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.15, color: isRed ? '#F44336' : '#111' }}>
                        {suitSymbol}
                    </div>
                </div>

                {/* Back Face (180deg) */}
                <div style={{
                    position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                    borderRadius: '8px', backgroundColor: '#1a1a1a', border: '2px solid #444',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    boxShadow: '2px 2px 5px rgba(0,0,0,0.5)',
                    transform: 'rotateY(180deg)'
                }}>
                    <div style={{ color: '#444', fontSize: '24px' }}>♦</div>
                </div>
            </div>
        </div>
    );
};

const HandDisplay = ({ label, cards, value, titleColor = '#888', isDealer = false }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
        {isDealer && (
            <img src={dealerImg} alt="Dealer" style={{ width: '180px', marginBottom: '-15px', zIndex: 0, pointerEvents: 'none' }} />
        )}
        <div style={{ color: titleColor, marginBottom: '10px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 1, position: 'relative', backgroundColor: isDealer ? 'rgba(0,0,0,0.6)' : 'transparent', padding: isDealer ? '4px 12px' : '0', borderRadius: '6px' }}>
            {label} {value !== undefined ? `(${value})` : ''}
        </div>
        <div style={{ display: 'flex', paddingRight: '20px', zIndex: 1, position: 'relative' }}>
            {cards.map((c, i) => <Card key={i} card={c} index={i} isDealer={isDealer} />)}
        </div>
    </div>
);

let socket;

export default function Blackjack() {
    const { user, setUser, refreshBalance } = useAuth();
    const [mode, setMode] = useState('live'); // 'live' or 'normal'
    const [betAmount, setBetAmount] = useState(1);

    // NORMAL STATE
    const [normState, setNormState] = useState('idle'); // idle, active, resolving, win, lose, push, dealer_bust, bust, blackjack
    const [normGameId, setNormGameId] = useState(null);
    const [normPlayer, setNormPlayer] = useState([]);
    const [normDealer, setNormDealer] = useState([]);
    const [normPVal, setNormPVal] = useState(0);
    const [normDVal, setNormDVal] = useState(0);
    const [normPayout, setNormPayout] = useState(0);

    // LIVE STATE
    const [liveState, setLiveState] = useState({ phase: 'betting', timeLeft: 15, playerHand: [], dealerHand: [], bets: {} });
    
    useEffect(() => {
        if (mode === 'live') {
            socket = io();
            socket.emit('join_game', 'live_blackjack');
            socket.on('live_blackjack_state', (state) => {
                setLiveState(state);
            });
            return () => socket.disconnect();
        }
    }, [mode]);

    useEffect(() => {
        if (mode === 'live' && (liveState.phase === 'idle' || liveState.phase === 'betting')) {
            refreshBalance();
        }
    }, [liveState.phase, mode, refreshBalance]);

    const playNormal = async () => {
        if (!user) return alert('Login required');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/blackjack/normal/start', { betAmount: parseFloat(betAmount) }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNormGameId(res.data.gameId);
            setNormState(res.data.state);
            setNormPlayer(res.data.playerHand);
            setNormDealer(res.data.dealerHand);
            setNormPVal(res.data.playerValue);
            setNormDVal(res.data.dealerValue);
            setNormPayout(res.data.payout);
            sounds.cardFlip();
            setUser(prev => prev ? { ...prev, gems: prev.gems - parseFloat(betAmount) } : prev);
            if (res.data.state !== 'active') refreshBalance(); // instant blackjack
        } catch (err) {
            alert(err.response?.data?.error || 'Failed');
        }
    };

    const actionNormal = async (act) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/blackjack/normal/action', { gameId: normGameId, action: act }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNormPlayer(res.data.playerHand);
            setNormPVal(res.data.playerValue);
            sounds.cardFlip();
            
            if (res.data.state !== 'active') {
                const drawnCards = res.data.dealerHand.length - 2;
                
                // Show first two cards (hidden card is now revealed)
                setNormDealer(res.data.dealerHand.slice(0, 2));
                setNormDVal(calculateHandValue(res.data.dealerHand.slice(0, 2)));

                let waitTime = 500;
                if (drawnCards > 0) {
                    for (let i = 1; i <= drawnCards; i++) {
                        setTimeout(() => {
                            const currentHand = res.data.dealerHand.slice(0, 2 + i);
                            setNormDealer(currentHand);
                            setNormDVal(calculateHandValue(currentHand));
                            sounds.cardFlip();
                        }, i * 800);
                    }
                    waitTime = (drawnCards * 800) + 500;
                }
                
                setNormState('resolving');
                setTimeout(() => {
                    setNormState(res.data.state);
                    setNormPayout(res.data.payout);
                    setNormDVal(res.data.dealerValue);
                    if (res.data.payout > 0) sounds.win(); else sounds.lose();
                    refreshBalance();
                }, waitTime);
            } else {
                setNormDealer(res.data.dealerHand);
                setNormDVal(res.data.dealerValue);
                setNormState(res.data.state);
                setNormPayout(res.data.payout);
                refreshBalance();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Action failed');
        }
    };

    const betLive = async () => {
        if (!user) return alert('Login required');
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/blackjack/live/bet', { amount: parseFloat(betAmount) }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prev => prev ? { ...prev, gems: prev.gems - parseFloat(betAmount) } : prev);
        } catch (err) {
            alert(err.response?.data?.error || 'Bet failed');
        }
    };

    const actionLive = async (act) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/blackjack/live/action', { action: act }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            alert(err.response?.data?.error || 'Action failed');
        }
    };

    const myLiveBet = user ? liveState.bets[user.id] : null;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <style>{`
                @keyframes cardDeal {
                    0% { transform: translate(150px, -250px) rotate(-30deg) scale(0.5); opacity: 0; }
                    100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
                }
            `}</style>
            {/* Header / Mode Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ color: 'var(--accent-gold)' }}>BLACKJACK</h1>
                <div style={{ display: 'flex', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '5px' }}>
                    <button 
                        style={{ padding: '8px 20px', borderRadius: '6px', backgroundColor: mode === 'live' ? 'var(--accent-gold)' : 'transparent', color: mode === 'live' ? '#000' : '#888', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setMode('live')}
                    >
                        LIVE MULTIPLAYER
                    </button>
                    <button 
                        style={{ padding: '8px 20px', borderRadius: '6px', backgroundColor: mode === 'normal' ? 'var(--accent-gold)' : 'transparent', color: mode === 'normal' ? '#000' : '#888', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setMode('normal')}
                    >
                        NORMAL
                    </button>
                </div>
            </div>

            {mode === 'normal' ? (
                /* --- NORMAL MODE --- */
                <div style={{ backgroundColor: '#111', padding: '40px', borderRadius: '12px', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #333' }}>
                    
                    {normState === 'idle' ? (
                        <div style={{ width: '300px', textAlign: 'center' }}>
                            <h2 style={{ color: '#fff', marginBottom: '20px' }}>PLACE BET</h2>
                            <input 
                                type="number" 
                                className="input-field" 
                                value={betAmount} 
                                onChange={e => setBetAmount(e.target.value)}
                                style={{ marginBottom: '15px' }}
                            />
                            <button className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '18px' }} onClick={playNormal}>
                                DEAL
                            </button>
                        </div>
                    ) : (
                        <div style={{ width: '100%' }}>
                            <HandDisplay label="Dealer" cards={normDealer} value={normDVal} isDealer={true} />
                            
                            {/* Result Banner */}
                            {normState !== 'active' && normState !== 'idle' && normState !== 'resolving' && (
                                <div style={{ textAlign: 'center', margin: '20px 0', padding: '15px', backgroundColor: normPayout > 0 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)', color: normPayout > 0 ? '#4CAF50' : '#F44336', borderRadius: '8px', fontWeight: 'bold', fontSize: '20px' }}>
                                    {normState.toUpperCase().replace('_', ' ')} {normPayout > 0 ? `(+${normPayout.toFixed(2)})` : ''}
                                    <button className="btn-primary" style={{ display: 'block', margin: '15px auto 0' }} onClick={() => setNormState('idle')}>PLAY AGAIN</button>
                                </div>
                            )}

                            <HandDisplay label="Player" cards={normPlayer} value={normPVal} titleColor="var(--accent-gold)" />

                            {normState === 'active' && (
                                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
                                    <button className="btn-secondary" style={{ padding: '15px 30px', fontSize: '16px' }} onClick={() => actionNormal('stand')}>STAND</button>
                                    <button className="btn-primary" style={{ padding: '15px 30px', fontSize: '16px' }} onClick={() => actionNormal('hit')}>HIT</button>
                                    <button className="btn-secondary" style={{ padding: '15px 30px', fontSize: '16px', color: 'var(--accent-gold)' }} onClick={() => actionNormal('double')}>DOUBLE</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* --- LIVE MODE --- */
                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                    {/* Left: Table */}
                    <div style={{ flex: '2 1 500px', backgroundColor: '#0a3a2a', padding: '40px', borderRadius: '12px', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', border: '5px solid #051a12', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)' }}>
                        
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                            <div>Phase: <span style={{ color: 'var(--accent-gold)' }}>{liveState.phase.toUpperCase().replace('_', ' ')}</span></div>
                            <div>Timer: <span style={{ color: liveState.timeLeft <= 5 ? '#F44336' : '#fff' }}>{liveState.timeLeft}s</span></div>
                        </div>

                        <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            {liveState.dealerHand.length > 0 && <HandDisplay label="Dealer" cards={liveState.dealerHand} isDealer={true} />}
                            {liveState.phase !== 'betting' && <div style={{ margin: '20px 0', borderTop: '2px dashed rgba(255,255,255,0.2)' }} />}
                            {liveState.playerHand.length > 0 && <HandDisplay label="Shared Board" cards={liveState.playerHand} titleColor="var(--accent-gold)" />}
                            
                            {liveState.phase === 'betting' && (
                                <div style={{ textAlign: 'center', color: '#888', fontSize: '24px' }}>WAITING FOR BETS...</div>
                            )}
                        </div>

                        {/* Player Controls (Live) */}
                        {myLiveBet && (
                            <div style={{ width: '100%', padding: '15px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ color: '#fff' }}>
                                    Your Action: <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>{myLiveBet.action.toUpperCase()}</span>
                                </div>
                                {liveState.phase === 'action_wait' && myLiveBet.action === 'waiting' && (
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button className="btn-secondary" onClick={() => actionLive('stand')}>STAND</button>
                                        <button className="btn-primary" onClick={() => actionLive('hit')}>HIT</button>
                                        <button className="btn-secondary" style={{ color: 'var(--accent-gold)' }} onClick={() => actionLive('double')}>DOUBLE</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Bets & Players */}
                    <div style={{ flex: '1 1 300px', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
                        {liveState.phase === 'betting' && !myLiveBet && (
                            <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #333' }}>
                                <h3 style={{ color: '#fff', marginBottom: '15px' }}>Place Bet</h3>
                                <input 
                                    type="number" 
                                    className="input-field" 
                                    value={betAmount} 
                                    onChange={e => setBetAmount(e.target.value)}
                                    style={{ marginBottom: '10px' }}
                                />
                                <button className="btn-primary" style={{ width: '100%' }} onClick={betLive}>BET</button>
                            </div>
                        )}

                        <h3 style={{ color: '#888', marginBottom: '15px' }}>Active Players</h3>
                        {Object.keys(liveState.bets).length === 0 ? (
                            <div style={{ color: '#555' }}>No players yet.</div>
                        ) : (
                            Object.values(liveState.bets).map((b, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', marginBottom: '5px' }}>
                                    <div>
                                        <div style={{ color: b.username === user?.username ? 'var(--accent-gold)' : '#fff', fontWeight: 'bold' }}>{b.username}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>Bet: {b.amount}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: b.action === 'bust' ? '#F44336' : b.action === 'blackjack' ? 'var(--accent-gold)' : '#4CAF50', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>
                                            {b.action}
                                        </div>
                                        {liveState.phase === 'resolving' && b.payout > 0 && (
                                            <div style={{ color: 'var(--accent-gold)', fontSize: '12px' }}>+{b.payout.toFixed(2)}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
