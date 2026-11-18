class AuthController {
    constructor(authService) {
        this.authService = authService;
    }

    async register(req, res, next) {
        try {
            const { name, email, password } = req.body;

            if (!name || !email || !password) {
                return res.status(400).json({ error: 'Name, email, and password are required' });
            }

            if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
                return res.status(400).json({ error: 'Invalid input data types' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            if (password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters long' });
            }

            const user = await this.authService.register(name, email, password);
            res.status(201).json(user);
        } catch (err) {
            next(err);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const tokens = await this.authService.login(email, password);
            res.status(200).json(tokens);
        } catch (err) {
            next(err);
        }
    }

    async refresh(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const tokens = await this.authService.refresh(refreshToken);
            res.status(200).json(tokens);
        } catch (err) {
            next(err);
        }
    }
}

module.exports = AuthController;