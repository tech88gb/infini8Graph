'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi } from '@/lib/api';
import { TrendingUp, TrendingDown, Users, Activity, HelpCircle, Eye, UserPlus, Target } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b'];

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
    const { data, isLoading } = useQuery({
        queryKey: ['growth'],
        queryFn: async () => {
            const res = await instagramApi.getGrowth();
            return res.data.data;
        }
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

    const growth = data || {};
    const growthData = growth.growthData || [];
    const weeklyStats = growth.weeklyStats || {};

    // Calculate follower acquisition rate
    const followerAcquisitionRate = growth.currentFollowers && weeklyStats.engagementThisWeek
        ? ((weeklyStats.engagementThisWeek / growth.currentFollowers) * 100).toFixed(2)
        : '0';

    // Simulated reach breakdown (would come from API in real implementation)
    const reachBreakdown = [
        { name: 'Followers', value: 65 },
        { name: 'Non-Followers', value: 35 }
    ];

    // Calculate week-over-week changes
    const totalLikesThisWeek = growthData.slice(-7).reduce((sum: number, d: any) => sum + (d.likes || 0), 0);
    const totalLikesLastWeek = growthData.slice(-14, -7).reduce((sum: number, d: any) => sum + (d.likes || 0), 0);
    const likesChange = totalLikesLastWeek > 0
        ? (((totalLikesThisWeek - totalLikesLastWeek) / totalLikesLastWeek) * 100).toFixed(1)
        : '0';

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 24 }}>
                <h1 className="page-title">Growth Analytics</h1>
                <p className="page-subtitle">Track your audience growth and engagement trends</p>
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
                    label="Posts This Week"
                    value={weeklyStats.postsThisWeek || 0}
                    icon={Activity}
                    color="#0ea5e9"
                    tooltip="Number of posts published in the last 7 days"
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
            <SectionCard title="Weekly Performance" subtitle="Comparison with the previous week">
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
                            color: parseFloat(likesChange) >= 0 ? '#10b981' : '#ef4444'
                        }}>
                            {parseFloat(likesChange) >= 0 ? '+' : ''}{likesChange}%
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Calculated Insights */}
            <SectionCard title="Growth Insights" subtitle="Advanced metrics for understanding your growth">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Follower Engagement Rate</span>
                                <InfoTooltip text="(Weekly Engagement ÷ Followers) × 100. Shows how engaged your followers are with your content." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{followerAcquisitionRate}%</div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Post Frequency</span>
                                <InfoTooltip text="Average number of posts per week" />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700 }}>{weeklyStats.postsThisWeek || 0}/week</div>
                        </div>
                    </div>

                    {/* Reach Breakdown Pie Chart */}
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Eye size={16} style={{ color: 'var(--muted)' }} />
                            <span style={{ fontSize: 13, fontWeight: 500 }}>Reach Breakdown</span>
                            <InfoTooltip text="Percentage of reach from followers vs non-followers. High non-follower reach indicates content discovery." />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <ResponsiveContainer width={100} height={100}>
                                <PieChart>
                                    <Pie
                                        data={reachBreakdown}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={25}
                                        outerRadius={45}
                                    >
                                        {reachBreakdown.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div>
                                {reachBreakdown.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i] }} />
                                        <span style={{ fontSize: 12 }}>{item.name}: {item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Engagement Over Time Chart */}
            <SectionCard title="Engagement Over Time" subtitle="Daily engagement trend for the last 30 days">
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={growthData.slice(-30)}>
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
                    <LineChart data={growthData.slice(-30)}>
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
                        <BarChart data={growthData.slice(-14)}>
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
        </div>
    );
}
