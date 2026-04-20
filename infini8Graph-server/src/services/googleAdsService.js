import { GoogleAdsApi } from 'google-ads-api';
import { getGoogleTokensForUser, getConnectedGoogleAccount, updateConnectedAccount } from './googleAuthService.js';
import { deleteRuntimeCacheByPrefix, getRuntimeCache, setRuntimeCache } from './runtimeStateService.js';
import dotenv from 'dotenv';

dotenv.config();

const DEVELOPER_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

/**
 * Build a GoogleAdsApi customer object.
 * @param {string} refreshToken
 * @param {string} customerId      - The actual ad account (client) to query
 * @param {string} loginCustomerId - The manager account to authenticate as (same as customerId if not MCC)
 */
export function buildClient(refreshToken, customerId, loginCustomerId) {
    const client = new GoogleAdsApi({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        developer_token: DEVELOPER_TOKEN,
    });
    return {
        client,
        customer: client.Customer({
            customer_id: customerId,
            refresh_token: refreshToken,
            login_customer_id: loginCustomerId || customerId,
        }),
    };
}

const pendingPromises = new Map();

/**
 * Result-level cache: keyed by `userId:endpoint:preset`.
 * Prevents multiple simultaneous or near-simultaneous calls (e.g., alerts
 * calling campaigns+keywords+budget, and OverviewTab calling budget at the
 * same time) from hitting Google twice for the same data.
 */
const GOOGLE_CACHE_TTL_SECONDS = 300;
const GOOGLE_CUSTOMER_CACHE_PREFIX = 'googleads:customer:';
const GOOGLE_RESULT_CACHE_PREFIX = 'googleads:result:';

async function getCachedResult(key) {
    return getRuntimeCache(`${GOOGLE_RESULT_CACHE_PREFIX}${key}`);
}

async function setCachedResult(key, data) {
    return setRuntimeCache(`${GOOGLE_RESULT_CACHE_PREFIX}${key}`, data, GOOGLE_CACHE_TTL_SECONDS);
}

export async function invalidateUserGoogleAdsCache(userId) {
    await deleteRuntimeCacheByPrefix(`${GOOGLE_RESULT_CACHE_PREFIX}${userId}:`);
    await deleteRuntimeCacheByPrefix(`${GOOGLE_CUSTOMER_CACHE_PREFIX}${userId}`);
}

/**
 * Resolves the correct ad account credentials for a user.
 */
export async function getCustomerId(userId) {
    const cacheKey = String(userId);

    // 1. Check In-Flight Promise Cache (Deduplication)
    if (pendingPromises.has(cacheKey)) {
        return pendingPromises.get(cacheKey);
    }

    // 2. Resolve
    const resolvePromise = (async () => {
        try {
            console.log(`📡 [GoogleAds] Resolving CID for user ${userId}...`);

            // Single DB call: returns tokens + stored customer IDs together
            const tokenData = await getGoogleTokensForUser(userId);
            if (!tokenData || !tokenData.refreshToken) {
                console.log(`❌ No refresh token for user ${userId}`);
                return null;
            }

            const cachedCustomer = await getRuntimeCache(`${GOOGLE_CUSTOMER_CACHE_PREFIX}${userId}`);
            if (cachedCustomer?.customerId) {
                return {
                    ...cachedCustomer,
                    refreshToken: tokenData.refreshToken,
                };
            }

            // DB-level cache: customer_id stored after first discovery — instant lookup
            if (tokenData.storedCustomerId) {
                console.log(`✅ [DB Cache] Using stored CID: ${tokenData.storedCustomerId}`);
                const customerSelection = {
                    customerId: String(tokenData.storedCustomerId),
                    loginCustomerId: tokenData.storedLoginCustomerId
                        ? String(tokenData.storedLoginCustomerId)
                        : String(tokenData.storedCustomerId),
                    allClientIds: tokenData.storedAllClientIds || [String(tokenData.storedCustomerId)],
                };
                await setRuntimeCache(`${GOOGLE_CUSTOMER_CACHE_PREFIX}${userId}`, customerSelection, 1800);
                return {
                    ...customerSelection,
                    refreshToken: tokenData.refreshToken,
                };
            }

            // PARALLEL DISCOVERY — only runs once (until persisted to DB)
            console.log(`🔍 [Discovery] No stored CID. Running parallel discovery for ${userId}...`);
            const client = new GoogleAdsApi({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                developer_token: DEVELOPER_TOKEN,
            });

            const accessibleResponse = await client.listAccessibleCustomers(tokenData.refreshToken);
            const accessible = accessibleResponse?.resource_names || [];
            if (accessible.length === 0) {
                console.log(`⚠️ No accessible customers for ${userId}`);
                return null;
            }

            console.log(`📋 Found ${accessible.length} accessible accounts`);

            const discoveryTasks = accessible.map(async (resource) => {
                const managerId = resource.replace('customers/', '');
                try {
                    const managerCustomer = client.Customer({
                        customer_id: managerId,
                        refresh_token: tokenData.refreshToken,
                        login_customer_id: managerId,
                    });

                    const clientRows = await managerCustomer.query(`
                        SELECT customer_client.id, customer_client.manager
                        FROM customer_client
                        WHERE customer_client.manager = false
                        AND customer_client.status = 'ENABLED'
                    `);

                    if (clientRows && clientRows.length > 0) {
                        return {
                            customerId: String(clientRows[0].customer_client.id),
                            loginCustomerId: managerId,
                            allClientIds: clientRows.map(r => String(r.customer_client.id)),
                        };
                    }
                    // Direct account (not MCC)
                    return {
                        customerId: managerId,
                        loginCustomerId: managerId,
                        allClientIds: [managerId],
                    };
                } catch (err) {
                    console.log(`⚠️ Could not query ${managerId}: ${err.message?.slice(0, 80)}`);
                    return null;
                }
            });

            const discoveryResults = (await Promise.all(discoveryTasks)).filter(Boolean);

            if (discoveryResults.length > 0) {
                const mccResult = discoveryResults.find(r => r.loginCustomerId !== r.customerId);
                const primary = mccResult || discoveryResults[0];
                const customerSelection = { ...primary };
                const result = { ...customerSelection, refreshToken: tokenData.refreshToken };

                console.log(`💾 [DB Persist] Saving CID ${result.customerId} for user ${userId}`);
                try {
                    await updateConnectedAccount(userId, result);
                    console.log(`✅ [DB Persist] Saved successfully`);
                } catch (persistErr) {
                    console.error(`❌ [DB Persist] FAILED for user ${userId}:`, persistErr);
                }

                await setRuntimeCache(`${GOOGLE_CUSTOMER_CACHE_PREFIX}${userId}`, customerSelection, 1800);
                return result;
            }

            console.log(`❌ Discovery found no usable accounts for user ${userId}`);
            return null;
        } catch (error) {
            console.error(`❌ [GoogleAds] Error resolving CID:`, error.message);
            return null;
        } finally {
            pendingPromises.delete(cacheKey);
        }
    })();

    pendingPromises.set(cacheKey, resolvePromise);
    return resolvePromise;
}

