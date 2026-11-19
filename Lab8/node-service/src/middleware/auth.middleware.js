const jwtService = require('../auth/jwt.service');
const eventLogger = require('../events/event-logger');

async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        await eventLogger.logSecurityEvent('token_rejected', { reason: 'missing_header', ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized: Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwtService.verifyAccessToken(token);

    if (!decoded) {
        await eventLogger.logSecurityEvent('token_rejected', { reason: 'invalid_or_expired', ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role
    };

    next();
}

module.exports = { requireAuth };