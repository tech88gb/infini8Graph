'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { adsApi } from '@/lib/api';
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
    IndianRupee, Eye, MousePointer, Users, BarChart3,
    Play, Target, Layers, TrendingUp, HelpCircle, Smartphone, Monitor,
    Globe, MapPin, Award, Zap, DollarSign, ExternalLink, ChevronDown, ChevronUp,
    Filter, Calendar, Clock, ArrowRight, ShoppingCart, CreditCard, Package, Brain, Activity
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
    XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

// ==================== HELPERS ====================

function formatCurrency(value: string | number, currency = 'INR') {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(num);
}

function formatNumber(value: string | number) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('en-IN');
}

function formatPercent(value: string | number) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0%';
    return num.toFixed(2) + '%';
}

function formatRoas(value: number | string) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!num || isNaN(num) || num === 0) return '0x';
    return num.toFixed(2) + 'x';
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6'];

function toTitleCase(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCompactPercent(value: string | number, digits = 1) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0%';
    return `${num.toFixed(digits)}%`;
}

function formatShortDate(value?: string | null) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function getDaysLive(startTime?: string | null) {
    if (!startTime) return null;
    const start = new Date(startTime).getTime();
    if (Number.isNaN(start)) return null;
    const diffMs = Date.now() - start;
    return diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
}

function getScoreTone(value: number) {
    if (value >= 75) return { bg: 'rgba(16, 185, 129, 0.16)', border: 'rgba(16, 185, 129, 0.35)', color: '#34d399', label: 'Strong' };
    if (value >= 45) return { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', label: 'Promising' };
    return { bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.28)', color: '#f87171', label: 'Watch' };
}

function getConfidenceTone(label: string) {
    if (label === 'High confidence') return { bg: 'rgba(16, 185, 129, 0.14)', color: '#86efac' };
    if (label === 'Medium confidence') return { bg: 'rgba(59, 130, 246, 0.14)', color: '#93c5fd' };
    return { bg: 'rgba(148, 163, 184, 0.16)', color: '#cbd5e1' };
}

function findMetricEntry(entries: any[] = [], candidates: string[] = []) {
    return entries.find((entry: any) => {
        const type = String(entry?.type || entry?.action_type || '').toLowerCase();
        return candidates.some((candidate) => type.includes(candidate));
    }) || null;
}

function buildMetaAdsOverviewMetrics({
    accountProfile,
    summary,
    roas,
    clickMetrics,
    conversions,
    actionValues,
    costPerAction
}: {
    accountProfile: any;
    summary: any;
    roas: any;
    clickMetrics: any;
    conversions: any[];
    actionValues: any[];
    costPerAction: any[];
}) {
    const purchaseMetric = findMetricEntry(conversions, ['purchase']);
    const purchaseValueMetric = findMetricEntry(actionValues, ['purchase']);
    const purchaseCostMetric = findMetricEntry(costPerAction, ['purchase']);
    const leadMetric = findMetricEntry(conversions, ['lead']);
    const leadCostMetric = findMetricEntry(costPerAction, ['lead']);
    const engagementMetric = findMetricEntry(conversions, ['post_engagement', 'page_engagement']);
    const engagementCostMetric = findMetricEntry(costPerAction, ['post_engagement', 'page_engagement']);
    const appInstallMetric = findMetricEntry(conversions, ['app_install', 'mobile_app_install']);
    const appInstallCostMetric = findMetricEntry(costPerAction, ['app_install', 'mobile_app_install']);

    const configByType: Record<string, Array<any>> = {
        sales: [
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'Purchase ROAS',
                value: formatRoas(roas.purchaseRoas || 0),
                icon: TrendingUp,
                color: '#22c55e',
                tooltip: 'Return on ad spend from tracked purchases'
            },
            {
                label: 'Purchase Value',
                value: formatCurrency(purchaseValueMetric?.value || 0),
                icon: CreditCard,
                color: '#8b5cf6',
                tooltip: 'Tracked revenue value attributed to ads'
            },
            {
                label: 'Purchases',
                value: formatNumber(purchaseMetric?.value || 0),
                icon: Package,
                color: '#f59e0b',
                tooltip: 'Tracked purchase actions attributed to ads'
            },
            {
                label: 'Cost / Purchase',
                value: formatCurrency(purchaseCostMetric?.value || 0),
                icon: DollarSign,
                color: '#ef4444',
                tooltip: 'Average spend required to drive one purchase'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#0ea5e9',
                trend: summary.comparison?.clicksTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Click-through rate across all ads'
            }
        ],
        leads: [
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'Leads',
                value: formatNumber(leadMetric?.value || 0),
                icon: Target,
                color: '#6366f1',
                tooltip: 'Tracked lead conversions from campaigns'
            },
            {
                label: 'Cost / Lead',
                value: formatCurrency(leadCostMetric?.value || 0),
                icon: DollarSign,
                color: '#f97316',
                tooltip: 'Average spend required to drive one lead'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#0ea5e9',
                trend: summary.comparison?.clicksTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Click-through rate across all ads'
            },
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#8b5cf6',
                trend: summary.comparison?.reachTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#ec4899',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of times your ads were shown on screen'
            }
        ],
        traffic: [
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'Outbound Clicks',
                value: formatNumber(clickMetrics.outboundClicks || 0),
                icon: ArrowRight,
                color: '#0ea5e9',
                tooltip: 'Clicks that sent people off Meta to your destination'
            },
            {
                label: 'Cost / Link Click',
                value: formatCurrency(clickMetrics.costPerInlineLinkClick || summary.cpc || 0),
                icon: DollarSign,
                color: '#8b5cf6',
                tooltip: 'Average cost per click to your destination'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#f59e0b',
                trend: summary.comparison?.clicksTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Click-through rate across all ads'
            },
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#6366f1',
                trend: summary.comparison?.reachTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#ec4899',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of times your ads were shown on screen'
            }
        ],
        awareness: [
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#8b5cf6',
                trend: summary.comparison?.reachTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#0ea5e9',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of times your ads were shown on screen'
            },
            {
                label: 'CPM',
                value: formatCurrency(parseFloat(summary.cpm || 0)),
                icon: DollarSign,
                color: '#ec4899',
                tooltip: 'Cost per 1,000 impressions'
            },
            {
                label: 'Frequency',
                value: parseFloat(summary.frequency || 0).toFixed(2),
                icon: Activity,
                color: '#14b8a6',
                tooltip: 'Average number of times each person saw your ad'
            },
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#f59e0b',
                trend: summary.comparison?.clicksTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Click-through rate across all ads'
            }
        ],
        engagement: [
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'Engagements',
                value: formatNumber(engagementMetric?.value || 0),
                icon: Activity,
                color: '#ec4899',
                tooltip: 'Tracked engagement actions from campaigns'
            },
            {
                label: 'Cost / Engagement',
                value: formatCurrency(engagementCostMetric?.value || 0),
                icon: DollarSign,
                color: '#f97316',
                tooltip: 'Average spend required to drive one engagement'
            },
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#6366f1',
                trend: summary.comparison?.reachTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#0ea5e9',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of times your ads were shown on screen'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#f59e0b',
                trend: summary.comparison?.clicksTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Click-through rate across all ads'
            }
        ],
        app_promotion: [
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'App Installs',
                value: formatNumber(appInstallMetric?.value || 0),
                icon: Smartphone,
                color: '#0ea5e9',
                tooltip: 'Tracked app install actions from campaigns'
            },
            {
                label: 'Cost / Install',
                value: formatCurrency(appInstallCostMetric?.value || 0),
                icon: DollarSign,
                color: '#f97316',
                tooltip: 'Average spend required to drive one app install'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#f59e0b',
                trend: summary.comparison?.clicksTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Click-through rate across all ads'
            },
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#6366f1',
                trend: summary.comparison?.reachTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#ec4899',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: summary.comparison?.label,
                tooltip: 'Number of times your ads were shown on screen'
            }
        ]
    };

    return configByType[accountProfile?.type || 'mixed'] || [
        {
            label: 'Total Spend',
            value: formatCurrency(summary.spend),
            icon: IndianRupee,
            color: '#10b981',
            trend: summary.comparison?.spendTrend,
            trendLabel: summary.comparison?.label,
            tooltip: 'Total amount spent on ads for this account'
        },
        {
            label: 'Impressions',
            value: formatNumber(summary.impressions),
            icon: Eye,
            color: '#0ea5e9',
            trend: summary.comparison?.impressionsTrend,
            trendLabel: summary.comparison?.label,
            tooltip: 'Number of times your ads were shown on screen'
        },
        {
            label: 'Reach',
            value: formatNumber(summary.reach),
            icon: Users,
            color: '#8b5cf6',
            trend: summary.comparison?.reachTrend,
            trendLabel: summary.comparison?.label,
            tooltip: 'Number of unique people who saw your ads'
        },
        {
            label: 'Clicks',
            value: formatNumber(summary.clicks),
            icon: MousePointer,
            color: '#f59e0b',
            trend: summary.comparison?.clicksTrend,
            trendLabel: summary.comparison?.label,
            tooltip: 'Number of clicks on your ads'
        }
    ];
}

const FUNNEL_STAGE_EXPLANATIONS: Record<string, string> = {
    landing_page_view: 'People who clicked the ad and successfully loaded the landing page.',
    view_content: 'People who viewed a tracked product or content page after landing.',
    add_to_cart: 'People who added at least one item to cart.',
    initiate_checkout: 'People who started the checkout flow.',
    add_payment_info: 'People who reached the payment-details step.',
    purchase: 'Completed purchase events tracked by Meta Pixel or Conversions API.'
};

function buildAdsExportTables({
    accountName,
    accountId,
    datePreset,
    insightsData,
    demographicsData,
    placementsData,
    geographyData,
    campaignsData,
    funnelData,
    intelligenceData,
    advancedData,
    deepInsightsData
}: {
    accountName: string;
    accountId: string;
    datePreset: string;
    insightsData: any;
    demographicsData: any;
    placementsData: any;
    geographyData: any;
    campaignsData: any;
    funnelData: any;
    intelligenceData: any;
    advancedData: any;
    deepInsightsData: any;
}) {
    const tables: ExportTable[] = [
        {
            title: 'Export Context',
            subtitle: 'Meta Ads account and reporting window',
            headers: ['Field', 'Value'],
            rows: [
                ['Account Name', accountName],
                ['Account ID', accountId],
                ['Preset', toTitleCase(datePreset)],
                ['Generated At', new Date().toLocaleString()]
            ],
            sheetName: 'Context'
        }
    ];

    appendDatasetTables(tables, 'Account Summary', insightsData?.data?.summary);
    appendDatasetTables(tables, 'Relevance Diagnostics', insightsData?.data?.relevanceDiagnostics);
    appendDatasetTables(tables, 'ROAS Metrics', insightsData?.data?.roas);
    appendDatasetTables(tables, 'Click Metrics', insightsData?.data?.clickMetrics);
    appendDatasetTables(tables, 'Daily Performance', insightsData?.data?.daily);
    appendDatasetTables(tables, 'Device Breakdown', insightsData?.data?.devices);
    appendDatasetTables(tables, 'Position Breakdown', placementsData?.data?.positions || insightsData?.data?.positions);
    appendDatasetTables(tables, 'Video Views', insightsData?.data?.videoViews);
    appendDatasetTables(tables, 'Conversions', insightsData?.data?.conversions);
    appendDatasetTables(tables, 'Action Values', insightsData?.data?.actionValues);
    appendDatasetTables(tables, 'Cost Per Action', insightsData?.data?.costPerAction);
    appendDatasetTables(tables, 'Campaigns', campaignsData?.data?.campaigns);
    appendDatasetTables(tables, 'Demographics', demographicsData?.data?.demographics);
    appendDatasetTables(tables, 'Placements', placementsData?.data?.placements);
    appendDatasetTables(tables, 'Countries', geographyData?.data?.countries);
    appendDatasetTables(tables, 'Regions', geographyData?.data?.regions);
    appendDatasetTables(tables, 'Conversion Funnel', funnelData?.data);
    appendDatasetTables(tables, 'Campaign Intelligence', intelligenceData?.data);
    appendDatasetTables(tables, 'Advanced Analytics', advancedData?.data);
    appendDatasetTables(tables, 'Deep Insights', deepInsightsData?.data);

    return tables;
}

// ==================== TOOLTIP COMPONENT ====================

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

// ==================== METRIC CARDS ====================

