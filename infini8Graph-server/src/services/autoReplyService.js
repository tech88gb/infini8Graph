import axios from 'axios';
import supabase from '../config/database.js';
import { decrypt } from '../utils/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v18.0';
const INSTAGRAM_GRAPH_API = `https://graph.instagram.com/${META_GRAPH_API_VERSION}`;
const FACEBOOK_GRAPH_API = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

// Rate limiting: max 1 reply per user per 30 seconds
const REPLY_COOLDOWN_SECONDS = 30;

// 24-hour messaging window (in milliseconds)
const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

// In-memory cooldown tracker (for demo - use Redis in production)
const replyCooldowns = new Map();

// In-memory activity log for API traces (Live Console)
const recentActivity = [];
const MAX_ACTIVITY_LOGS = 50;

/**
 * Auto-Reply Service
 * Handles automatic replies to Instagram comments and DMs
 */
class AutoReplyService {
    /**
     * Store an activity log entry for the Live Console
     */
    addActivityLog(instagramAccountId, action, detail, extra = {}) {
        const entry = {
            id: Math.random().toString(36).substring(2, 11),
            instagramAccountId,
            action,
            detail,
            timestamp: new Date().toISOString(),
            ...extra
        };

        recentActivity.unshift(entry);

        // Keep only the most recent logs
        if (recentActivity.length > MAX_ACTIVITY_LOGS) {
            recentActivity.pop();
        }

        console.log(`[ACTIVITY] ${action}: ${detail}`);
        return entry;
    }

    /**
     * Get recent activity for a specific account
     */
    getRecentActivity(instagramAccountId, limit = 10) {
        return recentActivity
            .filter(a => a.instagramAccountId === instagramAccountId)
            .slice(0, limit);
    }

    constructor() {
        // Define auto-reply rules (can be moved to database later)
        this.messageRules = [
            {
                keywords: ['hi', 'hello', 'hey', 'hola', 'namaste'],
                reply: 'Hey there! 👋 Thanks for reaching out. How can we help you today?',
                priority: 1
            },
            {
                keywords: ['price', 'cost', 'how much', 'rate', 'pricing'],
                reply: 'Thanks for your interest in our pricing! 💰 Please DM us with details about what you\'re looking for, and our team will get back to you shortly.',
                priority: 2
            },
            {
                keywords: ['help', 'support', 'issue', 'problem'],
                reply: 'We\'re here to help! 🙌 Please describe your issue and our support team will assist you as soon as possible.',
                priority: 2
            },
            {
                keywords: ['thanks', 'thank you', 'appreciate'],
                reply: 'You\'re welcome! 😊 Let us know if there\'s anything else we can help with.',
                priority: 3
            },
            {
                keywords: ['info', 'information', 'details', 'tell me more'],
                reply: 'Great question! 📝 For more information, please check our bio or send us a detailed message about what you\'d like to know.',
                priority: 2
            }
        ];

        this.commentRules = [
            {
                keywords: ['love', 'amazing', 'awesome', 'great', 'beautiful', '❤️', '🔥', '👏'],
                reply: 'Thank you so much! 🙏 We appreciate your support! ❤️',
                priority: 1
            },
            {
                keywords: ['price', 'cost', 'how much', 'rate'],
                reply: 'Thanks for your interest! 💰 Check your DMs! 📩',
                dmReply: 'Hey! 👋 Thanks for asking about pricing!\n\n💰 Here are our rates:\n• Basic Package: $99\n• Premium Package: $199\n• Enterprise: Custom pricing\n\nLet me know if you have any questions!',
                priority: 2,
                sendDM: true // Flag to also send a DM
            },
            {
                keywords: ['where', 'location', 'address', 'shop'],
                reply: 'Check your DMs for location details! 📍📩',
                dmReply: 'Hey! 👋 Here are our location details:\n\n📍 Address: 123 Main Street, City\n⏰ Hours: Mon-Sat 9AM-6PM\n📞 Phone: +1-234-567-8900\n\nLooking forward to seeing you!',
                priority: 2,
                sendDM: true
            },
            {
                keywords: ['info', 'information', 'details', 'interested'],
                reply: 'Thanks for your interest! Check your DMs 📩',
                dmReply: 'Hey! 👋 Thanks for your interest!\n\nI\'d love to help you learn more. Could you tell me:\n• What product/service interests you?\n• Any specific questions?\n\nI\'ll get back to you right away!',
                priority: 2,
                sendDM: true
            }
        ];
    }