/**
 * Parse days from preset (7d, 30d, 90d) into GAQL date strings.
 */
function getDateRange(preset = '30d') {
    const today = new Date();
    const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    const fmt = (d) => d.toISOString().split('T')[0];
    return { startDate: fmt(from), endDate: fmt(today) };
}

function mapAssetPerformanceLabel(value) {
    const labels = {
        0: 'UNSPECIFIED',
        1: 'UNKNOWN',
        2: 'PENDING',
        3: 'LEARNING',
        4: 'LOW',
        5: 'GOOD',
        6: 'BEST',
        7: 'NOT_APPLICABLE',
        UNSPECIFIED: 'UNSPECIFIED',
        UNKNOWN: 'UNKNOWN',
        PENDING: 'PENDING',
        LEARNING: 'LEARNING',
        LOW: 'LOW',
        GOOD: 'GOOD',
        BEST: 'BEST',
        NOT_APPLICABLE: 'NOT_APPLICABLE',
    };
    return labels[value] || String(value || 'UNKNOWN');
}

function mapServedAssetFieldType(value) {
    const labels = {
        0: 'UNSPECIFIED',
        1: 'UNKNOWN',
        2: 'HEADLINE_1',
        3: 'HEADLINE_2',
        4: 'HEADLINE_3',
        5: 'DESCRIPTION_1',
        6: 'DESCRIPTION_2',
        7: 'HEADLINE',
        8: 'HEADLINE_IN_PORTRAIT',
        9: 'LONG_HEADLINE',
        10: 'DESCRIPTION',
        11: 'DESCRIPTION_IN_PORTRAIT',
        12: 'BUSINESS_NAME_IN_PORTRAIT',
        13: 'BUSINESS_NAME',
        14: 'MARKETING_IMAGE',
        15: 'MARKETING_IMAGE_IN_PORTRAIT',
        16: 'SQUARE_MARKETING_IMAGE',
        17: 'PORTRAIT_MARKETING_IMAGE',
        18: 'LOGO',
        19: 'LANDSCAPE_LOGO',
        20: 'CALL_TO_ACTION',
        21: 'YOU_TUBE_VIDEO',
        22: 'SITELINK',
        23: 'CALL',
        24: 'MOBILE_APP',
        25: 'CALLOUT',
        26: 'STRUCTURED_SNIPPET',
        UNSPECIFIED: 'UNSPECIFIED',
        UNKNOWN: 'UNKNOWN',
        HEADLINE_1: 'HEADLINE_1',
        HEADLINE_2: 'HEADLINE_2',
        HEADLINE_3: 'HEADLINE_3',
        DESCRIPTION_1: 'DESCRIPTION_1',
        DESCRIPTION_2: 'DESCRIPTION_2',
        HEADLINE: 'HEADLINE',
        LONG_HEADLINE: 'LONG_HEADLINE',
        DESCRIPTION: 'DESCRIPTION',
        BUSINESS_NAME: 'BUSINESS_NAME',
        MARKETING_IMAGE: 'MARKETING_IMAGE',
        SQUARE_MARKETING_IMAGE: 'SQUARE_MARKETING_IMAGE',
        PORTRAIT_MARKETING_IMAGE: 'PORTRAIT_MARKETING_IMAGE',
        LOGO: 'LOGO',
        CALL_TO_ACTION: 'CALL_TO_ACTION',
        YOU_TUBE_VIDEO: 'YOU_TUBE_VIDEO',
        SITELINK: 'SITELINK',
        CALL: 'CALL',
        MOBILE_APP: 'MOBILE_APP',
        CALLOUT: 'CALLOUT',
        STRUCTURED_SNIPPET: 'STRUCTURED_SNIPPET',
    };
    return labels[value] || String(value || 'UNKNOWN');
}

function mapGeoTargetingType(value) {
    const labels = {
        0: 'UNSPECIFIED',
        1: 'UNKNOWN',
        2: 'AREA_OF_INTEREST',
        3: 'LOCATION_OF_PRESENCE',
        UNSPECIFIED: 'UNSPECIFIED',
        UNKNOWN: 'UNKNOWN',
        AREA_OF_INTEREST: 'AREA_OF_INTEREST',
        LOCATION_OF_PRESENCE: 'LOCATION_OF_PRESENCE',
    };
    return labels[value] || String(value || 'UNKNOWN');
}

async function resolveGeoTargetDetails(customer, ids = []) {
    const uniqueIds = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (!uniqueIds.length) return {};

    const batches = [];
    for (let i = 0; i < uniqueIds.length; i += 50) {
        batches.push(uniqueIds.slice(i, i + 50));
    }

    const details = {};

    for (const batch of batches) {
        try {
            const resourceNames = batch.map((id) => `'geoTargetConstants/${id}'`).join(',');
            const rows = await customer.query(`
                SELECT
                    geo_target_constant.resource_name,
                    geo_target_constant.id,
                    geo_target_constant.name,
                    geo_target_constant.target_type,
                    geo_target_constant.country_code
                FROM geo_target_constant
                WHERE geo_target_constant.resource_name IN (${resourceNames})
            `);

            (rows || []).forEach((row) => {
                const id = String(row.geo_target_constant?.id || '').trim();
                if (!id) return;
                details[id] = {
                    name: row.geo_target_constant?.name || `Geo ${id}`,
                    targetType: row.geo_target_constant?.target_type || '',
                    countryCode: row.geo_target_constant?.country_code || ''
                };
            });
        } catch (error) {
            console.warn('⚠️ Geo target name lookup failed:', error.message);
        }
    }

    return details;
}

