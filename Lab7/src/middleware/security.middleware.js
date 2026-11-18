const helmet = require('helmet');

const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            frameAncestors: ["'none'"],
        },
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
});

// Безпечна перевірка власних ключів об'єкта на наявність спроб прототипних ін'єкцій
function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        const keys = Object.keys(req.body);
        if (keys.includes('__proto__') || keys.includes('constructor') || keys.includes('prototype')) {
            return res.status(400).json({ error: 'Malicious payload detected' });
        }
    }
    next();
}

module.exports = { securityHeaders, sanitizeBody };