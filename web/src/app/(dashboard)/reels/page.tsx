'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi } from '@/lib/api';
import { analyticsQueryOptions } from '@/lib/analyticsQueryOptions';
import { useAuth } from '@/lib/auth';
import { Film, Heart, MessageCircle, Eye, TrendingUp, Bookmark, Share2, HelpCircle, Users, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
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

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ marginBottom: 16 }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h3>
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
            <div className="metric-value" style={{ fontSize: 22, color }}>{value}</div>
            <div className="metric-label" style={{ fontSize: 12 }}>{label}</div>
        </div>
    );
}

// ==================== MAIN PAGE ====================

export default function ReelsPage() {
    const { activeAccountId } = useAuth();
    const REELS_PER_PAGE = 12;
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([null]);
    const [dateRange, setDateRange] = useState({
        startDate: defaultStart.toISOString().split('T')[0],
        endDate: defaultEnd.toISOString().split('T')[0]
    });
    const currentCursor = cursorHistory[cursorHistory.length - 1] || undefined;
    const currentPage = cursorHistory.length;

    useEffect(() => {
        setCursorHistory([null]);
    }, [activeAccountId, dateRange.startDate, dateRange.endDate]);

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['reels', activeAccountId, dateRange.startDate, dateRange.endDate, currentCursor, REELS_PER_PAGE],
        queryFn: async () => {
            const res = await instagramApi.getReels(dateRange.startDate, dateRange.endDate, {
                after: currentCursor,
                limit: REELS_PER_PAGE
            });
            return res.data.data;
        },
        ...analyticsQueryOptions
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Loading reels analytics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center', maxWidth: 460 }}>
                    <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>Reels analytics failed to load</p>
                    <p className="text-muted" style={{ marginBottom: 16 }}>
                        The request did not return a usable reel page. This now surfaces as an error instead of silently showing empty analytics.
                    </p>
                    <button onClick={() => refetch()} className="btn btn-primary">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const reels = data?.reels || [];
    const summary = data?.summary || {};
    const comparison = data?.comparison || {};
    const pagination = data?.pagination || {};
    const playsAvailable = reels.some((reel: any) => (reel.plays || 0) > 0);
    const diagnosticReels = [...reels]
        .sort((a: any, b: any) => (b.reach || 0) - (a.reach || 0))
        .slice(0, 8);

    // Chart data for engagement
    const chartData = reels.slice(0, 10).map((reel: any, i: number) => ({
        name: `Reel ${i + 1}`,
        engagement: reel.engagement,
        likes: reel.likes,
        comments: reel.comments,
        reach: reel.reach || 0
    }));

    // Calculate computed metrics
    const viralScore = summary.totalReach && summary.totalEngagement
        ? ((summary.totalEngagement / summary.totalReach) * 100).toFixed(2)
        : '0';

    const saveRate = reels.length > 0
        ? ((reels.reduce((sum: number, r: any) => sum + (r.saved || 0), 0) / summary.totalReach) * 100).toFixed(2)
        : '0';

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 className="page-title">Reels Analytics</h1>
                    <p className="page-subtitle">Performance metrics for your video content</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <DateRangeSelector dateRange={dateRange} setDateRange={setDateRange} />
                    <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary btn-sm">
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid-metrics" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                <MetricCard
                    label="Reels In Page"
                    value={summary.totalReels || 0}
                    icon={Film}
                    color="#6366f1"
                    tooltip="Number of reels returned in this server-fetched page"
                />
                <MetricCard
                    label="Total Reach"
                    value={summary.totalReach?.toLocaleString() || 0}
                    icon={Eye}
                    color="#ec4899"
                    tooltip="Total unique accounts reached by your reels"
                />
                <MetricCard
                    label="Impressions"
                    value={summary.totalImpressions?.toLocaleString() || 0}
                    icon={Users}
                    color="#0ea5e9"
                    tooltip="Total impressions returned across the analyzed reel set"
                />
                <MetricCard
                    label="Total Saves"
                    value={summary.totalSaved?.toLocaleString() || 0}
                    icon={Bookmark}
                    color="#10b981"
                    tooltip="Total saves across your reels"
                />
                <MetricCard
                    label="Total Shares"
                    value={summary.totalShares?.toLocaleString() || 0}
                    icon={Share2}
                    color="#f59e0b"
                    tooltip="Total shares returned by supported reel insights"
                />
                <MetricCard
                    label="Interactions"
                    value={summary.totalInteractions?.toLocaleString() || 0}
                    icon={TrendingUp}
                    color="#6366f1"
                    tooltip="Total interactions returned by supported reel insights"
                />
            </div>

            {/* Comparison Banner */}
            <SectionCard
                title="Reels vs Posts Performance"
                subtitle="Comparison using the current analyzed page instead of your full library"
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Reel Avg Engagement</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>
                            {comparison.reelAvgEngagement?.toLocaleString() || 0}
                        </div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Post Avg Engagement</div>
                        <div style={{ fontSize: 28, fontWeight: 700 }}>
                            {comparison.postAvgEngagement?.toLocaleString() || 0}
                        </div>
                    </div>
                    <div style={{
                        padding: 16,
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                        borderRadius: 8,
                        textAlign: 'center'
                    }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Performance Multiplier</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>
                            {comparison.reelMultiplier || 0}x
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* Calculated Insights */}
            <SectionCard title="Rate Diagnostics" subtitle="Real rates calculated directly from fetched reel reach and interactions">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Engagement Rate</span>
                            <InfoTooltip text="Engagement divided by reach across the analyzed reel set." />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{viralScore}%</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Save Rate</span>
                            <InfoTooltip text="(Total Saves ÷ Total Reach) × 100. High save rate indicates valuable, reference-worthy content." />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{saveRate}%</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span className="text-muted" style={{ fontSize: 12 }}>Avg Share Rate</span>
                            <InfoTooltip text="Average shares divided by reach across the analyzed reel set." />
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{summary.avgShareRate || 0}%</div>
                    </div>
                </div>
            </SectionCard>

            {/* Playback & intent */}
            <SectionCard
                title="Playback & Intent Signals"
                subtitle="Only real reel metrics returned by Meta are shown here"
            >
                <div style={{ display: 'grid', gridTemplateColumns: playsAvailable ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 16 }}>
                    {playsAvailable && (
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Total Plays</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>
                                {(summary.totalPlays || 0).toLocaleString()}
                            </div>
                            <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
                                Returned by media insights
                            </div>
                        </div>
                    )}
                    {playsAvailable && (
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Avg Play Rate</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#ec4899' }}>
                                {summary.avgPlayRate || 0}%
                            </div>
                            <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>Plays divided by reach</div>
                        </div>
                    )}
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Avg Save Rate</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
                            {summary.avgSaveRate || 0}%
                        </div>
                        <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>Saves divided by reach</div>
                    </div>
                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Avg Interaction Rate</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>
                            {summary.avgEngagementRate || 0}%
                        </div>
                        <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>Interactions divided by reach</div>
                    </div>
                </div>
            </SectionCard>

            {/* Engagement Chart */}
            <SectionCard title="Top Reels Engagement" subtitle="Engagement breakdown for your best performing reels">
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                        />
                        <Bar dataKey="likes" fill="#ec4899" radius={[4, 4, 0, 0]} name="Likes" />
                        <Bar dataKey="comments" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Comments" />
                    </BarChart>
                </ResponsiveContainer>
            </SectionCard>


            <SectionCard
                title="Real Reel Diagnostics"
                subtitle={`Top reels from page ${currentPage}, ranked by actual reach, plays, saves, and engagement efficiency`}
            >
                {diagnosticReels.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {diagnosticReels.map((reel: any, i: number) => (
                            <div key={reel.id || i} style={{
                                padding: '14px',
                                borderRadius: 12,
                                background: 'var(--card-raised)',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--background)', flexShrink: 0, overflow: 'hidden' }}>
                                        {reel.thumbnail ? <img src={reel.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Film size={20} style={{ color: 'var(--muted)', margin: 10 }} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 2 }}>
                                            {(() => {
                                                const text = reel.caption || reel.title || reel.name;
                                                if (text) return text.length > 60 ? `${text.substring(0, 60)}…` : text;
                                                return new Date(reel.timestamp || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                            })()}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 10 }}>
                                            <span>{(reel.reach || 0).toLocaleString()} reach</span>
                                            <span>{(reel.likes || 0).toLocaleString()} likes</span>
                                            {playsAvailable && <span>{(reel.plays || 0).toLocaleString()} plays</span>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: playsAvailable ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: 10, marginBottom: 4 }}>Engagement Rate</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{reel.engagementRate || 0}%</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: 10, marginBottom: 4 }}>Save Rate</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{reel.saveRate || 0}%</div>
                                    </div>
                                    {playsAvailable && (
                                        <div>
                                            <div className="text-muted" style={{ fontSize: 10, marginBottom: 4 }}>Play Rate</div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: '#ec4899' }}>{reel.playRate || 0}%</div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-muted" style={{ fontSize: 10, marginBottom: 4 }}>Share Rate</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0ea5e9' }}>{reel.shareRate || 0}%</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: 10, marginBottom: 4 }}>Saves</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>{reel.saved || 0}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                        <Film size={24} style={{ margin: '0 auto 12px' }} />
                        <p style={{ fontSize: 13 }}>No reels data found. Post Reels on Instagram and check back after 24 hours for insights.</p>
                    </div>
                )}
            </SectionCard>

            {/* Reels Grid */}
            <SectionCard
                title="Your Reels"
                subtitle={`${reels.length} video${reels.length !== 1 ? 's' : ''} returned on page ${currentPage}${pagination.pagesScanned ? ` after scanning ${pagination.pagesScanned} media batch${pagination.pagesScanned !== 1 ? 'es' : ''}` : ''}`}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
                    {reels.map((reel: any, idx: number) => (
                        <div
                            key={reel.id || idx}
                            style={{
                                borderRadius: 8,
                                overflow: 'hidden',
                                background: 'var(--background)',
                                cursor: 'pointer',
                                transition: 'transform 0.2s'
                            }}
                        >
                            <div style={{ aspectRatio: '9/16', background: '#1e293b', position: 'relative' }}>
                                {reel.thumbnail && (
                                    <img
                                        src={reel.thumbnail}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                )}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                    padding: '24px 8px 8px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, color: 'white' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                            <Heart size={14} /> {reel.likes?.toLocaleString()}
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                            <MessageCircle size={14} /> {reel.comments?.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: -10, marginBottom: 20 }}>
                <button
                    onClick={() => setCursorHistory((history) => history.length > 1 ? history.slice(0, -1) : history)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 18px', borderRadius: 20 }}
                    disabled={cursorHistory.length === 1 || isFetching}
                >
                    <ChevronLeft size={16} /> Previous Page
                </button>
                <span className="text-muted" style={{ fontSize: 13 }}>
                    Page {currentPage}
                </span>
                <button
                    onClick={() => {
                        if (pagination.nextCursor) {
                            setCursorHistory((history) => [...history, pagination.nextCursor]);
                        }
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '8px 18px', borderRadius: 20 }}
                    disabled={!pagination.hasNextPage || isFetching}
                >
                    Next Page <ChevronRight size={16} />
                </button>
            </div>
            {!pagination.hasNextPage && reels.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: -8, marginBottom: 20 }}>
                    <p className="text-muted" style={{ fontSize: 12 }}>
                        You&apos;ve reached the end of the currently available reels for this date range.
                    </p>
                </div>
            )}
        </div>
    );
}
