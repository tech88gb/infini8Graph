import { verifyToken } from '../utils/jwt.js';

function buildUserFromDecoded(decoded) {
    return {
        userId: decoded.userId,
        // Google identity
        googleEmail: decoded.googleEmail || null,
        metaConnected: decoded.metaConnected || false,
        // Active Instagram account (populated after Meta setup)
        instagramUserId: decoded.instagramUserId || null,
        instagramAccountId: decoded.instagramAccountId || null,
        username: decoded.username || null,
    };
}

function getDecodedAuth(req) {
    const cookieToken = req.cookies?.auth_token || null;
    const authorization = req.headers.authorization || '';
    const bearerToken = authorization.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : null;

    if (cookieToken) {
        const decodedFromCookie = verifyToken(cookieToken);
        if (decodedFromCookie) return decodedFromCookie;
    }

    if (bearerToken) {
        const decodedFromBearer = verifyToken(bearerToken);
        if (decodedFromBearer) return decodedFromBearer;
    }

    return null;
}

export function authenticate(req, res, next) {
    try {
        const decoded = getDecodedAuth(req);

        if (!decoded) {
            return res.status(401).json({ success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
        }

        req.user = buildUserFromDecoded(decoded);

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ success: false, error: 'Authentication failed', code: 'AUTH_ERROR' });
    }
}

export function optionalAuth(req, res, next) {
    try {
        const decoded = getDecodedAuth(req);
        if (decoded) {
            req.user = buildUserFromDecoded(decoded);
        }
        next();
    } catch (error) {
        next();
    }
}

export default { authenticate, optionalAuth };
