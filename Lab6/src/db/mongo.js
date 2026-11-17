const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://appuser:secret@localhost:27017';
const dbName = process.env.MONGO_DB || 'appdb';

const client = new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
});

let dbInstance = null;

async function connectMongo() {
    if (dbInstance) return dbInstance;
    try {
        await client.connect();
        dbInstance = client.db(dbName);
        console.log('Connected to MongoDB successfully');
        
        // Створення унікального індексу на email для колекції users (п. 2)
        await dbInstance.collection('users').createIndex({ email: 1 }, { unique: true });
        // Колекція подій (write-heavy, без унікальних індексів)
        await dbInstance.collection('events').createIndex({ timestamp: -1 });

        return dbInstance;
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        throw err;
    }
}

function getDb() {
    if (!dbInstance) {
        throw new Error('MongoDB not initialized. Call connectMongo first.');
    }
    return dbInstance;
}

module.exports = { connectMongo, getDb, client };