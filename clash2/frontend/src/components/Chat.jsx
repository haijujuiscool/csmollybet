import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import LiveGamesFeed from './LiveGamesFeed';
import { Users } from 'lucide-react';

let socket;

export default function Chat({ isCollapsed, onToggleCollapse }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [view, setView] = useState('chat'); // 'chat' or 'feed'
    const [input, setInput] = useState('');
    const [isConnecting, setIsConnecting] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1281);
    const messagesEndRef = useRef(null);
    const lastMessageTime = useRef(0);
    const [onlineCount, setOnlineCount] = useState(0);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 1281);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        socket = io(undefined, {
            auth: { token: localStorage.getItem('token') }
        });

        socket.on('connect', () => setIsConnecting(false));

        socket.on('chat_history', (history) => {
            setMessages(history);
        });

        socket.on('chat_message', (msg) => {
            setMessages(prev => [...prev, msg].slice(-30));
        });

        socket.on('online_count', (count) => {
            setOnlineCount(count);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (socket) {
            const token = localStorage.getItem('token');
            if (socket.auth && socket.auth.token !== token) {
                socket.auth.token = token;
                socket.disconnect().connect();
            }
        }
    }, [user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        let scrollY = 0;
        if (isOpen && !isDesktop) {
            scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.documentElement.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.documentElement.style.overflow = '';
            window.scrollTo(0, scrollY);
        };
    }, [isOpen, isDesktop]);

    const hasChatAccess = user?.gems > 0;

    const sendMessage = () => {
        if (!user) return alert('Please login to chat');
        if (!hasChatAccess) return alert('Deposit to unlock chat');
        if (!input.trim()) return;
        const now = Date.now();
        if (now - lastMessageTime.current < 10000) {
            const remaining = Math.ceil((10000 - (now - lastMessageTime.current)) / 1000);
            return alert(`Please wait ${remaining} seconds before sending another message`);
        }

        socket.emit('send_chat', { text: input }, (res) => {
            if (res?.error) {
                alert(res.error);
            } else {
                setInput('');
                lastMessageTime.current = Date.now();
            }
        });
    };

        return (
        <>
            {/* Chat Sidebar */}
            <div className={`chat-sidebar ${isOpen ? 'open' : ''}`}>
                {/* Desktop Title Bar */}
                <div className="chat-title-bar" style={{ borderBottom: '2px solid #222', backgroundColor: '#111', padding: '15px 15px 10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '15px' }}>
                        Chat
                    </div>
                </div>

                {/* Mobile Title Bar / Tabs */}
                <div className="chat-mobile-header" style={{ borderBottom: '2px solid #222', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '15px' }}>
                    <div className="chat-tabs" style={{ flex: 1, display: 'flex' }}>
                        <button 
                            onClick={() => setView('chat')}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: view === 'chat' ? '#1a1a1a' : 'none',
                                color: view === 'chat' ? 'var(--accent-gold)' : '#888',
                                border: 'none',
                                borderBottom: view === 'chat' ? '2px solid var(--accent-gold)' : 'none',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Chat
                        </button>
                        <button 
                            onClick={() => setView('feed')}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: view === 'feed' ? '#1a1a1a' : 'none',
                                color: view === 'feed' ? 'var(--accent-gold)' : '#888',
                                border: 'none',
                                borderBottom: view === 'feed' ? '2px solid var(--accent-gold)' : 'none',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Feed
                        </button>
                    </div>
                    <button 
                        onClick={() => setIsOpen(false)} 
                        className="chat-close-btn"
                        style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer', transition: 'color 0.2s', padding: '10px' }}
                        onMouseOver={(e) => e.target.style.color = '#fff'}
                        onMouseOut={(e) => e.target.style.color = '#888'}
                    >
                        ✕
                    </button>
                </div>

                {(view === 'chat' || isDesktop) ? (
                    <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px', opacity: hasChatAccess ? 1 : 0.5, filter: hasChatAccess ? 'none' : 'grayscale(0.6)' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', wordBreak: 'break-word', color: '#fff' }}>
                                <img 
                                    src={msg.avatar || 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'} 
                                    alt={msg.username} 
                                    style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #333', flexShrink: 0, objectFit: 'cover', marginTop: '2px' }}
                                    onError={(e) => {
                                        e.target.src = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';
                                    }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>
                                        {msg.username}
                                    </span>
                                    <span style={{ color: '#e0e0e0', lineHeight: '1.4' }}>{msg.text}</span>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    <LiveGamesFeed />
                )}

                {(view === 'chat' || isDesktop) && (
                    <div style={{ padding: '15px', borderTop: '2px solid #333', backgroundColor: '#111' }}>
                        {user ? (
                            <>
                                {!hasChatAccess && (
                                    <div style={{ color: '#999', fontSize: '13px', marginBottom: '10px' }}>
                                        Deposit to unlock chat
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', opacity: hasChatAccess ? 1 : 0.5 }}>
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                        placeholder={hasChatAccess ? 'Type your message...' : 'Deposit to unlock chat'}
                                        style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#1e1e1e', color: '#fff', outline: 'none' }}
                                        maxLength={100}
                                        disabled={!hasChatAccess}
                                    />
                                    <button className="btn-primary" onClick={sendMessage} style={{ padding: '10px' }} disabled={!hasChatAccess}>&gt;</button>
                                 </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#555', fontSize: '14px' }}>Login to chat</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0 0', fontSize: '13px', color: '#888' }}>
                            <Users size={14} />
                            <span>{onlineCount} users online</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile chat toggle button */}
            <button
                className="chat-toggle-btn"
                onClick={() => setIsOpen(true)}
                aria-label="Open chat"
                style={{ display: isOpen && !isDesktop ? 'none' : 'flex' }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            </button>
        </>
    );
}
