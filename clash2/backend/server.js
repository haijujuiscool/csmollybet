require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const battleEngine = require('./battleEngine');
const chatEngine = require('./chatEngine');
const { getItemPrice } = require('./tradebotService');
const steamBot = require('./steamBot');

const {
    validateBody,
    validateString,
    validateNumber,
    validateInteger,
    isString,
    isNumber,
    isInteger
} = require('./validation');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // For localhost development
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

let isShutdown = false;

app.use((req, res, next) => {
    if (req.path === '/api/shutdown') {
        isShutdown = true;
        return res.send('SHUTDOWN ACTIVATED');
    }
    if (req.path === '/api/reactivate') {
        isShutdown = false;
        return res.send('REACTIVATED');
    }
    if (isShutdown && req.path !== '/api/status') {
        return res.status(503).json({ error: 'SITE OFFLINE' });
    }
    next();
});

app.get('/api/status', (req, res) => {
    res.json({ isShutdown });
});

// --- GAME FEED LOGIC ---
global.gameFeedHistory = [];
global.broadcastGameResult = (username, gameName, betAmount, payoutAmount, multiplier) => {
    const profit = payoutAmount - betAmount;
    db.get('SELECT avatar FROM users WHERE username = ?', [username], (err, row) => {
        const update = {
            username,
            avatar: row && row.avatar ? row.avatar : '',
            game: gameName,
            bet: parseFloat(betAmount.toFixed(2)),
            multiplier: parseFloat(multiplier.toFixed(2)),
            profit: parseFloat(profit.toFixed(2)),
            timestamp: Date.now()
        };
        global.gameFeedHistory.push(update);
        if (global.gameFeedHistory.length > 50) {
            global.gameFeedHistory.shift();
        }
        io.emit('game_feed_update', update);
    });
};

battleEngine(io);
chatEngine(io);

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

const upload = multer({ 
    storage, 
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.use('/uploads', express.static(uploadDir));

const transfersDir = path.join(__dirname, 'public', 'transfers');
if (!fs.existsSync(transfersDir)) {
    fs.mkdirSync(transfersDir, { recursive: true });
}
app.use('/transfers', express.static(transfersDir));

const { JWT_SECRET } = require('./security');

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.sendStatus(403);
        db.get('SELECT is_banned, role, token_version FROM users WHERE id = ?', [decoded.id], (dbErr, row) => {
            if (dbErr || !row) return res.sendStatus(403);
            if (row.is_banned) {
                return res.status(403).json({ error: 'Your account has been banned.' });
            }
            if (decoded.token_version !== undefined && row.token_version !== decoded.token_version) {
                return res.sendStatus(401);
            }
            req.user = { ...decoded, role: row.role };
            next();
        });
    });
};

const wagerGems = (userId, amount) => {
    if (!amount || amount <= 0) return;
    db.run('UPDATE users SET wager_req = CASE WHEN wager_req - ? < 0 THEN 0 ELSE wager_req - ? END WHERE id = ?', [amount, amount, userId], (err) => {
        if (err) console.error('[Wager] Failed to update wager requirement:', err.message);
    });
    trackAffiliateWager(userId, amount);
};

const logBalanceChange = (userId, change, description, multiplier) => {
    db.get('SELECT gems FROM users WHERE id = ?', [userId], (err, row) => {
        if (err || !row) return;
        db.run('INSERT INTO balance_history (user_id, change, new_balance, description, multiplier) VALUES (?, ?, ?, ?, ?)',
            [userId, change, row.gems, description || null, multiplier || null],
            (err) => { if (err) console.error('[BalanceLog] Failed to log:', err.message); }
        );
    });
};

// Compute SHA256 hash of the required PFP image for requirements check
let requiredPfpHash = null;
const pfpPath = path.join(__dirname, '..', 'frontend', 'public', 'pfp.png');
(async () => {
    try {
        if (fs.existsSync(pfpPath)) {
            const imgBuffer = fs.readFileSync(pfpPath);
            const resized = await sharp(imgBuffer).resize(32, 32).grayscale().raw().toBuffer();
            requiredPfpHash = require('crypto').createHash('sha256').update(resized).digest('hex');
            console.log('[PFP] Required PFP hash computed:', requiredPfpHash);
        } else {
            console.warn('[PFP] pfp.png not found at', pfpPath);
        }
    } catch (e) {
        console.error('[PFP] Error computing PFP hash:', e.message);
    }
})();

// Affiliate tracking helpers
const trackAffiliateDeposit = (userId, amount) => {
    if (!amount || amount <= 0) return;
    db.get('SELECT referred_by FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || !user.referred_by) return;
        const commission = amount * 0.05; // 5% of deposit
        db.run('UPDATE users SET gems = gems + ?, affiliate_earnings = affiliate_earnings + ? WHERE id = ?',
            [commission, commission, user.referred_by]);
        db.run('INSERT INTO affiliate_transactions (affiliate_id, referred_user_id, type, amount, commission) VALUES (?, ?, ?, ?, ?)',
            [user.referred_by, userId, 'deposit', amount, commission]);
    });
};

const trackAffiliateWager = (userId, betAmount) => {
    if (!betAmount || betAmount <= 0) return;
    db.get('SELECT referred_by FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user || !user.referred_by) return;
        const commission = betAmount * 0.003; // ~10% of house edge (~3%)
        db.run('UPDATE users SET gems = gems + ?, affiliate_earnings = affiliate_earnings + ? WHERE id = ?',
            [commission, commission, user.referred_by]);
        db.run('INSERT INTO affiliate_transactions (affiliate_id, referred_user_id, type, amount, commission) VALUES (?, ?, ?, ?, ?)',
            [user.referred_by, userId, 'wager', betAmount, commission]);
    });
};

// Helper to apply a referral code
const applyReferralCode = (userId, code) => {
    return new Promise((resolve, reject) => {
        if (!code || typeof code !== 'string') return reject('Invalid referral code');
        db.get('SELECT id FROM users WHERE affiliate_code = ? AND id != ?', [code.toLowerCase(), userId], (err, aff) => {
            if (err) return reject('Database error');
            if (!aff) return reject('Invalid referral code');
            db.get('SELECT referred_by, onboarding_done FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) return reject('Database error');
                if (!user) return reject('User not found');
                if (user.referred_by) return reject('You already used a referral code');
                if (user.onboarding_done) return reject('Onboarding already completed');
                db.run('UPDATE users SET referred_by = ?, welcome_cases = 3, onboarding_done = 1 WHERE id = ?', [aff.id, userId], (err) => {
                    if (err) return reject('Database error updating user');
                    resolve({ cases: 3, affiliateName: null });
                });
            });
        });
    });
};

// Routes
// Steam OpenID Authentication Redirect
app.get('/api/auth/steam', (req, res) => {
    let origin = 'http://localhost:5173'; // Default fallback
    if (req.headers.referer) {
        try {
            origin = new URL(req.headers.referer).origin;
        } catch (e) {}
    } else if (req.headers.host) {
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        let host = req.headers.host;
        if (host.includes('3001')) {
            host = host.replace('3001', '5173');
        }
        origin = `${protocol}://${host}`;
    }

    const returnTo = `${origin}/api/auth/steam/return`;
    const realm = origin;

    const params = new URLSearchParams({
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': returnTo,
        'openid.realm': realm,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
    });

    res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
});

// Steam OpenID Authentication Callback
app.get('/api/auth/steam/return', async (req, res) => {
    try {
        const params = req.query;
        // Verify assertion with Steam
        const verificationParams = new URLSearchParams(params);
        verificationParams.set('openid.mode', 'check_authentication');

        const response = await fetch('https://steamcommunity.com/openid/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: verificationParams.toString()
        });
        const text = await response.text();

        if (!text.includes('is_valid:true')) {
            return res.status(400).send('Steam authentication failed: Invalid assertion');
        }

        const claimedId = params['openid.claimed_id'];
        if (!claimedId) {
            return res.status(400).send('Steam authentication failed: Missing claimed_id');
        }

        const steamid = claimedId.split('/id/')[1];
        if (!steamid) {
            return res.status(400).send('Steam authentication failed: Could not parse steamid');
        }

        // Fetch Steam Profile Data (username and avatar) from Steam XML API
        let username = 'Steam User';
        let avatar = '';
        try {
            const profileRes = await fetch(`https://steamcommunity.com/profiles/${steamid}/?xml=1`);
            if (profileRes.ok) {
                const xml = await profileRes.text();
                const steamIDMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/) || xml.match(/<steamID>(.*?)<\/steamID>/);
                const avatarFullMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/) || xml.match(/<avatarFull>(.*?)<\/avatarFull>/);
                if (steamIDMatch) username = steamIDMatch[1];
                if (avatarFullMatch) avatar = avatarFullMatch[1];
            }
        } catch (profileErr) {
            console.error('Failed to fetch Steam profile XML:', profileErr);
        }

        // Check if user exists, otherwise create them
        db.get('SELECT * FROM users WHERE steamid = ?', [steamid], (err, user) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error');
            }

            if (user) {
                // Update username/avatar if they changed on Steam
                db.run('UPDATE users SET username = ?, avatar = ? WHERE id = ?', [username, avatar, user.id], (updateErr) => {
                    if (updateErr) console.error('Failed to update user profile info:', updateErr);
                    
                    const token = jwt.sign({ id: user.id, username, role: user.role, token_version: user.token_version || 0 }, JWT_SECRET);
                    sendAuthHTML(res, token);
                });
            } else {
                // Register a new user with an auto-generated affiliate code
                const initialGems = 0.1;
                const initialWagerReq = 2.0;
                db.run('INSERT INTO users (steamid, username, avatar, gems, role, wager_req, onboarding_done, player_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                    [steamid, username, avatar, initialGems, 'user', initialWagerReq, 0, 100000 + Math.floor(Math.random() * 900000)], 
                    function (insertErr) {
                        if (insertErr) {
                            console.error(insertErr);
                            return res.status(500).send('Database error registering user');
                        }
                        const token = jwt.sign({ id: this.lastID, username, role: 'user', token_version: 0 }, JWT_SECRET);
                        sendAuthHTML(res, token);
                    }
                );
            }
        });
    } catch (err) {
        console.error('Steam Auth return handler error:', err);
        res.status(500).send('Internal server error');
    }
});

// Helper to return HTML that saves token to localStorage and redirects to Home
function sendAuthHTML(res, token) {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authenticating...</title>
        </head>
        <body>
            <p style="text-align: center; margin-top: 50px; font-family: sans-serif; color: #fff; background-color: #0b0e11;">Authenticating with Steam, please wait...</p>
            <script>
                localStorage.setItem('token', ${JSON.stringify(token)});
                window.location.href = '/';
            </script>
        </body>
        </html>
    `);
}

app.get('/api/me', authenticateToken, (req, res) => {
    db.get('SELECT id, username, gems, role, avatar, steamid, trade_url, date_of_birth, accepted_tos, wager_req, affiliate_code, affiliate_earnings, referred_by, last_daily_case, welcome_cases, daily_case_streak, onboarding_done, player_id FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

app.post('/api/auth/logout-all', authenticateToken, (req, res) => {
    db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.user.id], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to invalidate sessions.' });
        }
        res.json({ success: true, message: 'All sessions logged out.' });
    });
});

app.post('/api/user/verify-age', authenticateToken, validateBody({
    dob: val => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val),
    acceptedTos: val => typeof val === 'boolean'
}), (req, res) => {
    const { dob, acceptedTos } = req.body;
    
    // Check if user is over 18 years old
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    if (age < 18) {
        return res.status(400).json({ error: 'You must be at least 18 years old to register.' });
    }

    if (!acceptedTos) {
        return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy to continue.' });
    }

    db.run('UPDATE users SET date_of_birth = ?, accepted_tos = ? WHERE id = ?', [dob, 1, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to complete registration verification.' });
        res.json({ success: true, message: 'Verification successful.' });
    });
});

app.post('/api/claim-free-gems', authenticateToken, (req, res) => {
    db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        if (user.gems >= 20) {
            return res.status(400).json({ error: 'You already have 20 or more gems.' });
        }
        db.run('UPDATE users SET gems = 20 WHERE id = ?', [req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to claim gems' });
            logBalanceChange(req.user.id, 20 - user.gems, 'FreeGems', null);
            res.json({ message: 'Balance restored to 20 gems', newBalance: 20 });
        });
    });
});

// --- TRADEBOT / DEPOSIT / WITHDRAW ENDPOINTS ---

// Fetch user's Steam inventory (real CS2 items if steamid exists, otherwise fallback to mock inventory)
// In-memory inventory cache: { steamid: { data: [...], timestamp: Date.now() } }
const inventoryCache = new Map();
const INVENTORY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
let steamRateLimitUntil = 0; // Timestamp until which we should not call Steam

app.get('/api/inventory', authenticateToken, async (req, res) => {
    db.get('SELECT steamid FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });

        if (!user.steamid) {
            return res.status(400).json({ error: 'No Steam account linked. Please log in with Steam first.' });
        }

        // Check cache first
        const cached = inventoryCache.get(user.steamid);
        if (cached && (Date.now() - cached.timestamp) < INVENTORY_CACHE_TTL) {
            console.log(`[Inventory] Serving cached inventory for ${user.steamid} (${cached.data.length} items, age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
            return res.json(cached.data);
        }

        // Check global rate limit cooldown
        if (Date.now() < steamRateLimitUntil) {
            const waitSec = Math.ceil((steamRateLimitUntil - Date.now()) / 1000);
            // If we have stale cache, serve it
            if (cached) {
                console.log(`[Inventory] Rate-limited, serving stale cache for ${user.steamid}`);
                return res.json(cached.data);
            }
            return res.status(429).json({ error: `Steam is rate-limiting us. Please try again in ${waitSec} seconds.` });
        }

        const steamUrl = `https://steamcommunity.com/inventory/${user.steamid}/730/2?l=english&count=2000`;
        const fetchOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': `https://steamcommunity.com/profiles/${user.steamid}/inventory/`
            }
        };

        const maxRetries = 3;
        const retryDelays = [5000, 15000, 30000]; // 5s, 15s, 30s
        let lastStatus = 0;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`[Inventory] Fetching Steam inventory for ${user.steamid} (attempt ${attempt + 1}/${maxRetries})...`);
                const response = await fetch(steamUrl, fetchOptions);
                lastStatus = response.status;

                if (response.status === 403) {
                    return res.status(403).json({ error: 'Your Steam inventory is set to private. Please set your CS2 inventory to public in your Steam Privacy Settings and try again.' });
                }

                if (response.status === 429 || response.status === 400) {
                    const body = await response.text();
                    console.warn(`[Inventory] Steam returned HTTP ${response.status} (attempt ${attempt + 1}). Body: ${body.substring(0, 200)}`);
                    
                    if (attempt < maxRetries - 1) {
                        const delay = retryDelays[attempt];
                        console.log(`[Inventory] Retrying in ${delay / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    // Set global cooldown on final failure
                    steamRateLimitUntil = Date.now() + 60000; // 60s cooldown
                    
                    if (cached) {
                        console.log(`[Inventory] All retries failed, serving stale cache`);
                        return res.json(cached.data);
                    }
                    return res.status(429).json({ error: 'Steam is temporarily blocking inventory requests (rate limit). Please wait 1-2 minutes and try again.' });
                }

                if (response.status === 200) {
                    const data = await response.json();
                    if (!data || !data.assets || !data.descriptions) {
                        inventoryCache.set(user.steamid, { data: [], timestamp: Date.now() });
                        return res.json([]);
                    }

                    const itemsMap = new Map();
                    data.descriptions.forEach(desc => {
                        itemsMap.set(desc.classid, desc);
                    });

                    const inventory = data.assets.map(asset => {
                        const desc = itemsMap.get(asset.classid);
                        if (!desc || desc.tradable !== 1) return null;

                        const name = desc.market_name;
                        const value = getItemPrice(name);
                        const imageUrl = desc.icon_url 
                            ? `https://community.akamai.steamstatic.com/economy/image/${desc.icon_url}`
                            : '';

                        // Extract rarity from Steam description
                        let rarity = '';
                        // First try tags
                        if (desc.tags && Array.isArray(desc.tags)) {
                            const rarityTag = desc.tags.find(t => 
                                t.category === 'Rarity' || t.category === 'Rarity Category' || t.category === 'Quality'
                            );
                            if (rarityTag && rarityTag.name) rarity = rarityTag.name.replace(/ Grade$/, '');
                        }
                        // Fallback: parse from type field (e.g. "Covert Pistol", "Mil-Spec Grade SMG")
                        if (!rarity && desc.type) {
                            const knownRarities = ['Consumer', 'Industrial', 'Mil-Spec', 'Restricted', 'Classified', 'Covert', 'Special', 'Rare', 'Extraordinary', 'Contraband', 'Ancient', 'Legendary', 'Immortal', 'Arcana'];
                            const match = knownRarities.find(r => desc.type.startsWith(r));
                            if (match) rarity = match;
                        }

                        return { name, value, image_url: imageUrl, assetid: asset.assetid, rarity };
                    }).filter(item => item !== null);

                    // Sort inventory items by value descending (most to least)
                    inventory.sort((a, b) => b.value - a.value);

                    // Cache the result
                    inventoryCache.set(user.steamid, { data: inventory, timestamp: Date.now() });
                    console.log(`[Inventory] Successfully loaded and cached ${inventory.length} tradable items for ${user.steamid}.`);
                    return res.json(inventory);
                }

                // Other unexpected status
                const body = await response.text();
                console.warn(`[Inventory] Unexpected HTTP ${response.status}. Body: ${body.substring(0, 200)}`);
                return res.status(502).json({ error: `Steam returned an unexpected error (HTTP ${response.status}). Please try again later.` });

            } catch (fetchErr) {
                console.error(`[Inventory] Network error (attempt ${attempt + 1}):`, fetchErr.message);
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
                }
            }
        }

        console.error(`[Inventory] All ${maxRetries} attempts failed for steamid ${user.steamid}. Last status: ${lastStatus}`);
        res.status(502).json({ error: 'Could not connect to Steam servers after multiple attempts. Please try again in a few minutes.' });
    });
});

