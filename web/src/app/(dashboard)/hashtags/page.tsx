'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi } from '@/lib/api';
import { analyticsQueryOptions } from '@/lib/analyticsQueryOptions';
import { useAuth } from '@/lib/auth';
import { Hash, Heart, BarChart3, HelpCircle, Star, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

function SectionCard({ title, subtitle, children, badge }: {
    title: string; subtitle?: string; children: React.ReactNode; badge?: string;
}) {
    return (
        <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ marginBottom: 16 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h3>
                        {badge && <span className="badge badge-info">{badge}</span>}
                    </div>
                    {subtitle && <p className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

// ==================== METRIC CARD ====================

function MetricCard({ label, value, icon: Icon, color, tooltip }: {
    label: string; value: string | number; icon: React.ElementType; color: string; tooltip?: string;
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
        </div>
    );
}

// ==================== HASHTAG TAG ====================

function HashtagTag({ tag, engagement, color = 'primary' }: { tag: string; engagement: number; color?: string }) {
    const bgColor = color === 'primary' ? 'var(--primary)' : color === 'success' ? '#10b981' : '#0ea5e9';
    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 20,
            background: `${bgColor}15`,
            border: `1px solid ${bgColor}30`,
            fontSize: 13
        }}>
            <span style={{ color: bgColor, fontWeight: 500 }}>{tag}</span>
            <span className="text-muted" style={{ fontSize: 11 }}>{engagement}</span>
        </div>
    );
}

// ==================== MAIN PAGE ====================

export default function HashtagsPage() {
    const { activeAccountId } = useAuth();
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    const [dateRange, setDateRange] = useState({
        startDate: defaultStart.toISOString().split('T')[0],
        endDate: defaultEnd.toISOString().split('T')[0]
    });
    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['hashtags', activeAccountId, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            const res = await instagramApi.getHashtags(dateRange.startDate, dateRange.endDate);
            return res.data.data;
        },
        ...analyticsQueryOptions
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Analyzing your hashtags...</p>
                </div>
            </div>
        );
    }

    const topPerforming = data?.topPerforming || [];
    const mostUsed = data?.mostUsed || [];
    const consistencyLeaders = data?.consistencyLeaders || [];
    const fatigueSignals = data?.fatigueSignals || [];
    const reachExpanders = data?.reachExpanders || [];

    const chartData = topPerforming.slice(0, 10).map((h: any) => ({
        name: h.tag.replace('#', ''),
        engagement: h.avgEngagement,
        uses: h.usageCount
    }));

    // Find underperforming hashtags (high usage, low engagement)
    const avgEngagement = topPerforming.reduce((sum: number, h: any) => sum + h.avgEngagement, 0) / topPerforming.length || 0;
    const underperforming = fatigueSignals.length > 0
        ? fatigueSignals.slice(0, 5)
        : mostUsed.filter((h: any) => h.avgEngagement < avgEngagement * 0.5).slice(0, 5);

    // Calculate hashtag efficiency score
    const efficiencyScore = topPerforming.length > 0
        ? ((topPerforming[0]?.avgEngagement || 0) / (avgEngagement || 1) * 100).toFixed(0)
        : '0';

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 className="page-title">Hashtag Analytics</h1>
                    <p className="page-subtitle">Weighted hashtag attribution based on real post performance</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <DateRangeSelector dateRange={dateRange} setDateRange={setDateRange} />
                    <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary btn-sm">
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid-metrics" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                <MetricCard
                    label="Unique Hashtags"
                    value={data?.totalHashtagsUsed || 0}
                    icon={Hash}
                    color="#6366f1"
                    tooltip="Total number of different hashtags you've used"
                />
                <MetricCard
                    label="Avg per Post"
                    value={data?.avgHashtagsPerPost || 0}
                    icon={BarChart3}
                    color="#0ea5e9"
                    tooltip="Average number of hashtags used per post"
                />
                <MetricCard
                    label="Best Performer"
                    value={topPerforming[0]?.avgEngagement?.toLocaleString() || 0}
                    icon={Star}
                    color="#f59e0b"
                    tooltip="Highest weighted average engagement attributed to a hashtag across the posts where it appeared"
                />
                <MetricCard
                    label="Posts Analyzed"
                    value={data?.postsAnalyzed || 0}
                    icon={Heart}
                    color="#ec4899"
                    tooltip="Number of posts included in this analysis"
                />
            </div>

            {/* Calculated Insights */}
            <SectionCard title="Hashtag Insights" subtitle="Insights derived from weighted attribution across the posts using each hashtag">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Top Hashtag Performance</span>
                            <InfoTooltip text="How much better your strongest weighted hashtag performs compared to your hashtag average" />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{efficiencyScore}%</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>above average</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Average Attributed Engagement</span>
                            <InfoTooltip text="Average weighted engagement attributed to each hashtag based on the posts where it appeared" />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(avgEngagement).toLocaleString()}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>weighted per hashtag</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Top Engagement Lift</span>
                            <InfoTooltip text="Best positive lift versus your overall post engagement baseline, based on weighted hashtag attribution" />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{topPerforming[0]?.engagementLift || 0}%</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>vs post baseline</div>
                    </div>
                </div>
            </SectionCard>

            <SectionCard title="Reach & Consistency Signals" subtitle="Useful hashtag signals beyond raw attributed engagement">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Best Reach Lift</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#0ea5e9' }}>{reachExpanders[0]?.reachLift || 0}%</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>vs account reach baseline</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Best Consistency</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{consistencyLeaders[0]?.consistencyScore || 0}%</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>posts above baseline</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Fatigue Flags</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: fatigueSignals.length > 0 ? '#ef4444' : '#10b981' }}>{fatigueSignals.length}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>hashtags with declining returns</div>
                    </div>
                </div>
            </SectionCard>

            {/* Top Performing Hashtags Cloud */}
            <SectionCard title="Top Performing Hashtags" subtitle="Weighted average engagement attributed to each hashtag">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {topPerforming.slice(0, 15).map((h: any, i: number) => (
                        <HashtagTag
                            key={h.tag}
                            tag={h.tag}
                            engagement={h.avgEngagement}
                            color={i < 3 ? 'success' : i < 7 ? 'primary' : 'secondary'}
                        />
                    ))}
                </div>
            </SectionCard>

            {/* Chart */}
            <SectionCard title="Top 10 Hashtags by Attributed Engagement" subtitle="Horizontal comparison using weighted attribution across posts">
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData} layout="vertical">
                        <XAxis type="number" stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke="#9ca3af"
                            fontSize={11}
                            width={100}
                            tickFormatter={(val) => `#${val}`}
                        />
                        <Tooltip
                            contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                        />
                        <Bar dataKey="engagement" fill="#6366f1" radius={[0, 4, 4, 0]} name="Attributed Engagement" />
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Underperforming Hashtags */}
            {underperforming.length > 0 && (
                <SectionCard
                    title="Consider Replacing"
                    subtitle="Hashtags showing weak weighted engagement or clear diminishing returns"
                >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {underperforming.map((h: any) => (
                            <div
                                key={h.tag}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca'
                                }}
                            >
                                <span style={{ color: '#991b1b', fontWeight: 500 }}>{h.tag}</span>
                                <span style={{ fontSize: 11, color: '#b91c1c' }}>
                                    {h.usageCount} uses · {h.avgEngagement} avg · {h.diminishingReturn || 0}% trend
                                </span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <SectionCard title="Top Performing" subtitle="Ranked by weighted average engagement" badge={`${topPerforming.length}`}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Hashtag</th>
                                    <th>Uses</th>
                                    <th>Avg Engagement</th>
                                    <th>Lift</th>
                                    <th>Reach Lift</th>
                                    <th>Consistency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topPerforming.slice(0, 10).map((h: any, i: number) => (
                                    <tr key={h.tag}>
                                        <td>
                                            <div style={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: '50%',
                                                background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--background)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: i < 3 ? 'white' : 'var(--foreground)'
                                            }}>
                                                {i + 1}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{h.tag}</td>
                                        <td>{h.usageCount}</td>
                                        <td style={{ fontWeight: 600 }}>{h.avgEngagement.toLocaleString()}</td>
                                        <td style={{ color: (h.engagementLift || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                            {(h.engagementLift || 0) >= 0 ? '+' : ''}{h.engagementLift || 0}%
                                        </td>
                                        <td style={{ color: (h.reachLift || 0) >= 0 ? '#0ea5e9' : '#ef4444', fontWeight: 600 }}>
                                            {(h.reachLift || 0) >= 0 ? '+' : ''}{h.reachLift || 0}%
                                        </td>
                                        <td>{h.consistencyScore || 0}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>

                <SectionCard title="Most Used" subtitle="Ranked by frequency of use" badge={`${mostUsed.length}`}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Hashtag</th>
                                    <th>Uses</th>
                                    <th>Avg Engagement</th>
                                    <th>Diminishing Return</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mostUsed.slice(0, 10).map((h: any, i: number) => (
                                    <tr key={h.tag}>
                                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{i + 1}</td>
                                        <td style={{ fontWeight: 500, color: '#0ea5e9' }}>{h.tag}</td>
                                        <td style={{ fontWeight: 600 }}>{h.usageCount}</td>
                                        <td>{h.avgEngagement.toLocaleString()}</td>
                                        <td style={{ color: (h.diminishingReturn || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                            {(h.diminishingReturn || 0) >= 0 ? '+' : ''}{h.diminishingReturn || 0}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}
