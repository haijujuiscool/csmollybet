import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import axios from 'axios';
import sounds from '../utils/sounds';

let socket;

export default function Crash() {
    const { user, refreshBalance } = useAuth();
    const [gameState, setGameState] = useState({ phase: 'waiting', timeLeft: 15, multiplier: 1.00, crashPoint: null });
    const [betAmount, setBetAmount] = useState('');
    const [myBet, setMyBet] = useState(null); // null, or { amount, cashedOut: boolean, won: number }
    const [ping, setPing] = useState(0);
    const rocketSoundRef = useRef(null);
    const refreshBalanceRef = useRef(refreshBalance);

    useEffect(() => {
        refreshBalanceRef.current = refreshBalance;
    }, [refreshBalance]);

    useEffect(() => {
        socket = io();
        socket.emit('join_game', 'crash');

        let prevPhase = null;

        socket.on('crash_state', (state) => {
            setGameState(state);
            // Only reset bet when transitioning INTO betting from another phase (new round)
            if (state.phase === 'betting' && prevPhase && prevPhase !== 'betting') {
                setMyBet(null);
            }
            
            // Sound: bomb planted
            if (state.phase === 'running' && prevPhase !== 'running') {
                sounds.bombPlanted();
            }
            // Sound: bomb explode
            if (state.phase === 'crashed' && prevPhase !== 'crashed') {
                sounds.bombExplode();
                setTimeout(() => {
                    refreshBalanceRef.current();
                }, 2000);
            }
            
            prevPhase = state.phase;
        });

        socket.on('crash_cashout_success', (data) => {
            setMyBet(prev => ({ ...prev, cashedOut: true, won: data.winnings }));
            refreshBalanceRef.current();
        });

        // Ping logic
        const pingInterval = setInterval(() => {
            const start = Date.now();
            socket.emit('ping_latency', () => {
                const duration = Date.now() - start;
                setPing(duration);
            });
        }, 2000);

        return () => {
            clearInterval(pingInterval);
            if (rocketSoundRef.current) {
                rocketSoundRef.current();
                rocketSoundRef.current = null;
            }
            socket.disconnect();
        };
    }, []);

    const placeBet = async () => {
        if (!user) return alert('Please login first!');
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount <= 0) return alert('Invalid bet amount');
        
        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/bet/crash', {
                amount
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setMyBet({ amount, cashedOut: false, won: 0 });
            sounds.betPlace();
            refreshBalance();
        } catch (err) {
            alert(err.response?.data?.error || 'Bet failed');
        }
    };

    const cashOut = async () => {
        if (!myBet || myBet.cashedOut || gameState.phase !== 'running') return;

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/cashout/crash', {}, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setMyBet(prev => ({ ...prev, cashedOut: true, won: res.data.winnings }));
            sounds.win();
            refreshBalance();
        } catch (err) {
            alert(err.response?.data?.error || 'Cashout failed');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px', position: 'relative' }}>
                <h1 style={{ color: 'var(--accent-green)', marginBottom: '5px' }}>CRASH</h1>
                <div style={{ 
                    fontSize: '12px', 
                    color: ping < 100 ? '#4CAF50' : ping < 250 ? '#FF9800' : '#F44336',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: '500'
                }}>
                    <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: ping < 100 ? '#4CAF50' : ping < 250 ? '#FF9800' : '#F44336',
                        display: 'inline-block'
                    }}></span>
                    Ping: {ping}ms
                </div>
                
                {/* Crash History (Last 9 rolls) */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: '15px',
                    minHeight: '32px'
                }}>
                    {(gameState.previousRolls || []).slice(-9).map((roll, index) => {
                        const isHigh = roll >= 2.0;
                        return (
                            <span 
                                key={index} 
                                style={{
                                    backgroundColor: isHigh ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                                    color: isHigh ? '#4CAF50' : '#F44336',
                                    border: `1px solid ${isHigh ? '#4CAF50' : '#F44336'}`,
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    fontSize: '14px'
                                }}
                            >
                                {roll.toFixed(2)}x
                            </span>
                        );
                    })}
                </div>

                <div style={{ 
                    margin: '20px auto', 
                    width: '100%', 
                    maxWidth: '600px', 
                    height: '300px', 
                    backgroundColor: '#1e1e1e', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    flexDirection: 'column',
                    border: gameState.phase === 'crashed' ? '2px solid #F44336' : '2px solid #333'
                }}>
                    {gameState.phase === 'betting' && (
                        <div style={{ fontSize: '32px', color: '#fff' }}>Starting in {Math.max(0, gameState.timeLeft).toFixed(1)}s</div>
                    )}
                    {gameState.phase === 'running' && (
                        <div style={{ fontSize: '72px', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                            {gameState.multiplier.toFixed(2)}x
                        </div>
                    )}
                    {gameState.phase === 'crashed' && (
                        <>
                            <div style={{ fontSize: '72px', fontWeight: 'bold', color: '#F44336' }}>
                                Crashed at {gameState.crashPoint.toFixed(2)}x
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ flex: 1 }}>
                    <input 
                        type="number" 
                        placeholder="Bet Amount" 
                        className="input-field"
                        value={betAmount}
                        onChange={e => setBetAmount(e.target.value)}
                        disabled={gameState.phase !== 'betting' || myBet !== null}
                    />
                    <button className="btn-secondary" style={{ width: '100%', marginBottom: '15px' }} onClick={() => setBetAmount(Math.floor((user?.gems || 0) * 100) / 100)} disabled={gameState.phase !== 'betting' || myBet !== null}>MAX</button>
                    
                    {(() => {
                        const hasBet = myBet && !myBet.cashedOut;
                        const isRunning = gameState.phase === 'running';
                        const potentialWin = hasBet ? (myBet.amount * gameState.multiplier) : 0;

                        // Bet placed & cashed out already
                        if (myBet && myBet.cashedOut) {
                            return (
                                <button 
                                    className="btn-primary" 
                                    style={{ width: '100%', height: '80px', fontSize: '18px', backgroundColor: '#333', cursor: 'default' }} 
                                    disabled
                                >
                                    <div>Cashed Out!</div>
                                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{myBet.won.toFixed(2)} Gems</div>
                                </button>
                            );
                        }

                        // Bet placed & round is running → show CASH OUT with live value
                        if (hasBet && isRunning) {
                            return (
                                <button 
                                    className="btn-primary" 
                                    style={{ 
                                        width: '100%', height: '80px', fontSize: '18px', 
                                        backgroundColor: 'var(--accent-gold)', color: '#000',
                                        fontWeight: 'bold', transition: 'all 0.1s'
                                    }} 
                                    onClick={cashOut}
                                >
                                    <div>CASH OUT</div>
                                    <div style={{ fontSize: '22px' }}>{potentialWin.toFixed(2)} Gems</div>
                                </button>
                            );
                        }

                        // Bet placed & waiting for round to start
                        if (hasBet && !isRunning) {
                            return (
                                <button 
                                    className="btn-primary" 
                                    style={{ width: '100%', height: '80px', fontSize: '18px', backgroundColor: '#555', cursor: 'default' }} 
                                    disabled
                                >
                                    <div>Bet Placed: {myBet.amount.toFixed(2)} Gems</div>
                                    <div style={{ fontSize: '14px', color: '#aaa' }}>Waiting for round...</div>
                                </button>
                            );
                        }

                        // Crashed & had a bet that wasn't cashed out
                        if (myBet && gameState.phase === 'crashed') {
                            return (
                                <button 
                                    className="btn-primary" 
                                    style={{ width: '100%', height: '80px', fontSize: '18px', backgroundColor: '#F44336', cursor: 'default' }} 
                                    disabled
                                >
                                    <div>BUSTED!</div>
                                    <div style={{ fontSize: '14px' }}>Lost {myBet.amount.toFixed(2)} Gems</div>
                                </button>
                            );
                        }

                        // Default: Place Bet
                        return (
                            <button 
                                className="btn-primary" 
                                style={{ width: '100%', height: '80px', fontSize: '20px', backgroundColor: 'var(--accent-green)' }} 
                                onClick={placeBet} 
                                disabled={gameState.phase !== 'betting' || myBet !== null}
                            >
                                Place Bet
                            </button>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
