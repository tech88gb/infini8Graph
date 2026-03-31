import {
    getAuthUrl,
    exchangeCode,
    getGoogleUserInfo,
    saveUserAndTokens,
    getConnectedGoogleAccount,
    disconnectGoogleAccount,
} from '../services/googleAuthService.js';
import {
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
} from '../services/googleAdsService.js';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://infini8graph.vercel.app';

// ==================== AUTH ====================

export async function login(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
        const authUrl = getAuthUrl();
        return res.redirect(`${authUrl}&state=${encodeURIComponent(userId)}`);
    } catch (error) {
        console.error('Google login error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to generate Google auth URL' });
    }
}

export async function callback(req, res) {
    try {
        const { code, state, error } = req.query;
        if (error) return res.redirect(`${FRONTEND_URL}/auth/google/callback?error=${encodeURIComponent(error)}`);
        if (!code || !state) return res.redirect(`${FRONTEND_URL}/auth/google/callback?error=missing_code_or_state`);

        const userId = decodeURIComponent(state);
        const tokens = await exchangeCode(code);
        if (!tokens.access_token) throw new Error('No access token returned from Google');
        const googleUserInfo = await getGoogleUserInfo(tokens.access_token);
        await saveUserAndTokens(userId, googleUserInfo, tokens);
        console.log(`✅ Google account connected: ${googleUserInfo.email}`);
        return res.redirect(`${FRONTEND_URL}/auth/google/callback?success=true&email=${encodeURIComponent(googleUserInfo.email)}`);
    } catch (error) {
        console.error('Google callback error:', error.message);
        return res.redirect(`${FRONTEND_URL}/auth/google/callback?error=${encodeURIComponent(error.message)}`);
    }
}

export async function getStatus(req, res) {
    try {
        const userId = req.user?.userId;
        const account = await getConnectedGoogleAccount(userId);
        return res.json({
            success: true,
            connected: !!account,
            account: account ? { email: account.email, name: account.name, picture: account.picture } : null,
        });
    } catch (error) {
        console.error('Google status error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to check Google connection status' });
    }
}

export async function disconnect(req, res) {
    try {
        const userId = req.user?.userId;
        await disconnectGoogleAccount(userId);
        return res.json({ success: true, message: 'Google account disconnected successfully' });
    } catch (error) {
        console.error('Google disconnect error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to disconnect Google account' });
    }
}

// ==================== ADS DATA ====================

export async function getAdsPerformanceData(req, res) {
    try {
        const userId = req.user?.userId;
        const { preset = '30d' } = req.query;
        const data = await getAdsPerformance(userId, preset);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Google Ads performance error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch Google Ads performance' });
    }
}

export async function getCampaigns(req, res) {
    try {
        const userId = req.user?.userId;
        const { preset = '30d' } = req.query;
        const data = await getCampaignBreakdown(userId, preset);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Google campaigns error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch campaign breakdown' });
    }
}

export async function getBudget(req, res) {
    try {
        const userId = req.user?.userId;
        const data = await getBudgetUtilization(userId);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Google budget error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch budget utilization' });
    }
}

export async function getKeywords(req, res) {
    try {
        const userId = req.user?.userId;
        const { preset = '30d' } = req.query;
        const data = await getKeywordPerformance(userId, preset);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Google keywords error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch keyword performance' });
    }
}

export async function getCreatives(req, res) {
    try {
        const userId = req.user?.userId;
        const data = await getAdCreativePreviews(userId);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Google creatives error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch ad creatives' });
    }
}

export async function getCrossPlatform(req, res) {
    try {
        const userId = req.user?.userId;
        const { preset = '30d', metaSpend = 0, metaImpressions = 0, metaClicks = 0 } = req.query;
        const data = await getCrossPlatformSummary(userId, metaSpend, metaImpressions, metaClicks, preset);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Cross-platform error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch cross-platform data' });
    }
}

export async function getAlerts(req, res) {
    try {
        const userId = req.user?.userId;
        const data = await getRecommendations(userId);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Google recommendations error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
    }
}

export async function getAuctionInsightsData(req, res) {
    try {
        const userId = req.user?.userId;
        const { preset = '30d' } = req.query;
        const data = await getAuctionInsights(userId, preset);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Auction insights controller error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed' });
    }
}

export async function getSearchTerms(req, res) {
    try {
        const userId = req.user?.userId;
        const { preset = '30d' } = req.query;
        const data = await getSearchTermInsights(userId, preset);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Search terms controller error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed' });
    }
}

export async function getQualityScore(req, res) {
    try {
        const userId = req.user?.userId;
        const data = await getQualityScoreDiagnostics(userId);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Quality score controller error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed' });
    }
}

export async function getAssetData(req, res) {
    try {
        const userId = req.user?.userId;
        const data = await getAssetPerformance(userId);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Asset performance controller error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed' });
    }
}

export async function getBiddingData(req, res) {
    try {
        const userId = req.user?.userId;
        const { preset = '30d' } = req.query;
        const data = await getBiddingInsights(userId, preset);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Bidding insights controller error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed' });
    }
}

export async function getGeoData(req, res) {
    try {
        const userId = req.user?.userId;
        const { preset = '30d' } = req.query;
        const data = await getGeoPerformance(userId, preset);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Geo performance controller error:', error.message);
        return res.status(500).json({ success: false, error: 'Failed' });
    }
}

export async function getAccounts(req, res) {
    try {
        const userId = req.user?.userId;
        const account = await getConnectedGoogleAccount(userId);
        if (!account) return res.status(404).json({ success: false, error: 'Not connected' });
        
        // Return stored discovery info
        return res.json({ 
            success: true, 
            data: { 
                customerId: account.customer_id,
                allClientIds: account.all_client_ids || []
            } 
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function updateAccount(req, res) {
    try {
        const userId = req.user?.userId;
        const { customerId, loginCustomerId, allClientIds } = req.body;
        await updateConnectedAccount(userId, { customerId, loginCustomerId, allClientIds });
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

export default { 
    login, 
    callback, 
    getStatus, 
    getAdsPerformanceData, 
    disconnect, 
    getCampaigns, 
    getBudget, 
    getKeywords, 
    getCreatives, 
    getCrossPlatform, 
    getAlerts,
    getAuctionInsightsData,
    getSearchTerms,
    getQualityScore,
    getAssetData,
    getBiddingData,
    getGeoData,
    getAccounts,
    updateAccount
};
