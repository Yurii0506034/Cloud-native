require('./tracing');
require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const logger = require('./logger');
const { register, metricsMiddleware } = require('./metrics');

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

    // 1. Кореляція запитів (reqId + trace_id через logger) та метрики Prometheus
    app.use((req, res, next) => {
        req.log = logger.child({ reqId: crypto.randomUUID() });
        req.log.info({ method: req.method, url: req.url, ip: req.headers['x-real-ip'] || req.ip }, 'request in');
        res.on('finish', () => {
            req.log.info({ statusCode: res.statusCode }, 'request out');
        });
        next();
    });

    app.use(metricsMiddleware);

    // Ендпоінт метрик Prometheus (доступний у внутрішній мережі)
    app.get('/metrics', async (req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    });

    // 2. Заголовки безпеки та санітизація
    app.use(securityHeaders);
    app.use(express.json({ limit: '10kb' }));
    app.use(sanitizeBody);

    // 3. Публічний health-check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', security: 'JWT + RBAC enabled' });
    });

    // 4. Роути автентифікації та захищені роути
    app.use('/api/auth', createAuthRoutes(authController));
    app.use('/api', createUserRoutes(userController));

    // Централізована обробка помилок
    app.use((err, req, res, next) => {
        const log = req.log || logger;
        log.error({ err: err.message, stack: err.stack }, 'unhandled error');
        const status = err.status || 500;
        res.status(status).json({ error: err.message || 'Internal Server Error' });
    });

    const server = http.createServer(app);
    if (typeof wsManager.init === 'function') {
        wsManager.init(server);
    }

    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        logger.info({ port: Number(port) }, 'node service started');
    });

    const shutdown = (signal) => {
        logger.info({ signal }, 'shutting down node service');
        server.close(() => {
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
    logger.error({ err: err.message }, 'bootstrap failed');
    process.exit(1);
});