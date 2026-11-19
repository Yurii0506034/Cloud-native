const express = require('express');
const { loginRateLimiter } = require('../middleware/rate-limit.middleware');

function createAuthRoutes(authController) {
    const router = express.Router();

    router.post('/register', (req, res, next) => authController.register(req, res, next));
    router.post('/login', loginRateLimiter, (req, res, next) => authController.login(req, res, next));
    router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

    return router;
}

module.exports = createAuthRoutes;