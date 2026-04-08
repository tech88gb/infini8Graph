import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

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
    async getAccountInsights(period = 'day', metrics = [], since = null, until = null) {
        const defaultMetrics = [
            'impressions',
            'reach',
            'profile_views',
            'follower_count'
        ];

        const requestMetrics = metrics.length > 0 ? metrics : defaultMetrics;

        const params = {
            metric: requestMetrics.join(','),
            period: period
        };

        if (since) params.since = since;
        if (until) params.until = until;

        return this.apiRequest(`/${this.instagramUserId}/insights`, params);
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
        const params = {
            fields: `${basicFields},insights.metric(impressions,reach,saved)`,
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
        let metrics;

        if (mediaType === 'REEL' || mediaType === 'VIDEO') {
            // Valid metrics for Reels/Video: impressions, reach, plays, saved, likes, comments, shares, total_interactions
            metrics = 'impressions,reach,saved,plays,total_interactions';
        } else if (mediaType === 'CAROUSEL_ALBUM') {
            // Valid metrics for Carousel
            metrics = 'impressions,reach,saved';
        } else {
            // Valid metrics for Images
            metrics = 'impressions,reach,saved';
        }

        return this.apiRequest(`/${mediaId}/insights`, {
            metric: metrics
        });
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
        return this.apiRequest(`/${storyId}/insights`, {
            metric: 'impressions,reach,replies,taps_forward,taps_back,exits'
        });
    }

    /**
     * Get all media with full insights (batch processing)
     * @param {number} count - Total number of posts to fetch
     */
    async getAllMediaWithInsights(count = 50) {
        const allMedia = [];
        let cursor = null;
        let fetched = 0;

        while (fetched < count) {
            const batchSize = Math.min(25, count - fetched);
            const response = await this.getMedia(batchSize, cursor);

            if (!response.data || response.data.length === 0) break;

            // Process each media item to get detailed insights
            for (const media of response.data) {
                try {
                    // Extract insights from the nested structure
                    const insights = {};
                    if (media.insights && media.insights.data) {
                        for (const insight of media.insights.data) {
                            insights[insight.name] = insight.values[0]?.value || 0;
                        }
                    }

                    allMedia.push({
                        id: media.id,
                        caption: media.caption || '',
                        mediaType: media.media_type,
                        mediaUrl: media.media_url,
                        thumbnailUrl: media.thumbnail_url,
                        permalink: media.permalink,
                        timestamp: media.timestamp,
                        likeCount: media.like_count || 0,
                        commentsCount: media.comments_count || 0,
                        impressions: insights.impressions || 0,
                        reach: insights.reach || 0,
                        engagement: insights.engagement || (media.like_count || 0) + (media.comments_count || 0),
                        saved: insights.saved || 0,
                        shares: insights.shares || 0
                    });
                } catch (err) {
                    console.warn(`Failed to process media ${media.id}:`, err.message);
                }
            }

            fetched += response.data.length;

            if (response.paging?.cursors?.after) {
                cursor = response.paging.cursors.after;
            } else {
                break;
            }
        }

        return allMedia;
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

    /**
     * Get all media with normalised insight fields.
     * Used by AnalyticsService.getPostsAnalytics() and anywhere that needs
     * a consistent camelCase shape with computed engagement.
     *
     * Raw API field → normalised field:
     *   media_type       → mediaType
     *   media_url        → mediaUrl
     *   thumbnail_url    → thumbnailUrl
     *   like_count       → likeCount
     *   comments_count   → commentsCount
     *   insights.data[]  → impressions, reach, saved (extracted)
     *   computed         → engagement = likes + comments + saved
     */
    async getAllMediaWithInsights(limit = 50) {
        const response = await this.getMedia(limit);
        const rawPosts = response?.data || [];

        return rawPosts.map(p => {
            let impressions = 0, reach = 0, saved = 0;

            // Insights come back as nested { data: [{ name, values: [{value}] }] }
            if (Array.isArray(p.insights?.data)) {
                for (const insight of p.insights.data) {
                    const val =
                        insight?.values?.[0]?.value ??    // period-based
                        insight?.total_value?.value ??    // total_value style
                        0;
                    if (insight.name === 'impressions') impressions = val;
                    else if (insight.name === 'reach')  reach = val;
                    else if (insight.name === 'saved')  saved = val;
                }
            }

            const likeCount     = p.like_count     || 0;
            const commentsCount = p.comments_count || 0;
            const engagement    = likeCount + commentsCount + saved;

            return {
                id:            p.id,
                mediaType:     p.media_type,
                caption:       p.caption || '',
                mediaUrl:      p.media_url,
                thumbnailUrl:  p.thumbnail_url || p.media_url,
                permalink:     p.permalink,
                timestamp:     p.timestamp,
                likeCount,
                commentsCount,
                impressions,
                reach,
                saved,
                engagement,
            };
        });
    }
}

export default InstagramService;
