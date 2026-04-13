'use client';

import { useQuery } from '@tanstack/react-query';
import { instagramApi } from '@/lib/api';
import { analyticsQueryOptions } from '@/lib/analyticsQueryOptions';
import { useAuth } from '@/lib/auth';
import {
    Zap, TrendingUp, Bookmark, Clock, Award, ExternalLink,
    Image, Video, LayoutGrid, Film, HelpCircle, Heart, MessageCircle, Eye, RefreshCw
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useState } from 'react';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];
const FORMAT_COLORS: Record<string, string> = {
    'IMAGE': '#6366f1',
    'VIDEO': '#ec4899',
    'CAROUSEL_ALBUM': '#10b981',
    'REEL': '#f59e0b'
};
const FORMAT_ICONS: Record<string, React.ElementType> = {
    'IMAGE': Image,
    'VIDEO': Video,
    'CAROUSEL_ALBUM': LayoutGrid,
    'REEL': Film
};

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

function SectionCard({ title, subtitle, insight, timePeriod, children }: {
    title: string; subtitle?: string; insight?: string; timePeriod?: string; children: React.ReactNode
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
            {insight && (
                <div style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(236, 72, 153, 0.1))',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <Zap size={16} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{insight}</span>
                </div>
            )}
        </div>
    );
}


