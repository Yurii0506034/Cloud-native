const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://appuser:secret@localhost:27017';
const dbName = process.env.MONGO_DB || 'appdb';

const client = new MongoClient(uri, { maxPoolSize: 20 });
let dbInstance = null;

async function connectMongo() {
    if (dbInstance) return dbInstance;
    await client.connect();
    dbInstance = client.db(dbName);
    await dbInstance.collection('users').createIndex({ email: 1 }, { unique: true });
    await dbInstance.collection('events').createIndex({ timestamp: -1 });
    return dbInstance;
}

function getDb() {
    if (!dbInstance) throw new Error('MongoDB not initialized');
    return dbInstance;
}

module.exports = { connectMongo, getDb };