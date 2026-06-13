import { useState, useEffect } from 'react';
import { Gift, X, Check, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function WelcomeCaseModal({ user, onClose, refreshBalance }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showInput, setShowInput] = useState(false);
    const [done, setDone] = useState(false);
    const [message, setMessage] = useState('');

    if (!user || user.onboarding_done || done) return null;

    const handleSkip = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/user/skip-referral', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setDone(true);
            refreshBalance();
        } catch (err) {
            setError(err.response?.data?.error || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitCode = async () => {
        if (!code.trim()) return;
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/user/referral-code', { code: code.trim() }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setDone(true);
            refreshBalance();
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: '#1a1a1a', borderRadius: '20px', padding: '40px',
                border: '1px solid #333', width: '460px', maxWidth: '100%',
                textAlign: 'center', position: 'relative'
            }}>
                <button
                    onClick={handleSkip}
                    style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: 'none', border: 'none', color: '#666',
                        cursor: 'pointer', padding: '4px'
                    }}
                >
                    <X size={20} />
                </button>

                <div style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px'
                }}>
                    <Gift size={36} color="#000" />
                </div>

                <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>
                    Welcome to CSMOLLY.BET
                </h2>
                <p style={{ color: '#999', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
                    {done
                        ? message
                        : 'Get free welcome cases to start your journey. Enter a referral code or use the default code.'}

                </p>

                {done ? (
                    <button
                        className="btn-primary"
                        style={{ padding: '12px 32px', fontSize: '14px', fontWeight: 700 }}
                        onClick={onClose}
                    >
                        <Check size={16} style={{ marginRight: '6px' }} />
                        Let's Go!
                    </button>
                ) : showInput ? (
                    <div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                            <input
                                type="text"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="Enter referral code"
                                style={{
                                    flex: 1, padding: '12px 16px', borderRadius: '10px',
                                    background: '#111', border: '1px solid #333',
                                    color: '#fff', fontSize: '14px', outline: 'none'
                                }}
                                onKeyDown={e => e.key === 'Enter' && handleSubmitCode()}
                            />
                            <button
                                onClick={handleSubmitCode}
                                disabled={loading || !code.trim()}
                                style={{
                                    padding: '12px 20px', borderRadius: '10px',
                                    background: loading ? '#555' : 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                                    color: '#000', fontWeight: 700, border: 'none',
                                    cursor: loading ? 'wait' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                                Apply
                            </button>
                        </div>
                        {error && (
                            <p style={{ color: '#f44336', fontSize: '12px', margin: '0 0 12px' }}>{error}</p>
                        )}
                        <button
                            onClick={() => setShowInput(false)}
                            style={{
                                background: 'none', border: 'none', color: '#888',
                                fontSize: '13px', cursor: 'pointer', textDecoration: 'underline'
                            }}
                        >
                            Back
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                            onClick={handleSkip}
                            disabled={loading}
                            style={{
                                padding: '14px 24px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #4CAF50, #66BB6A)',
                                color: '#fff', fontWeight: 700, fontSize: '14px',
                                border: 'none', cursor: loading ? 'wait' : 'pointer',
                                boxShadow: '0 4px 16px rgba(76,175,80,0.3)'
                            }}
                        >
                            Use Code "molotov" — Get 2 Free Cases
                        </button>
                        <button
                            onClick={() => setShowInput(true)}
                            style={{
                                padding: '14px 24px', borderRadius: '12px',
                                background: 'rgba(255,255,255,0.06)',
                                color: '#ccc', fontWeight: 600, fontSize: '14px',
                                border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer'
                            }}
                        >
                            Enter a Referral Code — Get 3 Free Cases
                        </button>
                        <button
                            onClick={handleSkip}
                            style={{
                                background: 'none', border: 'none',
                                color: '#666', fontSize: '12px', cursor: 'pointer',
                                padding: '8px', textDecoration: 'underline'
                            }}
                        >
                            Skip for now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
