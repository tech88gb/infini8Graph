import * as authService from '../services/authService.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
const META_CACHE = new Map();

const META_CACHE_TTL = {
    accounts: parseInt(process.env.META_ADS_CACHE_TTL_ACCOUNTS || '300', 10),
    overview: parseInt(process.env.META_ADS_CACHE_TTL_OVERVIEW || '180', 10),
    breakdowns: parseInt(process.env.META_ADS_CACHE_TTL_BREAKDOWNS || '300', 10),
    campaigns: parseInt(process.env.META_ADS_CACHE_TTL_CAMPAIGNS || '300', 10),
    funnel: parseInt(process.env.META_ADS_CACHE_TTL_FUNNEL || '180', 10),
    intelligence: parseInt(process.env.META_ADS_CACHE_TTL_INTELLIGENCE || '300', 10),
    advanced: parseInt(process.env.META_ADS_CACHE_TTL_ADVANCED || '300', 10),
    deep: parseInt(process.env.META_ADS_CACHE_TTL_DEEP || '300', 10)
};

const OBJECTIVE_GROUPS = {
    sales: ['outcome_sales', 'sales', 'conversions', 'catalog_sales', 'store_visits'],
    leads: ['outcome_leads', 'lead_generation', 'leads', 'messages'],
    traffic: ['outcome_traffic', 'traffic', 'link_clicks'],
    awareness: ['outcome_awareness', 'awareness', 'brand_awareness', 'reach', 'video_views'],
    engagement: ['outcome_engagement', 'engagement', 'post_engagement', 'page_likes', 'event_responses'],
    app_promotion: ['outcome_app_promotion', 'app_installs', 'app_promotion']
};

const ACTION_CANDIDATES = {
    purchases: ['purchase', 'omni_purchase', 'onsite_web_purchase', 'offsite_conversion.fb_pixel_purchase'],
    leads: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'omni_lead'],
    engagement: ['post_engagement', 'page_engagement', 'post_reaction', 'comment', 'share', 'link_click'],
    appInstalls: ['app_install', 'mobile_app_install', 'omni_app_install']
};

function getMetaCacheEntry(key) {
    const entry = META_CACHE.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
        META_CACHE.delete(key);
        return null;
    }

    return entry.value;
}

function setMetaCacheEntry(key, value, ttlSeconds) {
    META_CACHE.set(key, {
        value,
        expiresAt: Date.now() + (ttlSeconds * 1000)
    });
}

function buildMetaCacheKey(prefix, parts) {
    return [prefix, ...parts].join(':');
}

async function withMetaCache(key, ttlSeconds, fetcher) {
    const cached = getMetaCacheEntry(key);
    if (cached) return cached;

    const data = await fetcher();
    setMetaCacheEntry(key, data, ttlSeconds);
    return data;
}

function mapObjectiveGroup(objective = '') {
    const normalized = String(objective || '').trim().toLowerCase();
    if (!normalized) return 'general';

    for (const [group, matches] of Object.entries(OBJECTIVE_GROUPS)) {
        if (matches.some((match) => normalized.includes(match))) {
            return group;
        }
    }

    return 'general';
}

function getTopProfileGroup(counts = {}) {
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'general';
}

function parseMetricNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function findActionMetric(entries = [], candidates = []) {
    return entries.find((entry) => {
        const type = String(entry?.type || entry?.action_type || '').toLowerCase();
        return candidates.some((candidate) => type.includes(candidate));
    }) || null;
}

function buildRecommendedMetrics(profileGroup) {
    switch (profileGroup) {
        case 'sales':
            return ['spend', 'purchase_roas', 'purchase_value', 'purchases', 'cost_per_purchase', 'ctr'];
        case 'leads':
            return ['spend', 'leads', 'cost_per_lead', 'ctr', 'reach', 'impressions'];
        case 'traffic':
            return ['spend', 'outbound_clicks', 'cost_per_link_click', 'ctr', 'reach', 'impressions'];
        case 'awareness':
            return ['reach', 'impressions', 'cpm', 'frequency', 'spend', 'ctr'];
        case 'engagement':
            return ['spend', 'engagement_results', 'cost_per_engagement', 'reach', 'impressions', 'ctr'];
        case 'app_promotion':
            return ['spend', 'app_installs', 'cost_per_app_install', 'ctr', 'reach', 'impressions'];
        default:
            return ['impressions', 'clicks', 'spend', 'ctr', 'reach', 'cpm'];
    }
}

function buildAccountProfile(campaigns = [], context = {}) {
    const activeCampaigns = campaigns.filter((campaign) => {
        const status = String(campaign?.effective_status || campaign?.status || '').toUpperCase();
        return status !== 'ARCHIVED' && status !== 'DELETED';
    });

    const objectiveCounts = activeCampaigns.reduce((acc, campaign) => {
        const group = mapObjectiveGroup(campaign?.objective);
        acc[group] = (acc[group] || 0) + 1;
        return acc;
    }, {});

    const totalCampaigns = activeCampaigns.length;
    const topGroup = getTopProfileGroup(objectiveCounts);
    const topCount = objectiveCounts[topGroup] || 0;
    const dominantShare = totalCampaigns > 0 ? topCount / totalCampaigns : 0;

    let profileGroup = topGroup;
    if (totalCampaigns === 0) {
        profileGroup = 'general';
    } else if (Object.keys(objectiveCounts).length > 1 && dominantShare < 0.6) {
        profileGroup = 'mixed';
    }

    const purchaseMetric = findActionMetric(context.conversions, ACTION_CANDIDATES.purchases);
    const leadMetric = findActionMetric(context.conversions, ACTION_CANDIDATES.leads);
    const engagementMetric = findActionMetric(context.conversions, ACTION_CANDIDATES.engagement);
    const appInstallMetric = findActionMetric(context.conversions, ACTION_CANDIDATES.appInstalls);

    if (profileGroup === 'general') {
        if (parseMetricNumber(context.roas?.purchaseRoas) > 0 || parseMetricNumber(purchaseMetric?.value) > 0) {
            profileGroup = 'sales';
        } else if (parseMetricNumber(leadMetric?.value) > 0) {
            profileGroup = 'leads';
        } else if (parseMetricNumber(context.clickMetrics?.outboundClicks) > 0) {
            profileGroup = 'traffic';
        } else if (parseMetricNumber(engagementMetric?.value) > 0) {
            profileGroup = 'engagement';
        } else if (parseMetricNumber(appInstallMetric?.value) > 0) {
            profileGroup = 'app_promotion';
        }
    }

    const labels = {
        sales: 'Sales-Focused',
        leads: 'Lead Gen',
        traffic: 'Traffic',
        awareness: 'Awareness',
        engagement: 'Engagement',
        app_promotion: 'App Promotion',
        mixed: 'Mixed Objectives',
        general: 'General Performance'
    };

    const descriptions = {
        sales: 'Optimized for purchase and revenue efficiency.',
        leads: 'Prioritize lead volume and cost per lead.',
        traffic: 'Focus on visits, clicks, and click efficiency.',
        awareness: 'Focus on delivery, reach, and frequency.',
        engagement: 'Track engagement output and cost per interaction.',
        app_promotion: 'Prioritize app install volume and efficiency.',
        mixed: 'Blend of multiple campaign goals. Showing balanced KPIs.',
        general: 'Showing the universal ad account KPIs.'
    };

    return {
        type: profileGroup,
        label: labels[profileGroup] || labels.general,
        description: descriptions[profileGroup] || descriptions.general,
        totalCampaigns,
        objectiveMix: Object.entries(objectiveCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([group, count]) => ({
                type: group,
                label: labels[group] || group,
                count,
                share: totalCampaigns > 0 ? Number(((count / totalCampaigns) * 100).toFixed(1)) : 0
            })),
        recommendedMetrics: buildRecommendedMetrics(profileGroup)
    };
}

function getComparisonDatePreset(datePreset) {
    if (datePreset === 'last_7d') return 'last_week_mon_sun';
    if (datePreset === 'last_30d') return 'last_month';
    return null;
}

async function fetchInsightsBreakdown(accountId, accessToken, datePreset, breakdowns, fields) {
    const response = await axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
        params: {
            access_token: accessToken,
            fields,
            date_preset: datePreset,
            breakdowns
        }
    });

    return response.data.data || [];
}

/**
 * Get lightweight ad account discovery data
 */
export async function getAdAccounts(req, res) {
    try {
        const accessToken = await authService.getAccessToken(req.user.userId);
        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const cacheKey = buildMetaCacheKey('meta-accounts', [req.user.userId]);
        const adAccounts = await withMetaCache(
            cacheKey,
            META_CACHE_TTL.accounts,
            async () => {
                const response = await axios.get(`${GRAPH_API_BASE}/me/adaccounts`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,name,account_id,account_status,currency,timezone_name,business_name,amount_spent',
                        limit: 500
                    }
                });

                const accounts = response.data.data || [];
                return accounts.sort((a, b) => {
                    const aSpent = parseFloat(a.amount_spent || 0);
                    const bSpent = parseFloat(b.amount_spent || 0);
                    return bSpent - aSpent;
                });
            }
        );

        res.json({
            success: true,
            data: {
                adAccounts,
                total: adAccounts.length,
                defaultAccountId: adAccounts[0]?.account_id || null
            }
        });
    } catch (error) {
        console.error('Ad accounts error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch ad accounts' });
    }
}

/**
 * Get detailed insights for a specific ad account
 */
