import { google } from 'googleapis';
import supabase from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL;

/**
 * Creates a configured Google OAuth2 client
 * @returns {OAuth2Client} - Google OAuth2 client
 */
function createOAuth2Client() {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URL
    );
}

/**
 * Generate the Google OAuth2 authorization URL
 * @returns {string} - The URL to redirect the user to for Google login
 */
export function getAuthUrl() {
    const oauth2Client = createOAuth2Client();
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/adwords',
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent', // Force consent screen to always get a refresh token
    });
}

/**
 * Exchange authorization code for access and refresh tokens
 * @param {string} code - Authorization code from Google callback
 * @returns {object} - Token data including access_token and refresh_token
 */
export async function exchangeCode(code) {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

/**
 * Get Google user profile info using access token
 * @param {string} accessToken - Google access token
 * @returns {object} - User profile info
 */
export async function getGoogleUserInfo(accessToken) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return data;
}

/**
 * Save or update a Google account and its tokens for a user in our DB
 * @param {string} userId - The internal user UUID from our `users` table
 * @param {object} googleUserInfo - Profile info from Google (id, email, name, picture)
 * @param {object} tokens - Token object from Google (access_token, refresh_token, expiry_date)
 * @returns {object} - The upserted google_account record
 */
export async function saveUserAndTokens(userId, googleUserInfo, tokens) {
    // 1. Upsert the google_accounts record
    const { data: googleAccount, error: accountError } = await supabase
        .from('google_accounts')
        .upsert({
            user_id: userId,
            google_user_id: googleUserInfo.id,
            email: googleUserInfo.email,
            name: googleUserInfo.name,
            picture: googleUserInfo.picture,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' }) // One Google account per user for simplicity
        .select('id')
        .single();

    if (accountError) {
        console.error('❌ Error saving google_account:', accountError);
        throw accountError;
    }

    // 2. Upsert the google_auth_tokens record with encrypted tokens
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(); // default 1h

    const tokenPayload = {
        user_id: userId,
        google_account_id: googleAccount.id,
        access_token: encryptedAccessToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
    };

    if (encryptedRefreshToken) {
        tokenPayload.refresh_token = encryptedRefreshToken;
    }

    const { error: tokenError } = await supabase
        .from('google_auth_tokens')
        .upsert(tokenPayload, { onConflict: 'google_account_id' });

    if (tokenError) {
        console.error('❌ Error saving google_auth_tokens:', tokenError);
        throw tokenError;
    }

    console.log(`✅ Google account saved for user ${userId}: ${googleUserInfo.email}`);
    return googleAccount;
}

/**
 * Get the decrypted Google tokens for a user
 * Handles automatic refresh if the access token is expired
 * @param {string} userId - The internal user UUID
 * @returns {object|null} - Token data or null if not connected
 */
export async function getGoogleTokensForUser(userId) {
    try {
        const { data: account, error: accError } = await supabase
            .from('google_accounts')
            .select('id, email')
            .eq('user_id', userId)
            .maybeSingle();

        if (accError || !account) return null;

        const { data: tokenData, error: tokenError } = await supabase
            .from('google_auth_tokens')
            .select('access_token, refresh_token, expires_at')
            .eq('google_account_id', account.id)
            .single();

        if (tokenError || !tokenData) return null;

        const accessToken = decrypt(tokenData.access_token);
        const refreshToken = tokenData.refresh_token ? decrypt(tokenData.refresh_token) : null;

        // Check if access token is expired and refresh if we have a refresh token
        if (new Date(tokenData.expires_at) < new Date() && refreshToken) {
            console.log(`🔄 Refreshing Google access token for user ${userId}`);
            const oauth2Client = createOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            const { credentials } = await oauth2Client.refreshAccessToken();
            const newEncryptedToken = encrypt(credentials.access_token);
            const newExpiresAt = new Date(credentials.expiry_date).toISOString();

            await supabase
                .from('google_auth_tokens')
                .update({
                    access_token: newEncryptedToken,
                    expires_at: newExpiresAt,
                    updated_at: new Date().toISOString(),
                })
                .eq('google_account_id', account.id);

            return { accessToken: credentials.access_token, refreshToken };
        }

        return { accessToken, refreshToken };
    } catch (error) {
        console.error('Error getting Google tokens:', error.message);
        return null;
    }
}

/**
 * Check if a user has connected their Google account
 * @param {string} userId - The internal user UUID
 * @returns {object|null} - Basic google account info or null
 */
export async function getConnectedGoogleAccount(userId) {
    const { data, error } = await supabase
        .from('google_accounts')
        .select('id, email, name, picture')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) return null;
    return data;
}

/**
 * Disconnect a user's Google account by removing all associated records
 * @param {string} userId - The internal user UUID
 */
export async function disconnectGoogleAccount(userId) {
    const { data: account } = await supabase
        .from('google_accounts')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

    if (account) {
        await supabase.from('google_auth_tokens').delete().eq('google_account_id', account.id);
        await supabase.from('google_accounts').delete().eq('id', account.id);
    }
}

export default {
    getAuthUrl,
    exchangeCode,
    getGoogleUserInfo,
    saveUserAndTokens,
    getGoogleTokensForUser,
    getConnectedGoogleAccount,
    disconnectGoogleAccount,
};
