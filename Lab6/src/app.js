require('dotenv').config();
const express = require('express');
const http = require('http');

const { connectMongo } = require('./db/mongo');
const { getUserRepository } = require('./repositories/user-repository.factory');
const UserService = require('./services/user.service');
const UserController = require('./controllers/user.controller');
const createRoutes = require('./routes/user.routes');
const wsManager = require('./websocket/ws.server');

async function bootstrap() {
    // 1. Ініціалізуємо MongoDB (для логів подій та/або основного сховища)
    await connectMongo();

    // 2. Обираємо реалізацію репозиторію за REPO_TYPE з .env
    const userRepository = getUserRepository();
    console.log(`[Storage] Active UserRepository: ${process.env.REPO_TYPE || 'postgres'}`);

    // 3. Збираємо шари (Dependency Injection)
    const userService = new UserService(userRepository);
    const userController = new UserController(userService, userRepository);

    const app = express();
    app.use(express.json());

    // Middleware логування запитів
    app.use((req, res, next) => {
        console.log(`[HTTP] ${req.method} ${req.url}`);
        next();
    });

    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', repoType: process.env.REPO_TYPE || 'postgres' });
    });

    app.use('/api', createRoutes(userController));

    // Централізована обробка помилок
    app.use((err, req, res, next) => {
        const status = err.status || 500;
        res.status(status).json({
            error: err.message || 'Internal Server Error'
        });
    });

    const server = http.createServer(app);
    wsManager.init(server);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`WebSocket ready at ws://localhost:${PORT}/ws`);
    });
}

bootstrap().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});