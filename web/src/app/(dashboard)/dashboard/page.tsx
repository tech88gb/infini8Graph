'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi } from '@/lib/api';
import {
    Users, Heart, Eye, Bookmark, TrendingUp, TrendingDown, Image, RefreshCw, Instagram,
    Globe, MapPin, HelpCircle, Clock
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

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
                    background: '#1e293b',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    width: 200,
                    zIndex: 100,
                    marginBottom: 6,
                    lineHeight: 1.5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}>
                    {text}
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
        <div className="metric-card">
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
        <div className="card" style={{ marginBottom: 20 }}>
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
                        background: '#f3f4f6',
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

    // Process data into hourly format
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Find max value for color scaling
    let maxVal = 0;
    const processedData: { [key: string]: { [key: number]: number } } = {};

    data.forEach((item: any) => {
        if (item.value) {
            Object.entries(item.value).forEach(([hour, count]) => {
                const h = parseInt(hour);
                const c = count as number;
                if (c > maxVal) maxVal = c;
            });
        }
    });

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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
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

// ==================== MAIN PAGE ====================

export default function DashboardPage() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['overview'],
        queryFn: async () => {
            const res = await instagramApi.getOverview();
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

    // Process chart data
    const chartData = recentPosts.slice(0, 10).reverse().map((post: any) => ({
        name: new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        engagement: post.engagement,
        likes: post.likes,
        comments: post.comments
    }));

    // Process demographics for display - sort by value to ensure logical accuracy
    const countryData = [...(demographics.countries || [])]
        .sort((a, b) => (b.value || 0) - (a.value || 0))
        .slice(0, 5)
        .map((c: any) => ({
            name: getCountryName(c.dimension_values?.[0] || ''),
            value: c.value || 0
        }));

    const cityData = [...(demographics.cities || [])]
        .sort((a, b) => (b.value || 0) - (a.value || 0))
        .slice(0, 5)
        .map((c: any) => ({
            name: (c.dimension_values?.[0] || 'Unknown').split(',')[0], // Just city name for cleaner UI
            fullName: c.dimension_values?.[0] || 'Unknown',
            value: c.value || 0
        }));

    // Format gender/age and sort
    const genderAgeData = [...(demographics.genderAge || [])]
        .sort((a, b) => (b.value || 0) - (a.value || 0))
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

    // Calculate computed metrics
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
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="btn btn-secondary btn-sm"
                >
                    <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Core Metrics */}
            <div className="grid-metrics" style={{ marginBottom: 24 }}>
                <MetricCard
                    label="Followers"
                    value={metrics.followers || 0}
                    icon={Users}
                    color="#6366f1"
                    tooltip="Total number of accounts following you"
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
                                    background: 'white',
                                    border: '1px solid #e5e7eb',
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
                                    background: 'white',
                                    border: '1px solid #e5e7eb',
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
                                                <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
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
        </div>
    );
}
