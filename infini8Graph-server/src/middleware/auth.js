import { verifyToken } from '../utils/jwt.js';

export function authenticate(req, res, next) {
    try {
        let token = req.cookies?.auth_token;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
        }
        if (!token) token = req.headers['x-auth-token'];
        if (!token && req.query?.token) token = req.query.token;

        if (!token) {
            return res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
        }

        req.user = {
            userId: decoded.userId,
            // Google identity
            googleEmail: decoded.googleEmail || null,
            metaConnected: decoded.metaConnected || false,
            // Active Instagram account (populated after Meta setup)
            instagramUserId: decoded.instagramUserId || null,
            instagramAccountId: decoded.instagramAccountId || null,
            username: decoded.username || null,
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ success: false, error: 'Authentication failed', code: 'AUTH_ERROR' });
    }
}

export function optionalAuth(req, res, next) {
    try {
        let token = req.cookies?.auth_token;
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
        }
        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                req.user = {
                    userId: decoded.userId,
                    googleEmail: decoded.googleEmail || null,
                    metaConnected: decoded.metaConnected || false,
                    instagramUserId: decoded.instagramUserId || null,
                    instagramAccountId: decoded.instagramAccountId || null,
                    username: decoded.username || null,
                };
            }
        }
        next();
    } catch (error) {
        next();
    }
}

export default { authenticate, optionalAuth };
