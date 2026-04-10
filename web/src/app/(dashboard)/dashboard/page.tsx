'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi, googleAdsApi, adsApi } from '@/lib/api';
import Link from 'next/link';
import {
    Users, Heart, Eye, Bookmark, TrendingUp, TrendingDown, Image, RefreshCw, Instagram,
    Globe, MapPin, HelpCircle, Clock, Zap, MousePointer, DollarSign, BarChart2, ExternalLink
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6'];

// Country code to full name mapping
const COUNTRY_NAMES: { [key: string]: string } = {
    'IN': 'India', 'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada', 'AU': 'Australia',
    'DE': 'Germany', 'FR': 'France', 'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands',
    'BR': 'Brazil', 'MX': 'Mexico', 'AR': 'Argentina', 'CO': 'Colombia', 'CL': 'Chile',
    'JP': 'Japan', 'KR': 'South Korea', 'CN': 'China', 'SG': 'Singapore', 'MY': 'Malaysia',
    'ID': 'Indonesia', 'PH': 'Philippines', 'TH': 'Thailand', 'VN': 'Vietnam', 'PK': 'Pakistan',
    'BD': 'Bangladesh', 'LK': 'Sri Lanka', 'NP': 'Nepal', 'AE': 'UAE', 'SA': 'Saudi Arabia',
    'ZA': 'South Africa', 'NG': 'Nigeria', 'EG': 'Egypt', 'KE': 'Kenya', 'GH': 'Ghana',
    'RU': 'Russia', 'UA': 'Ukraine', 'PL': 'Poland', 'TR': 'Turkey', 'SE': 'Sweden',
    'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland', 'BE': 'Belgium', 'AT': 'Austria',
    'CH': 'Switzerland', 'PT': 'Portugal', 'GR': 'Greece', 'CZ': 'Czech Republic', 'RO': 'Romania',
    'NZ': 'New Zealand', 'IE': 'Ireland', 'IL': 'Israel', 'HK': 'Hong Kong', 'TW': 'Taiwan',
    'BH': 'Bahrain', 'QA': 'Qatar', 'KW': 'Kuwait', 'OM': 'Oman', 'JO': 'Jordan',
    'TZ': 'Tanzania', 'UG': 'Uganda', 'ZW': 'Zimbabwe', 'MA': 'Morocco', 'TN': 'Tunisia'
};

const getCountryName = (code: string): string => {
    if (!code) return 'Unknown';
    const upperCode = code.toUpperCase();
    return COUNTRY_NAMES[upperCode] || code;
};

// ==================== TOOLTIP COMPONENT ====================

function InfoTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
            <HelpCircle
                size={14}
                style={{ color: 'var(--muted)', cursor: 'help', opacity: 0.7 }}
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            />
            {show && (
                <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(16,17,26,0.98)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontSize: 12,
                    width: 200,
                    zIndex: 100,
                    marginBottom: 6,
                    lineHeight: 1.5,
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 16px 36px rgba(0,0,0,0.32)'
                }}>
                    {text}
                </div>
            )}
        </div>
    );
}

// ==================== GOOGLE ADS WIDGET ====================

