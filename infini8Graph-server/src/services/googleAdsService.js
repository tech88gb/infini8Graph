import { GoogleAdsApi } from 'google-ads-api';
import { getGoogleTokensForUser } from './googleAuthService.js';
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
function buildClient(refreshToken, customerId, loginCustomerId) {
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

/**
 * Resolves the correct ad account credentials for a user.
 *
 * Handles the MCC (manager account) case:
 * - listAccessibleCustomers can return the manager account itself.
 * - Campaigns and metrics live in CLIENT accounts (non-manager), not the manager.
 * - We check each accessible account for sub-clients (customer_client query).
 * - If sub-clients exist, we return the first enabled non-manager client ID
 *   along with the manager's ID as login_customer_id.
 *
 * Returns: { customerId, loginCustomerId, allClientIds, refreshToken } or null
 */
async function getCustomerId(userId) {
    const tokens = await getGoogleTokensForUser(userId);
    if (!tokens || !tokens.refreshToken) return null;

    const client = new GoogleAdsApi({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        developer_token: DEVELOPER_TOKEN,
    });

    const accessibleResponse = await client.listAccessibleCustomers(tokens.refreshToken);
    const accessible = accessibleResponse?.resource_names;
    if (!accessible || accessible.length === 0) return null;

    console.log('📋 Accessible Google customers:', accessible);

    for (const resource of accessible) {
        const managerCandidateId = resource.replace('customers/', '');

        try {
            // Attempt to enumerate sub-clients — only works if this is a manager/MCC account
            const managerCustomer = client.Customer({
                customer_id: managerCandidateId,
                refresh_token: tokens.refreshToken,
                login_customer_id: managerCandidateId,
            });

            const clientRows = await managerCustomer.query(`
                SELECT
                    customer_client.id,
                    customer_client.manager,
                    customer_client.status,
                    customer_client.descriptive_name
                FROM customer_client
                WHERE customer_client.manager = false
                AND customer_client.status = 'ENABLED'
            `);

            if (clientRows && clientRows.length > 0) {
                const allClientIds = clientRows.map(r => String(r.customer_client.id));
                const primaryClientId = allClientIds[0];

                console.log(`✅ MCC detected: manager=${managerCandidateId}, clients=${allClientIds.join(', ')}`);

                return {
                    customerId: primaryClientId,
                    loginCustomerId: managerCandidateId,
                    allClientIds,
                    refreshToken: tokens.refreshToken,
                };
            }
        } catch (err) {
            // Not a manager account or no permission to list clients — skip and try as direct account
            console.log(`⚠️  Could not list clients for ${managerCandidateId}: ${err.message?.slice(0, 80)}`);
        }

        // Fallback: treat this as a direct (non-manager) ad account
        console.log(`📌 Using ${managerCandidateId} as direct ad account`);
        return {
            customerId: managerCandidateId,
            loginCustomerId: managerCandidateId,
            allClientIds: [managerCandidateId],
            refreshToken: tokens.refreshToken,
        };
    }

    return null;
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

// ===================== OVERVIEW METRICS =====================

export async function getAdsPerformance(userId, preset = '30d') {
    try {
        const creds = await getCustomerId(userId);
        if (!creds) return { connected: false };

        const { customer } = buildClient(creds.refreshToken, creds.customerId, creds.loginCustomerId);
        const { startDate, endDate } = getDateRange(preset);

        const rows = await customer.query(`
            SELECT
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
        (rows || []).forEach((r) => {
            const m = r.metrics;
            impressions += Number(m?.impressions || 0);
            clicks      += Number(m?.clicks || 0);
            costMicros  += Number(m?.cost_micros || 0);
            conversions += Number(m?.conversions || 0);
            convValue   += Number(m?.conversions_value || 0);
        });

        const spend = costMicros / 1_000_000;
        const ctr   = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
        const roas  = spend > 0 ? (convValue / spend).toFixed(2) : '0.00';
        const costPerConversion = conversions > 0 ? (spend / conversions).toFixed(2) : '0.00';

        return {
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
            },
            period: preset,
        };
    } catch (error) {
        const msg = error?.errors?.[0]?.error_string || error.message;
        console.error('❌ Google Ads overview error:', msg);
        return { connected: true, hasAdAccounts: false, error: msg };
    }
}

// ===================== CAMPAIGN BREAKDOWN =====================

export async function getCampaignBreakdown(userId, preset = '30d') {
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

        return { connected: true, campaigns, period: preset };
    } catch (error) {
        const msg = error?.errors?.[0]?.error_string || error.message;
        console.error('❌ Campaign breakdown error:', msg);
        return { connected: true, campaigns: [], error: msg };
    }
}

// ===================== BUDGET UTILIZATION =====================

export async function getBudgetUtilization(userId) {
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

        return { connected: true, campaigns };
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

export async function getCrossPlatformSummary(userId, metaSpend = 0, metaImpressions = 0, metaClicks = 0, preset = '30d') {
    try {
        const perf = await getAdsPerformance(userId, preset);
        if (!perf.connected) return { connected: false };

        const googleSpend = perf.metrics?.spend || 0;
        const googleImpressions = perf.metrics?.impressions || 0;
        const googleClicks = perf.metrics?.clicks || 0;
        const totalSpend = googleSpend + parseFloat(metaSpend || 0);

        return {
            connected: true,
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
                        message: `$${c.spend} spent with 0 conversions. Check conversion tracking or landing page.`,
                        metric: `$${c.spend} wasted`,
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
                        metric: `$${c.remaining} remaining`,
                    });
                }
                if (c.utilization < 20 && c.budgetAmount > 5) {
                    alerts.push({
                        type: 'info',
                        category: 'Budget',
                        title: `Underspending: ${c.name}`,
                        message: `Only ${c.utilization}% of daily budget used. Ads may have limited reach or targeting issues.`,
                        metric: `$${c.spent} / $${c.budgetAmount}`,
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
                    metric: `QS ${k.qualityScore}/10 · $${k.cpc} CPC`,
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

export default {
    getAdsPerformance,
    getCampaignBreakdown,
    getBudgetUtilization,
    getKeywordPerformance,
    getAdCreativePreviews,
    getCrossPlatformSummary,
    getRecommendations,
};
