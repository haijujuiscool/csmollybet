import React from 'react';

export default function Terms() {
    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '40px', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent-gold)', marginBottom: '30px', textAlign: 'center' }}>
                Terms of Service & Privacy Policy
            </h1>

            <section style={{ marginBottom: '35px' }}>
                <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '15px' }}>
                    1. Terms of Service
                </h2>
                <p style={{ color: '#ccc', marginBottom: '12px', lineHeight: '1.6' }}>
                    Welcome to Bluegem.com. By accessing or using our services, you agree to comply with and be bound by the following Terms of Service.
                </p>
                <h3 style={{ color: 'var(--accent-gold)', fontSize: '1.1rem', margin: '15px 0 8px' }}>Eligibility</h3>
                <p style={{ color: '#aaa', marginBottom: '12px', lineHeight: '1.6' }}>
                    You must be at least 18 years of age (or the age of majority in your jurisdiction) to register an account and play on Bluegem.com. Any account created by an individual under the age of 18 is a violation of these terms and will be terminated immediately.
                </p>
                <h3 style={{ color: 'var(--accent-gold)', fontSize: '1.1rem', margin: '15px 0 8px' }}>Virtual Goods & Gems</h3>
                <p style={{ color: '#aaa', marginBottom: '12px', lineHeight: '1.6' }}>
                    Bluegem.com operates utilizing virtual gems. Gems have no real-world monetary value and cannot be redeemed for real currency. Any transactions involving virtual items or skins are subject to trade restrictions, review periods, and admin verification.
                </p>
                <h3 style={{ color: 'var(--accent-gold)', fontSize: '1.1rem', margin: '15px 0 8px' }}>Prohibited Conduct</h3>
                <p style={{ color: '#aaa', marginBottom: '12px', lineHeight: '1.6' }}>
                    Users are prohibited from abusing bugs, utilizing automated bots or scripts, or attempting to exploit the system. Any suspicious activities will result in an immediate account ban and forfeiture of all virtual balances.
                </p>
            </section>

            <section style={{ marginBottom: '35px' }}>
                <h2 style={{ fontSize: '1.5rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '15px' }}>
                    2. Privacy Policy
                </h2>
                <p style={{ color: '#ccc', marginBottom: '12px', lineHeight: '1.6' }}>
                    Your privacy is important to us. This Privacy Policy explains how we collect, use, and store information.
                </p>
                <h3 style={{ color: 'var(--accent-gold)', fontSize: '1.1rem', margin: '15px 0 8px' }}>Information We Collect</h3>
                <p style={{ color: '#aaa', marginBottom: '12px', lineHeight: '1.6' }}>
                    We collect your Steam profile information (including your Steam ID, username, and avatar) when you authenticate via Steam OpenID. We also collect and verify your Date of Birth to enforce the 18+ age restriction requirement.
                </p>
                <h3 style={{ color: 'var(--accent-gold)', fontSize: '1.1rem', margin: '15px 0 8px' }}>How We Protect Your Data</h3>
                <p style={{ color: '#aaa', marginBottom: '12px', lineHeight: '1.6' }}>
                    We do not share your private account data or trade links with third parties. All connections and balances are secured and stored internally in our local database.
                </p>
            </section>

            <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <p style={{ color: '#777', fontSize: '0.9rem' }}>Last updated: June 2026</p>
            </div>
        </div>
    );
}
