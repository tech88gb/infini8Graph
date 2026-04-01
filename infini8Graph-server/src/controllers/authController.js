import * as authService from '../services/authService.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// For local dev, redirect to the actual frontend (localhost:3000), not through ngrok
const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL || 'http://localhost:3000';

/**
 * Initiate OAuth login flow
 */
export async function login(req, res) {
    try {
        console.log('🔥 LOGIN ENDPOINT HIT');
        console.log('🔥 ENV CHECK:');
        console.log('   META_APP_ID:', process.env.META_APP_ID ? '✅ SET' : '❌ MISSING');
        console.log('   META_REDIRECT_URI:', process.env.META_REDIRECT_URI ? '✅ SET' : '❌ MISSING');
        
        const loginUrl = authService.getLoginUrl();
        console.log('🔥 GENERATED LOGIN URL:', loginUrl);
        
        if (!loginUrl || loginUrl.includes('undefined')) {
            throw new Error('Login URL contains undefined values - check environment variables');
        }
        
        res.json({
            success: true,
            loginUrl
        });
    } catch (error) {
        console.error('❌ Login initiation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to initiate login'
        });
    }
}

/**
 * Handle OAuth callback
 */
export async function callback(req, res) {
    console.log('🔥 CALLBACK HIT!');
    console.log('🔥 Full URL:', req.originalUrl);
    console.log('🔥 Query params:', JSON.stringify(req.query));
    console.log('🔥 All headers:', JSON.stringify(req.headers, null, 2));
    try {
        const { code, error, error_description } = req.query;

        if (error) {
            console.error('OAuth error:', error, error_description);
            return res.redirect(`${FRONTEND_REDIRECT_URL}/login?error=${encodeURIComponent(error_description || error)}`);
        }

        if (!code) {
            return res.redirect(`${FRONTEND_REDIRECT_URL}/login?error=No authorization code received`);
        }

        // Exchange code for token
        const tokenData = await authService.exchangeCodeForToken(code);

        // Get ALL authorized Instagram Business Accounts
        const authorizedAccounts = await authService.getInstagramBusinessAccount(tokenData.accessToken);
        console.log(`✅ Authorized ${authorizedAccounts.length} Instagram accounts`);

        // Create or update user and all accounts
        const userData = await authService.createOrUpdateUser(
            authorizedAccounts,
            tokenData.accessToken,
            tokenData.expiresIn
        );

        // Set HttpOnly cookie with JWT
        // Note: Using secure:true and sameSite:'none' for cross-origin OAuth
        res.cookie('auth_token', userData.jwt, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to dashboard with token
        const redirectUrl = `${FRONTEND_REDIRECT_URL}/dashboard?token=${userData.jwt}`;
        console.log('✅ Auth successful! Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`${FRONTEND_REDIRECT_URL}/login?error=${encodeURIComponent(error.message)}`);
    }
}

/**
 * Get current user info
 */
export async function getMe(req, res) {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user info'
        });
    }
}

/**
 * Logout user
 */
export async function logout(req, res) {
    try {
        await authService.logoutUser(req.user.userId, req.user.instagramAccountId);

        // Clear the auth cookie
        res.clearCookie('auth_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout'
        });
    }
}

/**
 * Refresh token endpoint
 */
export async function refreshToken(req, res) {
    try {
        // The user is already authenticated via middleware
        // Generate a new JWT with updated expiration
        const jwt = authService.generateToken({
            userId: req.user.userId,
            instagramUserId: req.user.instagramUserId,
            username: req.user.username
        });

        res.cookie('auth_token', jwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            message: 'Token refreshed'
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh token'
        });
    }
}

/**
 * Get user's Instagram accounts
 */
export async function getAccounts(req, res) {
    try {
        const accounts = await authService.getUserAccounts(req.user.userId);
        res.json({
            success: true,
            accounts,
            activeAccountId: req.user.instagramAccountId
        });
    } catch (error) {
        console.error('Get accounts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get accounts'
        });
    }
}

/**
 * Switch active Instagram account
 */
export async function switchAccount(req, res) {
    try {
        const { accountId } = req.params;

        const result = await authService.switchActiveAccount(req.user.userId, accountId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error || 'Failed to switch account'
            });
        }

        // Set new JWT cookie
        res.cookie('auth_token', result.jwt, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            jwt: result.jwt,
            account: result.account
        });
    } catch (error) {
        console.error('Switch account error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to switch account'
        });
    }
}

export default {
    login,
    callback,
    getMe,
    logout,
    refreshToken,
    getAccounts,
    switchAccount
};
