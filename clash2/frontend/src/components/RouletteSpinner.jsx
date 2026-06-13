import { useState, useEffect, useRef } from 'react';
import emeraldImg from '../assets/emerald.png';

// Web Audio API sound helpers
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioContext ? new AudioContext() : null;

function isSoundEnabled() {
    return localStorage.getItem('soundEnabled') !== 'false';
}

function playTick() {
    if (!audioCtx || !isSoundEnabled()) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 800 + Math.random() * 400;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.05);
}

function playWin() {
    if (!audioCtx || !isSoundEnabled()) return;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = audioCtx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
    });
}

export default function RouletteSpinner({ currentRoll, currentCaseItems, large = false, isMythicSpin = false, casePrice = 0 }) {
    const [spinItems, setSpinItems] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [phase, setPhase] = useState(1);
    const [mythicGlow, setMythicGlow] = useState(false);
    const [jitterMultiplier, setJitterMultiplier] = useState(0);
    const [snapToCenter, setSnapToCenter] = useState(false);
    const tickInterval = useRef(null);
    const cancelledRef = useRef(false);

    // Reset phase on new roll
    useEffect(() => {
        setPhase(1);
        setMythicGlow(false);
        setSnapToCenter(false);
        setJitterMultiplier((Math.random() - 0.5) * 0.9); // Random float between -0.45 and +0.45
    }, [currentRoll]);

    useEffect(() => {
        if (!currentRoll || !currentCaseItems) {
            setSpinItems([]);
            setIsSpinning(false);
            return;
        }

        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        cancelledRef.current = false;
        setSnapToCenter(false);
        setIsSpinning(false);

        let targetItem = currentRoll;
        let pool = currentCaseItems;
        const threshold = casePrice * 2.5;

        // Create the Mythic Gem template
        const mythicGemItem = { 
            name: 'MYTHIC DROP', 
            value: 0, 
            image_url: emeraldImg 
        };

        // Transform items in Phase 1 if Mythic Spin is enabled
        if (isMythicSpin) {
            if (phase === 1) {
                pool = currentCaseItems.map(i => i.value > threshold ? mythicGemItem : i);
                if (currentRoll.value > threshold) {
                    targetItem = mythicGemItem;
                }
            } else if (phase === 2) {
                // In phase 2, show the actual mythic items with their real textures
                pool = currentCaseItems.filter(i => i.value > threshold);
                if (pool.length === 0) pool = currentCaseItems;
            }
        }

        const items = [];
        for (let i = 0; i < 50; i++) {
            if (i === 45) {
                items.push(targetItem);
            } else {
                items.push(pool[Math.floor(Math.random() * pool.length)]);
            }
        }
        setSpinItems(items);
        setIsSpinning(false); // Snap back to start

        const timer = setTimeout(() => {
            if (cancelledRef.current) return;
            setIsSpinning(true);

            const startTime = Date.now();
            const maxDuration = 5300;
            let tickDelay = 40;
            const doTick = () => {
                if (cancelledRef.current) return;
                const elapsed = Date.now() - startTime;
                if (elapsed >= maxDuration) {
                    if (!cancelledRef.current) {
                        // Snap to center slightly after stopping
                        setTimeout(() => {
                            if (!cancelledRef.current) setSnapToCenter(true);
                        }, 200);

                        if (phase === 1 && currentRoll.isMythicHit) {
                            // Phase 1 finished, trigger Mythic Glow and Phase 2
                            setMythicGlow(true);
                            // Web Audio for Mythic transition
                            if (audioCtx) {
                                const osc = audioCtx.createOscillator();
                                const gain = audioCtx.createGain();
                                osc.connect(gain); gain.connect(audioCtx.destination);
                                osc.frequency.setValueAtTime(200, audioCtx.currentTime);
                                osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.5);
                                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
                                osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.5);
                            }
                            
                            setTimeout(() => {
                                if (!cancelledRef.current) setPhase(2);
                            }, 1000);
                        } else {
                            playWin();
                        }
                    }
                    return;
                }
                playTick();
                const progress = elapsed / maxDuration;
                tickDelay = 40 + Math.pow(progress, 2) * 500;
                tickInterval.current = setTimeout(doTick, tickDelay);
            };
            doTick();
        }, 50);

        return () => {
            cancelledRef.current = true;
            clearTimeout(timer);
            if (tickInterval.current) clearTimeout(tickInterval.current);
        };
    }, [currentRoll, currentCaseItems, phase, isMythicSpin, casePrice]);

    if (!currentRoll) return <div style={{ color: '#555' }}>Waiting...</div>;

    const itemWidth = large ? 150 : 120;
    const imgSize = large ? 120 : 95;
    const gap = large ? 14 : 10;
    const itemTotalWidth = itemWidth + gap;
    const containerWidth = large ? 500 : 260;
    const containerHeight = large ? 200 : 170;
    const fontSize = large ? '13px' : '11px';

    return (
        <div style={{ 
            width: `${containerWidth}px`, maxWidth: '100%', height: `${containerHeight}px`, overflow: 'hidden', position: 'relative', 
            border: mythicGlow ? '2px solid #9C27B0' : '2px solid #333', 
            borderRadius: '8px', backgroundColor: '#050505', margin: '0 auto',
            boxShadow: mythicGlow ? '0 0 30px rgba(156, 39, 176, 0.6)' : 'none',
            transition: 'box-shadow 0.5s, border-color 0.5s'
        }}>
            <div style={{ 
                position: 'absolute', top: 0, bottom: 0, left: '50%', width: '3px', 
                backgroundColor: mythicGlow ? '#9C27B0' : 'var(--accent-gold)', 
                zIndex: 10, transform: 'translateX(-50%)',
                boxShadow: mythicGlow ? '0 0 15px #9C27B0' : '0 0 10px rgba(255,193,7,0.5)',
                transition: 'background-color 0.5s, box-shadow 0.5s'
            }} />
            
            <div style={{ 
                display: 'flex', gap: `${gap}px`, padding: `${large ? 15 : 10}px 0`,
                marginLeft: `calc(50% - ${itemWidth / 2}px)`,
                transform: (isSpinning || snapToCenter) ? `translateX(calc(-${45 * itemTotalWidth}px ${snapToCenter ? '' : `- ${jitterMultiplier * itemWidth}px`}))` : 'translateX(0px)',
                transition: snapToCenter ? 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : (isSpinning ? 'transform 5.5s cubic-bezier(0.1, 0.7, 0.1, 1)' : 'none')
            }}>
                    {spinItems.map((item, idx) => {
                        if (!item) return <div key={idx} style={{ width: `${itemWidth}px`, flexShrink: 0 }}></div>;
                        return (
                            <div key={idx} style={{ 
                                width: `${itemWidth}px`, flexShrink: 0, textAlign: 'center',
                                borderRight: '1px solid #2a2a2a',
                                paddingRight: `${gap / 2}px`
                            }}>
                                <img src={item.image_url || item.imageUrl} alt={item.name} style={{ width: `${imgSize}px`, height: `${imgSize}px`, objectFit: 'contain' }} />
                                <div style={{ fontSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: item.name === 'MYTHIC DROP' ? '#9C27B0' : '#fff', fontWeight: item.name === 'MYTHIC DROP' ? 'bold' : 'normal' }}>
                                    {item.name}
                                </div>
                                {item.value > 0 && <div style={{ fontSize, color: 'var(--accent-gold)' }}>{item.value.toFixed(2)}</div>}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}
