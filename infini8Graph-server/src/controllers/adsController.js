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
    appInstalls: ['app_install', 'mobile_app_install', 'omni_app_install'],
    messagingConnections: ['total_messaging_connection']
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

function calculateTrendPercent(currentValue, previousValue) {
    const current = parseMetricNumber(currentValue);
    const previous = parseMetricNumber(previousValue);
    if (previous <= 0) return null;
    return Number((((current - previous) / previous) * 100).toFixed(1));
}

function findActionMetric(entries = [], candidates = []) {
    return entries.find((entry) => {
        const type = String(entry?.type || entry?.action_type || '').toLowerCase();
        return candidates.some((candidate) => type.includes(candidate));
    }) || null;
}

function getActionTotal(actions = [], candidates = []) {
    return actions.reduce((sum, action) => {
        const type = String(action?.action_type || '').toLowerCase();
        if (candidates.some((candidate) => type.includes(candidate))) {
            return sum + parseMetricNumber(action?.value);
        }
        return sum;
    }, 0);
}

function extractCreativePreview(creative = {}) {
    const primaryImage = creative?.image_url
        || creative?.object_story_spec?.video_data?.image_url
        || creative?.object_story_spec?.video_data?.picture
        || creative?.object_story_spec?.photo_data?.image_url
        || creative?.object_story_spec?.photo_data?.url
        || creative?.object_story_spec?.template_data?.picture
        || creative?.object_story_spec?.link_data?.child_attachments?.find((item) => item?.image_url)?.image_url
        || creative?.object_story_spec?.link_data?.child_attachments?.find((item) => item?.picture)?.picture
        || creative?.object_story_spec?.link_data?.picture
        || creative?.asset_feed_spec?.images?.[0]?.url
        || null;
    const thumbnail = primaryImage || creative?.thumbnail_url || null;
    const previewSource = primaryImage ? 'creative' : creative?.thumbnail_url ? 'thumbnail' : 'none';

    return {
        thumbnail,
        previewSource
    };
}

function extractCreativeImageHashes(creative = {}) {
    const hashes = [
        creative?.image_hash,
        creative?.object_story_spec?.link_data?.image_hash,
        creative?.object_story_spec?.photo_data?.image_hash,
        creative?.object_story_spec?.template_data?.image_hash,
        creative?.object_story_spec?.link_data?.child_attachments?.find((item) => item?.image_hash)?.image_hash,
        ...(Array.isArray(creative?.asset_feed_spec?.images)
            ? creative.asset_feed_spec.images.map((image) => image?.hash || image?.image_hash)
            : [])
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    return Array.from(new Set(hashes));
}

function getCreativeAssetCount(creative = {}) {
    const childAssets = creative?.object_story_spec?.link_data?.child_attachments;
    if (Array.isArray(childAssets) && childAssets.length > 0) return childAssets.length;

    const hasVisual = Boolean(
        creative?.image_url
        || creative?.thumbnail_url
        || creative?.object_story_spec?.video_data?.image_url
        || creative?.object_story_spec?.photo_data?.image_url
        || creative?.object_story_spec?.link_data?.picture
    );
    return hasVisual ? 1 : 0;
}

function sortInsightsByDate(rows = []) {
    return [...rows].sort((a, b) => {
        const aTime = new Date(a?.date_start || a?.date_stop || 0).getTime();
        const bTime = new Date(b?.date_start || b?.date_stop || 0).getTime();
        return aTime - bTime;
    });
}

function buildSpendSeries(currentRows = [], previousRows = []) {
    const currentSeries = sortInsightsByDate(currentRows);
    const previousSeries = sortInsightsByDate(previousRows);

    return currentSeries.map((row, index) => ({
        dateStart: row?.date_start || null,
        dateStop: row?.date_stop || null,
        spend: parseMetricNumber(row?.spend),
        previousSpend: parseMetricNumber(previousSeries[index]?.spend),
        previousDateStart: previousSeries[index]?.date_start || null,
        previousDateStop: previousSeries[index]?.date_stop || null
    }));
}

function getMetricTimestamp(record = {}) {
    return new Date(record?.updated_time || record?.created_time || 0).getTime();
}

function upsertCampaignPreview(previewMap, campaignId, record = {}) {
    const preview = extractCreativePreview(record?.creative || {});
    if (!preview.thumbnail || !campaignId) return;

    const spend = parseMetricNumber(record?.insights?.data?.[0]?.spend);
    const freshness = getMetricTimestamp(record);
    const existing = previewMap.get(campaignId);

    if (!existing || spend > existing.spend || (spend === existing.spend && freshness > existing.freshness)) {
        previewMap.set(campaignId, {
            spend,
            freshness,
            thumbnail: preview.thumbnail,
            previewSource: preview.previewSource
        });
    }
}

function normalizeAdImageRows(payload = {}) {
    if (Array.isArray(payload?.data)) return payload.data;
    if (payload?.data && typeof payload.data === 'object') {
        return Object.entries(payload.data).map(([hash, value]) => ({
            hash,
            ...value
        }));
    }
    return [];
}

function mapGeoPerformanceRow(row, keyName) {
    const actions = row?.actions || [];
    const actionValues = row?.action_values || [];
    const costPerAction = row?.cost_per_action_type || [];
    const purchaseMetric = findActionMetric(actions, ACTION_CANDIDATES.purchases);
    const purchaseValueMetric = findActionMetric(actionValues, ACTION_CANDIDATES.purchases);
    const purchaseCostMetric = findActionMetric(costPerAction, ACTION_CANDIDATES.purchases);
    const purchaseRoas = Array.isArray(row?.purchase_roas)
        ? parseMetricNumber(row.purchase_roas[0]?.value)
        : parseMetricNumber(row?.purchase_roas);

    return {
        [keyName]: row?.[keyName] || 'Unknown',
        spend: parseMetricNumber(row?.spend),
        impressions: parseMetricNumber(row?.impressions),
        clicks: parseMetricNumber(row?.clicks),
        reach: parseMetricNumber(row?.reach),
        ctr: parseMetricNumber(row?.ctr),
        cpc: parseMetricNumber(row?.cpc),
        cpm: parseMetricNumber(row?.cpm),
        purchases: parseMetricNumber(purchaseMetric?.value),
        purchaseValue: parseMetricNumber(purchaseValueMetric?.value),
        purchaseRoas,
        costPerPurchase: parseMetricNumber(purchaseCostMetric?.value)
    };
}

function getCampaignTypeLabel(objective = '') {
    const group = mapObjectiveGroup(objective);
    switch (group) {
        case 'sales':
            return 'Sales';
        case 'leads':
            return 'Lead Gen';
        case 'traffic':
            return 'Traffic';
        case 'awareness':
            return 'Awareness';
        case 'engagement':
            return 'Engagement';
        case 'app_promotion':
            return 'App Promotion';
        default:
            return objective ? toTitleFromSnake(objective) : 'General';
    }
}

function toTitleFromSnake(value = '') {
    return String(value || '')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pickPrimaryCampaignMetric(group, insights = {}) {
    const actions = insights.actions || [];
    const costPerAction = insights.cost_per_action_type || [];
    const purchaseMetric = findActionMetric(actions, ACTION_CANDIDATES.purchases);
    const purchaseCostMetric = findActionMetric(costPerAction, ACTION_CANDIDATES.purchases);
    const leadMetric = findActionMetric(actions, ACTION_CANDIDATES.leads);
    const leadCostMetric = findActionMetric(costPerAction, ACTION_CANDIDATES.leads);
    const engagementMetric = findActionMetric(actions, ACTION_CANDIDATES.engagement);
    const engagementCostMetric = findActionMetric(costPerAction, ACTION_CANDIDATES.engagement);
    const inlineLinkClicks = parseMetricNumber(insights.inline_link_clicks);
    const outboundClicks = parseMetricNumber(insights.outbound_clicks);
    const clicks = outboundClicks || inlineLinkClicks || parseMetricNumber(insights.clicks);
    const cpc = parseMetricNumber(insights.cpc);
    const reach = parseMetricNumber(insights.reach);
    const impressions = parseMetricNumber(insights.impressions);

    switch (group) {
        case 'sales':
            return {
                label: 'Purchases',
                value: parseMetricNumber(purchaseMetric?.value),
                costLabel: 'Cost / Purchase',
                costValue: parseMetricNumber(purchaseCostMetric?.value)
            };
        case 'leads':
            return {
                label: 'Leads',
                value: parseMetricNumber(leadMetric?.value),
                costLabel: 'Cost / Lead',
                costValue: parseMetricNumber(leadCostMetric?.value)
            };
        case 'traffic':
            return {
                label: 'Link Clicks',
                value: clicks,
                costLabel: 'Cost / Link Click',
                costValue: cpc
            };
        case 'awareness':
            return {
                label: 'Reach',
                value: reach,
                costLabel: 'CPM',
                costValue: parseMetricNumber(insights.cpm)
            };
        case 'engagement':
            return {
                label: 'Engagements',
                value: parseMetricNumber(engagementMetric?.value),
                costLabel: 'Cost / Engagement',
                costValue: parseMetricNumber(engagementCostMetric?.value)
            };
        case 'app_promotion':
            return {
                label: 'Clicks',
                value: clicks,
                costLabel: 'CPC',
                costValue: cpc
            };
        default:
            return {
                label: 'Impressions',
                value: impressions,
                costLabel: 'CPC',
                costValue: cpc
            };
    }
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

function shiftDate(date, days) {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + days);
    return shifted;
}

function formatDateYmd(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getRollingComparisonRange(datePreset, referenceDate = new Date()) {
    const normalized = String(datePreset || '').toLowerCase();
    const presetLengths = {
        today: 1,
        last_7d: 7,
        last_14d: 14,
        last_30d: 30,
        last_90d: 90
    };
    const days = presetLengths[normalized];
    if (!days) return null;

    const currentEnd = new Date(referenceDate);
    currentEnd.setHours(0, 0, 0, 0);

    const currentStart = shiftDate(currentEnd, -(days - 1));
    const previousEnd = shiftDate(currentStart, -1);
    const previousStart = shiftDate(previousEnd, -(days - 1));
    const label = normalized === 'today'
        ? 'vs yesterday'
        : `vs previous ${days} day${days === 1 ? '' : 's'}`;

    return {
        current: {
            since: formatDateYmd(currentStart),
            until: formatDateYmd(currentEnd)
        },
        previous: {
            since: formatDateYmd(previousStart),
            until: formatDateYmd(previousEnd)
        },
        label
    };
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
        const cacheKey = buildMetaCacheKey('meta-overview-v2', [req.user.userId, accountId, datePreset]);
        const payload = await withMetaCache(cacheKey, META_CACHE_TTL.overview, async () => {
            const comparisonRange = getRollingComparisonRange(datePreset);
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

            if (comparisonRange) {
                requests.push(axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,reach,clicks',
                        time_range: JSON.stringify(comparisonRange.previous)
                    }
                }));
                requests.push(axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,reach,clicks,ctr',
                        time_range: JSON.stringify(comparisonRange.previous),
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
                    [
                        'purchase',
                        'lead',
                        'complete_registration',
                        'add_to_cart',
                        'initiate_checkout',
                        'link_click',
                        'post_engagement',
                        'page_engagement'
                    ].includes(a.action_type)
                    || String(a.action_type || '').toLowerCase().includes('total_messaging_connection')
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
                    return Number((((c - p) / p) * 100).toFixed(1));
                };

                comparisonTrend = {
                    spendTrend: calculateTrend(summary?.spend, comparisonSummary.spend),
                    impressionsTrend: calculateTrend(summary?.impressions, comparisonSummary.impressions),
                    reachTrend: calculateTrend(summary?.reach, comparisonSummary.reach),
                    clicksTrend: calculateTrend(summary?.clicks, comparisonSummary.clicks),
                    label: comparisonRange?.label || 'vs previous period'
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
        const demographics = await withMetaCache(cacheKey, META_CACHE_TTL.breakdowns, async () => {
            const rows = await fetchInsightsBreakdown(accountId, accessToken, datePreset, 'age,gender', 'spend,impressions,clicks,reach,ctr,cpc,cpm,actions,action_values,cost_per_action_type,purchase_roas');
            return rows
                .map((row) => ({
                    age: row?.age || 'Unknown',
                    gender: row?.gender || 'unknown',
                    spend: parseMetricNumber(row?.spend),
                    impressions: parseMetricNumber(row?.impressions),
                    clicks: parseMetricNumber(row?.clicks),
                    reach: parseMetricNumber(row?.reach),
                    ctr: parseMetricNumber(row?.ctr),
                    cpc: parseMetricNumber(row?.cpc),
                    cpm: parseMetricNumber(row?.cpm),
                    purchases: parseMetricNumber(findActionMetric(row?.actions || [], ACTION_CANDIDATES.purchases)?.value),
                    purchaseValue: parseMetricNumber(findActionMetric(row?.action_values || [], ACTION_CANDIDATES.purchases)?.value),
                    purchaseRoas: Array.isArray(row?.purchase_roas)
                        ? parseMetricNumber(row.purchase_roas[0]?.value)
                        : parseMetricNumber(row?.purchase_roas),
                    costPerPurchase: parseMetricNumber(findActionMetric(row?.cost_per_action_type || [], ACTION_CANDIDATES.purchases)?.value)
                }))
                .sort((a, b) => b.spend - a.spend);
        });

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
                fetchInsightsBreakdown(accountId, accessToken, datePreset, 'country', 'spend,impressions,clicks,reach,ctr,cpc,cpm,actions,action_values,cost_per_action_type,purchase_roas'),
                fetchInsightsBreakdown(accountId, accessToken, datePreset, 'region', 'spend,impressions,clicks,reach,ctr,cpc,cpm,actions,action_values,cost_per_action_type,purchase_roas')
            ]);

            return [
                countryData.map((row) => mapGeoPerformanceRow(row, 'country')).sort((a, b) => b.spend - a.spend),
                regionData.map((row) => mapGeoPerformanceRow(row, 'region')).sort((a, b) => b.spend - a.spend)
            ];
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
        const { datePreset = 'last_30d' } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const campaignsPayload = await withMetaCache(
            buildMetaCacheKey('meta-campaigns-v3', [req.user.userId, accountId, datePreset]),
            META_CACHE_TTL.campaigns,
            async () => {
                const [campaignsRes, adsPreviewRes] = await Promise.allSettled([
                    axios.get(`${GRAPH_API_BASE}/${accountId}/campaigns`, {
                        params: {
                            access_token: accessToken,
                            fields: 'id,name,status,effective_status,configured_status,objective,buying_type,smart_promotion_type,special_ad_categories,bid_strategy,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget,insights.date_preset(' + datePreset + '){spend,impressions,reach,clicks,inline_link_clicks,outbound_clicks,cpc,cpm,ctr,frequency,actions,action_values,cost_per_action_type,purchase_roas}',
                            limit: 500
                        }
                    }),
                    axios.get(`${GRAPH_API_BASE}/${accountId}/ads`, {
                        params: {
                            access_token: accessToken,
                            fields: 'id,name,campaign_id,updated_time,created_time,creative{id,name,image_hash,image_url,thumbnail_url,object_story_spec,asset_feed_spec},insights.date_preset(' + datePreset + '){spend}',
                            limit: 500
                        }
                    })
                ]);

                const previewByCampaign = new Map();
                const imageHashesByCampaign = new Map();
                if (adsPreviewRes.status === 'fulfilled') {
                    (adsPreviewRes.value.data.data || []).forEach((ad) => {
                        const campaignId = String(ad?.campaign_id || '');
                        if (!campaignId) return;
                        upsertCampaignPreview(previewByCampaign, campaignId, ad);
                        imageHashesByCampaign.set(
                            campaignId,
                            Array.from(new Set([
                                ...(imageHashesByCampaign.get(campaignId) || []),
                                ...extractCreativeImageHashes(ad?.creative || {})
                            ]))
                        );
                    });
                }

                if (campaignsRes.status !== 'fulfilled') {
                    throw campaignsRes.reason;
                }

                const rawCampaigns = campaignsRes.value.data.data || [];
                const missingPreviewCampaignIds = rawCampaigns
                    .map((campaign) => String(campaign?.id || ''))
                    .filter((campaignId) => campaignId && !previewByCampaign.has(campaignId))
                    .slice(0, 60);

                if (missingPreviewCampaignIds.length > 0) {
                    const previewRequests = await Promise.allSettled(
                        missingPreviewCampaignIds.map((campaignId) =>
                            axios.get(`${GRAPH_API_BASE}/${campaignId}/ads`, {
                                params: {
                                    access_token: accessToken,
                                    fields: 'id,name,campaign_id,updated_time,created_time,creative{id,name,image_hash,image_url,thumbnail_url,object_story_spec,asset_feed_spec},insights.date_preset(' + datePreset + '){spend}',
                                    limit: 12
                                }
                            })
                        )
                    );

                    previewRequests.forEach((result, index) => {
                        if (result.status !== 'fulfilled') return;
                        const campaignId = missingPreviewCampaignIds[index];
                        (result.value.data.data || []).forEach((ad) => {
                            upsertCampaignPreview(previewByCampaign, campaignId, ad);
                            imageHashesByCampaign.set(
                                campaignId,
                                Array.from(new Set([
                                    ...(imageHashesByCampaign.get(campaignId) || []),
                                    ...extractCreativeImageHashes(ad?.creative || {})
                                ]))
                            );
                        });
                    });
                }

                const unresolvedCampaignIds = rawCampaigns
                    .map((campaign) => String(campaign?.id || ''))
                    .filter((campaignId) => campaignId && !previewByCampaign.has(campaignId));

                const unresolvedHashes = Array.from(new Set(
                    unresolvedCampaignIds.flatMap((campaignId) => imageHashesByCampaign.get(campaignId) || [])
                )).slice(0, 200);

                if (unresolvedCampaignIds.length > 0 && unresolvedHashes.length > 0) {
                    const adImagesRes = await axios.get(`${GRAPH_API_BASE}/${accountId}/adimages`, {
                        params: {
                            access_token: accessToken,
                            fields: 'hash,url,permalink_url',
                            hashes: JSON.stringify(unresolvedHashes)
                        }
                    });

                    const adImageRows = normalizeAdImageRows(adImagesRes.data || {});
                    const adImageByHash = new Map(
                        adImageRows.map((row) => [
                            String(row?.hash || '').trim(),
                            row?.url || row?.permalink_url || null
                        ]).filter(([hash, url]) => hash && url)
                    );

                    unresolvedCampaignIds.forEach((campaignId) => {
                        const existing = previewByCampaign.get(campaignId);
                        if (existing) return;

                        const hashMatch = (imageHashesByCampaign.get(campaignId) || [])
                            .map((hash) => ({
                                hash,
                                url: adImageByHash.get(hash)
                            }))
                            .find((entry) => entry.url);

                        if (hashMatch?.url) {
                            previewByCampaign.set(campaignId, {
                                spend: 0,
                                freshness: 0,
                                thumbnail: hashMatch.url,
                                previewSource: 'image_hash'
                            });
                        }
                    });
                }

                const campaigns = rawCampaigns.map((campaign) => {
                    const insights = campaign?.insights?.data?.[0] || {};
                    const profileGroup = mapObjectiveGroup(campaign?.objective);
                    const actions = insights.actions || [];
                    const actionValues = insights.action_values || [];
                    const costPerAction = insights.cost_per_action_type || [];
                    const purchaseMetric = findActionMetric(actions, ACTION_CANDIDATES.purchases);
                    const purchaseValueMetric = findActionMetric(actionValues, ACTION_CANDIDATES.purchases);
                    const purchaseCostMetric = findActionMetric(costPerAction, ACTION_CANDIDATES.purchases);
                    const leadMetric = findActionMetric(actions, ACTION_CANDIDATES.leads);
                    const leadCostMetric = findActionMetric(costPerAction, ACTION_CANDIDATES.leads);
                    const inlineLinkClicks = parseMetricNumber(insights.inline_link_clicks);
                    const outboundClicks = parseMetricNumber(insights.outbound_clicks);
                    const clickCount = outboundClicks || inlineLinkClicks || parseMetricNumber(insights.clicks);
                    const purchaseRoas = Array.isArray(insights.purchase_roas)
                        ? parseMetricNumber(insights.purchase_roas[0]?.value)
                        : parseMetricNumber(insights.purchase_roas);
                    const primaryMetric = pickPrimaryCampaignMetric(profileGroup, insights);
                    const effectiveStatus = String(campaign?.effective_status || campaign?.status || '').toUpperCase();
                    const configuredStatus = String(campaign?.configured_status || campaign?.status || '').toUpperCase();
                    const budgetMode = parseMetricNumber(campaign?.daily_budget) > 0
                        ? 'Daily'
                        : parseMetricNumber(campaign?.lifetime_budget) > 0
                            ? 'Lifetime'
                            : 'No budget';
                    const preview = previewByCampaign.get(String(campaign?.id || ''));

                    return {
                        ...campaign,
                        type: profileGroup,
                        typeLabel: getCampaignTypeLabel(campaign?.objective),
                        objectiveLabel: campaign?.objective ? toTitleFromSnake(campaign.objective) : 'General',
                        effectiveStatus,
                        configuredStatus,
                        budgetMode,
                        budgetAmount: parseMetricNumber(campaign?.daily_budget) || parseMetricNumber(campaign?.lifetime_budget),
                        thumbnail: preview?.thumbnail || null,
                        previewSource: preview?.previewSource || 'none',
                        metrics: {
                            spend: parseMetricNumber(insights.spend),
                            impressions: parseMetricNumber(insights.impressions),
                            reach: parseMetricNumber(insights.reach),
                            clicks: parseMetricNumber(insights.clicks),
                            linkClicks: clickCount,
                            ctr: parseMetricNumber(insights.ctr),
                            cpc: parseMetricNumber(insights.cpc),
                            cpm: parseMetricNumber(insights.cpm),
                            frequency: parseMetricNumber(insights.frequency),
                            purchases: parseMetricNumber(purchaseMetric?.value),
                            purchaseValue: parseMetricNumber(purchaseValueMetric?.value),
                            purchaseRoas,
                            costPerPurchase: parseMetricNumber(purchaseCostMetric?.value),
                            leads: parseMetricNumber(leadMetric?.value),
                            costPerLead: parseMetricNumber(leadCostMetric?.value)
                        },
                        primaryMetric
                    };
                });

                const byType = campaigns.reduce((acc, campaign) => {
                    acc[campaign.type] = (acc[campaign.type] || 0) + 1;
                    return acc;
                }, {});
                const byStatus = campaigns.reduce((acc, campaign) => {
                    acc[campaign.effectiveStatus] = (acc[campaign.effectiveStatus] || 0) + 1;
                    return acc;
                }, {});

                return {
                    campaigns,
                    summary: {
                        total: campaigns.length,
                        active: campaigns.filter((campaign) => campaign.effectiveStatus === 'ACTIVE').length,
                        byType,
                        byStatus,
                        datePreset
                    }
                };
            }
        );

        res.json({
            success: true,
            data: campaignsPayload
        });
    } catch (error) {
        console.error('Campaigns error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch campaigns' });
    }
}

