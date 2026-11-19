require('dotenv').config();
const PostgresUserRepository = require('./postgres-user.repository');
const MongoUserRepository = require('./mongo-user.repository');

function getUserRepository() {
    const repoType = process.env.REPO_TYPE || 'postgres';
    if (repoType === 'mongo' || repoType === 'mongodb') {
        return new MongoUserRepository();
    }
    return new PostgresUserRepository();
}

module.exports = { getUserRepository };