export async function getAdInsights(req, res) {
    try {
        const { adAccountId } = req.params;
        const { datePreset = 'last_90d' } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const cacheKey = buildMetaCacheKey('meta-overview', [req.user.userId, accountId, datePreset]);
        const payload = await withMetaCache(cacheKey, META_CACHE_TTL.overview, async () => {
            const comparisonDatePreset = getComparisonDatePreset(datePreset);
            const requests = [
                axios.get(`${GRAPH_API_BASE}/${accountId}/ads`, {
                    params: {
                        access_token: accessToken,
                        fields: 'name,status,insights.date_preset(' + datePreset + '){quality_ranking,engagement_rate_ranking,conversion_rate_ranking,impressions,spend}',
                        limit: 500
                    }
                }),
                axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,action_values,cost_per_action_type,purchase_roas,website_purchase_roas,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,outbound_clicks,unique_outbound_clicks,inline_link_clicks,cost_per_inline_link_click,social_spend',
                        date_preset: datePreset
                    }
                }),
                axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,clicks,reach,ctr',
                        date_preset: datePreset,
                        time_increment: 1
                    }
                }),
                axios.get(`${GRAPH_API_BASE}/${accountId}/campaigns`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,name,objective,status,effective_status',
                        limit: 200
                    }
                }),
                axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,clicks,reach',
                        date_preset: datePreset,
                        breakdowns: 'device_platform'
                    }
                }),
                axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,clicks,reach,ctr',
                        date_preset: datePreset,
                        breakdowns: 'publisher_platform,platform_position'
                    }
                })
            ];

            if (comparisonDatePreset) {
                requests.push(axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,reach,clicks',
                        date_preset: comparisonDatePreset
                    }
                }));
                requests.push(axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,reach,clicks,ctr',
                        date_preset: comparisonDatePreset,
                        time_increment: 1
                    }
                }));
            }

            const results = await Promise.allSettled(requests);
            const [relevanceRes, summaryRes, dailyRes, campaignsRes, deviceRes, positionRes, comparisonRes, comparisonDailyRes] = results;
            const adRelevanceData = relevanceRes.status === 'fulfilled' ? relevanceRes.value.data.data || [] : [];
            const summary = summaryRes.status === 'fulfilled' ? summaryRes.value.data.data?.[0] : null;
            const daily = dailyRes.status === 'fulfilled' ? dailyRes.value.data.data : [];
            const campaigns = campaignsRes.status === 'fulfilled' ? campaignsRes.value.data.data || [] : [];
            const devices = deviceRes.status === 'fulfilled' ? deviceRes.value.data.data : [];
            const positions = positionRes.status === 'fulfilled' ? positionRes.value.data.data : [];
            const comparisonDaily = comparisonDailyRes?.status === 'fulfilled' ? comparisonDailyRes.value.data.data || [] : [];

            let videoViews = { views_3s: 0, views_25: 0, views_50: 0, views_75: 0, views_100: 0 };
            if (summary?.video_p25_watched_actions) {
                videoViews.views_25 = parseInt(summary.video_p25_watched_actions[0]?.value || 0);
            }
            if (summary?.video_p50_watched_actions) {
                videoViews.views_50 = parseInt(summary.video_p50_watched_actions[0]?.value || 0);
            }
            if (summary?.video_p75_watched_actions) {
                videoViews.views_75 = parseInt(summary.video_p75_watched_actions[0]?.value || 0);
            }
            if (summary?.video_p100_watched_actions) {
                videoViews.views_100 = parseInt(summary.video_p100_watched_actions[0]?.value || 0);
            }

            let conversions = [];
            if (summary?.actions) {
                conversions = summary.actions.filter(a =>
                    ['purchase', 'lead', 'complete_registration', 'add_to_cart', 'initiate_checkout', 'link_click', 'post_engagement', 'page_engagement'].includes(a.action_type)
                ).map(a => ({
                    type: a.action_type,
                    value: parseInt(a.value)
                }));
            }

            let actionValues = [];
            if (summary?.action_values) {
                actionValues = summary.action_values.map(a => ({
                    type: a.action_type,
                    value: parseFloat(a.value)
                }));
            }

            let costPerAction = [];
            if (summary?.cost_per_action_type) {
                costPerAction = summary.cost_per_action_type.map(a => ({
                    type: a.action_type,
                    value: parseFloat(a.value)
                }));
            }

            let qualityRankings = [];
            let engagementRankings = [];
            let conversionRankings = [];

            for (const ad of adRelevanceData) {
                const insights = ad.insights?.data?.[0];
                if (insights) {
                    if (insights.quality_ranking && insights.quality_ranking !== 'UNKNOWN') {
                        qualityRankings.push(insights.quality_ranking);
                    }
                    if (insights.engagement_rate_ranking && insights.engagement_rate_ranking !== 'UNKNOWN') {
                        engagementRankings.push(insights.engagement_rate_ranking);
                    }
                    if (insights.conversion_rate_ranking && insights.conversion_rate_ranking !== 'UNKNOWN') {
                        conversionRankings.push(insights.conversion_rate_ranking);
                    }
                }
            }

            const getMostCommon = (arr) => {
                if (arr.length === 0) return 'UNKNOWN';
                const counts = arr.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {});
                return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
            };

            const relevanceDiagnostics = {
                qualityRanking: getMostCommon(qualityRankings),
                engagementRateRanking: getMostCommon(engagementRankings),
                conversionRateRanking: getMostCommon(conversionRankings),
                adsAnalyzed: adRelevanceData.length,
                adsWithData: qualityRankings.length
            };

            const roas = {
                purchaseRoas: summary?.purchase_roas?.[0]?.value || 0,
                websitePurchaseRoas: summary?.website_purchase_roas?.[0]?.value || 0
            };

            const clickMetrics = {
                outboundClicks: summary?.outbound_clicks?.[0]?.value || 0,
                uniqueOutboundClicks: summary?.unique_outbound_clicks?.[0]?.value || 0,
                inlineLinkClicks: summary?.inline_link_clicks || 0,
                costPerInlineLinkClick: summary?.cost_per_inline_link_click || 0,
                socialSpend: summary?.social_spend || 0
            };

            const comparisonSummary = comparisonRes?.status === 'fulfilled' ? comparisonRes.value.data.data?.[0] : null;
            let comparisonTrend = null;

            if (comparisonSummary) {
                const calculateTrend = (curr, prev) => {
                    const c = parseFloat(curr || 0);
                    const p = parseFloat(prev || 0);
                    if (p === 0) return 0;
                    return Math.round(((c - p) / p) * 100);
                };

                comparisonTrend = {
                    spendTrend: calculateTrend(summary?.spend, comparisonSummary.spend),
                    impressionsTrend: calculateTrend(summary?.impressions, comparisonSummary.impressions),
                    reachTrend: calculateTrend(summary?.reach, comparisonSummary.reach),
                    clicksTrend: calculateTrend(summary?.clicks, comparisonSummary.clicks),
                    label: datePreset === 'last_7d' ? 'vs last week' : datePreset === 'last_30d' ? 'vs last month' : 'vs previous'
                };
            }

            const accountProfile = buildAccountProfile(campaigns, {
                conversions,
                actionValues,
                costPerAction,
                roas,
                clickMetrics,
                summary
            });

            return {
                summary: {
                    spend: summary?.spend || '0',
                    impressions: summary?.impressions || '0',
                    reach: summary?.reach || '0',
                    clicks: summary?.clicks || '0',
                    cpc: summary?.cpc || '0',
                    cpm: summary?.cpm || '0',
                    ctr: summary?.ctr || '0',
                    frequency: summary?.frequency || '0',
                    comparison: comparisonTrend
                },
                relevanceDiagnostics,
                roas,
                clickMetrics,
                actionValues,
                costPerAction,
                videoViews,
                conversions,
                accountProfile,
                daily,
                comparisonDaily,
                devices,
                positions
            };
        });

        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('Ad insights error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch ad insights' });
    }
}

export async function getDemographics(req, res) {
    try {
        const { adAccountId } = req.params;
        const { datePreset = 'last_90d' } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const cacheKey = buildMetaCacheKey('meta-demographics', [req.user.userId, accountId, datePreset]);
        const demographics = await withMetaCache(cacheKey, META_CACHE_TTL.breakdowns, async () =>
            fetchInsightsBreakdown(accountId, accessToken, datePreset, 'age,gender', 'spend,impressions,clicks,reach,ctr')
        );

        res.json({ success: true, data: { demographics } });
    } catch (error) {
        console.error('Demographics error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch demographics' });
    }
}

export async function getPlacements(req, res) {
    try {
        const { adAccountId } = req.params;
        const { datePreset = 'last_90d' } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const cacheKey = buildMetaCacheKey('meta-placements', [req.user.userId, accountId, datePreset]);
        const [placements, positions] = await withMetaCache(cacheKey, META_CACHE_TTL.breakdowns, async () => {
            const [platforms, platformPositions] = await Promise.all([
                fetchInsightsBreakdown(accountId, accessToken, datePreset, 'publisher_platform', 'spend,impressions,clicks,reach'),
                fetchInsightsBreakdown(accountId, accessToken, datePreset, 'publisher_platform,platform_position', 'spend,impressions,clicks,reach,ctr')
            ]);

            return [platforms, platformPositions];
        });

        res.json({ success: true, data: { placements, positions } });
    } catch (error) {
        console.error('Placements error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch placements' });
    }
}

export async function getGeography(req, res) {
    try {
        const { adAccountId } = req.params;
        const { datePreset = 'last_90d' } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const cacheKey = buildMetaCacheKey('meta-geography', [req.user.userId, accountId, datePreset]);
        const [countries, regions] = await withMetaCache(cacheKey, META_CACHE_TTL.breakdowns, async () => {
            const [countryData, regionData] = await Promise.all([
                fetchInsightsBreakdown(accountId, accessToken, datePreset, 'country', 'spend,impressions,clicks,reach,ctr'),
                fetchInsightsBreakdown(accountId, accessToken, datePreset, 'region', 'spend,impressions,clicks,reach')
            ]);

            return [countryData, regionData];
        });

        res.json({ success: true, data: { countries, regions } });
    } catch (error) {
        console.error('Geography error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch geography' });
    }
}

/**
 * Get campaigns for an ad account
 */
export async function getCampaigns(req, res) {
    try {
        const { adAccountId } = req.params;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const campaigns = await withMetaCache(
            buildMetaCacheKey('meta-campaigns', [req.user.userId, accountId]),
            META_CACHE_TTL.campaigns,
            async () => {
                const response = await axios.get(`${GRAPH_API_BASE}/${accountId}/campaigns`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,name,status,objective,created_time,updated_time,daily_budget,lifetime_budget,insights{spend,impressions,reach,clicks,cpc,cpm,ctr}',
                        limit: 500
                    }
                });

                return response.data.data || [];
            }
        );

        res.json({
            success: true,
            data: { campaigns }
        });
    } catch (error) {
        console.error('Campaigns error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch campaigns' });
    }
}

/**
 * Get ad sets for an ad account
 */
export async function getAdSets(req, res) {
    try {
        const { adAccountId } = req.params;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

        const response = await axios.get(`${GRAPH_API_BASE}/${accountId}/adsets`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,insights{spend,impressions,reach,clicks,cpc,cpm,ctr}',
                limit: 500
            }
        });

        res.json({
            success: true,
            data: { adSets: response.data.data || [] }
        });
    } catch (error) {
        console.error('Ad sets error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch ad sets' });
    }
}

/**
 * Get individual ads for an ad account
 */
export async function getAds(req, res) {
    try {
        const { adAccountId } = req.params;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

        const response = await axios.get(`${GRAPH_API_BASE}/${accountId}/ads`, {
            params: {
                access_token: accessToken,
                fields: 'id,name,status,creative,adset_id,campaign_id,insights{spend,impressions,reach,clicks,cpc,cpm,ctr}',
                limit: 500
            }
        });

        res.json({
            success: true,
            data: { ads: response.data.data || [] }
        });
    } catch (error) {
        console.error('Ads error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch ads' });
    }
}

/**
 * Test permissions
 */
export async function testAdsPermissions(req, res) {
    try {
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const results = { ads_read: { success: false, message: '' }, read_insights: { success: false, message: '' } };

        try {
            const adResponse = await axios.get(`${GRAPH_API_BASE}/me/adaccounts`, {
                params: { access_token: accessToken, fields: 'id,name' }
            });
            results.ads_read = { success: true, message: `Found ${adResponse.data.data?.length || 0} ad accounts`, data: adResponse.data.data };
        } catch (err) {
            results.ads_read = { success: false, message: err.response?.data?.error?.message || 'Failed' };
        }

        try {
            const pagesRes = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
                params: { access_token: accessToken, fields: 'id,name,access_token' }
            });
            const pages = pagesRes.data.data || [];
            if (pages.length > 0) {
                results.read_insights = { success: true, message: `Found ${pages.length} pages` };
            }
        } catch (err) {
            results.read_insights = { success: false, message: err.response?.data?.error?.message || 'Failed' };
        }

        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Permission test failed' });
    }
}

export async function getPageInsights(req, res) {
    res.json({ success: true, message: 'Not implemented' });
}

/**
 * Get Conversion Funnel Analytics
 * Tracks: Landing Page View → View Content → Add to Cart → Initiate Checkout → Purchase
 */
