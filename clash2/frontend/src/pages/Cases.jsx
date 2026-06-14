import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import RouletteSpinner from '../components/RouletteSpinner';

export default function Cases() {
    const { user, setUser, refreshBalance } = useAuth();
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [isMythicSpin, setIsMythicSpin] = useState(false);

    // Solo opening state
    const [soloModal, setSoloModal] = useState(null);

    // Case preview modal state
    const [previewCase, setPreviewCase] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    useEffect(() => {
        axios.get('/api/cases')
            .then(res => setCases(res.data))
            .catch(err => console.error(err));
    }, []);

    const handleSoloOpen = async (caseObj) => {
        if (!user) return alert('Please login first');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`/api/cases/${caseObj.id}/open`, { mythicSpin: isMythicSpin }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setSoloModal({
                caseObj,
                wonItem: res.data.wonItem,
                items: res.data.items,
                isMythic: res.data.isMythic,
                mythicItems: res.data.mythicItems,
                phase: 'spinning'
            });

            // Show cost deduction immediately (no spoiler on winnings)
            setUser(prev => prev ? { ...prev, gems: prev.gems - caseObj.price } : prev);

            // Update real balance only after animation finishes
            // Mythic spin takes 12s total (2 phases), normal takes 6s
            const animDuration = res.data.wonItem.isMythicHit ? 12000 : 6000;
            setTimeout(() => {
                setSoloModal(prev => prev ? { ...prev, phase: 'done' } : null);
                refreshBalance();
            }, animDuration);
        } catch (err) {
            alert(err.response?.data?.error || 'Error opening case');
        }
    };

    const handleDeleteCase = async (id) => {
        if (!confirm('Are you sure you want to delete this case?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/cases/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setCases(cases.filter(c => c.id !== id));
        } catch (err) {
            alert(err.response?.data?.error || 'Error deleting case');
        }
    };

    const handleCaseRightClick = async (e, caseObj) => {
        e.preventDefault();
        setLoadingPreview(true);
        setPreviewCase({ ...caseObj, items: [] });
        try {
            const res = await axios.get(`/api/cases/${caseObj.id}`);
            setPreviewCase(res.data);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Error fetching case details');
            setPreviewCase(null);
        } finally {
            setLoadingPreview(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', overflowX: 'hidden' }}>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {/* Cases List */}
                <div style={{ flex: '1 1 100%', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                            <div>
                                <h1 style={{ color: 'var(--accent-gold)', margin: 0 }}>CASES</h1>
                                <span style={{ fontSize: '11px', color: '#888', display: 'block', marginTop: '2px' }}>(Rechtsklick für Vorschau)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="checkbox"
                                    id="mythicSpinCases"
                                    checked={isMythicSpin}
                                    onChange={e => setIsMythicSpin(e.target.checked)}
                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                                <label htmlFor="mythicSpinCases" style={{ fontWeight: 'bold', color: isMythicSpin ? '#9C27B0' : 'var(--text-main)', cursor: 'pointer' }}>
                                    {'Mythic Spin'}
                                </label>
                            </div>
                        </div>
                        <button
                            className="btn-primary"
                            style={{ padding: '10px 20px' }}
                            onClick={() => navigate('/case-creator')}
                        >
                            + Create Case
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                        {cases.length === 0 ? <p>No cases available yet. Go create one!</p> : cases.map(c => (
                            <div 
                                key={c.id} 
                                onContextMenu={(e) => handleCaseRightClick(e, c)}
                                style={{
                                    width: '200px', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '15px',
                                    textAlign: 'center', border: '1px solid #333', cursor: 'pointer',
                                    userSelect: 'none', position: 'relative',
display: 'flex', flexDirection: 'column', alignItems: 'center'
                                }}
                            >
                                {/* Info icon for mobile and desktop preview tap/click */}
                                <div 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCaseRightClick(e, c);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        backgroundColor: '#2b2b2b',
                                        color: 'var(--accent-gold)',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        border: '1px solid #444',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        transition: 'background-color 0.2s, transform 0.1s'
                                    }}
                                    title="Case Vorschau"
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3b3b3b'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2b2b2b'}
                                >
                                    i
                                </div>
                                <img src={c.image_url} alt={c.name} style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
                                <h3 style={{ margin: '10px 0 5px 0' }}>{c.name}</h3>
                                <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', marginBottom: '5px' }}>{c.price.toFixed(2)} Gems</div>
                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>By: {c.owner_name}</span>
                                    {user && c.owner_id === user.id && (
                                        <span
                                            onClick={() => handleDeleteCase(c.id)}
                                            style={{ color: '#F44336', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            Delete
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                                    <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '13px' }} onClick={() => handleSoloOpen(c)}>
                                        Open Case
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Solo Opening Modal */}
            {soloModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }} onClick={() => { if (soloModal.phase === 'done') setSoloModal(null); }}>
                    <div style={{
                        backgroundColor: '#1a1a1a', borderRadius: '16px', padding: '40px',
                        border: '1px solid #333', width: '600px', maxWidth: '90vw', textAlign: 'center'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: 'var(--accent-gold)', marginBottom: '20px', fontSize: '24px' }}>
                            Opening: {soloModal.caseObj.name}
                        </h2>

                        <div style={{ margin: '30px 0' }}>
                            <RouletteSpinner
                                currentRoll={soloModal.wonItem}
                                currentCaseItems={soloModal.items}
                                isMythicSpin={isMythicSpin}
                                casePrice={soloModal.caseObj.price}
                                large={true}
                            />
                        </div>

                        {soloModal.phase === 'done' && (
                            <div style={{ marginTop: '25px' }}>
                                <div style={{ fontSize: '18px', marginBottom: '10px', color: '#aaa' }}>You won:</div>
                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent-green)' }}>
                                    {soloModal.wonItem.name}
                                </div>
                                <div style={{ fontSize: '24px', color: 'var(--accent-gold)', marginTop: '8px' }}>
                                    {soloModal.wonItem.value.toFixed(2)} Gems
                                </div>
                                <button
                                    className="btn-primary"
                                    style={{ marginTop: '25px', padding: '14px 40px', fontSize: '16px' }}
                                    onClick={() => setSoloModal(null)}
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Case Preview Modal */}
            {previewCase && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }} onClick={() => setPreviewCase(null)}>
                    <div style={{
                        backgroundColor: '#1a1a1a', borderRadius: '16px', padding: '30px',
                        border: '1px solid #333', width: '700px', maxWidth: '95vw',
                        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ color: 'var(--accent-gold)', margin: 0, fontSize: '24px' }}>
                                    {previewCase.name}
                                </h2>
                                <span style={{ color: '#888', fontSize: '13px' }}>Created by: {previewCase.owner_name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                                    {previewCase.price.toFixed(2)} Gems
                                </div>
                                <button
                                    onClick={() => setPreviewCase(null)}
                                    style={{
                                        background: 'none', border: 'none', color: '#888',
                                        fontSize: '24px', cursor: 'pointer', outline: 'none'
                                    }}
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        {loadingPreview ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
                                <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>Loading case items...</div>
                            </div>
                        ) : (
                            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px', scrollbarWidth: 'thin' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                    gap: '12px'
                                }}>
                                    {previewCase.items && [...previewCase.items]
                                        .sort((a, b) => b.value - a.value)
                                        .map((item, idx) => (
                                            <div key={idx} style={{
                                                backgroundColor: '#111',
                                                border: '1px solid #222',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                textAlign: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center'
                                            }}>
                                                <img
                                                    src={item.image_url}
                                                    alt={item.name}
                                                    style={{ width: '70px', height: '70px', objectFit: 'contain' }}
                                                />
                                                <div style={{
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    marginTop: '8px',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    width: '100%',
                                                    color: '#fff'
                                                }} title={item.name}>
                                                    {item.name}
                                                </div>
                                                <div style={{
                                                    fontSize: '11px',
                                                    color: 'var(--accent-gold)',
                                                    fontWeight: 'bold',
                                                    marginTop: '4px'
                                                }}>
                                                    {item.value.toFixed(2)} Gems
                                                </div>
                                                <div style={{
                                                    fontSize: '10px',
                                                    color: '#4CAF50',
                                                    fontWeight: 'bold',
                                                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    marginTop: '6px'
                                                }}>
                                                    {item.odds.toFixed(2)}%
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
