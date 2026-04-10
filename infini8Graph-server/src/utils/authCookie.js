const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function envFlag(name) {
    const value = process.env[name];
    if (value === undefined) return null;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function getFrontendUrl() {
    return process.env.FRONTEND_REDIRECT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
}

export function getAuthCookieOptions() {
    const explicitSecure = envFlag('COOKIE_SECURE');
    const secure = explicitSecure ?? (process.env.NODE_ENV === 'production' || getFrontendUrl().startsWith('https://'));
    const domain = process.env.COOKIE_DOMAIN || undefined;

    return {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        path: '/',
        ...(domain ? { domain } : {}),
    };
}

export function setAuthCookie(res, token) {
    res.cookie(AUTH_COOKIE_NAME, token, {
        ...getAuthCookieOptions(),
        maxAge: AUTH_COOKIE_MAX_AGE,
    });
}

export function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
}
