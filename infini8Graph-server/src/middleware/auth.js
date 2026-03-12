import { verifyToken } from '../utils/jwt.js';

/**
 * Authentication middleware
 * Validates JWT token from HttpOnly cookie or Authorization header
 */
export function authenticate(req, res, next) {
    try {
        // Try to get token from HttpOnly cookie first
        let token = req.cookies?.auth_token;

        // Fallback to Authorization header
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        // Fallback to X-Auth-Token header (sometimes Authorization is stripped)
        if (!token) {
            token = req.headers['x-auth-token'];
        }

        // Fallback to query parameter (last resort for dev)
        if (!token && req.query?.token) {
            token = req.query.token;
        }

        // Debug logging - only for failed auth attempts
        if (process.env.NODE_ENV === 'development' && !token) {
            console.log('Auth: No token found in request');
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
                code: 'INVALID_TOKEN'
            });
        }

        // Attach user info to request
        req.user = {
            userId: decoded.userId,
            instagramUserId: decoded.instagramUserId,
            instagramAccountId: decoded.instagramAccountId,
            username: decoded.username
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed',
            code: 'AUTH_ERROR'
        });
    }
}

/**
 * Optional authentication middleware
 * Attaches user info if token present, but doesn't block if missing
 */
export function optionalAuth(req, res, next) {
    try {
        let token = req.cookies?.auth_token;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                req.user = {
                    userId: decoded.userId,
                    instagramUserId: decoded.instagramUserId,
                    instagramAccountId: decoded.instagramAccountId,
                    username: decoded.username
                };
            }
        }

        next();
    } catch (error) {
        // Continue without auth
        next();
    }
}

export default { authenticate, optionalAuth };
