import * as authService from '../services/authService.js';
import { generateExchangeToken, generateToken, verifyExchangeToken } from '../utils/jwt.js';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie.js';
import supabase from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL || 'http://localhost:3000';

function buildExchangeRedirect(path, payload) {
    const code = generateExchangeToken(payload);
    return `${FRONTEND_REDIRECT_URL}${path}?code=${encodeURIComponent(code)}`;
}

// ============================================================
// GOOGLE LOGIN (Primary identity — replaces Meta login)
// ============================================================

/**
 * Step 1: Redirect user to Google OAuth consent screen.
 * This is now the main /api/auth/login endpoint.
 */
export async function login(req, res) {
    try {
        const loginUrl = authService.getGoogleLoginUrl();
        console.log('🔑 Google login initiated');
        res.json({ success: true, loginUrl });
    } catch (error) {
        console.error('❌ Login initiation error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to initiate login' });
    }
}

/**
 * Step 2: Handle Google OAuth callback.
 * Finds or creates user by google_id, checks meta_connected, returns JWT.
 * Route: GET /api/auth/google/callback  (GOOGLE_LOGIN_REDIRECT_URL must point here)
 */
export async function googleCallback(req, res) {
    try {
        const { code, error } = req.query;

        if (error) {
            console.error('Google OAuth error:', error);
            return res.redirect(`${FRONTEND_REDIRECT_URL}/login?error=${encodeURIComponent(error)}`);
        }
        if (!code) {
            return res.redirect(`${FRONTEND_REDIRECT_URL}/login?error=No+authorization+code+received`);
        }

        // Exchange code for Google tokens
        const tokens = await authService.exchangeGoogleLoginCode(code);
        if (!tokens.access_token) throw new Error('No access token from Google');

        // Get user profile from Google
        const googleUserInfo = await authService.getGoogleUserInfo(tokens.access_token);
        console.log(`✅ Google login: ${googleUserInfo.email}`);

        // Find or create user by google_id
        const user = await authService.findOrCreateUserByGoogle(googleUserInfo.id, googleUserInfo.email);

        // DEFENSIVE FIX: Always check auth_tokens for an active account,
        // regardless of the meta_connected flag (which can be stale/false after
        // a migration or re-login). This ensures users with existing tokens
        // get their full Instagram context in the JWT.
        const activeAccount = await authService.getActiveAccountForUser(user.id);
        const isMetaConnected = user.meta_connected || !!activeAccount;

        // If we found tokens but meta_connected was false, fix the DB flag silently
        if (activeAccount && !user.meta_connected) {
            console.log(`\ud83d\udd27 Correcting stale meta_connected=false for user: ${googleUserInfo.email}`);
            await supabase.from('users')
                .update({ meta_connected: true, updated_at: new Date().toISOString() })
                .eq('id', user.id);
        }

        const sessionPayload = {
            userId: user.id,
            googleEmail: googleUserInfo.email,
            metaConnected: isMetaConnected,
            instagramUserId: activeAccount?.instagram_user_id || null,
            instagramAccountId: activeAccount?.id || null,
            username: activeAccount?.username || null,
        };
        const jwtToken = generateToken(sessionPayload);

        setAuthCookie(res, jwtToken);

        // Redirect to frontend callback handler with a short-lived one-time code.
        return res.redirect(buildExchangeRedirect('/auth/callback', sessionPayload));
    } catch (error) {
        console.error('❌ Google callback error:', error);
        return res.redirect(`${FRONTEND_REDIRECT_URL}/login?error=${encodeURIComponent(error.message)}`);
    }
}

// ============================================================
// META SETUP (One-time setup — NOT login)
// ============================================================

/**
 * Step 3a: Generate Meta OAuth URL for the one-time Meta account connection.
 * Protected route — user must be logged in via Google first.
 * Route: GET /api/auth/meta/connect
 */
