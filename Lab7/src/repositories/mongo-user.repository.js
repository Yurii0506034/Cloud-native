const { getDb } = require('../db/mongo');
const { ObjectId } = require('mongodb');

class MongoUserRepository {
    async getCollection() {
        return getDb().collection('users');
    }

    async create(name, email, passwordHash, role = 'user') {
        const col = await this.getCollection();
        try {
            const result = await col.insertOne({
                name,
                email,
                passwordHash,
                role,
                created_at: new Date()
            });
            return { id: result.insertedId.toString(), name, email, role, created_at: new Date() };
        } catch (err) {
            if (err.code === 11000) {
                const error = new Error('User with this email already exists');
                error.status = 409;
                throw error;
            }
            throw err;
        }
    }

    async findByEmail(email) {
        // Приведення до примітивного типу (String) для захисту від NoSQL-ін'єкцій
        const cleanEmail = String(email || '');
        const col = await this.getCollection();
        const user = await col.findOne({ email: cleanEmail });
        if (!user) return null;
        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            password_hash: user.passwordHash,
            role: user.role,
            created_at: user.created_at
        };
    }

    async findById(id) {
        const col = await this.getCollection();
        const user = await col.findOne({ _id: new ObjectId(id) });
        if (!user) {
            const error = new Error(`User with id ${id} not found`);
            error.status = 404;
            throw error;
        }
        return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, created_at: user.created_at };
    }

    async findAll() {
        const col = await this.getCollection();
        const users = await col.find({}).toArray();
        return users.map(u => ({
            id: u._id.toString(),
            name: u.name,
            email: u.email,
            role: u.role,
            created_at: u.created_at
        }));
    }

    async update(id, name) {
        const col = await this.getCollection();
        const result = await col.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { name } },
            { returnDocument: 'after' }
        );
        if (!result) {
            const error = new Error(`User with id ${id} not found`);
            error.status = 404;
            throw error;
        }
        return { id: result._id.toString(), name: result.name, email: result.email, role: result.role, created_at: result.created_at };
    }

    async delete(id) {
        const col = await this.getCollection();
        const result = await col.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            const error = new Error(`User with id ${id} not found`);
            error.status = 404;
            throw error;
        }
        return true;
    }
}

module.exports = MongoUserRepository;