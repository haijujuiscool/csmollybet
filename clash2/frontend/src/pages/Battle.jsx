import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import RouletteSpinner from '../components/RouletteSpinner';
import battlesLogo from '../assets/battles.png';

let socket;

export default function Battle() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, refreshBalance } = useAuth();
    const [battle, setBattle] = useState(null);
    const [roundData, setRoundData] = useState(null);
    const [winners, setWinners] = useState(null);
    const [revealedRound, setRevealedRound] = useState(-1); // which round's result has been revealed
    const [isProcessing, setIsProcessing] = useState(false);
    const isProcessingRef = useRef(false);
    const recreateCooldownRef = useRef(false);

    useEffect(() => {
        // Reset all battle-related states to initial values when switching battles
        setBattle(null);
        setRoundData(null);
        setWinners(null);
        setRevealedRound(-1);
        setIsProcessing(false);
        isProcessingRef.current = false;

        socket = io(undefined, {
            auth: { token: localStorage.getItem('token') }
        });

        socket.emit('watch_battle', id);

        socket.on('battle_updated', (b) => {
            setBattle(b);
        });

        socket.on('battle_started', (b) => {
            setBattle(b);
            refreshBalance(); // Deducted balance already, but good to refresh
        });

        socket.on('battle_round', (data) => {
            // data: { round: int, players: [] }
            setRoundData(prev => {
                // Force a fresh object so React detects changes even if round index is same
                return { ...data, _ts: Date.now() };
            });
            
            // Determine if ANY player hit a mythic this round
            const hasMythicHit = data.players.some(p => p.rolls[data.round]?.isMythicHit);
            const animDuration = hasMythicHit ? 11500 : 5800;

            // Reveal previous round's total immediately, current round after animation
            setTimeout(() => {
                setRevealedRound(data.round);
            }, animDuration);
        });

        socket.on('battle_finished', (data) => {
            // data: { winners: [], battle: {} }
            setBattle(data.battle);
            setWinners(data.winners);
            setTimeout(refreshBalance, 2000);
        });

        return () => socket.disconnect();
    }, [id, refreshBalance]);

    const callBot = () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        setIsProcessing(true);
        socket.emit('call_bot', id, (res) => {
            setTimeout(() => {
                isProcessingRef.current = false;
                setIsProcessing(false);
            }, 500);
            if (res.error) alert(res.error);
        });
    };

    const joinBattle = () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        setIsProcessing(true);
        socket.emit('join_battle', id, (res) => {
            setTimeout(() => {
                isProcessingRef.current = false;
                setIsProcessing(false);
            }, 500);
            if (res.error) alert(res.error);
            else refreshBalance();
        });
    };

    const handleRecreate = () => {
        if (recreateCooldownRef.current) return;
        if (!user) return alert('Please login first');
        
        recreateCooldownRef.current = true;
        setTimeout(() => { recreateCooldownRef.current = false; }, 5000);
        
        socket.emit('create_battle', { 
            mode: battle.mode, 
            isCrazyMode: battle.isCrazyMode, 
            isMythicSpin: battle.isMythicSpin, 
            ffaPlayers: battle.maxPlayers, 
            caseIds: battle.cases.map(c => c.id) 
        }, (res) => {
            if (res.error) {
                alert(res.error);
            } else {
                navigate(`/battle/${res.battleId}`);
            }
        });
    };

    const alreadyJoined = battle?.players?.some(p => p.id === user?.id);

    if (!battle) return <div style={{ padding: '20px' }}>Loading battle...</div>;

    const isFinished = battle.status === 'finished';

    const getCurrentRound = () => {
        if (battle.status === 'waiting') return 0;
        if (battle.status === 'finished') return battle.cases.length;
        return roundData ? roundData.round : 0;
    };

    // Calculate displayed total: sum of rolls up to revealedRound
    const getDisplayedTotal = (player) => {
        if (isFinished) return player.totalWon;
        if (revealedRound < 0) return 0;
        const playerData = roundData?.players?.find(rp => rp.id === player.id);
        if (!playerData) return 0;
        let total = 0;
        for (let i = 0; i <= revealedRound && i < playerData.rolls.length; i++) {
            total += playerData.rolls[i].value;
        }
        return total;
    };

    // Calculate what each player actually gets credited
    const getPlayerPayout = (player) => {
        if (!winners || !isFinished) return 0;
        const isWinner = winners.find(w => w.id === player.id);
        if (!isWinner) return 0;
        const totalLoot = battle.players.reduce((acc, p) => acc + p.totalWon, 0);
        return totalLoot / winners.length;
    };

    const renderPlayer = (p, i) => {
        // Find the current round roll if rolling
        const currentRoll = roundData ? roundData.players.find(rp => rp.id === p.id)?.rolls[roundData.round] : null;
        const isWinner = winners?.find(w => w.id === p.id);
        const displayedTotal = getDisplayedTotal(p);
        const playerPayout = getPlayerPayout(p);

        // Unique key per round to force re-mount of RouletteSpinner
        const spinnerKey = roundData ? `${p.id}-r${roundData.round}-${roundData._ts || 0}` : `${p.id}-idle`;

        return (
            <div key={p.id || i} style={{ 
                width: '290px', maxWidth: '100%', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '20px', 
                textAlign: 'center', 
                border: isWinner ? '2px solid var(--accent-gold)' : '1px solid #333',
                boxShadow: isWinner ? '0 0 20px rgba(255,193,7,0.3)' : 'none'
            }}>
                <h3>{p.username} {p.isBot && '(BOT)'}</h3>

                {/* Running total (revealed after each spin finishes) */}
                {isFinished ? (
                    <div style={{ margin: '10px 0' }}>
                        <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>
                            Total Unboxed: <span style={{ color: '#fff' }}>{p.totalWon.toFixed(2)}</span>
                        </div>
                        <div style={{ 
                            fontSize: '18px', fontWeight: 'bold',
                            color: isWinner ? 'var(--accent-green)' : '#F44336'
                        }}>
                            {isWinner ? '🏆 WINNER' : '❌ LOST'}
                        </div>
                        <div style={{ 
                            fontSize: '16px', fontWeight: 'bold', marginTop: '4px',
                            color: 'var(--accent-gold)'
                        }}>
                            Credited: {playerPayout > 0 ? `+${playerPayout.toFixed(2)}` : '0.00'} Gems
                        </div>
                    </div>
                ) : (
                    <div style={{ margin: '10px 0', fontSize: '14px', color: '#888' }}>
                        Total: <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>{displayedTotal.toFixed(2)}</span>
                    </div>
                )}

                {/* Current Roll Animation */}
                <div style={{ 
                    height: '200px', backgroundColor: '#0a0a0a', borderRadius: '8px', marginTop: '20px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                }}>
                    <RouletteSpinner 
                        key={spinnerKey}
                        currentRoll={currentRoll} 
                        currentCaseItems={roundData && battle.cases ? battle.cases[roundData.round]?.items : null} 
                        casePrice={roundData && battle.cases ? battle.cases[roundData.round]?.price : 0}
                        isMythicSpin={battle.isMythicSpin}
                    />
                </div>
            </div>
        );
    };

    const isTeamMode = battle.mode === '2v2' || battle.mode === '3v3';

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ color: 'var(--accent-gold)' }}>CASE BATTLE {battle.isCrazyMode && <span style={{ color: '#F44336' }}>(CRAZY MODE)</span>}</h1>
                <div style={{ fontSize: '18px' }}>Mode: {battle.mode.toUpperCase()} | Cost: {battle.cost.toFixed(2)} Gems</div>
            </div>

            {/* Cases Progress Bar */}
            <div style={{
                display: 'flex',
                gap: '12px',
                padding: '15px',
                backgroundColor: '#141414',
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                overflowX: 'auto',
                marginBottom: '30px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#444 #141414',
                userSelect: 'none'
            }}>
                {battle.cases.map((c, idx) => {
                    const currentRound = getCurrentRound();
                    const isPast = idx < currentRound;
                    const isCurrent = idx === currentRound && battle.status === 'rolling';
                    
                    return (
                        <div key={idx} style={{
                            flex: '0 0 110px',
                            backgroundColor: isCurrent ? '#2a200a' : '#1e1e1e',
                            border: isCurrent ? '2px solid var(--accent-gold)' : '1px solid #333',
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center',
                            position: 'relative',
                            filter: isPast ? 'grayscale(100%)' : 'none',
                            opacity: isPast ? 0.4 : 1,
                            transition: 'all 0.3s ease',
                            boxShadow: isCurrent ? '0 0 15px rgba(255, 193, 7, 0.3)' : 'none'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: '5px',
                                left: '5px',
                                right: '5px',
                                fontSize: '10px',
                                color: isCurrent ? 'var(--accent-gold)' : '#888',
                                fontWeight: 'bold'
                            }}>
                                R{idx + 1}
                            </div>
                            <img src={c.image_url} alt={c.name} style={{ width: '60px', height: '60px', objectFit: 'contain', marginTop: '10px' }} />
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                marginTop: '5px',
                                color: '#fff'
                            }} title={c.name}>
                                {c.name}
                            </div>
                            <div style={{
                                fontSize: '10px',
                                color: 'var(--accent-gold)',
                                fontWeight: 'bold',
                                marginTop: '2px'
                            }}>
                                {c.price.toFixed(2)} G
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Lobby / Status */}
            {battle.status === 'waiting' && (
                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                    <h2>Waiting for players... ({battle.players.length}/{battle.maxPlayers})</h2>
                    {battle.players.length < battle.maxPlayers && user && battle.hostId === user.id && (
                        <button className="btn-secondary" style={{ marginTop: '20px', opacity: isProcessing ? 0.5 : 1 }} onClick={callBot} disabled={isProcessing}>
                            Call Bot
                        </button>
                    )}
                </div>
            )}

            {battle.status === 'rolling' && (
                <div style={{ textAlign: 'center', margin: '20px 0', fontSize: '24px', color: 'var(--accent-gold)' }}>
                    {roundData ? `ROUND ${roundData.round + 1} OF ${battle.cases.length}` : 'STARTING...'}
                </div>
            )}

            {battle.status === 'finished' && winners && (
                <div style={{ textAlign: 'center', margin: '40px 0', padding: '20px', backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: '8px', border: '1px solid var(--accent-gold)' }}>
                    <h2 style={{ color: 'var(--accent-gold)' }}>BATTLE FINISHED!</h2>
                    <h3>Winners: {winners.map(w => w.username).join(', ')}</h3>
                    <p style={{ marginBottom: '15px' }}>Loot distributed!</p>
                    <button className="btn-primary" style={{ padding: '10px 30px', fontSize: '18px' }} onClick={handleRecreate}>
                        Recreate Battle
                    </button>
                </div>
            )}

            {/* Players Grid / Layout */}
            {isTeamMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                    {/* Team 1 */}
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {battle.players.slice(0, battle.maxPlayers / 2).map((p, i) => renderPlayer(p, i))}
                        {battle.status === 'waiting' && Array.from({ length: (battle.maxPlayers / 2) - battle.players.slice(0, battle.maxPlayers / 2).length }).map((_, i) => (
                            <div key={`empty-t1-${i}`} style={{ width: '290px', maxWidth: '100%', backgroundColor: '#111', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '1px dashed #444', color: '#555', gap: '10px' }}>
                                <span>Empty Slot</span>
                                {user && !alreadyJoined && <button className="btn-primary" style={{ padding: '8px 20px', opacity: isProcessing ? 0.5 : 1 }} onClick={joinBattle} disabled={isProcessing}>Join</button>}
                            </div>
                        ))}
                    </div>

                    {/* VS Separator */}
                    <div style={{ margin: '20px 0' }}>
                        <img src={battlesLogo} alt="VS" style={{ height: '48px', width: 'auto' }} />
                    </div>

                    {/* Team 2 */}
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {battle.players.slice(battle.maxPlayers / 2).map((p, i) => renderPlayer(p, i))}
                        {battle.status === 'waiting' && Array.from({ length: (battle.maxPlayers / 2) - battle.players.slice(battle.maxPlayers / 2).length }).map((_, i) => (
                            <div key={`empty-t2-${i}`} style={{ width: '290px', maxWidth: '100%', backgroundColor: '#111', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '1px dashed #444', color: '#555', gap: '10px' }}>
                                <span>Empty Slot</span>
                                {user && !alreadyJoined && <button className="btn-primary" style={{ padding: '8px 20px', opacity: isProcessing ? 0.5 : 1 }} onClick={joinBattle} disabled={isProcessing}>Join</button>}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                    {battle.players.flatMap((p, i) => {
                        const elements = [renderPlayer(p, i)];
                        if (i < battle.players.length - 1) {
                            elements.push(
                                <div key={`vs-${i}`} style={{ display: 'flex', alignItems: 'center' }}>
                                    <img src={battlesLogo} alt="VS" style={{ height: '40px', width: 'auto' }} />
                                </div>
                            );
                        }
                        return elements;
                    })}
                    
                    {/* Empty Slots */}
                    {battle.status === 'waiting' && Array.from({ length: battle.maxPlayers - battle.players.length }).map((_, i) => (
                        <div key={`empty-${i}`} style={{ 
                            width: '290px', maxWidth: '100%', backgroundColor: '#111', borderRadius: '8px', padding: '20px', 
                            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '1px dashed #444', color: '#555', gap: '10px'
                        }}>
                            <span>Empty Slot</span>
                            {user && !alreadyJoined && <button className="btn-primary" style={{ padding: '8px 20px', opacity: isProcessing ? 0.5 : 1 }} onClick={joinBattle} disabled={isProcessing}>Join</button>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
