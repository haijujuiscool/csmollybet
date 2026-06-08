import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import sounds from '../utils/sounds';

export default function ChickenRoad() {
    const { user, refreshBalance } = useAuth();

    const [betAmount, setBetAmount] = useState(10);
    const [difficulty, setDifficulty] = useState('medium');
    const [gameState, setGameState] = useState('idle'); // idle, playing, dead, cashed_out, maxwin
    const [columns, setColumns] = useState(3);
    const [currentRow, setCurrentRow] = useState(0);
    const [currentMultiplier, setCurrentMultiplier] = useState(1);
    const [nextMultiplier, setNextMultiplier] = useState(0);
    const [revealedRows, setRevealedRows] = useState([]);
    const [futureRows, setFutureRows] = useState([]);
    const [payout, setPayout] = useState(0);
    const [lastPickedDead, setLastPickedDead] = useState(null); // {row, col}

    useEffect(() => {
        const checkActiveGame = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await axios.get('/api/chicken/state', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.active) {
                    setGameState('playing');
                    setBetAmount(res.data.bet);
                    setDifficulty(res.data.difficulty);
                    setColumns(res.data.columns);
                    setCurrentRow(res.data.currentRow);
                    setCurrentMultiplier(res.data.currentMultiplier);
                    setNextMultiplier(res.data.nextMultiplier);
                    setRevealedRows(res.data.revealedRows);
                    setFutureRows([]);
                    setPayout(0);
                    setLastPickedDead(null);
                }
            } catch (err) {
                console.error("Failed to check active chicken game state:", err);
            }
        };
        checkActiveGame();
    }, [user]);

    const totalRows = 10;

    const startGame = async () => {
        if (!user) return alert('Please login first');
        if (betAmount <= 0) return alert('Invalid bet');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/chicken/start', {
                betAmount: parseFloat(betAmount), difficulty
            }, { headers: { Authorization: `Bearer ${token}` } });

            setGameState('playing');
            setColumns(res.data.columns);
            setCurrentRow(res.data.currentRow);
            setCurrentMultiplier(res.data.currentMultiplier);
            setNextMultiplier(res.data.nextMultiplier);
            setRevealedRows([]);
            setFutureRows([]);
            setPayout(0);
            setLastPickedDead(null);
            sounds.betPlace();
            refreshBalance();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to start');
        }
    };

    const pickColumn = async (col) => {
        if (gameState !== 'playing') return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/chicken/pick', { column: col }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.status === 'dead') {
                setGameState('dead');
                setRevealedRows(res.data.revealedRows);
                setFutureRows(res.data.futureRows || []);
                setLastPickedDead({ row: res.data.currentRow, col: res.data.column });
                sounds.lose();
            } else if (res.data.status === 'maxwin') {
                setGameState('maxwin');
                setCurrentRow(res.data.currentRow);
                setCurrentMultiplier(res.data.currentMultiplier);
                setRevealedRows(res.data.revealedRows);
                setPayout(res.data.payout);
                sounds.win();
                refreshBalance();
            } else {
                setCurrentRow(res.data.currentRow);
                setCurrentMultiplier(res.data.currentMultiplier);
                setNextMultiplier(res.data.nextMultiplier);
                setRevealedRows(res.data.revealedRows);
                sounds.tick(600 + res.data.currentRow * 50);
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Pick failed');
        }
    };

    const cashout = async () => {
        if (gameState !== 'playing' || currentRow === 0) return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/chicken/cashout', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setGameState('cashed_out');
            setPayout(res.data.payout);
            setCurrentMultiplier(res.data.currentMultiplier);
            setRevealedRows(res.data.revealedRows);
            setFutureRows(res.data.futureRows || []);
            sounds.win();
            refreshBalance();
        } catch (err) {
            alert(err.response?.data?.error || 'Cashout failed');
        }
    };

    // Render the grid
    const renderGrid = () => {
        const gridRows = [];

        for (let r = totalRows - 1; r >= 0; r--) {
            const revealed = revealedRows.find(rr => rr.row === r);
            const isFuture = futureRows[r - currentRow] !== undefined && (gameState === 'dead' || gameState === 'cashed_out');
            const futureCarPositions = (gameState === 'dead' || gameState === 'cashed_out') && r >= (gameState === 'dead' ? currentRow + 1 : currentRow)
                ? futureRows[r - (gameState === 'dead' ? currentRow + 1 : currentRow)]
                : null;
            const isCurrentRow = gameState === 'playing' && r === currentRow;
            const isDeadRow = gameState === 'dead' && lastPickedDead && r === lastPickedDead.row;

            const cells = [];
            for (let c = 0; c < columns; c++) {
                let cellContent = '';
                let cellBg = '#1e1e1e';
                let cellBorder = '1px solid #333';
                let cursor = 'default';
                let opacity = 1;

                if (revealed) {
                    if (revealed.picked === c && revealed.safe) {
                        cellContent = '🐔';
                        cellBg = 'rgba(76, 175, 80, 0.2)';
                        cellBorder = '2px solid #4CAF50';
                    } else if (revealed.cars.includes(c)) {
                        cellContent = '🚗';
                        cellBg = 'rgba(244, 67, 54, 0.15)';
                    } else {
                        cellContent = '✅';
                        cellBg = 'rgba(76, 175, 80, 0.08)';
                    }
                } else if (isDeadRow) {
                    const deadRevealed = revealedRows.find(rr => rr.row === r);
                    if (deadRevealed) {
                        if (deadRevealed.picked === c) {
                            cellContent = '💀';
                            cellBg = 'rgba(244, 67, 54, 0.3)';
                            cellBorder = '2px solid #F44336';
                        } else if (deadRevealed.cars.includes(c)) {
                            cellContent = '🚗';
                            cellBg = 'rgba(244, 67, 54, 0.15)';
                        } else {
                            cellContent = '✅';
                        }
                    }
                } else if (futureCarPositions) {
                    if (futureCarPositions.includes(c)) {
                        cellContent = '🚗';
                        opacity = 0.4;
                    } else {
                        cellContent = '·';
                        opacity = 0.3;
                    }
                } else if (isCurrentRow) {
                    cellContent = '❓';
                    cellBg = 'rgba(255, 193, 7, 0.1)';
                    cellBorder = '2px solid var(--accent-gold)';
                    cursor = 'pointer';
                } else {
                    cellContent = '·';
                    opacity = 0.3;
                }

                cells.push(
                    <div
                        key={c}
                        onClick={() => isCurrentRow ? pickColumn(c) : null}
                        style={{
                            flex: 1, height: '50px', display: 'flex',
                            justifyContent: 'center', alignItems: 'center',
                            backgroundColor: cellBg, border: cellBorder,
                            borderRadius: '6px', fontSize: '22px',
                            cursor, opacity,
                            transition: 'all 0.2s',
                        }}
                    >
                        {cellContent}
                    </div>
                );
            }

            // Row multiplier label
            const survivalRate = (columns - 1) / columns;
            const rowMultiplier = parseFloat((0.99 / Math.pow(survivalRate, r + 1)).toFixed(2));

            gridRows.push(
                <div key={r} style={{
                    display: 'flex', gap: '8px', alignItems: 'center',
                    marginBottom: '6px',
                    transform: isCurrentRow ? 'scale(1.02)' : 'scale(1)',
                    transition: 'transform 0.2s'
                }}>
                    <div style={{
                        width: '55px', textAlign: 'right', fontSize: '12px',
                        color: r < currentRow ? 'var(--accent-green)' : isCurrentRow ? 'var(--accent-gold)' : '#555',
                        fontWeight: isCurrentRow ? 'bold' : 'normal'
                    }}>
                        {rowMultiplier}x
                    </div>
                    {cells}
                </div>
            );
        }

        return gridRows;
    };

    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
            <h1 style={{ color: 'var(--accent-gold)', textAlign: 'center', marginBottom: '5px' }}>
                CHICKEN ROAD 🐔
            </h1>
            <p style={{ color: '#888', textAlign: 'center', marginBottom: '25px' }}>
                Help the chicken cross the road! Avoid the cars.
            </p>

            {gameState === 'idle' ? (
                <div style={{ maxWidth: '320px', margin: '0 auto', backgroundColor: '#111', padding: '30px', borderRadius: '12px', border: '1px solid #333' }}>
                    <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '5px' }}>BET AMOUNT</label>
                    <input
                        type="number" className="input-field"
                        value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
                        style={{ width: '100%', marginBottom: '15px' }}
                    />

                    <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '5px' }}>DIFFICULTY</label>
                    <select
                        className="input-field"
                        value={difficulty} onChange={e => setDifficulty(e.target.value)}
                        style={{ width: '100%', marginBottom: '25px', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333' }}
                    >
                        <option value="easy">Easy – 4 Lanes (75% per row)</option>
                        <option value="medium">Medium – 3 Lanes (67% per row)</option>
                        <option value="hard">Hard – 2 Lanes (50% per row)</option>
                    </select>

                    <button className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '18px' }} onClick={startGame}>
                        START CROSSING 🐔
                    </button>
                </div>
            ) : (
                <div>
                    {/* HUD */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', padding: '12px 20px',
                        backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '15px'
                    }}>
                        <div>
                            <div style={{ color: '#888', fontSize: '11px' }}>BET</div>
                            <div style={{ fontWeight: 'bold' }}>{betAmount.toFixed ? betAmount.toFixed(2) : betAmount}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>ROW</div>
                            <div style={{ fontWeight: 'bold' }}>{currentRow} / {totalRows}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#888', fontSize: '11px' }}>MULTIPLIER</div>
                            <div style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>{currentMultiplier}x</div>
                        </div>
                    </div>

                    {/* Result Banners - ABOVE the grid for quick access */}
                    {gameState === 'dead' && (
                        <div style={{
                            padding: '15px', backgroundColor: 'rgba(244, 67, 54, 0.2)',
                            color: '#F44336', borderRadius: '8px', marginBottom: '15px',
                            fontWeight: 'bold', fontSize: '18px', textAlign: 'center',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', flexWrap: 'wrap'
                        }}>
                            <span>💀 HIT! Lost {typeof betAmount === 'number' ? betAmount.toFixed(2) : betAmount} Gems</span>
                            <button className="btn-secondary" style={{ padding: '8px 20px', fontSize: '14px' }}
                                onClick={() => setGameState('idle')}>TRY AGAIN</button>
                        </div>
                    )}

                    {(gameState === 'cashed_out' || gameState === 'maxwin') && (
                        <div style={{
                            padding: '15px', backgroundColor: 'rgba(76, 175, 80, 0.2)',
                            color: '#4CAF50', borderRadius: '8px', marginBottom: '15px',
                            fontWeight: 'bold', fontSize: '18px', textAlign: 'center',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', flexWrap: 'wrap'
                        }}>
                            <span>{gameState === 'maxwin' ? '🏆 MAX WIN!' : '🐔 SAFE!'} +{payout.toFixed(2)} Gems ({currentMultiplier}x)</span>
                            <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '14px' }}
                                onClick={() => setGameState('idle')}>PLAY AGAIN</button>
                        </div>
                    )}

                    {/* Cashout Button */}
                    {gameState === 'playing' && currentRow > 0 && (
                        <button
                            className="btn-primary"
                            style={{
                                width: '100%', padding: '14px', fontSize: '18px',
                                marginBottom: '15px', backgroundColor: '#4CAF50', border: 'none'
                            }}
                            onClick={cashout}
                        >
                            CASH OUT 💸 {(betAmount * currentMultiplier).toFixed(2)} Gems ({currentMultiplier}x)
                        </button>
                    )}

                    {/* Grid */}
                    <div style={{
                        backgroundColor: '#111', padding: '15px', borderRadius: '12px',
                        border: '1px solid #333'
                    }}>
                        {/* Finish line */}
                        <div style={{
                            textAlign: 'center', padding: '8px', marginBottom: '10px',
                            borderBottom: '2px dashed var(--accent-gold)', color: 'var(--accent-gold)',
                            fontSize: '13px', fontWeight: 'bold'
                        }}>
                            🏁 FINISH LINE 🏁
                        </div>
                        {renderGrid()}
                        {/* Start line */}
                        <div style={{
                            textAlign: 'center', padding: '8px', marginTop: '10px',
                            borderTop: '2px dashed #555', color: '#555',
                            fontSize: '13px'
                        }}>
                            🐔 START
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
