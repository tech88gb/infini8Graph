'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { googleAdsApi } from '@/lib/api';
import {
    BarChart2, TrendingUp, TrendingDown, DollarSign, MousePointer, Eye,
    Zap, AlertTriangle, CheckCircle, Info, AlertCircle, RefreshCw,
    ExternalLink, Tag, ChevronRight, Activity, Target, ListChecks,
    Layers, LogOut, BarChart, Search, Users, Globe, Cpu, Clock, MapPin
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    BarChart as ReBarChart, Bar, PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6'];

// ==================== HELPERS ====================

const fmt = (n: number, dec = 2) => n?.toLocaleString('en-US', { maximumFractionDigits: dec }) ?? '—';
const fmtINR = (n: number) => `₹${fmt(n, 2)}`;
const fmtPct = (n: number) => `${fmt(n, 2)}%`;

function ROAS({ value }: { value: number }) {
    const color = value >= 4 ? '#10b981' : value >= 2 ? '#f59e0b' : value >= 1 ? '#ef4444' : '#6b7280';
    return <span style={{ color, fontWeight: 700 }}>{value ? `${value.toFixed(2)}x` : '—'}</span>;
}

function StatusBadge({ status }: { status: string }) {
    const s = String(status || '').toUpperCase();
    const color = s === 'ENABLED' || s === 'ACTIVE' ? '#10b981' : s === 'PAUSED' ? '#f59e0b' : '#6b7280';
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
            background: `${color}22`, color, textTransform: 'uppercase', letterSpacing: '0.04em'
        }}>
            {s}
        </span>
    );
}

function QualityScore({ score }: { score: number | null }) {
    if (score === null || score === undefined) return <span style={{ color: 'var(--muted)' }}>—</span>;
    const color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
                width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden'
            }}>
                <div style={{ width: `${score * 10}%`, height: '100%', background: color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}/10</span>
        </div>
    );
}

