import axios from 'axios';
import crypto from 'crypto';
import supabase from '../config/database.js';
import { decrypt } from '../utils/encryption.js';
import { deleteRuntimeCache, getRuntimeCache, setRuntimeCache } from './runtimeStateService.js';
import dotenv from 'dotenv';

dotenv.config();

const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v18.0';
const FACEBOOK_GRAPH_API = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

// Rate limiting: max 1 reply per user per 30 seconds
const REPLY_COOLDOWN_SECONDS = 30;

// 24-hour messaging window (in milliseconds)
const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_CACHE_PREFIX = 'autoreply:cooldown:';

/**
 * Auto-Reply Service
 * Handles automatic replies to Instagram comments and DMs
 */
class AutoReplyService {
    /**
     * Store an activity log entry for the Live Console
     */
    async addActivityLog(instagramAccountId, action, detail, extra = {}) {
        const entry = {
            id: crypto.randomUUID(),
            instagramAccountId,
            action,
            detail,
            timestamp: new Date().toISOString(),
            ...extra
        };

        if (instagramAccountId) {
            try {
                const { error: insertError } = await supabase
                    .from('auto_reply_activity_logs')
                    .insert({
                        id: entry.id,
                        instagram_account_id: instagramAccountId,
                        action,
                        detail,
                        extra,
                        created_at: entry.timestamp,
                    });

                if (insertError) {
                    throw insertError;
                }

                const deltas = this.getStatsDeltas(action, detail, extra);
                if (deltas.comments || deltas.dms || deltas.errors) {
                    const { error: statsError } = await supabase.rpc('increment_auto_reply_runtime_stats', {
                        target_account_id: instagramAccountId,
                        comments_delta: deltas.comments,
                        dms_delta: deltas.dms,
                        errors_delta: deltas.errors,
                    });

                    if (statsError) {
                        throw statsError;
                    }
                }
            } catch (error) {
                console.error(`[ACTIVITY] Failed to persist runtime state: ${error.message}`);
            }
        }

        return entry;
    }

    getStatsDeltas(action, detail, extra = {}) {
        return {
            comments: action === 'WEBHOOK RECEIVED' && (extra.commentId || detail.toLowerCase().includes('comment')) ? 1 : 0,
            dms: action === 'API RESPONSE' && extra.type === 'dm' ? 1 : 0,
            errors: action === 'API ERROR' ? 1 : 0,
        };
    }

