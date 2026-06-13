const db = require('./database');

const activeBattles = {}; 
// battleId: { id, mode, cases: [], players: [], status: 'waiting'|'rolling'|'finished', currentRound: 0, rolls: [] }

const wagerGems = (userId, amount) => {
    if (!amount || amount <= 0) return;
    db.run('UPDATE users SET wager_req = CASE WHEN wager_req - ? < 0 THEN 0 ELSE wager_req - ? END WHERE id = ?', [amount, amount, userId], (err) => {
        if (err) console.error('[Wager] Failed to update wager requirement in battleEngine:', err.message);
    });
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

module.exports = (io) => {
    const battleCreateCooldown = new Map(); // userId -> timestamp

    io.on('connection', (socket) => {
        socket.on('create_battle', async (data, callback) => {
            const safeCallback = (res) => {
                if (typeof callback === 'function') {
                    try { callback(res); } catch (e) {}
                }
            };

            if (!socket.userId) {
                return safeCallback({ error: 'Not authenticated' });
            }

            // 5-second cooldown between battle creations
            const now = Date.now();
            const lastCreate = battleCreateCooldown.get(socket.userId) || 0;
            if (now - lastCreate < 5000) {
                return safeCallback({ error: 'Please wait 5 seconds between creating battles.' });
            }
            battleCreateCooldown.set(socket.userId, now);

            if (!data || typeof data !== 'object') {
                return safeCallback({ error: 'Invalid payload: expected object' });
            }

            const { caseIds, mode, isCrazyMode, isMythicSpin } = data;

            if (!Array.isArray(caseIds) || caseIds.length === 0) {
                return safeCallback({ error: 'Case IDs must be a non-empty array' });
            }

            if (caseIds.length > 20) {
                return safeCallback({ error: 'A battle cannot have more than 20 cases' });
            }

            const validCaseIds = caseIds.every(id => Number.isInteger(id) && id > 0);
            if (!validCaseIds) {
                return safeCallback({ error: 'All case IDs must be valid positive integers' });
            }

            const allowedModes = ['solo', '1v1', '1v1v1', '2v2', '3v3', 'ffa'];
            if (typeof mode !== 'string' || !allowedModes.includes(mode)) {
                return safeCallback({ error: 'Invalid game mode' });
            }

            const isCrazyModeBool = isCrazyMode === true;
            const isMythicSpinBool = isMythicSpin === true;

            try {
                // Fetch cases to calculate cost and get items
                let totalCost = 0;
                const casesData = [];
                for (const cid of caseIds) {
                    const row = await new Promise((resolve, reject) => {
                        db.get('SELECT * FROM cases WHERE id = ?', [cid], (err, row) => err ? reject(err) : resolve(row));
                    });
                    if (!row) return safeCallback({ error: 'Case not found' });
                    
                    const items = await new Promise((resolve, reject) => {
                        db.all('SELECT * FROM items WHERE case_id = ?', [cid], (err, rows) => err ? reject(err) : resolve(rows));
                    });

                    totalCost += row.price;
                    casesData.push({ ...row, items });
                }

                // Deduct cost atomically to prevent race conditions
                const deductSuccess = await new Promise((resolve) => {
                    db.run('UPDATE users SET gems = gems - ? WHERE id = ? AND gems >= ?', [totalCost, socket.userId, totalCost], function(err) {
                        if (err || this.changes === 0) resolve(false);
                        else {
                            wagerGems(socket.userId, totalCost);
                            resolve(true);
                        }
                    });
                });
                
                if (!deductSuccess) return safeCallback({ error: 'Insufficient gems' });

                // Fetch user data for username
                const user = await new Promise((resolve, reject) => {
                    db.get('SELECT * FROM users WHERE id = ?', [socket.userId], (err, row) => err ? reject(err) : resolve(row));
                });

                const battleId = Date.now().toString();
                
                let ffaPlayers = parseInt(data.ffaPlayers);
                if (isNaN(ffaPlayers) || ffaPlayers < 2 || ffaPlayers > 6) ffaPlayers = 6;
                const maxPlayers = { 'solo': 1, '1v1': 2, '1v1v1': 3, '2v2': 4, '3v3': 6, 'ffa': ffaPlayers }[mode] || 2;

                activeBattles[battleId] = {
                    id: battleId,
                    mode: mode,
                    isCrazyMode: isCrazyModeBool,
                    isMythicSpin: isMythicSpinBool,
                    maxPlayers,
                    hostId: user.id,
                    cost: totalCost,
                    cases: casesData,
                    players: [{ id: user.id, username: user.username, avatar: 'user', isBot: false, totalWon: 0, rolls: [] }],
                    status: 'waiting'
                };

                socket.join(`battle_${battleId}`);
                io.emit('battles_update', Object.values(activeBattles).filter(b => b.status === 'waiting'));
                
                safeCallback({ success: true, battleId });
                
                // If it's a solo battle, start immediately
                if (maxPlayers === 1) {
                    startBattle(battleId, io);
                }
            } catch (err) {
                console.error(err);
                safeCallback({ error: 'Server error' });
            }
        });

        socket.on('join_battle', async (battleId, callback) => {
            const safeCallback = (res) => {
                if (typeof callback === 'function') {
                    try { callback(res); } catch (e) {}
                }
            };

            if (!socket.userId) {
                return safeCallback({ error: 'Not authenticated' });
            }

            if (typeof battleId !== 'string') {
                return safeCallback({ error: 'Invalid battle ID' });
            }

            const battle = activeBattles[battleId];
            if (!battle || battle.status !== 'waiting') return safeCallback({ error: 'Battle not available' });
            if (battle.players.length >= battle.maxPlayers) return safeCallback({ error: 'Battle full' });
            if (battle.players.some(p => p.id === socket.userId)) return safeCallback({ error: 'Already joined' });
            
            battle.pendingJoins = battle.pendingJoins || new Set();
            if (battle.pendingJoins.has(socket.userId)) return safeCallback({ error: 'Already joining' });
            battle.pendingJoins.add(socket.userId);

            // Deduct cost atomically
            const deductSuccess = await new Promise((resolve) => {
                db.run('UPDATE users SET gems = gems - ? WHERE id = ? AND gems >= ?', [battle.cost, socket.userId, battle.cost], function(err) {
                    if (err || this.changes === 0) resolve(false);
                    else {
                        wagerGems(socket.userId, battle.cost);
                        resolve(true);
                    }
                });
            });

            if (!deductSuccess) {
                battle.pendingJoins.delete(socket.userId);
                return safeCallback({ error: 'Insufficient gems' });
            }

            // Fetch user for username
            const user = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE id = ?', [socket.userId], (err, row) => err ? reject(err) : resolve(row));
            });

            battle.players.push({ id: user.id, username: user.username, avatar: 'user', isBot: false, totalWon: 0, rolls: [] });
            battle.pendingJoins.delete(socket.userId);
            socket.join(`battle_${battleId}`);
            
            io.to(`battle_${battleId}`).emit('battle_updated', battle);
            io.emit('battles_update', Object.values(activeBattles).filter(b => b.status === 'waiting'));

            if (battle.players.length === battle.maxPlayers) {
                startBattle(battleId, io);
            }

            safeCallback({ success: true });
        });

        socket.on('call_bot', (battleId, callback) => {
            const safeCallback = (res) => {
                if (typeof callback === 'function') {
                    try { callback(res); } catch (e) {}
                }
            };

            if (!socket.userId) {
                return safeCallback({ error: 'Not authenticated' });
            }

            if (typeof battleId !== 'string') {
                return safeCallback({ error: 'Invalid battle ID' });
            }

            const battle = activeBattles[battleId];
            if (!battle || battle.status !== 'waiting') return safeCallback({ error: 'Battle not available' });
            if (battle.players.length >= battle.maxPlayers) return safeCallback({ error: 'Battle full' });
            if (battle.hostId !== socket.userId) return safeCallback({ error: 'Only the host can call bots' });

            // Cooldown lock to prevent duplicate bot additions via double-click socket emits
            const now = Date.now();
            battle.lastBotCall = battle.lastBotCall || 0;
            if (now - battle.lastBotCall < 500) {
                return safeCallback({ error: 'Please wait between calling bots' });
            }
            battle.lastBotCall = now;

            const botId = 'bot_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            battle.players.push({ id: botId, username: 'Bot_' + Math.floor(Math.random() * 1000), avatar: 'bot', isBot: true, totalWon: 0, rolls: [] });
            
            io.to(`battle_${battleId}`).emit('battle_updated', battle);

            if (battle.players.length === battle.maxPlayers) {
                startBattle(battleId, io);
            }
            safeCallback({ success: true });
        });

        socket.on('get_battles', (callback) => {
            const safeCallback = (res) => {
                if (typeof callback === 'function') {
                    try { callback(res); } catch (e) {}
                }
            };
            safeCallback(Object.values(activeBattles).filter(b => b.status !== 'finished'));
        });

        socket.on('watch_battle', (battleId) => {
            if (typeof battleId !== 'string') return;

            socket.join(`battle_${battleId}`);
            if (activeBattles[battleId]) {
                socket.emit('battle_updated', activeBattles[battleId]);
            }
        });
    });

    const startBattle = async (battleId, io) => {
        const battle = activeBattles[battleId];
        battle.status = 'rolling';
        io.emit('battles_update', Object.values(activeBattles).filter(b => b.status === 'waiting'));
        io.to(`battle_${battleId}`).emit('battle_started', battle);

        // Pre-roll all cases for all players
        let hasAnyMythic = false;
        for (let round = 0; round < battle.cases.length; round++) {
            const currentCase = battle.cases[round];
            
            // Payout 1% to case owner
            db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [currentCase.price * 0.01 * battle.players.length, currentCase.owner_id]);

            // Mythic spin setup
            const threshold = currentCase.price * 2.5;
            const normalItems = battle.isMythicSpin ? currentCase.items.filter(i => i.value <= threshold) : currentCase.items;
            const mythicItems = battle.isMythicSpin ? currentCase.items.filter(i => i.value > threshold) : [];
            const mythicTotalOdds = mythicItems.reduce((s, i) => s + i.odds, 0);
            const hasMythicPool = battle.isMythicSpin && mythicItems.length > 0 && mythicTotalOdds > 0;

            for (const player of battle.players) {
                let roll = Math.random() * 100;
                let wonItem = null;
                let hitMythic = false;
                let cumProb = 0;

                if (hasMythicPool) {
                    for (const item of normalItems) {
                        cumProb += item.odds;
                        if (roll <= cumProb) { wonItem = item; break; }
                    }
                    if (!wonItem) {
                        hitMythic = true;
                        hasAnyMythic = true;
                        let mythicRoll = Math.random() * mythicTotalOdds;
                        let mythicCum = 0;
                        for (const item of mythicItems) {
                            mythicCum += item.odds;
                            if (mythicRoll <= mythicCum) { wonItem = item; break; }
                        }
                        if (!wonItem) wonItem = mythicItems[mythicItems.length - 1];
                    }
                } else {
                    for (const item of currentCase.items) {
                        cumProb += item.odds;
                        if (roll <= cumProb) { wonItem = item; break; }
                    }
                    if (!wonItem) wonItem = currentCase.items[currentCase.items.length - 1];
                }
                
                wonItem = { ...wonItem, isMythicHit: hitMythic };
                player.rolls.push(wonItem);
                player.totalWon += wonItem.value;
            }
        }

        // Send results and animate rounds
        let roundIndex = 0;
        const emitRound = () => {
            if (roundIndex >= battle.cases.length) {
                finishBattle(battleId, io);
            } else {
                io.to(`battle_${battleId}`).emit('battle_round', { round: roundIndex, players: battle.players });
                const hasMythicHit = battle.players.some(p => p.rolls[roundIndex]?.isMythicHit);
                const delay = hasMythicHit ? 13000 : 7000;
                roundIndex++;
                setTimeout(emitRound, delay);
            }
        };
        emitRound();
    };

    const finishBattle = (battleId, io) => {
        const battle = activeBattles[battleId];
        battle.status = 'finished';

        // Determine winners
        // For simplicity: FFA takes highest totalWon. For 2v2, sum teams.
        let winners = [];
        if (battle.mode === '2v2' || battle.mode === '3v3') {
            const team1 = battle.players.slice(0, battle.players.length / 2);
            const team2 = battle.players.slice(battle.players.length / 2);
            const t1Total = team1.reduce((acc, p) => acc + p.totalWon, 0);
            const t2Total = team2.reduce((acc, p) => acc + p.totalWon, 0);
            
            const totalLoot = t1Total + t2Total;
            if (battle.isCrazyMode) {
                if (t1Total < t2Total) winners = team1;
                else if (t2Total < t1Total) winners = team2;
                else winners = [...team1, ...team2]; // Tie
            } else {
                if (t1Total > t2Total) winners = team1;
                else if (t2Total > t1Total) winners = team2;
                else winners = [...team1, ...team2]; // Tie
            }

            const payoutPerWinner = totalLoot / winners.length;
            winners.forEach(w => {
                if (!w.isBot) db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [payoutPerWinner, w.id]);
            });
            winners.forEach(w => {
                if (!w.isBot) logBalanceChange(w.id, payoutPerWinner, 'Battle', null);
            });
        } else if (battle.mode === 'ffa') {
            // FFA Mode / Group Mode: Split the total loot among ALL players equally
            winners = battle.players;
            const totalLoot = battle.players.reduce((acc, p) => acc + p.totalWon, 0);
            const payoutPerWinner = totalLoot / winners.length;
            winners.forEach(w => {
                if (!w.isBot) db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [payoutPerWinner, w.id]);
            });
            winners.forEach(w => {
                if (!w.isBot) logBalanceChange(w.id, payoutPerWinner, 'Battle', null);
            });
        } else {
            // Other modes (solo, 1v1, 1v1v1)
            if (battle.isCrazyMode) {
                let lowest = Infinity;
                battle.players.forEach(p => { if (p.totalWon < lowest) lowest = p.totalWon; });
                winners = battle.players.filter(p => p.totalWon === lowest);
            } else {
                let highest = 0;
                battle.players.forEach(p => { if (p.totalWon > highest) highest = p.totalWon; });
                winners = battle.players.filter(p => p.totalWon === highest);
            }
            
            const totalLoot = battle.players.reduce((acc, p) => acc + p.totalWon, 0);
            const payoutPerWinner = totalLoot / winners.length;
            winners.forEach(w => {
                if (!w.isBot) db.run('UPDATE users SET gems = gems + ? WHERE id = ?', [payoutPerWinner, w.id]);
            });
            winners.forEach(w => {
                if (!w.isBot) logBalanceChange(w.id, payoutPerWinner, 'Battle', null);
            });
        }

        // Broadcast to game feed for all human players
        if (global.broadcastGameResult) {
            const totalLootFeed = battle.players.reduce((acc, p) => acc + p.totalWon, 0);
            const payoutPerWinnerFeed = winners.length > 0 ? totalLootFeed / winners.length : 0;
            battle.players.forEach(p => {
                if (!p.isBot) {
                    const isWinner = winners.some(w => w.id === p.id);
                    const payout = isWinner ? payoutPerWinnerFeed : 0;
                    const multiplier = battle.cost > 0 ? payout / battle.cost : 0;
                    global.broadcastGameResult(p.username, 'CaseBattle', battle.cost, payout, multiplier);
                }
            });
        }

        io.to(`battle_${battleId}`).emit('battle_finished', { winners, battle });
        io.emit('battles_update', Object.values(activeBattles).filter(b => b.status === 'waiting'));
        
        setTimeout(() => {
            delete activeBattles[battleId];
        }, 60000); // Keep result for 60s
    };
};