// Initiates a deposit of selected inventory items (creates a simulated or real pending trade offer)
app.post('/api/deposit', authenticateToken, validateBody({
    items: val => Array.isArray(val) && val.length >= 1 && val.every(i => 
        i && typeof i.name === 'string' && typeof i.value === 'number'
    )
}), (req, res) => {
    const { items } = req.body;
    const userId = req.user.id;

    // Check if real tradebot is enabled
    if (steamBot.isEnabled) {
        db.get('SELECT trade_url FROM users WHERE id = ?', [userId], async (err, userRow) => {
            if (err || !userRow) {
                return res.status(500).json({ error: 'Server error retrieving user data' });
            }

            if (!userRow.trade_url || !userRow.trade_url.startsWith('http')) {
                return res.status(400).json({ error: 'Please configure your Steam Trade URL first in the Deposit tab.' });
            }

            try {
                // Send the real trade offer
                const realTradeOfferId = await steamBot.sendRealDepositTradeOffer(userRow.trade_url, items, userId);

                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    const stmt = db.prepare(`
                        INSERT INTO deposits (user_id, item_name, item_value, status, payout_date, image_url, trade_offer_id) 
                        VALUES (?, ?, ?, 'pending_offer', NULL, ?, ?)
                    `);

                    let insertErr = null;
                    for (const item of items) {
                        stmt.run([userId, item.name, item.value, item.image_url || '', realTradeOfferId], (err) => {
                            if (err && !insertErr) insertErr = err;
                        });
                    }

                    stmt.finalize(() => {
                        if (insertErr) {
                            console.error(insertErr);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Database error logging deposits' });
                        }

                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                console.error(commitErr);
                                return res.status(500).json({ error: 'Transaction commit failed' });
                            }

                            res.json({
                                success: true,
                                isRealTrade: true,
                                message: `Real trade offer #${realTradeOfferId} sent! Please accept it on Steam.`,
                                tradeOfferId: realTradeOfferId,
                                items
                            });
                        });
                    });
                });
            } catch (tradeErr) {
                console.error('[SteamBot] Error sending trade offer:', tradeErr);
                return res.status(500).json({ error: tradeErr.message || 'Failed to send real Steam trade offer. Ensure your inventory is public and trade URL is correct.' });
            }
        });
    } else {
        // Fallback to simulated mode
        const mockTradeOfferId = 'offer_' + Math.floor(Math.random() * 10000000);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const stmt = db.prepare(`
                INSERT INTO deposits (user_id, item_name, item_value, status, payout_date, image_url, trade_offer_id) 
                VALUES (?, ?, ?, 'pending_offer', NULL, ?, ?)
            `);

            let insertErr = null;
            for (const item of items) {
                stmt.run([userId, item.name, item.value, item.image_url || '', mockTradeOfferId], (err) => {
                    if (err && !insertErr) {
                        insertErr = err;
                    }
                });
            }

            stmt.finalize(() => {
                if (insertErr) {
                    console.error(insertErr);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Database error logging deposits' });
                }

                db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                        console.error(commitErr);
                        return res.status(500).json({ error: 'Transaction commit failed' });
                    }

                    res.json({
                        success: true,
                        isRealTrade: false,
                        message: `Simulated trade offer ${mockTradeOfferId} sent.`,
                        tradeOfferId: mockTradeOfferId,
                        items
                    });
                });
            });
        });
    }
});

// Confirms a pending deposit trade offer, inserting items into user's inventory
app.post('/api/deposit/confirm', authenticateToken, validateBody({
    tradeOfferId: val => typeof val === 'string'
}), (req, res) => {
    const { tradeOfferId } = req.body;
    const userId = req.user.id;

    db.all('SELECT * FROM deposits WHERE user_id = ? AND trade_offer_id = ? AND status = \'pending_offer\'', [userId, tradeOfferId], (err, items) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error fetching trade offer' });
        }

        if (!items || items.length === 0) {
            return res.status(404).json({ error: 'Trade offer not found or already processed' });
        }

        const totalValue = items.reduce((sum, item) => sum + item.item_value, 0);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Insert each item into user_inventories
            const stmt = db.prepare('INSERT INTO user_inventories (user_id, item_name, item_value, image_url, trade_offer_id, status) VALUES (?, ?, ?, ?, ?, ?)');
            let insertErr = null;
            for (const item of items) {
                stmt.run([userId, item.item_name, item.item_value, item.image_url || '', tradeOfferId, 'available'], (err) => {
                    if (err && !insertErr) insertErr = err;
                });
            }

            stmt.finalize(() => {
                if (insertErr) {
                    console.error(insertErr);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Database error adding items to inventory' });
                }

                // Delete processed deposit records
                db.run('DELETE FROM deposits WHERE user_id = ? AND trade_offer_id = ?', [userId, tradeOfferId], (delErr) => {
                    if (delErr) {
                        console.error(delErr);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Database error cleaning up deposits' });
                    }

                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            console.error(commitErr);
                            return res.status(500).json({ error: 'Transaction commit failed' });
                        }

                        res.json({
                            success: true,
                            message: `Successfully deposited ${items.length} items to your inventory.`,
                            items: items.length
                        });
                        trackAffiliateDeposit(userId, totalValue);
                    });
                });
            });
        });
    });
});

// Updates the authenticated user's Steam Trade URL
app.post('/api/user/trade-url', authenticateToken, validateBody({
    tradeUrl: val => typeof val === 'string' && val.startsWith('https://steamcommunity.com/tradeoffer/new/')
}), (req, res) => {
    const { tradeUrl } = req.body;
    const userId = req.user.id;

    db.run('UPDATE users SET trade_url = ? WHERE id = ?', [tradeUrl, userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error saving trade URL' });
        }
        res.json({ success: true, message: 'Trade URL successfully updated.' });
    });
});

// Checks status of a specific deposit trade offer (for polling in the frontend)
app.get('/api/deposit/status/:tradeOfferId', authenticateToken, (req, res) => {
    const { tradeOfferId } = req.params;
    const userId = req.user.id;

    db.all('SELECT status FROM deposits WHERE user_id = ? AND trade_offer_id = ?', [userId, tradeOfferId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Deposit not found' });
        }

        // If any item is still 'pending_offer', the trade offer is pending.
        // If all items are 'accepted_half' or 'completed', the trade is accepted.
        const allAccepted = rows.every(r => r.status === 'accepted_half' || r.status === 'completed');
        res.json({
            tradeOfferId,
            status: allAccepted ? 'accepted' : 'pending'
        });
    });
});

// Fetches user's inventory items
app.get('/api/user-inventory', authenticateToken, (req, res) => {
    db.all('SELECT * FROM user_inventories WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to fetch inventory' });
        }
        res.json(rows || []);
    });
});

// Sell an inventory item for gems
app.post('/api/inventory/sell', authenticateToken, validateBody({
    itemId: val => typeof val === 'number'
}), (req, res) => {
    const { itemId } = req.body;
    const userId = req.user.id;

    db.get('SELECT * FROM user_inventories WHERE id = ? AND user_id = ? AND status = \'available\'', [itemId, userId], (err, item) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!item) return res.status(404).json({ error: 'Item not found or already sold/withdrawn' });

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [item.item_value, userId], (err) => {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Database error crediting gems' }); }
                logBalanceChange(userId, item.item_value, 'Sold: ' + item.item_name, null);
                db.run('UPDATE user_inventories SET status = \'sold\' WHERE id = ?', [itemId], (err) => {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Database error updating item' }); }
                    db.run('COMMIT', (err) => {
                        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'Transaction commit failed' }); }
                        res.json({ success: true, message: `Sold ${item.item_name} for ${item.item_value.toFixed(2)} gems.`, gems: item.item_value });
                    });
                });
            });
        });
    });
});

// Withdraw an inventory item (mark for withdrawal)
app.post('/api/inventory/withdraw', authenticateToken, validateBody({
    itemId: val => typeof val === 'number'
}), (req, res) => {
    const { itemId } = req.body;
    const userId = req.user.id;

    db.get('SELECT * FROM user_inventories WHERE id = ? AND user_id = ? AND status = \'available\'', [itemId, userId], (err, item) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!item) return res.status(404).json({ error: 'Item not found or already sold/withdrawn' });

        db.run('UPDATE user_inventories SET status = \'withdrawing\' WHERE id = ?', [itemId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error updating item' });
            res.json({ success: true, message: `Withdrawal request for ${item.item_name} submitted.` });
        });
    });
});

// Fetches balance history for the authenticated user
app.get('/api/balance-history', authenticateToken, (req, res) => {
    db.all('SELECT id, change, new_balance, description, multiplier, timestamp FROM balance_history WHERE user_id = ? ORDER BY id DESC LIMIT 200', [req.user.id], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to fetch balance history' });
        }
        res.json(rows || []);
    });
});

// Fetches items in the bot's inventory available for withdrawal
app.get('/api/bot-inventory', (req, res) => {
    db.all('SELECT * FROM bot_inventory ORDER BY item_value ASC', (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to fetch bot inventory' });
        }
        res.json(rows || []);
    });
});

// Withdraws an item from the bot's inventory, deducting gems and creating a review request
app.post('/api/withdraw', authenticateToken, validateBody({
    itemId: val => typeof val === 'number'
}), (req, res) => {
    const { itemId } = req.body;
    const userId = req.user.id;

    db.get('SELECT * FROM bot_inventory WHERE id = ?', [itemId], (err, item) => {
        if (err || !item) {
            return res.status(404).json({ error: 'Item not found in bot inventory' });
        }

        db.get('SELECT username, gems, wager_req FROM users WHERE id = ?', [userId], (err, user) => {
            if (err || !user) {
                return res.status(500).json({ error: 'User check failed' });
            }

            if (user.wager_req > 0) {
                return res.status(400).json({ error: `Wager requirement not met. You must wager another ${user.wager_req.toFixed(2)} gems before you can withdraw.` });
            }

            if (user.gems < item.item_value) {
                return res.status(400).json({ error: `Insufficient gems. You need ${item.item_value} gems to withdraw this item.` });
            }

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Deduct gems
                db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [item.item_value, userId], (deductErr) => {
                    if (deductErr) {
                        console.error(deductErr);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Gems deduction failed' });
                    }

                    logBalanceChange(userId, -item.item_value, 'Withdraw', null);

                    // Create pending review withdrawal
                    db.run('INSERT INTO withdrawals (user_id, username, item_name, item_value, image_url, status) VALUES (?, ?, ?, ?, ?, ?)',
                        [userId, user.username, item.item_name, item.item_value, item.image_url, 'pending_review'], (insertErr) => {
                        if (insertErr) {
                            console.error(insertErr);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to create withdrawal request' });
                        }

                        // Remove item from bot's inventory (so others can't withdraw it)
                        db.run('DELETE FROM bot_inventory WHERE id = ?', [itemId], (deleteErr) => {
                            if (deleteErr) {
                                console.error(deleteErr);
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Failed to reserve item' });
                            }

                            // Commit transaction
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    console.error(commitErr);
                                    return res.status(500).json({ error: 'Transaction commit failed' });
                                }

                                res.json({
                                    success: true,
                                    message: `An admin will review your withdrawal. Your request to withdraw ${item.item_name} has been submitted.`,
                                    remainingGems: user.gems - item.item_value
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// --- ADMIN MANAGEMENT ROUTES ---

// Helper middleware to verify admin role
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    next();
};

// Fetch all users for admin review
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    db.all('SELECT id, username, steamid, gems, role, is_banned FROM users ORDER BY username ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch users' });
        res.json(rows || []);
    });
});

// Ban/unban a user
app.post('/api/admin/ban', authenticateToken, requireAdmin, validateBody({
    userId: val => typeof val === 'number',
    ban: val => typeof val === 'boolean'
}), (req, res) => {
    const { userId, ban } = req.body;
    db.run('UPDATE users SET is_banned = ? WHERE id = ?', [ban ? 1 : 0, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update user ban status' });
        res.json({ success: true, message: `User ban status updated to ${ban}` });
    });
});

// Fetch withdrawals for admin review
app.get('/api/admin/withdrawals', authenticateToken, requireAdmin, (req, res) => {
    db.all('SELECT * FROM withdrawals ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch withdrawals' });
        res.json(rows || []);
    });
});

// Approve or decline a withdrawal
app.post('/api/admin/withdrawals/action', authenticateToken, requireAdmin, validateBody({
    withdrawalId: val => typeof val === 'number',
    action: val => ['approve', 'decline'].includes(val)
}), (req, res) => {
    const { withdrawalId, action } = req.body;

    db.get('SELECT * FROM withdrawals WHERE id = ?', [withdrawalId], (err, withdrawal) => {
        if (err || !withdrawal) return res.status(404).json({ error: 'Withdrawal request not found' });
        if (withdrawal.status !== 'pending_review') {
            return res.status(400).json({ error: 'Withdrawal already processed' });
        }

        if (action === 'approve') {
            // Approve: update status to approved
            db.run('UPDATE withdrawals SET status = ? WHERE id = ?', ['approved', withdrawalId], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: 'Failed to approve withdrawal' });
                res.json({ success: true, message: 'Withdrawal approved successfully' });
            });
        } else {
            // Decline: refund user gems and put item back in inventory (or delete withdrawal record)
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // Refund user gems
                db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [withdrawal.item_value, withdrawal.user_id], (refundErr) => {
                    if (refundErr) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to refund user gems' });
                    }

                    logBalanceChange(withdrawal.user_id, withdrawal.item_value, 'Refund', null);

                    // Set withdrawal status to declined
                    db.run('UPDATE withdrawals SET status = ? WHERE id = ?', ['declined', withdrawalId], (statusErr) => {
                        if (statusErr) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to update withdrawal status' });
                        }

                        // Add item back to bot inventory
                        db.run('INSERT INTO bot_inventory (item_name, item_value, image_url) VALUES (?, ?, ?)',
                            [withdrawal.item_name, withdrawal.item_value, withdrawal.image_url], (invErr) => {
                            if (invErr) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Failed to return item to inventory' });
                            }

                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) return res.status(500).json({ error: 'Transaction commit failed' });
                                res.json({ success: true, message: 'Withdrawal declined and gems refunded.' });
                            });
                        });
                    });
                });
            });
        }
    });
});

