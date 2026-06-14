const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                steamid TEXT UNIQUE,
                username TEXT,
                avatar TEXT,
                gems REAL DEFAULT 0,
                role TEXT DEFAULT 'user',
                wager_req REAL DEFAULT 0,
                player_id INTEGER UNIQUE,
                token_version INTEGER DEFAULT 0
            )`);

            // For existing databases that don't have player_id yet (SQLite ALTER TABLE can't add UNIQUE)
            db.run("ALTER TABLE users ADD COLUMN player_id INTEGER", (e) => {
                if (e) { /* column already exists, ignore */ }
            });
            db.all("SELECT id, player_id FROM users WHERE player_id IS NULL LIMIT 1", (err, rows) => {
                if (!err && rows && rows.length > 0) {
                    db.all("SELECT id FROM users WHERE player_id IS NULL", (err2, all) => {
                        if (err2 || !all) return;
                        for (const row of all) {
                            const pid = 100000 + row.id;
                            db.run("UPDATE users SET player_id = ? WHERE id = ?", [pid, row.id]);
                        }
                        console.log(`Generated player_ids for ${all.length} existing users`);
                    });
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER,
                name TEXT,
                price REAL,
                image_url TEXT,
                FOREIGN KEY(owner_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                name TEXT,
                value REAL,
                odds REAL,
                image_url TEXT,
                FOREIGN KEY(case_id) REFERENCES cases(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS battles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cases JSON,
                mode TEXT,
                status TEXT DEFAULT 'waiting'
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS battle_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                battle_id INTEGER,
                user_id INTEGER,
                team INTEGER,
                is_bot BOOLEAN DEFAULT 0,
                total_won REAL DEFAULT 0,
                FOREIGN KEY(battle_id) REFERENCES battles(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS lotteries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                creator_id INTEGER,
                status TEXT DEFAULT 'waiting',
                timer_ends_at DATETIME,
                winner_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(creator_id) REFERENCES users(id),
                FOREIGN KEY(winner_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS lottery_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lottery_id INTEGER,
                user_id INTEGER,
                item_name TEXT,
                item_value REAL,
                image_url TEXT,
                user_inventory_id INTEGER,
                FOREIGN KEY(lottery_id) REFERENCES lotteries(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS upgrader_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                creator_id INTEGER,
                name TEXT,
                price REAL,
                image_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(creator_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS kalshi_markets (
                ticker TEXT PRIMARY KEY,
                event_ticker TEXT,
                title TEXT,
                yes_sub_title TEXT,
                category TEXT,
                yes_bid INTEGER,
                yes_ask INTEGER,
                no_bid INTEGER,
                no_ask INTEGER,
                last_price INTEGER,
                status TEXT,
                expiration_date TEXT,
                settlement_date TEXT,
                last_updated INTEGER,
                volume_24h REAL DEFAULT 0
            )`);

            // Safe migration: Add event_ticker, yes_sub_title, and volume_24h columns if they don't exist in an existing database
            db.all("PRAGMA table_info(kalshi_markets)", (err, columns) => {
                if (!err && columns) {
                    const hasEventTicker = columns.some(c => c.name === 'event_ticker');
                    const hasYesSubTitle = columns.some(c => c.name === 'yes_sub_title');
                    const hasVolume24h = columns.some(c => c.name === 'volume_24h');
                    
                    if (!hasEventTicker) {
                        db.run("ALTER TABLE kalshi_markets ADD COLUMN event_ticker TEXT", (alterErr) => {
                            if (alterErr) console.log("Migration log: event_ticker already exists or could not be added.");
                        });
                    }
                    if (!hasYesSubTitle) {
                        db.run("ALTER TABLE kalshi_markets ADD COLUMN yes_sub_title TEXT", (alterErr) => {
                            if (alterErr) console.log("Migration log: yes_sub_title already exists or could not be added.");
                        });
                    }
                    if (!hasVolume24h) {
                        db.run("ALTER TABLE kalshi_markets ADD COLUMN volume_24h REAL DEFAULT 0", (alterErr) => {
                            if (alterErr) console.log("Migration log: volume_24h already exists or could not be added.");
                        });
                    }
                }
            });

            // Safe migration: Add trade_url column to users if it doesn't exist
            db.all("PRAGMA table_info(users)", (err, columns) => {
                if (!err && columns) {
                    const hasTradeUrl = columns.some(c => c.name === 'trade_url');
                    const hasDob = columns.some(c => c.name === 'date_of_birth');
                    const hasTos = columns.some(c => c.name === 'accepted_tos');
                    const hasWagerReq = columns.some(c => c.name === 'wager_req');

                    if (!hasTradeUrl) {
                        db.run("ALTER TABLE users ADD COLUMN trade_url TEXT", (alterErr) => {
                            if (alterErr) console.log("Migration log: trade_url already exists or could not be added.");
                        });
                    }
                    if (!hasDob) {
                        db.run("ALTER TABLE users ADD COLUMN date_of_birth TEXT", (alterErr) => {
                            if (alterErr) console.log("Migration log: date_of_birth could not be added.");
                        });
                    }
                    if (!hasTos) {
                        db.run("ALTER TABLE users ADD COLUMN accepted_tos BOOLEAN DEFAULT 0", (alterErr) => {
                            if (alterErr) console.log("Migration log: accepted_tos could not be added.");
                        });
                    }
                    if (!hasWagerReq) {
                        db.run("ALTER TABLE users ADD COLUMN wager_req REAL DEFAULT 0", (alterErr) => {
                            if (alterErr) console.log("Migration log: wager_req could not be added.");
                        });
                    }
                }
            });


            db.run(`CREATE TABLE IF NOT EXISTS kalshi_bets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT,
                market_ticker TEXT,
                market_title TEXT,
                position TEXT,
                contracts INTEGER,
                buy_price INTEGER,
                total_cost REAL,
                status TEXT DEFAULT 'active',
                cashout_price INTEGER,
                payout_amount REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                settled_at INTEGER,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS user_inventories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                item_name TEXT NOT NULL,
                item_value REAL NOT NULL,
                image_url TEXT,
                float_value REAL,
                trade_offer_id TEXT,
                status TEXT DEFAULT 'available',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT,
                item_name TEXT,
                item_value REAL,
                status TEXT DEFAULT 'pending_review',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                image_url TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            // Safe migration: Add is_banned column to users if it doesn't exist
            db.all("PRAGMA table_info(users)", (err, columns) => {
                if (!err && columns) {
                    const hasIsBanned = columns.some(c => c.name === 'is_banned');
                    if (!hasIsBanned) {
                        db.run("ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT 0", (alterErr) => {
                            if (alterErr) console.log("Migration log: is_banned already exists or could not be added.");
                        });
                    }
                }
            });

            // Safe migration: Add affiliate/daily_case/referral columns to users
            db.all("PRAGMA table_info(users)", (err, columns) => {
                if (!err && columns) {
                    const hasReferredBy = columns.some(c => c.name === 'referred_by');
                    const hasAffiliateCode = columns.some(c => c.name === 'affiliate_code');
                    const hasAffiliateEarnings = columns.some(c => c.name === 'affiliate_earnings');
                    const hasLastDailyCase = columns.some(c => c.name === 'last_daily_case');
                    const hasWelcomeCases = columns.some(c => c.name === 'welcome_cases');
                    const hasDailyCaseStreak = columns.some(c => c.name === 'daily_case_streak');
                    const hasOnboardingDone = columns.some(c => c.name === 'onboarding_done');

                    if (!hasReferredBy) db.run("ALTER TABLE users ADD COLUMN referred_by INTEGER", (e) => { if (e) console.log("Migration: referred_by", e.message); });
                    if (!hasAffiliateCode) db.run("ALTER TABLE users ADD COLUMN affiliate_code TEXT", (e) => { if (e) console.log("Migration: affiliate_code", e.message); });
                    if (!hasAffiliateEarnings) db.run("ALTER TABLE users ADD COLUMN affiliate_earnings REAL DEFAULT 0", (e) => { if (e) console.log("Migration: affiliate_earnings", e.message); });
                    if (!hasLastDailyCase) db.run("ALTER TABLE users ADD COLUMN last_daily_case DATETIME", (e) => { if (e) console.log("Migration: last_daily_case", e.message); });
                    if (!hasWelcomeCases) db.run("ALTER TABLE users ADD COLUMN welcome_cases INTEGER DEFAULT 0", (e) => { if (e) console.log("Migration: welcome_cases", e.message); });
                    if (!hasDailyCaseStreak) db.run("ALTER TABLE users ADD COLUMN daily_case_streak INTEGER DEFAULT 0", (e) => { if (e) console.log("Migration: daily_case_streak", e.message); });
                    if (!hasOnboardingDone) db.run("ALTER TABLE users ADD COLUMN onboarding_done BOOLEAN DEFAULT 0", (e) => { if (e) console.log("Migration: onboarding_done", e.message); });
                    const hasTokenVersion = columns.some(c => c.name === 'token_version');
                    if (!hasTokenVersion) db.run("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0", (e) => { if (e) console.log("Migration: token_version", e.message); });
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS affiliate_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                affiliate_id INTEGER NOT NULL,
                referred_user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                commission REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(affiliate_id) REFERENCES users(id),
                FOREIGN KEY(referred_user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS bot_inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT,
                item_value REAL,
                image_url TEXT,
                float_value REAL
            )`, () => {
                // Only seed if the table is empty (first run)
                db.get('SELECT COUNT(*) as cnt FROM bot_inventory', (err, row) => {
                    if (err || (row && row.cnt > 0)) return;
                    const correctImages = {
                        "★ Karambit | Fade (FN)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Q7uCvZaZkNM-SD1iWwOpzj-1gSCGn20tztm_UyIn_JHKUbgYlWMcmQ-ZcskSwldS0MOnntAfd3YlMzH35jntXrnE8SOGRGG8",
                        "AK-47 | Case Hardened (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiNK0P2nZKFpH_yaCW-Ej7sk5bE8Sn-2lEpz4zndzoyvdHuUPwFzWZYiE7EK4Bi4k9TlY-y24FbAy9USGSiZd5Q",
                        "AWP | Asiimov (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6V-Kf2cGFidxOp_pewnF3nhxEt0sGnSzN76dH3GOg9xC8FyEORftRe-x9PuYurq71bW3d8UnjK-0H0YSTpMGQ",
                        "M4A4 | Howl (FN)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwiFO0P_6afVSKP-EAm6extF6ueZhW2exwkl2tmTXwt39eCiUPQR2DMN4TOVetUK8xoLgM-K341eM2otDnC6okGoXufBz_TAB",
                        "Desert Eagle | Blaze (FN)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7vORbqhsLfWAMWuZxuZi_uI_TX6wxxkjsGXXnImsJ37COlUoWcByEOMOtxa5kdXmNu3htVPZjN1bjXKpkHLRfQU",
                        "P90 | Desert Halftone (BS)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA",
                        "XM1014 | Canvas Cloud (BS)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLpk8ewrHZk5-uRa6hiNfSsDWadztF6ueZhW2fgwhghtm3SzN6qcS6fbwV1DpV5QO8P5kTulIW0P7vj4ATbjdlEm3iokGoXuQMfRK1o",
                        "G3SG1 | Green Cell (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2zYXnrB1I_82lYKVmKc-QD2qf_uJ_t-l9AXi3whgm4WjczNageHzCZgRyDcchRu8Ls0W5l922N7jhsgyMjYpAzS7gznQe2xurqq8",
                        "P250 | Sand Dune (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhzMOwwjFU0OGvZqBSLPmUBnPelesn5-RrSXDlwRhx5TjSwtmocCifPwQpDpshReBfsxPrk4DhNu3jshue1dy8VcXxuA",
                        "Dual Berettas | Colony (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL0kp_0-B1I4M29eKVuJc-eD3WZz-tJvOhuRz39wRx2smzVyIqtJ3OQaARzDschFO5esxm5mtHiM-7l5wCN3ohBxSz63zQJsHg_UethgQ",
                        "AK-47 | Redline (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSI_-RHGavzedxuPUnFniykEtzsWWBzoyuIiifaAchDZUjTOZe4RC_w4buM-6z7wzbgokUyzK-0H08hRGDMA",
                        "USP-S | Orion (FN)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKz2lu_XuWbwcuyMESA4Fdl-4nnpU7iQA3-kKn17jJk_PuibapuJeLdWGLFwL8i4eVsFiqxxUt34jmHnoysJ3qVOAYgCJZwQrRb5EPul4XlYvSiuVIHgy4Xvg",
                        "AWP | Atheris (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V7JkMPWBMWuZxuZi_rZsS3zgzU8isW3dnIr6eHKfPVAhDpojEe9YsUW4xta1Nuzm5FDci4NbjXKpmWVQppo",
                        "Glock-18 | Water Elemental (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnj9h1Y-s2pZKtuK72fB3aFxP11te99cCW6khUz_TjVyompc3-QOFR2DJQkFOMJtBbqk9LlY-7n5QLZjtkTxCWqhixPv311o7FVIf8eASQ",
                        "M4A1-S | Decimator (FT)": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_ega6F_H_eAMWrEwL9JtORqRiSygRI1jDGMnYftb3iUb1dxW5ImFLNftxCxktflZLm2tgaP2otGyn_-hytOvy9q5elQV_A7uvqA6CRSoZY"
                    };
                    const prices = {
                        "★ Karambit | Fade (FN)": 1500.0, "AK-47 | Case Hardened (FT)": 250.0, "AWP | Asiimov (FT)": 120.0,
                        "M4A4 | Howl (FN)": 3500.0, "Desert Eagle | Blaze (FN)": 600.0, "P90 | Desert Halftone (BS)": 0.05,
                        "XM1014 | Canvas Cloud (BS)": 0.04, "G3SG1 | Green Cell (FT)": 0.03, "P250 | Sand Dune (FT)": 0.05,
                        "Dual Berettas | Colony (FT)": 0.03, "AK-47 | Redline (FT)": 35.0, "USP-S | Orion (FN)": 45.0,
                        "AWP | Atheris (FT)": 5.0, "Glock-18 | Water Elemental (FT)": 8.0, "M4A1-S | Decimator (FT)": 15.0
                    };
                    const floats = {
                        "★ Karambit | Fade (FN)": 0.03, "AK-47 | Case Hardened (FT)": 0.18, "AWP | Asiimov (FT)": 0.22,
                        "M4A4 | Howl (FN)": 0.01, "Desert Eagle | Blaze (FN)": 0.04, "P90 | Desert Halftone (BS)": 0.65,
                        "XM1014 | Canvas Cloud (BS)": 0.72, "G3SG1 | Green Cell (FT)": 0.19, "P250 | Sand Dune (FT)": 0.21,
                        "Dual Berettas | Colony (FT)": 0.24, "AK-47 | Redline (FT)": 0.15, "USP-S | Orion (FN)": 0.02,
                        "AWP | Atheris (FT)": 0.17, "Glock-18 | Water Elemental (FT)": 0.23, "M4A1-S | Decimator (FT)": 0.16
                    };
                    const stmt = db.prepare("INSERT INTO bot_inventory (item_name, item_value, image_url, float_value) VALUES (?, ?, ?, ?)");
                    for (const [name, url] of Object.entries(correctImages)) {
                        stmt.run(name, prices[name], url, floats[name] || 0.15);
                    }
                    stmt.finalize();
                    console.log("Seeded bot_inventory with 15 fallback items (table was empty).");
                });
            });

            db.all("PRAGMA table_info(balance_history)", (err, columns) => {
                const hasOldGems = !err && columns && columns.some(c => c.name === 'old_gems');
                const runCreate = () => {
                    db.run(`CREATE TABLE IF NOT EXISTS balance_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        change REAL NOT NULL,
                        new_balance REAL NOT NULL,
                        description TEXT,
                        multiplier REAL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id)
                    )`);
                };
                if (hasOldGems) {
                    db.run("DROP TABLE balance_history", (dropErr) => {
                        if (!dropErr) console.log("Dropped legacy balance_history table containing 'old_gems'");
                        runCreate();
                    });
                } else {
                    runCreate();
                }
            });

            // Safe migration: Add missing columns to balance_history if they don't exist
            db.all("PRAGMA table_info(balance_history)", (err, columns) => {
                if (!err && columns) {
                    const hasDescription = columns.some(c => c.name === 'description');
                    const hasMultiplier = columns.some(c => c.name === 'multiplier');
                    if (!hasDescription) {
                        db.run("ALTER TABLE balance_history ADD COLUMN description TEXT", (e) => {
                            if (e) console.log("Migration log: balance_history.description", e.message);
                            else console.log("Migration: Added 'description' column to balance_history");
                        });
                    }
                    if (!hasMultiplier) {
                        db.run("ALTER TABLE balance_history ADD COLUMN multiplier REAL", (e) => {
                            if (e) console.log("Migration log: balance_history.multiplier", e.message);
                            else console.log("Migration: Added 'multiplier' column to balance_history");
                        });
                    }
                }
            });

            // Drop old trigger if it exists from previous version
            db.run("DROP TRIGGER IF EXISTS log_balance_change");

            db.run(`CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subject TEXT NOT NULL,
                status TEXT DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS ticket_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                user_id INTEGER,
                message TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(ticket_id) REFERENCES support_tickets(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS world_cup_bets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                match_id TEXT NOT NULL,
                home_team TEXT NOT NULL,
                away_team TEXT NOT NULL,
                bet_type TEXT NOT NULL,
                odds REAL NOT NULL,
                stake REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                payout REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            console.log('All tables ready.');
        });
    }
});

module.exports = db;
