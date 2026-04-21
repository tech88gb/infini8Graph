'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { googleAdsApi } from '@/lib/api';
import {
    PageExportMenu,
    appendDatasetTables,
    buildExportDocument,
    buildWorkbookBlob,
    downloadBlob,
    sanitizeFileName,
    tablesToMarkup,
    tablesToSheets,
    type ExportTable,
    type SectionExportFormat
} from '@/lib/pageExport';
import {
    BarChart2, TrendingUp, TrendingDown, DollarSign, MousePointer, Eye,
    Zap, AlertTriangle, CheckCircle, Info, AlertCircle, RefreshCw,
    ExternalLink, Tag, ChevronRight, Activity, Target, ListChecks,
    Layers, LogOut, BarChart, Search, Users, Globe, Cpu, Clock, MapPin,
    Crosshair, ShieldAlert, X, Sparkles, HelpCircle
} from 'lucide-react';
import {
    ConversionIntegrityTab, LocalImpactTab, CompetitorThreatTab, WastedSpendTab,
    LocalSearchDominanceTab, BiddingIntelligenceTab
} from '@/components/GoogleAdsIntelligentTabs';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    BarChart as ReBarChart, Bar, PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6'];

// ==================== HELPERS ====================

const fmt = (n: number, dec = 2) => n?.toLocaleString('en-US', { maximumFractionDigits: dec }) ?? '—';
const fmtINR = (n: number) => `₹${fmt(n, 2)}`;
const fmtPct = (n: number) => `${fmt(n, 2)}%`;

function buildGoogleAdsExportTables({
    preset,
    status,
    accounts,
    performance,
    budget,
    campaigns,
    keywords,
    auctionInsights,
    searchTerms,
    geography,
    alerts,
    bidding,
    qualityScore,
    assets
}: {
    preset: string;
    status: any;
    accounts: any;
    performance: any;
    budget: any;
    campaigns: any;
    keywords: any;
    auctionInsights: any;
    searchTerms: any;
    geography: any;
    alerts: any;
    bidding: any;
    qualityScore: any;
    assets: any;
}) {
    const tables: ExportTable[] = [
        {
            title: 'Export Context',
            subtitle: 'Google Ads account and reporting window',
            headers: ['Field', 'Value'],
            rows: [
                ['Customer ID', accounts?.customerId || status?.account?.customerId || '-'],
                ['Account Email', status?.account?.email || '-'],
                ['Preset', preset],
                ['Generated At', new Date().toLocaleString()]
            ],
            sheetName: 'Context'
        }
    ];

    appendDatasetTables(tables, 'Connection Status', status);
    appendDatasetTables(tables, 'Account Discovery', accounts);
    appendDatasetTables(tables, 'Performance Overview', performance);
    appendDatasetTables(tables, 'Budget Overview', budget);
    appendDatasetTables(tables, 'Campaigns', campaigns);
    appendDatasetTables(tables, 'Keywords', keywords);
    appendDatasetTables(tables, 'Auction Insights', auctionInsights);
    appendDatasetTables(tables, 'Search Terms', searchTerms);
    appendDatasetTables(tables, 'Geography', geography);
    appendDatasetTables(tables, 'Alerts', alerts);
    appendDatasetTables(tables, 'Bidding Intelligence', bidding);
    appendDatasetTables(tables, 'Quality Score', qualityScore);
    appendDatasetTables(tables, 'Asset Performance', assets);

    return tables;
}

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

function InfoTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const iconRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleMouseEnter = () => {
        if (iconRef.current) {
            setRect(iconRef.current.getBoundingClientRect());
            setShow(true);
        }
    };

    return (
        <div ref={iconRef} style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
            <HelpCircle
                size={14}
                style={{ color: 'var(--muted)', cursor: 'help', opacity: 0.7 }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShow(false)}
            />
            {mounted && show && rect && createPortal(
                <div style={{
                    position: 'absolute',
                    top: rect.top + window.scrollY - 8,
                    left: rect.left + rect.width / 2 + window.scrollX,
                    transform: 'translate(-50%, -100%)',
                    background: '#1e293b',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    width: Math.min(260, window.innerWidth - 32),
                    zIndex: 999999,
                    pointerEvents: 'none',
                    lineHeight: 1.5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    textAlign: 'center'
                }}>
                    {text}
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        borderWidth: 6,
                        borderStyle: 'solid',
                        borderColor: '#1e293b transparent transparent transparent'
                    }} />
                </div>,
                document.body
            )}
        </div>
    );
}

