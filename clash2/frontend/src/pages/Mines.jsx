import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import diamondImg from '../assets/diamond.png';
import bombImg from '../assets/bomb.png';
import sounds from '../utils/sounds';

export default function Mines() {
    const { user, refreshBalance } = useAuth();
    const [betAmount, setBetAmount] = useState(1);
    const [minesCount, setMinesCount] = useState(3);
    const [gameState, setGameState] = useState('idle'); // idle, active, busted, cashed_out
    const [gameId, setGameId] = useState(null);
    const [board, setBoard] = useState(Array(25).fill('hidden'));
    const [multiplier, setMultiplier] = useState(1.0);
    const [nextMultiplier, setNextMultiplier] = useState(1.0);
    const [payout, setPayout] = useState(0);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const playSound = (type) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (type === 'tick') {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'boom') {
            sounds.bombExplode();
        } else if (type === 'win') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
            osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    };

    const handleStart = async () => {
        if (!user) return alert('Please login');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/mines/start', { betAmount: parseFloat(betAmount), minesCount }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGameId(res.data.gameId);
            setGameState('active');
            setBoard(Array(25).fill('hidden'));
            setMultiplier(1.0);
            
            // Calc initial next multiplier roughly for display, proper is from server on click
            setNextMultiplier(1.0); 
            refreshBalance();
        } catch (err) {
            alert(err.response?.data?.error || 'Start failed');
        }
    };

    const handleTileClick = async (index) => {
        if (gameState !== 'active' || board[index] !== 'hidden') return;
        
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/mines/click', { gameId, tileIndex: index }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data.status === 'busted') {
                playSound('boom');
                setGameState('busted');
                setBoard(res.data.board); // server reveals all
            } else if (res.data.status === 'active') {
                playSound('tick');
                const newBoard = [...board];
                newBoard[index] = 'gem';
                setBoard(newBoard);
                setMultiplier(res.data.multiplier);
                setNextMultiplier(res.data.nextMultiplier);
            } else if (res.data.status === 'cashed_out') {
                playSound('win');
                setGameState('cashed_out');
                setBoard(res.data.board);
                setMultiplier(res.data.multiplier);
                setPayout(res.data.payout);
                refreshBalance();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCashout = async () => {
        if (gameState !== 'active') return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/mines/cashout', { gameId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            playSound('win');
            setGameState('cashed_out');
            setBoard(res.data.board);
            setMultiplier(res.data.multiplier);
            setPayout(res.data.payout);
            refreshBalance();
        } catch (err) {
            alert(err.response?.data?.error || 'Cashout failed');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            
            {/* Control Panel */}
            <div style={{ flex: '1 1 300px', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
                <h1 style={{ color: 'var(--accent-gold)', marginBottom: '20px' }}>MINES</h1>
                
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Bet Amount</label>
                    <input 
                        type="number" 
                        className="input-field" 
                        value={betAmount} 
                        onChange={e => setBetAmount(e.target.value)}
                        disabled={gameState === 'active'}
                    />
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Mines (1-24)</label>
                    <input 
                        type="number" 
                        min="1" max="24"
                        className="input-field" 
                        value={minesCount} 
                        onChange={e => setMinesCount(parseInt(e.target.value))}
                        disabled={gameState === 'active'}
                    />
                </div>

                {gameState === 'active' ? (
                    <button className="btn-secondary" style={{ width: '100%', padding: '15px', fontSize: '18px' }} onClick={handleCashout}>
                        Cashout {(betAmount * multiplier).toFixed(2)}
                    </button>
                ) : (
                    <button className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '18px' }} onClick={handleStart}>
                        Bet
                    </button>
                )}

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', color: '#888' }}>
                    <div>Current Mult: {multiplier.toFixed(2)}x</div>
                    {gameState === 'active' && <div>Next: {nextMultiplier.toFixed(2)}x</div>}
                </div>
            </div>

            {/* Game Board */}
            <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(5, 1fr)', 
                    gap: '10px',
                    width: '100%',
                    maxWidth: '500px',
                    aspectRatio: '1 / 1',
                    backgroundColor: '#111',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    position: 'relative'
                }}>
                    {board.map((tile, i) => {
                        let content = '';
                        let bgColor = '#2a2a2a';
                        
                        if (tile === 'hidden') {
                            bgColor = '#2a2a2a';
                        } else if (tile === 'gem') {
                            bgColor = 'rgba(76, 175, 80, 0.2)';
                            content = <img src={diamondImg} alt="gem" style={{ width: '65%', height: '65%', objectFit: 'contain', pointerEvents: 'none' }} />;
                        } else if (tile === 'mine') {
                            bgColor = 'rgba(244, 67, 54, 0.2)';
                            content = <img src={bombImg} alt="mine" style={{ width: '65%', height: '65%', objectFit: 'contain', pointerEvents: 'none' }} />;
                        }
                        
                        return (
                            <div 
                                key={i}
                                onClick={() => handleTileClick(i)}
                                style={{
                                    backgroundColor: bgColor,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    fontSize: '32px',
                                    cursor: (gameState === 'active' && tile === 'hidden') ? 'pointer' : 'default',
                                    transition: 'background-color 0.2s, transform 0.1s',
                                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                                    aspectRatio: '1 / 1',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    overflow: 'hidden'
                                }}
                                onMouseDown={e => { if (gameState === 'active' && tile === 'hidden') e.currentTarget.style.transform = 'scale(0.95)'; }}
                                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {content}
                            </div>
                        );
                    })}

                    {/* Overlay Messages */}
                    {gameState === 'busted' && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(244, 67, 54, 0.9)', padding: '10px 30px', borderRadius: '8px', fontSize: '24px', fontWeight: 'bold', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                            BUSTED!
                        </div>
                    )}
                    {gameState === 'cashed_out' && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(76, 175, 80, 0.9)', padding: '10px 30px', borderRadius: '8px', fontSize: '24px', fontWeight: 'bold', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                            +{payout.toFixed(2)}
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
}