function summarizeGoogleChannelMix(campaigns = []) {
    const totals = {
        search: 0,
        brandSearch: 0,
        genericSearch: 0,
        performanceMax: 0,
        shopping: 0,
        local: 0,
        awareness: 0,
        leadGen: 0,
    };
    let totalWeight = 0;

    campaigns.forEach((campaign) => {
        const spend = Number(campaign?.spend || 0);
        const weight = spend > 0 ? spend : 1;
        totalWeight += weight;
        const name = String(campaign?.name || '').toLowerCase();
        const channelType = String(campaign?.channelType || '').toUpperCase();
        const isBrand = /\bbrand|branded\b/.test(name);
        const isGeneric = /\bgeneric|prospect|prospecting|competitor|non[\s-]?brand\b/.test(name);
        const isLeadGen = /\blead|form|inquir|enquir|signup|sign[-\s]?up|contact|quote|demo\b/.test(name);
        const isLocal = /\blocal|store|maps|near me|location\b/.test(name) || channelType === 'LOCAL';
        const isAwareness = /\bawareness|video|display|reach|view\b/.test(name)
            || ['VIDEO', 'DISPLAY', 'DEMAND_GEN'].includes(channelType);

        if (channelType === 'SEARCH') {
            totals.search += weight;
            if (isBrand) totals.brandSearch += weight;
            else totals.genericSearch += weight;
        }
        if (channelType === 'PERFORMANCE_MAX') totals.performanceMax += weight;
        if (channelType === 'SHOPPING') totals.shopping += weight;
        if (isLocal) totals.local += weight;
        if (isAwareness) totals.awareness += weight;
        if (isLeadGen) totals.leadGen += weight;
    });

    const denominator = totalWeight || 1;
    const share = (value) => value / denominator;
    const rankedMix = [
        { label: 'Search', share: share(totals.search) },
        { label: 'Performance Max', share: share(totals.performanceMax) },
        { label: 'Shopping', share: share(totals.shopping) },
        { label: 'Awareness', share: share(totals.awareness) },
        { label: 'Local', share: share(totals.local) },
    ].filter(entry => entry.share > 0.05)
        .sort((a, b) => b.share - a.share);

    return {
        totals,
        primaryMix: rankedMix.slice(0, 2).map(entry => `${entry.label} ${Math.round(entry.share * 100)}%`).join(' • ') || 'Mixed campaign distribution',
        share,
    };
}

function inferGoogleAccountFocus(campaigns = [], aggregate = {}) {
    const mix = summarizeGoogleChannelMix(campaigns);
    const totals = mix.totals;
    const searchShare = mix.share(totals.search);
    const brandSearchShare = mix.share(totals.brandSearch);
    const genericSearchShare = mix.share(totals.genericSearch);
    const pmaxShoppingShare = mix.share(totals.performanceMax + totals.shopping);
    const localShare = mix.share(totals.local);
    const awarenessShare = mix.share(totals.awareness);
    const leadGenShare = mix.share(totals.leadGen);
    const spend = Number(aggregate.spend || 0);
    const conversions = Number(aggregate.conversions || 0);
    const conversionValue = Number(aggregate.conversionValue || 0);
    const valuePerConversion = conversions > 0 ? conversionValue / conversions : 0;
    const roas = spend > 0 ? conversionValue / spend : 0;
    const valueTrackingQuality = conversions >= 10
        ? ((conversionValue <= 0 || roas < 0.2 || valuePerConversion < 20) ? 'weak' : 'strong')
        : (conversionValue > 0 ? 'partial' : 'unavailable');

    const response = {
        label: 'Mixed',
        type: 'mixed',
        description: 'Performance is spread across multiple Google Ads campaign styles.',
        primaryMix: mix.primaryMix,
        valueTrackingQuality,
    };

    if (brandSearchShare >= 0.45) {
        return {
            ...response,
            label: 'Brand Search',
            type: 'brand_search',
            description: 'This account leans heavily on branded demand capture, so CPC discipline and conversion efficiency matter most.',
        };
    }

    if (localShare >= 0.35) {
        return {
            ...response,
            label: 'Local / Store Visits',
            type: 'local',
            description: 'This account looks locally oriented. Coverage, click quality, and budget pacing will matter more than headline ROAS alone.',
        };
    }

    if (pmaxShoppingShare >= 0.4 && valueTrackingQuality !== 'weak') {
        return {
            ...response,
            label: 'Sales / Ecommerce',
            type: 'sales',
            description: 'Performance Max or Shopping has real weight here, so revenue efficiency and cost per conversion should lead the overview.',
        };
    }

    if (leadGenShare >= 0.3 || (searchShare >= 0.55 && valueTrackingQuality === 'weak' && conversions > 0)) {
        return {
            ...response,
            label: 'Lead Generation',
            type: 'lead_gen',
            description: 'This account behaves more like a lead-gen setup, so conversion rate, cost per lead, and click quality are more trustworthy than ROAS.',
        };
    }

    if (awarenessShare >= 0.4) {
        return {
            ...response,
            label: 'Awareness / Reach',
            type: 'awareness',
            description: 'Upper-funnel campaign types are prominent, so delivery and engagement signals deserve more weight than revenue metrics.',
        };
    }

    if (genericSearchShare >= 0.35 || searchShare >= 0.55) {
        return {
            ...response,
            label: 'Prospecting / Generic Search',
            type: 'prospecting',
            description: 'This account is driven by non-brand search demand, so CPC, CTR, and conversion rate are the core operating metrics.',
        };
    }

    return response;
}

// ===================== OVERVIEW METRICS =====================

