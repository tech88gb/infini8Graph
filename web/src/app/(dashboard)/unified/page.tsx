'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { instagramApi } from '@/lib/api';
import {
    Users, Heart, Eye, Bookmark, Image, RefreshCw, Instagram,
    Globe, HelpCircle, Clock, LayoutDashboard, BarChart3, TrendingUp
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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

// ==================== METRIC CARD ====================

function MetricCard({ label, value, icon: Icon, color, tooltip }: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    tooltip?: string;
}) {
    return (
        <div className="metric-card" style={{ padding: 20, background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012)), rgba(16,17,26,0.94)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="metric-icon" style={{ background: `${color}15`, color, width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} />
                </div>
                {tooltip && <InfoTooltip text={tooltip} />}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
        </div>
    );
}

// ==================== SECTION CARD ====================

function SectionCard({ title, subtitle, children }: {
    title: string; subtitle?: string; children: React.ReactNode
}) {
    return (
        <div className="card" style={{ marginBottom: 20, padding: 24, background: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012)), rgba(16,17,26,0.94)' }}>
            <div className="card-header" style={{ marginBottom: 20, borderBottom: 'none', padding: 0 }}>
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h3>
                    {subtitle && <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

// ==================== POST ROW ====================

function PostRow({ post }: { post: any }) {
    return (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ padding: '16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: 'var(--background-alt)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border)'
                    }}>
                        {post.thumbnailUrl ? (
                            <img src={post.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Image size={18} style={{ color: 'var(--muted)' }} />
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{post.type}</div>
                        <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>
                            @{post.accountUsername}
                        </div>
                    </div>
                </div>
            </td>
            <td style={{ padding: '16px 0', fontSize: 13, color: 'var(--muted)' }}>
                {new Date(post.timestamp).toLocaleDateString()}
            </td>
            <td style={{ padding: '16px 0', fontWeight: 600, fontSize: 14 }}>{post.likes?.toLocaleString() || 0}</td>
            <td style={{ padding: '16px 0', fontWeight: 600, fontSize: 14 }}>{post.comments?.toLocaleString() || 0}</td>
            <td style={{ padding: '16px 0', fontWeight: 600, fontSize: 14, color: 'var(--primary)' }}>
                {post.engagement?.toLocaleString() || 0}
            </td>
        </tr>
    );
}

// ==================== MAIN PAGE ====================

export default function UnifiedDashboardPage() {
    const { switchAccount, activeAccountId } = useAuth();
    const router = useRouter();
    const [switchingId, setSwitchingId] = useState<string | null>(null);

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['unified-overview'],
        queryFn: async () => {
            const res = await instagramApi.getUnifiedOverview();
            return res.data.data;
        }
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted" style={{ fontWeight: 500 }}>Aggregating account data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center', maxWidth: 400 }}>
                    <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Failed to load unified data</p>
                    <p className="text-muted" style={{ marginBottom: 24 }}>We couldn't aggregate your account analytics. Please try again.</p>
                    <button onClick={() => refetch()} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                        <RefreshCw size={16} /> Try Again
                    </button>
                </div>
            </div>
        );
    }

    const metrics = data?.metrics || {};
    const accounts = data?.accounts || [];
    const recentPosts = data?.recentPosts || [];

    // Process chart data (Top 10 posts by engagement across all accounts)
    const chartData = [...recentPosts]
        .slice(0, 10)
        .reverse()
        .map((post: any) => ({
            name: new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            engagement: post.engagement,
            account: post.accountUsername
        }));

    return (
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 20px 40px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, marginTop: 10 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>Unified Dashboard</h1>
                        <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                            <Globe size={14} />
                            {accounts.length} Accounts
                        </span>
                    </div>
                    <p className="text-muted" style={{ fontSize: 15 }}>Aggregated performance across all linked Instagram profiles</p>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="btn btn-secondary"
                    style={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}
                >
                    <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
                    Refresh All
                </button>
            </div>

            {/* Unified Metrics Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
                <MetricCard
                    label="Total Followers"
                    value={metrics.totalFollowers || 0}
                    icon={Users}
                    color="#6366f1"
                    tooltip="Combined follower count across all linked accounts"
                />
                <MetricCard
                    label="Avg. Engagement"
                    value={`${metrics.avgEngagementRate || 0}%`}
                    icon={Heart}
                    color="#ec4899"
                    tooltip="Average engagement rate across all active accounts"
                />
                <MetricCard
                    label="Total Impressions"
                    value={metrics.totalImpressions || 0}
                    icon={Eye}
                    color="#0ea5e9"
                    tooltip="Combined impressions for all accounts in the last 30 days"
                />
                <MetricCard
                    label="Total Reach"
                    value={metrics.totalReach || 0}
                    icon={TrendingUp}
                    color="#10b981"
                    tooltip="Combined unique reach across all accounts"
                />
                <MetricCard
                    label="Total Saved"
                    value={metrics.totalSaved || 0}
                    icon={Bookmark}
                    color="#f59e0b"
                    tooltip="Total post saves across all accounts"
                />
                <MetricCard
                    label="Total Posts"
                    value={metrics.totalPosts || 0}
                    icon={Image}
                    color="#8b5cf6"
                    tooltip="Total number of posts published across all profiles"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 32 }}>
                {/* Global Engagement Trend */}
                <SectionCard
                    title="Global Engagement Trend"
                    subtitle="Performance flow of recent posts across all accounts"
                >
                    <div style={{ height: 300, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={40} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--card-raised)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 12,
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                        fontSize: 13,
                                        padding: '12px'
                                    }}
                                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area type="monotone" dataKey="engagement" stroke="#6366f1" strokeWidth={3} fill="url(#engGrad)" animationDuration={1500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>

                {/* Account Breakdown */}
                <SectionCard
                    title="Account Performance"
                    subtitle="Follower distribution by profile"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {accounts.map((account: any, i: number) => {
                            const percentage = metrics.totalFollowers > 0
                                ? ((account.metrics.followers / metrics.totalFollowers) * 100).toFixed(1)
                                : '0';

                            const isCurrent = account.id === activeAccountId;

                            return (
                                <div
                                    key={account.id}
                                    onClick={async () => {
                                        if (isCurrent || switchingId) return;
                                        setSwitchingId(account.id);
                                        const success = await switchAccount(account.id);
                                        if (success) router.push('/dashboard');
                                        setSwitchingId(null);
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 6,
                                        cursor: isCurrent ? 'default' : 'pointer',
                                        padding: '10px',
                                        borderRadius: '12px',
                                        transition: 'background 0.2s',
                                        background: isCurrent ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                        border: isCurrent ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid transparent',
                                        opacity: switchingId === account.id ? 0.6 : 1
                                    }}
                                    onMouseOver={(e) => {
                                        if (!isCurrent) e.currentTarget.style.background = 'var(--background-alt)';
                                    }}
                                    onMouseOut={(e) => {
                                        if (!isCurrent) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>@{account.username}</span>
                                            {isCurrent && <span style={{ fontSize: 10, background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>Active</span>}
                                        </div>
                                        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{account.metrics.followers.toLocaleString()}</span>
                                    </div>
                                    <div style={{ height: 8, background: 'var(--background-alt)', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${percentage}%`,
                                        background: i === 0 ? 'var(--primary)' : 'rgba(129, 140, 248, 0.75)',
                                        borderRadius: 4
                                    }} />
                                    </div>
                                    {!isCurrent && (
                                        <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 4, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                            {switchingId === account.id ? 'Switching...' : 'Switch to Account →'}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            </div>

            {/* Recent Posts Table */}
            <SectionCard title="Cross-Account Feed" subtitle="Latest content from all your linked profiles">
                {recentPosts.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0 0 12px 0', fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Post Details</th>
                                    <th style={{ padding: '0 0 12px 0', fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                                    <th style={{ padding: '0 0 12px 0', fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Likes</th>
                                    <th style={{ padding: '0 0 12px 0', fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comments</th>
                                    <th style={{ padding: '0 0 12px 0', fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engagement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentPosts.slice(0, 10).map((post: any, i: number) => (
                                    <PostRow key={`${post.accountUsername}-${post.id || i}`} post={post} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <p className="text-muted">No posts found across your accounts.</p>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
