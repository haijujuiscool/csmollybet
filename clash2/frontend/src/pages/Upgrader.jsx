import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import sounds from '../utils/sounds';

export default function Upgrader() {
    const { user, setUser, refreshBalance } = useAuth();

    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [betAmount, setBetAmount] = useState(10);
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState(null); // { won, payout, winChance, winZoneDeg, landingAngle }
    const [spinAngle, setSpinAngle] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

    // Create item form
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemImage, setNewItemImage] = useState(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = () => {
        axios.get('/api/upgrader/items').then(res => setItems(res.data)).catch(console.error);
    };

    const winChance = selectedItem && betAmount > 0 && betAmount < selectedItem.price
        ? Math.min(((betAmount * 0.99) / selectedItem.price) * 100, 99)
        : 0;

    const winZoneDeg = (winChance / 100) * 360;

    const handleSpin = async () => {
        if (!user) return alert('Please login first');
        if (!selectedItem) return alert('Select an item to upgrade to');
        if (betAmount <= 0) return alert('Enter a valid bet amount');
        if (betAmount >= selectedItem.price) return alert('Bet must be less than item price');

        setSpinning(true);
        setResult(null);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/upgrader/spin', {
                betAmount: parseFloat(betAmount),
                itemId: selectedItem.id
            }, { headers: { Authorization: `Bearer ${token}` } });

            setUser(prev => prev ? { ...prev, gems: prev.gems - parseFloat(betAmount) } : prev);

            const data = res.data;

            // Animate the ring: spin multiple full rotations then land
            // The pointer is at top (0deg). We need the win zone segment to align.
            // landingAngle is where the pointer should land within 0-360.
            // We rotate the ring so the landingAngle ends up at the top (0 position).
            // Ring rotates clockwise. To land at `landingAngle`, we rotate by (360 - landingAngle).
            const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full spins
            const targetRotation = fullSpins * 360 + (360 - data.landingAngle);

            setSpinAngle(targetRotation);
            sounds.spinStart();

            setTimeout(() => {
                setResult(data);
                setSpinning(false);
                if (data.won) sounds.win(); else sounds.lose();
                refreshBalance();
            }, 4500);
        } catch (err) {
            alert(err.response?.data?.error || 'Upgrade failed');
            setSpinning(false);
        }
    };

    const resetSpin = () => {
        setResult(null);
        setSpinAngle(0);
    };

    const handleCreateItem = async () => {
        if (!newItemName || !newItemPrice) return alert('Fill in all fields');
        setCreating(true);

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('name', newItemName);
            formData.append('price', newItemPrice);
            if (newItemImage) formData.append('image', newItemImage);

            await axios.post('/api/upgrader/items', formData, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });

            setNewItemName('');
            setNewItemPrice('');
            setNewItemImage(null);
            setShowCreateModal(false);
            fetchItems();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create item');
        }
        setCreating(false);
    };

    const deleteItem = async (itemId) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/upgrader/items/${itemId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (selectedItem?.id === itemId) setSelectedItem(null);
            fetchItems();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete item');
        }
    };

    const filteredItems = items
        .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price);

    // SVG ring spinner
    const RING_SIZE = 280;
    const RING_CENTER = RING_SIZE / 2;
    const RING_RADIUS = 120;
    const RING_STROKE = 24;

    // Build arc path for the win zone
    const buildArc = (startAngle, endAngle, radius) => {
        const toRad = (deg) => (deg - 90) * Math.PI / 180;
        const x1 = RING_CENTER + radius * Math.cos(toRad(startAngle));
        const y1 = RING_CENTER + radius * Math.sin(toRad(startAngle));
        const x2 = RING_CENTER + radius * Math.cos(toRad(endAngle));
        const y2 = RING_CENTER + radius * Math.sin(toRad(endAngle));
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ color: 'var(--accent-gold)', marginBottom: '5px', textAlign: 'center' }}>UPGRADER 🎯</h1>
            <p style={{ color: '#888', marginBottom: '30px', textAlign: 'center' }}>Bet gems for a chance to win high-value items!</p>

            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>

                {/* LEFT: Spinner + Controls */}
                <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                    {/* Spinner Area */}
                    <div style={{
                        position: 'relative', width: RING_SIZE + 'px', height: RING_SIZE + 'px',
                        marginBottom: '30px'
                    }}>
                        {/* Pointer at top */}
                        <div style={{
                            position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                            width: 0, height: 0,
                            borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
                            borderTop: '16px solid var(--accent-gold)',
                            zIndex: 10, filter: 'drop-shadow(0 0 6px rgba(255,193,7,0.6))'
                        }} />

                        {/* Spinning SVG Ring */}
                        <svg
                            width={RING_SIZE} height={RING_SIZE}
                            style={{
                                transform: `rotate(${spinAngle}deg)`,
                                transition: spinning ? 'transform 4s cubic-bezier(0.15, 0.7, 0.1, 1)' : 'none'
                            }}
                        >
                            {/* Background ring (lose zone) */}
                            <circle
                                cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS}
                                fill="none" stroke="#2a2a2a" strokeWidth={RING_STROKE}
                            />
                            {/* Win zone arc */}
                            {winZoneDeg > 0.5 && (
                                <path
                                    d={buildArc(0, Math.min(winZoneDeg, 359.9), RING_RADIUS)}
                                    fill="none"
                                    stroke="var(--accent-green)"
                                    strokeWidth={RING_STROKE}
                                    strokeLinecap="butt"
                                    style={{ filter: 'drop-shadow(0 0 8px rgba(76,175,80,0.5))' }}
                                />
                            )}
                        </svg>

                        {/* Center content */}
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)', textAlign: 'center'
                        }}>
                            {result ? (
                                <div>
                                    <div style={{ fontSize: '48px', marginBottom: '5px' }}>
                                        {result.won ? '🎉' : '💀'}
                                    </div>
                                    <div style={{
                                        fontSize: '18px', fontWeight: 'bold',
                                        color: result.won ? 'var(--accent-green)' : '#F44336'
                                    }}>
                                        {result.won ? `WON!` : 'LOST'}
                                    </div>
                                    {result.won && (
                                        <div style={{ fontSize: '14px', color: 'var(--accent-gold)', marginTop: '4px' }}>
                                            +{result.payout.toFixed(2)}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                                        {winChance.toFixed(1)}%
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888' }}>chance</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Item Preview */}
                    {selectedItem && (
                        <div style={{
                            backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '8px',
                            border: '1px solid var(--accent-gold)', width: '100%', maxWidth: '350px',
                            display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px'
                        }}>
                            {selectedItem.image_url ? (
                                <img src={selectedItem.image_url} alt={selectedItem.name}
                                    style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
                            ) : (
                                <div style={{
                                    width: '60px', height: '60px', borderRadius: '8px',
                                    backgroundColor: '#333', display: 'flex', justifyContent: 'center',
                                    alignItems: 'center', fontSize: '28px'
                                }}>🎁</div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{selectedItem.name}</div>
                                <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                    {selectedItem.price.toFixed(2)} Gems
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)}
                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                        </div>
                    )}

                    {/* Bet Input */}
                    <div style={{ width: '100%', maxWidth: '350px', marginBottom: '15px' }}>
                        <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '5px' }}>BET AMOUNT</label>
                        <input
                            type="number"
                            className="input-field"
                            value={betAmount}
                            onChange={e => { setBetAmount(Number(e.target.value)); resetSpin(); }}
                            style={{ width: '100%' }}
                            disabled={spinning}
                        />
                    </div>

                    {/* Spin Button */}
                    <button
                        className="btn-primary"
                        style={{
                            width: '100%', maxWidth: '350px', padding: '18px', fontSize: '20px',
                            opacity: (spinning || !selectedItem) ? 0.5 : 1
                        }}
                        disabled={spinning || !selectedItem}
                        onClick={result ? () => { resetSpin(); } : handleSpin}
                    >
                        {spinning ? 'SPINNING...' : result ? 'RESET' : 'UPGRADE 🎯'}
                    </button>
                </div>

                {/* RIGHT: Item List */}
                <div style={{ flex: '1 1 500px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ color: '#fff', margin: 0 }}>Target Items</h2>
                        <button
                            className="btn-secondary"
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                            onClick={() => setShowCreateModal(true)}
                        >
                            + Create Item
                        </button>
                    </div>

                    {/* Search + Sort */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ flex: 1, marginBottom: 0 }}
                        />
                        <button
                            className="btn-secondary"
                            style={{ padding: '8px 14px', fontSize: '13px', whiteSpace: 'nowrap' }}
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        >
                            Price {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                    </div>

                    {/* Items Grid */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '10px', maxHeight: '600px', overflowY: 'auto', paddingRight: '5px'
                    }}>
                        {filteredItems.length === 0 && (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#666', padding: '40px' }}>
                                No items yet. Create one!
                            </div>
                        )}
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                onClick={() => { setSelectedItem(item); resetSpin(); }}
                                style={{
                                    backgroundColor: selectedItem?.id === item.id ? '#1a3a2a' : '#1a1a1a',
                                    border: selectedItem?.id === item.id ? '2px solid var(--accent-green)' : '1px solid #333',
                                    borderRadius: '8px', padding: '12px', cursor: 'pointer',
                                    transition: 'all 0.2s', textAlign: 'center'
                                }}
                            >
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.name}
                                        style={{ width: '80px', height: '80px', borderRadius: '6px', objectFit: 'cover', marginBottom: '8px' }} />
                                ) : (
                                    <div style={{
                                        width: '80px', height: '80px', borderRadius: '6px',
                                        backgroundColor: '#333', display: 'flex', justifyContent: 'center',
                                        alignItems: 'center', fontSize: '36px', margin: '0 auto 8px'
                                    }}>🎁</div>
                                )}
                                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.name}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                    {item.price.toFixed(2)} 💎
                                </div>
                                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                                    by {item.creator_name || 'Unknown'}
                                </div>
                                {user && item.creator_id === user.id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                        style={{
                                            marginTop: '6px', padding: '3px 10px', fontSize: '11px',
                                            backgroundColor: 'rgba(244,67,54,0.2)', color: '#F44336',
                                            border: '1px solid #F44336', borderRadius: '4px', cursor: 'pointer'
                                        }}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Create Item Modal */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
                    justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }} onClick={() => setShowCreateModal(false)}>
                    <div style={{
                        backgroundColor: '#1a1a1a', padding: '30px', borderRadius: '12px',
                        border: '1px solid #333', width: '400px', maxWidth: '90vw'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: 'var(--accent-gold)', marginTop: 0 }}>Create Item</h2>

                        <label style={{ color: '#888', fontSize: '12px' }}>Name</label>
                        <input
                            type="text" className="input-field"
                            value={newItemName} onChange={e => setNewItemName(e.target.value)}
                            placeholder="e.g. Dragon Lore"
                            style={{ width: '100%', marginBottom: '15px' }}
                        />

                        <label style={{ color: '#888', fontSize: '12px' }}>Price (Gems)</label>
                        <input
                            type="number" className="input-field"
                            value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)}
                            placeholder="e.g. 500"
                            style={{ width: '100%', marginBottom: '15px' }}
                        />

                        <label style={{ color: '#888', fontSize: '12px' }}>Image (optional)</label>
                        <input
                            type="file" accept="image/*"
                            onChange={e => setNewItemImage(e.target.files[0])}
                            style={{ width: '100%', marginBottom: '20px', color: '#fff' }}
                        />

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={handleCreateItem} disabled={creating}>
                                {creating ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
