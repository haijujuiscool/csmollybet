import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, RefreshCw, AlertCircle, Calendar, Clock, Zap, TrendingUp } from 'lucide-react';
import sounds from '../utils/sounds';

const getFlag = (teamName) => {
    if (!teamName) return '⚽';
    const flags = {
        'argentina': '🇦🇷', 'france': '🇫🇷', 'brazil': '🇧🇷', 'germany': '🇩🇪',
        'spain': '🇪🇸', 'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'portugal': '🇵🇹', 'netherlands': '🇳🇱',
        'usa': '🇺🇸', 'united states': '🇺🇸', 'mexico': '🇲🇽', 'canada': '🇨🇦',
        'south africa': '🇿🇦', 'korea republic': '🇰🇷', 'czechia': '🇨🇿',
        'bosnia and herzegovina': '🇧🇦', 'haiti': '🇭🇹', 'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        'paraguay': '🇵🇾', 'italy': '🇮🇹', 'belgium': '🇧🇪', 'croatia': '🇭🇷',
        'uruguay': '🇺🇾', 'japan': '🇯🇵', 'morocco': '🇲🇦', 'senegal': '🇸🇳',
        'switzerland': '🇨🇭', 'denmark': '🇩🇰', 'australia': '🇦🇺', 'turkiye': '🇹🇷',
        'qatar': '🇶🇦', 'ecuador': '🇪🇨', 'curacao': '🇨🇼', 'curaçao': '🇨🇼',
        'sweden': '🇸🇪', 'tunisia': '🇹🇳', 'cabo verde': '🇨🇻', 'ir iran': '🇮🇷',
        'new zealand': '🇳🇿', 'egypt': '🇪🇬', 'iraq': '🇮🇶', 'norway': '🇳🇴',
        'algeria': '🇩🇿', 'austria': '🇦🇹', 'jordan': '🇯🇴', 'ghana': '🇬🇭',
        'panama': '🇵🇦', 'congo dr': '🇨🇩', 'uzbekistan': '🇺🇿', 'colombia': '🇨🇴',
        'saudi arabia': '🇸🇦', "cote d'ivoire": '🇨🇮'
    };
    return flags[teamName.toLowerCase()] || '🏳️';
};

