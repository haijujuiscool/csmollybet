import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

let feedSocket;

export default function LiveGamesFeed() {
  const navigate = useNavigate();
  const [feedItems, setFeedItems] = useState([]);
  const [feedFilter, setFeedFilter] = useState('all');

  useEffect(() => {
    feedSocket = io(undefined, {
      auth: { token: localStorage.getItem('token') }
    });

    feedSocket.on('connect', () => {});

    feedSocket.on('game_feed_history', (history) => {
      setFeedItems(history);
    });

    const timeouts = [];
    feedSocket.on('game_feed_update', (update) => {
      const tId = setTimeout(() => {
        setFeedItems(prev => [update, ...prev].slice(0, 100));
        const idx = timeouts.indexOf(tId);
        if (idx > -1) timeouts.splice(idx, 1);
      }, 5000);
      timeouts.push(tId);
    });

    return () => {
      feedSocket.disconnect();
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const filteredFeed = feedItems.filter(item => {
    if (feedFilter === 'all') return true;
    return item.bet > 0 && (item.profit / item.bet) > 5;
  });

  const gameRoutes = {
    'Double': '/double',
    'Crash': '/crash',
    'Mines': '/mines',
    'Battles': '/battles',
    'Cases': '/cases',
    'Upgrader': '/upgrader',
    'Lottery': '/lotteries'
  };

  const handleItemClick = (game) => {
    const route = gameRoutes[game];
    if (route) {
      navigate(route);
    }
  };

  return (
    <>
      <style>{`
        @keyframes feedSlideIn {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .feed-item {
          animation: feedSlideIn 0.35s ease-out;
        }
      `}</style>
      <div style={{ display: 'flex', gap: '8px', padding: '15px 15px 5px' }}>
        <button
          onClick={() => setFeedFilter('all')}
          style={{
            flex: 1,
            padding: '8px 0',
            backgroundColor: feedFilter === 'all' ? 'rgba(255,193,7,0.2)' : '#1e1e1e',
            color: feedFilter === 'all' ? 'var(--accent-gold)' : '#aaa',
            border: feedFilter === 'all' ? '1px solid var(--accent-gold)' : '1px solid #2a2a2a',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
          }}
        >All</button>
        <button
          onClick={() => setFeedFilter('top')}
          style={{
            flex: 1,
            padding: '8px 0',
            backgroundColor: feedFilter === 'top' ? 'rgba(255,193,7,0.2)' : '#1e1e1e',
            color: feedFilter === 'top' ? 'var(--accent-gold)' : '#aaa',
            border: feedFilter === 'top' ? '1px solid var(--accent-gold)' : '1px solid #2a2a2a',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
          }}
        >Top</button>
      </div>
      <div className="feed-messages" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 15px 15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {filteredFeed.map((item, i) => {
        const isWin = item.profit > 0;
        return (
          <div
            key={i}
            className="feed-item"
            onClick={() => handleItemClick(item.game)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              backgroundColor: '#161616',
              border: '1px solid #262626',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = isWin ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}
            onMouseOut={e => e.currentTarget.style.borderColor = '#262626'}
          >
            {item.avatar && (
              <img src={item.avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  backgroundColor: '#262626',
                  color: '#aaa',
                }}>{item.game}</span>
                <span style={{ fontSize: '11px', color: '#999' }}>{item.bet.toLocaleString()} gems</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: '#666', backgroundColor: '#1a1a1a', padding: '1px 5px', borderRadius: '3px', border: '1px solid #2a2a2a' }}>{item.multiplier.toFixed(2)}x</span>
                <span style={{ fontWeight: 'bold', fontSize: '12px', color: isWin ? '#22c55e' : '#ef4444' }}>{isWin ? '+' : ''}{item.profit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })}
        {feedItems.length === 0 && (
        <div style={{ textAlign: 'center', color: '#555', fontSize: '14px', marginTop: '40px' }}>
          Waiting for games...
        </div>
      )}
      </div>
    </>
  );
}