// --- CASE ENDPOINTS ---
app.post('/api/upload', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + '.webp';
        const filepath = path.join(uploadDir, filename);

        // Process image with sharp: auto-rotate from EXIF, resize, convert to WebP
        await sharp(req.file.buffer)
            .rotate() // Auto-orient based on EXIF metadata (fixes iPad/iPhone photos)
            .resize({ width: 1920, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filepath);

        res.json({ url: '/uploads/' + filename });
    } catch (err) {
        console.error("Error processing image:", err);
        res.status(500).json({ error: 'Error processing image', details: err.message });
    }
});

app.post('/api/cases', authenticateToken, validateBody({
    name: val => typeof val === 'string' && val.trim().length >= 1 && val.trim().length <= 100,
    imageUrl: val => typeof val === 'string' && val.trim().length >= 1 && val.trim().length <= 500,
    items: val => Array.isArray(val) && val.length >= 1 && val.length <= 100 && val.every(item => 
        item && typeof item === 'object' &&
        typeof item.name === 'string' && item.name.trim().length >= 1 && item.name.trim().length <= 100 &&
        typeof item.value === 'number' && Number.isFinite(item.value) && item.value >= 0 && item.value <= 1000000 &&
        typeof item.odds === 'number' && Number.isFinite(item.odds) && item.odds > 0 && item.odds <= 100 &&
        typeof item.imageUrl === 'string' && item.imageUrl.trim().length >= 1 && item.imageUrl.trim().length <= 500
    )
}), (req, res) => {
    const { name, imageUrl, items } = req.body;

    let expectedReturn = 0;
    let totalOdds = 0;
    
    for (const item of items) {
        expectedReturn += item.value * (item.odds / 100);
        totalOdds += item.odds;
    }

    if (Math.abs(totalOdds - 100) > 0.01) {
        return res.status(400).json({ error: 'Odds must sum to 100%' });
    }

    const caseCost = expectedReturn / 0.99;

    db.run('INSERT INTO cases (owner_id, name, price, image_url) VALUES (?, ?, ?, ?)', 
        [req.user.id, name, caseCost, imageUrl], 
        function(err) {
            if (err) {
                console.error("Error creating case:", err.message);
                return res.status(500).json({ error: 'Server error creating case', details: err.message });
            }
            
            const caseId = this.lastID;
            
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                const stmt = db.prepare('INSERT INTO items (case_id, name, value, odds, image_url) VALUES (?, ?, ?, ?, ?)');
                let itemError = null;

                for (const item of items) {
                    stmt.run([caseId, item.name, item.value, item.odds, item.imageUrl], (err) => {
                        if (err && !itemError) {
                            itemError = err.message;
                            console.error("Error inserting item:", err.message, "Item:", item);
                        }
                    });
                }
                stmt.finalize();

                db.run("COMMIT", () => {
                    if (itemError) {
                        return res.status(500).json({ error: 'Server error adding items', details: itemError });
                    }
                    res.json({ message: 'Case created successfully', caseId, price: caseCost });
                });
            });
    });
});

app.get('/api/cases', (req, res) => {
    db.all('SELECT cases.*, users.username as owner_name FROM cases JOIN users ON cases.owner_id = users.id', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(rows);
    });
});

app.delete('/api/cases/:id', authenticateToken, (req, res) => {
    db.get('SELECT owner_id FROM cases WHERE id = ?', [req.params.id], (err, caseRow) => {
        if (err || !caseRow) return res.status(404).json({ error: 'Case not found' });
        if (caseRow.owner_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
        
        db.run('DELETE FROM items WHERE case_id = ?', [req.params.id], function(err) {
            if (err) {
                console.error("Error deleting items:", err);
                return res.status(500).json({ error: 'Server error deleting items', details: err.message });
            }
            db.run('DELETE FROM cases WHERE id = ?', [req.params.id], function(err) {
                if (err) {
                    console.error("Error deleting case:", err);
                    return res.status(500).json({ error: 'Server error deleting case', details: err.message });
                }
                res.json({ message: 'Case deleted successfully' });
            });
        });
    });
});

app.get('/api/cases/:id', (req, res) => {
    db.get('SELECT cases.*, users.username as owner_name FROM cases JOIN users ON cases.owner_id = users.id WHERE cases.id = ?', [req.params.id], (err, caseRow) => {
        if (err || !caseRow) return res.status(404).json({ error: 'Case not found' });
        
        db.all('SELECT * FROM items WHERE case_id = ?', [req.params.id], (err, items) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            res.json({ ...caseRow, items });
        });
    });
});

app.post('/api/cases/:id/open', authenticateToken, (req, res) => {
    const caseId = req.params.id;
    const userId = req.user.id;
    const mythicSpin = req.body && req.body.mythicSpin === true;

    db.get('SELECT * FROM cases WHERE id = ?', [caseId], (err, caseRow) => {
        if (err || !caseRow) return res.status(404).json({ error: 'Case not found' });

        db.get('SELECT gems FROM users WHERE id = ?', [userId], (err, userRow) => {
            if (err || !userRow) return res.status(500).json({ error: 'User error' });

            if (userRow.gems < caseRow.price) return res.status(400).json({ error: 'Insufficient gems' });

            db.all('SELECT * FROM items WHERE case_id = ?', [caseId], (err, items) => {
                if (err || items.length === 0) return res.status(500).json({ error: 'Case items not found' });

                // Deduct gems
                db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [caseRow.price, userId], () => {
                    wagerGems(userId, caseRow.price);
                    // Payout owner
                    db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [caseRow.price * 0.01, caseRow.owner_id], () => {
                        
                        const threshold = caseRow.price * 2.5; // 150% profit
                        const normalItems = mythicSpin ? items.filter(i => i.value <= threshold) : items;
                        const mythicItems = mythicSpin ? items.filter(i => i.value > threshold) : [];
                        const mythicTotalOdds = mythicItems.reduce((s, i) => s + i.odds, 0);
                        const hasMythicPool = mythicSpin && mythicItems.length > 0 && mythicTotalOdds > 0;

                        // Roll logic
                        let roll = Math.random() * 100;
                        let wonItem = null;
                        let hitMythic = false;
                        let cumProb = 0;

                        if (hasMythicPool) {
                            // Roll against normal items first
                            for (const item of normalItems) {
                                cumProb += item.odds;
                                if (roll <= cumProb) {
                                    wonItem = item;
                                    break;
                                }
                            }
                            // If no normal item hit, we're in mythic territory
                            if (!wonItem) {
                                hitMythic = true;
                                let mythicRoll = Math.random() * mythicTotalOdds;
                                let mythicCum = 0;
                                for (const item of mythicItems) {
                                    mythicCum += item.odds;
                                    if (mythicRoll <= mythicCum) {
                                        wonItem = item;
                                        break;
                                    }
                                }
                                if (!wonItem) wonItem = mythicItems[mythicItems.length - 1];
                            }
                        } else {
                            // Normal roll
                            for (const item of items) {
                                cumProb += item.odds;
                                if (roll <= cumProb) {
                                    wonItem = item;
                                    break;
                                }
                            }
                            if (!wonItem) wonItem = items[items.length - 1];
                        }

                        // Add won value
                        db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [wonItem.value, userId], () => {
                            logBalanceChange(userId, wonItem.value, 'Cases', caseRow.price > 0 ? wonItem.value / caseRow.price : 0);
                            wonItem.isMythicHit = hitMythic;
                            if (global.broadcastGameResult) {
                                global.broadcastGameResult(req.user.username, 'Cases', caseRow.price, wonItem.value, caseRow.price > 0 ? wonItem.value / caseRow.price : 0);
                            }
                            res.json({ 
                                wonItem, 
                                items: items,
                                isMythic: hitMythic
                            });
                        });
                    });
                });
            });
        });
    });
});

// --- DOUBLE GAME LOGIC ---
let doubleGameState = {
    phase: 'betting', // 'betting' or 'rolling'
    timeLeft: 15,
    previousRolls: [],
    bets: [] // { userId, color, amount }
};

const runDoubleGame = () => {
    setInterval(() => {
        if (doubleGameState.phase === 'betting') {
            doubleGameState.timeLeft -= 1;
            if (doubleGameState.timeLeft <= 0) {
                doubleGameState.phase = 'rolling';
                
                // Roll logic: Red(7/15), Black(7/15), Green(1/15)
                const roll = Math.random();
                let result = 'black';
                if (roll < 7/15) result = 'red';
                else if (roll < 14/15) result = 'black';
                else result = 'green';

                // Payout winners
                doubleGameState.bets.forEach(bet => {
                    let winnings = 0;
                    let multiplier = 0;
                    if (bet.color === result) {
                        multiplier = result === 'green' ? 14 : 2;
                        winnings = bet.amount * multiplier;
                        db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [winnings, bet.userId]);
                        logBalanceChange(bet.userId, winnings, 'Double', multiplier);
                    }
                    if (global.broadcastGameResult) {
                        global.broadcastGameResult(bet.username, 'Double', bet.amount, winnings, multiplier);
                    }
                });

                // Broadcast roll result
                io.to('double').emit('double_state', { ...doubleGameState, result });

                setTimeout(() => {
                    doubleGameState.previousRolls.push(result);
                    if (doubleGameState.previousRolls.length > 100) doubleGameState.previousRolls.shift();
                    doubleGameState.phase = 'betting';
                    doubleGameState.timeLeft = 15;
                    doubleGameState.bets = [];
                }, 5000); // 5 seconds rolling animation duration
            }
        }
        
        if (doubleGameState.phase === 'betting') {
            io.to('double').emit('double_state', doubleGameState);
        }
    }, 1000);
};

runDoubleGame();

let crashGameState = {
    phase: 'betting', // 'betting', 'running', 'crashed'
    timeLeft: 15,
    multiplier: 1.00,
    crashPoint: null,
    bets: [], // { userId, amount, cashedOut: boolean, won: number }
    previousRolls: [] // Last crash multipliers
};

const runCrashGame = () => {
    setInterval(() => {
        if (crashGameState.phase === 'betting') {
            crashGameState.timeLeft -= 0.1;
            if (crashGameState.timeLeft <= 0) {
                crashGameState.phase = 'running';
                crashGameState.multiplier = 1.00;
                
                const r = Math.random();
                crashGameState.crashPoint = Math.max(1.00, 1 / (1 - r));
                if (crashGameState.crashPoint > 1000) crashGameState.crashPoint = 1000;
            }
        } else if (crashGameState.phase === 'running') {
            crashGameState.multiplier *= 1.01;
            
            if (crashGameState.multiplier >= crashGameState.crashPoint) {
                crashGameState.phase = 'crashed';
                crashGameState.multiplier = crashGameState.crashPoint;
                
                // Broadcast losses for those who didn't cash out
                crashGameState.bets.forEach(bet => {
                    if (!bet.cashedOut) {
                        if (global.broadcastGameResult) {
                            global.broadcastGameResult(bet.username, 'Crash', bet.amount, 0, 0);
                        }
                        logBalanceChange(bet.userId, -bet.amount, 'Crash', 0);
                    }
                });

                if (!crashGameState.previousRolls) crashGameState.previousRolls = [];
                crashGameState.previousRolls.push(crashGameState.crashPoint);
                if (crashGameState.previousRolls.length > 100) {
                    crashGameState.previousRolls.shift();
                }
                
                setTimeout(() => {
                    crashGameState.phase = 'betting';
                    crashGameState.timeLeft = 15;
                    crashGameState.multiplier = 1.00;
                    crashGameState.crashPoint = null;
                    crashGameState.bets = [];
                }, 5000);
            }
        }
        
        io.to('crash').emit('crash_state', crashGameState);
    }, 100);
};

runCrashGame();

// --- SOCKET.IO ---
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next();
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) socket.userId = user.id;
        next();
    });
});

io.on('connection', (socket) => {
    socket.on('join_game', (game) => {
        socket.join(game);
        if (game === 'double') {
            socket.emit('double_state', doubleGameState);
        } else if (game === 'crash') {
            socket.emit('crash_state', crashGameState);
        }
    });

    socket.on('ping_latency', (callback) => {
        if (typeof callback === 'function') {
            callback();
        }
    });
});

// --- BETTING ENDPOINT ---
app.post('/api/bet/double', authenticateToken, validateBody({
    color: val => typeof val === 'string' && ['red', 'black', 'green'].includes(val),
    amount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000
}), (req, res) => {
    if (doubleGameState.phase !== 'betting') {
        return res.status(400).json({ error: 'Betting is closed' });
    }

    const { color, amount } = req.body;

    db.get('SELECT username, gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Server error' });
        if (row.gems < amount) return res.status(400).json({ error: 'Insufficient gems' });

        db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [amount, req.user.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Server error' });
            wagerGems(req.user.id, amount);

            doubleGameState.bets.push({ userId: req.user.id, username: row.username, color, amount });
            res.json({ message: 'Bet placed' });
        });
    });
});

runLiveBlackjackLoop(io);

// --- KEEP DIGGING ENDPOINTS ---
const activeDiggingGames = new Map();

const DIGGING_RISKS = {
    'low': 0.95,
    'medium': 0.85,
    'high': 0.70
};

app.post('/api/dig/start', authenticateToken, validateBody({
    betAmount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000,
    risk: val => typeof val === 'string' && ['low', 'medium', 'high'].includes(val)
}), (req, res) => {
    const { betAmount, risk } = req.body;

    // If game exists, return its state instead of blocking
    if (activeDiggingGames.has(req.user.id)) {
        return res.status(400).json({ error: 'Finish your current game first' });
    }

    db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Server error' });
        if (row.gems < betAmount) return res.status(400).json({ error: 'Insufficient gems' });

        db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [betAmount, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            wagerGems(req.user.id, betAmount);
            
            const gameState = { bet: betAmount, risk, depth: 0, status: 'playing' };
            activeDiggingGames.set(req.user.id, gameState);
            
            res.json({ message: 'Game started', state: gameState });
        });
    });
});

app.post('/api/dig/action', authenticateToken, validateBody({
    action: val => typeof val === 'string' && ['dig', 'cashout'].includes(val)
}), (req, res) => {
    const game = activeDiggingGames.get(req.user.id);
    if (!game) return res.status(400).json({ error: 'No active game' });

    const { action } = req.body;

    const survivalProb = DIGGING_RISKS[game.risk];
    
    // Multiplier formula: 0.99 / (p^depth)
    const getMultiplier = (depth) => {
        if (depth === 0) return 0;
        return parseFloat((0.99 / Math.pow(survivalProb, depth)).toFixed(2));
    };

    if (action === 'cashout') {
        if (game.depth === 0) return res.status(400).json({ error: 'Cannot cashout at depth 0' });
        
        const payout = game.bet * getMultiplier(game.depth);
        db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [payout, req.user.id], () => {
            logBalanceChange(req.user.id, payout, 'KeepDigging', getMultiplier(game.depth));
            activeDiggingGames.delete(req.user.id);
            if (global.broadcastGameResult) {
                global.broadcastGameResult(req.user.username, 'KeepDigging', game.bet, payout, getMultiplier(game.depth));
            }
            res.json({ status: 'cashed_out', payout, depth: game.depth, multiplier: getMultiplier(game.depth) });
        });
    } else if (action === 'dig') {
        const roll = Math.random();
        if (roll <= survivalProb) {
            // Survived
            game.depth += 1;
            res.json({ 
                status: 'playing', 
                depth: game.depth, 
                currentMultiplier: getMultiplier(game.depth),
                nextMultiplier: getMultiplier(game.depth + 1)
            });
        } else {
            // Exploded
            activeDiggingGames.delete(req.user.id);
            if (global.broadcastGameResult) {
                global.broadcastGameResult(req.user.username, 'KeepDigging', game.bet, 0, 0);
            }
            logBalanceChange(req.user.id, -game.bet, 'KeepDigging', 0);
            res.json({ status: 'exploded', depth: game.depth });
        }
    } else {
        res.status(400).json({ error: 'Invalid action' });
    }
});