export async function getAdsPerformance(userId, preset = '30d') {
    const cacheKey = `${userId}:performance:${preset}`;
    const cached = await getCachedResult(cacheKey);
    if (cached) { console.log(`⚡ [cache] performance:${preset}`); return cached; }

    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };

        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        const rows = await customer.query(`
            SELECT
                campaign.id,
                campaign.name,
                campaign.advertising_channel_type,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.ctr,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND campaign.status = 'ENABLED'
        `);

        let impressions = 0, clicks = 0, costMicros = 0, conversions = 0, convValue = 0;
        const campaignMap = {};
        (rows || []).forEach((r) => {
            const m = r.metrics;
            impressions += Number(m?.impressions || 0);
            clicks      += Number(m?.clicks || 0);
            costMicros  += Number(m?.cost_micros || 0);
            conversions += Number(m?.conversions || 0);
            convValue   += Number(m?.conversions_value || 0);

            const campaignId = r.campaign?.id;
            if (!campaignId) return;

            if (!campaignMap[campaignId]) {
                campaignMap[campaignId] = {
                    id: campaignId,
                    name: r.campaign?.name || 'Unknown',
                    channelType: r.campaign?.advertising_channel_type || 'UNKNOWN',
                    costMicros: 0,
                    conversions: 0,
                    conversionValue: 0,
                };
            }

            campaignMap[campaignId].costMicros += Number(m?.cost_micros || 0);
            campaignMap[campaignId].conversions += Number(m?.conversions || 0);
            campaignMap[campaignId].conversionValue += Number(m?.conversions_value || 0);
        });

        const spend = costMicros / 1_000_000;
        const ctr   = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
        const roas  = spend > 0 ? (convValue / spend).toFixed(2) : '0.00';
        const costPerConversion = conversions > 0 ? (spend / conversions).toFixed(2) : '0.00';
        const avgCpc = clicks > 0 ? (spend / clicks).toFixed(2) : '0.00';
        const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : '0.00';
        const valuePerConversion = conversions > 0 ? (convValue / conversions).toFixed(2) : '0.00';
        const valueTrackingQuality = conversions >= 10
            ? ((convValue <= 0 || (spend > 0 && convValue / spend < 0.2) || convValue / Math.max(conversions, 1) < 20) ? 'weak' : 'strong')
            : (convValue > 0 ? 'partial' : 'unavailable');
        const campaignSummaries = Object.values(campaignMap).map((campaign) => ({
            ...campaign,
            spend: campaign.costMicros / 1_000_000,
        }));
        const accountFocus = inferGoogleAccountFocus(campaignSummaries, {
            spend,
            conversions,
            conversionValue: convValue,
        });

        const result = {
            connected: true,
            hasAdAccounts: true,
            customerId: creds.customerId,
            metrics: {
                impressions,
                clicks,
                spend: parseFloat(spend.toFixed(2)),
                ctr: parseFloat(ctr),
                conversions,
                conversionValue: parseFloat(convValue.toFixed(2)),
                roas: parseFloat(roas),
                costPerConversion: parseFloat(costPerConversion),
                avgCpc: parseFloat(avgCpc),
                conversionRate: parseFloat(conversionRate),
                valuePerConversion: parseFloat(valuePerConversion),
            },
            accountFocus,
            valueTracking: {
                quality: valueTrackingQuality,
                trustedRevenueMetrics: valueTrackingQuality === 'strong',
                reason: valueTrackingQuality === 'strong'
                    ? 'Conversion value looks strong enough to keep ROAS and value metrics in the overview.'
                    : valueTrackingQuality === 'partial'
                        ? 'Value tracking exists, but volume is still too thin to make ROAS the headline KPI.'
                        : valueTrackingQuality === 'weak'
                            ? 'Conversions are present, but revenue/value tracking looks too weak to headline ROAS confidently.'
                            : 'This account does not yet have enough value tracking to make ROAS the primary operating metric.',
            },
            period: preset,
        };
        await setCachedResult(cacheKey, result);
        return result;
    } catch (error) {
        const msg = error?.errors?.[0]?.error_string || error.message;
        console.error('❌ Google Ads overview error:', msg);
        return { connected: true, hasAdAccounts: false, error: msg };
    }
}

// ===================== CAMPAIGN BREAKDOWN =====================

export async function getCampaignBreakdown(userId, preset = '30d') {
    const cacheKey = `${userId}:campaigns:${preset}`;
    const cached = await getCachedResult(cacheKey);
    if (cached) { console.log(`⚡ [cache] campaigns:${preset}`); return cached; }

    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };

        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        const rows = await customer.query(`
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                campaign.campaign_budget,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.ctr,
                metrics.conversions,
                metrics.conversions_value,
                metrics.search_impression_share
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            ORDER BY metrics.cost_micros DESC
        `);

        // Aggregate per campaign (one row per day — need to sum)
        const map = {};
        (rows || []).forEach((r) => {
            const id = r.campaign?.id;
            if (!id) return;
            if (!map[id]) {
                map[id] = {
                    id,
                    name: r.campaign?.name || 'Unknown',
                    status: r.campaign?.status || 'UNKNOWN',
                    channelType: r.campaign?.advertising_channel_type || '',
                    impressions: 0,
                    clicks: 0,
                    costMicros: 0,
                    conversions: 0,
                    convValue: 0,
                };
            }
            const m = r.metrics;
            map[id].impressions  += Number(m?.impressions || 0);
            map[id].clicks       += Number(m?.clicks || 0);
            map[id].costMicros   += Number(m?.cost_micros || 0);
            map[id].conversions  += Number(m?.conversions || 0);
            map[id].convValue    += Number(m?.conversions_value || 0);
        });

        const campaigns = Object.values(map).map((c) => {
            const spend = c.costMicros / 1_000_000;
            const roas  = spend > 0 ? (c.convValue / spend) : 0;
            const cpc   = c.clicks > 0 ? spend / c.clicks : 0;
            const ctr   = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
            const costPerConversion = c.conversions > 0 ? spend / c.conversions : 0;

            return {
                ...c,
                spend: parseFloat(spend.toFixed(2)),
                ctr: parseFloat(ctr.toFixed(2)),
                cpc: parseFloat(cpc.toFixed(2)),
                roas: parseFloat(roas.toFixed(2)),
                costPerConversion: parseFloat(costPerConversion.toFixed(2)),
                // budget utilization: daily_budget * days_in_period vs actual spend
            };
        }).sort((a, b) => b.spend - a.spend);

        const result = { connected: true, campaigns, period: preset };
        await setCachedResult(cacheKey, result);
        return result;
    } catch (error) {
        const msg = error?.errors?.[0]?.error_string || error.message;
        console.error('❌ Campaign breakdown error:', msg);
        return { connected: true, campaigns: [], error: msg };
    }
}

// ===================== BUDGET UTILIZATION =====================

