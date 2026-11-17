const { getDb } = require('../db/mongo');
const { ObjectId } = require('mongodb');

class MongoUserRepository {
    async getCollection() {
        return getDb().collection('users');
    }

    async create(name, email) {
        const col = await this.getCollection();
        try {
            const result = await col.insertOne({ name, email, created_at: new Date() });
            return { id: result.insertedId.toString(), name, email, created_at: new Date() };
        } catch (err) {
            if (err.code === 11000) { // MongoDB duplicate key error
                const error = new Error('User with this email already exists');
                error.status = 409;
                throw error;
            }
            throw err;
        }
    }

    async findById(id) {
        const col = await this.getCollection();
        let queryId;
        try {
            queryId = new ObjectId(id);
        } catch {
            queryId = id; // на випадок числових ID
        }

        const user = await col.findOne({ $or: [{ _id: queryId }, { id: id }] });
        if (!user) {
            const error = new Error(`User with id ${id} was not found`);
            error.status = 404;
            throw error;
        }
        return { id: user._id.toString(), name: user.name, email: user.email, created_at: user.created_at };
    }

    async findAll() {
        const col = await this.getCollection();
        const users = await col.find({}).toArray();
        return users.map(u => ({
            id: u._id.toString(),
            name: u.name,
            email: u.email,
            created_at: u.created_at
        }));
    }

    async update(id, name) {
        const col = await this.getCollection();
        let queryId;
        try {
            queryId = new ObjectId(id);
        } catch {
            queryId = id;
        }

        const result = await col.findOneAndUpdate(
            { $or: [{ _id: queryId }, { id: id }] },
            { $set: { name } },
            { returnDocument: 'after' }
        );

        if (!result) {
            const error = new Error(`User with id ${id} was not found`);
            error.status = 404;
            throw error;
        }
        return { id: result._id.toString(), name: result.name, email: result.email, created_at: result.created_at };
    }

    async delete(id) {
        const col = await this.getCollection();
        let queryId;
        try {
            queryId = new ObjectId(id);
        } catch {
            queryId = id;
        }

        const result = await col.deleteOne({ $or: [{ _id: queryId }, { id: id }] });
        if (result.deletedCount === 0) {
            const error = new Error(`User with id ${id} was not found`);
            error.status = 404;
            throw error;
        }
        return true;
    }
}

module.exports = MongoUserRepository;