/**
 * Get drill-down analytics for a specific campaign
 */
export async function getCampaignDrilldown(req, res) {
    try {
        const { adAccountId, campaignId } = req.params;
        const {
            datePreset = 'last_30d',
            creativeOffset = '0',
            creativeLimit = '4'
        } = req.query;
        const accessToken = await authService.getAccessToken(req.user.userId);

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Access token not found' });
        }

        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const offset = Math.max(0, parseInt(String(creativeOffset || '0'), 10) || 0);
        const limit = Math.min(12, Math.max(1, parseInt(String(creativeLimit || '4'), 10) || 4));
        const cacheKey = buildMetaCacheKey('meta-campaign-drilldown-v2', [req.user.userId, accountId, campaignId, datePreset, offset, limit]);
        const payload = await withMetaCache(cacheKey, META_CACHE_TTL.deep, async () => {
            const comparisonRange = getRollingComparisonRange(datePreset);
            const currentRange = comparisonRange?.current || null;
            const previousRange = comparisonRange?.previous || null;
            const currentPeriodLabel = String(datePreset || '').toLowerCase() === 'today'
                ? 'Today'
                : `Current ${String(datePreset || '').replace('last_', '').replace('d', '-day').replace('maximum', 'full').toLowerCase()}`;
            const aggregateFields = 'spend,impressions,reach,clicks,inline_link_clicks,outbound_clicks,cpc,cpm,ctr,frequency,actions,action_values,cost_per_action_type,purchase_roas,video_play_actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions';
            const campaignFiltering = JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: String(campaignId) }]);

            const [campaignMetaRes, campaignCurrentRes, campaignDailyCurrentRes, adsMetaRes, campaignPreviousRes, campaignDailyPreviousRes] = await Promise.allSettled([
                axios.get(`${GRAPH_API_BASE}/${campaignId}`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,name,status,effective_status,configured_status,objective,buying_type,smart_promotion_type,special_ad_categories,bid_strategy,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget'
                    }
                }),
                axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: aggregateFields,
                        filtering: campaignFiltering,
                        level: 'campaign',
                        ...(currentRange ? { time_range: JSON.stringify(currentRange) } : { date_preset: datePreset }),
                        limit: 1
                    }
                }),
                axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                    params: {
                        access_token: accessToken,
                        fields: 'spend',
                        filtering: campaignFiltering,
                        level: 'campaign',
                        ...(currentRange ? { time_range: JSON.stringify(currentRange) } : { date_preset: datePreset }),
                        time_increment: 1,
                        limit: 500
                    }
                }),
                axios.get(`${GRAPH_API_BASE}/${campaignId}/ads`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,name,status,effective_status,updated_time,created_time,adset{id,name},creative{id,name,image_url,thumbnail_url,object_story_spec,asset_feed_spec}',
                        limit: 500
                    }
                }),
                previousRange
                    ? axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                        params: {
                            access_token: accessToken,
                            fields: aggregateFields,
                            filtering: campaignFiltering,
                            level: 'campaign',
                            time_range: JSON.stringify(previousRange),
                            limit: 1
                        }
                    })
                    : Promise.resolve({ data: { data: [] } }),
                previousRange
                    ? axios.get(`${GRAPH_API_BASE}/${accountId}/insights`, {
                        params: {
                            access_token: accessToken,
                            fields: 'spend',
                            filtering: campaignFiltering,
                            level: 'campaign',
                            time_range: JSON.stringify(previousRange),
                            time_increment: 1,
                            limit: 500
                        }
                    })
                    : Promise.resolve({ data: { data: [] } })
            ]);

            const campaignMeta = campaignMetaRes.status === 'fulfilled' ? campaignMetaRes.value.data || {} : {};
            const currentCampaignInsights = campaignCurrentRes.status === 'fulfilled' ? campaignCurrentRes.value.data.data?.[0] || {} : {};
            const previousCampaignInsights = campaignPreviousRes.status === 'fulfilled' ? campaignPreviousRes.value.data.data?.[0] || {} : {};
            const currentCampaignDaily = campaignDailyCurrentRes.status === 'fulfilled' ? campaignDailyCurrentRes.value.data.data || [] : [];
            const previousCampaignDaily = campaignDailyPreviousRes.status === 'fulfilled' ? campaignDailyPreviousRes.value.data.data || [] : [];
            const adsMeta = adsMetaRes.status === 'fulfilled' ? adsMetaRes.value.data.data || [] : [];

            const profileGroup = mapObjectiveGroup(campaignMeta?.objective);
            const currentActions = currentCampaignInsights.actions || [];
            const currentActionValues = currentCampaignInsights.action_values || [];
            const currentCostPerAction = currentCampaignInsights.cost_per_action_type || [];
            const currentPurchaseMetric = findActionMetric(currentActions, ACTION_CANDIDATES.purchases);
            const currentPurchaseValueMetric = findActionMetric(currentActionValues, ACTION_CANDIDATES.purchases);
            const currentPurchaseCostMetric = findActionMetric(currentCostPerAction, ACTION_CANDIDATES.purchases);
            const currentLeadMetric = findActionMetric(currentActions, ACTION_CANDIDATES.leads);
            const currentLeadCostMetric = findActionMetric(currentCostPerAction, ACTION_CANDIDATES.leads);
            const currentInlineLinkClicks = parseMetricNumber(currentCampaignInsights.inline_link_clicks);
            const currentOutboundClicks = parseMetricNumber(currentCampaignInsights.outbound_clicks?.[0]?.value || currentCampaignInsights.outbound_clicks);
            const currentClickCount = currentOutboundClicks || currentInlineLinkClicks || parseMetricNumber(currentCampaignInsights.clicks);
            const currentPurchaseRoas = Array.isArray(currentCampaignInsights.purchase_roas)
                ? parseMetricNumber(currentCampaignInsights.purchase_roas[0]?.value)
                : parseMetricNumber(currentCampaignInsights.purchase_roas);
            const currentPrimaryMetric = pickPrimaryCampaignMetric(profileGroup, {
                ...currentCampaignInsights,
                outbound_clicks: currentOutboundClicks,
                inline_link_clicks: currentInlineLinkClicks
            });

            const previousInlineLinkClicks = parseMetricNumber(previousCampaignInsights.inline_link_clicks);
            const previousOutboundClicks = parseMetricNumber(previousCampaignInsights.outbound_clicks?.[0]?.value || previousCampaignInsights.outbound_clicks);
            const previousPrimaryMetric = pickPrimaryCampaignMetric(profileGroup, {
                ...previousCampaignInsights,
                outbound_clicks: previousOutboundClicks,
                inline_link_clicks: previousInlineLinkClicks
            });

            const budgetMode = parseMetricNumber(campaignMeta?.daily_budget) > 0
                ? 'Daily'
                : parseMetricNumber(campaignMeta?.lifetime_budget) > 0
                    ? 'Lifetime'
                    : 'No budget';
            const orderedAdsMeta = [...adsMeta].sort((a, b) => {
                const aTime = new Date(a?.updated_time || a?.created_time || 0).getTime();
                const bTime = new Date(b?.updated_time || b?.created_time || 0).getTime();
                return bTime - aTime;
            });
            const visibleAdsMeta = orderedAdsMeta.slice(offset, offset + limit);
            const topCreativePreviewSource = orderedAdsMeta
                .map((ad) => ({ ...extractCreativePreview(ad?.creative || {}), ad }))
                .find((item) => item.thumbnail) || null;

            const detailBundles = await Promise.all(visibleAdsMeta.map(async (adMeta) => {
                const adId = String(adMeta?.id || '');
                const [currentAdRes, currentAdDailyRes, previousAdRes, previousAdDailyRes] = await Promise.allSettled([
                    axios.get(`${GRAPH_API_BASE}/${adId}/insights`, {
                        params: {
                            access_token: accessToken,
                            fields: aggregateFields,
                            ...(currentRange ? { time_range: JSON.stringify(currentRange) } : { date_preset: datePreset })
                        }
                    }),
                    axios.get(`${GRAPH_API_BASE}/${adId}/insights`, {
                        params: {
                            access_token: accessToken,
                            fields: 'spend',
                            ...(currentRange ? { time_range: JSON.stringify(currentRange) } : { date_preset: datePreset }),
                            time_increment: 1
                        }
                    }),
                    previousRange
                        ? axios.get(`${GRAPH_API_BASE}/${adId}/insights`, {
                            params: {
                                access_token: accessToken,
                                fields: aggregateFields,
                                time_range: JSON.stringify(previousRange)
                            }
                        })
                        : Promise.resolve({ data: { data: [] } }),
                    previousRange
                        ? axios.get(`${GRAPH_API_BASE}/${adId}/insights`, {
                            params: {
                                access_token: accessToken,
                                fields: 'spend',
                                time_range: JSON.stringify(previousRange),
                                time_increment: 1
                            }
                        })
                        : Promise.resolve({ data: { data: [] } })
                ]);

                return {
                    adMeta,
                    currentRow: currentAdRes.status === 'fulfilled' ? currentAdRes.value.data.data?.[0] || {} : {},
                    currentDaily: currentAdDailyRes.status === 'fulfilled' ? currentAdDailyRes.value.data.data || [] : [],
                    previousRow: previousAdRes.status === 'fulfilled' ? previousAdRes.value.data.data?.[0] || {} : {},
                    previousDaily: previousAdDailyRes.status === 'fulfilled' ? previousAdDailyRes.value.data.data || [] : []
                };
            }));

            const creatives = detailBundles.map(({ adMeta, currentRow, currentDaily, previousRow, previousDaily }) => {
                const adId = String(adMeta?.id || '');
                const creative = adMeta?.creative || {};
                const preview = extractCreativePreview(creative);
                const assetCount = getCreativeAssetCount(creative);
                const insightsActions = currentRow.actions || [];
                const insightsActionValues = currentRow.action_values || [];
                const insightsCostPerAction = currentRow.cost_per_action_type || [];
                const purchases = findActionMetric(insightsActions, ACTION_CANDIDATES.purchases);
                const purchaseValue = findActionMetric(insightsActionValues, ACTION_CANDIDATES.purchases);
                const purchaseCost = findActionMetric(insightsCostPerAction, ACTION_CANDIDATES.purchases);
                const leads = findActionMetric(insightsActions, ACTION_CANDIDATES.leads);
                const leadCost = findActionMetric(insightsCostPerAction, ACTION_CANDIDATES.leads);
                const outboundClicks = parseMetricNumber(currentRow.outbound_clicks?.[0]?.value || currentRow.outbound_clicks);
                const inlineLinkClicks = parseMetricNumber(currentRow.inline_link_clicks);
                const clicks = outboundClicks || inlineLinkClicks || parseMetricNumber(currentRow.clicks);
                const spend = parseMetricNumber(currentRow.spend);
                const purchaseRoas = Array.isArray(currentRow.purchase_roas)
                    ? parseMetricNumber(currentRow.purchase_roas[0]?.value)
                    : parseMetricNumber(currentRow.purchase_roas);
                const primaryMetric = pickPrimaryCampaignMetric(profileGroup, {
                    ...currentRow,
                    outbound_clicks: outboundClicks,
                    inline_link_clicks: inlineLinkClicks
                });
                const videoPlays = parseMetricNumber(currentRow.video_play_actions?.[0]?.value || currentRow.video_play_actions || currentRow.impressions);
                const p25 = parseMetricNumber(currentRow.video_p25_watched_actions?.[0]?.value || currentRow.video_p25_watched_actions);
                const p50 = parseMetricNumber(currentRow.video_p50_watched_actions?.[0]?.value || currentRow.video_p50_watched_actions);
                const p75 = parseMetricNumber(currentRow.video_p75_watched_actions?.[0]?.value || currentRow.video_p75_watched_actions);
                const p100 = parseMetricNumber(currentRow.video_p100_watched_actions?.[0]?.value || currentRow.video_p100_watched_actions);
                const completionRate = videoPlays > 0 ? (p100 / videoPlays) * 100 : 0;
                const hookRate = videoPlays > 0 ? (p25 / videoPlays) * 100 : 0;
                const holdRate = p25 > 0 ? (p75 / p25) * 100 : 0;
                const currentSpend = spend;
                const previousSpend = parseMetricNumber(previousRow.spend);
                const adsetMeta = adMeta?.adset || {};
                const hasVideo = Boolean(
                    p25 > 0
                    || creative?.object_story_spec?.video_data
                    || currentRow.video_play_actions
                );

                return {
                    adId,
                    adName: adMeta?.name || currentRow?.ad_name || 'Unnamed ad',
                    status: adMeta?.effective_status || adMeta?.status || 'UNKNOWN',
                    updatedTime: adMeta?.updated_time || null,
                    createdTime: adMeta?.created_time || null,
                    adsetId: adsetMeta?.id || currentRow?.adset_id || null,
                    adsetName: adsetMeta?.name || currentRow?.adset_name || null,
                    creativeId: creative?.id || null,
                    creativeName: creative?.name || null,
                    assetCount,
                    hasVideo,
                    thumbnail: preview.thumbnail,
                    previewSource: preview.previewSource,
                    primaryMetric,
                    metrics: {
                        spend: currentSpend,
                        previousSpend,
                        spendDeltaPct: calculateTrendPercent(currentSpend, previousSpend),
                        impressions: parseMetricNumber(currentRow.impressions),
                        reach: parseMetricNumber(currentRow.reach),
                        clicks: parseMetricNumber(currentRow.clicks),
                        linkClicks: clicks,
                        ctr: parseMetricNumber(currentRow.ctr),
                        cpc: parseMetricNumber(currentRow.cpc),
                        cpm: parseMetricNumber(currentRow.cpm),
                        frequency: parseMetricNumber(currentRow.frequency),
                        purchases: parseMetricNumber(purchases?.value),
                        purchaseValue: parseMetricNumber(purchaseValue?.value),
                        purchaseRoas,
                        costPerPurchase: parseMetricNumber(purchaseCost?.value),
                        leads: parseMetricNumber(leads?.value),
                        costPerLead: parseMetricNumber(leadCost?.value)
                    },
                    retention: hasVideo ? {
                        videoPlays,
                        p25,
                        p50,
                        p75,
                        p100,
                        hookRate: Number(hookRate.toFixed(1)),
                        holdRate: Number(holdRate.toFixed(1)),
                        completionRate: Number(completionRate.toFixed(1))
                    } : null,
                    comparison: comparisonRange ? {
                        label: comparisonRange.label,
                        currentSpend,
                        previousSpend,
                        spendDeltaPct: calculateTrendPercent(currentSpend, previousSpend)
                    } : null,
                    spendTrend: buildSpendSeries(currentDaily, previousDaily)
                };
            }).filter((ad) => ad.metrics.spend > 0 || ad.metrics.impressions > 0 || ad.thumbnail);

            const uniqueCreativeIds = new Set(orderedAdsMeta.map((ad) => String(ad?.creative?.id || ad?.id || '')));
            const creativeSummary = {
                adsCount: orderedAdsMeta.length,
                activeAdsCount: orderedAdsMeta.filter((ad) => String(ad?.effective_status || ad?.status || '').toUpperCase() === 'ACTIVE').length,
                creativesCount: uniqueCreativeIds.size,
                videoCreativesCount: orderedAdsMeta.filter((ad) => Boolean(ad?.creative?.object_story_spec?.video_data)).length,
                multiAssetCreativesCount: orderedAdsMeta.filter((ad) => getCreativeAssetCount(ad?.creative || {}) > 1).length
            };

            return {
                campaign: {
                    id: campaignMeta?.id || campaignId,
                    name: campaignMeta?.name || 'Unnamed campaign',
                    objective: campaignMeta?.objective || null,
                    objectiveLabel: campaignMeta?.objective ? toTitleFromSnake(campaignMeta.objective) : 'General',
                    type: profileGroup,
                    typeLabel: getCampaignTypeLabel(campaignMeta?.objective),
                    status: campaignMeta?.effective_status || campaignMeta?.status || 'UNKNOWN',
                    configuredStatus: campaignMeta?.configured_status || campaignMeta?.status || 'UNKNOWN',
                    buyingType: campaignMeta?.buying_type || 'Auction',
                    budgetMode,
                    budgetAmount: parseMetricNumber(campaignMeta?.daily_budget) || parseMetricNumber(campaignMeta?.lifetime_budget),
                    startTime: campaignMeta?.start_time || campaignMeta?.created_time || null,
                    updatedTime: campaignMeta?.updated_time || null,
                    thumbnail: topCreativePreviewSource?.thumbnail || null,
                    previewSource: topCreativePreviewSource?.previewSource || 'none',
                    metrics: {
                        spend: parseMetricNumber(currentCampaignInsights.spend),
                        impressions: parseMetricNumber(currentCampaignInsights.impressions),
                        reach: parseMetricNumber(currentCampaignInsights.reach),
                        clicks: parseMetricNumber(currentCampaignInsights.clicks),
                        linkClicks: currentClickCount,
                        ctr: parseMetricNumber(currentCampaignInsights.ctr),
                        cpc: parseMetricNumber(currentCampaignInsights.cpc),
                        cpm: parseMetricNumber(currentCampaignInsights.cpm),
                        frequency: parseMetricNumber(currentCampaignInsights.frequency),
                        purchases: parseMetricNumber(currentPurchaseMetric?.value),
                        purchaseValue: parseMetricNumber(currentPurchaseValueMetric?.value),
                        purchaseRoas: currentPurchaseRoas,
                        costPerPurchase: parseMetricNumber(currentPurchaseCostMetric?.value),
                        leads: parseMetricNumber(currentLeadMetric?.value),
                        costPerLead: parseMetricNumber(currentLeadCostMetric?.value)
                    },
                    primaryMetric: currentPrimaryMetric,
                    comparison: comparisonRange ? {
                        label: comparisonRange.label,
                        currentSpend: parseMetricNumber(currentCampaignInsights.spend),
                        previousSpend: parseMetricNumber(previousCampaignInsights.spend),
                        spendDeltaPct: calculateTrendPercent(currentCampaignInsights.spend, previousCampaignInsights.spend),
                        currentResults: parseMetricNumber(currentPrimaryMetric?.value),
                        previousResults: parseMetricNumber(previousPrimaryMetric?.value)
                    } : null
                },
                creativeSummary,
                spendTrend: {
                    currentLabel: currentPeriodLabel,
                    comparisonLabel: comparisonRange?.label || null,
                    points: buildSpendSeries(currentCampaignDaily, previousCampaignDaily)
                },
                creatives,
                pagination: {
                    offset,
                    limit,
                    total: orderedAdsMeta.length,
                    returned: creatives.length,
                    hasMore: offset + limit < orderedAdsMeta.length,
                    nextOffset: offset + limit < orderedAdsMeta.length ? offset + limit : null
                },
                datePreset
            };
        });

        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('Campaign drilldown error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch campaign drilldown' });
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
        const cacheKey = buildMetaCacheKey('meta-advanced-v6', [req.user.userId, accountId, datePreset]);
        const cached = getMetaCacheEntry(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        const getPresetWindowDays = (preset) => {
            switch (preset) {
                case 'today':
                case 'yesterday':
                    return 1;
                case 'last_3d':
                    return 3;
                case 'last_7d':
                    return 7;
                case 'last_14d':
                    return 14;
                case 'last_28d':
                    return 28;
                case 'last_30d':
                    return 30;
                case 'last_90d':
                    return 90;
                default:
                    return 30;
            }
        };

        const getActionTotal = (actions = [], candidates = []) => actions.reduce((sum, action) => {
            const type = String(action?.action_type || '').toLowerCase();
            if (candidates.some((candidate) => type.includes(candidate))) {
                return sum + parseFloat(action?.value || 0);
            }
            return sum;
        }, 0);

        const getMedian = (values = []) => {
            if (!values.length) return 0;
            const sorted = [...values].sort((a, b) => a - b);
            const middle = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0
                ? (sorted[middle - 1] + sorted[middle]) / 2
                : sorted[middle];
        };

        const getConfidenceLabel = ({ spend = 0, conversions = 0, clicks = 0, impressions = 0 } = {}) => {
            if (conversions >= 20 || spend >= 12000 || clicks >= 1500 || impressions >= 80000) return 'High confidence';
            if (conversions >= 6 || spend >= 3500 || clicks >= 400 || impressions >= 20000) return 'Medium confidence';
            return 'Low confidence';
        };

        const getVideoSignalConfidence = ({ plays = 0, spend = 0, quartile25Views = 0, completes = 0 } = {}) => {
            let score = 0;

            if (plays >= 750) score += 2;
            else if (plays >= 250) score += 1;

            if (spend >= 5000) score += 1;
            else if (spend >= 1500) score += 0.5;

            if (quartile25Views >= 30) score += 1;
            else if (quartile25Views >= 10) score += 0.5;

            if (completes >= 10) score += 0.5;
            else if (completes >= 3) score += 0.25;

            const label = score >= 3 ? 'High confidence' : score >= 1.5 ? 'Medium confidence' : 'Low confidence';
            return {
                label,
                reliableForCreative: label !== 'Low confidence' && plays >= 100,
                reliableForFatigue: label !== 'Low confidence' && plays >= 150
            };
        };

        const isUnsupportedFieldError = (error, fieldName) => {
            const message = String(error?.response?.data?.error?.message || error?.message || '').toLowerCase();
            return message.includes('field') && message.includes(String(fieldName || '').toLowerCase());
        };

        const describeOptimizationGoal = (optimizationGoal = '', campaignObjective = '') => {
            const goal = String(optimizationGoal || '').toUpperCase();
            const objective = String(campaignObjective || '').toUpperCase();

            const descriptor = {
                goal,
                objective,
                label: goal ? goal.replace(/_/g, ' ') : 'Unknown',
                friendlyLabel: goal ? goal.replace(/_/g, ' ').toLowerCase() : 'unknown delivery goal',
                objectiveLabel: objective ? objective.replace(/_/g, ' ') : 'Unknown',
                benchmarkType: 'delivery',
                benchmarkLabel: 'No fixed 50-event benchmark',
                needsOptimizationEvents: false,
                benchmarkTarget: null,
                metricSource: 'delivery',
                actionCandidates: [],
                metricLabel: 'Delivery'
            };

            if (['OFFSITE_CONVERSIONS', 'VALUE', 'QUALITY_LEAD', 'LEAD_GENERATION', 'DERIVED_EVENTS'].includes(goal)) {
                return {
                    ...descriptor,
                    friendlyLabel: goal === 'VALUE' ? 'value optimization' : goal.replace(/_/g, ' ').toLowerCase(),
                    benchmarkType: 'events',
                    benchmarkLabel: '50 optimization events/week',
                    needsOptimizationEvents: true,
                    benchmarkTarget: 50,
                    metricSource: 'actions',
                    actionCandidates: ['purchase', 'lead', 'complete_registration', 'add_payment_info', 'initiate_checkout', 'add_to_cart'],
                    metricLabel: goal === 'LEAD_GENERATION' || goal === 'QUALITY_LEAD' ? 'Leads' : 'Conversion events'
                };
            }

            if (goal === 'APP_INSTALLS') {
                return {
                    ...descriptor,
                    benchmarkType: 'events',
                    benchmarkLabel: '50 installs/week',
                    needsOptimizationEvents: true,
                    benchmarkTarget: 50,
                    metricSource: 'actions',
                    actionCandidates: ['app_install', 'mobile_app_install'],
                    metricLabel: 'App installs'
                };
            }

            if (goal === 'LANDING_PAGE_VIEWS') {
                return {
                    ...descriptor,
                    benchmarkType: 'events',
                    benchmarkLabel: '50 LPVs/week',
                    needsOptimizationEvents: true,
                    benchmarkTarget: 50,
                    metricSource: 'actions',
                    actionCandidates: ['landing_page_view'],
                    metricLabel: 'Landing page views'
                };
            }

            if (goal === 'LINK_CLICKS') {
                return {
                    ...descriptor,
                    benchmarkType: 'events',
                    benchmarkLabel: '50 link clicks/week',
                    needsOptimizationEvents: true,
                    benchmarkTarget: 50,
                    metricSource: 'clicks',
                    metricLabel: 'Link clicks'
                };
            }

            if (goal === 'POST_ENGAGEMENT') {
                return {
                    ...descriptor,
                    benchmarkType: 'events',
                    benchmarkLabel: '50 engagement events/week',
                    needsOptimizationEvents: true,
                    benchmarkTarget: 50,
                    metricSource: 'actions',
                    actionCandidates: ['post_engagement', 'page_engagement', 'post_reaction', 'comment', 'share', 'post_save'],
                    metricLabel: 'Engagement events'
                };
            }

            if (goal === 'THRUPLAY') {
                return {
                    ...descriptor,
                    benchmarkType: 'events',
                    benchmarkLabel: '50 ThruPlays/week',
                    needsOptimizationEvents: true,
                    benchmarkTarget: 50,
                    metricSource: 'actions',
                    actionCandidates: ['thruplay', 'video_view'],
                    metricLabel: 'Video watch events'
                };
            }

            if (goal === 'VISIT_INSTAGRAM_PROFILE') {
                return {
                    ...descriptor,
                    benchmarkType: 'events',
                    benchmarkLabel: '50 profile visits/week',
                    needsOptimizationEvents: true,
                    benchmarkTarget: 50,
                    metricSource: 'actions',
                    actionCandidates: ['visit_instagram_profile', 'profile_visit', 'ig_profile_visit'],
                    metricLabel: 'Profile visits'
                };
            }

            if (goal === 'REACH' || goal === 'IMPRESSIONS') {
                return {
                    ...descriptor,
                    benchmarkType: 'delivery',
                    benchmarkLabel: 'Delivery-stability goal',
                    needsOptimizationEvents: false,
                    benchmarkTarget: null,
                    metricSource: goal === 'REACH' ? 'reach' : 'impressions',
                    metricLabel: goal === 'REACH' ? 'Reach' : 'Impressions'
                };
            }

            if (objective.includes('AWARENESS')) {
                return {
                    ...descriptor,
                    benchmarkType: 'delivery',
                    benchmarkLabel: 'Awareness goal - judge delivery stability, not 50 conversions',
                    needsOptimizationEvents: false,
                    benchmarkTarget: null,
                    metricSource: 'impressions',
                    metricLabel: 'Impressions'
                };
            }

            return descriptor;
        };

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

        const buildAdvancedAdFields = ({ includeVideoPlays = true, includeVideoRetention = true, includeStorySpec = true } = {}) => [
            'id',
            'name',
            'status',
            'effective_status',
            'created_time',
            'updated_time',
            includeStorySpec
                ? 'creative{id,name,image_url,thumbnail_url,object_story_spec}'
                : 'creative{id,name,image_url,thumbnail_url}',
            `insights.date_preset(${datePreset}){impressions,clicks,ctr,cpc,cpm,spend,actions,action_values${includeVideoPlays ? ',video_play_actions' : ''}${includeVideoRetention ? ',video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions' : ''},frequency}`
        ].join(',');

        const fetchAdvancedAds = async () => {
            const fieldVariants = [
                {
                    key: 'full',
                    fields: buildAdvancedAdFields({ includeVideoPlays: true, includeVideoRetention: true, includeStorySpec: true })
                },
                {
                    key: 'no_video_plays',
                    fields: buildAdvancedAdFields({ includeVideoPlays: false, includeVideoRetention: true, includeStorySpec: true })
                },
                {
                    key: 'basic_creative',
                    fields: buildAdvancedAdFields({ includeVideoPlays: false, includeVideoRetention: false, includeStorySpec: false })
                }
            ];

            let lastError = null;
            for (const variant of fieldVariants) {
                try {
                    const response = await axios.get(`${GRAPH_API_BASE}/${accountId}/ads`, {
                        params: {
                            access_token: accessToken,
                            fields: variant.fields,
                            limit: 100
                        }
                    });

                    return { ...response, creativeFetchMode: variant.key };
                } catch (error) {
                    lastError = error;
                    const unsupportedVideoFields = ['video_play_actions', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions', 'video_p100_watched_actions'];
                    const isFieldCompatibilityIssue = unsupportedVideoFields.some((field) => isUnsupportedFieldError(error, field));
                    if (!isFieldCompatibilityIssue && variant.key !== 'basic_creative') {
                        throw error;
                    }
                }
            }

            try {
                const response = await axios.get(`${GRAPH_API_BASE}/${accountId}/ads`, {
                    params: {
                        access_token: accessToken,
                        fields: buildAdvancedAdFields({ includeVideoPlays: false, includeVideoRetention: false, includeStorySpec: false }),
                        limit: 100
                    }
                });
                return { ...response, creativeFetchMode: 'last_resort' };
            } catch (fallbackError) {
                throw lastError || fallbackError;
            }
        };

        // Fetch all required data in parallel
        const [adsRes, adsetsRes, campaignsRes, dailyRes, placementRes] = await Promise.allSettled([
            // Ads with creative details and insights
            fetchAdvancedAds(),
            // Adsets with learning phase status
            axios.get(`${GRAPH_API_BASE}/${accountId}/adsets`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,effective_status,created_time,start_time,daily_budget,lifetime_budget,optimization_goal,bid_strategy,targeting,campaign{id,name,objective},insights.date_preset(' + datePreset + '){spend,reach,impressions,clicks,actions,frequency,ctr,cpc}',
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
                const describeChange = (value, badWord, goodWord = 'improvement') => {
                    if (value === null || value === undefined || Number.isNaN(value)) return 'Not enough data';
                    if (value > 0) return `${value.toFixed(1)}% ${badWord}`;
                    if (value < 0) return `${Math.abs(value).toFixed(1)}% ${goodWord}`;
                    return 'Flat';
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
                        value: describeChange(ctrDecay, 'decay'),
                        weight: 22
                    },
                    {
                        key: 'cpm',
                        label: 'CPM',
                        description: 'Rising CPM can signal auction pressure or audience saturation, especially when creative engagement weakens at the same time.',
                        score: parseFloat(cpmScore.toFixed(1)),
                        value: describeChange(cpmIncrease, 'increase', 'decrease'),
                        weight: 18
                    },
                    {
                        key: 'cpc',
                        label: 'CPC',
                        description: 'CPC pressure captures when clicks are getting more expensive, which often happens before clear conversion deterioration.',
                        score: parseFloat(cpcScore.toFixed(1)),
                        value: describeChange(cpcIncrease, 'increase', 'decrease'),
                        weight: 15
                    },
                    {
                        key: 'cpr',
                        label: 'CPR',
                        description: 'Cost per result is the marketer-facing reality check. When CPR rises while CTR or hook weakens, fatigue is more credible.',
                        score: parseFloat(cprScore.toFixed(1)),
                        value: cprIncrease === null ? 'Not enough conversion volume' : describeChange(cprIncrease, 'increase', 'decrease'),
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
                        avgFrequency: avgFrequency.toFixed(2),
                        componentScores: {
                            ctr: parseFloat(ctrScore.toFixed(1)),
                            cpm: parseFloat(cpmScore.toFixed(1)),
                            cpc: parseFloat(cpcScore.toFixed(1)),
                            cpr: parseFloat(cprScore.toFixed(1)),
                            frequency: parseFloat(frequencyScore.toFixed(1)),
                            hook: null
                        }
                    },
                    trend: daily.slice(-14).map(d => ({
                        date: d.date_start,
                        ctr: parseFloat(d.ctr || 0).toFixed(2),
                        cpm: parseFloat(d.cpm || 0).toFixed(2),
                        cpc: parseFloat(d.cpc || 0).toFixed(2),
                        frequency: parseFloat(d.frequency || 0).toFixed(2)
                    })),
                    scope: 'Account-level aggregate across all campaigns in the selected ad account',
                    comparisonBasis: 'Trend metrics compare the first half of the selected date range against the second half of the same range.',
                    recommendation: fatigueScore >= 60
                        ? 'Creative or audience fatigue is likely. Refresh top-spend creatives, widen audience pools, and check whether CPM and CPR are still climbing.'
                        : fatigueScore >= 30
                            ? 'Some fatigue signals are emerging. Rotate creatives selectively and watch whether CPM or CPR continue worsening.'
                            : indicators.length > 0
                                ? 'One pressure signal is elevated, but the account is not showing broad fatigue yet. Watch whether that pressure spreads into CTR, CPR, or frequency.'
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
        let creativeForensicsMeta = {
            available: false,
            fetchMode: 'unavailable',
            note: null
        };

        if (adsRes.status === 'fulfilled') {
            const ads = adsRes.value.data.data || [];
            creativeForensicsMeta = {
                available: true,
                fetchMode: adsRes.value.creativeFetchMode || 'full',
                note: adsRes.value.creativeFetchMode === 'basic_creative' || adsRes.value.creativeFetchMode === 'last_resort'
                    ? 'Creative diagnostics are using a reduced Meta field set for this account, so some video-specific signals may be unavailable in this date range.'
                    : adsRes.value.creativeFetchMode === 'no_video_plays'
                        ? 'Meta did not return video play counts directly for this account, so creative analysis is using fallback video retention fields where available.'
                        : null
            };
            const creativeBase = ads.filter(ad => ad.insights?.data?.[0]).map(ad => {
                const insights = ad.insights.data[0];
                const actions = insights.actions || [];
                const actionValues = insights.action_values || [];
                const ctr = parseFloat(insights.ctr || 0);
                const cpc = parseFloat(insights.cpc || 0);
                const cpm = parseFloat(insights.cpm || 0);
                const impressions = parseInt(insights.impressions || 0);
                const clicks = parseInt(insights.clicks || 0);
                const spend = parseFloat(insights.spend || 0);
                const frequency = parseFloat(insights.frequency || 0);
                const createdAt = ad.created_time || ad.updated_time || null;
                const daysActive = Math.max(
                    1,
                    Math.ceil(
                        (Date.now() - new Date(createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
                    )
                );
                const effectiveStatus = String(ad.effective_status || ad.status || '').toUpperCase();
                const isActive = effectiveStatus === 'ACTIVE';

                const videoPlays = parseInt(insights.video_play_actions?.[0]?.value || 0);
                const v25 = parseInt(insights.video_p25_watched_actions?.[0]?.value || 0);
                const v50 = parseInt(insights.video_p50_watched_actions?.[0]?.value || 0);
                const v75 = parseInt(insights.video_p75_watched_actions?.[0]?.value || 0);
                const v100 = parseInt(insights.video_p100_watched_actions?.[0]?.value || 0);
                const hasVideo = videoPlays > 0 || v25 > 0;

                const leads = getActionTotal(actions, ['lead']);
                const purchases = getActionTotal(actions, ['purchase']);
                const conversions = leads + purchases;
                const purchaseValue = getActionTotal(actionValues, ['purchase']);
                const roas = spend > 0 ? purchaseValue / spend : 0;
                const costPerConversion = conversions > 0 ? spend / conversions : null;
                const hookRate = hasVideo && videoPlays > 0 ? (v25 / videoPlays * 100) : null;
                const completionRate = hasVideo && videoPlays > 0 ? (v100 / videoPlays * 100) : null;
                const clickToConversionRate = clicks > 0 ? (conversions / clicks * 100) : 0;
                const confidenceLabel = getConfidenceLabel({ spend, conversions, clicks, impressions });
                const videoSignal = hasVideo
                    ? getVideoSignalConfidence({
                        plays: videoPlays,
                        spend,
                        quartile25Views: v25,
                        completes: v100
                    })
                    : null;

                const primaryImage = ad.creative?.image_url
                    || ad.creative?.object_story_spec?.video_data?.image_url
                    || ad.creative?.object_story_spec?.photo_data?.image_url
                    || ad.creative?.object_story_spec?.link_data?.child_attachments?.find((item) => item?.picture)?.picture
                    || ad.creative?.object_story_spec?.link_data?.picture
                    || null;
                const thumbnail = primaryImage || ad.creative?.thumbnail_url || null;
                const previewSource = primaryImage ? 'creative' : ad.creative?.thumbnail_url ? 'thumbnail' : 'none';

                return {
                    id: ad.id,
                    name: ad.name,
                    status: ad.status,
                    thumbnail,
                    previewSource,
                    impressions,
                    clicks,
                    ctr,
                    cpc,
                    cpm,
                    spend,
                    frequency,
                    createdAt,
                    daysActive,
                    effectiveStatus,
                    isActive,
                    conversions,
                    leads,
                    purchases,
                    purchaseValue,
                    roas,
                    costPerConversion,
                    clickToConversionRate,
                    confidenceLabel,
                    hasVideo,
                    videoMetrics: hasVideo ? {
                        plays: videoPlays,
                        hookRate: hookRate !== null ? hookRate : 0,
                        retention25: v25,
                        retention50: v50,
                        retention75: v75,
                        retention100: v100,
                        completionRate: completionRate !== null ? completionRate : 0,
                        confidenceLabel: videoSignal?.label || 'Low confidence',
                        reliableForCreative: Boolean(videoSignal?.reliableForCreative),
                        reliableForFatigue: Boolean(videoSignal?.reliableForFatigue)
                    } : null
                };
            });

            const medianCtr = getMedian(creativeBase.map(ad => ad.ctr).filter(value => value > 0));
            const medianCpm = getMedian(creativeBase.map(ad => ad.cpm).filter(value => value > 0));
            const medianFrequency = getMedian(creativeBase.map(ad => ad.frequency).filter(value => value > 0));
            const medianCpa = getMedian(creativeBase.map(ad => ad.costPerConversion).filter(value => value !== null && value > 0));
            const medianSpend = getMedian(creativeBase.map(ad => ad.spend).filter(value => value > 0));
            const medianCreativeCvr = getMedian(creativeBase.map(ad => ad.clickToConversionRate).filter(value => value > 0));
            const medianCreativeRoas = getMedian(creativeBase.map(ad => ad.roas).filter(value => value > 0));
            const medianHookRate = getMedian(creativeBase.filter(ad => ad.videoMetrics && ad.videoMetrics.hookRate > 0).map(ad => ad.videoMetrics.hookRate));
            const maxCreativeConversions = creativeBase.reduce((max, ad) => Math.max(max, ad.conversions || 0), 0);
            const maxCreativeSpend = creativeBase.reduce((max, ad) => Math.max(max, ad.spend || 0), 0);

            creativeForensics = creativeBase.map(ad => {
                let pattern;
                const qualifiesWinnerGate = ad.isActive && ad.daysActive >= 3 && ad.spend >= 2000;

                if (
                    qualifiesWinnerGate &&
                    ad.conversions >= 10 &&
                    ad.costPerConversion !== null &&
                    (medianCpa === 0 || ad.costPerConversion <= medianCpa * 0.9) &&
                    ad.ctr >= medianCtr * 0.9
                ) {
                    pattern = {
                        type: 'winner',
                        label: 'Winner',
                        color: '#10b981',
                        insight: 'Strong conversion volume with efficient cost per result.',
                        action: 'Keep scaling carefully and use this creative as a benchmark.'
                    };
                } else if (ad.ctr >= Math.max(2.5, medianCtr * 1.15) && ad.conversions <= 2) {
                    pattern = {
                        type: 'traffic_mismatch',
                        label: 'Traffic Mismatch',
                        color: '#f59e0b',
                        insight: 'The creative is earning clicks, but those clicks are not turning into outcomes.',
                        action: 'Check landing-page fit, offer clarity, and audience intent.'
                    };
                } else if (ad.conversions >= 5 && ad.costPerConversion !== null && (medianCpa === 0 || ad.costPerConversion <= medianCpa * 0.95) && ad.ctr < medianCtr) {
                    pattern = {
                        type: 'efficient_niche',
                        label: 'Efficient Niche',
                        color: '#6366f1',
                        insight: 'Lower CTR, but the traffic is qualified and converts efficiently.',
                        action: 'Protect this creative and test broader hooks without changing the core promise.'
                    };
                } else if (ad.spend >= Math.max(1500, medianSpend) && ad.conversions === 0) {
                    pattern = {
                        type: 'burning_spend',
                        label: 'Burning Spend',
                        color: '#ef4444',
                        insight: 'Meaningful spend has gone in without conversion proof.',
                        action: 'Pause or refresh this creative unless it serves an upper-funnel purpose.'
                    };
                } else if (ad.hasVideo && ad.videoMetrics?.reliableForCreative && ad.videoMetrics.hookRate < 8 && ad.spend >= Math.max(1000, medianSpend * 0.6)) {
                    pattern = {
                        type: 'hook_issue',
                        label: 'Hook Weakness',
                        color: '#f97316',
                        insight: 'The opening seconds are losing viewers before the message can land.',
                        action: 'Rework the first 1-3 seconds and front-load the value proposition.'
                    };
                } else if (ad.spend < Math.max(600, medianSpend * 0.35) && ad.conversions < 3) {
                    pattern = {
                        type: 'early_read',
                        label: 'Early Read',
                        color: '#64748b',
                        insight: 'There is not enough delivery yet for a confident creative verdict.',
                        action: 'Let it collect more spend or impressions before making a hard call.'
                    };
                } else {
                    pattern = {
                        type: 'mixed',
                        label: 'Mixed Read',
                        color: '#0ea5e9',
                        insight: 'The creative has signals worth watching, but the picture is not one-sided.',
                        action: 'Compare audience, placement mix, and landing-page fit before changing it.'
                    };
                }

                let creativeFatigue = 'healthy';
                const fatigueReasons = [];
                if (ad.frequency > Math.max(3.4, medianFrequency + 0.8)) creativeFatigue = 'critical';
                else if (ad.frequency > Math.max(2.4, medianFrequency + 0.4)) creativeFatigue = 'warning';

                if (ad.frequency > Math.max(2.4, medianFrequency + 0.4)) fatigueReasons.push(`Frequency ${ad.frequency.toFixed(2)}x`);
                if (ad.videoMetrics?.reliableForCreative && ad.videoMetrics?.hookRate !== null && ad.videoMetrics?.hookRate < 10) fatigueReasons.push(`Weak hook ${ad.videoMetrics.hookRate.toFixed(1)}%`);
                if (ad.costPerConversion !== null && medianCpa > 0 && ad.costPerConversion > medianCpa * 1.35) fatigueReasons.push(`High CPR ₹${ad.costPerConversion.toFixed(0)}`);
                if (medianCpm > 0 && ad.cpm > medianCpm * 1.3) fatigueReasons.push(`High CPM ₹${ad.cpm.toFixed(0)}`);

                const ctrScore = medianCtr > 0
                    ? Math.min((ad.ctr / medianCtr) * 18, 18)
                    : Math.min((ad.ctr / 3) * 18, 18);
                const cvrScore = medianCreativeCvr > 0
                    ? Math.min((ad.clickToConversionRate / medianCreativeCvr) * 24, 24)
                    : Math.min((ad.clickToConversionRate / 2) * 24, 24);
                const volumeScore = maxCreativeConversions > 0
                    ? Math.min((Math.log10(ad.conversions + 1) / Math.log10(maxCreativeConversions + 1)) * 16, 16)
                    : 0;
                const efficiencyScore = ad.costPerConversion !== null && medianCpa > 0
                    ? Math.min((medianCpa / ad.costPerConversion) * 18, 18)
                    : 0;
                const spendConfidenceScore = maxCreativeSpend > 0
                    ? Math.min((Math.log10(ad.spend + 1) / Math.log10(maxCreativeSpend + 1)) * 10, 10)
                    : 0;
                const roasScore = ad.roas > 0 && medianCreativeRoas > 0
                    ? Math.min((ad.roas / medianCreativeRoas) * 8, 8)
                    : 0;
                const hookScore = ad.hasVideo && ad.videoMetrics && ad.videoMetrics.hookRate > 0
                    ? Math.min((ad.videoMetrics.hookRate / Math.max(medianHookRate || 8, 8)) * 6, 6)
                    : 0;
                const frequencyPenalty = ad.frequency > Math.max(3.5, medianFrequency + 0.8)
                    ? 10
                    : ad.frequency > Math.max(2.5, medianFrequency + 0.4)
                        ? 4
                        : 0;
                const lowDataPenalty = ad.confidenceLabel === 'Low confidence' ? 6 : 0;

                const performanceScore = Math.max(
                    0,
                    Math.min(
                        100,
                        (
                            ctrScore +
                            cvrScore +
                            volumeScore +
                            efficiencyScore +
                            spendConfidenceScore +
                            roasScore +
                            hookScore -
                            frequencyPenalty -
                            lowDataPenalty
                        )
                    )
                );

                return {
                    ...ad,
                    ctr: ad.ctr.toFixed(2),
                    cpc: ad.cpc.toFixed(2),
                    cpm: ad.cpm.toFixed(2),
                    frequency: ad.frequency.toFixed(2),
                    clickToConversionRate: ad.clickToConversionRate.toFixed(2),
                    costPerConversion: ad.costPerConversion !== null ? ad.costPerConversion.toFixed(2) : null,
                    roas: ad.roas > 0 ? ad.roas.toFixed(2) : null,
                    videoMetrics: ad.videoMetrics ? {
                        ...ad.videoMetrics,
                        hookRate: ad.videoMetrics.hookRate.toFixed(1),
                        completionRate: ad.videoMetrics.completionRate.toFixed(1)
                    } : null,
                    pattern,
                    winnerGate: {
                        isActive: ad.isActive,
                        minDaysActive: ad.daysActive >= 3,
                        minSpend: ad.spend >= 2000
                    },
                    performanceScore: performanceScore.toFixed(0),
                    scoreComponents: {
                        ctrScore: ctrScore.toFixed(1),
                        cvrScore: cvrScore.toFixed(1),
                        volumeScore: volumeScore.toFixed(1),
                        efficiencyScore: efficiencyScore.toFixed(1),
                        spendConfidenceScore: spendConfidenceScore.toFixed(1),
                        roasScore: roasScore.toFixed(1),
                        hookScore: hookScore.toFixed(1),
                        frequencyPenalty,
                        lowDataPenalty
                    },
                    fatigue: {
                        status: creativeFatigue,
                        frequency: ad.frequency,
                        reasons: fatigueReasons
                    }
                };
            }).sort((a, b) => {
                const scoreDiff = parseFloat(b.performanceScore) - parseFloat(a.performanceScore);
                if (scoreDiff !== 0) return scoreDiff;
                return b.conversions - a.conversions;
            });

            if (creativeBase.length === 0) {
                creativeForensicsMeta.note = 'Meta returned ad objects for this account, but none had ad-level insight rows in the selected date range.';
            }

            const videoCreatives = creativeForensics.filter(ad => ad.hasVideo && ad.videoMetrics && ad.spend > 0);
            const reliableVideoCreatives = videoCreatives.filter(ad => ad.videoMetrics?.reliableForFatigue);
            const lowConfidenceVideoCreatives = videoCreatives.filter(ad => !ad.videoMetrics?.reliableForFatigue);

            if (reliableVideoCreatives.length > 0) {
                const totalVideoSpend = reliableVideoCreatives.reduce((sum, ad) => sum + ad.spend, 0);
                const weightedHook = totalVideoSpend > 0
                    ? reliableVideoCreatives.reduce((sum, ad) => sum + (parseFloat(ad.videoMetrics.hookRate || 0) * ad.spend), 0) / totalVideoSpend
                    : 0;
                const weightedCompletion = totalVideoSpend > 0
                    ? reliableVideoCreatives.reduce((sum, ad) => sum + (parseFloat(ad.videoMetrics.completionRate || 0) * ad.spend), 0) / totalVideoSpend
                    : 0;
                const hookScore = weightedHook < 8 ? 85 : weightedHook < 12 ? 55 : weightedHook < 18 ? 25 : 0;
                const completionScore = weightedCompletion < 1 ? 60 : weightedCompletion < 3 ? 35 : weightedCompletion < 6 ? 15 : 0;
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
                    weightedCompletionRate: weightedCompletion.toFixed(1),
                    hookConfidenceLabel: reliableVideoCreatives.length >= 3 ? 'High confidence' : 'Medium confidence',
                    reliableVideoCreatives: reliableVideoCreatives.length,
                    excludedLowConfidenceVideoCreatives: lowConfidenceVideoCreatives.length,
                    componentScores: {
                        ...(fatigueAnalysis.metrics?.componentScores || {}),
                        hook: creativePressure
                    }
                };
                if (lowConfidenceVideoCreatives.length > 0) {
                    fatigueAnalysis.missingSignals = [
                        ...(fatigueAnalysis.missingSignals || []),
                        `${lowConfidenceVideoCreatives.length} video creative${lowConfidenceVideoCreatives.length === 1 ? '' : 's'} had low-confidence watch-depth data and were excluded from hook pressure scoring.`
                    ];
                }
            } else {
                fatigueAnalysis.missingSignals = [
                    ...(fatigueAnalysis.missingSignals || []),
                    videoCreatives.length > 0
                        ? 'Video watch data existed, but it stayed low-confidence in this date range, so the fatigue model excluded hook/completion pressure.'
                        : 'No meaningful video-watch data was available, so the fatigue model could not use hook or completion quality.'
                ];
            }

            if (fatigueAnalysis.metrics?.componentScores) {
                const componentScores = fatigueAnalysis.metrics.componentScores || {};
                const audienceSaturation = ((Number(componentScores.frequency || 0) * 0.6) + (Number(componentScores.ctr || 0) * 0.4));
                const creativeDecay = componentScores.hook === null || componentScores.hook === undefined
                    ? ((Number(componentScores.ctr || 0) * 0.7) + (Number(componentScores.frequency || 0) * 0.3))
                    : ((Number(componentScores.hook || 0) * 0.65) + (Number(componentScores.ctr || 0) * 0.35));
                const auctionPressure = ((Number(componentScores.cpm || 0) * 0.45) + (Number(componentScores.cpc || 0) * 0.2) + (Number(componentScores.cpr || 0) * 0.35));

                fatigueAnalysis.sourceSplit = [
                    {
                        key: 'audience',
                        label: 'Audience Saturation',
                        score: parseFloat(audienceSaturation.toFixed(1)),
                        detail: `Frequency ${fatigueAnalysis.metrics.currentFrequency || '0.00'}x with CTR trend ${fatigueAnalysis.metrics.ctrDecay || '0.0'}%.`,
                        confidenceLabel: 'High confidence'
                    },
                    {
                        key: 'creative',
                        label: 'Creative Decay',
                        score: parseFloat(creativeDecay.toFixed(1)),
                        detail: componentScores.hook === null || componentScores.hook === undefined
                            ? 'Hook pressure is unavailable, so this read leans on CTR softening and repeat exposure only.'
                            : `Hook pressure ${Math.round(Number(componentScores.hook || 0))} with ${fatigueAnalysis.metrics.weightedHookRate || '0.0'}% weighted hook rate.`,
                        confidenceLabel: fatigueAnalysis.metrics?.hookConfidenceLabel || 'Low confidence'
                    },
                    {
                        key: 'auction',
                        label: 'Auction Pressure',
                        score: parseFloat(auctionPressure.toFixed(1)),
                        detail: `CPM ${fatigueAnalysis.metrics.cpmIncrease || '0.0'}%, CPC ${fatigueAnalysis.metrics.cpcIncrease || '0.0'}%, CPR ${fatigueAnalysis.metrics.cprIncrease ?? 'n/a'}%.`,
                        confidenceLabel: fatigueAnalysis.metrics?.cprIncrease === null ? 'Medium confidence' : 'High confidence'
                    }
                ].sort((a, b) => b.score - a.score);
            }

            fatigueAnalysis.status = fatigueAnalysis.score >= 60 ? 'critical' : fatigueAnalysis.score >= 30 ? 'warning' : 'healthy';
            fatigueAnalysis.statusEmoji = fatigueAnalysis.score >= 60 ? '🔴' : fatigueAnalysis.score >= 30 ? '🟡' : '🟢';
            fatigueAnalysis.statusLabel = fatigueAnalysis.score >= 60 ? 'Fatigue Critical' : fatigueAnalysis.score >= 30 ? 'Fatigue Building' : 'Healthy';
        } else {
            creativeForensicsMeta.note = 'The ad-level creative fetch did not complete for this account, so creative diagnostics could not be calculated for this refresh.';
        }

        // ==================== 4. LEARNING PHASE STATUS ====================
        let learningPhase = [];

        if (adsetsRes.status === 'fulfilled') {
            const adsets = adsetsRes.value.data.data || [];
            const selectedWindowDays = getPresetWindowDays(datePreset);

            learningPhase = adsets.map(adset => {
                const status = adset.effective_status || adset.status;
                const insights = adset.insights?.data?.[0] || {};
                const actions = insights.actions || [];
                const spend = parseFloat(insights.spend || 0);
                const campaignObjective = adset.campaign?.objective || '';
                const goalProfile = describeOptimizationGoal(adset.optimization_goal, campaignObjective);
                const generalConversions = getActionTotal(actions, ['purchase', 'lead', 'complete_registration', 'add_to_cart']);
                const goalEvents = goalProfile.metricSource === 'clicks'
                    ? parseFloat(insights.clicks || 0)
                    : goalProfile.metricSource === 'impressions'
                        ? parseFloat(insights.impressions || 0)
                        : goalProfile.metricSource === 'reach'
                            ? parseFloat(insights.reach || 0)
                            : getActionTotal(actions, goalProfile.actionCandidates);
                const daysActive = Math.max(
                    1,
                    Math.ceil(
                        (Date.now() - new Date(adset.start_time || adset.created_time || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
                    )
                );
                const weeklyPace = selectedWindowDays > 0
                    ? (goalEvents / selectedWindowDays) * 7
                    : goalEvents;
                const benchmarkProgress = goalProfile.benchmarkTarget
                    ? Math.min((weeklyPace / goalProfile.benchmarkTarget) * 100, 100)
                    : null;
                const ctrValue = parseFloat(insights.ctr || 0);
                const frequencyValue = parseFloat(insights.frequency || 0);
                const isLearning = status === 'LEARNING' || status === 'PENDING_REVIEW';
                const isLimited = status === 'LEARNING_LIMITED';
                const isActive = status === 'ACTIVE';
                const deliveryWarnings = [];

                if (goalProfile.needsOptimizationEvents && weeklyPace < 50) {
                    deliveryWarnings.push(`Projected pace is only ${weeklyPace.toFixed(1)}/week against the ${goalProfile.benchmarkTarget}/week benchmark.`);
                }
                if (daysActive < Math.min(5, selectedWindowDays || 5)) {
                    deliveryWarnings.push('This ad set is still young, so delivery stability is not proven yet.');
                }
                if (frequencyValue >= (goalProfile.needsOptimizationEvents ? 3.2 : 2.2)) {
                    deliveryWarnings.push(`Frequency is elevated at ${frequencyValue.toFixed(2)}x.`);
                }
                if (ctrValue > 0 && ctrValue < (goalProfile.needsOptimizationEvents ? 1 : 0.15)) {
                    deliveryWarnings.push(`CTR is soft at ${ctrValue.toFixed(2)}%.`);
                }

                const hasStableRunway = daysActive >= Math.min(5, selectedWindowDays || 5);
                const hasHealthyFrequency = frequencyValue === 0 || frequencyValue < (goalProfile.needsOptimizationEvents ? 3.2 : 2.2);
                const hasViableCtr = ctrValue === 0 || ctrValue >= (goalProfile.needsOptimizationEvents ? 1 : 0.15);
                const awarenessScaleReady = !goalProfile.needsOptimizationEvents
                    && spend >= 5000
                    && daysActive >= 10
                    && hasStableRunway
                    && hasHealthyFrequency
                    && hasViableCtr
                    && goalEvents >= (goalProfile.metricSource === 'reach' ? 150000 : 250000);
                const safeToScale = goalProfile.needsOptimizationEvents
                    ? weeklyPace >= Math.max(goalProfile.benchmarkTarget || 50, 75) && spend >= 2000 && hasStableRunway && hasHealthyFrequency && hasViableCtr
                    : awarenessScaleReady;
                const confidenceLabel = getConfidenceLabel({
                    spend,
                    conversions: goalProfile.needsOptimizationEvents ? goalEvents : generalConversions,
                    clicks: parseFloat(insights.clicks || 0),
                    impressions: parseFloat(insights.impressions || 0)
                });

                if (!goalProfile.needsOptimizationEvents && isActive && !awarenessScaleReady) {
                    deliveryWarnings.push('Delivery is stable, but this awareness ad set has not cleared the stronger scale-ready thresholds for spend depth, age, frequency, CTR, and delivery volume.');
                }

                let learningStatus = { status: 'unknown', label: 'Unknown', color: '#6b7280', icon: '❓' };

                if (goalProfile.needsOptimizationEvents && isLearning) {
                    learningStatus = {
                        status: 'learning',
                        label: 'Learning',
                        color: '#f59e0b',
                        icon: '📚',
                        progress: benchmarkProgress,
                        risk: weeklyPace < 25 ? 'high' : weeklyPace < 45 ? 'medium' : 'low',
                        riskLabel: weeklyPace < 25 ? 'Pace is too low' : weeklyPace < 45 ? 'Needs more event volume' : 'Nearly stable',
                        note: `Projected pace: ${weeklyPace.toFixed(1)} ${goalProfile.metricLabel.toLowerCase()}/week`
                    };
                } else if (goalProfile.needsOptimizationEvents && isLimited) {
                    learningStatus = {
                        status: 'limited',
                        label: 'Learning Limited',
                        color: '#ef4444',
                        icon: '⚠️',
                        recommendation: `Needs more ${goalProfile.metricLabel.toLowerCase()} volume per week. Consider broader targeting, fewer edits, or a simpler optimization event.`,
                        progress: benchmarkProgress
                    };
                } else if (!goalProfile.needsOptimizationEvents && isLearning) {
                    learningStatus = {
                        status: 'delivery_learning',
                        label: 'New Delivery',
                        color: '#6366f1',
                        icon: '🌀',
                        note: 'This goal is judged on delivery stability rather than a 50-event benchmark.'
                    };
                } else if (isActive) {
                    learningStatus = {
                        status: goalProfile.needsOptimizationEvents ? 'active' : 'delivery_active',
                        label: safeToScale
                            ? 'Scale Ready'
                            : goalProfile.needsOptimizationEvents
                                ? 'Stable Delivery'
                                : 'Delivery Stable',
                        color: '#10b981',
                        icon: '✅',
                        safeToScale,
                        note: safeToScale
                            ? 'Event pace, spend depth, age, and frequency all support cautious scaling.'
                            : goalProfile.needsOptimizationEvents
                                ? `Projected pace: ${weeklyPace.toFixed(1)} ${goalProfile.metricLabel.toLowerCase()}/week. Use the watchouts below before scaling harder.`
                                : 'This awareness goal is judged on delivery stability first. It only becomes scale-ready once spend depth, age, frequency, CTR, and reach/impression volume all look durable.'
                    };
                }

                return {
                    id: adset.id,
                    name: adset.name,
                    status: adset.status,
                    effectiveStatus: status,
                    campaignName: adset.campaign?.name || null,
                    campaignObjective,
                    optimizationGoal: adset.optimization_goal,
                    bidStrategy: adset.bid_strategy,
                    budget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : (adset.lifetime_budget ? parseFloat(adset.lifetime_budget) / 100 : 0),
                    budgetType: adset.daily_budget ? 'daily' : 'lifetime',
                    spend,
                    conversions: generalConversions,
                    goalEvents: parseFloat(goalEvents.toFixed(1)),
                    goalLabel: goalProfile.metricLabel,
                    benchmarkLabel: goalProfile.benchmarkLabel,
                    benchmarkProgress: benchmarkProgress !== null ? parseFloat(benchmarkProgress.toFixed(1)) : null,
                    daysActive,
                    weeklyPace: parseFloat(weeklyPace.toFixed(1)),
                    needsOptimizationEvents: goalProfile.needsOptimizationEvents,
                    objectiveType: goalProfile.objectiveLabel,
                    optimizationType: goalProfile.friendlyLabel,
                    confidenceLabel,
                    warnings: deliveryWarnings,
                    learningStatus,
                    startTime: adset.start_time || null,
                    frequency: frequencyValue,
                    ctr: ctrValue.toFixed(2)
                };
            }).sort((a, b) => (b.spend || 0) - (a.spend || 0));
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
                const coldCpa = coldMetrics.conversions > 0 ? (coldMetrics.spend / coldMetrics.conversions) : null;
                const retargetCpa = retargetMetrics.conversions > 0 ? (retargetMetrics.spend / retargetMetrics.conversions) : null;
                const cpaDelta = coldCpa && retargetCpa && coldCpa > 0
                    ? ((coldCpa - retargetCpa) / coldCpa * 100)
                    : null;

                let insight = '';
                let status = 'neutral';
                let confidence = 'low';
                let confidenceLabel = 'Low confidence';
                let sampleNote = 'Retargeting has a small sample in this window, so treat the lift as directional.';

                if (retargetMetrics.clicks >= 1000 && retargetMetrics.conversions >= 20) {
                    confidence = 'high';
                    confidenceLabel = 'High confidence';
                    sampleNote = 'Retargeting has enough click and conversion volume for a more stable read.';
                } else if (retargetMetrics.clicks >= 300 && retargetMetrics.conversions >= 5) {
                    confidence = 'medium';
                    confidenceLabel = 'Medium confidence';
                    sampleNote = 'Retargeting shows a usable signal, but the sample is still modest.';
                }

                if (lift > 50) {
                    insight = confidence === 'high'
                        ? 'Retargeting is clearly converting more efficiently than cold traffic in this period.'
                        : 'Retargeting looks stronger than cold traffic, but the sample is not large enough to treat this as conclusive.';
                    status = 'excellent';
                } else if (lift > 20) {
                    insight = confidence === 'low'
                        ? 'Retargeting appears to be helping, but the sample is still small.'
                        : 'Retargeting is delivering a healthy efficiency lift versus cold traffic.';
                    status = 'good';
                } else if (lift > 0) {
                    insight = 'Retargeting is only slightly ahead of cold traffic, so audience quality or sequencing may need work.';
                    status = 'warning';
                } else {
                    insight = 'Retargeting is underperforming cold traffic in this window, which can point to weak audience quality, offer mismatch, or a noisy sample.';
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
                        cpa: coldCpa ? coldCpa.toFixed(2) : null
                    },
                    retarget: {
                        clicks: retargetMetrics.clicks,
                        conversions: retargetMetrics.conversions,
                        spend: retargetMetrics.spend,
                        conversionRate: retargetConvRate.toFixed(3),
                        cpa: retargetCpa ? retargetCpa.toFixed(2) : null
                    },
                    lift: lift.toFixed(1),
                    cpaDelta: cpaDelta !== null ? cpaDelta.toFixed(1) : null,
                    denominator: 'clicks',
                    status,
                    insight,
                    confidence,
                    confidenceLabel,
                    sampleNote
                };
            }
        }

        // ==================== 6. CAMPAIGN QUALITY INDEX ====================
        let leadQualityScore = null;

        if (campaignsRes.status === 'fulfilled') {
            const campaigns = campaignsRes.value.data.data || [];

            // Calculate LQS per campaign
            const campaignBase = campaigns.filter(c => c.insights?.data?.[0]).map(c => {
                const insights = c.insights.data[0];
                const actionValues = insights.action_values || [];
                const ctr = parseFloat(insights.ctr || 0);
                const clicks = parseInt(insights.clicks || 0);
                const impressions = parseInt(insights.impressions || 0);
                const frequency = parseFloat(insights.frequency || 0);
                const spend = parseFloat(insights.spend || 0);
                const cpc = parseFloat(insights.cpc || 0);

                const conversions = (insights.actions || []).reduce((sum, a) =>
                    ['purchase', 'lead', 'complete_registration'].includes(a.action_type) ? sum + parseInt(a.value) : sum, 0);

                const conversionRate = clicks > 0 ? (conversions / clicks * 100) : 0;
                const cpa = conversions > 0 ? spend / conversions : null;
                const purchaseValue = getActionTotal(actionValues, ['purchase']);
                const roas = spend > 0 ? purchaseValue / spend : 0;
                const confidenceLabel = getConfidenceLabel({ spend, conversions, clicks, impressions });

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
                    cpa,
                    roas,
                    confidenceLabel
                };
            });

            const medianCampaignCtr = getMedian(campaignBase.map(c => c.ctr).filter(value => value > 0));
            const medianCampaignCvr = getMedian(campaignBase.map(c => c.conversionRate).filter(value => value > 0));
            const medianCampaignCpa = getMedian(campaignBase.map(c => c.cpa).filter(value => value !== null && value > 0));
            const medianCampaignCpc = getMedian(campaignBase.map(c => c.cpc).filter(value => value > 0));
            const medianCampaignRoas = getMedian(campaignBase.map(c => c.roas).filter(value => value > 0));
            const maxCampaignConversions = campaignBase.reduce((max, campaign) => Math.max(max, campaign.conversions || 0), 0);
            const maxCampaignSpend = campaignBase.reduce((max, campaign) => Math.max(max, campaign.spend || 0), 0);
            const campaignLQS = campaignBase.map(c => {
                const ctrScore = medianCampaignCtr > 0
                    ? Math.min((c.ctr / medianCampaignCtr) * 18, 18)
                    : Math.min((c.ctr / 3) * 18, 18);
                const conversionScore = medianCampaignCvr > 0
                    ? Math.min((c.conversionRate / medianCampaignCvr) * 24, 24)
                    : Math.min((c.conversionRate / 2) * 24, 24);
                const cpaScore = c.cpa && medianCampaignCpa > 0
                    ? Math.min((medianCampaignCpa / c.cpa) * 16, 16)
                    : 0;
                const cpcScore = c.cpc > 0 && medianCampaignCpc > 0
                    ? Math.min((medianCampaignCpc / c.cpc) * 8, 8)
                    : 0;
                const volumeScore = maxCampaignConversions > 0
                    ? Math.min((Math.log10(c.conversions + 1) / Math.log10(maxCampaignConversions + 1)) * 12, 12)
                    : 0;
                const spendConfidence = maxCampaignSpend > 0
                    ? Math.min((Math.log10(c.spend + 1) / Math.log10(maxCampaignSpend + 1)) * 10, 10)
                    : 0;
                const roasScore = c.roas > 0 && medianCampaignRoas > 0
                    ? Math.min((c.roas / medianCampaignRoas) * 12, 12)
                    : 0;
                const frequencyPenalty = c.frequency > 3.5 ? 10 : c.frequency > 2.5 ? 5 : 0;
                const lowDataPenalty = c.confidenceLabel === 'Low confidence' ? 7 : 0;

                const rawLQS = ctrScore + conversionScore + cpaScore + cpcScore + volumeScore + spendConfidence + roasScore - frequencyPenalty - lowDataPenalty;
                const lqs = Math.max(0, Math.min(100, rawLQS));

                let grade = 'D';
                let gradeColor = '#ef4444';
                if (lqs >= 78) { grade = 'A'; gradeColor = '#10b981'; }
                else if (lqs >= 60) { grade = 'B'; gradeColor = '#6366f1'; }
                else if (lqs >= 40) { grade = 'C'; gradeColor = '#f59e0b'; }

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
                        roas: c.roas > 0 ? c.roas.toFixed(2) : null,
                        confidenceLabel: c.confidenceLabel,
                        ctrScore: ctrScore.toFixed(1),
                        conversionScore: conversionScore.toFixed(1),
                        cpaScore: cpaScore.toFixed(1),
                        cpcScore: cpcScore.toFixed(1),
                        volumeScore: volumeScore.toFixed(1),
                        spendConfidence: spendConfidence.toFixed(1),
                        roasScore: roasScore.toFixed(1),
                        frequencyPenalty,
                        lowDataPenalty
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
                creativeForensicsMeta,
                learningPhase,
                retargetingLift,
                leadQualityScore,
                campaignQualityIndex: leadQualityScore,
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
        const cacheKey = buildMetaCacheKey('meta-deep-v3', [req.user.userId, accountId, datePreset, campaignId || 'all']);
        const cached = getMetaCacheEntry(cacheKey);
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        let deepAccountProfile = {
            type: 'general',
            label: 'General',
            dominantShare: 0,
            objectiveMix: []
        };

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
                    fields: 'id,name,status,effective_status,created_time,updated_time,campaign_id,campaign{id,name},adset{id,name},creative{id,name,image_url,thumbnail_url,object_story_spec},insights.date_preset(' + datePreset + '){impressions,reach,clicks,ctr,spend,actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_play_actions}',
                    limit: 100
                }
            })
        ]);

        // ==================== 1. NURTURE EFFICIENCY FUNNEL (Per-Campaign) ====================
        let campaignFunnels = [];
        let overallFunnel = null;

        if (campaignFunnelRes.status === 'fulfilled') {
            const campaigns = campaignFunnelRes.value.data.data || [];
            deepAccountProfile = buildAccountProfile(campaigns, {});

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
                const landingPageViews = getActionValue('landing_page_view');
                const viewContent = getActionValue('view_content');
                const addToCart = getActionValue('add_to_cart');
                const initiateCheckout = getActionValue('initiate_checkout');
                const purchase = getActionValue('purchase');
                const purchaseRevenue = getActionRevenue('purchase');
                const spend = parseFloat(insights.spend || 0);

                // Calculate drop-off deltas (percentage of people lost at each stage)
                const hasLandingPageViewData = landingPageViews > 0;
                const bounceGap = hasLandingPageViewData && outboundClicks > 0
                    ? ((outboundClicks - landingPageViews) / outboundClicks * 100)
                    : null;
                const lpvToVc = hasLandingPageViewData && viewContent > 0
                    ? ((landingPageViews - viewContent) / landingPageViews * 100)
                    : null;
                const vcToAtc = viewContent > 0 && addToCart > 0 ? ((viewContent - addToCart) / viewContent * 100) : null;
                const atcToPurchase = addToCart > 0 && purchase > 0 ? ((addToCart - purchase) / addToCart * 100) : null;

                // Conversion Velocity Score (higher = faster conversions)
                const velocityScore = linkClicks > 0 ? ((purchase / linkClicks) * 100).toFixed(2) : 0;

                // Calculate ROAS
                const roas = spend > 0 ? (purchaseRevenue / spend) : 0;

                // Determine quality based on bounce gap
                let bounceQuality = 'unknown';
                let bounceInsight = 'Landing page view data is unavailable for this campaign.';
                if (bounceGap === null) {
                    bounceQuality = 'unknown';
                } else if (bounceGap > 50) {
                    bounceQuality = 'critical';
                    bounceInsight = 'High click-to-landing loss suggests slow pages or mismatched traffic.';
                } else if (bounceGap > 30) {
                    bounceQuality = 'warning';
                    bounceInsight = 'Moderate click-to-landing loss. Review page speed and mobile experience.';
                } else if (bounceGap > 15) {
                    bounceQuality = 'acceptable';
                    bounceInsight = 'Some click-to-landing loss is expected, but there is room to tighten the handoff.';
                } else {
                    bounceQuality = 'excellent';
                    bounceInsight = 'Low click-to-landing loss indicates a strong handoff from ad to site.';
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
                        bounceGap: bounceGap === null ? null : parseFloat(bounceGap.toFixed(1)),
                        bounceQuality,
                        bounceInsight,
                        lpvToVc: lpvToVc === null ? null : parseFloat(lpvToVc.toFixed(1)),
                        vcToAtc: vcToAtc === null ? null : parseFloat(vcToAtc.toFixed(1)),
                        atcToPurchase: atcToPurchase === null ? null : parseFloat(atcToPurchase.toFixed(1))
                    },
                    conversions: {
                        rate: parseFloat(velocityScore),
                        atcToPurchaseRate: addToCart > 0 ? parseFloat(((purchase / addToCart) * 100).toFixed(1)) : 0,
                        roas: parseFloat(roas.toFixed(2)),
                        costPerPurchase: getCPA('purchase')
                    },
                    dataQuality: {
                        hasLandingPageViewData
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
                    const effectiveStatus = String(ad.effective_status || ad.status || '').toUpperCase();
                    const isActive = effectiveStatus === 'ACTIVE';
                    const daysActive = Math.max(
                        1,
                        Math.ceil(
                            (Date.now() - new Date(ad.created_time || ad.updated_time || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
                        )
                    );

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
                    const spend = parseFloat(insights.spend || 0);
                    const qualifiesWinnerGate = isActive && daysActive >= 3 && spend >= 2000;

                    if (hookRate >= 50 && holdRate >= 60 && qualifiesWinnerGate) {
                        pattern = '🏆 Full Engagement Winner';
                        insight = 'Great hook AND content keeps viewers engaged until the end';
                        color = '#10b981';
                    } else if (hookRate >= 50 && holdRate >= 60) {
                        pattern = '🌱 Promising Engagement';
                        insight = 'Strong engagement shape, but it has not cleared the 3-day active and ₹2,000 spend gate for a true winner call yet.';
                        color = '#14b8a6';
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

                    return {
                        adId: ad.id,
                        adName: ad.name,
                        campaignId: ad.campaign_id,
                        campaignName: ad.campaign?.name || null,
                        adsetName: ad.adset?.name || null,
                        status: ad.status,
                        thumbnail: ad.creative?.image_url
                            || ad.creative?.object_story_spec?.video_data?.image_url
                            || ad.creative?.object_story_spec?.photo_data?.image_url
                            || ad.creative?.object_story_spec?.link_data?.child_attachments?.find((item) => item?.picture)?.picture
                            || ad.creative?.object_story_spec?.link_data?.picture
                            || ad.creative?.thumbnail_url
                            || null,
                        previewSource: ad.creative?.image_url
                            || ad.creative?.object_story_spec?.video_data?.image_url
                            || ad.creative?.object_story_spec?.photo_data?.image_url
                            || ad.creative?.object_story_spec?.link_data?.child_attachments?.find((item) => item?.picture)?.picture
                            || ad.creative?.object_story_spec?.link_data?.picture
                            ? 'creative'
                            : ad.creative?.thumbnail_url
                                ? 'thumbnail'
                                : 'none',
                        spend,
                        daysActive,
                        isActive,
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

        // ==================== 4. PLACEMENT DIAGNOSTICS ====================
        let placementDiagnostics = [];
        let placementSummary = null;

        if (placementArbitrageRes.status === 'fulfilled') {
            const placements = placementArbitrageRes.value.data.data || [];
            const profileType = deepAccountProfile?.type || 'general';

            placementDiagnostics = placements.map(p => {
                const spend = parseFloat(p.spend || 0);
                const impressions = parseInt(p.impressions || 0);
                const clicks = parseInt(p.clicks || 0);
                const reach = parseInt(p.reach || 0);
                const actions = p.actions || [];
                const actionValues = p.action_values || [];
                const purchaseMetric = findActionMetric(actions, ACTION_CANDIDATES.purchases);
                const purchaseValueMetric = findActionMetric(actionValues, ACTION_CANDIDATES.purchases);
                const leadMetric = findActionMetric(actions, ACTION_CANDIDATES.leads);
                const landingPageViewMetric = findActionMetric(actions, ['landing_page_view']);
                const purchaseCount = parseInt(purchaseMetric?.value || 0, 10);
                const leads = parseInt(leadMetric?.value || 0, 10);
                const landingPageViews = parseInt(landingPageViewMetric?.value || 0, 10);
                const revenue = parseFloat(purchaseValueMetric?.value || 0);

                const cpc = clicks > 0 ? spend / clicks : 0;
                const cpm = impressions > 0 ? (spend / impressions * 1000) : 0;
                const ctr = parseFloat(p.ctr || 0);
                const roas = spend > 0 ? (revenue / spend) : 0;
                const cpa = purchaseCount > 0 ? (spend / purchaseCount) : 0;
                const cpl = leads > 0 ? (spend / leads) : 0;
                const lpvRate = clicks > 0 ? (landingPageViews / clicks) * 100 : 0;

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
                        landingPageViews,
                        leads,
                        cpc: parseFloat(cpc.toFixed(2)),
                        cpm: parseFloat(cpm.toFixed(2)),
                        ctr,
                        purchases: purchaseCount,
                        revenue,
                        roas: parseFloat(roas.toFixed(2)),
                        cpa: parseFloat(cpa.toFixed(2)),
                        cpl: parseFloat(cpl.toFixed(2)),
                        lpvRate: parseFloat(lpvRate.toFixed(1))
                    }
                };
            }).filter(p => p.metrics.spend > 0);

            if (placementDiagnostics.length >= 1) {
                const totalSpend = placementDiagnostics.reduce((sum, placement) => sum + placement.metrics.spend, 0);
                const totalRevenue = placementDiagnostics.reduce((sum, placement) => sum + placement.metrics.revenue, 0);
                const totalPurchases = placementDiagnostics.reduce((sum, placement) => sum + placement.metrics.purchases, 0);
                const totalLeads = placementDiagnostics.reduce((sum, placement) => sum + placement.metrics.leads, 0);
                const totalLandingPageViews = placementDiagnostics.reduce((sum, placement) => sum + placement.metrics.landingPageViews, 0);
                const totalClicks = placementDiagnostics.reduce((sum, placement) => sum + placement.metrics.clicks, 0);

                const benchmarkRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
                const benchmarkCPA = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
                const benchmarkCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
                const benchmarkCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
                const benchmarkLpvRate = totalClicks > 0 ? (totalLandingPageViews / totalClicks) * 100 : 0;

                placementDiagnostics = placementDiagnostics.map((placement) => {
                    const spendShare = totalSpend > 0 ? (placement.metrics.spend / totalSpend) * 100 : 0;
                    const enoughSpend = spendShare >= 5;
                    const enoughData = enoughSpend || placement.metrics.clicks >= 40 || placement.metrics.purchases >= 3 || placement.metrics.leads >= 3;
                    let recommendation = 'Needs data';
                    let recommendationColor = '#94a3b8';

                    if (profileType === 'sales' || profileType === 'mixed') {
                        if (placement.metrics.purchases === 0 && enoughSpend) {
                            recommendation = 'Review';
                            recommendationColor = '#ef4444';
                        } else if (
                            placement.metrics.purchases >= 3 &&
                            placement.metrics.roas >= Math.max(1, benchmarkRoas * 0.9) &&
                            (placement.metrics.cpa === 0 || benchmarkCPA === 0 || placement.metrics.cpa <= benchmarkCPA * 1.15)
                        ) {
                            recommendation = 'Scale';
                            recommendationColor = '#10b981';
                        } else if (placement.metrics.purchases > 0 && placement.metrics.roas >= 1) {
                            recommendation = 'Hold';
                            recommendationColor = '#0ea5e9';
                        } else if (enoughData) {
                            recommendation = 'Watch';
                            recommendationColor = '#f59e0b';
                        }
                    } else if (profileType === 'leads') {
                        if (placement.metrics.leads === 0 && enoughSpend) {
                            recommendation = 'Review';
                            recommendationColor = '#ef4444';
                        } else if (
                            placement.metrics.leads >= 3 &&
                            (benchmarkCpl === 0 || placement.metrics.cpl <= benchmarkCpl * 1.1) &&
                            placement.metrics.ctr >= 1
                        ) {
                            recommendation = 'Scale';
                            recommendationColor = '#10b981';
                        } else if (placement.metrics.leads > 0) {
                            recommendation = 'Hold';
                            recommendationColor = '#0ea5e9';
                        } else if (enoughData) {
                            recommendation = 'Watch';
                            recommendationColor = '#f59e0b';
                        }
                    } else if (profileType === 'traffic') {
                        if (placement.metrics.clicks === 0 && enoughSpend) {
                            recommendation = 'Review';
                            recommendationColor = '#ef4444';
                        } else if (
                            placement.metrics.clicks >= 40 &&
                            (benchmarkCpc === 0 || placement.metrics.cpc <= benchmarkCpc * 1.05) &&
                            placement.metrics.lpvRate >= Math.max(40, benchmarkLpvRate * 0.9)
                        ) {
                            recommendation = 'Scale';
                            recommendationColor = '#10b981';
                        } else if (placement.metrics.clicks > 0 && placement.metrics.lpvRate > 0) {
                            recommendation = 'Hold';
                            recommendationColor = '#0ea5e9';
                        } else if (enoughData) {
                            recommendation = 'Watch';
                            recommendationColor = '#f59e0b';
                        }
                    } else {
                        if (placement.metrics.reach > 0 && placement.metrics.cpm > 0 && (benchmarkCpc === 0 || placement.metrics.cpm <= (totalSpend > 0 && placementDiagnostics.reduce((sum, row) => sum + row.metrics.impressions, 0) > 0 ? (totalSpend / placementDiagnostics.reduce((sum, row) => sum + row.metrics.impressions, 0)) * 1000 * 1.1 : placement.metrics.cpm))) {
                            recommendation = 'Efficient';
                            recommendationColor = '#10b981';
                        } else if (enoughData) {
                            recommendation = 'Watch';
                            recommendationColor = '#f59e0b';
                        }
                    }

                    return {
                        ...placement,
                        metrics: {
                            ...placement.metrics,
                            spendShare: parseFloat(spendShare.toFixed(1))
                        },
                        recommendation,
                        recommendationColor
                    };
                });

                if (profileType === 'sales' || profileType === 'mixed') {
                    placementDiagnostics.sort((a, b) => {
                        const scoreA = (a.metrics.purchases * 18) + (a.metrics.roas * 12) - (a.metrics.cpa > 0 ? a.metrics.cpa / Math.max(benchmarkCPA || 1, 1) : 0);
                        const scoreB = (b.metrics.purchases * 18) + (b.metrics.roas * 12) - (b.metrics.cpa > 0 ? b.metrics.cpa / Math.max(benchmarkCPA || 1, 1) : 0);
                        return scoreB - scoreA;
                    });
                } else if (profileType === 'leads') {
                    placementDiagnostics.sort((a, b) => {
                        const scoreA = (a.metrics.leads * 16) + (a.metrics.ctr * 6) - (a.metrics.cpl > 0 ? a.metrics.cpl / Math.max(benchmarkCpl || 1, 1) : 0);
                        const scoreB = (b.metrics.leads * 16) + (b.metrics.ctr * 6) - (b.metrics.cpl > 0 ? b.metrics.cpl / Math.max(benchmarkCpl || 1, 1) : 0);
                        return scoreB - scoreA;
                    });
                } else if (profileType === 'traffic') {
                    placementDiagnostics.sort((a, b) => {
                        const scoreA = (a.metrics.landingPageViews * 10) + (a.metrics.lpvRate * 3) - (a.metrics.cpc || 0);
                        const scoreB = (b.metrics.landingPageViews * 10) + (b.metrics.lpvRate * 3) - (b.metrics.cpc || 0);
                        return scoreB - scoreA;
                    });
                } else {
                    placementDiagnostics.sort((a, b) => b.metrics.reach - a.metrics.reach);
                }

                const scaleCount = placementDiagnostics.filter((placement) => placement.recommendation === 'Scale').length;
                const reviewCount = placementDiagnostics.filter((placement) => placement.recommendation === 'Review').length;
                const holdCount = placementDiagnostics.filter((placement) => placement.recommendation === 'Hold' || placement.recommendation === 'Efficient').length;

                placementSummary = {
                    profileType,
                    totalPlacements: placementDiagnostics.length,
                    totalSpend: parseFloat(totalSpend.toFixed(2)),
                    benchmarkRoas: parseFloat(benchmarkRoas.toFixed(2)),
                    benchmarkCPA: parseFloat(benchmarkCPA.toFixed(2)),
                    benchmarkCpl: parseFloat(benchmarkCpl.toFixed(2)),
                    benchmarkCpc: parseFloat(benchmarkCpc.toFixed(2)),
                    benchmarkLpvRate: parseFloat(benchmarkLpvRate.toFixed(1)),
                    scaleCount,
                    reviewCount,
                    holdCount,
                    topRoasPlacement: [...placementDiagnostics]
                        .filter((placement) => placement.metrics.roas > 0)
                        .sort((a, b) => b.metrics.roas - a.metrics.roas)[0] || null,
                    topVolumePlacement: profileType === 'leads'
                        ? [...placementDiagnostics].sort((a, b) => b.metrics.leads - a.metrics.leads)[0] || null
                        : profileType === 'traffic'
                            ? [...placementDiagnostics].sort((a, b) => b.metrics.landingPageViews - a.metrics.landingPageViews)[0] || null
                            : [...placementDiagnostics].sort((a, b) => b.metrics.purchases - a.metrics.purchases)[0] || null,
                    topEfficiencyPlacement: placementDiagnostics.find((placement) => placement.recommendation === 'Scale')
                        || placementDiagnostics.find((placement) => placement.recommendation === 'Hold')
                        || placementDiagnostics[0]
                        || null,
                    note: profileType === 'sales' || profileType === 'mixed'
                        ? 'Ranked by real purchase volume, ROAS, CPA, and spend share so a sales account sees where profitable demand is actually coming from.'
                        : profileType === 'leads'
                            ? 'Ranked by real lead volume, CPL, CTR, and spend share so lead-gen accounts can see which placements drive affordable form completions.'
                            : profileType === 'traffic'
                                ? 'Ranked by real landing-page-view volume, LPV rate, CPC, and spend share so traffic accounts can see where clicks are becoming site visits.'
                                : 'Ranked by real delivery metrics from Meta for the selected account and date range.'
                };
            }
        }

        // ==================== COMPILE RESPONSE ====================
        const payload = {
                accountProfile: deepAccountProfile,
                campaignFunnels: campaignFunnels.slice(0, 20),
                compareFunnels: campaignFunnels.length >= 2 ? {
                    best: campaignFunnels[0],
                    worst: campaignFunnels[campaignFunnels.length - 1],
                    comparison: campaignFunnels[0] && campaignFunnels[campaignFunnels.length - 1] ? {
                        roasDiff: (campaignFunnels[0].conversions.roas - campaignFunnels[campaignFunnels.length - 1].conversions.roas).toFixed(2),
                        atcRateDiff: (campaignFunnels[0].conversions.atcToPurchaseRate - campaignFunnels[campaignFunnels.length - 1].conversions.atcToPurchaseRate).toFixed(1),
                        bounceGapDiff: campaignFunnels[0].dropoffs.bounceGap !== null && campaignFunnels[campaignFunnels.length - 1].dropoffs.bounceGap !== null
                            ? (campaignFunnels[campaignFunnels.length - 1].dropoffs.bounceGap - campaignFunnels[0].dropoffs.bounceGap).toFixed(1)
                            : null
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
                placementDiagnostics: placementDiagnostics.slice(0, 20),
                placementSummary,
                datePreset
        };

        setMetaCacheEntry(cacheKey, payload, META_CACHE_TTL.deep);
        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('Deep insights error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data?.error?.message || 'Failed to fetch deep insights' });
    }
}