export async function getBudgetUtilization(userId) {
    const cacheKey = `${userId}:budget`;
    const cached = await getCachedResult(cacheKey);
    if (cached) { console.log('⚡ [cache] budget'); return cached; }

    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };

        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const today = new Date().toISOString().split('T')[0];

        const rows = await customer.query(`
            SELECT
                campaign.id,
                campaign.name,
                campaign.status,
                campaign_budget.amount_micros,
                campaign_budget.type,
                metrics.cost_micros,
                metrics.impressions
            FROM campaign
            WHERE segments.date = '${today}'
            AND campaign.status = 'ENABLED'
        `);

        const campaigns = (rows || []).map((r) => {
            const budgetMicros = Number(r.campaign_budget?.amount_micros || 0);
            const spentMicros  = Number(r.metrics?.cost_micros || 0);
            const budgetAmount = budgetMicros / 1_000_000;
            const spent        = spentMicros / 1_000_000;
            const utilization  = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
            const remaining    = Math.max(0, budgetAmount - spent);

            return {
                id: r.campaign?.id,
                name: r.campaign?.name || 'Unknown',
                budgetAmount: parseFloat(budgetAmount.toFixed(2)),
                spent: parseFloat(spent.toFixed(2)),
                remaining: parseFloat(remaining.toFixed(2)),
                utilization: parseFloat(utilization.toFixed(1)),
                budgetType: r.campaign_budget?.type || 'DAILY',
                impressionsToday: Number(r.metrics?.impressions || 0),
            };
        }).filter(c => c.budgetAmount > 0)
          .sort((a, b) => b.utilization - a.utilization);

        const result = { connected: true, campaigns };
        await setCachedResult(cacheKey, result);
        return result;
    } catch (error) {
        const msg = error?.errors?.[0]?.error_string || error.message;
        console.error('❌ Budget utilization error:', msg);
        return { connected: true, campaigns: [], error: msg };
    }
}

// ===================== KEYWORD PERFORMANCE =====================

export async function getKeywordPerformance(userId, preset = '30d') {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };

        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        const rows = await customer.query(`
            SELECT
                keyword_view.resource_name,
                ad_group_criterion.keyword.text,
                ad_group_criterion.keyword.match_type,
                ad_group_criterion.quality_info.quality_score,
                ad_group_criterion.quality_info.creative_quality_score,
                ad_group_criterion.quality_info.post_click_quality_score,
                ad_group_criterion.quality_info.search_predicted_ctr,
                ad_group_criterion.status,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                metrics.average_cpc,
                campaign.name
            FROM keyword_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND ad_group_criterion.status != 'REMOVED'
            ORDER BY metrics.cost_micros DESC
            LIMIT 50
        `);

        // Aggregate per keyword text
        const map = {};
        (rows || []).forEach((r) => {
            const text = r.ad_group_criterion?.keyword?.text;
            if (!text) return;
            const key  = `${text}::${r.ad_group_criterion?.keyword?.match_type}`;
            if (!map[key]) {
                map[key] = {
                    keyword: text,
                    matchType: r.ad_group_criterion?.keyword?.match_type || '',
                    qualityScore: r.ad_group_criterion?.quality_info?.quality_score || null,
                    status: r.ad_group_criterion?.status || '',
                    campaignName: r.campaign?.name || '',
                    impressions: 0,
                    clicks: 0,
                    costMicros: 0,
                    conversions: 0,
                };
            }
            const m = r.metrics;
            map[key].impressions += Number(m?.impressions || 0);
            map[key].clicks      += Number(m?.clicks || 0);
            map[key].costMicros  += Number(m?.cost_micros || 0);
            map[key].conversions += Number(m?.conversions || 0);
        });

        const keywords = Object.values(map).map((k) => {
            const spend = k.costMicros / 1_000_000;
            const cpc   = k.clicks > 0 ? spend / k.clicks : 0;
            const ctr   = k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0;
            return {
                ...k,
                spend: parseFloat(spend.toFixed(2)),
                cpc: parseFloat(cpc.toFixed(2)),
                ctr: parseFloat(ctr.toFixed(2)),
            };
        }).sort((a, b) => b.spend - a.spend);

        // Surface low quality score keywords (< 5)
        const lowQuality = keywords.filter(k => k.qualityScore !== null && k.qualityScore < 5);

        return { connected: true, keywords, lowQuality, period: preset };
    } catch (error) {
        const msg = error?.errors?.[0]?.error_string || error.message;
        console.error('❌ Keyword performance error:', msg);
        return { connected: true, keywords: [], lowQuality: [], error: msg };
    }
}

// ===================== AD CREATIVE PREVIEWS =====================

export async function getAdCreativePreviews(userId) {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };

        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange('30d');

        const rows = await customer.query(`
            SELECT
                ad_group_ad.ad.id,
                ad_group_ad.ad.name,
                ad_group_ad.ad.type,
                ad_group_ad.ad.responsive_search_ad.headlines,
                ad_group_ad.ad.responsive_search_ad.descriptions,
                ad_group_ad.ad.expanded_text_ad.headline_part1,
                ad_group_ad.ad.expanded_text_ad.headline_part2,
                ad_group_ad.ad.expanded_text_ad.description,
                ad_group_ad.ad.final_urls,
                ad_group_ad.status,
                campaign.name,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.ctr
            FROM ad_group_ad
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND ad_group_ad.status = 'ENABLED'
            ORDER BY metrics.impressions DESC
            LIMIT 30
        `);

        // Aggregate per ad
        const map = {};
        (rows || []).forEach((r) => {
            const adId = r.ad_group_ad?.ad?.id;
            if (!adId) return;
            if (!map[adId]) {
                const ad = r.ad_group_ad?.ad;
                const rsa = ad?.responsive_search_ad;
                const eta = ad?.expanded_text_ad;

                let headlines = [];
                let descriptions = [];

                if (rsa?.headlines) {
                    headlines = rsa.headlines.slice(0, 3).map(h => h.text).filter(Boolean);
                }
                if (rsa?.descriptions) {
                    descriptions = rsa.descriptions.slice(0, 2).map(d => d.text).filter(Boolean);
                }
                if (eta?.headline_part1) {
                    headlines = [eta.headline_part1, eta.headline_part2].filter(Boolean);
                    descriptions = [eta.description].filter(Boolean);
                }

                map[adId] = {
                    id: adId,
                    name: ad?.name || 'Ad',
                    type: ad?.type || '',
                    headlines,
                    descriptions,
                    finalUrl: ad?.final_urls?.[0] || '',
                    campaignName: r.campaign?.name || '',
                    status: r.ad_group_ad?.status || '',
                    impressions: 0,
                    clicks: 0,
                    costMicros: 0,
                    ctr: 0,
                };
            }
            const m = r.metrics;
            map[adId].impressions += Number(m?.impressions || 0);
            map[adId].clicks      += Number(m?.clicks || 0);
            map[adId].costMicros  += Number(m?.cost_micros || 0);
        });

        const ads = Object.values(map).map((ad) => {
            const spend = ad.costMicros / 1_000_000;
            const ctr   = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : '0.00';
            return { ...ad, spend: parseFloat(spend.toFixed(2)), ctr: parseFloat(ctr) };
        }).sort((a, b) => b.impressions - a.impressions);

        return { connected: true, ads };
    } catch (error) {
        const msg = error?.errors?.[0]?.error_string || error.message;
        console.error('❌ Ad creative error:', msg);
        return { connected: true, ads: [], error: msg };
    }
}

