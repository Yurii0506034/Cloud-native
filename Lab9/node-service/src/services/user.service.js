const { hashPassword } = require('../auth/password');
const eventLogger = require('../events/event-logger');

class UserService {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async createUser(name, email, password = 'DefaultPassword123!', role = 'user') {
        const passwordHash = await hashPassword(password);
        const user = await this.userRepository.create(name, email, passwordHash, role);
        await eventLogger.logSecurityEvent('user_created_by_admin', { id: user.id, email: user.email });
        return user;
    }

    async getAllUsers() {
        return await this.userRepository.findAll();
    }

    async getUserById(id) {
        return await this.userRepository.findById(id);
    }

    async updateUser(id, name) {
        return await this.userRepository.update(id, name);
    }

    async deleteUser(id) {
        return await this.userRepository.delete(id);
    }
}

module.exports = UserService;