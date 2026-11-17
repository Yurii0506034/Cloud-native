require('dotenv').config();
const PostgresUserRepository = require('./postgres-user.repository');
const MongoUserRepository = require('./mongo-user.repository');
const InMemoryUserRepository = require('./in-memory-user.repository');

function getUserRepository() {
    const repoType = process.env.REPO_TYPE || 'postgres';

    switch (repoType.toLowerCase()) {
        case 'postgres':
        case 'postgresql':
            return new PostgresUserRepository();
        case 'mongo':
        case 'mongodb':
            return new MongoUserRepository();
        case 'memory':
        case 'in-memory':
            return new InMemoryUserRepository();
        default:
            console.warn(`Unknown REPO_TYPE "${repoType}", defaulting to Postgres.`);
            return new PostgresUserRepository();
    }
}

module.exports = { getUserRepository };