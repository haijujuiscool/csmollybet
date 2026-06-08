import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function Battles() {
    const { user, setUser, refreshBalance } = useAuth();
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [cart, setCart] = useState([]);
    const [battleMode, setBattleMode] = useState('1v1');
    const [ffaPlayers, setFfaPlayers] = useState(2);
    const [isCrazyMode, setIsCrazyMode] = useState(false);
    const [isMythicSpin, setIsMythicSpin] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [activeBattles, setActiveBattles] = useState([]);

    useEffect(() => {
        // Fetch cases to select for battle
        axios.get('/api/cases')
            .then(res => setCases(res.data))
            .catch(err => console.error(err));

        // Fetch active battles list
        const s = io();
        s.emit('get_battles', (battles) => {
            setActiveBattles(battles);
        });
        s.on('battles_update', (battles) => {
            setActiveBattles(battles);
        });
        return () => s.disconnect();
    }, []);

    const addToCart = (caseObj) => {
        setCart([...cart, caseObj]);
    };

    const removeFromCart = (index) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const totalCost = cart.reduce((acc, c) => acc + c.price, 0);

    const handleCreateBattle = () => {
        if (isCreating) return;
        if (!user) return alert('Please login first');
        if (cart.length === 0) return alert('Select at least one case to battle');
        if (user.gems < totalCost) return alert('Insufficient gems');

        setIsCreating(true);
        const socket = io(undefined, {
            auth: { token: localStorage.getItem('token') }
        });

        socket.emit('create_battle', { 
            mode: battleMode, 
            isCrazyMode, 
            isMythicSpin, 
            ffaPlayers: battleMode === 'ffa' ? ffaPlayers : undefined, 
            caseIds: cart.map(c => c.id) 
        }, (res) => {
            setIsCreating(false);
            if (res.error) {
                alert(res.error);
                socket.disconnect();
            } else {
                navigate(`/battle/${res.battleId}`);
            }
        });
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', overflowX: 'hidden' }}>
            <h1 style={{ color: 'var(--accent-gold)', marginBottom: '20px' }}>CASE BATTLES</h1>
            
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '40px' }}>
                {/* Active Battles Section */}
                <div style={{ flex: '1 1 600px', minWidth: 0 }}>
                    <h2 style={{ color: '#fff', marginBottom: '15px', fontSize: '20px' }}>Active Battles Lobby</h2>
                    {activeBattles.length === 0 ? (
                        <div style={{ backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '8px', border: '1px solid #333', textAlign: 'center', color: '#666' }}>
                            No active battles right now. Create one on the right to start!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {activeBattles.map(b => (
                                <div
                                    key={b.id}
                                    onClick={() => navigate(`/battle/${b.id}`)}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '15px 20px',
                                        border: b.status === 'rolling' ? '1px solid var(--accent-gold)' : '1px solid #333',
                                        cursor: 'pointer', transition: 'border-color 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <span style={{
                                            backgroundColor: b.status === 'waiting' ? 'var(--accent-green)' : 'var(--accent-gold)',
                                            color: '#000', padding: '3px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                                        }}>
                                            {b.status === 'waiting' ? 'OPEN' : 'LIVE'}
                                        </span>
                                        <span style={{ fontWeight: 'bold' }}>{b.mode.toUpperCase()}</span>
                                        {b.isCrazyMode && <span style={{ color: '#F44336', fontSize: '12px', fontWeight: 'bold' }}>CRAZY</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                        <span style={{ color: '#888' }}>{b.players.length}/{b.maxPlayers} Players</span>
                                        <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>{b.cost.toFixed(2)} Gems</span>
                                        {b.status === 'waiting' && (
                                            <span className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px' }}>Join</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Battle Setup Config Panel */}
                <div style={{ flex: '1 1 300px', maxWidth: '400px', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '20px', border: '1px solid #333', height: 'fit-content' }}>
                    <h2 style={{ marginBottom: '15px', fontSize: '20px', color: '#fff' }}>Configure Battle</h2>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Mode:</label>
                        <select
                            className="input-field"
                            value={battleMode}
                            onChange={e => setBattleMode(e.target.value)}
                        >
                            <option value="solo">Solo (1 Player)</option>
                            <option value="1v1">1v1 (2 Players)</option>
                            <option value="1v1v1">1v1v1 (3 Players)</option>
                            <option value="2v2">2v2 (Team Battle)</option>
                            <option value="3v3">3v3 (Team Battle)</option>
                            <option value="ffa">Group (Max 6)</option>
                        </select>
                    </div>

                    {battleMode === 'ffa' && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Number of Players (2-6):</label>
                            <input
                                type="number"
                                className="input-field"
                                value={ffaPlayers}
                                min="2"
                                max="6"
                                onChange={e => setFfaPlayers(parseInt(e.target.value) || 2)}
                            />
                        </div>
                    )}

                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            type="checkbox"
                            id="crazyMode"
                            checked={isCrazyMode}
                            onChange={e => setIsCrazyMode(e.target.checked)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <label htmlFor="crazyMode" style={{ fontWeight: 'bold', color: isCrazyMode ? '#F44336' : 'var(--text-main)', cursor: 'pointer' }}>
                            Crazy Mode (Lowest Wins)
                        </label>
                    </div>

                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            type="checkbox"
                            id="mythicSpin"
                            checked={isMythicSpin}
                            onChange={e => setIsMythicSpin(e.target.checked)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <label htmlFor="mythicSpin" style={{ fontWeight: 'bold', color: isMythicSpin ? '#9C27B0' : 'var(--text-main)', cursor: 'pointer' }}>
                            {'Mythic Spin'}
                        </label>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '15px', borderBottom: '1px solid #333', pb: '10px' }}>
                        <h4 style={{ marginBottom: '8px', color: '#aaa' }}>Selected Cases:</h4>
                        {cart.map((c, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: '10px', marginBottom: '5px', borderRadius: '4px' }}>
                                <span style={{ fontSize: '14px' }}>{c.name}</span>
                                <div>
                                    <span style={{ color: 'var(--accent-gold)', fontSize: '12px', marginRight: '10px' }}>{c.price.toFixed(2)}</span>
                                    <button onClick={() => removeFromCart(i)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && <div style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '10px' }}>No cases selected</div>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginBottom: '15px' }}>
                        <span>Total Cost:</span>
                        <span style={{ color: 'var(--accent-gold)' }}>{totalCost.toFixed(2)} Gems</span>
                    </div>

                    <button
                        className="btn-primary"
                        style={{ width: '100%', padding: '15px', fontSize: '18px', opacity: isCreating ? 0.5 : 1 }}
                        onClick={handleCreateBattle}
                        disabled={isCreating}
                    >
                        {isCreating ? 'Creating...' : `Create Battle`}
                    </button>
                </div>
            </div>

            {/* Cases Selection Grid */}
            <div style={{ borderTop: '2px solid #222', paddingTop: '30px' }}>
                <h2 style={{ color: '#fff', marginBottom: '20px' }}>Add Cases to your Battle</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                    {cases.length === 0 ? (
                        <p>No cases available to battle. Create a case first on the Cases page!</p>
                    ) : (
                        cases.map(c => (
                            <div 
                                key={c.id} 
                                style={{
                                    width: '180px', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '15px',
                                    textAlign: 'center', border: '1px solid #333'
                                }}
                            >
                                <img src={c.image_url} alt={c.name} style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                                <h3 style={{ margin: '10px 0 5px 0', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</h3>
                                <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', marginBottom: '12px' }}>{c.price.toFixed(2)} Gems</div>
                                <button 
                                    className="btn-secondary" 
                                    style={{ width: '100%', padding: '6px', fontSize: '13px' }} 
                                    onClick={() => addToCart(c)}
                                >
                                    + Add to Battle
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