    /**
     * Get access token for a user by Instagram account ID
     * Returns both User Token (for ads) and Page Token (for DMs)
     */
    async getAccessTokenByInstagramId(instagramUserId) {
        if (instagramUserId === '0') {
            console.log('🧪 Meta Dashboard Test detected (ID: 0). Use a real account for live testing.');
            return null;
        }

        try {
            // First find the instagram account (include facebook_page_id AND page_access_token for messaging)
            const { data: account, error: accountError } = await supabase
                .from('instagram_accounts')
                .select('id, user_id, facebook_page_id, page_access_token, username')
                .eq('instagram_user_id', instagramUserId)
                .single();

            if (accountError || !account) {
                console.error('❌ Instagram account not found:', instagramUserId);
                return null;
            }

            // Get the auth token (User token for ads, etc.)
            const { data: tokenData, error: tokenError } = await supabase
                .from('auth_tokens')
                .select('access_token, expires_at')
                .eq('instagram_account_id', account.id)
                .single();

            if (tokenError || !tokenData) {
                console.error('❌ Auth token not found for account:', account.id);
                return null;
            }

            // Check if token is expired
            if (new Date(tokenData.expires_at) < new Date()) {
                console.warn('⚠️ Access token has expired');
                return null;
            }

            const decryptedUserToken = decrypt(tokenData.access_token);

            // Decrypt Page Token if available (used for DMs)
            let decryptedPageToken = null;
            if (account.page_access_token) {
                decryptedPageToken = decrypt(account.page_access_token);
                console.log(`🔑 Page Token retrieved for DMs, first 20 chars: ${decryptedPageToken?.substring(0, 20)}...`);
            } else {
                console.log('⚠️ No Page Token stored - DMs may fail. User needs to re-login.');
            }

            console.log(`🔑 User Token retrieved, first 20 chars: ${decryptedUserToken?.substring(0, 20)}...`);
            console.log(`🔑 Token length: ${decryptedUserToken?.length}`);
            console.log(`📄 Facebook Page ID: ${account.facebook_page_id}`);

            return {
                accessToken: decryptedUserToken, // For backward compatibility & ads
                pageToken: decryptedPageToken,   // For DMs/messaging
                instagramAccountId: account.id,
                userId: account.user_id,
                facebookPageId: account.facebook_page_id,
                username: account.username
            };
        } catch (error) {
            console.error('❌ Error getting access token:', error);
            return null;
        }
    }

    /**
     * Fetch automation rules from database
     * @param {string} instagramAccountId - The internal DB ID of the Instagram account
     * @param {string|null} mediaId - Optional media ID for post-specific rules
     */
    /**
     * Fetch automation rules from database
     * @param {string} instagramAccountId - The internal DB ID of the Instagram account
     * @param {string|null} currentMediaId - The media ID of the current post being commented on
     */
    async getAutomationRules(instagramAccountId, currentMediaId = null) {
        try {
            // Fetch ALL active rules for this account
            const { data: allRules, error } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('instagram_account_id', instagramAccountId)
                .eq('is_active', true);

            if (error || !allRules || allRules.length === 0) {
                console.log('📋 No user-defined rules found, using defaults');
                return null;
            }

            // Filter for matching rules
            const applicableRules = allRules.filter(rule => {
                // 1. General Rule (Application to all posts)
                if (!rule.media_id && (!rule.media_ids || rule.media_ids.length === 0)) {
                    return true;
                }

                // 2. Specific Post Rule (Single ID)
                if (rule.media_id === currentMediaId) {
                    return true;
                }

                // 3. Specific Post Rule (Multiple IDs)
                if (rule.media_ids && Array.isArray(rule.media_ids) && rule.media_ids.includes(currentMediaId)) {
                    return true;
                }

                return false;
            });

            if (applicableRules.length === 0) return null;

            // Sort by specificity (Specific posts > General)
            applicableRules.sort((a, b) => {
                const aIsSpecific = a.media_id || (a.media_ids && a.media_ids.length > 0);
                const bIsSpecific = b.media_id || (b.media_ids && b.media_ids.length > 0);
                if (aIsSpecific && !bIsSpecific) return -1; // a comes first
                if (!aIsSpecific && bIsSpecific) return 1;  // b comes first
                return 0;
            });

            console.log(`📋 Found ${applicableRules.length} matching rule(s) for media ${currentMediaId || 'unknown'}`);

            return applicableRules.map(r => ({
                keywords: r.keywords,
                reply: r.comment_reply,
                dmReply: r.dm_reply,
                sendDM: r.send_dm,
                // Assign priority: 1 for specific, 2 for general
                priority: (r.media_id || (r.media_ids && r.media_ids.length > 0)) ? 1 : 2,
                name: r.name
            }));

        } catch (error) {
            console.error('❌ Error fetching automation rules:', error);
            return null;
        }
    }

