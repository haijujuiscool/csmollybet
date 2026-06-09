import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Calendar, ShieldAlert } from 'lucide-react';

export default function AgeVerificationModal() {
    const { user, setUser } = useAuth();
    const [dob, setDob] = useState('');
    const [accepted, setAccepted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // If user is not logged in or has already completed verification, do not render modal
    if (!user || user.accepted_tos) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!dob) {
            setError('Please enter your date of birth.');
            return;
        }

        // Quick frontend verification
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 18) {
            setError('You must be at least 18 years old to access csmolly.bet.');
            return;
        }

        if (!accepted) {
            setError('You must accept the Terms of Service and Privacy Policy.');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/user/verify-age', {
                dob,
                acceptedTos: accepted
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update user in context with the updated fields
            setUser(prev => ({
                ...prev,
                date_of_birth: dob,
                accepted_tos: 1
            }));
        } catch (err) {
            setError(err.response?.data?.error || 'Verification failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 999999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                background: 'var(--bg-panel)',
                padding: '40px',
                borderRadius: '24px',
                maxWidth: '500px',
                width: '90%',
                border: '1px solid rgba(255, 193, 7, 0.2)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 30px rgba(255, 193, 7, 0.05)',
                textAlign: 'center'
            }}>
                <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', backgroundColor: 'rgba(255, 193, 7, 0.1)', color: 'var(--accent-gold)', marginBottom: '20px' }}>
                    <ShieldAlert size={48} />
                </div>

                <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '15px', color: '#fff' }}>
                    Age Verification Required
                </h2>

                <p style={{ color: '#aaa', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '25px' }}>
                    To comply with legal requirements and keep csmolly.bet safe, you must verify that you are at least 18 years old and agree to our policies.
                </p>

                {error && (
                    <div style={{
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        border: '1px solid var(--accent-red)',
                        color: 'var(--accent-red)',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        fontSize: '0.9rem',
                        textAlign: 'left'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#ccc', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            Date of Birth
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="date" 
                                value={dob} 
                                onChange={(e) => setDob(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                className="input-field" 
                                style={{ margin: 0, paddingLeft: '40px' }}
                                required
                            />
                            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: '#888' }} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '25px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <input 
                            type="checkbox" 
                            id="terms-checkbox" 
                            checked={accepted} 
                            onChange={(e) => setAccepted(e.target.checked)}
                            style={{ marginTop: '4px', cursor: 'pointer', width: '16px', height: '16px' }}
                            required
                        />
                        <label htmlFor="terms-checkbox" style={{ color: '#aaa', fontSize: '0.85rem', lineHeight: '1.4', cursor: 'pointer' }}>
                            I confirm that I am at least 18 years of age and agree to the <Link to="/terms" target="_blank" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Terms of Service</Link> and <Link to="/terms" target="_blank" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Privacy Policy</Link>.
                        </label>
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '10px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 15px rgba(255, 193, 7, 0.3)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Processing...' : 'Complete Verification'}
                    </button>
                </form>
            </div>
        </div>
    );
}
