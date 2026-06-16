import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Gift, Check, X, Loader2, Download, Shield, User, Gamepad2, RefreshCw, Sparkles } from 'lucide-react';
import RouletteSpinner from '../components/RouletteSpinner';

export default function FreeDailyCase() {
    const { user, loading: authLoading, refreshBalance } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [checks, setChecks] = useState(null);
    const [checking, setChecking] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [transfers, setTransfers] = useState([]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        loadStatus();
    }, [user, authLoading]);

    useEffect(() => {
        axios.get('/api/transfers').then(res => setTransfers(res.data || [])).catch(() => {});
    }, []);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/api/daily-case/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatus(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load status');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckRequirements = async () => {
        setChecking(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/daily-case/check-requirements', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChecks(res.data.checks);
            if (res.data.allMet) {
                setError('');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to check requirements');
        } finally {
            setChecking(false);
        }
    };

    const handleClaim = async () => {
        setClaiming(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/daily-case/claim', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResult({
                wonItem: res.data.wonItem,
                items: res.data.items,
                caseName: res.data.caseName,
                isWelcome: res.data.isWelcome,
                phase: 'spinning'
            });
            setTimeout(() => {
                setResult(prev => prev ? { ...prev, phase: 'done' } : null);
                setClaiming(false);
                refreshBalance();
                loadStatus();
            }, 6000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to open case');
            setClaiming(false);
        }
    };

    const RequirementRow = ({ icon: Icon, label, met, loading }) => (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px',
            background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
            border: met ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid rgba(255,255,255,0.06)'
        }}>
            <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: met ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255,255,255,0.05)',
                color: met ? 'var(--accent-green)' : '#666'
            }}>
                <Icon size={20} />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#e0e0e0' }}>{label}</div>
            </div>
            <div>
                {met === null || met === undefined ? (
                    <span style={{ color: '#666', fontSize: '12px' }}>—</span>
                ) : met ? (
                    <div style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                        <Check size={16} /> Done
                    </div>
                ) : (
                    <div style={{ color: '#f44336', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                        <X size={16} /> Missing
                    </div>
                )}
            </div>
        </div>
    );

    const canOpen = checks && checks.username && checks.pfp && checks.ownsCs2;

    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const transferImages = transfers.filter(f => imageExts.some(ext => f.name.toLowerCase().endsWith(ext)) && f.name.toLowerCase() !== 'a8d32192-6c18-41fd-a61c-fa916bddd279.png');
    const leftBgImage = transfers.find(f => f.name.toLowerCase() === 'kskdaily.png');
    const bgImage = transferImages.find(f => f.name.toLowerCase() !== 'kskdaily.png') || transferImages[0];
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <>
        <style>{`footer { position: relative !important; z-index: 10 !important; }`}</style>
        <div style={{
            position: 'relative',
            margin: '0 auto',
            width: '100%',
            maxWidth: '1400px',
            padding: '20px',
            ...(isDesktop
                ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '450px' }
                : { maxWidth: '720px', minHeight: '100%' }
            )
        }}>
            <div style={{ position: 'relative', zIndex: 1, width: isDesktop ? '100%' : undefined, maxWidth: isDesktop ? '600px' : undefined }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(255, 107, 53, 0.3)'
                }}>
                    <Gift size={32} color="#000" />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Free Daily Case</h1>
                {status && (
                    <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
                        {status.welcomeCases > 0
                            ? `You have ${status.welcomeCases} welcome case${status.welcomeCases > 1 ? 's' : ''} available`
                            : status.canClaimDaily
                            ? 'Your daily case is ready!'
                            : status.nextClaimTime
                            ? `Next case available at ${new Date(status.nextClaimTime).toLocaleString()}`
                            : 'Check back tomorrow for your next case'}
                    </p>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#666' }} />
                </div>
            ) : (
                <>
                    {/* Skip requirements if welcome cases available */}
                    {status?.welcomeCases > 0 ? (
                        <>
                            <div style={{
                                padding: '20px', background: 'rgba(76,175,80,0.08)', borderRadius: '14px',
                                border: '1px solid rgba(76,175,80,0.2)', marginBottom: '20px', textAlign: 'center'
                            }}>
                                <Sparkles size={28} style={{ color: 'var(--accent-gold)', marginBottom: '8px' }} />
                                <div style={{ fontSize: '15px', color: '#ccc', marginBottom: '4px' }}>
                                    You have <strong style={{ color: 'var(--accent-gold)' }}>{status.welcomeCases}</strong> welcome case{status.welcomeCases > 1 ? 's' : ''} — no requirements needed!
                                </div>
                                <div style={{ fontSize: '12px', color: '#888' }}>Just click below to open one.</div>
                            </div>
                            <button onClick={handleClaim} disabled={claiming}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '12px',
                                    background: claiming ? '#555' : 'linear-gradient(135deg, #4CAF50, #66BB6A)',
                                    color: '#fff', fontWeight: 800, fontSize: '16px',
                                    border: 'none', cursor: claiming ? 'wait' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                    boxShadow: claiming ? 'none' : '0 4px 20px rgba(76,175,80,0.4)',
                                    marginBottom: '20px'
                                }}
                            >
                                {claiming ? (
                                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    <Sparkles size={20} />
                                )}
                                {claiming ? 'Opening...' : 'Open Welcome Case'}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Requirements */}
                            <div style={{
                                background: 'rgba(30, 30, 30, 0.6)', borderRadius: '14px',
                                padding: '24px', border: '1px solid rgba(255,255,255,0.06)',
                                marginBottom: '20px'
                            }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ccc', margin: '0 0 16px' }}>Requirements</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <RequirementRow icon={User} label='Steam username must include "csmolly.bet"' met={checks?.username} />
                                    <RequirementRow icon={Shield} label='Steam profile picture must match' met={checks?.pfp} />
                                    <RequirementRow icon={Gamepad2} label='You must own CS2 on Steam' met={checks?.ownsCs2} />
                                </div>

                                <div style={{
                                    marginTop: '16px', padding: '14px', background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex', alignItems: 'center', gap: '16px'
                                }}>
                                    <img src="/pfp.png" alt="Required PFP" style={{
                                        width: '56px', height: '56px', borderRadius: '50%',
                                        objectFit: 'cover', border: '2px solid #FF6B35'
                                    }} onError={(e) => { e.target.style.display = 'none'; }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ccc', marginBottom: '2px' }}>Required Profile Picture</div>
                                        <div style={{ fontSize: '11px', color: '#666' }}>Download and set this as your Steam avatar</div>
                                    </div>
                                    <a href="/pfp.png" download
                                        style={{
                                            padding: '8px 16px', background: 'rgba(255,107,53,0.15)', color: '#FF6B35',
                                            borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                                            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                                            border: '1px solid rgba(255,107,53,0.3)', cursor: 'pointer'
                                        }}
                                    >
                                        <Download size={14} /> Download
                                    </a>
                                </div>
                            </div>

                            {/* Check Requirements Button */}
                            <button onClick={handleCheckRequirements} disabled={checking}
                                style={{
                                    width: '100%', padding: '14px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                                    color: '#000', fontWeight: 700, fontSize: '15px',
                                    border: 'none', cursor: checking ? 'wait' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    marginBottom: '16px', opacity: checking ? 0.7 : 1
                                }}
                            >
                                {checking ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={18} />}
                                {checking ? 'Checking...' : 'Check Requirements'}
                            </button>
                        </>
                    )}

                    {error && (
                        <div style={{
                            padding: '12px 16px', background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.3)',
                            borderRadius: '10px', color: '#f44336', fontSize: '13px', marginBottom: '16px'
                        }}>
                            {error}
                        </div>
                    )}

                </>
            )}
            </div>

            {isDesktop && leftBgImage && (
                <div style={{
                    position: 'absolute',
                    bottom: status?.welcomeCases > 0 ? '-105px' : '-35px',
                    left: '-45px',
                    width: '55.7%',
                    maxWidth: '743px',
                    zIndex: 0,
                    pointerEvents: 'none'
                }}>
                    <img src={leftBgImage.url} alt=""
                        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '12px' }}
                    />
                </div>
            )}

            {isDesktop && bgImage && (
                <div style={{
                    position: 'absolute',
                    bottom: status?.welcomeCases > 0 ? '-105px' : '-35px',
                    right: '-295px',
                    width: '90%',
                    maxWidth: '1200px',
                    zIndex: 0,
                    pointerEvents: 'none'
                }}>
                    <img src={bgImage.url} alt=""
                        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '12px' }}
                    />
                </div>
            )}

            {!isDesktop && bgImage && (
                <div style={{
                    position: 'absolute',
                    bottom: '-50px',
                    left: 0,
                    width: '100%',
                    zIndex: 0,
                    pointerEvents: 'none'
                }}>
                    <img src={bgImage.url} alt=""
                        style={{ width: '100%', borderRadius: '12px', display: 'block' }}
                    />
                </div>
            )}

            {/* Opening Modal */}
            {result && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => { if (result.phase === 'done') { setResult(null); } }}>
                    <div style={{
                        background: '#1a1a1a', borderRadius: '16px', padding: '40px',
                        border: '1px solid #333', width: '600px', maxWidth: '90vw', textAlign: 'center'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: 'var(--accent-gold)', marginBottom: '20px', fontSize: '22px' }}>
                            {result.isWelcome ? 'Welcome Case' : 'Daily Case'}
                        </h2>
                        <div style={{ margin: '30px 0' }}>
                            <RouletteSpinner
                                currentRoll={result.wonItem}
                                currentCaseItems={result.items}
                                isMythicSpin={false}
                                casePrice={0}
                                large={true}
                            />
                        </div>
                        {result.phase === 'done' && (
                            <div>
                                <div style={{ fontSize: '16px', marginBottom: '8px', color: '#aaa' }}>You won:</div>
                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                                    padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px'
                                }}>
                                    {result.wonItem.image_url && (
                                        <img src={result.wonItem.image_url} alt={result.wonItem.name}
                                            style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                                    )}
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
                                        {result.wonItem.name}
                                    </div>
                                    <div style={{ fontSize: '24px', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                        +{result.wonItem.value.toFixed(2)} Gems
                                    </div>
                                </div>
                                <button
                                    className="btn-primary"
                                    style={{ marginTop: '20px', padding: '14px 40px', fontSize: '15px' }}
                                    onClick={() => { setResult(null); }}
                                >
                                    Nice!
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
