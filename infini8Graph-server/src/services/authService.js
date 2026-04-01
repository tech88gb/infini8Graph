import axios from 'axios';
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

/**
 * Generate the Meta OAuth login URL
 * @returns {string} - The OAuth URL
 */
export function getLoginUrl() {
    const scopes = [
        'instagram_basic',
        'instagram_manage_insights',
        'instagram_manage_comments',   // For comment auto-reply
        'instagram_manage_messages',   // For DM auto-reply
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_metadata',       // Required for webhooks
        'business_management',
        'ads_read',                    // For ad account insights
        'read_insights'                // For page/app insights
    ].join(',');

    const params = new URLSearchParams({
        client_id: META_APP_ID,
        redirect_uri: META_REDIRECT_URI,
        scope: scopes,
        response_type: 'code',
        state: generateState()
    });

    return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Generate a random state parameter for OAuth
 */
function generateState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Exchange authorization code for access token
 * @param {string} code - The authorization code
 * @returns {object} - Token data
 */
export async function exchangeCodeForToken(code) {
    try {
        // Exchange code for short-lived token
        const tokenResponse = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
            params: {
                client_id: META_APP_ID,
                client_secret: META_APP_SECRET,
                redirect_uri: META_REDIRECT_URI,
                code: code
            }
        });

        const shortLivedToken = tokenResponse.data.access_token;

        // Exchange for long-lived token
        const longLivedResponse = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: META_APP_ID,
                client_secret: META_APP_SECRET,
                fb_exchange_token: shortLivedToken
            }
        });

        return {
            accessToken: longLivedResponse.data.access_token,
            expiresIn: longLivedResponse.data.expires_in || 5184000 // 60 days default
        };
    } catch (error) {
        console.error('Token exchange error:', error.response?.data || error.message);
        throw new Error('Failed to exchange authorization code for token');
    }
}

/**
 * Get all Facebook Pages and their linked Instagram Business Accounts
 * @param {string} accessToken - The Facebook access token
 * @returns {Array} - Array of Instagram account data objects
 */
export async function getInstagramBusinessAccount(accessToken) {
    try {
        // 1. Get user's Facebook Pages
        const pagesResponse = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,access_token,instagram_business_account'
            }
        });

        const pages = pagesResponse.data.data;

        if (!pages || pages.length === 0) {
            throw new Error('No Facebook Pages found. Please connect a Facebook Page to your account.');
        }

        // 2. Filter pages that have a linked Instagram Business Account
        const pagesWithInstagram = pages.filter(page => page.instagram_business_account);

        if (pagesWithInstagram.length === 0) {
            throw new Error('No Instagram Business or Creator account found. Please link an Instagram Business account to your Facebook Page.');
        }

        console.log(`🔍 Found ${pagesWithInstagram.length} pages with Instagram accounts`);

        // 3. Fetch details for each Instagram account in parallel
        const accountPromises = pagesWithInstagram.map(async (page) => {
            try {
                const instagramAccountId = page.instagram_business_account.id;
                const instagramResponse = await axios.get(`${GRAPH_API_BASE}/${instagramAccountId}`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website'
                    }
                });

                return {
                    instagramUserId: instagramResponse.data.id,
                    username: instagramResponse.data.username,
                    name: instagramResponse.data.name,
                    profilePictureUrl: instagramResponse.data.profile_picture_url,
                    followersCount: instagramResponse.data.followers_count,
                    followsCount: instagramResponse.data.follows_count,
                    mediaCount: instagramResponse.data.media_count,
                    biography: instagramResponse.data.biography,
                    website: instagramResponse.data.website,
                    pageId: page.id,
                    pageToken: page.access_token
                };
            } catch (err) {
                console.error(`❌ Error fetching details for IG account ${page.instagram_business_account.id}:`, err.message);
                return null;
            }
        });

        const accounts = (await Promise.all(accountPromises)).filter(Boolean);

        if (accounts.length === 0) {
            throw new Error('Failed to fetch details for any Instagram account.');
        }

        return accounts; // Returns array [ { ...account1 }, { ...account2 } ]
    } catch (error) {
        console.error('Instagram account fetch error:', error.response?.data || error.message);
        throw new Error(error.message || 'Failed to fetch Instagram Business Accounts');
    }
}

/**
 * Create or update user in database and store encrypted token
 * @param {object} instagramData - Instagram account data
 * @param {string} accessToken - The access token to store
 * @param {number} expiresIn - Token expiration in seconds
 * @returns {object} - User data with JWT
 */
