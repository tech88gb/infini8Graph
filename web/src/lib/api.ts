import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

function withNoCache(path: string) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}_=${Date.now()}`;
}

const api = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
    timeout: 15000, // Important to prevent infinite loading spinners
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    }
});

function readStoredToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
}

function writeStoredToken(token?: string | null) {
    if (typeof window === 'undefined' || !token) return;
    localStorage.setItem('auth_token', token);
}

function attachBearerToken(config: import('axios').InternalAxiosRequestConfig) {
    const token = readStoredToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}

function persistTokenFromResponse(response: import('axios').AxiosResponse) {
    writeStoredToken(response.data?.token);
    return response;
}

api.interceptors.request.use(attachBearerToken);

// Simple error interceptor - NO automatic redirects
api.interceptors.response.use(
    persistTokenFromResponse,
    (error) => {
        // Don't log 401s on auth/me — expected when not logged in
        const is401OnMe = error.response?.status === 401 && error.config?.url?.includes('/auth/me');
        if (!is401OnMe) {
            console.error('API Error:', error.response?.status, error.message);
        }
        return Promise.reject(error);
    }
);

const instagramApiClient = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    }
});

instagramApiClient.interceptors.request.use(attachBearerToken);
instagramApiClient.interceptors.response.use(
    persistTokenFromResponse,
    (error) => {
        console.error('Instagram API Error:', error.response?.status, error.message);
        return Promise.reject(error);
    }
);

export const authApi = {
    getLoginUrl: () => api.get('/auth/login'),
    connectMeta: () => api.get('/auth/meta/connect'),
    reconnectMeta: () => api.post('/auth/meta/reconnect'),
    exchangeCode: (code: string) => api.post('/auth/exchange', { code }),
    getMe: () => api.get(withNoCache('/auth/me')),
    logout: () => api.post('/auth/logout'),
    refresh: () => api.post('/auth/refresh'),
    // Multi-account support
    getAccounts: (includeDisabled = false) =>
        api.get(withNoCache(`/auth/accounts${includeDisabled ? '?includeDisabled=true' : ''}`)),
    updateAccountEnabled: (accountId: string, isEnabled: boolean) =>
        api.patch(`/auth/accounts/${accountId}/enabled`, { is_enabled: isEnabled }),
    switchAccount: (accountId: string) => api.post(`/auth/switch/${accountId}`)
};

export const instagramApi = (() => {
    const buildParams = (startDate?: string, endDate?: string, extraParams?: Record<string, string | number | undefined | null>) => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (extraParams) {
            Object.entries(extraParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.append(key, String(value));
                }
            });
        }
        const query = params.toString();
        return query ? `?${query}` : '';
    };

    return {
        getOverview: (startDate?: string, endDate?: string) => instagramApiClient.get(`/instagram/overview${buildParams(startDate, endDate)}`),
        getOverviewAudience: (startDate?: string, endDate?: string) => instagramApiClient.get(`/instagram/overview-audience${buildParams(startDate, endDate)}`),
        getGrowth: (startDate?: string, endDate?: string, period = '30d') => {
            const params = new URLSearchParams({ period });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            return instagramApiClient.get(`/instagram/growth?${params.toString()}`);
        },
        getBestTime: (startDate?: string, endDate?: string) => instagramApiClient.get(`/instagram/best-time${buildParams(startDate, endDate)}`),
        getHashtags: (startDate?: string, endDate?: string) => instagramApiClient.get(`/instagram/hashtags${buildParams(startDate, endDate)}`),
        getReels: (startDate?: string, endDate?: string, options?: { after?: string; limit?: number; summaryMode?: 'fast' | 'full'; summaryOnly?: boolean }) =>
            instagramApiClient.get(
                `/instagram/reels${buildParams(startDate, endDate, {
                    after: options?.after,
                    limit: options?.limit,
                    summaryMode: options?.summaryMode,
                    summaryOnly: options?.summaryOnly ? 'true' : undefined
                })}`
            ),
        getPosts: (limit = 12, startDate?: string, endDate?: string, includeCollabs = false, options?: { after?: string }) => {
            const p = new URLSearchParams({ limit: String(limit) });
            if (startDate) p.append('startDate', startDate);
            if (endDate) p.append('endDate', endDate);
            if (includeCollabs) p.append('includeCollabs', 'true');
            if (options?.after) p.append('after', options.after);
            return instagramApiClient.get(`/instagram/posts?${p.toString()}`);
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
            return instagramApiClient.get(`/instagram/export?${params.toString()}`, {
                responseType: format === 'json' ? 'json' : 'blob',
            });
        },
        getContentIntelligence: (startDate?: string, endDate?: string) => instagramApiClient.get(`/instagram/content-intelligence${buildParams(startDate, endDate)}`),
        getUnifiedOverview: (startDate?: string, endDate?: string) => instagramApiClient.get(`/instagram/unified-overview${buildParams(startDate, endDate)}`)
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
    getAdInsights: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/insights?datePreset=${datePreset}`),
    getDemographics: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/demographics?datePreset=${datePreset}`),
    getPlacements: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/placements?datePreset=${datePreset}`),
    getGeography: (adAccountId: string, datePreset = 'last_90d') =>
        api.get(`/ads/accounts/${adAccountId}/geography?datePreset=${datePreset}`),
    getCampaigns: (adAccountId: string, datePreset = 'last_30d') => api.get(`/ads/accounts/${adAccountId}/campaigns?datePreset=${datePreset}`),
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

googleApi.interceptors.request.use(attachBearerToken);

googleApi.interceptors.response.use(
    persistTokenFromResponse,
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
    getAssetData: (preset = '30d') => googleApi.get(`/google/auth/assets?preset=${preset}`),
    getBidding: (preset = '30d') => googleApi.get(`/google/auth/bidding?preset=${preset}`),
    getGeo: (preset = '30d') => googleApi.get(`/google/auth/geo?preset=${preset}`),
    getDiscovery: () => googleApi.get('/google/auth/accounts'),
    updateAccount: (payload: { customerId: string; loginCustomerId?: string; allClientIds?: string[] }) =>
        googleApi.post('/google/auth/update-account', payload),
};

export default api;