// ===================== CROSS-PLATFORM COMPARISON =====================

/**
 * Cross-platform summary.
 * IMPORTANT: We reuse the already-cached getAdsPerformance result - this
 * does NOT fire an extra Google API call if performance was already fetched.
 */
export async function getCrossPlatformSummary(userId, metaSpend = 0, metaImpressions = 0, metaClicks = 0, preset = '30d') {
    try {
        // getAdsPerformance is result-cached — this will be a cache hit if
        // the OverviewTab already fetched it moments ago
        const perf = await getAdsPerformance(userId, preset);
        if (!perf.connected) return { connected: false };

        const googleSpend = perf.metrics?.spend || 0;
        const googleImpressions = perf.metrics?.impressions || 0;
        const googleClicks = perf.metrics?.clicks || 0;
        const totalSpend = googleSpend + parseFloat(metaSpend || 0);

        return {
            connected: true,
            combined: true,
            google: {
                spend: googleSpend,
                impressions: googleImpressions,
                clicks: googleClicks,
                roas: perf.metrics?.roas || 0,
                ctr: perf.metrics?.ctr || 0,
            },
            meta: {
                spend: parseFloat(metaSpend || 0),
                impressions: parseInt(metaImpressions || 0),
                clicks: parseInt(metaClicks || 0),
            },
            combined: {
                totalSpend,
                googleShare: totalSpend > 0 ? ((googleSpend / totalSpend) * 100).toFixed(1) : '0',
                metaShare: totalSpend > 0 ? (((parseFloat(metaSpend || 0)) / totalSpend) * 100).toFixed(1) : '0',
            },
        };
    } catch (error) {
        console.error('❌ Cross-platform error:', error.message);
        return { connected: true, error: error.message };
    }
}

// ===================== RECOMMENDATIONS / ALERTS =====================

export async function getRecommendations(userId) {
    try {
        const [campaigns, keywords, budget] = await Promise.all([
            getCampaignBreakdown(userId, '30d'),
            getKeywordPerformance(userId, '30d'),
            getBudgetUtilization(userId),
        ]);

        const alerts = [];

        // --- Campaign-level alerts ---
        if (campaigns.campaigns) {
            campaigns.campaigns.forEach((c) => {
                // Low CTR
                if (c.impressions > 1000 && c.ctr < 1.0) {
                    alerts.push({
                        type: 'warning',
                        category: 'Campaign',
                        title: `Low CTR: ${c.name}`,
                        message: `CTR of ${c.ctr}% is below the 1% benchmark. Review ad copy and targeting.`,
                        metric: `${c.ctr}% CTR`,
                    });
                }
                // Zero conversions with significant spend
                if (c.spend > 50 && c.conversions === 0) {
                    alerts.push({
                        type: 'danger',
                        category: 'Campaign',
                        title: `No conversions: ${c.name}`,
                        message: `₹${c.spend} spent with 0 conversions. Check conversion tracking or landing page.`,
                        metric: `₹${c.spend} wasted`,
                    });
                }
                // Negative ROAS (spent more than earned)
                if (c.roas > 0 && c.roas < 1.0 && c.conversions > 0) {
                    alerts.push({
                        type: 'danger',
                        category: 'Campaign',
                        title: `Negative ROAS: ${c.name}`,
                        message: `ROAS of ${c.roas}x means you're spending more than you're earning. Pause or restructure.`,
                        metric: `${c.roas}x ROAS`,
                    });
                }
                // Great ROAS
                if (c.roas >= 4.0 && c.spend > 10) {
                    alerts.push({
                        type: 'success',
                        category: 'Campaign',
                        title: `High performer: ${c.name}`,
                        message: `ROAS of ${c.roas}x is excellent. Consider scaling this campaign's budget.`,
                        metric: `${c.roas}x ROAS`,
                    });
                }
            });
        }

        // --- Budget alerts ---
        if (budget.campaigns) {
            budget.campaigns.forEach((c) => {
                if (c.utilization > 90) {
                    alerts.push({
                        type: 'warning',
                        category: 'Budget',
                        title: `Budget nearly exhausted: ${c.name}`,
                        message: `${c.utilization}% of daily budget used. Ads may stop showing before end of day.`,
                        metric: `₹${c.remaining} remaining`,
                    });
                }
                if (c.utilization < 20 && c.budgetAmount > 5) {
                    alerts.push({
                        type: 'info',
                        category: 'Budget',
                        title: `Underspending: ${c.name}`,
                        message: `Only ${c.utilization}% of daily budget used. Ads may have limited reach or targeting issues.`,
                        metric: `₹${c.spent} / ₹${c.budgetAmount}`,
                    });
                }
            });
        }

        // --- Keyword quality score alerts ---
        if (keywords.lowQuality && keywords.lowQuality.length > 0) {
            const worst = keywords.lowQuality.slice(0, 3);
            worst.forEach((k) => {
                alerts.push({
                    type: 'warning',
                    category: 'Keywords',
                    title: `Low quality score: "${k.keyword}"`,
                    message: `Quality Score ${k.qualityScore}/10. Improve ad relevance or landing page to lower CPC.`,
                    metric: `QS ${k.qualityScore}/10 · ₹${k.cpc} CPC`,
                });
            });
        }

        // Sort: danger → warning → success → info
        const order = { danger: 0, warning: 1, success: 2, info: 3 };
        alerts.sort((a, b) => (order[a.type] || 3) - (order[b.type] || 3));

        return { connected: true, alerts };
    } catch (error) {
        console.error('❌ Recommendations error:', error.message);
        return { connected: true, alerts: [], error: error.message };
    }
}