export async function metaConnect(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

        const loginUrl = authService.getMetaSetupUrl(userId);
        console.log(`🔗 Meta setup initiated for user: ${userId}`);
        res.json({ success: true, loginUrl });
    } catch (error) {
        console.error('❌ Meta connect error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Step 3b: Handle Meta OAuth callback — set up Instagram accounts for the user.
 * The userId is encoded in state as "setup:<userId>".
 * Route: GET /api/auth/callback  (META_REDIRECT_URI must point here — same as before)
 */
export async function callback(req, res) {
    try {
        const { code, error, state } = req.query;

        if (error) {
            console.error('Meta OAuth error:', error);
            return res.redirect(`${FRONTEND_REDIRECT_URL}/connect-meta?error=${encodeURIComponent(error)}`);
        }

        if (!code) {
            return res.redirect(`${FRONTEND_REDIRECT_URL}/connect-meta?error=No+authorization+code+received`);
        }

        // Decode userId from state
        const stateDecoded = state ? decodeURIComponent(state) : '';
        if (!stateDecoded.startsWith('setup:')) {
            return res.redirect(`${FRONTEND_REDIRECT_URL}/connect-meta?error=Invalid+state+parameter`);
        }
        const userId = stateDecoded.replace('setup:', '');

        console.log(`🔗 Meta setup callback for user: ${userId}`);

        // Exchange code for Meta long-lived token
        const tokenData = await authService.exchangeCodeForToken(code);

        // Fetch all authorized IG accounts
        const authorizedAccounts = await authService.getInstagramBusinessAccount(tokenData.accessToken);
        console.log(`✅ Meta authorized ${authorizedAccounts.length} Instagram account(s)`);

        // Set up accounts in DB (composite key, no user_id overwrite)
        await authService.setupMetaAccounts(
            userId,
            authorizedAccounts,
            tokenData.accessToken,
            tokenData.expiresIn
        );

        const session = await authService.buildUserSession(userId);
        const activeAccount = session.account || authorizedAccounts[0] || null;
        const jwtToken = session.jwt;

        setAuthCookie(res, jwtToken);

        console.log(`✅ Meta setup complete for @${activeAccount?.username || 'unknown'}`);
        return res.redirect(buildExchangeRedirect('/auth/callback', session.payload));
    } catch (error) {
        console.error('❌ Meta callback error:', error);
        return res.redirect(`${FRONTEND_REDIRECT_URL}/connect-meta?error=${encodeURIComponent(error.message)}`);
    }
}

// ============================================================
// SHARED ENDPOINTS (unchanged behavior, updated internals)
// ============================================================

export async function exchangeCode(req, res) {
    try {
        const { code } = req.body || {};

        if (!code || typeof code !== 'string') {
            return res.status(400).json({ success: false, error: 'Exchange code is required' });
        }

        const payload = verifyExchangeToken(code);
        if (!payload) {
            return res.status(400).json({ success: false, error: 'Exchange code is invalid or expired' });
        }

        const token = generateToken(payload);
        setAuthCookie(res, token);
        return res.json({ success: true, token });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to exchange login code' });
    }
}

export async function getMe(req, res) {
    try {
        res.json({ success: true, user: req.user });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get user info' });
    }
}

export async function logout(req, res) {
    try {
        await authService.logoutUser(req.user.userId, req.user.instagramAccountId || null);
        clearAuthCookie(res);
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to logout' });
    }
}

export async function refreshToken(req, res) {
    try {
        const jwtToken = generateToken({
            userId: req.user.userId,
            googleEmail: req.user.googleEmail,
            metaConnected: req.user.metaConnected,
            instagramUserId: req.user.instagramUserId,
            instagramAccountId: req.user.instagramAccountId,
            username: req.user.username,
        });

        setAuthCookie(res, jwtToken);

        res.json({ success: true, message: 'Token refreshed', token: jwtToken });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to refresh token' });
    }
}

export async function getAccounts(req, res) {
    try {
        const includeDisabled = req.query.includeDisabled === 'true';
        const accounts = await authService.getUserAccounts(req.user.userId, { includeDisabled });
        const activeAccount = await authService.getActiveAccountForUser(req.user.userId);
        res.json({ success: true, accounts, activeAccountId: activeAccount?.id || null });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get accounts' });
    }
}

export async function updateAccountEnabled(req, res) {
    try {
        const { accountId } = req.params;
        const { is_enabled } = req.body;

        if (typeof is_enabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'is_enabled must be a boolean' });
        }

        const result = await authService.setAccountEnabled(req.user.userId, accountId, is_enabled);
        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error || 'Failed to update account selection' });
        }

        setAuthCookie(res, result.jwt);

        res.json({
            success: true,
            enabled: result.enabled,
            activeAccountId: result.activeAccount?.id || null,
            token: result.jwt,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update account selection' });
    }
}

export async function switchAccount(req, res) {
    try {
        const { accountId } = req.params;
        const result = await authService.switchActiveAccount(req.user.userId, accountId);

        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error || 'Failed to switch account' });
        }

        setAuthCookie(res, result.jwt);

        res.json({ success: true, account: result.account, token: result.jwt });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to switch account' });
    }
}

/**
 * Reconnect Meta account — resets meta_connected so user goes through setup again.
 * Route: POST /api/auth/meta/reconnect
 */
export async function metaReconnect(req, res) {
    try {
        const userId = req.user?.userId;
        // Just return the Meta setup URL — same as metaConnect
        const loginUrl = authService.getMetaSetupUrl(userId);
        res.json({ success: true, loginUrl });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export default {
    login,
    googleCallback,
    metaConnect,
    metaReconnect,
    callback,
    exchangeCode,
    getMe,
    logout,
    refreshToken,
    getAccounts,
    updateAccountEnabled,
    switchAccount,
};
