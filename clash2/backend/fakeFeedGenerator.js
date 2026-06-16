const fs = require('fs');
const path = require('path');

const AVATARS_DIR = path.join(__dirname, 'public', 'avatars');

const GAMES = ['Double', 'Crash', 'Mines', 'Cases', 'Upgrader'];
const GAME_WEIGHTS = [25, 25, 20, 20, 10];

const BET_RANGES = [
  { min: 0.01, max: 0.50, weight: 35 },
  { min: 0.50, max: 5.00, weight: 30 },
  { min: 5.00, max: 50.00, weight: 20 },
  { min: 50.00, max: 200.00, weight: 10 },
  { min: 200.00, max: 1000.00, weight: 5 },
];

let avatars = [];
let players = [];
let lastPlayerIndex = -1;
let currentStreak = 0;
let maxStreak = 1;
let nextPlayTimer = null;

function loadAvatars() {
  try {
    avatars = fs.readdirSync(AVATARS_DIR).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp', '.jfif', '.gif'].includes(ext);
    });
    console.log(`[FakeFeed] Loaded ${avatars.length} avatars`);
  } catch (e) {
    console.error('[FakeFeed] Failed to load avatars:', e.message);
    avatars = [];
  }
}

function initPlayers() {
  players = avatars.map((file, i) => ({
    index: i,
    avatar: `/avatars/${file}`,
    totalPlays: 0,
    lastPlayTime: 0,
    cooldownUntil: 0,
    streakCount: 0,
  }));
}

function pickWeighted(arr, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

function pickGame() {
  return pickWeighted(GAMES, GAME_WEIGHTS);
}

function pickBetAmount() {
  const range = pickWeighted(BET_RANGES, BET_RANGES.map(r => r.weight));
  const amount = range.min + Math.random() * (range.max - range.min);
  return parseFloat(amount.toFixed(2));
}

function pickMultiplier(game) {
  const baseMul = {
    'Double': () => 1 + Math.random() * 14,
    'Crash': () => 1 + Math.random() * 20,
    'Mines': () => 1 + Math.random() * 10,
    'Cases': () => 1 + Math.random() * 5,
    'Upgrader': () => 1 + Math.random() * 8,
    'Battles': () => 1 + Math.random() * 6,
    'Lottery': () => 1 + Math.random() * 100,
  };
  const fn = baseMul[game] || baseMul['Double'];
  let mul = fn();
  mul = Math.max(1.01, Math.min(mul, 100));
  return parseFloat(mul.toFixed(2));
}

function pickPlayer(now) {
  const streakChance = currentStreak > 0 ? 0.35 : 0;
  const cooldownEnded = players.filter(p => now >= p.cooldownUntil);

  if (cooldownEnded.length === 0) return null;

  if (currentStreak < maxStreak && Math.random() < streakChance && now >= players[lastPlayerIndex].cooldownUntil) {
    currentStreak++;
    return players[lastPlayerIndex];
  }

  currentStreak = 0;
  maxStreak = 1 + Math.floor(Math.random() * 4);

  if (Math.random() < 0.2) {
    cooldownEnded.sort((a, b) => a.lastPlayTime - b.lastPlayTime);
    return cooldownEnded[0];
  }

  const weights = cooldownEnded.map(p => 1 + p.totalPlays * 0.5);
  return pickWeighted(cooldownEnded, weights);
}

function generateFeedEntry() {
  const now = Date.now();
  const player = pickPlayer(now);
  if (!player) return null;

  const game = pickGame();
  const bet = pickBetAmount();
  const mul = pickMultiplier(game);
  const isWin = Math.random() < 0.45;
  const profit = isWin ? parseFloat((bet * (mul - 1)).toFixed(2)) : parseFloat((-bet).toFixed(2));

  player.totalPlays++;
  player.lastPlayTime = now;
  player.cooldownUntil = now + (Math.random() * 5000 + 2000);
  lastPlayerIndex = player.index;

  return {
    avatar: player.avatar,
    game,
    bet,
    multiplier: mul,
    profit,
    isWin,
    timestamp: now,
  };
}

function calculateNextDelay(avgPlaysPerSecond) {
  const baseInterval = 1000 / avgPlaysPerSecond;
  const jitter = Math.random() * 0.8 + 0.2;
  let delay = baseInterval * jitter;

  if (Math.random() < 0.05) delay *= 2 + Math.random() * 3;
  if (Math.random() < 0.02) delay *= 5 + Math.random() * 10;

  return Math.max(100, Math.min(delay, 15000));
}

let isRunning = false;

function start(io, history) {
  if (isRunning) return;
  isRunning = true;

  loadAvatars();
  initPlayers();

  console.log('[FakeFeed] Starting fake feed generator (~1 play/sec)');

  function tick() {
    const entry = generateFeedEntry();
    if (entry) {
      history.push(entry);
      if (history.length > 100) history.shift();
      io.emit('game_feed_update', entry);
    }

    const delay = calculateNextDelay(1);
    nextPlayTimer = setTimeout(tick, delay);
  }

  tick();
}

function stop() {
  isRunning = false;
  if (nextPlayTimer) {
    clearTimeout(nextPlayTimer);
    nextPlayTimer = null;
  }
}

module.exports = { start, stop };