function HealthSignalCard({ item }: { item: any }) {
    const tones: Record<string, { color: string; bg: string; border: string; icon: any }> = {
        success: { color: '#10b981', bg: '#10b98112', border: '#10b98133', icon: CheckCircle },
        info: { color: '#6366f1', bg: '#6366f112', border: '#6366f133', icon: Info },
        warning: { color: '#f59e0b', bg: '#f59e0b12', border: '#f59e0b33', icon: AlertTriangle },
        danger: { color: '#ef4444', bg: '#ef444412', border: '#ef444433', icon: AlertCircle }
    };
    const tone = tones[item.tone] || tones.info;
    const Icon = tone.icon;

    return (
        <div className="card" style={{ padding: '14px 16px', background: tone.bg, border: `1px solid ${tone.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${tone.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} style={{ color: tone.color }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                        {item.title}
                        {item.tooltip && <InfoTooltip text={item.tooltip} />}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: tone.color, lineHeight: 1.1 }}>{item.value}</div>
                    <div style={{ marginTop: 5, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.note}
                    </div>
                </div>
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

function AccountSelector({ currentId, allIds, onSelect, loading }: { currentId: string, allIds: string[], onSelect: (id: string) => void, loading: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #4285F4, #34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart size={16} color="#fff" />
                </div>
                <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Ad Account</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{currentId || 'Discovering...'}</div>
                </div>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ display: 'flex', gap: 6 }}>
                {allIds.map(id => (
                    <button
                        key={id}
                        onClick={() => onSelect(id)}
                        disabled={loading}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: id === currentId ? 'var(--primary)' : 'transparent',
                            color: id === currentId ? '#fff' : 'var(--muted)',
                            border: id === currentId ? 'none' : '1px solid var(--border)'
                        }}
                    >
                        {loading && id === currentId ? '...' : id}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ==================== OVERVIEW TAB ====================

function OverviewTab({ preset }: { preset: string }) {
    // Primary query — this is the ONLY Google API call on initial load
    const { data: perf, isLoading, isError, error } = useQuery({
        queryKey: ['google-perf', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getPerformance(preset);
            if (!res.data.success) throw new Error(res.data.error || 'Failed to fetch performance data');
            return res.data.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    // Budget loads lazily AFTER performance succeeds — not simultaneously
    const { data: budgetData } = useQuery({
        queryKey: ['google-budget'],
        queryFn: async () => {
            const res = await googleAdsApi.getBudget();
            return res.data.data;
        },
        enabled: !!perf?.hasAdAccounts,
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
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
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 16 }}
                    onClick={() => {
                        window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'}/api/google/auth/login`;
                    }}
                >
                    Connect Google Ads
                </button>
            </div>
        );
    }

    const m = perf.metrics || {};
    const focus = perf.accountFocus || {};
    const valueTracking = perf.valueTracking || {};
    const showRevenueMetrics = !!valueTracking.trustedRevenueMetrics;
    const budgetCampaigns = budgetData?.campaigns || [];
    const activeBudgetCount = budgetCampaigns.filter((campaign: any) => Number(campaign.spent || 0) > 0).length;
    const highestBudgetPressure = budgetCampaigns[0] || null;
    const metricCards = [
        { label: 'Total Spend', value: fmtINR(m.spend), icon: DollarSign, color: '#6366f1', tooltip: 'Total spend across enabled campaigns in the selected reporting window.' },
        { label: 'Conversions', value: fmt(m.conversions, 0), icon: Target, color: '#f59e0b', tooltip: 'Total conversions reported by Google Ads for the selected period.' },
        { label: 'Cost / Conv.', value: fmtINR(m.costPerConversion), icon: Zap, color: '#0ea5e9', tooltip: 'Spend divided by conversions. Lower is usually better when conversion quality is stable.' },
        { label: 'Conversion Rate', value: fmtPct(m.conversionRate), icon: TrendingUp, color: '#10b981', tooltip: 'Conversions divided by clicks for the selected period.' },
        { label: 'Avg CPC', value: fmtINR(m.avgCpc), icon: MousePointer, color: '#ec4899', tooltip: 'Average cost per click across enabled campaigns.' },
        { label: 'CTR', value: fmtPct(m.ctr), icon: Activity, color: '#14b8a6', tooltip: 'Click-through rate across impressions in the selected window.' },
        ...(showRevenueMetrics
            ? [
                { label: 'Conv. Value', value: fmtINR(m.conversionValue), icon: BarChart2, color: '#8b5cf6', tooltip: 'Total tracked conversion value returned by Google Ads.' },
                { label: 'ROAS', value: m.roas ? `${m.roas.toFixed(2)}x` : '—', icon: TrendingUp, color: m.roas >= 4 ? '#10b981' : m.roas >= 2 ? '#f59e0b' : '#ef4444', tooltip: 'Tracked conversion value divided by spend. This is only shown when value tracking looks usable.' },
            ]
            : [
                { label: 'Clicks', value: fmt(m.clicks, 0), icon: MousePointer, color: '#ec4899', tooltip: 'Total clicks across enabled campaigns for the selected period.' },
                { label: 'Impressions', value: fmt(m.impressions, 0), icon: Eye, color: '#0ea5e9', tooltip: 'Total impressions served in the selected reporting window.' },
            ])
    ];
    const healthSignals = [
        {
            tone: m.conversionRate >= 8 ? 'success' : m.conversionRate >= 3 ? 'info' : 'warning',
            title: 'Conversion Efficiency',
            value: fmtPct(m.conversionRate),
            note: m.conversionRate >= 8 ? 'Strong click-to-conversion flow' : m.conversionRate >= 3 ? 'Usable, keep monitoring' : 'Needs landing/query cleanup',
            tooltip: 'Conversions divided by clicks for the selected window. This is the cleanest quick read on whether paid traffic is turning into actions.'
        },
        {
            tone: m.avgCpc <= 10 ? 'success' : m.avgCpc <= 25 ? 'info' : 'warning',
            title: 'Click Cost',
            value: fmtINR(m.avgCpc),
            note: m.avgCpc <= 10 ? 'CPC looks disciplined' : m.avgCpc <= 25 ? 'Manageable cost level' : 'Traffic is getting expensive',
            tooltip: 'Average cost per click across enabled campaigns in the selected period.'
        },
        {
            tone: valueTracking.quality === 'strong' ? 'success' : valueTracking.quality === 'partial' ? 'info' : 'warning',
            title: 'Value Tracking',
            value: valueTracking.quality === 'strong'
                ? 'Revenue-ready'
                : valueTracking.quality === 'partial'
                    ? 'Thin value data'
                : valueTracking.quality === 'weak'
                        ? 'Weak revenue signal'
                        : 'No clear value signal',
            note: showRevenueMetrics ? 'ROAS can lead the view' : 'Efficiency should lead the view',
            tooltip: 'A heuristic confidence read on whether conversion value data is strong enough to trust ROAS as a headline KPI.'
        },
        {
            tone: highestBudgetPressure?.utilization >= 90 ? 'warning' : activeBudgetCount > 0 ? 'info' : 'warning',
            title: 'Budget Pacing',
            value: highestBudgetPressure
                ? `${highestBudgetPressure.utilization}% top utilization`
                : 'No active pacing',
            note: highestBudgetPressure?.utilization >= 90
                ? 'One campaign is near cap'
                : activeBudgetCount > 0
                    ? `${activeBudgetCount} campaign${activeBudgetCount > 1 ? 's' : ''} spending today`
                    : 'No meaningful spend yet',
            tooltip: 'Today-only pacing read based on campaign budget usage returned by Google Ads. This is intentionally separate from the selected reporting window.'
        }
    ];
    const summaryStats = [
        { label: 'Focus', value: focus.label || 'Mixed', tooltip: 'High-level account classification inferred from campaign mix, channel types, and conversion/value behavior.' },
        { label: 'Primary Mix', value: focus.primaryMix || 'Mixed distribution', tooltip: 'The dominant campaign distribution in the account, weighted primarily by spend.' },
        { label: 'Mode', value: showRevenueMetrics ? 'Revenue-aware' : 'Efficiency-first', tooltip: 'Whether the overview should prioritize ROAS/value metrics or operate as an efficiency-first dashboard.' },
        { label: 'Value / Conv.', value: m.valuePerConversion ? fmtINR(m.valuePerConversion) : '—', tooltip: 'Average tracked conversion value per conversion in the selected period.' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                            Overview Read
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>{focus.label || 'Mixed'}</div>
                        <span className="badge badge-info">{showRevenueMetrics ? 'ROAS usable' : 'ROAS secondary'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {showRevenueMetrics ? 'Revenue-led view' : 'Efficiency-led view'}
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                    {summaryStats.map((item, index) => (
                        <div key={index} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--background)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                                {item.label}
                                {item.tooltip && <InfoTooltip text={item.tooltip} />}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                {healthSignals.map((item, index) => (
                    <HealthSignalCard key={index} item={item} />
                ))}
            </div>

            {/* Top Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {metricCards.map((stat, i) => (
                    <div key={i} className="card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ padding: 6, borderRadius: 6, background: `${stat.color}22` }}>
                                <stat.icon size={14} style={{ color: stat.color }} />
                            </div>
                            <span className="text-muted" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center' }}>
                                {stat.label}
                                {stat.tooltip && <InfoTooltip text={stat.tooltip} />}
                            </span>
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

        </div>
    );
}

// ==================== CAMPAIGNS TAB ====================

function FilterPill({
    label,
    active,
    onClick,
    tone = 'default'
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
    const tones: Record<string, { color: string; bg: string; border: string }> = {
        default: { color: 'var(--muted)', bg: 'transparent', border: 'var(--border)' },
        success: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)' },
        warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' },
        danger: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)' },
        info: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.28)' },
    };
    const styleTone = active ? tones[tone] || tones.default : tones.default;

    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${styleTone.border}`,
                background: styleTone.bg,
                color: styleTone.color,
                transition: 'all 0.15s ease'
            }}
        >
            {label}
        </button>
    );
}

function getCampaignHealth(campaign: any, accountMetrics: any, wasteSpend = 0) {
    const accountCostPerConversion = Number(accountMetrics?.costPerConversion || 0);
    const accountCtr = Number(accountMetrics?.ctr || 0);
    const costPerConversion = Number(campaign?.costPerConversion || 0);
    const ctr = Number(campaign?.ctr || 0);
    const conversions = Number(campaign?.conversions || 0);
    const spend = Number(campaign?.spend || 0);
    const roas = Number(campaign?.roas || 0);

    if ((conversions >= 8 && costPerConversion > 0 && accountCostPerConversion > 0 && costPerConversion <= accountCostPerConversion * 0.8) || roas >= 3) {
        return { key: 'scale', label: 'Scale', tone: 'success', note: 'Efficiency is beating account baseline.' };
    }
    if ((spend >= 50 && conversions === 0) || wasteSpend >= 50 || (campaign?.impressions > 1500 && ctr < Math.max(accountCtr * 0.55, 1))) {
        return { key: 'fix', label: 'Fix now', tone: 'danger', note: 'Spend is leaking or engagement is too weak.' };
    }
    if (conversions > 0 || spend > 0) {
        return { key: 'watch', label: 'Watch', tone: 'warning', note: 'Active, but not yet a scale signal.' };
    }
    return { key: 'idle', label: 'Idle', tone: 'default', note: 'No meaningful delivery in this window.' };
}

function classifyKeywordIntent(text: string) {
    const value = String(text || '').toLowerCase();
    if (/\bnear me|near|location|coimbatore|saravanampatti|pune|chennai|maps|visit\b/.test(value)) {
        return { key: 'local', label: 'Local', tone: 'success' as const };
    }
    if (/\bbrand|aaranya|cresendo|cinco\b/.test(value)) {
        return { key: 'brand', label: 'Brand', tone: 'info' as const };
    }
    if (/\bprice|cost|budget|affordable|luxury|best|top|review|compare\b/.test(value)) {
        return { key: 'comparison', label: 'Compare', tone: 'warning' as const };
    }
    return { key: 'category', label: 'Category', tone: 'default' as const };
}

function getKeywordHealth(keyword: any, accountMetrics: any) {
    const qs = Number(keyword?.qualityScore || 0);
    const spend = Number(keyword?.spend || 0);
    const conversions = Number(keyword?.conversions || 0);
    const ctr = Number(keyword?.ctr || 0);
    const accountCtr = Number(accountMetrics?.ctr || 0);
    const accountCostPerConversion = Number(accountMetrics?.costPerConversion || 0);
    const costPerConversion = Number(keyword?.costPerConversion || 0);

    if (conversions >= 5 && qs >= 7 && costPerConversion > 0 && accountCostPerConversion > 0 && costPerConversion <= accountCostPerConversion * 0.85) {
        return { key: 'scale', label: 'Scale', tone: 'success', note: 'Qualified and converting efficiently.' };
    }
    if ((spend >= 20 && conversions === 0) || qs > 0 && qs < 5 || (keyword?.impressions > 500 && ctr < Math.max(accountCtr * 0.6, 1))) {
        return { key: 'fix', label: 'Fix now', tone: 'danger', note: 'Quality or conversion efficiency is weak.' };
    }
    if (keyword?.clicks > 0 || spend > 0) {
        return { key: 'watch', label: 'Watch', tone: 'warning', note: 'Needs more proof before scaling.' };
    }
    return { key: 'idle', label: 'Idle', tone: 'default', note: 'Not contributing enough data yet.' };
}

function CampaignsTab({ preset }: { preset: string }) {
    const [search, setSearch] = useState('');
    const [channelFilter, setChannelFilter] = useState('all');
    const [healthFilter, setHealthFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const { data, isLoading } = useQuery({
        queryKey: ['google-campaigns', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getCampaigns(preset);
            return res.data.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    const { data: budgetData } = useQuery({
        queryKey: ['google-budget-campaign-ops'],
        queryFn: async () => {
            const res = await googleAdsApi.getBudget();
            return res.data.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    const { data: perfData } = useQuery({
        queryKey: ['google-perf-campaign-ops', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getPerformance(preset);
            return res.data.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    const { data: searchTermData } = useQuery({
        queryKey: ['google-search-terms-campaign-ops', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getSearchTerms(preset);
            return res.data.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const campaigns = data?.campaigns || [];
    const metrics = perfData?.metrics || {};
    const budgetById = new Map((budgetData?.campaigns || []).map((campaign: any) => [String(campaign.id), campaign]));
    const wasteByCampaign = new Map<string, { spend: number; clicks: number; count: number }>();
    (searchTermData?.wastedSpend || []).forEach((term: any) => {
        const key = String(term.campaign || '').trim();
        const current = wasteByCampaign.get(key) || { spend: 0, clicks: 0, count: 0 };
        current.spend += Number(term.spend || 0);
        current.clicks += Number(term.clicks || 0);
        current.count += 1;
        wasteByCampaign.set(key, current);
    });
    const totalSpend = campaigns.reduce((sum: number, campaign: any) => sum + Number(campaign.spend || 0), 0);
    const channels: string[] = ['all', ...Array.from(new Set<string>(campaigns.map((campaign: any) => String(campaign.channelType || 'Unknown')).filter(Boolean)))];

    const enrichedCampaigns = campaigns.map((campaign: any) => {
        const budget = budgetById.get(String(campaign.id));
        const waste = wasteByCampaign.get(String(campaign.name || '').trim()) || { spend: 0, clicks: 0, count: 0 };
        const health = getCampaignHealth(campaign, metrics, waste.spend);
        const spendShare = totalSpend > 0 ? (Number(campaign.spend || 0) / totalSpend) * 100 : 0;
        return {
            ...campaign,
            budget,
            waste,
            health,
            spendShare,
            action: health.key === 'scale'
                ? 'Scale carefully'
                : health.key === 'fix'
                    ? 'Tighten or pause'
                    : health.key === 'watch'
                        ? 'Monitor efficiency'
                        : 'Low activity',
        };
    });

    const filteredCampaigns = enrichedCampaigns.filter((campaign: any) => {
        const matchesSearch = !search || String(campaign.name || '').toLowerCase().includes(search.toLowerCase());
        const matchesChannel = channelFilter === 'all' || String(campaign.channelType || '') === channelFilter;
        const matchesHealth = healthFilter === 'all' || campaign.health.key === healthFilter;
        const matchesStatus = statusFilter === 'all' || String(campaign.status || '').toLowerCase() === statusFilter;
        return matchesSearch && matchesChannel && matchesHealth && matchesStatus;
    });

    const scaleCount = enrichedCampaigns.filter((campaign: any) => campaign.health.key === 'scale').length;
    const fixCount = enrichedCampaigns.filter((campaign: any) => campaign.health.key === 'fix').length;
    const topConcentration = enrichedCampaigns.slice(0, 3).reduce((sum: number, campaign: any) => sum + campaign.spendShare, 0);
    const hotBudgets = enrichedCampaigns.filter((campaign: any) => Number(campaign.budget?.utilization || 0) >= 85).length;

    if (!campaigns.length) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Target size={40} style={{ color: 'var(--muted)', margin: '0 auto 16px' }} />
                <p className="text-muted">No campaign data available for this period.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                            Campaign Operator View
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>Scale, fix, or watch</div>
                        <span className="badge badge-info">{preset} window</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Built for decisions: spend share, efficiency, pacing, and leak risk by campaign
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                    <HealthSignalCard item={{
                        tone: scaleCount > 0 ? 'success' : 'info',
                        title: 'Scale Candidates',
                        value: String(scaleCount),
                        note: scaleCount > 0 ? 'Campaigns beating account efficiency' : 'No obvious scale campaigns yet',
                        tooltip: 'Campaigns with enough conversion volume and efficiency to justify cautious budget expansion.'
                    }} />
                    <HealthSignalCard item={{
                        tone: fixCount > 0 ? 'danger' : 'success',
                        title: 'Fix Now',
                        value: String(fixCount),
                        note: fixCount > 0 ? 'Spend leakage or weak engagement' : 'No major campaign leaks surfaced',
                        tooltip: 'Campaigns with poor conversion efficiency, weak CTR, or obvious waste that should be tightened before more spend is added.'
                    }} />
                    <HealthSignalCard item={{
                        tone: topConcentration >= 70 ? 'warning' : 'info',
                        title: 'Spend Concentration',
                        value: `${topConcentration.toFixed(0)}%`,
                        note: 'Top 3 campaigns share of spend',
                        tooltip: 'How much of total campaign spend is concentrated in the top three campaigns. High concentration raises dependency risk.'
                    }} />
                    <HealthSignalCard item={{
                        tone: hotBudgets > 0 ? 'warning' : 'info',
                        title: 'Hot Budgets Today',
                        value: String(hotBudgets),
                        note: hotBudgets > 0 ? 'Campaigns close to daily caps' : 'No campaign close to cap',
                        tooltip: 'Today-only pacing read. These campaigns are nearing their daily budget limit and may stop serving before the day ends.'
                    }} />
                </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                            <input
                                placeholder="Find campaign..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    background: 'var(--background)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    padding: '7px 10px 7px 30px',
                                    fontSize: 13,
                                    color: 'var(--foreground)',
                                    width: 190
                                }}
                            />
                        </div>
                        {channels.map((channel) => (
                            <FilterPill
                                key={channel}
                                label={channel === 'all' ? 'All channels' : channel.replaceAll('_', ' ')}
                                active={channelFilter === channel}
                                onClick={() => setChannelFilter(channel)}
                                tone="info"
                            />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: 'All health', tone: 'default' },
                            { key: 'scale', label: 'Scale', tone: 'success' },
                            { key: 'watch', label: 'Watch', tone: 'warning' },
                            { key: 'fix', label: 'Fix now', tone: 'danger' }
                        ].map((item) => (
                            <FilterPill
                                key={item.key}
                                label={item.label}
                                active={healthFilter === item.key}
                                onClick={() => setHealthFilter(item.key)}
                                tone={item.tone as any}
                            />
                        ))}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                background: 'var(--background)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '7px 10px',
                                fontSize: 12,
                                color: 'var(--foreground)'
                            }}
                        >
                            <option value="all">All statuses</option>
                            <option value="enabled">Enabled</option>
                            <option value="paused">Paused</option>
                        </select>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Campaign</th>
                                <th>Health</th>
                                <th>Spend Share</th>
                                <th>Conv.</th>
                                <th>CVR</th>
                                <th>Cost / Conv.</th>
                                <th>Avg CPC</th>
                                <th>Search IS</th>
                                <th>Budget Today</th>
                                <th>Waste Risk</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCampaigns.map((campaign: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ minWidth: 230 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{campaign.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{campaign.channelType?.replaceAll('_', ' ') || 'Unknown'}</span>
                                            <StatusBadge status={campaign.status} />
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: 999,
                                            background: campaign.health.tone === 'success' ? 'rgba(16,185,129,0.15)' : campaign.health.tone === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                            color: campaign.health.tone === 'success' ? '#10b981' : campaign.health.tone === 'danger' ? '#ef4444' : '#f59e0b'
                                        }}>
                                            {campaign.health.label}
                                        </span>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{campaign.health.note}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{campaign.spendShare.toFixed(1)}%</div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtINR(campaign.spend)}</div>
                                    </td>
                                    <td>{fmt(campaign.conversions, 1)}</td>
                                    <td>{fmtPct(campaign.conversionRate)}</td>
                                    <td>{campaign.costPerConversion > 0 ? fmtINR(campaign.costPerConversion) : '—'}</td>
                                    <td>{fmtINR(campaign.cpc)}</td>
                                    <td>{campaign.searchImpressionShare > 0 ? `${campaign.searchImpressionShare.toFixed(1)}%` : '—'}</td>
                                    <td>
                                        {campaign.budget ? (
                                            <>
                                                <div style={{ fontWeight: 700 }}>{campaign.budget.utilization}%</div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtINR(campaign.budget.spent)} / {fmtINR(campaign.budget.budgetAmount)}</div>
                                            </>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        {campaign.waste.count > 0 ? (
                                            <>
                                                <div style={{ fontWeight: 700, color: campaign.waste.spend >= 50 ? '#ef4444' : '#f59e0b' }}>{fmtINR(campaign.waste.spend)}</div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{campaign.waste.count} zero-conv terms</div>
                                            </>
                                        ) : 'Clean'}
                                    </td>
                                    <td style={{ minWidth: 150 }}>
                                        <div style={{ fontWeight: 700 }}>{campaign.action}</div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                                            {campaign.health.key === 'scale'
                                                ? 'Protect query quality before adding budget.'
                                                : campaign.health.key === 'fix'
                                                    ? 'Narrow targeting, review search terms, or pause leakage.'
                                                    : 'Track until efficiency proves out.'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!filteredCampaigns.length && (
                    <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--muted)' }}>
                        No campaigns match the current filters.
                    </div>
                )}
            </div>
        </div>
    );
}

// ==================== KEYWORDS TAB ====================

function KeywordsTab({ preset }: { preset: string }) {
    const [search, setSearch] = useState('');
    const [matchFilter, setMatchFilter] = useState('all');
    const [healthFilter, setHealthFilter] = useState('all');
    const [qualityFilter, setQualityFilter] = useState('all');
    const [intentFilter, setIntentFilter] = useState('all');

    const { data, isLoading } = useQuery({
        queryKey: ['google-keywords', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getKeywords(preset);
            return res.data.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    const { data: perfData } = useQuery({
        queryKey: ['google-perf-keyword-ops', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getPerformance(preset);
            return res.data.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const allKeywords = data?.keywords || [];
    const lowQuality = data?.lowQuality || [];
    const metrics = perfData?.metrics || {};
    const totalKeywordSpend = allKeywords.reduce((sum: number, keyword: any) => sum + Number(keyword.spend || 0), 0);
    const matchTypes: string[] = ['all', ...Array.from(new Set<string>(allKeywords.map((keyword: any) => String(keyword.matchType || 'UNKNOWN')).filter(Boolean)))];

    const enrichedKeywords = allKeywords.map((keyword: any) => {
        const health = getKeywordHealth(keyword, metrics);
        const intent = classifyKeywordIntent(keyword.keyword);
        const spendShare = totalKeywordSpend > 0 ? (Number(keyword.spend || 0) / totalKeywordSpend) * 100 : 0;
        const campaignFootprint = Array.isArray(keyword.campaignNames) ? keyword.campaignNames.length : (keyword.campaignName ? 1 : 0);
        return {
            ...keyword,
            health,
            intent,
            spendShare,
            campaignFootprint,
            qualityBucket: keyword.qualityScore === null || keyword.qualityScore === undefined
                ? 'unknown'
                : keyword.qualityScore >= 7
                    ? 'strong'
                    : keyword.qualityScore >= 5
                        ? 'mid'
                        : 'weak'
        };
    });

    const keywords = enrichedKeywords.filter((keyword: any) => {
        const matchesSearch = !search || String(keyword.keyword || '').toLowerCase().includes(search.toLowerCase());
        const matchesMatch = matchFilter === 'all' || String(keyword.matchType || '') === matchFilter;
        const matchesHealth = healthFilter === 'all' || keyword.health.key === healthFilter;
        const matchesQuality = qualityFilter === 'all' || keyword.qualityBucket === qualityFilter;
        const matchesIntent = intentFilter === 'all' || keyword.intent.key === intentFilter;
        return matchesSearch && matchesMatch && matchesHealth && matchesQuality && matchesIntent;
    });

    const scaleKeywords = enrichedKeywords.filter((keyword: any) => keyword.health.key === 'scale').length;
    const fixKeywords = enrichedKeywords.filter((keyword: any) => keyword.health.key === 'fix').length;
    const exactPhraseShare = allKeywords.length > 0
        ? (allKeywords.filter((keyword: any) => /EXACT|PHRASE/i.test(String(keyword.matchType || ''))).length / allKeywords.length) * 100
        : 0;
    const lowQualitySpend = lowQuality.reduce((sum: number, keyword: any) => sum + Number(keyword.spend || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                            Keyword Operating View
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>Quality, intent, and scale fit</div>
                        <span className="badge badge-info">{preset} window</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Built to separate scalable search intent from quality drag and loose traffic
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                    <HealthSignalCard item={{
                        tone: scaleKeywords > 0 ? 'success' : 'info',
                        title: 'Scale Keywords',
                        value: String(scaleKeywords),
                        note: scaleKeywords > 0 ? 'Qualified terms beating account baseline' : 'No clear scale keywords yet',
                        tooltip: 'Keywords with strong quality and conversion efficiency relative to the account average.'
                    }} />
                    <HealthSignalCard item={{
                        tone: fixKeywords > 0 ? 'danger' : 'success',
                        title: 'Fix Keywords',
                        value: String(fixKeywords),
                        note: fixKeywords > 0 ? 'Weak quality or poor conversion fit' : 'No major keyword leaks surfaced',
                        tooltip: 'Keywords that should be tightened because of low quality, high spend without return, or weak click-through rate.'
                    }} />
                    <HealthSignalCard item={{
                        tone: exactPhraseShare >= 45 ? 'success' : 'warning',
                        title: 'Exact / Phrase Share',
                        value: `${exactPhraseShare.toFixed(0)}%`,
                        note: exactPhraseShare >= 45 ? 'Query mix is fairly disciplined' : 'Query mix still leans broad',
                        tooltip: 'Share of tracked keywords using exact or phrase match. Higher shares usually mean stronger query control.'
                    }} />
                    <HealthSignalCard item={{
                        tone: lowQualitySpend > 0 ? 'warning' : 'success',
                        title: 'Spend In Low QS',
                        value: fmtINR(lowQualitySpend),
                        note: lowQuality.length > 0 ? `${lowQuality.length} keywords need relevance work` : 'No low-QS keywords surfaced',
                        tooltip: 'Total spend attached to keywords with low Quality Score. This is expensive traffic that deserves relevance cleanup.'
                    }} />
                </div>
            </div>

            {lowQuality.length > 0 && (
                <div style={{
                    padding: 14, borderRadius: 10, background: '#f59e0b11', border: '1px solid #f59e0b33',
                    display: 'flex', gap: 10, alignItems: 'flex-start'
                }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                            {lowQuality.length} keyword{lowQuality.length > 1 ? 's' : ''} are dragging quality
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                            This tab is centered on operator actions, so use the filters below to isolate weak query themes, low Quality Score spend, or scalable exact-match clusters.
                        </p>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Keyword Workbench</h3>
                    <span className="badge badge-info">{keywords.length} shown</span>
                </div>
                <div style={{ padding: '0 20px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                        <input
                            placeholder="Find keyword..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                background: 'var(--background)', border: '1px solid var(--border)',
                                borderRadius: 8, padding: '6px 10px 6px 30px', fontSize: 13,
                                color: 'var(--foreground)', width: 180
                            }}
                        />
                    </div>
                    {[
                        { key: 'all', label: 'All health', tone: 'default' },
                        { key: 'scale', label: 'Scale', tone: 'success' },
                        { key: 'watch', label: 'Watch', tone: 'warning' },
                        { key: 'fix', label: 'Fix now', tone: 'danger' }
                    ].map((item) => (
                        <FilterPill
                            key={item.key}
                            label={item.label}
                            active={healthFilter === item.key}
                            onClick={() => setHealthFilter(item.key)}
                            tone={item.tone as any}
                        />
                    ))}
                    <select value={matchFilter} onChange={(e) => setMatchFilter(e.target.value)} style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--foreground)' }}>
                        <option value="all">All matches</option>
                        {matchTypes.filter((match) => match !== 'all').map((match) => (
                            <option key={match} value={match}>{match.replace('MATCH_TYPE_', '').replaceAll('_', ' ')}</option>
                        ))}
                    </select>
                    <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--foreground)' }}>
                        <option value="all">All quality</option>
                        <option value="strong">Strong QS</option>
                        <option value="mid">Mid QS</option>
                        <option value="weak">Weak QS</option>
                        <option value="unknown">Unknown QS</option>
                    </select>
                    <select value={intentFilter} onChange={(e) => setIntentFilter(e.target.value)} style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--foreground)' }}>
                        <option value="all">All intent</option>
                        <option value="brand">Brand</option>
                        <option value="local">Local</option>
                        <option value="comparison">Compare</option>
                        <option value="category">Category</option>
                    </select>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Keyword</th>
                                <th>Intent</th>
                                <th>Health</th>
                                <th>Match</th>
                                <th>Quality Score</th>
                                <th>Diagnostics</th>
                                <th>Clicks</th>
                                <th>Conv.</th>
                                <th>CVR</th>
                                <th>Cost / Conv.</th>
                                <th>Spend Share</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {keywords.map((k: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ minWidth: 230 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{k.keyword}</div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                                            {k.campaignFootprint > 1 ? `${k.campaignFootprint} campaigns` : (k.campaignName || 'Campaign not surfaced')}
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: 999,
                                            background: k.intent.tone === 'success' ? 'rgba(16,185,129,0.15)' : k.intent.tone === 'warning' ? 'rgba(245,158,11,0.15)' : k.intent.tone === 'info' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.15)',
                                            color: k.intent.tone === 'success' ? '#10b981' : k.intent.tone === 'warning' ? '#f59e0b' : k.intent.tone === 'info' ? '#6366f1' : 'var(--muted)'
                                        }}>
                                            {k.intent.label}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: 999,
                                            background: k.health.tone === 'success' ? 'rgba(16,185,129,0.15)' : k.health.tone === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                            color: k.health.tone === 'success' ? '#10b981' : k.health.tone === 'danger' ? '#ef4444' : '#f59e0b'
                                        }}>
                                            {k.health.label}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--card-hover)', color: 'var(--muted)' }}>
                                            {String(k.matchType || '').replace('MATCH_TYPE_', '') || '—'}
                                        </span>
                                    </td>
                                    <td><QualityScore score={k.qualityScore} /></td>
                                    <td style={{ minWidth: 180 }}>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pred. CTR: {String(k.searchPredictedCtr || '—').replaceAll('_', ' ')}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Ad rel.: {String(k.creativeQualityScore || '—').replaceAll('_', ' ')}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Landing: {String(k.postClickQualityScore || '—').replaceAll('_', ' ')}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{fmt(k.clicks, 0)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtPct(k.ctr)} CTR</div>
                                    </td>
                                    <td>{fmt(k.conversions, 1)}</td>
                                    <td>{fmtPct(k.conversionRate)}</td>
                                    <td>{k.costPerConversion > 0 ? fmtINR(k.costPerConversion) : '—'}</td>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{k.spendShare.toFixed(1)}%</div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtINR(k.spend)}</div>
                                    </td>
                                    <td style={{ minWidth: 150 }}>
                                        <div style={{ fontWeight: 700 }}>{k.health.key === 'scale' ? 'Lean in' : k.health.key === 'fix' ? 'Tighten relevance' : 'Keep observing'}</div>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{k.health.note}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!keywords.length && (
                    <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--muted)' }}>
                        No keywords match the current filters.
                    </div>
                )}
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
            const res = await googleAdsApi.getAssetData('30d');
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

function AlertsTab({ preset }: { preset: string }) {
    const [severityFilter, setSeverityFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['google-alerts', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getAlerts(preset);
            return res.data.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    if (isLoading) return <div className="spinner" style={{ margin: '60px auto' }} />;

    const alerts = data?.alerts || [];
    const summary = data?.summary || {};
    const danger = alerts.filter((a: any) => a.type === 'danger');
    const warning = alerts.filter((a: any) => a.type === 'warning');
    const success = alerts.filter((a: any) => a.type === 'success');
    const info = alerts.filter((a: any) => a.type === 'info');
    const categories: string[] = ['all', ...Array.from(new Set<string>(alerts.map((alert: any) => String(alert.category || 'Other'))))];
    const filteredAlerts = alerts.filter((alert: any) => {
        const matchesSeverity = severityFilter === 'all' || alert.type === severityFilter;
        const matchesCategory = categoryFilter === 'all' || alert.category === categoryFilter;
        return matchesSeverity && matchesCategory;
    });

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
            <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                            Action Center
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>What needs operator attention now</div>
                        <span className="badge badge-info">{preset} window</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        This tab is the command center: what to fix now, what to watch, and what is ready to scale
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                    <HealthSignalCard item={{
                        tone: danger.length > 0 ? 'danger' : 'success',
                        title: 'Urgent Actions',
                        value: String(summary.urgent ?? danger.length),
                        note: danger.length > 0 ? 'Campaign or query leaks need action' : 'No urgent blockers surfaced',
                        tooltip: 'Critical issues that can waste spend or hide conversion problems if left alone.'
                    }} />
                    <HealthSignalCard item={{
                        tone: (summary.spendAtRisk || 0) > 0 ? 'warning' : 'success',
                        title: 'Spend At Risk',
                        value: fmtINR(summary.spendAtRisk || 0),
                        note: `${summary.zeroConvTerms || 0} zero-conversion terms surfaced`,
                        tooltip: 'Search-term spend currently sitting in obvious waste candidates.'
                    }} />
                    <HealthSignalCard item={{
                        tone: (summary.pacingRisks || 0) > 0 ? 'warning' : 'info',
                        title: 'Budget Pacing Risks',
                        value: String(summary.pacingRisks || 0),
                        note: (summary.pacingRisks || 0) > 0 ? 'Campaigns near daily cap today' : 'No pacing pressure right now',
                        tooltip: 'Today-only budget warnings for campaigns that may stop delivering before the day ends.'
                    }} />
                    <HealthSignalCard item={{
                        tone: success.length > 0 ? 'success' : 'info',
                        title: 'Scale Signals',
                        value: String(success.length),
                        note: success.length > 0 ? 'Positive pockets worth protecting' : 'No clear scale wins surfaced',
                        tooltip: 'Opportunities where campaign efficiency is strong enough to consider more budget or broader reach.'
                    }} />
                </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: 'All', tone: 'default' },
                            { key: 'danger', label: 'Urgent', tone: 'danger' },
                            { key: 'warning', label: 'Watch', tone: 'warning' },
                            { key: 'success', label: 'Scale', tone: 'success' },
                            { key: 'info', label: 'Info', tone: 'info' }
                        ].map((item) => (
                            <FilterPill
                                key={item.key}
                                label={item.label}
                                active={severityFilter === item.key}
                                onClick={() => setSeverityFilter(item.key)}
                                tone={item.tone as any}
                            />
                        ))}
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            style={{
                                background: 'var(--background)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '7px 10px',
                                fontSize: 12,
                                color: 'var(--foreground)'
                            }}
                        >
                            <option value="all">All categories</option>
                            {categories.filter((category) => category !== 'all').map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="btn btn-secondary btn-sm"
                    >
                        <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredAlerts.map((alert: any, i: number) => (
                        <div key={i} style={{
                            padding: '14px 16px',
                            borderRadius: 12,
                            background: alert.type === 'danger' ? 'rgba(239,68,68,0.10)' : alert.type === 'warning' ? 'rgba(245,158,11,0.10)' : alert.type === 'success' ? 'rgba(16,185,129,0.10)' : 'rgba(99,102,241,0.10)',
                            border: alert.type === 'danger' ? '1px solid rgba(239,68,68,0.25)' : alert.type === 'warning' ? '1px solid rgba(245,158,11,0.25)' : alert.type === 'success' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(99,102,241,0.25)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(15,23,42,0.18)', color: 'var(--foreground)' }}>
                                            {alert.category}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: alert.type === 'danger' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : alert.type === 'success' ? '#10b981' : '#6366f1' }}>
                                            {alert.type.toUpperCase()}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{alert.title}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{alert.message}</div>
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{alert.metric}</div>
                            </div>
                            {alert.nextStep && (
                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(148,163,184,0.16)' }}>
                                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Next move</div>
                                    <div style={{ fontSize: 12 }}>{alert.nextStep}</div>
                                </div>
                            )}
                        </div>
                    ))}

                    {!filteredAlerts.length && (
                        <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--muted)' }}>
                            No alerts match the current filters.
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card" style={{ padding: 16 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Action Stack</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>Fix first</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {danger[0]?.title || warning[0]?.title || 'No urgent blocker surfaced.'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>Watch next</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {warning[0]?.title || info[0]?.title || 'No watchlist issue surfaced.'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>Scale signal</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {success[0]?.title || 'No scale signal surfaced yet.'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 16 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Alert Mix</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'Urgent', count: danger.length, color: '#ef4444' },
                                { label: 'Warning', count: warning.length, color: '#f59e0b' },
                                { label: 'Scale', count: success.length, color: '#10b981' },
                                { label: 'Info', count: info.length, color: '#6366f1' },
                            ].map((item, index) => (
                                <div key={index}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 12 }}>{item.label}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.count}</span>
                                    </div>
                                    <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                                        <div style={{ width: `${alerts.length ? (item.count / alerts.length) * 100 : 0}%`, height: '100%', background: item.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
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
                    style={{ 
                        width: '100%', 
                        justifyContent: 'center', 
                        padding: '12px 24px', 
                        fontSize: 15,
                        backgroundColor: '#ffffff',
                        color: '#757575',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontWeight: 500,
                        fontFamily: 'Roboto, sans-serif',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px 0 rgba(0,0,0,.25)',
                        transition: 'background-color .218s, border-color .218s, box-shadow .218s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f8f8'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                    {loading ? (
                        <><div className="spinner" style={{ width: 16, height: 16, borderColor: '#757575', borderTopColor: 'transparent' }} /> Redirecting...</>
                    ) : (
                        <>
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 48 48" style={{ display: 'block' }}>
                                <g>
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                    <path fill="none" d="M0 0h48v48H0z"></path>
                                </g>
                            </svg>
                            <span style={{ flexGrow: 1, textAlign: 'center' }}>Sign in with Google</span>
                        </>
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
    const [showTip, setShowTip] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const dismissed = window.localStorage.getItem('onboarding-tip:google-ads');
        if (!dismissed) {
            setShowTip(true);
        }
    }, []);

    const dismissTip = () => {
        setShowTip(false);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('onboarding-tip:google-ads', 'dismissed');
        }
    };

    const { data: status, isLoading: statusLoading } = useQuery({
        queryKey: ['google-status'],
        queryFn: async () => {
            const res = await googleAdsApi.getStatus();
            return res.data;
        },
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: 1
    });

    const { data: accountsData, isLoading: accountsLoading } = useQuery({
        queryKey: ['google-accounts'],
        queryFn: async () => {
            const res = await googleAdsApi.getDiscovery();
            return res.data.data;
        },
        enabled: !!status?.connected,
        staleTime: 300000
    });

    const switchMutation = useMutation({
        mutationFn: async (id: string) => {
            await googleAdsApi.updateAccount({ customerId: id });
        },
        onSuccess: async () => {
            const isGoogleQuery = (queryKey: readonly unknown[]) =>
                typeof queryKey[0] === 'string' && queryKey[0].startsWith('google-');

            await queryClient.invalidateQueries({
                predicate: (query) => isGoogleQuery(query.queryKey),
            });
            await queryClient.refetchQueries({
                predicate: (query) => isGoogleQuery(query.queryKey),
                type: 'active',
            });
        }
    });

    // Alerts: only fetched when user is actually on the Alerts tab.
    // getRecommendations runs 3 sub-queries (campaigns+keywords+budget) inside
    // it — we do NOT want those hitting Google on every page load.
    const { data: alertsData } = useQuery({
        queryKey: ['google-alerts', preset],
        queryFn: async () => {
            const res = await googleAdsApi.getAlerts(preset);
            return res.data.data;
        },
        enabled: !!status?.connected && activeTab === 'alerts',
        staleTime: 300000,
        refetchOnWindowFocus: false,
        retry: false
    });

    const disconnectMutation = useMutation({
        mutationFn: async () => {
            await googleAdsApi.disconnect();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-status'] });
        }
    });

    const onboardingTip = showTip ? (
        <div
            className="card"
            style={{
                marginBottom: 20,
                border: '1px solid rgba(16,185,129,0.24)',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.08))',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(16,185,129,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={18} style={{ color: '#6ee7b7' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>First look guide</div>
                        <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                            Start in `Overview` for spend and ROAS, then use `Keywords` to spot wasted budget and `Alerts` for issues that need action. Account switching stays at the top so you always know which Google Ads client you are viewing.
                        </p>
                    </div>
                </div>
                <button type="button" onClick={dismissTip} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
                    <X size={14} />
                    Dismiss
                </button>
            </div>
        </div>
    ) : null;

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
                {onboardingTip}
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

    const tabs = [
        { key: 'overview', label: 'Overview', icon: BarChart2 },
        { key: 'true-roas', label: 'Conversion Integrity', icon: Activity },
        { key: 'local', label: 'Geo Performance', icon: MapPin },
        { key: 'local-search', label: 'Local Search Dominance', icon: Globe },
        { key: 'bidding-intel', label: 'Bidding Intelligence', icon: ShieldAlert },
        { key: 'search-terms', label: 'Wasted Spend', icon: Zap },
        { key: 'campaigns', label: 'Campaigns', icon: Target },
        { key: 'keywords', label: 'Keywords', icon: Search },
        { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
    ];

    const handlePageExport = async (format: SectionExportFormat) => {
        const [
            latestStatus,
            latestAccounts,
            latestPerformance,
            latestBudget,
            latestCampaigns,
            latestKeywords,
            latestAuctionInsights,
            latestSearchTerms,
            latestGeo,
            latestAlerts,
            latestBidding,
            latestQualityScore,
            latestAssets
        ] = await Promise.all([
            googleAdsApi.getStatus().then((res) => res.data).catch(() => status),
            googleAdsApi.getDiscovery().then((res) => res.data.data).catch(() => accountsData),
            googleAdsApi.getPerformance(preset).then((res) => res.data.data).catch(() => null),
            googleAdsApi.getBudget().then((res) => res.data.data).catch(() => null),
            googleAdsApi.getCampaigns(preset).then((res) => res.data.data).catch(() => null),
            googleAdsApi.getKeywords(preset).then((res) => res.data.data).catch(() => null),
            googleAdsApi.getAuctionInsights(preset).then((res) => res.data.data).catch(() => null),
            googleAdsApi.getSearchTerms(preset).then((res) => res.data.data).catch(() => null),
            googleAdsApi.getGeo(preset).then((res) => res.data.data).catch(() => null),
            googleAdsApi.getAlerts(preset).then((res) => res.data.data).catch(() => alertsData),
            googleAdsApi.getBidding(preset).then((res) => res.data.data).catch(() => null),
            googleAdsApi.getQualityScore().then((res) => res.data.data).catch(() => null),
            googleAdsApi.getAssetData(preset).then((res) => res.data.data).catch(() => null)
        ]);

        const customerId = latestAccounts?.customerId || latestStatus?.account?.customerId || 'google-ads';
        const reportTitle = `Google Ads ${customerId} Report`;
        const reportSubtitle = `${preset} export for ${latestStatus?.account?.email || customerId}`;
        const tables = buildGoogleAdsExportTables({
            preset,
            status: latestStatus,
            accounts: latestAccounts,
            performance: latestPerformance,
            budget: latestBudget,
            campaigns: latestCampaigns,
            keywords: latestKeywords,
            auctionInsights: latestAuctionInsights,
            searchTerms: latestSearchTerms,
            geography: latestGeo,
            alerts: latestAlerts,
            bidding: latestBidding,
            qualityScore: latestQualityScore,
            assets: latestAssets
        });

        if (format === 'excel') {
            const workbookBlob = buildWorkbookBlob(reportTitle, tablesToSheets(tables));
            downloadBlob(workbookBlob, `${sanitizeFileName(reportTitle)}.xlsx`);
            return;
        }

        const markup = tablesToMarkup(tables);
        const documentMarkup = buildExportDocument(reportTitle, reportSubtitle, markup, format);
        downloadBlob(new Blob([documentMarkup], { type: 'text/html;charset=utf-8' }), `${sanitizeFileName(reportTitle)}.html`);
    };

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {onboardingTip}

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
                    {['overview', 'campaigns', 'keywords', 'search-terms', 'local', 'true-roas', 'local-search', 'bidding-intel', 'alerts'].includes(activeTab) && (
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
                    <PageExportMenu onExport={handlePageExport} />
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

            {/* Account Picker */}
            <AccountSelector
                currentId={accountsData?.customerId || ''}
                allIds={accountsData?.allClientIds || []}
                onSelect={(id) => switchMutation.mutate(id)}
                loading={switchMutation.isPending}
            />

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {tabs.map((t) => (
                    <Tab
                        key={t.key}
                        label={t.label}
                        icon={t.icon}
                        active={activeTab === t.key}
                        onClick={() => setActiveTab(t.key)}
                    />
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '20px 0' }}>
                {activeTab === 'overview' && <OverviewTab preset={preset} />}
                {activeTab === 'true-roas' && <ConversionIntegrityTab preset={preset} />}
                {activeTab === 'local' && <LocalImpactTab />}
                {activeTab === 'local-search' && <LocalSearchDominanceTab preset={preset} />}
                {activeTab === 'bidding-intel' && <BiddingIntelligenceTab preset={preset} />}
                {activeTab === 'competitors' && <BiddingIntelligenceTab preset={preset} />}
                {activeTab === 'campaigns' && <CampaignsTab preset={preset} />}
                {activeTab === 'keywords' && <KeywordsTab preset={preset} />}
                {activeTab === 'search-terms' && <WastedSpendTab preset={preset} />}
                {activeTab === 'alerts' && <AlertsTab preset={preset} />}
            </div>
        </div>
    );
}
