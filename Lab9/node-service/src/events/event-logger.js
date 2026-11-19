const logger = require('../logger');
const { getDb } = require('../db/mongo');
const wsManager = require('../websocket/ws.server');

class EventLogger {
    async logSecurityEvent(eventType, eventData) {
        try {
            const db = getDb();
            const eventDoc = {
                type: eventType,
                data: eventData, // Без паролів і токенів!
                timestamp: new Date().toISOString()
            };

            await db.collection('events').insertOne(eventDoc);

            // Якщо це реєстрація, транслюємо WS-подію усім підключеним клієнтам (розділ 6.2)
            if (eventType === 'user_registered') {
                wsManager.broadcast({
                    type: 'user_registered',
                    data: { id: eventData.id, name: eventData.name },
                    timestamp: eventDoc.timestamp
                });
            }
        } catch (err) {
            logger.error('Failed to log security event:', err.message);
        }
    }

    async getRecentEvents(limit = 20) {
        const db = getDb();
        return await db.collection('events').find({}).sort({ timestamp: -1 }).limit(limit).toArray();
    }
}

module.exports = new EventLogger();