// ===================== AUCTION INSIGHTS (COMPETITORS) =====================

export async function getAuctionInsights(userId, preset = '30d') {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };
        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        // Using customer_auction_insight_stats for better data density and account-level overview
        const rows = await customer.query(`
            SELECT
                customer_auction_insight_stats.domain,
                customer_auction_insight_stats.impression_share,
                customer_auction_insight_stats.overlap_rate,
                customer_auction_insight_stats.outranking_share,
                customer_auction_insight_stats.position_above_rate,
                customer_auction_insight_stats.top_of_page_rate
            FROM customer_auction_insight_stats
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            LIMIT 50
        `);

        const competitors = (rows || []).map(r => ({
            domain: r.customer_auction_insight_stats?.domain || 'Unknown',
            impressionShare: parseFloat((r.customer_auction_insight_stats?.impression_share || 0) * 100).toFixed(2),
            overlapRate: parseFloat((r.customer_auction_insight_stats?.overlap_rate || 0) * 100).toFixed(2),
            outrankingShare: parseFloat((r.customer_auction_insight_stats?.outranking_share || 0) * 100).toFixed(2),
            positionAboveRate: parseFloat((r.customer_auction_insight_stats?.position_above_rate || 0) * 100).toFixed(2),
            topOfPageRate: parseFloat((r.customer_auction_insight_stats?.top_of_page_rate || 0) * 100).toFixed(2),
            campaign: 'Account-wide'
        })).filter(c => c.domain !== 'You');

        return { connected: true, competitors };
    } catch (error) {
        console.error('❌ Auction insights error:', error.message);
        return { connected: true, competitors: [], error: error.message };
    }
}

// Helper to map Quality Score numeric enums to strings
function mapQsLabel(val) {
    const labels = {
        0: 'UNSPECIFIED',
        1: 'UNKNOWN',
        2: 'BELOW AVERAGE',
        3: 'AVERAGE',
        4: 'ABOVE AVERAGE'
    };
    return labels[val] || String(val || 'UNKNOWN');
}

// ===================== SEARCH TERM INSIGHTS (WASTED SPEND) =====================

export async function getSearchTermInsights(userId, preset = '30d') {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };
        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        const rows = await customer.query(`
            SELECT
                search_term_view.search_term,
                search_term_view.status,
                metrics.impressions,
                metrics.clicks,
                metrics.cost_micros,
                metrics.conversions,
                campaign.name
            FROM search_term_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND metrics.cost_micros > 0
            ORDER BY metrics.cost_micros DESC
            LIMIT 100
        `);

        const terms = (rows || []).map(r => {
            const spend = Number(r.metrics?.cost_micros || 0) / 1_000_000;
            return {
                term: r.search_term_view?.search_term || '',
                status: r.search_term_view?.status || '',
                campaign: r.campaign?.name || '',
                impressions: Number(r.metrics?.impressions || 0),
                clicks: Number(r.metrics?.clicks || 0),
                spend: parseFloat(spend.toFixed(2)),
                conversions: Number(r.metrics?.conversions || 0)
            };
        });

        // Identify wasted spend (High spend, 0 conversions)
        // Lowered threshold to ₹5 to show more potential waste in the UI
        const wastedSpend = terms.filter(t => t.spend >= 5 && t.conversions === 0)
                                 .sort((a,b) => b.spend - a.spend)
                                 .slice(0, 10);

        return { connected: true, terms, wastedSpend };
    } catch (error) {
        console.error('❌ Search term insights error:', error.message);
        return { connected: true, terms: [], wastedSpend: [], error: error.message };
    }
}

// ===================== QUALITY SCORE DIAGNOSTICS =====================

export async function getQualityScoreDiagnostics(userId) {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };
        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);

        const rows = await customer.query(`
            SELECT
                ad_group_criterion.keyword.text,
                ad_group_criterion.quality_info.quality_score,
                ad_group_criterion.quality_info.creative_quality_score,
                ad_group_criterion.quality_info.post_click_quality_score,
                ad_group_criterion.quality_info.search_predicted_ctr,
                metrics.impressions,
                campaign.name
            FROM keyword_view
            WHERE ad_group_criterion.status = 'ENABLED'
            AND ad_group_criterion.quality_info.quality_score IS NOT NULL
            ORDER BY metrics.impressions DESC
            LIMIT 50
        `);

        const keywords = (rows || []).map(r => ({
            keyword: r.ad_group_criterion?.keyword?.text || '',
            qualityScore: r.ad_group_criterion?.quality_info?.quality_score || 0,
            creativeQuality: mapQsLabel(r.ad_group_criterion?.quality_info?.creative_quality_score),
            landingPageQuality: mapQsLabel(r.ad_group_criterion?.quality_info?.post_click_quality_score),
            expectedCtr: mapQsLabel(r.ad_group_criterion?.quality_info?.search_predicted_ctr),
            campaign: r.campaign?.name || ''
        }));

        return { connected: true, keywords };
    } catch (error) {
        console.error('❌ Quality score diagnostics error:', error.message);
        return { connected: true, keywords: [], error: error.message };
    }
}

// ===================== ASSET PERFORMANCE (RSA) =====================

export async function getAssetPerformance(userId, preset = '30d') {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };
        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        // Responsive Search Ad Asset performance
        const rows = await customer.query(`
            SELECT
                asset.id,
                asset.text_asset.text,
                ad_group_ad_asset_view.performance_label,
                ad_group_ad_asset_view.field_type,
                metrics.impressions,
                metrics.clicks,
                campaign.name
            FROM ad_group_ad_asset_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND metrics.impressions > 0
            ORDER BY metrics.impressions DESC
            LIMIT 50
        `);

        const assets = (rows || []).map(r => ({
            id: r.asset?.id,
            text: r.asset?.text_asset?.text || '',
            performance: mapAssetPerformanceLabel(r.ad_group_ad_asset_view?.performance_label),
            type: mapServedAssetFieldType(r.ad_group_ad_asset_view?.field_type),
            impressions: Number(r.metrics?.impressions || 0),
            clicks: Number(r.metrics?.clicks || 0),
            campaign: r.campaign?.name || ''
        }));

        return { connected: true, assets, period: preset };
    } catch (error) {
        console.error('❌ Asset performance error:', error.message);
        return { connected: true, assets: [], error: error.message };
    }
}

