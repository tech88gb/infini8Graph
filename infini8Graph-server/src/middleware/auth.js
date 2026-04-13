import { verifyToken } from '../utils/jwt.js';

function getTokenFromRequest(req) {
    const authorization = req.headers.authorization || '';
    if (authorization.startsWith('Bearer ')) {
        return authorization.slice(7).trim();
    }

    return req.cookies?.auth_token || null;
}

export function authenticate(req, res, next) {
    try {
        const token = getTokenFromRequest(req);

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
        const token = getTokenFromRequest(req);
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
