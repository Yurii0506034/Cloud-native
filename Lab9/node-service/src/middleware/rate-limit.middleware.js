const rateLimit = require('express-rate-limit');

const loginRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 хвилина
    max: 5, // Не більше 5 спроб за хвилину
    skipSuccessfulRequests: true, // Успішні входи не рахуємо
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many failed login attempts. Please try again after 1 minute.'
    }
});

module.exports = { loginRateLimiter };