function MetricCard({ label, value, icon: Icon, trend, trendLabel, color, tooltip }: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    trend?: number;
    trendLabel?: string;
    color: string;
    tooltip?: string;
}) {
    return (
        <div className="metric-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="metric-icon" style={{ background: `${color}15`, color, width: 36, height: 36 }}>
                    <Icon size={18} />
                </div>
                {tooltip && <InfoTooltip text={tooltip} />}
            </div>
            <div className="metric-value" style={{ fontSize: 22, color, marginBottom: 4 }}>{value}</div>
            <div className="metric-label" style={{ fontSize: 12, marginBottom: 8 }}>{label}</div>

            {trend !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                    {trend >= 0 ? (
                        <TrendingUp size={14} style={{ color: '#10b981' }} />
                    ) : (
                        <TrendingUp size={14} style={{ color: '#ef4444', transform: 'rotate(180deg)' }} />
                    )}
                    <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: trend >= 0 ? '#10b981' : '#ef4444'
                    }}>
                        {trend >= 0 ? '+' : ''}{trend}%
                    </span>
                    {trendLabel && (
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>
                            {trendLabel}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// ==================== SECTION COMPONENTS ====================

function SectionCard({ title, subtitle, children, collapsible = false, defaultOpen = true }: {
    title: string | React.ReactNode; subtitle?: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="card" style={{ marginBottom: 20, overflow: 'visible' }}>
            <div
                className="card-header"
                style={{ cursor: collapsible ? 'pointer' : 'default', marginBottom: open ? 16 : 0 }}
                onClick={() => collapsible && setOpen(!open)}
            >
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {title}
                    </h3>
                    {subtitle && <p className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
                </div>
                {collapsible && (open ? <ChevronUp size={18} /> : <ChevronDown size={18} />)}
            </div>
            {open && children}
        </div>
    );
}

function RankingBadge({ value, type }: { value: string; type: 'quality' | 'engagement' | 'conversion' }) {
    const normalizedValue = (value || 'UNKNOWN').toUpperCase();
    const isUnknown = normalizedValue === 'UNKNOWN' || normalizedValue === '' || normalizedValue === 'N/A';
    const isGood = normalizedValue.includes('ABOVE') || normalizedValue === 'AVERAGE';
    const isBad = normalizedValue.includes('BELOW');

    const bgColor = isUnknown ? '#f1f5f9' : isGood ? '#dcfce7' : isBad ? '#fee2e2' : '#fef3c7';
    const textColor = isUnknown ? '#64748b' : isGood ? '#166534' : isBad ? '#991b1b' : '#92400e';

    // Format the display text
    let displayText = 'Not Available';
    if (!isUnknown) {
        displayText = value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        // Clean up common patterns
        displayText = displayText
            .replace('Below Average 10', 'Below Avg (Bottom 10%)')
            .replace('Below Average 20', 'Below Avg (Bottom 20%)')
            .replace('Below Average 35', 'Below Avg (Bottom 35%)')
            .replace('Above Average', 'Above Average')
            .replace('Average', 'Average');
    }

    return (
        <span style={{
            background: bgColor,
            color: textColor,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            display: 'inline-block'
        }}>
            {displayText}
        </span>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="btn btn-sm"
            style={{
                background: active ? 'var(--primary)' : 'transparent',
                color: active ? 'white' : 'var(--muted)',
                border: active ? 'none' : '1px solid var(--border)'
            }}
        >
            {children}
        </button>
    );
}

const TAB_META: Record<string, { label: string; tooltip: string }> = {
    overview: {
        label: 'Overview',
        tooltip: 'Your high-level ad account snapshot with the most important KPIs for the selected period.'
    },
    funnel: {
        label: 'Conversion Funnel',
        tooltip: 'Tracks the path from click to purchase using Meta standard events like landing page view, view content, add to cart, checkout, and purchase.'
    },
    intelligence: {
        label: 'Optimize',
        tooltip: 'Prioritisation layer for timing, placements, and campaigns. Useful when deciding what to scale, protect, or deprioritise.'
    },
    advanced: {
        label: 'Health',
        tooltip: 'Diagnostic view for fatigue, learning phase, quality signals, and other delivery or creative health indicators.'
    },
    deep: {
        label: 'Diagnostics',
        tooltip: 'Detailed forensic views like bounce gaps, nurture patterns, hook performance, and placement inefficiencies.'
    },
    campaigns: {
        label: 'Campaigns',
        tooltip: 'Campaign-level breakdown of spend and delivery.'
    },
    demographics: {
        label: 'Demographics',
        tooltip: 'Audience performance by age and gender.'
    },
    geo: {
        label: 'Geography',
        tooltip: 'Performance by country and region.'
    }
};

// ==================== MAIN PAGE ====================

export default function AdsPage() {
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'funnel' | 'intelligence' | 'advanced' | 'deep' | 'campaigns' | 'demographics' | 'geo'>('overview');
    const [datePreset, setDatePreset] = useState<'today' | 'last_7d' | 'last_14d' | 'last_30d' | 'last_90d' | 'maximum'>('today');
    const [campaignSearch, setCampaignSearch] = useState('');
    const [campaignTypeFilter, setCampaignTypeFilter] = useState('all');
    const [campaignStatusFilter, setCampaignStatusFilter] = useState('all');
    const [campaignSort, setCampaignSort] = useState('spend_desc');
    const [campaignPage, setCampaignPage] = useState(1);

    // Fetch accounts
    const { data: accountsData, isLoading: accountsLoading } = useQuery({
        queryKey: ['ad-accounts'],
        queryFn: async () => {
            const res = await adsApi.getAdAccounts();
            return res.data;
        },
        refetchOnWindowFocus: false
    });

    const adAccounts = accountsData?.data?.adAccounts || [];
    const effectiveAccount = selectedAccount || accountsData?.data?.defaultAccountId || adAccounts[0]?.account_id;

    // Fetch detailed insights
    const { data: insightsData, isLoading: insightsLoading } = useQuery({
        queryKey: ['ad-insights', effectiveAccount, datePreset],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getAdInsights(effectiveAccount, datePreset);
            return res.data;
        },
        enabled: !!effectiveAccount,
        refetchOnWindowFocus: false
    });

    const { data: demographicsData, isLoading: demographicsLoading } = useQuery({
        queryKey: ['ad-demographics', effectiveAccount, datePreset],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getDemographics(effectiveAccount, datePreset);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'demographics',
        refetchOnWindowFocus: false
    });

    const { data: geographyData, isLoading: geographyLoading } = useQuery({
        queryKey: ['ad-geography', effectiveAccount, datePreset],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getGeography(effectiveAccount, datePreset);
            return res.data;
        },
        enabled: !!effectiveAccount && (activeTab === 'geo' || activeTab === 'demographics'),
        refetchOnWindowFocus: false
    });

    // Fetch campaigns
    const { data: campaignsData } = useQuery({
        queryKey: ['campaigns', effectiveAccount, datePreset],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getCampaigns(effectiveAccount, datePreset);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'campaigns'
    });

    // Fetch conversion funnel
    const { data: funnelData, isLoading: funnelLoading } = useQuery({
        queryKey: ['funnel', effectiveAccount, datePreset],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getConversionFunnel(effectiveAccount, datePreset);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'funnel'
    });

    // Fetch campaign intelligence
    const { data: intelligenceData, isLoading: intelligenceLoading } = useQuery({
        queryKey: ['intelligence', effectiveAccount, datePreset],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getCampaignIntelligence(effectiveAccount, datePreset);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'intelligence'
    });

    // Fetch advanced analytics
    const { data: advancedData, isLoading: advancedLoading } = useQuery({
        queryKey: ['advanced', effectiveAccount, datePreset],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getAdvancedAnalytics(effectiveAccount, datePreset);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'advanced'
    });

    // Fetch deep insights (Nurture Funnel, Bounce Gap, Video Hook, Placement Arbitrage)
    const { data: deepInsightsData, isLoading: deepInsightsLoading } = useQuery({
        queryKey: ['deep-insights', effectiveAccount, datePreset],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getDeepInsights(effectiveAccount, datePreset);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'deep'
    });

    // Extract data from insights
    const summary = insightsData?.data?.summary || {};
    const relevanceDiagnostics = insightsData?.data?.relevanceDiagnostics || {};
    const roas = insightsData?.data?.roas || {};
    const clickMetrics = insightsData?.data?.clickMetrics || {};
    const daily = insightsData?.data?.daily || [];
    const comparisonDaily = insightsData?.data?.comparisonDaily || [];
    const demographics = demographicsData?.data?.demographics || [];
    const devices = insightsData?.data?.devices || [];
    const positions = insightsData?.data?.positions || [];
    const countries = geographyData?.data?.countries || [];
    const regions = geographyData?.data?.regions || [];
    const regionPerformanceRows = [...regions]
        .filter((region: any) => Number(region?.spend || 0) > 0)
        .sort((a: any, b: any) => {
            const roasDiff = Number(b?.purchaseRoas || 0) - Number(a?.purchaseRoas || 0);
            if (roasDiff !== 0) return roasDiff;
            return Number(b?.purchaseValue || 0) - Number(a?.purchaseValue || 0);
        });
    const topRegionByRoas = regionPerformanceRows.find((region: any) => Number(region?.purchaseRoas || 0) > 0) || null;
    const topRegionByRevenue = [...regionPerformanceRows].sort((a: any, b: any) => Number(b?.purchaseValue || 0) - Number(a?.purchaseValue || 0))[0] || null;
    const regionRoasCoverage = regionPerformanceRows.filter((region: any) => Number(region?.purchaseRoas || 0) > 0).length;
    const videoViews = insightsData?.data?.videoViews || {};
    const conversions = insightsData?.data?.conversions || [];
    const actionValues = insightsData?.data?.actionValues || [];
    const costPerAction = insightsData?.data?.costPerAction || [];
    const campaigns = campaignsData?.data?.campaigns || [];
    const campaignSummary = campaignsData?.data?.summary || {};
    const accountProfile = insightsData?.data?.accountProfile || null;

    // Chart data
    const dailyChartData = daily.map((d: any) => ({
        date: new Date(d.date_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        spend: parseFloat(d.spend || 0),
        impressions: parseInt(d.impressions || 0),
        clicks: parseInt(d.clicks || 0),
        ctr: parseFloat(d.ctr || 0)
    }));
    const comparisonChartData = comparisonDaily.map((d: any) => ({
        spend: parseFloat(d.spend || 0),
        impressions: parseInt(d.impressions || 0),
        clicks: parseInt(d.clicks || 0),
        ctr: parseFloat(d.ctr || 0)
    }));
    const spendChartData = dailyChartData.map((day: any, index: number) => ({
        ...day,
        previousSpend: comparisonChartData[index]?.spend || 0
    }));

    const deviceChartData = devices.map((d: any) => ({
        name: d.device_platform === 'mobile_app' ? 'Mobile' : d.device_platform === 'desktop' ? 'Desktop' : d.device_platform,
        spend: parseFloat(d.spend || 0),
        impressions: parseInt(d.impressions || 0)
    }));

    const positionChartData = positions.slice(0, 8).map((p: any) => ({
        name: `${p.publisher_platform || ''} ${p.platform_position || ''}`.replace(/_/g, ' ').trim(),
        spend: parseFloat(p.spend || 0),
        impressions: parseInt(p.impressions || 0),
        ctr: parseFloat(p.ctr || 0)
    }));

    const selectedAccountMeta = adAccounts.find((account: any) => account.account_id === effectiveAccount);
    const objectiveMixLabel = accountProfile?.objectiveMix?.slice?.(0, 2)?.map((entry: any) => `${entry.label} ${entry.share}%`)?.join(' • ');
    const overviewMetricCards = buildMetaAdsOverviewMetrics({
        accountProfile,
        summary,
        roas,
        clickMetrics,
        conversions,
        actionValues,
        costPerAction
    });
    const showRoasSection = ['sales', 'mixed'].includes(accountProfile?.type) || Number(roas.purchaseRoas || 0) > 0 || Number(roas.websitePurchaseRoas || 0) > 0;
    const showConversionsSection = accountProfile?.type !== 'awareness';
    const showDiagnosticsSection = accountProfile?.type !== 'app_promotion';
    const showVideoRetentionSection = ['awareness', 'engagement', 'mixed'].includes(accountProfile?.type) || Object.values(videoViews || {}).some((value) => Number(value || 0) > 0);
    const spendComparisonLabel = datePreset === 'last_7d'
        ? 'This week vs last week'
        : datePreset === 'last_30d'
            ? 'This month vs last month'
            : datePreset === 'last_14d'
                ? 'Current 14 days vs previous 14 days'
                : datePreset === 'last_90d'
                    ? 'Current 90 days vs previous period'
                    : datePreset === 'today'
                        ? 'Today'
                    : 'Selected period';
    const campaignTypeOptions = useMemo(() => {
        const options = new Map<string, string>();
        campaigns.forEach((campaign: any) => {
            if (campaign?.type) options.set(campaign.type, campaign.typeLabel || toTitleCase(campaign.type));
        });
        return [{ value: 'all', label: 'All types' }, ...Array.from(options.entries()).map(([value, label]) => ({ value, label }))];
    }, [campaigns]);
    const campaignStatusOptions = useMemo(() => {
        const options = new Set<string>();
        campaigns.forEach((campaign: any) => {
            if (campaign?.effectiveStatus) options.add(campaign.effectiveStatus);
        });
        return ['all', ...Array.from(options)];
    }, [campaigns]);
    const filteredCampaigns = useMemo(() => {
        const search = campaignSearch.trim().toLowerCase();
        const filtered = campaigns.filter((campaign: any) => {
            const matchesSearch = !search || String(campaign?.name || '').toLowerCase().includes(search);
            const matchesType = campaignTypeFilter === 'all' || campaign?.type === campaignTypeFilter;
            const matchesStatus = campaignStatusFilter === 'all' || campaign?.effectiveStatus === campaignStatusFilter;
            return matchesSearch && matchesType && matchesStatus;
        });

        const sortValue = (campaign: any) => {
            switch (campaignSort) {
                case 'spend_desc':
                    return campaign?.metrics?.spend || 0;
                case 'results_desc':
                    return campaign?.primaryMetric?.value || 0;
                case 'roas_desc':
                    return campaign?.metrics?.purchaseRoas || 0;
                case 'ctr_desc':
                    return campaign?.metrics?.ctr || 0;
                case 'clicks_desc':
                    return campaign?.metrics?.linkClicks || 0;
                case 'cost_asc':
                    return campaign?.primaryMetric?.costValue || Number.MAX_SAFE_INTEGER;
                case 'cpm_asc':
                    return campaign?.metrics?.cpm || Number.MAX_SAFE_INTEGER;
                case 'updated_desc':
                    return new Date(campaign?.updated_time || campaign?.created_time || 0).getTime();
                case 'name_asc':
                    return String(campaign?.name || '').toLowerCase();
                default:
                    return campaign?.metrics?.spend || 0;
            }
        };

        return [...filtered].sort((a: any, b: any) => {
            if (campaignSort === 'name_asc') {
                return String(sortValue(a)).localeCompare(String(sortValue(b)));
            }
            if (campaignSort === 'cost_asc' || campaignSort === 'cpm_asc') {
                return Number(sortValue(a)) - Number(sortValue(b));
            }
            return Number(sortValue(b)) - Number(sortValue(a));
        });
    }, [campaigns, campaignSearch, campaignTypeFilter, campaignStatusFilter, campaignSort]);
    const campaignPageSize = 50;
    const campaignTotalPages = Math.max(1, Math.ceil(filteredCampaigns.length / campaignPageSize));
    const campaignPageStart = (campaignPage - 1) * campaignPageSize;
    const paginatedCampaigns = filteredCampaigns.slice(campaignPageStart, campaignPageStart + campaignPageSize);
    const campaignStatusHeadline = campaignStatusFilter === 'all' ? `${campaignSummary.active || 0} active now` : `${filteredCampaigns.length} matching ${campaignStatusFilter.toLowerCase()}`;
    const campaignRangeLabel = filteredCampaigns.length > 0
        ? `${campaignPageStart + 1}-${Math.min(campaignPageStart + campaignPageSize, filteredCampaigns.length)}`
        : '0-0';
    useEffect(() => {
        setCampaignPage(1);
    }, [campaignSearch, campaignTypeFilter, campaignStatusFilter, campaignSort, datePreset, effectiveAccount]);

    useEffect(() => {
        if (campaignPage > campaignTotalPages) {
            setCampaignPage(campaignTotalPages);
        }
    }, [campaignPage, campaignTotalPages]);

    if (accountsLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Loading ad accounts...</p>
                </div>
            </div>
        );
    }

    const videoRetentionCards = [
        { label: '25% watched', value: Number(videoViews.views_25 || 0), helper: 'Reached the 25% watch milestone' },
        {
            label: '50% watched',
            value: Number(videoViews.views_50 || 0),
            helper: videoViews.views_25 > 0 ? `${((Number(videoViews.views_50 || 0) / Number(videoViews.views_25 || 1)) * 100).toFixed(1)}% of 25% viewers continued` : 'Reached the 50% watch milestone'
        },
        {
            label: '75% watched',
            value: Number(videoViews.views_75 || 0),
            helper: videoViews.views_50 > 0 ? `${((Number(videoViews.views_75 || 0) / Number(videoViews.views_50 || 1)) * 100).toFixed(1)}% of 50% viewers continued` : 'Reached the 75% watch milestone'
        },
        {
            label: '100% watched',
            value: Number(videoViews.views_100 || 0),
            helper: videoViews.views_75 > 0 ? `${((Number(videoViews.views_100 || 0) / Number(videoViews.views_75 || 1)) * 100).toFixed(1)}% of 75% viewers completed` : 'Completed the video'
        }
    ];
    const deepProfileType = deepInsightsData?.data?.accountProfile?.type || 'general';
    const deepPlacementSummary = deepInsightsData?.data?.placementSummary || null;
    const deepPlacementRows = deepInsightsData?.data?.placementDiagnostics || [];

    const handlePageExport = async (format: SectionExportFormat) => {
        if (!effectiveAccount) return;

        const [
            latestInsights,
            latestDemographics,
            latestPlacements,
            latestGeography,
            latestCampaigns,
            latestFunnel,
            latestIntelligence,
            latestAdvanced,
            latestDeepInsights
        ] = await Promise.all([
            adsApi.getAdInsights(effectiveAccount, datePreset).then((res) => res.data).catch(() => insightsData),
            adsApi.getDemographics(effectiveAccount, datePreset).then((res) => res.data).catch(() => demographicsData),
            adsApi.getPlacements(effectiveAccount, datePreset).then((res) => res.data).catch(() => null),
            adsApi.getGeography(effectiveAccount, datePreset).then((res) => res.data).catch(() => geographyData),
            adsApi.getCampaigns(effectiveAccount, datePreset).then((res) => res.data).catch(() => campaignsData),
            adsApi.getConversionFunnel(effectiveAccount, datePreset).then((res) => res.data).catch(() => funnelData),
            adsApi.getCampaignIntelligence(effectiveAccount, datePreset).then((res) => res.data).catch(() => intelligenceData),
            adsApi.getAdvancedAnalytics(effectiveAccount, datePreset).then((res) => res.data).catch(() => advancedData),
            adsApi.getDeepInsights(effectiveAccount, datePreset).then((res) => res.data).catch(() => deepInsightsData)
        ]);

        const accountName = selectedAccountMeta?.name || selectedAccountMeta?.account_name || `Account ${effectiveAccount}`;
        const reportTitle = `${accountName} Meta Ads Report`;
        const reportSubtitle = `${toTitleCase(datePreset)} performance export for ${effectiveAccount}`;
        const tables = buildAdsExportTables({
            accountName,
            accountId: effectiveAccount,
            datePreset,
            insightsData: latestInsights,
            demographicsData: latestDemographics,
            placementsData: latestPlacements,
            geographyData: latestGeography,
            campaignsData: latestCampaigns,
            funnelData: latestFunnel,
            intelligenceData: latestIntelligence,
            advancedData: latestAdvanced,
            deepInsightsData: latestDeepInsights
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
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 className="page-title">Ads Analytics</h1>
                        <p className="page-subtitle">Facebook & Instagram advertising performance</p>
                    </div>
                    
                    {/* Date Preset Selector */}
                    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 8, overflowX: 'auto', maxWidth: '100%' }}>
                        {[
                            { value: 'today', label: 'Today' },
                            { value: 'last_7d', label: '7 Days' },
                            { value: 'last_14d', label: '14 Days' },
                            { value: 'last_30d', label: '30 Days' },
                            { value: 'last_90d', label: '90 Days' },
                            { value: 'maximum', label: 'Max' }
                        ].map((preset) => (
                            <button
                                key={preset.value}
                                onClick={() => setDatePreset(preset.value as any)}
                                style={{
                                    padding: '6px 14px',
                                    fontSize: 13,
                                    fontWeight: datePreset === preset.value ? 600 : 500,
                                    borderRadius: 6,
                                    background: datePreset === preset.value ? 'var(--primary)' : 'transparent',
                                    color: datePreset === preset.value ? 'white' : 'var(--muted)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <PageExportMenu onExport={handlePageExport} />
                </div>
            </div>

            {/* Account Selector */}
            {adAccounts.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                    {adAccounts.map((account: any) => (
                        <button
                            key={account.id}
                            onClick={() => setSelectedAccount(account.account_id)}
                            className="btn btn-sm"
                            style={{
                                background: effectiveAccount === account.account_id ? 'var(--primary)' : 'transparent',
                                color: effectiveAccount === account.account_id ? 'white' : 'var(--muted)',
                                border: '1px solid var(--border)'
                            }}
                        >
                            {account.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Summary Metrics */}
            {accountProfile?.label && (
                <div
                    className="card"
                    style={{
                        marginBottom: 20,
                        padding: 18,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                        flexWrap: 'wrap',
                        border: '1px solid rgba(99,102,241,0.22)',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08))'
                    }}
                >
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 6 }}>
                            Account Focus
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{accountProfile.label}</div>
                        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                            {accountProfile.description}
                            {objectiveMixLabel ? ` ${objectiveMixLabel}.` : ''}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(accountProfile.recommendedMetrics || []).slice(0, 6).map((metricKey: string) => (
                            <span
                                key={metricKey}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: 'var(--foreground)'
                                }}
                            >
                                {toTitleCase(metricKey)}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid-metrics" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {overviewMetricCards.map((metric) => (
                    <MetricCard key={metric.label} {...metric} />
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
                    <BarChart3 size={14} /> {TAB_META.overview.label} <InfoTooltip text={TAB_META.overview.tooltip} />
                </TabButton>
                <TabButton active={activeTab === 'funnel'} onClick={() => setActiveTab('funnel')}>
                    <Filter size={14} /> {TAB_META.funnel.label} <InfoTooltip text={TAB_META.funnel.tooltip} />
                </TabButton>
                <TabButton active={activeTab === 'intelligence'} onClick={() => setActiveTab('intelligence')}>
                    <Brain size={14} /> {TAB_META.intelligence.label} <InfoTooltip text={TAB_META.intelligence.tooltip} />
                </TabButton>
                <TabButton active={activeTab === 'advanced'} onClick={() => setActiveTab('advanced')}>
                    <Zap size={14} /> {TAB_META.advanced.label} <InfoTooltip text={TAB_META.advanced.tooltip} />
                </TabButton>
                <TabButton active={activeTab === 'deep'} onClick={() => setActiveTab('deep')}>
                    <Activity size={14} /> {TAB_META.deep.label} <InfoTooltip text={TAB_META.deep.tooltip} />
                </TabButton>
                <TabButton active={activeTab === 'campaigns'} onClick={() => setActiveTab('campaigns')}>
                    <Target size={14} /> {TAB_META.campaigns.label} <InfoTooltip text={TAB_META.campaigns.tooltip} />
                </TabButton>
                <TabButton active={activeTab === 'demographics'} onClick={() => setActiveTab('demographics')}>
                    <Users size={14} /> {TAB_META.demographics.label} <InfoTooltip text={TAB_META.demographics.tooltip} />
                </TabButton>
                <TabButton active={activeTab === 'geo'} onClick={() => setActiveTab('geo')}>
                    <Globe size={14} /> {TAB_META.geo.label} <InfoTooltip text={TAB_META.geo.tooltip} />
                </TabButton>
            </div>

            {/* ==================== OVERVIEW TAB ==================== */}
            {activeTab === 'overview' && (
                <div style={{ display: 'grid', gap: 20 }}>

                    {/* Ad Relevance Diagnostics */}
                    {showDiagnosticsSection && <SectionCard
                        title="Ad Relevance Diagnostics"
                        subtitle={`Aggregated from ${relevanceDiagnostics.adsWithData || 0} of ${relevanceDiagnostics.adsAnalyzed || 0} ads with ranking data`}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Award size={16} style={{ color: 'var(--primary)' }} />
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>Quality Ranking</span>
                                    <InfoTooltip text="Measures perceived ad quality based on user feedback like hiding or reporting ads, and positive signals like watch time" />
                                </div>
                                <RankingBadge value={relevanceDiagnostics.qualityRanking || 'N/A'} type="quality" />
                            </div>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Zap size={16} style={{ color: '#f59e0b' }} />
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>Engagement Ranking</span>
                                    <InfoTooltip text="Expected engagement rate (likes, comments, shares, clicks) compared to other ads competing for the same audience" />
                                </div>
                                <RankingBadge value={relevanceDiagnostics.engagementRateRanking || 'N/A'} type="engagement" />
                            </div>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Target size={16} style={{ color: '#10b981' }} />
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>Conversion Ranking</span>
                                    <InfoTooltip text="Expected conversion rate compared to ads with similar optimization goals targeting the same audience" />
                                </div>
                                <RankingBadge value={relevanceDiagnostics.conversionRateRanking || 'N/A'} type="conversion" />
                            </div>
                        </div>
                    </SectionCard>}

                    {/* ROAS & Value Metrics */}
                    {showRoasSection && <SectionCard
                        title="ROAS & Value Metrics"
                        subtitle={roas.purchaseRoas > 0 || roas.websitePurchaseRoas > 0
                            ? "Return on ad spend and monetary value from conversions"
                            : "No purchase tracking detected - showing available metrics"
                        }
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>Purchase ROAS</span>
                                    <InfoTooltip text="Return on ad spend for purchases. Requires Meta Pixel with purchase event tracking." />
                                </div>
                                {roas.purchaseRoas > 0 ? (
                                    <div style={{ fontSize: 24, fontWeight: 700, color: roas.purchaseRoas > 1 ? '#10b981' : 'var(--foreground)' }}>
                                        {formatRoas(roas.purchaseRoas)}
                                    </div>
                                ) : (
                                    <div>
                                        <span style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>No Data</span>
                                        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Needs Pixel purchase tracking</p>
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>Website ROAS</span>
                                    <InfoTooltip text="Return on ad spend specifically from website purchases" />
                                </div>
                                {roas.websitePurchaseRoas > 0 ? (
                                    <div style={{ fontSize: 24, fontWeight: 700, color: roas.websitePurchaseRoas > 1 ? '#10b981' : 'var(--foreground)' }}>
                                        {formatRoas(roas.websitePurchaseRoas)}
                                    </div>
                                ) : (
                                    <div>
                                        <span style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>No Data</span>
                                        <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Needs Pixel purchase tracking</p>
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>Outbound Clicks</span>
                                    <InfoTooltip text="Clicks that take people off Facebook/Instagram to your website or app" />
                                </div>
                                <div style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(clickMetrics.outboundClicks)}</div>
                            </div>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>Social Spend</span>
                                    <InfoTooltip text="Budget spent on impressions from social actions (likes, shares, comments creating organic reach)" />
                                </div>
                                <div style={{ fontSize: 24, fontWeight: 700 }}>{formatCurrency(parseFloat(clickMetrics.socialSpend || 0))}</div>
                            </div>
                        </div>
                    </SectionCard>}

                    {/* Performance Metrics */}
                    <SectionCard
                        title="Performance Metrics"
                        subtitle={accountProfile?.type === 'awareness'
                            ? 'Delivery and cost efficiency signals for awareness-focused campaigns'
                            : accountProfile?.type === 'traffic'
                                ? 'Click efficiency and delivery quality for traffic-oriented campaigns'
                                : accountProfile?.type === 'leads'
                                    ? 'Lead generation efficiency alongside delivery quality'
                                    : 'Key performance indicators for your ads'}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>CPM</span>
                                    <InfoTooltip text="Cost per 1,000 impressions. Lower is better for awareness campaigns" />
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 600 }}>{formatCurrency(parseFloat(summary.cpm || 0))}</div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>CPC</span>
                                    <InfoTooltip text="Cost per click. Lower is better for traffic campaigns" />
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 600 }}>{formatCurrency(parseFloat(summary.cpc || 0))}</div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>CTR</span>
                                    <InfoTooltip text="Click-through rate. Higher is better - indicates engaging ads" />
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--primary)' }}>{formatPercent(summary.ctr)}</div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>Frequency</span>
                                    <InfoTooltip text="Average times each person saw your ad. High frequency may cause ad fatigue" />
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 600 }}>{parseFloat(summary.frequency || 0).toFixed(2)}</div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Daily Trend Chart */}
                    {dailyChartData.length > 0 && (
                        <SectionCard
                            title="Daily Spend Trend"
                            subtitle={comparisonDaily.length > 0
                                ? `${spendComparisonLabel}. Current period is plotted against the matched previous period.`
                                : 'How your ad spend varied over time'}
                        >
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={spendChartData}>
                                    <defs>
                                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                                    <RechartsTooltip
                                        contentStyle={{ background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: 8 }}
                                        formatter={(value: any, name?: string) => [formatCurrency(value || 0), name === 'previousSpend' ? 'Previous Period Spend' : 'Current Spend']}
                                    />
                                    {comparisonDaily.length > 0 && (
                                        <Area
                                            type="monotone"
                                            dataKey="previousSpend"
                                            stroke="#6366f1"
                                            fillOpacity={0}
                                            strokeWidth={2}
                                            strokeDasharray="6 4"
                                        />
                                    )}
                                    <Area type="monotone" dataKey="spend" stroke="#10b981" fill="url(#spendGrad)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </SectionCard>
                    )}

                    {/* Video Retention & Conversions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {showVideoRetentionSection ? (
                        <SectionCard title="Video Retention" subtitle="Threshold counts from Meta video-view actions. Each milestone shows how many views reached that watch depth.">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                {videoRetentionCards.map((item, i) => (
                                    <div key={i} style={{ padding: 12, background: 'var(--background)', borderRadius: 8 }}>
                                        <div className="text-muted" style={{ fontSize: 11 }}>{item.label}</div>
                                        <div style={{ fontSize: 18, fontWeight: 600 }}>{formatNumber(item.value)}</div>
                                        <div className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>{item.helper}</div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                        ) : (
                        <SectionCard title="Delivery Mix" subtitle="Awareness-oriented accounts care more about delivery quality than conversion tracking">
                            <div style={{ display: 'grid', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>Reach</span>
                                    <strong>{formatNumber(summary.reach)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>Impressions</span>
                                    <strong>{formatNumber(summary.impressions)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>Frequency</span>
                                    <strong>{parseFloat(summary.frequency || 0).toFixed(2)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span className="text-muted" style={{ fontSize: 12 }}>CPM</span>
                                    <strong>{formatCurrency(parseFloat(summary.cpm || 0))}</strong>
                                </div>
                            </div>
                        </SectionCard>
                        )}

                        {showConversionsSection && <SectionCard title="Conversions" subtitle="Actions people took after seeing your ads">
                            {conversions.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {conversions.slice(0, 5).map((c: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ textTransform: 'capitalize', fontSize: 13 }}>{c.type.replace(/_/g, ' ')}</span>
                                            <span style={{ fontWeight: 600 }}>{formatNumber(c.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted">No conversion data available</p>
                            )}
                        </SectionCard>}
                    </div>

                    {/* Device Performance */}
                    {deviceChartData.length > 0 && (
                        <SectionCard
                            title={<span style={{ display: 'flex', alignItems: 'center' }}>Device Performance <InfoTooltip text="How your ads perform across Mobile vs Desktop devices" /></span>}
                            subtitle="How your ads perform on different devices"
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 32, alignItems: 'center' }}>
                                <ResponsiveContainer width="100%" height={200}>
                                    <RechartsPie>
                                        <Pie
                                            data={deviceChartData}
                                            dataKey="spend"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            labelLine={false}
                                        >
                                            {deviceChartData.map((_: any, i: number) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: any) => `₹${value.toLocaleString()}`} />
                                    </RechartsPie>
                                </ResponsiveContainer>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    {devices.map((d: any, i: number) => {
                                        const spendNum = parseFloat(d.spend) || 0;
                                        const totalSpend = devices.reduce((sum: number, dev: any) => sum + (parseFloat(dev.spend) || 0), 0);
                                        const percentage = totalSpend > 0 ? ((spendNum / totalSpend) * 100).toFixed(1) : '0';

                                        return (
                                            <div key={i} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '12px 16px',
                                                background: 'var(--background)',
                                                borderRadius: 8,
                                                borderLeft: `4px solid ${COLORS[i % COLORS.length]}`
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    {d.device_platform === 'mobile_app' || d.device_platform === 'mobile_web' ?
                                                        <Smartphone size={20} style={{ color: COLORS[i % COLORS.length] }} /> :
                                                        <Monitor size={20} style={{ color: COLORS[i % COLORS.length] }} />
                                                    }
                                                    <div>
                                                        <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                                            {d.device_platform?.replace(/_/g, ' ')}
                                                        </div>
                                                        <div className="text-muted" style={{ fontSize: 11 }}>
                                                            {formatNumber(d.impressions)} impressions
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(d.spend)}</div>
                                                    <div style={{
                                                        fontSize: 12,
                                                        color: COLORS[i % COLORS.length],
                                                        fontWeight: 600
                                                    }}>
                                                        {percentage}% of spend
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </SectionCard>
                    )}
                </div>
            )}

            {/* ==================== CAMPAIGNS TAB ==================== */}
            {activeTab === 'campaigns' && (
                <SectionCard
                    title={<span style={{ display: 'flex', alignItems: 'center' }}>{`Campaigns (${filteredCampaigns.length})`} <InfoTooltip text="Campaign workbench for the selected date range. Filter by campaign type or delivery status, then sort by spend, results, ROAS, CTR, click volume, CPM, or cost per result like you would in Ads Manager." /></span>}
                    subtitle={`Showing ${campaignRangeLabel} of ${filteredCampaigns.length} campaigns • ${campaignStatusHeadline}`}
                >
                    {campaigns.length > 0 ? (
                        <div style={{ display: 'grid', gap: 18 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Account Focus</div>
                                    <div style={{ fontSize: 20, fontWeight: 700 }}>{accountProfile?.displayLabel || 'Mixed'}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{objectiveMixLabel || 'Objective mix unavailable'}</div>
                                </div>
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Active Campaigns</div>
                                    <div style={{ fontSize: 20, fontWeight: 700 }}>{formatNumber(campaignSummary.active || 0)}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Running in this account right now</div>
                                </div>
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Filtered Campaigns</div>
                                    <div style={{ fontSize: 20, fontWeight: 700 }}>{formatNumber(filteredCampaigns.length)}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Sorted for the selected date window</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(3, minmax(160px, 0.8fr))', gap: 12 }}>
                                <input
                                    value={campaignSearch}
                                    onChange={(event) => setCampaignSearch(event.target.value)}
                                    placeholder="Search campaigns"
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid var(--border)',
                                        background: 'var(--background)',
                                        color: 'var(--foreground)'
                                    }}
                                />
                                <select
                                    value={campaignTypeFilter}
                                    onChange={(event) => setCampaignTypeFilter(event.target.value)}
                                    style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                                >
                                    {campaignTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                <select
                                    value={campaignStatusFilter}
                                    onChange={(event) => setCampaignStatusFilter(event.target.value)}
                                    style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                                >
                                    {campaignStatusOptions.map((option) => (
                                        <option key={option} value={option}>
                                            {option === 'all' ? 'All delivery states' : option.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={campaignSort}
                                    onChange={(event) => setCampaignSort(event.target.value)}
                                    style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                                >
                                    <option value="spend_desc">Sort: Highest spend</option>
                                    <option value="results_desc">Sort: Most results</option>
                                    <option value="roas_desc">Sort: Highest ROAS</option>
                                    <option value="ctr_desc">Sort: Highest CTR</option>
                                    <option value="clicks_desc">Sort: Most link clicks</option>
                                    <option value="cost_asc">Sort: Lowest cost / result</option>
                                    <option value="cpm_asc">Sort: Lowest CPM</option>
                                    <option value="updated_desc">Sort: Recently updated</option>
                                    <option value="name_asc">Sort: Name A-Z</option>
                                </select>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Campaign <InfoTooltip text="Campaign name plus type, budget mode, days live, and raw delivery state so you can scan structure and maturity quickly." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Type <InfoTooltip text="Objective family derived from the campaign objective, such as Sales, Traffic, Awareness, or Engagement." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Delivery <InfoTooltip text="Effective delivery state returned by Meta. This is what Ads Manager uses to show whether a campaign is active, paused, limited, or otherwise constrained." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Spend <InfoTooltip text={`Spend for the selected ${toTitleCase(datePreset)} window.`} /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Primary Result <InfoTooltip text="The main result metric adapts to campaign type: purchases for sales, leads for lead gen, link clicks for traffic, reach for awareness, and engagements for engagement campaigns." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Cost / Result <InfoTooltip text="The matching efficiency metric for the primary result. For example, cost per purchase for sales campaigns or cost per lead for lead-gen campaigns." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Purchase ROAS <InfoTooltip text="Purchase value divided by spend for campaigns where Meta returns purchase value. If the campaign objective is not sales, this may stay at zero." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CTR <InfoTooltip text="Click-through rate from Meta insights for the selected date window." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Link Clicks <InfoTooltip text="Outbound or inline link clicks, whichever Meta exposes for that campaign in this window." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CPM / Freq <InfoTooltip text="CPM shows cost per thousand impressions. Frequency shows the average number of times people saw the ads in this campaign." /></span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedCampaigns.map((campaign: any) => {
                                            const daysLive = getDaysLive(campaign.start_time || campaign.created_time);
                                            const deliveryTone = campaign.effectiveStatus === 'ACTIVE'
                                                ? { bg: 'rgba(16,185,129,0.14)', color: '#86efac', border: 'rgba(16,185,129,0.22)' }
                                                : campaign.effectiveStatus?.includes('PAUSED')
                                                    ? { bg: 'rgba(148,163,184,0.16)', color: '#cbd5e1', border: 'rgba(148,163,184,0.22)' }
                                                    : { bg: 'rgba(245,158,11,0.14)', color: '#fcd34d', border: 'rgba(245,158,11,0.24)' };

                                            return (
                                                <tr key={campaign.id}>
                                                    <td style={{ minWidth: 260 }}>
                                                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{campaign.name}</div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                                                            <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.14)', color: '#c4b5fd', fontSize: 11, fontWeight: 600 }}>
                                                                {campaign.objectiveLabel}
                                                            </span>
                                                            <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(14,165,233,0.14)', color: '#7dd3fc', fontSize: 11, fontWeight: 600 }}>
                                                                {campaign.budgetMode}{campaign.budgetAmount ? ` • ${formatCurrency(campaign.budgetAmount)}` : ''}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                                            {daysLive !== null ? `${daysLive}d live` : 'Start unknown'} • Updated {formatShortDate(campaign.updated_time)}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{campaign.typeLabel || 'General'}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{campaign.buying_type || 'Auction'}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'inline-flex', padding: '5px 10px', borderRadius: 999, background: deliveryTone.bg, color: deliveryTone.color, border: `1px solid ${deliveryTone.border}`, fontSize: 11, fontWeight: 700 }}>
                                                            {campaign.effectiveStatus?.replace(/_/g, ' ') || 'UNKNOWN'}
                                                        </div>
                                                        {campaign.configuredStatus && campaign.configuredStatus !== campaign.effectiveStatus && (
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                                                                Configured: {campaign.configuredStatus.replace(/_/g, ' ')}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{formatCurrency(campaign.metrics?.spend || 0)}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatNumber(campaign.metrics?.impressions || 0)} imp</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{formatNumber(campaign.primaryMetric?.value || 0)}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{campaign.primaryMetric?.label || 'Results'}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>
                                                            {campaign.primaryMetric?.costValue ? formatCurrency(campaign.primaryMetric.costValue) : '—'}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{campaign.primaryMetric?.costLabel || 'Cost / Result'}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{formatRoas(campaign.metrics?.purchaseRoas || 0)}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                                            {campaign.metrics?.purchaseValue ? formatCurrency(campaign.metrics.purchaseValue) : 'No purchase value'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{formatPercent(campaign.metrics?.ctr || 0)}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatNumber(campaign.metrics?.reach || 0)} reach</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{formatNumber(campaign.metrics?.linkClicks || 0)}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{campaign.metrics?.cpc ? formatCurrency(campaign.metrics.cpc) : '—'} CPC</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{campaign.metrics?.cpm ? formatCurrency(campaign.metrics.cpm) : '—'}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{Number(campaign.metrics?.frequency || 0).toFixed(2)}x freq</div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <div className="text-muted" style={{ fontSize: 13 }}>
                                    Page {campaignPage} of {campaignTotalPages} • 50 campaigns per page
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setCampaignPage((page) => Math.max(1, page - 1))}
                                        disabled={campaignPage === 1}
                                    >
                                        Previous 50
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setCampaignPage((page) => Math.min(campaignTotalPages, page + 1))}
                                        disabled={campaignPage === campaignTotalPages}
                                    >
                                        Next 50
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <p className="text-muted" style={{ marginBottom: 12 }}>No campaigns found for this account</p>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { window.location.href = '/settings'; }}>
                                Open Meta Ads setup
                            </button>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* ==================== DEMOGRAPHICS TAB ==================== */}
            {activeTab === 'demographics' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>Demographics <InfoTooltip text="Age and gender breakdown of who is interacting with your ads." /></span>} subtitle="Breakdown by age and gender">
                        {demographicsLoading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                                <p className="text-muted">Loading demographics...</p>
                            </div>
                        ) : demographics.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Age / Gender</th>
                                            <th>Spend</th>
                                            <th>Impressions</th>
                                            <th>Reach</th>
                                            <th>Clicks</th>
                                            <th>CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {demographics.slice(0, 15).map((d: any, i: number) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 500 }}>{d.age} {d.gender}</td>
                                                <td>{formatCurrency(d.spend)}</td>
                                                <td>{formatNumber(d.impressions)}</td>
                                                <td>{formatNumber(d.reach)}</td>
                                                <td>{formatNumber(d.clicks)}</td>
                                                <td>{formatPercent(d.ctr)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-muted">No demographic data available</p>
                        )}
                    </SectionCard>

                    <SectionCard
                        title={<span style={{ display: 'flex', alignItems: 'center' }}>Region Performance <InfoTooltip text="Region-level performance from Meta's geo breakdown. This view highlights which regions are generating purchase value and ROAS, not just spend and clicks." /></span>}
                        subtitle="Detailed region performance with spend, purchases, purchase value, and ROAS"
                    >
                        {geographyLoading && regionPerformanceRows.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                                <p className="text-muted">Loading region performance...</p>
                            </div>
                        ) : regionPerformanceRows.length > 0 ? (
                            <div style={{ display: 'grid', gap: 16 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Regions With ROAS</div>
                                        <div style={{ fontSize: 22, fontWeight: 700 }}>{formatNumber(regionRoasCoverage)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Regions where Meta returned purchase value and spend</div>
                                    </div>
                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Top ROAS Region</div>
                                        <div style={{ fontSize: 18, fontWeight: 700 }}>{topRegionByRoas?.region || 'No ROAS yet'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                            {topRegionByRoas ? `${formatRoas(topRegionByRoas.purchaseRoas)} on ${formatCurrency(topRegionByRoas.spend)}` : 'No region-level purchase value available'}
                                        </div>
                                    </div>
                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Top Revenue Region</div>
                                        <div style={{ fontSize: 18, fontWeight: 700 }}>{topRegionByRevenue?.region || 'No revenue yet'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                            {topRegionByRevenue ? `${formatCurrency(topRegionByRevenue.purchaseValue)} from ${formatNumber(topRegionByRevenue.purchases)} purchases` : 'No purchase-value data available'}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Region <InfoTooltip text="Region returned by Meta’s geo breakdown for the selected date range." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Spend <InfoTooltip text="Spend attributed to this region in the selected window." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Purchase Value <InfoTooltip text="Purchase value Meta attributed to this region." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Purchases <InfoTooltip text="Purchase count Meta attributed to this region." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>ROAS <InfoTooltip text="Purchase value divided by spend for that region." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Cost / Purchase <InfoTooltip text="Spend divided by purchases for this region when Meta returns purchase actions." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CTR <InfoTooltip text="Regional click-through rate for this region." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CPC <InfoTooltip text="Regional cost per click." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CPM <InfoTooltip text="Regional cost per thousand impressions." /></span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {regionPerformanceRows.slice(0, 20).map((region: any, index: number) => (
                                                <tr key={`${region.region}-${index}`}>
                                                    <td style={{ fontWeight: 600 }}>{region.region}</td>
                                                    <td>{formatCurrency(region.spend)}</td>
                                                    <td>{region.purchaseValue ? formatCurrency(region.purchaseValue) : '—'}</td>
                                                    <td>{formatNumber(region.purchases || 0)}</td>
                                                    <td>{region.purchaseRoas ? formatRoas(region.purchaseRoas) : '—'}</td>
                                                    <td>{region.costPerPurchase ? formatCurrency(region.costPerPurchase) : '—'}</td>
                                                    <td>{formatPercent(region.ctr || 0)}</td>
                                                    <td>{region.cpc ? formatCurrency(region.cpc) : '—'}</td>
                                                    <td>{region.cpm ? formatCurrency(region.cpm) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted">No region-level performance data available for this date range.</p>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* ==================== GEOGRAPHY TAB ==================== */}
            {activeTab === 'geo' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    {geographyLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                            <p className="text-muted">Loading geography...</p>
                        </div>
                    ) : (
                        <>
                            {/* Country Breakdown */}
                            <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>Country Performance <InfoTooltip text="Geographical breakdown of your ad reach and performance at the country level." /></span>} subtitle="How your ads perform in different countries">
                                {countries.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Country</th>
                                                    <th>Spend</th>
                                                    <th>Impressions</th>
                                                    <th>Reach</th>
                                                    <th>Clicks</th>
                                                    <th>CTR</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {countries.slice(0, 15).map((c: any, i: number) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: 500 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <Globe size={14} />
                                                                {c.country}
                                                            </div>
                                                        </td>
                                                        <td>{formatCurrency(c.spend)}</td>
                                                        <td>{formatNumber(c.impressions)}</td>
                                                        <td>{formatNumber(c.reach)}</td>
                                                        <td>{formatNumber(c.clicks)}</td>
                                                        <td>{formatPercent(c.ctr)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-muted">No country data available</p>
                                )}
                            </SectionCard>

                            {/* Region Breakdown */}
                            <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>Region Performance <InfoTooltip text="More granular geographical breakdown showing states or regions." /></span>} subtitle="Performance by state/region">
                                {regions.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Region</th>
                                                    <th>Spend</th>
                                                    <th>Impressions</th>
                                                    <th>Reach</th>
                                                    <th>Clicks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {regions.slice(0, 15).map((r: any, i: number) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: 500 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <MapPin size={14} />
                                                                {r.region}
                                                            </div>
                                                        </td>
                                                        <td>{formatCurrency(r.spend)}</td>
                                                        <td>{formatNumber(r.impressions)}</td>
                                                        <td>{formatNumber(r.reach)}</td>
                                                        <td>{formatNumber(r.clicks)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 6, fontSize: 12, color: 'var(--muted)' }}>
                                            Showing top 15 regions sorted by highest spend. Total {regions.length} regions tracked.
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted">No region data available</p>
                                )}
                            </SectionCard>
                        </>
                    )}
                </div>
            )}

            {/* ==================== FUNNEL TAB ==================== */}
            {activeTab === 'funnel' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    {funnelLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                            <p className="text-muted">Loading funnel data...</p>
                        </div>
                    ) : funnelData?.data ? (
                        <>
                            {(() => {
                                const funnelStages = funnelData.data.funnel || [];
                                const lpvStage = funnelStages.find((s: any) => s.stage === 'landing_page_view');
                                const vcStage = funnelStages.find((s: any) => s.stage === 'view_content');
                                const lpv = lpvStage?.count || 0;
                                const vc = vcStage?.count || 0;
                                const bounceComparable = lpv > 0 && vc <= lpv;
                                const overallBounce = bounceComparable ? (((lpv - vc) / lpv) * 100) : null;
                                const contentContinuationRate = lpv > 0 ? ((vc / lpv) * 100) : null;

                                return (
                                    <>
                            {/* Funnel Summary */}
                            <SectionCard
                                title={<span style={{ display: 'flex', alignItems: 'center' }}>Conversion Funnel Overview <InfoTooltip text="This funnel is built from Meta standard events. It shows where people move from landing-page load through purchase, using real tracked event counts and derived conversion rates." /></span>}
                                subtitle="Track the journey from landing-page visit to purchase using Meta tracked events and calculated step-to-step conversion rates."
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                                            <span className="text-muted" style={{ fontSize: 12 }}>Total Spend</span>
                                            <InfoTooltip text="Real Meta spend for the selected date preset across this ad account." />
                                        </div>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
                                            {formatCurrency(funnelData.data.summary?.totalSpend || 0)}
                                        </div>
                                    </div>
                                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                                            <span className="text-muted" style={{ fontSize: 12 }}>Overall Conversion</span>
                                            <InfoTooltip text="Calculated as Purchases divided by Landing Page Views for the selected period. This estimates how much paid landing-page traffic turns into purchases." />
                                        </div>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>
                                            {funnelData.data.summary?.overallConversionRate || 0}%
                                        </div>
                                    </div>
                                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                                            <span className="text-muted" style={{ fontSize: 12 }}>ROAS</span>
                                            <InfoTooltip text="Calculated as purchase value divided by spend. A ROAS of 3x means about ₹3 in tracked purchase value for every ₹1 spent." />
                                        </div>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: funnelData.data.summary?.roas > 1 ? '#10b981' : '#f59e0b' }}>
                                            {funnelData.data.summary?.roas || 0}x
                                        </div>
                                    </div>
                                    <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                                            <span className="text-muted" style={{ fontSize: 12 }}>Cost/Purchase</span>
                                            <InfoTooltip text="Calculated as Total Spend divided by total Purchase events in the selected period." />
                                        </div>
                                        <div style={{ fontSize: 24, fontWeight: 700, color: '#ec4899' }}>
                                            {formatCurrency(funnelData.data.summary?.costPerPurchase || 0)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                                    <strong style={{ color: 'var(--foreground)' }}>How to read this funnel:</strong> each stage is a real Meta event count. The conversion percentage on each step is calculated from the previous step, so you can see where the biggest drop-offs happen in the customer journey.
                                </div>
                            </SectionCard>

                            {/* Visual Funnel */}
                            <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>Conversion Funnel Visualization <InfoTooltip text="Each block is a real event count from Meta. The drop-off between blocks is calculated from the previous stage, which helps isolate the biggest leak in the journey." /></span>} subtitle="Step-by-step view of where users continue and where they drop off.">
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                                    {(funnelData.data.funnel || []).map((stage: any, i: number) => {
                                        const maxCount = Math.max(...(funnelData.data.funnel || []).map((s: any) => s.count || 1));
                                        const width = stage.count > 0 ? Math.max(30, (stage.count / maxCount) * 100) : 30;
                                        const isBottleneck = funnelData.data.bottleneck?.stage === stage.label;

                                        const stageIcons: Record<string, React.ElementType> = {
                                            'Landing Page View': Eye,
                                            'View Content': Package,
                                            'Add To Cart': ShoppingCart,
                                            'Initiate Checkout': CreditCard,
                                            'Add Payment Info': CreditCard,
                                            'Purchase': DollarSign
                                        };
                                        const Icon = stageIcons[stage.label] || Target;

                                        return (
                                            <div key={stage.stage} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                {/* Stage Bar */}
                                                <div style={{
                                                    width: `${width}%`,
                                                    background: isBottleneck
                                                        ? 'linear-gradient(135deg, #ef4444, #f87171)'
                                                        : `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                                                    padding: '16px 20px',
                                                    borderRadius: 8,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    color: 'white',
                                                    minWidth: 300,
                                                    boxShadow: isBottleneck ? '0 0 0 3px rgba(239, 68, 68, 0.3)' : 'none'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <Icon size={20} />
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <div style={{ fontWeight: 600, fontSize: 14 }}>{stage.label}</div>
                                                                <InfoTooltip text={FUNNEL_STAGE_EXPLANATIONS[stage.stage] || 'Tracked Meta event in the conversion journey.'} />
                                                            </div>
                                                            <div style={{ fontSize: 11, opacity: 0.8 }}>
                                                                {formatCurrency(stage.costPerAction || 0)} per action
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 20, fontWeight: 700 }}>{formatNumber(stage.count)}</div>
                                                        {i > 0 && (
                                                            <div style={{ fontSize: 11, opacity: 0.8 }}>
                                                                {stage.conversionRate}% from prev
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Arrow with dropoff */}
                                                {i < (funnelData.data.funnel?.length || 0) - 1 && (
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        padding: '8px 0',
                                                        color: stage.dropoffRate > 50 ? '#ef4444' : '#94a3b8'
                                                    }}>
                                                        <ArrowRight size={16} style={{ transform: 'rotate(90deg)' }} />
                                                        <span style={{ fontSize: 12, fontWeight: 500 }}>
                                                            {stage.dropoffRate}% drop off
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Bottleneck Alert */}
                                {funnelData.data.bottleneck && (
                                    <div style={{
                                        marginTop: 24,
                                        padding: '16px 20px',
                                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(249, 115, 22, 0.1))',
                                        borderRadius: 8,
                                        border: '1px solid rgba(239, 68, 68, 0.3)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <Zap size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
                                                    🚨 Bottleneck Detected: {funnelData.data.bottleneck.stage}
                                                </div>
                                                <div style={{ fontSize: 13, marginBottom: 8 }}>{funnelData.data.bottleneck.insight}</div>
                                                <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 12px', background: 'rgba(0,0,0,0.05)', borderRadius: 6 }}>
                                                    <strong>What this means:</strong> The drop-off at this stage is higher than expected. This is where you lose the most potential customers.
                                                    Consider optimizing your {funnelData.data.bottleneck.stage === 'Add To Cart' ? 'product page, pricing, or shipping info' :
                                                        funnelData.data.bottleneck.stage === 'Initiate Checkout' ? 'checkout flow and trust signals' :
                                                            funnelData.data.bottleneck.stage === 'Add Payment Info' ? 'payment options and security messaging' : 'landing page experience'}.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </SectionCard>
                            {/* ===== FEATURE: FULL FUNNEL ANALYSIS - Bounce Rate per Campaign (analytics.readonly) ===== */}
                            <SectionCard
                                title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Bounce Rate per Campaign
                                    <InfoTooltip text="This section compares upper-funnel page events to downstream content events. When View Content exceeds Landing Page Views, Meta event counting is not directly comparable, so bounce is shown as unavailable instead of a misleading negative number." />
                                </span>}
                                subtitle="Landing-page quality view using real Meta event counts plus campaign-level directional signals"
                            >
                                {(() => {
                                    const campaignRows = (campaigns || [])
                                        .filter((c: any) => parseInt(c.insights?.data?.[0]?.clicks || 0) > 0)
                                        .slice(0, 12)
                                        .map((c: any) => {
                                            const insight = c.insights?.data?.[0] || {};
                                            const clicks  = parseInt(insight.clicks || 0);
                                            const spend   = parseFloat(insight.spend || 0);
                                            const ctr     = parseFloat(insight.ctr || 0);
                                            const freq    = parseFloat(insight.frequency || 1);
                                            const normalizedCtr = Math.min(ctr / 3, 1);
                                            const br = parseFloat(Math.max(15, Math.min(95, 90 - normalizedCtr * 60 + freq * 2)).toFixed(1));
                                            return { name: c.name, status: c.status, clicks, spend, ctr, br };
                                        })
                                        .sort((a: any, b: any) => b.br - a.br);

                                    const getBC = (br: number) => br > 70 ? '#ef4444' : br > 50 ? '#f59e0b' : '#10b981';
                                    const getBL = (br: number) => br > 70 ? 'High Bounce' : br > 50 ? 'Moderate' : 'Healthy';

                                    return (
                                        <div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                                                {[
                                                    {
                                                        label: 'Landing Page Views',
                                                        value: formatNumber(lpv),
                                                        col: '#6366f1',
                                                        helper: 'Users who loaded the landing page after ad click.'
                                                    },
                                                    {
                                                        label: 'Continued to Content',
                                                        value: formatNumber(vc),
                                                        col: '#10b981',
                                                        helper: contentContinuationRate !== null ? `${contentContinuationRate.toFixed(1)}% of LPV volume` : 'Meta content-view events recorded.'
                                                    },
                                                    {
                                                        label: 'Overall Bounce Rate',
                                                        value: overallBounce !== null ? `${overallBounce.toFixed(1)}%` : 'Not comparable',
                                                        col: overallBounce !== null && overallBounce > 70 ? '#ef4444' : '#f59e0b',
                                                        warn: overallBounce !== null && overallBounce > 70,
                                                        helper: overallBounce !== null
                                                            ? 'Calculated as (Landing Page Views - Continued to Content) / Landing Page Views.'
                                                            : 'View Content exceeds Landing Page Views, so Meta event counts are not directly comparable for a bounce calculation here.'
                                                    },
                                                ].map((m: any, i: number) => (
                                                    <div key={i} style={{ padding: 16, background: m.warn ? 'rgba(239,68,68,0.06)' : 'var(--background)', borderRadius: 8, textAlign: 'center', border: m.warn ? '1px solid rgba(239,68,68,0.25)' : 'none' }}>
                                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                                                            {m.label}
                                                            <InfoTooltip text={m.helper} />
                                                        </div>
                                                        <div style={{ fontSize: 24, fontWeight: 700, color: m.col }}>{m.value}</div>
                                                        {m.warn && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>{`\u26A0 Review landing pages`}</div>}
                                                    </div>
                                                ))}
                                            </div>

                                            {campaignRows.length > 0 ? (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table className="table">
                                                        <thead>
                                                            <tr>
                                                                <th>Campaign</th>
                                                                <th>Status</th>
                                                                <th>Spend</th>
                                                                <th>Clicks</th>
                                                                <th>CTR</th>
                                                                <th><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Bounce Rate<InfoTooltip text="Derived from CTR-to-frequency ratio as a proxy. Install Meta Pixel ViewContent event for exact per-campaign bounce data." /></span></th>
                                                                <th>Landing Page Health</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {campaignRows.map((c: any, idx: number) => {
                                                                const col = getBC(c.br);
                                                                const lbl = getBL(c.br);
                                                                return (
                                                                    <tr key={idx}>
                                                                        <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</td>
                                                                        <td><span className={`badge ${c.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>{c.status}</span></td>
                                                                        <td>{formatCurrency(c.spend)}</td>
                                                                        <td>{formatNumber(c.clicks)}</td>
                                                                        <td style={{ color: c.ctr > 2 ? '#10b981' : 'inherit', fontWeight: c.ctr > 2 ? 600 : 400 }}>{formatPercent(c.ctr)}</td>
                                                                        <td>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                                <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                                                                                    <div style={{ width: `${Math.min(c.br, 100)}%`, height: '100%', background: col, borderRadius: 3 }} />
                                                                                </div>
                                                                                <span style={{ fontWeight: 700, fontSize: 13, color: col, minWidth: 42 }}>{c.br}%</span>
                                                                            </div>
                                                                        </td>
                                                                        <td>
                                                                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${col}20`, color: col }}>{lbl}</span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: 6, fontSize: 12, color: 'var(--muted)', borderLeft: '3px solid #ef4444' }}>
                                                        <strong style={{ color: 'var(--foreground)' }}>{`\uD83D\uDCA1 Fix High-Bounce Campaigns:`}</strong>
                                                        {` Match landing page messaging to ad copy, improve load speed (<2s), and add trust signals. A 10-point bounce reduction typically yields a 15\u201325% conversion lift.`}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                                                    <p style={{ fontSize: 13 }}>Open the <strong>Campaigns</strong> tab to load campaign data, then return here to see per-campaign bounce rates.</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </SectionCard>
                                    </>
                                );
                            })()}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <p className="text-muted">No funnel data available. Ensure you have purchase tracking set up.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== INTELLIGENCE TAB ==================== */}
            {activeTab === 'intelligence' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    {intelligenceLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                            <p className="text-muted">Analyzing campaign data...</p>
                        </div>
                    ) : intelligenceData?.data ? (
                        <>
                            {/* AI Recommendations */}
                            {intelligenceData.data.recommendations && (
                                <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>🎯 Smart Recommendations <InfoTooltip text="AI-generated actionable advice based on historical data patterns to optimize your campaign scheduling and placements." /></span>} subtitle="AI-powered insights for optimization">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                        {intelligenceData.data.recommendations.bestHour && (
                                            <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))', borderRadius: 8 }}>
                                                <Clock size={20} style={{ color: '#6366f1', marginBottom: 8 }} />
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Best Hour</div>
                                                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{intelligenceData.data.recommendations.bestHour}</div>
                                            </div>
                                        )}
                                        {intelligenceData.data.recommendations.bestDay && (
                                            <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.1))', borderRadius: 8 }}>
                                                <Calendar size={20} style={{ color: '#10b981', marginBottom: 8 }} />
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Best Day</div>
                                                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{intelligenceData.data.recommendations.bestDay}</div>
                                            </div>
                                        )}
                                        {intelligenceData.data.recommendations.bestPlacement && (
                                            <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(249, 115, 22, 0.1))', borderRadius: 8 }}>
                                                <Layers size={20} style={{ color: '#ec4899', marginBottom: 8 }} />
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Best Placement</div>
                                                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{intelligenceData.data.recommendations.bestPlacement}</div>
                                            </div>
                                        )}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Day of Week Heatmap */}
                            {(intelligenceData.data.dayOfWeekPerformance || []).length > 0 && (
                                <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>📅 Day of Week Performance <InfoTooltip text="Heatmap showing which days yield the highest CTR and lowest costs." /></span>} subtitle="Find your best performing days">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                                        {(intelligenceData.data.dayOfWeekPerformance || []).map((day: any) => {
                                            const maxCtr = Math.max(...(intelligenceData.data.dayOfWeekPerformance || []).map((d: any) => parseFloat(d.ctr) || 0));
                                            const intensity = maxCtr > 0 ? parseFloat(day.ctr) / maxCtr : 0;
                                            const bgColor = `rgba(99, 102, 241, ${0.1 + intensity * 0.6})`;

                                            return (
                                                <div key={day.day} style={{
                                                    padding: 16,
                                                    background: bgColor,
                                                    borderRadius: 8,
                                                    textAlign: 'center',
                                                    border: intensity > 0.8 ? '2px solid #6366f1' : 'none'
                                                }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{day.day.slice(0, 3)}</div>
                                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{day.ctr}%</div>
                                                    <div className="text-muted" style={{ fontSize: 10 }}>CTR</div>
                                                    <div style={{ marginTop: 8, fontSize: 11 }}>
                                                        {formatNumber(day.avgClicks)} clicks
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Placement ROAS Matrix */}
                            {(() => {
                                const placements = (intelligenceData.data.placementMatrix || []).filter((p: any) => p.spend > 0);
                                if (!placements.length) return null;

                                const topByRoas = [...placements].sort((a: any, b: any) => b.roas - a.roas)[0];
                                const topByScale = [...placements].sort((a: any, b: any) => b.revenue - a.revenue)[0];
                                const topByCpc = [...placements]
                                    .filter((p: any) => p.clicks > 0)
                                    .sort((a: any, b: any) => a.cpc - b.cpc)[0];

                                return (
                                    <SectionCard
                                        title={<span style={{ display: 'flex', alignItems: 'center' }}>📊 Placement Profitability Map <InfoTooltip text="Uses real placement-level spend, clicks, purchases, and purchase value from Meta. Ranked with a blended score so tiny low-spend outliers do not overpower placements that drive meaningful scale." /></span>}
                                        subtitle="Read this as where to scale, where to protect, and where to watch"
                                    >
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                                            {[
                                                {
                                                    title: 'Highest ROAS',
                                                    value: `${toTitleCase(topByRoas.platform)} ${toTitleCase(topByRoas.position)}`,
                                                    meta: `${formatRoas(topByRoas.roas)} on ${formatCurrency(topByRoas.spend)}`,
                                                    color: '#10b981'
                                                },
                                                {
                                                    title: 'Largest Revenue Driver',
                                                    value: `${toTitleCase(topByScale.platform)} ${toTitleCase(topByScale.position)}`,
                                                    meta: `${formatCurrency(topByScale.revenue)} revenue from ${topByScale.purchases} purchases`,
                                                    color: '#6366f1'
                                                },
                                                {
                                                    title: 'Cheapest Clicks',
                                                    value: topByCpc ? `${toTitleCase(topByCpc.platform)} ${toTitleCase(topByCpc.position)}` : 'No click data',
                                                    meta: topByCpc ? `${formatCurrency(topByCpc.cpc)} CPC with ${formatNumber(topByCpc.clicks)} clicks` : 'No eligible placements',
                                                    color: '#f59e0b'
                                                }
                                            ].map((item) => (
                                                <div key={item.title} style={{ padding: 16, borderRadius: 12, background: 'var(--background)', border: `1px solid ${item.color}33` }}>
                                                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: item.color, marginBottom: 8 }}>{item.title}</div>
                                                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{item.value}</div>
                                                    <div className="text-muted" style={{ fontSize: 12 }}>{item.meta}</div>
                                                </div>
                                            ))}
                                        </div>

                                    <div className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
                                            Placements are sorted by an opportunity score built from real ROAS, purchase volume, CPC efficiency, and spend share so the list is useful for budget decisions, not just vanity ranking.
                                        </div>

                                        <div style={{ overflowX: 'auto' }}>
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Placement</th>
                                                        <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Opportunity <InfoTooltip text="A prioritisation score from 0 to 100. It blends real ROAS, purchase volume, CPC efficiency, and spend share to highlight placements that are both efficient and material enough to act on." /></span></th>
                                                        <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>ROAS <InfoTooltip text="Return on ad spend for that placement, calculated from real purchase value divided by spend." /></span></th>
                                                        <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Spend Share <InfoTooltip text="How much of total spend this placement consumed in the selected period." /></span></th>
                                                        <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Purchases <InfoTooltip text="Tracked purchase actions attributed to this placement in Meta." /></span></th>
                                                        <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Cost / Purchase <InfoTooltip text="Spend divided by purchases for this placement. Lower is usually better if attribution quality is consistent." /></span></th>
                                                        <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CPC <InfoTooltip text="Average cost per click for that placement." /></span></th>
                                                        <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Confidence <InfoTooltip text="Confidence reflects how much evidence is behind the result. It rises when a placement has enough spend, clicks, and purchase volume to trust the signal." /></span></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {placements.slice(0, 8).map((p: any, i: number) => {
                                                        const scoreTone = getScoreTone(p.rankScore || 0);
                                                        const confidenceTone = getConfidenceTone(p.confidenceLabel || '');
                                                        return (
                                                            <tr key={`${p.platform}-${p.position}-${i}`}>
                                                                <td>
                                                                    <div style={{ fontWeight: 600 }}>{toTitleCase(p.platform)} {toTitleCase(p.position)}</div>
                                                                    <div className="text-muted" style={{ fontSize: 12 }}>{formatCurrency(p.spend)} spend • {formatCurrency(p.revenue)} revenue</div>
                                                                </td>
                                                                <td>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                        <div style={{ minWidth: 42, fontWeight: 700, color: scoreTone.color }}>{Math.round(p.rankScore || 0)}</div>
                                                                        <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(148, 163, 184, 0.18)', overflow: 'hidden' }}>
                                                                            <div style={{ width: `${Math.min(p.rankScore || 0, 100)}%`, height: '100%', background: scoreTone.color }} />
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: scoreTone.color, marginTop: 4 }}>{scoreTone.label}</div>
                                                                </td>
                                                                <td>{formatRoas(p.roas)}</td>
                                                                <td>{formatCompactPercent(p.spendShare || 0)}</td>
                                                                <td>{formatNumber(p.purchases || 0)}</td>
                                                                <td>{p.costPerPurchase ? formatCurrency(p.costPerPurchase) : '—'}</td>
                                                                <td>{p.clicks > 0 ? formatCurrency(p.cpc) : '—'}</td>
                                                                <td>
                                                                    <span style={{ padding: '4px 10px', borderRadius: 999, background: confidenceTone.bg, color: confidenceTone.color, fontSize: 12, fontWeight: 600 }}>
                                                                        {p.confidenceLabel}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </SectionCard>
                                );
                            })()}

                            {/* Top Campaigns by Efficiency */}
                            {(() => {
                                const campaigns = (intelligenceData.data.campaigns || []).filter((c: any) => c.spend > 0);
                                if (!campaigns.length) return null;

                                return (
                                    <SectionCard
                                        title={<span style={{ display: 'flex', alignItems: 'center' }}>🏆 Campaigns to Scale First <InfoTooltip text="This score is formulated from real campaign metrics returned by Meta: ROAS, purchase volume, CTR, CPC efficiency, and spend confidence. It is meant to help prioritise scaling, not replace raw metrics." /></span>}
                                        subtitle="Ranked by a blended performance score built from real Meta signals"
                                    >
                                        <div className="text-muted" style={{ fontSize: 12, marginBottom: 14 }}>
                                            A high score means the campaign is combining efficiency with enough delivery volume to trust the result. Low-spend campaigns can still have strong ROAS, but they will show lower confidence until they prove at scale.
                                        </div>

                                        <div style={{ display: 'grid', gap: 12 }}>
                                            {campaigns.slice(0, 5).map((c: any, i: number) => {
                                                const scoreTone = getScoreTone(c.efficiencyScore || 0);
                                                return (
                                                    <div key={c.id} style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '40px minmax(0, 1.4fr) minmax(320px, 1fr) 110px',
                                                        gap: 16,
                                                        alignItems: 'center',
                                                        padding: 16,
                                                        background: 'var(--background)',
                                                        borderRadius: 12,
                                                        border: `1px solid ${scoreTone.border}`
                                                    }}>
                                                        <div style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: '50%',
                                                            background: COLORS[i % COLORS.length],
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 700
                                                        }}>
                                                            {i + 1}
                                                        </div>

                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: 700, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                                <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', fontSize: 12 }}>
                                                                    {toTitleCase((c.objective || '').replace('OUTCOME_', '').toLowerCase()) || 'Unknown Objective'}
                                                                </span>
                                                                <span style={{ padding: '4px 8px', borderRadius: 999, background: c.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.16)', color: c.status === 'ACTIVE' ? '#86efac' : '#cbd5e1', fontSize: 12 }}>
                                                                    {c.status}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                                                            <div>
                                                                <div className="text-muted" style={{ fontSize: 11 }}>Spend</div>
                                                                <div style={{ fontWeight: 700 }}>{formatCurrency(c.spend)}</div>
                                                                <div className="text-muted" style={{ fontSize: 11 }}>CPA {c.costPerPurchase ? formatCurrency(c.costPerPurchase) : '—'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted" style={{ fontSize: 11 }}>Purchases</div>
                                                                <div style={{ fontWeight: 700 }}>{formatNumber(c.purchases || 0)}</div>
                                                                <div className="text-muted" style={{ fontSize: 11 }}>CVR {formatCompactPercent(c.conversionRate || 0)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted" style={{ fontSize: 11 }}>ROAS</div>
                                                                <div style={{ fontWeight: 700 }}>{formatRoas(c.roas)}</div>
                                                                <div className="text-muted" style={{ fontSize: 11 }}>CTR {formatCompactPercent(c.ctr || 0, 2)}</div>
                                                            </div>
                                                        </div>

                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: 28, fontWeight: 800, color: scoreTone.color, lineHeight: 1 }}>{Math.round(c.efficiencyScore || 0)}</div>
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'inline-flex', alignItems: 'center' }}>
                                                                Performance score
                                                                <InfoTooltip text="Performance score is a blended prioritisation score from 0 to 100 built from real Meta values: ROAS, purchase volume, CTR, CPC efficiency, and spend confidence. It is meant to help rank what to scale first, not replace the raw metrics." />
                                                            </div>
                                                            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                                                                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                                    ROAS {c.scoreComponents?.roas ?? 0}
                                                                    <InfoTooltip text="ROAS contribution shows how strong this campaign's ROAS is relative to the best campaign in the current selection." />
                                                                </div>
                                                                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                                    Volume {c.scoreComponents?.volume ?? 0}
                                                                    <InfoTooltip text="Volume contribution reflects purchase count relative to the strongest converting campaign in this view." />
                                                                </div>
                                                                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                                    CPC {c.scoreComponents?.cpcEfficiency ?? 0}
                                                                    <InfoTooltip text="CPC contribution rewards campaigns that generate clicks more efficiently than peers." />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </SectionCard>
                                );
                            })()}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <p className="text-muted">No intelligence data available for this account.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== ADVANCED TAB ==================== */}
            {activeTab === 'advanced' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    {advancedLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                            <p className="text-muted">Running advanced analysis...</p>
                        </div>
                    ) : advancedData?.data ? (
                        <>
                            {/* Fatigue Early Warning */}
                            <SectionCard
                                title={<span style={{ display: 'flex', alignItems: 'center' }}>🚨 Fatigue Framework <InfoTooltip text="A blended fatigue read built from real Meta trend signals: CTR decay, CPM pressure, CPC pressure, CPR pressure, frequency, and when available, video hook quality. This is meant to distinguish audience fatigue from creative fatigue more credibly than a single metric." /></span>}
                                subtitle="Account-level fatigue read built from hook, CPR, CPM, CTR, and frequency"
                            >
                                <div style={{ display: 'grid', gap: 20 }}>
                                    <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
                                        <strong>Scope:</strong> {advancedData.data.fatigueAnalysis?.scope || 'Account-level aggregate across all campaigns in the selected ad account'}<br />
                                        <strong>Compared to:</strong> {advancedData.data.fatigueAnalysis?.comparisonBasis || 'First half of the selected period vs second half of the selected period.'}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
                                    {/* Fatigue Score Circle */}
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{
                                            width: 140,
                                            height: 140,
                                            borderRadius: '50%',
                                            background: advancedData.data.fatigueAnalysis?.status === 'critical'
                                                ? 'linear-gradient(135deg, #ef4444, #f87171)'
                                                : advancedData.data.fatigueAnalysis?.status === 'warning'
                                                    ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                                                    : 'linear-gradient(135deg, #10b981, #34d399)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                                        }}>
                                            <div style={{ fontSize: 36, fontWeight: 700, color: 'white' }}>
                                                {advancedData.data.fatigueAnalysis?.statusEmoji}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'white', opacity: 0.9 }}>
                                                Score: {advancedData.data.fatigueAnalysis?.score || 0}
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 12, fontWeight: 600 }}>
                                            {advancedData.data.fatigueAnalysis?.statusLabel || 'Unknown'}
                                        </div>
                                    </div>

                                    {/* Indicators */}
                                    <div>
                                        <div style={{ marginBottom: 16 }}>
                                            <span className="text-muted" style={{ fontSize: 12 }}>Fatigue Indicators</span>
                                        </div>
                                        {(advancedData.data.fatigueAnalysis?.indicators || []).length > 0 ? (
                                            <div style={{ display: 'grid', gap: 8 }}>
                                                {(advancedData.data.fatigueAnalysis?.indicators || []).map((ind: any, i: number) => (
                                                    <div key={i} style={{
                                                        padding: '12px 16px',
                                                        background: ind.severity === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                        borderRadius: 8,
                                                        borderLeft: `4px solid ${ind.severity === 'high' ? '#ef4444' : '#f59e0b'}`,
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}>
                                                        <span style={{ fontSize: 13 }}>{ind.message}</span>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: 20,
                                                            background: ind.severity === 'high' ? '#ef4444' : '#f59e0b',
                                                            color: 'white',
                                                            fontSize: 11,
                                                            fontWeight: 600
                                                        }}>
                                                            {ind.severity === 'high' ? 'HIGH' : 'MEDIUM'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ padding: 20, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, textAlign: 'center' }}>
                                                <span style={{ color: '#10b981' }}>✓ No fatigue indicators detected</span>
                                            </div>
                                        )}

                                        {advancedData.data.fatigueAnalysis?.recommendation && (
                                            <div style={{
                                                marginTop: 16,
                                                padding: '12px 16px',
                                                background: 'var(--background)',
                                                borderRadius: 8,
                                                fontSize: 13
                                            }}>
                                                <strong>Recommendation:</strong> {advancedData.data.fatigueAnalysis.recommendation}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                    {(advancedData.data.fatigueAnalysis?.framework || []).length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                            {(advancedData.data.fatigueAnalysis.framework || []).map((item: any) => {
                                                const tone = getScoreTone(item.score || 0);
                                                return (
                                                    <div key={item.key} style={{ padding: 14, borderRadius: 12, background: 'var(--background)', border: `1px solid ${tone.border}` }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                            <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                                                                {item.label}
                                                                <InfoTooltip text={item.description} />
                                                            </div>
                                                            <div style={{ color: tone.color, fontWeight: 700 }}>{Math.round(item.score || 0)}</div>
                                                        </div>
                                                        <div style={{ height: 8, borderRadius: 999, background: 'rgba(148, 163, 184, 0.18)', overflow: 'hidden', marginBottom: 8 }}>
                                                            <div style={{ width: `${Math.min(item.score || 0, 100)}%`, height: '100%', background: tone.color }} />
                                                        </div>
                                                        <div style={{ fontSize: 11, color: tone.color, marginBottom: 4 }}>{tone.label}</div>
                                                        <div className="text-muted" style={{ fontSize: 12 }}>{item.value}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {(advancedData.data.fatigueAnalysis?.missingSignals || []).length > 0 && (
                                        <div style={{ padding: '12px 16px', background: 'rgba(148, 163, 184, 0.12)', borderRadius: 10, fontSize: 12 }}>
                                            <strong>Missing or limited data:</strong> {(advancedData.data.fatigueAnalysis.missingSignals || []).join(' ')}
                                        </div>
                                    )}
                                </div>
                            </SectionCard>

                            {/* Campaign Quality Index */}
                            {(advancedData.data.campaignQualityIndex || advancedData.data.leadQualityScore) && (
                                <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>📊 Campaign Quality Index <InfoTooltip text="CQI is a blended campaign-quality score built from real CTR, click-to-conversion rate, CPA efficiency, spend confidence, and a frequency penalty. Read it as a practical campaign quality read, not as a pure lead score." /></span>} subtitle="Ranks campaigns by traffic quality, conversion efficiency, and cost discipline">
                                    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24 }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{
                                                fontSize: 48,
                                                fontWeight: 700,
                                                color: parseFloat((advancedData.data.campaignQualityIndex || advancedData.data.leadQualityScore).average) >= 50 ? '#10b981' : '#f59e0b'
                                            }}>
                                                {(advancedData.data.campaignQualityIndex || advancedData.data.leadQualityScore).average}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: 12 }}>Average CQI</div>
                                        </div>
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {((advancedData.data.campaignQualityIndex || advancedData.data.leadQualityScore).campaigns || []).slice(0, 5).map((c: any) => (
                                                <div key={c.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    padding: '10px 16px',
                                                    background: 'var(--background)',
                                                    borderRadius: 8
                                                }}>
                                                    <div style={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: 8,
                                                        background: c.gradeColor,
                                                        color: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 700,
                                                        fontSize: 16
                                                    }}>
                                                        {c.grade}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                            CTR: {c.metrics.ctr}% • Click CVR: {c.metrics.conversionRate}% • CPA: {c.metrics.cpa ? formatCurrency(parseFloat(c.metrics.cpa)) : '—'}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 700, color: c.gradeColor }}>{c.lqs}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                            CTR {c.metrics.ctrScore} • CVR {c.metrics.conversionScore}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </SectionCard>
                            )}

                            {/* Creative Forensics */}
                            {(advancedData.data.creativeForensics || []).length > 0 && (
                                <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>🔍 Creative Forensics <InfoTooltip text="Reads each ad creative against its peers using real CTR, click-to-result rate, CPR, CPM, frequency, and video hook quality when available. The labels here are meant to help you decide whether to scale, refresh, or let the creative mature." /></span>} subtitle="Creative-by-creative diagnosis with visuals, cost signals, and practical next actions">
                                    <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
                                        The label is a diagnosis, not a vanity badge. Winners combine conversion proof and efficiency. Traffic mismatch means the ad earns clicks but not enough downstream action. Early read means it simply has not spent enough yet to judge fairly.
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                        {(advancedData.data.creativeForensics || []).slice(0, 8).map((ad: any) => {
                                            const pattern = ad.pattern || { label: 'Mixed Read', color: '#64748b', insight: 'Mixed performance signals.', action: 'Keep monitoring.' };
                                            const performanceScore = parseFloat(ad.performanceScore || 0);
                                            const shouldContainPreview = ad.previewSource === 'thumbnail';

                                            return (
                                                <div key={ad.id} style={{
                                                    background: 'var(--background)',
                                                    borderRadius: 12,
                                                    overflow: 'hidden',
                                                    border: pattern.type === 'winner'
                                                        ? '2px solid #10b981'
                                                        : pattern.type === 'burning_spend' || pattern.type === 'traffic_mismatch'
                                                            ? '1px solid rgba(239, 68, 68, 0.45)'
                                                            : '1px solid var(--border)'
                                                }}>
                                                    <div style={{ position: 'relative', height: 136, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(15, 23, 42, 0.95))' }}>
                                                        {ad.thumbnail ? (
                                                            <img
                                                                src={ad.thumbnail}
                                                                alt={ad.name}
                                                                loading="lazy"
                                                                style={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: shouldContainPreview ? 'contain' : 'cover',
                                                                    objectPosition: 'center',
                                                                    display: 'block',
                                                                    padding: shouldContainPreview ? 10 : 0,
                                                                    background: shouldContainPreview ? 'rgba(15, 23, 42, 0.88)' : 'transparent'
                                                                }}
                                                            />
                                                        ) : (
                                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.72)', fontSize: 12 }}>
                                                                Preview unavailable
                                                            </div>
                                                        )}
                                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.05), rgba(15, 23, 42, 0.82))' }} />
                                                        <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                padding: '6px 10px',
                                                                borderRadius: 999,
                                                                background: pattern.color || '#64748b',
                                                                color: '#fff',
                                                                fontWeight: 700,
                                                                fontSize: 11
                                                            }}>
                                                                {pattern.label}
                                                            </span>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                padding: '6px 10px',
                                                                borderRadius: 999,
                                                                background: 'rgba(15, 23, 42, 0.82)',
                                                                border: '1px solid rgba(148, 163, 184, 0.28)',
                                                                color: performanceScore >= 70 ? '#86efac' : performanceScore >= 45 ? '#fcd34d' : '#fca5a5',
                                                                fontWeight: 700,
                                                                fontSize: 11
                                                            }}>
                                                                Score {Math.round(performanceScore)}
                                                            </span>
                                                        </div>
                                                        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                                                            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 6, textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
                                                                {ad.name}
                                                            </div>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                                {ad.hasVideo && (
                                                                    <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(15,23,42,0.78)', color: '#cbd5e1', fontSize: 10 }}>
                                                                        Video
                                                                    </span>
                                                                )}
                                                                {ad.fatigue?.status !== 'healthy' && (
                                                                    <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.85)', color: '#111827', fontSize: 10, fontWeight: 700 }}>
                                                                        {ad.fatigue?.status === 'critical' ? 'Fatigue risk' : 'Watch fatigue'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ padding: 16 }}>
                                                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{pattern.insight}</p>
                                                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.16)', fontSize: 11, color: '#dbe4f0', marginBottom: 12 }}>
                                                            <strong style={{ color: '#fff' }}>Next action:</strong> {pattern.action}
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, textAlign: 'center' }}>
                                                            <div>
                                                                <div style={{ fontSize: 14, fontWeight: 600 }}>{ad.ctr}%</div>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>CTR</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: 14, fontWeight: 600 }}>{ad.conversions}</div>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Results</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: 14, fontWeight: 600 }}>{ad.costPerConversion ? formatCurrency(parseFloat(ad.costPerConversion)) : '—'}</div>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>CPR</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(parseFloat(ad.cpm || 0))}</div>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>CPM</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: 14, fontWeight: 600 }}>{ad.clickToConversionRate}%</div>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Click CVR</div>
                                                            </div>
                                                        </div>

                                                        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
                                                            Spend {formatCurrency(ad.spend)} • Freq {ad.frequency}x
                                                        </div>

                                                        {ad.hasVideo && ad.videoMetrics && (
                                                            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 6 }}>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Video Retention</div>
                                                                <div style={{ fontSize: 12 }}>
                                                                    Hook: <strong>{ad.videoMetrics.hookRate}%</strong> •
                                                                    Complete: <strong>{ad.videoMetrics.completionRate}%</strong>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {!ad.hasVideo && (
                                                            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(148, 163, 184, 0.12)', borderRadius: 6, fontSize: 11, color: 'var(--muted)' }}>
                                                                No video hook or completion data for this creative.
                                                            </div>
                                                        )}
                                                        {ad.fatigue?.reasons?.length > 0 && (
                                                            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
                                                                Watchouts: {ad.fatigue.reasons.join(' • ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Delivery Readiness */}
                            {(advancedData.data.learningPhase || []).length > 0 && (
                                <SectionCard
                                    title={<span style={{ display: 'flex', alignItems: 'center' }}>📚 Delivery Readiness <InfoTooltip text="Meta learning and learning-limited are ad set delivery states. For event-optimized goals, a practical benchmark is about 50 optimization events per week. For reach or impression goals, this section switches to delivery-stability mode instead of pretending there should be 50 conversions." /></span>}
                                    subtitle="Objective-aware read on learning, limited delivery, and scale readiness"
                                >
                                    {(() => {
                                        const learningPhase = advancedData.data.learningPhase || [];
                                        const learningLimitedCount = learningPhase.filter((item: any) => item.learningStatus?.status === 'limited').length;
                                        const learningCount = learningPhase.filter((item: any) => item.learningStatus?.status === 'learning').length;
                                        const stableCount = learningPhase.filter((item: any) => item.learningStatus?.status === 'active' || item.learningStatus?.status === 'delivery_active').length;

                                        return (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                                                {learningLimitedCount > 0 && (
                                                    <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.28)', color: '#fca5a5', fontSize: 12, fontWeight: 600 }}>
                                                        {learningLimitedCount} ad set{learningLimitedCount === 1 ? '' : 's'} are Learning Limited
                                                    </div>
                                                )}
                                                {learningCount > 0 && (
                                                    <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.14)', border: '1px solid rgba(245, 158, 11, 0.28)', color: '#fcd34d', fontSize: 12, fontWeight: 600 }}>
                                                        {learningCount} still in Learning
                                                    </div>
                                                )}
                                                {stableCount > 0 && (
                                                    <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(16, 185, 129, 0.28)', color: '#86efac', fontSize: 12, fontWeight: 600 }}>
                                                        {stableCount} with stable delivery
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
                                        This section is based on each ad set&apos;s <strong>objective</strong> and <strong>optimization goal</strong>. Conversion-style ad sets are judged on optimization-event pace. Awareness-style ad sets are judged on delivery stability, not a fake 50-conversion target.
                                    </div>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {(advancedData.data.learningPhase || []).slice(0, 10).map((adset: any) => {
                                            const status = adset.learningStatus || { icon: '❓', label: 'Unknown', color: '#94a3b8' };
                                            const progressRing = status.status === 'learning' || status.status === 'limited' || status.status === 'delivery_learning';
                                            const ringValue = progressRing
                                                ? (adset.benchmarkProgress ?? Math.min(((adset.daysActive || 1) / 14) * 100, 100))
                                                : null;
                                            const radius = 24;
                                            const circumference = 2 * Math.PI * radius;
                                            const offset = ringValue !== null ? circumference - (ringValue / 100) * circumference : circumference;
                                            const displayStatusLabel = status.status === 'limited'
                                                ? 'Learning Limited'
                                                : status.status === 'learning'
                                                    ? 'Learning'
                                                    : status.status === 'unknown' && adset.effectiveStatus
                                                        ? toTitleCase(String(adset.effectiveStatus).toLowerCase())
                                                        : status.label;

                                            return (
                                                <div key={adset.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 16,
                                                    padding: '12px 16px',
                                                    background: 'var(--background)',
                                                    borderRadius: 8,
                                                    borderLeft: `4px solid ${status.color || '#6b7280'}`
                                                }}>
                                                    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                                                        <svg width="56" height="56" viewBox="0 0 56 56">
                                                            <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(148, 163, 184, 0.18)" strokeWidth="5" />
                                                            {progressRing ? (
                                                                <circle
                                                                    cx="28"
                                                                    cy="28"
                                                                    r={radius}
                                                                    fill="none"
                                                                    stroke={status.color || '#94a3b8'}
                                                                    strokeWidth="5"
                                                                    strokeLinecap="round"
                                                                    strokeDasharray={circumference}
                                                                    strokeDashoffset={offset}
                                                                    transform="rotate(-90 28 28)"
                                                                />
                                                            ) : (
                                                                <circle
                                                                    cx="28"
                                                                    cy="28"
                                                                    r={radius}
                                                                    fill="none"
                                                                    stroke={status.color || '#94a3b8'}
                                                                    strokeOpacity="0.65"
                                                                    strokeWidth="4"
                                                                    strokeDasharray="4 5"
                                                                    transform="rotate(-90 28 28)"
                                                                />
                                                            )}
                                                        </svg>
                                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                                                            <div style={{ fontSize: 14 }}>{status.icon}</div>
                                                            <div style={{ fontSize: 10, fontWeight: 700 }}>{adset.daysActive}d</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{adset.name}</div>
                                                            <span style={{
                                                                padding: '3px 8px',
                                                                borderRadius: 999,
                                                                background: status.status === 'limited'
                                                                    ? 'rgba(239, 68, 68, 0.14)'
                                                                    : status.status === 'learning'
                                                                        ? 'rgba(245, 158, 11, 0.14)'
                                                                        : 'rgba(148, 163, 184, 0.14)',
                                                                color: status.status === 'limited'
                                                                    ? '#fca5a5'
                                                                    : status.status === 'learning'
                                                                        ? '#fcd34d'
                                                                        : '#cbd5e1',
                                                                fontSize: 10,
                                                                fontWeight: 700
                                                            }}>
                                                                {displayStatusLabel}
                                                            </span>
                                                            <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(99, 102, 241, 0.12)', color: '#c7d2fe', fontSize: 10 }}>
                                                                {toTitleCase(adset.objectiveType || 'Unknown')}
                                                            </span>
                                                            <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.12)', color: '#a7f3d0', fontSize: 10 }}>
                                                                {toTitleCase(adset.optimizationGoal || 'Unknown')}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                            {status.label} • {formatCurrency(adset.spend || 0)} spent • {adset.daysActive} days live
                                                        </div>
                                                        {status.status === 'unknown' && adset.effectiveStatus && (
                                                            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                                                                Raw Meta status: <strong style={{ color: '#e5e7eb' }}>{adset.effectiveStatus}</strong>
                                                            </div>
                                                        )}
                                                        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                                                            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(15, 23, 42, 0.55)' }}>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                    {adset.needsOptimizationEvents ? 'Goal pace' : 'Delivery signal'}
                                                                </div>
                                                                <div style={{ fontSize: 13, fontWeight: 700 }}>
                                                                    {adset.needsOptimizationEvents ? `${formatNumber(adset.weeklyPace || 0)}/week` : formatNumber(adset.goalEvents || 0)}
                                                                </div>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                    {adset.needsOptimizationEvents ? adset.goalLabel : adset.benchmarkLabel}
                                                                </div>
                                                            </div>
                                                            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(15, 23, 42, 0.55)' }}>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>CTR</div>
                                                                <div style={{ fontSize: 13, fontWeight: 700 }}>{adset.ctr}%</div>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Frequency {Number(adset.frequency || 0).toFixed(2)}x</div>
                                                            </div>
                                                            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(15, 23, 42, 0.55)' }}>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                    {adset.needsOptimizationEvents ? 'Events in window' : 'General conversions'}
                                                                </div>
                                                                <div style={{ fontSize: 13, fontWeight: 700 }}>{formatNumber(adset.needsOptimizationEvents ? adset.goalEvents || 0 : adset.conversions || 0)}</div>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                    {adset.needsOptimizationEvents ? adset.benchmarkLabel : 'Shown for context only'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {status.note && (
                                                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                                                                {status.note}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {adset.needsOptimizationEvents && status.progress !== undefined && (
                                                        <div style={{ width: 120, flexShrink: 0 }}>
                                                            <div style={{
                                                                height: 6,
                                                                background: 'var(--border)',
                                                                borderRadius: 3,
                                                                overflow: 'hidden'
                                                            }}>
                                                                <div style={{
                                                                    height: '100%',
                                                                    width: `${Math.min(status.progress, 100)}%`,
                                                                    background: status.color,
                                                                    borderRadius: 3
                                                                }} />
                                                            </div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
                                                                {Math.round(status.progress)}% of weekly benchmark
                                                            </div>
                                                        </div>
                                                    )}
                                                    {status.safeToScale && (
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            background: '#dcfce7',
                                                            color: '#166534',
                                                            borderRadius: 20,
                                                            fontSize: 11,
                                                            fontWeight: 600
                                                        }}>
                                                            Safe to Scale
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, fontSize: 12 }}>
                                        <strong>Why this matters:</strong> Learning and learning-limited are ad set delivery states. Use event pace for conversion-style goals, but use delivery stability for awareness-style goals. Otherwise you end up penalizing the wrong campaigns with the wrong benchmark.
                                    </div>
                                </SectionCard>
                            )}

                            {/* Retargeting Lift */}
                            {advancedData.data.retargetingLift && (
                                <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>🔄 Retargeting Lift Analysis <InfoTooltip text="Measures whether retargeting converts better than cold traffic for the selected window. This uses click-to-conversion rate, not reach-to-conversion rate, so the comparison is closer to what performance marketers usually expect." /></span>} subtitle="Compares cold vs retargeting click-to-conversion efficiency and CPA">
                                    <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
                                        <strong>How to read this:</strong> click CVR is conversions divided by clicks inside each bucket. Lift compares retargeting click CVR against cold click CVR for the same selected period.
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'center' }}>
                                        {/* Cold Traffic */}
                                        <div style={{ textAlign: 'center', padding: 20, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 12 }}>
                                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Cold Traffic</div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{advancedData.data.retargetingLift.coldCampaigns} campaigns</div>
                                            <div style={{ fontSize: 28, fontWeight: 700, color: '#6366f1', marginTop: 8 }}>
                                                {advancedData.data.retargetingLift.cold.conversionRate}%
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
                                                Click CVR
                                                <InfoTooltip text="Cold click CVR = total tracked conversions divided by total clicks across the cold-campaign bucket." />
                                            </div>
                                            <div style={{ marginTop: 12, fontSize: 12 }}>
                                                CPA: {advancedData.data.retargetingLift.cold.cpa ? formatCurrency(parseFloat(advancedData.data.retargetingLift.cold.cpa)) : 'N/A'}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                                                {formatNumber(advancedData.data.retargetingLift.cold.clicks || 0)} clicks
                                            </div>
                                        </div>

                                        {/* Lift Arrow */}
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{
                                                fontSize: 32,
                                                fontWeight: 700,
                                                color: parseFloat(advancedData.data.retargetingLift.lift) > 20 ? '#10b981'
                                                    : parseFloat(advancedData.data.retargetingLift.lift) > 0 ? '#f59e0b' : '#ef4444'
                                            }}>
                                                {parseFloat(advancedData.data.retargetingLift.lift) > 0 ? '+' : ''}{advancedData.data.retargetingLift.lift}%
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
                                                Lift
                                                <InfoTooltip text="Lift = percentage difference between retargeting click CVR and cold click CVR. Positive means retargeting converts better." />
                                            </div>
                                            <ArrowRight size={24} style={{ marginTop: 8, color: 'var(--muted)' }} />
                                        </div>

                                        {/* Retarget Traffic */}
                                        <div style={{ textAlign: 'center', padding: 20, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 12 }}>
                                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Retargeting</div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{advancedData.data.retargetingLift.retargetCampaigns} campaigns</div>
                                            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', marginTop: 8 }}>
                                                {advancedData.data.retargetingLift.retarget.conversionRate}%
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
                                                Click CVR
                                                <InfoTooltip text="Retargeting click CVR = total tracked conversions divided by total clicks across the retargeting-campaign bucket." />
                                            </div>
                                            <div style={{ marginTop: 12, fontSize: 12 }}>
                                                CPA: {advancedData.data.retargetingLift.retarget.cpa ? formatCurrency(parseFloat(advancedData.data.retargetingLift.retarget.cpa)) : 'N/A'}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                                                {formatNumber(advancedData.data.retargetingLift.retarget.clicks || 0)} clicks
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{
                                        marginTop: 20,
                                        padding: '16px 20px',
                                        background: advancedData.data.retargetingLift.status === 'excellent' || advancedData.data.retargetingLift.status === 'good'
                                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.1))'
                                            : advancedData.data.retargetingLift.status === 'warning'
                                                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.1))'
                                                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(248, 113, 113, 0.1))',
                                        borderRadius: 8
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Zap size={20} style={{
                                                color: advancedData.data.retargetingLift.status === 'excellent' || advancedData.data.retargetingLift.status === 'good'
                                                    ? '#10b981' : advancedData.data.retargetingLift.status === 'warning' ? '#f59e0b' : '#ef4444'
                                            }} />
                                            <div style={{ fontSize: 13 }}>{advancedData.data.retargetingLift.insight}</div>
                                        </div>
                                    </div>
                                </SectionCard>
                            )}

                            {/* Placement Intent */}
                            {(advancedData.data.placementIntent || []).length > 0 && (
                                <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>🎯 Placement Intent Weighting <InfoTooltip text="This is a marketer heuristic, not a Meta-native metric. It applies intent weights to placements so feed, search-like, or marketplace surfaces can be judged differently from lower-intent placements. The underlying conversions and CPA are real; only the weighting is formulated." /></span>} subtitle="Uses real placement conversions, then applies intent weights to interpret them">
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Placement</th>
                                                    <th>Intent</th>
                                                    <th>Conversions</th>
                                                    <th>Weighted Conv</th>
                                                    <th>CPA</th>
                                                    <th>Intent-Adjusted CPA</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(advancedData.data.placementIntent || []).slice(0, 10).map((p: any, i: number) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: 500 }}>{p.displayName}</td>
                                                        <td>
                                                            <span style={{
                                                                padding: '4px 10px',
                                                                borderRadius: 20,
                                                                background: `${p.intentColor}20`,
                                                                color: p.intentColor,
                                                                fontSize: 11,
                                                                fontWeight: 600
                                                            }}>
                                                                {p.intentLabel} ({p.intentWeight}x)
                                                            </span>
                                                        </td>
                                                        <td>{p.conversions}</td>
                                                        <td style={{ fontWeight: 600 }}>{p.weightedConversions.toFixed(1)}</td>
                                                        <td>{p.effectiveCPA ? formatCurrency(parseFloat(p.effectiveCPA)) : '—'}</td>
                                                        <td style={{ color: p.intentColor, fontWeight: 600 }}>
                                                            {p.intentAdjustedCPA ? formatCurrency(parseFloat(p.intentAdjustedCPA)) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </SectionCard>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <p className="text-muted">No advanced analytics data available for this account.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== DEEP INSIGHTS TAB ==================== */}
            {activeTab === 'deep' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    {deepInsightsLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                            <p className="text-muted">Running deep analysis...</p>
                        </div>
                    ) : deepInsightsData?.data ? (
                        <>
                            {/* Bounce Gap Analysis - Overall */}
                            {deepInsightsData.data.bounceGapAnalysis && (
                                <SectionCard
                                    title={<span style={{ display: 'flex', alignItems: 'center' }}>🔍 Click-to-Landing Gap <InfoTooltip text="Uses Meta's real outbound clicks and landing-page-view events. This is the handoff loss between a paid click and the page actually loading enough for the landing-page-view event to fire." /></span>}
                                    subtitle="A sales account should watch how much paid click traffic is lost before the landing page actually loads"
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
                                        {/* Bounce Gap Score Circle */}
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{
                                                width: 140,
                                                height: 140,
                                                borderRadius: '50%',
                                                background: deepInsightsData.data.bounceGapAnalysis.severity === 'critical'
                                                    ? 'linear-gradient(135deg, #ef4444, #f87171)'
                                                    : deepInsightsData.data.bounceGapAnalysis.severity === 'warning'
                                                        ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                                                        : deepInsightsData.data.bounceGapAnalysis.severity === 'acceptable'
                                                            ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)'
                                                            : 'linear-gradient(135deg, #10b981, #34d399)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                                            }}>
                                                <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>
                                                    {deepInsightsData.data.bounceGapAnalysis.bounceGap}%
                                                </div>
                                                <div style={{ fontSize: 11, color: 'white', opacity: 0.9 }}>
                                                    Click Loss
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                                                {deepInsightsData.data.bounceGapAnalysis.severity}
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                                                <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                    <div className="text-muted" style={{ fontSize: 11 }}>Link Clicks</div>
                                                    <div style={{ fontSize: 20, fontWeight: 700 }}>{formatNumber(deepInsightsData.data.bounceGapAnalysis.outboundClicks)}</div>
                                                </div>
                                                <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                    <div className="text-muted" style={{ fontSize: 11 }}>Landing Page Views</div>
                                                    <div style={{ fontSize: 20, fontWeight: 700 }}>{formatNumber(deepInsightsData.data.bounceGapAnalysis.landingPageViews)}</div>
                                                </div>
                                                <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                    <div className="text-muted" style={{ fontSize: 11 }}>Users Lost</div>
                                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
                                                        {formatNumber(deepInsightsData.data.bounceGapAnalysis.outboundClicks - deepInsightsData.data.bounceGapAnalysis.landingPageViews)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, marginBottom: 12 }}>
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{deepInsightsData.data.bounceGapAnalysis.message}</div>
                                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{deepInsightsData.data.bounceGapAnalysis.recommendation}</div>
                                            </div>

                                            {(deepInsightsData.data.bounceGapAnalysis.possibleReasons || []).length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                    {deepInsightsData.data.bounceGapAnalysis.possibleReasons.map((reason: string, i: number) => (
                                                        <span key={i} style={{
                                                            padding: '4px 12px',
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            color: '#ef4444',
                                                            borderRadius: 20,
                                                            fontSize: 11
                                                        }}>
                                                            {reason}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </SectionCard>
                            )}

                            {/* Per-Campaign Funnel Comparison */}
                            {(deepInsightsData.data.campaignFunnels || []).length > 0 && (
                                <SectionCard
                                    title={<span style={{ display: 'flex', alignItems: 'center' }}>📊 Campaign Funnel Benchmarking <InfoTooltip text="Compares campaigns using real Meta funnel events. If a campaign has no landing-page-view event, the table will show a dash instead of estimating that step." /></span>}
                                    subtitle="Compare real funnel handoff and purchase efficiency across campaigns to see which ones turn traffic into revenue"
                                >
                                    {/* Comparison Header if we have best/worst */}
                                    {deepInsightsData.data.compareFunnels && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto 1fr',
                                            gap: 20,
                                            marginBottom: 24,
                                            padding: 16,
                                            background: 'var(--background)',
                                            borderRadius: 12
                                        }}>
                                            {/* Best */}
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ color: '#10b981', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>🏆 BEST PERFORMER</div>
                                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                                                    {deepInsightsData.data.compareFunnels.best?.campaignName}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                                                    <div>
                                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                                                            {deepInsightsData.data.compareFunnels.best?.conversions.roas}x
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>ROAS</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
                                                            {deepInsightsData.data.compareFunnels.best?.conversions.atcToPurchaseRate}%
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Cart→Purchase</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* VS */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--muted)' }}>VS</div>
                                                {deepInsightsData.data.compareFunnels.comparison && (
                                                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
                                                        +{deepInsightsData.data.compareFunnels.comparison.roasDiff}x ROAS<br />
                                                        +{deepInsightsData.data.compareFunnels.comparison.atcRateDiff}% ATC to buy
                                                    </div>
                                                )}
                                            </div>

                                            {/* Worst */}
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚠️ NEEDS WORK</div>
                                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                                                    {deepInsightsData.data.compareFunnels.worst?.campaignName}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                                                    <div>
                                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
                                                            {deepInsightsData.data.compareFunnels.worst?.conversions.roas}x
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>ROAS</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>
                                                            {deepInsightsData.data.compareFunnels.worst?.conversions.atcToPurchaseRate}%
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Cart→Purchase</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Campaign Funnel Table */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Campaign</th>
                                                    <th>Click Loss</th>
                                                    <th>Link→LPV</th>
                                                    <th>LPV→ATC</th>
                                                    <th>ATC→Buy</th>
                                                    <th>ROAS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(deepInsightsData.data.campaignFunnels || []).slice(0, 10).map((c: any) => (
                                                    <tr key={c.campaignId}>
                                                        <td>
                                                            <div style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {c.campaignName}
                                                            </div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                {formatCurrency(c.spend)} spent
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {c.dropoffs.bounceGap === null ? (
                                                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>No LPV data</span>
                                                            ) : (
                                                                <span style={{
                                                                    padding: '4px 10px',
                                                                    borderRadius: 20,
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    background: c.dropoffs.bounceQuality === 'critical' ? '#fee2e2' :
                                                                        c.dropoffs.bounceQuality === 'warning' ? '#fef3c7' :
                                                                            c.dropoffs.bounceQuality === 'acceptable' ? '#e0f2fe' : '#dcfce7',
                                                                    color: c.dropoffs.bounceQuality === 'critical' ? '#991b1b' :
                                                                        c.dropoffs.bounceQuality === 'warning' ? '#92400e' :
                                                                            c.dropoffs.bounceQuality === 'acceptable' ? '#0369a1' : '#166534'
                                                                }}>
                                                                    {c.dropoffs.bounceGap}%
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ fontSize: 13 }}>
                                                            {c.funnel.linkClicks} → {c.funnel.landingPageViews > 0 ? c.funnel.landingPageViews : '—'}
                                                        </td>
                                                        <td style={{ fontSize: 13 }}>
                                                            {c.funnel.landingPageViews > 0 ? c.funnel.landingPageViews : '—'} → {c.funnel.addToCart}
                                                        </td>
                                                        <td>
                                                            <span style={{ fontWeight: 600, color: c.conversions.atcToPurchaseRate >= 50 ? '#10b981' : '#f59e0b' }}>
                                                                {c.conversions.atcToPurchaseRate}%
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span style={{ fontWeight: 700, color: c.conversions.roas >= 1 ? '#10b981' : '#ef4444' }}>
                                                                {c.conversions.roas}x
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </SectionCard>
                            )}

                            {/* Video Hook Analysis */}
                            {deepInsightsData.data.videoSummary && (
                                <SectionCard
                                    title={<span style={{ display: 'flex', alignItems: 'center' }}>📹 Video Hook & Retention Analysis <InfoTooltip text="Uses Meta's real video-play and watch-depth actions. Hook rate is the share of plays that reached 25%. Hold rate is the share of 25% viewers who stayed through 75%." /></span>}
                                    subtitle="Use this when the account is spending materially on video and you want to see whether the opening and middle of the video are keeping attention"
                                >
                                    {/* Summary Stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Videos Analyzed
                                                <InfoTooltip text="How many ads had enough Meta video-play or watch-depth data to be evaluated in this section." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700 }}>{deepInsightsData.data.videoSummary.totalVideos}</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Avg Hook Rate (25%)
                                                <InfoTooltip text="Average share of video plays that reached the 25% watch milestone. This is a practical read on whether the opening earned attention." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>{deepInsightsData.data.videoSummary.avgHookRate}%</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Avg Completion
                                                <InfoTooltip text="Average share of plays that reached 100% watched. This is usually much lower than hook rate and should be read as a depth metric, not a goal on its own." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{deepInsightsData.data.videoSummary.avgCompletionRate}%</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Needs Improvement
                                                <InfoTooltip text="Count of video ads whose hook or hold pattern suggests creative work is needed before scaling harder." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{deepInsightsData.data.videoSummary.needsWork}</div>
                                        </div>
                                    </div>

                                    {/* Video Cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                                        {(deepInsightsData.data.videoHookAnalysis || []).slice(0, 8).map((v: any) => (
                                            <div key={v.adId} style={{
                                                background: 'linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.96))',
                                                borderRadius: 14,
                                                overflow: 'hidden',
                                                border: `1px solid ${v.patternColor}55`,
                                                boxShadow: '0 14px 30px rgba(0,0,0,0.16)'
                                            }}>
                                                <div style={{ position: 'relative', height: 118, background: 'rgba(15, 23, 42, 0.82)' }}>
                                                    {v.thumbnail ? (
                                                        <img
                                                            src={v.thumbnail}
                                                            alt={v.adName}
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: v.previewSource === 'thumbnail' ? 'contain' : 'cover',
                                                                background: v.previewSource === 'thumbnail' ? 'rgba(15, 23, 42, 0.94)' : undefined,
                                                                padding: v.previewSource === 'thumbnail' ? 10 : 0,
                                                                filter: v.previewSource === 'thumbnail' ? 'saturate(0.95) contrast(1.03)' : 'none'
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(226,232,240,0.7)', fontSize: 12 }}>
                                                            Preview unavailable
                                                        </div>
                                                    )}
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.12), rgba(2,6,23,0.82))' }} />
                                                    <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '5px 9px',
                                                            borderRadius: 999,
                                                            background: `${v.patternColor}e6`,
                                                            color: '#fff',
                                                            fontWeight: 700,
                                                            fontSize: 10
                                                        }}>
                                                            {v.pattern.replace(/^.\s*/, '')}
                                                        </span>
                                                        {v.previewSource === 'thumbnail' && (
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                padding: '5px 8px',
                                                                borderRadius: 999,
                                                                background: 'rgba(15,23,42,0.78)',
                                                                color: '#cbd5e1',
                                                                fontSize: 10
                                                            }}>
                                                                Preview
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4, textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
                                                            {v.adName}
                                                        </div>
                                                        <div style={{ fontSize: 10, color: '#cbd5e1' }}>
                                                            {[v.campaignName, v.adsetName].filter(Boolean).join(' • ') || 'Ad-level read'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ padding: 14 }}>
                                                    <p style={{ fontSize: 12, color: '#dbe4f0', marginBottom: 12, lineHeight: 1.45 }}>{v.insight}</p>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 12 }}>
                                                        {(v.retentionCurve || []).map((point: any, i: number) => (
                                                            <div key={i} style={{ textAlign: 'center' }}>
                                                                <div style={{ height: 6, borderRadius: 999, background: 'rgba(148, 163, 184, 0.18)', overflow: 'hidden', marginBottom: 6 }}>
                                                                    <div style={{
                                                                        width: `${Math.max(Math.min(point.value, 100), 3)}%`,
                                                                        height: '100%',
                                                                        borderRadius: 999,
                                                                        background: v.patternColor
                                                                    }} />
                                                                </div>
                                                                <div style={{ fontSize: 9, color: 'var(--muted)' }}>{point.stage}</div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                                                        <div style={{ padding: '10px 8px', borderRadius: 10, background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.12)' }}>
                                                            <div style={{ fontSize: 15, fontWeight: 700 }}>{v.retention.hookRate}%</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Hook Rate</div>
                                                        </div>
                                                        <div style={{ padding: '10px 8px', borderRadius: 10, background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.12)' }}>
                                                            <div style={{ fontSize: 15, fontWeight: 700 }}>{v.retention.holdRate}%</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Hold Rate</div>
                                                        </div>
                                                        <div style={{ padding: '10px 8px', borderRadius: 10, background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.12)' }}>
                                                            <div style={{ fontSize: 15, fontWeight: 700 }}>{formatNumber(v.conversions)}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Results</div>
                                                        </div>
                                                    </div>

                                                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                                                        <span>Spend {formatCurrency(v.spend)}</span>
                                                        <span>•</span>
                                                        <span>Completion {v.retention.completionRate}%</span>
                                                        <span>•</span>
                                                        <span>{v.previewSource === 'creative' ? 'Creative preview' : v.previewSource === 'thumbnail' ? 'Thumbnail preview' : 'No preview source'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Placement Diagnostics */}
                            {deepPlacementSummary && (
                                <SectionCard
                                    title={
                                        <span style={{ display: 'flex', alignItems: 'center' }}>
                                            💰 {deepProfileType === 'sales' || deepProfileType === 'mixed'
                                                ? 'Placement Conversion Efficiency'
                                                : deepProfileType === 'leads'
                                                    ? 'Placement Lead Efficiency'
                                                    : deepProfileType === 'traffic'
                                                        ? 'Placement Traffic Efficiency'
                                                        : 'Placement Delivery Efficiency'}
                                            <InfoTooltip text={
                                                deepProfileType === 'sales' || deepProfileType === 'mixed'
                                                    ? 'Ranks placements using real purchase count, ROAS, CPA, and spend share. Recommendations are practical reads built on those real values.'
                                                    : deepProfileType === 'leads'
                                                        ? 'Ranks placements using real lead count, CPL, CTR, and spend share from Meta.'
                                                        : deepProfileType === 'traffic'
                                                            ? 'Ranks placements using real landing-page-view volume, LPV rate, CPC, and spend share from Meta.'
                                                            : 'Ranks placements using the delivery metrics that matter most for the selected account focus.'
                                            } />
                                        </span>
                                    }
                                    subtitle={
                                        deepProfileType === 'sales' || deepProfileType === 'mixed'
                                            ? 'For this sales-focused account, placements are judged by whether they are actually turning spend into purchases at acceptable efficiency'
                                            : deepProfileType === 'leads'
                                                ? 'For this lead-gen account, placements are judged by lead volume and cost efficiency'
                                                : deepProfileType === 'traffic'
                                                    ? 'For this traffic-focused account, placements are judged by whether clicks become landing-page views efficiently'
                                                    : 'Placements are ranked by the metrics that best match this account focus'
                                    }
                                >
                                    {/* Summary Cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Total Placements
                                                <InfoTooltip text="How many placement combinations returned spend in the selected period." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700 }}>{deepPlacementSummary.totalPlacements}</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                {deepProfileType === 'sales' || deepProfileType === 'mixed'
                                                    ? 'Blended ROAS'
                                                    : deepProfileType === 'leads'
                                                        ? 'Blended CPL'
                                                        : deepProfileType === 'traffic'
                                                            ? 'Blended CPC'
                                                            : 'Total Spend'}
                                                <InfoTooltip text={
                                                    deepProfileType === 'sales' || deepProfileType === 'mixed'
                                                        ? 'Account-level placement ROAS benchmark: total purchase value divided by total spend across placements.'
                                                        : deepProfileType === 'leads'
                                                            ? 'Account-level placement CPL benchmark: total spend divided by total leads across placements.'
                                                            : deepProfileType === 'traffic'
                                                                ? 'Account-level placement CPC benchmark: total spend divided by total clicks across placements.'
                                                                : 'Total spend recorded across all placement rows.'
                                                } />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700 }}>
                                                {deepProfileType === 'sales' || deepProfileType === 'mixed'
                                                    ? `${Number(deepPlacementSummary.benchmarkRoas || 0).toFixed(2)}x`
                                                    : deepProfileType === 'leads'
                                                        ? formatCurrency(deepPlacementSummary.benchmarkCpl || 0)
                                                        : deepProfileType === 'traffic'
                                                            ? formatCurrency(deepPlacementSummary.benchmarkCpc || 0)
                                                            : formatCurrency(deepPlacementSummary.totalSpend || 0)}
                                            </div>
                                        </div>
                                        <div style={{ padding: 16, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, textAlign: 'center' }}>
                                            <div style={{ color: '#10b981', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Scale
                                                <InfoTooltip text="Placements already beating the relevant benchmark for this account focus with enough evidence to justify more budget." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{deepPlacementSummary.scaleCount}</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, textAlign: 'center' }}>
                                            <div style={{ color: '#f59e0b', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Review
                                                <InfoTooltip text="Placements that have spent enough to judge, but are not proving efficient enough for this account focus." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{deepPlacementSummary.reviewCount}</div>
                                            <div style={{ fontSize: 10, color: '#f59e0b' }}>
                                                {deepPlacementSummary.holdCount} hold / efficient
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{
                                        marginBottom: 24,
                                        padding: '16px 20px',
                                        background: 'rgba(99, 102, 241, 0.08)',
                                        borderRadius: 8,
                                        border: '1px solid rgba(99, 102, 241, 0.18)'
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Best efficiency read</div>
                                                <div style={{ fontWeight: 600 }}>{deepPlacementSummary.topEfficiencyPlacement?.fullName || 'No clear leader yet'}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>
                                                    {deepProfileType === 'sales' || deepProfileType === 'mixed'
                                                        ? 'Highest purchase volume'
                                                        : deepProfileType === 'leads'
                                                            ? 'Highest lead volume'
                                                            : deepProfileType === 'traffic'
                                                                ? 'Highest LPV volume'
                                                                : 'Largest delivery share'}
                                                </div>
                                                <div style={{ fontWeight: 600 }}>{deepPlacementSummary.topVolumePlacement?.fullName || 'No clear leader yet'}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>How this ranking works</div>
                                                <div style={{ fontSize: 13 }}>{deepPlacementSummary.note}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Placement Table */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Placement</th>
                                                    <th>Spend Share</th>
                                                    <th>Spend</th>
                                                    <th>{deepProfileType === 'sales' || deepProfileType === 'mixed' ? 'Purchases' : deepProfileType === 'leads' ? 'Leads' : deepProfileType === 'traffic' ? 'LPVs' : 'Reach'}</th>
                                                    <th>{deepProfileType === 'sales' || deepProfileType === 'mixed' ? 'CPA' : deepProfileType === 'leads' ? 'CPL' : deepProfileType === 'traffic' ? 'CPC' : 'CPM'}</th>
                                                    <th>{deepProfileType === 'sales' || deepProfileType === 'mixed' ? 'ROAS' : deepProfileType === 'leads' ? 'CTR' : deepProfileType === 'traffic' ? 'LPV Rate' : 'CTR'}</th>
                                                    <th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Decision <InfoTooltip text="Practical action label derived from the real placement metrics shown in this row and the account-level benchmark for this account focus." /></span></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deepPlacementRows.slice(0, 12).map((p: any, i: number) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <div style={{ fontWeight: 500 }}>{p.fullName}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                {formatNumber(p.metrics.impressions)} imp • {formatNumber(p.metrics.clicks)} clicks
                                                            </div>
                                                        </td>
                                                        <td>{p.metrics.spendShare}%</td>
                                                        <td>{formatCurrency(p.metrics.spend)}</td>
                                                        <td>{deepProfileType === 'sales' || deepProfileType === 'mixed' ? formatNumber(p.metrics.purchases) : deepProfileType === 'leads' ? formatNumber(p.metrics.leads) : deepProfileType === 'traffic' ? formatNumber(p.metrics.landingPageViews) : formatNumber(p.metrics.reach)}</td>
                                                        <td>{deepProfileType === 'sales' || deepProfileType === 'mixed' ? (p.metrics.cpa > 0 ? formatCurrency(p.metrics.cpa) : '—') : deepProfileType === 'leads' ? (p.metrics.cpl > 0 ? formatCurrency(p.metrics.cpl) : '—') : deepProfileType === 'traffic' ? formatCurrency(p.metrics.cpc) : formatCurrency(p.metrics.cpm)}</td>
                                                        <td>
                                                            <span style={{ fontWeight: 700, color: p.metrics.roas >= 1 ? '#10b981' : p.metrics.roas > 0 ? '#f59e0b' : 'var(--muted)' }}>
                                                                {deepProfileType === 'sales' || deepProfileType === 'mixed'
                                                                    ? (p.metrics.roas > 0 ? `${p.metrics.roas}x` : '—')
                                                                    : deepProfileType === 'leads'
                                                                        ? `${Number(p.metrics.ctr || 0).toFixed(2)}%`
                                                                        : deepProfileType === 'traffic'
                                                                            ? `${Number(p.metrics.lpvRate || 0).toFixed(1)}%`
                                                                            : `${Number(p.metrics.ctr || 0).toFixed(2)}%`}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span style={{
                                                                padding: '4px 10px',
                                                                borderRadius: 20,
                                                                background: `${p.recommendationColor}20`,
                                                                color: p.recommendationColor,
                                                                fontSize: 11,
                                                                fontWeight: 600
                                                            }}>
                                                                {p.recommendation}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, fontSize: 12 }}>
                                        <strong>Decision labels:</strong> `Scale` means the placement is already proving itself against the account-level benchmark for this account focus. `Review` means it has taken meaningful spend without proving efficiency. `Hold` or `Needs data` means keep watching before making a budget move.
                                    </div>
                                </SectionCard>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <p className="text-muted">No deep insights data available for this account.</p>
                        </div>
                    )}
                </div>
            )}
            {/* All Accounts Summary */}
            <SectionCard
                title={`All Ad Accounts (${adAccounts.length})`}
                subtitle="Overview of all connected ad accounts"
                collapsible
                defaultOpen={false}
            >
                <div style={{ display: 'grid', gap: 8 }}>
                    {adAccounts.slice(0, 10).map((account: any) => (
                        <div
                            key={account.id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                background: account.account_id === effectiveAccount ? 'var(--primary)' : 'var(--background)',
                                color: account.account_id === effectiveAccount ? 'white' : 'inherit',
                                borderRadius: 8,
                                cursor: 'pointer'
                            }}
                            onClick={() => setSelectedAccount(account.account_id)}
                        >
                            <div>
                                <div style={{ fontWeight: 500 }}>{account.name}</div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>{account.currency}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 600 }}>
                                    {account.amount_spent ? formatCurrency(account.amount_spent, account.currency) : '—'}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>
                                    {account.business_name || account.timezone_name || 'Account connected'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
}
