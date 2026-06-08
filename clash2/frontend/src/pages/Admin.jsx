import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Ban, Check, X, AlertTriangle } from 'lucide-react';

export default function Admin() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchAdminData();
        }
    }, [user]);

    const fetchAdminData = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [usersRes, withdrawalsRes] = await Promise.all([
                axios.get('/api/admin/users', { headers }),
                axios.get('/api/admin/withdrawals', { headers })
            ]);

            setUsers(usersRes.data);
            setWithdrawals(withdrawalsRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch admin statistics');
        } finally {
            setLoading(false);
        }
    };

    const handleBanUser = async (userId, currentBanStatus) => {
        const actionText = currentBanStatus ? 'unban' : 'ban';
        if (!confirm(`Are you sure you want to ${actionText} this user?`)) return;

        setError('');
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post('/api/admin/ban', { userId, ban: !currentBanStatus }, { headers });
            setMessage(`Successfully ${currentBanStatus ? 'unbanned' : 'banned'} user.`);
            fetchAdminData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update ban status');
        }
    };

    const handleWithdrawalAction = async (withdrawalId, action) => {
        if (!confirm(`Are you sure you want to ${action} this withdrawal?`)) return;

        setError('');
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post('/api/admin/withdrawals/action', { withdrawalId, action }, { headers });
            setMessage(`Withdrawal request successfully ${action}d.`);
            fetchAdminData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to process withdrawal action');
        }
    };

    if (!user || user.role !== 'admin') {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-red)' }}>
                <Shield size={64} style={{ marginBottom: '20px' }} />
                <h2>ACCESS DENIED</h2>
                <p style={{ color: '#aaa', marginTop: '10px' }}>You must be signed in as an administrator to view this page.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <Shield size={36} style={{ color: 'var(--accent-gold)' }} />
                <span>Admin Management Panel</span>
            </h1>

            {error && (
                <div style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            {message && (
                <div style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    {message}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>Loading admin data...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
                    {/* Pending Withdrawals */}
                    <div style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-gold)' }}>
                            ⏳ Pending Withdrawal Requests ({withdrawals.filter(w => w.status === 'pending_review').length})
                        </h2>

                        {withdrawals.filter(w => w.status === 'pending_review').length === 0 ? (
                            <p style={{ color: '#888', fontStyle: 'italic' }}>No pending withdrawal requests found.</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', color: '#888' }}>
                                            <th style={{ padding: '12px' }}>User</th>
                                            <th style={{ padding: '12px' }}>Item</th>
                                            <th style={{ padding: '12px' }}>Value</th>
                                            <th style={{ padding: '12px' }}>Requested At</th>
                                            <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {withdrawals.filter(w => w.status === 'pending_review').map(w => (
                                            <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle' }}>
                                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{w.username}</td>
                                                <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {w.image_url && <img src={w.image_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '4px', background: '#121212', objectFit: 'contain' }} />}
                                                    <span>{w.item_name}</span>
                                                </td>
                                                <td style={{ padding: '12px', color: 'var(--accent-green)', fontWeight: 'bold' }}>💎 {w.item_value.toFixed(2)}</td>
                                                <td style={{ padding: '12px', color: '#aaa', fontSize: '0.9rem' }}>{new Date(w.created_at).toLocaleString()}</td>
                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                                        <button 
                                                            onClick={() => handleWithdrawalAction(w.id, 'approve')} 
                                                            className="btn-primary" 
                                                            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--accent-green)', color: '#fff' }}
                                                        >
                                                            <Check size={14} /> Approve
                                                        </button>
                                                        <button 
                                                            onClick={() => handleWithdrawalAction(w.id, 'decline')} 
                                                            className="btn-secondary" 
                                                            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                                                        >
                                                            <X size={14} /> Decline (Refund)
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Users Management */}
                    <div style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: 'var(--accent-gold)' }}>
                            👥 Registered Users Management ({users.length})
                        </h2>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', color: '#888' }}>
                                        <th style={{ padding: '12px' }}>Username</th>
                                        <th style={{ padding: '12px' }}>Steam ID</th>
                                        <th style={{ padding: '12px' }}>Gems Balance</th>
                                        <th style={{ padding: '12px' }}>Role</th>
                                        <th style={{ padding: '12px' }}>Status</th>
                                        <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{u.username}</td>
                                            <td style={{ padding: '12px', color: '#aaa', fontSize: '0.9rem' }}>{u.steamid}</td>
                                            <td style={{ padding: '12px', color: 'var(--accent-green)' }}>💎 {(Math.floor(u.gems * 100) / 100).toFixed(2)}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{ 
                                                    padding: '4px 8px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 'bold',
                                                    backgroundColor: u.role === 'admin' ? 'rgba(255, 193, 7, 0.15)' : 'rgba(255,255,255,0.05)',
                                                    color: u.role === 'admin' ? 'var(--accent-gold)' : '#aaa'
                                                }}>
                                                    {u.role.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {u.is_banned ? (
                                                    <span style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                                        <AlertTriangle size={14} /> Banned
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--accent-green)', fontSize: '0.9rem' }}>Active</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                {u.role !== 'admin' && (
                                                    <button 
                                                        onClick={() => handleBanUser(u.id, u.is_banned)} 
                                                        className="btn-secondary" 
                                                        style={{ 
                                                            padding: '6px 12px', 
                                                            fontSize: '13px', 
                                                            display: 'inline-flex', 
                                                            alignItems: 'center', 
                                                            gap: '6px', 
                                                            borderColor: u.is_banned ? 'var(--accent-green)' : 'var(--accent-red)',
                                                            color: u.is_banned ? 'var(--accent-green)' : 'var(--accent-red)'
                                                        }}
                                                    >
                                                        <Ban size={12} /> {u.is_banned ? 'Unban User' : 'Ban User'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
