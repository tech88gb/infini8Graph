'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi } from '@/lib/api';
import { analyticsQueryOptions } from '@/lib/analyticsQueryOptions';
import { useAuth } from '@/lib/auth';
import { TrendingUp, TrendingDown, Users, Activity, HelpCircle, Eye, UserPlus, Target, RefreshCw } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar
} from 'recharts';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';

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
                        color: 'var(--muted)'
                    }}>
                        {timePeriod}
                    </span>
                )}
            </div>
            {children}
        </div>
    );
}

// ==================== METRIC CARD ====================

function MetricCard({ label, value, icon: Icon, color, tooltip, trend, trendLabel }: {
    label: string; value: string | number; icon: React.ElementType; color: string; tooltip?: string; trend?: number; trendLabel?: string;
}) {
    return (
        <div className="metric-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div className="metric-icon" style={{ background: `${color}15`, color, width: 36, height: 36 }}>
                    <Icon size={18} />
                </div>
                {tooltip && <InfoTooltip text={tooltip} />}
            </div>
            <div className="metric-value" style={{ fontSize: 22 }}>{value}</div>
            <div className="metric-label" style={{ fontSize: 12 }}>{label}</div>
            {trend !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                    {trend >= 0 ? (
                        <TrendingUp size={14} style={{ color: '#10b981' }} />
                    ) : (
                        <TrendingDown size={14} style={{ color: '#ef4444' }} />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 500, color: trend >= 0 ? '#10b981' : '#ef4444' }}>
                        {trend >= 0 ? '+' : ''}{trend}% {trendLabel && <span style={{ fontWeight: 400, opacity: 0.7 }}>{trendLabel}</span>}
                    </span>
                </div>
            )}

            
        </div>
    );
}

// ==================== MAIN PAGE ====================

