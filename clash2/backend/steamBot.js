const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const db = require('./database');

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    community: community,
    language: 'en'
});

const isEnabled = !!(
    process.env.STEAM_ACCOUNT_NAME && 
    process.env.STEAM_PASSWORD
);

let botReady = false;

if (isEnabled) {
    console.log('[SteamBot] Bot credentials found. Initializing real Steam bot connection...');

    const logOnOptions = {
        accountName: process.env.STEAM_ACCOUNT_NAME,
        password: process.env.STEAM_PASSWORD,
    };

    // Auto-generate 2FA code if shared secret is provided
    if (process.env.STEAM_SHARED_SECRET) {
        try {
            logOnOptions.twoFactorCode = SteamTotp.generateAuthCode(process.env.STEAM_SHARED_SECRET);
        } catch (totpErr) {
            console.error('[SteamBot] Error generating Steam TOTP code:', totpErr.message);
        }
    }

    client.logOn(logOnOptions);

    client.on('steamGuard', (domain, callback) => {
        if (process.env.STEAM_GUARD_CODE) {
            const code = process.env.STEAM_GUARD_CODE.trim();
            console.log(`[SteamBot] Using Steam Guard code from STEAM_GUARD_CODE env var.`);
            process.env.STEAM_GUARD_CODE = '';
            return callback(code);
        }
        const fs = require('fs');
        const path = require('path');
        const sgFile = path.join(__dirname, '..', 'sg.txt');
        try {
            if (fs.existsSync(sgFile)) {
                const code = fs.readFileSync(sgFile, 'utf8').trim();
                if (code.length === 5) {
                    console.log(`[SteamBot] Using Steam Guard code from sg.txt`);
                    fs.unlinkSync(sgFile);
                    return callback(code);
                }
            }
        } catch (e) {}
        console.log(`[SteamBot] Steam Guard code required. Set STEAM_GUARD_CODE env var or create sg.txt with the code.`);
        process.stdin.resume();
        process.stdin.once('data', (data) => {
            const code = data.toString().trim();
            callback(code);
        });
    });

    client.on('loggedOn', () => {
        console.log(`[SteamBot] Successfully logged into Steam as ${process.env.STEAM_ACCOUNT_NAME}`);
    });

    client.on('error', (err) => {
        console.error('[SteamBot] Steam login error:', err.message || err);
    });

    client.on('webSession', (sessionID, cookies) => {
        community.setCookies(cookies);
        manager.setCookies(cookies, (err) => {
            if (err) {
                console.error('[SteamBot] Error setting cookies for TradeOfferManager:', err.message);
                return;
            }
            botReady = true;
            console.log('[SteamBot] TradeOfferManager is fully ready.');
        });
    });

    // Listen for trade offer status changes
    manager.on('sentOfferChanged', (offer, oldState) => {
        const stateName = TradeOfferManager.ETradeOfferState[offer.state];
        const oldStateName = TradeOfferManager.ETradeOfferState[oldState] || oldState;
        console.log(`[SteamBot] Offer #${offer.id} changed state: ${oldStateName} -> ${stateName}`);

        // State 3 corresponds to Accepted
        if (offer.state === TradeOfferManager.ETradeOfferState.Accepted) {
            handleRealTradeAccepted(offer);
        }
    });
} else {
    console.log('[SteamBot] Bot credentials missing in .env. Running in simulated fallback mode.');
}

