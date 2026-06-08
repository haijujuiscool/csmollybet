import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Chat from './components/Chat';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Double from './pages/Double';
import Crash from './pages/Crash';
import CaseCreator from './pages/CaseCreator';
import Cases from './pages/Cases';
import Battles from './pages/Battles';
import Battle from './pages/Battle';
import Mines from './pages/Mines';
import Upgrader from './pages/Upgrader';
import Admin from './pages/Admin';
import Terms from './pages/Terms';
import AgeVerificationModal from './components/AgeVerificationModal';
import LiveGamesFeed from './components/LiveGamesFeed';

function App() {
  const [isShutdown, setIsShutdown] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isFeedCollapsed, setIsFeedCollapsed] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/shutdown') {
        axios.get('/api/shutdown').then(() => window.location.href = '/').catch(() => window.location.href = '/');
        return;
    }
    if (window.location.pathname === '/reactivate') {
        axios.get('/api/reactivate').then(() => window.location.href = '/').catch(() => window.location.href = '/');
        return;
    }

    const checkStatus = async () => {
      try {
        const res = await axios.get('/api/status');
        setIsShutdown(res.data.isShutdown);
      } catch (err) {
        if (err.response && err.response.status === 503) {
          setIsShutdown(true);
        }
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isShutdown && window.location.pathname !== '/reactivate') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: 'red' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '20px' }}>SITE OFFLINE</h1>
        <p style={{ color: '#fff' }}>The site is currently down for maintenance.</p>
      </div>
    );
  }

  return (
    <div className={`app-layout ${isChatCollapsed ? 'chat-collapsed' : ''} ${isFeedCollapsed ? 'feed-collapsed' : ''}`}>
      <AgeVerificationModal />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Chat isCollapsed={isChatCollapsed} onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)} />
      <div className='main-content'>
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <div className='page-content'>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/login' element={<Login />} />
            <Route path='/register' element={<Register />} />
            <Route path='/double' element={<Double />} />
            <Route path='/crash' element={<Crash />} />
            <Route path='/mines' element={<Mines />} />
            <Route path='/upgrader' element={<Upgrader />} />
            <Route path='/case-creator' element={<CaseCreator />} />
            <Route path='/cases' element={<Cases />} />
            <Route path='/battles' element={<Battles />} />
            <Route path='/battle/:id' element={<Battle />} />
            <Route path='/admin' element={<Admin />} />
            <Route path='/terms' element={<Terms />} />
          </Routes>
        </div>
      </div>
      <div className="feed-sidebar">
        <div style={{ borderBottom: '2px solid #222', backgroundColor: '#111', padding: '15px 15px 10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 'bold', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '15px' }}>
            Live Game Feed
          </div>
          <button 
            onClick={() => setIsFeedCollapsed(true)}
            style={{
              background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px', outline: 'none'
            }}
            title="Hide Feed"
          >
            ▶
          </button>
        </div>
        <LiveGamesFeed />
      </div>

      {/* Expand handles on screen edges (desktop only via css class) */}
      {isChatCollapsed && (
        <div 
          className="expand-handle"
          onClick={() => setIsChatCollapsed(false)}
          style={{
            position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: '20px', height: '60px', backgroundColor: 'var(--bg-panel)',
            border: '1px solid #333', borderLeft: 'none', borderRadius: '0 8px 8px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 1001, color: 'var(--accent-gold)', fontWeight: 'bold'
          }}
          title="Show Chat"
        >
          ▶
        </div>
      )}

      {isFeedCollapsed && (
        <div 
          className="expand-handle"
          onClick={() => setIsFeedCollapsed(false)}
          style={{
            position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)',
            width: '20px', height: '60px', backgroundColor: 'var(--bg-panel)',
            border: '1px solid #333', borderRight: 'none', borderRadius: '8px 0 0 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 1001, color: 'var(--accent-gold)', fontWeight: 'bold'
          }}
          title="Show Feed"
        >
          ◀
        </div>
      )}
    </div>
  );
}

export default App;
