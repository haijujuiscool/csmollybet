const db = require('./database');

let priceCache = {};
let steamPriceCache = {};
let lastFetchTime = 0;

// Fetch prices from CSGOTrader public JSON APIs (Buff163 primary + Steam Market fallback)
const fetchPrices = async () => {
    try {
        console.log('[Tradebot] Fetching live CS2 skin prices from CSGOTrader API...');
        const [buffRes, steamRes] = await Promise.all([
            fetch('https://prices.csgotrader.app/latest/buff163.json'),
            fetch('https://prices.csgotrader.app/latest/steam.json')
        ]);
        if (buffRes.ok) {
            priceCache = await buffRes.json();
        } else {
            console.warn(`[Tradebot] Buff163 prices returned HTTP ${buffRes.status}`);
        }
        if (steamRes.ok) {
            steamPriceCache = await steamRes.json();
        } else {
            console.warn(`[Tradebot] Steam prices returned HTTP ${steamRes.status}`);
        }
        lastFetchTime = Date.now();
        console.log('[Tradebot] Successfully cached live skin prices (Buff163 + Steam Market).');
    } catch (err) {
        console.error('[Tradebot] Failed to fetch live CS2 prices, using fallback prices:', err.message);
    }
};

// Start fetching prices on service load
fetchPrices();
// Keep updated every 6 hours
setInterval(fetchPrices, 6 * 60 * 60 * 1000);

const getItemPrice = (name) => {
    // Primary: Check Buff163 cache
    if (priceCache && priceCache[name]) {
        const itemData = priceCache[name];
        const price = itemData.starting_at?.price || itemData.highest_order?.price;
        if (price && price > 0) {
            return parseFloat(price.toFixed(2));
        }
    }
    
    // Fallback: Check Steam Market prices
    if (steamPriceCache && steamPriceCache[name]) {
        const steamData = steamPriceCache[name];
        // Use most recent price available: 24h > 7d > 30d > 90d
        const steamPrice = steamData.last_24h || steamData.last_7d || steamData.last_30d || steamData.last_90d;
        if (steamPrice && steamPrice > 0) {
            return parseFloat(steamPrice.toFixed(2));
        }
    }
    
    // Final fallback: minimum price (avoid absurd random values)
    return 0.03;
};

// Check and release pending 50% payout of matured deposits (7 days trade lock)
const startPayoutReleaseLoop = () => {
    // Run check immediately, then every 30 seconds
    const checkPayouts = () => {
        const query = `
            SELECT d.id, d.user_id, d.item_name, d.item_value, u.username 
            FROM deposits d 
            JOIN users u ON d.user_id = u.id 
            WHERE d.status = 'accepted_half' AND datetime(d.payout_date) <= datetime('now')
        `;
        db.all(query, (err, rows) => {
            if (err) {
                if (err.message.includes('no such table: deposits')) {
                    return; // Ignore gracefully during DB initialization
                }
                console.error('[Tradebot] Error checking matured payouts:', err.message);
                return;
            }

            if (rows && rows.length > 0) {
                console.log(`[Tradebot] Found ${rows.length} matured deposits ready for payout.`);
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    let success = true;
                    rows.forEach(row => {
                        const remainingPayout = row.item_value * 0.5;
                        if (!success) return;
                        db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [remainingPayout, row.user_id], (updateErr) => {
                            if (updateErr) {
                                console.error(`[Tradebot] Error crediting remaining gems to user ${row.user_id}:`, updateErr.message);
                                success = false;
                                db.run('ROLLBACK');
                                return;
                            }
                            db.run('UPDATE deposits SET status = \'completed\' WHERE id = ?', [row.id], (statusErr) => {
                                if (statusErr) {
                                    console.error(`[Tradebot] Error updating deposit ${row.id} status:`, statusErr.message);
                                    success = false;
                                    db.run('ROLLBACK');
                                    return;
                                }
                                console.log(`[Tradebot] Payout successful: Credited ${remainingPayout} gems to ${row.username} for matured deposit of ${row.item_name}.`);
                            });
                        });
                    });
                    if (success) {
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) console.error('[Tradebot] Transaction commit failed:', commitErr.message);
                        });
                    }
                });
            }
        });
    };

    checkPayouts();
    setInterval(checkPayouts, 30000); // Check every 30 seconds
};

// Simulated mock CS2 items for inventory loading
const MOCK_INVENTORY_ITEMS = [
    { name: "AK-47 | Redline (FT)", value: 45.0, image_url: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSI_-RHGavzedxuPUnFniykEtzsWWBzoyuIiifaAchDZUjTOZe4RC_w4buM-6z7wzbgokUyzK-0H08hRGDMA" },
    { name: "M4A1-S | Printstream (MW)", value: 320.0, image_url: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_eka6F_H_OGMWrEwL9lj_F7Rienhgk1tjyIpYPwJiPTcAAoCpsiEO5ZsUbpm9C2Zuni4VHW3o5EzSX62HxP7Sg96-hWVqYi_6TJz1aW0nxrkGs" },
    { name: "★ Specialist Gloves | Crimson Kimono (FT)", value: 950.0, image_url: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Tk71ruQBH4jYLf-i5U-fe9V7d9JfOaD2uZ0vpJu-hkQCe8qhkusjCKlIvqHjnCOml8U8UoAfkItBLswdbuNbjr5FHdjNkUzSv73C1K5y46tu4EUvAg-6bU3FrBMOE4_9BdcyhkRns5" },
    { name: "Glock-18 | Fade (FN)", value: 850.0, image_url: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnj9h1a7s2oaaBoH_yaCW-Ej-8u5bZvHnq1w0Vz62TUzNj4eCiVblMmXMAkROJeskLpkdXjMrzksVTAy9US8PY25So" },
    { name: "USP-S | Kill Confirmed (FT)", value: 38.0, image_url: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkjYbf7itX6vytbbZSI-WsG3SA_uV_vO1WTCa9kxQ1vjiBpYPwJiPTcFB2Xpp5TO5cskG9lYCxZu_jsVCL3o4Xnij23ClO5ik9tegFA_It8qHJz1aWe-uc160" },
    { name: "AWP | Dragon Lore (BS)", value: 3200.0, image_url: "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk4veqYaF7IfysCnWRxuF4j-B-Xxa_nBovp3Pdwtj9cC_GaAd0DZdwQu9fuhS4kNy0NePntVTbjYpCyyT_3CgY5i9j_a9cBkcCWUKV" }
];

module.exports = {
    startPayoutReleaseLoop,
    MOCK_INVENTORY_ITEMS,
    getItemPrice
};
