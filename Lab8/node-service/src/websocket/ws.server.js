const WebSocket = require('ws');
const url = require('url');
const crypto = require('crypto');
const jwtService = require('../auth/jwt.service');

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map();
    }

    init(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws' });

        this.wss.on('connection', (ws, req) => {
            const parsedUrl = url.parse(req.url, true);
            const token = parsedUrl.query.token;

            // 1. Верифікація токена при підключенні (розділ 6.1)
            const user = jwtService.verifyAccessToken(token);
            if (!user) {
                console.warn('[WS] Connection rejected: Invalid or missing token');
                ws.close(1008, 'Unauthorized: Valid JWT token required');
                return;
            }

            // 2. Реєстрація автентифікованого клієнта в Hub з його роллю
            const clientId = crypto.randomUUID().slice(0, 8);
            this.clients.set(clientId, {
                ws,
                clientId,
                userId: user.sub,
                role: user.role,
                connectedAt: new Date().toISOString()
            });

            console.log(`[WS] Authenticated client connected: ${clientId} (User: ${user.sub}, Role: ${user.role})`);

            ws.send(JSON.stringify({
                type: 'welcome',
                clientId,
                user: { id: user.sub, role: user.role },
                message: 'Connected to Authenticated Real-Time Server'
            }));

            // Обробка вхідних повідомлень без краху сервера
            ws.on('message', (data) => {
                try {
                    JSON.parse(data.toString());
                } catch {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
                }
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
                console.log(`[WS] Client disconnected: ${clientId}`);
            });

            ws.on('error', () => {
                this.clients.delete(clientId);
            });
        });
    }

    broadcast(payload) {
        if (!this.wss) return;
        const message = JSON.stringify(payload);
        for (const [, client] of this.clients.entries()) {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        }
    }
}

module.exports = new WebSocketManager();