function ScoreGauge({ score, label, maxScore = 100 }: { score: number; label: string; maxScore?: number }) {
    const percentage = Math.min((score / maxScore) * 100, 100);
    const getColor = () => {
        if (percentage >= 70) return '#10b981';
        if (percentage >= 40) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10" />
                    <circle
                        cx="60" cy="60" r="50"
                        fill="none"
                        stroke={getColor()}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${percentage * 3.14} 314`}
                        transform="rotate(-90 60 60)"
                    />
                </svg>
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: getColor()
                }}>
                    {score}
                </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{label}</p>
        </div>
    );
}

// New component: Post Card with full details
function TopPostCard({ post, rank }: { post: any; rank: number }) {
    const Icon = FORMAT_ICONS[post.type] || Image;
    const color = FORMAT_COLORS[post.type] || '#6366f1';

    return (
        <div style={{
            background: 'var(--background)',
            borderRadius: 12,
            overflow: 'hidden',
            border: rank === 1 ? '2px solid #f59e0b' : '1px solid var(--border)'
        }}>
            {/* Thumbnail */}
            <div style={{ position: 'relative', aspectRatio: '1', background: '#f1f5f9', overflow: 'hidden' }}>
                {post.thumbnail ? (
                    <img
                        src={post.thumbnail}
                        alt="Post thumbnail"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8'
                    }}>
                        <Icon size={40} />
                    </div>
                )}
                {/* Rank Badge */}
                <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : rank === 3 ? '#cd7f32' : '#6366f1',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                    {rank}
                </div>
                {/* Score Badge */}
                <div style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.75)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 700
                }}>
                    {post.qualityScore} pts
                </div>
                {/* Type Badge */}
                <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: color,
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600
                }}>
                    {post.type}
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: 12 }}>
                {/* Caption Preview */}
                <p style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginBottom: 12,
                    height: 36,
                    overflow: 'hidden',
                    lineHeight: 1.5
                }}>
                    {post.caption || 'No caption'}
                </p>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Heart size={12} style={{ color: '#ec4899' }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{post.likes || 0}</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Likes</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <MessageCircle size={12} style={{ color: '#0ea5e9' }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{post.comments || 0}</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Comments</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Bookmark size={12} style={{ color: '#10b981' }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{post.saved || 0}</span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Saves</span>
                    </div>
                </div>

                {/* Why it performed well */}
                {post.topFactors && post.topFactors.length > 0 && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.1))',
                        borderRadius: 6,
                        padding: '8px 10px',
                        marginBottom: 10
                    }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>WHY IT WORKED</div>
                        <div style={{ fontSize: 11, fontWeight: 500 }}>
                            {post.topFactors.join(' • ')}
                        </div>
                    </div>
                )}

                {/* View Link */}
                {post.permalink && (
                    <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '8px',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            textDecoration: 'none'
                        }}
                    >
                        <ExternalLink size={12} />
                        View on Instagram
                    </a>
                )}
            </div>
        </div>
    );
}

export default function ContentIntelligencePage() {
    const { activeAccountId } = useAuth();
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    const [dateRange, setDateRange] = useState({
        startDate: defaultStart.toISOString().split('T')[0],
        endDate: defaultEnd.toISOString().split('T')[0]
    });
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['contentIntelligence', activeAccountId, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            const res = await instagramApi.getContentIntelligence(dateRange.startDate, dateRange.endDate);
            return res.data.data;
        },
        ...analyticsQueryOptions
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Analyzing your content...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ color: '#ef4444' }}>Failed to load content intelligence</p>
            </div>
        );
    }

    const intel = data || {};
    const formatBattle = intel.formatBattle || {};
    const captionAnalysis = intel.captionAnalysis || {};
    const reachEfficiency = intel.reachEfficiency || {};
    const interactionQuality = intel.interactionQuality || {};
    const postingTime = intel.postingTime || {};
    const contentQuality = intel.contentQuality || {};

    // Prepare chart data
    const formatChartData = (formatBattle.ranking || []).map((f: any) => ({
        name: f.format,
        score: f.performanceScore,
        engagementRate: f.avgEngagementRate,
        saveRate: f.avgSaveRate,
        fill: FORMAT_COLORS[f.format] || '#6366f1'
    }));

    const captionChartData = (captionAnalysis.buckets || []).map((b: any, i: number) => ({
        name: b.label,
        score: b.performanceScore,
        engagementRate: b.avgEngagementRate,
        fill: COLORS[i % COLORS.length]
    }));

    const qualityDistribution = contentQuality.distribution || {};
    const qualityPieData = [
        { name: 'Excellent', value: qualityDistribution.excellent || 0, fill: '#10b981' },
        { name: 'Good', value: qualityDistribution.good || 0, fill: '#6366f1' },
        { name: 'Average', value: qualityDistribution.average || 0, fill: '#f59e0b' },
        { name: 'Poor', value: qualityDistribution.poor || 0, fill: '#ef4444' }
    ].filter(d => d.value > 0);

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 className="page-title">Content Intelligence</h1>
                    <p className="page-subtitle">Real-signal analysis across format, caption length, reach efficiency, interaction quality, and timing · {intel.postsAnalyzed || 0} posts analyzed</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <DateRangeSelector dateRange={dateRange} setDateRange={setDateRange} />
                    <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary btn-sm">
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Top 5 Best Performing Posts - HERO SECTION */}
            <SectionCard
                title="🏆 Top 5 Best Performing Posts"
                subtitle="Ranked by a real-only quality score using engagement rate, save rate, share rate, comment rate, and reach efficiency"
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                    {(contentQuality.topContent || []).slice(0, 5).map((post: any, i: number) => (
                        <TopPostCard key={post.id} post={post} rank={i + 1} />
                    ))}
                </div>
            </SectionCard>

            {/* Content Quality Score Summary */}
            <SectionCard
                title="Content Quality Score"
                subtitle="Overall health of your content — built only from fetched rates and reach efficiency"
                timePeriod={`${data?.contentQuality?.postsAnalyzed || 0} posts analyzed`}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'center' }}>
                    <div>
                        <ScoreGauge score={contentQuality.averageScore || 0} label="Average Quality Score" />
                        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 6, fontSize: 11, textAlign: 'center' }}>
                            <strong>Score Formula:</strong> Engagement rate + save rate + share rate + comment rate + reach efficiency
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Quality Distribution</span>
                            <InfoTooltip text="Posts are graded from the normalized mix of real fetched rates. Higher scores mean stronger interaction quality and more efficient reach for your account." />
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {qualityPieData.map((item, i) => (
                                <div key={i} style={{
                                    padding: '12px 20px',
                                    background: `${item.fill}15`,
                                    borderRadius: 8,
                                    borderLeft: `3px solid ${item.fill}`
                                }}>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: item.fill }}>{item.value}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Format Battle */}
            <SectionCard
                title="Content Format Battle"
                subtitle="Which format produces the best mix of reach efficiency and interaction quality"
                insight={formatBattle.insight}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={formatChartData} layout="vertical">
                            <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                            <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={100} />
                            <Tooltip
                                contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                                formatter={(value) => [Number(value || 0).toLocaleString(), 'Performance Score']}
                            />
                            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                {formatChartData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    <div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Format Rankings</div>
                        {(formatBattle.ranking || []).map((f: any, i: number) => {
                            const Icon = FORMAT_ICONS[f.format] || Image;
                            return (
                                <div key={f.format} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 0',
                                    borderBottom: i < (formatBattle.ranking?.length || 0) - 1 ? '1px solid var(--border)' : 'none'
                                }}>
                                    <div style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: FORMAT_COLORS[f.format] || '#6366f1',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 12,
                                        fontWeight: 600
                                    }}>
                                        {f.rank}
                                    </div>
                                    <Icon size={18} style={{ color: FORMAT_COLORS[f.format] }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{f.format}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{f.count} posts</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>{f.performanceScore}</div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>score</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </SectionCard>

            {/* Caption Length Analysis */}
            <SectionCard
                title="Caption Length Analysis"
                subtitle="Find the caption length band with the best combined content quality"
                insight={captionAnalysis.insight}
            >
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={captionChartData}>
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                        <YAxis stroke="#9ca3af" fontSize={11} />
                        <Tooltip
                            contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                            formatter={(value, name) => [
                                Number(value || 0).toLocaleString(),
                                name === 'score' ? 'Performance Score' : 'Value'
                            ]}
                        />
                        <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]}>
                            {captionChartData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>

            {/* Key Content Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
                <SectionCard
                    title="Reach Efficiency"
                    subtitle="Reach as a share of followers"
                >
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            fontSize: 36,
                            fontWeight: 700,
                            color: '#10b981'
                        }}>
                            {(reachEfficiency.average || 0).toFixed(2)}%
                        </div>
                        <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {reachEfficiency.insight}
                        </p>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Average Save Rate"
                    subtitle="Saves ÷ reach"
                >
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            fontSize: 36,
                            fontWeight: 700,
                            color: '#6366f1'
                        }}>
                            {(interactionQuality.avgSaveRate || 0).toFixed(1)}%
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                            <Bookmark size={16} style={{ color: '#10b981' }} />
                            <span style={{ fontSize: 13 }}>
                                <strong>{interactionQuality.topSavers?.length || 0}</strong> top saver posts surfaced
                            </span>
                            <InfoTooltip text="Save rate is a more reliable value signal than raw save counts because it adjusts for reach." />
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Average Share Rate"
                    subtitle="Shares ÷ reach"
                >
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{
                            fontSize: 36,
                            fontWeight: 700,
                            color: '#ec4899'
                        }}>
                            {(interactionQuality.avgShareRate || 0).toFixed(1)}%
                        </div>
                        <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {(interactionQuality.avgCommentRate || 0).toFixed(1)}% avg comment rate
                        </p>
                    </div>
                </SectionCard>
            </div>

            <SectionCard
                title="Posting Time Signals"
                subtitle="Best recent timing windows based on the same real-only performance score"
                insight={postingTime.insight}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Best Hours</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(postingTime.bestHours || []).map((slot: any) => (
                                <div key={slot.hour} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--background)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600 }}>{slot.formatted}</span>
                                        <span style={{ color: '#6366f1', fontWeight: 700 }}>score {slot.performanceScore}</span>
                                    </div>
                                    <div className="text-muted" style={{ fontSize: 11 }}>{slot.avgReach} avg reach • {slot.avgSaveRate}% save rate</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Best Days</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(postingTime.bestDays || []).map((slot: any) => (
                                <div key={slot.day} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--background)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600 }}>{slot.day}</span>
                                        <span style={{ color: '#10b981', fontWeight: 700 }}>score {slot.performanceScore}</span>
                                    </div>
                                    <div className="text-muted" style={{ fontSize: 11 }}>{slot.avgReach} avg reach • {slot.avgSaveRate}% save rate</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionCard>

            <p className="text-muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 24 }}>
                Last updated: {intel.lastUpdated ? new Date(intel.lastUpdated).toLocaleString() : 'N/A'}
            </p>
        </div>
    );
}
