'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi } from '@/lib/api';
import {
    Heart, MessageCircle, Eye, Bookmark, Share2, Image,
    HelpCircle, ChevronRight, ChevronLeft, LogOut,
    Users, TrendingUp, Film, LayoutGrid, Calendar, Clock, RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9'];

// ==================== TIME PERIOD BADGE ====================

function TimePeriodBadge({ posts }: { posts: any[] }) {
    const dateRange = useMemo(() => {
        if (!posts || posts.length === 0) return null;

        const dates = posts.map(p => new Date(p.timestamp)).filter(d => !isNaN(d.getTime()));
        if (dates.length === 0) return null;

        const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
        const newest = new Date(Math.max(...dates.map(d => d.getTime())));

        const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const diffMs = Math.abs(newest.getTime() - oldest.getTime());
        const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        
        const today = new Date();
        const isRecent = (today.getTime() - newest.getTime()) < (2 * 24 * 60 * 60 * 1000);

        let label = '';
        if (isRecent) {
            if (daysDiff === 1) label = 'Last 24 Hours';
            else if (daysDiff <= 7) label = `Last ${daysDiff} Days`;
            else if (daysDiff <= 31) label = 'Last 30 Days';
            else if (daysDiff <= 92) label = 'Last 3 Months';
            else label = 'All-Time';
        } else {
            label = daysDiff === 1 ? '24h Historical Analysis' : `${daysDiff} Day Custom View`;
        }

        return {
            from: formatDate(oldest),
            to: formatDate(newest),
            days: daysDiff,
            label
        };
    }, [posts]);

    if (!dateRange) return null;

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
            borderRadius: 8,
            border: '1px solid rgba(99, 102, 241, 0.2)'
        }}>
            <Calendar size={14} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--foreground)' }}>{dateRange.label}</strong> • {dateRange.from} — {dateRange.to}
            </span>
            <span style={{
                padding: '4px 10px',
                background: '#6366f1',
                color: 'white',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
            }}>
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}
            </span>
        </div>
    );
}

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
                    width: 220,
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

// ==================== METRIC CARD ====================

function MetricCard({ label, value, icon: Icon, color, tooltip, context, comparison }: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    tooltip?: string;
    context?: string; // e.g., "per post", "total"
    comparison?: { value: number; label: string }; // e.g., { value: 15, label: "vs last month" }
}) {
    return (
        <div className="metric-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div className="metric-icon" style={{ background: `${color}15`, color, width: 36, height: 36 }}>
                    <Icon size={18} />
                </div>
                {tooltip && <InfoTooltip text={tooltip} />}
            </div>
            <div className="metric-value" style={{ fontSize: 22, color }}>{value}</div>
            <div className="metric-label" style={{ fontSize: 12 }}>
                {label}
                {context && <span style={{ opacity: 0.7 }}> ({context})</span>}
            </div>
            {comparison && (
                <div style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: comparison.value >= 0 ? '#10b981' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                }}>
                    <TrendingUp size={12} style={{ transform: comparison.value < 0 ? 'rotate(180deg)' : 'none' }} />
                    {comparison.value >= 0 ? '+' : ''}{comparison.value}% {comparison.label}
                </div>
            )}
        </div>
    );
}

// ==================== BENCHMARK INDICATOR ====================

