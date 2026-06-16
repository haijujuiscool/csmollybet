const db = require('./database');
const fs = require('fs');
const path = require('path');

const AVATARS_DIR = path.join(__dirname, 'public', 'avatars');

const BOT_NAMES = [
  'James Wilson', 'Sarah Chen', 'Michael Brown', 'Emma Davis', 'Daniel Kim',
  'Olivia Martinez', 'William Taylor', 'Sophia Anderson', 'David Thomas', 'Isabella Jackson',
  'Joseph White', 'Mia Harris', 'Alexander Martin', 'Charlotte Thompson', 'Benjamin Garcia',
  'Amelia Robinson', 'Ryan Clark', 'Harper Lewis', 'Nathan Walker', 'Evelyn Hall',
  'Tyler Young', 'Abigail Allen', 'Lucas King', 'Emily Wright', 'Jacob Scott',
  'Elizabeth Green', 'Ethan Baker', 'Sofia Hill', 'Mason Adams', 'Avery Nelson',
];

const REALISTIC_ITEMS = [
  { name: 'AK-47 | Redline', min: 2, max: 8 },
  { name: 'M4A4 | Asiimov', min: 3, max: 10 },
  { name: 'AWP | Electric Hive', min: 1, max: 5 },
  { name: 'Desert Eagle | Code Red', min: 2, max: 7 },
  { name: 'USP-S | Kill Confirmed', min: 3, max: 9 },
  { name: 'Glock-18 | Wasteland Rebel', min: 1, max: 4 },
  { name: 'FAMAS | Eye of Athena', min: 1, max: 4 },
  { name: 'M4A1-S | Decimator', min: 2, max: 6 },
  { name: 'MAC-10 | Stalker', min: 1, max: 3 },
  { name: 'Galil AR | Signal', min: 1, max: 4 },
  { name: 'SSG 08 | Death Strike', min: 1, max: 3 },
  { name: 'MP9 | Hot Rod', min: 1, max: 5 },
  { name: 'Five-SeveN | Angry Mob', min: 1, max: 3 },
  { name: 'P250 | Asiimov', min: 1, max: 3 },
  { name: 'Tec-9 | Fuel Injector', min: 1, max: 4 },
  { name: 'P2000 | Imperial Dragon', min: 1, max: 4 },
  { name: 'Dual Berettas | Royal Consorts', min: 1, max: 3 },
  { name: 'Negev | Lionfish', min: 1, max: 2 },
  { name: 'MAG-7 | Justice', min: 1, max: 3 },
  { name: 'UMP-45 | Momentum', min: 1, max: 3 },
];

const WEARS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

let cachedAvatars = [];
let usedBotNames = new Set();

let currentLottery = { id: null, entries: [], status: 'waiting', timer_ends_at: null, total_value: 0 };
let timerHandle = null;
let botTimerHandle = null;

function loadAvatars() {
  try {
    cachedAvatars = fs.readdirSync(AVATARS_DIR).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp', '.jfif', '.gif'].includes(ext);
    });
  } catch (e) {
    cachedAvatars = [];
  }
}

function pickAvatar() {
  if (cachedAvatars.length === 0) return '';
  return `/avatars/${cachedAvatars[Math.floor(Math.random() * cachedAvatars.length)]}`;
}

function pickBotName() {
  const available = BOT_NAMES.filter(n => !usedBotNames.has(n));
  if (available.length === 0) {
    usedBotNames.clear();
    return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  }
  const name = available[Math.floor(Math.random() * available.length)];
  usedBotNames.add(name);
  return name;
}