// Get active dig game state
app.get('/api/dig/state', authenticateToken, (req, res) => {
    const game = activeDiggingGames.get(req.user.id);
    if (!game) return res.json({ active: false });
    
    const survivalProb = DIGGING_RISKS[game.risk];
    const getMultiplier = (depth) => {
        if (depth === 0) return 0;
        return parseFloat((0.99 / Math.pow(survivalProb, depth)).toFixed(2));
    };
    
    res.json({
        active: true,
        status: 'playing',
        depth: game.depth,
        bet: game.bet,
        risk: game.risk,
        currentMultiplier: getMultiplier(game.depth),
        nextMultiplier: getMultiplier(game.depth + 1)
    });
});

// --- CHICKEN ROAD ENDPOINTS ---
const activeChickenGames = new Map();

const CHICKEN_DIFFICULTIES = {
    'easy':   { columns: 4, cars: 1 },  // 75% survival
    'medium': { columns: 3, cars: 1 },  // 66.7% survival
    'hard':   { columns: 2, cars: 1 },  // 50% survival
};

app.post('/api/chicken/start', authenticateToken, validateBody({
    betAmount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000,
    difficulty: val => typeof val === 'string' && ['easy', 'medium', 'hard'].includes(val)
}), (req, res) => {
    const { betAmount, difficulty } = req.body;

    if (activeChickenGames.has(req.user.id)) {
        return res.status(400).json({ error: 'Finish your current game first' });
    }

    db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'Server error' });
        if (row.gems < betAmount) return res.status(400).json({ error: 'Insufficient gems' });

        db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [betAmount, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            wagerGems(req.user.id, betAmount);

            const config = CHICKEN_DIFFICULTIES[difficulty];
            // Pre-generate all 10 rows of car positions
            const rows = [];
            for (let i = 0; i < 10; i++) {
                const carPositions = new Set();
                while (carPositions.size < config.cars) {
                    carPositions.add(Math.floor(Math.random() * config.columns));
                }
                rows.push(Array.from(carPositions));
            }

            const game = {
                bet: betAmount,
                difficulty,
                columns: config.columns,
                cars: config.cars,
                currentRow: 0,
                rows, // secret car positions
                revealedRows: [], // rows the player has passed
                status: 'playing'
            };
            activeChickenGames.set(req.user.id, game);

            const survivalRate = (config.columns - config.cars) / config.columns;
            const nextMultiplier = parseFloat((0.99 / survivalRate).toFixed(2));

            res.json({
                status: 'playing',
                columns: config.columns,
                currentRow: 0,
                totalRows: 10,
                currentMultiplier: 1,
                nextMultiplier,
                revealedRows: []
            });
        });
    });
});

// Get active chicken game state
app.get('/api/chicken/state', authenticateToken, (req, res) => {
    const game = activeChickenGames.get(req.user.id);
    if (!game) return res.json({ active: false });
    
    const survivalRate = (game.columns - game.cars) / game.columns;
    const currentMultiplier = game.currentRow > 0 
        ? parseFloat((0.99 / Math.pow(survivalRate, game.currentRow)).toFixed(2))
        : 1;
    const nextMultiplier = game.currentRow < 10
        ? parseFloat((0.99 / Math.pow(survivalRate, game.currentRow + 1)).toFixed(2))
        : null;
    
    res.json({
        active: true,
        status: 'playing',
        columns: game.columns,
        currentRow: game.currentRow,
        totalRows: 10,
        bet: game.bet,
        difficulty: game.difficulty,
        currentMultiplier,
        nextMultiplier,
        revealedRows: game.revealedRows
    });
});

app.post('/api/chicken/pick', authenticateToken, validateBody({
    column: val => Number.isInteger(val) && val >= 0 && val <= 10
}), (req, res) => {
    const game = activeChickenGames.get(req.user.id);
    if (!game || game.status !== 'playing') return res.status(400).json({ error: 'No active game' });

    const { column } = req.body;
    if (column >= game.columns) return res.status(400).json({ error: 'Invalid column' });

    const carPositions = game.rows[game.currentRow];
    const hitCar = carPositions.includes(column);

    const survivalRate = (game.columns - game.cars) / game.columns;

    if (hitCar) {
        // Reveal all remaining rows
        const allRevealed = [...game.revealedRows, { row: game.currentRow, picked: column, cars: carPositions, safe: false }];
        activeChickenGames.delete(req.user.id);
        if (global.broadcastGameResult) {
            global.broadcastGameResult(req.user.username, 'ChickenRoad', game.bet, 0, 0);
        }
        logBalanceChange(req.user.id, -game.bet, 'ChickenRoad', 0);
        return res.json({
            status: 'dead',
            hitCar: true,
            column,
            carPositions,
            currentRow: game.currentRow,
            revealedRows: allRevealed,
            // Reveal all future car positions too
            futureRows: game.rows.slice(game.currentRow + 1)
        });
    }

    // Safe!
    game.currentRow++;
    game.revealedRows.push({ row: game.currentRow - 1, picked: column, cars: carPositions, safe: true });

    const currentMultiplier = parseFloat((0.99 / Math.pow(survivalRate, game.currentRow)).toFixed(2));
    const nextMultiplier = game.currentRow < 10
        ? parseFloat((0.99 / Math.pow(survivalRate, game.currentRow + 1)).toFixed(2))
        : null;

    // Auto-win at row 10
    if (game.currentRow >= 10) {
        const payout = game.bet * currentMultiplier;
        db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [payout, req.user.id]);
        logBalanceChange(req.user.id, payout, 'ChickenRoad', currentMultiplier);
        activeChickenGames.delete(req.user.id);
        if (global.broadcastGameResult) {
            global.broadcastGameResult(req.user.username, 'ChickenRoad', game.bet, payout, currentMultiplier);
        }
        return res.json({
            status: 'maxwin',
            currentRow: game.currentRow,
            currentMultiplier,
            payout,
            revealedRows: game.revealedRows
        });
    }

    res.json({
        status: 'playing',
        currentRow: game.currentRow,
        currentMultiplier,
        nextMultiplier,
        revealedRows: game.revealedRows
    });
});

app.post('/api/chicken/cashout', authenticateToken, (req, res) => {
    const game = activeChickenGames.get(req.user.id);
    if (!game || game.status !== 'playing') return res.status(400).json({ error: 'No active game' });
    if (game.currentRow === 0) return res.status(400).json({ error: 'Cross at least one row first' });

    const survivalRate = (game.columns - game.cars) / game.columns;
    const currentMultiplier = parseFloat((0.99 / Math.pow(survivalRate, game.currentRow)).toFixed(2));
    const payout = game.bet * currentMultiplier;

    db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [payout, req.user.id]);
    logBalanceChange(req.user.id, payout, 'ChickenRoad', currentMultiplier);
    activeChickenGames.delete(req.user.id);
    if (global.broadcastGameResult) {
        global.broadcastGameResult(req.user.username, 'ChickenRoad', game.bet, payout, currentMultiplier);
    }

    res.json({
        status: 'cashed_out',
        payout,
        currentMultiplier,
        currentRow: game.currentRow,
        revealedRows: game.revealedRows,
        futureRows: game.rows.slice(game.currentRow)
    });
});

// --- UPGRADER ENDPOINTS ---

// Get all upgrader items
app.get('/api/upgrader/items', (req, res) => {
    db.all('SELECT ui.*, u.username as creator_name FROM upgrader_items ui LEFT JOIN users u ON ui.creator_id = u.id ORDER BY ui.price ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(rows || []);
    });
});

// Create upgrader item
app.post('/api/upgrader/items', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, price } = req.body;
    
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
        return res.status(400).json({ error: 'Name required and must be under 100 characters' });
    }
    
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || !Number.isFinite(parsedPrice) || parsedPrice < 0.01 || parsedPrice > 1000000) {
        return res.status(400).json({ error: 'Valid price (0.01 - 1,000,000) is required' });
    }
    
    let imageUrl = null;
    if (req.file) {
        try {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = uniqueSuffix + '.webp';
            const filepath = path.join(uploadDir, filename);
            await sharp(req.file.buffer)
                .rotate()
                .resize({ width: 512, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(filepath);
            imageUrl = '/uploads/' + filename;
        } catch (err) {
            console.error("Error processing upgrader image:", err);
            return res.status(500).json({ error: 'Error processing image' });
        }
    }
    
    db.run('INSERT INTO upgrader_items (creator_id, name, price, image_url) VALUES (?, ?, ?, ?)',
        [req.user.id, name, parsedPrice, imageUrl],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ id: this.lastID, name, price: parsedPrice, image_url: imageUrl });
        }
    );
});

// Delete upgrader item (only creator can delete)
app.delete('/api/upgrader/items/:id', authenticateToken, (req, res) => {
    db.get('SELECT * FROM upgrader_items WHERE id = ?', [req.params.id], (err, item) => {
        if (err || !item) return res.status(404).json({ error: 'Item not found' });
        if (item.creator_id !== req.user.id) return res.status(403).json({ error: 'Only the creator can delete this item' });
        
        db.run('DELETE FROM upgrader_items WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Item deleted' });
        });
    });
});

// Perform upgrade
app.post('/api/upgrader/spin', authenticateToken, validateBody({
    betAmount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000,
    itemId: val => Number.isInteger(val) && val > 0
}), (req, res) => {
    const { betAmount, itemId } = req.body;
    
    db.get('SELECT * FROM upgrader_items WHERE id = ?', [itemId], (err, item) => {
        if (err || !item) return res.status(400).json({ error: 'Item not found' });
        
        if (betAmount >= item.price) return res.status(400).json({ error: 'Bet must be less than item price' });
        
        // Win chance = (betAmount * 0.99) / itemPrice  → ensures 99% RTP
        const winChance = (betAmount * 0.99) / item.price;
        
        if (winChance <= 0 || winChance >= 1) return res.status(400).json({ error: 'Invalid upgrade ratio' });
        
        db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row) return res.status(500).json({ error: 'Server error' });
            if (row.gems < betAmount) return res.status(400).json({ error: 'Insufficient gems' });
            
            db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [betAmount, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                wagerGems(req.user.id, betAmount);
                
                // 1% commission to item creator
                const commission = betAmount * 0.01;
                if (item.creator_id && item.creator_id !== req.user.id) {
                    db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [commission, item.creator_id]);
                }
                
                const roll = Math.random();
                const won = roll < winChance;
                
                // Generate a landing angle for the spinner (0-360)
                // The "win zone" spans from 0 to winChance*360 degrees
                const winZoneDeg = winChance * 360;
                let landingAngle;
                
                if (won) {
                    // Land inside the win zone (with some margin from edges)
                    const margin = Math.min(5, winZoneDeg * 0.1);
                    landingAngle = margin + Math.random() * (winZoneDeg - 2 * margin);
                    
                    // Pay out item value
                    db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [item.price, req.user.id]);
                    logBalanceChange(req.user.id, item.price, 'Upgrader', item.price / betAmount);
                } else {
                    // Land outside the win zone
                    logBalanceChange(req.user.id, -betAmount, 'Upgrader', 0);
                    const margin = Math.min(5, (360 - winZoneDeg) * 0.05);
                    landingAngle = winZoneDeg + margin + Math.random() * (360 - winZoneDeg - 2 * margin);
                }

                if (global.broadcastGameResult) {
                    global.broadcastGameResult(req.user.username, 'Upgrader', betAmount, won ? item.price : 0, won ? (item.price / betAmount) : 0);
                }
                
                res.json({
                    won,
                    winChance: parseFloat((winChance * 100).toFixed(2)),
                    winZoneDeg: parseFloat(winZoneDeg.toFixed(2)),
                    landingAngle: parseFloat(landingAngle.toFixed(2)),
                    item,
                    payout: won ? item.price : 0
                });
            });
        });
    });
});

// --- CRASH ENDPOINTS ---
app.post('/api/bet/crash', authenticateToken, validateBody({
    amount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000
}), (req, res) => {
    if (crashGameState.phase !== 'betting') return res.status(400).json({ error: 'Betting closed' });
    
    const { amount } = req.body;

    db.get('SELECT username, gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row || row.gems < amount) return res.status(400).json({ error: 'Insufficient gems' });

        db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [amount, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            wagerGems(req.user.id, amount);
            crashGameState.bets.push({ userId: req.user.id, username: row.username, amount, cashedOut: false, won: 0 });
            res.json({ message: 'Bet placed' });
        });
    });
});

app.post('/api/cashout/crash', authenticateToken, (req, res) => {
    if (crashGameState.phase !== 'running') return res.status(400).json({ error: 'Cannot cash out now' });

    const betIndex = crashGameState.bets.findIndex(b => b.userId === req.user.id && !b.cashedOut);
    if (betIndex === -1) return res.status(400).json({ error: 'No active bet found' });

    const bet = crashGameState.bets[betIndex];
    const winnings = bet.amount * crashGameState.multiplier;
    
    crashGameState.bets[betIndex].cashedOut = true;
    crashGameState.bets[betIndex].won = winnings;

    db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [winnings, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        logBalanceChange(req.user.id, winnings, 'Crash', crashGameState.multiplier);
        if (global.broadcastGameResult) {
            global.broadcastGameResult(bet.username, 'Crash', bet.amount, winnings, crashGameState.multiplier);
        }
        res.json({ message: 'Cashed out', winnings });
    });
});

// --- MINES ENDPOINTS ---
const activeMinesGames = new Map();

function generateMinesBoard(minesCount) {
    const board = Array(25).fill('gem');
    let placed = 0;
    while(placed < minesCount) {
        let idx = Math.floor(Math.random() * 25);
        if(board[idx] !== 'mine') {
            board[idx] = 'mine';
            placed++;
        }
    }
    return board;
}

function calculateMinesMultiplier(mines, clicks) {
    function nCr(n, r) {
        if (r > n) return 0;
        if (r === 0 || r === n) return 1;
        let res = 1;
        for (let i = 1; i <= r; i++) {
            res = res * (n - i + 1) / i;
        }
        return res;
    }
    const trueOdds = nCr(25, clicks) / nCr(25 - mines, clicks);
    return trueOdds * 0.97;
}

app.post('/api/mines/start', authenticateToken, validateBody({
    betAmount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000,
    minesCount: val => Number.isInteger(val) && val >= 1 && val <= 24
}), (req, res) => {
    const { betAmount, minesCount } = req.body;

    db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row || row.gems < betAmount) return res.status(400).json({ error: 'Insufficient gems' });
        
        db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [betAmount, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            wagerGems(req.user.id, betAmount);
            
            const gameId = Date.now().toString() + Math.random().toString();
            const board = generateMinesBoard(minesCount);
            
            activeMinesGames.set(gameId, {
                userId: req.user.id,
                betAmount,
                minesCount,
                board,
                clicks: 0,
                revealed: Array(25).fill(false)
            });
            
            res.json({ gameId, status: 'active' });
        });
    });
});