export async function getConversionFunnel(req, res) {
    try {
        const { adAccountId } = req.params;
        const { datePreset = 'last_90d' } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const payload = await withMetaCache(
            buildMetaCacheKey('meta-funnel', [req.user.userId, accountId, datePreset]),
            META_CACHE_TTL.funnel,
            async () => {
                const response = await axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'actions,action_values,cost_per_action_type,spend',
                        date_preset: datePreset
                    }
                });

                const data = response.data.data?.[0] || {};
                const actions = data.actions || [];
                const actionValues = data.action_values || [];
                const costPerAction = data.cost_per_action_type || [];
                const totalSpend = parseFloat(data.spend || 0);
                const funnelStages = [
                    'landing_page_view',
                    'view_content',
                    'add_to_cart',
                    'initiate_checkout',
                    'add_payment_info',
                    'purchase'
                ];

                const getActionValue = (type) => {
                    const action = actions.find(a => a.action_type === type);
                    return action ? parseInt(action.value) : 0;
                };

                const getActionRevenue = (type) => {
                    const action = actionValues.find(a => a.action_type === type);
                    return action ? parseFloat(action.value) : 0;
                };

                const getCPA = (type) => {
                    const action = costPerAction.find(a => a.action_type === type);
                    return action ? parseFloat(action.value) : 0;
                };

                const funnel = funnelStages.map((stage, index) => {
                    const count = getActionValue(stage);
                    const prevCount = index > 0 ? getActionValue(funnelStages[index - 1]) : count;
                    const dropoff = prevCount > 0 ? ((prevCount - count) / prevCount * 100).toFixed(1) : 0;
                    const conversionRate = index > 0 && prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : 100;

                    return {
                        stage,
                        label: stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        count,
                        costPerAction: getCPA(stage),
                        revenue: getActionRevenue(stage),
                        dropoffRate: parseFloat(dropoff),
                        conversionRate: parseFloat(conversionRate)
                    };
                });

                const landingPageViews = getActionValue('landing_page_view') || getActionValue('link_click');
                const purchases = getActionValue('purchase');
                const purchaseValue = getActionRevenue('purchase');
                const overallConversionRate = landingPageViews > 0
                    ? ((purchases / landingPageViews) * 100).toFixed(2)
                    : 0;
                const roas = totalSpend > 0 ? (purchaseValue / totalSpend).toFixed(2) : 0;
                const bottleneck = funnel
                    .filter(s => s.count > 0)
                    .reduce((max, stage) => stage.dropoffRate > (max?.dropoffRate || 0) ? stage : max, null);

                return {
                funnel,
                summary: {
                    totalSpend,
                    landingPageViews,
                    purchases,
                    purchaseValue,
                    overallConversionRate: parseFloat(overallConversionRate),
                    roas: parseFloat(roas),
                    costPerPurchase: getCPA('purchase')
                },
                bottleneck: bottleneck ? {
                    stage: bottleneck.label,
                    dropoffRate: bottleneck.dropoffRate,
                    insight: `${bottleneck.dropoffRate}% of users drop off at ${bottleneck.label}`
                } : null,
                datePreset
                };
            }
        );

        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('Conversion funnel error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch conversion funnel' });
    }
}

/**
 * Get Campaign Intelligence - Deep metrics for campaign optimization
 */
export async function getCampaignIntelligence(req, res) {
    try {
        const { adAccountId } = req.params;
        const { datePreset = 'last_30d' } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const cacheKey = buildMetaCacheKey('meta-intelligence', [req.user.userId, accountId, datePreset]);
        const cached = getMetaCacheEntry(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        // Fetch multiple breakdowns in parallel
        const [campaignsRes, hourlyRes, weekdayRes, placementMatrixRes] = await Promise.allSettled([
            // Campaign-level performance
            axios.get(`${GRAPH_API_BASE}/${accountId}/campaigns`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,objective,daily_budget,lifetime_budget,insights.date_preset(' + datePreset + '){spend,impressions,reach,clicks,actions,action_values,cpc,cpm,ctr,frequency,purchase_roas}',
                    limit: 500
                }
            }),
            // Hourly breakdown for timing optimization
            axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                params: {
                    access_token: accessToken,
                    fields: 'spend,impressions,clicks,actions',
                    date_preset: datePreset,
                    time_increment: 1,
                    breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone'
                }
            }),
            // Day of week performance
            axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                params: {
                    access_token: accessToken,
                    fields: 'spend,impressions,clicks,ctr,actions',
                    date_preset: datePreset,
                    time_increment: 1
                }
            }),
            // Placement matrix
            axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                params: {
                    access_token: accessToken,
                    fields: 'spend,impressions,clicks,reach,actions,action_values',
                    date_preset: datePreset,
                    breakdowns: 'publisher_platform,platform_position'
                }
            })
        ]);

        // Process campaigns
        let campaigns = [];
        if (campaignsRes.status === 'fulfilled') {
            const rawCampaigns = (campaignsRes.value.data.data || []).map(c => {
                const insights = c.insights?.data?.[0] || {};
                const purchases = (insights.actions || []).find(a => a.action_type === 'purchase');
                const purchaseValue = (insights.action_values || []).find(a => a.action_type === 'purchase');
                const spend = parseFloat(insights.spend || 0);
                const purchaseCount = purchases ? parseInt(purchases.value) : 0;
                const revenue = purchaseValue ? parseFloat(purchaseValue.value) : 0;
                const roas = parseFloat(insights.purchase_roas?.[0]?.value || (spend > 0 ? revenue / spend : 0));
                const budgetUtilization = c.daily_budget ? ((spend / (parseFloat(c.daily_budget) / 100 * 30)) * 100).toFixed(1) : null;
                const clicks = parseInt(insights.clicks || 0);
                const cpc = parseFloat(insights.cpc || 0);
                const ctr = parseFloat(insights.ctr || 0);
                const frequency = parseFloat(insights.frequency || 0);

                return {
                    id: c.id,
                    name: c.name,
                    status: c.status,
                    objective: c.objective,
                    spend,
                    impressions: parseInt(insights.impressions || 0),
                    clicks,
                    ctr,
                    cpc,
                    frequency,
                    purchases: purchaseCount,
                    revenue,
                    roas,
                    costPerPurchase: purchaseCount > 0 ? spend / purchaseCount : null,
                    conversionRate: clicks > 0 ? (purchaseCount / clicks) * 100 : 0,
                    budgetUtilization: budgetUtilization ? parseFloat(budgetUtilization) : null
                };
            });

            const scoredCampaigns = rawCampaigns.filter(c => c.spend > 0);
            const maxRoas = Math.max(...scoredCampaigns.map(c => c.roas), 0);
            const maxPurchases = Math.max(...scoredCampaigns.map(c => c.purchases), 0);
            const maxCtr = Math.max(...scoredCampaigns.map(c => c.ctr), 0);
            const maxSpend = Math.max(...scoredCampaigns.map(c => c.spend), 0);
            const minCpc = Math.min(...scoredCampaigns.filter(c => c.cpc > 0).map(c => c.cpc), Number.POSITIVE_INFINITY);

            campaigns = rawCampaigns.map(c => {
                const roasScore = maxRoas > 0 ? c.roas / maxRoas : 0;
                const volumeScore = maxPurchases > 0 ? c.purchases / maxPurchases : 0;
                const ctrScore = maxCtr > 0 ? c.ctr / maxCtr : 0;
                const cpcScore = Number.isFinite(minCpc) && c.cpc > 0 ? Math.min(minCpc / c.cpc, 1) : 0;
                const spendConfidence = maxSpend > 0 ? Math.log10(c.spend + 1) / Math.log10(maxSpend + 1) : 0;
                const performanceScore = c.spend > 0
                    ? ((roasScore * 0.45) + (volumeScore * 0.25) + (ctrScore * 0.15) + (cpcScore * 0.1) + (spendConfidence * 0.05)) * 100
                    : 0;

                return {
                    ...c,
                    efficiencyScore: parseFloat(performanceScore.toFixed(2)),
                    scoreComponents: {
                        roas: parseFloat((roasScore * 100).toFixed(1)),
                        volume: parseFloat((volumeScore * 100).toFixed(1)),
                        ctr: parseFloat((ctrScore * 100).toFixed(1)),
                        cpcEfficiency: parseFloat((cpcScore * 100).toFixed(1)),
                        spendConfidence: parseFloat((spendConfidence * 100).toFixed(1))
                    }
                };
            }).sort((a, b) => b.efficiencyScore - a.efficiencyScore);
        }

        // Process hourly data
        let hourlyPerformance = [];
        if (hourlyRes.status === 'fulfilled') {
            const hourlyData = hourlyRes.value.data.data || [];
            // Group by hour
            const hourlyMap = {};
            hourlyData.forEach(d => {
                const hour = d.hourly_stats_aggregated_by_advertiser_time_zone;
                if (!hourlyMap[hour]) {
                    hourlyMap[hour] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, count: 0 };
                }
                hourlyMap[hour].spend += parseFloat(d.spend || 0);
                hourlyMap[hour].impressions += parseInt(d.impressions || 0);
                hourlyMap[hour].clicks += parseInt(d.clicks || 0);
                const purchases = (d.actions || []).find(a => a.action_type === 'purchase');
                hourlyMap[hour].conversions += purchases ? parseInt(purchases.value) : 0;
                hourlyMap[hour].count++;
            });

            hourlyPerformance = Object.entries(hourlyMap).map(([hour, data]) => ({
                hour: parseInt(hour.split(':')[0]) || 0,
                avgSpend: data.count > 0 ? (data.spend / data.count).toFixed(2) : 0,
                avgImpressions: data.count > 0 ? Math.round(data.impressions / data.count) : 0,
                avgClicks: data.count > 0 ? Math.round(data.clicks / data.count) : 0,
                conversions: data.conversions
            })).sort((a, b) => a.hour - b.hour);
        }

        // Process day of week data
        let dayOfWeekPerformance = [];
        if (weekdayRes.status === 'fulfilled') {
            const dailyData = weekdayRes.value.data.data || [];
            const dayMap = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
            const dayStats = { Sunday: { spend: 0, clicks: 0, impressions: 0, count: 0 }, Monday: { spend: 0, clicks: 0, impressions: 0, count: 0 }, Tuesday: { spend: 0, clicks: 0, impressions: 0, count: 0 }, Wednesday: { spend: 0, clicks: 0, impressions: 0, count: 0 }, Thursday: { spend: 0, clicks: 0, impressions: 0, count: 0 }, Friday: { spend: 0, clicks: 0, impressions: 0, count: 0 }, Saturday: { spend: 0, clicks: 0, impressions: 0, count: 0 } };

            dailyData.forEach(d => {
                const date = new Date(d.date_start);
                const dayName = dayMap[date.getDay()];
                if (dayStats[dayName]) {
                    dayStats[dayName].spend += parseFloat(d.spend || 0);
                    dayStats[dayName].clicks += parseInt(d.clicks || 0);
                    dayStats[dayName].impressions += parseInt(d.impressions || 0);
                    dayStats[dayName].count++;
                }
            });

            dayOfWeekPerformance = Object.entries(dayStats).map(([day, data]) => ({
                day,
                avgSpend: data.count > 0 ? (data.spend / data.count).toFixed(2) : 0,
                avgClicks: data.count > 0 ? Math.round(data.clicks / data.count) : 0,
                avgImpressions: data.count > 0 ? Math.round(data.impressions / data.count) : 0,
                ctr: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : 0
            }));
        }

        // Process placement matrix
        let placementMatrix = [];
        if (placementMatrixRes.status === 'fulfilled') {
            const rawPlacements = (placementMatrixRes.value.data.data || []).map(d => {
                const purchases = (d.actions || []).find(a => a.action_type === 'purchase');
                const purchaseValue = (d.action_values || []).find(a => a.action_type === 'purchase');
                const spend = parseFloat(d.spend || 0);
                const revenue = purchaseValue ? parseFloat(purchaseValue.value) : 0;
                const clicks = parseInt(d.clicks || 0);
                const purchaseCount = purchases ? parseInt(purchases.value) : 0;

                return {
                    platform: d.publisher_platform,
                    position: d.platform_position,
                    spend,
                    impressions: parseInt(d.impressions || 0),
                    clicks,
                    reach: parseInt(d.reach || 0),
                    purchases: purchaseCount,
                    revenue,
                    roas: spend > 0 ? revenue / spend : 0,
                    cpc: clicks > 0 ? spend / clicks : 0,
                    costPerPurchase: purchaseCount > 0 ? spend / purchaseCount : null
                };
            });

            const totalPlacementSpend = rawPlacements.reduce((sum, p) => sum + p.spend, 0);
            const maxPlacementRoas = Math.max(...rawPlacements.map(p => p.roas), 0);
            const maxPlacementPurchases = Math.max(...rawPlacements.map(p => p.purchases), 0);
            const maxPlacementSpend = Math.max(...rawPlacements.map(p => p.spend), 0);
            const minPlacementCpc = Math.min(...rawPlacements.filter(p => p.cpc > 0).map(p => p.cpc), Number.POSITIVE_INFINITY);

            placementMatrix = rawPlacements.map(p => {
                const spendShare = totalPlacementSpend > 0 ? (p.spend / totalPlacementSpend) * 100 : 0;
                const roasScore = maxPlacementRoas > 0 ? p.roas / maxPlacementRoas : 0;
                const purchaseScore = maxPlacementPurchases > 0 ? p.purchases / maxPlacementPurchases : 0;
                const spendScore = maxPlacementSpend > 0 ? p.spend / maxPlacementSpend : 0;
                const cpcScore = Number.isFinite(minPlacementCpc) && p.cpc > 0 ? Math.min(minPlacementCpc / p.cpc, 1) : 0;
                const rankScore = p.spend > 0
                    ? ((roasScore * 0.55) + (purchaseScore * 0.2) + (spendScore * 0.15) + (cpcScore * 0.1)) * 100
                    : 0;
                const confidenceScore = (Math.min(p.spend / 5000, 1) * 0.4) + (Math.min(p.purchases / 10, 1) * 0.35) + (Math.min(p.clicks / 500, 1) * 0.25);
                const confidenceLabel = confidenceScore >= 0.75 ? 'High confidence' : confidenceScore >= 0.45 ? 'Medium confidence' : 'Low confidence';

                return {
                    ...p,
                    spendShare: parseFloat(spendShare.toFixed(1)),
                    rankScore: parseFloat(rankScore.toFixed(1)),
                    confidenceScore: parseFloat((confidenceScore * 100).toFixed(1)),
                    confidenceLabel
                };
            }).sort((a, b) => b.rankScore - a.rankScore);
        }

        // Find best performing times
        const bestHour = hourlyPerformance.length > 0
            ? hourlyPerformance.reduce((max, h) => h.conversions > (max?.conversions || 0) ? h : max, null)
            : null;
        const bestDay = dayOfWeekPerformance.length > 0
            ? dayOfWeekPerformance.reduce((max, d) => parseFloat(d.ctr) > parseFloat(max?.ctr || 0) ? d : max, null)
            : null;
        const bestPlacement = placementMatrix.length > 0 ? placementMatrix[0] : null;

        const payload = {
                campaigns: campaigns.slice(0, 150),
                topCampaign: campaigns.length > 0 ? campaigns[0] : null,
                hourlyPerformance,
                dayOfWeekPerformance,
                placementMatrix: placementMatrix.slice(0, 15),
                recommendations: {
                    bestHour: bestHour ? `${bestHour.hour}:00 has highest conversions` : null,
                    bestDay: bestDay ? `${bestDay.day} has ${bestDay.ctr}% CTR` : null,
                    bestPlacement: bestPlacement ? `${bestPlacement.platform} ${bestPlacement.position} has ${bestPlacement.roas}x ROAS` : null
                },
                datePreset
        };

        setMetaCacheEntry(cacheKey, payload, META_CACHE_TTL.intelligence);
        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('Campaign intelligence error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch campaign intelligence' });
    }
}

