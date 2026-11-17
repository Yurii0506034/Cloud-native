const express = require('express');

function createRoutes(controller) {
    const router = express.Router();

    // Спеціальні маршрути (перед :id)
    router.get('/users/export', (req, res, next) => controller.exportCsv(req, res, next));
    router.get('/events', (req, res, next) => controller.getEvents(req, res, next));
    
    // Транзакції та рахунки
    router.post('/accounts', (req, res, next) => controller.createAccount(req, res, next));
    router.post('/accounts/transfer', (req, res, next) => controller.transfer(req, res, next));

    // CRUD користувачів
    router.post('/users', (req, res, next) => controller.create(req, res, next));
    router.get('/users', (req, res, next) => controller.getAll(req, res, next));
    router.get('/users/:id', (req, res, next) => controller.getById(req, res, next));
    router.put('/users/:id', (req, res, next) => controller.update(req, res, next));
    router.delete('/users/:id', (req, res, next) => controller.delete(req, res, next));

    return router;
}

module.exports = createRoutes;