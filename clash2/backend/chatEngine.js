const db = require('./database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./security');

let chatHistory = [];
let onlineCount = Math.floor(Math.random() * 401) + 200;

let ioRef;

setInterval(() => {
    const step = Math.floor(Math.random() * 21) - 10;
    onlineCount = Math.max(200, Math.min(600, onlineCount + step));
    if (ioRef) ioRef.emit('online_count', onlineCount);
}, 3000);

module.exports = (io) => {
    ioRef = io;
    io.on('connection', (socket) => {
        // Send initial history
        socket.emit('chat_history', chatHistory);
        socket.emit('game_feed_history', global.gameFeedHistory || []);
        socket.emit('online_count', onlineCount);

        socket.on('send_chat', async (data, callback) => {
            const safeCallback = (res) => {
                if (typeof callback === 'function') {
                    try {
                        callback(res);
                    } catch (e) {
                        console.error('Failed to invoke socket callback:', e.message);
                    }
                }
            };

            const token = socket.handshake.auth.token;
            if (!token) return safeCallback({ error: 'Not authenticated' });

            jwt.verify(token, JWT_SECRET, (err, user) => {
                if (err) return safeCallback({ error: 'Invalid token' });

                if (!data || typeof data !== 'object') {
                    return safeCallback({ error: 'Invalid payload: expected object' });
                }

                const { text } = data;

                if (typeof text !== 'string') {
                    return safeCallback({ error: 'Message must be a string' });
                }

                const textStr = text.trim();
                if (!textStr) return safeCallback({ error: 'Message cannot be empty' });
                if (textStr.length > 500) {
                    return safeCallback({ error: 'Message cannot exceed 500 characters' });
                }

                db.get('SELECT username, avatar FROM users WHERE id = ?', [user.id], (err, row) => {
                    if (err || !row) return safeCallback({ error: 'User not found' });

                    const msg = {
                        userId: user.id,
                        username: row.username,
                        avatar: row.avatar,
                        text: textStr,
                        timestamp: Date.now()
                    };

                    chatHistory.push(msg);
                    if (chatHistory.length > 50) chatHistory.shift();

                    io.emit('chat_message', msg);
                    safeCallback({ success: true });
                });
            });
        });
    });
};