app.post('/api/mines/click', authenticateToken, validateBody({
    gameId: val => typeof val === 'string' && val.trim().length > 0,
    tileIndex: val => Number.isInteger(val) && val >= 0 && val <= 24
}), (req, res) => {
    const { gameId, tileIndex } = req.body;
    const game = activeMinesGames.get(gameId);
    
    if (!game || game.userId !== req.user.id) return res.status(404).json({ error: 'Game not found' });
    if (game.revealed[tileIndex]) return res.status(400).json({ error: 'Invalid move' });
    
    game.revealed[tileIndex] = true;
    
    if (game.board[tileIndex] === 'mine') {
        activeMinesGames.delete(gameId);
        if (global.broadcastGameResult) {
            global.broadcastGameResult(req.user.username, 'Mines', game.betAmount, 0, 0);
        }
        logBalanceChange(req.user.id, -game.betAmount, 'Mines', 0);
        return res.json({ status: 'busted', tile: 'mine', board: game.board });
    }
    
    game.clicks++;
    const multiplier = calculateMinesMultiplier(game.minesCount, game.clicks);
    const nextMultiplier = calculateMinesMultiplier(game.minesCount, game.clicks + 1);
    
    if (game.clicks === 25 - game.minesCount) {
        const winnings = game.betAmount * multiplier;
        db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [winnings, req.user.id], (err) => {
            logBalanceChange(req.user.id, winnings, 'Mines', multiplier);
            activeMinesGames.delete(gameId);
            if (global.broadcastGameResult) {
                global.broadcastGameResult(req.user.username, 'Mines', game.betAmount, winnings, multiplier);
            }
            return res.json({ status: 'cashed_out', multiplier, payout: winnings, board: game.board });
        });
    } else {
        res.json({ status: 'active', tile: 'gem', multiplier, nextMultiplier });
    }
});

app.post('/api/mines/cashout', authenticateToken, validateBody({
    gameId: val => typeof val === 'string' && val.trim().length > 0
}), (req, res) => {
    const { gameId } = req.body;
    const game = activeMinesGames.get(gameId);
    
    if (!game || game.userId !== req.user.id) return res.status(404).json({ error: 'Game not found' });
    if (game.clicks === 0) return res.status(400).json({ error: 'Must click at least one tile' });
    
    const multiplier = calculateMinesMultiplier(game.minesCount, game.clicks);
    const winnings = game.betAmount * multiplier;
    
    db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [winnings, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        logBalanceChange(req.user.id, winnings, 'Mines', multiplier);
        activeMinesGames.delete(gameId);
        if (global.broadcastGameResult) {
            global.broadcastGameResult(req.user.username, 'Mines', game.betAmount, winnings, multiplier);
        }
        res.json({ status: 'cashed_out', multiplier, payout: winnings, board: game.board });
    });
});

// --- PLINKO ENDPOINTS ---
function getPlinkoMultipliers(rows, risk) {
    if (rows === 8) {
        if (risk === 'low') return [6, 2.5, 1.2, 1.1, 0.8, 1.1, 1.2, 2.5, 6];
        if (risk === 'medium') return [15, 4, 1.5, 0.9, 0.6, 0.9, 1.5, 4, 15];
        return [35, 5, 2, 0.5, 0.4, 0.5, 2, 5, 35];
    } else if (rows === 16) {
        if (risk === 'low') return [18, 10, 2.5, 1.6, 1.5, 1.3, 1.2, 1.1, 0.8, 1.1, 1.2, 1.3, 1.5, 1.6, 2.5, 10, 18];
        if (risk === 'medium') return [130, 50, 12, 6, 4, 2, 1.5, 0.8, 0.5, 0.8, 1.5, 2, 4, 6, 12, 50, 130];
        return [1200, 150, 30, 10, 5, 2.5, 0.5, 0.3, 0.3, 0.3, 0.5, 2.5, 5, 10, 30, 150, 1200];
    }
    // Default 14 rows - very generous
    if (risk === 'low') return [9, 4, 2, 1.3, 1.2, 1.1, 0.8, 0.8, 0.8, 1.1, 1.2, 1.3, 2, 4, 9];
    if (risk === 'medium') return [22, 7, 3, 1.8, 1.3, 0.8, 0.5, 0.5, 0.5, 0.8, 1.3, 1.8, 3, 7, 22];
    return [150, 30, 10, 4, 2, 0.5, 0.3, 0.3, 0.3, 0.5, 2, 4, 10, 30, 150];
}

const { createDeck, calculateValue, isBlackjack } = require('./blackjackLogic');

// --- NORMAL BLACKJACK ---
const activeNormalBj = new Map();

app.post('/api/blackjack/normal/start', authenticateToken, validateBody({
    betAmount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000
}), (req, res) => {
    const { betAmount } = req.body;

    db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row || row.gems < betAmount) return res.status(400).json({ error: 'Insufficient gems' });
        
        db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [betAmount, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            wagerGems(req.user.id, betAmount);
            
            const deck = createDeck();
            const playerHand = [deck.pop(), deck.pop()];
            const dealerHand = [deck.pop(), deck.pop()];
            const gameId = Date.now().toString() + Math.random().toString();
            
            const pVal = calculateValue(playerHand);
            let state = 'active';
            let payout = 0;
            
            if (isBlackjack(playerHand)) {
                if (isBlackjack(dealerHand)) {
                    state = 'push';
                    payout = betAmount;
                } else {
                    state = 'blackjack';
                    payout = betAmount * 2.5; 
                }
            } else if (isBlackjack(dealerHand)) {
                state = 'lose';
            }
            
            if (payout > 0 || state === 'lose') {
                if (payout > 0) {
                db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [payout, req.user.id]);
                const bjMultiplier = betAmount > 0 ? payout / betAmount : 0;
                logBalanceChange(req.user.id, payout, 'Blackjack', bjMultiplier);
            }
                if (global.broadcastGameResult) {
                    global.broadcastGameResult(req.user.username, 'Blackjack', betAmount, payout, betAmount > 0 ? payout / betAmount : 0);
                }
            } else {
                activeNormalBj.set(gameId, {
                    userId: req.user.id,
                    betAmount,
                    deck,
                    playerHand,
                    dealerHand
                });
            }
            
            res.json({
                gameId,
                state,
                playerHand,
                dealerHand: state === 'active' ? [dealerHand[0], { hidden: true }] : dealerHand,
                playerValue: pVal,
                dealerValue: state === 'active' ? calculateValue([dealerHand[0]]) : calculateValue(dealerHand),
                payout
            });
        });
    });
});

app.post('/api/blackjack/normal/action', authenticateToken, validateBody({
    gameId: val => typeof val === 'string' && val.trim().length > 0,
    action: val => typeof val === 'string' && ['hit', 'stand', 'double'].includes(val)
}), (req, res) => {
    const { gameId, action } = req.body;
    const game = activeNormalBj.get(gameId);
    if (!game || game.userId !== req.user.id) return res.status(404).json({ error: 'Game not found' });
    
    let { playerHand, dealerHand, deck, betAmount } = game;
    
    const resolveDealer = () => {
        let dVal = calculateValue(dealerHand);
        while (dVal < 17) {
            dealerHand.push(deck.pop());
            dVal = calculateValue(dealerHand);
        }
        
        const pVal = calculateValue(playerHand);
        let state = '';
        let payout = 0;
        
        if (dVal > 21) {
            state = 'dealer_bust';
            payout = betAmount * 2;
        } else if (pVal > dVal) {
            state = 'win';
            payout = betAmount * 2;
        } else if (pVal === dVal) {
            state = 'push';
            payout = betAmount;
        } else {
            state = 'lose';
        }
        
        return { state, payout };
    };

    if (action === 'double') {
        db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row || row.gems < betAmount) return res.status(400).json({ error: 'Insufficient gems for double' });
            db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [betAmount, req.user.id], () => {
                wagerGems(req.user.id, betAmount);
                game.betAmount *= 2;
                betAmount = game.betAmount;
                playerHand.push(deck.pop());
                const pVal = calculateValue(playerHand);
                if (pVal > 21) {
                    activeNormalBj.delete(gameId);
                    if (global.broadcastGameResult) {
                        global.broadcastGameResult(req.user.username, 'Blackjack', betAmount, 0, 0);
                    }
                    return res.json({ state: 'bust', playerHand, dealerHand, playerValue: pVal, dealerValue: calculateValue(dealerHand), payout: 0 });
                }
                const result = resolveDealer();
                if (result.payout > 0) {
                    db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [result.payout, req.user.id]);
                    logBalanceChange(req.user.id, result.payout, 'Blackjack', result.payout / (betAmount * 2));
                }
                activeNormalBj.delete(gameId);
                if (global.broadcastGameResult) {
                    global.broadcastGameResult(req.user.username, 'Blackjack', betAmount, result.payout, betAmount > 0 ? result.payout / betAmount : 0);
                }
                res.json({ state: result.state, playerHand, dealerHand, playerValue: pVal, dealerValue: calculateValue(dealerHand), payout: result.payout });
            });
        });
        return;
    }

    if (action === 'hit') {
        playerHand.push(deck.pop());
        const pVal = calculateValue(playerHand);
        if (pVal > 21) {
            activeNormalBj.delete(gameId);
            if (global.broadcastGameResult) {
                global.broadcastGameResult(req.user.username, 'Blackjack', betAmount, 0, 0);
            }
            return res.json({ state: 'bust', playerHand, dealerHand, playerValue: pVal, dealerValue: calculateValue(dealerHand), payout: 0 });
        }
        return res.json({ state: 'active', playerHand, dealerHand: [dealerHand[0], { hidden: true }], playerValue: pVal, dealerValue: calculateValue([dealerHand[0]]) });
    }

    if (action === 'stand') {
        const result = resolveDealer();
        if (result.payout > 0) {
            db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [result.payout, req.user.id]);
            logBalanceChange(req.user.id, result.payout, 'Blackjack', betAmount > 0 ? result.payout / betAmount : 0);
        }
        activeNormalBj.delete(gameId);
        if (global.broadcastGameResult) {
            global.broadcastGameResult(req.user.username, 'Blackjack', betAmount, result.payout, betAmount > 0 ? result.payout / betAmount : 0);
        }
        res.json({ state: result.state, playerHand, dealerHand, playerValue: calculateValue(playerHand), dealerValue: calculateValue(dealerHand), payout: result.payout });
    }
});

// --- LIVE BLACKJACK ENGINE ---
const liveBjState = {
    phase: 'betting', // betting, dealing, action_wait, drawing, dealer_turn, resolving
    timeLeft: 15,
    deck: [],
    dealerHand: [],
    playerHand: [],
    bets: {}, // userId -> { amount, username, action: 'waiting'|'hit'|'stand'|'double'|'bust'|'blackjack', currentHandLength: 2, payout: 0 }
};

function broadcastLiveBj() {
    const safeState = { ...liveBjState, deck: undefined };
    if (['betting', 'dealing', 'action_wait', 'drawing'].includes(liveBjState.phase) && liveBjState.dealerHand.length === 2) {
        safeState.dealerHand = [liveBjState.dealerHand[0], { hidden: true }];
    }
    io.to('live_blackjack').emit('live_blackjack_state', safeState);
}

function runLiveBlackjackLoop(io) {
    setInterval(() => {
        if (liveBjState.phase === 'betting') {
            liveBjState.timeLeft -= 1;
            if (liveBjState.timeLeft <= 0) {
                if (Object.keys(liveBjState.bets).length === 0) {
                    liveBjState.timeLeft = 15; // Wait for players
                } else {
                    liveBjState.phase = 'dealing';
                }
            }
        } else if (liveBjState.phase === 'action_wait') {
            liveBjState.timeLeft -= 1;
            if (liveBjState.timeLeft <= 0) {
                liveBjState.phase = 'drawing';
            }
        }
        broadcastLiveBj();
    }, 1000);

    // Fast loop for phase transitions
    setInterval(() => {
        if (liveBjState.phase === 'dealing') {
            liveBjState.deck = createDeck();
            liveBjState.playerHand = [liveBjState.deck.pop(), liveBjState.deck.pop()];
            liveBjState.dealerHand = [liveBjState.deck.pop(), liveBjState.deck.pop()];
            
            const isDj = isBlackjack(liveBjState.dealerHand);
            let anyActive = false;

            for (const uid in liveBjState.bets) {
                const b = liveBjState.bets[uid];
                b.currentHandLength = 2;
                if (isBlackjack(liveBjState.playerHand)) {
                    b.action = 'blackjack';
                } else if (isDj) {
                    b.action = 'stand'; // forces immediate resolve
                } else {
                    b.action = 'waiting';
                    anyActive = true;
                }
            }
            
            if (isDj || !anyActive) {
                liveBjState.phase = 'dealer_turn';
            } else {
                liveBjState.phase = 'action_wait';
                liveBjState.timeLeft = 10;
            }
            broadcastLiveBj();
        } else if (liveBjState.phase === 'drawing') {
            // Check if anyone requested a hit or double (or defaulted to stand if timeout)
            let needsCard = false;
            for (const uid in liveBjState.bets) {
                const b = liveBjState.bets[uid];
                if (b.action === 'waiting') b.action = 'stand'; // Auto-stand on timeout
                if (b.action === 'hit' || b.action === 'double') needsCard = true;
            }

            if (needsCard) {
                liveBjState.playerHand.push(liveBjState.deck.pop());
                
                let anyStillWaiting = false;
                for (const uid in liveBjState.bets) {
                    const b = liveBjState.bets[uid];
                    if (b.action === 'hit' || b.action === 'double') {
                        b.currentHandLength++;
                        const subHand = liveBjState.playerHand.slice(0, b.currentHandLength);
                        const val = calculateValue(subHand);
                        
                        if (val > 21) {
                            b.action = 'bust';
                        } else if (b.action === 'double' || val === 21) {
                            b.action = 'stand';
                        } else if (b.action === 'hit') {
                            b.action = 'waiting'; // Needs next action
                            anyStillWaiting = true;
                        }
                    }
                }

                if (anyStillWaiting) {
                    liveBjState.phase = 'action_wait';
                    liveBjState.timeLeft = 8;
                } else {
                    liveBjState.phase = 'dealer_turn';
                }
            } else {
                liveBjState.phase = 'dealer_turn';
            }
            broadcastLiveBj();
        } else if (liveBjState.phase === 'dealer_turn') {
            // Only draw if someone is not busted and not BJ?
            // Actually, casino rules: dealer draws if someone is standing.
            let needsDealerDraw = false;
            for (const uid in liveBjState.bets) {
                if (['stand', 'double'].includes(liveBjState.bets[uid].action)) needsDealerDraw = true;
            }
            
            if (needsDealerDraw) {
                let dVal = calculateValue(liveBjState.dealerHand);
                while (dVal < 17) {
                    liveBjState.dealerHand.push(liveBjState.deck.pop());
                    dVal = calculateValue(liveBjState.dealerHand);
                }
            }
            
            liveBjState.phase = 'resolving';
            broadcastLiveBj();
        } else if (liveBjState.phase === 'resolving') {
            const dVal = calculateValue(liveBjState.dealerHand);
            const isDj = isBlackjack(liveBjState.dealerHand);

            for (const uid in liveBjState.bets) {
                const b = liveBjState.bets[uid];
                const subHand = liveBjState.playerHand.slice(0, b.currentHandLength);
                const pVal = calculateValue(subHand);
                
                if (b.action === 'bust') {
                    b.payout = 0;
                } else if (b.action === 'blackjack') {
                    b.payout = isDj ? b.amount : b.amount * 2.5;
                } else {
                    if (isDj) {
                        b.payout = 0;
                    } else if (dVal > 21) {
                        b.payout = b.amount * 2;
                    } else if (pVal > dVal) {
                        b.payout = b.amount * 2;
                    } else if (pVal === dVal) {
                        b.payout = b.amount;
                    } else {
                        b.payout = 0;
                    }
                }
                
                if (b.payout > 0) {
                    db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [b.payout, uid]);
                    logBalanceChange(uid, b.payout, 'LiveBlackjack', b.amount > 0 ? b.payout / b.amount : 0);
                }

                if (global.broadcastGameResult) {
                    global.broadcastGameResult(b.username, 'LiveBlackjack', b.amount, b.payout, b.amount > 0 ? b.payout / b.amount : 0);
                }
            }
            
            setTimeout(() => {
                liveBjState.bets = {};
                liveBjState.playerHand = [];
                liveBjState.dealerHand = [];
                liveBjState.phase = 'betting';
                liveBjState.timeLeft = 15;
                broadcastLiveBj();
            }, 6000); // Wait 6 seconds to show results
            
            liveBjState.phase = 'idle'; // Prevent multiple resolves
            broadcastLiveBj();
        }
    }, 500);
}

