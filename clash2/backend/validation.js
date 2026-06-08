/**
 * validation.js
 * Comprehensive type and bounds validation helper layer for Express and Socket.io payloads.
 */

const isString = (val) => typeof val === 'string';
const isNumber = (val) => typeof val === 'number' && Number.isFinite(val);
const isInteger = (val) => Number.isInteger(val);
const isBoolean = (val) => typeof val === 'boolean';

const validateString = (val, minLen = 0, maxLen = 1000) => {
    if (!isString(val)) return false;
    return val.length >= minLen && val.length <= maxLen;
};

// Validates positive amounts or standard numbers
const validateNumber = (val, min = 0, max = Infinity) => {
    if (!isNumber(val)) return false;
    return val >= min && val <= max;
};

const validateInteger = (val, min = 0, max = Infinity) => {
    if (!isInteger(val)) return false;
    return val >= min && val <= max;
};

/**
 * Express validation middleware builder.
 * @param {Object} schema - Object mapping keys to validator functions.
 * @returns {Function} Express middleware.
 */
const validateBody = (schema) => {
    return (req, res, next) => {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Invalid payload: JSON object expected' });
        }
        for (const [key, validator] of Object.entries(schema)) {
            const value = req.body[key];
            if (!validator(value)) {
                return res.status(400).json({ error: `Invalid or missing field: ${key}` });
            }
        }
        next();
    };
};

module.exports = {
    isString,
    isNumber,
    isInteger,
    isBoolean,
    validateString,
    validateNumber,
    validateInteger,
    validateBody
};