    /**
     * Get recent activity for a specific account
     */
    async getRecentActivity(instagramAccountId, limit = 10) {
        const { data, error } = await supabase
            .from('auto_reply_activity_logs')
            .select('id, instagram_account_id, action, detail, extra, created_at')
            .eq('instagram_account_id', instagramAccountId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error || !data) {
            return [];
        }

        return data.map((row) => ({
            id: row.id,
            instagramAccountId: row.instagram_account_id,
            action: row.action,
            detail: row.detail,
            timestamp: row.created_at,
            ...(row.extra || {}),
        }));
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

    async getAccountTokenContexts(instagramUserId) {
        if (instagramUserId === '0') {
            return { account: null, contexts: [] };
        }

        try {
            const { data: account, error: accountError } = await supabase
                .from('instagram_accounts')
                .select('id, user_id, facebook_page_id, page_access_token, username')
                .eq('instagram_user_id', instagramUserId)
                .maybeSingle();

            if (accountError || !account) {
                return { account: null, contexts: [] };
            }

            const { data: tokenData, error: tokenError } = await supabase
                .from('auth_tokens')
                .select('access_token, expires_at, user_id, is_active, is_enabled, updated_at, page_access_token, facebook_page_id')
                .eq('instagram_account_id', account.id)
                .eq('is_enabled', true)
                .gt('expires_at', new Date().toISOString())
                .order('is_active', { ascending: false })
                .order('updated_at', { ascending: false });

            if (tokenError || !tokenData || tokenData.length === 0) {
                return { account, contexts: [] };
            }

            let decryptedPageToken = null;
            if (account.page_access_token) {
                decryptedPageToken = decrypt(account.page_access_token);
            }

            return {
                account,
                contexts: tokenData.map((tokenRow) => {
                    const hasConnectionPageToken = !!tokenRow.page_access_token;

                    return {
                        accessToken: decrypt(tokenRow.access_token),
                        pageToken: hasConnectionPageToken ? decrypt(tokenRow.page_access_token) : decryptedPageToken,
                        pageTokenSource: hasConnectionPageToken ? 'auth_tokens' : 'instagram_accounts',
                        instagramAccountId: account.id,
                        userId: tokenRow.user_id,
                        isActive: tokenRow.is_active === true,
                        facebookPageId: tokenRow.facebook_page_id || account.facebook_page_id,
                        username: account.username,
                        updatedAt: tokenRow.updated_at || null,
                    };
                }),
            };
        } catch (error) {
            console.error(`   │  ❌ Token lookup error: ${error.message}`);
            return { account: null, contexts: [] };
        }
    }

    /**
     * Get access token for a user by Instagram account ID
     * Returns the best active enabled token context for this account.
     */
    async getAccessTokenByInstagramId(instagramUserId) {
        const { contexts } = await this.getAccountTokenContexts(instagramUserId);
        return contexts[0] || null;
    }

    mapAutomationRules(rules, priority) {
        return rules.map((rule) => ({
            keywords: rule.keywords,
            reply: rule.comment_reply,
            dmReply: rule.dm_reply,
            sendDM: rule.send_dm,
            priority,
            name: rule.name,
            updatedAt: rule.updated_at || rule.created_at || null,
            userId: rule.user_id || null,
        }));
    }

    getApplicableRules(rules, currentMediaId = null) {
        const specificRules = rules.filter((rule) =>
            rule.is_active &&
            currentMediaId &&
            (rule.media_id === currentMediaId ||
                (rule.media_ids && Array.isArray(rule.media_ids) && rule.media_ids.includes(currentMediaId)))
        );

        if (specificRules.length > 0) {
            return this.mapAutomationRules(specificRules, 1);
        }

        const generalRules = rules.filter((rule) =>
            rule.is_active &&
            !rule.media_id &&
            (!rule.media_ids || rule.media_ids.length === 0)
        );

        if (generalRules.length === 0) {
            return null;
        }

        return this.mapAutomationRules(generalRules, 2);
    }

    async resolveAutomationContext(instagramUserId, currentMediaId = null) {
        try {
            const { account, contexts } = await this.getAccountTokenContexts(instagramUserId);
            if (!account || contexts.length === 0) {
                return null;
            }

            const { data: allRules, error } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('instagram_account_id', account.id)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Error loading automation rules:', error.message);
                return null;
            }

            if (!allRules || allRules.length === 0) {
                return null;
            }

            const applicableRules = this.getApplicableRules(allRules, currentMediaId);
            if (!applicableRules || applicableRules.length === 0) {
                return null;
            }

            const ownerContext = applicableRules
                .map((rule) => rule.userId)
                .filter(Boolean)
                .map((ruleUserId) => contexts.find((context) => context.userId === ruleUserId))
                .find(Boolean);
            const tokenData = ownerContext || contexts[0];

            return {
                tokenData,
                rules: applicableRules,
                sortKey: applicableRules[0]?.updatedAt || tokenData?.updatedAt || '',
            };

        } catch (error) {
            console.error('❌ Error fetching automation rules:', error);
            return null;
        }
    }

    /**
     * Check if we should reply (cooldown check)
     */
    async shouldReply(senderId, type = 'message') {
        const key = `${COOLDOWN_CACHE_PREFIX}${type}:${senderId}`;
        const lastReply = await getRuntimeCache(key);

        if (lastReply?.blockedUntil && new Date(lastReply.blockedUntil).getTime() > Date.now()) {
            return false;
        }

        return true;
    }

    /**
     * Mark that we replied (set cooldown)
     */
    async markReplied(senderId, type = 'message') {
        const key = `${COOLDOWN_CACHE_PREFIX}${type}:${senderId}`;
        const blockedUntil = new Date(Date.now() + (REPLY_COOLDOWN_SECONDS * 1000)).toISOString();
        await setRuntimeCache(key, { blockedUntil }, REPLY_COOLDOWN_SECONDS);
    }

