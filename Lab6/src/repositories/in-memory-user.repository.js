class InMemoryUserRepository {
    constructor() {
        this.users = new Map();
        this.nextId = 1;
    }

    async create(name, email) {
        for (const u of this.users.values()) {
            if (u.email === email) {
                const err = new Error('User with this email already exists');
                err.code = '23505'; // Postgres unique violation code emulation
                throw err;
            }
        }
        const id = String(this.nextId++);
        const user = { id, name, email, created_at: new Date() };
        this.users.set(id, user);
        return user;
    }

    async findById(id) {
        const user = this.users.get(id);
        if (!user) throw new Error('User not found');
        return user;
    }

    async findAll() {
        return Array.from(this.users.values());
    }

    async update(id, name) {
        const user = this.users.get(id);
        if (!user) throw new Error('User not found');
        user.name = name;
        this.users.set(id, user);
        return user;
    }

    async delete(id) {
        if (!this.users.has(id)) return false;
        this.users.delete(id);
        return true;
    }
}

module.exports = InMemoryUserRepository;