const formatKickoff = (kickoff) => {
    if (!kickoff) return '';
    const d = new Date(kickoff);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const getStatusInfo = (match) => {
    if (match.status === 'completed') {
        return {
            label: match.homeScore !== undefined ? `${match.homeScore} – ${match.awayScore}` : 'COMPLETED',
            bg: 'rgba(76, 175, 80, 0.15)',
            color: '#4CAF50'
        };
    }
    if (match.status === 'closed') {
        const liveText = match.liveElapsed !== undefined ? `LIVE (${match.liveElapsed}')` : 'LIVE / IN PROGRESS';
        const scoreText = (match.homeScore !== undefined && match.awayScore !== undefined) ? ` · ${match.homeScore}–${match.awayScore}` : '';
        return {
            label: `${liveText}${scoreText}`,
            bg: 'rgba(244, 67, 54, 0.15)',
            color: '#F44336'
        };
    }
    // upcoming
    return {
        label: 'OPEN',
        bg: 'rgba(255, 193, 7, 0.15)',
        color: 'var(--accent-gold)'
    };
};

export default function WorldCup() {
    const { user, refreshBalance } = useAuth();
    const [matches, setMatches] = useState([]);
    const [bets, setBets] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    const [stake, setStake] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [tab, setTab] = useState('matches');
    const [filter, setFilter] = useState('upcoming'); // 'upcoming', 'closed', 'completed', 'all'

    const fetchMatches = async () => {
        try {
            const res = await axios.get('/api/worldcup/matches');
            setMatches(res.data);
        } catch (err) {
            console.error('Failed to fetch matches:', err);
        }
    };

    const fetchMyBets = async () => {
        if (!user) return;
        try {
            const res = await axios.get('/api/worldcup/my-bets', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setBets(res.data);
        } catch (err) {
            console.error('Failed to fetch bets:', err);
        }
    };

    useEffect(() => {
        fetchMatches();
        fetchMyBets();
        const interval = setInterval(() => {
            fetchMatches();
            fetchMyBets();
        }, 15000);
        return () => clearInterval(interval);
    }, [user]);

    const selectBet = (match, outcome) => {
        if (match.status !== 'upcoming') return;
        setSelectedMatch(match);
        setSelectedOutcome(outcome);
        setMessage(null);
    };

    const handlePlaceBet = async () => {
        if (!user) {
            setMessage({ type: 'error', text: 'You must be logged in to place a bet.' });
            return;
        }
        if (!selectedMatch || !selectedOutcome) return;
        const stakeVal = parseFloat(stake);
        if (isNaN(stakeVal) || stakeVal <= 0) {
            setMessage({ type: 'error', text: 'Please enter a valid stake amount.' });
            return;
        }

        setLoading(true);
        setMessage(null);
        try {
            const res = await axios.post('/api/worldcup/bet', {
                matchId: selectedMatch.id,
                betType: selectedOutcome,
                stake: stakeVal
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            if (res.data.success) {
                sounds.betPlace();
                setMessage({ type: 'success', text: 'Bet placed successfully!' });
                setStake('');
                setSelectedMatch(null);
                setSelectedOutcome(null);
                refreshBalance();
                fetchMyBets();
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to place bet.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSimulate = async (matchId) => {
        try {
            const res = await axios.post('/api/admin/worldcup/simulate', { matchId }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.data.success) {
                sounds.win();
                fetchMatches();
                fetchMyBets();
                refreshBalance();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Simulation failed');
        }
    };

    const handleRefreshOdds = async () => {
        try {
            await axios.post('/api/admin/worldcup/refresh-odds', {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchMatches();
        } catch (err) {
            alert(err.response?.data?.error || 'Refresh failed');
        }
    };

    const getOdds = () => {
        if (!selectedMatch || !selectedOutcome) return 0;
        if (selectedOutcome === 'home') return selectedMatch.homeOdds;
        if (selectedOutcome === 'draw') return selectedMatch.drawOdds;
        return selectedMatch.awayOdds;
    };
    const potentialPayout = parseFloat(stake) > 0 ? (parseFloat(stake) * getOdds()).toFixed(2) : '0.00';

    // Filter matches
    const filteredMatches = matches.filter(m => {
        if (filter === 'all') return true;
        if (filter === 'upcoming') return m.status === 'upcoming';
        if (filter === 'closed') return m.status === 'closed';
        if (filter === 'completed') return m.status === 'completed';
        return true;
    });

    // Count matches per status
    const upcomingCount = matches.filter(m => m.status === 'upcoming').length;
    const closedCount = matches.filter(m => m.status === 'closed').length;
    const completedCount = matches.filter(m => m.status === 'completed').length;

    // Check if any match has live odds
    const hasLiveOdds = matches.some(m => m.oddsSource === 'live');

    return (
        <>
            <div className="worldcup-container-bg" />
            <div className="worldcup-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
            {/* Header Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(30, 30, 30, 0.8) 100%)',
                borderRadius: '16px',
                border: '1px solid rgba(76, 175, 80, 0.3)',
                padding: '24px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '12px',
                        background: 'rgba(76, 175, 80, 0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(76, 175, 80, 0.4)'
                    }}>
                        <Trophy size={32} color="#4CAF50" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '0.5px' }}>
                            FIFA WORLD CUP 2026
                        </h1>
                        <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {hasLiveOdds ? (
                                <>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#4CAF50',
                                        padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold'
                                    }}>
                                        <Zap size={10} /> LIVE ODDS
                                    </span>
                                    Real bookmaker odds • Updated automatically
                                </>
                            ) : (
                                'Bet on World Cup matches using your gems!'
                            )}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {user?.role === 'admin' && (
                        <button
                            onClick={handleRefreshOdds}
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', fontSize: '13px' }}
                        >
                            <TrendingUp size={14} /> Refresh Odds
                        </button>
                    )}
                    <button
                        onClick={fetchMatches}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', fontSize: '13px' }}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {/* Layout Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: selectedMatch ? '1fr 340px' : '1fr',
                gap: '24px',
                alignItems: 'start'
            }}>
                {/* Left: Main Content */}
                <div>
                    {/* Navigation Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setTab('matches')}
                            style={{
                                padding: '12px 24px', background: 'none', border: 'none',
                                color: tab === 'matches' ? 'var(--accent-gold)' : '#aaa',
                                borderBottom: tab === 'matches' ? '2px solid var(--accent-gold)' : 'none',
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                            }}
                        >
                            Matches
                        </button>
                        <button
                            onClick={() => setTab('history')}
                            style={{
                                padding: '12px 24px', background: 'none', border: 'none',
                                color: tab === 'history' ? 'var(--accent-gold)' : '#aaa',
                                borderBottom: tab === 'history' ? '2px solid var(--accent-gold)' : 'none',
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                            }}
                        >
                            My Bets {bets.length > 0 && <span style={{ color: '#888', fontSize: '12px' }}>({bets.length})</span>}
                        </button>
                    </div>

                    {tab === 'matches' ? (
                        <>
                            {/* Filter Chips */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                {[
                                    { key: 'upcoming', label: `Open (${upcomingCount})`, icon: '🟢' },
                                    { key: 'closed', label: `In Progress (${closedCount})`, icon: '🔴' },
                                    { key: 'completed', label: `Completed (${completedCount})`, icon: '✅' },
                                    { key: 'all', label: `All (${matches.length})`, icon: '📋' },
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        style={{
                                            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            border: filter === f.key ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)',
                                            backgroundColor: filter === f.key ? 'rgba(255,193,7,0.1)' : 'rgba(255,255,255,0.02)',
                                            color: filter === f.key ? 'var(--accent-gold)' : '#999'
                                        }}
                                    >
                                        {f.icon} {f.label}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {filteredMatches.length === 0 && (
                                    <div style={{ textAlign: 'center', color: '#555', padding: '40px' }}>
                                        No matches in this category.
                                    </div>
                                )}
                                {filteredMatches.map(match => {
                                    const canBet = match.status === 'upcoming';
                                    const statusInfo = getStatusInfo(match);
                                    
                                    return (
                                        <div key={match.id} style={{
                                            backgroundColor: 'var(--bg-panel)',
                                            borderRadius: '12px',
                                            border: canBet ? '1px solid rgba(76, 175, 80, 0.15)' : '1px solid rgba(255,255,255,0.05)',
                                            padding: '16px 20px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            position: 'relative',
                                            opacity: match.status === 'completed' ? 0.7 : 1,
                                            transition: 'all 0.2s'
                                        }}>
                                            {/* Top Row Info */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#888', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Calendar size={12} />
                                                    <span>{match.stage} • {formatKickoff(match.kickoff)}</span>
                                                    {match.oddsSource === 'live' && (
                                                        <span style={{
                                                            backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                                            color: '#4CAF50',
                                                            padding: '1px 6px', borderRadius: '8px',
                                                            fontSize: '10px', fontWeight: 'bold',
                                                            display: 'inline-flex', alignItems: 'center', gap: '3px'
                                                        }}>
                                                            <Zap size={8} /> LIVE
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{
                                                    backgroundColor: statusInfo.bg,
                                                    color: statusInfo.color,
                                                    padding: '2px 10px', borderRadius: '4px',
                                                    fontSize: '11px', fontWeight: 'bold'
                                                }}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>

                                            {/* Teams and Odds Grid */}
                                            <div className="wc-teams-grid" style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto 1fr',
                                                alignItems: 'center',
                                                gap: '16px',
                                                padding: '12px 0'
                                            }}>
                                                {/* Home Team */}
                                                <div className="wc-team wc-team-home" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '32px' }}>{getFlag(match.home)}</span>
                                                    <div>
                                                        <span style={{ fontSize: '16px', fontWeight: 'bold', display: 'block' }}>{match.home}</span>
                                                        {match.homeScore !== undefined && (
                                                            <span style={{ fontSize: '20px', fontWeight: '900', color: match.winner === 'home' ? '#4CAF50' : (match.status === 'closed' ? '#fff' : '#888') }}>
                                                                {match.homeScore}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* VS Indicator */}
                                                <div className="wc-vs" style={{
                                                    fontSize: '13px', fontWeight: 'bold', color: '#666',
                                                    backgroundColor: '#111', padding: '4px 10px', borderRadius: '20px',
                                                    textAlign: 'center'
                                                }}>
                                                    {match.status === 'completed' ? 'FT' : 'VS'}
                                                </div>

                                                {/* Away Team */}
                                                <div className="wc-team wc-team-away" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                                                    <div style={{ textAlign: 'right' }} className="wc-team-name-score">
                                                        <span style={{ fontSize: '16px', fontWeight: 'bold', display: 'block' }}>{match.away}</span>
                                                        {match.awayScore !== undefined && (
                                                            <span style={{ fontSize: '20px', fontWeight: '900', color: match.winner === 'away' ? '#4CAF50' : (match.status === 'closed' ? '#fff' : '#888') }}>
                                                                {match.awayScore}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '32px' }}>{getFlag(match.away)}</span>
                                                </div>
                                            </div>

                                            {/* Odds Selection Row */}
                                            <div className="wc-odds-row" style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: '12px',
                                                marginTop: '4px'
                                            }}>
                                                {[
                                                    { type: 'home', label: `${match.home} Win`, odds: match.homeOdds },
                                                    { type: 'draw', label: 'Draw', odds: match.drawOdds },
                                                    { type: 'away', label: `${match.away} Win`, odds: match.awayOdds }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.type}
                                                        disabled={!canBet}
                                                        onClick={() => selectBet(match, opt.type)}
                                                        style={{
                                                            backgroundColor: selectedMatch?.id === match.id && selectedOutcome === opt.type
                                                                ? 'rgba(76, 175, 80, 0.2)'
                                                                : (match.status === 'completed' && match.winner === opt.type
                                                                    ? 'rgba(76, 175, 80, 0.1)'
                                                                    : 'rgba(255,255,255,0.02)'),
                                                            border: selectedMatch?.id === match.id && selectedOutcome === opt.type
                                                                ? '1px solid #4CAF50'
                                                                : (match.status === 'completed' && match.winner === opt.type
                                                                    ? '1px solid rgba(76, 175, 80, 0.3)'
                                                                    : '1px solid rgba(255,255,255,0.05)'),
                                                            padding: '12px', borderRadius: '8px',
                                                            cursor: canBet ? 'pointer' : 'default',
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                            gap: '4px', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '11px', color: '#888' }}>{opt.label}</span>
                                                        <span style={{
                                                            fontSize: '15px', fontWeight: 'bold',
                                                            color: match.status === 'completed' && match.winner === opt.type
                                                                ? '#4CAF50'
                                                                : 'var(--accent-gold)'
                                                        }}>
                                                            {opt.odds.toFixed(2)}
                                                        </span>
                                                        {match.status === 'completed' && match.winner === opt.type && (
                                                            <span style={{ fontSize: '9px', color: '#4CAF50', fontWeight: 'bold' }}>✓ WINNER</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Admin controls */}
                                            {user?.role === 'admin' && match.status !== 'completed' && (
                                                <div style={{
                                                    borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px', paddingTop: '12px',
                                                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px'
                                                }}>
                                                    <span style={{ fontSize: '11px', color: '#ff6b35', fontWeight: 'bold' }}>Admin:</span>
                                                    <button
                                                        onClick={() => handleSimulate(match.id)}
                                                        className="btn-primary"
                                                        style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '6px' }}
                                                    >
                                                        ⚡ Simulate Result
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        // History Tab
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {bets.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#555', padding: '40px' }}>
                                    No bets placed yet.
                                </div>
                            ) : (
                                bets.map(bet => {
                                    const isPending = bet.status === 'pending';
                                    const isWon = bet.status === 'won';
                                    return (
                                        <div key={bet.id} style={{
                                            backgroundColor: 'var(--bg-panel)',
                                            border: isWon
                                                ? '1px solid rgba(76, 175, 80, 0.2)'
                                                : '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: '10px',
                                            padding: '12px 18px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '12px'
                                        }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>
                                                        {getFlag(bet.home_team)} {bet.home_team} vs {bet.away_team} {getFlag(bet.away_team)}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#888' }}>
                                                    Bet: <span style={{ color: '#fff', fontWeight: '500' }}>{bet.bet_type.toUpperCase()}</span> @ <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>{bet.odds.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '11px', color: '#888' }}>Stake</div>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>💎 {bet.stake.toFixed(2)}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '11px', color: '#888' }}>{isWon ? 'Payout' : 'Potential'}</div>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: isWon ? 'var(--accent-green)' : '#fff' }}>
                                                        💎 {isWon ? bet.payout.toFixed(2) : (bet.stake * bet.odds).toFixed(2)}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    backgroundColor: isPending ? 'rgba(255,193,7,0.15)' : (isWon ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)'),
                                                    color: isPending ? 'var(--accent-gold)' : (isWon ? '#4CAF50' : '#F44336'),
                                                    padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                                                }}>
                                                    {bet.status.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Right Sidebar: Bet Slip */}
                {selectedMatch && (
                    <div style={{
                        backgroundColor: 'var(--bg-panel)',
                        borderRadius: '12px',
                        border: '1px solid rgba(76, 175, 80, 0.3)',
                        padding: '20px',
                        position: 'sticky',
                        top: '24px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff' }}>BET SLIP</span>
                            <button
                                onClick={() => { setSelectedMatch(null); setSelectedOutcome(null); setMessage(null); }}
                                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '18px' }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Match Details */}
                        <div style={{ marginBottom: '16px', fontSize: '13px', color: '#ccc' }}>
                            <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                                {getFlag(selectedMatch.home)} {selectedMatch.home} vs {selectedMatch.away} {getFlag(selectedMatch.away)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                                {selectedMatch.stage} • {formatKickoff(selectedMatch.kickoff)}
                            </div>
                        </div>

                        {/* Selection & Odds */}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px'
                        }}>
                            <div>
                                <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>Selection</span>
                                <span style={{ fontWeight: 'bold', color: '#fff' }}>
                                    {selectedOutcome === 'home' ? selectedMatch.home : (selectedOutcome === 'away' ? selectedMatch.away : 'Draw')}
                                </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>Odds</span>
                                <span style={{ fontWeight: '900', color: 'var(--accent-gold)', fontSize: '16px' }}>{getOdds().toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Stake Input */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '8px', fontWeight: '500' }}>
                                Bet Amount (Gems)
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="number"
                                    placeholder="Enter stake..."
                                    value={stake}
                                    onChange={e => setStake(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px',
                                        backgroundColor: '#0a0a0a',
                                        border: '1px solid #333',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '14px',
                                        outline: 'none',
                                        paddingRight: '90px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '4px', position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)' }}>
                                    {[5, 10, 50].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setStake(String(val))}
                                            style={{ backgroundColor: '#222', border: '1px solid #444', borderRadius: '4px', color: '#ccc', fontSize: '10px', padding: '3px 6px', cursor: 'pointer' }}
                                        >{val}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Estimated Payout */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', fontSize: '14px' }}>
                            <span style={{ color: '#aaa' }}>Potential Payout:</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>💎 {potentialPayout} Gems</span>
                        </div>

                        {/* Message Banner */}
                        {message && (
                            <div style={{
                                display: 'flex', gap: '8px', alignItems: 'center',
                                backgroundColor: message.type === 'success' ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                                color: message.type === 'success' ? '#4CAF50' : '#F44336',
                                padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px'
                            }}>
                                <AlertCircle size={14} />
                                <span>{message.text}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            onClick={handlePlaceBet}
                            disabled={loading}
                            className="btn-primary"
                            style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }}
                        >
                            {loading ? 'Placing Bet...' : 'PLACE BET'}
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile Bet Slip Info & Background Style */}
            <style>{`
                /* Static Background on PC, hidden on mobile */
                @media (min-width: 769px) {
                    .worldcup-container-bg {
                        background-image: url('/transfers/A8D32192-6C18-41FD-A61C-FA916BDDD279.png');
                        background-attachment: fixed;
                        background-position: center;
                        background-repeat: no-repeat;
                        background-size: cover;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: -1;
                    }
                }
                
                @media (max-width: 768px) {
                    .worldcup-container > div:nth-child(2) {
                        grid-template-columns: 1fr !important;
                    }
                }

                @media (max-width: 600px) {
                    .wc-teams-grid {
                        grid-template-columns: 1fr !important;
                        gap: 12px !important;
                        padding: 8px 0 !important;
                    }
                    .wc-team {
                        justify-content: center !important;
                        text-align: center !important;
                        gap: 8px !important;
                    }
                    .wc-team-home {
                        flex-direction: column !important;
                    }
                    .wc-team-away {
                        flex-direction: column-reverse !important;
                    }
                    .wc-team-name-score {
                        text-align: center !important;
                    }
                    .wc-vs {
                        margin: 0 auto !important;
                        width: fit-content !important;
                    }
                    .wc-odds-row {
                        grid-template-columns: 1fr !important;
                        gap: 8px !important;
                    }
                }
            `}</style>
        </div>
        </>
    );
}