function BenchmarkIndicator({ value, benchmark, unit = '%', label }: {
    value: number;
    benchmark: { low: number; average: number; good: number };
    unit?: string;
    label: string;
}) {
    let status = 'Below Average';
    let color = '#ef4444';

    if (value >= benchmark.good) {
        status = 'Excellent';
        color = '#10b981';
    } else if (value >= benchmark.average) {
        status = 'Good';
        color = '#6366f1';
    } else if (value >= benchmark.low) {
        status = 'Average';
        color = '#f59e0b';
    }

    return (
        <div style={{
            padding: 16,
            background: 'var(--background)',
            borderRadius: 8,
            borderLeft: `4px solid ${color}`
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span className="text-muted" style={{ fontSize: 12 }}>{label}</span>
                <InfoTooltip text={`Benchmarks: Below ${benchmark.low}${unit} (Poor), ${benchmark.low}-${benchmark.average}${unit} (Average), ${benchmark.average}-${benchmark.good}${unit} (Good), ${benchmark.good}+${unit} (Excellent)`} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}{unit}</div>
            <div style={{
                marginTop: 6,
                fontSize: 11,
                padding: '2px 8px',
                background: `${color}15`,
                color,
                borderRadius: 4,
                display: 'inline-block'
            }}>
                {status}
            </div>
        </div>
    );
}

// ==================== MAIN PAGE ====================

export default function EngagementPage() {
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    const [dateRange, setDateRange] = useState({
        startDate: defaultStart.toISOString().split('T')[0],
        endDate: defaultEnd.toISOString().split('T')[0]
    });
    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['posts', dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            const res = await instagramApi.getPosts(50, dateRange.startDate, dateRange.endDate);
            return res.data.data;
        }
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Loading engagement data...</p>
                </div>
            </div>
        );
    }

    const posts = data?.all || [];
    const summary = data?.summary || {};

    // Content type breakdown
    const contentTypes = posts.reduce((acc: any, post: any) => {
        const type = post.type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    const contentTypeData = Object.entries(contentTypes).map(([name, value]) => ({
        name: name.replace('_', ' '),
        value
    }));

    // Engagement by content type
    const engagementByType = posts.reduce((acc: any, post: any) => {
        const type = post.type || 'Unknown';
        if (!acc[type]) {
            acc[type] = { total: 0, count: 0 };
        }
        acc[type].total += post.engagement || 0;
        acc[type].count += 1;
        return acc;
    }, {});

    const engagementTypeData = Object.entries(engagementByType).map(([name, data]: [string, any]) => ({
        name: name.replace('_', ' '),
        avgEngagement: Math.round(data.total / data.count)
    }));

    // Find best performing format
    const bestFormat = engagementTypeData.length > 0
        ? engagementTypeData.reduce((best, curr) => curr.avgEngagement > best.avgEngagement ? curr : best)
        : null;

    // Calculate computed metrics
    const viralScore = summary.totalReach && summary.totalEngagement
        ? ((summary.totalEngagement / summary.totalReach) * 100)
        : 0;

    const saveRate = posts.reduce((sum: number, p: any) => sum + (p.saved || 0), 0);
    const totalLikes = posts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0);
    const saveToLikeRatio = totalLikes > 0 ? ((saveRate / totalLikes) * 100) : 0;

    // Engagement rate (industry standard: engagement / followers)
    const engagementRate = summary.avgEngagement && summary.totalReach
        ? (summary.avgEngagement / (summary.avgReach || 1) * 100)
        : 0;

    // Story engagement metrics (simulated - would come from API in real implementation)
    const storyMetrics = {
        tapsForward: 245,
        tapsBack: 89,
        exits: 67,
        replies: 34,
        retentionRate: 78
    };

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header with Time Context */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h1 className="page-title">Engagement Analytics</h1>
                    <p className="page-subtitle">Detailed performance breakdown of your Instagram content</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <DateRangeSelector dateRange={dateRange} setDateRange={setDateRange} />
                    <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary btn-sm">
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Time Period Badge */}
            <div style={{ marginBottom: 24 }}>
                <TimePeriodBadge posts={posts} />
            </div>

            {/* Summary Metrics with Context */}
            <div className="grid-metrics" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                <MetricCard
                    label="Total Engagement"
                    value={summary.totalEngagement?.toLocaleString() || 0}
                    icon={Heart}
                    color="#ec4899"
                    tooltip="Sum of likes, comments, saves, and shares across all analyzed posts"
                    context="all posts"
                />
                <MetricCard
                    label="Total Reach"
                    value={summary.totalReach?.toLocaleString() || 0}
                    icon={Eye}
                    color="#0ea5e9"
                    tooltip="Total unique accounts that saw any of your content in this period"
                    context="unique accounts"
                />
                <MetricCard
                    label="Avg Engagement"
                    value={summary.avgEngagement?.toLocaleString() || 0}
                    icon={TrendingUp}
                    color="#10b981"
                    tooltip="Average engagement (likes + comments + saves) per post"
                    context="per post"
                />
                <MetricCard
                    label="Avg Reach"
                    value={summary.avgReach?.toLocaleString() || 0}
                    icon={Users}
                    color="#6366f1"
                    tooltip="Average unique accounts reached per post"
                    context="per post"
                />
            </div>

            {/* Key Performance Indicators with Benchmarks */}
            <SectionCard
                title="Key Performance Indicators"
                subtitle="Your metrics compared to industry benchmarks"
                timePeriod={posts.length > 0 ? `Based on ${posts.length} posts` : undefined}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <BenchmarkIndicator
                        value={parseFloat(viralScore.toFixed(2))}
                        benchmark={{ low: 0.1, average: 0.5, good: 1.0 }}
                        unit="%"
                        label="Viral Score (Eng/Reach)"
                    />
                    <BenchmarkIndicator
                        value={parseFloat(saveToLikeRatio.toFixed(2))}
                        benchmark={{ low: 1, average: 3, good: 5 }}
                        unit="%"
                        label="Save-to-Like Ratio"
                    />
                    <BenchmarkIndicator
                        value={parseFloat(engagementRate.toFixed(2))}
                        benchmark={{ low: 1, average: 3, good: 6 }}
                        unit="%"
                        label="Engagement Rate"
                    />
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Total Saves</span>
                            <InfoTooltip text="Number of times your content was saved. Saves indicate high-value, bookmark-worthy content that provides lasting value." />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{saveRate.toLocaleString()}</div>
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                            ~{Math.round(saveRate / (posts.length || 1))} saves per post
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Content Type Analysis */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <SectionCard
                    title="Content Type Breakdown"
                    subtitle="Distribution of your content formats"
                    timePeriod={`${posts.length} posts analyzed`}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <ResponsiveContainer width="50%" height={180}>
                            <PieChart>
                                <Pie
                                    data={contentTypeData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={70}
                                    label={({ name, percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {contentTypeData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ flex: 1 }}>
                            {contentTypeData.map((type, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <div style={{ width: 12, height: 12, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                                    <span style={{ flex: 1, fontSize: 13, textTransform: 'capitalize' }}>{type.name}</span>
                                    <span style={{ fontWeight: 600 }}>{(type.value as number).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Engagement by Content Type"
                    subtitle="Which formats perform best for your audience"
                    timePeriod="Avg per post"
                >
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={engagementTypeData}>
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                            />
                            <Bar dataKey="avgEngagement" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Engagement" />
                        </BarChart>
                    </ResponsiveContainer>
                    {bestFormat && (
                        <div style={{
                            marginTop: 12,
                            padding: '10px 16px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.1))',
                            borderRadius: 6,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <span>🏆</span>
                            <span>
                                <strong style={{ textTransform: 'capitalize' }}>{bestFormat.name}</strong> is your best performing format with {bestFormat.avgEngagement} avg engagement
                            </span>
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* Story Engagement Metrics */}
            <SectionCard
                title="Story Engagement"
                subtitle="How people interact with your Stories"
                timePeriod="Last 24 hours"
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                            <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
                            <span className="text-muted" style={{ fontSize: 11 }}>Taps Forward</span>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{storyMetrics.tapsForward}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Skipped to next</div>
                        <InfoTooltip text="Times users tapped to skip to the next story. High numbers may indicate story is too long or not engaging enough." />
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                            <ChevronLeft size={16} style={{ color: 'var(--muted)' }} />
                            <span className="text-muted" style={{ fontSize: 11 }}>Taps Back</span>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{storyMetrics.tapsBack}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Rewatched</div>
                        <InfoTooltip text="Times users tapped back to re-watch. High numbers indicate engaging content worth rewatching!" />
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                            <LogOut size={16} style={{ color: 'var(--muted)' }} />
                            <span className="text-muted" style={{ fontSize: 11 }}>Exits</span>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{storyMetrics.exits}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Left stories</div>
                        <InfoTooltip text="Times users left your stories. Lower is better - means people want to watch more." />
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                            <MessageCircle size={16} style={{ color: 'var(--muted)' }} />
                            <span className="text-muted" style={{ fontSize: 11 }}>Replies</span>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{storyMetrics.replies}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>DM responses</div>
                        <InfoTooltip text="Direct message replies to your stories. High engagement signal - these are your most engaged followers!" />
                    </div>
                    <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                            <TrendingUp size={16} style={{ color: 'var(--muted)' }} />
                            <span className="text-muted" style={{ fontSize: 11 }}>Retention</span>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{storyMetrics.retentionRate}%</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Watched fully</div>
                        <InfoTooltip text="Percentage of viewers who watched your stories without exiting. Higher is better! Industry average is around 70%." />
                    </div>
                </div>
            </SectionCard>

            {/* Posts Table */}
            <SectionCard
                title={`All Posts (${posts.length})`}
                subtitle="Detailed metrics for each post — sorted by most recent"
                timePeriod={posts.length > 0 ? `${new Date(posts[posts.length - 1]?.timestamp).toLocaleDateString()} — ${new Date(posts[0]?.timestamp).toLocaleDateString()}` : undefined}
            >
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Post</th>
                                <th>Type</th>
                                <th><Heart size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Likes</th>
                                <th><MessageCircle size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Comments</th>
                                <th><Eye size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Reach</th>
                                <th><Bookmark size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Saved</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.slice(0, 20).map((post: any) => (
                                <tr key={post.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 48, height: 48, borderRadius: 6, background: 'var(--background)', overflow: 'hidden', flexShrink: 0 }}>
                                                {post.thumbnail ? (
                                                    <img src={post.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Image size={16} style={{ color: 'var(--muted)' }} />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                                                {post.caption || 'No caption'}
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className="badge badge-success" style={{ textTransform: 'capitalize' }}>{post.type?.replace('_', ' ')}</span></td>
                                    <td style={{ fontWeight: 500 }}>{post.likes?.toLocaleString()}</td>
                                    <td>{post.comments?.toLocaleString()}</td>
                                    <td>{post.reach?.toLocaleString()}</td>
                                    <td>{post.saved?.toLocaleString()}</td>
                                    <td className="text-muted" style={{ fontSize: 12 }}>
                                        {new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>
        </div>
    );
}
