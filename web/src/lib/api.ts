import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
    timeout: 15000, // Important to prevent infinite loading spinners
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    // FALLBACK: Use localStorage directly to avoid any Cookie library issues
    // We will re-enable cookies later once we verify token passing works
    let token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    console.log('🔥 API Interceptor Running. URL:', config.url);
    console.log('🔥 API Interceptor Token:', token ? 'FOUND' : 'MISSING');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['X-Auth-Token'] = token; // Redundant backup
    }
    return config;
}, (error) => {
    console.error('🔥 Interceptor Error:', error);
    return Promise.reject(error);
});

// Simple error interceptor - NO automatic redirects
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Don't log 401s on auth/me — expected when not logged in
        const is401OnMe = error.response?.status === 401 && error.config?.url?.includes('/auth/me');
        if (!is401OnMe) {
            console.error('API Error:', error.response?.status, error.message);
        }
        return Promise.reject(error);
    }
);

export const authApi = {
    getLoginUrl: () => api.get('/auth/login'),
    getMe: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
    refresh: () => api.post('/auth/refresh'),
    // Multi-account support
    getAccounts: () => api.get('/auth/accounts'),
    switchAccount: (accountId: string) => api.post(`/auth/switch/${accountId}`)
};

export const instagramApi = {
    getOverview: () => api.get('/instagram/overview'),
    getGrowth: (period = '30d') => api.get(`/instagram/growth?period=${period}`),
    getBestTime: () => api.get('/instagram/best-time'),
    getHashtags: () => api.get('/instagram/hashtags'),
    getReels: () => api.get('/instagram/reels'),
    getPosts: (limit = 50) => api.get(`/instagram/posts?limit=${limit}`),
    exportData: (format = 'json', metrics = 'overview,growth,posts') =>
        api.get(`/instagram/export?format=${format}&metrics=${metrics}`),
    getContentIntelligence: () => api.get('/instagram/content-intelligence'),
    getUnifiedOverview: () => api.get('/instagram/unified-overview')
};

export const adsApi = {
    testPermissions: () => api.get('/ads/test-permissions'),
    getAdAccounts: (datePreset = 'last_90d') => api.get(`/ads/accounts?datePreset=${datePreset}`),
    getAdInsights: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/insights?datePreset=${datePreset}`),
    getCampaigns: (adAccountId: string) => api.get(`/ads/accounts/${adAccountId}/campaigns`),
    getAdSets: (adAccountId: string) => api.get(`/ads/accounts/${adAccountId}/adsets`),
    getAds: (adAccountId: string) => api.get(`/ads/accounts/${adAccountId}/ads`),
    getPageInsights: () => api.get('/ads/page-insights'),
    getConversionFunnel: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/funnel?datePreset=${datePreset}`),
    getCampaignIntelligence: (adAccountId: string, datePreset = 'last_30d') =>
        api.get(`/ads/accounts/${adAccountId}/intelligence?datePreset=${datePreset}`),
    getAdvancedAnalytics: (adAccountId: string, datePreset = 'last_30d') =>
        api.get(`/ads/accounts/${adAccountId}/advanced?datePreset=${datePreset}`),
    getDeepInsights: (adAccountId: string, datePreset = 'last_30d') =>
        api.get(`/ads/accounts/${adAccountId}/deep-insights?datePreset=${datePreset}`)
};

/**
 * Separate axios instance for Google Ads API calls.
 * Google's GAQL engine + account discovery loop routinely takes 15-25s,
 * which exceeds the global 15s timeout. Meta endpoints are fast (~2s)
 * so we keep the global timeout tight for them.
 */
const googleApi = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
    timeout: 60000, // 60s — Google Ads API needs this
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    }
});

// Reuse the same auth interceptor for Google requests
googleApi.interceptors.request.use((config) => {
    let token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['X-Auth-Token'] = token;
    }
    return config;
}, (error) => Promise.reject(error));

googleApi.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('Google API Error:', error.response?.status, error.message);
        return Promise.reject(error);
    }
);

export const googleAdsApi = {
    getStatus: () => googleApi.get('/google/auth/status'),
    login: () => googleApi.get('/google/auth/login'),
    disconnect: () => googleApi.post('/google/auth/disconnect'),
    getPerformance: (preset = '30d') => googleApi.get(`/google/auth/ads-performance?preset=${preset}`),
    getCampaigns: (preset = '30d') => googleApi.get(`/google/auth/campaigns?preset=${preset}`),
    getBudget: () => googleApi.get('/google/auth/budget'),
    getKeywords: (preset = '30d') => googleApi.get(`/google/auth/keywords?preset=${preset}`),
    getCreatives: () => googleApi.get('/google/auth/creatives'),
    getCrossPlatform: (preset = '30d', metaSpend = 0, metaImpressions = 0, metaClicks = 0) =>
        googleApi.get(`/google/auth/cross-platform?preset=${preset}&metaSpend=${metaSpend}&metaImpressions=${metaImpressions}&metaClicks=${metaClicks}`),
    getAlerts: () => googleApi.get('/google/auth/alerts'),
    getAuctionInsights: (preset = '30d') => googleApi.get(`/google/auth/auction-insights?preset=${preset}`),
    getSearchTerms: (preset = '30d') => googleApi.get(`/google/auth/search-terms?preset=${preset}`),
    getQualityScore: () => googleApi.get('/google/auth/quality-score'),
    getAssetData: () => googleApi.get('/google/auth/assets'),
    getBidding: (preset = '30d') => googleApi.get(`/google/auth/bidding?preset=${preset}`),
    getGeo: (preset = '30d') => googleApi.get(`/google/auth/geo?preset=${preset}`),
    getDiscovery: () => googleApi.get('/google/auth/accounts'),
    updateAccount: (payload: { customerId: string; loginCustomerId?: string; allClientIds?: string[] }) =>
        googleApi.post('/google/auth/update-account', payload),
};

export default api;
