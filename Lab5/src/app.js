const express = require('express');
const http = require('http');
const streamRoutes = require('./routes/stream.routes');
const wsManager = require('./ws/ws.server');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Базовий health-check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'node-stream-ws-service' });
});

// Підключення маршрутів потоків
app.use('/api/stream', streamRoutes);

// Створення HTTP-сервера та ініціалізація WebSocket на шляху /ws
const server = http.createServer(app);
wsManager.init(server);

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`WebSocket endpoint is ready at ws://localhost:${PORT}/ws`);
});