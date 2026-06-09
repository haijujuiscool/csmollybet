import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Gem, LogOut, Menu, WalletCards } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DepositWithdrawModal from './DepositWithdrawModal';

import doubleIcon from '../assets/double.png';
import crashIcon from '../assets/crash.png';
import minesIcon from '../assets/mines.png';
import battlesIcon from '../assets/battles.png';
import casesIcon from '../assets/cases.png';
import upgraderIcon from '../assets/upgrader.png';

export default function Navbar({ onToggleSidebar }) {
    const { user, logout } = useAuth();
    const [tradeModal, setTradeModal] = useState(null);
    const [gamesOpen, setGamesOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setGamesOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const formattedBalance = (Math.floor(Number(user?.gems || 0) * 100) / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const gameLinks = [
        { path: '/double', label: 'Double', icon: doubleIcon },
        { path: '/crash', label: 'Crash', icon: crashIcon },
        { path: '/mines', label: 'Mines', icon: minesIcon },
        { path: '/battles', label: 'Battles', icon: battlesIcon },
        { path: '/cases', label: 'Cases', icon: casesIcon },
        { path: '/upgrader', label: 'Upgrader', icon: upgraderIcon }
    ];

    return (
        <>
            <header className="top-navbar">
                <div className="navbar-left">
                    <button
                        type="button"
                        className="mobile-menu-btn"
                        onClick={onToggleSidebar}
                        aria-label="Open navigation"
                    >
                        <Menu size={24} />
                    </button>
                    <Link to="/" className="navbar-brand" aria-label="csmolly.bet home" style={{
                        fontSize: '22px',
                        fontWeight: 900,
                        background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C00 50%, #FFB347 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginRight: '20px',
                        textDecoration: 'none'
                    }}>
                        CSMOLLY.BET
                    </Link>
                    <div ref={dropdownRef} className="games-dropdown-wrapper" style={{ position: 'relative' }}>
                        <button
                            type="button"
                            className="btn-secondary navbar-action"
                            onClick={() => setGamesOpen(prev => !prev)}
                            aria-haspopup="true"
                            aria-expanded={gamesOpen}
                        >
                            Games ▼
                        </button>
                        {gamesOpen && (
                            <div
                                className="games-dropdown"
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '100%',
                                    background: 'rgba(0,0,0,0.95)',
                                    border: '1px solid #444',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    zIndex: 1000,
                                    minWidth: '160px'
                                }}
                            >
                                {gameLinks.map(link => (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        className="dropdown-item"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '8px 12px',
                                            color: '#fff',
                                            textDecoration: 'none',
                                            borderRadius: '4px',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onClick={() => setGamesOpen(false)}
                                    >
                                        <img src={link.icon} alt={link.label} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                        <span>{link.label}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="navbar-center" />

                <div className="navbar-right">
                    {user ? (
                        <>
                            <div className="gem-balance">
                                <Gem size={18} />
                                <span>{formattedBalance}</span>
                            </div>
                            <button
                                type="button"
                                className="btn-primary navbar-action"
                                onClick={() => setTradeModal('deposit')}
                            >
                                <WalletCards size={16} />
                                <span className="navbar-action-label">Deposit</span>
                            </button>
                            <button
                                type="button"
                                className="btn-secondary navbar-action"
                                onClick={logout}
                                aria-label="Logout"
                            >
                                <LogOut size={16} />
                                <span className="navbar-action-label">Logout</span>
                            </button>
                        </>
                    ) : (
                        <a className="btn-primary navbar-action" href="/api/auth/steam">
                            Login
                        </a>
                    )}
                </div>
            </header>

            <DepositWithdrawModal
                isOpen={Boolean(tradeModal)}
                onClose={() => setTradeModal(null)}
                initialTab={tradeModal || 'deposit'}
            />
        </>
    );
}
