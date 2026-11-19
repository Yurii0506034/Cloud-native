const { hashPassword, verifyPassword } = require('../auth/password');
const jwtService = require('../auth/jwt.service');
const eventLogger = require('../events/event-logger');

class AuthService {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async register(name, email, password) {
        const cleanName = String(name || '').trim();
        const cleanEmail = String(email || '').trim().toLowerCase();

        const passwordHash = await hashPassword(password);
        const createdUser = await this.userRepository.create(cleanName, cleanEmail, passwordHash, 'user');

        // DTO без поля password_hash
        const userDto = {
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role,
            created_at: createdUser.created_at
        };

        await eventLogger.logSecurityEvent('user_registered', { id: userDto.id, name: userDto.name, email: userDto.email });
        return userDto;
    }

    async login(email, password) {
        // Захист від NoSQL/SQL ін'єкцій: приведення до примітивного рядка
        if (typeof email !== 'string' || typeof password !== 'string') {
            await eventLogger.logSecurityEvent('login_failed', { reason: 'invalid_payload_type' });
            throw Object.assign(new Error('Invalid credentials'), { status: 401 });
        }

        const cleanEmail = email.trim().toLowerCase();
        const user = await this.userRepository.findByEmail(cleanEmail);

        if (!user) {
            await eventLogger.logSecurityEvent('login_failed', { email: cleanEmail, reason: 'user_not_found' });
            throw Object.assign(new Error('Invalid credentials'), { status: 401 });
        }

        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
            await eventLogger.logSecurityEvent('login_failed', { email: cleanEmail, reason: 'wrong_password' });
            throw Object.assign(new Error('Invalid credentials'), { status: 401 });
        }

        const tokens = jwtService.generateTokens(user);
        await eventLogger.logSecurityEvent('user_logged_in', { id: user.id, email: user.email, role: user.role });

        return tokens;
    }

    async refresh(refreshToken) {
        if (!refreshToken || typeof refreshToken !== 'string') {
            throw Object.assign(new Error('Refresh token is required'), { status: 401 });
        }

        const decoded = jwtService.verifyRefreshToken(refreshToken);
        if (!decoded) {
            await eventLogger.logSecurityEvent('token_rejected', { reason: 'invalid_refresh_token' });
            throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
        }

        // Отримуємо актуальні дані користувача з БД
        const user = await this.userRepository.findById(decoded.sub);
        return jwtService.generateTokens(user);
    }
}

module.exports = AuthService;