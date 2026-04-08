import express from 'express';
import supabase from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import autoReplyService from '../services/autoReplyService.js';

const router = express.Router();

/**
 * Helper: Get all instagram_account IDs this user has access to,
 * via auth_tokens (multi-user aware) — NOT instagram_accounts.user_id (original owner only).
 */
async function getAccountIdsForUser(userId) {
    const { data: tokens } = await supabase
        .from('auth_tokens')
        .select('instagram_account_id')
        .eq('user_id', userId)
        .eq('is_enabled', true);
    return (tokens || []).map(t => t.instagram_account_id);
}

/**
 * Get all automation rules for the authenticated user's accessible account(s)
 * Rules are shared per Instagram account; access remains gated by auth_tokens.
 */
router.get('/rules', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const activeAccountId = req.user.instagramAccountId;

        // Fast path: active account is known from JWT
        if (activeAccountId) {
            const { data: rules, error: rulesError } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('instagram_account_id', activeAccountId)
                .order('created_at', { ascending: false });

            if (rulesError) throw rulesError;
            return res.json({ success: true, rules: rules || [] });
        }

        // Fallback: resolve all accounts for this user via auth_tokens
        const accountIds = await getAccountIdsForUser(userId);

        if (accountIds.length === 0) {
            return res.json({ success: true, rules: [] });
        }

        const { data: rules, error: rulesError } = await supabase
            .from('automation_rules')
            .select('*')
            .in('instagram_account_id', accountIds)
            .order('created_at', { ascending: false });

        if (rulesError) throw rulesError;
        res.json({ success: true, rules: rules || [] });
    } catch (error) {
        console.error('Error fetching automation rules:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch rules' });
    }
});

/**
 * Create a new automation rule
 */
router.post('/rules', authenticate, async (req, res) => {
    try {
        const activeAccountId = req.user.instagramAccountId;
        const { name, keywords, comment_reply, dm_reply, send_dm, is_active, media_id, media_ids } = req.body;

        if (!name || !comment_reply) {
            return res.status(400).json({ success: false, error: 'Name and comment_reply are required' });
        }

        if (!activeAccountId) {
            return res.status(400).json({ success: false, error: 'No active Instagram account selected' });
        }

        const { data: rule, error: createError } = await supabase
            .from('automation_rules')
            .insert({
                user_id: req.user.userId,
                instagram_account_id: activeAccountId,
                name,
                keywords,
                comment_reply,
                dm_reply: dm_reply || null,
                send_dm: send_dm || false,
                is_active: is_active !== false,
                media_id: media_id || null,
                media_ids: media_ids || null
            })
            .select()
            .single();

        if (createError) throw createError;
        res.json({ success: true, rule });
    } catch (error) {
        console.error('Error creating automation rule:', error);
        res.status(500).json({ success: false, error: 'Failed to create rule' });
    }
});

/**
 * Update an automation rule
 * Rules are shared per Instagram account; any user with access to the account can edit them.
 */
router.patch('/rules/:id', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const ruleId = req.params.id;
        const updates = req.body;

        // FIX: Use auth_tokens to resolve accounts this user can access
        const accountIds = await getAccountIdsForUser(userId);

        const { data: existingRule, error: fetchError } = await supabase
            .from('automation_rules')
            .select('instagram_account_id')
            .eq('id', ruleId)
            .single();

        if (fetchError || !existingRule || !accountIds.includes(existingRule.instagram_account_id)) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }

        const { data: rule, error: updateError } = await supabase
            .from('automation_rules')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', ruleId)
            .select()
            .single();

        if (updateError) throw updateError;
        res.json({ success: true, rule });
    } catch (error) {
        console.error('Error updating automation rule:', error);
        res.status(500).json({ success: false, error: 'Failed to update rule' });
    }
});

/**
 * Delete an automation rule
 * Rules are shared per Instagram account; any user with access to the account can delete them.
 */
router.delete('/rules/:id', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const ruleId = req.params.id;

        // FIX: Use auth_tokens to resolve accounts this user can access
        const accountIds = await getAccountIdsForUser(userId);

        const { data: existingRule, error: fetchError } = await supabase
            .from('automation_rules')
            .select('instagram_account_id')
            .eq('id', ruleId)
            .single();

        if (fetchError || !existingRule || !accountIds.includes(existingRule.instagram_account_id)) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }

        const { error: deleteError } = await supabase
            .from('automation_rules')
            .delete()
            .eq('id', ruleId);

        if (deleteError) throw deleteError;
        res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
        console.error('Error deleting automation rule:', error);
        res.status(500).json({ success: false, error: 'Failed to delete rule' });
    }
});

/**
 * Get recent automated activity (Live Console)
 */
router.get('/activity', authenticate, async (req, res) => {
    try {
        const activeAccountId = req.user.instagramAccountId;
        if (!activeAccountId) {
            return res.status(400).json({ success: false, error: 'No active account selected' });
        }

        const activity = await autoReplyService.getRecentActivity(activeAccountId, 20);
        res.json({ success: true, activity });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get automation statistics
 */
router.get('/stats', authenticate, async (req, res) => {
    try {
        const activeAccountId = req.user.instagramAccountId;
        if (!activeAccountId) {
            return res.status(400).json({ success: false, error: 'No active account selected' });
        }

        const stats = await autoReplyService.getStats(activeAccountId);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
