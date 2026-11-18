require('dotenv').config();
const express = require('express');
const http = require('http');

const { connectMongo } = require('./db/mongo');
const { getUserRepository } = require('./repositories/user-repository.factory');
const AuthService = require('./services/auth.service');
const UserService = require('./services/user.service');
const AuthController = require('./controllers/auth.controller');
const UserController = require('./controllers/user.controller');
const createAuthRoutes = require('./routes/auth.routes');
const createUserRoutes = require('./routes/user.routes');
const { securityHeaders, sanitizeBody } = require('./middleware/security.middleware');
const wsManager = require('./websocket/ws.server');

async function bootstrap() {
    await connectMongo();

    const userRepository = getUserRepository();
    const authService = new AuthService(userRepository);
    const userService = new UserService(userRepository);

    const authController = new AuthController(authService);
    const userController = new UserController(userService, userRepository);

    const app = express();

    // 1. Заголовки безпеки та санітизація
    app.use(securityHeaders);
    app.use(express.json({ limit: '10kb' }));
    app.use(sanitizeBody);

    // 2. Публічний health-check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', security: 'JWT + RBAC enabled' });
    });

    // 3. Роути автентифікації та захищені роути
    app.use('/api/auth', createAuthRoutes(authController));
    app.use('/api', createUserRoutes(userController));

    // Централізована обробка помилок
    app.use((err, req, res, next) => {
        const status = err.status || 500;
        res.status(status).json({ error: err.message || 'Internal Server Error' });
    });

    const server = http.createServer(app);
    wsManager.init(server);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Secure Server running on http://localhost:${PORT}`);
        console.log(`Authenticated WebSocket ready at ws://localhost:${PORT}/ws?token=<JWT>`);
    });
}

bootstrap().catch((err) => {
    console.error('Failed to start secure server:', err);
    process.exit(1);
});