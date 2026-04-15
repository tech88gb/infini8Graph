import supabase from '../config/database.js';
import InstagramService from './instagramService.js';
import { getAccessToken } from './authService.js';
import dotenv from 'dotenv';

dotenv.config();

const CACHE_TTL = {
    overview: parseInt(process.env.CACHE_TTL_OVERVIEW) || 300,
    growth: parseInt(process.env.CACHE_TTL_GROWTH) || 600,
    posts: parseInt(process.env.CACHE_TTL_POSTS) || 300,
    reels: parseInt(process.env.CACHE_TTL_REELS) || 300,
    stories: 300,
    best_time: 600,
    hashtags: 600
};

const MEDIA_FETCH_LIMITS = {
    overview: { ranged: 24, default: 18 },
    growth: { ranged: 36, default: 24 },
    bestTime: { ranged: 36, default: 24 },
    hashtags: { ranged: 40, default: 28 },
    contentIntel: { ranged: 36, default: 24 },
    postsAnalysis: { ranged: 30, default: 24 }
};

async function runWithConcurrency(tasks, limit = 2) {
    const outcomes = new Array(tasks.length);
    let cursor = 0;

    const worker = async () => {
        while (cursor < tasks.length) {
            const index = cursor++;
            try {
                outcomes[index] = { status: 'fulfilled', value: await tasks[index]() };
            } catch (error) {
                outcomes[index] = { status: 'rejected', reason: error };
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
    return outcomes;
}

/**
 * Analytics Service
 * Handles KPI calculations, caching, and data aggregation
 */
class AnalyticsService {
    constructor(userId, instagramUserId, instagramAccountId = null) {
        this.userId = userId;
        this.instagramUserId = instagramUserId;
        this.instagramAccountId = instagramAccountId;
        this.instagram = null;
    }

    /**
     * Initialize Instagram service with access token
     */
    async initialize() {
        const accessToken = await getAccessToken(this.userId, this.instagramAccountId);
        if (!accessToken) {
            throw new Error('No valid access token found. Please re-authenticate.');
        }
        this.instagram = new InstagramService(accessToken, this.instagramUserId);
        return this;
    }

    /**
     * Check cache for existing data
     */
    async checkCache(metricType, dateRange = 'current') {
        try {
            const { data, error } = await supabase
                .from('analytics_cache')
                .select('aggregated_data, last_fetched_at')
                .eq('user_id', this.userId)
                .eq('instagram_account_id', this.instagramAccountId)
                .eq('metric_type', metricType)
                .eq('date_range', dateRange)
                .single();

            if (error || !data) return null;

            // Check if cache is still valid
            const lastFetched = new Date(data.last_fetched_at);
            const now = new Date();
            const ageSeconds = (now - lastFetched) / 1000;
            const ttl = CACHE_TTL[metricType] || 300;

            if (ageSeconds > ttl) {
                return null; // Cache expired
            }

            return data.aggregated_data;
        } catch (error) {
            console.error('Cache check error:', error);
            return null;
        }
    }

    /**
     * Update cache with new data
     */
    async updateCache(metricType, dateRange, data) {
        try {
            await supabase
                .from('analytics_cache')
                .upsert({
                    user_id: this.userId,
                    instagram_account_id: this.instagramAccountId,
                    metric_type: metricType,
                    date_range: dateRange,
                    aggregated_data: data,
                    last_fetched_at: new Date().toISOString()
                }, {
                    onConflict: 'instagram_account_id,metric_type,date_range'
                });
        } catch (error) {
            console.error('Cache update error:', error);
        }
    }

    toPercent(numerator, denominator, decimals = 2) {
        if (!denominator || denominator <= 0) return 0;
        return Number(((numerator / denominator) * 100).toFixed(decimals));
    }

    averageValue(values = [], decimals = 2) {
        if (!Array.isArray(values) || values.length === 0) return 0;
        const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
        return Number((total / values.length).toFixed(decimals));
    }

    parseInsightMetricValue(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        if (value && typeof value === 'object') {
            if (typeof value.value === 'number') return value.value;
            if (typeof value.count === 'number') return value.count;
        }
        return 0;
    }

    getMetricRowByName(rows = [], metricName) {
        if (!Array.isArray(rows)) return null;
        return rows.find((row) => row?.name === metricName) || null;
    }

    buildAccountInsightWindows(startDate = null, endDate = null) {
        if (!startDate && !endDate) {
            return [{ since: null, until: null, startDate: null, endDate: null }];
        }

        const requestedStart = new Date(`${startDate || endDate}T00:00:00Z`);
        const requestedEnd = new Date(`${endDate || startDate}T23:59:59Z`);
        const rangeStart = requestedStart <= requestedEnd ? requestedStart : requestedEnd;
        const rangeEnd = requestedStart <= requestedEnd ? requestedEnd : requestedStart;
        const windows = [];
        let cursor = new Date(rangeStart);

        while (cursor <= rangeEnd) {
            const windowStart = new Date(cursor);
            const windowEnd = new Date(Date.UTC(
                windowStart.getUTCFullYear(),
                windowStart.getUTCMonth(),
                windowStart.getUTCDate() + 29,
                23,
                59,
                59
            ));
            const cappedEnd = windowEnd < rangeEnd ? windowEnd : new Date(rangeEnd);

            windows.push({
                since: Math.floor(windowStart.getTime() / 1000),
                until: Math.floor(cappedEnd.getTime() / 1000),
                startDate: windowStart.toISOString().split('T')[0],
                endDate: cappedEnd.toISOString().split('T')[0]
            });

            cursor = new Date(cappedEnd.getTime() + 1000);
        }

        return windows;
    }

    parseFollowBreakdown(metricRow) {
        const rows = metricRow?.total_value?.breakdowns?.[0]?.results || [];
        const totals = { follows: 0, unfollows: 0 };

        rows.forEach((row) => {
            const key = String(row?.dimension_values?.[0] || '').toLowerCase();
            const value = this.parseInsightMetricValue(row?.value);

            // Meta currently returns FOLLOWER / NON_FOLLOWER buckets here.
            // Based on live responses, the non-follower bucket behaves like unfollows/leaves.
            if (key.includes('non') || key.includes('unfollow') || key.includes('leave')) {
                totals.unfollows += value;
            } else {
                totals.follows += value;
            }
        });

        return totals;
    }

    buildFollowerTrendFromDailyMetrics(dailyMetrics = [], fallbackAggregates = {}, currentFollowerCount = 0) {
        const snapshots = (dailyMetrics || [])
            .filter((day) => typeof day?.follower_count === 'number' && Number.isFinite(day.follower_count))
            .sort((a, b) => a.date.localeCompare(b.date));

        const maxSnapshotValue = snapshots.reduce((max, day) => Math.max(max, Number(day.follower_count || 0)), 0);
        const looksLikeAbsoluteFollowerBase = currentFollowerCount <= 0
            ? maxSnapshotValue > 0
            : maxSnapshotValue >= currentFollowerCount * 0.5;

        if (snapshots.length >= 2 && looksLikeAbsoluteFollowerBase) {
            const first = snapshots[0];
            const last = snapshots[snapshots.length - 1];
            const delta = Number(last.follower_count || 0) - Number(first.follower_count || 0);

            return {
                start: Number(first.follower_count || 0),
                end: Number(last.follower_count || 0),
                delta,
                deltaPercent: this.toPercent(delta, Number(first.follower_count || 0)),
                follows: fallbackAggregates.follows || 0,
                unfollows: fallbackAggregates.unfollows || 0,
                source: 'daily_snapshots'
            };
        }

        const fallbackDelta = Number(fallbackAggregates.followerDelta || 0);
        const fallbackEnd = snapshots.length === 1
            ? Number(snapshots[0].follower_count || 0)
            : Number(fallbackAggregates.followerEnd || 0);
        const fallbackStart = Math.max(fallbackEnd - fallbackDelta, 0);

        return {
            start: fallbackStart,
            end: fallbackEnd,
            delta: fallbackDelta,
            deltaPercent: this.toPercent(fallbackDelta, fallbackStart),
            follows: fallbackAggregates.follows || 0,
            unfollows: fallbackAggregates.unfollows || 0,
            source: 'aggregates_fallback'
        };
    }

    async getAccountAggregateMetrics(startDate = null, endDate = null) {
        const windows = this.buildAccountInsightWindows(startDate, endDate);
        const aggregates = {
            totalViews: 0,
            totalProfileViews: 0,
            follows: 0,
            unfollows: 0,
            followerDelta: 0
        };

        for (const window of windows) {
            const [visibilityResult, followsResult] = await Promise.allSettled([
                this.instagram.getAccountInsights(
                    'day',
                    ['views', 'profile_views'],
                    window.since,
                    window.until,
                    'total_value'
                ),
                this.instagram.getAccountInsights(
                    'day',
                    ['follows_and_unfollows'],
                    window.since,
                    window.until,
                    'total_value',
                    { breakdown: 'follow_type' }
                )
            ]);

            if (visibilityResult.status === 'fulfilled') {
                const rows = visibilityResult.value?.data || [];
                const viewsRow = this.getMetricRowByName(rows, 'views');
                const profileViewsRow = this.getMetricRowByName(rows, 'profile_views');
                aggregates.totalViews += this.parseInsightMetricValue(viewsRow?.total_value);
                aggregates.totalProfileViews += this.parseInsightMetricValue(profileViewsRow?.total_value);
            } else {
                console.warn(
                    `[getAccountAggregateMetrics] visibility failed for ${window.startDate || 'default'}-${window.endDate || 'default'}:`,
                    visibilityResult.reason?.message || visibilityResult.reason
                );
            }

            if (followsResult.status === 'fulfilled') {
                const followsRow = this.getMetricRowByName(followsResult.value?.data || [], 'follows_and_unfollows');
                const followBreakdown = this.parseFollowBreakdown(followsRow);
                aggregates.follows += followBreakdown.follows;
                aggregates.unfollows += followBreakdown.unfollows;
            } else {
                console.warn(
                    `[getAccountAggregateMetrics] follows_and_unfollows failed for ${window.startDate || 'default'}-${window.endDate || 'default'}:`,
                    followsResult.reason?.message || followsResult.reason
                );
            }
        }

        aggregates.followerDelta = aggregates.follows - aggregates.unfollows;
        return aggregates;
    }

    normaliseSeries(values = []) {
        const numericValues = values.map((value) => Number(value || 0));
        const max = Math.max(...numericValues, 0);
        if (max <= 0) return numericValues.map(() => 0);
        return numericValues.map((value) => value / max);
    }

    buildOnlineFollowersSummary(onlineFollowers = []) {
        if (!Array.isArray(onlineFollowers) || onlineFollowers.length === 0) {
            return { peakHours: [], averageValue: 0 };
        }

        const hourly = onlineFollowers.map((entry, index) => {
            const rawValue = typeof entry?.value === 'number'
                ? entry.value
                : typeof entry === 'number'
                    ? entry
                    : 0;

            const endTime = entry?.end_time ? new Date(entry.end_time) : null;
            const hour = endTime && !Number.isNaN(endTime.getTime()) ? endTime.getHours() : index;

            return {
                hour,
                label: `${String(hour).padStart(2, '0')}:00`,
                value: Number(rawValue || 0)
            };
        });

        const peakHours = [...hourly]
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);

        return {
            peakHours,
            averageValue: this.averageValue(hourly.map((entry) => entry.value))
        };
    }

    /**
     * Get overview analytics (dashboard main metrics)
     */
    async getOverview(startDate = null, endDate = null) {
        // Build a cache key that includes the dates
        const dateKey = `v5_core_${startDate || 'default'}_${endDate || 'default'}`;
        
        // Check cache first
        const cached = await this.checkCache('overview', dateKey);
        if (cached) return cached;

        // Fetch profile first (most basic permission)
        let profile;
        try {
            profile = await this.instagram.getProfile();
        } catch (profileError) {
            throw new Error('Cannot fetch Instagram profile. Please re-authenticate with the required permissions.');
        }

        // Fetch only the fast overview essentials here.
        // Audience demographics are loaded separately so the dashboard can paint sooner.
        let media = [];
        let dailyMetrics = [];
        let accountAggregates = {
            totalViews: 0,
            totalProfileViews: 0,
            follows: 0,
            unfollows: 0,
            followerDelta: 0
        };
        const fetchLimit = (startDate || endDate)
            ? MEDIA_FETCH_LIMITS.overview.ranged
            : MEDIA_FETCH_LIMITS.overview.default;
        const overviewTasks = [
            async () => {
                const fetchedMedia = await this.instagram.getAllMediaWithInsights(fetchLimit, {
                    includeDetailedVideoInsights: false,
                    fetchShares: true
                });
                return this.filterMediaByDate(fetchedMedia, startDate, endDate);
            },
            async () => this.getDailyAccountMetrics(startDate, endDate),
            async () => this.getAccountAggregateMetrics(startDate, endDate)
        ];

        const [mediaResult, dailyMetricsResult, accountAggregatesResult] = await runWithConcurrency(overviewTasks, 3);

        if (mediaResult.status === 'fulfilled') {
            media = mediaResult.value;
        } else {
            console.warn('Overview media fetch failed:', mediaResult.reason?.message || mediaResult.reason);
        }

        if (dailyMetricsResult.status === 'fulfilled') {
            dailyMetrics = dailyMetricsResult.value || [];
        } else {
            console.warn('Overview account insights fetch failed:', dailyMetricsResult.reason?.message || dailyMetricsResult.reason);
        }

        if (accountAggregatesResult.status === 'fulfilled') {
            accountAggregates = accountAggregatesResult.value || accountAggregates;
        } else {
            console.warn('Overview aggregate account insights fetch failed:', accountAggregatesResult.reason?.message || accountAggregatesResult.reason);
        }

        // Calculate engagement rate
        const totalEngagement = media.reduce((sum, post) => sum + post.engagement, 0);
        const avgEngagement = media.length > 0 ? totalEngagement / media.length : 0;
        const engagementRate = profile.followers_count > 0
            ? (avgEngagement / profile.followers_count * 100).toFixed(2)
            : 0;

        // Calculate metrics
        const mediaImpressions = media.reduce((sum, post) => sum + post.impressions, 0);
        const mediaReach = media.reduce((sum, post) => sum + post.reach, 0);
        const totalLikes = media.reduce((sum, post) => sum + post.likeCount, 0);
        const totalComments = media.reduce((sum, post) => sum + post.commentsCount, 0);
        const totalSaved = media.reduce((sum, post) => sum + post.saved, 0);
        const totalShares = media.reduce((sum, post) => sum + (post.shares || 0), 0);
        const accountLevelReach = dailyMetrics.reduce((sum, day) => sum + Number(day.reach || 0), 0);
        const totalImpressions = accountAggregates.totalViews || mediaImpressions;
        const totalReach = accountLevelReach || mediaReach;
        const totalProfileViews = accountAggregates.totalProfileViews || 0;
        const avgShares = Math.round(totalShares / Math.max(media.length, 1));
        const followerTrend = this.buildFollowerTrendFromDailyMetrics(dailyMetrics, {
            ...accountAggregates,
            followerEnd: profile.followers_count || 0
        }, profile.followers_count || 0);

        // Get recent posts performance
        const recentPosts = media.slice(0, 10).map(post => ({
            id: post.id,
            type: post.mediaType,
            caption: post.caption || '',
            likes: post.likeCount,
            comments: post.commentsCount,
            engagement: post.engagement,
            saved: post.saved,
            shares: post.shares || 0,
            reach: post.reach,
            impressions: post.impressions,
            saveRate: this.toPercent(post.saved, post.reach),
            engagementRate: this.toPercent(post.engagement, post.reach),
            timestamp: post.timestamp,
            thumbnailUrl: post.thumbnailUrl || post.mediaUrl
        }));

        const overview = {
            profile: {
                username: profile.username,
                name: profile.name,
                profilePictureUrl: profile.profile_picture_url,
                biography: profile.biography,
                website: profile.website
            },
            metrics: {
                followers: profile.followers_count,
                following: profile.follows_count,
                posts: profile.media_count,
                engagementRate: parseFloat(engagementRate),
                avgLikes: Math.round(totalLikes / Math.max(media.length, 1)),
                avgComments: Math.round(totalComments / Math.max(media.length, 1)),
                avgShares,
                totalImpressions,
                totalReach,
                totalSaved,
                totalShares,
                totalProfileViews,
                followerDelta: followerTrend.delta,
                followerDeltaPercent: followerTrend.deltaPercent,
                // === Advanced Metrics ===
                // True Follower Growth Rate: new followers / start followers * 100
                trueFollowerGrowthRate: followerTrend.start > 0
                    ? Number(((followerTrend.delta / followerTrend.start) * 100).toFixed(2))
                    : 0,
                // Content ROI Score: total engagement / posts published in period
                contentRoiScore: media.length > 0
                    ? Number((totalEngagement / media.length).toFixed(1))
                    : 0,
                // Reach-to-Follower Ratio: total reach / followers (breakout signal)
                reachToFollowerRatio: profile.followers_count > 0
                    ? Number((totalReach / profile.followers_count).toFixed(2))
                    : 0,
                // Save Rate: saves / reach * 100 (high saves = evergreen content signal)
                saveRate: totalReach > 0
                    ? Number(((totalSaved / totalReach) * 100).toFixed(2))
                    : 0,
                // Profile Visit Rate: profile_views / reach * 100
                profileVisitRate: totalReach > 0
                    ? Number(((totalProfileViews / totalReach) * 100).toFixed(2))
                    : 0
            },
            demographics: {},
            audienceInsights: {},
            followerTrend,
            recentPosts,
            dailyMetrics,
            lastUpdated: new Date().toISOString()
        };

        // Cache the result with the specific date range
        await this.updateCache('overview', dateKey, overview);

        return overview;
    }

    async getOverviewAudience(startDate = null, endDate = null) {
        const dateKey = `v1_audience_${startDate || 'default'}_${endDate || 'default'}`;
        const cached = await this.checkCache('overview', dateKey);
        if (cached) return cached;

        let demographics = {};
        try {
            demographics = await this.instagram.getFollowerDemographics();
        } catch (error) {
            console.warn('Overview audience fetch failed:', error.message);
        }

        const onlineFollowerSummary = this.buildOnlineFollowersSummary(demographics.onlineFollowers || []);

        const audience = {
            demographics: demographics || {},
            audienceInsights: {
                topCountry: demographics.countries?.[0]
                    ? {
                        label: demographics.countries[0].dimension_values?.[0] || 'Unknown',
                        value: demographics.countries[0].value || 0
                    }
                    : null,
                topCity: demographics.cities?.[0]
                    ? {
                        label: demographics.cities[0].dimension_values?.[0] || 'Unknown',
                        value: demographics.cities[0].value || 0
                    }
                    : null,
                topGenderAge: demographics.genderAge?.[0]
                    ? {
                        gender: demographics.genderAge[0].dimension_values?.[0] || '',
                        age: demographics.genderAge[0].dimension_values?.[1] || '',
                        value: demographics.genderAge[0].value || 0
                    }
                    : null,
                peakFollowerHours: onlineFollowerSummary.peakHours,
                onlineFollowerAverage: onlineFollowerSummary.averageValue
            },
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('overview', dateKey, audience);
        return audience;
    }

    /**
     * Get growth analytics
     */
    async getGrowth(startDate = null, endDate = null) {
        const dateKey = `v4_${startDate || 'default'}_${endDate || 'default'}`;
        const cached = await this.checkCache('growth', dateKey);
        if (cached) return cached;

        const profile = await this.instagram.getProfile();
        const fetchLimit = (startDate || endDate)
            ? MEDIA_FETCH_LIMITS.growth.ranged
            : MEDIA_FETCH_LIMITS.growth.default;
        let media = [];
        let accountMetrics = [];
        let accountAggregates = {
            totalViews: 0,
            totalProfileViews: 0,
            follows: 0,
            unfollows: 0,
            followerDelta: 0
        };
        const growthTasks = [
            async () => {
                const fetchedMedia = await this.instagram.getAllMediaWithInsights(fetchLimit, {
                    includeDetailedVideoInsights: false,
                    fetchShares: false
                });
                return this.filterMediaByDate(fetchedMedia, startDate, endDate);
            },
            async () => this.getDailyAccountMetrics(startDate, endDate),
            async () => this.getAccountAggregateMetrics(startDate, endDate)
        ];

        const [mediaResult, metricsResult, aggregatesResult] = await runWithConcurrency(growthTasks, 3);

        if (mediaResult.status === 'fulfilled') {
            media = mediaResult.value || [];
        } else {
            console.warn('Growth media fetch failed:', mediaResult.reason?.message || mediaResult.reason);
        }

        if (metricsResult.status === 'fulfilled') {
            accountMetrics = metricsResult.value || [];
        } else {
            console.warn('Growth account insights fetch failed:', metricsResult.reason?.message || metricsResult.reason);
        }

        if (aggregatesResult.status === 'fulfilled') {
            accountAggregates = aggregatesResult.value || accountAggregates;
        } else {
            console.warn('Growth aggregate account insights fetch failed:', aggregatesResult.reason?.message || aggregatesResult.reason);
        }

        // Group posts by date for growth analysis
        const postsByDate = {};
        const engagementByDate = {};

        media.forEach(post => {
            const date = new Date(post.timestamp).toISOString().split('T')[0];
            if (!postsByDate[date]) {
                postsByDate[date] = 0;
                engagementByDate[date] = { likes: 0, comments: 0, total: 0 };
            }
            postsByDate[date]++;
            engagementByDate[date].likes += post.likeCount;
            engagementByDate[date].comments += post.commentsCount;
            engagementByDate[date].total += post.engagement;
        });

        const accountMetricsByDate = Object.fromEntries(accountMetrics.map((day) => [day.date, day]));
        const dates = [...new Set([...Object.keys(postsByDate), ...accountMetrics.map((day) => day.date)])].sort();
        const growthData = dates.map(date => ({
            date,
            posts: postsByDate[date] || 0,
            engagement: engagementByDate[date]?.total || 0,
            likes: engagementByDate[date]?.likes || 0,
            comments: engagementByDate[date]?.comments || 0,
            followerCount: Number(accountMetricsByDate[date]?.follower_count || 0),
            reach: Number(accountMetricsByDate[date]?.reach || 0),
            impressions: Number(accountMetricsByDate[date]?.impressions || 0),
            profileViews: Number(accountMetricsByDate[date]?.profile_views || 0)
        }));

        // Calculate week-over-week changes
        const thisWeekPosts = media.filter(p => {
            const postDate = new Date(p.timestamp);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return postDate >= weekAgo;
        });

        const lastWeekPosts = media.filter(p => {
            const postDate = new Date(p.timestamp);
            const weekAgo = new Date();
            const twoWeeksAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            return postDate >= twoWeeksAgo && postDate < weekAgo;
        });

        const thisWeekEngagement = thisWeekPosts.reduce((sum, p) => sum + p.engagement, 0);
        const lastWeekEngagement = lastWeekPosts.reduce((sum, p) => sum + p.engagement, 0);
        const engagementChange = lastWeekEngagement > 0
            ? ((thisWeekEngagement - lastWeekEngagement) / lastWeekEngagement * 100).toFixed(1)
            : 0;

        const followerTrend = this.buildFollowerTrendFromDailyMetrics(accountMetrics, {
            ...accountAggregates,
            followerEnd: profile.followers_count || 0
        }, profile.followers_count || 0);
        const followerDelta = followerTrend.delta || 0;
        const followerEnd = followerTrend.end || profile.followers_count || 0;
        const followerStart = followerTrend.start || 0;

        const totalPostsInWindow = media.length;
        const totalReach = accountMetrics.reduce((sum, day) => sum + Number(day.reach || 0), 0);
        const totalImpressions = accountAggregates.totalViews || 0;
        const totalProfileViews = accountAggregates.totalProfileViews || 0;

        const growth = {
            currentFollowers: profile.followers_count,
            currentFollowing: profile.follows_count,
            totalPosts: profile.media_count,
            growthData,
            accountMetrics,
            accountSummary: {
                totalReach,
                totalImpressions,
                totalProfileViews,
                avgDailyReach: accountMetrics.length > 0
                    ? Math.round(totalReach / accountMetrics.length)
                    : 0,
                avgDailyImpressions: accountMetrics.length > 0
                    ? Math.round(totalImpressions / accountMetrics.length)
                    : 0,
                avgDailyProfileViews: accountMetrics.length > 0
                    ? Math.round(totalProfileViews / accountMetrics.length)
                    : 0,
                followerStart,
                followerEnd,
                followerDelta,
                followerDeltaPercent: followerTrend.deltaPercent,
                followersGained: followerTrend.follows || 0,
                unfollows: followerTrend.unfollows || 0,
                // === Advanced Growth Metrics ===
                // True Follower Growth Rate: (new followers / start) * 100 in the period
                trueFollowerGrowthRate: followerStart > 0
                    ? Number(((followerDelta / followerStart) * 100).toFixed(2))
                    : 0,
                // Net Follower Change (gained − lost; we have delta from daily snapshots)
                netFollowerChange: followerDelta,
                // Audience Quality Score: (likes + comments + saves) / followers
                audienceQualityScore: profile.followers_count > 0
                    ? Number((
                        media.reduce((sum, p) => sum + p.likeCount + p.commentsCount + (p.saved || 0), 0)
                        / profile.followers_count
                      ).toFixed(3))
                    : 0
            },
            comparisonSummary: {
                avgPostsPerActiveDay: growthData.filter((day) => day.posts > 0).length > 0
                    ? Number((totalPostsInWindow / growthData.filter((day) => day.posts > 0).length).toFixed(2))
                    : 0,
                avgReachPerPost: totalPostsInWindow > 0 ? Math.round(totalReach / totalPostsInWindow) : 0,
                avgProfileViewsPerPost: totalPostsInWindow > 0 ? Math.round(totalProfileViews / totalPostsInWindow) : 0,
                profileViewRateFromReach: this.toPercent(totalProfileViews, totalReach),
                impressionsPerReach: totalReach > 0 ? Number((totalImpressions / totalReach).toFixed(2)) : 0
            },
            weeklyStats: {
                postsThisWeek: thisWeekPosts.length,
                engagementThisWeek: thisWeekEngagement,
                engagementChange: parseFloat(engagementChange),
                avgEngagementPerPost: thisWeekPosts.length > 0
                    ? Math.round(thisWeekEngagement / thisWeekPosts.length)
                    : 0
            },
            // === Follower-to-Engagement Ratio Trend (weekly buckets) ===
            // Declining ratio over time = audience getting stale
            followerEngagementRatioTrend: (() => {
                const weeks = {};
                media.forEach((post) => {
                    const d = new Date(post.timestamp);
                    const weekStart = new Date(d);
                    weekStart.setDate(d.getDate() - d.getDay());
                    const wk = weekStart.toISOString().split('T')[0];
                    if (!weeks[wk]) weeks[wk] = { week: wk, engagement: 0, posts: 0 };
                    weeks[wk].engagement += post.engagement;
                    weeks[wk].posts += 1;
                });
                return Object.values(weeks)
                    .sort((a, b) => a.week.localeCompare(b.week))
                    .map((wk) => ({
                        week: wk.week,
                        posts: wk.posts,
                        totalEngagement: wk.engagement,
                        followerEngagementRatio: profile.followers_count > 0
                            ? Number((wk.engagement / profile.followers_count).toFixed(4))
                            : 0
                    }));
            })(),
            // === Post-to-Follower Growth Correlation ===
            // Cross-reference posting days with follower change (from daily snapshots)
                postToFollowerGrowthCorrelation: (() => {
                    const postingDates = new Set(media.map((p) => p.timestamp.split('T')[0]));
                    return accountMetrics
                        .filter((day) => typeof day.follower_count === 'number')
                        .map((day) => ({
                            date: day.date,
                            hadPost: postingDates.has(day.date),
                            followerChange: day.follower_count || 0
                        }));
                })(),
                lastUpdated: new Date().toISOString()
            };

        await this.updateCache('growth', dateKey, growth);
        return growth;
    }

    /**
     * Get best time to post analysis
     */
    async getBestTimeToPost(startDate = null, endDate = null) {
        const dateKey = `${startDate || 'default'}_${endDate || 'default'}`;
        const cached = await this.checkCache('best_time', dateKey);
        if (cached) return cached;

        // Fetch more to ensure we have enough after filtering
        const fetchLimit = (startDate || endDate)
            ? MEDIA_FETCH_LIMITS.bestTime.ranged
            : MEDIA_FETCH_LIMITS.bestTime.default;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit, {
            fetchShares: true
        });
        media = this.filterMediaByDate(media, startDate, endDate);

        const hourlyStats = {};
        const dailyStats = {};
        for (let i = 0; i < 24; i++) {
            hourlyStats[i] = { hour: i, postCount: 0, totalEngagement: 0, totalReach: 0, totalSaved: 0, totalComments: 0, totalShares: 0 };
        }

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach((day) => {
            dailyStats[day] = { day, postCount: 0, totalEngagement: 0, totalReach: 0, totalSaved: 0, totalComments: 0, totalShares: 0 };
        });

        media.forEach((post) => {
            const timestamp = new Date(post.timestamp);
            const hour = timestamp.getHours();
            const day = days[timestamp.getDay()];

            hourlyStats[hour].postCount += 1;
            hourlyStats[hour].totalEngagement += post.engagement || 0;
            hourlyStats[hour].totalReach += post.reach || 0;
            hourlyStats[hour].totalSaved += post.saved || 0;
            hourlyStats[hour].totalComments += post.commentsCount || 0;
            hourlyStats[hour].totalShares += post.shares || 0;

            dailyStats[day].postCount += 1;
            dailyStats[day].totalEngagement += post.engagement || 0;
            dailyStats[day].totalReach += post.reach || 0;
            dailyStats[day].totalSaved += post.saved || 0;
            dailyStats[day].totalComments += post.commentsCount || 0;
            dailyStats[day].totalShares += post.shares || 0;
        });

        const buildPerformanceRows = (rows, keyField) => {
            const baseRows = rows.map((row) => ({
                ...row,
                avgEngagement: row.postCount > 0 ? Math.round(row.totalEngagement / row.postCount) : 0,
                avgReach: row.postCount > 0 ? Math.round(row.totalReach / row.postCount) : 0,
                avgSaveRate: this.toPercent(row.totalSaved, row.totalReach),
                avgCommentRate: this.toPercent(row.totalComments, row.totalReach),
                avgShareRate: this.toPercent(row.totalShares, row.totalReach),
                avgEngagementRate: this.toPercent(row.totalEngagement, row.totalReach),
            }));

            const engagementNorm = this.normaliseSeries(baseRows.map((row) => row.avgEngagement));
            const reachNorm = this.normaliseSeries(baseRows.map((row) => row.avgReach));
            const saveNorm = this.normaliseSeries(baseRows.map((row) => row.avgSaveRate));
            const commentNorm = this.normaliseSeries(baseRows.map((row) => row.avgCommentRate));
            const shareNorm = this.normaliseSeries(baseRows.map((row) => row.avgShareRate));

            return baseRows.map((row, index) => ({
                ...row,
                performanceScore: Math.round(
                    (engagementNorm[index] * 35) +
                    (reachNorm[index] * 20) +
                    (saveNorm[index] * 20) +
                    (commentNorm[index] * 15) +
                    (shareNorm[index] * 10)
                ),
                [keyField]: row[keyField]
            }));
        };

        const hourlyAvg = buildPerformanceRows(Object.values(hourlyStats), 'hour');
        const dailyAvg = buildPerformanceRows(days.map((day) => dailyStats[day]), 'day');

        const sortedHours = [...hourlyAvg].sort((a, b) => b.performanceScore - a.performanceScore);
        const sortedDays = [...dailyAvg].sort((a, b) => b.performanceScore - a.performanceScore);

        const bestTime = {
            hourlyAnalysis: hourlyAvg,
            dailyAnalysis: dailyAvg,
            recommendations: {
                bestHours: sortedHours.slice(0, 3).map(h => h.hour),
                bestDays: sortedDays.slice(0, 3).map(d => d.day),
                optimalPostingTimes: sortedHours.slice(0, 3).map(h => ({
                    hour: h.hour,
                    score: h.performanceScore,
                    engagement: h.avgEngagement,
                    reach: h.avgReach,
                    saveRate: h.avgSaveRate,
                    formatted: `${h.hour.toString().padStart(2, '0')}:00`
                }))
            },
            insights: {
                strongestHour: sortedHours[0] || null,
                weakestHour: sortedHours[sortedHours.length - 1] || null,
                strongestDay: sortedDays[0] || null
            },
            postsAnalyzed: media.length,
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('best_time', dateKey, bestTime);
        return bestTime;
    }

    /**
     * Get hashtag performance analysis
     */
    async getHashtagAnalysis(startDate = null, endDate = null) {
        const dateKey = `${startDate || 'default'}_${endDate || 'default'}`;
        const cached = await this.checkCache('hashtags', dateKey);
        if (cached) return cached;

        // Fetch more to ensure we have enough after filtering
        const fetchLimit = (startDate || endDate)
            ? MEDIA_FETCH_LIMITS.hashtags.ranged
            : MEDIA_FETCH_LIMITS.hashtags.default;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit, {
            fetchShares: false
        });
        media = this.filterMediaByDate(media, startDate, endDate);

        // Extract hashtags from captions
        const hashtagStats = {};
        const overallAvgEngagement = media.length > 0
            ? media.reduce((sum, post) => sum + post.engagement, 0) / media.length
            : 0;

        media.forEach(post => {
            const hashtags = (post.caption || '').match(/#\w+/g) || [];
            const attributionWeight = hashtags.length > 0 ? 1 / hashtags.length : 0;
            hashtags.forEach(tag => {
                const normalizedTag = tag.toLowerCase();
                if (!hashtagStats[normalizedTag]) {
                    hashtagStats[normalizedTag] = {
                        tag: normalizedTag,
                        usageCount: 0,
                        totalEngagement: 0,
                        totalLikes: 0,
                        totalComments: 0,
                        totalAttributedEngagement: 0,
                        totalAttributedLikes: 0,
                        totalAttributedComments: 0,
                        posts: []
                    };
                }
                hashtagStats[normalizedTag].usageCount++;
                hashtagStats[normalizedTag].totalEngagement += post.engagement;
                hashtagStats[normalizedTag].totalLikes += post.likeCount;
                hashtagStats[normalizedTag].totalComments += post.commentsCount;
                hashtagStats[normalizedTag].totalAttributedEngagement += post.engagement * attributionWeight;
                hashtagStats[normalizedTag].totalAttributedLikes += post.likeCount * attributionWeight;
                hashtagStats[normalizedTag].totalAttributedComments += post.commentsCount * attributionWeight;
                hashtagStats[normalizedTag].posts.push(post.id);
            });
        });

        const overallAvgReach = media.length > 0
            ? media.reduce((sum, post) => sum + post.reach, 0) / media.length
            : 0;

        // Calculate averages and sort
        const hashtagList = Object.values(hashtagStats)
            .map(h => ({
                ...h
            }))
            .map((h) => {
                const postsWithTag = media
                    .filter((post) => (post.caption || '').toLowerCase().includes(h.tag))
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const avgReach = postsWithTag.length > 0
                    ? postsWithTag.reduce((sum, post) => sum + post.reach, 0) / postsWithTag.length
                    : 0;
                const aboveAverageCount = postsWithTag.filter((post) => post.engagement >= overallAvgEngagement).length;
                const splitIndex = Math.ceil(postsWithTag.length / 2);
                const earlyPosts = postsWithTag.slice(0, splitIndex);
                const recentPosts = postsWithTag.slice(splitIndex);
                const earlyAvgEngagement = earlyPosts.length > 0
                    ? earlyPosts.reduce((sum, post) => sum + post.engagement, 0) / earlyPosts.length
                    : 0;
                const recentAvgEngagement = recentPosts.length > 0
                    ? recentPosts.reduce((sum, post) => sum + post.engagement, 0) / recentPosts.length
                    : earlyAvgEngagement;

                return {
                    ...h,
                    avgEngagement: Math.round(h.totalAttributedEngagement / h.usageCount),
                    avgLikes: Math.round(h.totalAttributedLikes / h.usageCount),
                    avgComments: Math.round(h.totalAttributedComments / h.usageCount),
                    engagementLift: overallAvgEngagement > 0
                        ? Number((((h.totalAttributedEngagement / h.usageCount) / overallAvgEngagement - 1) * 100).toFixed(1))
                        : 0,
                    avgReach: Math.round(avgReach),
                    reachLift: overallAvgReach > 0
                        ? Number((((avgReach / overallAvgReach) - 1) * 100).toFixed(1))
                        : 0,
                    reachMultiplier: overallAvgReach > 0 ? Number((avgReach / overallAvgReach).toFixed(2)) : 0,
                    consistencyScore: postsWithTag.length > 0
                        ? Number(((aboveAverageCount / postsWithTag.length) * 100).toFixed(1))
                        : 0,
                    earlyAvgEngagement: Math.round(earlyAvgEngagement),
                    recentAvgEngagement: Math.round(recentAvgEngagement),
                    diminishingReturn: earlyAvgEngagement > 0
                        ? Number((((recentAvgEngagement - earlyAvgEngagement) / earlyAvgEngagement) * 100).toFixed(1))
                        : 0
                };
            })
            .sort((a, b) => b.avgEngagement - a.avgEngagement);

        const hashtagReachAttribution = hashtagList.map(h => ({
                tag: h.tag,
                avgReach: h.avgReach,
                reachMultiplier: h.reachMultiplier,
                reachLift: h.reachLift,
                usageCount: h.usageCount,
                consistencyScore: h.consistencyScore
            }))
            .sort((a, b) => b.reachMultiplier - a.reachMultiplier);

        const hashtags = {
            topPerforming: hashtagList.slice(0, 20),
            mostUsed: [...hashtagList].sort((a, b) => b.usageCount - a.usageCount).slice(0, 20),
            reachExpanders: hashtagReachAttribution.filter(h => h.reachMultiplier > 1).slice(0, 10),
            consistencyLeaders: [...hashtagList].sort((a, b) => b.consistencyScore - a.consistencyScore).slice(0, 10),
            fatigueSignals: [...hashtagList]
                .filter((tag) => tag.usageCount >= 3 && tag.diminishingReturn < 0)
                .sort((a, b) => a.diminishingReturn - b.diminishingReturn)
                .slice(0, 10),
            totalHashtagsUsed: hashtagList.length,
            avgHashtagsPerPost: media.length > 0
                ? (hashtagList.reduce((sum, h) => sum + h.usageCount, 0) / media.length).toFixed(1)
                : 0,
            postsAnalyzed: media.length,
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('hashtags', dateKey, hashtags);
        return hashtags;
    }

    /**
     * Get deep content intelligence metrics
     * Includes: format battle, caption analysis, viral coefficient, save-to-like ratio
     */
    async getContentIntelligence(startDate = null, endDate = null) {
        const dateKey = `${startDate || 'default'}_${endDate || 'default'}`;
        const cached = await this.checkCache('content_intelligence', dateKey);
        if (cached) return cached;

        const profile = await this.instagram.getProfile();
        const fetchLimit = (startDate || endDate)
            ? MEDIA_FETCH_LIMITS.contentIntel.ranged
            : MEDIA_FETCH_LIMITS.contentIntel.default;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit, {
            includeDetailedVideoInsights: false,
            fetchShares: true
        });
        media = this.filterMediaByDate(media, startDate, endDate);

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const enrichedPosts = media.map((post) => {
            const timestamp = new Date(post.timestamp);
            return {
                ...post,
                type: post.mediaType,
                captionLength: (post.caption || '').length,
                postingHour: timestamp.getHours(),
                postingDay: days[timestamp.getDay()],
                engagementRate: this.toPercent(post.engagement, post.reach),
                saveRate: this.toPercent(post.saved, post.reach),
                shareRate: this.toPercent(post.shares || 0, post.reach),
                commentRate: this.toPercent(post.commentsCount, post.reach),
                reachEfficiency: this.toPercent(post.reach, profile.followers_count)
            };
        });

        const engagementRateNorm = this.normaliseSeries(enrichedPosts.map((post) => post.engagementRate));
        const saveRateNorm = this.normaliseSeries(enrichedPosts.map((post) => post.saveRate));
        const shareRateNorm = this.normaliseSeries(enrichedPosts.map((post) => post.shareRate));
        const commentRateNorm = this.normaliseSeries(enrichedPosts.map((post) => post.commentRate));
        const reachEfficiencyNorm = this.normaliseSeries(enrichedPosts.map((post) => post.reachEfficiency));

        const contentScores = enrichedPosts.map((post, index) => {
            const topFactors = [
                { name: 'High engagement rate', score: post.engagementRate },
                { name: 'Strong save rate', score: post.saveRate },
                { name: 'Strong share rate', score: post.shareRate },
                { name: 'Strong comment rate', score: post.commentRate },
                { name: 'Efficient reach', score: post.reachEfficiency }
            ]
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .filter((factor) => factor.score > 0);

            return {
                id: post.id,
                qualityScore: Math.round(
                    (engagementRateNorm[index] * 35) +
                    (saveRateNorm[index] * 25) +
                    (shareRateNorm[index] * 15) +
                    (commentRateNorm[index] * 10) +
                    (reachEfficiencyNorm[index] * 15)
                ),
                type: post.mediaType,
                thumbnail: post.thumbnailUrl || post.mediaUrl,
                caption: (post.caption || '').substring(0, 100) + ((post.caption?.length > 100) ? '...' : ''),
                permalink: post.permalink,
                timestamp: post.timestamp,
                engagement: post.engagement,
                likes: post.likeCount,
                comments: post.commentsCount,
                reach: post.reach,
                impressions: post.impressions,
                saved: post.saved,
                shares: post.shares || 0,
                engagementRate: post.engagementRate,
                saveRate: post.saveRate,
                shareRate: post.shareRate,
                commentRate: post.commentRate,
                reachEfficiency: post.reachEfficiency,
                topFactors: topFactors.map((factor) => factor.name),
                insight: topFactors.length > 0 ? topFactors.map((factor) => factor.name).join(' • ') : 'Low signal volume'
            };
        }).sort((a, b) => b.qualityScore - a.qualityScore);

        const avgQualityScore = contentScores.length > 0
            ? Math.round(contentScores.reduce((sum, post) => sum + post.qualityScore, 0) / contentScores.length)
            : 0;

        const buildAggregateRows = (groups, labelKey) => {
            const rows = groups.map((group) => ({
                ...group,
                avgEngagement: group.posts.length > 0 ? Math.round(group.posts.reduce((sum, post) => sum + post.engagement, 0) / group.posts.length) : 0,
                avgReach: group.posts.length > 0 ? Math.round(group.posts.reduce((sum, post) => sum + post.reach, 0) / group.posts.length) : 0,
                avgEngagementRate: this.averageValue(group.posts.map((post) => post.engagementRate)),
                avgSaveRate: this.averageValue(group.posts.map((post) => post.saveRate)),
                avgShareRate: this.averageValue(group.posts.map((post) => post.shareRate)),
                avgCommentRate: this.averageValue(group.posts.map((post) => post.commentRate)),
                avgReachEfficiency: this.averageValue(group.posts.map((post) => post.reachEfficiency)),
                [labelKey]: group[labelKey]
            }));

            const engagementNorm = this.normaliseSeries(rows.map((row) => row.avgEngagementRate));
            const saveNorm = this.normaliseSeries(rows.map((row) => row.avgSaveRate));
            const shareNorm = this.normaliseSeries(rows.map((row) => row.avgShareRate));
            const reachNorm = this.normaliseSeries(rows.map((row) => row.avgReachEfficiency));

            return rows.map((row, index) => ({
                ...row,
                performanceScore: Math.round(
                    (engagementNorm[index] * 40) +
                    (saveNorm[index] * 25) +
                    (shareNorm[index] * 15) +
                    (reachNorm[index] * 20)
                )
            }));
        };

        const formats = ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REEL'];
        const formatRanking = buildAggregateRows(
            formats
                .map((format) => ({ format, count: enrichedPosts.filter((post) => post.mediaType === format).length, posts: enrichedPosts.filter((post) => post.mediaType === format) }))
                .filter((group) => group.posts.length > 0),
            'format'
        )
            .sort((a, b) => b.performanceScore - a.performanceScore)
            .map((row, index) => ({ ...row, rank: index + 1 }));

        const captionBuckets = [
            { bucket: 'short', label: '0-50 chars', posts: enrichedPosts.filter((post) => post.captionLength <= 50) },
            { bucket: 'medium', label: '51-150 chars', posts: enrichedPosts.filter((post) => post.captionLength > 50 && post.captionLength <= 150) },
            { bucket: 'long', label: '151-300 chars', posts: enrichedPosts.filter((post) => post.captionLength > 150 && post.captionLength <= 300) },
            { bucket: 'veryLong', label: '300+ chars', posts: enrichedPosts.filter((post) => post.captionLength > 300) }
        ];

        const captionAnalysis = buildAggregateRows(
            captionBuckets.filter((bucket) => bucket.posts.length > 0),
            'label'
        ).sort((a, b) => b.performanceScore - a.performanceScore);

        const postingHours = buildAggregateRows(
            Array.from({ length: 24 }, (_, hour) => ({
                hour,
                posts: enrichedPosts.filter((post) => post.postingHour === hour)
            })).filter((bucket) => bucket.posts.length > 0),
            'hour'
        ).sort((a, b) => b.performanceScore - a.performanceScore);

        const postingDays = buildAggregateRows(
            days.map((day) => ({
                day,
                posts: enrichedPosts.filter((post) => post.postingDay === day)
            })).filter((bucket) => bucket.posts.length > 0),
            'day'
        ).sort((a, b) => b.performanceScore - a.performanceScore);

        const interactionQuality = {
            avgSaveRate: this.averageValue(enrichedPosts.map((post) => post.saveRate)),
            avgShareRate: this.averageValue(enrichedPosts.map((post) => post.shareRate)),
            avgCommentRate: this.averageValue(enrichedPosts.map((post) => post.commentRate)),
            topSavers: [...contentScores].sort((a, b) => b.saveRate - a.saveRate).slice(0, 5),
            topShared: [...contentScores].sort((a, b) => b.shareRate - a.shareRate).slice(0, 5),
            insight: enrichedPosts.length > 0
                ? `Average save rate ${this.averageValue(enrichedPosts.map((post) => post.saveRate))}% with share rate ${this.averageValue(enrichedPosts.map((post) => post.shareRate))}%`
                : 'Not enough data'
        };

        const reachEfficiency = {
            average: this.averageValue(enrichedPosts.map((post) => post.reachEfficiency)),
            topPosts: [...contentScores].sort((a, b) => b.reachEfficiency - a.reachEfficiency).slice(0, 5),
            insight: enrichedPosts.length > 0
                ? `${[...contentScores].sort((a, b) => b.reachEfficiency - a.reachEfficiency)[0]?.type || 'Content'} reaches followers most efficiently`
                : 'Not enough data'
        };

        // Content Type Mix Optimization: which format drives most ER adjusted for reach
        const contentTypeMixOptimization = formatRanking.map((row) => ({
            type: row.format,
            postCount: row.count,
            shareOfPosts: enrichedPosts.length > 0
                ? Number(((row.count / enrichedPosts.length) * 100).toFixed(1))
                : 0,
            avgEngagementRate: row.avgEngagementRate,
            avgSaveRate: row.avgSaveRate,
            avgShareRate: row.avgShareRate,
            avgReachEfficiency: row.avgReachEfficiency,
            // Reach-adjusted ER: down-weights types that only get ER on tiny audiences
            reachAdjustedER: row.avgReachEfficiency > 0
                ? Number((row.avgEngagementRate * (row.avgReachEfficiency / 100)).toFixed(3))
                : 0,
            performanceScore: row.performanceScore,
            rank: row.rank
        })).sort((a, b) => b.reachAdjustedER - a.reachAdjustedER);

        const intelligence = {
            formatBattle: {
                ranking: formatRanking,
                winner: formatRanking[0]?.format || null,
                insight: formatRanking[0]
                    ? `${formatRanking[0].format} leads on performance score with ${formatRanking[0].avgSaveRate}% save rate and ${formatRanking[0].avgReachEfficiency}% reach efficiency`
                    : 'Not enough data'
            },
            // Content Type Mix Optimization
            contentTypeMix: {
                breakdown: contentTypeMixOptimization,
                bestByReachAdjustedER: contentTypeMixOptimization[0]?.type || null,
                insight: contentTypeMixOptimization.length > 0
                    ? `${contentTypeMixOptimization[0]?.type || 'N/A'} delivers the highest reach-adjusted engagement rate (${contentTypeMixOptimization[0]?.reachAdjustedER || 0})`
                    : 'Not enough data'
            },
            captionAnalysis: {
                buckets: captionAnalysis,
                optimalLength: captionAnalysis[0]?.label || null,
                insight: captionAnalysis[0]
                    ? `${captionAnalysis[0].label} captions currently produce your best combined quality score`
                    : 'Not enough data'
            },
            postingTime: {
                bestHours: postingHours.slice(0, 3).map((row) => ({
                    hour: row.hour,
                    formatted: `${String(row.hour).padStart(2, '0')}:00`,
                    performanceScore: row.performanceScore,
                    avgReach: row.avgReach,
                    avgSaveRate: row.avgSaveRate
                })),
                bestDays: postingDays.slice(0, 3).map((row) => ({
                    day: row.day,
                    performanceScore: row.performanceScore,
                    avgReach: row.avgReach,
                    avgSaveRate: row.avgSaveRate
                })),
                insight: postingHours[0]
                    ? `${String(postingHours[0].hour).padStart(2, '0')}:00 is your strongest recent posting hour by combined reach and interaction quality`
                    : 'Not enough data'
            },
            interactionQuality,
            reachEfficiency,
            contentQuality: {
                averageScore: avgQualityScore,
                topContent: contentScores.slice(0, 5),
                bottomContent: [...contentScores].slice(-3).reverse(),
                distribution: {
                    excellent: contentScores.filter((post) => post.qualityScore >= 80).length,
                    good: contentScores.filter((post) => post.qualityScore >= 60 && post.qualityScore < 80).length,
                    average: contentScores.filter((post) => post.qualityScore >= 40 && post.qualityScore < 60).length,
                    poor: contentScores.filter((post) => post.qualityScore < 40).length
                },
                postsAnalyzed: contentScores.length
            },
            postsAnalyzed: media.length,
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('content_intelligence', dateKey, intelligence);
        return intelligence;
    }

    /**
     * Get reels-specific analytics
     */
    async getReelsAnalytics(startDate = null, endDate = null, options = {}) {
        const requestedLimit = Number.parseInt(options.limit, 10);
        const targetReels = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 6), 24)
            : 12;
        const after = options.after || null;
        const dateKey = `v3_${startDate || 'default'}_${endDate || 'default'}_${after || 'first'}_${targetReels}`;
        const cached = await this.checkCache('reels', dateKey);
        if (cached) return cached;

        const reels = [];
        const nonReels = [];
        const batchSize = Math.min(Math.max(targetReels, 12), 18);
        const maxPagesToScan = 4;
        let nextCursor = after;
        let pagesScanned = 0;

        while (pagesScanned < maxPagesToScan && reels.length < targetReels) {
            const response = await this.instagram.getMediaPageWithInsights(batchSize, nextCursor, {
                includeDetailedVideoInsights: true,
                detailedInsightConcurrency: 2
            });
            const batch = this.filterMediaByDate(response?.data || [], startDate, endDate);

            if (batch.length > 0) {
                batch.forEach((item) => {
                    if (item.mediaType === 'REEL' || item.mediaType === 'VIDEO') {
                        reels.push(item);
                    } else {
                        nonReels.push(item);
                    }
                });
            }

            pagesScanned += 1;
            nextCursor = response?.paging?.cursors?.after || null;

            if (!nextCursor || (response?.data || []).length === 0) {
                break;
            }
        }

        // Fetch virality breakdown (follow_type) for top reels — capped to avoid rate overload
        const TOP_REELS_VIRALITY = 6;
        const viralityMap = {};
        await Promise.allSettled(
            reels.slice(0, TOP_REELS_VIRALITY).map(async (r) => {
                try {
                    const breakdown = await this.instagram.getReelReachByFollowType(r.id);
                    if (breakdown) viralityMap[r.id] = breakdown;
                } catch { /* non-fatal */ }
            })
        );

        // Average play rate used to detect algorithm boost window candidates
        const avgPlayRate = reels.length > 0
            ? reels.reduce((sum, r) => sum + (r.plays > 0 && r.reach > 0 ? r.plays / r.reach : 0), 0) / reels.length
            : 0;

        // Calculate reel-specific aggregate stats
        const reelStats = {
            totalReels: reels.length,
            totalEngagement: reels.reduce((sum, r) => sum + r.engagement, 0),
            totalLikes: reels.reduce((sum, r) => sum + r.likeCount, 0),
            totalComments: reels.reduce((sum, r) => sum + r.commentsCount, 0),
            totalImpressions: reels.reduce((sum, r) => sum + r.impressions, 0),
            totalReach: reels.reduce((sum, r) => sum + r.reach, 0),
            totalPlays: reels.reduce((sum, r) => sum + (r.plays || 0), 0),
            totalSaved: reels.reduce((sum, r) => sum + (r.saved || 0), 0),
            totalShares: reels.reduce((sum, r) => sum + (r.shares || 0), 0),
            totalInteractions: reels.reduce((sum, r) => sum + (r.totalInteractions || r.engagement), 0)
        };

        const nonReelStats = {
            totalPosts: nonReels.length,
            avgEngagement: nonReels.length > 0
                ? Math.round(nonReels.reduce((sum, p) => sum + p.engagement, 0) / nonReels.length)
                : 0
        };

        const enrichedReels = reels.map((r) => {
            const plays = r.plays || 0;
            const reach = r.reach || 0;
            const virality = viralityMap[r.id] || null;
            const nonFollowerReach = virality ? virality.nonFollower : 0;

            // Watch-Through Rate: reach / plays * 100 (complete_views not in basic API — approximation)
            const watchThroughRate = plays > 0 ? Number(((reach / plays) * 100).toFixed(2)) : 0;
            // Hook Rate: plays / impressions * 100 (3-sec views not available; uses impressions as proxy)
            const hookRate = r.impressions > 0 ? Number(((plays / r.impressions) * 100).toFixed(2)) : 0;
            // Reel Virality Score: non-follower reach / total reach * 100
            const reelViralityScore = virality && reach > 0
                ? Number(((nonFollowerReach / reach) * 100).toFixed(1))
                : null;
            // Reel-to-Profile Funnel: profile_activity / plays * 100
            const reelToProfileFunnel = plays > 0
                ? Number(((r.profileActivity || 0) / plays * 100).toFixed(2))
                : 0;
            // Algorithm Boost Window flag: play rate 1.5× above account average
            const thisPlayRate = reach > 0 && plays > 0 ? plays / reach : 0;
            const algorithmBoosted = avgPlayRate > 0 ? thisPlayRate > avgPlayRate * 1.5 : false;

            return {
                id: r.id,
                thumbnail: r.thumbnailUrl || r.mediaUrl,
                caption: r.caption || '',
                likes: r.likeCount,
                comments: r.commentsCount,
                engagement: r.engagement,
                impressions: r.impressions,
                reach,
                saved: r.saved || 0,
                shares: r.shares || 0,
                plays,
                totalInteractions: r.totalInteractions || r.engagement,
                engagementRate: reach > 0 ? Number(((r.engagement / reach) * 100).toFixed(2)) : 0,
                saveRate: reach > 0 ? Number((((r.saved || 0) / reach) * 100).toFixed(2)) : 0,
                shareRate: reach > 0 ? Number((((r.shares || 0) / reach) * 100).toFixed(2)) : 0,
                commentRate: reach > 0 ? Number(((r.commentsCount / reach) * 100).toFixed(2)) : 0,
                interactionRate: reach > 0 ? Number((((r.totalInteractions || r.engagement) / reach) * 100).toFixed(2)) : 0,
                playRate: reach > 0 && plays > 0 ? Number(((plays / reach) * 100).toFixed(2)) : 0,
                watchThroughRate,
                hookRate,
                reelViralityScore,
                reelToProfileFunnel,
                algorithmBoosted,
                timestamp: r.timestamp
            };
        });

        const analytics = {
            reels: enrichedReels,
            summary: {
                ...reelStats,
                avgEngagement: reels.length > 0
                    ? Math.round(reelStats.totalEngagement / reels.length)
                    : 0,
                avgLikes: reels.length > 0
                    ? Math.round(reelStats.totalLikes / reels.length)
                    : 0,
                avgComments: reels.length > 0
                    ? Math.round(reelStats.totalComments / reels.length)
                    : 0,
                avgPlays: reels.length > 0
                    ? Math.round(reelStats.totalPlays / reels.length)
                    : 0,
                avgEngagementRate: reels.length > 0
                    ? Number((reels.reduce((sum, r) => sum + (r.reach > 0 ? (r.engagement / r.reach) * 100 : 0), 0) / reels.length).toFixed(2))
                    : 0,
                avgSaveRate: reels.length > 0
                    ? Number((reels.reduce((sum, r) => sum + (r.reach > 0 ? ((r.saved || 0) / r.reach) * 100 : 0), 0) / reels.length).toFixed(2))
                    : 0,
                avgShareRate: reels.length > 0
                    ? Number((reels.reduce((sum, r) => sum + (r.reach > 0 ? ((r.shares || 0) / r.reach) * 100 : 0), 0) / reels.length).toFixed(2))
                    : 0,
                avgCommentRate: reels.length > 0
                    ? Number((reels.reduce((sum, r) => sum + (r.reach > 0 ? (r.commentsCount / r.reach) * 100 : 0), 0) / reels.length).toFixed(2))
                    : 0,
                avgPlayRate: reels.length > 0
                    ? Number((reels.reduce((sum, r) => sum + (r.reach > 0 && (r.plays || 0) > 0 ? ((r.plays || 0) / r.reach) * 100 : 0), 0) / reels.length).toFixed(2))
                    : 0,
                // Watch-Through Rate (avg)
                avgWatchThroughRate: enrichedReels.length > 0
                    ? Number((enrichedReels.reduce((sum, r) => sum + r.watchThroughRate, 0) / enrichedReels.length).toFixed(2))
                    : 0,
                // Hook Rate (avg)
                avgHookRate: enrichedReels.length > 0
                    ? Number((enrichedReels.reduce((sum, r) => sum + r.hookRate, 0) / enrichedReels.length).toFixed(2))
                    : 0,
                // Reel Virality Score (avg, only for reels with breakdown data)
                avgViralityScore: (() => {
                    const withV = enrichedReels.filter((r) => r.reelViralityScore !== null);
                    if (withV.length === 0) return null;
                    return Number((withV.reduce((sum, r) => sum + r.reelViralityScore, 0) / withV.length).toFixed(1));
                })(),
                // Reel-to-Profile Funnel (avg)
                avgReelToProfileFunnel: enrichedReels.length > 0
                    ? Number((enrichedReels.reduce((sum, r) => sum + r.reelToProfileFunnel, 0) / enrichedReels.length).toFixed(2))
                    : 0,
                // Algorithm Boost Window count
                algorithmBoostedCount: enrichedReels.filter((r) => r.algorithmBoosted).length
            },
            comparison: {
                reelAvgEngagement: reels.length > 0
                    ? Math.round(reelStats.totalEngagement / reels.length)
                    : 0,
                postAvgEngagement: nonReelStats.avgEngagement,
                reelMultiplier: nonReelStats.avgEngagement > 0
                    ? ((reelStats.totalEngagement / Math.max(reels.length, 1)) / nonReelStats.avgEngagement).toFixed(2)
                    : 0
            },
            diagnostics: {
                highIntent: [...reels]
                    .sort((a, b) => this.toPercent(b.saved || 0, b.reach) - this.toPercent(a.saved || 0, a.reach))
                    .slice(0, 5)
                    .map((reel) => ({
                        id: reel.id,
                        caption: reel.caption || '',
                        reach: reel.reach,
                        saveRate: this.toPercent(reel.saved || 0, reel.reach),
                        shareRate: this.toPercent(reel.shares || 0, reel.reach)
                    })),
                strongestDistribution: [...reels]
                    .sort((a, b) => b.reach - a.reach)
                    .slice(0, 5)
                    .map((reel) => ({
                        id: reel.id,
                        caption: reel.caption || '',
                        reach: reel.reach,
                        interactionRate: this.toPercent(reel.totalInteractions || reel.engagement, reel.reach)
                    }))
            },
            pagination: {
                returned: reels.length,
                target: targetReels,
                pagesScanned,
                nextCursor,
                hasNextPage: Boolean(nextCursor)
            },
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('reels', dateKey, analytics);
        return analytics;
    }

    /**
     * Get detailed post analytics
     */
    async getPostsAnalytics(limit = 12, startDate = null, endDate = null, options = {}) {
        const requestedLimit = Number.isFinite(Number(limit))
            ? Math.min(Math.max(Number(limit), 6), 20)
            : 12;
        const after = options.after || null;
        const analysisLimit = Number.isFinite(Number(options.analysisLimit))
            ? Math.min(Math.max(Number(options.analysisLimit), 18), 40)
            : ((startDate || endDate) ? MEDIA_FETCH_LIMITS.postsAnalysis.ranged : MEDIA_FETCH_LIMITS.postsAnalysis.default);
        const dateKey = `v5_${startDate || 'default'}_${endDate || 'default'}_${after || 'first'}_${requestedLimit}_${analysisLimit}`;
        const cached = await this.checkCache('posts', dateKey);
        if (cached) return cached;

        let analysisMedia = [];
        let stories = { stories: [], summary: {} };

        const [analysisResult, storiesResult] = await runWithConcurrency([
            async () => {
                const fetchedMedia = await this.instagram.getAllMediaWithInsights(analysisLimit, {
                    includeDetailedVideoInsights: false,
                    fetchShares: false
                });
                return this.filterMediaByDate(fetchedMedia, startDate, endDate);
            },
            async () => this.getStoryAnalytics()
        ], 2);

        if (analysisResult.status === 'fulfilled') {
            analysisMedia = analysisResult.value || [];
        } else {
            console.warn('Posts analysis media fetch failed:', analysisResult.reason?.message || analysisResult.reason);
        }

        if (storiesResult.status === 'fulfilled') {
            stories = storiesResult.value || stories;
        } else {
            console.warn('Story analytics fetch failed:', storiesResult.reason?.message || storiesResult.reason);
        }

        const pagePosts = [];
        const batchSize = Math.min(Math.max(requestedLimit, 10), 16);
        const maxPagesToScan = 4;
        let nextCursor = after;
        let pagesScanned = 0;

        while (pagesScanned < maxPagesToScan && pagePosts.length < requestedLimit) {
            const response = await this.instagram.getMediaPageWithInsights(batchSize, nextCursor, {
                includeDetailedVideoInsights: false,
                fetchShares: false
            });
            const batch = this.filterMediaByDate(response?.data || [], startDate, endDate);

            if (batch.length > 0) {
                pagePosts.push(...batch);
            }

            pagesScanned += 1;
            nextCursor = response?.paging?.cursors?.after || null;

            if (!nextCursor || (response?.data || []).length === 0) {
                break;
            }
        }

        const media = analysisMedia;
        const visiblePosts = pagePosts.slice(0, requestedLimit);
        const byEngagement = [...media].sort((a, b) => b.engagement - a.engagement);
        const byLikes = [...media].sort((a, b) => b.likeCount - a.likeCount);
        const byComments = [...media].sort((a, b) => b.commentsCount - a.commentsCount);
        const byReach = [...media].sort((a, b) => b.reach - a.reach);

        const posts = {
            all: visiblePosts.map(p => ({
                id: p.id,
                type: p.mediaType,
                caption: p.caption?.substring(0, 100) + (p.caption?.length > 100 ? '...' : ''),
                thumbnail: p.thumbnailUrl || p.mediaUrl,
                permalink: p.permalink,
                likes: p.likeCount,
                comments: p.commentsCount,
                engagement: p.engagement,
                impressions: p.impressions,
                reach: p.reach,
                saved: p.saved,
                shares: p.shares || 0,
                saveRate: this.toPercent(p.saved, p.reach),
                commentRate: this.toPercent(p.commentsCount, p.reach),
                engagementRate: this.toPercent(p.engagement, p.reach),
                // Profile Visit Rate: profile_activity / reach * 100 (from post insights)
                profileVisitRate: this.toPercent(p.profileActivity || 0, p.reach),
                // Website Click Rate: not directly available per-post without ads_read level; kept 0
                websiteClickRate: 0,
                timestamp: p.timestamp
            })),
            topByEngagement: byEngagement.slice(0, 10).map(p => p.id),
            topByLikes: byLikes.slice(0, 10).map(p => p.id),
            topByComments: byComments.slice(0, 10).map(p => p.id),
            topByReach: byReach.slice(0, 10).map(p => p.id),
            summary: {
                totalPosts: media.length,
                totalEngagement: media.reduce((sum, p) => sum + p.engagement, 0),
                avgEngagement: media.length > 0
                    ? Math.round(media.reduce((sum, p) => sum + p.engagement, 0) / media.length)
                    : 0,
                totalReach: media.reduce((sum, p) => sum + p.reach, 0),
                avgReach: media.length > 0
                    ? Math.round(media.reduce((sum, p) => sum + p.reach, 0) / media.length)
                    : 0,
                totalLikes: media.reduce((sum, p) => sum + p.likeCount, 0),
                totalComments: media.reduce((sum, p) => sum + p.commentsCount, 0),
                totalSaved: media.reduce((sum, p) => sum + p.saved, 0),
                totalShares: media.reduce((sum, p) => sum + (p.shares || 0), 0),
                avgSaveRate: this.averageValue(media.map((p) => this.toPercent(p.saved, p.reach))),
                avgCommentRate: this.averageValue(media.map((p) => this.toPercent(p.commentsCount, p.reach))),
                avgEngagementRate: this.averageValue(media.map((p) => this.toPercent(p.engagement, p.reach))),
                // Profile Visit Rate: profile_activity / reach * 100
                avgProfileVisitRate: this.averageValue(media.map((p) => this.toPercent(p.profileActivity || 0, p.reach))),
                // Website Click Rate: not available per-post via basic permissions
                avgWebsiteClickRate: 0
            },
            formatEfficiency: Object.values(
                media.reduce((acc, post) => {
                    const key = post.mediaType || 'UNKNOWN';
                    if (!acc[key]) acc[key] = { type: key, posts: [] };
                    acc[key].posts.push(post);
                    return acc;
                }, {})
            ).map((entry) => ({
                type: entry.type,
                count: entry.posts.length,
                avgEngagement: Math.round(entry.posts.reduce((sum, post) => sum + post.engagement, 0) / entry.posts.length),
                avgReach: Math.round(entry.posts.reduce((sum, post) => sum + post.reach, 0) / entry.posts.length),
                avgSaveRate: this.averageValue(entry.posts.map((post) => this.toPercent(post.saved, post.reach))),
                avgCommentRate: this.averageValue(entry.posts.map((post) => this.toPercent(post.commentsCount, post.reach))),
                avgEngagementRate: this.averageValue(entry.posts.map((post) => this.toPercent(post.engagement, post.reach)))
            })).sort((a, b) => b.avgEngagementRate - a.avgEngagementRate),
            stories,
            pagination: {
                returned: visiblePosts.length,
                target: requestedLimit,
                pagesScanned,
                nextCursor,
                hasNextPage: Boolean(nextCursor)
            },
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('posts', dateKey, posts);
        return posts;
    }

    sanitizeExportMetrics(metrics = []) {
        const validMetrics = new Set(['overview', 'growth', 'posts', 'reels', 'bestTime', 'hashtags', 'contentIntelligence']);
        const cleaned = (metrics || [])
            .map(metric => String(metric || '').trim())
            .filter(metric => validMetrics.has(metric));

        return cleaned.length > 0 ? [...new Set(cleaned)] : ['overview', 'growth', 'posts'];
    }

    async collectExportData(metrics, startDate = null, endDate = null) {
        const selectedMetrics = this.sanitizeExportMetrics(metrics);
        const data = {};

        for (const metric of selectedMetrics) {
            switch (metric) {
                case 'overview':
                    data.overview = await this.getOverview(startDate, endDate);
                    break;
                case 'growth':
                    data.growth = await this.getGrowth(startDate, endDate);
                    break;
                case 'posts':
                    data.posts = await this.getPostsAnalytics(200, startDate, endDate);
                    break;
                case 'reels':
                    data.reels = await this.getReelsAnalytics(startDate, endDate);
                    break;
                case 'bestTime':
                    data.bestTime = await this.getBestTimeToPost(startDate, endDate);
                    break;
                case 'hashtags':
                    data.hashtags = await this.getHashtagAnalysis(startDate, endDate);
                    break;
                case 'contentIntelligence':
                    data.contentIntelligence = await this.getContentIntelligence(startDate, endDate);
                    break;
            }
        }

        return { selectedMetrics, data };
    }

    buildExportSummary(data) {
        const summary = [];
        const overviewMetrics = data.overview?.metrics || {};
        const growth = data.growth || {};
        const reelsSummary = data.reels?.summary || {};
        const postsSummary = data.posts?.summary || {};
        const hashtags = data.hashtags || {};
        const intelligence = data.contentIntelligence || {};

        if (Object.keys(overviewMetrics).length > 0) {
            summary.push(
                { category: 'Audience', metric: 'Followers', value: overviewMetrics.followers ?? 0 },
                { category: 'Audience', metric: 'Following', value: overviewMetrics.following ?? 0 },
                { category: 'Content', metric: 'Posts Published', value: overviewMetrics.posts ?? 0 },
                { category: 'Performance', metric: 'Engagement Rate %', value: overviewMetrics.engagementRate ?? 0 },
                { category: 'Performance', metric: 'Total Impressions', value: overviewMetrics.totalImpressions ?? 0 },
                { category: 'Performance', metric: 'Total Reach', value: overviewMetrics.totalReach ?? 0 },
                { category: 'Performance', metric: 'Total Saves', value: overviewMetrics.totalSaved ?? 0 }
            );
        }

        if (growth.weeklyStats) {
            summary.push(
                { category: 'Momentum', metric: 'Posts This Week', value: growth.weeklyStats.postsThisWeek ?? 0 },
                { category: 'Momentum', metric: 'Engagement This Week', value: growth.weeklyStats.engagementThisWeek ?? 0 },
                { category: 'Momentum', metric: 'Weekly Engagement Change %', value: growth.weeklyStats.engagementChange ?? 0 },
                { category: 'Momentum', metric: 'Avg Engagement Per Post', value: growth.weeklyStats.avgEngagementPerPost ?? 0 }
            );
        }

        if (Object.keys(postsSummary).length > 0) {
            summary.push(
                { category: 'Posts', metric: 'Exported Posts', value: postsSummary.totalPosts ?? 0 },
                { category: 'Posts', metric: 'Avg Reach Per Post', value: postsSummary.avgReach ?? 0 },
                { category: 'Posts', metric: 'Avg Engagement Per Post', value: postsSummary.avgEngagement ?? 0 }
            );
        }

        if (Object.keys(reelsSummary).length > 0) {
            summary.push(
                { category: 'Reels', metric: 'Total Reels', value: reelsSummary.totalReels ?? 0 },
                { category: 'Reels', metric: 'Avg Reel Engagement', value: reelsSummary.avgEngagement ?? 0 },
                { category: 'Reels', metric: 'Avg Reel Reach', value: reelsSummary.totalReels ? Math.round((reelsSummary.totalReach || 0) / Math.max(reelsSummary.totalReels, 1)) : 0 }
            );
        }

        if (hashtags.topPerforming?.length) {
            summary.push(
                { category: 'Hashtags', metric: 'Unique Hashtags Used', value: hashtags.totalHashtagsUsed ?? 0 },
                { category: 'Hashtags', metric: 'Avg Hashtags Per Post', value: hashtags.avgHashtagsPerPost ?? 0 },
                { category: 'Hashtags', metric: 'Top Performing Hashtag', value: hashtags.topPerforming[0]?.tag || '' }
            );
        }

        if (intelligence.contentQuality || intelligence.formatBattle) {
            summary.push(
                { category: 'Creative', metric: 'Best Format', value: intelligence.formatBattle?.winner || '' },
                { category: 'Creative', metric: 'Avg Content Quality Score', value: intelligence.contentQuality?.averageScore ?? 0 },
                { category: 'Creative', metric: 'Optimal Caption Length', value: intelligence.captionAnalysis?.optimalLength || '' }
            );
        }

        return summary;
    }

    buildExportTables(data) {
        const tables = [];
        const pushTable = (key, title, rows) => {
            if (Array.isArray(rows) && rows.length > 0) {
                tables.push({ key, title, rows });
            }
        };

        pushTable('summary', 'Executive Summary', this.buildExportSummary(data));

        if (data.overview?.dailyMetrics?.length) {
            pushTable('daily_metrics', 'Daily Account Metrics', data.overview.dailyMetrics);
        }

        if (data.growth?.growthData?.length) {
            pushTable('growth_trends', 'Growth Trends', data.growth.growthData);
        }

        if (data.posts?.all?.length) {
            pushTable('post_performance', 'Post Performance', data.posts.all.map((post, index) => ({
                rank: index + 1,
                postId: post.id,
                type: post.type,
                caption: post.caption,
                likes: post.likes,
                comments: post.comments,
                saves: post.saved,
                impressions: post.impressions,
                reach: post.reach,
                engagement: post.engagement,
                permalink: post.permalink,
                timestamp: post.timestamp,
            })));
        }

        if (data.reels?.reels?.length) {
            pushTable('reels_performance', 'Reels Performance', data.reels.reels.map((reel, index) => ({
                rank: index + 1,
                reelId: reel.id,
                likes: reel.likes,
                comments: reel.comments,
                saves: reel.saved,
                shares: reel.shares,
                impressions: reel.impressions,
                reach: reel.reach,
                engagement: reel.engagement,
                engagementRate: reel.engagementRate,
                saveRate: reel.saveRate,
                shareRate: reel.shareRate,
                timestamp: reel.timestamp,
            })));
        }

        if (data.bestTime?.hourlyAnalysis?.length) {
            pushTable('posting_hours', 'Best Posting Hours', data.bestTime.hourlyAnalysis.map((entry) => ({
                hour: entry.hour,
                performanceScore: entry.performanceScore,
                avgEngagement: entry.avgEngagement,
                avgReach: entry.avgReach,
                avgSaveRate: entry.avgSaveRate,
                postCount: entry.postCount,
            })));
        }

        if (data.bestTime?.dailyAnalysis?.length) {
            pushTable('posting_days', 'Best Posting Days', data.bestTime.dailyAnalysis.map((entry) => ({
                day: entry.day,
                performanceScore: entry.performanceScore,
                avgEngagement: entry.avgEngagement,
                avgReach: entry.avgReach,
                avgSaveRate: entry.avgSaveRate,
                postCount: entry.postCount,
            })));
        }

        if (data.hashtags?.topPerforming?.length) {
            pushTable('hashtags_top_performing', 'Top Performing Hashtags', data.hashtags.topPerforming.map((item, index) => ({
                rank: index + 1,
                hashtag: item.tag,
                usageCount: item.usageCount,
                avgEngagement: item.avgEngagement,
                avgLikes: item.avgLikes,
                avgComments: item.avgComments,
                reachLift: item.reachLift,
                consistencyScore: item.consistencyScore,
                diminishingReturn: item.diminishingReturn,
            })));
        }

        if (data.hashtags?.reachExpanders?.length) {
            pushTable('hashtags_reach_expanders', 'Reach Expander Hashtags', data.hashtags.reachExpanders.map((item, index) => ({
                rank: index + 1,
                hashtag: item.tag,
                usageCount: item.usageCount,
                avgReach: item.avgReach,
                reachMultiplier: item.reachMultiplier,
            })));
        }

        if (data.contentIntelligence?.formatBattle?.ranking?.length) {
            pushTable('creative_formats', 'Creative Format Ranking', data.contentIntelligence.formatBattle.ranking.map((item) => ({
                rank: item.rank,
                format: item.format,
                posts: item.count,
                performanceScore: item.performanceScore,
                avgEngagement: item.avgEngagement,
                avgReach: item.avgReach,
                avgEngagementRate: item.avgEngagementRate,
                avgSaveRate: item.avgSaveRate,
                avgShareRate: item.avgShareRate,
                avgReachEfficiency: item.avgReachEfficiency,
            })));
        }

        if (data.contentIntelligence?.contentQuality?.topContent?.length) {
            pushTable('creative_quality', 'Top Content Quality', data.contentIntelligence.contentQuality.topContent.map((item, index) => ({
                rank: index + 1,
                postId: item.id,
                type: item.type,
                qualityScore: item.qualityScore,
                engagement: item.engagement,
                reach: item.reach,
                saves: item.saved,
                insight: item.insight,
                topFactors: (item.topFactors || []).join(' | '),
                permalink: item.permalink,
                timestamp: item.timestamp,
            })));
        }

        return tables;
    }

    buildExportPackage(data, metrics, startDate = null, endDate = null) {
        const generatedAt = new Date().toISOString();
        return {
            metadata: {
                generatedAt,
                accountId: this.instagramAccountId,
                instagramUserId: this.instagramUserId,
                metrics,
                dateRange: {
                    startDate: startDate || null,
                    endDate: endDate || null,
                },
            },
            summary: this.buildExportSummary(data),
            tables: this.buildExportTables(data),
            datasets: data,
        };
    }

    stringifyCell(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return value.join(' | ');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    renderDelimitedTable(rows, delimiter = ',') {
        if (!rows || rows.length === 0) return '';
        const headers = Array.from(rows.reduce((set, row) => {
            Object.keys(row).forEach((key) => set.add(key));
            return set;
        }, new Set()));

        const escapeCell = (value) => {
            const text = this.stringifyCell(value);
            if (delimiter === '\t') return text.replace(/\r?\n/g, ' ');
            const escaped = text.replace(/"/g, '""');
            return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
        };

        const lines = [
            headers.join(delimiter),
            ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(delimiter))
        ];

        return lines.join('\n');
    }

    renderDelimitedExport(exportPackage, delimiter = ',') {
        return exportPackage.tables
            .map((table) => {
                const content = this.renderDelimitedTable(table.rows, delimiter);
                if (!content) return '';
                return [`# ${table.title}`, content].join('\n');
            })
            .filter(Boolean)
            .join('\n\n');
    }

    renderMarkdownExport(exportPackage) {
        const lines = [
            '# Performance Marketing Export',
            '',
            `Generated: ${exportPackage.metadata.generatedAt}`,
            `Metrics: ${exportPackage.metadata.metrics.join(', ')}`,
            `Date Range: ${exportPackage.metadata.dateRange.startDate || 'All time'} -> ${exportPackage.metadata.dateRange.endDate || 'Today'}`,
            '',
            '## Executive Summary',
            ''
        ];

        exportPackage.summary.forEach((item) => {
            lines.push(`- ${item.category}: ${item.metric} = ${item.value}`);
        });

        exportPackage.tables
            .filter((table) => table.key !== 'summary')
            .forEach((table) => {
                lines.push('', `## ${table.title}`, '');
                const previewRows = table.rows.slice(0, 12);
                const headers = Array.from(previewRows.reduce((set, row) => {
                    Object.keys(row).forEach((key) => set.add(key));
                    return set;
                }, new Set()));

                if (headers.length === 0) {
                    lines.push('_No rows available_');
                    return;
                }

                lines.push(`| ${headers.join(' | ')} |`);
                lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
                previewRows.forEach((row) => {
                    lines.push(`| ${headers.map((header) => this.stringifyCell(row[header]).replace(/\|/g, '\\|')).join(' | ')} |`);
                });

                if (table.rows.length > previewRows.length) {
                    lines.push('', `_Showing ${previewRows.length} of ${table.rows.length} rows_`);
                }
            });

        return lines.join('\n');
    }

    renderHtmlExport(exportPackage) {
        const summaryCards = exportPackage.summary.map((item) => `
            <div class="card">
                <div class="eyebrow">${item.category}</div>
                <div class="metric">${item.metric}</div>
                <div class="value">${this.stringifyCell(item.value)}</div>
            </div>
        `).join('');

        const sections = exportPackage.tables.map((table) => {
            const previewRows = table.rows.slice(0, 20);
            const headers = Array.from(previewRows.reduce((set, row) => {
                Object.keys(row).forEach((key) => set.add(key));
                return set;
            }, new Set()));

            const head = headers.map((header) => `<th>${header}</th>`).join('');
            const body = previewRows.map((row) => `<tr>${headers.map((header) => `<td>${this.stringifyCell(row[header])}</td>`).join('')}</tr>`).join('');

            return `
                <section>
                    <h2>${table.title}</h2>
                    <table>
                        <thead><tr>${head}</tr></thead>
                        <tbody>${body}</tbody>
                    </table>
                    ${table.rows.length > previewRows.length ? `<p class="note">Showing ${previewRows.length} of ${table.rows.length} rows.</p>` : ''}
                </section>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>infini8Graph Export</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 32px; color: #111827; background: #f8fafc; }
        h1, h2 { margin: 0 0 12px; }
        p { color: #475569; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 24px 0 32px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; }
        .eyebrow { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.08em; margin-bottom: 8px; }
        .metric { font-weight: 700; margin-bottom: 6px; }
        .value { font-size: 20px; color: #0f172a; }
        section { margin: 28px 0; background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 8px 10px; vertical-align: top; }
        th { background: #f8fafc; position: sticky; top: 0; }
        .note { font-size: 12px; color: #64748b; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>Performance Marketing Export</h1>
    <p>Generated ${exportPackage.metadata.generatedAt}</p>
    <p>Metrics: ${exportPackage.metadata.metrics.join(', ')}</p>
    <div class="summary">${summaryCards}</div>
    ${sections}
</body>
</html>`;
    }

    async exportData(format = 'json', metrics = ['overview', 'growth', 'posts'], options = {}) {
        const { startDate = null, endDate = null } = options;
        const { selectedMetrics, data } = await this.collectExportData(metrics, startDate, endDate);
        const exportPackage = this.buildExportPackage(data, selectedMetrics, startDate, endDate);

        switch (format) {
            case 'json':
                return exportPackage;
            case 'csv':
                return this.renderDelimitedExport(exportPackage, ',');
            case 'tsv':
                return this.renderDelimitedExport(exportPackage, '\t');
            case 'md':
                return this.renderMarkdownExport(exportPackage);
            case 'html':
                return this.renderHtmlExport(exportPackage);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    clampDateWindow(startDate = null, endDate = null) {
        const todayStr = new Date().toISOString().split('T')[0];
        return {
            startStr: startDate || '0000-00-00',
            endStr: endDate ? (endDate > todayStr ? todayStr : endDate) : todayStr
        };
    }

    filterMediaByDate(media = [], startDate = null, endDate = null) {
        if (!startDate && !endDate) return media;

        const { startStr, endStr } = this.clampDateWindow(startDate, endDate);

        return media.filter((post) => {
            const postDateStr = (post.timestamp || '').split('T')[0];
            return postDateStr >= startStr && postDateStr <= endStr;
        });
    }

    async getDailyAccountMetrics(startDate = null, endDate = null) {
        const dailyData = {};
        const windows = this.buildAccountInsightWindows(startDate, endDate);

        for (const window of windows) {
            try {
                const rawResponse = await this.instagram.getAccountInsights(
                    'day',
                    ['reach', 'follower_count'],
                    window.since,
                    window.until,
                    'time_series'
                );
                const metricRows = rawResponse?.data || [];

                metricRows.forEach((metric) => {
                    if (!Array.isArray(metric.values) || metric.values.length === 0) return;

                    metric.values.forEach((val) => {
                        const date = (val.end_time || '').split('T')[0];
                        if (!date) return;
                        if (!dailyData[date]) dailyData[date] = { date };
                        const parsedValue = this.parseInsightMetricValue(val.value);
                        dailyData[date][metric.name] = parsedValue;
                    });
                });
            } catch (error) {
                console.warn(
                    `[getDailyAccountMetrics] FAILED for ${window.startDate || 'default'}-${window.endDate || 'default'}:`,
                    error?.message || error
                );
            }
        }

        return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    }

    async getStoryAnalytics() {
        const cached = await this.checkCache('stories', 'current_v3');
        if (cached) return cached;

        let stories = [];
        try {
            stories = await this.instagram.getActiveStoriesWithInsights();
        } catch (error) {
            console.warn('Story insights unavailable:', error.message);
        }
        const analytics = {
            stories: stories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
            summary: {
                activeStories: stories.length,
                totalImpressions: stories.reduce((sum, story) => sum + (story.impressions || 0), 0),
                totalReach: stories.reduce((sum, story) => sum + (story.reach || 0), 0),
                totalReplies: stories.reduce((sum, story) => sum + (story.replies || 0), 0),
                totalTapsForward: stories.reduce((sum, story) => sum + (story.tapsForward || 0), 0),
                totalTapsBack: stories.reduce((sum, story) => sum + (story.tapsBack || 0), 0),
                totalExits: stories.reduce((sum, story) => sum + (story.exits || 0), 0),
                // Story Completion Rate: % of viewers who watched the full story (avg across active stories)
                avgCompletionRate: stories.length > 0
                    ? Number((stories.reduce((sum, story) => sum + (story.completionRate || 0), 0) / stories.length).toFixed(1))
                    : 0,
                // Best story by completion rate
                topStoryByCompletion: stories.length > 0
                    ? [...stories].sort((a, b) => (b.completionRate || 0) - (a.completionRate || 0))[0]?.id || null
                    : null
            },
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('stories', 'current_v3', analytics);
        return analytics;
    }
}

export default AnalyticsService;