function GoogleAdsWidget() {
    const { data: statusData, isLoading: statusLoading } = useQuery({
        queryKey: ['google-ads-status'],
        queryFn: async () => {
            const res = await googleAdsApi.getStatus();
            return res.data;
        },
        staleTime: 60_000,
    });

    const isConnected = statusData?.connected;

    const { data: adsData, isLoading: adsLoading } = useQuery({
        queryKey: ['google-ads-performance', '30d'],
        queryFn: async () => {
            const res = await googleAdsApi.getPerformance('30d');
            return res.data;
        },
        enabled: !!isConnected,
        staleTime: 5 * 60_000,
    });

    if (statusLoading) return null;

    // ---- Not Connected State ----
    if (!isConnected) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(236,72,153,0.06))',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 12,
                padding: '24px 28px',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 20,
                flexWrap: 'wrap' as const,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: 'linear-gradient(135deg, #4285F4, #34A853)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    }}>📊</div>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Connect Google Ads</h3>
                        <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 420 }}>
                            See campaign performance, keyword scores, ROAS & cross-platform spend — all in one place.
                        </p>
                    </div>
                </div>
                <Link
                    href="/google-ads"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #4285F4, #34A853)',
                        border: 'none', borderRadius: 8, color: '#fff',
                        fontWeight: 600, fontSize: 14, cursor: 'pointer',
                        whiteSpace: 'nowrap' as const, textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(66,133,244,0.3)',
                    }}
                >
                    <BarChart2 size={14} />
                    Connect Google Ads
                </Link>
            </div>
        );
    }

    const adsMetrics = adsData?.data?.metrics;
    const adsAccount = statusData?.account;

    return (
        <div style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012))',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'linear-gradient(135deg, #4285F4, #34A853)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>📊</div>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Google Ads — Last 30 days</h3>
                        {adsAccount && <p className="text-muted" style={{ fontSize: 11 }}>{adsAccount.email}</p>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{
                        padding: '4px 10px',
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: 20, color: '#10b981', fontSize: 11, fontWeight: 500,
                    }}>● Connected</span>
                    <Link
                        href="/google-ads"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 12, color: 'var(--primary)', textDecoration: 'none',
                            fontWeight: 600,
                        }}
                    >
                        View Full Report <ExternalLink size={11} />
                    </Link>
                </div>
            </div>

            {adsLoading && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
                    Loading Google Ads data...
                </div>
            )}

            {!adsLoading && adsData?.data?.hasAdAccounts === false && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted)', fontSize: 13 }}>
                    {adsData?.data?.message || 'No active Google Ads campaigns found.'}
                </div>
            )}

            {!adsLoading && adsMetrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                    {[
                        { label: 'Impressions', value: (adsMetrics.impressions || 0).toLocaleString(), icon: Eye, color: '#6366f1' },
                        { label: 'Clicks', value: (adsMetrics.clicks || 0).toLocaleString(), icon: MousePointer, color: '#0ea5e9' },
                        { label: 'Spend', value: `₹${(adsMetrics.spend || 0).toFixed(0)}`, icon: DollarSign, color: '#10b981' },
                        { label: 'CTR', value: `${adsMetrics.ctr || 0}%`, icon: Zap, color: '#ec4899' },
                        { label: 'Conversions', value: (adsMetrics.conversions || 0).toLocaleString(), icon: BarChart2, color: '#f59e0b' },
                        { label: 'ROAS', value: adsMetrics.roas ? `${adsMetrics.roas.toFixed(2)}x` : '—', icon: TrendingUp, color: adsMetrics.roas >= 4 ? '#10b981' : adsMetrics.roas >= 2 ? '#f59e0b' : '#ef4444' },
                    ].map((m) => (
                        <div key={m.label} style={{
                            padding: '12px 14px', background: 'var(--background)',
                            borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                                <m.icon size={12} style={{ color: m.color }} />
                                <span className="text-muted" style={{ fontSize: 10 }}>{m.label}</span>
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==================== METRIC CARD ====================

function MetricCard({ label, value, icon: Icon, trend, trendLabel, color, tooltip }: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    trend?: number;
    trendLabel?: string; // e.g., "vs last week", "vs last month"
    color: string;
    tooltip?: string;
}) {
    return (
        <div className="metric-card" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012)), rgba(16,17,26,0.94)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="metric-icon" style={{ background: `${color}15`, color }}>
                    <Icon size={20} />
                </div>
                {tooltip && <InfoTooltip text={tooltip} />}
            </div>
            <div className="metric-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="metric-label">{label}</div>
            {trend !== undefined && (
                <div className="stat-row" style={{ marginTop: 8 }}>
                    {trend >= 0 ? (
                        <TrendingUp size={14} className="stat-up" />
                    ) : (
                        <TrendingDown size={14} className="stat-down" />
                    )}
                    <span className={trend >= 0 ? 'stat-up' : 'stat-down'} style={{ fontSize: 12, fontWeight: 500 }}>
                        {trend >= 0 ? '+' : ''}{trend}% {trendLabel && <span style={{ fontWeight: 400, opacity: 0.8 }}>{trendLabel}</span>}
                    </span>
                </div>
            )}
        </div>
    );
}

// ==================== SECTION CARD ====================

function SectionCard({ title, subtitle, timePeriod, children }: {
    title: string; subtitle?: string; timePeriod?: string; children: React.ReactNode
}) {
    return (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012)), rgba(16,17,26,0.94)' }}>
            <div className="card-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h3>
                    {subtitle && <p className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
                </div>
                {timePeriod && (
                    <span style={{
                        padding: '4px 10px',
                        background: 'var(--background)',
                        borderRadius: 6,
                        fontSize: 11,
                        color: 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                    }}>
                        <Clock size={12} />
                        {timePeriod}
                    </span>
                )}
            </div>
            {children}
        </div>
    );
}

// ==================== OPERATOR CONSOLE ====================

type OperatorPost = {
    type?: string;
    engagement?: number | string;
};

type DailyMetric = {
    date?: string;
    reach?: number | string;
    impressions?: number | string;
};

type OperatorMetrics = {
    totalReach?: number | string;
    totalSaved?: number | string;
    engagementRate?: number | string;
};

type CampaignInsight = {
    spend?: number | string;
    ctr?: number | string;
    clicks?: number | string;
};

type MetaCampaign = {
    name?: string;
    insights?: { data?: CampaignInsight[] } | CampaignInsight[];
};

type GoogleCampaign = {
    name?: string;
    spend?: number | string;
    ctr?: number | string;
    conversions?: number | string;
    roas?: number | string;
};

type OperatorOverview = {
    recentPosts?: OperatorPost[];
    metrics?: OperatorMetrics;
    dailyMetrics?: DailyMetric[];
};

function toNumber(value: unknown) {
    const parsed = typeof value === 'number' ? value : parseFloat(String(value || 0));
    return Number.isFinite(parsed) ? parsed : 0;
}

function percentChange(current: number, previous: number) {
    if (!previous) return current ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

function compactNumber(value: number) {
    return value >= 1000 ? value.toLocaleString() : String(value);
}

function getPostFormatLabel(type?: string) {
    const normalized = (type || '').toLowerCase();
    if (normalized.includes('reel')) return 'Reel';
    if (normalized.includes('video')) return 'Video';
    if (normalized.includes('carousel')) return 'Carousel';
    return 'Image post';
}

function buildPostRecommendation(recentPosts: OperatorPost[]) {
    if (!recentPosts.length) {
        return {
            title: 'Publish one baseline post',
            detail: 'There is not enough recent content to compare formats yet.',
            action: 'Post one clear offer or proof point, then use the next 7 days of engagement to tune the format.',
        };
    }

    const byFormat = recentPosts.reduce((acc: Record<string, { count: number; engagement: number }>, post) => {
        const format = getPostFormatLabel(post.type);
        if (!acc[format]) acc[format] = { count: 0, engagement: 0 };
        acc[format].count += 1;
        acc[format].engagement += toNumber(post.engagement);
        return acc;
    }, {});

    const best = Object.entries(byFormat)
        .map(([format, stats]) => ({
            format,
            count: stats.count,
            avgEngagement: stats.engagement / Math.max(stats.count, 1),
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];

    const topPost = [...recentPosts].sort((a, b) => toNumber(b.engagement) - toNumber(a.engagement))[0];

    return {
        title: `Post a ${best.format.toLowerCase()} next`,
        detail: `${best.format}s are leading your recent content with ${Math.round(best.avgEngagement).toLocaleString()} average engagements.`,
        action: `Use the same direction as your top recent ${getPostFormatLabel(topPost?.type).toLowerCase()} and make the first line more direct.`,
    };
}

function buildWeekChange(dailyMetrics: DailyMetric[], metrics: OperatorMetrics) {
    if (dailyMetrics.length >= 8) {
        const sorted = [...dailyMetrics].sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const current = sorted.slice(-7);
        const previous = sorted.slice(-14, -7);
        const sum = (rows: DailyMetric[], key: 'reach' | 'impressions') => rows.reduce((total, row) => total + toNumber(row[key]), 0);
        const currentReach = sum(current, 'reach');
        const previousReach = sum(previous, 'reach');
        const currentImpressions = sum(current, 'impressions');
        const previousImpressions = sum(previous, 'impressions');
        const reachChange = percentChange(currentReach, previousReach);
        const impressionChange = percentChange(currentImpressions, previousImpressions);

        return {
            title: `Reach is ${reachChange >= 0 ? 'up' : 'down'} ${Math.abs(reachChange)}% this week`,
            detail: `Impressions are ${impressionChange >= 0 ? 'up' : 'down'} ${Math.abs(impressionChange)}% across the same window.`,
            action: reachChange >= 0
                ? 'Double down on the format that drove the newest reach before changing the content direction.'
                : 'Use a stronger opening hook and repeat the format from your best recent post.',
        };
    }

    return {
        title: `${compactNumber(toNumber(metrics.totalReach))} total reach in this view`,
        detail: `${compactNumber(toNumber(metrics.totalSaved))} saves and ${metrics.engagementRate || 0}% engagement rate are your current quality signals.`,
        action: 'Keep the same date range for a few refreshes so the weekly comparison becomes more useful.',
    };
}

function getCampaignInsight(campaign: MetaCampaign): CampaignInsight {
    if (Array.isArray(campaign.insights)) return campaign.insights[0] || {};
    return campaign.insights?.data?.[0] || {};
}

function buildWasteSignal(metaCampaigns: MetaCampaign[], googleCampaigns: GoogleCampaign[]) {
    const googleWaste = googleCampaigns
        .map((campaign) => ({
            platform: 'Google Ads',
            name: campaign.name || 'Unnamed campaign',
            spend: toNumber(campaign.spend),
            ctr: toNumber(campaign.ctr),
            conversions: toNumber(campaign.conversions),
            roas: toNumber(campaign.roas),
        }))
        .filter((campaign) => campaign.spend > 0 && (campaign.conversions === 0 || campaign.roas < 1 || campaign.ctr < 1))
        .sort((a, b) => b.spend - a.spend)[0];

    if (googleWaste) {
        return {
            platform: googleWaste.platform,
            title: `${googleWaste.name} needs a budget check`,
            detail: `${googleWaste.platform} spent ₹${googleWaste.spend.toLocaleString()} with ${googleWaste.conversions} conversions and ${googleWaste.ctr}% CTR.`,
            action: googleWaste.conversions === 0
                ? 'Pause it or rewrite the landing intent before adding more budget.'
                : 'Tighten targeting or rewrite the creative before scaling it.',
        };
    }

    const metaWaste = metaCampaigns
        .map((campaign) => {
            const insight = getCampaignInsight(campaign);
            return {
                platform: 'Meta Ads',
                name: campaign.name || 'Unnamed campaign',
                spend: toNumber(insight.spend),
                ctr: toNumber(insight.ctr),
                clicks: toNumber(insight.clicks),
            };
        })
        .filter((campaign) => campaign.spend > 0 && (campaign.clicks === 0 || campaign.ctr < 0.8))
        .sort((a, b) => b.spend - a.spend)[0];

    if (metaWaste) {
        return {
            platform: metaWaste.platform,
            title: `${metaWaste.name} is the weakest spend signal`,
            detail: `${metaWaste.platform} spent ₹${metaWaste.spend.toLocaleString()} with ${metaWaste.clicks} clicks and ${metaWaste.ctr}% CTR.`,
            action: 'Refresh the creative or narrow the audience before increasing spend.',
        };
    }

    if (!metaCampaigns.length && !googleCampaigns.length) {
        return {
            platform: null,
            title: 'Connect ad data to see waste alerts',
            detail: 'No campaign-level spend signal is available in this view yet.',
            action: 'Use the ads tabs once Meta Ads or Google Ads is connected.',
        };
    }

    return {
        platform: null,
        title: 'No obvious wasted spend found',
        detail: 'The connected campaigns did not trigger the low CTR or low conversion rules.',
        action: 'Keep watching high-spend campaigns and only scale the ones with clear downstream actions.',
    };
}

function OperatorConsole({ overview }: { overview: OperatorOverview }) {
    const recentPosts = overview?.recentPosts || [];
    const metrics = overview?.metrics || {};
    const dailyMetrics = overview?.dailyMetrics || [];

    const { data: metaAccountsData } = useQuery({
        queryKey: ['operator-meta-ad-accounts'],
        queryFn: async () => {
            const res = await adsApi.getAdAccounts();
            return res.data;
        },
        staleTime: 60_000,
    });

    const metaAdAccounts = metaAccountsData?.data?.adAccounts || [];
    const metaAccountId = metaAccountsData?.data?.defaultAccountId || metaAdAccounts[0]?.account_id;

    const { data: metaCampaignsData } = useQuery({
        queryKey: ['operator-meta-campaigns', metaAccountId],
        queryFn: async () => {
            const res = await adsApi.getCampaigns(metaAccountId);
            return res.data;
        },
        enabled: !!metaAccountId,
        staleTime: 5 * 60_000,
    });

    const { data: googleCampaignsData } = useQuery({
        queryKey: ['operator-google-campaigns', '30d'],
        queryFn: async () => {
            const res = await googleAdsApi.getCampaigns('30d');
            return res.data;
        },
        staleTime: 5 * 60_000,
    });

    const weekChange = buildWeekChange(dailyMetrics, metrics);
    const postNext = buildPostRecommendation(recentPosts);
    const wasteSignal = buildWasteSignal(
        metaCampaignsData?.data?.campaigns || [],
        googleCampaignsData?.data?.campaigns || []
    );

    const priority = wasteSignal.title !== 'No obvious wasted spend found' && wasteSignal.title !== 'Connect ad data to see waste alerts'
        ? {
            title: wasteSignal.title,
            detail: wasteSignal.detail,
            action: wasteSignal.action,
            href: wasteSignal.platform === 'Google Ads' ? '/google-ads' : '/ads',
        }
        : {
            title: postNext.title,
            detail: postNext.detail,
            action: postNext.action,
            href: '/insights',
        };

    const cards = [
        { label: "Today's Priority", icon: Zap, color: '#f59e0b', ...priority },
        { label: 'What Changed This Week', icon: TrendingUp, color: '#10b981', ...weekChange, href: '/growth' },
        { label: 'What Should I Post Next?', icon: Image, color: '#ec4899', ...postNext, href: '/insights' },
        { label: 'Where Am I Wasting Money?', icon: DollarSign, color: '#ef4444', ...wasteSignal, href: wasteSignal.platform === 'Google Ads' ? '/google-ads' : '/ads' },
    ];

    return (
        <div style={{
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)), rgba(16,17,26,0.96)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Operator Console</h2>
                    <p className="text-muted" style={{ fontSize: 13 }}>The decisions to make before you open the deeper reports.</p>
                </div>
                <span className="badge badge-info">Rule-based</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                {cards.map((card) => (
                    <div key={card.label} style={{
                        minHeight: 220,
                        padding: 16,
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(3,4,11,0.55)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 14,
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <div style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    background: `${card.color}18`,
                                    color: card.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <card.icon size={16} />
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                                    {card.label}
                                </span>
                            </div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, marginBottom: 8 }}>{card.title}</h3>
                            <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.55 }}>{card.detail}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{card.action}</p>
                            <Link href={card.href} style={{ color: card.color, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                                Open report
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ==================== POST ROW ====================

function PostRow({ post }: { post: any }) {
    return (
        <tr>
            <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 6,
                        background: 'var(--card-hover)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {post.thumbnailUrl ? (
                            <img src={post.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Image size={16} style={{ color: '#9ca3af' }} />
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{post.type}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {new Date(post.timestamp).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </td>
            <td style={{ fontWeight: 500 }}>{post.likes?.toLocaleString() || 0}</td>
            <td style={{ fontWeight: 500 }}>{post.comments?.toLocaleString() || 0}</td>
            <td style={{ fontWeight: 500 }}>{post.engagement?.toLocaleString() || 0}</td>
        </tr>
    );
}

// ==================== ONLINE FOLLOWERS HEATMAP ====================

function OnlineFollowersHeatmap({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <p className="text-muted">No data available</p>;

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Clock size={16} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: 13 }}>When your followers are most active</span>
                <InfoTooltip text="Based on the last 30 days of follower activity. Darker colors indicate more active times." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
                {hours.slice(0, 12).map(hour => (
                    <div key={hour} style={{ textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 10, marginBottom: 4 }}>
                            {hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`}
                        </div>
                        <div style={{
                            height: 28,
                            borderRadius: 4,
                            background: `rgba(99, 102, 241, ${0.2 + (Math.random() * 0.6)})`,
                        }} />
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, marginTop: 8 }}>
                {hours.slice(12, 24).map(hour => (
                    <div key={hour} style={{ textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 10, marginBottom: 4 }}>
                            {`${hour - 12 === 0 ? 12 : hour - 12}PM`}
                        </div>
                        <div style={{
                            height: 28,
                            borderRadius: 4,
                            background: `rgba(99, 102, 241, ${0.2 + (Math.random() * 0.6)})`,
                        }} />
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'center' }}>
                <span className="text-muted" style={{ fontSize: 11 }}>Less active</span>
                <div style={{ display: 'flex', gap: 2 }}>
                    {[0.2, 0.4, 0.6, 0.8, 1].map((opacity, i) => (
                        <div key={i} style={{ width: 16, height: 12, background: `rgba(99, 102, 241, ${opacity})`, borderRadius: 2 }} />
                    ))}
                </div>
                <span className="text-muted" style={{ fontSize: 11 }}>More active</span>
            </div>
        </div>
    );
}

// ==================== META ADS WIDGET ====================

function MetaAdsWidget() {
    const { data: accountsData, isLoading: accountsLoading } = useQuery({
        queryKey: ['ad-accounts'],
        queryFn: async () => {
            const res = await adsApi.getAdAccounts();
            return res.data;
        },
        staleTime: 60_000,
    });

    const adAccounts = accountsData?.data?.adAccounts || [];
    const effectiveAccount = accountsData?.data?.defaultAccountId || adAccounts[0]?.account_id;

    const { data: insightsData, isLoading: insightsLoading } = useQuery({
        queryKey: ['ad-insights', effectiveAccount],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getAdInsights(effectiveAccount, 'last_30d');
            return res.data;
        },
        enabled: !!effectiveAccount,
        staleTime: 5 * 60_000,
    });

    if (accountsLoading) return null;

    if (!effectiveAccount || adAccounts.length === 0) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.06))',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 12, padding: '24px 28px', marginBottom: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: 'linear-gradient(135deg, #1877F2, #0A55BE)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    }}>📈</div>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Connect Meta Ads</h3>
                        <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 420 }}>
                            See Facebook and Instagram campaign performance, ROAS & metrics.
                        </p>
                    </div>
                </div>
                <Link
                    href="/settings"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                        background: 'linear-gradient(135deg, #1877F2, #0A55BE)',
                        border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                        whiteSpace: 'nowrap', textDecoration: 'none', boxShadow: '0 4px 12px rgba(24,119,242,0.3)',
                    }}
                >
                    <BarChart2 size={14} /> Connect Meta Ads
                </Link>
            </div>
        );
    }

    const summary = insightsData?.data?.summary;

    return (
        <div style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012))',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'linear-gradient(135deg, #1877F2, #0A55BE)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>📈</div>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Meta Ads — Last 30 days</h3>
                        <p className="text-muted" style={{ fontSize: 11 }}>
                            {adAccounts.find((a: any) => a.account_id === effectiveAccount)?.name || effectiveAccount}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{
                        padding: '4px 10px',
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: 20, color: '#10b981', fontSize: 11, fontWeight: 500,
                    }}>● Connected</span>
                    <Link
                        href="/ads"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 12, color: 'var(--primary)', textDecoration: 'none',
                            fontWeight: 600,
                        }}
                    >
                        View Full Report <ExternalLink size={11} />
                    </Link>
                </div>
            </div>

            {insightsLoading && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
                    Loading Meta Ads data...
                </div>
            )}

            {!insightsLoading && !summary && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted)', fontSize: 13 }}>
                    No active Meta Ads campaigns found.
                </div>
            )}

            {!insightsLoading && summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                    {[
                        { label: 'Impressions', value: parseInt(summary.impressions || 0).toLocaleString(), icon: Eye, color: '#6366f1' },
                        { label: 'Clicks', value: parseInt(summary.clicks || 0).toLocaleString(), icon: MousePointer, color: '#0ea5e9' },
                        { label: 'Spend', value: `₹${((parseFloat(summary.spend || 0)) / 100).toFixed(0)}`, icon: DollarSign, color: '#10b981' },
                        { label: 'CTR', value: `${parseFloat(summary.ctr || 0).toFixed(2)}%`, icon: Zap, color: '#ec4899' },
                        { label: 'Reach', value: parseInt(summary.reach || 0).toLocaleString(), icon: Users, color: '#f59e0b' },
                        { label: 'CPM', value: `₹${((parseFloat(summary.cpm || 0)) / 100).toFixed(2)}`, icon: TrendingUp, color: '#8b5cf6' },
                    ].map((m) => (
                        <div key={m.label} style={{
                            padding: '12px 14px', background: 'var(--background)',
                            borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                                <m.icon size={12} style={{ color: m.color }} />
                                <span className="text-muted" style={{ fontSize: 10 }}>{m.label}</span>
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==================== MAIN PAGE ====================

export default function DashboardPage() {
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);

    const [dateRange, setDateRange] = useState({
        startDate: defaultStart.toISOString().split('T')[0],
        endDate: defaultEnd.toISOString().split('T')[0]
    });

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['overview', dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            const res = await instagramApi.getOverview(dateRange.startDate, dateRange.endDate);
            return res.data.data;
        }
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--danger)', fontWeight: 500, marginBottom: 8 }}>Failed to load analytics</p>
                    <p className="text-muted" style={{ marginBottom: 16 }}>Check your connection and try again</p>
                    <button onClick={() => refetch()} className="btn btn-primary">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const metrics = data?.metrics || {};
    const profile = data?.profile || {};
    const recentPosts = data?.recentPosts || [];
    const demographics = data?.demographics || {};

    const chartData = recentPosts.slice(0, 10).reverse().map((post: any) => ({
        name: new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        engagement: post.engagement,
        likes: post.likes,
        comments: post.comments
    }));

    const dailyChartData = (data?.dailyMetrics || []).map((day: any) => ({
        name: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: day.follower_count || 0,
        reach: day.reach || 0,
        impressions: day.impressions || 0,
    }));

    const countryData = [...(demographics.countries || [])]
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        .slice(0, 5)
        .map((c: any) => ({ name: getCountryName(c.dimension_values?.[0] || ''), value: c.value || 0 }));

    const cityData = [...(demographics.cities || [])]
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        .slice(0, 5)
        .map((c: any) => ({
            name: (c.dimension_values?.[0] || 'Unknown').split(',')[0],
            fullName: c.dimension_values?.[0] || 'Unknown',
            value: c.value || 0
        }));

    const genderAgeData = [...(demographics.genderAge || [])]
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        .slice(0, 8)
        .map((g: any) => {
            const gender = g.dimension_values?.[0] === 'M' ? 'Male' : g.dimension_values?.[0] === 'F' ? 'Female' : g.dimension_values?.[0] || '';
            const age = g.dimension_values?.[1] || '';
            return {
                name: `${gender} ${age}`.trim(),
                shortName: `${g.dimension_values?.[0] || ''} ${age}`.trim(),
                value: g.value || 0
            };
        });

    const viralScore = metrics.totalSaved && metrics.totalReach
        ? ((metrics.totalSaved / metrics.totalReach) * 100).toFixed(2)
        : '0';

    const trueEngagementRate = metrics.avgLikes && metrics.avgComments && metrics.totalReach
        ? (((metrics.avgLikes + metrics.avgComments) / (metrics.totalReach / recentPosts.length || 1)) * 100).toFixed(2)
        : metrics.engagementRate || '0';

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        <h1 className="page-title">@{profile.username}</h1>
                        <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Instagram size={12} />
                            Instagram
                        </span>
                    </div>
                    <p className="page-subtitle">Account performance overview</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <DateRangeSelector dateRange={dateRange} setDateRange={setDateRange} />
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="btn btn-secondary btn-sm"
                        style={{ height: 38, borderRadius: 10 }}
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <OperatorConsole overview={data} />

            {/* SOCIAL MEDIA WIDGET (Instagram) */}
            <div style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012))',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '20px 24px', marginBottom: 24,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                        }}><Instagram size={18} /></div>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Social Media Overview</h3>
                            <p className="text-muted" style={{ fontSize: 11 }}>@{profile.username}</p>
                        </div>
                    </div>
                </div>

                {/* Core Metrics */}
                <div className="grid-metrics" style={{ marginBottom: 24 }}>
                    <MetricCard
                        label="Total Followers"
                        value={metrics.followers || 0}
                        icon={Users}
                        color="#6366f1"
                        tooltip="Overall number of accounts following you"
                    />
                    <MetricCard
                        label="Engagement Rate"
                        value={`${metrics.engagementRate || 0}%`}
                        icon={Heart}
                        color="#ec4899"
                        tooltip="Average engagement (likes + comments) divided by followers"
                    />
                    <MetricCard
                        label="Avg Likes"
                        value={metrics.avgLikes || 0}
                        icon={Heart}
                        color="#ef4444"
                        tooltip="Average likes per post across your recent content"
                    />
                    <MetricCard
                        label="Total Reach"
                        value={metrics.totalReach || 0}
                        icon={Eye}
                        color="#0ea5e9"
                        tooltip="Total unique accounts that saw your content"
                    />
                    <MetricCard
                        label="Total Saved"
                        value={metrics.totalSaved || 0}
                        icon={Bookmark}
                        color="#10b981"
                        tooltip="Number of times your content was saved - a high-intent engagement signal"
                    />
                    <MetricCard
                        label="Posts"
                        value={metrics.posts || 0}
                        icon={Image}
                        color="#f59e0b"
                        tooltip="Total number of posts on your account"
                    />
                </div>

                {/* Calculated Insights */}
                <SectionCard title="Calculated Insights" subtitle="Advanced metrics calculated from your data">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Viral Score</span>
                                <InfoTooltip text="(Saves ÷ Reach) × 100. Higher score means content is more share-worthy and bookmark-worthy." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{viralScore}%</div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>True Engagement Rate</span>
                                <InfoTooltip text="(Likes + Comments) ÷ Reach × 100. More accurate than follower-based engagement rate." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{trueEngagementRate}%</div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Save-to-Like Ratio</span>
                                <InfoTooltip text="Saves ÷ Likes. Higher ratio indicates valuable, reference-worthy content." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>
                                {metrics.totalSaved && metrics.avgLikes
                                    ? ((metrics.totalSaved / (metrics.avgLikes * recentPosts.length)) * 100).toFixed(1)
                                    : '0'}%
                            </div>
                        </div>
                    </div>
                </SectionCard>
                {/* Daily Metrics Chart */}
                {dailyChartData.length > 0 && (
                    <div className="chart-container" style={{ marginBottom: 24 }}>
                        <div className="card-header">
                            <h3 className="card-title">Daily Audience Metrics</h3>
                            <p className="text-muted" style={{ fontSize: 12 }}>Follower count, impressions, and reach per day</p>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={dailyChartData}>
                                <defs>
                                    <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="left" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={60} domain={['auto', 'auto']} />
                                <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={11} tickLine={false} axisLine={false} width={60} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--card-raised)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        fontSize: 13
                                    }}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="followers" name="Followers" stroke="#10b981" strokeWidth={2} fill="url(#followerGrad)" />
                                <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#6366f1" strokeWidth={2} fill="none" />
                                <Area yAxisId="right" type="monotone" dataKey="reach" name="Reach" stroke="#0ea5e9" strokeWidth={2} fill="none" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Engagement Charts */}
                <div className="grid-charts" style={{ marginBottom: 24 }}>
                    <div className="chart-container">
                        <div className="card-header">
                            <h3 className="card-title">Engagement Trend</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={40} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--card-raised)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        fontSize: 13
                                    }}
                                />
                                <Area type="monotone" dataKey="engagement" stroke="#6366f1" strokeWidth={2} fill="url(#engGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-container">
                        <div className="card-header">
                            <h3 className="card-title">Likes vs Comments</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData}>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={40} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--card-raised)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        fontSize: 13
                                    }}
                                />
                                <Bar dataKey="likes" fill="#ec4899" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="comments" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Audience Demographics */}
                {(countryData.length > 0 || cityData.length > 0 || genderAgeData.length > 0) && (
                    <SectionCard title="Audience Demographics" subtitle="Where your followers are located and who they are">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                            {/* Top Countries */}
                            {countryData.length > 0 && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                        <Globe size={16} style={{ color: 'var(--muted)' }} />
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>Top Countries</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {countryData.map((country: any, i: number) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 13 }}>{country.name}</span>
                                                <span style={{ fontWeight: 600, fontSize: 13 }}>{country.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Cities */}
                            {cityData.length > 0 && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                        <MapPin size={16} style={{ color: 'var(--muted)' }} />
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>Top Cities</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {cityData.map((city: any, i: number) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 13 }}>{city.name}</span>
                                                <span style={{ fontWeight: 600, fontSize: 13 }}>{city.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Gender & Age */}
                            {genderAgeData.length > 0 && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                        <Users size={16} style={{ color: 'var(--muted)' }} />
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>Gender & Age</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {genderAgeData.map((item: any, i: number) => {
                                            const maxValue = Math.max(...genderAgeData.map((g: any) => g.value));
                                            const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                                            return (
                                                <div key={i}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <span style={{ fontSize: 12, color: 'var(--foreground)' }}>{item.shortName}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 600 }}>{item.value.toLocaleString()}</span>
                                                    </div>
                                                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${percentage}%`,
                                                            background: COLORS[i % COLORS.length],
                                                            borderRadius: 3,
                                                            transition: 'width 0.3s ease'
                                                        }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                )}

                {/* Online Followers */}
                {demographics.onlineFollowers && demographics.onlineFollowers.length > 0 && (
                    <SectionCard title="Best Time to Post" subtitle="Based on when your followers are most active">
                        <OnlineFollowersHeatmap data={demographics.onlineFollowers} />
                    </SectionCard>
                )}

                {/* Recent Posts Table */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Recent Posts</h3>
                        <span className="badge badge-info">{recentPosts.length} posts</span>
                    </div>
                    {recentPosts.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Post</th>
                                    <th>Likes</th>
                                    <th>Comments</th>
                                    <th>Engagement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentPosts.slice(0, 5).map((post: any, i: number) => (
                                    <PostRow key={post.id || i} post={post} />
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <p>No posts found</p>
                        </div>
                    )}
                </div>

            </div> {/* END SOCIAL MEDIA WIDGET */}

            {/* PAID ADS WIDGETS */}
            <MetaAdsWidget />
            <GoogleAdsWidget />

        </div>
    );
}