/**
 * Advanced Analytics - Fatigue Detection, LQS, Creative Forensics, Learning Phase
 */
export async function getAdvancedAnalytics(req, res) {
    try {
        const { adAccountId } = req.params;
        const { datePreset = 'last_30d' } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const cacheKey = buildMetaCacheKey('meta-advanced', [req.user.userId, accountId, datePreset]);
        const cached = getMetaCacheEntry(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        // Placement intent weights
        const PLACEMENT_INTENT = {
            'feed': { weight: 1.2, label: 'High Intent', color: '#10b981' },
            'story': { weight: 1.0, label: 'Medium Intent', color: '#f59e0b' },
            'reels': { weight: 0.7, label: 'Discovery', color: '#8b5cf6' },
            'right_hand_column': { weight: 0.9, label: 'Medium Intent', color: '#f59e0b' },
            'instant_article': { weight: 0.8, label: 'Low-Medium', color: '#f59e0b' },
            'marketplace': { weight: 1.1, label: 'High Intent', color: '#10b981' },
            'video_feeds': { weight: 0.8, label: 'Discovery', color: '#8b5cf6' },
            'search': { weight: 1.3, label: 'Highest Intent', color: '#059669' },
            'audience_network': { weight: 0.5, label: 'Low Intent', color: '#ef4444' }
        };

        // Fetch all required data in parallel
        const [adsRes, adsetsRes, campaignsRes, dailyRes, placementRes] = await Promise.allSettled([
            // Ads with creative details and insights
            axios.get(`${GRAPH_API_BASE}/${accountId}/ads`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,creative{id,name,thumbnail_url,object_story_spec},insights.date_preset(' + datePreset + '){impressions,clicks,ctr,cpc,spend,actions,action_values,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,frequency}',
                    limit: 100
                }
            }),
            // Adsets with learning phase status
            axios.get(`${GRAPH_API_BASE}/${accountId}/adsets`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,bid_strategy,targeting,insights.date_preset(' + datePreset + '){spend,impressions,clicks,actions,frequency,ctr,cpc}',
                    limit: 500
                }
            }),
            // Campaigns for retargeting comparison
            axios.get(`${GRAPH_API_BASE}/${accountId}/campaigns`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,objective,insights.date_preset(' + datePreset + '){spend,reach,impressions,clicks,ctr,cpc,cpm,actions,action_values,frequency}',
                    limit: 500
                }
            }),
            // Daily breakdown for fatigue detection
            axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                params: {
                    access_token: accessToken,
                    fields: 'spend,impressions,clicks,ctr,cpc,cpm,frequency,actions',
                    date_preset: datePreset,
                    time_increment: 1
                }
            }),
            // Placement breakdown with conversions
            axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                params: {
                    access_token: accessToken,
                    fields: 'spend,impressions,clicks,reach,ctr,actions,action_values',
                    date_preset: datePreset,
                    breakdowns: 'publisher_platform,platform_position'
                }
            })
        ]);

        // ==================== 1. FATIGUE DETECTION ====================
        let fatigueAnalysis = {
            status: 'unknown',
            score: 0,
            indicators: [],
            trend: [],
            framework: [],
            metrics: {},
            missingSignals: [],
            statusLabel: 'Unknown',
            recommendation: 'Not enough evidence yet to evaluate fatigue.'
        };

        if (dailyRes.status === 'fulfilled') {
            const daily = dailyRes.value.data.data || [];
            if (daily.length >= 7) {
                // Calculate weekly trends
                const midpoint = Math.floor(daily.length / 2);
                const firstHalf = daily.slice(0, midpoint);
                const secondHalf = daily.slice(midpoint);

                const avgCtr1 = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + parseFloat(d.ctr || 0), 0) / firstHalf.length : 0;
                const avgCtr2 = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + parseFloat(d.ctr || 0), 0) / secondHalf.length : 0;
                const ctrDecay = avgCtr1 > 0 ? ((avgCtr1 - avgCtr2) / avgCtr1 * 100) : 0;

                const avgCpc1 = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + parseFloat(d.cpc || 0), 0) / firstHalf.length : 0;
                const avgCpc2 = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + parseFloat(d.cpc || 0), 0) / secondHalf.length : 0;
                const cpcIncrease = avgCpc1 > 0 ? ((avgCpc2 - avgCpc1) / avgCpc1 * 100) : 0;

                const avgCpm1 = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + parseFloat(d.cpm || 0), 0) / firstHalf.length : 0;
                const avgCpm2 = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + parseFloat(d.cpm || 0), 0) / secondHalf.length : 0;
                const cpmIncrease = avgCpm1 > 0 ? ((avgCpm2 - avgCpm1) / avgCpm1 * 100) : 0;

                const getDailyConversions = (rows) => rows.reduce((sum, d) => {
                    const conversions = (d.actions || []).reduce((actionSum, a) =>
                        ['purchase', 'lead', 'complete_registration'].includes(a.action_type) ? actionSum + parseInt(a.value) : actionSum, 0);
                    return sum + conversions;
                }, 0);

                const conv1 = getDailyConversions(firstHalf);
                const conv2 = getDailyConversions(secondHalf);
                const cpr1 = conv1 > 0 ? firstHalf.reduce((s, d) => s + parseFloat(d.spend || 0), 0) / conv1 : null;
                const cpr2 = conv2 > 0 ? secondHalf.reduce((s, d) => s + parseFloat(d.spend || 0), 0) / conv2 : null;
                const cprIncrease = cpr1 && cpr2 && cpr1 > 0 ? ((cpr2 - cpr1) / cpr1 * 100) : null;

                const latestFrequency = parseFloat(daily[daily.length - 1]?.frequency || 0);
                const avgFrequency = daily.length > 0 ? daily.reduce((s, d) => s + parseFloat(d.frequency || 0), 0) / daily.length : 0;

                const scaleRatio = (value, low, high) => {
                    if (value === null || value === undefined || Number.isNaN(value)) return 0;
                    if (value <= low) return 0;
                    if (value >= high) return 100;
                    return ((value - low) / (high - low)) * 100;
                };

                let fatigueScore = 0;
                const indicators = [];
                const framework = [];
                const missingSignals = [];

                const ctrScore = scaleRatio(ctrDecay, 8, 30);
                const cpmScore = scaleRatio(cpmIncrease, 10, 35);
                const cpcScore = scaleRatio(cpcIncrease, 10, 35);
                const cprScore = cprIncrease === null ? 0 : scaleRatio(cprIncrease, 10, 40);
                const frequencyScore = scaleRatio(latestFrequency, 1.8, 4.5);

                framework.push(
                    {
                        key: 'ctr_decay',
                        label: 'CTR',
                        description: 'Falling CTR often means the audience is seeing the same idea too often or the creative is losing stopping power.',
                        score: parseFloat(ctrScore.toFixed(1)),
                        value: `${ctrDecay.toFixed(1)}% decay`,
                        weight: 22
                    },
                    {
                        key: 'cpm',
                        label: 'CPM',
                        description: 'Rising CPM can signal auction pressure or audience saturation, especially when creative engagement weakens at the same time.',
                        score: parseFloat(cpmScore.toFixed(1)),
                        value: `${cpmIncrease.toFixed(1)}% change`,
                        weight: 18
                    },
                    {
                        key: 'cpc',
                        label: 'CPC',
                        description: 'CPC pressure captures when clicks are getting more expensive, which often happens before clear conversion deterioration.',
                        score: parseFloat(cpcScore.toFixed(1)),
                        value: `${cpcIncrease.toFixed(1)}% change`,
                        weight: 15
                    },
                    {
                        key: 'cpr',
                        label: 'CPR',
                        description: 'Cost per result is the marketer-facing reality check. When CPR rises while CTR or hook weakens, fatigue is more credible.',
                        score: parseFloat(cprScore.toFixed(1)),
                        value: cprIncrease === null ? 'Not enough conversion volume' : `${cprIncrease.toFixed(1)}% change`,
                        weight: 25
                    },
                    {
                        key: 'frequency',
                        label: 'Frequency',
                        description: 'High repeat exposure can wear out the audience even when spend is stable.',
                        score: parseFloat(frequencyScore.toFixed(1)),
                        value: `${latestFrequency.toFixed(2)}x current`,
                        weight: 20
                    }
                );

                fatigueScore += (ctrScore * 0.22) + (cpmScore * 0.18) + (cpcScore * 0.15) + (cprScore * 0.25) + (frequencyScore * 0.2);

                if (ctrScore >= 60) indicators.push({ type: 'ctr_decay', severity: 'high', message: `CTR dropped ${ctrDecay.toFixed(1)}% versus earlier in the window`, value: ctrDecay });
                else if (ctrScore >= 35) indicators.push({ type: 'ctr_decay', severity: 'medium', message: `CTR is softening by ${ctrDecay.toFixed(1)}%`, value: ctrDecay });

                if (cpmScore >= 60) indicators.push({ type: 'cpm_pressure', severity: 'high', message: `CPM increased ${cpmIncrease.toFixed(1)}%`, value: cpmIncrease });
                else if (cpmScore >= 35) indicators.push({ type: 'cpm_pressure', severity: 'medium', message: `CPM pressure is building (${cpmIncrease.toFixed(1)}%)`, value: cpmIncrease });

                if (cprIncrease === null) {
                    missingSignals.push('CPR trend is unavailable because there were not enough conversion events in both halves of the selected period.');
                } else if (cprScore >= 60) {
                    indicators.push({ type: 'cpr_pressure', severity: 'high', message: `Cost per result rose ${cprIncrease.toFixed(1)}%`, value: cprIncrease });
                } else if (cprScore >= 35) {
                    indicators.push({ type: 'cpr_pressure', severity: 'medium', message: `Cost per result is getting worse (${cprIncrease.toFixed(1)}%)`, value: cprIncrease });
                }

                if (frequencyScore >= 60) indicators.push({ type: 'frequency', severity: 'high', message: `Frequency is high at ${latestFrequency.toFixed(1)}x`, value: latestFrequency });
                else if (frequencyScore >= 35) indicators.push({ type: 'frequency', severity: 'medium', message: `Frequency is building at ${latestFrequency.toFixed(1)}x`, value: latestFrequency });

                fatigueAnalysis = {
                    score: Math.min(parseFloat(fatigueScore.toFixed(1)), 100),
                    status: fatigueScore >= 60 ? 'critical' : fatigueScore >= 30 ? 'warning' : 'healthy',
                    statusEmoji: fatigueScore >= 60 ? '🔴' : fatigueScore >= 30 ? '🟡' : '🟢',
                    statusLabel: fatigueScore >= 60 ? 'Fatigue Critical' : fatigueScore >= 30 ? 'Fatigue Building' : 'Healthy',
                    indicators,
                    framework,
                    missingSignals,
                    metrics: {
                        ctrDecay: ctrDecay.toFixed(1),
                        cpmIncrease: cpmIncrease.toFixed(1),
                        cpcIncrease: cpcIncrease.toFixed(1),
                        cprIncrease: cprIncrease !== null ? cprIncrease.toFixed(1) : null,
                        currentFrequency: latestFrequency.toFixed(2),
                        avgFrequency: avgFrequency.toFixed(2)
                    },
                    trend: daily.slice(-14).map(d => ({
                        date: d.date_start,
                        ctr: parseFloat(d.ctr || 0).toFixed(2),
                        cpm: parseFloat(d.cpm || 0).toFixed(2),
                        cpc: parseFloat(d.cpc || 0).toFixed(2),
                        frequency: parseFloat(d.frequency || 0).toFixed(2)
                    })),
                    recommendation: fatigueScore >= 60
                        ? 'Creative or audience fatigue is likely. Refresh top-spend creatives, widen audience pools, and check whether CPM and CPR are still climbing.'
                        : fatigueScore >= 30
                            ? 'Some fatigue signals are emerging. Rotate creatives selectively and watch whether CPM or CPR continue worsening.'
                            : 'No major fatigue pressure right now. Keep monitoring, especially if frequency keeps climbing.'
                };
            } else {
                fatigueAnalysis.missingSignals = ['At least 7 daily rows are needed for a reliable fatigue read on trend-based metrics.'];
            }
        }

        // ==================== 2. PLACEMENT INTENT WEIGHTING ====================
        let placementIntent = [];

        if (placementRes.status === 'fulfilled') {
            const placements = placementRes.value.data.data || [];

            placementIntent = placements.map(p => {
                const position = (p.platform_position || '').toLowerCase();
                const platform = (p.publisher_platform || '').toLowerCase();
                const intentData = PLACEMENT_INTENT[position] || PLACEMENT_INTENT[platform] || { weight: 1.0, label: 'Standard', color: '#6b7280' };

                const clicks = parseInt(p.clicks || 0);
                const spend = parseFloat(p.spend || 0);
                const leads = (p.actions || []).find(a => a.action_type === 'lead')?.value || 0;
                const purchases = (p.actions || []).find(a => a.action_type === 'purchase')?.value || 0;
                const purchaseValue = (p.action_values || []).find(a => a.action_type === 'purchase')?.value || 0;
                const conversions = parseInt(leads) + parseInt(purchases);

                return {
                    platform: p.publisher_platform,
                    position: p.platform_position,
                    displayName: `${p.publisher_platform} ${(p.platform_position || '').replace(/_/g, ' ')}`,
                    spend,
                    clicks,
                    ctr: parseFloat(p.ctr || 0),
                    conversions,
                    leads: parseInt(leads),
                    purchases: parseInt(purchases),
                    revenue: parseFloat(purchaseValue),
                    intentWeight: intentData.weight,
                    intentLabel: intentData.label,
                    intentColor: intentData.color,
                    weightedConversions: conversions * intentData.weight,
                    effectiveCPA: conversions > 0 ? (spend / conversions).toFixed(2) : null,
                    intentAdjustedCPA: conversions > 0 ? (spend / (conversions * intentData.weight)).toFixed(2) : null
                };
            }).sort((a, b) => b.weightedConversions - a.weightedConversions);
        }

        // ==================== 3. CREATIVE FORENSICS ====================
        let creativeForensics = [];

        if (adsRes.status === 'fulfilled') {
            const ads = adsRes.value.data.data || [];

            creativeForensics = ads.filter(ad => ad.insights?.data?.[0]).map(ad => {
                const insights = ad.insights.data[0];
                const ctr = parseFloat(insights.ctr || 0);
                const cpc = parseFloat(insights.cpc || 0);
                const cpm = parseFloat(insights.cpm || 0);
                const impressions = parseInt(insights.impressions || 0);
                const clicks = parseInt(insights.clicks || 0);
                const spend = parseFloat(insights.spend || 0);
                const frequency = parseFloat(insights.frequency || 0);

                // Video metrics
                const v25 = parseInt(insights.video_p25_watched_actions?.[0]?.value || 0);
                const v50 = parseInt(insights.video_p50_watched_actions?.[0]?.value || 0);
                const v75 = parseInt(insights.video_p75_watched_actions?.[0]?.value || 0);
                const v100 = parseInt(insights.video_p100_watched_actions?.[0]?.value || 0);
                const hasVideo = v25 > 0;

                // Leads/purchases
                const leads = parseInt((insights.actions || []).find(a => a.action_type === 'lead')?.value || 0);
                const purchases = parseInt((insights.actions || []).find(a => a.action_type === 'purchase')?.value || 0);
                const conversions = leads + purchases;
                const costPerConversion = conversions > 0 ? spend / conversions : null;
                const hookRate = hasVideo && impressions > 0 ? (v25 / impressions * 100) : null;
                const completionRate = hasVideo && v25 > 0 ? (v100 / v25 * 100) : null;

                // Determine creative pattern
                let pattern = { type: 'unknown', label: 'Analyzing...', color: '#6b7280', insight: '' };

                if (hasVideo) {
                    const retentionRate = completionRate || 0;

                    if (v25 > 500 && conversions < 3) {
                        pattern = {
                            type: 'entertainment',
                            label: '🎭 Entertainment',
                            color: '#f59e0b',
                            insight: 'High views but low conversions - entertaining but not converting'
                        };
                    } else if (ctr < 1 && conversions > 5) {
                        pattern = {
                            type: 'buyer_magnet',
                            label: '🎯 Buyer Magnet',
                            color: '#10b981',
                            insight: 'Lower CTR but strong conversions - attracts buyers not browsers'
                        };
                    } else if (ctr > 2 && conversions < 2) {
                        pattern = {
                            type: 'clickbait',
                            label: '⚠️ Clickbait',
                            color: '#ef4444',
                            insight: 'High CTR but weak conversions - clickbait pattern detected'
                        };
                    } else if (hookRate > 50 && retentionRate > 60) {
                        pattern = {
                            type: 'engaging',
                            label: '✨ Engaging',
                            color: '#6366f1',
                            insight: 'Strong hook and retention - quality content'
                        };
                    } else if (conversions > 0 && spend / conversions < 50) {
                        pattern = {
                            type: 'efficient',
                            label: '💰 Efficient',
                            color: '#10b981',
                            insight: 'Good cost per conversion - keep running'
                        };
                    }
                } else {
                    // Non-video creative analysis
                    if (ctr > 2 && conversions > 3) {
                        pattern = { type: 'winner', label: '🏆 Winner', color: '#10b981', insight: 'High engagement AND conversions' };
                    } else if (ctr > 2 && conversions < 2) {
                        pattern = { type: 'clickbait', label: '⚠️ Clickbait', color: '#ef4444', insight: 'High clicks but no conversions' };
                    } else if (ctr < 0.5 && conversions > 0) {
                        pattern = { type: 'hidden_gem', label: '💎 Hidden Gem', color: '#8b5cf6', insight: 'Low visibility but converts well when seen' };
                    } else if (spend > 100 && conversions === 0) {
                        pattern = { type: 'underperformer', label: '📉 Underperformer', color: '#ef4444', insight: 'Spending without results - consider pausing' };
                    }
                }

                // Fatigue status per creative
                let creativeFatigue = 'healthy';
                const fatigueReasons = [];
                if (frequency > 4) creativeFatigue = 'critical';
                else if (frequency > 2.5) creativeFatigue = 'warning';
                if (frequency > 2.5) fatigueReasons.push(`Frequency ${frequency.toFixed(2)}x`);
                if (hookRate !== null && hookRate < 10) fatigueReasons.push(`Weak hook ${hookRate.toFixed(1)}%`);
                if (costPerConversion !== null && costPerConversion > 1500) fatigueReasons.push(`High CPR ₹${costPerConversion.toFixed(0)}`);
                if (cpm > 350) fatigueReasons.push(`High CPM ₹${cpm.toFixed(0)}`);

                return {
                    id: ad.id,
                    name: ad.name,
                    status: ad.status,
                    thumbnail: ad.creative?.thumbnail_url,
                    impressions,
                    clicks,
                    ctr: ctr.toFixed(2),
                    cpc: cpc.toFixed(2),
                    cpm: cpm.toFixed(2),
                    spend,
                    frequency: frequency.toFixed(2),
                    conversions,
                    leads,
                    purchases,
                    costPerConversion: costPerConversion !== null ? costPerConversion.toFixed(2) : null,
                    hasVideo,
                    videoMetrics: hasVideo ? {
                        hookRate: hookRate !== null ? hookRate.toFixed(1) : 0,
                        retention25: v25,
                        retention50: v50,
                        retention75: v75,
                        retention100: v100,
                        completionRate: completionRate !== null ? completionRate.toFixed(1) : 0
                    } : null,
                    pattern,
                    fatigue: {
                        status: creativeFatigue,
                        frequency,
                        reasons: fatigueReasons
                    }
                };
            }).sort((a, b) => b.conversions - a.conversions);

            const videoCreatives = creativeForensics.filter(ad => ad.hasVideo && ad.videoMetrics && ad.spend > 0);
            if (videoCreatives.length > 0) {
                const totalVideoSpend = videoCreatives.reduce((sum, ad) => sum + ad.spend, 0);
                const weightedHook = totalVideoSpend > 0
                    ? videoCreatives.reduce((sum, ad) => sum + (parseFloat(ad.videoMetrics.hookRate || 0) * ad.spend), 0) / totalVideoSpend
                    : 0;
                const weightedCompletion = totalVideoSpend > 0
                    ? videoCreatives.reduce((sum, ad) => sum + (parseFloat(ad.videoMetrics.completionRate || 0) * ad.spend), 0) / totalVideoSpend
                    : 0;
                const hookScore = weightedHook < 5 ? 100 : weightedHook < 10 ? 70 : weightedHook < 15 ? 40 : 0;
                const completionScore = weightedCompletion < 12 ? 100 : weightedCompletion < 20 ? 65 : weightedCompletion < 30 ? 35 : 0;
                const creativePressure = Math.round((hookScore * 0.65) + (completionScore * 0.35));

                fatigueAnalysis.framework = [
                    ...fatigueAnalysis.framework,
                    {
                        key: 'hook',
                        label: 'Hook',
                        description: 'Spend-weighted video hook rate across active creatives. Weak hooks usually point to creative fatigue before conversion performance fully collapses.',
                        score: creativePressure,
                        value: `${weightedHook.toFixed(1)}% hook • ${weightedCompletion.toFixed(1)}% completion`,
                        weight: 20
                    }
                ];
                fatigueAnalysis.score = Math.min(100, parseFloat((fatigueAnalysis.score + (creativePressure * 0.2)).toFixed(1)));

                if (creativePressure >= 60) {
                    fatigueAnalysis.indicators.push({
                        type: 'hook_pressure',
                        severity: 'high',
                        message: `Video hook quality is weak (${weightedHook.toFixed(1)}% weighted hook rate)`,
                        value: weightedHook
                    });
                } else if (creativePressure >= 35) {
                    fatigueAnalysis.indicators.push({
                        type: 'hook_pressure',
                        severity: 'medium',
                        message: `Video hook quality is softening (${weightedHook.toFixed(1)}% weighted hook rate)`,
                        value: weightedHook
                    });
                }

                fatigueAnalysis.metrics = {
                    ...fatigueAnalysis.metrics,
                    weightedHookRate: weightedHook.toFixed(1),
                    weightedCompletionRate: weightedCompletion.toFixed(1)
                };
            } else {
                fatigueAnalysis.missingSignals = [
                    ...(fatigueAnalysis.missingSignals || []),
                    'No meaningful video-watch data was available, so the fatigue model could not use hook or completion quality.'
                ];
            }

            fatigueAnalysis.status = fatigueAnalysis.score >= 60 ? 'critical' : fatigueAnalysis.score >= 30 ? 'warning' : 'healthy';
            fatigueAnalysis.statusEmoji = fatigueAnalysis.score >= 60 ? '🔴' : fatigueAnalysis.score >= 30 ? '🟡' : '🟢';
            fatigueAnalysis.statusLabel = fatigueAnalysis.score >= 60 ? 'Fatigue Critical' : fatigueAnalysis.score >= 30 ? 'Fatigue Building' : 'Healthy';
        }

        // ==================== 4. LEARNING PHASE STATUS ====================
        let learningPhase = [];

        if (adsetsRes.status === 'fulfilled') {
            const adsets = adsetsRes.value.data.data || [];

            learningPhase = adsets.map(adset => {
                const status = adset.effective_status || adset.status;
                const insights = adset.insights?.data?.[0] || {};
                const spend = parseFloat(insights.spend || 0);
                const conversions = (insights.actions || []).reduce((sum, a) => {
                    if (['purchase', 'lead', 'complete_registration', 'add_to_cart'].includes(a.action_type)) {
                        return sum + parseInt(a.value);
                    }
                    return sum;
                }, 0);

                // Determine learning status
                let learningStatus = { status: 'unknown', label: 'Unknown', color: '#6b7280', icon: '❓' };
                const isLearning = status === 'LEARNING' || status === 'PENDING_REVIEW';
                const isLimited = status === 'LEARNING_LIMITED';
                const isActive = status === 'ACTIVE';

                if (isLearning) {
                    const progress = Math.min((conversions / 50) * 100, 100);
                    learningStatus = {
                        status: 'learning',
                        label: `Learning (${conversions}/50)`,
                        color: '#f59e0b',
                        icon: '📚',
                        progress,
                        risk: conversions < 20 ? 'high' : conversions < 35 ? 'medium' : 'low',
                        riskLabel: conversions < 20 ? 'At risk of Limited' : conversions < 35 ? 'On track' : 'Almost there'
                    };
                } else if (isLimited) {
                    learningStatus = {
                        status: 'limited',
                        label: 'Learning Limited',
                        color: '#ef4444',
                        icon: '⚠️',
                        recommendation: 'Needs 50+ conversions/week. Consider: broader audience, higher budget, or simpler conversion event'
                    };
                } else if (isActive) {
                    learningStatus = {
                        status: 'active',
                        label: 'Optimized',
                        color: '#10b981',
                        icon: '✅',
                        safeToScale: conversions > 50 && spend > 100
                    };
                }

                return {
                    id: adset.id,
                    name: adset.name,
                    status: adset.status,
                    effectiveStatus: status,
                    optimizationGoal: adset.optimization_goal,
                    bidStrategy: adset.bid_strategy,
                    budget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : (adset.lifetime_budget ? parseFloat(adset.lifetime_budget) / 100 : 0),
                    budgetType: adset.daily_budget ? 'daily' : 'lifetime',
                    spend,
                    conversions,
                    learningStatus,
                    frequency: parseFloat(insights.frequency || 0),
                    ctr: parseFloat(insights.ctr || 0).toFixed(2)
                };
            });
        }

        // ==================== 5. RETARGETING LIFT ====================
        let retargetingLift = null;

        if (campaignsRes.status === 'fulfilled') {
            const campaigns = campaignsRes.value.data.data || [];

            // Heuristic: campaigns with "retarget", "remarket", "warm" in name are retargeting
            const retargetKeywords = ['retarget', 'remarket', 'warm', 'remarketing', 'website visitor', 'engaged', 'cart', 'abandon'];
            const coldKeywords = ['cold', 'prospecting', 'broad', 'interest', 'new audience'];

            const retargetCampaigns = campaigns.filter(c =>
                retargetKeywords.some(k => c.name.toLowerCase().includes(k))
            );
            const coldCampaigns = campaigns.filter(c =>
                coldKeywords.some(k => c.name.toLowerCase().includes(k)) ||
                !retargetKeywords.some(k => c.name.toLowerCase().includes(k))
            );

            if (retargetCampaigns.length > 0 && coldCampaigns.length > 0) {
                const coldMetrics = coldCampaigns.reduce((acc, c) => {
                    const insights = c.insights?.data?.[0] || {};
                    const clicks = parseInt(insights.clicks || 0);
                    const conversions = (insights.actions || []).reduce((sum, a) =>
                        ['purchase', 'lead'].includes(a.action_type) ? sum + parseInt(a.value) : sum, 0);
                    return {
                        clicks: acc.clicks + clicks,
                        conversions: acc.conversions + conversions,
                        spend: acc.spend + parseFloat(insights.spend || 0)
                    };
                }, { clicks: 0, conversions: 0, spend: 0 });

                const retargetMetrics = retargetCampaigns.reduce((acc, c) => {
                    const insights = c.insights?.data?.[0] || {};
                    const clicks = parseInt(insights.clicks || 0);
                    const conversions = (insights.actions || []).reduce((sum, a) =>
                        ['purchase', 'lead'].includes(a.action_type) ? sum + parseInt(a.value) : sum, 0);
                    return {
                        clicks: acc.clicks + clicks,
                        conversions: acc.conversions + conversions,
                        spend: acc.spend + parseFloat(insights.spend || 0)
                    };
                }, { clicks: 0, conversions: 0, spend: 0 });

                const coldConvRate = coldMetrics.clicks > 0 ? (coldMetrics.conversions / coldMetrics.clicks * 100) : 0;
                const retargetConvRate = retargetMetrics.clicks > 0 ? (retargetMetrics.conversions / retargetMetrics.clicks * 100) : 0;
                const lift = coldConvRate > 0 ? ((retargetConvRate - coldConvRate) / coldConvRate * 100) : 0;

                let insight = '';
                let status = 'neutral';

                if (lift > 50) {
                    insight = 'Retargeting is significantly boosting conversions - your acquisition is working well';
                    status = 'excellent';
                } else if (lift > 20) {
                    insight = 'Retargeting provides moderate lift - normal performance';
                    status = 'good';
                } else if (lift > 0) {
                    insight = 'Retargeting provides minimal lift - acquisition quality may be low';
                    status = 'warning';
                } else {
                    insight = 'Retargeting performing worse than cold - problem is likely acquisition traffic quality';
                    status = 'critical';
                }

                retargetingLift = {
                    coldCampaigns: coldCampaigns.length,
                    retargetCampaigns: retargetCampaigns.length,
                    cold: {
                        clicks: coldMetrics.clicks,
                        conversions: coldMetrics.conversions,
                        spend: coldMetrics.spend,
                        conversionRate: coldConvRate.toFixed(3),
                        cpa: coldMetrics.conversions > 0 ? (coldMetrics.spend / coldMetrics.conversions).toFixed(2) : null
                    },
                    retarget: {
                        clicks: retargetMetrics.clicks,
                        conversions: retargetMetrics.conversions,
                        spend: retargetMetrics.spend,
                        conversionRate: retargetConvRate.toFixed(3),
                        cpa: retargetMetrics.conversions > 0 ? (retargetMetrics.spend / retargetMetrics.conversions).toFixed(2) : null
                    },
                    lift: lift.toFixed(1),
                    denominator: 'clicks',
                    status,
                    insight
                };
            }
        }

        // ==================== 6. LEAD QUALITY SCORE (LQS) ====================
        let leadQualityScore = null;

        if (campaignsRes.status === 'fulfilled') {
            const campaigns = campaignsRes.value.data.data || [];

            // Calculate LQS per campaign
            const campaignBase = campaigns.filter(c => c.insights?.data?.[0]).map(c => {
                const insights = c.insights.data[0];
                const ctr = parseFloat(insights.ctr || 0);
                const clicks = parseInt(insights.clicks || 0);
                const frequency = parseFloat(insights.frequency || 0);
                const spend = parseFloat(insights.spend || 0);
                const cpc = parseFloat(insights.cpc || 0);

                const conversions = (insights.actions || []).reduce((sum, a) =>
                    ['purchase', 'lead', 'complete_registration'].includes(a.action_type) ? sum + parseInt(a.value) : sum, 0);

                const conversionRate = clicks > 0 ? (conversions / clicks * 100) : 0;
                const cpa = conversions > 0 ? spend / conversions : null;

                return {
                    id: c.id,
                    name: c.name,
                    objective: c.objective,
                    ctr,
                    conversionRate,
                    frequency,
                    spend,
                    conversions,
                    cpc,
                    cpa
                };
            });

            const bestCPA = Math.min(...campaignBase.filter(c => c.cpa && c.cpa > 0).map(c => c.cpa), Number.POSITIVE_INFINITY);
            const campaignLQS = campaignBase.map(c => {
                const ctrScore = Math.min((c.ctr / 5) * 28, 28);
                const conversionScore = Math.min((c.conversionRate / 3) * 38, 38);
                const cpaScore = Number.isFinite(bestCPA) && c.cpa ? Math.min((bestCPA / c.cpa) * 22, 22) : 0;
                const spendConfidence = c.spend > 0 ? Math.min((Math.log10(c.spend + 1) / 4) * 12, 12) : 0;
                const frequencyPenalty = c.frequency > 3.5 ? 12 : c.frequency > 2.5 ? 6 : 0;

                const rawLQS = ctrScore + conversionScore + cpaScore + spendConfidence - frequencyPenalty;
                const lqs = Math.max(0, Math.min(100, rawLQS));

                let grade = 'D';
                let gradeColor = '#ef4444';
                if (lqs >= 70) { grade = 'A'; gradeColor = '#10b981'; }
                else if (lqs >= 50) { grade = 'B'; gradeColor = '#6366f1'; }
                else if (lqs >= 30) { grade = 'C'; gradeColor = '#f59e0b'; }

                return {
                    id: c.id,
                    name: c.name,
                    objective: c.objective,
                    lqs: lqs.toFixed(1),
                    grade,
                    gradeColor,
                    metrics: {
                        ctr: c.ctr.toFixed(2),
                        conversionRate: c.conversionRate.toFixed(3),
                        frequency: c.frequency.toFixed(2),
                        cpc: c.cpc.toFixed(2),
                        cpa: c.cpa ? c.cpa.toFixed(2) : null,
                        ctrScore: ctrScore.toFixed(1),
                        conversionScore: conversionScore.toFixed(1),
                        cpaScore: cpaScore.toFixed(1),
                        spendConfidence: spendConfidence.toFixed(1),
                        frequencyPenalty
                    },
                    spend: c.spend,
                    conversions: c.conversions
                };
            }).sort((a, b) => parseFloat(b.lqs) - parseFloat(a.lqs));

            const avgLQS = campaignLQS.length > 0
                ? campaignLQS.reduce((s, c) => s + parseFloat(c.lqs), 0) / campaignLQS.length
                : 0;

            leadQualityScore = {
                average: avgLQS.toFixed(1),
                campaigns: campaignLQS.slice(0, 10),
                topPerformer: campaignLQS[0] || null,
                bottomPerformer: campaignLQS[campaignLQS.length - 1] || null
            };
        }

        const payload = {
                fatigueAnalysis,
                placementIntent: placementIntent.slice(0, 15),
                creativeForensics: creativeForensics.slice(0, 20),
                learningPhase,
                retargetingLift,
                leadQualityScore,
                summary: {
                    fatigueStatus: fatigueAnalysis.statusLabel,
                    adsAnalyzed: creativeForensics.length,
                    adsetsAnalyzed: learningPhase.length,
                    placementsAnalyzed: placementIntent.length,
                    hasRetargetingData: retargetingLift !== null
                },
                datePreset
        };

        setMetaCacheEntry(cacheKey, payload, META_CACHE_TTL.advanced);
        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('Advanced analytics error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch advanced analytics' });
    }
}

