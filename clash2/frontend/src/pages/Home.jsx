import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Dices } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import sounds from '../utils/sounds';

import doubleIcon from '../assets/double.png';
import crashIcon from '../assets/crash.png';
import minesIcon from '../assets/mines.png';
import battlesIcon from '../assets/battles.png';
import casesIcon from '../assets/cases.png';
import upgraderIcon from '../assets/upgrader.png';
import mollyFlames from '../assets/molly_flames.png';

export default function Home() {
    const { user } = useAuth();
    const [lottery, setLottery] = useState(null);
    const [lotteryTime, setLotteryTime] = useState(null);
    const [lotteryWinner, setLotteryWinner] = useState(null);
    const [lotteryWheel, setLotteryWheel] = useState([]);
    const [lotteryAnimating, setLotteryAnimating] = useState(false);
    const [lotterySnap, setLotterySnap] = useState(false);
    const [lotteryWheelOff, setLotteryWheelOff] = useState(0);
    const [lotteryRevealed, setLotteryRevealed] = useState(null);

    useEffect(() => {
        const s = io(undefined, {
            auth: { token: localStorage.getItem('token') }
        });
        s.emit('get_lottery', (state) => {
            setLottery(state);
        });
        s.on('lottery_state', (state) => {
            setLottery(state);
            if (state.status !== 'active') setLotteryTime(null);
        });
        s.on('lottery_tick', ({ timeLeft }) => {
            setLotteryTime(timeLeft);
        });
        s.on('lottery_rolling', (data) => {
            const items = [];
            for (let i = 0; i < 81; i++) {
                const p = data.participants[Math.floor(Math.random() * data.participants.length)];
                items.push({ avatar: p.avatar || '', username: p.username, isWinner: false });
            }
            items[80] = { avatar: data.winnerEntry.avatar || '', username: data.winnerEntry.username, isWinner: true };
            setLotteryWheel(items);
            setLotteryTime(null);
            setLotteryRevealed(null);
            setLotteryAnimating(false);
            setLotterySnap(false);
            setLotteryWheelOff(3215);

            setTimeout(() => {
                setLotteryAnimating(true);
                sounds.spinStart();
                const jitter = Math.floor(Math.random() * 60) - 30;
                setLotteryWheelOff(6415 + jitter);
            }, 50);

            setTimeout(() => {
                setLotterySnap(true);
                setLotteryWheelOff(6415);
            }, 4700);

            setTimeout(() => {
                setLotteryRevealed(data.winnerEntry);
                sounds.tick(900);
            }, 4500);
        });
        s.on('lottery_finished', (result) => {
            setLotteryWinner(result);
            setLotteryWheel([]);
            setLotteryRevealed(null);
            setTimeout(() => setLotteryWinner(null), 8000);
        });
        return () => s.disconnect();
    }, []);

    const games = [
        { name: 'Double', path: '/double', icon: doubleIcon, desc: 'Bet on colors and multiply your gems', color: '#E91E63' },
        { name: 'Crash', path: '/crash', icon: crashIcon, desc: 'Predict the multiplier before it crashes', color: '#4CAF50' },
        { name: 'Mines', path: '/mines', icon: minesIcon, desc: 'Uncover gems, avoid the hidden mines', color: '#FF9800' },
        { name: 'Battles', path: '/battles', icon: battlesIcon, desc: 'Battle other players or bots in case openings', color: '#FF6B35' },
        { name: 'Cases', path: '/cases', icon: casesIcon, desc: 'Open custom cases and win big skins', color: '#607D8B' },
        { name: 'Upgrader', path: '/upgrader', icon: upgraderIcon, desc: 'Upgrade your items for high tier skins', color: '#FFEB3B' },
        { name: 'Lotteries', path: '/lotteries', icon: null, desc: 'Pool items and win the whole pot', color: '#9C27B0' }
    ];
    const lotteryEntry = lottery?.entries || [];
    const isActive = lottery?.status === 'active';

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
            {/* Header Hero Section */}
            <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'linear-gradient(135deg, rgba(30,30,30,0.6) 0%, rgba(18,18,18,0.8) 100%)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                marginBottom: '40px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Visual Gradient Glow */}
                <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    background: 'radial-gradient(circle, rgba(255, 107, 53, 0.05) 0%, transparent 60%)',
                    pointerEvents: 'none'
                }} />

                <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '15px', letterSpacing: '-1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                    <img src={mollyFlames} alt="" style={{ height: '48px', width: 'auto' }} />
                    <span style={{
                        background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C00 50%, #FFB347 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: '950',
                        textShadow: '0 0 15px rgba(255, 107, 53, 0.3)'
                    }}>CSMOLLY.BET</span>
                </h1>
                <p style={{ color: '#aaa', fontSize: '1.2rem', marginBottom: '35px', maxWidth: '600px', margin: '0 auto 35px' }}>
                    The only CS2 gambling site where the house has a 1% house edge, provably fair and secure! In Clash gg, the house has a 8.5% edge.
                </p>

                {/* User Portal / Call To Action */}
                {!user ? (
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <a href="/api/auth/steam" className="btn-primary" style={{
                            padding: '14px 35px',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            boxShadow: '0 4px 15px rgba(255, 193, 7, 0.3)',
                            transition: 'all 0.2s ease-in-out'
                        }}>
                            Login with Steam
                        </a>
                    </div>
                ) : (
                    <div style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '20px 40px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                        <div style={{ fontSize: '1.1rem', color: '#fff' }}>
                            Logged in as <span style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>{user.username}</span>
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            💎 {(Math.floor(parseFloat(user.gems || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Gems
                        </div>
                    </div>
                )}
            </div>

            {/* Live Lottery Banner */}
            {lottery && (
                <Link to="/lotteries" style={{ textDecoration: 'none', display: 'block', marginBottom: '40px' }}>
                    <div style={{
                        background: lotteryWinner
                            ? 'linear-gradient(135deg, rgba(156,39,176,0.2) 0%, rgba(255,215,0,0.15) 100%)'
                            : 'linear-gradient(135deg, rgba(156,39,176,0.12) 0%, rgba(30,30,30,0.8) 100%)',
                        borderRadius: '16px',
                        border: lotteryWinner
                            ? '2px solid var(--accent-gold)'
                            : '1px solid rgba(156,39,176,0.3)',
                        padding: '24px',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'border-color 0.3s'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Dices size={22} color="var(--accent-gold)" />
                                <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#fff' }}>Live Lottery</span>
                            </div>
                            <span style={{
                                backgroundColor: isActive ? 'var(--accent-gold)' : lotteryEntry.length > 0 ? 'var(--accent-green)' : '#555',
                                color: '#000', padding: '3px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                            }}>
                                {lotteryWinner ? 'FINISHED' : isActive ? 'LIVE' : lotteryEntry.length > 0 ? 'WAITING' : 'EMPTY'}
                            </span>
                        </div>

                        {lotteryWinner ? (
                            <div style={{ textAlign: 'center', padding: '12px' }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ color: '#888', fontSize: '13px' }}>Winner: </span>
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '20px' }}>{lotteryWinner.winner?.username}</span>
                                    <span style={{ color: '#aaa', fontSize: '13px', marginLeft: '8px' }}>
                                        won {lotteryWinner.total_value?.toFixed(2)} Gems
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {(lotteryWinner.winner?.items || []).map((item, j) => (
                                        <div key={j} style={{
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            backgroundColor: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px'
                                        }}>
                                            <img src={item.image_url} alt="" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                                            <span style={{ fontSize: '10px', color: '#bbb' }}>
                                                {item.float_value ? `${item.float_value.toFixed(4)} ` : ''}{item.item_value.toFixed(2)}g
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (lotteryRevealed || lotteryAnimating) && lotteryWheel.length > 0 ? (
                            <div style={{ padding: '12px' }}>
                                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '14px' }}>
                                        {lotteryRevealed ? `Winner: ${lotteryRevealed.username}` : 'Rolling...'}
                                    </span>
                                </div>
                                <div style={{ width: '100%', height: '70px', position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute', left: '50%', top: 0, bottom: 0, width: '3px',
                                        backgroundColor: lotteryRevealed ? 'var(--accent-gold)' : '#fff',
                                        transform: 'translateX(-50%)', zIndex: 10,
                                        boxShadow: lotteryRevealed ? '0 0 15px rgba(255,215,0,0.5)' : '0 0 8px rgba(255,255,255,0.5)'
                                    }} />
                                    <div style={{
                                        display: 'flex', gap: '8px', padding: '8px',
                                        height: '100%',
                                        transform: `translateX(calc(50% - ${lotteryWheelOff}px))`,
                                        transition: lotterySnap
                                            ? 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                            : (lotteryAnimating ? 'transform 4.5s cubic-bezier(0.1, 0.7, 0.1, 1)' : 'none'),
                                        willChange: 'transform'
                                    }}>
                                        {lotteryWheel.map((entry, i) => (
                                            <div key={i} style={{
                                                minWidth: '60px', height: '100%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}>
                                                <img src={entry.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${entry.username}`}
                                                     alt="" style={{
                                                         width: '44px', height: '44px', borderRadius: '50%',
                                                         objectFit: 'cover',
                                                         border: entry.isWinner && lotteryRevealed ? '3px solid var(--accent-gold)' : '2px solid #444',
                                                         boxShadow: entry.isWinner && lotteryRevealed ? '0 0 12px rgba(255,215,0,0.4)' : 'none',
                                                         transition: 'border 0.3s, box-shadow 0.3s'
                                                     }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {isActive && lotteryTime !== null && (
                                    <div style={{ textAlign: 'center', padding: '8px', marginBottom: '8px' }}>
                                        <span style={{
                                            fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace',
                                            color: lotteryTime < 5000 ? '#F44336' : 'var(--accent-gold)'
                                        }}>
                                            {(lotteryTime / 1000).toFixed(1)}s
                                        </span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                                    {lotteryEntry.length === 0 && !isActive ? (
                                        <span style={{ color: '#666', fontSize: '14px' }}>No entries yet — be the first!</span>
                                    ) : (
                                        lotteryEntry.map((e, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px', flexWrap: 'wrap'
                                            }}>
                                                <img src={e.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${e.username}`}
                                                     alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                                                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{e.username}</span>
                                                {(e.items || []).slice(0, 3).map((item, j) => (
                                                    <div key={j} style={{
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                        backgroundColor: '#1a1a1a', padding: '2px 6px', borderRadius: '4px',
                                                        border: '1px solid #2a2a2a'
                                                    }}>
                                                        <img src={item.image_url} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                                        <span style={{ fontSize: '10px', color: '#aaa' }}>
                                                            {item.float_value ? `${item.float_value.toFixed(4)} ` : ''}{item.item_value.toFixed(2)}g
                                                        </span>
                                                    </div>
                                                ))}
                                                {(e.items || []).length > 3 && (
                                                    <span style={{ fontSize: '10px', color: '#666' }}>+{e.items.length - 3} more</span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                    <span style={{ color: '#888', fontSize: '13px' }}>
                                        {lotteryEntry.length} player{lotteryEntry.length !== 1 ? 's' : ''}
                                    </span>
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '16px' }}>
                                        {lottery?.total_value?.toFixed(2) || '0.00'} Gems
                                    </span>
                                </div>
                            </>
                        )}
                        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(156,39,176,0.08), transparent 70%)', pointerEvents: 'none' }} />
                    </div>
                </Link>
            )}

            {/* Game Modes Header */}
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ borderBottom: '3px solid var(--accent-gold)', paddingBottom: '5px' }}>Explore Game Modes</span>
            </h2>

            {/* Games Grid Layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '20px'
            }}>
                {games.map((g) => (
                    <Link to={g.path} key={g.name} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '24px',
                        borderRadius: '16px',
                        background: 'var(--bg-panel)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        height: '200px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = `0 10px 20px rgba(0,0,0,0.4), 0 0 15px ${g.color}15`;
                            e.currentTarget.style.borderColor = g.color;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        }}>
                        {/* Glow corner */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '60px',
                            height: '60px',
                            background: `radial-gradient(circle at top right, ${g.color}25, transparent 70%)`
                        }} />

                        <div>
                            <div style={{ marginBottom: '12px' }}>
                                {g.icon ? (
                                    <img src={g.icon} alt={g.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                                ) : (
                                    <Dices size={44} color="#fff" />
                                )}
                            </div>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>{g.name}</h3>
                            <p style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.3' }}>{g.desc}</p>
                        </div>

                        <div style={{
                            alignSelf: 'flex-end',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: g.color,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            Play Now →
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