/**
 * Create or update user and all their Instagram accounts
 * @param {Array} accountsData - Array of Instagram account data objects
 * @param {string} accessToken - The user access token to store
 * @param {number} expiresIn - Token expiration in seconds
 * @returns {object} - User data with JWT for the primary/first account
 */
export async function createOrUpdateUser(accountsData, accessToken, expiresIn) {
    try {
        // 0. Get Facebook User info to have a stable system-wide ID
        const meResponse = await axios.get(`${GRAPH_API_BASE}/me`, {
            params: {
                access_token: accessToken,
                fields: 'id,name'
            }
        });
        const facebookUserId = meResponse.data.id;

        // 1. Create or Update User (Unified Identity)
        // Check if user exists by facebook_user_id (new) or legacy instagram_user_id
        let { data: existingUsers } = await supabase
            .from('users')
            .select('*')
            .or(`facebook_user_id.eq.${facebookUserId},instagram_user_id.eq.${accountsData[0].instagramUserId}`);

        let existingUser = null;
        if (existingUsers && existingUsers.length > 0) {
            existingUser = existingUsers.find(u => u.facebook_user_id === facebookUserId) || existingUsers[0];
        }

        let userId;

        if (existingUser) {
            userId = existingUser.id;
            // Update user details if needed
            await supabase
                .from('users')
                .update({
                    facebook_user_id: facebookUserId, // Ensure this is set
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);
        } else {
            // Create new user
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    facebook_user_id: facebookUserId,
                    instagram_user_id: accountsData[0].instagramUserId, // Legacy support
                    username: accountsData[0].username
                })
                .select('id')
                .single();

            if (createError) throw createError;
            userId = newUser.id;
        }

        console.log(`👤 User identified/created: ${userId} (${meResponse.data.name})`);

        // 2. Process each authorized Instagram account
        let primaryAccountId = null;
        let primaryAccountData = accountsData[0];

        // Deactivate all accounts for this user initially (we'll activate the current session ones)
        await supabase
            .from('instagram_accounts')
            .update({ is_active: false })
            .eq('user_id', userId);

        for (const account of accountsData) {
            let instagramAccountId;
            const encryptedPageToken = account.pageToken ? encrypt(account.pageToken) : null;

            // Check if this specific IG account already exists
            const { data: existingAccount } = await supabase
                .from('instagram_accounts')
                .select('id')
                .eq('instagram_user_id', account.instagramUserId)
                .maybeSingle();

            const accountPayload = {
                user_id: userId,
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
                is_active: account === accountsData[0], // Mark the first one as active by default
                updated_at: new Date().toISOString()
            };

            if (existingAccount) {
                instagramAccountId = existingAccount.id;
                await supabase
                    .from('instagram_accounts')
                    .update(accountPayload)
                    .eq('id', instagramAccountId);
            } else {
                const { data: newAccount, error: createAccountError } = await supabase
                    .from('instagram_accounts')
                    .insert({
                        ...accountPayload,
                        instagram_user_id: account.instagramUserId
                    })
                    .select('id')
                    .single();

                if (createAccountError) throw createAccountError;
                instagramAccountId = newAccount.id;
            }

            if (account === accountsData[0]) {
                primaryAccountId = instagramAccountId;
                primaryAccountData = account;
            }

            // --- 🌟 NEW: Automatically Subscribe Page to Webhook 🌟 ---
            try {
                if (account.pageId && account.pageToken) {
                    await axios.post(`${GRAPH_API_BASE}/${account.pageId}/subscribed_apps`, null, {
                        params: {
                            access_token: account.pageToken,
                            subscribed_fields: 'messages,messaging_postbacks,messaging_optins,feed'
                        }
                    });
                    console.log(`✅ Automatically subscribed page ${account.pageId} to webhooks!`);
                }
            } catch (err) {
                 console.error(`⚠️ Failed to subscribe page ${account.pageId} to webhooks:`, err.response?.data || err.message);
            }
            // --------------------------------------------------------

            // 3. Store Auth Token for THIS account
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
                    updated_at: new Date().toISOString()
                }, { onConflict: 'instagram_account_id' });
        }

        // 4. Generate JWT for the session (based on the first account)
        const jwtToken = generateToken({
            userId: userId,
            instagramUserId: primaryAccountData.instagramUserId,
            instagramAccountId: primaryAccountId,
            username: primaryAccountData.username
        });

        return {
            userId,
            instagramAccountId: primaryAccountId,
            jwt: jwtToken,
            accountsCount: accountsData.length,
            user: primaryAccountData
        };
    } catch (error) {
        console.error('User processing error:', error.response?.data || error.message);
        throw new Error('Failed to process user and accounts: ' + error.message);
    }
}

