import * as authService from '../services/authService.js';
import { generateToken } from '../utils/jwt.js';
import supabase from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL || 'http://localhost:3000';

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

        // Load active Instagram account if Meta is already connected
        let activeAccount = null;
        if (user.meta_connected) {
            activeAccount = await authService.getActiveAccountForUser(user.id);
        }

        // Issue JWT
        const jwtToken = generateToken({
            userId: user.id,
            googleEmail: googleUserInfo.email,
            metaConnected: user.meta_connected || false,
            instagramUserId: activeAccount?.instagram_user_id || null,
            instagramAccountId: activeAccount?.id || null,
            username: activeAccount?.username || null,
        });

        // Set HttpOnly cookie
        res.cookie('auth_token', jwtToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Redirect to frontend callback handler — it will check metaConnected and route accordingly
        return res.redirect(`${FRONTEND_REDIRECT_URL}/auth/callback?token=${jwtToken}`);
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
        const { primaryAccountId, primaryAccountData } = await authService.setupMetaAccounts(
            userId,
            authorizedAccounts,
            tokenData.accessToken,
            tokenData.expiresIn
        );

        // Get user info for JWT
        const { data: user } = await supabase.from('users').select('google_email').eq('id', userId).maybeSingle();

        // Issue a new JWT with full IG account context
        const jwtToken = generateToken({
            userId,
            googleEmail: user?.google_email || null,
            metaConnected: true,
            instagramUserId: primaryAccountData.instagramUserId,
            instagramAccountId: primaryAccountId,
            username: primaryAccountData.username,
        });

        res.cookie('auth_token', jwtToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        console.log(`✅ Meta setup complete for @${primaryAccountData.username}`);
        return res.redirect(`${FRONTEND_REDIRECT_URL}/dashboard?token=${jwtToken}`);
    } catch (error) {
        console.error('❌ Meta callback error:', error);
        return res.redirect(`${FRONTEND_REDIRECT_URL}/connect-meta?error=${encodeURIComponent(error.message)}`);
    }
}

// ============================================================
// SHARED ENDPOINTS (unchanged behavior, updated internals)
// ============================================================

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
        res.clearCookie('auth_token', { httpOnly: true, secure: true, sameSite: 'none' });
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

        res.cookie('auth_token', jwtToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ success: true, message: 'Token refreshed' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to refresh token' });
    }
}

export async function getAccounts(req, res) {
    try {
        const accounts = await authService.getUserAccounts(req.user.userId);
        res.json({ success: true, accounts, activeAccountId: req.user.instagramAccountId });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get accounts' });
    }
}

export async function switchAccount(req, res) {
    try {
        const { accountId } = req.params;
        const result = await authService.switchActiveAccount(req.user.userId, accountId);

        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error || 'Failed to switch account' });
        }

        res.cookie('auth_token', result.jwt, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ success: true, jwt: result.jwt, account: result.account });
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
    getMe,
    logout,
    refreshToken,
    getAccounts,
    switchAccount,
};
