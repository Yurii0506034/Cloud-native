const eventLogger = require('../events/event-logger');
const { exportUsersToCsv } = require('../streams/export-stream');

class UserController {
    constructor(userService, userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }

    async create(req, res, next) {
        try {
            const { name, email, password, role } = req.body;
            const user = await this.userService.createUser(name, email, password, role);
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
            res.status(200).json({ message: 'Exported successfully', ...result });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = UserController;