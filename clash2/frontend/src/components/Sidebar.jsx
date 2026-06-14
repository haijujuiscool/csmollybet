import { Link } from 'react-router-dom';

export default function Sidebar({ isOpen, onClose }) {
    return (
        <>
            <button
                type="button"
                className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
                aria-label="Close navigation"
                onClick={onClose}
            />
            <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
                <Link to="/" className="nav-brand" style={{
                    background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C00 50%, #FFB347 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: '950',
                    letterSpacing: '-0.5px'
                }} onClick={onClose}>
                    CSMOLLY.BET
                </Link>

                <div className="nav-links">
                    <Link to="/double" className="btn-secondary" onClick={onClose}>Double</Link>
                    <Link to="/crash" className="btn-secondary" onClick={onClose}>Crash</Link>
                    <Link to="/mines" className="btn-secondary" onClick={onClose}>Mines</Link>
                    <Link to="/battles" className="btn-secondary" onClick={onClose}>Battles</Link>
                    <Link to="/cases" className="btn-secondary" onClick={onClose}>Cases</Link>
                    <Link to="/upgrader" className="btn-secondary" onClick={onClose}>Upgrader</Link>
                    <Link to="/lotteries" className="btn-secondary" onClick={onClose}>Lotteries</Link>
                    <Link to="/worldcup" className="btn-secondary" style={{ borderLeft: '3px solid var(--accent-gold)' }} onClick={onClose}>⚽ World Cup</Link>
                </div>
                <div style={{ borderTop: '1px solid #333', margin: '12px 0' }} />
                <div className="nav-links">
                    <Link to="/inventory" className="btn-secondary" onClick={onClose}>Inventory</Link>
                </div>
            </nav>
        </>
    );
}
