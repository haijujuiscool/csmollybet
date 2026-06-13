import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Ban, Check, X, AlertTriangle, MessageSquare, Send, ArrowLeft, Upload, Trash2 } from 'lucide-react';

export default function Admin() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [ticketView, setTicketView] = useState(null);
    const [adminReply, setAdminReply] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [ticketFilter, setTicketFilter] = useState('open');
    const [transfers, setTransfers] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchAdminData();
        }
    }, [user, ticketFilter]);

    const fetchAdminData = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [usersRes, withdrawalsRes, ticketsRes] = await Promise.all([
                axios.get('/api/admin/users', { headers }),
                axios.get('/api/admin/withdrawals', { headers }),
                axios.get('/api/admin/support/tickets', { headers, params: { status: ticketFilter } })
            ]);

            setUsers(usersRes.data);
            setWithdrawals(withdrawalsRes.data);
            setTickets(ticketsRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch admin statistics');
        } finally {
            setLoading(false);
        }
    };

    const fetchTransfers = async () => {
        try {
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
            const res = await axios.get('/api/admin/transfers', { headers });
            setTransfers(res.data);
        } catch (err) {}
    };

    useEffect(() => {
        if (user && user.role === 'admin') fetchTransfers();
    }, [user]);

    const handleUploadFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
            await axios.post('/api/admin/upload-transfer', form, { headers });
            setMessage(`"${file.name}" uploaded successfully`);
            fetchTransfers();
        } catch (err) {
            setError(err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDeleteTransfer = async (filename) => {
        if (!confirm(`Delete "${filename}"?`)) return;
        try {
            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
            await axios.delete(`/api/admin/transfers/${encodeURIComponent(filename)}`, { headers });
            setMessage(`"${filename}" deleted`);
            fetchTransfers();
        } catch (err) {
            setError('Failed to delete file');
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

    const openTicketView = async (ticketId) => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.get(`/api/support/tickets/${ticketId}`, { headers });
            setTicketView(res.data);
        } catch (err) {
            setError('Failed to load ticket');
        }
    };

    const handleAdminReply = async () => {
        if (!adminReply.trim() || !ticketView) return;
        setSendingReply(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post(`/api/admin/support/tickets/${ticketView.id}/messages`, { message: adminReply.trim() }, { headers });
            setAdminReply('');
            openTicketView(ticketView.id);
        } catch (err) {
            setError('Failed to send reply');
        } finally { setSendingReply(false); }
    };

    const closeTicket = async (ticketId) => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post(`/api/admin/support/tickets/${ticketId}/close`, {}, { headers });
            setMessage('Ticket closed');
            setTicketView(null);
            fetchAdminData();
        } catch (err) {
            setError('Failed to close ticket');
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

                    {/* Support Tickets */}
                    <div style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-gold)' }}>
                            <MessageSquare size={24} /> Support Tickets ({tickets.length})
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button onClick={() => setTicketFilter('open')}
                                style={{
                                    padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                    background: ticketFilter === 'open' ? 'var(--accent-green)' : 'transparent',
                                    color: ticketFilter === 'open' ? '#000' : '#888',
                                    border: ticketFilter === 'open' ? 'none' : '1px solid #333'
                                }}
                            >Open</button>
                            <button onClick={() => setTicketFilter('closed')}
                                style={{
                                    padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                    background: ticketFilter === 'closed' ? '#888' : 'transparent',
                                    color: ticketFilter === 'closed' ? '#000' : '#888',
                                    border: ticketFilter === 'closed' ? 'none' : '1px solid #333'
                                }}
                            >Closed</button>
                        </div>

                        {/* Ticket Detail View */}
                        {ticketView ? (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <button onClick={() => setTicketView(null)}
                                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{ticketView.subject}</div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>by {ticketView.username} — {ticketView.status}</div>
                                    </div>
                                    {ticketView.status === 'open' && (
                                        <button onClick={() => closeTicket(ticketView.id)}
                                            style={{
                                                padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                                background: 'rgba(244,67,54,0.15)', color: '#F44336',
                                                border: '1px solid rgba(244,67,54,0.3)', cursor: 'pointer'
                                            }}
                                        >Close Ticket</button>
                                    )}
                                </div>
                                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {ticketView.messages?.map(msg => (
                                        <div key={msg.id} style={{
                                            padding: '12px', borderRadius: '8px', maxWidth: '80%',
                                            alignSelf: msg.is_admin ? 'flex-start' : 'flex-end',
                                            background: msg.is_admin ? 'rgba(255,107,53,0.08)' : 'rgba(255,255,255,0.04)',
                                            border: msg.is_admin ? '1px solid rgba(255,107,53,0.15)' : '1px solid rgba(255,255,255,0.06)'
                                        }}>
                                            <div style={{ fontSize: '11px', color: msg.is_admin ? '#FF6B35' : '#888', marginBottom: '4px', fontWeight: 600 }}>
                                                {msg.is_admin ? 'Admin' : msg.username || 'User'}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#ddd', whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                                            <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
                                                {new Date(msg.created_at + 'Z').toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {ticketView.status === 'open' && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <textarea value={adminReply} onChange={e => setAdminReply(e.target.value)}
                                            placeholder="Type your reply..."
                                            rows={2}
                                            style={{
                                                flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #333',
                                                background: '#111', color: '#fff', fontSize: '13px', outline: 'none', resize: 'none',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                        <button onClick={handleAdminReply} disabled={sendingReply || !adminReply.trim()}
                                            style={{
                                                padding: '10px 16px', borderRadius: '6px',
                                                background: 'rgba(255,107,53,0.2)', color: '#FF6B35',
                                                border: '1px solid rgba(255,107,53,0.4)', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600,
                                                opacity: sendingReply || !adminReply.trim() ? 0.5 : 1
                                            }}
                                        ><Send size={16} /> {sendingReply ? '...' : 'Reply'}</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            tickets.length === 0 ? (
                                <p style={{ color: '#888', fontStyle: 'italic' }}>No {ticketFilter} tickets.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {tickets.map(ticket => (
                                        <div key={ticket.id} onClick={() => openTicketView(ticket.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                                transition: 'background 0.15s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        >
                                            <MessageSquare size={18} style={{ color: ticket.status === 'open' ? 'var(--accent-green)' : '#666', flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#e0e0e0' }}>{ticket.username} — {ticket.subject}</div>
                                                <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {ticket.last_message || ''}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#555', flexShrink: 0 }}>
                                                {ticket.last_message_at ? new Date(ticket.last_message_at + 'Z').toLocaleDateString() : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
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

                    {/* File Transfers */}
                    <div style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: 'var(--accent-gold)' }}>
                            📁 File Transfers ({transfers.length})
                        </h2>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                                background: 'rgba(255,107,53,0.15)', color: '#FF6B35',
                                border: '1px solid rgba(255,107,53,0.3)', fontWeight: 600, fontSize: '14px'
                            }}>
                                <Upload size={18} />
                                {uploading ? 'Uploading...' : 'Upload File'}
                                <input type="file" onChange={handleUploadFile} disabled={uploading}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                        {transfers.length === 0 ? (
                            <p style={{ color: '#888', fontStyle: 'italic' }}>No files uploaded yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {transfers.map(f => (
                                    <div key={f.name} style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '10px 14px', borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)'
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <a href={f.url} target="_blank" rel="noopener noreferrer"
                                                style={{ color: '#FF8C00', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
                                                onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                                onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                            >
                                                {f.name}
                                            </a>
                                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                                {(f.size / 1024).toFixed(1)} KB &middot; {new Date(f.modified).toLocaleString()}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteTransfer(f.name)}
                                            style={{
                                                padding: '6px 10px', borderRadius: '6px',
                                                background: 'rgba(244,67,54,0.1)', color: '#F44336',
                                                border: '1px solid rgba(244,67,54,0.2)', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600
                                            }}
                                        >
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
