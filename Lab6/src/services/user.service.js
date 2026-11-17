const pool = require('../db/postgres');
const eventLogger = require('../events/event-logger');

class UserService {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async createUser(name, email) {
        if (!name || !email) {
            const err = new Error('Name and email are required');
            err.status = 400;
            throw err;
        }
        const user = await this.userRepository.create(name, email);
        await eventLogger.logEvent('user_created', user);
        return user;
    }

    async getUserById(id) {
        return await this.userRepository.findById(id);
    }

    async getAllUsers() {
        return await this.userRepository.findAll();
    }

    async updateUser(id, name) {
        if (!name) {
            const err = new Error('Name is required');
            err.status = 400;
            throw err;
        }
        const user = await this.userRepository.update(id, name);
        await eventLogger.logEvent('user_updated', user);
        return user;
    }

    async deleteUser(id) {
        const deleted = await this.userRepository.delete(id);
        if (deleted) {
            await eventLogger.logEvent('user_deleted', { id });
        }
        return deleted;
    }

    /**
     * Транзакційний переказ коштів між рахунками (PostgreSQL ACID)
     */
    async transferFunds(fromAccountId, toAccountId, amount) {
        if (amount <= 0) {
            const err = new Error('Transfer amount must be positive');
            err.status = 400;
            throw err;
        }

        const client = await pool.connect(); // Ручне отримання з'єднання з пулу
        try {
            await client.query('BEGIN');

            // 1. Блокуємо та перевіряємо баланс відправника
            const senderRes = await client.query(
                'SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE',
                [fromAccountId]
            );
            if (senderRes.rows.length === 0) {
                throw Object.assign(new Error(`Source account ${fromAccountId} not found`), { status: 404 });
            }

            const currentBalance = parseFloat(senderRes.rows[0].balance);
            if (currentBalance < amount) {
                throw Object.assign(new Error('Insufficient funds for transfer'), { status: 400 });
            }

            // 2. Перевіряємо існування отримувача
            const receiverRes = await client.query(
                'SELECT id FROM accounts WHERE id = $1 FOR UPDATE',
                [toAccountId]
            );
            if (receiverRes.rows.length === 0) {
                throw Object.assign(new Error(`Target account ${toAccountId} not found`), { status: 404 });
            }

            // 3. Списання та зарахування
            await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromAccountId]);
            await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toAccountId]);

            await client.query('COMMIT');
            await eventLogger.logEvent('funds_transferred', { fromAccountId, toAccountId, amount });

            return { status: 'committed', fromAccountId, toAccountId, amount };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release(); // Обов'язкове повернення з'єднання в пул
        }
    }

    /**
     * Допоміжний метод для створення рахунку користувачу (для тестування транзакцій)
     */
    async createAccount(userId, initialBalance) {
        const { rows } = await pool.query(
            'INSERT INTO accounts (user_id, balance) VALUES ($1, $2) RETURNING id, user_id, balance',
            [userId, initialBalance]
        );
        return rows[0];
    }
}

module.exports = UserService;