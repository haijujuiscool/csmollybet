import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import sounds from '../utils/sounds';

export default function KeepDigging() {
    const { user, refreshBalance } = useAuth();

    // Game Setup
    const [betAmount, setBetAmount] = useState(10);
    const [risk, setRisk] = useState('medium');

    // Game State
    const [gameState, setGameState] = useState('idle'); // idle, playing, exploded, cashed_out
    const [depth, setDepth] = useState(0);
    const [currentMultiplier, setCurrentMultiplier] = useState(0);
    const [nextMultiplier, setNextMultiplier] = useState(0);
    const [history, setHistory] = useState([]); // Array of strings (e.g. '💎', '💣')
    const [finalPayout, setFinalPayout] = useState(0);

    useEffect(() => {
        const checkActiveGame = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get('/api/dig/state', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.active) {
                    setGameState('playing');
                    setDepth(res.data.depth);
                    setBetAmount(res.data.bet);
                    setRisk(res.data.risk);
                    setCurrentMultiplier(res.data.currentMultiplier);
                    setNextMultiplier(res.data.nextMultiplier);
                    setHistory(new Array(res.data.depth).fill('💎'));
                    setFinalPayout(0);
                }
            } catch (err) {
                console.error("Failed to check active game state:", err);
            }
        };
        checkActiveGame();
    }, [user]);

    const getNextMultiplierPreview = (r, d) => {
        const prob = { 'low': 0.95, 'medium': 0.85, 'high': 0.70 }[r];
        return (0.99 / Math.pow(prob, d + 1)).toFixed(2);
    };

    const startGame = async () => {
        if (!user) return alert('Please login first');
        if (betAmount <= 0) return alert('Invalid bet amount');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/dig/start', { betAmount, risk }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setGameState('playing');
            setDepth(0);
            setCurrentMultiplier(0);
            setNextMultiplier(getNextMultiplierPreview(risk, 0));
            setHistory([]);
            setFinalPayout(0);
            refreshBalance();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to start game');
        }
    };

    const action = async (act) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/dig/action', { action: act }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.status === 'playing') {
                setDepth(res.data.depth);
                setCurrentMultiplier(res.data.currentMultiplier);
                setNextMultiplier(res.data.nextMultiplier);
                setHistory(prev => [...prev, '💎']);
                sounds.dig();
            } else if (res.data.status === 'exploded') {
                setGameState('exploded');
                setDepth(res.data.depth);
                setHistory(prev => [...prev, '💣']);
                sounds.lose();
            } else if (res.data.status === 'cashed_out') {
                setGameState('cashed_out');
                setFinalPayout(res.data.payout);
                sounds.win();
                refreshBalance();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Action failed');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ color: 'var(--accent-gold)', marginBottom: '10px' }}>KEEP DIGGING ⛏️</h1>
            <p style={{ color: '#888', marginBottom: '30px' }}>Dig deeper for bigger multipliers, but avoid the bombs!</p>

            <div style={{ backgroundColor: '#111', padding: '30px', borderRadius: '12px', border: '1px solid #333', position: 'relative', overflow: 'hidden' }}>

                {gameState === 'idle' ? (
                    <div style={{ maxWidth: '300px', margin: '0 auto' }}>
                        <div style={{ marginBottom: '15px', textAlign: 'left' }}>
                            <label style={{ color: '#888', display: 'block', marginBottom: '5px' }}>Bet Amount</label>
                            <input
                                type="number"
                                className="input-field"
                                value={betAmount}
                                onChange={e => setBetAmount(Number(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ marginBottom: '25px', textAlign: 'left' }}>
                            <label style={{ color: '#888', display: 'block', marginBottom: '5px' }}>Risk Level</label>
                            <select
                                className="input-field"
                                value={risk}
                                onChange={e => setRisk(e.target.value)}
                                style={{ width: '100%', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333' }}
                            >
                                <option value="low">Low Risk (95% Survival)</option>
                                <option value="medium">Medium Risk (85% Survival)</option>
                                <option value="high">High Risk (70% Survival)</option>
                            </select>
                        </div>
                        <button className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '18px' }} onClick={startGame}>
                            START DIGGING
                        </button>
                    </div>
                ) : (
                    <div>
                        {/* Game HUD */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '10px 20px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
                            <div>
                                <span style={{ color: '#888', fontSize: '12px', display: 'block' }}>CURRENT DEPTH</span>
                                <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{depth} m</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ color: '#888', fontSize: '12px', display: 'block' }}>MULTIPLIER</span>
                                <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                                    {currentMultiplier > 0 ? `${currentMultiplier}x` : '0.00x'}
                                </span>
                            </div>
                        </div>

                        {/* Digging Animation Area */}
                        <div style={{ height: '150px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '64px', margin: '20px 0' }}>
                            {gameState === 'exploded' ? '💥' : gameState === 'cashed_out' ? '💰' : '👷'}
                        </div>

                        {/* Action Buttons */}
                        {gameState === 'playing' && (
                            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                                <button
                                    className="btn-primary"
                                    style={{ padding: '20px 40px', fontSize: '20px', flex: 1, backgroundColor: '#4CAF50', color: '#fff', border: 'none' }}
                                    onClick={() => action('dig')}
                                >
                                    DIG DEEPER ⛏️ <br />
                                    <span style={{ fontSize: '12px', fontWeight: 'normal' }}>Next: {nextMultiplier}x</span>
                                </button>

                                <button
                                    className="btn-secondary"
                                    style={{ padding: '20px 40px', fontSize: '20px', flex: 1 }}
                                    onClick={() => action('cashout')}
                                    disabled={depth === 0}
                                >
                                    CASH OUT 💸 <br />
                                    <span style={{ fontSize: '12px', fontWeight: 'normal' }}>
                                        Win: {(betAmount * currentMultiplier).toFixed(2)}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Result Banners */}
                        {gameState === 'exploded' && (
                            <div style={{ padding: '20px', backgroundColor: 'rgba(244, 67, 54, 0.2)', color: '#F44336', borderRadius: '8px', marginTop: '20px', fontWeight: 'bold', fontSize: '20px' }}>
                                YOU HIT A BOMB! 💣 LOST {betAmount.toFixed(2)} GEMS.
                                <button className="btn-secondary" style={{ display: 'block', margin: '15px auto 0' }} onClick={() => setGameState('idle')}>TRY AGAIN</button>
                            </div>
                        )}

                        {gameState === 'cashed_out' && (
                            <div style={{ padding: '20px', backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#4CAF50', borderRadius: '8px', marginTop: '20px', fontWeight: 'bold', fontSize: '20px' }}>
                                YOU ESCAPED! 🎉 WON {finalPayout.toFixed(2)} GEMS.
                                <button className="btn-primary" style={{ display: 'block', margin: '15px auto 0' }} onClick={() => setGameState('idle')}>PLAY AGAIN</button>
                            </div>
                        )}

                        {/* History Log */}
                        <div style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px', textAlign: 'left' }}>
                            <div style={{ color: '#888', marginBottom: '10px', fontSize: '14px' }}>Path:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', fontSize: '24px' }}>
                                {history.map((icon, i) => <span key={i}>{icon}</span>)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
