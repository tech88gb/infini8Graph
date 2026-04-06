import axios from 'axios';
import { google } from 'googleapis';
import supabase from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { generateToken } from '../utils/jwt.js';
import dotenv from 'dotenv';

dotenv.config();

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI;
const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_LOGIN_REDIRECT_URL = process.env.GOOGLE_LOGIN_REDIRECT_URL; // e.g. https://server.com/api/auth/google/callback

// ============================================================
// GOOGLE LOGIN (Primary Identity)
// ============================================================

function createGoogleLoginClient() {
    return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_LOGIN_REDIRECT_URL);
}

/**
 * Generate the Google OAuth URL for LOGIN (minimal scopes: email + profile only)
 */
export function getGoogleLoginUrl() {
    const client = createGoogleLoginClient();
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ],
        prompt: 'select_account',
    });
}

/**
 * Exchange a Google auth code for tokens (login flow)
 */
export async function exchangeGoogleLoginCode(code) {
    const client = createGoogleLoginClient();
    const { tokens } = await client.getToken(code);
    return tokens;
}

/**
 * Get Google user profile from access token
 */
export async function getGoogleUserInfo(accessToken) {
    const client = createGoogleLoginClient();
    client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    return data; // { id, email, name, picture }
}

/**
 * Find existing user by google_id or create a new one.
 *
 * MULTI-USER FIX: Also checks by google_email as a fallback.
 * This handles legacy users who were created via the old Meta-login flow
 * (their rows have google_id = null). Without this, Google login would
 * create a duplicate orphaned user row for them, losing all their tokens.
 */
export async function findOrCreateUserByGoogle(googleId, googleEmail) {
    // 1. Try by google_id (fast path for returning users)
    let { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('google_id', googleId)
        .maybeSingle();

    if (user) {
        await supabase.from('users').update({ updated_at: new Date().toISOString() }).eq('id', user.id);
        return user;
    }

    // 2. Fallback: look up by google_email (catches legacy Meta-login users)
    if (googleEmail) {
        let { data: existingByEmail } = await supabase
            .from('users')
            .select('*')
            .eq('google_email', googleEmail)
            .maybeSingle();

        if (existingByEmail) {
            // Absorb this user — stamp their google_id so future logins are fast
            const { data: updatedUser } = await supabase
                .from('users')
                .update({ google_id: googleId, updated_at: new Date().toISOString() })
                .eq('id', existingByEmail.id)
                .select('*')
                .single();
            console.log(`🔗 Linked Google ID to existing user: ${googleEmail}`);
            return updatedUser || existingByEmail;
        }
    }

    // 3. Truly new user — create fresh
    const { data: newUser, error } = await supabase
        .from('users')
        .insert({ google_id: googleId, google_email: googleEmail, meta_connected: false })
        .select('*')
        .single();

    if (error) throw new Error('Failed to create user: ' + error.message);
    console.log(`✅ New user created: ${googleEmail}`);
    return newUser;
}

/**
 * Get the active Instagram account for this user (via auth_tokens.is_active)
 */
export async function getActiveAccountForUser(userId) {
    // Active account first
    const { data: activeToken } = await supabase
        .from('auth_tokens')
        .select('instagram_accounts(id, instagram_user_id, username, name, profile_picture_url)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

    if (activeToken?.instagram_accounts) return activeToken.instagram_accounts;

    // Fallback: any account for this user
    const { data: anyToken } = await supabase
        .from('auth_tokens')
        .select('instagram_accounts(id, instagram_user_id, username, name, profile_picture_url)')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    return anyToken?.instagram_accounts || null;
}

// ============================================================
// META OAUTH (One-time Setup — not login)
// ============================================================

function generateState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Generate the Meta OAuth URL for the one-time Meta setup flow.
 * userId is encoded in state so the callback knows which user to set up.
 */
export function getMetaSetupUrl(userId) {
    const scopes = [
        'instagram_basic',
        'instagram_manage_insights',
        'instagram_manage_comments',
        'instagram_manage_messages',
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_metadata',
        'business_management',
        'ads_read',
        'read_insights',
        'public_profile',
    ].join(',');

    const params = new URLSearchParams({
        client_id: META_APP_ID,
        redirect_uri: META_REDIRECT_URI,
        scope: scopes,
        response_type: 'code',
        state: encodeURIComponent(`setup:${userId}`),
    });

    return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange Meta authorization code for a long-lived access token
 */
export async function exchangeCodeForToken(code) {
    try {
        const tokenResponse = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
            params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: META_REDIRECT_URI, code },
        });
        const shortLivedToken = tokenResponse.data.access_token;

        const longLivedResponse = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
            params: { grant_type: 'fb_exchange_token', client_id: META_APP_ID, client_secret: META_APP_SECRET, fb_exchange_token: shortLivedToken },
        });

        return {
            accessToken: longLivedResponse.data.access_token,
            expiresIn: longLivedResponse.data.expires_in || 5184000,
        };
    } catch (error) {
        console.error('Token exchange error:', error.response?.data || error.message);
        throw new Error('Failed to exchange authorization code for token');
    }
}

