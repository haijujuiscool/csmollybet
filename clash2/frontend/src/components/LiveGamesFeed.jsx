import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

let feedSocket;

export default function LiveGamesFeed() {
  const navigate = useNavigate();
  const [feedItems, setFeedItems] = useState([]);
  const [feedFilter, setFeedFilter] = useState('all'); // 'all' or 'top'

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
        setFeedItems(prev => [update, ...prev].slice(0, 20));
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
    'Upgrader': '/upgrader'
  };

  const handleItemClick = (game) => {
    const route = gameRoutes[game];
    if (route) {
      navigate(route);
    }
  };

  return (
    <>
      {/* Filter Buttons */}
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
            onClick={() => handleItemClick(item.game)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#161616',
              border: '1px solid #262626',
              transition: 'transform 0.2s, border-color 0.2s',
              cursor: 'pointer',
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = isWin ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = '#262626';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Top row: User and Game name */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.avatar && (
                  <img src={item.avatar} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                )}
                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{item.username}</span>
              </div>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: '#262626',
                color: '#ccc',
                fontWeight: '500'
              }}>{item.game}</span>
            </div>
            {/* Bottom row: Bet, Multiplier, Profit/Loss */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#999' }}>
              <div>Bet: <span style={{ color: '#fff', fontWeight: '500' }}>{item.bet.toLocaleString()} gems</span></div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ backgroundColor: '#222', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', color: '#bbb', border: '1px solid #333' }}>{item.multiplier.toFixed(2)}x</span>
                <span style={{ fontWeight: 'bold', color: isWin ? '#22c55e' : '#ef4444', fontSize: '13px' }}>{isWin ? '+' : ''}{item.profit.toLocaleString()}</span>
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
