import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import sounds from '../utils/sounds';

const PAYLINE_COLORS = ['#FFD700', '#FF4444', '#44FF44', '#4488FF', '#FF44FF'];
const PAYLINE_PATHS = [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
];
const PAYLINE_NAMES = ['Middle', 'Top', 'Bottom', 'V-Shape', 'Λ-Shape'];

const ALL_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣', '⭐', '🎰'];

const PAYTABLE = [
    { emoji: '7️⃣', name: 'Seven', pays: '3x=40  4x=150  5x=500' },
    { emoji: '💎', name: 'Diamond', pays: '3x=20  4x=60  5x=150' },
    { emoji: '🔔', name: 'Bell', pays: '3x=10  4x=30  5x=60' },
    { emoji: '🍇', name: 'Grape', pays: '3x=6  4x=18  5x=40' },
    { emoji: '🍊', name: 'Orange', pays: '3x=4  4x=12  5x=25' },
    { emoji: '🍋', name: 'Lemon', pays: '3x=3  4x=8  5x=18' },
    { emoji: '🍒', name: 'Cherry', pays: '3x=2  4x=5  5x=12' },
    { emoji: '⭐', name: 'Wild', pays: 'Substitutes any symbol' },
    { emoji: '🎰', name: 'Scatter', pays: '3x=10 FS (2x)  4x=15 FS (3x)  5x=20 FS (5x)' },
];

function ReelCell({ symbol, spinning, reelIndex, rowIndex }) {
    const randomSymbols = useRef(
        Array.from({ length: 12 }, () => ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)])
    );

    return (
        <div style={{
            width: '80px', height: '80px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '42px',
            backgroundColor: 'rgba(0,0,0,0.4)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {spinning ? (
                <div style={{
                    position: 'absolute',
                    animation: `reelSpin 0.15s linear infinite`,
                    animationDelay: `${reelIndex * 0.05}s`,
                }}>
                    {randomSymbols.current.map((s, i) => (
                        <div key={i} style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px' }}>
                            {s}
                        </div>
                    ))}
                </div>
            ) : (
                <span style={{
                    animation: 'symbolPop 0.2s ease-out',
                    animationFillMode: 'both',
                }}>
                    {symbol}
                </span>
            )}
        </div>
    );
}