/**
 * Get all Facebook Pages and their linked Instagram Business Accounts
 */
export async function getInstagramBusinessAccount(accessToken) {
    try {
        const pagesResponse = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
            params: { access_token: accessToken, fields: 'id,name,access_token,instagram_business_account' },
        });
        const pages = pagesResponse.data.data;
        if (!pages || pages.length === 0) throw new Error('No Facebook Pages found.');

        const pagesWithInstagram = pages.filter(p => p.instagram_business_account);
        if (pagesWithInstagram.length === 0) throw new Error('No Instagram Business account found linked to your Facebook Pages.');

        const accountPromises = pagesWithInstagram.map(async (page) => {
            try {
                const igId = page.instagram_business_account.id;
                const igRes = await axios.get(`${GRAPH_API_BASE}/${igId}`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
                    },
                });
                return {
                    instagramUserId: igRes.data.id,
                    username: igRes.data.username,
                    name: igRes.data.name,
                    profilePictureUrl: igRes.data.profile_picture_url,
                    followersCount: igRes.data.followers_count,
                    followsCount: igRes.data.follows_count,
                    mediaCount: igRes.data.media_count,
                    biography: igRes.data.biography,
                    website: igRes.data.website,
                    pageId: page.id,
                    pageToken: page.access_token,
                };
            } catch (err) {
                console.error(`❌ Error fetching IG account ${page.instagram_business_account.id}:`, err.message);
                return null;
            }
        });

        const accounts = (await Promise.all(accountPromises)).filter(Boolean);
        if (accounts.length === 0) throw new Error('Failed to fetch details for any Instagram account.');
        return accounts;
    } catch (error) {
        throw new Error(error.message || 'Failed to fetch Instagram Business Accounts');
    }
}

/**
 * Set up Meta accounts for an already-authenticated user (Google login user).
 *
 * KEY CHANGES vs old createOrUpdateUser:
 *  1. Takes userId as parameter (from Google JWT) — never derives identity from Facebook
 *  2. Does NOT overwrite instagram_accounts.user_id if account already exists
 *  3. auth_tokens upsert uses COMPOSITE key (user_id, instagram_account_id)
 *  4. is_active stored in auth_tokens (per-user), not instagram_accounts
 */