// ===================== BIDDING HEATMAP (DAY/HOUR) =====================

export async function getBiddingInsights(userId, preset = '30d') {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };
        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        const rows = await customer.query(`
            SELECT
                segments.day_of_week,
                segments.hour,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value
            FROM campaign
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND campaign.status = 'ENABLED'
        `);

        const heatmap = (rows || []).map(r => {
            const spend = Number(r.metrics?.cost_micros || 0) / 1_000_000;
            const convValue = Number(r.metrics?.conversions_value || 0);
            return {
                day: r.segments?.day_of_week || 'UNKNOWN',
                hour: r.segments?.hour || 0,
                spend: parseFloat(spend.toFixed(2)),
                impressions: Number(r.metrics?.impressions || 0),
                clicks: Number(r.metrics?.clicks || 0),
                conversions: Number(r.metrics?.conversions || 0),
                roas: spend > 0 ? parseFloat((convValue / spend).toFixed(2)) : 0
            };
        });

        return { connected: true, heatmap };
    } catch (error) {
        console.error('❌ Bidding insights error:', error.message);
        return { connected: true, heatmap: [], error: error.message };
    }
}

// ===================== GEO PERFORMANCE =====================

export async function getGeoPerformance(userId, preset = '30d') {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };
        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        const rows = await customer.query(`
            SELECT
                geographic_view.country_criterion_id,
                geographic_view.location_type,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                campaign.name
            FROM geographic_view
            WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
            AND metrics.cost_micros > 0
            LIMIT 50
        `);

        const geoIds = (rows || []).map((row) => row.geographic_view?.country_criterion_id).filter(Boolean);
        const geoDetails = await resolveGeoTargetDetails(customer, geoIds);
        const locationMap = {};

        (rows || []).forEach((row) => {
            const geoId = String(row.geographic_view?.country_criterion_id || '').trim();
            const locationType = mapGeoTargetingType(row.geographic_view?.location_type);
            const geoMeta = geoDetails[geoId] || {};
            const key = `${geoId}:${locationType}`;
            if (!locationMap[key]) {
                locationMap[key] = {
                    id: geoId || 'unknown',
                    location: geoMeta.name || (geoId ? `Geo ${geoId}` : 'Unknown location'),
                    targetType: geoMeta.targetType || 'Unknown',
                    countryCode: geoMeta.countryCode || '',
                    matchType: locationType.replace(/_/g, ' '),
                    spend: 0,
                    impressions: 0,
                    clicks: 0,
                    conversions: 0,
                };
            }

            locationMap[key].spend += Number(row.metrics?.cost_micros || 0) / 1_000_000;
            locationMap[key].impressions += Number(row.metrics?.impressions || 0);
            locationMap[key].clicks += Number(row.metrics?.clicks || 0);
            locationMap[key].conversions += Number(row.metrics?.conversions || 0);
        });

        const locations = Object.values(locationMap).map((location) => {
            const cpc = location.clicks > 0 ? location.spend / location.clicks : 0;
            const conversionRate = location.clicks > 0 ? (location.conversions / location.clicks) * 100 : 0;
            const costPerConversion = location.conversions > 0 ? location.spend / location.conversions : null;
            return {
                ...location,
                spend: parseFloat(location.spend.toFixed(2)),
                conversions: parseFloat(location.conversions.toFixed(1)),
                cpc: parseFloat(cpc.toFixed(2)),
                conversionRate: parseFloat(conversionRate.toFixed(2)),
                costPerConversion: costPerConversion !== null ? parseFloat(costPerConversion.toFixed(2)) : null,
            };
        }).sort((a, b) => b.spend - a.spend);

        const totalSpend = locations.reduce((sum, location) => sum + location.spend, 0);
        const totalClicks = locations.reduce((sum, location) => sum + location.clicks, 0);
        const totalConversions = locations.reduce((sum, location) => sum + location.conversions, 0);
        const enrichedLocations = locations.map((location) => ({
            ...location,
            spendShare: totalSpend > 0 ? parseFloat(((location.spend / totalSpend) * 100).toFixed(1)) : 0,
        }));
        const locationsWithConversion = enrichedLocations.filter((location) => location.conversions > 0);

        const summary = {
            totalSpend: parseFloat(totalSpend.toFixed(2)),
            totalClicks,
            totalConversions: parseFloat(totalConversions.toFixed(1)),
            averageCpc: totalClicks > 0 ? parseFloat((totalSpend / totalClicks).toFixed(2)) : 0,
            averageConversionRate: totalClicks > 0 ? parseFloat(((totalConversions / totalClicks) * 100).toFixed(2)) : 0,
            averageCostPerConversion: totalConversions > 0 ? parseFloat((totalSpend / totalConversions).toFixed(2)) : null,
            topLocationBySpend: enrichedLocations[0] || null,
            topLocationByEfficiency: [...locationsWithConversion].sort((a, b) => {
                const aCost = a.costPerConversion ?? Number.MAX_SAFE_INTEGER;
                const bCost = b.costPerConversion ?? Number.MAX_SAFE_INTEGER;
                return aCost - bCost;
            })[0] || null,
            lowEfficiencyLocations: [...locationsWithConversion]
                .filter((location) => location.costPerConversion !== null)
                .sort((a, b) => (b.costPerConversion || 0) - (a.costPerConversion || 0))
                .slice(0, 3)
        };

        return { connected: true, locations: enrichedLocations, summary, period: preset };
    } catch (error) {
        console.error('❌ Geo performance error:', error.message);
        return { connected: true, locations: [], error: error.message };
    }
}

export default {
    getAdsPerformance,
    getCampaignBreakdown,
    getBudgetUtilization,
    getKeywordPerformance,
    getAdCreativePreviews,
    getCrossPlatformSummary,
    getRecommendations,
    getAuctionInsights,
    getSearchTermInsights,
    getQualityScoreDiagnostics,
    getAssetPerformance,
    getBiddingInsights,
    getGeoPerformance,
};