/**
 * Deep Insights - Per-campaign funnels, Bounce Gap, Video Hook Analysis, Placement Arbitrage
 * This is the "Pro Analytics" that Meta hides or makes difficult to calculate
 */
export async function getDeepInsights(req, res) {
    try {
        const { adAccountId } = req.params;
        const { datePreset = 'last_30d', campaignId = null } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const cacheKey = buildMetaCacheKey('meta-deep', [req.user.userId, accountId, datePreset, campaignId || 'all']);
        const cached = getMetaCacheEntry(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        // Fetch all necessary data in parallel
        const [
            campaignFunnelRes,
            accountFunnelRes,
            placementArbitrageRes,
            videoRetentionRes
        ] = await Promise.allSettled([
            // Campaign-level funnel data (for per-campaign funnel breakdown)
            axios.get(`${GRAPH_API_BASE}/${accountId}/campaigns`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,objective,insights.date_preset(' + datePreset + '){spend,impressions,reach,clicks,actions,action_values,cost_per_action_type,inline_link_clicks,outbound_clicks,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions}',
                    limit: 500
                }
            }),
            // Account-level funnel data (overall bounce gap calculation)
            axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                params: {
                    access_token: accessToken,
                    fields: 'spend,clicks,actions,action_values,cost_per_action_type,inline_link_clicks,outbound_clicks,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions',
                    date_preset: datePreset
                }
            }),
            // Detailed placement breakdown with all metrics for arbitrage detection
            axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                params: {
                    access_token: accessToken,
                    fields: 'spend,impressions,clicks,reach,ctr,cpc,cpm,actions,action_values',
                    date_preset: datePreset,
                    breakdowns: 'publisher_platform,platform_position,device_platform'
                }
            }),
            // Ad-level video retention data (for Hook Analysis)
            axios.get(`${GRAPH_API_BASE}/${accountId}/ads`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,campaign_id,creative{thumbnail_url},insights.date_preset(' + datePreset + '){impressions,reach,clicks,ctr,spend,actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_play_actions}',
                    limit: 100
                }
            })
        ]);

        // ==================== 1. NURTURE EFFICIENCY FUNNEL (Per-Campaign) ====================
        let campaignFunnels = [];
        let overallFunnel = null;

        if (campaignFunnelRes.status === 'fulfilled') {
            const campaigns = campaignFunnelRes.value.data.data || [];

            campaignFunnels = campaigns.map(c => {
                const insights = c.insights?.data?.[0] || {};
                const actions = insights.actions || [];
                const actionValues = insights.action_values || [];
                const costPerAction = insights.cost_per_action_type || [];

                // Helper functions
                const getActionValue = (type) => {
                    const action = actions.find(a => a.action_type === type);
                    return action ? parseInt(action.value) : 0;
                };
                const getActionRevenue = (type) => {
                    const action = actionValues.find(a => a.action_type === type);
                    return action ? parseFloat(action.value) : 0;
                };
                const getCPA = (type) => {
                    const action = costPerAction.find(a => a.action_type === type);
                    return action ? parseFloat(action.value) : 0;
                };

                // Get funnel metrics
                const linkClicks = parseInt(insights.clicks || 0);
                const outboundClicks = parseInt(insights.outbound_clicks?.[0]?.value || 0) || linkClicks;
                const landingPageViews = getActionValue('landing_page_view') || Math.round(linkClicks * 0.7); // Estimate if not available
                const viewContent = getActionValue('view_content');
                const addToCart = getActionValue('add_to_cart');
                const initiateCheckout = getActionValue('initiate_checkout');
                const purchase = getActionValue('purchase');
                const purchaseRevenue = getActionRevenue('purchase');
                const spend = parseFloat(insights.spend || 0);

                // Calculate drop-off deltas (percentage of people lost at each stage)
                const bounceGap = outboundClicks > 0 ? ((outboundClicks - landingPageViews) / outboundClicks * 100) : 0;
                const lpvToVc = landingPageViews > 0 && viewContent > 0 ? ((landingPageViews - viewContent) / landingPageViews * 100) : 0;
                const vcToAtc = viewContent > 0 && addToCart > 0 ? ((viewContent - addToCart) / viewContent * 100) : 0;
                const atcToPurchase = addToCart > 0 && purchase > 0 ? ((addToCart - purchase) / addToCart * 100) : 0;

                // Conversion Velocity Score (higher = faster conversions)
                const velocityScore = linkClicks > 0 ? ((purchase / linkClicks) * 100).toFixed(2) : 0;

                // Calculate ROAS
                const roas = spend > 0 ? (purchaseRevenue / spend) : 0;

                // Determine quality based on bounce gap
                let bounceQuality = 'healthy';
                let bounceInsight = '';
                if (bounceGap > 50) {
                    bounceQuality = 'critical';
                    bounceInsight = 'High bounce rate suggests slow landing page or mismatched traffic';
                } else if (bounceGap > 30) {
                    bounceQuality = 'warning';
                    bounceInsight = 'Moderate bounce - consider page speed optimization';
                } else if (bounceGap > 15) {
                    bounceQuality = 'acceptable';
                    bounceInsight = 'Acceptable bounce rate';
                } else {
                    bounceQuality = 'excellent';
                    bounceInsight = 'Excellent page load and audience fit';
                }

                return {
                    campaignId: c.id,
                    campaignName: c.name,
                    status: c.status,
                    objective: c.objective,
                    spend,
                    funnel: {
                        linkClicks,
                        landingPageViews,
                        viewContent,
                        addToCart,
                        purchase,
                        purchaseRevenue
                    },
                    dropoffs: {
                        bounceGap: parseFloat(bounceGap.toFixed(1)),
                        bounceQuality,
                        bounceInsight,
                        lpvToVc: parseFloat(lpvToVc.toFixed(1)),
                        vcToAtc: parseFloat(vcToAtc.toFixed(1)),
                        atcToPurchase: parseFloat(atcToPurchase.toFixed(1))
                    },
                    conversions: {
                        rate: parseFloat(velocityScore),
                        atcToPurchaseRate: addToCart > 0 ? parseFloat(((purchase / addToCart) * 100).toFixed(1)) : 0,
                        roas: parseFloat(roas.toFixed(2)),
                        costPerPurchase: getCPA('purchase')
                    }
                };
            }).filter(c => c.funnel.linkClicks > 0); // Only campaigns with traffic

            // Sort by ROAS descending for comparison
            campaignFunnels.sort((a, b) => b.conversions.roas - a.conversions.roas);
        }

        // ==================== 2. OVERALL BOUNCE GAP ====================
        let bounceGapAnalysis = null;

        if (accountFunnelRes.status === 'fulfilled') {
            const data = accountFunnelRes.value.data.data?.[0] || {};
            const actions = data.actions || [];

            const getAction = (type) => {
                const action = actions.find(a => a.action_type === type);
                return action ? parseInt(action.value) : 0;
            };

            const totalClicks = parseInt(data.clicks || 0);
            const outboundClicks = parseInt(data.outbound_clicks?.[0]?.value || 0) || totalClicks;
            const landingPageViews = getAction('landing_page_view');

            // Bounce Gap = people who clicked but didn't let the page load (Pixel didn't fire)
            const bounceGapPercent = outboundClicks > 0
                ? ((outboundClicks - landingPageViews) / outboundClicks * 100)
                : 0;

            let severity = 'healthy';
            let message = '';
            let recommendation = '';

            if (bounceGapPercent > 50) {
                severity = 'critical';
                message = 'Over half your paid traffic bounces before page load';
                recommendation = 'Urgently optimize landing page speed, check mobile responsiveness, review ad-to-page relevance';
            } else if (bounceGapPercent > 30) {
                severity = 'warning';
                message = 'Significant traffic is lost before page load';
                recommendation = 'Consider AMP pages for mobile, lazy-load non-critical assets, evaluate hosting speed';
            } else if (bounceGapPercent > 15) {
                severity = 'acceptable';
                message = 'Some bounce is expected, but room for improvement';
                recommendation = 'Test different landing pages, ensure ads match page content';
            } else {
                severity = 'excellent';
                message = 'Very low bounce gap indicates fast pages and good ad relevance';
                recommendation = 'Current performance is optimal - focus on other funnel stages';
            }

            bounceGapAnalysis = {
                totalClicks,
                outboundClicks,
                landingPageViews,
                bounceGap: parseFloat(bounceGapPercent.toFixed(1)),
                severity,
                message,
                recommendation,
                possibleReasons: bounceGapPercent > 30 ? [
                    'Slow page load time',
                    'Mobile-unfriendly landing page',
                    'Ad creative doesn\'t match landing page',
                    'Users from low-intent placements (e.g., Audience Network)',
                    'Bot or accidental clicks'
                ] : []
            };
        }

        // ==================== 3. VIDEO HOOK ANALYSIS (Retention Milestones) ====================
        let videoHookAnalysis = [];

        if (videoRetentionRes.status === 'fulfilled') {
            const ads = videoRetentionRes.value.data.data || [];

            videoHookAnalysis = ads
                .filter(ad => {
                    const insights = ad.insights?.data?.[0];
                    // Only include video ads with retention data
                    return insights?.video_play_actions || insights?.video_p25_watched_actions;
                })
                .map(ad => {
                    const insights = ad.insights?.data?.[0] || {};

                    const videoPlays = parseInt(insights.video_play_actions?.[0]?.value || 0);
                    const p25 = parseInt(insights.video_p25_watched_actions?.[0]?.value || 0);
                    const p50 = parseInt(insights.video_p50_watched_actions?.[0]?.value || 0);
                    const p75 = parseInt(insights.video_p75_watched_actions?.[0]?.value || 0);
                    const p100 = parseInt(insights.video_p100_watched_actions?.[0]?.value || 0);
                    const thruplay = parseInt(insights.video_thruplay_watched_actions?.[0]?.value || 0);

                    // Calculate retention percentages (relative to video plays or impressions)
                    const baseViews = videoPlays || parseInt(insights.impressions || 0);
                    const hookRate = baseViews > 0 ? (p25 / baseViews * 100) : 0; // 25% watch = Hook worked
                    const holdRate = p25 > 0 ? (p75 / p25 * 100) : 0; // 75% of those who hit 25% = Hold worked
                    const completionRate = baseViews > 0 ? (p100 / baseViews * 100) : 0;

                    // Get conversions for this ad
                    const conversions = (insights.actions || [])
                        .filter(a => ['purchase', 'lead', 'complete_registration', 'add_to_cart'].includes(a.action_type))
                        .reduce((sum, a) => sum + parseInt(a.value), 0);

                    // Determine pattern
                    let pattern = '';
                    let insight = '';
                    let color = '#6b7280';

                    if (hookRate >= 50 && holdRate >= 60) {
                        pattern = '🏆 Full Engagement Winner';
                        insight = 'Great hook AND content keeps viewers engaged until the end';
                        color = '#10b981';
                    } else if (hookRate >= 50 && holdRate < 40) {
                        pattern = '⚠️ Hook Works, Content Weak';
                        insight = 'Strong first 3 seconds but viewers drop off mid-video. Improve middle content.';
                        color = '#f59e0b';
                    } else if (hookRate < 30 && holdRate >= 60) {
                        pattern = '💎 Slow Burn Gem';
                        insight = 'Weak hook but those who stay are highly engaged. Improve opening.';
                        color = '#6366f1';
                    } else if (hookRate < 30) {
                        pattern = '❌ Weak Hook';
                        insight = 'First 3 seconds aren\'t capturing attention. Redesign the opening.';
                        color = '#ef4444';
                    } else if (completionRate >= 25 && conversions > 0) {
                        pattern = '✓ Solid Performer';
                        insight = 'Good completion rate with conversions';
                        color = '#0ea5e9';
                    } else {
                        pattern = '📊 Needs More Data';
                        insight = 'Not enough retention or conversion data to classify';
                        color = '#6b7280';
                    }

                    const spend = parseFloat(insights.spend || 0);

                    return {
                        adId: ad.id,
                        adName: ad.name,
                        campaignId: ad.campaign_id,
                        status: ad.status,
                        thumbnail: ad.creative?.thumbnail_url || null,
                        spend,
                        retention: {
                            videoPlays: baseViews,
                            p25,
                            p50,
                            p75,
                            p100,
                            thruplay,
                            hookRate: parseFloat(hookRate.toFixed(1)),
                            holdRate: parseFloat(holdRate.toFixed(1)),
                            completionRate: parseFloat(completionRate.toFixed(1))
                        },
                        retentionCurve: [
                            { stage: 'Start', value: 100 },
                            { stage: '25%', value: hookRate },
                            { stage: '50%', value: p25 > 0 ? (p50 / p25 * 100) * (hookRate / 100) : 0 },
                            { stage: '75%', value: p25 > 0 ? (p75 / p25 * 100) * (hookRate / 100) : 0 },
                            { stage: '100%', value: completionRate }
                        ].map(s => ({ ...s, value: parseFloat(s.value.toFixed(1)) })),
                        conversions,
                        pattern,
                        insight,
                        patternColor: color
                    };
                })
                .filter(v => v.retention.videoPlays > 10) // Only meaningful data
                .sort((a, b) => b.retention.hookRate - a.retention.hookRate);
        }

        // ==================== 4. PLACEMENT ARBITRAGE ====================
        let placementArbitrage = [];
        let arbitrageSummary = null;

        if (placementArbitrageRes.status === 'fulfilled') {
            const placements = placementArbitrageRes.value.data.data || [];

            // Calculate metrics for each placement combination
            placementArbitrage = placements.map(p => {
                const spend = parseFloat(p.spend || 0);
                const impressions = parseInt(p.impressions || 0);
                const clicks = parseInt(p.clicks || 0);
                const reach = parseInt(p.reach || 0);

                // Get conversion actions
                const actions = p.actions || [];
                const actionValues = p.action_values || [];
                const purchases = actions.find(a => a.action_type === 'purchase');
                const purchaseValue = actionValues.find(a => a.action_type === 'purchase');
                const purchaseCount = purchases ? parseInt(purchases.value) : 0;
                const revenue = purchaseValue ? parseFloat(purchaseValue.value) : 0;

                const cpc = clicks > 0 ? spend / clicks : 0;
                const cpm = impressions > 0 ? (spend / impressions * 1000) : 0;
                const ctr = parseFloat(p.ctr || 0);
                const roas = spend > 0 ? (revenue / spend) : 0;
                const cpa = purchaseCount > 0 ? (spend / purchaseCount) : 0;

                // Intent weighting
                const position = (p.platform_position || '').toLowerCase();
                let intentWeight = 1.0;
                let intentLabel = 'Medium';
                let intentColor = '#f59e0b';

                if (position.includes('feed') || position.includes('search') || position.includes('marketplace')) {
                    intentWeight = 1.2;
                    intentLabel = 'High Intent';
                    intentColor = '#10b981';
                } else if (position.includes('story') || position.includes('stories')) {
                    intentWeight = 1.0;
                    intentLabel = 'Medium Intent';
                    intentColor = '#f59e0b';
                } else if (position.includes('reel')) {
                    intentWeight = 0.7;
                    intentLabel = 'Discovery';
                    intentColor = '#8b5cf6';
                } else if (position.includes('audience_network') || position.includes('an_')) {
                    intentWeight = 0.5;
                    intentLabel = 'Low Intent';
                    intentColor = '#ef4444';
                }

                // Intent-adjusted CPA (lower is better for high-intent placements)
                const adjustedCPA = cpa > 0 ? cpa / intentWeight : 0;

                return {
                    platform: p.publisher_platform,
                    position: p.platform_position,
                    device: p.device_platform,
                    fullName: `${p.publisher_platform || ''} ${p.platform_position || ''} (${p.device_platform || ''})`.trim(),
                    metrics: {
                        spend,
                        impressions,
                        clicks,
                        reach,
                        cpc: parseFloat(cpc.toFixed(2)),
                        cpm: parseFloat(cpm.toFixed(2)),
                        ctr,
                        purchases: purchaseCount,
                        revenue,
                        roas: parseFloat(roas.toFixed(2)),
                        cpa: parseFloat(cpa.toFixed(2)),
                        adjustedCPA: parseFloat(adjustedCPA.toFixed(2))
                    },
                    intent: {
                        weight: intentWeight,
                        label: intentLabel,
                        color: intentColor
                    }
                };
            }).filter(p => p.metrics.spend > 0);

            // Sort by adjusted CPA (best value first) for finding arbitrage opportunities
            placementArbitrage.sort((a, b) => {
                // Prioritize by adjusted CPA if we have conversion data, otherwise by CPM
                if (a.metrics.cpa > 0 && b.metrics.cpa > 0) {
                    return a.metrics.adjustedCPA - b.metrics.adjustedCPA;
                }
                return a.metrics.cpm - b.metrics.cpm;
            });

            // Calculate arbitrage opportunities (waste detection)
            if (placementArbitrage.length >= 2) {
                const totalSpend = placementArbitrage.reduce((s, p) => s + p.metrics.spend, 0);
                const avgCPA = placementArbitrage
                    .filter(p => p.metrics.cpa > 0)
                    .reduce((s, p, i, arr) => s + p.metrics.cpa / arr.length, 0);

                // Find wasteful placements (low intent + high CPA + significant spend)
                const wastefulPlacements = placementArbitrage.filter(p =>
                    p.intent.weight < 1.0 &&
                    p.metrics.cpa > avgCPA * 1.3 &&
                    p.metrics.spend > totalSpend * 0.05
                );

                // Find high-value placements (high intent + low CPA)
                const valuePlacements = placementArbitrage.filter(p =>
                    p.intent.weight >= 1.0 &&
                    p.metrics.cpa > 0 &&
                    p.metrics.cpa < avgCPA * 0.8
                );

                const wastedSpend = wastefulPlacements.reduce((s, p) => s + p.metrics.spend, 0);

                arbitrageSummary = {
                    totalPlacements: placementArbitrage.length,
                    totalSpend,
                    avgCPA: parseFloat(avgCPA.toFixed(2)),
                    wastefulPlacements: wastefulPlacements.length,
                    wastedSpend,
                    wastedPercent: totalSpend > 0 ? parseFloat((wastedSpend / totalSpend * 100).toFixed(1)) : 0,
                    valuePlacements: valuePlacements.length,
                    bestPlacement: placementArbitrage[0] || null,
                    worstPlacement: placementArbitrage[placementArbitrage.length - 1] || null,
                    recommendation: wastedSpend > totalSpend * 0.1
                        ? `Consider excluding ${wastefulPlacements.map(p => p.fullName).join(', ')} to save ₹${(wastedSpend / 100).toFixed(0)}`
                        : 'Placement allocation looks reasonable'
                };
            }
        }

        // ==================== COMPILE RESPONSE ====================
        const payload = {
                campaignFunnels: campaignFunnels.slice(0, 20),
                compareFunnels: campaignFunnels.length >= 2 ? {
                    best: campaignFunnels[0],
                    worst: campaignFunnels[campaignFunnels.length - 1],
                    comparison: campaignFunnels[0] && campaignFunnels[campaignFunnels.length - 1] ? {
                        roasDiff: (campaignFunnels[0].conversions.roas - campaignFunnels[campaignFunnels.length - 1].conversions.roas).toFixed(2),
                        atcRateDiff: (campaignFunnels[0].conversions.atcToPurchaseRate - campaignFunnels[campaignFunnels.length - 1].conversions.atcToPurchaseRate).toFixed(1),
                        bounceGapDiff: (campaignFunnels[campaignFunnels.length - 1].dropoffs.bounceGap - campaignFunnels[0].dropoffs.bounceGap).toFixed(1)
                    } : null
                } : null,
                bounceGapAnalysis,
                videoHookAnalysis: videoHookAnalysis.slice(0, 15),
                videoSummary: videoHookAnalysis.length > 0 ? {
                    totalVideos: videoHookAnalysis.length,
                    avgHookRate: parseFloat((videoHookAnalysis.reduce((s, v) => s + v.retention.hookRate, 0) / videoHookAnalysis.length).toFixed(1)),
                    avgCompletionRate: parseFloat((videoHookAnalysis.reduce((s, v) => s + v.retention.completionRate, 0) / videoHookAnalysis.length).toFixed(1)),
                    topPerformer: videoHookAnalysis[0],
                    needsWork: videoHookAnalysis.filter(v => v.pattern.includes('Weak') || v.pattern.includes('Content Weak')).length
                } : null,
                placementArbitrage: placementArbitrage.slice(0, 20),
                arbitrageSummary,
                datePreset
        };

        setMetaCacheEntry(cacheKey, payload, META_CACHE_TTL.deep);
        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('Deep insights error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch deep insights' });
    }
}