// Ensure you run this function later when IO is ready, similar to battleEngine.

app.post('/api/blackjack/live/bet', authenticateToken, validateBody({
    amount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000
}), (req, res) => {
    if (liveBjState.phase !== 'betting') return res.status(400).json({ error: 'Betting closed' });
    const { amount } = req.body;
    if (liveBjState.bets[req.user.id]) return res.status(400).json({ error: 'Already bet' });

    db.get('SELECT username, gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row || row.gems < amount) return res.status(400).json({ error: 'Insufficient gems' });
        db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [amount, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            wagerGems(req.user.id, amount);
            liveBjState.bets[req.user.id] = { amount, username: row.username, action: 'waiting', currentHandLength: 0, payout: 0 };
            broadcastLiveBj();
            res.json({ message: 'Bet placed' });
        });
    });
});

app.post('/api/blackjack/live/action', authenticateToken, validateBody({
    action: val => typeof val === 'string' && ['hit', 'stand', 'double'].includes(val)
}), (req, res) => {
    if (liveBjState.phase !== 'action_wait') return res.status(400).json({ error: 'Not action phase' });
    const bet = liveBjState.bets[req.user.id];
    if (!bet || bet.action !== 'waiting') return res.status(400).json({ error: 'Cannot act' });

    const { action } = req.body;

    if (action === 'double') {
        db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row || row.gems < bet.amount) return res.status(400).json({ error: 'Insufficient gems' });
            db.run('UPDATE users SET gems = gems - ? WHERE id = ?', [bet.amount, req.user.id], (err) => {
                if (!err) {
                    wagerGems(req.user.id, bet.amount);
                    bet.amount *= 2;
                    bet.action = 'double';
                    broadcastLiveBj();
                    res.json({ message: 'Doubled' });
                }
            });
        });
    } else {
        bet.action = action;
        broadcastLiveBj();
        res.json({ message: action });
    }
});

// --- PLINKO LOGIC ---
app.post('/api/plinko/drop', authenticateToken, validateBody({
    betAmount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000,
    risk: val => typeof val === 'string' && ['low', 'medium', 'high'].includes(val),
    rows: val => Number.isInteger(val) && [8, 14, 16].includes(val)
}), (req, res) => {
    const { betAmount, risk, rows } = req.body;
    const amount = betAmount;
    
    db.get('SELECT gems FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'User not found' });
        if (user.gems < amount) return res.status(400).json({ error: 'Insufficient gems' });
        
        let mults = [];
        if (rows === 8) {
            if (risk === 'low') mults = [6, 2.5, 1.2, 1.1, 0.8, 1.1, 1.2, 2.5, 6];
            else if (risk === 'medium') mults = [15, 4, 1.5, 0.9, 0.6, 0.9, 1.5, 4, 15];
            else mults = [35, 5, 2, 0.5, 0.4, 0.5, 2, 5, 35];
        } else if (rows === 16) {
            if (risk === 'low') mults = [18, 10, 2.5, 1.6, 1.5, 1.3, 1.2, 1.1, 0.8, 1.1, 1.2, 1.3, 1.5, 1.6, 2.5, 10, 18];
            else if (risk === 'medium') mults = [130, 50, 12, 6, 4, 2, 1.5, 0.8, 0.5, 0.8, 1.5, 2, 4, 6, 12, 50, 130];
            else mults = [1200, 150, 30, 10, 5, 2.5, 0.5, 0.3, 0.3, 0.3, 0.5, 2.5, 5, 10, 30, 150, 1200];
        } else {
            if (risk === 'low') mults = [9, 4, 2, 1.3, 1.2, 1.1, 0.8, 0.8, 0.8, 1.1, 1.2, 1.3, 2, 4, 9];
            else if (risk === 'medium') mults = [22, 7, 3, 1.8, 1.3, 0.8, 0.5, 0.5, 0.5, 0.8, 1.3, 1.8, 3, 7, 22];
            else mults = [150, 30, 10, 4, 2, 0.5, 0.3, 0.3, 0.3, 0.5, 2, 4, 10, 30, 150];
        }

        // Generate drop path
        let path = [];
        let rights = 0;
        for (let i = 0; i < rows; i++) {
            // Very slight bias towards center
            let centerRatio = (rights - (i / 2)) / (i || 1); 
            let probRight = 0.5 - (centerRatio * 0.1); 
            
            if (Math.random() < probRight) {
                rights++;
                path.push('R');
            } else {
                path.push('L');
            }
        }
        
        let multiplier = mults[rights];
        let payout = amount * multiplier;
        
        db.run('UPDATE users SET gems = gems - ? + ? WHERE id = ?', [amount, payout, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            logBalanceChange(req.user.id, payout - amount, 'Plinko', multiplier);
            wagerGems(req.user.id, amount);
            if (global.broadcastGameResult) {
                global.broadcastGameResult(req.user.username, 'Plinko', amount, payout, multiplier);
            }
            res.json({ path, payout });
        });
    });
});

// --- SLOTS GAME ---
const SLOT_SYMBOLS = [
    { id: 'cherry',  emoji: '🍒', weight: 22, pays: { 3: 2, 4: 5, 5: 12 } },
    { id: 'lemon',   emoji: '🍋', weight: 20, pays: { 3: 3, 4: 8, 5: 18 } },
    { id: 'orange',  emoji: '🍊', weight: 16, pays: { 3: 4, 4: 12, 5: 25 } },
    { id: 'grape',   emoji: '🍇', weight: 13, pays: { 3: 6, 4: 18, 5: 40 } },
    { id: 'bell',    emoji: '🔔', weight: 10, pays: { 3: 10, 4: 30, 5: 60 } },
    { id: 'diamond', emoji: '💎', weight: 7,  pays: { 3: 20, 4: 60, 5: 150 } },
    { id: 'seven',   emoji: '7️⃣',  weight: 4,  pays: { 3: 40, 4: 150, 5: 500 } },
    { id: 'wild',    emoji: '⭐', weight: 3,  pays: {} },
    { id: 'scatter', emoji: '🎰', weight: 3,  pays: {} },
];

const SLOT_PAYLINES = [
    [1, 1, 1, 1, 1], // Line 1: middle
    [0, 0, 0, 0, 0], // Line 2: top
    [2, 2, 2, 2, 2], // Line 3: bottom
    [0, 1, 2, 1, 0], // Line 4: V shape
    [2, 1, 0, 1, 2], // Line 5: inverted V
];

const slotTotalWeight = SLOT_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

function pickSlotSymbol() {
    let roll = Math.random() * slotTotalWeight;
    for (const sym of SLOT_SYMBOLS) {
        roll -= sym.weight;
        if (roll <= 0) return sym;
    }
    return SLOT_SYMBOLS[0];
}

function generateSlotGrid() {
    const grid = [];
    for (let row = 0; row < 3; row++) {
        grid[row] = [];
        for (let col = 0; col < 5; col++) {
            grid[row][col] = pickSlotSymbol();
        }
    }
    return grid;
}

function checkPayline(grid, payline) {
    const symbols = payline.map((row, col) => grid[row][col]);
    
    // Find the first non-wild symbol
    let baseSymbol = null;
    for (const sym of symbols) {
        if (sym.id !== 'wild' && sym.id !== 'scatter') {
            baseSymbol = sym;
            break;
        }
    }
    
    if (!baseSymbol) {
        // All wilds - treat as highest paying symbol (seven)
        baseSymbol = SLOT_SYMBOLS.find(s => s.id === 'seven');
    }
    
    // Count consecutive matches from left (wilds count as match)
    let matchCount = 0;
    for (const sym of symbols) {
        if (sym.id === baseSymbol.id || sym.id === 'wild') {
            matchCount++;
        } else {
            break;
        }
    }
    
    if (matchCount >= 3 && baseSymbol.pays[matchCount]) {
        return { symbol: baseSymbol, count: matchCount, multiplier: baseSymbol.pays[matchCount] };
    }
    return null;
}

function countScatters(grid) {
    let count = 0;
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 5; col++) {
            if (grid[row][col].id === 'scatter') count++;
        }
    }
    return count;
}

const activeSlotFreeSpins = new Map();

app.post('/api/slots/spin', authenticateToken, validateBody({
    betAmount: val => typeof val === 'number' && Number.isFinite(val) && val >= 0.01 && val <= 1000000,
    lines: val => Number.isInteger(val) && val >= 1 && val <= 5
}), (req, res) => {
    const { betAmount, lines } = req.body;
    const numLines = lines;
    
    const freeSpinState = activeSlotFreeSpins.get(req.user.id);
    const isFreeSpinMode = freeSpinState && freeSpinState.remaining > 0;
    const totalCost = isFreeSpinMode ? 0 : betAmount * numLines;
    const currentMultiplier = isFreeSpinMode ? freeSpinState.multiplier : 1;
    
    const doSpin = () => {
        const grid = generateSlotGrid();
        
        // Check wins on active paylines
        const wins = [];
        for (let i = 0; i < numLines; i++) {
            const result = checkPayline(grid, SLOT_PAYLINES[i]);
            if (result) {
                wins.push({
                    line: i,
                    symbol: result.symbol.id,
                    emoji: result.symbol.emoji,
                    count: result.count,
                    payout: result.multiplier * betAmount * currentMultiplier
                });
            }
        }
        
        // Count scatters
        const scatterCount = countScatters(grid);
        let awardedFreeSpins = 0;
        let freeSpinMultiplier = 1;
        
        if (scatterCount >= 3) {
            if (scatterCount === 3) { awardedFreeSpins = 10; freeSpinMultiplier = 2; }
            else if (scatterCount === 4) { awardedFreeSpins = 15; freeSpinMultiplier = 3; }
            else { awardedFreeSpins = 20; freeSpinMultiplier = 5; }
            
            const existing = activeSlotFreeSpins.get(req.user.id);
            if (existing && existing.remaining > 0) {
                existing.remaining += awardedFreeSpins;
                existing.multiplier = Math.max(existing.multiplier, freeSpinMultiplier);
            } else {
                activeSlotFreeSpins.set(req.user.id, { remaining: awardedFreeSpins, multiplier: freeSpinMultiplier, lines: numLines, betAmount });
            }
        }
        
        const totalPayout = wins.reduce((sum, w) => sum + w.payout, 0);
        
        // Update free spin counter
        let freeSpinsRemaining = 0;
        if (isFreeSpinMode) {
            freeSpinState.remaining--;
            freeSpinsRemaining = freeSpinState.remaining;
            if (freeSpinState.remaining <= 0 && awardedFreeSpins === 0) {
                activeSlotFreeSpins.delete(req.user.id);
            }
        } else if (awardedFreeSpins > 0) {
            freeSpinsRemaining = awardedFreeSpins;
        }
        
        // Serialize grid for response
        const gridData = grid.map(row => row.map(sym => ({ id: sym.id, emoji: sym.emoji })));
        
        const actualBet = isFreeSpinMode ? 0 : totalCost;
        const originalBet = isFreeSpinMode ? (freeSpinState.betAmount * freeSpinState.lines) : totalCost;
        const displayMultiplier = originalBet > 0 ? (totalPayout / originalBet) : 0;
        if (global.broadcastGameResult) {
            global.broadcastGameResult(req.user.username, 'Slots', actualBet, totalPayout, displayMultiplier);
        }

        if (totalPayout > 0) {
            db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [totalPayout, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                logBalanceChange(req.user.id, totalPayout, 'Slots', displayMultiplier);
                res.json({ grid: gridData, wins, totalPayout, scatterCount, awardedFreeSpins, freeSpinsRemaining, freeSpinMultiplier: currentMultiplier, isFreeSpinMode });
            });
        } else {
            res.json({ grid: gridData, wins, totalPayout: 0, scatterCount, awardedFreeSpins, freeSpinsRemaining, freeSpinMultiplier: currentMultiplier, isFreeSpinMode });
        }
    };
    
    if (isFreeSpinMode) {
        doSpin();
    } else {
        db.run('UPDATE users SET gems = gems - ? WHERE id = ? AND gems >= ?', [totalCost, req.user.id, totalCost], function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) return res.status(400).json({ error: 'Insufficient gems' });
            wagerGems(req.user.id, totalCost);
            doSpin();
        });
    }
});

app.get('/api/slots/freespins', authenticateToken, (req, res) => {
    const state = activeSlotFreeSpins.get(req.user.id);
    if (state && state.remaining > 0) {
        res.json({ active: true, remaining: state.remaining, multiplier: state.multiplier, lines: state.lines, betAmount: state.betAmount });
    } else {
        res.json({ active: false });
    }
});

// ==========================================
// --- KALSHI PREDICTION MARKETS SYSTEM ---
// ==========================================

const categorizeMarket = (title) => {
    const t = title.toLowerCase();
    if (t.includes('bitcoin') || t.includes('ethereum') || t.includes('crypto') || t.includes('btc') || t.includes('eth') || t.includes('solana') || t.includes('doge') || t.includes('xrp') || t.includes('cardano') || t.includes('ada') || t.includes('bnb') || t.includes('avax') || t.includes('polkadot') || t.includes('chainlink') || t.includes('litecoin') || t.includes('coin') || t.includes('token')) {
        return 'Crypto';
    }
    if (t.includes('president') || t.includes('election') || t.includes('senate') || t.includes('house') || t.includes('biden') || t.includes('trump') || t.includes('harris') || t.includes('politic') || t.includes('supreme court') || t.includes('gop') || t.includes('democrat') || t.includes('congress') || t.includes('governor') || t.includes('executive order') || t.includes('legislation') || t.includes('republican') || t.includes('democrat') || t.includes('vote') || t.includes('ballot') || t.includes('cabinet') || t.includes('impeach')) {
        return 'Politics';
    }
    if (t.includes('rate') || t.includes('inflation') || t.includes('cpi') || t.includes('fed') || t.includes('federal reserve') || t.includes('gdp') || t.includes('unemployment') || t.includes('jobs') || t.includes('economic') || t.includes('yield') || t.includes('recession') || t.includes('gas price') || t.includes('oil') || t.includes('stock') || t.includes('s&p') || t.includes('nasdaq') || t.includes('dow') || t.includes('tariff') || t.includes('treasury') || t.includes('fomc') || t.includes('pce') || t.includes('payroll') || t.includes('ifo') || t.includes('pmi') || t.includes('consumer') || t.includes('trade balance') || t.includes('debt') || t.includes('bond') || t.includes('mortgage')) {
        return 'Economy';
    }
    if (t.includes('movie') || t.includes('box office') || t.includes('oscar') || t.includes('grammy') || t.includes('award') || t.includes('netflix') || t.includes('disney') || t.includes('billboard') || t.includes('album') || t.includes('streaming') || t.includes('celebrity') || t.includes('reality tv') || t.includes('emmy') || t.includes('golden globe')) {
        return 'Pop Culture';
    }
    if (t.includes('nasa') || t.includes('spacex') || t.includes('launch') || t.includes('ai') || t.includes('openai') || t.includes('gpt') || t.includes('tesla') || t.includes('apple') || t.includes('google') || t.includes('microsoft') || t.includes('tech') || t.includes('science') || t.includes('robot') || t.includes('quantum') || t.includes('chip') || t.includes('semiconductor') || t.includes('nvidia') || t.includes('meta') || t.includes('amazon') || t.includes('starship')) {
        return 'Tech & Science';
    }
    if (t.includes('temperature') || t.includes('rain') || t.includes('snow') || t.includes('weather') || t.includes('degrees') || t.includes('hurricane') || t.includes('storm') || t.includes('wind') || t.includes('heat') || t.includes('cold') || t.includes('nyc') || t.includes('celsius') || t.includes('fahrenheit') || t.includes('forecast') || t.includes('drought') || t.includes('flood') || t.includes('tornado') || t.includes('wildfire') || t.includes('climate')) {
        return 'Weather';
    }
    if (t.includes('valorant') || t.includes('esport') || t.includes('nba') || t.includes('nfl') || t.includes('mlb') || t.includes('nhl') || t.includes('basketball') || t.includes('baseball') || t.includes('soccer') || t.includes('tennis') || t.includes('boxing') || t.includes('ufc') || t.includes('mma') || t.includes('golf') || t.includes('runs scored') || t.includes('points scored') || t.includes('rebounds') || t.includes('assists') || (t.includes('win') && t.includes('match')) || (t.includes('win') && t.includes('map')) || t.includes('winner?') || t.includes('spread') || t.includes('over') || t.includes('half') || t.includes('quarter') || t.includes('ncaa') || t.includes('college') || t.includes('pga') || t.includes('fifa') || t.includes('premier league') || t.includes('serie a') || t.includes('bundesliga') || t.includes('la liga') || t.includes('champions league') || t.includes('f1') || t.includes('formula') || t.includes('nascar') || t.includes('cricket') || t.includes('rugby') || t.includes('hockey') || t.includes('football') || t.includes('cs2') || t.includes('dota') || t.includes('league of legends') || t.includes('lol') || t.includes('game') || t.includes(' vs ')) {
        return 'Sports';
    }
    return 'Other';
};

