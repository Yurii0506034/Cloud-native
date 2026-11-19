const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

function createUserRoutes(userController) {
    const router = express.Router();

    // Ендпоінти для всіх автентифікованих користувачів (user, admin)
    router.get('/users/export', requireAuth, (req, res, next) => userController.exportCsv(req, res, next));
    router.get('/events', requireAuth, (req, res, next) => userController.getEvents(req, res, next));
    router.get('/users', requireAuth, (req, res, next) => userController.getAll(req, res, next));
    router.get('/users/:id', requireAuth, (req, res, next) => userController.getById(req, res, next));

    // Ендпоінти лише для ролі admin
    router.post('/users', requireAuth, requireRole('admin'), (req, res, next) => userController.create(req, res, next));
    router.put('/users/:id', requireAuth, requireRole('admin'), (req, res, next) => userController.update(req, res, next));
    router.delete('/users/:id', requireAuth, requireRole('admin'), (req, res, next) => userController.delete(req, res, next));

    return router;
}

module.exports = createUserRoutes;