/**
 * Get decrypted access token for a user
 * @param {string} userId - The user's UUID
 * @param {string} [instagramAccountId] - Optional specific account ID
 * @returns {string|null} - The decrypted access token
 */
export async function getAccessToken(userId, instagramAccountId) {
    try {
        let query = supabase
            .from('auth_tokens')
            .select('access_token, expires_at');

        // 1. If a specific account ID is provided, use it
        if (instagramAccountId) {
            query = query.eq('instagram_account_id', instagramAccountId);
        } else {
            // 2. Otherwise, look for the active account
            const { data: activeAccount } = await supabase
                .from('instagram_accounts')
                .select('id')
                .eq('user_id', userId)
                .eq('is_active', true)
                .maybeSingle();

            if (activeAccount) {
                query = query.eq('instagram_account_id', activeAccount.id);
            } else {
                // 3. Last fallback: any token for this user
                query = query.eq('user_id', userId);
            }
        }

        const { data, error } = await query.maybeSingle(); // maybeSingle allows 0 rows without error

        if (error) {
            console.error('Supabase error fetching token:', error);
            return null;
        }

        if (!data) {
            console.error('No token data found for user:', userId);
            // Emergency fallback: If we couldn't find a token by active account, try finding ANY token by user_id
            // This handles cases where data might be slightly inconsistent during migration
            if (activeAccount) {
                const { data: fallbackData } = await supabase
                    .from('auth_tokens')
                    .select('access_token, expires_at')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (fallbackData) {
                    return decrypt(fallbackData.access_token);
                }
            }
            return null;
        }

        // Check if token is expired
        if (new Date(data.expires_at) < new Date()) {
            console.warn('Access token has expired for user:', userId);
            return null;
        }

        return decrypt(data.access_token);
    } catch (error) {
        console.error('Error fetching access token:', error);
        return null;
    }
}

/**
 * Log out user - remove their token
 * @param {string} userId - The user's UUID
 */
export async function logoutUser(userId) {
    try {
        await supabase
            .from('auth_tokens')
            .delete()
            .eq('user_id', userId);

        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
}

/**
 * Get all Instagram accounts for a user
 * @param {string} userId - The user's UUID
 * @returns {Array} - Array of accounts
 */
export async function getUserAccounts(userId) {
    try {
        const { data: accounts, error } = await supabase
            .from('instagram_accounts')
            .select('id, instagram_user_id, username, name, profile_picture_url, followers_count, is_active, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return accounts || [];
    } catch (error) {
        console.error('Error fetching user accounts:', error);
        return [];
    }
}

/**
 * Switch active Instagram account
 * @param {string} userId - The user's UUID
 * @param {string} accountId - The Instagram account ID to switch to
 * @returns {object} - Result with new JWT
 */
export async function switchActiveAccount(userId, accountId) {
    try {
        // Verify the account belongs to this user
        const { data: account, error: accountError } = await supabase
            .from('instagram_accounts')
            .select('id, instagram_user_id, username, name, profile_picture_url')
            .eq('id', accountId)
            .eq('user_id', userId)
            .single();

        if (accountError || !account) {
            return { success: false, error: 'Account not found or access denied' };
        }

        // Check if there's a valid token for this account
        const { data: tokenData, error: tokenError } = await supabase
            .from('auth_tokens')
            .select('access_token, expires_at')
            .eq('instagram_account_id', accountId)
            .single();

        if (tokenError || !tokenData) {
            return { success: false, error: 'No valid token for this account. Please re-authenticate.' };
        }

        // Check expiration
        if (new Date(tokenData.expires_at) < new Date()) {
            return { success: false, error: 'Token expired for this account. Please re-authenticate.' };
        }

        // Deactivate all accounts for this user
        await supabase
            .from('instagram_accounts')
            .update({ is_active: false })
            .eq('user_id', userId);

        // Activate the selected account
        await supabase
            .from('instagram_accounts')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('id', accountId);

        // Generate new JWT with the switched account
        const jwt = generateToken({
            userId: userId,
            instagramUserId: account.instagram_user_id,
            instagramAccountId: account.id,
            username: account.username
        });

        return {
            success: true,
            jwt,
            account: {
                id: account.id,
                username: account.username,
                name: account.name,
                profilePictureUrl: account.profile_picture_url
            }
        };
    } catch (error) {
        console.error('Error switching account:', error);
        return { success: false, error: 'Failed to switch account' };
    }
}

export default {
    getLoginUrl,
    exchangeCodeForToken,
    getInstagramBusinessAccount,
    createOrUpdateUser,
    getAccessToken,
    logoutUser,
    getUserAccounts,
    switchActiveAccount
};
