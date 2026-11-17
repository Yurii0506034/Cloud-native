const { getDb } = require('../db/mongo');
const wsManager = require('../websocket/ws.server');

class EventLogger {
    async logEvent(eventType, entityData) {
        try {
            const db = getDb();
            const eventDoc = {
                type: eventType,
                data: entityData,
                timestamp: new Date().toISOString()
            };

            // Зберігаємо в MongoDB (колекція events)
            await db.collection('events').insertOne(eventDoc);

            // Broadcast події всім підключеним WebSocket-клієнтам (п. 7.1)
            wsManager.broadcast(eventDoc);
        } catch (err) {
            console.error('Failed to log event:', err.message);
        }
    }

    async getRecentEvents(limit = 20) {
        const db = getDb();
        return await db.collection('events')
            .find({})
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
    }
}

module.exports = new EventLogger();