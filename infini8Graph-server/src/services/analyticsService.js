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
    best_time: 600,
    hashtags: 600
};

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

    /**
     * Get overview analytics (dashboard main metrics)
     */
    async getOverview(startDate = null, endDate = null) {
        // Build a cache key that includes the dates
        const dateKey = `${startDate || 'default'}_${endDate || 'default'}`;
        
        // Check cache first
        const cached = await this.checkCache('overview', dateKey);
        if (cached) return cached;

        // Fetch profile first (most basic permission)
        let profile;
        try {
            profile = await this.instagram.getProfile();
            console.log('✅ Profile fetched successfully for:', profile.username);
        } catch (profileError) {
            console.error('❌ Failed to fetch profile:', profileError.message);
            throw new Error('Cannot fetch Instagram profile. Please re-authenticate with the required permissions.');
        }

        // Fetch media and demographics with graceful fallback
        let media = [];
        let demographics = {};

        try {
            // Fetch more media if a date range is provided to increase coverage
            const fetchLimit = (startDate || endDate) ? 200 : 100;
            media = await this.instagram.getAllMediaWithInsights(fetchLimit);
            console.log(`✅ Media fetched successfully: ${media.length} posts (limit: ${fetchLimit})`);

            // Filter media by date range if provided
            if (startDate || endDate) {
                // Normalize dates to YYYY-MM-DD for comparison
                const startStr = startDate ? startDate : '0000-00-00';
                const todayStr = new Date().toISOString().split('T')[0];
                const endStr = endDate ? (endDate > todayStr ? todayStr : endDate) : todayStr;

                media = media.filter(post => {
                    const postDateStr = post.timestamp.split('T')[0];
                    return postDateStr >= startStr && postDateStr <= endStr;
                });
                console.log(`📅 Filtered to ${media.length} posts for range ${startStr} → ${endStr}`);
            }
        } catch (mediaError) {
            console.warn('⚠️ Media fetch failed (permission issue?):', mediaError.message);
            console.warn('⚠️ Continuing with basic profile data only...');
        }

        try {
            demographics = await this.instagram.getFollowerDemographics();
            console.log('✅ Demographics fetched successfully');
        } catch (demoError) {
            console.warn('⚠️ Demographics fetch failed (permission issue?):', demoError.message);
        }

        // Calculate engagement rate
        const totalEngagement = media.reduce((sum, post) => sum + post.engagement, 0);
        const avgEngagement = media.length > 0 ? totalEngagement / media.length : 0;
        const engagementRate = profile.followers_count > 0
            ? (avgEngagement / profile.followers_count * 100).toFixed(2)
            : 0;

        // Calculate metrics
        const totalImpressions = media.reduce((sum, post) => sum + post.impressions, 0);
        const totalReach = media.reduce((sum, post) => sum + post.reach, 0);
        const totalLikes = media.reduce((sum, post) => sum + post.likeCount, 0);
        const totalComments = media.reduce((sum, post) => sum + post.commentsCount, 0);
        const totalSaved = media.reduce((sum, post) => sum + post.saved, 0);

        // Get recent posts performance
        const recentPosts = media.slice(0, 10).map(post => ({
            id: post.id,
            type: post.mediaType,
            likes: post.likeCount,
            comments: post.commentsCount,
            engagement: post.engagement,
            timestamp: post.timestamp,
            thumbnailUrl: post.thumbnailUrl || post.mediaUrl
        }));

        // Get daily metrics using account insights API for the date range
        let dailyMetrics = [];
        try {
            let since = null;
            let until = null;
            
            if (startDate) since = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
            if (endDate) {
                // To get full day of endDate, set it to the end of that day
                const end = new Date(endDate + 'T23:59:59Z');
                until = Math.floor(end.getTime() / 1000);
            }
            
            // Meta allows up to 30 days for period='day'
            const insightsRes = await this.instagram.getAccountInsights('day', ['follower_count', 'impressions', 'reach', 'profile_views'], since, until);
            
            if (insightsRes && insightsRes.data) {
                // process the daily metrics
                const dailyData = {};
                insightsRes.data.forEach(metric => {
                    const metricName = metric.name;
                    if (metric.values && Array.isArray(metric.values)) {
                        metric.values.forEach(val => {
                            const date = (val.end_time || '').split('T')[0];
                            if (date) {
                                if (!dailyData[date]) dailyData[date] = { date };
                                dailyData[date][metricName] = val.value || 0;
                            }
                        });
                    }
                });
                dailyMetrics = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
            }
        } catch (e) {
            console.warn('⚠️ Account insights fetch failed (period=day):', e.message);
        }

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
                totalImpressions,
                totalReach,
                totalSaved
            },
            demographics: demographics || {},
            recentPosts,
            dailyMetrics, // <-- Exposing daily metrics here
            lastUpdated: new Date().toISOString()
        };

        // Cache the result with the specific date range
        await this.updateCache('overview', dateKey, overview);

        return overview;
    }

    /**
     * Get growth analytics
     */
    async getGrowth(startDate = null, endDate = null) {
        const dateKey = `${startDate || 'default'}_${endDate || 'default'}`;
        const cached = await this.checkCache('growth', dateKey);
        if (cached) return cached;

        const profile = await this.instagram.getProfile();
        // Fetch more to ensure we have enough after filtering
        const fetchLimit = (startDate || endDate) ? 200 : 100;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit);

        // Filter by date range
        if (startDate || endDate) {
            const startStr = startDate ? startDate : '0000-00-00';
            const todayStr = new Date().toISOString().split('T')[0];
            const endStr = endDate ? (endDate > todayStr ? todayStr : endDate) : todayStr;

            media = media.filter(post => {
                const postDateStr = (post.timestamp || "").split('T')[0];
                return postDateStr >= startStr && postDateStr <= endStr;
            });
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

        // Calculate growth trends
        const dates = Object.keys(postsByDate).sort();
        const growthData = dates.map(date => ({
            date,
            posts: postsByDate[date],
            engagement: engagementByDate[date].total,
            likes: engagementByDate[date].likes,
            comments: engagementByDate[date].comments
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

        const growth = {
            currentFollowers: profile.followers_count,
            currentFollowing: profile.follows_count,
            totalPosts: profile.media_count,
            growthData,
            weeklyStats: {
                postsThisWeek: thisWeekPosts.length,
                engagementThisWeek: thisWeekEngagement,
                engagementChange: parseFloat(engagementChange),
                avgEngagementPerPost: thisWeekPosts.length > 0
                    ? Math.round(thisWeekEngagement / thisWeekPosts.length)
                    : 0
            },
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
        const fetchLimit = (startDate || endDate) ? 200 : 100;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit);

        // Filter by date range
        if (startDate || endDate) {
            const startStr = startDate ? startDate : '0000-00-00';
            const todayStr = new Date().toISOString().split('T')[0];
            const endStr = endDate ? (endDate > todayStr ? todayStr : endDate) : todayStr;

            media = media.filter(post => {
                const postDateStr = (post.timestamp || "").split('T')[0];
                return postDateStr >= startStr && postDateStr <= endStr;
            });
        }

        // Analyze by hour and day of week
        const hourlyEngagement = {};
        const dailyEngagement = {};
        const hourlyCount = {};
        const dailyCount = {};

        for (let i = 0; i < 24; i++) {
            hourlyEngagement[i] = 0;
            hourlyCount[i] = 0;
        }

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => {
            dailyEngagement[day] = 0;
            dailyCount[day] = 0;
        });

        media.forEach(post => {
            const date = new Date(post.timestamp);
            const hour = date.getHours();
            const day = days[date.getDay()];

            hourlyEngagement[hour] += post.engagement;
            hourlyCount[hour]++;
            dailyEngagement[day] += post.engagement;
            dailyCount[day]++;
        });

        // Calculate averages
        const hourlyAvg = Object.keys(hourlyEngagement).map(hour => ({
            hour: parseInt(hour),
            avgEngagement: hourlyCount[hour] > 0
                ? Math.round(hourlyEngagement[hour] / hourlyCount[hour])
                : 0,
            postCount: hourlyCount[hour]
        }));

        const dailyAvg = days.map(day => ({
            day,
            avgEngagement: dailyCount[day] > 0
                ? Math.round(dailyEngagement[day] / dailyCount[day])
                : 0,
            postCount: dailyCount[day]
        }));

        // Find best times
        const sortedHours = [...hourlyAvg].sort((a, b) => b.avgEngagement - a.avgEngagement);
        const sortedDays = [...dailyAvg].sort((a, b) => b.avgEngagement - a.avgEngagement);

        const bestTime = {
            hourlyAnalysis: hourlyAvg,
            dailyAnalysis: dailyAvg,
            recommendations: {
                bestHours: sortedHours.slice(0, 3).map(h => h.hour),
                bestDays: sortedDays.slice(0, 3).map(d => d.day),
                optimalPostingTimes: sortedHours.slice(0, 3).map(h => ({
                    hour: h.hour,
                    engagement: h.avgEngagement,
                    formatted: `${h.hour.toString().padStart(2, '0')}:00`
                }))
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
        const fetchLimit = (startDate || endDate) ? 200 : 100;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit);

        // Filter by date range
        if (startDate || endDate) {
            const startStr = startDate ? startDate : '0000-00-00';
            const todayStr = new Date().toISOString().split('T')[0];
            const endStr = endDate ? (endDate > todayStr ? todayStr : endDate) : todayStr;

            media = media.filter(post => {
                const postDateStr = (post.timestamp || "").split('T')[0];
                return postDateStr >= startStr && postDateStr <= endStr;
            });
        }

        // Extract hashtags from captions
        const hashtagStats = {};

        media.forEach(post => {
            const hashtags = (post.caption || '').match(/#\w+/g) || [];
            hashtags.forEach(tag => {
                const normalizedTag = tag.toLowerCase();
                if (!hashtagStats[normalizedTag]) {
                    hashtagStats[normalizedTag] = {
                        tag: normalizedTag,
                        usageCount: 0,
                        totalEngagement: 0,
                        totalLikes: 0,
                        totalComments: 0,
                        posts: []
                    };
                }
                hashtagStats[normalizedTag].usageCount++;
                hashtagStats[normalizedTag].totalEngagement += post.engagement;
                hashtagStats[normalizedTag].totalLikes += post.likeCount;
                hashtagStats[normalizedTag].totalComments += post.commentsCount;
                hashtagStats[normalizedTag].posts.push(post.id);
            });
        });

        // Calculate averages and sort
        const hashtagList = Object.values(hashtagStats)
            .map(h => ({
                ...h,
                avgEngagement: Math.round(h.totalEngagement / h.usageCount),
                avgLikes: Math.round(h.totalLikes / h.usageCount),
                avgComments: Math.round(h.totalComments / h.usageCount)
            }))
            .sort((a, b) => b.avgEngagement - a.avgEngagement);

        // Calculate reach attribution per hashtag (which hashtags expand reach)
        const hashtagReachAttribution = hashtagList.map(h => {
            const postsWithTag = media.filter(p => (p.caption || '').toLowerCase().includes(h.tag));
            const avgReach = postsWithTag.length > 0
                ? postsWithTag.reduce((sum, p) => sum + p.reach, 0) / postsWithTag.length
                : 0;
            const overallAvgReach = media.length > 0
                ? media.reduce((sum, p) => sum + p.reach, 0) / media.length
                : 0;
            return {
                tag: h.tag,
                avgReach: Math.round(avgReach),
                reachMultiplier: overallAvgReach > 0 ? (avgReach / overallAvgReach).toFixed(2) : 0,
                usageCount: h.usageCount
            };
        }).sort((a, b) => parseFloat(b.reachMultiplier) - parseFloat(a.reachMultiplier));

        const hashtags = {
            topPerforming: hashtagList.slice(0, 20),
            mostUsed: [...hashtagList].sort((a, b) => b.usageCount - a.usageCount).slice(0, 20),
            reachExpanders: hashtagReachAttribution.filter(h => parseFloat(h.reachMultiplier) > 1).slice(0, 10),
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
        // Fetch more to ensure we have enough after filtering
        const fetchLimit = (startDate || endDate) ? 200 : 100;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit);

        // Filter by date range
        if (startDate || endDate) {
            const startStr = startDate ? startDate : '0000-00-00';
            const todayStr = new Date().toISOString().split('T')[0];
            const endStr = endDate ? (endDate > todayStr ? todayStr : endDate) : todayStr;

            media = media.filter(post => {
                const postDateStr = (post.timestamp || "").split('T')[0];
                return postDateStr >= startStr && postDateStr <= endStr;
            });
        }

        // ============ 1. CONTENT FORMAT BATTLE ============
        const formatStats = {};
        const formats = ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REEL'];

        formats.forEach(format => {
            const posts = media.filter(p => p.mediaType === format);
            if (posts.length === 0) {
                formatStats[format] = null;
                return;
            }

            const totalEngagement = posts.reduce((s, p) => s + p.engagement, 0);
            const totalReach = posts.reduce((s, p) => s + p.reach, 0);
            const totalSaved = posts.reduce((s, p) => s + p.saved, 0);

            formatStats[format] = {
                count: posts.length,
                totalEngagement,
                avgEngagement: Math.round(totalEngagement / posts.length),
                avgReach: Math.round(totalReach / posts.length),
                avgSaved: Math.round(totalSaved / posts.length),
                engagementRate: profile.followers_count > 0
                    ? ((totalEngagement / posts.length) / profile.followers_count * 100).toFixed(2)
                    : 0
            };
        });

        // Determine winning format
        const formatRanking = Object.entries(formatStats)
            .filter(([_, stats]) => stats !== null)
            .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)
            .map(([format, stats], idx) => ({ format, ...stats, rank: idx + 1 }));

        // ============ 2. CAPTION LENGTH ANALYSIS ============
        const captionBuckets = {
            'short': { min: 0, max: 50, posts: [], label: '0-50 chars' },
            'medium': { min: 51, max: 150, posts: [], label: '51-150 chars' },
            'long': { min: 151, max: 300, posts: [], label: '151-300 chars' },
            'veryLong': { min: 301, max: Infinity, posts: [], label: '300+ chars' }
        };

        media.forEach(post => {
            const len = (post.caption || '').length;
            if (len <= 50) captionBuckets.short.posts.push(post);
            else if (len <= 150) captionBuckets.medium.posts.push(post);
            else if (len <= 300) captionBuckets.long.posts.push(post);
            else captionBuckets.veryLong.posts.push(post);
        });

        const captionAnalysis = Object.entries(captionBuckets).map(([key, bucket]) => ({
            bucket: key,
            label: bucket.label,
            count: bucket.posts.length,
            avgEngagement: bucket.posts.length > 0
                ? Math.round(bucket.posts.reduce((s, p) => s + p.engagement, 0) / bucket.posts.length)
                : 0,
            avgReach: bucket.posts.length > 0
                ? Math.round(bucket.posts.reduce((s, p) => s + p.reach, 0) / bucket.posts.length)
                : 0
        })).sort((a, b) => b.avgEngagement - a.avgEngagement);

        const optimalCaptionLength = captionAnalysis.length > 0 ? captionAnalysis[0].label : 'N/A';

        // ============ 3. VIRAL COEFFICIENT (Shares/Reach) ============
        // Note: Instagram API doesn't provide shares for all post types, use saves as proxy
        const viralPosts = media.map(post => ({
            id: post.id,
            viralCoefficient: post.reach > 0 ? (post.saved / post.reach).toFixed(4) : 0,
            shareability: post.reach > 0 ? ((post.saved + post.commentsCount) / post.reach * 100).toFixed(2) : 0,
            saved: post.saved,
            reach: post.reach,
            type: post.mediaType
        })).sort((a, b) => parseFloat(b.viralCoefficient) - parseFloat(a.viralCoefficient));

        const avgViralCoefficient = media.length > 0
            ? (viralPosts.reduce((s, p) => s + parseFloat(p.viralCoefficient), 0) / media.length).toFixed(4)
            : 0;

        // ============ 4. SAVE-TO-LIKE RATIO ============
        const saveToLikeAnalysis = media.map(post => ({
            id: post.id,
            saveToLikeRatio: post.likeCount > 0 ? (post.saved / post.likeCount).toFixed(3) : 0,
            saved: post.saved,
            likes: post.likeCount,
            type: post.mediaType,
            isHighValue: post.likeCount > 0 && (post.saved / post.likeCount) > 0.05 // 5%+ is high value
        })).sort((a, b) => parseFloat(b.saveToLikeRatio) - parseFloat(a.saveToLikeRatio));

        const avgSaveToLikeRatio = media.length > 0
            ? (saveToLikeAnalysis.reduce((s, p) => s + parseFloat(p.saveToLikeRatio), 0) / media.length).toFixed(3)
            : 0;

        const highValueContentCount = saveToLikeAnalysis.filter(p => p.isHighValue).length;

        // ============ 5. FIRST HOUR PERFORMANCE / ENGAGEMENT VELOCITY ============
        // Calculate hours since post and engagement velocity
        const now = new Date();
        const velocityAnalysis = media.map(post => {
            const postDate = new Date(post.timestamp);
            const hoursSincePost = Math.max(1, (now - postDate) / (1000 * 60 * 60));
            const engagementVelocity = post.engagement / hoursSincePost;

            return {
                id: post.id,
                hoursSincePost: Math.round(hoursSincePost),
                engagement: post.engagement,
                engagementVelocity: engagementVelocity.toFixed(2),
                type: post.mediaType,
                timestamp: post.timestamp
            };
        }).sort((a, b) => parseFloat(b.engagementVelocity) - parseFloat(a.engagementVelocity));

        // Identify "fast starters" (high velocity in first 24 hours)
        const recentPosts = velocityAnalysis.filter(p => p.hoursSincePost <= 24);
        const fastStarters = recentPosts.filter(p => parseFloat(p.engagementVelocity) > 10);

        // ============ 6. CONTENT QUALITY SCORE ============
        // Composite score based on all metrics with detailed breakdown
        const contentScores = media.map(post => {
            const engagementScore = post.engagement / Math.max(profile.followers_count, 1) * 1000;
            const reachScore = post.reach / Math.max(profile.followers_count, 1) * 100;
            const saveScore = post.saved * 10; // Saves are valuable
            const viralScore = post.reach > 0 ? (post.saved / post.reach) * 1000 : 0;
            const commentScore = post.commentsCount * 20; // Comments indicate deeper engagement

            const totalScore = (engagementScore * 0.25) + (reachScore * 0.25) + (saveScore * 0.2) + (viralScore * 0.15) + (commentScore * 0.15);

            // Determine strongest factor
            const factors = [
                { name: 'High Engagement', score: engagementScore, threshold: 50 },
                { name: 'Wide Reach', score: reachScore, threshold: 50 },
                { name: 'High Saves', score: saveScore, threshold: 30 },
                { name: 'Viral Potential', score: viralScore, threshold: 20 },
                { name: 'Discussion Driver', score: commentScore, threshold: 20 }
            ];
            const topFactors = factors.filter(f => f.score >= f.threshold).sort((a, b) => b.score - a.score).slice(0, 2);

            return {
                id: post.id,
                qualityScore: Math.round(totalScore),
                type: post.mediaType,
                thumbnail: post.thumbnailUrl || post.mediaUrl,
                caption: (post.caption || '').substring(0, 100) + ((post.caption?.length > 100) ? '...' : ''),
                permalink: post.permalink,
                timestamp: post.timestamp,
                engagement: post.engagement,
                likes: post.likeCount,
                comments: post.commentsCount,
                reach: post.reach,
                saved: post.saved,
                // Why it scored well
                scoreBreakdown: {
                    engagementScore: Math.round(engagementScore),
                    reachScore: Math.round(reachScore),
                    saveScore: Math.round(saveScore),
                    viralScore: Math.round(viralScore),
                    commentScore: Math.round(commentScore)
                },
                topFactors: topFactors.map(f => f.name),
                insight: topFactors.length > 0
                    ? `Strong: ${topFactors.map(f => f.name).join(', ')}`
                    : 'Average performer'
            };
        }).sort((a, b) => b.qualityScore - a.qualityScore);

        const avgQualityScore = media.length > 0
            ? Math.round(contentScores.reduce((s, p) => s + p.qualityScore, 0) / media.length)
            : 0;

        const intelligence = {
            formatBattle: {
                stats: formatStats,
                ranking: formatRanking,
                winner: formatRanking.length > 0 ? formatRanking[0].format : null,
                insight: formatRanking.length > 0
                    ? `${formatRanking[0].format} outperforms other formats with ${formatRanking[0].avgEngagement} avg engagement`
                    : 'Not enough data'
            },
            captionAnalysis: {
                buckets: captionAnalysis,
                optimalLength: optimalCaptionLength,
                insight: `Posts with ${optimalCaptionLength} captions perform best`
            },
            viralCoefficient: {
                average: parseFloat(avgViralCoefficient),
                topViral: viralPosts.slice(0, 5),
                insight: parseFloat(avgViralCoefficient) > 0.01 ? 'Good shareability' : 'Consider creating more shareable content'
            },
            saveToLike: {
                average: parseFloat(avgSaveToLikeRatio),
                highValueCount: highValueContentCount,
                topHighValue: saveToLikeAnalysis.slice(0, 5),
                insight: `${highValueContentCount} posts are high-value reference content (5%+ save rate)`
            },
            engagementVelocity: {
                topPerformers: velocityAnalysis.slice(0, 5),
                fastStarters: fastStarters.length,
                insight: `${fastStarters.length} recent posts gained traction quickly`
            },
            contentQuality: {
                averageScore: avgQualityScore,
                topContent: contentScores.slice(0, 5),
                bottomContent: contentScores.slice(-3),
                distribution: {
                    excellent: contentScores.filter(p => p.qualityScore >= 80).length,
                    good: contentScores.filter(p => p.qualityScore >= 50 && p.qualityScore < 80).length,
                    average: contentScores.filter(p => p.qualityScore >= 20 && p.qualityScore < 50).length,
                    poor: contentScores.filter(p => p.qualityScore < 20).length
                }
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
    async getReelsAnalytics(startDate = null, endDate = null) {
        const dateKey = `${startDate || 'default'}_${endDate || 'default'}`;
        const cached = await this.checkCache('reels', dateKey);
        if (cached) return cached;

        // Fetch more to ensure we have enough after filtering
        const fetchLimit = (startDate || endDate) ? 200 : 100;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit);

        // Filter by date range
        if (startDate || endDate) {
            const startStr = startDate ? startDate : '0000-00-00';
            const todayStr = new Date().toISOString().split('T')[0];
            const endStr = endDate ? (endDate > todayStr ? todayStr : endDate) : todayStr;

            media = media.filter(post => {
                const postDateStr = (post.timestamp || "").split('T')[0];
                return postDateStr >= startStr && postDateStr <= endStr;
            });
        }

        // Filter for reels only
        const reels = media.filter(m => m.mediaType === 'REEL' || m.mediaType === 'VIDEO');
        const nonReels = media.filter(m => m.mediaType !== 'REEL' && m.mediaType !== 'VIDEO');

        // Calculate reel-specific metrics
        const reelStats = {
            totalReels: reels.length,
            totalEngagement: reels.reduce((sum, r) => sum + r.engagement, 0),
            totalLikes: reels.reduce((sum, r) => sum + r.likeCount, 0),
            totalComments: reels.reduce((sum, r) => sum + r.commentsCount, 0),
            totalImpressions: reels.reduce((sum, r) => sum + r.impressions, 0),
            totalReach: reels.reduce((sum, r) => sum + r.reach, 0)
        };

        const nonReelStats = {
            totalPosts: nonReels.length,
            avgEngagement: nonReels.length > 0
                ? Math.round(nonReels.reduce((sum, p) => sum + p.engagement, 0) / nonReels.length)
                : 0
        };

        const analytics = {
            reels: reels.map(r => ({
                id: r.id,
                thumbnail: r.thumbnailUrl || r.mediaUrl,
                likes: r.likeCount,
                comments: r.commentsCount,
                engagement: r.engagement,
                impressions: r.impressions,
                reach: r.reach,
                timestamp: r.timestamp
            })),
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
                    : 0
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
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('reels', dateKey, analytics);
        return analytics;
    }

    /**
     * Get detailed post analytics
     */
    async getPostsAnalytics(limit = 50, startDate = null, endDate = null) {
        const dateKey = `${startDate || 'default'}_${endDate || 'default'}`;
        const cached = await this.checkCache('posts', dateKey);
        if (cached) return cached;

        // Fetch more to ensure we have enough after filtering
        const fetchLimit = (startDate || endDate) ? 200 : 100;
        let media = await this.instagram.getAllMediaWithInsights(fetchLimit);

        // Filter by date range
        if (startDate || endDate) {
            const startStr = startDate ? startDate : '0000-00-00';
            const todayStr = new Date().toISOString().split('T')[0];
            const endStr = endDate ? (endDate > todayStr ? todayStr : endDate) : todayStr;

            media = media.filter(post => {
                const postDateStr = (post.timestamp || "").split('T')[0];
                return postDateStr >= startStr && postDateStr <= endStr;
            });
        }

        // Limit results to the requested amount after filtering
        media = media.slice(0, limit);

        // Sort by different metrics
        const byEngagement = [...media].sort((a, b) => b.engagement - a.engagement);
        const byLikes = [...media].sort((a, b) => b.likeCount - a.likeCount);
        const byComments = [...media].sort((a, b) => b.commentsCount - a.commentsCount);
        const byReach = [...media].sort((a, b) => b.reach - a.reach);

        const posts = {
            all: media.map(p => ({
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
                    : 0
            },
            lastUpdated: new Date().toISOString()
        };

        await this.updateCache('posts', dateKey, posts);
        return posts;
    }

    /**
     * Export analytics data in various formats
     */
    async exportData(format = 'json', metrics = ['overview', 'growth', 'posts']) {
        const data = {};

        for (const metric of metrics) {
            switch (metric) {
                case 'overview':
                    data.overview = await this.getOverview();
                    break;
                case 'growth':
                    data.growth = await this.getGrowth();
                    break;
                case 'posts':
                    data.posts = await this.getPostsAnalytics();
                    break;
                case 'reels':
                    data.reels = await this.getReelsAnalytics();
                    break;
                case 'bestTime':
                    data.bestTime = await this.getBestTimeToPost();
                    break;
                case 'hashtags':
                    data.hashtags = await this.getHashtagAnalysis();
                    break;
            }
        }

        if (format === 'csv') {
            return this.convertToCSV(data);
        }

        return data;
    }

    /**
     * Convert data to CSV format
     */
    convertToCSV(data) {
        const csvSections = {};

        if (data.overview) {
            const metrics = data.overview.metrics;
            csvSections.overview = 'Metric,Value\n' +
                Object.entries(metrics).map(([k, v]) => `${k},${v}`).join('\n');
        }

        if (data.posts?.all) {
            const headers = 'ID,Type,Likes,Comments,Engagement,Reach,Timestamp';
            const rows = data.posts.all.map(p =>
                `${p.id},${p.type},${p.likes},${p.comments},${p.engagement},${p.reach},${p.timestamp}`
            );
            csvSections.posts = headers + '\n' + rows.join('\n');
        }

        return csvSections;
    }
}

export default AnalyticsService;