const getNormalizedPrices = (market) => {
    const parseDollars = (val) => val ? Math.round(parseFloat(val) * 100) : 0;
    const raw_yes_ask = parseDollars(market.yes_ask_dollars);
    const raw_no_ask = parseDollars(market.no_ask_dollars);
    const raw_last_price = parseDollars(market.last_price_dollars);

    let P = 50;
    if (raw_yes_ask > 0 && raw_no_ask > 0) {
        P = Math.round((raw_yes_ask / (raw_yes_ask + raw_no_ask)) * 100);
    } else if (raw_last_price > 0) {
        P = raw_last_price;
    } else if (raw_yes_ask > 0) {
        P = raw_yes_ask;
    }
    if (P < 1) P = 1;
    if (P > 99) P = 99;

    return {
        yes_bid: P,
        yes_ask: (raw_yes_ask > 0 && raw_yes_ask < 100) ? P : 0,
        no_bid: 100 - P,
        no_ask: (raw_no_ask > 0 && raw_no_ask < 100) ? (100 - P) : 0,
        last_price: P
    };
};

const syncKalshiMarkets = async (isFull = false) => {
    try {
        let allMarkets = [];
        let cursor = '';
        let pageCount = 0;
        // Limit full sync to exactly 10 pages (2000 markets) as requested by the user
        const maxPages = isFull ? 10 : 2;

        // Paginate through open markets
        while (pageCount < maxPages) {
            const url = 'https://external-api.kalshi.com/trade-api/v2/markets?status=open&limit=200&mve_filter=exclude'
                + (cursor ? '&cursor=' + cursor : '');
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Kalshi API responded with status ${response.status}`);
            }
            const data = await response.json();
            if (!data || !Array.isArray(data.markets) || data.markets.length === 0) break;

            allMarkets = allMarkets.concat(data.markets);
            pageCount++;

            // Stop if no more pages
            if (!data.cursor || data.markets.length < 200) break;
            cursor = data.cursor;

            // Sleep for 150ms to prevent hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        if (allMarkets.length > 0) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO kalshi_markets (
                ticker, event_ticker, title, yes_sub_title, category, yes_bid, yes_ask, no_bid, no_ask, last_price, status, expiration_date, settlement_date, last_updated, volume_24h
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            const now = Date.now();
            const activeTickers = new Set();

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                for (const market of allMarkets) {
                    const category = categorizeMarket(market.title || market.subtitle || '');
                    
                    const prices = getNormalizedPrices(market);
                    activeTickers.add(market.ticker);

                    stmt.run([
                        market.ticker,
                        market.event_ticker || market.ticker,
                        market.title || market.subtitle || 'Prediction Market',
                        market.yes_sub_title || '',
                        category,
                        prices.yes_bid,
                        prices.yes_ask,
                        prices.no_bid,
                        prices.no_ask,
                        prices.last_price,
                        market.status || 'open',
                        market.expiration_time || market.close_time || '',
                        market.settlement_date || '',
                        now,
                        parseFloat(market.volume_24h_fp) || 0
                    ]);
                }
                stmt.finalize();

                // Clean up markets that are no longer active on Kalshi (only on full syncs)
                if (isFull) {
                    db.run("DELETE FROM kalshi_markets WHERE last_updated < ?", [now]);
                }

                db.run("COMMIT");
            });
            console.log(`Synced ${allMarkets.length} markets from Kalshi API (${pageCount} pages, isFull = ${isFull}).`);
        }
    } catch (err) {
        console.error('Error syncing Kalshi markets:', err.message);
    }
};

const settleKalshiBets = async () => {
    db.all("SELECT DISTINCT market_ticker FROM kalshi_bets WHERE status = 'active'", async (err, rows) => {
        if (err || !rows || rows.length === 0) return;

        for (const row of rows) {
            const ticker = row.market_ticker;
            try {
                const response = await fetch(`https://external-api.kalshi.com/trade-api/v2/markets/${ticker}`);
                if (!response.ok) continue;
                const data = await response.json();
                if (data && data.market) {
                    const market = data.market;
                    const status = market.status;
                    const marketResult = market.market_result || market.result;
                    
                    if (status === 'finalized' || status === 'settled' || marketResult === 'yes' || marketResult === 'no') {
                        const pDollars = (val) => val ? Math.round(parseFloat(val) * 100) : 0;
                        const finalResult = marketResult || (pDollars(market.yes_bid_dollars) === 100 ? 'yes' : pDollars(market.no_bid_dollars) === 100 ? 'no' : null);
                        if (!finalResult) continue;

                        db.all("SELECT * FROM kalshi_bets WHERE market_ticker = ? AND status = 'active'", [ticker], (err, bets) => {
                            if (err || !bets || bets.length === 0) return;

                            bets.forEach(bet => {
                                const isWin = bet.position.toLowerCase() === finalResult.toLowerCase();
                                let payout = 0;
                                let betStatus = 'settled_loss';
                                let isRefund = false;

                                if (finalResult.toLowerCase() !== 'yes' && finalResult.toLowerCase() !== 'no') {
                                    payout = bet.total_cost;
                                    betStatus = 'void';
                                    isRefund = true;
                                } else {
                                    payout = isWin ? bet.contracts * 100 : 0;
                                    betStatus = isWin ? 'settled_win' : 'settled_loss';
                                }

                                db.serialize(() => {
                                    db.run("BEGIN TRANSACTION");
                                    db.run("UPDATE kalshi_bets SET status = ?, payout_amount = ?, settled_at = ? WHERE id = ?", 
                                        [betStatus, payout, Date.now(), bet.id]
                                    );
                                    if (isWin || isRefund) {
                                        db.run("UPDATE users SET gems = gems + ? WHERE id = ?", [payout, bet.user_id]);
                                        logBalanceChange(bet.user_id, payout, 'Kalshi', null);
                                    }
                                    db.run("COMMIT", () => {
                                        console.log(`Settled bet ${bet.id} for user ${bet.username} as ${betStatus}. Payout: ${payout} Gems.`);
                                        if (global.broadcastGameResult) {
                                            global.broadcastGameResult(
                                                bet.username, 
                                                'Kalshi', 
                                                bet.total_cost, 
                                                payout, 
                                                bet.total_cost > 0 ? payout / bet.total_cost : 0
                                            );
                                        }
                                        io.emit('kalshi_bet_settled', {
                                            id: bet.id,
                                            userId: bet.user_id,
                                            username: bet.username,
                                            status: betStatus,
                                            payout,
                                            title: bet.market_title
                                        });
                                    });
                                });
                            });
                        });
                    }
                }
            } catch (err) {
                console.error(`Error settling Kalshi bet for ticker ${ticker}:`, err.message);
            }
        }
    });
};

// Start sync intervals (DISABLED to save performance and system resources)
// 1. Startup full sync to populate the database with all 2000 markets across categories
// syncKalshiMarkets(true);

// 2. Fast sync every 15 seconds (updates prices for top 400 markets in ~200ms, saving bandwidth & CPU)
// setInterval(() => syncKalshiMarkets(false), 15000);

// 3. Full sync every 10 minutes (refreshes all categories and cleans up stale markets)
// setInterval(() => syncKalshiMarkets(true), 600000);

// 4. Bet settlement every 15 seconds (lightweight database resolution)
// setInterval(settleKalshiBets, 15000);

// API Routes

app.get('/api/kalshi/markets', (req, res) => {
    db.all("SELECT * FROM kalshi_markets WHERE status = 'open' OR status = 'active' ORDER BY volume_24h DESC LIMIT 2000", (err, rows) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ markets: rows });
    });
});

app.get('/api/kalshi/my-bets', authenticateToken, (req, res) => {
    db.all("SELECT * FROM kalshi_bets WHERE user_id = ? ORDER BY id DESC", [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ bets: rows });
    });
});

app.post('/api/kalshi/buy', authenticateToken, validateBody({
    ticker: val => typeof val === 'string' && val.trim().length > 0,
    position: val => typeof val === 'string' && ['yes', 'no'].includes(val.toLowerCase()),
    contracts: val => typeof val === 'number' && Number.isInteger(val) && val > 0
}), async (req, res) => {
    const { ticker, position, contracts } = req.body;
    const pos = position.toLowerCase();

    // Look up market from local DB first to check existence
    db.get("SELECT * FROM kalshi_markets WHERE ticker = ?", [ticker], async (err, marketRow) => {
        if (err || !marketRow) return res.status(404).json({ error: 'Market not found' });

        try {
            // Fetch live prices directly from Kalshi to prevent stale price exploit
            const response = await fetch(`https://external-api.kalshi.com/trade-api/v2/markets/${ticker}`);
            if (!response.ok) {
                return res.status(400).json({ error: 'Failed to verify market price from Kalshi' });
            }
            const data = await response.json();
            if (!data || !data.market) {
                return res.status(400).json({ error: 'Invalid market data received' });
            }

            const market = data.market;
            const prices = getNormalizedPrices(market);

            // Update cached prices
            db.run(`UPDATE kalshi_markets SET yes_bid = ?, yes_ask = ?, no_bid = ?, no_ask = ?, last_price = ?, status = ?, last_updated = ? WHERE ticker = ?`,
                [prices.yes_bid, prices.yes_ask, prices.no_bid, prices.no_ask, prices.last_price, market.status || 'open', Date.now(), ticker]
            );

            const buyPrice = pos === 'yes' ? prices.yes_ask : prices.no_ask;
            if (buyPrice <= 0 || buyPrice >= 100) {
                return res.status(400).json({ error: 'Market price is currently unavailable or invalid' });
            }

            const totalCost = contracts * buyPrice;

            db.get("SELECT gems, username FROM users WHERE id = ?", [req.user.id], (err, user) => {
                if (err || !user) return res.status(500).json({ error: 'Server error' });
                if (user.gems < totalCost) return res.status(400).json({ error: 'Insufficient gems' });

                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    db.run("UPDATE users SET gems = gems - ? WHERE id = ?", [totalCost, req.user.id]);
                    wagerGems(req.user.id, totalCost);
                    db.run(`INSERT INTO kalshi_bets (user_id, username, market_ticker, market_title, position, contracts, buy_price, total_cost)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [req.user.id, user.username, ticker, marketRow.title, pos, contracts, buyPrice, totalCost]
                    );
                    db.run("COMMIT", () => {
                        res.json({ message: 'Contracts purchased successfully', cost: totalCost, price: buyPrice });
                    });
                });
            });
        } catch (err) {
            console.error('Error in buy endpoint:', err.message);
            res.status(500).json({ error: 'Error calling Kalshi API', details: err.message });
        }
    });
});

app.post('/api/kalshi/sell', authenticateToken, validateBody({
    betId: val => typeof val === 'number' && Number.isInteger(val) && val > 0
}), async (req, res) => {
    const { betId } = req.body;

    db.get("SELECT * FROM kalshi_bets WHERE id = ? AND user_id = ? AND status = 'active'", [betId, req.user.id], async (err, betRow) => {
        if (err || !betRow) return res.status(404).json({ error: 'Active position not found' });

        try {
            // Fetch live prices directly from Kalshi
            const response = await fetch(`https://external-api.kalshi.com/trade-api/v2/markets/${betRow.market_ticker}`);
            if (!response.ok) {
                return res.status(400).json({ error: 'Failed to verify market price from Kalshi' });
            }
            const data = await response.json();
            if (!data || !data.market) {
                return res.status(400).json({ error: 'Invalid market data received' });
            }

            const market = data.market;
            const prices = getNormalizedPrices(market);

            // Update cached prices
            db.run(`UPDATE kalshi_markets SET yes_bid = ?, yes_ask = ?, no_bid = ?, no_ask = ?, last_price = ?, status = ?, last_updated = ? WHERE ticker = ?`,
                [prices.yes_bid, prices.yes_ask, prices.no_bid, prices.no_ask, prices.last_price, market.status || 'open', Date.now(), betRow.market_ticker]
            );

            const sellPrice = betRow.position === 'yes' ? prices.yes_bid : prices.no_bid;
            if (sellPrice <= 0 || sellPrice >= 100) {
                return res.status(400).json({ error: 'Market price is currently unavailable or invalid for cashout' });
            }

            const payoutAmount = betRow.contracts * sellPrice;

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                db.run("UPDATE users SET gems = gems + ? WHERE id = ?", [payoutAmount, req.user.id]);
                logBalanceChange(req.user.id, payoutAmount, 'Kalshi', null);
                db.run("UPDATE kalshi_bets SET status = 'cashed_out', cashout_price = ?, payout_amount = ?, settled_at = ? WHERE id = ?",
                    [sellPrice, payoutAmount, Date.now(), betId]
                );
                db.run("COMMIT", () => {
                    if (global.broadcastGameResult) {
                        global.broadcastGameResult(
                            betRow.username,
                            'Kalshi',
                            betRow.total_cost,
                            payoutAmount,
                            betRow.total_cost > 0 ? payoutAmount / betRow.total_cost : 0
                        );
                    }
                    res.json({ message: 'Position cashed out successfully', payout: payoutAmount, price: sellPrice });
                });
            });
        } catch (err) {
            console.error('Error in sell endpoint:', err.message);
            res.status(500).json({ error: 'Error calling Kalshi API', details: err.message });
        }
    });
});

// Global Error Handling Middleware to prevent stack trace leaks
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// --- DAILY CASE & REFERRAL ENDPOINTS ---

// Apply a referral code (for new users who didn't come via a referral link)
app.post('/api/user/referral-code', authenticateToken, validateBody({
    code: val => typeof val === 'string' && val.trim().length >= 1
}), async (req, res) => {
    try {
        const result = await applyReferralCode(req.user.id, req.body.code.trim().toLowerCase());
        res.json({ success: true, message: `Welcome! You received ${result.cases} welcome cases.`, cases: result.cases });
    } catch (err) {
        res.status(400).json({ error: typeof err === 'string' ? err : 'Failed to apply referral code' });
    }
});

// Skip referral (use "molotov" default code for 2 welcome cases)
app.post('/api/user/skip-referral', authenticateToken, (req, res) => {
    db.get('SELECT referred_by, onboarding_done FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.referred_by) return res.status(400).json({ error: 'You already used a referral code' });
        if (user.onboarding_done) return res.status(400).json({ error: 'Onboarding already completed' });
        db.run('UPDATE users SET welcome_cases = 2, onboarding_done = 1 WHERE id = ?', [req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, message: 'You received 2 welcome cases.', cases: 2 });
        });
    });
});