// Inserts items into user_inventories when a real trade offer is accepted on Steam
function handleRealTradeAccepted(offer) {
    const tradeOfferId = offer.id;

    db.all("SELECT * FROM deposits WHERE trade_offer_id = ? AND status = 'pending_offer'", [tradeOfferId], (err, rows) => {
        if (err || !rows || rows.length === 0) {
            console.warn(`[SteamBot] No matching pending deposit found in DB for accepted offer #${tradeOfferId}`);
            return;
        }

        const userId = rows[0].user_id;
        const totalValue = rows.reduce((sum, row) => sum + row.item_value, 0);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // Insert each item into user_inventories
            const stmt = db.prepare("INSERT INTO user_inventories (user_id, item_name, item_value, image_url, trade_offer_id, status) VALUES (?, ?, ?, ?, ?, ?)");
            let insertErr = null;
            for (const row of rows) {
                stmt.run([userId, row.item_name, row.item_value, row.image_url || '', tradeOfferId, 'available'], (err) => {
                    if (err && !insertErr) insertErr = err;
                });
            }

            stmt.finalize(() => {
                if (insertErr) {
                    console.error(`[SteamBot] Error inserting items into user_inventories:`, insertErr.message);
                    db.run("ROLLBACK");
                    return;
                }

                // Mark deposits as completed (no gems credited)
                db.run("UPDATE deposits SET status = 'completed' WHERE trade_offer_id = ? AND status = 'pending_offer'", [tradeOfferId], (updateErr) => {
                    if (updateErr) {
                        console.error(`[SteamBot] Error updating deposit rows:`, updateErr.message);
                        db.run("ROLLBACK");
                        return;
                    }

                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) {
                            console.error("[SteamBot] DB transaction commit failed:", commitErr.message);
                        } else {
                            console.log(`[SteamBot] Real trade #${tradeOfferId} accepted. ${rows.length} items added to user_inventories for user ID ${userId} (total value: $${totalValue.toFixed(2)}).`);
                            // Track affiliate deposit
                            if (typeof global.trackAffiliateDeposit === 'function') {
                                global.trackAffiliateDeposit(userId, totalValue);
                            }
                        }
                    });
                });
            });
        });
    });
}

// Sends a real deposit trade offer using the user's trade URL and active CS2 skin assets
function sendRealDepositTradeOffer(userTradeUrl, items, userId) {
    return new Promise((resolve, reject) => {
        if (!isEnabled || !botReady) {
            return reject(new Error('Steam Bot is not initialized or authenticated.'));
        }

        try {
            const offer = manager.createOffer(userTradeUrl);
            
            // App ID 730 is CS2, Context ID 2 is the inventory context
            for (const item of items) {
                if (!item.assetid) {
                    return reject(new Error(`Missing assetid for item: ${item.name}`));
                }
                offer.addTheirItem({
                    appid: 730,
                    contextid: '2',
                    assetid: item.assetid
                });
            }

            offer.setMessage('BlueGem Deposit Trade Offer');

            offer.send((sendErr, status) => {
                if (sendErr) {
                    // Strip HTML tags from Steam error messages (they contain <br> tags)
                    const cleanMsg = sendErr.message.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    console.error('[SteamBot] Error sending trade offer:', cleanMsg);
                    return reject(new Error(`Failed to send trade offer: ${cleanMsg}`));
                }

                console.log(`[SteamBot] Trade offer successfully sent. Status: ${status}`);

                // If offer requires confirmation (standard for sending/taking trades)
                if (status === 'pending') {
                    const time = SteamTotp.time();
                    const confKey = SteamTotp.getConfirmationKey(process.env.STEAM_IDENTITY_SECRET, time, 'conf');
                    community.acceptConfirmationForObject(process.env.STEAM_IDENTITY_SECRET, offer.id, (confirmErr) => {
                        if (confirmErr) {
                            console.error(`[SteamBot] Failed to auto-confirm offer #${offer.id}:`, confirmErr.message);
                            // Still resolve — the offer was sent, just needs manual confirmation
                            resolve(offer.id);
                            return;
                        }
                        console.log(`[SteamBot] Offer #${offer.id} successfully confirmed on Steam Guard.`);
                        resolve(offer.id);
                    });
                } else {
                    resolve(offer.id);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    isEnabled,
    isReady: () => botReady,
    sendRealDepositTradeOffer
};