function pickBotItems() {
  const count = 1 + Math.floor(Math.random() * 3);
  const items = [];
  let totalValue = 0;
  const shuffled = [...REALISTIC_ITEMS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count && i < shuffled.length; i++) {
    const template = shuffled[i];
    const value = parseFloat((template.min + Math.random() * (template.max - template.min)).toFixed(2));
    totalValue += value;
    if (totalValue > 13) break;
    const wear = WEARS[Math.floor(Math.random() * WEARS.length)];
    items.push({
      item_name: `${template.name} (${wear})`,
      item_value: value,
      image_url: '/images/skins/ak47_redline.png',
      float_value: parseFloat((Math.random() * 0.5 + 0.001).toFixed(4)),
    });
  }
  if (items.length === 0) {
    const template = REALISTIC_ITEMS[0];
    const value = parseFloat((template.min + Math.random() * (template.max - template.min)).toFixed(2));
    const wear = WEARS[Math.floor(Math.random() * WEARS.length)];
    items.push({
      item_name: `${template.name} (${wear})`,
      item_value: value,
      image_url: '/images/skins/ak47_redline.png',
      float_value: parseFloat((Math.random() * 0.5 + 0.001).toFixed(4)),
    });
  }
  return items;
}

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
  const realEntries = entries.filter(e => !e.isBot);
  if (realEntries.length < 2) {
    resetLottery();
    emitState(io);
    return;
  }

  const totalPot = currentLottery.total_value;
  const realPot = realEntries.reduce((s, e) => s + e.total_value, 0);
  const rand = Math.random() * realPot;
  let cumulative = 0;
  let winner = realEntries[0];
  for (const e of realEntries) {
    cumulative += e.total_value;
    if (rand <= cumulative) { winner = e; break; }
  }

  const participants = entries.map(e => ({ avatar: e.avatar || '', username: e.username, total_value: e.total_value }));
  const winnerEntry = { avatar: winner.avatar || '', username: winner.username };

  currentLottery.status = 'rolling';
  io.emit('lottery_rolling', { participants, winnerEntry });
  setTimeout(() => finishLottery(io, winner), 7500);
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
      if (e.isBot) continue;
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
        db.get('SELECT gems FROM users WHERE id = ?', [winnerId], (errGems, rowGems) => {
          const currentGems = (rowGems && rowGems.gems) || 0;
          db.run('INSERT INTO balance_history (user_id, change, new_balance, description) VALUES (?, ?, ?, ?)',
            [winnerId, 0, currentGems, 'Won lottery #' + currentLottery.id]);
        });

        if (typeof global.broadcastGameResult === 'function') {
          const betAmount = winner.total_value || 0;
          const payoutAmount = totalPot || 0;
          const multiplier = betAmount > 0 ? (payoutAmount / betAmount) : 1;
          global.broadcastGameResult(winner.username, 'Lottery', betAmount, payoutAmount, multiplier);
        }

        resetLottery();
        emitState(io);
        scheduleBots(io);
      });
    });
  });
}

function resetLottery() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (botTimerHandle) { clearTimeout(botTimerHandle); botTimerHandle = null; }
  currentLottery = { id: null, entries: [], status: 'waiting', timer_ends_at: null, total_value: 0 };
}

function createNewLotteryInDb(callback) {
  db.run('INSERT INTO lotteries (creator_id, status) VALUES (?, ?)', [0, 'waiting'], function(err) {
    if (err) return callback(null);
    callback(this.lastID);
  });
}

function addBotPlayer(io) {
  if (currentLottery.status !== 'waiting' && currentLottery.status !== 'active') return;
  if (currentLottery.entries.length >= 5) return;

  const botName = pickBotName();
  const items = pickBotItems();
  const totalValue = items.reduce((s, i) => s + i.item_value, 0);

  const entry = {
    user_id: -Math.floor(Math.random() * 99999) - 1000,
    username: botName,
    avatar: pickAvatar(),
    total_value: totalValue,
    item_ids: [],
    items: items,
    isBot: true,
  };

  if (!currentLottery.id) {
    createNewLotteryInDb((newId) => {
      if (!newId) return;
      currentLottery.id = newId;
      currentLottery.entries.push(entry);
      currentLottery.total_value += totalValue;
      emitState(io);
      if (currentLottery.entries.length >= 2 && currentLottery.status === 'waiting') {
        startTimer(io);
      }
    });
  } else {
    currentLottery.entries.push(entry);
    currentLottery.total_value += totalValue;
    emitState(io);
    if (currentLottery.entries.length >= 2 && currentLottery.status === 'waiting') {
      startTimer(io);
    }
  }
}

function scheduleBots(io) {
  if (botTimerHandle) { clearTimeout(botTimerHandle); botTimerHandle = null; }
  const botCount = 2 + Math.floor(Math.random() * 4);

  function addNext(remaining) {
    if (remaining <= 0) return;
    const delay = 500 + Math.random() * 2500;
    botTimerHandle = setTimeout(() => {
      if (currentLottery.status !== 'waiting') return;
      addBotPlayer(io);
      addNext(remaining - 1);
    }, delay);
  }

  addNext(botCount);
}

module.exports = (io) => {
  loadAvatars();
  scheduleBots(io);

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