function AlertCard({ alert }: { alert: any }) {
    const icons: Record<string, any> = {
        danger: AlertCircle,
        warning: AlertTriangle,
        success: CheckCircle,
        info: Info,
    };
    const colors: Record<string, string> = {
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        info: '#6366f1',
    };
    const Icon = icons[alert.type] || Info;
    const color = colors[alert.type] || '#6366f1';

    return (
        <div style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: `${color}11`,
            border: `1px solid ${color}33`,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start'
        }}>
            <Icon size={16} style={{ color, flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{alert.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}22`, padding: '2px 7px', borderRadius: 20 }}>
                        {alert.category}
                    </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px', lineHeight: 1.5 }}>{alert.message}</p>
                <span style={{ fontSize: 11, fontWeight: 600, color }}>{alert.metric}</span>
            </div>
        </div>
    );
}

// ==================== TAB BUTTON ====================

function Tab({ label, icon: Icon, active, onClick, badge }: { label: string; icon: any; active: boolean; onClick: () => void; badge?: number }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: active ? 'var(--primary)' : 'transparent',
                border: active ? 'none' : '1px solid var(--border)',
                color: active ? '#fff' : 'var(--muted)',
                fontWeight: active ? 600 : 400,
                fontSize: 13, cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
            }}
        >
            <Icon size={14} />
            {label}
            {badge !== undefined && badge > 0 && (
                <span style={{
                    background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
                    padding: '1px 5px', borderRadius: 20, marginLeft: 2
                }}>{badge}</span>
            )}
        </button>
    );
}

// ==================== OVERVIEW TAB ====================

function OverviewTab({ preset }: { preset: string }) {
    const { data: perf, isLoading, isError, error } = useQuery({
        queryKey: ['google-perf', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getPerformance(preset);
            if (!res.data.success) throw new Error(res.data.error || 'Failed to fetch performance data');
            return res.data.data;
        },
        retry: 1
    });

    const { data: budgetData } = useQuery({
        queryKey: ['google-budget'],
        queryFn: async () => {
            const res = await googleAdsApi.getBudget();
            return res.data.data;
        },
        retry: 1
    });

    const { data: crossData } = useQuery({
        queryKey: ['google-cross', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getCrossPlatform(preset);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    if (isError) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <BarChart2 size={40} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 500, marginBottom: 8 }}>Unable to load Google Ads metrics</p>
                <p className="text-muted" style={{ fontSize: 13, maxWidth: 400, margin: '0 auto' }}>
                    {(error as any)?.message || 'There was a timeout or connection issue communicating with the Google Ads API.'}
                </p>
            </div>
        );
    }

    if (!perf?.hasAdAccounts) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <BarChart2 size={40} style={{ color: 'var(--muted)', margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 500, marginBottom: 8 }}>No Google Ads accounts found</p>
                <p className="text-muted" style={{ fontSize: 13 }}>
                    {perf?.message || perf?.error || 'No active Google Ads campaigns were found on your connected Google Ads Manager / account.'}
                </p>
            </div>
        );
    }

    const m = perf.metrics || {};
    const pieData = crossData?.combined
        ? [
            { name: 'Google Ads', value: crossData.google?.spend || 0 },
            { name: 'Meta Ads', value: crossData.meta?.spend || 0 },
        ]
        : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Top Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                    { label: 'Total Spend', value: fmtINR(m.spend), icon: DollarSign, color: '#6366f1' },
                    { label: 'Impressions', value: fmt(m.impressions, 0), icon: Eye, color: '#0ea5e9' },
                    { label: 'Clicks', value: fmt(m.clicks, 0), icon: MousePointer, color: '#ec4899' },
                    { label: 'CTR', value: fmtPct(m.ctr), icon: Activity, color: '#10b981' },
                    { label: 'Conversions', value: fmt(m.conversions, 0), icon: Target, color: '#f59e0b' },
                    { label: 'Conv. Value', value: fmtINR(m.conversionValue), icon: TrendingUp, color: '#8b5cf6' },
                    { label: 'ROAS', value: m.roas ? `${m.roas.toFixed(2)}x` : '—', icon: BarChart2, color: m.roas >= 4 ? '#10b981' : m.roas >= 2 ? '#f59e0b' : '#ef4444' },
                    { label: 'Cost / Conv.', value: fmtINR(m.costPerConversion), icon: Zap, color: '#0ea5e9' },
                ].map((stat, i) => (
                    <div key={i} className="card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ padding: 6, borderRadius: 6, background: `${stat.color}22` }}>
                                <stat.icon size={14} style={{ color: stat.color }} />
                            </div>
                            <span className="text-muted" style={{ fontSize: 12 }}>{stat.label}</span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Budget Utilization */}
            {budgetData?.campaigns?.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Today's Budget Utilization</h3>
                        <span className="badge badge-info">{budgetData.campaigns.length} campaigns</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {budgetData.campaigns.map((c: any, i: number) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <span className="text-muted" style={{ fontSize: 12 }}>{fmtINR(c.spent)} / {fmtINR(c.budgetAmount)}</span>
                                        <span style={{
                                            fontSize: 11, fontWeight: 700,
                                            color: c.utilization > 90 ? '#ef4444' : c.utilization > 60 ? '#f59e0b' : '#10b981'
                                        }}>
                                            {c.utilization}%
                                        </span>
                                    </div>
                                </div>
                                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.min(c.utilization, 100)}%`,
                                        background: c.utilization > 90 ? '#ef4444' : c.utilization > 60 ? '#f59e0b' : '#10b981',
                                        borderRadius: 3,
                                        transition: 'width 0.5s ease'
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cross-Platform Comparison */}
            {crossData?.connected && (crossData.google?.spend > 0 || crossData.meta?.spend > 0) && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Cross-Platform Ad Spend</h3>
                        <span className="text-muted" style={{ fontSize: 13 }}>
                            Total: {fmtINR(crossData.combined?.totalSpend || 0)}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, alignItems: 'center' }}>
                        {/* Google */}
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ color: '#4285F4', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Google Ads</div>
                            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{fmtINR(crossData.google?.spend)}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>{crossData.combined?.googleShare}% of budget</div>
                            <div style={{ marginTop: 8, fontSize: 12 }}>CTR: <b>{fmtPct(crossData.google?.ctr)}</b> · ROAS: <b>{crossData.google?.roas?.toFixed(2) || '—'}x</b></div>
                        </div>

                        {/* Donut chart */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <PieChart width={140} height={140}>
                                <Pie data={pieData} cx={65} cy={65} innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                                    <Cell fill="#4285F4" />
                                    <Cell fill="#0081FB" />
                                </Pie>
                                <Tooltip formatter={(v: any) => fmtINR(v)} />
                            </PieChart>
                        </div>

                        {/* Meta */}
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 10, textAlign: 'center' }}>
                            <div style={{ color: '#0081FB', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Meta Ads</div>
                            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{fmtINR(crossData.meta?.spend)}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>{crossData.combined?.metaShare}% of budget</div>
                            <div style={{ marginTop: 8, fontSize: 12 }}>Impressions: <b>{fmt(crossData.meta?.impressions, 0)}</b></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== CAMPAIGNS TAB ====================

function CampaignsTab({ preset }: { preset: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['google-campaigns', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getCampaigns(preset);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const campaigns = data?.campaigns || [];

    if (!campaigns.length) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Target size={40} style={{ color: 'var(--muted)', margin: '0 auto 16px' }} />
                <p className="text-muted">No campaign data available for this period.</p>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Campaign Breakdown</h3>
                <span className="badge badge-info">{campaigns.length} campaigns</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Campaign</th>
                            <th>Status</th>
                            <th>Spend</th>
                            <th>Impressions</th>
                            <th>Clicks</th>
                            <th>CTR</th>
                            <th>CPC</th>
                            <th>Conversions</th>
                            <th>ROAS</th>
                            <th>Cost/Conv.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {campaigns.map((c: any, i: number) => (
                            <tr key={i}>
                                <td style={{ maxWidth: 200 }}>
                                    <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.channelType}</div>
                                </td>
                                <td><StatusBadge status={c.status} /></td>
                                <td style={{ fontWeight: 600 }}>{fmtINR(c.spend)}</td>
                                <td>{fmt(c.impressions, 0)}</td>
                                <td>{fmt(c.clicks, 0)}</td>
                                <td>{fmtPct(c.ctr)}</td>
                                <td>{fmtINR(c.cpc)}</td>
                                <td>{fmt(c.conversions, 0)}</td>
                                <td><ROAS value={c.roas} /></td>
                                <td>{c.costPerConversion > 0 ? fmtINR(c.costPerConversion) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ==================== KEYWORDS TAB ====================

function KeywordsTab({ preset }: { preset: string }) {
    const [filter, setFilter] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['google-keywords', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getKeywords(preset);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const allKeywords = data?.keywords || [];
    const lowQuality = data?.lowQuality || [];
    const keywords = filter
        ? allKeywords.filter((k: any) => String(k.keyword || '').toLowerCase().includes(filter.toLowerCase()))
        : allKeywords;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Low Quality Alert */}
            {lowQuality.length > 0 && (
                <div style={{
                    padding: 14, borderRadius: 10, background: '#f59e0b11', border: '1px solid #f59e0b33',
                    display: 'flex', gap: 10, alignItems: 'flex-start'
                }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                            {lowQuality.length} keyword{lowQuality.length > 1 ? 's' : ''} with Low Quality Score
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Low quality scores increase your CPCs. Review landing page relevance and ad copy alignment.
                        </p>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Keyword Performance</h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                        <input
                            placeholder="Filter keywords..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            style={{
                                background: 'var(--background)', border: '1px solid var(--border)',
                                borderRadius: 8, padding: '6px 10px 6px 30px', fontSize: 13,
                                color: 'var(--foreground)', width: 180
                            }}
                        />
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Keyword</th>
                                <th>Match</th>
                                <th>Quality Score</th>
                                <th>Impressions</th>
                                <th>Clicks</th>
                                <th>CTR</th>
                                <th>CPC</th>
                                <th>Spend</th>
                                <th>Conversions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {keywords.slice(0, 30).map((k: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 500, fontSize: 13 }}>{k.keyword}</td>
                                    <td>
                                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--card-hover)', color: 'var(--muted)' }}>
                                            {String(k.matchType || '').replace('MATCH_TYPE_', '') || '—'}
                                        </span>
                                    </td>
                                    <td><QualityScore score={k.qualityScore} /></td>
                                    <td>{fmt(k.impressions, 0)}</td>
                                    <td>{fmt(k.clicks, 0)}</td>
                                    <td>{fmtPct(k.ctr)}</td>
                                    <td>{fmtINR(k.cpc)}</td>
                                    <td style={{ fontWeight: 600 }}>{fmtINR(k.spend)}</td>
                                    <td>{fmt(k.conversions, 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ==================== CREATIVES TAB ====================

function CreativesTab() {
    const { data, isLoading } = useQuery({
        queryKey: ['google-creatives'],
        queryFn: async () => {
            const res = await googleAdsApi.getCreatives();
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const ads = data?.ads || [];

    if (!ads.length) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Layers size={40} style={{ color: 'var(--muted)', margin: '0 auto 16px' }} />
                <p className="text-muted">No active ad creatives found.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {ads.map((ad: any, i: number) => (
                <div key={i} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{ad.campaignName}</div>
                            <StatusBadge status={ad.status} />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmt(ad.impressions, 0)} impr.</div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct(ad.ctr)} CTR</div>
                        </div>
                    </div>

                    {/* Ad Preview */}
                    <div style={{
                        padding: 14, borderRadius: 8,
                        background: 'var(--background)', border: '1px solid var(--border)',
                        marginBottom: 12
                    }}>
                        {/* Headline */}
                        {ad.headlines.length > 0 && (
                            <div style={{ marginBottom: 6 }}>
                                {ad.headlines.slice(0, 3).map((h: string, j: number) => (
                                    <span key={j}>
                                        <span style={{ color: '#4285F4', fontSize: 14, fontWeight: 600 }}>{h}</span>
                                        {j < ad.headlines.length - 1 && ad.headlines.length > 1 && j < 2 && (
                                            <span style={{ color: 'var(--muted)', margin: '0 6px' }}>|</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                        {/* URL */}
                        {ad.finalUrl && (
                            <div style={{ fontSize: 12, color: '#0d652d', marginBottom: 6 }}>
                                {String(ad.finalUrl).replace('https://', '').split('/')[0]}
                            </div>
                        )}
                        {/* Descriptions */}
                        {ad.descriptions.length > 0 && (
                            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
                                {ad.descriptions[0]}
                            </p>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span className="text-muted">{fmt(ad.clicks, 0)} clicks · {fmtINR(ad.spend)}</span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--card-hover)', color: 'var(--muted)' }}>
                            {String(ad.type || '').replace('AD_TYPE_', '') || 'RSA'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ==================== COMPETITORS TAB ====================

function CompetitorsTab({ preset }: { preset: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['google-auction', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getAuctionInsights(preset);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const competitors = data?.competitors || [];

    if (!competitors.length) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Users size={40} style={{ color: 'var(--muted)', margin: '0 auto 16px' }} />
                <p className="text-muted">No auction insight data available.</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Note: Auction data requires sufficient campaign history and competition density.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Auction Insights (Competitors)</h3>
                    <span className="badge badge-info">{competitors.length} Competitors Detected</span>
                </div>
                <div style={{ height: 300, width: '100%', padding: '0 20px 20px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={competitors.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                            <XAxis type="number" unit="%" />
                            <YAxis dataKey="domain" type="category" width={80} style={{ fontSize: 10 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="impressionShare" name="Impression Share" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="overlapRate" name="Overlap Rate" fill="#ec4899" radius={[0, 4, 4, 0]} />
                        </ReBarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Competitor Domain</th>
                                <th>Impression Share</th>
                                <th>Overlap Rate</th>
                                <th>Outranking Share</th>
                                <th>Top of Page Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {competitors.map((c: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 600, color: '#6366f1' }}>{c.domain}</td>
                                    <td>{c.impressionShare}%</td>
                                    <td>{c.overlapRate}%</td>
                                    <td>{c.outrankingShare}%</td>
                                    <td>{c.topOfPageRate}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ==================== SEARCH TERMS (WASTED SPEND) ====================

function SearchTermsTab({ preset }: { preset: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['google-search-terms', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getSearchTerms(preset);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const wasted = data?.wastedSpend || [];
    const allTerms = data?.terms || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Wasted Spend Warning */}
            {wasted.length > 0 && (
                <div style={{
                    padding: 20, borderRadius: 12, background: '#ef444411', border: '1px solid #ef444433',
                    display: 'flex', gap: 16, alignItems: 'center'
                }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ef444422', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertCircle size={24} style={{ color: '#ef4444' }} />
                    </div>
                    <div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Potential Wasted Spend Detected</h4>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                            We found <b>{wasted.length}</b> search terms with high spend but 0 conversions. 
                            Consider adding these as negative keywords to save budget.
                        </p>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>
                            {fmtINR(wasted.reduce((acc: number, t: any) => acc + t.spend, 0))}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>Wasted in {preset}</div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Top Wasted Search Terms</h3>
                    </div>
                    {wasted.length > 0 ? (
                        <table className="table" style={{ fontSize: 13 }}>
                            <thead>
                                <tr>
                                    <th>Term</th>
                                    <th>Spend</th>
                                    <th>Clicks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {wasted.map((t: any, i: number) => (
                                    <tr key={i}>
                                        <td style={{ fontSize: 12 }}>{t.term}</td>
                                        <td style={{ fontWeight: 600, color: '#ef4444' }}>{fmtINR(t.spend)}</td>
                                        <td>{t.clicks}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                            <CheckCircle size={24} style={{ color: '#10b981', margin: '0 auto 12px' }} />
                            <p style={{ fontSize: 13 }}>No high-spend wasted terms detected yet.</p>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Search Term Volume</h3>
                    </div>
                    <div style={{ height: 260, width: '100%', padding: '0 20px 20px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={allTerms.slice(0, 15)}>
                                <Tooltip />
                                <Area type="monotone" dataKey="spend" stroke="#6366f1" fill="#6366f133" />
                                <Area type="monotone" dataKey="clicks" stroke="#ec4899" fill="#ec489933" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">All Search Terms</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Search Term</th>
                                <th>Campaign</th>
                                <th>Spend</th>
                                <th>Clicks</th>
                                <th>Conv.</th>
                                <th>CTR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allTerms.slice(0, 50).map((t: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 500 }}>{t.term}</td>
                                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{t.campaign}</td>
                                    <td style={{ fontWeight: 600 }}>{fmtINR(t.spend)}</td>
                                    <td>{t.clicks}</td>
                                    <td>{t.conversions}</td>
                                    <td>{((t.clicks / t.impressions) * 100).toFixed(2)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ==================== QUALITY SCORE (INTELLIGENCE) ====================

function IntelligenceTab() {
    const { data: qs, isLoading: qsLoading } = useQuery({
        queryKey: ['google-qs'],
        queryFn: async () => {
            const res = await googleAdsApi.getQualityScore();
            return res.data.data;
        }
    });

    const { data: assetData, isLoading: assetLoading } = useQuery({
        queryKey: ['google-assets'],
        queryFn: async () => {
            const res = await googleAdsApi.getAssets();
            return res.data.data;
        }
    });

    if (qsLoading || assetLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const keywords = qs?.keywords || [];
    const assets = assetData?.assets || [];

    const lowQs = keywords.filter((k: any) => k.qualityScore < 5);
    const highImprAssets = assets.filter((a: any) => a.performance === 'BEST' || a.performance === 'GOOD');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Quality Score Diagnostics */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Quality Score Diagnostics</h3>
                        <span className="badge badge-warning">{lowQs.length} items to fix</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {keywords.length > 0 ? keywords.slice(0, 5).map((k: any, i: number) => (
                            <div key={i} style={{ padding: 12, borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{k.keyword}</span>
                                    <QualityScore score={k.qualityScore} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                    {[
                                        { label: 'Expected CTR', value: k.expectedCtr },
                                        { label: 'Ad Relevance', value: k.creativeQuality },
                                        { label: 'LP Experience', value: k.landingPageQuality },
                                    ].map((p, j) => (
                                        <div key={j} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4, whiteSpace: 'nowrap' }}>{p.label}</div>
                                            <span style={{ 
                                                fontSize: 9, fontWeight: 800,
                                                padding: '2px 6px', borderRadius: 4,
                                                background: String(p.value).includes('ABOVE') ? '#10b98122' : String(p.value).includes('BELOW') ? '#ef444422' : '#f59e0b22',
                                                color: String(p.value).includes('ABOVE') ? '#10b981' : String(p.value).includes('BELOW') ? '#ef4444' : '#f59e0b'
                                            }}>
                                                {String(p.value || 'UNKNOWN').replace(' AVERAGE', '')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )) : (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                                <Zap size={24} style={{ margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 13 }}>No diagnostic data available.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RSA Asset Performance */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Responsive Ad Assets</h3>
                        <span className="badge badge-success">{highImprAssets.length} top performers</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {assets.length > 0 ? assets.slice(0, 10).map((a: any, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                                <div style={{ 
                                    padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, minWidth: 70, textAlign: 'center',
                                    background: a.performance === 'BEST' ? '#10b98122' : a.performance === 'GOOD' ? '#0ea5e922' : 'var(--border)',
                                    color: a.performance === 'BEST' ? '#10b981' : a.performance === 'GOOD' ? '#0ea5e9' : 'var(--muted)'
                                }}>
                                    {a.performance === 'UNSPECIFIED' ? 'LEARNING' : a.performance}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</div>
                                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{String(a.type || '').replace('RSA_', '').toLowerCase()} · {fmt(a.impressions, 0)} impressions</div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                                <Layers size={24} style={{ margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 13 }}>No asset performance data available yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== GEO / LOCATION TAB ====================

function GeoTab({ preset }: { preset: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['google-geo', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getGeo(preset);
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const locations = data?.locations || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Geographic Performance</h3>
                </div>
                <div style={{ height: 350, width: '100%', padding: '0 20px 20px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={locations.slice(0, 15)} margin={{ top: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis dataKey="campaign" hide />
                            <YAxis style={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="spend" name="Spend (₹)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="conversions" name="Conversions" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </ReBarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Location/Campaign</th>
                            <th>Spend</th>
                            <th>Impressions</th>
                            <th>Clicks</th>
                            <th>Conversions</th>
                            <th>ROAS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {locations.map((loc: any, i: number) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{loc.campaign}</td>
                                <td style={{ fontWeight: 600 }}>{fmtINR(loc.spend)}</td>
                                <td>{fmt(loc.impressions, 0)}</td>
                                <td>{fmt(loc.clicks, 0)}</td>
                                <td style={{ color: '#10b981', fontWeight: 600 }}>{loc.conversions}</td>
                                <td>{loc.spend > 0 ? (loc.conversions / loc.spend).toFixed(2) : 0}x</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ==================== ALERTS TAB ====================

function AlertsTab() {
    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['google-alerts'],
        queryFn: async () => {
            const res = await googleAdsApi.getAlerts();
            return res.data.data;
        }
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const alerts = data?.alerts || [];
    const danger = alerts.filter((a: any) => a.type === 'danger');
    const warning = alerts.filter((a: any) => a.type === 'warning');
    const success = alerts.filter((a: any) => a.type === 'success');
    const info = alerts.filter((a: any) => a.type === 'info');

    if (!alerts.length) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <CheckCircle size={40} style={{ color: '#10b981', margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 500, marginBottom: 8 }}>All clear!</p>
                <p className="text-muted" style={{ fontSize: 13 }}>No issues or recommendations detected at this time.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                    { label: 'Urgent', count: danger.length, color: '#ef4444' },
                    { label: 'Warnings', count: warning.length, color: '#f59e0b' },
                    { label: 'Wins', count: success.length, color: '#10b981' },
                    { label: 'Info', count: info.length, color: '#6366f1' },
                ].map((s, i) => (
                    <div key={i} style={{
                        padding: '12px 16px', borderRadius: 10,
                        background: `${s.color}11`, border: `1px solid ${s.color}33`,
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.count}</div>
                        <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="btn btn-secondary btn-sm"
                >
                    <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {alerts.map((alert: any, i: number) => (
                    <AlertCard key={i} alert={alert} />
                ))}
            </div>
        </div>
    );
}

// ==================== CONNECT SCREEN ====================

function ConnectScreen() {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const handleConnect = () => {
        setLoading(true);
        // Redirect — the backend will handle the OAuth flow
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}/api/google/auth/login`;
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{
                maxWidth: 480, width: '100%',
                padding: 40, borderRadius: 20,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(99,102,241,0.2)',
                textAlign: 'center'
            }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
                    background: 'linear-gradient(135deg, #4285F4, #34A853)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <BarChart2 size={28} color="#fff" />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Connect Google Ads</h2>
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                    Link your Google Ads account to see campaign performance, keyword quality scores,
                    ad creative previews, budget utilization, and cross-platform spend comparisons — all in one place.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                    {[
                        'Campaign-level ROAS & cost-per-conversion',
                        'Keyword performance & quality scores',
                        'Ad creative preview with CTR data',
                        'Smart alerts & optimization recommendations'
                    ].map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'left' }}>{f}</span>
                        </div>
                    ))}
                </div>
                <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px 24px', fontSize: 15 }}
                >
                    {loading ? (
                        <><div className="spinner" style={{ width: 16, height: 16 }} /> Redirecting...</>
                    ) : (
                        <><BarChart2 size={16} /> Connect Google Ads</>
                    )}
                </button>
            </div>
        </div>
    );
}

// ==================== MAIN PAGE ====================

const PRESETS = [
    { label: '7 days', value: '7d' },
    { label: '30 days', value: '30d' },
    { label: '90 days', value: '90d' },
];

export default function GoogleAdsPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [preset, setPreset] = useState('30d');
    const queryClient = useQueryClient();

    const { data: status, isLoading: statusLoading } = useQuery({
        queryKey: ['google-status'],
        queryFn: async () => {
            const res = await googleAdsApi.getStatus();
            return res.data;
        }
    });

    const { data: alertsData } = useQuery({
        queryKey: ['google-alerts'],
        queryFn: async () => {
            const res = await googleAdsApi.getAlerts();
            return res.data.data;
        },
        enabled: !!status?.connected
    });

    const disconnectMutation = useMutation({
        mutationFn: async () => {
            await googleAdsApi.disconnect();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-status'] });
        }
    });

    if (statusLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!status?.connected) {
        return (
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div className="page-header" style={{ marginBottom: 32 }}>
                    <div>
                        <h1 className="page-title">Google Ads</h1>
                        <p className="page-subtitle">Cross-platform advertising intelligence</p>
                    </div>
                </div>
                <ConnectScreen />
            </div>
        );
    }

    const urgentCount = alertsData?.alerts?.filter((a: any) => a.type === 'danger' || a.type === 'warning').length || 0;

    const tabs = [
        { key: 'overview', label: 'Overview', icon: BarChart2 },
        { key: 'campaigns', label: 'Campaigns', icon: Target },
        { key: 'keywords', label: 'Keywords', icon: Search },
        { key: 'competitors', label: 'Competitors', icon: Users },
        { key: 'search-terms', label: 'Search Terms', icon: Search },
        { key: 'intelligence', label: 'Intelligence', icon: Cpu },
        { key: 'geo', label: 'Location', icon: MapPin },
        { key: 'creatives', label: 'Creatives', icon: Layers },
        { key: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: urgentCount },
    ];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h1 className="page-title">Google Ads</h1>
                        <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                            {status.account?.email}
                        </span>
                    </div>
                    <p className="page-subtitle">Campaign performance, keywords, and cross-platform intelligence</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Date Range Picker */}
                    {['overview', 'campaigns', 'keywords', 'competitors', 'search-terms', 'geo'].includes(activeTab) && (
                        <div style={{ display: 'flex', gap: 4, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
                            {PRESETS.map((p) => (
                                <button
                                    key={p.value}
                                    onClick={() => setPreset(p.value)}
                                    style={{
                                        padding: '4px 10px', borderRadius: 6,
                                        background: preset === p.value ? 'var(--primary)' : 'transparent',
                                        border: 'none', color: preset === p.value ? '#fff' : 'var(--muted)',
                                        fontSize: 12, fontWeight: preset === p.value ? 600 : 400,
                                        cursor: 'pointer', transition: 'all 0.15s'
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => disconnectMutation.mutate()}
                        disabled={disconnectMutation.isPending}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#f87171' }}
                    >
                        <LogOut size={13} />
                        Disconnect
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {tabs.map((t) => (
                    <Tab
                        key={t.key}
                        label={t.label}
                        icon={t.icon}
                        active={activeTab === t.key}
                        onClick={() => setActiveTab(t.key)}
                        badge={t.badge}
                    />
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '20px 0' }}>
                {activeTab === 'overview' && <OverviewTab preset={preset} />}
                {activeTab === 'campaigns' && <CampaignsTab preset={preset} />}
                {activeTab === 'keywords' && <KeywordsTab preset={preset} />}
                {activeTab === 'competitors' && <CompetitorsTab preset={preset} />}
                {activeTab === 'search-terms' && <SearchTermsTab preset={preset} />}
                {activeTab === 'intelligence' && <IntelligenceTab />}
                {activeTab === 'geo' && <GeoTab preset={preset} />}
                {activeTab === 'creatives' && <CreativesTab />}
                {activeTab === 'alerts' && <AlertsTab />}
            </div>
        </div>
    );
}