// Claim/choose an affiliate code for your own profile
app.post('/api/user/claim-affiliate-code', authenticateToken, validateBody({
    code: val => typeof val === 'string' && /^[a-zA-Z0-9_-]{3,20}$/.test(val)
}), (req, res) => {
    const code = req.body.code.trim().toLowerCase();
    db.get('SELECT affiliate_code FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.affiliate_code) return res.status(400).json({ error: 'You already have an affiliate code' });
        db.get('SELECT id FROM users WHERE affiliate_code = ?', [code], (err, existing) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (existing) return res.status(400).json({ error: 'This code is already taken' });
            db.run('UPDATE users SET affiliate_code = ? WHERE id = ?', [code, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: 'Failed to save code' });
                res.json({ success: true, code });
            });
        });
    });
});

// Get daily case page status (requirements, can claim, welcome cases)
app.get('/api/daily-case/status', authenticateToken, (req, res) => {
    db.get('SELECT steamid, username, last_daily_case, welcome_cases, daily_case_streak FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        
        let canClaimDaily = false;
        let nextClaimTime = null;
        if (user.last_daily_case) {
            const last = new Date(user.last_daily_case + 'Z');
            const now = new Date();
            const nextMidnight = new Date(now);
            nextMidnight.setUTCHours(24, 0, 0, 0);
            if (now >= nextMidnight) {
                canClaimDaily = true;
                nextClaimTime = null;
            } else {
                canClaimDaily = false;
                nextClaimTime = nextMidnight.toISOString();
            }
        } else {
            canClaimDaily = true;
        }
        
        const pfpExists = fs.existsSync(pfpPath);
        
        res.json({
            steamid: user.steamid,
            username: user.username,
            canClaimDaily,
            nextClaimTime,
            welcomeCases: user.welcome_cases || 0,
            dailyCaseStreak: user.daily_case_streak || 0,
            hasPfpImage: pfpExists
        });
    });
});

// Check daily case requirements (Steam username, PFP, CS2 ownership)
app.post('/api/daily-case/check-requirements', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get('SELECT steamid, username FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });
            
            const steamid = user.steamid;
            const checks = { username: false, pfp: false, ownsCs2: false };
            
            // 1. Check Steam username contains "csmolly.bet" (case-insensitive)
            try {
                const profileRes = await fetch(`https://steamcommunity.com/profiles/${steamid}/?xml=1`);
                if (profileRes.ok) {
                    const xml = await profileRes.text();
                    const steamIDMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/) || xml.match(/<steamID>(.*?)<\/steamID>/);
                    const currentName = steamIDMatch ? steamIDMatch[1].toLowerCase() : '';
                    checks.username = currentName.includes('csmolly.bet');
                }
            } catch (e) {
                console.error('[DailyCase] Error checking Steam username:', e.message);
            }
            
            // 2. Check PFP matches required image
            try {
                const avatarRes = await fetch(`https://steamcommunity.com/profiles/${steamid}/?xml=1`);
                if (avatarRes.ok) {
                    const xml = await avatarRes.text();
                    const avatarMatch = xml.match(/<avatarIcon><!\[CDATA\[(.*?)\]\]><\/avatarIcon>/) || xml.match(/<avatarIcon>(.*?)<\/avatarIcon>/);
                    if (avatarMatch) {
                        const avatarUrl = avatarMatch[1];
                        const imgRes = await fetch(avatarUrl);
                        if (imgRes.ok) {
                            const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
                            const resized = await sharp(imgBuffer).resize(32, 32).grayscale().raw().toBuffer();
                            const avatarHash = require('crypto').createHash('sha256').update(resized).digest('hex');
                            checks.pfp = requiredPfpHash !== null && avatarHash === requiredPfpHash;
                        }
                    }
                }
            } catch (e) {
                console.error('[DailyCase] Error checking PFP:', e.message);
            }
            
            // 3. Check CS2 ownership by trying to access inventory
            try {
                const invRes = await fetch(`https://steamcommunity.com/inventory/${steamid}/730/2`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                // 200 or 403 means the user has CS2 (403 = private inventory)
                checks.ownsCs2 = invRes.status === 200 || invRes.status === 403;
            } catch (e) {
                console.error('[DailyCase] Error checking CS2 ownership:', e.message);
            }
            
            const allMet = checks.username && checks.pfp && checks.ownsCs2;
            
            res.json({ checks, allMet });
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to check requirements', details: e.message });
    }
});

// Claim daily case (free) — re-checks requirements
app.post('/api/daily-case/claim', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });
            
            // Check if they have welcome cases
            const usingWelcome = (user.welcome_cases || 0) > 0;
            
            if (!usingWelcome) {
                // Check if daily case is available
                if (user.last_daily_case) {
                    const last = new Date(user.last_daily_case + 'Z');
                    const now = new Date();
                    const nextMidnight = new Date(now);
                    nextMidnight.setUTCHours(24, 0, 0, 0);
                    if (now < nextMidnight) {
                        return res.status(400).json({ error: 'Daily case already claimed today. Come back tomorrow!' });
                    }
                }
            }
            
            // Re-check requirements (skip for welcome cases)
            if (!usingWelcome) {
                const steamid = user.steamid;
                let allMet = false;
                
                try {
                    const profileRes = await fetch(`https://steamcommunity.com/profiles/${steamid}/?xml=1`);
                    if (profileRes.ok) {
                        const xml = await profileRes.text();
                        const steamIDMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/) || xml.match(/<steamID>(.*?)<\/steamID>/);
                        const currentName = steamIDMatch ? steamIDMatch[1].toLowerCase() : '';
                        const nameOk = currentName.includes('csmolly.bet');
                        
                        const avatarMatch = xml.match(/<avatarIcon><!\[CDATA\[(.*?)\]\]><\/avatarIcon>/) || xml.match(/<avatarIcon>(.*?)<\/avatarIcon>/);
                        let pfpOk = false;
                        if (avatarMatch && requiredPfpHash) {
                            const imgRes = await fetch(avatarMatch[1]);
                            if (imgRes.ok) {
                                const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
                                const resized = await sharp(imgBuffer).resize(32, 32).grayscale().raw().toBuffer();
                                const avatarHash = require('crypto').createHash('sha256').update(resized).digest('hex');
                                pfpOk = avatarHash === requiredPfpHash;
                            }
                        }
                        
                        const invRes = await fetch(`https://steamcommunity.com/inventory/${steamid}/730/2`, {
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        const ownsCs2 = invRes.status === 200 || invRes.status === 403;
                        
                        allMet = nameOk && pfpOk && ownsCs2;
                    }
                } catch (e) {
                    console.error('[DailyCase] Error checking requirements on claim:', e.message);
                }
                
                if (!allMet) {
                    return res.status(400).json({ error: 'Requirements not met. Please check your Steam username (must contain "csmolly.bet"), profile picture, and CS2 ownership.' });
                }
            }
            
            // Find the "Daily Case" created by admin (owner_id = 1 or any case named "Daily Case")
            // If none exists, use any available case
            db.get('SELECT * FROM cases WHERE LOWER(name) = ? ORDER BY id DESC LIMIT 1', ['daily case'], (err, dailyCase) => {
                if (!dailyCase) {
                    // Fallback: use first available case
                    db.get('SELECT * FROM cases ORDER BY id ASC LIMIT 1', [], (err, fallbackCase) => {
                        if (!fallbackCase) {
                            return res.status(400).json({ error: 'No cases available. Create a case first.' });
                        }
                        openDailyCase(fallbackCase);
                    });
                    return;
                }
                openDailyCase(dailyCase);
            });
            
            function openDailyCase(caseRow) {
                db.all('SELECT * FROM items WHERE case_id = ?', [caseRow.id], (err, items) => {
                    if (err || !items || items.length === 0) {
                        return res.status(500).json({ error: 'Case has no items' });
                    }
                    
                    // Roll for winning item
                    let roll = Math.random() * 100;
                    let wonItem = null;
                    let cumProb = 0;
                    for (const item of items) {
                        cumProb += item.odds;
                        if (roll <= cumProb) { wonItem = item; break; }
                    }
                    if (!wonItem) wonItem = items[items.length - 1];
                    
                    // Update user balance
                    const rewardValue = wonItem.value;
                    
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');
                        db.run('UPDATE users SET gems = gems + ?, last_daily_case = datetime(\'now\'), daily_case_streak = CASE WHEN ? = 1 THEN daily_case_streak + 1 ELSE daily_case_streak END, welcome_cases = CASE WHEN welcome_cases > 0 THEN welcome_cases - 1 ELSE welcome_cases END WHERE id = ?',
                            [rewardValue, usingWelcome ? 0 : 1, userId]);
                        
                        db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [caseRow.price * 0.01, caseRow.owner_id]);
                        
                        logBalanceChange(userId, rewardValue, usingWelcome ? 'WelcomeCase' : 'DailyCase', null);

                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) return res.status(500).json({ error: 'Transaction failed' });
                            res.json({
                                success: true,
                                wonItem: { name: wonItem.name, value: wonItem.value, image_url: wonItem.image_url },
                                items: items.map(i => ({ name: i.name, value: i.value, image_url: i.image_url, odds: i.odds })),
                                caseName: caseRow.name,
                                isWelcome: usingWelcome
                            });
                        });
                    });
                });
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to claim daily case', details: e.message });
    }
});

// Get affiliate stats
app.get('/api/affiliate/stats', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    db.get('SELECT affiliate_code, affiliate_earnings FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        
        db.get('SELECT COUNT(*) as total FROM users WHERE referred_by = ?', [userId], (err, referrals) => {
            db.all('SELECT at.*, u.username as referred_username FROM affiliate_transactions at JOIN users u ON at.referred_user_id = u.id WHERE at.affiliate_id = ? ORDER BY at.created_at DESC LIMIT 50', [userId], (err, transactions) => {
                if (err) { console.error(err); return res.status(500).json({ error: 'Database error' }); }
                
                const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
                const totalWagerComm = transactions.filter(t => t.type === 'wager').reduce((s, t) => s + t.commission, 0);
                const totalDepositComm = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.commission, 0);
                
                res.json({
                    affiliateCode: user.affiliate_code,
                    affiliateLink: `/?ref=${user.affiliate_code}`,
                    totalEarnings: user.affiliate_earnings || 0,
                    totalReferrals: referrals ? referrals.total : 0,
                    totalDeposits,
                    totalWagerComm,
                    totalDepositComm,
                    transactions: transactions || []
                });
            });
        });
    });
});

// ============ SUPPORT TICKETS ============

// Create a new support ticket
app.post('/api/support/tickets', authenticateToken, validateBody({
    subject: val => typeof val === 'string' && val.trim().length >= 1 && val.trim().length <= 200,
    message: val => typeof val === 'string' && val.trim().length >= 1
}), (req, res) => {
    const { subject, message } = req.body;
    const userId = req.user.id;
    
    db.run('INSERT INTO support_tickets (user_id, subject) VALUES (?, ?)', [userId, subject.trim()], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to create ticket' });
        const ticketId = this.lastID;
        db.run('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)',
            [ticketId, userId, message.trim()], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save message' });
            res.json({ success: true, ticketId });
        });
    });
});

// List tickets for the authenticated user
app.get('/api/support/tickets', authenticateToken, (req, res) => {
    db.all(`SELECT t.*, 
        (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_at
        FROM support_tickets t WHERE t.user_id = ? ORDER BY t.updated_at DESC`, [req.user.id], (err, tickets) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch tickets' });
        res.json(tickets || []);
    });
});

// Get a single ticket with all messages
app.get('/api/support/tickets/:id', authenticateToken, (req, res) => {
    const ticketId = req.params.id;
    db.get('SELECT * FROM support_tickets WHERE id = ?', [ticketId], (err, ticket) => {
        if (err || !ticket) return res.status(404).json({ error: 'Ticket not found' });
        if (ticket.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        db.all('SELECT tm.*, u.username FROM ticket_messages tm LEFT JOIN users u ON tm.user_id = u.id WHERE tm.ticket_id = ? ORDER BY tm.created_at ASC', [ticketId], (err, messages) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch messages' });
            res.json({ ...ticket, messages: messages || [] });
        });
    });
});

// Add a message to a ticket (user)
app.post('/api/support/tickets/:id/messages', authenticateToken, validateBody({
    message: val => typeof val === 'string' && val.trim().length >= 1
}), (req, res) => {
    const ticketId = req.params.id;
    const { message } = req.body;
    
    db.get('SELECT * FROM support_tickets WHERE id = ?', [ticketId], (err, ticket) => {
        if (err || !ticket) return res.status(404).json({ error: 'Ticket not found' });
        if (ticket.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
        if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket is closed' });
        
        db.run('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)',
            [ticketId, req.user.id, message.trim()], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to save message' });
            db.run('UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);
            res.json({ success: true });
        });
    });
});

// Admin: List all tickets
app.get('/api/admin/support/tickets', authenticateToken, requireAdmin, (req, res) => {
    const status = req.query.status || 'open';
    db.all(`SELECT t.*, u.username,
        (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_at
        FROM support_tickets t JOIN users u ON t.user_id = u.id
        WHERE t.status = ? ORDER BY t.updated_at DESC`, [status], (err, tickets) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch tickets' });
        res.json(tickets || []);
    });
});

// Admin: Close a ticket
app.post('/api/admin/support/tickets/:id/close', authenticateToken, requireAdmin, (req, res) => {
    db.run('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['closed', req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to close ticket' });
        res.json({ success: true });
    });
});

// Admin: Reply to a ticket
app.post('/api/admin/support/tickets/:id/messages', authenticateToken, requireAdmin, validateBody({
    message: val => typeof val === 'string' && val.trim().length >= 1
}), (req, res) => {
    const ticketId = req.params.id;
    db.run('INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, 1)',
        [ticketId, req.user.id, req.body.message.trim()], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to save reply' });
        db.run('UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['open', ticketId]);
        res.json({ success: true });
    });
});

// Public: List transfer files (no auth needed)
app.get('/api/transfers', (req, res) => {
    fs.readdir(transfersDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to list transfers' });
        const fileInfos = files.map(file => {
            const stat = fs.statSync(path.join(transfersDir, file));
            return {
                name: file,
                size: stat.size,
                modified: stat.mtime,
                url: '/transfers/' + file
            };
        }).sort((a, b) => b.modified - a.modified);
        res.json(fileInfos);
    });
});

// Admin: List transfer files
app.get('/api/admin/transfers', authenticateToken, requireAdmin, (req, res) => {
    fs.readdir(transfersDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to list transfers' });
        const fileInfos = files.map(file => {
            const stat = fs.statSync(path.join(transfersDir, file));
            return {
                name: file,
                size: stat.size,
                modified: stat.mtime,
                url: '/transfers/' + file
            };
        }).sort((a, b) => b.modified - a.modified);
        res.json(fileInfos);
    });
});

// Admin: Upload transfer file
app.post('/api/admin/upload-transfer', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const originalName = req.file.originalname;
    const filepath = path.join(transfersDir, originalName);
    fs.writeFile(filepath, req.file.buffer, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to save file' });
        res.json({ success: true, name: originalName, url: '/transfers/' + originalName });
    });
});

// Admin: Delete transfer file
app.delete('/api/admin/transfers/:filename', authenticateToken, requireAdmin, (req, res) => {
    const filepath = path.join(transfersDir, req.params.filename);
    // Prevent directory traversal
    if (!filepath.startsWith(transfersDir)) return res.status(400).json({ error: 'Invalid filename' });
    fs.unlink(filepath, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to delete file' });
        res.json({ success: true });
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
