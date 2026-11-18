const pool = require('../db/postgres');

class PostgresUserRepository {
    async create(name, email, passwordHash, role = 'user') {
        const query = 'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at';
        try {
            const { rows } = await pool.query(query, [name, email, passwordHash, role]);
            return rows[0];
        } catch (err) {
            if (err.code === '23505') {
                const error = new Error('User with this email already exists');
                error.status = 409;
                throw error;
            }
            throw err;
        }
    }

    async findByEmail(email) {
        const query = 'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1';
        const { rows } = await pool.query(query, [email]);
        return rows[0] || null;
    }

    async findById(id) {
        const query = 'SELECT id, name, email, role, created_at FROM users WHERE id = $1';
        const { rows } = await pool.query(query, [id]);
        if (rows.length === 0) {
            const error = new Error(`User with id ${id} not found`);
            error.status = 404;
            throw error;
        }
        return rows[0];
    }

    async findAll() {
        const query = 'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC';
        const { rows } = await pool.query(query);
        return rows;
    }

    async update(id, name) {
        const query = 'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role, created_at';
        const { rows } = await pool.query(query, [name, id]);
        if (rows.length === 0) {
            const error = new Error(`User with id ${id} not found`);
            error.status = 404;
            throw error;
        }
        return rows[0];
    }

    async delete(id) {
        const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
        const { rows } = await pool.query(query, [id]);
        if (rows.length === 0) {
            const error = new Error(`User with id ${id} not found`);
            error.status = 404;
            throw error;
        }
        return true;
    }
}

module.exports = PostgresUserRepository;