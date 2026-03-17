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
    async getAccountInsights(period = 'day', metrics = []) {
        const defaultMetrics = [
            'impressions',
            'reach',
            'profile_views',
            'follower_count'
        ];

        const requestMetrics = metrics.length > 0 ? metrics : defaultMetrics;

        return this.apiRequest(`/${this.instagramUserId}/insights`, {
            metric: requestMetrics.join(','),
            period: period
        });
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

        try {
            // Get audience city breakdown
            const cityRes = await this.apiRequest(`/${this.instagramUserId}/insights`, {
                metric: 'follower_demographics',
                period: 'lifetime',
                metric_type: 'total_value',
                breakdown: 'city'
            });
            if (cityRes?.data?.[0]?.total_value?.breakdowns?.[0]?.results) {
                const sorted = [...cityRes.data[0].total_value.breakdowns[0].results]
                    .sort((a, b) => (b.value || 0) - (a.value || 0));
                results.cities = sorted.slice(0, 10);
            }
        } catch (e) { console.warn('City demographics not available'); }

        try {
            // Get audience country breakdown
            const countryRes = await this.apiRequest(`/${this.instagramUserId}/insights`, {
                metric: 'follower_demographics',
                period: 'lifetime',
                metric_type: 'total_value',
                breakdown: 'country'
            });
            if (countryRes?.data?.[0]?.total_value?.breakdowns?.[0]?.results) {
                const sorted = [...countryRes.data[0].total_value.breakdowns[0].results]
                    .sort((a, b) => (b.value || 0) - (a.value || 0));
                results.countries = sorted.slice(0, 10);
            }
        } catch (e) { console.warn('Country demographics not available'); }

        try {
            // Get audience gender/age breakdown
            const genderAgeRes = await this.apiRequest(`/${this.instagramUserId}/insights`, {
                metric: 'follower_demographics',
                period: 'lifetime',
                metric_type: 'total_value',
                breakdown: 'age,gender'
            });
            if (genderAgeRes?.data?.[0]?.total_value?.breakdowns?.[0]?.results) {
                results.genderAge = [...genderAgeRes.data[0].total_value.breakdowns[0].results]
                    .sort((a, b) => (b.value || 0) - (a.value || 0));
            }
        } catch (e) { console.warn('Gender/age demographics not available'); }

        try {
            // Get online followers (when followers are active)
            const onlineRes = await this.apiRequest(`/${this.instagramUserId}/insights`, {
                metric: 'online_followers',
                period: 'lifetime'
            });
            if (onlineRes?.data?.[0]?.values) {
                results.onlineFollowers = onlineRes.data[0].values;
            }
        } catch (e) { console.warn('Online followers data not available'); }

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
                console.log('ℹ️ Some posts lack insights (pre-business account) - using basic media data instead.');
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
}

export default InstagramService;
