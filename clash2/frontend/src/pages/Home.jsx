import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import doubleIcon from '../assets/double.png';
import crashIcon from '../assets/crash.png';
import minesIcon from '../assets/mines.png';
import battlesIcon from '../assets/battles.png';
import casesIcon from '../assets/cases.png';
import upgraderIcon from '../assets/upgrader.png';

export default function Home() {
    const { user } = useAuth();

    const games = [
        { name: 'Double', path: '/double', icon: doubleIcon, desc: 'Bet on colors and multiply your gems', color: '#E91E63' },
        { name: 'Crash', path: '/crash', icon: crashIcon, desc: 'Predict the multiplier before it crashes', color: '#4CAF50' },
        { name: 'Mines', path: '/mines', icon: minesIcon, desc: 'Uncover gems, avoid the hidden mines', color: '#FF9800' },
        { name: 'Battles', path: '/battles', icon: battlesIcon, desc: 'Battle other players or bots in case openings', color: '#FFC107' },
        { name: 'Cases', path: '/cases', icon: casesIcon, desc: 'Open custom cases and win big skins', color: '#607D8B' },
        { name: 'Upgrader', path: '/upgrader', icon: upgraderIcon, desc: 'Upgrade your items for high tier skins', color: '#FFEB3B' }
    ];

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
                    background: 'radial-gradient(circle, rgba(255, 193, 7, 0.05) 0%, transparent 60%)',
                    pointerEvents: 'none'
                }} />

                <h1 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '15px', letterSpacing: '-1px' }}>
                    Welcome to <span style={{
                        background: 'linear-gradient(135deg, #1b75ff 0%, #2bd2ff 35%, #ffb800 80%, #ff8c00 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: '950',
                        textShadow: '0 0 15px rgba(27, 117, 255, 0.3)'
                    }}>Bluegem.com</span>
                </h1>
                <p style={{ color: '#aaa', fontSize: '1.2rem', marginBottom: '35px', maxWidth: '600px', margin: '0 auto 35px' }}>
                    The only CS2 gambling site where the house has a 1% house edge, provably fair and secure! In Clash gg, the house has a 8.5% edge.
                </p>

                {/* User Portal / Call To Action */}
                {!user ? (
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <Link to="/login" className="btn-primary" style={{
                            padding: '14px 35px',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            boxShadow: '0 4px 15px rgba(255, 193, 7, 0.3)',
                            transition: 'all 0.2s ease-in-out'
                        }}>
                            Login
                        </Link>
                        <Link to="/register" className="btn-secondary" style={{
                            padding: '14px 35px',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            transition: 'all 0.2s ease-in-out'
                        }}>
                            Register
                        </Link>
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
                                <img src={g.icon} alt={g.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
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

