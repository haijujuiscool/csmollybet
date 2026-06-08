const crypto = require('crypto');

// Load JWT secret from environment or dynamically generate a secure random one at startup.
// This prevents token forgery exploits while remaining zero-config for local development.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

module.exports = {
    JWT_SECRET
};
