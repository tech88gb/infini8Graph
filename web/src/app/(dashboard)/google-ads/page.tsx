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
                {wasted.length > 0 ? (\n                        <table className="table">\n                            <thead>
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
                    ) : (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                            <CheckCircle size={24} style={{ color: '#10b981', margin: '0 auto 12px' }} />
                            <p style={{ fontSize: 13 }}>No high-spend wasted terms detected yet.</p>
                        </div>
                    )}
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
                    