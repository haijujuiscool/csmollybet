import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function Plinko() {
    const { user, setUser, refreshBalance } = useAuth();
    const [betAmount, setBetAmount] = useState(1);
    const [risk, setRisk] = useState('medium');
    const [rows, setRows] = useState(14);
    const [multipliers, setMultipliers] = useState([]);
    
    const canvasRef = useRef(null);
    const ballsRef = useRef([]); // Active falling balls
    const animationRef = useRef(null);
    const [isDropping, setIsDropping] = useState(false);

    // Audio
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playBounceSound = () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(300 + Math.random() * 200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    };

    // Initialize/Update Board layout when risk/rows change to show multipliers
    useEffect(() => {
        updateMultipliersDisplay(rows, risk);
    }, [rows, risk]);

    const updateMultipliersDisplay = (r, rsk) => {
        let mults = [];
        if (r === 8) {
            if (rsk === 'low') mults = [6, 2.5, 1.2, 1.1, 0.8, 1.1, 1.2, 2.5, 6];
            else if (rsk === 'medium') mults = [15, 4, 1.5, 0.9, 0.6, 0.9, 1.5, 4, 15];
            else mults = [35, 5, 2, 0.5, 0.4, 0.5, 2, 5, 35];
        } else if (r === 16) {
            if (rsk === 'low') mults = [18, 10, 2.5, 1.6, 1.5, 1.3, 1.2, 1.1, 0.8, 1.1, 1.2, 1.3, 1.5, 1.6, 2.5, 10, 18];
            else if (rsk === 'medium') mults = [130, 50, 12, 6, 4, 2, 1.5, 0.8, 0.5, 0.8, 1.5, 2, 4, 6, 12, 50, 130];
            else mults = [1200, 150, 30, 10, 5, 2.5, 0.5, 0.3, 0.3, 0.3, 0.5, 2.5, 5, 10, 30, 150, 1200];
        } else {
            // Default 14 rows
            if (rsk === 'low') mults = [9, 4, 2, 1.3, 1.2, 1.1, 0.8, 0.8, 0.8, 1.1, 1.2, 1.3, 2, 4, 9];
            else if (rsk === 'medium') mults = [22, 7, 3, 1.8, 1.3, 0.8, 0.5, 0.5, 0.5, 0.8, 1.3, 1.8, 3, 7, 22];
            else mults = [150, 30, 10, 4, 2, 0.5, 0.3, 0.3, 0.3, 0.5, 2, 4, 10, 30, 150];
        }
        setMultipliers(mults);
        drawBoard();
    };

    const handleDrop = async () => {
        if (!user) return alert('Please login');
        try {
            setIsDropping(true);
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/plinko/drop', { betAmount: parseFloat(betAmount), risk, rows }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setUser(prev => prev ? { ...prev, gems: prev.gems - parseFloat(betAmount) } : prev);
            
            // Add ball to animation queue
            ballsRef.current.push({
                x: 0, // Relative to top center
                y: 0,
                path: res.data.path,
                step: 0,
                progress: 0, // 0 to 1 for current step transition
                payout: res.data.payout
            });
            
            // Start animation loop if not running
            if (!animationRef.current) {
                animationRef.current = requestAnimationFrame(animate);
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Drop failed');
            setIsDropping(false);
        }
    };

    const drawBoard = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width = 800;
        const height = canvas.height = 600;

        ctx.clearRect(0, 0, width, height);

        const rowHeight = 35;
        const colWidth = 35;
        const startY = 50;
        const centerX = width / 2;

        // Draw Pegs
        ctx.fillStyle = '#fff';
        for (let i = 0; i < rows; i++) {
            const pegsInRow = i + 3; // Top row has 3 pegs for visual width
            const rowWidth = (pegsInRow - 1) * colWidth;
            const startX = centerX - rowWidth / 2;
            for (let j = 0; j < pegsInRow; j++) {
                ctx.beginPath();
                ctx.arc(startX + j * colWidth, startY + i * rowHeight, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Multiplier Slots at the bottom
        const bottomY = startY + rows * rowHeight;
        const slotsCount = rows + 1;
        const slotsWidth = slotsCount * colWidth;
        const startX = centerX - slotsWidth / 2 + colWidth / 2;
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px Arial';
        
        for (let i = 0; i < slotsCount; i++) {
            const mult = multipliers[i];
            const color = mult >= 2 ? '#4CAF50' : mult >= 1 ? '#FFEB3B' : '#F44336';
            
            // Draw box
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(startX + i * colWidth - colWidth/2 + 2, bottomY, colWidth - 4, 25, 4);
            ctx.fill();
            
            // Draw text
            ctx.fillStyle = '#000';
            ctx.fillText(`${mult}x`, startX + i * colWidth, bottomY + 12);
        }
    };

    const animate = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        
        drawBoard(); // redraw static board

        const rowHeight = 35;
        const colWidth = 35;
        const startY = 50;
        const centerX = width / 2;
        
        const speed = 0.035; // slower animation speed per frame

        let activeBalls = [];

        ballsRef.current.forEach(ball => {
            if (ball.step < rows) {
                // Moving between pegs
                ball.progress += speed;
                if (ball.progress >= 1) {
                    ball.progress = 0;
                    ball.step++;
                    playBounceSound();
                }

                // Calculate current absolute position
                // Logic: at step i, ball is at row i. It falls to row i+1.
                // It shifts horizontally by +0.5 or -0.5 columns
                let targetXOffset = 0;
                for(let i=0; i<ball.step; i++) {
                    targetXOffset += (ball.path[i] === 'R' ? 0.5 : -0.5) * colWidth;
                }
                
                let nextXOffset = targetXOffset + (ball.path[ball.step] === 'R' ? 0.5 : -0.5) * colWidth;
                
                // Interpolate
                // Add a simple bounce effect using sine wave on Y
                const bounce = Math.sin(ball.progress * Math.PI) * -10;
                
                const currentXOffset = targetXOffset + (nextXOffset - targetXOffset) * ball.progress;
                const currentYOffset = (ball.step + ball.progress) * rowHeight + bounce;

                ball.currentX = centerX + currentXOffset;
                ball.currentY = startY + currentYOffset;

                // Draw Ball
                ctx.fillStyle = '#FFC107'; // Accent gold
                ctx.beginPath();
                ctx.arc(ball.currentX, ball.currentY, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.stroke();

                activeBalls.push(ball);
            } else {
                // Ball finished falling
                refreshBalance(); // Update balance to reflect the payout visually
            }
        });

        ballsRef.current = activeBalls;

        if (activeBalls.length > 0) {
            animationRef.current = requestAnimationFrame(animate);
        } else {
            animationRef.current = null;
            setIsDropping(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            
            {/* Control Panel */}
            <div style={{ flex: '1 1 300px', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
                <h1 style={{ color: 'var(--accent-gold)', marginBottom: '20px' }}>PLINKO</h1>
                
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Bet Amount</label>
                    <input 
                        type="number" 
                        className="input-field" 
                        value={betAmount} 
                        onChange={e => setBetAmount(e.target.value)}
                    />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Risk</label>
                    <select className="input-field" value={risk} onChange={e => setRisk(e.target.value)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#888' }}>Rows (8-16)</label>
                    <input 
                        type="number" 
                        min="8" max="16"
                        className="input-field" 
                        value={rows} 
                        onChange={e => setRows(parseInt(e.target.value))}
                    />
                </div>

                <button className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '18px' }} onClick={handleDrop}>
                    Drop Ball
                </button>
            </div>

            {/* Plinko Board */}
            <div style={{ flex: '2 1 600px', display: 'flex', justifyContent: 'center', backgroundColor: '#050505', borderRadius: '8px', border: '1px solid #333', padding: '20px' }}>
                <canvas 
                    ref={canvasRef} 
                    style={{ maxWidth: '100%', height: 'auto', display: 'block' }} 
                />
            </div>
            
        </div>
    );
}
