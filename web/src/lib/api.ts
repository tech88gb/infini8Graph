import axios from 'axios';

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
    let token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['X-Auth-Token'] = token; // Redundant backup
    }
    return config;
}, (error) => {
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
    connectMeta: () => api.get('/auth/meta/connect'),
    reconnectMeta: () => api.post('/auth/meta/reconnect'),
    getMe: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
    refresh: () => api.post('/auth/refresh'),
    // Multi-account support
    getAccounts: (includeDisabled = false) =>
        api.get(`/auth/accounts${includeDisabled ? '?includeDisabled=true' : ''}`),
    updateAccountEnabled: (accountId: string, isEnabled: boolean) =>
        api.patch(`/auth/accounts/${accountId}/enabled`, { is_enabled: isEnabled }),
    switchAccount: (accountId: string) => api.post(`/auth/switch/${accountId}`)
};

export const instagramApi = (() => {
    const buildParams = (startDate?: string, endDate?: string) => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const query = params.toString();
        return query ? `?${query}` : '';
    };

    return {
        getOverview: (startDate?: string, endDate?: string) => api.get(`/instagram/overview${buildParams(startDate, endDate)}`),
        getGrowth: (startDate?: string, endDate?: string, period = '30d') => {
            const params = new URLSearchParams({ period });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            return api.get(`/instagram/growth?${params.toString()}`);
        },
        getBestTime: (startDate?: string, endDate?: string) => api.get(`/instagram/best-time${buildParams(startDate, endDate)}`),
        getHashtags: (startDate?: string, endDate?: string) => api.get(`/instagram/hashtags${buildParams(startDate, endDate)}`),
        getReels: (startDate?: string, endDate?: string) => api.get(`/instagram/reels${buildParams(startDate, endDate)}`),
        getPosts: (limit = 50, startDate?: string, endDate?: string, includeCollabs = false) => {
            const p = new URLSearchParams({ limit: String(limit) });
            if (startDate) p.append('startDate', startDate);
            if (endDate) p.append('endDate', endDate);
            if (includeCollabs) p.append('includeCollabs', 'true');
            return api.get(`/instagram/posts?${p.toString()}`);
        },
        exportData: (
            format: 'json' | 'csv' | 'tsv' | 'md' | 'html' = 'json',
            metrics = 'overview,growth,posts',
            startDate?: string,
            endDate?: string
        ) => {
            const params = new URLSearchParams({ format, metrics });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            return api.get(`/instagram/export?${params.toString()}`, {
                responseType: format === 'json' ? 'json' : 'blob',
            });
        },
        getContentIntelligence: (startDate?: string, endDate?: string) => api.get(`/instagram/content-intelligence${buildParams(startDate, endDate)}`),
        getUnifiedOverview: (startDate?: string, endDate?: string) => api.get(`/instagram/unified-overview${buildParams(startDate, endDate)}`)
    };
})();

export const automationApi = {
    getRules: () => api.get('/automation/rules'),
    createRule: (payload: unknown) => api.post('/automation/rules', payload),
    updateRule: (ruleId: string, payload: unknown) => api.patch(`/automation/rules/${ruleId}`, payload),
    deleteRule: (ruleId: string) => api.delete(`/automation/rules/${ruleId}`),
    getStats: () => api.get('/automation/stats'),
    getActivity: () => api.get('/automation/activity'),
};

export const webhookApi = {
    getStatus: () => api.get('/webhook/status'),
};

export const adsApi = {
    testPermissions: () => api.get('/ads/test-permissions'),
    getAdAccounts: () => api.get('/ads/accounts'),
    searchCompetitors: (query: string, country = 'IN') =>
        api.get(`/ads/competitors/search?q=${encodeURIComponent(query)}&country=${encodeURIComponent(country)}`),
    getCompetitorIntelligence: (params: {
        searchTerms?: string;
        pageId?: string;
        name?: string;
        country?: string;
        status?: 'ACTIVE' | 'ALL';
    }) => {
        const search = new URLSearchParams();
        if (params.searchTerms) search.set('searchTerms', params.searchTerms);
        if (params.pageId) search.set('pageId', params.pageId);
        if (params.name) search.set('name', params.name);
        if (params.country) search.set('country', params.country);
        if (params.status) search.set('status', params.status);
        return api.get(`/ads/competitors/intelligence?${search.toString()}`);
    },
    getAdInsights: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/insights?datePreset=${datePreset}`),
    getDemographics: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/demographics?datePreset=${datePreset}`),
    getPlacements: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/placements?datePreset=${datePreset}`),
    getGeography: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/geography?datePreset=${datePreset}`),
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
