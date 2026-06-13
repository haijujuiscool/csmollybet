import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Gem, History, Settings as SettingsIcon, Users, LifeBuoy, LogOut, User, Volume2, VolumeX, ArrowUp, ArrowDown, Copy, ExternalLink, Check, MessageSquare, Plus, Send, ArrowLeft, Hash } from 'lucide-react';

const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'balance', label: 'Balance History', icon: History },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
    { key: 'affiliates', label: 'Affiliates', icon: Users },
    { key: 'support', label: 'Support', icon: LifeBuoy },
    { key: 'logout', label: 'Logout', icon: LogOut },
];

export default function Profile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [balanceHistory, setBalanceHistory] = useState([]);
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('soundEnabled') !== 'false');
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [clientSeed, setClientSeed] = useState(() => localStorage.getItem('clientSeed') || '');
    const [logoutAllLoading, setLogoutAllLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'balance') {
            setLoadingHistory(true);
            axios.get('/api/balance-history', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            }).then(res => {
                setBalanceHistory(res.data || []);
            }).catch(() => {}).finally(() => setLoadingHistory(false));
        }
    }, [activeTab]);

    const handleTabClick = (key) => {
        if (key === 'logout') {
            logout();
            navigate('/');
            return;
        }
        setActiveTab(key);
    };

    const toggleSound = () => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        localStorage.setItem('soundEnabled', next);
    };

    const randomizeClientSeed = () => {
        let result = '';
        const chars = '0123456789abcdef';
        for (let i = 0; i < 64; i++) {
            result += chars[Math.floor(Math.random() * 16)];
        }
        setClientSeed(result);
    };

    const saveClientSeed = () => {
        localStorage.setItem('clientSeed', clientSeed);
    };

    const handleLogoutAll = async () => {
        setLogoutAllLoading(true);
        try {
            await axios.post('/api/auth/logout-all', {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            localStorage.removeItem('token');
            navigate('/login');
        } catch (err) {
            alert('Failed to log out all accounts.');
        } finally {
            setLogoutAllLoading(false);
        }
    };

    const formattedBalance = (Math.floor(Number(user?.gems || 0) * 100) / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    return (
        <div className="profile-page">
            <div className="profile-panel">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            className={`profile-panel-btn ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => handleTabClick(tab.key)}
                        >
                            <Icon size={18} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="profile-content">
                {activeTab === 'profile' && (
                    <div className="profile-tab-content">
                        <h2>Profile</h2>
                        <div className="profile-info-card">
                            <img src={user?.avatar} alt="" className="profile-avatar" />
                            <div>
                                <h3>{user?.username}</h3>
                                <div className="profile-gems">
                                    <Gem size={18} />
                                    <span>{formattedBalance}</span>
                                </div>
                                {user?.player_id && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px',
                                        fontSize: '13px', color: '#888'
                                    }}>
                                        <Hash size={14} />
                                        <span style={{ fontFamily: 'monospace', letterSpacing: '1px', color: '#FF8C00', fontWeight: 700 }}>
                                            #{user.player_id}
                                        </span>
                                        <button onClick={() => {
                                            navigator.clipboard.writeText(user.player_id.toString());
                                        }}
                                            style={{
                                                background: 'none', border: 'none', color: '#666', cursor: 'pointer',
                                                padding: '2px', display: 'flex', alignItems: 'center'
                                            }}
                                            title="Copy player ID"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'balance' && (
                    <div className="profile-tab-content">
                        <h2>Balance History</h2>
                        {loadingHistory ? (
                            <p style={{ color: '#888' }}>Loading...</p>
                        ) : balanceHistory.length === 0 ? (
                            <p style={{ color: '#888' }}>No balance changes recorded yet.</p>
                        ) : (
                            <div className="balance-history-list">
                                {balanceHistory.map(entry => (
                                    <div key={entry.id} className="balance-history-item">
                                        <div className="balance-change-icon">
                                            {entry.change >= 0 ? (
                                                <ArrowUp size={16} style={{ color: 'var(--accent-green)' }} />
                                            ) : (
                                                <ArrowDown size={16} style={{ color: '#F44336' }} />
                                            )}
                                        </div>
                                        <div className="balance-change-details">
                                            <span className={entry.change >= 0 ? 'change-positive' : 'change-negative'}>
                                                {entry.change >= 0 ? '+' : ''}{Number(entry.change).toFixed(2)}
                                            </span>
                                            <span className="balance-game">
                                                {entry.description}{entry.multiplier ? ` @ ${Number(entry.multiplier).toFixed(2)}x` : ''}
                                            </span>
                                            <span className="balance-old-new">
                                                Balance: {Number(entry.new_balance).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="balance-timestamp">
                                            {new Date(entry.timestamp + 'Z').toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="profile-tab-content">
                        <h2>Settings</h2>
                        <div className="settings-item" onClick={toggleSound}>
                            <div className="settings-item-left">
                                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                                <span>Sound Effects</span>
                            </div>
                            <div className={`settings-toggle ${soundEnabled ? 'on' : 'off'}`}>
                                <div className="settings-toggle-knob" />
                            </div>
                        </div>

                        {/* Client Seed */}
                        <div className="settings-section" style={{ marginTop: '24px' }}>
                            <h3 style={{ fontSize: '15px', color: '#ccc', marginBottom: '12px' }}>Client Seed</h3>
                            <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
                                Your client seed is combined with the server seed to determine game outcomes. You can set a custom seed or generate a random one.
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" value={clientSeed} onChange={e => setClientSeed(e.target.value)}
                                    style={{
                                        flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #333',
                                        background: '#111', color: '#fff', fontSize: '13px', outline: 'none',
                                        fontFamily: 'monospace', letterSpacing: '1px'
                                    }}
                                    placeholder="Enter a custom seed or randomize"
                                    maxLength={64}
                                />
                                <button onClick={randomizeClientSeed}
                                    style={{
                                        padding: '10px 16px', borderRadius: '8px',
                                        background: 'rgba(255,107,53,0.15)', color: '#FF6B35',
                                        border: '1px solid rgba(255,107,53,0.3)', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap'
                                    }}
                                >
                                    Randomize
                                </button>
                                <button onClick={saveClientSeed}
                                    style={{
                                        padding: '10px 16px', borderRadius: '8px',
                                        background: 'rgba(76,175,80,0.15)', color: 'var(--accent-green)',
                                        border: '1px solid rgba(76,175,80,0.3)', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap'
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>

                        {/* Log Out All Accounts */}
                        <div className="settings-section" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <h3 style={{ fontSize: '15px', color: '#ccc', marginBottom: '8px' }}>Sessions</h3>
                            <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                                This will invalidate all active sessions and log you out everywhere.
                            </div>
                            <button onClick={handleLogoutAll} disabled={logoutAllLoading}
                                style={{
                                    padding: '12px 24px', borderRadius: '8px', fontWeight: 700, fontSize: '14px',
                                    background: 'rgba(244,67,54,0.15)', color: '#F44336',
                                    border: '1px solid rgba(244,67,54,0.3)', cursor: logoutAllLoading ? 'not-allowed' : 'pointer',
                                    opacity: logoutAllLoading ? 0.6 : 1
                                }}
                            >
                                {logoutAllLoading ? 'Logging out...' : 'Log Out All Accounts'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'affiliates' && (
                    <AffiliatesTab />
                )}

                {activeTab === 'support' && <SupportTab />}
            </div>
        </div>
    );
}

function AffiliatesTab() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [claimCode, setClaimCode] = useState('');
    const [claimError, setClaimError] = useState('');
    const [claiming, setClaiming] = useState(false);

    const fetchStats = () => {
        axios.get('/api/affiliate/stats', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).then(res => setStats(res.data))
          .catch(() => {})
          .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleClaimCode = async () => {
        const trimmed = claimCode.trim().toLowerCase();
        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(trimmed)) {
            setClaimError('Code must be 3-20 characters (letters, numbers, - and _)');
            return;
        }
        setClaiming(true);
        setClaimError('');
        try {
            const res = await axios.post('/api/user/claim-affiliate-code', { code: trimmed }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.data.success) {
                fetchStats();
            }
        } catch (err) {
            setClaimError(err.response?.data?.error || 'Failed to claim code');
        } finally {
            setClaiming(false);
        }
    };

    if (loading) return <div className="profile-tab-content"><p style={{ color: '#888' }}>Loading...</p></div>;
    if (!stats) return <div className="profile-tab-content"><p style={{ color: '#888' }}>Failed to load affiliate stats.</p></div>;

    const origin = window.location.origin;

    // No affiliate code yet — show claim form
    if (!stats.affiliateCode) {
        return (
            <div className="profile-tab-content">
                <h2>Affiliates</h2>
                <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
                    Choose your unique affiliate code to start earning commissions.
                </p>
                <div style={{
                    padding: '20px', background: 'rgba(255,107,53,0.06)', borderRadius: '12px',
                    border: '1px solid rgba(255,107,53,0.15)', maxWidth: '400px'
                }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ccc', marginBottom: '8px' }}>
                        Your Affiliate Code
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" value={claimCode} onChange={e => { setClaimCode(e.target.value); setClaimError(''); }}
                            placeholder="e.g. csgoking"
                            maxLength={20}
                            style={{
                                flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #333',
                                background: '#111', color: '#fff', fontSize: '14px', outline: 'none'
                            }}
                        />
                        <button onClick={handleClaimCode} disabled={claiming}
                            style={{
                                padding: '10px 20px', borderRadius: '8px',
                                background: 'rgba(255,107,53,0.2)', color: '#FF6B35',
                                border: '1px solid rgba(255,107,53,0.4)', cursor: claiming ? 'not-allowed' : 'pointer',
                                fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', opacity: claiming ? 0.6 : 1
                            }}
                        >
                            {claiming ? '...' : 'Claim'}
                        </button>
                    </div>
                    {claimError && <div style={{ color: '#F44336', fontSize: '12px', marginTop: '8px' }}>{claimError}</div>}
                </div>
                <div style={{
                    padding: '16px', background: 'rgba(255,107,53,0.06)', borderRadius: '10px',
                    border: '1px solid rgba(255,107,53,0.15)', marginTop: '20px', maxWidth: '400px'
                }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#FF8C00', marginBottom: '8px' }}>Commission Rates</div>
                    <div style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.8 }}>
                        • <strong style={{ color: '#ddd' }}>5%</strong> of every deposit made by your referrals
                    </div>
                    <div style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.8 }}>
                        • <strong style={{ color: '#ddd' }}>10%</strong> of the house edge on every bet placed by your referrals
                    </div>
                </div>
            </div>
    );
}

    // Has affiliate code — show dashboard
    return (
        <div className="profile-tab-content">
            <h2>Affiliates</h2>

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                    { label: 'Referrals', value: stats.totalReferrals, color: '#FF8C00' },
                    { label: 'Earnings', value: `${stats.totalEarnings.toFixed(2)}`, color: 'var(--accent-green)' },
                    { label: 'From Deposits', value: `${stats.totalDepositComm.toFixed(2)}`, color: '#4b69ff' },
                    { label: 'From Wagers', value: `${stats.totalWagerComm.toFixed(2)}`, color: '#8847ff' },
                ].map(card => (
                    <div key={card.label} style={{
                        padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: card.color }}>{card.value}</div>
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{card.label}</div>
                    </div>
                ))}
            </div>

            {/* Referral Link */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ccc', marginBottom: '8px' }}>Your Referral Link</div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                    background: '#111', borderRadius: '10px', border: '1px solid #333'
                }}>
                    <input type="text" readOnly value={`${origin}${stats.affiliateLink}`}
                        style={{ flex: 1, background: 'none', border: 'none', color: '#aaa', fontSize: '13px', outline: 'none' }}
                    />
                    <button onClick={() => handleCopy(`${origin}${stats.affiliateLink}`)}
                        style={{
                            padding: '8px 14px', borderRadius: '8px',
                            background: copied ? 'rgba(76,175,80,0.2)' : 'rgba(255,107,53,0.15)',
                            color: copied ? 'var(--accent-green)' : '#FF6B35',
                            border: '1px solid rgba(255,107,53,0.3)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600
                        }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Referral Code */}
            <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ccc', marginBottom: '8px' }}>Your Referral Code</div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                    background: '#111', borderRadius: '10px', border: '1px solid #333'
                }}>
                    <span style={{ flex: 1, color: '#FF8C00', fontWeight: 700, fontSize: '16px', letterSpacing: '1px' }}>
                        {stats.affiliateCode}
                    </span>
                    <button onClick={() => handleCopy(stats.affiliateCode)}
                        style={{
                            padding: '8px 14px', borderRadius: '8px',
                            background: copied ? 'rgba(76,175,80,0.2)' : 'rgba(255,107,53,0.15)',
                            color: copied ? 'var(--accent-green)' : '#FF6B35',
                            border: '1px solid rgba(255,107,53,0.3)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600
                        }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Commission Info */}
            <div style={{
                padding: '16px', background: 'rgba(255,107,53,0.06)', borderRadius: '10px',
                border: '1px solid rgba(255,107,53,0.15)', marginBottom: '24px'
            }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#FF8C00', marginBottom: '8px' }}>Commission Rates</div>
                <div style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.8 }}>
                    • <strong style={{ color: '#ddd' }}>5%</strong> of every deposit made by your referrals
                </div>
                <div style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.8 }}>
                    • <strong style={{ color: '#ddd' }}>10%</strong> of the house edge on every bet placed by your referrals
                </div>
            </div>

            {/* Recent Transactions */}
            <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ccc', marginBottom: '12px' }}>Recent Activity</div>
                {stats.transactions.length === 0 ? (
                    <p style={{ color: '#888', fontSize: '13px' }}>No activity yet. Share your referral link to start earning!</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.transactions.slice(0, 20).map(tx => (
                            <div key={tx.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.04)'
                            }}>
                                <div>
                                    <div style={{ fontSize: '13px', color: '#ccc' }}>
                                        {tx.referred_username}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#666' }}>
                                        {tx.type === 'deposit' ? 'Deposit' : 'Wager'} &middot; ${tx.amount.toFixed(2)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-green)' }}>
                                        +${tx.commission.toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#666' }}>
                                        {new Date(tx.created_at + 'Z').toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SupportTab() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const [creating, setCreating] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const fetchTickets = () => {
        setLoading(true);
        setError('');
        axios.get('/api/support/tickets', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).then(res => setTickets(res.data || []))
          .catch(e => setError('Failed to load: ' + (e.response?.status || e.message)))
          .finally(() => setLoading(false));
    };

    useEffect(() => { fetchTickets(); }, []);

    const openTicket = async (ticketId) => {
        try {
            const res = await axios.get(`/api/support/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setSelectedTicket(res.data);
            setView('detail');
        } catch (e) {}
    };

    const createTicket = async () => {
        if (!subject.trim() || !message.trim()) return;
        setCreating(true);
        try {
            await axios.post('/api/support/tickets', { subject: subject.trim(), message: message.trim() }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setSubject(''); setMessage('');
            setView('list');
            fetchTickets();
        } catch (e) {} finally { setCreating(false); }
    };

    const sendReply = async () => {
        if (!replyMessage.trim() || !selectedTicket) return;
        setSending(true);
        try {
            await axios.post(`/api/support/tickets/${selectedTicket.id}/messages`, { message: replyMessage.trim() }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setReplyMessage('');
            openTicket(selectedTicket.id);
        } catch (e) {} finally { setSending(false); }
    };

    if (view === 'detail' && selectedTicket) {
        return (
            <div className="profile-tab-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <button onClick={() => { setView('list'); setSelectedTicket(null); }}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: '18px', flex: 1 }}>{selectedTicket.subject}</h2>
                    <span style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                        background: selectedTicket.status === 'open' ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.06)',
                        color: selectedTicket.status === 'open' ? 'var(--accent-green)' : '#888'
                    }}>
                        {selectedTicket.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                    {selectedTicket.messages?.map(msg => (
                        <div key={msg.id} style={{
                            padding: '14px', borderRadius: '10px', maxWidth: '85%',
                            alignSelf: msg.is_admin ? 'flex-start' : 'flex-end',
                            background: msg.is_admin ? 'rgba(255,107,53,0.08)' : 'rgba(255,255,255,0.04)',
                            border: msg.is_admin ? '1px solid rgba(255,107,53,0.15)' : '1px solid rgba(255,255,255,0.06)'
                        }}>
                            <div style={{ fontSize: '11px', color: msg.is_admin ? '#FF6B35' : '#888', marginBottom: '4px', fontWeight: 600 }}>
                                {msg.is_admin ? 'Admin' : 'You'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#ddd', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                            <div style={{ fontSize: '10px', color: '#555', marginTop: '6px' }}>
                                {new Date(msg.created_at + 'Z').toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>

                {selectedTicket.status === 'open' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <textarea value={replyMessage} onChange={e => setReplyMessage(e.target.value)}
                            placeholder="Write your reply..."
                            rows={3}
                            style={{
                                flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #333',
                                background: '#111', color: '#fff', fontSize: '13px', outline: 'none', resize: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                        <button onClick={sendReply} disabled={sending || !replyMessage.trim()}
                            style={{
                                padding: '10px 18px', borderRadius: '8px',
                                background: 'rgba(255,107,53,0.2)', color: '#FF6B35',
                                border: '1px solid rgba(255,107,53,0.4)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600,
                                opacity: sending || !replyMessage.trim() ? 0.5 : 1
                            }}
                        >
                            <Send size={16} /> {sending ? '...' : 'Send'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (view === 'create') {
        return (
            <div className="profile-tab-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <button onClick={() => setView('list')}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>New Ticket</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                        placeholder="Subject (e.g. Withdrawal issue)"
                        maxLength={200}
                        style={{
                            padding: '12px 16px', borderRadius: '8px', border: '1px solid #333',
                            background: '#111', color: '#fff', fontSize: '14px', outline: 'none'
                        }}
                    />
                    <textarea value={message} onChange={e => setMessage(e.target.value)}
                        placeholder="Describe your issue in detail..."
                        rows={6}
                        style={{
                            padding: '12px 16px', borderRadius: '8px', border: '1px solid #333',
                            background: '#111', color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical',
                            fontFamily: 'inherit'
                        }}
                    />
                    <button onClick={createTicket} disabled={creating || !subject.trim() || !message.trim()}
                        style={{
                            padding: '14px', borderRadius: '8px', fontWeight: 700, fontSize: '14px',
                            background: 'linear-gradient(135deg, #FF6B35, #FF8C00)', color: '#000',
                            border: 'none', cursor: 'pointer', opacity: creating || !subject.trim() || !message.trim() ? 0.6 : 1
                        }}
                    >
                        {creating ? 'Creating...' : 'Submit Ticket'}
                    </button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="profile-tab-content"><p style={{ color: '#888' }}>Loading...</p></div>;

    return (
        <div className="profile-tab-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Support</h2>
                <button onClick={() => setView('create')}
                    style={{
                        padding: '8px 16px', borderRadius: '8px',
                        background: 'rgba(255,107,53,0.15)', color: '#FF6B35',
                        border: '1px solid rgba(255,107,53,0.3)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600
                    }}
                >
                    <Plus size={16} /> New Ticket
                </button>
            </div>

            {error && <div style={{ padding: '12px', background: 'rgba(244,67,54,0.1)', borderRadius: '8px', color: '#F44336', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

            {tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
                    <MessageSquare size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                    <p style={{ fontSize: '14px' }}>No tickets yet.</p>
                    <p style={{ fontSize: '13px' }}>Create a ticket and our support team will get back to you.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tickets.map(ticket => (
                        <div key={ticket.id} onClick={() => openTicket(ticket.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '14px',
                                padding: '14px', borderRadius: '10px', cursor: 'pointer',
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                transition: 'background 0.15s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        >
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: ticket.status === 'open' ? 'rgba(76,175,80,0.12)' : 'rgba(255,255,255,0.04)',
                                color: ticket.status === 'open' ? 'var(--accent-green)' : '#666'
                            }}>
                                <MessageSquare size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#e0e0e0', marginBottom: '2px' }}>
                                    {ticket.subject}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ticket.last_message || 'No messages'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{
                                    padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 700,
                                    background: ticket.status === 'open' ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.06)',
                                    color: ticket.status === 'open' ? 'var(--accent-green)' : '#888',
                                    marginBottom: '4px'
                                }}>
                                    {ticket.status}
                                </div>
                                <div style={{ fontSize: '10px', color: '#555' }}>
                                    {ticket.last_message_at ? new Date(ticket.last_message_at + 'Z').toLocaleDateString() : ''}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