export default function Slots() {
    const { user, setUser, refreshBalance } = useAuth();
    const [betAmount, setBetAmount] = useState(1);
    const [lines, setLines] = useState(5);
    const [grid, setGrid] = useState(null);
    const [spinning, setSpinning] = useState([false, false, false, false, false]);
    const [wins, setWins] = useState([]);
    const [totalPayout, setTotalPayout] = useState(0);
    const [freeSpins, setFreeSpins] = useState(0);
    const [freeSpinMultiplier, setFreeSpinMultiplier] = useState(1);
    const [isFreeSpinMode, setIsFreeSpinMode] = useState(false);
    const [showPaytable, setShowPaytable] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const [isAutoSpinning, setIsAutoSpinning] = useState(false);
    const [autoSpinsLeft, setAutoSpinsLeft] = useState(0);
    const [highlightedLine, setHighlightedLine] = useState(-1);
    const [lastResult, setLastResult] = useState(null);
    const spinTimeoutRef = useRef(null);

    useEffect(() => {
        if (isAutoSpinning && !isSpinning && autoSpinsLeft > 0) {
            const timer = setTimeout(() => {
                if (!user || (!isFreeSpinMode && user.gems < betAmount * lines)) {
                    setIsAutoSpinning(false);
                    setAutoSpinsLeft(0);
                    return;
                }
                spin();
            }, 800); // 800ms delay between auto spins
            return () => clearTimeout(timer);
        } else if (isAutoSpinning && !isSpinning && autoSpinsLeft <= 0) {
            setIsAutoSpinning(false);
        }
    }, [isAutoSpinning, isSpinning, autoSpinsLeft, user, betAmount, lines, isFreeSpinMode]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.get('/api/slots/freespins', { headers: { Authorization: `Bearer ${token}` } })
                .then(res => {
                    if (res.data.active) {
                        setIsFreeSpinMode(true);
                        setFreeSpins(res.data.remaining);
                        setFreeSpinMultiplier(res.data.multiplier);
                        setLines(res.data.lines);
                        setBetAmount(res.data.betAmount);
                    }
                }).catch(() => {});
        }
    }, []);

    const spin = async () => {
        if (!user) return alert('Login required');
        if (isSpinning) return;

        setIsSpinning(true);
        setWins([]);
        setTotalPayout(0);
        setHighlightedLine(-1);
        setLastResult(null);
        setSpinning([true, true, true, true, true]);
        sounds.spinStart();
        
        // Optimistically deduct balance
        if (!isFreeSpinMode) {
            setUser(prev => ({ ...prev, gems: prev.gems - betAmount * lines }));
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/slots/spin', { betAmount: parseFloat(betAmount), lines }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = res.data;

            // Stop reels one by one with a fixed delay between them
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => {
                    spinTimeoutRef.current = setTimeout(() => {
                        setSpinning(prev => {
                            const next = [...prev];
                            next[i] = false;
                            return next;
                        });
                        setGrid(prevGrid => {
                            const newGrid = prevGrid ? prevGrid.map(r => [...r]) : data.grid.map(r => [...r]);
                            for (let row = 0; row < 3; row++) {
                                newGrid[row][i] = data.grid[row][i];
                            }
                            return newGrid;
                        });
                        sounds.reelStop();
                        resolve();
                    }, i === 0 ? 500 : 300); // 500ms for first reel, 300ms for each subsequent reel
                });
            }

            // Wait for last reel to land
            await new Promise(resolve => setTimeout(resolve, 500));

            setGrid(data.grid);
            setLastResult(data);

            if (data.wins.length > 0) {
                setWins(data.wins);
                setTotalPayout(data.totalPayout);
                sounds.win();

                // Animate through winning lines
                for (let w = 0; w < data.wins.length; w++) {
                    setHighlightedLine(data.wins[w].line);
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
                setHighlightedLine(-1);
            } else {
                sounds.lose();
            }

            if (data.awardedFreeSpins > 0) {
                setIsFreeSpinMode(true);
                setFreeSpins(data.freeSpinsRemaining);
                setFreeSpinMultiplier(data.freeSpinMultiplier);
            } else if (data.isFreeSpinMode) {
                setFreeSpins(data.freeSpinsRemaining);
                if (data.freeSpinsRemaining <= 0) {
                    setIsFreeSpinMode(false);
                    setFreeSpinMultiplier(1);
                }
            }

            // Update local balance immediately with payout before refreshBalance fully syncs
            if (data.totalPayout > 0) {
                setUser(prev => ({ ...prev, gems: prev.gems + data.totalPayout }));
            }
            refreshBalance();
            
            if (isAutoSpinning) {
                setAutoSpinsLeft(prev => prev > 0 ? prev - 1 : 0);
            }
        } catch (err) {
            // Revert balance on error
            if (!isFreeSpinMode) {
                setUser(prev => ({ ...prev, gems: prev.gems + betAmount * lines }));
            }
            setIsAutoSpinning(false);
            setAutoSpinsLeft(0);
            alert(err.response?.data?.error || 'Spin failed');
        } finally {
            setIsSpinning(false);
        }
    };

    const totalCost = isFreeSpinMode ? 0 : betAmount * lines;

    return (
        <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
            <style>{`
                @keyframes reelSpin {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-960px); }
                }
                @keyframes symbolPop {
                    0% { transform: scale(0.3); opacity: 0; }
                    60% { transform: scale(1.15); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes winPulse {
                    0%, 100% { box-shadow: 0 0 5px rgba(255,215,0,0.3); }
                    50% { box-shadow: 0 0 25px rgba(255,215,0,0.8); }
                }
                @keyframes freeSpinGlow {
                    0%, 100% { border-color: rgba(76,175,80,0.3); }
                    50% { border-color: rgba(76,175,80,1); }
                }
                @keyframes scatterPop {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.4) rotate(15deg); }
                    100% { transform: scale(1); }
                }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ color: 'var(--accent-gold)' }}>SLOTS 🎰</h1>
                <button
                    onClick={() => setShowPaytable(!showPaytable)}
                    style={{ padding: '8px 16px', backgroundColor: '#1e1e1e', color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    {showPaytable ? 'HIDE' : 'PAYTABLE'}
                </button>
            </div>

            {showPaytable && (
                <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '12px', border: '1px solid #333', marginBottom: '20px' }}>
                    <h3 style={{ color: '#fff', marginBottom: '15px' }}>Paytable (× bet per line)</h3>
                    {PAYTABLE.map((row, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '8px 0', borderBottom: '1px solid #222' }}>
                            <span style={{ fontSize: '28px', width: '40px', textAlign: 'center' }}>{row.emoji}</span>
                            <span style={{ color: '#aaa', width: '80px', fontWeight: 'bold' }}>{row.name}</span>
                            <span style={{ color: 'var(--accent-gold)', fontSize: '13px' }}>{row.pays}</span>
                        </div>
                    ))}
                    <div style={{ marginTop: '15px', color: '#666', fontSize: '12px' }}>
                        <strong>Paylines:</strong> {PAYLINE_NAMES.map((n, i) => (
                            <span key={i} style={{ color: PAYLINE_COLORS[i], marginRight: '10px' }}>L{i + 1}: {n}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Free Spins Banner */}
            {isFreeSpinMode && (
                <div style={{
                    padding: '15px', marginBottom: '20px', borderRadius: '12px', textAlign: 'center',
                    background: 'linear-gradient(135deg, rgba(76,175,80,0.15), rgba(0,150,0,0.15))',
                    border: '2px solid #4CAF50',
                    animation: 'freeSpinGlow 1.5s ease-in-out infinite',
                }}>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#4CAF50' }}>
                        🎉 FREE SPINS: {freeSpins} remaining
                    </div>
                    <div style={{ color: '#aaa', fontSize: '14px' }}>
                        All wins multiplied by {freeSpinMultiplier}x!
                    </div>
                </div>
            )}

            {/* Slot Machine */}
            <div style={{
                backgroundColor: '#111',
                padding: '30px',
                borderRadius: '16px',
                border: isFreeSpinMode ? '2px solid rgba(76,175,80,0.5)' : '1px solid #333',
                position: 'relative',
            }}>
                {/* Grid with payline indicators */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '10px' }}>
                    {/* Payline indicators left side - grouped by row */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                        {[0, 1, 2].map(row => {
                            // Find which active paylines start at this row
                            const linesAtRow = [];
                            for (let i = 0; i < lines; i++) {
                                if (PAYLINE_PATHS[i][0] === row) linesAtRow.push(i);
                            }
                            return (
                                <div key={row} style={{ height: '84px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                    {linesAtRow.map(i => (
                                        <div key={i} style={{
                                            width: '22px', height: '22px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '11px', fontWeight: 'bold',
                                            color: highlightedLine === i ? '#000' : PAYLINE_COLORS[i],
                                            backgroundColor: highlightedLine === i ? PAYLINE_COLORS[i] : 'rgba(255,255,255,0.05)',
                                            borderRadius: '4px',
                                            border: `1px solid ${PAYLINE_COLORS[i]}`,
                                            transition: 'all 0.2s',
                                        }}>
                                            {i + 1}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    {/* Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                        {[0, 1, 2].map(row => (
                            <div key={row} style={{ display: 'flex', gap: '6px' }}>
                                {[0, 1, 2, 3, 4].map(col => {
                                    const symbol = grid ? grid[row][col] : null;
                                    const isWinCell = wins.some(w => PAYLINE_PATHS[w.line][col] === row);
                                    const isHighlighted = highlightedLine >= 0 && PAYLINE_PATHS[highlightedLine][col] === row;
                                    const isScatter = symbol && symbol.id === 'scatter' && lastResult && lastResult.awardedFreeSpins > 0;

                                    return (
                                        <div key={col} style={{
                                            position: 'relative',
                                            borderRadius: '8px',
                                            border: isHighlighted ? `2px solid ${PAYLINE_COLORS[highlightedLine]}` : '2px solid transparent',
                                            animation: isHighlighted ? 'winPulse 0.6s ease-in-out infinite' : isScatter ? 'scatterPop 0.5s ease-in-out infinite' : 'none',
                                            transition: 'border-color 0.2s',
                                        }}>
                                            <ReelCell
                                                symbol={symbol ? symbol.emoji : '❓'}
                                                spinning={spinning[col]}
                                                reelIndex={col}
                                                rowIndex={row}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* Payline overlays */}
                        {highlightedLine >= 0 && (
                            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                <polyline
                                    points={PAYLINE_PATHS[highlightedLine].map((row, col) => {
                                        const x = col * 90 + 43;
                                        const y = row * 90 + 43;
                                        return `${x},${y}`;
                                    }).join(' ')}
                                    fill="none"
                                    stroke={PAYLINE_COLORS[highlightedLine]}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity="0.6"
                                />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Win Display */}
                {totalPayout > 0 && !isSpinning && (
                    <div style={{
                        textAlign: 'center', marginTop: '20px', padding: '15px',
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,200,0,0.05))',
                        borderRadius: '10px', border: '1px solid rgba(255,215,0,0.3)',
                    }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                            +{totalPayout.toFixed(2)} GEMS
                        </div>
                        <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                            {wins.map((w, i) => (
                                <span key={i} style={{ marginRight: '12px', color: PAYLINE_COLORS[w.line] }}>
                                    L{w.line + 1}: {w.count}x{w.emoji} (+{w.payout.toFixed(2)})
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: '15px',
                marginTop: '20px',
                backgroundColor: '#1e1e1e',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #333',
                alignItems: 'end',
            }}>
                <div>
                    <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '5px' }}>BET PER LINE</label>
                    <input
                        type="number" className="input-field"
                        value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
                        min="0.1" step="0.1"
                        style={{ width: '100%', marginBottom: 0 }}
                        disabled={isSpinning || isFreeSpinMode}
                    />
                </div>
                <div>
                    <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '5px' }}>LINES (1-5)</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                onClick={() => setLines(n)}
                                disabled={isSpinning || isFreeSpinMode}
                                style={{
                                    flex: 1, padding: '10px 0',
                                    backgroundColor: lines >= n ? PAYLINE_COLORS[n - 1] : '#0a0a0a',
                                    color: lines >= n ? '#000' : '#555',
                                    border: '1px solid #333', borderRadius: '6px',
                                    cursor: isSpinning || isFreeSpinMode ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold', fontSize: '14px',
                                }}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button
                        onClick={spin}
                        disabled={isSpinning || isAutoSpinning}
                        style={{
                            padding: '10px 40px',
                            fontSize: '18px', fontWeight: 'bold',
                            background: isSpinning || isAutoSpinning
                                ? '#555'
                                : isFreeSpinMode
                                    ? 'linear-gradient(135deg, #4CAF50, #2E7D32)'
                                    : 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                            color: '#000',
                            border: 'none', borderRadius: '10px',
                            cursor: isSpinning || isAutoSpinning ? 'not-allowed' : 'pointer',
                            height: '50px',
                            minWidth: '140px',
                            transition: 'transform 0.1s',
                        }}
                        onMouseDown={e => { if (!isSpinning && !isAutoSpinning) e.currentTarget.style.transform = 'scale(0.95)'; }}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {isSpinning && !isAutoSpinning ? '...' : isFreeSpinMode ? `FREE SPIN` : `SPIN (${totalCost.toFixed(1)})`}
                    </button>
                    
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {isAutoSpinning ? (
                            <button 
                                onClick={() => { setIsAutoSpinning(false); setAutoSpinsLeft(0); }}
                                style={{ flex: 1, padding: '8px', background: '#F44336', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                STOP AUTO ({autoSpinsLeft})
                            </button>
                        ) : (
                            <>
                                {[10, 50, 100].map(n => (
                                    <button 
                                        key={n}
                                        onClick={() => { 
                                            if (!user) return alert('Login required');
                                            if (user.gems < betAmount * lines && !isFreeSpinMode) return alert('Insufficient gems');
                                            setIsAutoSpinning(true); setAutoSpinsLeft(n); 
                                        }}
                                        disabled={isSpinning}
                                        style={{ flex: 1, padding: '8px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: isSpinning ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                    >
                                        {n} A
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', marginTop: '10px' }}>
                {isFreeSpinMode
                    ? `Free spins active! ${freeSpins} remaining with ${freeSpinMultiplier}x multiplier`
                    : `Total bet: ${totalCost.toFixed(2)} gems (${betAmount} × ${lines} lines)`
                }
            </div>
        </div>
    );
}
