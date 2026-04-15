import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

async function settleWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;

    const runner = async () => {
        while (cursor < items.length) {
            const index = cursor++;
            try {
                results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
            } catch (error) {
                results[index] = { status: 'rejected', reason: error };
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
    return results;
}

/**
 * Instagram Graph API Service
 * Handles all communication with the Instagram Graph API
 */
class InstagramService {
    constructor(accessToken, instagramUserId) {
        this.accessToken = accessToken;
        this.instagramUserId = instagramUserId;
    }

    /**
     * Make a request to the Graph API
     */
    async apiRequest(endpoint, params = {}) {
        try {
            const response = await axios.get(`${GRAPH_API_BASE}${endpoint}`, {
                params: {
                    access_token: this.accessToken,
                    ...params
                }
            });
            return response.data;
        } catch (error) {
            const errData = error.response?.data?.error;
            const isPreBusinessError = errData?.error_subcode === 2108006;
            if (!isPreBusinessError) {
                console.error('Instagram API Error:', error.response?.data || error.message);
            }
            throw new Error(errData?.message || 'Instagram API request failed');
        }
    }

    getInsightValue(insight) {
        return (
            insight?.values?.[0]?.value ??
            insight?.total_value?.value ??
            0
        );
    }

    extractInsightsMap(insights = []) {
        const mapped = {};

        if (!Array.isArray(insights)) return mapped;

        for (const insight of insights) {
            mapped[insight.name] = this.getInsightValue(insight);
        }

        return mapped;
    }

    normaliseMediaNode(node, extraInsights = {}) {
        const baseInsights = this.extractInsightsMap(node?.insights?.data);
        const mergedInsights = { ...baseInsights, ...extraInsights };

        const likeCount = node?.like_count || 0;
        const commentsCount = node?.comments_count || 0;
        const saved = mergedInsights.saved || 0;
        const shares = mergedInsights.shares || 0;
        const views = mergedInsights.views || 0;
        const plays = mergedInsights.plays || views || 0;
        const totalInteractions = mergedInsights.total_interactions || 0;
        const computedEngagement = likeCount + commentsCount + saved + shares;

        const profileActivity = mergedInsights.profile_activity || 0;

        return {
            id: node?.id,
            mediaType: node?.media_type,
            caption: node?.caption || '',
            mediaUrl: node?.media_url,
            thumbnailUrl: node?.thumbnail_url || node?.media_url,
            permalink: node?.permalink,
            timestamp: node?.timestamp,
            likeCount,
            commentsCount,
            impressions: mergedInsights.impressions || views || 0,
            reach: mergedInsights.reach || 0,
            saved,
            shares,
            plays,
            totalInteractions: totalInteractions || computedEngagement,
            engagement: Math.max(totalInteractions, computedEngagement),
            profileActivity,
        };
    }

    /**
     * Get account profile information
     */
    async getProfile() {
        return this.apiRequest(`/${this.instagramUserId}`, {
            fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website'
        });
    }

    /**
     * Get account insights (metrics)
     * @param {string} period - 'day', 'week', 'days_28', or 'lifetime'
     * @param {Array} metrics - Array of metric names
     */
    async getAccountInsights(period = 'day', metrics = [], since = null, until = null, metricType = null, extraParams = {}) {
        const defaultMetrics = [
            'reach',
            'follower_count'
        ];

        const requestMetrics = metrics.length > 0 ? metrics : defaultMetrics;

        const params = {
            metric: requestMetrics.join(','),
            period: period,
            ...extraParams
        };

        // Meta API v18+ requires metric_type for account insights
        // 'time_series' = daily breakdowns, 'total_value' = aggregated total
        if (metricType) {
            params.metric_type = metricType;
        } else if (period === 'day') {
            params.metric_type = 'time_series';
        }

        if (since) params.since = since;
        if (until) params.until = until;

        // Try with metric_type first, fall back without it for older API versions
        try {
            return await this.apiRequest(`/${this.instagramUserId}/insights`, params);
        } catch (err) {
            if (params.metric_type) {
                console.warn(`Account insights failed with metric_type=${params.metric_type}, retrying without it...`);
                delete params.metric_type;
                return this.apiRequest(`/${this.instagramUserId}/insights`, params);
            }
            throw err;
        }
    }

    /**
     * Get follower demographics (comprehensive)
     */
    async getFollowerDemographics() {
        const results = {
            cities: [],
            countries: [],
            genderAge: [],
            locales: [],
            onlineFollowers: []
        };

        const calls = [
            {
                key: 'city',
                request: this.apiRequest(`/${this.instagramUserId}/insights`, {
                    metric: 'follower_demographics',
                    period: 'lifetime',
                    metric_type: 'total_value',
                    breakdown: 'city'
                })
            },
            {
                key: 'country',
                request: this.apiRequest(`/${this.instagramUserId}/insights`, {
                    metric: 'follower_demographics',
                    period: 'lifetime',
                    metric_type: 'total_value',
                    breakdown: 'country'
                })
            },
            {
                key: 'ageGender',
                request: this.apiRequest(`/${this.instagramUserId}/insights`, {
                    metric: 'follower_demographics',
                    period: 'lifetime',
                    metric_type: 'total_value',
                    breakdown: 'age,gender'
                })
            },
            {
                key: 'onlineFollowers',
                request: this.apiRequest(`/${this.instagramUserId}/insights`, {
                    metric: 'online_followers',
                    period: 'lifetime'
                })
            }
        ];

        const settled = await Promise.allSettled(calls.map((call) => call.request));

        settled.forEach((outcome, index) => {
            if (outcome.status !== 'fulfilled') return;
            const key = calls[index].key;
            const payload = outcome.value;

            if (key === 'onlineFollowers') {
                if (payload?.data?.[0]?.values) {
                    results.onlineFollowers = payload.data[0].values;
                }
                return;
            }

            const rows = payload?.data?.[0]?.total_value?.breakdowns?.[0]?.results;
            if (!rows || !Array.isArray(rows)) return;
            const sorted = [...rows].sort((a, b) => (b.value || 0) - (a.value || 0));

            if (key === 'city') {
                results.cities = sorted.slice(0, 10);
            } else if (key === 'country') {
                results.countries = sorted.slice(0, 10);
            } else if (key === 'ageGender') {
                results.genderAge = sorted;
            }
        });

        return results;
    }

    /**
     * Get media (posts) with pagination
     * @param {number} limit - Number of posts to fetch
     * @param {string} after - Cursor for pagination
     */
    async getMedia(limit = 25, after = null) {
        const basicFields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
        // shares is a valid per-media insight but only returned by the /insights edge,
        // NOT via inline insights on the media list endpoint. We fetch it separately.
        const params = {
            fields: `${basicFields},insights.metric(views,reach,saved)`,
            limit: limit
        };

        if (after) {
            params.after = after;
        }

        try {
            return await this.apiRequest(`/${this.instagramUserId}/media`, params);
        } catch (error) {
            // Check for errors that indicate insights are unavailable:
            // - "Invalid parameter" (generic error when insights fail)
            // - "Media posted before business account conversion"
            const errorMsg = error.message || '';
            const isInsightsError = errorMsg.includes('Invalid parameter') ||
                errorMsg.includes('business account') ||
                errorMsg.includes('Unsupported get request');

            if (isInsightsError) {
                console.warn('[getMedia] Inline insights failed, falling back to basic fields:', errorMsg.substring(0, 100));
                // Retry without insights
                const fallbackParams = {
                    fields: basicFields,
                    limit: limit,
                    ...(after && { after })
                };
                return await this.apiRequest(`/${this.instagramUserId}/media`, fallbackParams);
            }

            throw error;
        }
    }

    /**
     * Get shares for a single media item via its /insights edge.
     * Works for IMAGE, VIDEO, CAROUSEL_ALBUM, and REEL.
     * Returns 0 if the metric is unsupported (older posts, pre-business-account, etc.)
     */
    async getMediaShares(mediaId, mediaType = 'IMAGE') {
        // Reels already get shares via getMediaInsights; call this for non-reels
        const metricSets = ['shares', 'views,reach,saved,shares', 'reach,saved,shares'];
        for (const metrics of metricSets) {
            try {
                const result = await this.apiRequest(`/${mediaId}/insights`, { metric: metrics });
                const map = this.extractInsightsMap(result?.data);
                return typeof map.shares === 'number' ? map.shares : 0;
            } catch {
                // unsupported metric for this post — continue
            }
        }
        return 0;
    }

    /**
     * Get tagged media (includes collaboration posts)
     * @param {number} limit - Number of posts to fetch
     */
    async getTaggedMedia(limit = 25) {
        const basicFields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
        
        try {
            const result = await this.apiRequest(`/${this.instagramUserId}/tags`, {
                fields: basicFields,
                limit: limit
            });
            return result;
        } catch (error) {
            console.warn('⚠️ Tagged media fetch failed:', error.message);
            return { data: [] };
        }
    }

    /**
     * Get all media including collaborations
     * Combines owned posts and tagged posts (which includes collabs)
     * @param {number} limit - Number of posts to fetch
     */
    async getAllMediaIncludingCollabs(limit = 100) {
        try {
            // Fetch owned posts
            const ownedResponse = await this.getMedia(limit);
            const ownedPosts = ownedResponse.data || [];

            // Fetch tagged posts (includes collabs)
            const taggedResponse = await this.getTaggedMedia(limit);
            const taggedPosts = taggedResponse.data || [];

            // Combine and deduplicate by ID
            const allPosts = [...ownedPosts];
            const ownedIds = new Set(ownedPosts.map(p => p.id));

            // Add tagged posts that aren't already in owned posts
            let collabCount = 0;
            for (const post of taggedPosts) {
                if (!ownedIds.has(post.id)) {
                    // Mark as collaboration/tagged
                    allPosts.push({
                        ...post,
                        is_collaboration: true
                    });
                    collabCount++;
                }
            }

            // Sort by timestamp (newest first)
            allPosts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return {
                data: allPosts.slice(0, limit),
                owned_count: ownedPosts.length,
                collab_count: collabCount
            };
        } catch (error) {
            console.error('❌ Error fetching all media including collabs:', error);
            // Fallback to just owned posts
            const ownedResponse = await this.getMedia(limit);
            return {
                data: ownedResponse.data || [],
                owned_count: ownedResponse.data?.length || 0,
                collab_count: 0
            };
        }
    }

    /**
     * Get insights for a specific media item
     * @param {string} mediaId - The media ID
     * @param {string} mediaType - 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', or 'REEL'
     */
    async getMediaInsights(mediaId, mediaType = 'IMAGE') {
        const metricSets = (mediaType === 'REEL' || mediaType === 'VIDEO')
            ? [
                'views,reach,saved,shares,total_interactions,profile_activity',
                'views,reach,saved,shares,total_interactions',
                'views,reach,saved,shares',
                'views,reach,saved',
                'reach,saved,shares,total_interactions',
                'reach,saved,shares',
                'reach,saved'
            ]
            : ['views,reach,saved,profile_activity', 'views,reach,saved', 'reach,saved'];

        let lastError = null;

        for (const metrics of metricSets) {
            try {
                return await this.apiRequest(`/${mediaId}/insights`, { metric: metrics });
            } catch (error) {
                lastError = error;
                const message = String(error.message || '').toLowerCase();
                const canRetry =
                    message.includes('invalid parameter') ||
                    message.includes('unsupported') ||
                    message.includes('metric');

                if (!canRetry) {
                    throw error;
                }
            }
        }

        if (lastError) throw lastError;
        return { data: [] };
    }

    /**
     * Get stories
     */
    async getStories() {
        return this.apiRequest(`/${this.instagramUserId}/stories`, {
            fields: 'id,media_type,media_url,thumbnail_url,timestamp'
        });
    }

    /**
     * Get story insights
     * @param {string} storyId - The story media ID
     */
    async getStoryInsights(storyId) {
        const metricSets = [
            'views,reach,replies,taps_forward,taps_back,exits,navigation',
            'views,reach,replies,taps_forward,taps_back,exits',
            'views,reach,taps_forward,taps_back,exits',
            'views,reach,replies',
            'views,reach',
            'reach,replies',
            'reach'
        ];

        let lastError = null;

        for (const metrics of metricSets) {
            try {
                return await this.apiRequest(`/${storyId}/insights`, { metric: metrics });
            } catch (error) {
                lastError = error;
                const message = String(error.message || '').toLowerCase();
                const canRetry =
                    message.includes('invalid parameter') ||
                    message.includes('unsupported') ||
                    message.includes('metric');

                if (!canRetry) {
                    throw error;
                }
            }
        }

        if (lastError) throw lastError;
        return { data: [] };
    }

    /**
     * Get hashtag search results
     * @param {string} hashtag - The hashtag to search (without #)
     */
    async searchHashtag(hashtag) {
        try {
            // First, get the hashtag ID
            const searchResponse = await this.apiRequest('/ig_hashtag_search', {
                user_id: this.instagramUserId,
                q: hashtag
            });

            if (!searchResponse.data || searchResponse.data.length === 0) {
                return null;
            }

            const hashtagId = searchResponse.data[0].id;

            // Get top media for the hashtag
            const topMedia = await this.apiRequest(`/${hashtagId}/top_media`, {
                user_id: this.instagramUserId,
                fields: 'id,caption,media_type,like_count,comments_count,timestamp'
            });

            // Get recent media for the hashtag
            const recentMedia = await this.apiRequest(`/${hashtagId}/recent_media`, {
                user_id: this.instagramUserId,
                fields: 'id,caption,media_type,like_count,comments_count,timestamp'
            });

            return {
                hashtagId,
                hashtag,
                topMedia: topMedia.data || [],
                recentMedia: recentMedia.data || []
            };
        } catch (error) {
            console.error('Hashtag search error:', error.message);
            return null;
        }
    }

    async getAllMediaWithInsights(count = 50, options = {}) {
        const {
            includeDetailedVideoInsights = false,
            detailedInsightConcurrency = 4,
            fetchShares = false
        } = options;
        const allMedia = [];
        let cursor = null;
        let fetched = 0;

        while (fetched < count) {
            const batchSize = Math.min(25, count - fetched);
            const response = await this.getMediaPageWithInsights(batchSize, cursor, {
                includeDetailedVideoInsights,
                detailedInsightConcurrency,
                fetchShares
            });
            const batch = response?.data || [];

            if (batch.length === 0) break;

            allMedia.push(...batch);
            fetched += batch.length;

            if (response?.paging?.cursors?.after) {
                cursor = response.paging.cursors.after;
            } else {
                break;
            }
        }

        return allMedia;
    }

    async getMediaPageWithInsights(limit = 25, after = null, options = {}) {
        const {
            includeDetailedVideoInsights = false,
            detailedInsightConcurrency = 4,
            fetchShares = false
        } = options;

        const response = await this.getMedia(limit, after);
        const rawMedia = response?.data || [];

        if (rawMedia.length === 0) {
            return {
                data: [],
                paging: response?.paging || null
            };
        }

        const normalisedBatch = rawMedia.map((media) => this.normaliseMediaNode(media));

        // If inline insights failed (all reach=0), try fetching insights individually
        const inlineInsightsMissing = normalisedBatch.length > 0 &&
            normalisedBatch.every(m => m.reach === 0 && m.impressions === 0);
        if (inlineInsightsMissing && !includeDetailedVideoInsights) {
            console.warn('[getMediaPageWithInsights] Inline insights returned all zeros — fetching individually');
            await settleWithConcurrency(
                normalisedBatch.map((media, index) => ({ media, index })),
                detailedInsightConcurrency,
                async ({ media, index }) => {
                    try {
                        const detailed = await this.getMediaInsights(media.id, media.mediaType);
                        const detailedInsights = this.extractInsightsMap(detailed?.data);
                        normalisedBatch[index] = {
                            ...media,
                            ...this.normaliseMediaNode(rawMedia[index], detailedInsights),
                        };
                    } catch (err) {
                        console.warn(`  Individual insights failed for ${media.id}:`, err.message?.substring(0, 80));
                    }
                }
            );
        }

        if (includeDetailedVideoInsights) {
            // For REELs/VIDEO: full getMediaInsights already returns shares
            const videoItems = normalisedBatch
                .map((media, index) => ({ media, index }))
                .filter(({ media }) => media.mediaType === 'REEL' || media.mediaType === 'VIDEO');

            await settleWithConcurrency(videoItems, detailedInsightConcurrency, async ({ media, index }) => {
                try {
                    const detailed = await this.getMediaInsights(media.id, media.mediaType);
                    const detailedInsights = this.extractInsightsMap(detailed?.data);
                    normalisedBatch[index] = {
                        ...media,
                        ...this.normaliseMediaNode(rawMedia[index], detailedInsights),
                    };
                } catch (error) {
                    console.warn(`Detailed insights unavailable for media ${media.id}:`, error.message);
                }
            });

            // For non-video posts in this batch, fetch shares separately
            if (fetchShares) {
                const nonVideoItems = normalisedBatch
                    .map((media, index) => ({ media, index }))
                    .filter(({ media }) => media.mediaType !== 'REEL' && media.mediaType !== 'VIDEO');
                await settleWithConcurrency(nonVideoItems, detailedInsightConcurrency, async ({ media, index }) => {
                    try {
                        const shares = await this.getMediaShares(media.id, media.mediaType);
                        if (shares > 0) normalisedBatch[index] = { ...normalisedBatch[index], shares };
                    } catch { /* non-fatal */ }
                });
            }
        } else if (fetchShares) {
            // shares is NEVER returned in the inline media list response.
            // It must be fetched from /{media_id}/insights for every post.
            // This is the root cause of shares always being 0 on overview/growth.
            const allItems = normalisedBatch.map((media, index) => ({ media, index }));
            await settleWithConcurrency(allItems, 4, async ({ media, index }) => {
                try {
                    const shares = await this.getMediaShares(media.id, media.mediaType);
                    if (shares > 0) normalisedBatch[index] = { ...normalisedBatch[index], shares };
                } catch { /* non-fatal — leave shares as 0 */ }
            });
        }

        return {
            data: normalisedBatch,
            paging: response?.paging || null
        };
    }

    async getActiveStoriesWithInsights() {
        const response = await this.getStories();
        const rawStories = response?.data || [];

        if (rawStories.length === 0) {
            return [];
        }

        const settled = await Promise.allSettled(
            rawStories.map((story) => this.getStoryInsights(story.id))
        );

        return rawStories.map((story, index) => {
            const storyInsights = settled[index].status === 'fulfilled'
                ? this.extractInsightsMap(settled[index].value?.data)
                : {};

            // navigation insight is an object: { swipe_forward, tap_back, tap_exit, tap_replay }
            const navigation = storyInsights.navigation || {};
            const tapReplay = typeof navigation === 'object' ? (navigation.tap_replay || 0) : 0;
            const swipeForward = typeof navigation === 'object' ? (navigation.swipe_forward || 0) : 0;

            const impressions = storyInsights.impressions || storyInsights.views || 0;
            const reach = storyInsights.reach || 0;
            const tapsForward = storyInsights.taps_forward || swipeForward || 0;
            const tapsBack = storyInsights.taps_back || 0;
            const exits = storyInsights.exits || 0;

            // Completion rate: viewers who did NOT exit early
            // Approximation: (reach - exits) / reach
            const completionRate = reach > 0 ? Number((((reach - exits) / reach) * 100).toFixed(1)) : 0;

            return {
                id: story.id,
                mediaType: story.media_type,
                mediaUrl: story.media_url,
                thumbnailUrl: story.thumbnail_url || story.media_url,
                timestamp: story.timestamp,
                impressions,
                reach,
                replies: storyInsights.replies || 0,
                tapsForward,
                tapsBack,
                exits,
                tapReplay,
                completionRate,
            };
        });
    }

    /**
     * Fetch reach breakdown by follow_type for a reel to calculate virality score.
     * Returns { follower: number, non_follower: number } or null if unsupported.
     */
    async getReelReachByFollowType(mediaId) {
        try {
            const result = await this.apiRequest(`/${mediaId}/insights`, {
                metric: 'reach',
                breakdown: 'follow_type'
            });
            const breakdowns = result?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
            const map = {};
            breakdowns.forEach(b => {
                const key = (b.dimension_values?.[0] || '').toLowerCase();
                map[key] = b.value || 0;
            });
            return {
                follower: map['follower'] || 0,
                nonFollower: map['non_follower'] || map['non-follower'] || 0
            };
        } catch {
            return null;
        }
    }
}

export default InstagramService;
