import { Link } from 'react-router-dom';

const gameLinks = [
  { path: '/double', label: 'Double' },
  { path: '/crash', label: 'Crash' },
  { path: '/mines', label: 'Mines' },
  { path: '/battles', label: 'Battles' },
  { path: '/cases', label: 'Cases' },
  { path: '/upgrader', label: 'Upgrader' }
];

const extraLinks = [
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Free Coins', href: '/free-coins' },
  { label: 'Fairness', href: '/fairness' },
  { label: 'Support', href: '/support' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/terms' },
];

export default function Footer() {
  return (
    <footer style={{
      backgroundColor: 'var(--bg-panel)',
      borderTop: '2px solid #333',
      padding: '30px 20px',
      marginTop: 'auto'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '40px',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '14px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Games</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gameLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                style={{ color: '#aaa', textDecoration: 'none', fontSize: '13px', transition: 'color 0.2s' }}
                onMouseOver={e => e.target.style.color = '#fff'}
                onMouseOut={e => e.target.style.color = '#aaa'}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '14px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Links</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {extraLinks.map(link => (
              <Link
                key={link.label}
                to={link.href}
                style={{ color: '#aaa', textDecoration: 'none', fontSize: '13px', transition: 'color 0.2s' }}
                onMouseOver={e => e.target.style.color = '#fff'}
                onMouseOut={e => e.target.style.color = '#aaa'}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: '30px', color: '#555', fontSize: '12px', borderTop: '1px solid #2a2a2a', paddingTop: '20px' }}>
        CSMOLLY &copy; {new Date().getFullYear()}
      </div>
    </footer>
  );
}