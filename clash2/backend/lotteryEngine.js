const db = require('./database');

let currentLottery = { id: null, entries: [], status: 'waiting', timer_ends_at: null, total_value: 0 };
let timerHandle = null;

function emitState(io) {
    io.emit('lottery_state', {
        entries: currentLottery.entries.map(e => ({
            user_id: e.user_id, username: e.username, avatar: e.avatar,
            total_value: e.total_value, items: e.items
        })),
        status: currentLottery.status,
        timer_ends_at: currentLottery.timer_ends_at,
        total_value: currentLottery.total_value
    });
}

function startTimer(io) {
    if (timerHandle) return;
    const endTime = Date.now() + 30000;
    currentLottery.timer_ends_at = endTime;
    currentLottery.status = 'active';
    db.run('UPDATE lotteries SET status = ?, timer_ends_at = datetime(?, \'unixepoch\') WHERE id = ?', ['active', Math.floor(endTime / 1000), currentLottery.id]);
    emitState(io);

    timerHandle = setInterval(() => {
        const remaining = Math.max(0, currentLottery.timer_ends_at - Date.now());
        io.emit('lottery_tick', { timeLeft: remaining });
        if (remaining <= 0) {
            clearInterval(timerHandle);
            timerHandle = null;
            startRoll(io);
        }
    }, 100);
}

function startRoll(io) {
    const entries = currentLottery.entries;
    if (entries.length < 2) {
        resetLottery();
        emitState(io);
        return;
    }

    const totalPot = currentLottery.total_value;
    const rand = Math.random() * totalPot;
    let cumulative = 0;
    let winner = entries[0];
    for (const e of entries) {
        cumulative += e.total_value;
        if (rand <= cumulative) { winner = e; break; }
    }

    const participants = entries.map(e => ({ avatar: e.avatar || '', username: e.username }));
    const winnerEntry = { avatar: winner.avatar || '', username: winner.username };

    currentLottery.status = 'rolling';
    io.emit('lottery_rolling', { participants, winnerEntry });
    setTimeout(() => finishLottery(io, winner), 5000);
}

function finishLottery(io, winner) {
    const entries = currentLottery.entries;
    if (!winner || entries.length < 2) {
        resetLottery();
        emitState(io);
        return;
    }

    const totalPot = currentLottery.total_value;
    const winnerId = winner.user_id;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('UPDATE lotteries SET status = ?, winner_id = ? WHERE id = ?', ['completed', winnerId, currentLottery.id]);

        const stmt = db.prepare('UPDATE user_inventories SET status = ?, user_id = ? WHERE id = ?');
        for (const e of entries) {
            for (const itemId of e.item_ids) {
                stmt.run(['available', winnerId, itemId]);
            }
        }
        stmt.finalize(() => {
            db.run('COMMIT', () => {
                const result = {
                    winner: { user_id: winner.user_id, username: winner.username, avatar: winner.avatar || '', items: winner.items },
                    participants: entries.map(e => ({ user_id: e.user_id, username: e.username, avatar: e.avatar || '', items: e.items })),
                    total_value: totalPot
                };
                io.emit('lottery_finished', result);
                db.run('INSERT INTO balance_history (user_id, change, description) VALUES (?, ?, ?)', [winnerId, 0, 'Won lottery #' + currentLottery.id]);
                resetLottery();
                emitState(io);
            });
        });
    });
}

function resetLottery() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    currentLottery = { id: null, entries: [], status: 'waiting', timer_ends_at: null, total_value: 0 };
}

function createNewLotteryInDb(callback) {
    db.run('INSERT INTO lotteries (creator_id, status) VALUES (?, ?)', [0, 'waiting'], function(err) {
        if (err) return callback(null);
        callback(this.lastID);
    });
}

module.exports = (io) => {
    io.on('connection', (socket) => {
        socket.on('get_lottery', (callback) => {
            if (typeof callback === 'function') {
                callback({
                    entries: currentLottery.entries.map(e => ({
                        user_id: e.user_id, username: e.username, avatar: e.avatar,
                        total_value: e.total_value, items: e.items
                    })),
                    status: currentLottery.status,
                    timer_ends_at: currentLottery.timer_ends_at,
                    total_value: currentLottery.total_value
                });
            }
        });

        socket.on('join_lottery', (data, callback) => {
            if (!socket.user) return callback({ error: 'Not authenticated' });
            const userId = socket.user.id;
            const itemIds = data?.itemIds;
            if (!Array.isArray(itemIds) || itemIds.length === 0) {
                return callback({ error: 'Select at least one item.' });
            }

            if (currentLottery.entries.find(e => e.user_id === userId)) {
                return callback({ error: 'You already joined this lottery.' });
            }

            const placeholders = itemIds.map(() => '?').join(',');
            db.all(`SELECT * FROM user_inventories WHERE id IN (${placeholders}) AND user_id = ? AND status = 'available'`, [...itemIds, userId], (err, items) => {
                if (!items || items.length === 0) {
                    return callback({ error: 'Items not found or not available.' });
                }
                db.get('SELECT username, avatar FROM users WHERE id = ?', [userId], (err, user) => {
                    if (!user) return callback({ error: 'User not found' });

                    const totalValue = items.reduce((s, i) => s + i.item_value, 0);

                    if (!currentLottery.id) {
                        createNewLotteryInDb((newId) => {
                            if (!newId) return callback({ error: 'Database error' });
                            currentLottery.id = newId;
                            finalizeJoin(io, socket, callback, userId, user, items, itemIds, totalValue);
                        });
                    } else {
                        finalizeJoin(io, socket, callback, userId, user, items, itemIds, totalValue);
                    }
                });
            });
        });
    });
};

function finalizeJoin(io, socket, callback, userId, user, items, itemIds, totalValue) {
    const placeholders = itemIds.map(() => '?').join(',');
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare('INSERT INTO lottery_entries (lottery_id, user_id, item_name, item_value, image_url, user_inventory_id) VALUES (?, ?, ?, ?, ?, ?)');
        let insertErr = null;
        for (const item of items) {
            stmt.run([currentLottery.id, userId, item.item_name, item.item_value, item.image_url, item.id], (err) => {
                if (err && !insertErr) insertErr = err;
            });
        }
        stmt.finalize(() => {
            if (insertErr) { db.run('ROLLBACK'); return callback({ error: 'Failed to add entries' }); }
            db.run('UPDATE user_inventories SET status = ? WHERE id IN (' + placeholders + ')', ['lottery', ...itemIds], (updateErr) => {
                if (updateErr) { db.run('ROLLBACK'); return callback({ error: 'Failed to lock items' }); }
                db.run('COMMIT', (commitErr) => {
                    if (commitErr) return callback({ error: 'Commit failed' });
                    const entryItems = items.map(i => ({ item_name: i.item_name, item_value: i.item_value, image_url: i.image_url, float_value: i.float_value }));
                    const entry = { user_id: userId, username: user.username, avatar: user.avatar || '', total_value: totalValue, item_ids: itemIds, items: entryItems };
                    currentLottery.entries.push(entry);
                    currentLottery.total_value += totalValue;
                    callback({ success: true });
                    emitState(io);
                    if (currentLottery.entries.length >= 2) {
                        startTimer(io);
                    }
                });
            });
        });
    });
}
