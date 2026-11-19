const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be defined in environment variables');
}

class JwtService {
    generateTokens(user) {
        // Claims: sub, role, iss (без паролів та хешів!)
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role || 'user',
            iss: 'cloud-native-auth-service'
        };

        const accessToken = jwt.sign(payload, JWT_SECRET, {
            expiresIn: '15m',
            algorithm: 'HS256' // Явний перелік алгоритмів — захист від alg=none
        });

        const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
            expiresIn: '7d',
            algorithm: 'HS256'
        });

        return { accessToken, refreshToken };
    }

    verifyAccessToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        } catch (err) {
            return null;
        }
    }

    verifyRefreshToken(token) {
        try {
            return jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
        } catch (err) {
            return null;
        }
    }
}

module.exports = new JwtService();