    /**
     * Check if we should reply (cooldown check)
     */
    shouldReply(senderId, type = 'message') {
        const key = `${type}:${senderId}`;
        const lastReply = replyCooldowns.get(key);
        const now = Date.now();

        if (lastReply && (now - lastReply) < (REPLY_COOLDOWN_SECONDS * 1000)) {
            console.log(`⏳ Cooldown active for ${senderId}, skipping reply`);
            return false;
        }

        return true;
    }

    /**
     * Mark that we replied (set cooldown)
     */
    markReplied(senderId, type = 'message') {
        const key = `${type}:${senderId}`;
        replyCooldowns.set(key, Date.now());
    }

    /**
     * Find matching rule for text
     * Rules with empty keywords array match ALL text (default/fallback behavior)
     * Rules with keywords only match if a keyword is found in text
     */
    findMatchingRule(text, rules) {
        if (!text) return null;

        const lowerText = text.toLowerCase();

        // Sort by priority (lower = higher priority)
        // Priority 1 = specific post rules, Priority 2 = general rules
        const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

        for (const rule of sortedRules) {
            // If rule has no keywords or empty keywords array, it matches EVERYTHING (default behavior)
            if (!rule.keywords || rule.keywords.length === 0) {
                console.log(`🎯 Rule "${rule.name || 'default'}" has no keywords - matches all comments`);
                return rule;
            }

            // Otherwise, check if any keyword matches
            for (const keyword of rule.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    console.log(`🎯 Keyword "${keyword}" matched in: "${text.substring(0, 50)}..."`);
                    return rule;
                }
            }
        }

