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

        // Update stats
        if (instagramAccountId) {
            if (!this.stats.has(instagramAccountId)) {
                this.stats.set(instagramAccountId, { comments: 0, dms: 0, errors: 0 });
            }
            const s = this.stats.get(instagramAccountId);
            if (action === 'WEBHOOK RECEIVED' && (extra.commentId || detail.toLowerCase().includes('comment'))) {
                s.comments++;
            } else if (action === 'API RESPONSE' && extra.type === 'dm') {
                s.dms++;
            } else if (action === 'API ERROR') {
                s.errors++;
            }
        }

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
        this.stats = new Map(); // Map<instagramAccountId, { comments: 0, dms: 0, errors: 0 }>
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
            console.log('   │  ⚠️  Test event from Meta Dashboard (ID: 0) — skipping');
            return null;
        }

        try {
            const { data: account, error: accountError } = await supabase
                .from('instagram_accounts')
                .select('id, user_id, facebook_page_id, page_access_token, username')
                .eq('instagram_user_id', instagramUserId)
                .single();

            if (accountError || !account) {
                console.log(`   │  ❌ Account not found for IG ID: ${instagramUserId}`);
                return null;
            }

            const { data: tokenData, error: tokenError } = await supabase
                .from('auth_tokens')
                .select('access_token, expires_at')
                .eq('instagram_account_id', account.id)
                .single();

            if (tokenError || !tokenData) {
                console.log(`   │  ❌ Token not found for account: ${account.id}`);
                return null;
            }

            if (new Date(tokenData.expires_at) < new Date()) {
                console.log(`   │  ⚠️  Token expired`);
                return null;
            }

            const decryptedUserToken = decrypt(tokenData.access_token);
            let decryptedPageToken = null;
            if (account.page_access_token) {
                decryptedPageToken = decrypt(account.page_access_token);
            }

            return {
                accessToken: decryptedUserToken,
                pageToken: decryptedPageToken,
                instagramAccountId: account.id,
                userId: account.user_id,
                facebookPageId: account.facebook_page_id,
                username: account.username
            };
        } catch (error) {
            console.error(`   │  ❌ Token lookup error: ${error.message}`);
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

            console.log(`   │  📋 ${applicableRules.length} matching rule(s) for media ${currentMediaId || 'all posts'}`);

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
                return rule;
            }

            // Otherwise, check if any keyword matches
            for (const keyword of rule.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    return rule;
                }
            }
        }

        return null;
    }

    /**
     * Process incoming DM and send auto-reply
     */
    async processMessage(event) {
        try {
            const { sender, recipient, message, timestamp } = event;

            if (!message?.text) return;

            const senderId = sender?.id;
            const recipientId = recipient?.id;
            const messageId = message?.mid || 'N/A';

            const tokenData = await this.getAccessTokenByInstagramId(recipientId);
            const activeId = tokenData ? tokenData.instagramAccountId : recipientId;

            this.addActivityLog(activeId, 'WEBHOOK RECEIVED', 'Received direct message', {
                senderId, recipientId, text: message.text
            });

            console.log(`\n   ┌─ DM PROCESSING`);
            console.log(`   │  Sender ID    : ${senderId}`);
            console.log(`   │  Recipient ID : ${recipientId}`);
            console.log(`   │  Message ID   : ${messageId}`);
            console.log(`   │  Text         : "${message.text}"`);

            if (!tokenData) {
                console.log(`   │  ❌ No valid token for account ${recipientId}`);
                this.addActivityLog(activeId, 'API ERROR', 'No valid token found for account', { step: 'AUTHENTICATION' });
                console.log(`   └─ END`);
                return;
            }

            console.log(`   │  Account      : @${tokenData.username}`);
            console.log(`   │  Page ID      : ${tokenData.facebookPageId}`);

            this.addActivityLog(activeId, 'RESOLVE ACCOUNT', `Token verified for @${tokenData.username}`, {
                pageId: tokenData.facebookPageId, username: tokenData.username
            });

            if (senderId === recipientId) {
                console.log(`   │  ⏭️  Skipping own message (echo)`);
                console.log(`   └─ END`);
                return;
            }

            const messageTime = timestamp ? new Date(timestamp * 1000) : new Date();
            const windowEnd = new Date(messageTime.getTime() + MESSAGING_WINDOW_MS);
            if (new Date() > windowEnd) {
                console.log(`   │  ⏰ Outside 24-hour messaging window`);
                console.log(`   └─ END`);
                return;
            }

            const rule = this.findMatchingRule(message.text, this.messageRules);
            if (!rule) {
                console.log(`   │  📭 No matching rule found`);
                this.addActivityLog(activeId, 'NO MATCH', `No keyword matched for: "${message.text}"`);
                console.log(`   └─ END`);
                return;
            }

            console.log(`   │  ✅ Rule matched: "${rule.name || 'default'}"`);
            console.log(`   │  Reply text   : "${rule.reply.substring(0, 60)}..."`);

            this.addActivityLog(activeId, 'RULE MATCHED', `Triggered rule: "${rule.name || 'default'}"`, {
                replyText: rule.reply, ruleName: rule.name
            });

            await this.sendMessageReply(tokenData.facebookPageId, senderId, rule.reply, tokenData.accessToken, null, activeId);
            this.markReplied(senderId, 'message');

            console.log(`   │  ✅ DM reply sent successfully`);
            console.log(`   └─ END`);

            await this.logReply({
                type: 'message', senderId, recipientId,
                originalText: message.text, replyText: rule.reply,
                instagramAccountId: tokenData.instagramAccountId
            });

        } catch (error) {
            console.error(`   │  ❌ Error: ${error.message}`);
            console.log(`   └─ END`);
        }
    }

    /**
     * @param {string|null} commentId - Optional comment ID (required for comment-triggered DMs to open messaging window)
     * @param {string|null} instagramAccountId - The account ID for logging
     */
    async sendMessageReply(facebookPageId, recipientIGSID, text, accessToken, commentId = null, instagramAccountId = null) {
        try {
            const recipient = commentId
                ? { comment_id: commentId }
                : { id: recipientIGSID };

            this.addActivityLog(instagramAccountId, 'API REQUEST', `POST /${facebookPageId}/messages`, {
                endpoint: `${FACEBOOK_GRAPH_API}/${facebookPageId}/messages`,
                payload: { recipient, message: { text } }
            });

            console.log(`   │  📤 SENDING DM`);
            console.log(`   │     Endpoint    : POST /${facebookPageId}/messages`);
            console.log(`   │     Recipient   : ${commentId ? `comment_id: ${commentId}` : `IGSID: ${recipientIGSID}`}`);
            console.log(`   │     Message     : "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

            if (!facebookPageId) {
                throw new Error('Facebook Page ID is required for Instagram messaging.');
            }

            const response = await axios.post(
                `${FACEBOOK_GRAPH_API}/${facebookPageId}/messages`,
                { recipient, message: { text } },
                {
                    params: { platform: 'instagram', access_token: accessToken },
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            console.log(`   │     ✅ Success`);
            console.log(`   │     Recipient ID : ${response.data?.recipient_id || 'N/A'}`);
            console.log(`   │     Message ID   : ${response.data?.message_id || 'N/A'}`);

            this.addActivityLog(instagramAccountId, 'API RESPONSE', 'DM sent successfully via Instagram API', {
                recipientIGSID, response: response.data, httpStatus: 200, type: 'dm'
            });

            return response.data;
        } catch (error) {
            const metaError = error.response?.data?.error;
            console.error(`   │     ❌ DM FAILED: ${metaError?.message || error.message}`);
            console.error(`   │     Error Code  : ${metaError?.code || 'N/A'}`);
            console.error(`   │     HTTP Status : ${error.response?.status || 'N/A'}`);

            this.addActivityLog(instagramAccountId, 'API ERROR', metaError?.message || error.message, {
                recipientIGSID, httpStatus: error.response?.status,
                errorType: metaError?.type, errorCode: metaError?.code, type: 'dm'
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
                const { from, id: commentId, text, media } = value;

                const tokenData = await this.getAccessTokenByInstagramId(instagramAccountId);
                const activeId = tokenData ? tokenData.instagramAccountId : instagramAccountId;

                this.addActivityLog(activeId, 'WEBHOOK RECEIVED', `Received comment from @${from?.username}`, {
                    commentId, text, mediaId: media?.id, username: from?.username
                });

                console.log(`\n   ┌─ COMMENT PROCESSING`);
                console.log(`   │  Comment ID   : ${commentId}`);
                console.log(`   │  From         : @${from?.username} (User ID: ${from?.id})`);
                console.log(`   │  Text         : "${text}"`);
                console.log(`   │  Media ID     : ${media?.id || 'N/A'}`);
                console.log(`   │  IG Account   : ${instagramAccountId}`);

                if (!tokenData) {
                    console.log(`   │  ❌ No valid token for account`);
                    this.addActivityLog(activeId, 'API ERROR', 'No valid token found for account', { step: 'AUTHENTICATION' });
                    console.log(`   └─ END`);
                    continue;
                }

                console.log(`   │  Account      : @${tokenData.username}`);
                console.log(`   │  Page ID      : ${tokenData.facebookPageId}`);

                this.addActivityLog(activeId, 'RESOLVE ACCOUNT', `Token verified for @${tokenData.username}`, {
                    pageId: tokenData.facebookPageId, username: tokenData.username
                });

                if (from?.id === instagramAccountId) {
                    console.log(`   │  ⏭️  Skipping own comment`);
                    console.log(`   └─ END`);
                    continue;
                }

                const mediaId = media?.id;
                let rules = await this.getAutomationRules(tokenData.instagramAccountId, mediaId);

                if (!rules || rules.length === 0) {
                    console.log(`   │  📭 No active rules for this post/account. Skipping.`);
                    console.log(`   └─ END`);
                    continue;
                }

                console.log(`   │  Using ${rules.length} custom rule(s)`);

                const rule = this.findMatchingRule(text, rules);
                if (!rule) {
                    console.log(`   │  📭 No matching rule found`);
                    this.addActivityLog(activeId, 'NO MATCH', `No keyword matched for: "${text}"`);
                    console.log(`   └─ END`);
                    continue;
                }

                console.log(`   │  ✅ Rule matched: "${rule.name || 'default'}"`);

                this.addActivityLog(activeId, 'RULE MATCHED', `Triggered rule: "${rule.name || 'default'}"`, {
                    commentReply: rule.reply, dmReply: rule.dmReply, sendDM: rule.sendDM
                });

                // Send comment reply
                console.log(`   │  📨 REPLYING TO COMMENT`);
                console.log(`   │     Comment ID : ${commentId}`);
                console.log(`   │     Reply      : "${rule.reply.substring(0, 80)}${rule.reply.length > 80 ? '...' : ''}"`);
                await this.sendCommentReply(commentId, rule.reply, tokenData.accessToken);
                this.markReplied(from?.id, 'comment');
                console.log(`   │     ✅ Comment reply sent`);

                // Send DM if configured
                if (rule.sendDM && rule.dmReply && from?.id) {
                    console.log(`   │  📩 SENDING DM TO COMMENTER`);
                    console.log(`   │     To         : @${from?.username} (ID: ${from?.id})`);
                    try {
                        if (tokenData.facebookPageId && tokenData.pageToken) {
                            await this.sendMessageReply(
                                tokenData.facebookPageId, from.id, rule.dmReply,
                                tokenData.pageToken, commentId, activeId
                            );
                            console.log(`   │     ✅ DM sent to @${from?.username}`);
                        } else if (!tokenData.pageToken) {
                            console.log(`   │     ⚠️  No Page Token — user needs to re-login`);
                            this.addActivityLog(activeId, 'API ERROR', 'Missing Page Token for DM reply');
                        } else {
                            console.log(`   │     ⚠️  No Facebook Page ID — user needs to re-login`);
                            this.addActivityLog(activeId, 'API ERROR', 'Missing Facebook Page ID for DM reply');
                        }
                    } catch (dmError) {
                        console.warn(`   │     ⚠️  DM failed: ${dmError.response?.data?.error?.message || dmError.message}`);
                    }
                }

                console.log(`   └─ END`);

                await this.logReply({
                    type: 'comment', senderId: from?.id, senderUsername: from?.username,
                    commentId, mediaId: media?.id, originalText: text,
                    replyText: rule.reply, dmSent: rule.sendDM ? true : false,
                    instagramAccountId: tokenData.instagramAccountId
                });
            }
        } catch (error) {
            console.error(`   │  ❌ Error: ${error.message}`);
            console.log(`   └─ END`);
        }
    }

    /**
     * Send a comment reply
     */
    async sendCommentReply(commentId, text, accessToken) {
        try {
            const response = await axios.post(
                `${FACEBOOK_GRAPH_API}/${commentId}/replies`,
                null,
                { params: { message: text, access_token: accessToken } }
            );

            console.log(`   │     Reply ID   : ${response.data?.id || 'N/A'}`);
            return response.data;
        } catch (error) {
            console.error(`   │     ❌ Comment reply failed: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    /**
     * Log reply to database for analytics
     */
    async logReply(data) {
        try {
            console.log(`   │  📊 Logged: ${data.type} | from: ${data.senderUsername || data.senderId} | reply: "${data.replyText?.substring(0, 40)}..."`);
        } catch (error) {
            // silent
        }
    }

    /**
     * Get auto-reply statistics
     */
    async getStats(instagramAccountId) {
        const defaultStats = {
            totalRepliesSent: 0,
            messagingReplies: 0,
            commentReplies: 0,
            errors: 0,
            activeRules: this.messageRules.length + this.commentRules.length,
            recentEvents: 0
        };

        if (!instagramAccountId) return defaultStats;

        const s = this.stats.get(instagramAccountId) || { comments: 0, dms: 0, errors: 0 };
        const recent = recentActivity.filter(a => a.instagramAccountId === instagramAccountId).length;

        // Try to get rules count from DB if possible
        let rulesCount = defaultStats.activeRules;
        try {
            const { count } = await supabase
                .from('automation_rules')
                .select('*', { count: 'exact', head: true })
                .eq('instagram_account_id', instagramAccountId);
            if (count !== null) rulesCount = count;
        } catch (e) { /* ignore */ }

        return {
            totalRepliesSent: s.comments + s.dms,
            messagingReplies: s.dms,
            commentReplies: s.comments,
            errors: s.errors,
            activeRules: rulesCount,
            recentEvents: recent
        };
    }
}

// Export singleton instance
export default new AutoReplyService();
