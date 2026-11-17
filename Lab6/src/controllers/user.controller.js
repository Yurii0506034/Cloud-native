const eventLogger = require('../events/event-logger');
const { exportUsersToCsv } = require('../streams/export-stream');

class UserController {
    constructor(userService, userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }

    async create(req, res, next) {
        try {
            const { name, email } = req.body;
            const user = await this.userService.createUser(name, email);
            res.status(201).json(user);
        } catch (err) {
            next(err);
        }
    }

    async getAll(req, res, next) {
        try {
            const users = await this.userService.getAllUsers();
            res.status(200).json(users);
        } catch (err) {
            next(err);
        }
    }

    async getById(req, res, next) {
        try {
            const user = await this.userService.getUserById(req.params.id);
            res.status(200).json(user);
        } catch (err) {
            next(err);
        }
    }

    async update(req, res, next) {
        try {
            const user = await this.userService.updateUser(req.params.id, req.body.name);
            res.status(200).json(user);
        } catch (err) {
            next(err);
        }
    }

    async delete(req, res, next) {
        try {
            await this.userService.deleteUser(req.params.id);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    }

    async createAccount(req, res, next) {
        try {
            const { userId, balance } = req.body;
            const account = await this.userService.createAccount(userId, balance || 0);
            res.status(201).json(account);
        } catch (err) {
            next(err);
        }
    }

    async transfer(req, res, next) {
        try {
            const { fromAccountId, toAccountId, amount } = req.body;
            const result = await this.userService.transferFunds(fromAccountId, toAccountId, Number(amount));
            res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    }

    async getEvents(req, res, next) {
        try {
            const events = await eventLogger.getRecentEvents(20);
            res.status(200).json(events);
        } catch (err) {
            next(err);
        }
    }

    async exportCsv(req, res, next) {
        try {
            const result = await exportUsersToCsv(this.userRepository, 10);
            res.status(200).json({
                message: 'Users exported successfully via Streams',
                ...result
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = UserController;