        console.log(`📭 No rule matched for text: "${text.substring(0, 50)}..."`);
        return null;
    }

    /**
     * Process incoming DM and send auto-reply
     */
    async processMessage(event) {
        try {
            const { sender, recipient, message, timestamp } = event;

            // Ignore messages without text
            if (!message?.text) {
                console.log('📭 Ignoring non-text message');
                return;
            }

            const senderId = sender?.id;
            const recipientId = recipient?.id; // Numeric Meta ID

            // Get access token for this Instagram account (resolves numeric ID to internal UUID)
            const tokenData = await this.getAccessTokenByInstagramId(recipientId);

            // If we found the account, use the internal UUID for all activity logs
            const activeId = tokenData ? tokenData.instagramAccountId : recipientId;

            // Start an activity trace for this automated flow
            this.addActivityLog(activeId, 'WEBHOOK RECEIVED', 'Received direct message', {
                senderId,
                recipientId,
                text: message.text
            });

            console.log(`📩 Processing message from ${senderId} to ${recipientId}`);
            console.log(`📝 Message text: "${message.text}"`);

            if (!tokenData) {
                console.error('❌ Cannot process message - no valid token');
                this.addActivityLog(activeId, 'API ERROR', 'No valid token found for account', {
                    step: 'AUTHENTICATION'
                });
                return;
            }

            this.addActivityLog(activeId, 'RESOLVE ACCOUNT', `Token verified for @${tokenData.username}`, {
                pageId: tokenData.facebookPageId,
                username: tokenData.username
            });

            // Ignore our own messages (echo protection)
            if (senderId === recipientId) {
                console.log('🔄 Ignoring own message (echo)');
                return;
            }

            // Check 24-hour window
            const messageTime = timestamp ? new Date(timestamp * 1000) : new Date();
            const windowEnd = new Date(messageTime.getTime() + MESSAGING_WINDOW_MS);
            if (new Date() > windowEnd) {
                console.log('⏰ Outside 24-hour messaging window');
                return;
            }

            // Check cooldown - TEMPORARILY DISABLED FOR TESTING
            // TODO: Uncomment when going to production
            // if (!this.shouldReply(senderId, 'message')) {
            //     return;
            // }

            // Find matching rule
            const rule = this.findMatchingRule(message.text, this.messageRules);
            if (!rule) {
                this.addActivityLog(activeId, 'NO MATCH', `No keyword matched for: "${message.text}"`);
                return;
            }

            this.addActivityLog(activeId, 'RULE MATCHED', `Triggered rule: "${rule.name || 'default'}"`, {
                replyText: rule.reply,
                ruleName: rule.name
            });

            // Send reply using Facebook Page ID for Instagram messaging
            await this.sendMessageReply(tokenData.facebookPageId, senderId, rule.reply, tokenData.accessToken, null, activeId);
            this.markReplied(senderId, 'message');

            // Log the reply
            await this.logReply({
                type: 'message',
                senderId,
                recipientId,
                originalText: message.text,
                replyText: rule.reply,
                instagramAccountId: tokenData.instagramAccountId
            });

        } catch (error) {
            console.error('❌ Error processing message:', error);
        }
    }

    /**
     * @param {string|null} commentId - Optional comment ID (required for comment-triggered DMs to open messaging window)
     * @param {string|null} instagramAccountId - The account ID for logging
     */
    async sendMessageReply(facebookPageId, recipientIGSID, text, accessToken, commentId = null, instagramAccountId = null) {
        try {
            this.addActivityLog(instagramAccountId, 'API REQUEST', `POST /${facebookPageId}/messages`, {
                endpoint: `${FACEBOOK_GRAPH_API}/${facebookPageId}/messages`,
                payload: {
                    recipient: commentId ? { comment_id: commentId } : { id: recipientIGSID },
                    message: { text }
                }
            });
            console.log(`📤 Attempting to send DM to ${recipientIGSID}`);
            console.log(`📄 Using Facebook Page ID: ${facebookPageId}`);
            console.log(`🔑 Using token: ${accessToken?.substring(0, 25)}...`);
            if (commentId) {
                console.log(`💬 Comment-triggered DM, using comment_id: ${commentId}`);
            }

            if (!facebookPageId) {
                throw new Error('Facebook Page ID is required for Instagram messaging. Please re-login to update your account data.');
            }

            // Build recipient field:
            // - For comment-triggered DMs: use { comment_id } to associate with the comment interaction
            //   This tells Meta the DM is in response to a comment, which opens the 24-hour messaging window
            // - For regular DMs (user messaged us first): use { id } with the user's IGSID
            const recipient = commentId
                ? { comment_id: commentId }
                : { id: recipientIGSID };

            // Use Facebook Graph API with platform=instagram for Instagram DMs
            // Per Meta docs: POST /{page-id}/messages?platform=instagram
            const response = await axios.post(
                `${FACEBOOK_GRAPH_API}/${facebookPageId}/messages`,
                {
                    recipient,
                    message: { text }
                },
                {
                    params: {
                        platform: 'instagram',
                        access_token: accessToken
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ DM sent successfully:`, response.data);

            // Log successful API response
            this.addActivityLog(instagramAccountId, 'API RESPONSE', 'DM sent successfully via Instagram API', {
                recipientIGSID,
                response: response.data,
                httpStatus: 200,
                type: 'dm'
            });

            return response.data;
        } catch (error) {
            const metaError = error.response?.data?.error;
            console.error('❌ Error sending DM:', metaError || error.message);

            // Log API error
            this.addActivityLog(instagramAccountId, 'API ERROR', metaError?.message || error.message, {
                recipientIGSID,
                httpStatus: error.response?.status,
                errorType: metaError?.type,
                errorCode: metaError?.code,
                type: 'dm'
            });

            throw error;
        }
    }

    /**
     * Process incoming comment and send auto-reply
     */
    async processComment(event) {
        try {
            const { id: instagramAccountId, changes } = event;

            for (const change of changes || []) {
                if (change.field !== 'comments') continue;

                const { value } = change;
                // Note: webhook sends 'id' for comment ID, not 'comment_id'
                const { from, id: commentId, text, media } = value;

                // Resolve account early to get the internal UUID for logging
                const tokenData = await this.getAccessTokenByInstagramId(instagramAccountId);
                const activeId = tokenData ? tokenData.instagramAccountId : instagramAccountId;

                // Start an activity trace for this automated flow
                this.addActivityLog(activeId, 'WEBHOOK RECEIVED', `Received comment from @${from?.username}`, {
                    commentId,
                    text,
                    mediaId: media?.id,
                    username: from?.username
                });

                console.log(`📢 Processing comment from ${from?.username} on media ${media?.id}`);
                console.log(`📝 Comment text: "${text}"`);

                if (!tokenData) {
                    this.addActivityLog(activeId, 'API ERROR', 'No valid token found for account', {
                        step: 'AUTHENTICATION'
                    });
                    continue;
                }

                this.addActivityLog(activeId, 'RESOLVE ACCOUNT', `Token verified for @${tokenData.username}`, {
                    pageId: tokenData.facebookPageId,
                    username: tokenData.username
                });

                // Ignore our own comments (Meta numeric ID comparison)
                if (from?.id === instagramAccountId) {
                    console.log('🔄 Ignoring own comment');
                    continue;
                }

                // Check cooldown - TEMPORARILY DISABLED FOR TESTING
                // TODO: Uncomment when going to production
                // if (!this.shouldReply(from?.id, 'comment')) {
                //     continue;
                // }

                // Try to get user-defined rules from database (check for post-specific rules first)
                const mediaId = media?.id;
                let rules = await this.getAutomationRules(tokenData.instagramAccountId, mediaId);

                // Fall back to default hardcoded rules if no user-defined rules
                if (!rules || rules.length === 0) {
                    rules = this.commentRules;
                    console.log('📋 Using default hardcoded rules');
                }

                // Find matching rule
                const rule = this.findMatchingRule(text, rules);
                if (!rule) {
                    this.addActivityLog(activeId, 'NO MATCH', `No keyword matched for: "${text}"`);
                    continue;
                }

                this.addActivityLog(activeId, 'RULE MATCHED', `Triggered rule: "${rule.name || 'default'}"`, {
                    commentReply: rule.reply,
                    dmReply: rule.dmReply,
                    sendDM: rule.sendDM
                });

                console.log(`🎯 Matched rule: ${rule.name || 'default'}`);

                // Send comment reply
                console.log(`📨 Sending reply to comment ID: ${commentId}`);
                await this.sendCommentReply(commentId, rule.reply, tokenData.accessToken);
                this.markReplied(from?.id, 'comment');

                // Also send DM if rule has sendDM flag and dmReply content
                if (rule.sendDM && rule.dmReply && from?.id) {
                    console.log(`📩 Also sending DM to commenter: ${from?.username} (ID: ${from?.id})`);
                    try {
                        // DMs require the Page Token, not User Token!
                        if (tokenData.facebookPageId && tokenData.pageToken) {
                            await this.sendMessageReply(
                                tokenData.facebookPageId,
                                from.id,  // Commenter's IGSID
                                rule.dmReply,
                                tokenData.pageToken,  // Use Page Token for DMs!
                                commentId,  // Pass comment ID to associate DM with the comment interaction
                                activeId
                            );
                            console.log(`✅ DM sent to commenter ${from?.username}`);
                        } else if (!tokenData.pageToken) {
                            console.warn('⚠️ Cannot send DM - Page Token not available. User needs to re-login to store Page Token.');
                            this.addActivityLog(activeId, 'API ERROR', 'Missing Page Token for DM reply');
                        } else {
                            console.warn('⚠️ Cannot send DM - Facebook Page ID not available. User needs to re-login.');
                            this.addActivityLog(activeId, 'API ERROR', 'Missing Facebook Page ID for DM reply');
                        }
                    } catch (dmError) {
                        // DM might fail if user hasn't messaged us before (24-hour rule)
                        // Don't let this fail the whole process
                        console.warn(`⚠️ Could not send DM to ${from?.username}:`, dmError.response?.data?.error?.message || dmError.message);
                    }
                }

                // Log the reply
                await this.logReply({
                    type: 'comment',
                    senderId: from?.id,
                    senderUsername: from?.username,
                    commentId: commentId,
                    mediaId: media?.id,
                    originalText: text,
                    replyText: rule.reply,
                    dmSent: rule.sendDM ? true : false,
                    instagramAccountId: tokenData.instagramAccountId
                });
            }
        } catch (error) {
            console.error('❌ Error processing comment:', error);
        }
    }

    /**
     * Send a comment reply
     */
    async sendCommentReply(commentId, text, accessToken) {
        try {
            console.log(`📤 Attempting to reply to comment ${commentId}`);

            // Use Facebook Graph API for Instagram Business account comment replies
            const response = await axios.post(
                `${FACEBOOK_GRAPH_API}/${commentId}/replies`,
                null,
                {
                    params: {
                        message: text,
                        access_token: accessToken
                    }
                }
            );

            console.log(`✅ Comment reply sent successfully:`, response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Error sending comment reply:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Log reply to database for analytics
     */
    async logReply(data) {
        try {
            // For demo, just log to console
            // In production, save to a webhook_logs or auto_replies table
            console.log('📊 Reply logged:', {
                type: data.type,
                senderId: data.senderId,
                originalText: data.originalText?.substring(0, 50),
                replyText: data.replyText?.substring(0, 50),
                timestamp: new Date().toISOString()
            });

            // Optionally save to database
            // await supabase.from('auto_reply_logs').insert(data);
        } catch (error) {
            console.error('⚠️ Failed to log reply:', error);
        }
    }

    /**
     * Get auto-reply statistics
     */
    async getStats(instagramAccountId) {
        // This would query the database for reply counts
        // For demo, return mock data
        return {
            totalRepliesSent: 0,
            messagingReplies: 0,
            commentReplies: 0,
            activeRules: this.messageRules.length + this.commentRules.length,
            lastActivity: null
        };
    }
}

// Export singleton instance
export default new AutoReplyService();
