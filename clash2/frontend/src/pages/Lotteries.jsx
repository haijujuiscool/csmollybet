import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import sounds from '../utils/sounds';

export default function Lotteries() {
    const { user } = useAuth();
    const [lotteryState, setLotteryState] = useState(null);
    const [inventory, setInventory] = useState([]);
    const [showJoin, setShowJoin] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [timeLeft, setTimeLeft] = useState(null);
    const [winner, setWinner] = useState(null);
    const [joining, setJoining] = useState(false);
    const [wheelItems, setWheelItems] = useState([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [snapToCenter, setSnapToCenter] = useState(false);
    const [wheelOffset, setWheelOffset] = useState(0);
    const [revealedWinner, setRevealedWinner] = useState(null);
    const phaseRef = useRef('idle');
    const socketRef = useRef(null);
    const animateRef = useRef(null);

    const ITEM_WIDTH = 70;
    const GAP = 10;
    const PADDING = 10;
    const getCenterOffset = (index) => PADDING + (index * (ITEM_WIDTH + GAP)) + (ITEM_WIDTH / 2);
    const INITIAL_INDEX = 40;
    const TARGET_INDEX = 80;

    const getWeightedParticipant = (participants) => {
        const total = participants.reduce((sum, p) => sum + (p.total_value || 0), 0);
        if (total <= 0) {
            return participants[Math.floor(Math.random() * participants.length)];
        }
        const rand = Math.random() * total;
        let cumulative = 0;
        for (const p of participants) {
            cumulative += p.total_value || 0;
            if (rand <= cumulative) {
                return p;
            }
        }
        return participants[participants.length - 1];
    };

    const generateWheel = (participants, winnerEntry) => {
        const items = [];
        const totalItemsCount = TARGET_INDEX + 30; // 30 items to the right of the winner
        for (let i = 0; i < totalItemsCount; i++) {
            const p = getWeightedParticipant(participants);
            items.push({ avatar: p.avatar || '', username: p.username, isWinner: false });
        }
        items[TARGET_INDEX] = { avatar: winnerEntry.avatar || '', username: winnerEntry.username, isWinner: true };
        return items;
    };

    useEffect(() => {
        const s = io(undefined, {
            auth: { token: localStorage.getItem('token') }
        });
        socketRef.current = s;

        s.emit('get_lottery', (state) => {
            setLotteryState(state);
        });

        s.on('lottery_state', (state) => {
            setLotteryState(state);
            if (state.status !== 'active') setTimeLeft(null);
        });

        s.on('lottery_tick', ({ timeLeft: remaining }) => {
            setTimeLeft(remaining);
        });

        s.on('lottery_rolling', (data) => {
            if (animateRef.current) {
                cancelAnimationFrame(animateRef.current);
            }

            const wheel = generateWheel(data.participants, data.winnerEntry);
            setWheelItems(wheel);
            setTimeLeft(null);
            setRevealedWinner(null);
            phaseRef.current = 'rolling';

            setIsAnimating(true);
            setSnapToCenter(false);
            setWheelOffset(getCenterOffset(INITIAL_INDEX));

            setTimeout(() => {
                sounds.spinStart();
                const startTime = performance.now();
                const duration = 6000; // spin for 6.0 seconds (slower ending)
                const startOffset = getCenterOffset(INITIAL_INDEX);
                const randomJitter = Math.floor(Math.random() * (ITEM_WIDTH - 15)) - ((ITEM_WIDTH - 15) / 2);
                const endOffset = getCenterOffset(TARGET_INDEX) + randomJitter;

                const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
                let lastTickIndex = -1;

                const animate = (now) => {
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = easeOutQuint(progress);
                    const currentOffset = startOffset + (endOffset - startOffset) * eased;

                    setWheelOffset(currentOffset);

                    // Ticking logic
                    const currentCenterIndex = Math.floor((currentOffset - PADDING) / (ITEM_WIDTH + GAP));
                    if (currentCenterIndex !== lastTickIndex) {
                        lastTickIndex = currentCenterIndex;
                        if (currentCenterIndex >= INITIAL_INDEX && currentCenterIndex <= TARGET_INDEX) {
                            sounds.tick(800 - progress * 400);
                        }
                    }

                    if (progress < 1) {
                        animateRef.current = requestAnimationFrame(animate);
                    } else {
                        setSnapToCenter(true);
                        setWheelOffset(getCenterOffset(TARGET_INDEX));
                        
                        setTimeout(() => {
                            setRevealedWinner(data.winnerEntry);
                            sounds.tick(900);
                        }, 200);
                    }
                };

                animateRef.current = requestAnimationFrame(animate);
            }, 50);
        });

        s.on('lottery_finished', (result) => {
            if (animateRef.current) {
                cancelAnimationFrame(animateRef.current);
            }
            setWinner(result);
            setWheelItems([]);
            setRevealedWinner(null);
            setIsAnimating(false);
            setSnapToCenter(false);
            phaseRef.current = 'idle';
            setTimeout(() => setWinner(null), 8000);
        });

        return () => {
            if (animateRef.current) {
                cancelAnimationFrame(animateRef.current);
            }
            s.disconnect();
        };
    }, []);

    const fetchInventory = () => {
        if (!user) return;
        axios.get('/api/user-inventory', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).then(res => {
            setInventory(res.data.filter(i => i.status === 'available'));
        }).catch(() => {});
    };

    const openJoin = () => {
        fetchInventory();
        setSelectedItems([]);
        setShowJoin(true);
    };

    const toggleItem = (item) => {
        setSelectedItems(prev =>
            prev.find(i => i.id === item.id)
                ? prev.filter(i => i.id !== item.id)
                : [...prev, item]
        );
    };

    const handleJoin = () => {
        if (!socketRef.current || joining) return;
        const ids = selectedItems.map(i => i.id);
        if (ids.length === 0) return;
        setJoining(true);
        socketRef.current.emit('join_lottery', { itemIds: ids }, (res) => {
            setJoining(false);
            if (res.error) {
                alert(res.error);
            } else {
                setShowJoin(false);
                setSelectedItems([]);
            }
        });
    };

    const totalSelected = selectedItems.reduce((s, i) => s + i.item_value, 0);
    const entries = lotteryState?.entries || [];
    const isActive = lotteryState?.status === 'active';
    const totalValue = lotteryState?.total_value || 0;
    const hasJoined = user && entries.find(e => e.user_id === user.id);

    return (
        <div className="lottery-container">
            <h1 style={{ color: 'var(--accent-gold)', textAlign: 'center', marginBottom: '24px' }}>LOTTERY</h1>

            {winner ? (
                <div style={{
                    backgroundColor: 'rgba(255,215,0,0.15)', border: '2px solid var(--accent-gold)',
                    borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '20px'
                }}>
                    <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>Winner</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
                        <img src={winner.winner?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${winner.winner?.username}`}
                             alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ color: 'var(--accent-gold)', fontSize: '24px', fontWeight: 'bold' }}>{winner.winner?.username}</span>
                    </div>
                    <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px' }}>won {winner.total_value?.toFixed(2)} Gems</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {(winner.winner?.items || []).map((item, j) => (
                            <div key={j} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px'
                            }}>
                                <img src={item.image_url} alt={item.item_name}
                                     style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                                <div style={{ fontSize: '11px', lineHeight: '1.2', textAlign: 'left' }}>
                                    <div style={{ color: '#ddd', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</div>
                                    <div style={{ color: '#999' }}>
                                        {item.float_value ? `${item.float_value.toFixed(4)} ` : ''}{item.item_value.toFixed(2)}g
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : revealedWinner || isAnimating ? (
                <div style={{
                    background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 107, 53, 0.25)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <div style={{ 
                        padding: '16px 20px', 
                        textAlign: 'center', 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'rgba(255, 255, 255, 0.01)'
                    }}>
                        <span style={{ 
                            background: revealedWinner ? 'linear-gradient(135deg, #FF6B35 0%, #FFB347 100%)' : '#aaa',
                            WebkitBackgroundClip: revealedWinner ? 'text' : 'none',
                            WebkitTextFillColor: revealedWinner ? 'transparent' : 'initial',
                            fontWeight: '900', 
                            fontSize: '18px',
                            letterSpacing: '1px',
                            textShadow: revealedWinner ? '0 0 15px rgba(255,107,53,0.3)' : 'none'
                        }}>
                            {revealedWinner ? `WINNER: ${revealedWinner.username}` : 'DETERMINING WINNER...'}
                        </span>
                    </div>

                    <div style={{
                        width: '100%', 
                        height: '120px', 
                        position: 'relative',
                        background: revealedWinner ? 'rgba(255,107,53,0.02)' : 'transparent',
                        overflow: 'hidden'
                    }}>
                        {/* Fading side masks for deep portal effect */}
                        <div className="spinner-fade-left" />
                        <div className="spinner-fade-right" />

                        {/* Neon Center Pointer Line */}
                        <div style={{
                            position: 'absolute', left: '50%', top: 0, bottom: 0, width: '3px',
                            backgroundColor: revealedWinner ? '#FF6B35' : '#fff',
                            transform: 'translateX(-50%)', zIndex: 10,
                            boxShadow: revealedWinner ? '0 0 15px #FF6B35, 0 0 30px #FF6B35' : '0 0 8px rgba(255,255,255,0.5)',
                            transition: 'all 0.5s'
                        }} />
                        {/* Little pointer triangles */}
                        <div style={{
                            position: 'absolute', left: '50%', top: 0, width: 0, height: 0, 
                            borderStyle: 'solid', borderWidth: '8px 6px 0 6px', 
                            borderColor: (revealedWinner ? '#FF6B35' : '#fff') + ' transparent transparent transparent', 
                            transform: 'translateX(-50%)', zIndex: 11,
                            transition: 'border-color 0.5s'
                        }} />
                        <div style={{
                            position: 'absolute', left: '50%', bottom: 0, width: 0, height: 0, 
                            borderStyle: 'solid', borderWidth: '0 6px 8px 6px', 
                            borderColor: 'transparent transparent ' + (revealedWinner ? '#FF6B35' : '#fff') + ' transparent', 
                            transform: 'translateX(-50%)', zIndex: 11,
                            transition: 'border-color 0.5s'
                        }} />

                        {/* Spinner Carousel */}
                        <div style={{
                            display: 'flex', gap: `${GAP}px`, padding: `0 ${PADDING}px`,
                            height: '100%',
                            alignItems: 'center',
                            transform: `translateX(calc(50% - ${wheelOffset}px))`,
                            transition: snapToCenter
                                ? 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                : 'none',
                            willChange: 'transform'
                        }}>
                            {wheelItems.map((entry, i) => {
                                const isTargetWinner = entry.isWinner && revealedWinner;
                                return (
                                    <div key={i} style={{
                                        minWidth: `${ITEM_WIDTH}px`, 
                                        height: '90px',
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        borderRadius: '12px',
                                        background: isTargetWinner 
                                            ? 'rgba(255, 107, 53, 0.12)' 
                                            : 'rgba(255, 255, 255, 0.02)',
                                        border: isTargetWinner 
                                            ? '1.5px solid #FF6B35' 
                                            : '1px solid rgba(255, 255, 255, 0.05)',
                                        boxShadow: isTargetWinner 
                                            ? '0 0 20px rgba(255, 107, 53, 0.35)' 
                                            : 'none',
                                        transform: isTargetWinner ? 'scale(1.12)' : 'scale(1)',
                                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                    }}>
                                        <img src={entry.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${entry.username}`}
                                             alt="" style={{
                                                 width: '54px', 
                                                 height: '54px', 
                                                 borderRadius: '50%',
                                                 objectFit: 'cover',
                                                 border: isTargetWinner ? '2px solid #FF6B35' : '1.5px solid rgba(255, 255, 255, 0.2)',
                                                 boxShadow: isTargetWinner ? '0 0 10px rgba(255, 107, 53, 0.5)' : 'none',
                                                 transition: 'border 0.3s, box-shadow 0.3s'
                                             }} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', border: isActive ? '1px solid var(--accent-gold)' : '1px solid #333', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                            backgroundColor: isActive ? 'var(--accent-gold)' : 'var(--accent-green)',
                            color: '#000', padding: '4px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold'
                        }}>
                            {isActive ? 'LIVE' : entries.length > 0 ? 'WAITING' : 'EMPTY'}
                        </span>
                        <span style={{ color: 'var(--accent-gold)', fontSize: '20px', fontWeight: 'bold' }}>
                            {totalValue.toFixed(2)} Gems
                        </span>
                    </div>

                    {/* Timer */}
                    {isActive && timeLeft !== null && (
                        <div style={{ textAlign: 'center', padding: '16px', backgroundColor: 'rgba(255,215,0,0.05)' }}>
                            <div style={{ fontSize: '36px', fontWeight: 'bold', color: timeLeft < 5000 ? '#F44336' : 'var(--accent-gold)', fontFamily: 'monospace' }}>
                                {(timeLeft / 1000).toFixed(1)}s
                            </div>
                        </div>
                    )}

                    {/* Entries */}
                    <div style={{ padding: '20px' }}>
                        {entries.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                                No one has joined yet. Be the first!
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {entries.map((e, i) => (
                                    <div key={i} style={{
                                        backgroundColor: '#0a0a0a', borderRadius: '8px', padding: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <img src={e.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${e.username}`}
                                                 alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                                            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{e.username}</span>
                                            <span style={{ color: 'var(--accent-gold)', fontSize: '13px', marginLeft: 'auto' }}>
                                                {e.total_value?.toFixed(2) || '0.00'} Gems
                                            </span>
                                        </div>
                                        <div className="lottery-items-scroll">
                                            {(e.items || []).map((item, j) => (
                                                <div key={j} className="lottery-item-card">
                                                    <img src={item.image_url} alt={item.item_name}
                                                         style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                                                    <div style={{ fontSize: '11px', lineHeight: '1.2' }}>
                                                        <div style={{ color: '#ccc', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</div>
                                                        <div style={{ color: '#888' }}>
                                                            {item.float_value ? `${item.float_value.toFixed(4)} ` : ''}{item.item_value.toFixed(2)}g
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Join button */}
                    {user && !hasJoined && !isActive && (
                        <div style={{ padding: '0 20px 20px' }}>
                            <button className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                                    onClick={openJoin} disabled={joining}>
                                {joining ? 'Joining...' : 'Join Lottery'}
                            </button>
                        </div>
                    )}
                    {hasJoined && !isActive && (
                        <div style={{ padding: '0 20px 20px', textAlign: 'center', color: 'var(--accent-green)', fontWeight: 'bold' }}>
                            You are in! Waiting for more players...
                        </div>
                    )}
                </div>
            )}

            {showJoin && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 2000
                }} onClick={() => setShowJoin(false)}>
                    <div style={{
                        backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '24px', maxWidth: '500px',
                        width: '90%', maxHeight: '80vh', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '16px' }}>Join Lottery</h2>
                        <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                            Select items from your inventory to deposit.
                        </p>
                        {inventory.length === 0 ? (
                            <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No available items.</div>
                        ) : (
                            <div className="inventory-selection-grid">
                                {inventory.map(item => {
                                    const sel = selectedItems.find(i => i.id === item.id);
                                    return (
                                        <div key={item.id} onClick={() => toggleItem(item)}
                                             className={`inventory-selection-card ${sel ? 'selected' : ''}`}>
                                            <div style={{ position: 'relative', width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '6px' }}>
                                                <img src={item.image_url} alt={item.item_name} style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                                                {sel && (
                                                    <div style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'var(--accent-green)', color: '#000', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>✓</div>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '11px', fontWeight: '500', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                                                {item.item_name}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--accent-gold)', fontWeight: 'bold', marginTop: '2px' }}>
                                                {item.item_value.toFixed(2)}g
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold' }}>Total: <span style={{ color: 'var(--accent-gold)' }}>{totalSelected.toFixed(2)} Gems</span></span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-secondary" onClick={() => setShowJoin(false)}>Cancel</button>
                                <button className="btn-primary" onClick={handleJoin} disabled={selectedItems.length === 0}>
                                    Join
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
