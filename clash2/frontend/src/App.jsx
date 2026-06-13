import { Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Chat from './components/Chat';
import Home from './pages/Home';
import Login from './pages/Login';
import Double from './pages/Double';
import Crash from './pages/Crash';
import CaseCreator from './pages/CaseCreator';
import Cases from './pages/Cases';
import Battles from './pages/Battles';
import Battle from './pages/Battle';
import Profile from './pages/Profile';
import Mines from './pages/Mines';
import Upgrader from './pages/Upgrader';
import Admin from './pages/Admin';
import Terms from './pages/Terms';
import FreeDailyCase from './pages/FreeDailyCase';
import AgeVerificationModal from './components/AgeVerificationModal';
import WelcomeCaseModal from './components/WelcomeCaseModal';
import Footer from './components/Footer';
import LiveGamesFeed from './components/LiveGamesFeed';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user, refreshBalance } = useAuth();
  const navigate = useNavigate();
  const [isShutdown, setIsShutdown] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isFeedCollapsed, setIsFeedCollapsed] = useState(false);

  useEffect(() => {
    // Capture referral code from URL
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      localStorage.setItem('referral_code', refCode);
    }
  }, []);

  useEffect(() => {
    if (user && !user.onboarding_done && !showWelcome) {
      // Auto-apply referral code if present in localStorage
      const refCode = localStorage.getItem('referral_code');
      if (refCode) {
        axios.post('/api/user/referral-code', { code: refCode }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).then(() => {
          localStorage.removeItem('referral_code');
          refreshBalance();
        }).catch(() => {
          // Invalid code, show welcome modal
          setShowWelcome(true);
        });
      } else {
        setShowWelcome(true);
      }
    }
  }, [user]);

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
      {showWelcome && user && !user.onboarding_done && (
        <WelcomeCaseModal user={user} onClose={() => { setShowWelcome(false); navigate('/daily-case'); }} refreshBalance={refreshBalance} />
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Chat isCollapsed={isChatCollapsed} onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)} />
            <div className='main-content'>
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <div className='page-content'>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/login' element={<Login />} />
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
            <Route path='/profile' element={<Profile />} />
            <Route path='/daily-case' element={<FreeDailyCase />} />
          </Routes>
        </div>
        <Footer />
      </div>
            <div className="feed-sidebar">
        <LiveGamesFeed />
      </div>

      <div 
        className="expand-handle"
        onClick={() => setIsChatCollapsed(!isChatCollapsed)}
        style={{
          position: 'fixed', left: 0, top: '50%', transform: `translateY(-50%) translateX(${isChatCollapsed ? 0 : 280}px)`,
          width: '20px', height: '60px', backgroundColor: 'var(--bg-panel)',
          border: '1px solid #333', borderLeft: 'none', borderRadius: '0 8px 8px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 1001, color: 'var(--accent-gold)', fontWeight: 'bold',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        title={isChatCollapsed ? "Show Chat" : "Hide Chat"}
      >
        {isChatCollapsed ? '▶' : '◀'}
      </div>

      <div 
        className="expand-handle"
        onClick={() => setIsFeedCollapsed(!isFeedCollapsed)}
        style={{
          position: 'fixed', right: 0, top: '50%', transform: `translateY(-50%) translateX(${isFeedCollapsed ? 0 : -280}px)`,
          width: '20px', height: '60px', backgroundColor: 'var(--bg-panel)',
          border: '1px solid #333', borderRight: 'none', borderRadius: '8px 0 0 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 1001, color: 'var(--accent-gold)', fontWeight: 'bold',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        title={isFeedCollapsed ? "Show Feed" : "Hide Feed"}
      >
        {isFeedCollapsed ? '◀' : '▶'}
      </div>
    </div>
  );
}

export default App;