export async function setupMetaAccounts(userId, accountsData, accessToken, expiresIn) {
    try {
        let primaryAccountId = null;
        let primaryAccountData = accountsData[0];

        for (const account of accountsData) {
            const isFirst = account === accountsData[0];
            const encryptedPageToken = account.pageToken ? encrypt(account.pageToken) : null;

            // Check if this IG account already exists in the system (any user may have registered it)
            const { data: existingAccount } = await supabase
                .from('instagram_accounts')
                .select('id')
                .eq('instagram_user_id', account.instagramUserId)
                .maybeSingle();

            let instagramAccountId;

            const metadataPayload = {
                username: account.username,
                name: account.name,
                profile_picture_url: account.profilePictureUrl,
                followers_count: account.followersCount,
                follows_count: account.followsCount,
                media_count: account.mediaCount,
                biography: account.biography,
                website: account.website,
                facebook_page_id: account.pageId,
                page_access_token: encryptedPageToken,
                updated_at: new Date().toISOString(),
            };

            if (existingAccount) {
                instagramAccountId = existingAccount.id;
                // FIX: Update metadata only — DO NOT touch user_id (preserve original owner)
                await supabase.from('instagram_accounts').update(metadataPayload).eq('id', instagramAccountId);
                console.log(`♻️  Reusing existing IG account row: ${account.username}`);
            } else {
                // New account — this user is the first to register it
                const { data: newAccount, error: createErr } = await supabase
                    .from('instagram_accounts')
                    .insert({ ...metadataPayload, user_id: userId, instagram_user_id: account.instagramUserId })
                    .select('id')
                    .single();
                if (createErr) throw createErr;
                instagramAccountId = newAccount.id;
                console.log(`✅ New IG account created: ${account.username}`);
            }

            if (isFirst) {
                primaryAccountId = instagramAccountId;
                primaryAccountData = account;
            }

            // Auto-subscribe page to webhooks
            try {
                if (account.pageId && account.pageToken) {
                    await axios.post(`${GRAPH_API_BASE}/${account.pageId}/subscribed_apps`, null, {
                        params: { access_token: account.pageToken, subscribed_fields: 'messages,messaging_postbacks,messaging_optins,feed' },
                    });
                    console.log(`✅ Subscribed page ${account.pageId} to webhooks`);
                }
            } catch (err) {
                console.error(`⚠️ Webhook subscription failed for page ${account.pageId}:`, err.response?.data || err.message);
            }

            // FIX: Store token with COMPOSITE KEY (user_id, instagram_account_id)
            // This means each user has their own independent token — no more clobbering!
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
            const encryptedToken = encrypt(accessToken);

            await supabase
                .from('auth_tokens')
                .upsert({
                    user_id: userId,
                    instagram_account_id: instagramAccountId,
                    access_token: encryptedToken,
                    expires_at: expiresAt.toISOString(),
                    is_active: isFirst, // First account is active by default
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id,instagram_account_id' }); // COMPOSITE KEY
        }

        // Mark user as meta_connected
        await supabase
            .from('users')
            .update({ meta_connected: true, meta_connected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', userId);

        console.log(`✅ Meta setup complete for user ${userId}: ${accountsData.length} account(s)`);

        return { primaryAccountId, primaryAccountData };
    } catch (error) {
        console.error('Meta setup error:', error.response?.data || error.message);
        throw new Error('Failed to set up Meta accounts: ' + error.message);
    }
}

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

/**
 * Get decrypted access token for a specific user + account combination.
 * FIX: Always filters by BOTH user_id AND instagram_account_id.
 * This ensures User A never gets User B's token.
 */
export async function getAccessToken(userId, instagramAccountId) {
    try {
        // If no account specified, find the user's active one
        if (!instagramAccountId) {
            const activeAccount = await getActiveAccountForUser(userId);
            if (!activeAccount) {
                console.error('No active account found for user:', userId);
                return null;
            }
            instagramAccountId = activeAccount.id;
        }

        const { data, error } = await supabase
            .from('auth_tokens')
            .select('access_token, expires_at')
            .eq('user_id', userId)            // ← ALWAYS filter by this user
            .eq('instagram_account_id', instagramAccountId)
            .maybeSingle();

        if (error || !data) {
            console.error('No token found for user:', userId, 'account:', instagramAccountId);
            return null;
        }

        if (new Date(data.expires_at) < new Date()) {
            console.warn('Access token expired for user:', userId);
            return null;
        }

        return decrypt(data.access_token);
    } catch (error) {
        console.error('Error fetching access token:', error);
        return null;
    }
}

/**
 * Get all Instagram accounts accessible to a user.
 * FIX: Queries via auth_tokens (many-to-many) instead of instagram_accounts.user_id
 * This allows multiple users to see shared IG accounts.
 */
export async function getUserAccounts(userId) {
    try {
        const { data: tokens, error } = await supabase
            .from('auth_tokens')
            .select(`
                is_active,
                instagram_accounts (
                    id, instagram_user_id, username, name,
                    profile_picture_url, followers_count, created_at
                )
            `)
            .eq('user_id', userId)
            .order('is_active', { ascending: false });

        if (error) throw error;

        return (tokens || [])
            .filter(t => t.instagram_accounts)
            .map(t => ({ ...t.instagram_accounts, is_active: t.is_active }));
    } catch (error) {
        console.error('Error fetching user accounts:', error);
        return [];
    }
}

/**
 * Switch the user's active Instagram account.
 * FIX: Uses auth_tokens.is_active (per-user) instead of instagram_accounts.is_active (global)
 */
export async function switchActiveAccount(userId, accountId) {
    try {
        // Verify user has a token for this account
        const { data: token } = await supabase
            .from('auth_tokens')
            .select('access_token, expires_at, instagram_accounts(id, instagram_user_id, username, name, profile_picture_url)')
            .eq('user_id', userId)
            .eq('instagram_account_id', accountId)
            .maybeSingle();

        if (!token) return { success: false, error: 'Account not found or access denied' };
        if (new Date(token.expires_at) < new Date()) return { success: false, error: 'Token expired. Please reconnect your Meta account.' };

        // Deactivate all accounts for this user only
        await supabase.from('auth_tokens').update({ is_active: false }).eq('user_id', userId);

        // Activate the selected account for this user only
        await supabase
            .from('auth_tokens')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('instagram_account_id', accountId);

        const account = token.instagram_accounts;
        const user = await supabase.from('users').select('google_email, meta_connected').eq('id', userId).maybeSingle();

        const jwt = generateToken({
            userId,
            googleEmail: user.data?.google_email || null,
            metaConnected: true,
            instagramUserId: account.instagram_user_id,
            instagramAccountId: account.id,
            username: account.username,
        });

        return {
            success: true,
            jwt,
            account: { id: account.id, username: account.username, name: account.name, profilePictureUrl: account.profile_picture_url },
        };
    } catch (error) {
        console.error('Error switching account:', error);
        return { success: false, error: 'Failed to switch account' };
    }
}

/**
 * Log out user — clears active flag only; preserves tokens for background automations.
 * FIX: Targets auth_tokens per-user, not instagram_accounts globally.
 */
export async function logoutUser(userId, instagramAccountId = null) {
    try {
        let query = supabase.from('auth_tokens').update({ is_active: false }).eq('user_id', userId);
        if (instagramAccountId) {
            query = query.eq('instagram_account_id', instagramAccountId);
        } else {
            query = query.eq('is_active', true);
        }
        await query;
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
}

// Keep generateToken export for controllers that import it directly
export { generateToken };

export default {
    getGoogleLoginUrl,
    exchangeGoogleLoginCode,
    getGoogleUserInfo,
    findOrCreateUserByGoogle,
    getActiveAccountForUser,
    getMetaSetupUrl,
    exchangeCodeForToken,
    getInstagramBusinessAccount,
    setupMetaAccounts,
    getAccessToken,
    getUserAccounts,
    switchActiveAccount,
    logoutUser,
    generateToken,
};
