const WebSocket = require('ws');
const crypto = require('crypto');

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map();
    }

    init(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws' });

        this.wss.on('connection', (ws) => {
            const clientId = crypto.randomUUID().slice(0, 8);
            this.clients.set(clientId, { ws, clientId, connectedAt: new Date().toISOString() });
            console.log(`[WS] Client connected: ${clientId} (Active: ${this.clients.size})`);

            ws.send(JSON.stringify({
                type: 'welcome',
                clientId,
                message: 'Connected to Lab 6 Persistence & Real-Time Server'
            }));

            ws.on('close', () => {
                this.clients.delete(clientId);
                console.log(`[WS] Client disconnected: ${clientId} (Active: ${this.clients.size})`);
            });

            ws.on('error', () => {
                this.clients.delete(clientId);
            });
        });
    }

    broadcast(payload) {
        if (!this.wss) return;
        const message = JSON.stringify(payload);
        for (const [id, client] of this.clients.entries()) {
            if (client.ws.readyState === WebSocket.OPEN) {
                // Базовий захист від повільного споживача (Backpressure)
                if (client.ws.bufferedAmount > 2 * 1024 * 1024) {
                    console.warn(`[WS] Slow client ${id} dropped frame due to buffer overflow`);
                    continue;
                }
                client.ws.send(message);
            }
        }
    }
}

module.exports = new WebSocketManager();