import AnalyticsService from '../services/analyticsService.js';
import * as authService from '../services/authService.js';

async function getAnalyticsService(req) {
    console.log('📊 Creating AnalyticsService for user:', req.user?.userId, 'instagram:', req.user?.instagramUserId, 'accountId:', req.user?.instagramAccountId);

    if (!req.user?.userId || !req.user?.instagramUserId) {
        throw new Error('Missing user credentials in request. userId=' + req.user?.userId + ', instagramUserId=' + req.user?.instagramUserId);
    }

    const service = new AnalyticsService(
        req.user.userId,
        req.user.instagramUserId,
        req.user.instagramAccountId
    );

    try {
        await service.initialize();
        console.log('✅ AnalyticsService initialized successfully');
    } catch (initError) {
        console.error('❌ AnalyticsService initialization failed:', initError.message);
        throw initError;
    }

    return service;
}

export async function getOverview(req, res) {
    try {
        console.log('📈 getOverview called for user:', req.user?.username);
        const { startDate, endDate } = req.query;
        const analytics = await getAnalyticsService(req);
        const data = await analytics.getOverview(startDate, endDate);
        console.log('✅ Overview data fetched successfully');
        res.json({ success: true, data });
    } catch (error) {
        console.error('❌ Overview error:', error.message);
        console.error('❌ Full error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getGrowth(req, res) {
    try {
        const { startDate, endDate } = req.query;
        const analytics = await getAnalyticsService(req);
        const data = await analytics.getGrowth(startDate, endDate);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Growth error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getBestTime(req, res) {
    try {
        const { startDate, endDate } = req.query;
        const analytics = await getAnalyticsService(req);
        const data = await analytics.getBestTimeToPost(startDate, endDate);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Best time error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getHashtags(req, res) {
    try {
        const { startDate, endDate } = req.query;
        const analytics = await getAnalyticsService(req);
        const data = await analytics.getHashtagAnalysis(startDate, endDate);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Hashtags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getReels(req, res) {
    try {
        const { startDate, endDate } = req.query;
        const analytics = await getAnalyticsService(req);
        const data = await analytics.getReelsAnalytics(startDate, endDate);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Reels error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getPosts(req, res) {
    try {
        const { limit = 50, includeCollabs = 'false' } = req.query;
        const analytics = await getAnalyticsService(req);
        
        // Don't include collabs since webhooks don't work for them
        if (includeCollabs === 'true') {
            const result = await analytics.instagram.getAllMediaIncludingCollabs(parseInt(limit));
            // Filter out collaboration posts since webhooks don't work for them
            const ownedOnly = result.data.filter(p => !p.is_collaboration);
            return res.json({ 
                success: true, 
                data: {
                    all: ownedOnly.map(p => ({
                        id: p.id,
                        media_type: p.media_type,
                        caption: p.caption || '',
                        media_url: p.media_url,
                        thumbnail: p.thumbnail_url || p.media_url,
                        permalink: p.permalink,
                        timestamp: p.timestamp,
                        like_count: p.like_count || 0,
                        comments_count: p.comments_count || 0,
                        is_collaboration: false
                    })),
                    owned_count: ownedOnly.length,
                    collab_count: 0,
                    total: ownedOnly.length
                }
            });
        }
        
        // Otherwise use the standard analytics method
        const { startDate, endDate } = req.query;
        const data = await analytics.getPostsAnalytics(parseInt(limit), startDate, endDate);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Posts error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function exportData(req, res) {
    try {
        const { format = 'json', metrics = 'overview,growth,posts', startDate, endDate } = req.query;
        const metricsArray = metrics.split(',').map(m => m.trim()).filter(Boolean);
        const analytics = await getAnalyticsService(req);
        const data = await analytics.exportData(format, metricsArray, { startDate, endDate });

        const extMap = {
            json: 'json',
            csv: 'csv',
            tsv: 'tsv',
            md: 'md',
            html: 'html',
        };

        const filename = `infini8graph-export-${Date.now()}.${extMap[format] || 'txt'}`;

        if (format === 'json') {
            return res.json({ success: true, data });
        }

        const typeMap = {
            csv: 'text/csv; charset=utf-8',
            tsv: 'text/tab-separated-values; charset=utf-8',
            md: 'text/markdown; charset=utf-8',
            html: 'text/html; charset=utf-8',
        };

        res.setHeader('Content-Type', typeMap[format] || 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        return res.send(data);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getContentIntelligence(req, res) {
    try {
        const { startDate, endDate } = req.query;
        const analytics = await getAnalyticsService(req);
        const data = await analytics.getContentIntelligence(startDate, endDate);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Content Intel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getUnifiedOverview(req, res) {
    try {
        console.log('🌐 getUnifiedOverview called for user:', req.user?.userId);
        const { startDate, endDate } = req.query;

        // 1. Get all accounts for this user
        const accounts = await authService.getUserAccounts(req.user.userId);

        if (!accounts || accounts.length === 0) {
            return res.json({ success: true, data: { metrics: {}, accounts: [] } });
        }

        // 2. Fetch overview for each account in parallel
        const results = await Promise.allSettled(accounts.map(async (account) => {
            const service = new AnalyticsService(req.user.userId, account.instagram_user_id, account.id);
            await service.initialize();
            const overview = await service.getOverview(startDate, endDate);
            return {
                accountId: account.id,
                username: account.username,
                data: overview
            };
        }));

        // 3. Aggregate metrics
        const successfulResults = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

        const unifiedMetrics = {
            totalFollowers: 0,
            totalPosts: 0,
            totalImpressions: 0,
            totalReach: 0,
            totalSaved: 0,
            avgEngagementRate: 0,
            accountCount: successfulResults.length
        };

        let allRecentPosts = [];

        successfulResults.forEach(result => {
            const m = result.data.metrics;
            unifiedMetrics.totalFollowers += m.followers || 0;
            unifiedMetrics.totalPosts += m.posts || 0;
            unifiedMetrics.totalImpressions += m.totalImpressions || 0;
            unifiedMetrics.totalReach += m.totalReach || 0;
            unifiedMetrics.totalSaved += m.totalSaved || 0;
            unifiedMetrics.avgEngagementRate += m.engagementRate || 0;

            // Tag posts with account info
            const posts = (result.data.recentPosts || []).map(p => ({
                ...p,
                accountUsername: result.username
            }));
            allRecentPosts = [...allRecentPosts, ...posts];
        });

        if (unifiedMetrics.accountCount > 0) {
            unifiedMetrics.avgEngagementRate = parseFloat((unifiedMetrics.avgEngagementRate / unifiedMetrics.accountCount).toFixed(2));
        }

        // Sort posts by date
        allRecentPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            data: {
                metrics: unifiedMetrics,
                accounts: successfulResults.map(r => ({
                    id: r.accountId,
                    username: r.username,
                    metrics: r.data.metrics
                })),
                recentPosts: allRecentPosts.slice(0, 20)
            }
        });
    } catch (error) {
        console.error('❌ Unified overview error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

export default {
    getOverview,
    getGrowth,
    getBestTime,
    getHashtags,
    getReels,
    getPosts,
    exportData,
    getContentIntelligence,
    getUnifiedOverview
};

