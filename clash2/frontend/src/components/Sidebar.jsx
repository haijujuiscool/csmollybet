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
                    background: 'linear-gradient(135deg, #1b75ff 0%, #2bd2ff 35%, #ffb800 80%, #ff8c00 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: '950',
                    letterSpacing: '-0.5px'
                }} onClick={onClose}>
                    BLUEGEM
                </Link>

                <div className="nav-links">
                    <Link to="/double" className="btn-secondary" onClick={onClose}>Double</Link>
                    <Link to="/crash" className="btn-secondary" onClick={onClose}>Crash</Link>
                    <Link to="/mines" className="btn-secondary" onClick={onClose}>Mines</Link>
                    <Link to="/battles" className="btn-secondary" onClick={onClose}>Battles</Link>
                    <Link to="/cases" className="btn-secondary" onClick={onClose}>Cases</Link>
                    <Link to="/upgrader" className="btn-secondary" onClick={onClose}>Upgrader</Link>
                </div>
            </nav>
        </>
    );
}
