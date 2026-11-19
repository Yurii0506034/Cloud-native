const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function hashPassword(plainPassword) {
    if (!plainPassword || plainPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }
    return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function verifyPassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) return false;
    // bcrypt.compare забезпечує порівняння за постійний час (timing-safe)
    return await bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = { hashPassword, verifyPassword };