export default function GrowthPage() {
    const { activeAccountId } = useAuth();
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 29);
    const [dateRange, setDateRange] = useState({
        startDate: defaultStart.toISOString().split('T')[0],
        endDate: defaultEnd.toISOString().split('T')[0]
    });

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['growth', activeAccountId, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            const res = await instagramApi.getGrowth(dateRange.startDate, dateRange.endDate);
            return res.data.data;
        },
        ...analyticsQueryOptions
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Loading growth data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center', maxWidth: 460 }}>
                    <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>Growth analytics failed to load</p>
                    <p className="text-muted" style={{ marginBottom: 16 }}>
                        The request did not return valid account metrics. This now shows as an error instead of fake zeroes.
                    </p>
                    <button onClick={() => refetch()} className="btn btn-primary">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const growth = data || {};
    const growthData = growth.growthData || [];
    const weeklyStats = growth.weeklyStats || {};
    const accountSummary = growth.accountSummary || {};
    const accountMetrics = growth.accountMetrics || [];
    const comparisonSummary = growth.comparisonSummary || {};
    const estimatedFollowerLift = growth.estimatedFollowerLift || {};

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 className="page-title">Growth Analytics</h1>
                    <p className="page-subtitle">Track your audience growth and engagement trends</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <DateRangeSelector dateRange={dateRange} setDateRange={setDateRange} />
                    <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary btn-sm">
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid-metrics" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                <MetricCard
                    label="Current Followers"
                    value={(growth.currentFollowers || 0).toLocaleString()}
                    icon={Users}
                    color="#6366f1"
                    tooltip="Total number of accounts following you"
                />
                <MetricCard
                    label="Posts In Selected Period"
                    value={growth.postsInRange || 0}
                    icon={Activity}
                    color="#0ea5e9"
                    tooltip="Number of posts published inside the currently selected date range"
                />
                <MetricCard
                    label="Following"
                    value={(growth.currentFollowing || 0).toLocaleString()}
                    icon={UserPlus}
                    color="#10b981"
                    tooltip="Number of accounts you follow"
                />
                <MetricCard
                    label="Total Posts"
                    value={(growth.totalPosts || 0).toLocaleString()}
                    icon={Target}
                    color="#f59e0b"
                    tooltip="Total number of posts on your account"
                />
            </div>

            {/* Week-over-Week Changes */}
            <SectionCard
                title="Weekly Performance"
                subtitle={
                    weeklyStats.periodStart && weeklyStats.periodEnd
                        ? `Comparison for ${weeklyStats.periodStart} → ${weeklyStats.periodEnd} against the previous 7-day window`
                        : 'Comparison with the previous week'
                }
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Engagement Change</span>
                            <InfoTooltip text="Week-over-week change in total engagement (likes + comments)" />
                        </div>
                        <div style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: (weeklyStats.engagementChange || 0) >= 0 ? '#10b981' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            {(weeklyStats.engagementChange || 0) >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                            {weeklyStats.engagementChange >= 0 ? '+' : ''}{weeklyStats.engagementChange || 0}%
                        </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Avg Engagement/Post</span>
                            <InfoTooltip text="Average engagement per post this week" />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>
                            {(weeklyStats.avgEngagementPerPost || 0).toLocaleString()}
                        </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Total Engagement This Week</span>
                            <InfoTooltip text="Sum of all likes and comments this week" />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>
                            {(weeklyStats.engagementThisWeek || 0).toLocaleString()}
                        </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Likes Change</span>
                            <InfoTooltip text="Week-over-week change in total likes" />
                        </div>
                        <div style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: (weeklyStats.likesChange || 0) >= 0 ? '#10b981' : '#ef4444'
                        }}>
                            {(weeklyStats.likesChange || 0) >= 0 ? '+' : ''}{weeklyStats.likesChange || 0}%
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Calculated Insights */}
            <SectionCard title="Growth Insights" subtitle="Only account-level metrics returned by Meta are shown here">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Net Follower Change</span>
                                <InfoTooltip text="Estimated follows minus unfollows across the selected date range, based on Meta's follows_and_unfollows breakdown." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: accountSummary.followerDelta >= 0 ? '#10b981' : '#ef4444' }}>
                                {accountSummary.followerDelta >= 0 ? '+' : ''}{accountSummary.followerDelta || 0}
                            </div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Profile View Rate</span>
                                <InfoTooltip text="Profile Views ÷ Reach. Useful for understanding how efficiently visibility turns into account intent." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>{comparisonSummary.profileViewRateFromReach || 0}%</div>
                        </div>
                    </div>

                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Eye size={16} style={{ color: 'var(--muted)' }} />
                            <span style={{ fontSize: 13, fontWeight: 500 }}>Account Visibility Summary</span>
                            <InfoTooltip text="These are daily account insights returned by Meta for the selected date range." />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                            <div>
                                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Total Reach</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                                    {(accountSummary.totalReach || 0).toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Total Impressions</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
                                    {(accountSummary.totalImpressions || 0).toLocaleString()}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Profile Views</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>
                                    {(accountSummary.totalProfileViews || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SectionCard>

            {growthData.some((day: any) => (day.followerCount || 0) > 0) && (
                <SectionCard title="Follower Gains Trend" subtitle="Daily followers gained returned by Meta account insights">
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={growthData}>
                            <XAxis
                                dataKey="date"
                                stroke="#9ca3af"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={(val) => new Date(val).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            />
                            <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                                labelFormatter={(val) => new Date(val).toLocaleDateString()}
                            />
                            <Line type="monotone" dataKey="followerCount" stroke="#6366f1" strokeWidth={2} dot={false} name="Followers Gained" />
                        </LineChart>
                    </ResponsiveContainer>
                </SectionCard>
            )}

            <SectionCard title="Reach vs Intent vs Publishing" subtitle="How visibility and profile intent compare with your posting output">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Avg Reach / Post</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{comparisonSummary.avgReachPerPost || 0}</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Avg Profile Views / Post</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{comparisonSummary.avgProfileViewsPerPost || 0}</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Avg Posts / Active Day</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#0ea5e9' }}>{comparisonSummary.avgPostsPerActiveDay || 0}</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Impressions / Reach</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>{comparisonSummary.impressionsPerReach || 0}</div>
                    </div>
                </div>
            </SectionCard>

            {accountMetrics.length > 0 && (
                <SectionCard title="Account Reach Trend" subtitle="Daily reach is time-series. Views and profile visits are aggregate totals for the selected range.">
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={accountMetrics}>
                            <XAxis
                                dataKey="date"
                                stroke="#9ca3af"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={(val) => new Date(val).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            />
                            <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                                labelFormatter={(val) => new Date(val).toLocaleDateString()}
                            />
                            <Line type="monotone" dataKey="reach" stroke="#10b981" strokeWidth={2} dot={false} name="Reach" />
                        </LineChart>
                    </ResponsiveContainer>
                </SectionCard>
            )}

            {/* Engagement Over Time Chart */}
            <SectionCard title="Engagement Over Time" subtitle={`Engagement trend: ${dateRange.startDate} → ${dateRange.endDate}`}>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={growthData}>
                        <defs>
                            <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            stroke="#9ca3af"
                            fontSize={11}
                            tickLine={false}
                            tickFormatter={(val) => new Date(val).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                            labelFormatter={(val) => new Date(val).toLocaleDateString()}
                        />
                        <Area
                            type="monotone"
                            dataKey="engagement"
                            stroke="#6366f1"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#growthGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Likes vs Comments Trend */}
            <SectionCard title="Likes vs Comments Trend" subtitle="How your engagement metrics compare">
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={growthData}>
                        <XAxis
                            dataKey="date"
                            stroke="#9ca3af"
                            fontSize={11}
                            tickLine={false}
                            tickFormatter={(val) => new Date(val).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                        />
                        <Line type="monotone" dataKey="likes" stroke="#ec4899" strokeWidth={2} dot={false} name="Likes" />
                        <Line type="monotone" dataKey="comments" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Comments" />
                    </LineChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 12, height: 3, borderRadius: 2, background: '#ec4899' }}></div>
                        <span className="text-muted" style={{ fontSize: 12 }}>Likes</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 12, height: 3, borderRadius: 2, background: '#0ea5e9' }}></div>
                        <span className="text-muted" style={{ fontSize: 12 }}>Comments</span>
                    </div>
                </div>
            </SectionCard>

            {/* Posting Activity */}
            {growthData.length > 0 && (
                <SectionCard title="Posting Activity" subtitle="Number of posts per day">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={growthData}>
                            <XAxis
                                dataKey="date"
                                stroke="#9ca3af"
                                fontSize={11}
                                tickLine={false}
                                tickFormatter={(val) => new Date(val).toLocaleDateString('en', { weekday: 'short' })}
                            />
                            <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                            />
                            <Bar dataKey="posts" fill="#10b981" radius={[4, 4, 0, 0]} name="Posts" />
                        </BarChart>
                    </ResponsiveContainer>
                </SectionCard>
            )}

            <SectionCard
                title="Estimated Follower Lift by Post"
                subtitle="Modelled attribution from daily follower gains in the 1-3 days after publish"
                timePeriod={estimatedFollowerLift.available ? `Est. ${estimatedFollowerLift.totalEstimatedLift || 0} followers attributed` : 'Estimated model'}
            >
                <div style={{
                    padding: '12px 14px',
                    background: 'var(--background)',
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 12,
                    color: 'var(--muted)',
                    lineHeight: 1.6
                }}>
                    {estimatedFollowerLift.methodology || 'This section estimates follower lift by combining positive daily follower gains with post-level profile activity, reach, engagement, and save signals inside a 3-day attribution window.'}
                </div>

                {estimatedFollowerLift.available ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Post</th>
                                    <th>Est. Lift</th>
                                    <th>Confidence</th>
                                    <th>Window</th>
                                    <th>Intent Signal</th>
                                    <th>Reach</th>
                                    <th>Engagement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(estimatedFollowerLift.posts || []).map((post: any) => (
                                    <tr key={post.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 8,
                                                    overflow: 'hidden',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--border)',
                                                    flexShrink: 0
                                                }}>
                                                    {post.thumbnailUrl ? (
                                                        <img src={post.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : null}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{post.mediaType || 'POST'}</div>
                                                    <div className="text-muted" style={{ fontSize: 12, maxWidth: 260 }}>
                                                        {(post.caption || 'No caption').slice(0, 70)}{(post.caption || '').length > 70 ? '...' : ''}
                                                    </div>
                                                    {!post.fullyObserved && (
                                                        <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                                                            Partial window: {post.daysObserved} of 3 days observed
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 700, color: '#10b981' }}>
                                            +{post.estimatedFollowerLift}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    width: 'fit-content',
                                                    padding: '4px 10px',
                                                    borderRadius: 999,
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    background: post.confidence === 'High'
                                                        ? 'rgba(16,185,129,0.14)'
                                                        : post.confidence === 'Medium'
                                                            ? 'rgba(245,158,11,0.14)'
                                                            : 'rgba(239,68,68,0.14)',
                                                    color: post.confidence === 'High'
                                                        ? '#10b981'
                                                        : post.confidence === 'Medium'
                                                            ? '#f59e0b'
                                                            : '#ef4444'
                                                }}>
                                                    {post.confidence}
                                                </span>
                                                <span className="text-muted" style={{ fontSize: 11 }}>{post.confidenceReason}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 12 }}>{post.attributionWindow}</div>
                                            <div className="text-muted" style={{ fontSize: 11 }}>
                                                {post.competingPosts > 0 ? `${post.competingPosts} competing posts` : 'No overlap'}
                                                {post.avgAttributionShare ? ` • ${post.avgAttributionShare}% avg share` : ''}
                                            </div>
                                        </td>
                                        <td>{(post.intentSignal || 0).toLocaleString()}</td>
                                        <td>{(post.reach || 0).toLocaleString()}</td>
                                        <td>{(post.engagement || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{
                        padding: 18,
                        borderRadius: 10,
                        background: 'var(--background)',
                        color: 'var(--muted)',
                        fontSize: 13,
                        lineHeight: 1.6
                    }}>
                        {estimatedFollowerLift.reason || 'Estimated post-level follower lift is unavailable for this account and date range.'}
                    </div>
                )}
            </SectionCard>

            {/* === Advanced Growth Metrics === */}
            <SectionCard title="Advanced Growth Metrics" subtitle="Deeper signals from follower and engagement data">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>True Follower Growth Rate</span>
                            <InfoTooltip text="(Follower delta / start followers) x 100 in the selected period." />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: (accountSummary.trueFollowerGrowthRate || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                            {(accountSummary.trueFollowerGrowthRate || 0) >= 0 ? '+' : ''}{accountSummary.trueFollowerGrowthRate ?? 0}%
                        </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Net Follower Change</span>
                            <InfoTooltip text="Gained minus lost followers in the period, from daily account snapshots." />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: (accountSummary.netFollowerChange || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                            {(accountSummary.netFollowerChange || 0) >= 0 ? '+' : ''}{accountSummary.netFollowerChange ?? 0}
                        </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Audience Quality Score</span>
                            <InfoTooltip text="(Likes + Comments + Saves) / followers. Higher = more engaged real audience." />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>
                            {accountSummary.audienceQualityScore ?? 0}
                        </div>
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
