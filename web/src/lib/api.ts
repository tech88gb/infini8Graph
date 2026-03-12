import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
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
        console.error('API Error:', error.response?.status, error.message);
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
    getAdAccounts: () => api.get('/ads/accounts'),
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

export default api;
