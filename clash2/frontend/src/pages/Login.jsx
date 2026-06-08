export default function Login() {
    const handleSteamLogin = () => {
        window.location.href = '/api/auth/steam';
    };

    return (
        <div className="auth-container">
            <div className="auth-box" style={{ textAlign: 'center', padding: '40px 30px' }}>
                <h2 style={{ marginBottom: '10px' }}>Login</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', fontSize: '15px' }}>
                    Please authenticate with Steam to access your account.
                </p>
                <button 
                    onClick={handleSteamLogin} 
                    className="btn-primary" 
                    style={{ 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '10px', 
                        padding: '14px', 
                        fontSize: '16px',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.467 3.655 10.08 8.683 11.53l.93-3.23c-.15-.09-.3-.21-.43-.34a2.887 2.887 0 0 1-.84-2.03c0-1.6 1.3-2.9 2.9-2.9.22 0 .43.03.63.07l2.84-4.14c-.03-.13-.05-.27-.05-.41 0-1.05.85-1.9 1.9-1.9s1.9.85 1.9 1.9-.85 1.9-1.9 1.9c-.14 0-.28-.02-.41-.05l-4.14 2.84c.04.2.07.41.07.63 0 1.6-1.3 2.9-2.9 2.9a2.887 2.887 0 0 1-2.03-.84c-.13-.13-.25-.28-.34-.43l-3.23.93c1.45 5.028 6.063 8.683 11.53 8.683 6.627 0 12-5.373 12-12s-5.373-12-12-12zm-3.55 17.51c0 .77-.63 1.4-1.4 1.4s-1.4-.63-1.4-1.4.63-1.4 1.4-1.4 1.4.63 1.4 1.4z"/>
                    </svg>
                    Sign in with Steam
                </button>
            </div>
        </div>
    );
}