    async clearReplyCooldown(senderId, type = 'message') {
        const key = `${COOLDOWN_CACHE_PREFIX}${type}:${senderId}`;
        try {
            await deleteRuntimeCache(key);
        } catch {
            // Ignore cache cleanup issues.
        }
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

            // Resolve full context: DB automation rules + token for this IG account.
            const resolvedContext = await this.resolveAutomationContext(recipientId);
            const tokenData = resolvedContext?.tokenData || await this.getAccessTokenByInstagramId(recipientId);
            const activeId = tokenData ? tokenData.instagramAccountId : recipientId;

            await this.addActivityLog(activeId, 'WEBHOOK RECEIVED', 'Received direct message', {
                senderId, recipientId, text: message.text
            });

            if (!tokenData) {
                await this.addActivityLog(activeId, 'API ERROR', 'No valid token found for account', { step: 'AUTHENTICATION' });
                return;
            }

            await this.addActivityLog(activeId, 'RESOLVE ACCOUNT', `Token verified for @${tokenData.username}`, {
                pageId: tokenData.facebookPageId, username: tokenData.username
            });

            if (senderId === recipientId) {
                return;
            }

            const messageTime = timestamp ? new Date(timestamp * 1000) : new Date();
            const windowEnd = new Date(messageTime.getTime() + MESSAGING_WINDOW_MS);
            if (new Date() > windowEnd) {
                return;
            }

            const rules = resolvedContext?.rules || this.messageRules;
            const rule = this.findMatchingRule(message.text, rules);
            if (!rule) {
                await this.addActivityLog(activeId, 'NO MATCH', `No keyword matched for: "${message.text}"`);
                return;
            }

            await this.addActivityLog(activeId, 'RULE MATCHED', `Triggered rule: "${rule.name || 'default'}"`, {
                replyText: rule.reply, ruleName: rule.name
            });

            if (!tokenData.pageToken) {
                await this.addActivityLog(
                    activeId,
                    'API ERROR',
                    'Missing page access token — cannot send DM reply. Re-connect Meta to refresh.',
                    { step: 'SEND_DM' }
                );
                return;
            }

            await this.sendMessageReply(tokenData.facebookPageId, senderId, rule.reply, tokenData.pageToken, null, activeId);
            await this.markReplied(senderId, 'message');

            await this.logReply({
                type: 'message',
                senderId,
                recipientId,
                originalText: message.text,
                replyText: rule.reply,
                instagramAccountId: tokenData.instagramAccountId,
                userId: tokenData.userId
            });
        } catch (error) {
            console.error('Auto-reply DM processing failed:', error.message);
        }
    }

    /**
     * Send a DM reply via the Instagram Messaging API.
     * MUST be called with a Page Access Token, NOT a User Access Token.
     * @param {string|null} commentId - Set when opened by a comment interaction (opens messaging window)
     * @param {string|null} instagramAccountId - Account ID used for activity logging
     */
    async sendMessageReply(facebookPageId, recipientIGSID, text, accessToken, commentId = null, instagramAccountId = null) {
        try {
            const recipient = commentId
                ? { comment_id: commentId }
                : { id: recipientIGSID };

            await this.addActivityLog(instagramAccountId, 'API REQUEST', `POST /${facebookPageId}/messages`, {
                endpoint: `${FACEBOOK_GRAPH_API}/${facebookPageId}/messages`,
                payload: { recipient, message: { text } }
            });

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

            await this.addActivityLog(instagramAccountId, 'API RESPONSE', 'DM sent successfully via Instagram API', {
                recipientIGSID, response: response.data, httpStatus: 200, type: 'dm'
            });

            return response.data;
        } catch (error) {
            const metaError = error.response?.data?.error;
            console.error(`DM failed: ${metaError?.message || error.message}`);

            await this.addActivityLog(instagramAccountId, 'API ERROR', metaError?.message || error.message, {
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
                const { from, id: commentId, text, media } = value;

                const resolvedContext = await this.resolveAutomationContext(instagramAccountId, media?.id);
                const tokenData = resolvedContext?.tokenData || await this.getAccessTokenByInstagramId(instagramAccountId);
                const activeId = tokenData ? tokenData.instagramAccountId : instagramAccountId;

                await this.addActivityLog(activeId, 'WEBHOOK RECEIVED', `Received comment from @${from?.username}`, {
                    commentId, text, mediaId: media?.id, username: from?.username
                });

                if (!tokenData) {
                    await this.addActivityLog(activeId, 'API ERROR', 'No valid token found for account', { step: 'AUTHENTICATION' });
                    continue;
                }

                await this.addActivityLog(activeId, 'RESOLVE ACCOUNT', `Token verified for @${tokenData.username}`, {
                    pageId: tokenData.facebookPageId, username: tokenData.username
                });

                if (from?.id === instagramAccountId) {
                    continue;
                }

                const rules = resolvedContext?.rules || null;
                if (!rules || rules.length === 0) {
                    continue;
                }

                const rule = this.findMatchingRule(text, rules);
                if (!rule) {
                    await this.addActivityLog(activeId, 'NO MATCH', `No keyword matched for: "${text}"`);
                    continue;
                }

                await this.addActivityLog(activeId, 'RULE MATCHED', `Triggered rule: "${rule.name || 'default'}"`, {
                    commentReply: rule.reply, dmReply: rule.dmReply, sendDM: rule.sendDM
                });

                await this.sendCommentReply(commentId, rule.reply, tokenData.accessToken);
                await this.markReplied(from?.id, 'comment');

                if (rule.sendDM && rule.dmReply && from?.id) {
                    try {
                        if (tokenData.facebookPageId && tokenData.pageToken) {
                            await this.sendMessageReply(
                                tokenData.facebookPageId,
                                from.id,
                                rule.dmReply,
                                tokenData.pageToken,
                                commentId,
                                activeId
                            );
                        } else if (!tokenData.pageToken) {
                            await this.addActivityLog(activeId, 'API ERROR', 'Missing Page Token for DM reply');
                        } else {
                            await this.addActivityLog(activeId, 'API ERROR', 'Missing Facebook Page ID for DM reply');
                        }
                    } catch (dmError) {
                        console.warn(`   │     ⚠️  DM failed: ${dmError.response?.data?.error?.message || dmError.message}`);
                    }
                }

                await this.logReply({
                    type: 'comment',
                    senderId: from?.id,
                    senderUsername: from?.username,
                    commentId,
                    mediaId: media?.id,
                    originalText: text,
                    replyText: rule.reply,
                    dmSent: rule.sendDM ? true : false,
                    instagramAccountId: tokenData.instagramAccountId,
                    userId: tokenData.userId
                });
            }
        } catch (error) {
            console.error('Auto-reply comment processing failed:', error.message);
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

            return response.data;
        } catch (error) {
            console.error(`Comment reply failed: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    /**
     * Log reply to database for analytics
     */
    async logReply(data) {
        void data;
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

        let runtimeStats = { comments: 0, dms: 0, errors: 0 };
        let recent = 0;

        try {
            const { data: statsRow } = await supabase
                .from('auto_reply_runtime_stats')
                .select('comments, dms, errors')
                .eq('instagram_account_id', instagramAccountId)
                .maybeSingle();

            if (statsRow) {
                runtimeStats = {
                    comments: Number(statsRow.comments || 0),
                    dms: Number(statsRow.dms || 0),
                    errors: Number(statsRow.errors || 0),
                };
            }

            const { count } = await supabase
                .from('auto_reply_activity_logs')
                .select('*', { count: 'exact', head: true })
                .eq('instagram_account_id', instagramAccountId);

            recent = count || 0;
        } catch (error) {
            console.warn('Auto-reply runtime stats lookup failed:', error.message);
        }

        let rulesCount = defaultStats.activeRules;
        try {
            const { count } = await supabase
                .from('automation_rules')
                .select('*', { count: 'exact', head: true })
                .eq('instagram_account_id', instagramAccountId)
                .eq('is_active', true);
            if (count !== null) rulesCount = count;
        } catch {
            // Ignore rule count lookup failures.
        }

        return {
            totalRepliesSent: runtimeStats.comments + runtimeStats.dms,
            messagingReplies: runtimeStats.dms,
            commentReplies: runtimeStats.comments,
            errors: runtimeStats.errors,
            activeRules: rulesCount,
            recentEvents: recent
        };
    }
}

export default new AutoReplyService();
