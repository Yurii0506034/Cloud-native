const WebSocket = require('ws');
const crypto = require('crypto');

const MAX_BUFFER_DROP_THRESHOLD = 1024 * 1024; // 1 MB - пропускаємо некритичні повідомлення (Message Dropping)
const MAX_BUFFER_TERMINATE_THRESHOLD = 5 * 1024 * 1024; // 5 MB - розриваємо з'єднання (Connection Termination)

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // clientId -> { ws, clientId, connectedAt, state }
    }

    init(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws' });

        this.wss.on('connection', (ws, req) => {
            // 1. Ідентифікація та реєстрація клієнта
            const clientId = crypto.randomUUID().slice(0, 8);
            const clientInfo = {
                ws,
                clientId,
                connectedAt: new Date().toISOString(),
                state: 'CONNECTED'
            };
            this.clients.set(clientId, clientInfo);
            console.log(`[WS] Client connected: ${clientId} (Total: ${this.clients.size})`);

            // Надсилаємо клієнту його ідентифікатор
            ws.send(JSON.stringify({
                type: 'welcome',
                clientId,
                connectedAt: clientInfo.connectedAt,
                message: 'Connected to Real-Time Stream & WS Server'
            }));

            // 2. Обмін повідомленнями
            ws.on('message', (rawMessage) => {
                try {
                    const data = JSON.parse(rawMessage.toString());
                    if (!data.type) {
                        throw new Error('Missing "type" field');
                    }

                    if (data.type === 'message' && typeof data.text === 'string') {
                        // Broadcast іншим підключеним клієнтам
                        this.broadcast({
                            type: 'broadcast',
                            from: clientId,
                            text: data.text,
                            timestamp: new Date().toISOString()
                        }, clientId);
                    } else {
                        ws.send(JSON.stringify({ type: 'ack', received: data }));
                    }
                } catch (err) {
                    // Реакція на невалідне повідомлення
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'invalid_message',
                        message: err.message
                    }));
                }
            });

            // 3. Закриття з'єднання / втрата клієнта
            ws.on('close', () => {
                clientInfo.state = 'CLOSED';
                this.clients.delete(clientId);
                console.log(`[WS] Client disconnected: ${clientId} (Total: ${this.clients.size})`);
            });

            ws.on('error', (err) => {
                console.error(`[WS] Error on client ${clientId}:`, err.message);
                this.clients.delete(clientId);
            });
        });
    }

    /**
     * Broadcast із контролем Backpressure (ws.bufferedAmount)
     */
    broadcast(payload, excludeClientId = null) {
        if (!this.wss) return;
        const serialized = JSON.stringify(payload);

        for (const [id, client] of this.clients.entries()) {
            if (id === excludeClientId) continue;
            const { ws } = client;

            if (ws.readyState !== WebSocket.OPEN) continue;

            // Перевірка Backpressure для конкретного клієнта
            if (ws.bufferedAmount > MAX_BUFFER_TERMINATE_THRESHOLD) {
                console.warn(`[WS Backpressure] Client ${id} buffer exceeded 5MB (${ws.bufferedAmount}B). Terminating slow connection.`);
                ws.terminate();
                this.clients.delete(id);
                continue;
            }

            if (ws.bufferedAmount > MAX_BUFFER_DROP_THRESHOLD && payload.type === 'progress') {
                // Message Dropping: пропускаємо проміжний прогрес для повільного клієнта
                console.warn(`[WS Backpressure] Dropping progress frame for slow client ${id} (buffered: ${ws.bufferedAmount}B)`);
                continue;
            }

            ws.send(serialized);
        }
    }

    getStats() {
        return Array.from(this.clients.values()).map(c => ({
            clientId: c.clientId,
            connectedAt: c.connectedAt,
            state: c.state,
            bufferedAmount: c.ws.bufferedAmount
        }));
    }
}

module.exports = new WebSocketManager();