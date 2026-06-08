import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import axios from 'axios';
import sounds from '../utils/sounds';

let socket;

export default function Double() {
    const { user, refreshBalance } = useAuth();
    const [gameState, setGameState] = useState({ phase: 'waiting', timeLeft: 15, previousRolls: [], bets: [] });
    const [betAmount, setBetAmount] = useState('');
    const [revealedResult, setRevealedResult] = useState(null);
    const [snapToCenter, setSnapToCenter] = useState(false);
    const phaseRef = useRef('betting');

    const [wheelItems, setWheelItems] = useState([]);
    const [wheelOffset, setWheelOffset] = useState(3200);
    const [isAnimating, setIsAnimating] = useState(false);

    const generateWheel = (winner) => {
        const items = [];
        let currentColor = 'red';
        for (let i = 0; i < 120; i++) {
            if (i === 80) {
                items.push(winner);
                currentColor = winner === 'red' ? 'black' : winner === 'black' ? 'red' : currentColor;
            } else {
                const r = Math.random();
                if (r < 0.05) {
                    items.push('green');
                } else {
                    items.push(currentColor);
                    currentColor = currentColor === 'red' ? 'black' : 'red';
                }
            }
        }
        return items;
    };

    // Initialize random wheel on load
    useEffect(() => {
        setWheelItems(generateWheel('black'));
    }, []);

    useEffect(() => {
        socket = io();
        socket.emit('join_game', 'double');

        socket.on('double_state', (state) => {
            setGameState(state);
            
            if (state.phase === 'rolling' && phaseRef.current === 'betting') {
                phaseRef.current = 'rolling';
                
                const newWheel = generateWheel(state.result);
                setWheelItems(newWheel);
                
                const ITEM_WIDTH = 70;
                const GAP = 10;
                const PADDING = 10;
                const getCenterOffset = (index) => PADDING + (index * (ITEM_WIDTH + GAP)) + (ITEM_WIDTH / 2);
                
                const initialOffset = getCenterOffset(40); // 3245
                const targetOffset = getCenterOffset(80); // 6445
                
                setIsAnimating(false);
                setSnapToCenter(false);
                setWheelOffset(initialOffset); 
                
                setTimeout(() => {
                    setIsAnimating(true);
                    sounds.spinStart();
                    const randomJitter = Math.floor(Math.random() * (ITEM_WIDTH - 10)) - ((ITEM_WIDTH - 10) / 2);
                    setWheelOffset(targetOffset + randomJitter);
                }, 50);

                // Snap to center slightly after stopping
                setTimeout(() => {
                    setSnapToCenter(true);
                    setWheelOffset(targetOffset); // Perfect center
                }, 4700);

                // Reveal result only after wheel stops spinning
                setTimeout(() => {
                    setRevealedResult(state.result);
                    sounds.tick(900);
                }, 4500);

                setTimeout(refreshBalance, 5000); 
            } else if (state.phase === 'betting' && phaseRef.current === 'rolling') {
                phaseRef.current = 'betting';
                setRevealedResult(null);
                setSnapToCenter(false);
                setWheelOffset(3245); // Reset to index 40 for next betting phase
                setIsAnimating(false);
            }
        });

        return () => socket.disconnect();
    }, [refreshBalance]);

    const placeBet = async (color) => {
        if (!user) return alert('Please login first!');
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount <= 0) return alert('Invalid bet amount');
        
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/bet/double', {
                color,
                amount
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setBetAmount('');
            refreshBalance();
        } catch (err) {
            alert(err.response?.data?.error || 'Bet failed');
        }
    };

    // Compute my bets directly from the server's global state
    const myBets = { red: 0, black: 0, green: 0 };
    if (user && gameState.bets) {
        gameState.bets.forEach(b => {
            if (b.userId === user.id) myBets[b.color] += b.amount;
        });
    }

    const renderBetsList = (color) => {
        const colorBets = (gameState.bets || []).filter(b => b.color === color);
        const total = colorBets.reduce((acc, curr) => acc + curr.amount, 0);
        
        return (
            <div style={{ marginTop: '20px', textAlign: 'left', minHeight: '150px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span>{colorBets.length} Bets</span>
                    <span style={{ color: 'var(--accent-gold)' }}>{total.toFixed(2)} Gems</span>
                </div>
                {colorBets.map((b, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
                        <span style={{ color: b.userId === user?.id ? 'var(--accent-gold)' : '#ccc' }}>
                            {b.username || 'Anonymous'}
                        </span>
                        <span style={{ fontWeight: 'bold' }}>{b.amount.toFixed(2)}</span>
                    </div>
                ))}
            </div>
        );
    };

    const rollCounts = { red: 0, black: 0, green: 0 };
    gameState.previousRolls.forEach(r => rollCounts[r]++);

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h1 style={{ color: 'var(--accent-green)' }}>DOUBLE</h1>
                
                {/* Previous Rolls & Stats */}
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
                        <div style={{ color: '#888' }}>LAST 100:</div>
                        <div style={{ color: '#F44336' }}>🔴 {rollCounts.red}</div>
                        <div style={{ color: '#fff' }}>⚫ {rollCounts.black}</div>
                        <div style={{ color: 'var(--accent-green)' }}>🟢 {rollCounts.green}</div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '5px', letterSpacing: '2px', textTransform: 'uppercase' }}>Previous Rolls</div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px', overflowX: 'auto', maxWidth: '100%' }}>
                        {gameState.previousRolls.slice(-15).map((r, i) => (
                            <div key={i} style={{ 
                                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                                backgroundColor: r === 'green' ? 'var(--accent-green)' : r === 'red' ? '#F44336' : '#1a1a1a',
                                border: '1px solid #333'
                            }} title={`Roll ${i + 1}: ${r}`} />
                        ))}
                    </div>
                </div>

                <div style={{ margin: '20px 0', fontSize: '24px', fontWeight: 'bold', height: '40px' }}>
                    {gameState.phase === 'betting' && `Rolling in ${gameState.timeLeft.toFixed(1)}s`}
                    {gameState.phase === 'rolling' && revealedResult && (
                        <div style={{ color: revealedResult === 'green' ? 'var(--accent-green)' : revealedResult === 'red' ? '#F44336' : '#fff' }}>
                            ROLLED {revealedResult.toUpperCase()}!
                        </div>
                    )}
                </div>

                {/* Spinning Wheel */}
                <div style={{ 
                    width: '100%', 
                    height: '100px', 
                    backgroundColor: '#1e1e1e', 
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    position: 'relative',
                    border: '2px solid #333',
                    marginBottom: '20px'
                }}>
                    {/* Selector Line */}
                    <div style={{
                        position: 'absolute', left: '50%', top: 0, bottom: 0, width: '4px',
                        backgroundColor: '#fff', transform: 'translateX(-50%)', zIndex: 10,
                        boxShadow: '0 0 10px rgba(255,255,255,0.5)'
                    }} />

                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        padding: '10px',
                        height: '100%',
                        transform: `translateX(calc(50% - ${wheelOffset}px))`,
                        transition: snapToCenter ? 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : (isAnimating ? 'transform 4.5s cubic-bezier(0.1, 0.7, 0.1, 1)' : 'none'),
                        willChange: 'transform'
                    }}>
                        {wheelItems.map((item, i) => (
                            <div key={i} style={{
                                minWidth: '70px',
                                height: '100%',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: item === 'green' ? 'var(--accent-green)' : item === 'red' ? '#F44336' : '#1a1a1a',
                                color: '#fff',
                                fontWeight: 'bold'
                            }}>
                                {/* Optional: add icon or logo inside */}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Betting Controls */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '30px' }}>
                <input 
                    type="number" 
                    placeholder="Bet Amount" 
                    className="input-field"
                    style={{ width: '200px', marginBottom: 0 }}
                    value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                />
                <button className="btn-secondary" onClick={() => setBetAmount(Math.floor((user?.gems || 0) * 100) / 100)}>MAX</button>
            </div>

            {/* Betting Options */}
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <div style={{ flex: 1, backgroundColor: '#F44336', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                    <h3>RED (2x)</h3>
                    <button className="btn-primary" style={{ marginTop: '15px', backgroundColor: '#fff', color: '#F44336' }} onClick={() => placeBet('red')} disabled={gameState.phase !== 'betting'}>Place Bet</button>
                    <div style={{ marginTop: '10px', fontWeight: 'bold' }}>My Bet: {myBets.red.toFixed(2)}</div>
                    {renderBetsList('red')}
                </div>
                <div style={{ flex: 1, backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px', textAlign: 'center', color: '#fff', border: '1px solid #333' }}>
                    <h3>BLACK (2x)</h3>
                    <button className="btn-primary" style={{ marginTop: '15px', backgroundColor: '#fff', color: '#000' }} onClick={() => placeBet('black')} disabled={gameState.phase !== 'betting'}>Place Bet</button>
                    <div style={{ marginTop: '10px', fontWeight: 'bold' }}>My Bet: {myBets.black.toFixed(2)}</div>
                    {renderBetsList('black')}
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--accent-green)', padding: '20px', borderRadius: '8px', textAlign: 'center', color: '#000' }}>
                    <h3>GREEN (14x)</h3>
                    <button className="btn-secondary" style={{ marginTop: '15px', backgroundColor: '#fff' }} onClick={() => placeBet('green')} disabled={gameState.phase !== 'betting'}>Place Bet</button>
                    <div style={{ marginTop: '10px', fontWeight: 'bold' }}>My Bet: {myBets.green.toFixed(2)}</div>
                    {renderBetsList('green')}
                </div>
            </div>
        </div>
    );
}
