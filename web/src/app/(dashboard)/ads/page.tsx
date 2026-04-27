'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adsApi } from '@/lib/api';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';
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
    Filter, Calendar, Clock, ArrowRight, ShoppingCart, CreditCard, Package, Brain, Activity, X, MessageCircle
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

function formatMultiplier(value: number) {
    if (!value || !isFinite(value)) return '0x';
    return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)}x`;
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

function formatSignedPercent(value?: number | null, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'No baseline';
    const num = Number(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(digits)}%`;
}

function formatChartDateLabel(value?: string | null) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getDisplayInitials(value?: string | null) {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (!parts.length) return 'AD';
    return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'AD';
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

function getRiskTone(value: number) {
    if (value >= 75) return { bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.3)', color: '#f87171', label: 'High Pressure' };
    if (value >= 45) return { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', label: 'Building' };
    return { bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.3)', color: '#34d399', label: 'Stable' };
}

function getDerivedBadgeTone() {
    return { bg: 'rgba(99, 102, 241, 0.14)', color: '#c7d2fe', border: 'rgba(99, 102, 241, 0.28)' };
}

function getConfidenceTone(label: string) {
    if (label === 'High confidence') return { bg: 'rgba(16, 185, 129, 0.14)', color: '#86efac' };
    if (label === 'Medium confidence') return { bg: 'rgba(59, 130, 246, 0.14)', color: '#93c5fd' };
    return { bg: 'rgba(148, 163, 184, 0.16)', color: '#cbd5e1' };
}

function getMaturityTone(label: string) {
    if (label === 'Established') return { bg: 'rgba(16, 185, 129, 0.14)', color: '#86efac' };
    if (label === 'Building') return { bg: 'rgba(245, 158, 11, 0.14)', color: '#fcd34d' };
    return { bg: 'rgba(148, 163, 184, 0.16)', color: '#cbd5e1' };
}

function normalizeObjectiveGroup(value?: string | null) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'general';
    if (normalized.includes('sales') || normalized.includes('conversion') || normalized.includes('catalog') || normalized.includes('purchase')) return 'sales';
    if (normalized.includes('lead') || normalized.includes('message')) return 'leads';
    if (normalized.includes('traffic') || normalized.includes('click')) return 'traffic';
    if (normalized.includes('awareness') || normalized.includes('reach') || normalized.includes('video')) return 'awareness';
    if (normalized.includes('engagement')) return 'engagement';
    if (normalized.includes('app')) return 'app_promotion';
    return normalized;
}

function getObjectiveFilterLabel(value: string) {
    switch (value) {
        case 'sales':
            return 'Sales';
        case 'leads':
            return 'Lead Gen';
        case 'traffic':
            return 'Traffic';
        case 'awareness':
            return 'Awareness';
        case 'engagement':
            return 'Engagement';
        case 'app_promotion':
            return 'App Promotion';
        default:
            return toTitleCase(value);
    }
}

function statusMatchesFilter(status: string | undefined | null, filter: string) {
    const normalized = String(status || '').toUpperCase();
    if (filter === 'all') return true;
    if (filter === 'active') return normalized === 'ACTIVE';
    if (filter === 'inactive') return normalized !== 'ACTIVE';
    if (filter === 'paused') return normalized.includes('PAUSED');
    return normalized === filter.toUpperCase();
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
        page: currentPage,
        totalPages,
        start,
        end: Math.min(start + pageSize, items.length),
        items: items.slice(start, start + pageSize)
    };
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
    costPerAction,
    trendLabel
}: {
    accountProfile: any;
    summary: any;
    roas: any;
    clickMetrics: any;
    conversions: any[];
    actionValues: any[];
    costPerAction: any[];
    trendLabel: string;
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
    const messagingConnectionsMetric = findMetricEntry(conversions, ['total_messaging_connection']);

    const configByType: Record<string, Array<any>> = {
        sales: [
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: trendLabel,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'Purchase ROAS',
                value: formatRoas(roas.purchaseRoas || 0),
                icon: TrendingUp,
                color: '#22c55e',
                trend: summary.comparison?.roasTrend,
                trendLabel: trendLabel,
                tooltip: 'Return on ad spend from tracked purchases'
            },
            {
                label: 'Purchase Value',
                value: formatCurrency(purchaseValueMetric?.value || 0),
                icon: CreditCard,
                color: '#8b5cf6',
                trend: summary.comparison?.purchaseValueTrend,
                trendLabel: trendLabel,
                tooltip: 'Tracked revenue value attributed to ads'
            },
            {
                label: 'Purchases',
                value: formatNumber(purchaseMetric?.value || 0),
                icon: Package,
                color: '#f59e0b',
                trend: summary.comparison?.purchasesTrend,
                trendLabel: trendLabel,
                tooltip: 'Tracked purchase actions attributed to ads'
            },
            {
                label: 'Cost / Purchase',
                value: formatCurrency(purchaseCostMetric?.value || 0),
                icon: DollarSign,
                color: '#ef4444',
                trend: summary.comparison?.costPerPurchaseTrend,
                trendLabel: trendLabel,
                trendInvert: true,
                tooltip: 'Average spend required to drive one purchase'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#0ea5e9',
                trend: summary.comparison?.ctrTrend,
                trendLabel: trendLabel,
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
                trendLabel: trendLabel,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'Leads',
                value: formatNumber(leadMetric?.value || 0),
                icon: Target,
                color: '#6366f1',
                trend: summary.comparison?.leadsTrend,
                trendLabel: trendLabel,
                tooltip: 'Tracked lead conversions from campaigns'
            },
            {
                label: 'Cost / Lead',
                value: formatCurrency(leadCostMetric?.value || 0),
                icon: DollarSign,
                color: '#f97316',
                trend: summary.comparison?.costPerLeadTrend,
                trendLabel: trendLabel,
                trendInvert: true,
                tooltip: 'Average spend required to drive one lead'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#0ea5e9',
                trend: summary.comparison?.ctrTrend,
                trendLabel: trendLabel,
                tooltip: 'Click-through rate across all ads'
            },
            {
                label: 'CPC',
                value: formatCurrency(parseFloat(summary.cpc || 0)),
                icon: CreditCard,
                color: '#ef4444',
                trend: summary.comparison?.cpcTrend,
                trendLabel: trendLabel,
                trendInvert: true,
                tooltip: 'Average cost per click'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#ec4899',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: trendLabel,
                tooltip: 'Number of times your ads were shown on screen'
            },
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#8b5cf6',
                trend: summary.comparison?.reachTrend,
                trendLabel: trendLabel,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'CPM',
                value: formatCurrency(parseFloat(summary.cpm || 0)),
                icon: BarChart3,
                color: '#14b8a6',
                trend: summary.comparison?.cpmTrend,
                trendLabel: trendLabel,
                trendInvert: true,
                tooltip: 'Cost per 1,000 impressions'
            }
        ],
        traffic: [
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: trendLabel,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'Outbound Clicks',
                value: formatNumber(clickMetrics.outboundClicks || 0),
                icon: ArrowRight,
                color: '#0ea5e9',
                trend: summary.comparison?.clicksTrend,
                trendLabel: trendLabel,
                tooltip: 'Clicks that sent people off Meta to your destination'
            },
            {
                label: 'Cost / Link Click',
                value: formatCurrency(clickMetrics.costPerInlineLinkClick || summary.cpc || 0),
                icon: DollarSign,
                color: '#8b5cf6',
                trend: summary.comparison?.cpcTrend,
                trendLabel: trendLabel,
                trendInvert: true,
                tooltip: 'Average cost per click to your destination'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#f59e0b',
                trend: summary.comparison?.ctrTrend,
                trendLabel: trendLabel,
                tooltip: 'Click-through rate across all ads'
            },
            {
                label: 'CPM',
                value: formatCurrency(parseFloat(summary.cpm || 0)),
                icon: BarChart3,
                color: '#14b8a6',
                trend: summary.comparison?.cpmTrend,
                trendLabel: trendLabel,
                trendInvert: true,
                tooltip: 'Cost per 1,000 impressions'
            },
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#6366f1',
                trend: summary.comparison?.reachTrend,
                trendLabel: trendLabel,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#ec4899',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: trendLabel,
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
                trendLabel: trendLabel,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#0ea5e9',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: trendLabel,
                tooltip: 'Number of times your ads were shown on screen'
            },
            {
                label: 'CPM',
                value: formatCurrency(parseFloat(summary.cpm || 0)),
                icon: DollarSign,
                color: '#ec4899',
                trend: summary.comparison?.cpmTrend,
                trendLabel: trendLabel,
                trendInvert: true,
                tooltip: 'Cost per 1,000 impressions'
            },
            {
                label: 'Frequency',
                value: parseFloat(summary.frequency || 0).toFixed(2),
                icon: Activity,
                color: '#14b8a6',
                trend: summary.comparison?.frequencyTrend,
                trendLabel: trendLabel,
                tooltip: 'Average number of times each person saw your ad'
            },
            {
                label: 'Total Spend',
                value: formatCurrency(summary.spend),
                icon: IndianRupee,
                color: '#10b981',
                trend: summary.comparison?.spendTrend,
                trendLabel: trendLabel,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#f59e0b',
                trend: summary.comparison?.ctrTrend,
                trendLabel: trendLabel,
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
                trendLabel: trendLabel,
                tooltip: 'Total amount spent on ads for this account'
            },
            {
                label: 'Engagements',
                value: formatNumber(engagementMetric?.value || 0),
                icon: Activity,
                color: '#ec4899',
                trend: summary.comparison?.engagementsTrend,
                trendLabel: trendLabel,
                tooltip: 'Tracked engagement actions from campaigns'
            },
            {
                label: 'Cost / Engagement',
                value: formatCurrency(engagementCostMetric?.value || 0),
                icon: DollarSign,
                color: '#f97316',
                trend: summary.comparison?.costPerEngagementTrend,
                trendLabel: trendLabel,
                trendInvert: true,
                tooltip: 'Average spend required to drive one engagement'
            },
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#6366f1',
                trend: summary.comparison?.reachTrend,
                trendLabel: trendLabel,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#0ea5e9',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: trendLabel,
                tooltip: 'Number of times your ads were shown on screen'
            },
            {
                label: 'CTR',
                value: formatPercent(summary.ctr),
                icon: MousePointer,
                color: '#f59e0b',
                trend: summary.comparison?.clicksTrend,
                trendLabel: trendLabel,
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
                trendLabel: trendLabel,
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
                trend: summary.comparison?.ctrTrend,
                trendLabel: trendLabel,
                tooltip: 'Click-through rate across all ads'
            },
            {
                label: 'Reach',
                value: formatNumber(summary.reach),
                icon: Users,
                color: '#6366f1',
                trend: summary.comparison?.reachTrend,
                trendLabel: trendLabel,
                tooltip: 'Number of unique people who saw your ads'
            },
            {
                label: 'Impressions',
                value: formatNumber(summary.impressions),
                icon: Eye,
                color: '#ec4899',
                trend: summary.comparison?.impressionsTrend,
                trendLabel: trendLabel,
                tooltip: 'Number of times your ads were shown on screen'
            }
        ]
    };

    const selectedMetrics = configByType[accountProfile?.type || 'mixed'] || [
        {
            label: 'Total Spend',
            value: formatCurrency(summary.spend),
            icon: IndianRupee,
            color: '#10b981',
            trend: summary.comparison?.spendTrend,
            trendLabel: trendLabel,
            tooltip: 'Total amount spent on ads for this account'
        },
        {
            label: 'Impressions',
            value: formatNumber(summary.impressions),
            icon: Eye,
            color: '#0ea5e9',
            trend: summary.comparison?.impressionsTrend,
            trendLabel: trendLabel,
            tooltip: 'Number of times your ads were shown on screen'
        },
        {
            label: 'Reach',
            value: formatNumber(summary.reach),
            icon: Users,
            color: '#8b5cf6',
            trend: summary.comparison?.reachTrend,
            trendLabel: trendLabel,
            tooltip: 'Number of unique people who saw your ads'
        },
        {
            label: 'Clicks',
            value: formatNumber(summary.clicks),
            icon: MousePointer,
            color: '#f59e0b',
            trend: summary.comparison?.clicksTrend,
            trendLabel: trendLabel,
            tooltip: 'Number of clicks on your ads'
        },
        {
            label: 'CTR',
            value: formatPercent(summary.ctr),
            icon: Target,
            color: '#22c55e',
            trend: summary.comparison?.ctrTrend,
            trendLabel: trendLabel,
            tooltip: 'Click-through rate across all ads'
        },
        {
            label: 'CPC',
            value: formatCurrency(parseFloat(summary.cpc || 0)),
            icon: CreditCard,
            color: '#ef4444',
            trend: summary.comparison?.cpcTrend,
            trendLabel: trendLabel,
            trendInvert: true,
            tooltip: 'Average cost per click'
        },
        {
            label: 'CPM',
            value: formatCurrency(parseFloat(summary.cpm || 0)),
            icon: BarChart3,
            color: '#14b8a6',
            trend: summary.comparison?.cpmTrend,
            trendLabel: trendLabel,
            trendInvert: true,
            tooltip: 'Cost per 1,000 impressions'
        },
        {
            label: 'Frequency',
            value: parseFloat(summary.frequency || 0).toFixed(2),
            icon: Activity,
            color: '#ec4899',
            trend: summary.comparison?.frequencyTrend,
            trendLabel: trendLabel,
            tooltip: 'Average number of times each person saw your ad'
        }
    ];

    const messagingConnectionsValue = Number(messagingConnectionsMetric?.value || 0);

    if (messagingConnectionsValue > 0) {
        return [
            ...selectedMetrics,
            {
                label: 'Messaging Connections',
                value: formatNumber(messagingConnectionsValue),
                icon: MessageCircle,
                color: '#22c55e',
                tooltip: 'Unique people who messaged your business on Messenger, Instagram, or WhatsApp in the selected reporting window.'
            }
        ];
    }

    return selectedMetrics;
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

function MetricCard({ label, value, icon: Icon, trend, trendLabel, color, tooltip, trendInvert }: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    trend?: number;
    trendLabel?: string;
    color: string;
    tooltip?: string;
    trendInvert?: boolean;
}) {
    const formattedTrend = trend !== undefined
        ? `${trend >= 0 ? '+' : ''}${Number.isInteger(trend) ? trend : trend.toFixed(1)}%`
        : null;
    const isPositive = trendInvert ? (trend !== undefined && trend <= 0) : (trend !== undefined && trend >= 0);

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
                    {isPositive ? (
                        <TrendingUp size={14} style={{ color: '#10b981' }} />
                    ) : (
                        <TrendingUp size={14} style={{ color: '#ef4444', transform: 'rotate(180deg)' }} />
                    )}
                    <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isPositive ? '#10b981' : '#ef4444'
                    }}>
                        {formattedTrend}
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

function SpendTrendAreaChart({
    points,
    comparisonLabel,
    height = 240
}: {
    points: Array<{ dateStart?: string | null; spend?: number; previousSpend?: number }>;
    comparisonLabel?: string | null;
    height?: number;
}) {
    const chartData = (points || []).map((point) => ({
        label: formatChartDateLabel(point?.dateStart || null),
        spend: Number(point?.spend || 0),
        previousSpend: Number(point?.previousSpend || 0)
    }));
    const hasComparison = Boolean(comparisonLabel) && chartData.some((point) => point.previousSpend > 0);

    if (!chartData.length) {
        return (
            <div style={{
                minHeight: height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted)',
                fontSize: 13
            }}>
                Spend trend unavailable for this selection.
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData}>
                <defs>
                    <linearGradient id="campaignSpendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="campaignSpendPrevFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                    width={72}
                />
                <RechartsTooltip
                    formatter={(value, key) => [
                        formatCurrency(Number(value || 0)),
                        key === 'previousSpend' ? (comparisonLabel || 'Previous period') : 'Spend'
                    ]}
                    labelFormatter={(value) => `Date: ${value}`}
                    contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: 10,
                        color: '#fff'
                    }}
                />
                {hasComparison && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {hasComparison && (
                    <Area
                        type="monotone"
                        dataKey="previousSpend"
                        name={comparisonLabel || 'Previous period'}
                        stroke="#94a3b8"
                        fill="url(#campaignSpendPrevFill)"
                        strokeWidth={2}
                    />
                )}
                <Area
                    type="monotone"
                    dataKey="spend"
                    name="Spend"
                    stroke="#2563eb"
                    fill="url(#campaignSpendFill)"
                    strokeWidth={3}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function MediaThumb({
    src,
    alt,
    previewSource,
    label,
    kind,
    width,
    height,
    radius = 16
}: {
    src?: string | null;
    alt: string;
    previewSource?: string | null;
    label?: string | null;
    kind?: string;
    width: number | string;
    height: number | string;
    radius?: number;
}) {
    const initials = getDisplayInitials(label || alt);
    const contain = previewSource === 'thumbnail';
    const numericWidth = typeof width === 'number' ? width : null;
    const numericHeight = typeof height === 'number' ? height : null;
    const sizeBasis = Math.min(numericWidth || numericHeight || 80, numericHeight || numericWidth || 80);

    return (
        <div style={{
            width,
            height,
            borderRadius: radius,
            overflow: 'hidden',
            flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(37,99,235,0.16), rgba(15,23,42,0.22))',
            border: '1px solid rgba(148,163,184,0.16)',
            position: 'relative'
        }}>
            {src ? (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: contain ? 'contain' : 'cover',
                        background: contain ? 'rgba(15,23,42,0.94)' : 'transparent',
                        padding: contain ? 8 : 0,
                        display: 'block'
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e2e8f0',
                    background: 'linear-gradient(180deg, rgba(30,41,59,0.85), rgba(15,23,42,0.94))',
                    padding: 8,
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: Math.max(16, Math.floor(sizeBasis * 0.28)), fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1 }}>
                        {initials}
                    </div>
                    <div style={{ fontSize: 9, opacity: 0.72, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {kind || 'Preview'}
                    </div>
                </div>
            )}
        </div>
    );
}

function CreativeSpendModal({
    creative,
    comparisonLabel,
    onClose
}: {
    creative: any;
    comparisonLabel?: string | null;
    onClose: () => void;
}) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (typeof document === 'undefined' || !creative) return null;

    const retention = creative.retention || null;

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.78)',
                backdropFilter: 'blur(6px)',
                zIndex: 1000001,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20
            }}
            onClick={onClose}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: 'min(920px, 100%)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))',
                    color: '#0f172a',
                    borderRadius: 20,
                    boxShadow: '0 24px 80px rgba(15, 23, 42, 0.32)',
                    border: '1px solid rgba(148,163,184,0.18)'
                }}
            >
                <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.16)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <MediaThumb
                            src={creative.thumbnail}
                            alt={creative.adName}
                            previewSource={creative.previewSource}
                            label={creative.adName}
                            kind="Creative"
                            width={92}
                            height={92}
                            radius={16}
                        />
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
                                Creative Spend Trend
                            </div>
                            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{creative.adName}</h3>
                            <div style={{ marginTop: 6, fontSize: 13, color: '#64748b' }}>
                                {[creative.adsetName, creative.creativeName].filter(Boolean).join(' • ') || 'Ad-level creative'}
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(37,99,235,0.1)', color: '#1d4ed8', fontSize: 12, fontWeight: 700 }}>
                                    Spend {formatCurrency(creative.metrics?.spend || 0)}
                                </span>
                                <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(148,163,184,0.12)', color: '#334155', fontSize: 12, fontWeight: 700 }}>
                                    {comparisonLabel || 'Selected period'} {formatSignedPercent(creative.comparison?.spendDeltaPct)}
                                </span>
                                {retention && (
                                    <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', color: '#047857', fontSize: 12, fontWeight: 700 }}>
                                        Hold {formatCompactPercent(retention.holdRate || 0)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            border: 'none',
                            background: 'rgba(148,163,184,0.14)',
                            color: '#0f172a',
                            width: 36,
                            height: 36,
                            borderRadius: 999,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: 20 }}>
                    <div style={{ marginBottom: 18 }}>
                        <SpendTrendAreaChart points={creative.spendTrend || []} comparisonLabel={comparisonLabel} height={280} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                        <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(148,163,184,0.16)' }}>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5 }}>Primary Result</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{formatNumber(creative.primaryMetric?.value || 0)}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{creative.primaryMetric?.label || 'Results'}</div>
                        </div>
                        <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(148,163,184,0.16)' }}>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5 }}>CTR</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{formatPercent(creative.metrics?.ctr || 0)}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{formatNumber(creative.metrics?.impressions || 0)} impressions</div>
                        </div>
                        <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(148,163,184,0.16)' }}>
                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5 }}>Cost / Result</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                                {creative.primaryMetric?.costValue ? formatCurrency(creative.primaryMetric.costValue) : '—'}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{creative.primaryMetric?.costLabel || 'Cost efficiency'}</div>
                        </div>
                        {retention && (
                            <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(148,163,184,0.16)' }}>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 5 }}>Video Retention</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{formatCompactPercent(retention.hookRate || 0)}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>Hook • Hold {formatCompactPercent(retention.holdRate || 0)}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

function CampaignDrilldownDrawer({
    open,
    loading,
    loadingMore,
    hasMore,
    data,
    onClose,
    onCreativeSelect,
    onLoadMore
}: {
    open: boolean;
    loading: boolean;
    loadingMore?: boolean;
    hasMore?: boolean;
    data: any;
    onClose: () => void;
    onCreativeSelect: (creative: any) => void;
    onLoadMore: () => void;
}) {
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    const campaign = data?.campaign || null;
    const creativeSummary = data?.creativeSummary || {};
    const spendTrend = data?.spendTrend || {};
    const creatives = data?.creatives || [];
    const pagination = data?.pagination || null;

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000000, display: 'flex', justifyContent: 'flex-end' }}>
            <button
                type="button"
                aria-label="Close campaign drilldown"
                onClick={onClose}
                style={{
                    flex: 1,
                    border: 'none',
                    background: 'rgba(2, 6, 23, 0.62)',
                    backdropFilter: 'blur(3px)',
                    cursor: 'pointer'
                }}
            />
            <aside style={{
                width: 'min(1120px, 100vw)',
                height: '100vh',
                overflowY: 'auto',
                background: 'linear-gradient(180deg, #0f1219, #0b0d14)',
                color: '#e2e8f0',
                borderLeft: '1px solid rgba(148,163,184,0.12)',
                boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.5)',
                padding: 24
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>
                            Campaign Drilldown
                        </div>
                        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#f1f5f9' }}>{campaign?.name || 'Loading campaign...'}</h2>
                        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)', maxWidth: 720 }}>
                            Click any creative preview to open its spend graph. Current period is compared against the previous matching window when the active preset supports it.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            border: '1px solid rgba(148,163,184,0.18)',
                            background: 'rgba(255,255,255,0.06)',
                            color: '#e2e8f0',
                            width: 40,
                            height: 40,
                            borderRadius: 999,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                        <div className="spinner" />
                        <p className="text-muted" style={{ margin: 0 }}>Loading campaign and creative analytics...</p>
                    </div>
                ) : campaign ? (
                    <div style={{ display: 'grid', gap: 18 }}>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 24, border: '1px solid rgba(148,163,184,0.1)', padding: 20, boxShadow: '0 18px 40px rgba(0,0,0,0.2)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.75fr)', gap: 20, alignItems: 'stretch' }}>
                                <div>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
                                    <MediaThumb
                                        src={campaign.thumbnail}
                                        alt={campaign.name}
                                        previewSource={campaign.previewSource}
                                        label={campaign.name}
                                        kind="Campaign"
                                        width={92}
                                        height={92}
                                        radius={18}
                                    />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                            <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(37,99,235,0.1)', color: '#1d4ed8', fontSize: 11, fontWeight: 700 }}>
                                                {campaign.typeLabel || 'General'}
                                            </span>
                                            <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(148,163,184,0.16)', color: '#cbd5e1', fontSize: 11, fontWeight: 700 }}>
                                                {campaign.status?.replace(/_/g, ' ') || 'UNKNOWN'}
                                            </span>
                                            <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', color: '#047857', fontSize: 11, fontWeight: 700 }}>
                                                {campaign.budgetMode}{campaign.budgetAmount ? ` • ${formatCurrency(campaign.budgetAmount)}` : ''}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                                            {campaign.objectiveLabel} • Updated {formatShortDate(campaign.updatedTime)}
                                        </div>
                                        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(15,23,42,0.3)', color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>
                                                {creativeSummary.adsCount || 0} ads
                                            </span>
                                            <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#4338ca', fontSize: 12, fontWeight: 700 }}>
                                                {creativeSummary.creativesCount || 0} creatives
                                            </span>
                                            <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(245,158,11,0.14)', color: '#b45309', fontSize: 12, fontWeight: 700 }}>
                                                {creativeSummary.videoCreativesCount || 0} video creatives
                                            </span>
                                            {(creativeSummary.multiAssetCreativesCount || 0) > 0 && (
                                                <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(14,165,233,0.12)', color: '#0369a1', fontSize: 12, fontWeight: 700 }}>
                                                    {creativeSummary.multiAssetCreativesCount} multi-asset
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.12)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Spend</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>{formatCurrency(campaign.metrics?.spend || 0)}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{spendTrend.comparisonLabel || 'Selected period'} {formatSignedPercent(campaign.comparison?.spendDeltaPct)}</div>
                                    </div>
                                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{campaign.primaryMetric?.label || 'Results'}</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>{formatNumber(campaign.primaryMetric?.value || 0)}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{campaign.primaryMetric?.costValue ? `${campaign.primaryMetric.costLabel}: ${formatCurrency(campaign.primaryMetric.costValue)}` : 'No cost baseline yet'}</div>
                                    </div>
                                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.16)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>CTR / Clicks</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>{formatPercent(campaign.metrics?.ctr || 0)}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{formatNumber(campaign.metrics?.linkClicks || 0)} link clicks</div>
                                    </div>
                                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.16)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>ROAS / Frequency</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>{formatRoas(campaign.metrics?.purchaseRoas || 0)}</div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>{Number(campaign.metrics?.frequency || 0).toFixed(2)}x frequency</div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                                    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>CPM</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{campaign.metrics?.cpm ? formatCurrency(campaign.metrics.cpm) : '—'}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>Cost per 1K imp</div>
                                    </div>
                                    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>CPC</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{campaign.metrics?.cpc ? formatCurrency(campaign.metrics.cpc) : '—'}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>Cost per click</div>
                                    </div>
                                    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Reach</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{formatNumber(campaign.metrics?.reach || 0)}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>Unique people</div>
                                    </div>
                                    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Impressions</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{formatNumber(campaign.metrics?.impressions || 0)}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>Total shown</div>
                                    </div>
                                    {(campaign.metrics?.purchases || 0) > 0 && (
                                        <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                                            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Revenue</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{formatCurrency(campaign.metrics?.purchaseValue || 0)}</div>
                                            <div style={{ fontSize: 11, color: '#64748b' }}>{formatNumber(campaign.metrics?.purchases || 0)} purchases</div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontSize: 18, fontWeight: 700 }}>Spend Trends</div>
                                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                                Current campaign spend vs the previous matching window for the selected preset
                                            </div>
                                        </div>
                                        {spendTrend.comparisonLabel && (
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', padding: '6px 10px', borderRadius: 999, background: 'rgba(148,163,184,0.12)' }}>
                                                {spendTrend.comparisonLabel}
                                            </div>
                                        )}
                                    </div>
                                    <SpendTrendAreaChart points={spendTrend.points || []} comparisonLabel={spendTrend.comparisonLabel} height={280} />
                                </div>
                                </div>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <div style={{ padding: '16px 18px', borderRadius: 18, background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.14)' }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 8 }}>
                                            Quick Read
                                        </div>
                                        <div style={{ display: 'grid', gap: 10 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, marginBottom: 3 }}>Pacing</div>
                                                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                                                    This chart shows whether the campaign is spending faster or softer than the previous matching window.
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, marginBottom: 3 }}>Creative depth</div>
                                                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                                                    The drawer loads the latest creatives first so you can inspect the freshest units quickly, then pull in more only when you need them.
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, marginBottom: 3 }}>Creative quality</div>
                                                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                                                    Each creative shows spend, result efficiency, and video hold rate when Meta returns watch-depth data.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(148,163,184,0.08)', padding: 18 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>
                                        Latest Creatives ({creatives.length}{pagination?.total ? ` / ${pagination.total}` : ''})
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                        Loading the newest creatives first keeps the drawer fast. Click a preview image to open that creative's spend graph.
                                    </div>
                                </div>
                                {pagination?.total > 0 && (
                                    <div style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(148,163,184,0.12)', color: '#cbd5e1', fontSize: 12, fontWeight: 700 }}>
                                        Showing {Math.min(creatives.length, pagination.total)} of {pagination.total}
                                    </div>
                                )}
                            </div>

                            {creatives.length ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
                                    {creatives.map((creative: any) => (
                                        <div key={creative.adId} style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                                            <button
                                                type="button"
                                                onClick={() => onCreativeSelect(creative)}
                                                style={{
                                                    width: '100%',
                                                    border: 'none',
                                                    padding: 0,
                                                    margin: 0,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    background: 'transparent'
                                                }}
                                            >
                                                <div style={{ position: 'relative', height: 160, background: 'linear-gradient(135deg, rgba(37,99,235,0.16), rgba(15,23,42,0.22))' }}>
                                                    <MediaThumb
                                                        src={creative.thumbnail}
                                                        alt={creative.adName}
                                                        previewSource={creative.previewSource}
                                                        label={creative.adName}
                                                        kind="Creative"
                                                        width="100%"
                                                        height={160}
                                                        radius={0}
                                                    />
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.04), rgba(15,23,42,0.64))' }} />
                                                    <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                        <span style={{ padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.9)', color: '#0f172a', fontSize: 10, fontWeight: 700 }}>
                                                            Click for spend graph
                                                        </span>
                                                        {creative.hasVideo && (
                                                            <span style={{ padding: '5px 9px', borderRadius: 999, background: 'rgba(16,185,129,0.9)', color: '#052e16', fontSize: 10, fontWeight: 800 }}>
                                                                Video
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4, textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
                                                            {creative.adName}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: '#dbe4f0' }}>
                                                            {[creative.adsetName, creative.creativeName].filter(Boolean).join(' • ') || 'Creative detail'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>

                                            <div style={{ padding: 16 }}>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                                    <span style={{ padding: '5px 8px', borderRadius: 999, background: 'rgba(37,99,235,0.12)', color: '#93c5fd', fontSize: 11, fontWeight: 700 }}>
                                                        Spend {formatCurrency(creative.metrics?.spend || 0)}
                                                    </span>
                                                    <span style={{ padding: '5px 8px', borderRadius: 999, background: 'rgba(148,163,184,0.12)', color: '#cbd5e1', fontSize: 11, fontWeight: 700 }}>
                                                        {spendTrend.comparisonLabel || 'Selected period'} {formatSignedPercent(creative.comparison?.spendDeltaPct)}
                                                    </span>
                                                    {creative.assetCount > 1 && (
                                                        <span style={{ padding: '5px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.14)', color: '#fbbf24', fontSize: 11, fontWeight: 700 }}>
                                                            {creative.assetCount} assets
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                                                    <div style={{ padding: '10px 10px', borderRadius: 12, background: 'rgba(15,23,42,0.04)' }}>
                                                        <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{formatNumber(creative.primaryMetric?.value || 0)}</div>
                                                        <div style={{ fontSize: 10, color: '#64748b' }}>{creative.primaryMetric?.label || 'Results'}</div>
                                                    </div>
                                                    <div style={{ padding: '10px 10px', borderRadius: 12, background: 'rgba(15,23,42,0.04)' }}>
                                                        <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{formatPercent(creative.metrics?.ctr || 0)}</div>
                                                        <div style={{ fontSize: 10, color: '#64748b' }}>CTR</div>
                                                    </div>
                                                    <div style={{ padding: '10px 10px', borderRadius: 12, background: 'rgba(15,23,42,0.04)' }}>
                                                        <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>
                                                            {creative.primaryMetric?.costValue ? formatCurrency(creative.primaryMetric.costValue) : '—'}
                                                        </div>
                                                        <div style={{ fontSize: 10, color: '#64748b' }}>{creative.primaryMetric?.costLabel || 'Cost / Result'}</div>
                                                    </div>
                                                </div>

                                                {creative.retention ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                                                        <div style={{ padding: '10px 8px', borderRadius: 12, background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.1)', textAlign: 'center' }}>
                                                            <div style={{ fontSize: 15, fontWeight: 800 }}>{formatCompactPercent(creative.retention.hookRate || 0)}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Hook Rate</div>
                                                        </div>
                                                        <div style={{ padding: '10px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', textAlign: 'center' }}>
                                                            <div style={{ fontSize: 15, fontWeight: 800 }}>{formatCompactPercent(creative.retention.holdRate || 0)}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Hold Rate</div>
                                                        </div>
                                                        <div style={{ padding: '10px 8px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', textAlign: 'center' }}>
                                                            <div style={{ fontSize: 15, fontWeight: 800 }}>{formatCompactPercent(creative.retention.completionRate || 0)}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Completion</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(148,163,184,0.12)', color: 'var(--muted)', fontSize: 11, marginBottom: 12 }}>
                                                        No video retention signal on this creative yet.
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--muted)' }}>
                                                    <span>{formatNumber(creative.metrics?.impressions || 0)} impressions</span>
                                                    <span>{Number(creative.metrics?.frequency || 0).toFixed(2)}x freq</span>
                                                    <span>{creative.status?.replace(/_/g, ' ') || 'UNKNOWN'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--muted)' }}>
                                    No creative-level rows surfaced for this campaign in the selected window.
                                </div>
                            )}
                            {hasMore && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
                                    <button
                                        type="button"
                                        onClick={onLoadMore}
                                        disabled={loadingMore}
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: 12,
                                            border: 'none',
                                            background: 'var(--primary)',
                                            color: '#ffffff',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            cursor: loadingMore ? 'not-allowed' : 'pointer',
                                            opacity: loadingMore ? 0.7 : 1,
                                            transition: 'all 0.15s ease',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {loadingMore ? 'Loading more...' : 'Load More Creatives'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                        Campaign drilldown data is unavailable right now.
                    </div>
                )}
            </aside>
        </div>,
        document.body
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

function FilterSelect({
    label,
    value,
    onChange,
    options,
    tooltip
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    tooltip?: string;
}) {
    return (
        <label style={{ display: 'grid', gap: 6, minWidth: 150 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
                {label}
                {tooltip && <InfoTooltip text={tooltip} />}
            </span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 12
                }}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </label>
    );
}

function FilterInput({
    label,
    value,
    onChange,
    placeholder,
    tooltip
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    tooltip?: string;
}) {
    return (
        <label style={{ display: 'grid', gap: 6, minWidth: 220, flex: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
                {label}
                {tooltip && <InfoTooltip text={tooltip} />}
            </span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 12
                }}
            />
        </label>
    );
}

function SectionPager({
    page,
    totalPages,
    count,
    pageSize,
    onPageChange
}: {
    page: number;
    totalPages: number;
    count: number;
    pageSize: number;
    onPageChange: (page: number) => void;
}) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Showing {count === 0 ? '0' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, count)}`} of {count}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                    Prev
                </button>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Page {page} of {totalPages}</span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                    Next
                </button>
            </div>
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
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 6); // default: last 7 days
    const toYMD = (d: Date) => d.toLocaleDateString('en-CA');
    const [dateRange, setDateRange] = useState({ startDate: toYMD(defaultStart), endDate: toYMD(defaultEnd) });

    // Derive a datePreset string for the API (if the range matches a known preset, use it; otherwise pass custom dates)
    const datePreset = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endD = new Date(dateRange.endDate);
        endD.setHours(0, 0, 0, 0);
        const startD = new Date(dateRange.startDate);
        startD.setHours(0, 0, 0, 0);
        const daySpan = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
        const isEndToday = endD.getTime() === today.getTime();
        const isEndYesterday = endD.getTime() === today.getTime() - 86400000;

        if (daySpan === 1 && isEndToday) return 'today';
        if (daySpan === 1 && isEndYesterday) return 'yesterday';
        if (daySpan === 7 && isEndToday) return 'last_7d';
        if (daySpan === 14 && isEndToday) return 'last_14d';
        if (daySpan === 30 && isEndToday) return 'last_30d';
        if (daySpan === 90 && isEndToday) return 'last_90d';
        return 'custom'; // custom range — pass startDate/endDate to API
    }, [dateRange]);

    // Custom date params to pass to API calls
    const customStartDate = datePreset === 'custom' ? dateRange.startDate : undefined;
    const customEndDate = datePreset === 'custom' ? dateRange.endDate : undefined;
    const [campaignSearch, setCampaignSearch] = useState('');
    const [campaignTypeFilter, setCampaignTypeFilter] = useState('all');
    const [campaignStatusFilter, setCampaignStatusFilter] = useState('all');
    const [campaignSort, setCampaignSort] = useState('spend_desc');
    const [campaignMinRoas, setCampaignMinRoas] = useState('');
    const [campaignMinCtr, setCampaignMinCtr] = useState('');
    const [campaignMaxCpm, setCampaignMaxCpm] = useState('');
    const [campaignMinSpend, setCampaignMinSpend] = useState('');
    const [campaignSignalFilter, setCampaignSignalFilter] = useState('all');
    const [campaignQualityFilter, setCampaignQualityFilter] = useState('all');
    const [campaignFunnelFilter, setCampaignFunnelFilter] = useState('all');
    const [campaignReadinessFilter, setCampaignReadinessFilter] = useState('all');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [campaignPage, setCampaignPage] = useState(1);
    const [scaleFilters, setScaleFilters] = useState({ search: '', objective: 'all', status: 'active', sort: 'score_desc', page: 1 });
    const [cqiFilters, setCqiFilters] = useState({ search: '', objective: 'all', status: 'active', confidence: 'all', sort: 'score_desc', page: 1 });
    const [creativeFilters, setCreativeFilters] = useState({ search: '', status: 'all', format: 'all', diagnosis: 'all', sort: 'score_desc', page: 1 });
    const [deliveryFilters, setDeliveryFilters] = useState({ search: '', objective: 'all', status: 'active', readiness: 'all', sort: 'spend_desc', page: 1 });
    const [funnelFilters, setFunnelFilters] = useState({ search: '', objective: 'all', status: 'active', sort: 'roas_desc', page: 1 });
    const [videoFilters, setVideoFilters] = useState({ search: '', status: 'all', confidence: 'all', diagnosis: 'all', sort: 'quality_desc', page: 1 });
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null);
    const creativePageSize = 10;

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
        queryKey: ['ad-insights', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getAdInsights(effectiveAccount, datePreset, customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount,
        refetchOnWindowFocus: false
    });

    const { data: demographicsData, isLoading: demographicsLoading } = useQuery({
        queryKey: ['ad-demographics', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getDemographics(effectiveAccount, datePreset, customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'demographics',
        refetchOnWindowFocus: false
    });

    const { data: geographyData, isLoading: geographyLoading } = useQuery({
        queryKey: ['ad-geography', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getGeography(effectiveAccount, datePreset, customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount && (activeTab === 'geo' || activeTab === 'demographics'),
        refetchOnWindowFocus: false
    });

    // Fetch campaigns
    const { data: campaignsData } = useQuery({
        queryKey: ['campaigns', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getCampaigns(effectiveAccount, datePreset, customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'campaigns'
    });

    const {
        data: campaignDrilldownPages,
        isLoading: campaignDrilldownLoading,
        isFetchingNextPage: campaignDrilldownLoadingMore,
        fetchNextPage: fetchMoreCampaignCreatives,
        hasNextPage: campaignDrilldownHasNextPage
    } = useInfiniteQuery({
        queryKey: ['campaign-drilldown', effectiveAccount, selectedCampaignId, datePreset, dateRange.startDate, dateRange.endDate, creativePageSize],
        initialPageParam: 0,
        queryFn: async ({ pageParam }) => {
            if (!effectiveAccount || !selectedCampaignId) return null;
            const res = await adsApi.getCampaignDrilldown(effectiveAccount, selectedCampaignId, datePreset, Number(pageParam || 0), creativePageSize, customStartDate, customEndDate);
            return res.data;
        },
        getNextPageParam: (lastPage) => {
            const nextOffset = lastPage?.data?.pagination?.nextOffset;
            return nextOffset ?? undefined;
        },
        enabled: !!effectiveAccount && !!selectedCampaignId
    });

    // Fetch conversion funnel
    const { data: funnelData, isLoading: funnelLoading } = useQuery({
        queryKey: ['funnel', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getConversionFunnel(effectiveAccount, datePreset, customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'funnel'
    });

    // Fetch campaign intelligence
    const { data: intelligenceData, isLoading: intelligenceLoading } = useQuery({
        queryKey: ['intelligence', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getCampaignIntelligence(effectiveAccount, datePreset, customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount && (activeTab === 'intelligence' || (activeTab === 'campaigns' && showAdvancedFilters))
    });

    // Fetch advanced analytics
    const { data: advancedData, isLoading: advancedLoading } = useQuery({
        queryKey: ['advanced', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getAdvancedAnalytics(effectiveAccount, datePreset, customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount && (activeTab === 'advanced' || (activeTab === 'campaigns' && showAdvancedFilters))
    });

    // Fetch deep insights (Nurture Funnel, Bounce Gap, Video Hook, Placement Arbitrage)
    const { data: deepInsightsData, isLoading: deepInsightsLoading, error: deepInsightsError } = useQuery({
        queryKey: ['deep-insights', 'funnel', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getDeepInsights(effectiveAccount, datePreset, 'funnel', customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount && (activeTab === 'funnel' || (activeTab === 'campaigns' && showAdvancedFilters)),
        retry: 1
    });
    const { data: deepDiagnosticsData, isLoading: deepDiagnosticsLoading, error: deepDiagnosticsError } = useQuery({
        queryKey: ['deep-insights', 'diagnostics', effectiveAccount, datePreset, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getDeepInsights(effectiveAccount, datePreset, 'diagnostics', customStartDate, customEndDate);
            return res.data;
        },
        enabled: !!effectiveAccount && activeTab === 'deep',
        retry: 1
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
    const totalDemographicSpend = demographics.reduce((sum: number, row: any) => sum + Number(row?.spend || 0), 0);
    const demographicRows = [...demographics].sort((a: any, b: any) => {
        const spendDiff = Number(b?.spend || 0) - Number(a?.spend || 0);
        if (spendDiff !== 0) return spendDiff;
        return Number(b?.purchaseRoas || 0) - Number(a?.purchaseRoas || 0);
    });
    const topDemographicRow = demographicRows[0] || null;
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
    const countryPerformanceRows = [...countries]
        .filter((country: any) => Number(country?.spend || 0) > 0)
        .sort((a: any, b: any) => {
            const roasDiff = Number(b?.purchaseRoas || 0) - Number(a?.purchaseRoas || 0);
            if (roasDiff !== 0) return roasDiff;
            return Number(b?.purchaseValue || 0) - Number(a?.purchaseValue || 0);
        });
    const topCountryByRoas = countryPerformanceRows.find((country: any) => Number(country?.purchaseRoas || 0) > 0) || null;
    const countryRoasCoverage = countryPerformanceRows.filter((country: any) => Number(country?.purchaseRoas || 0) > 0).length;
    const showRegionPurchaseColumns = regionRoasCoverage > 0;
    const showCountryPurchaseColumns = countryRoasCoverage > 0;
    const topRegionByCtr = [...regionPerformanceRows].sort((a: any, b: any) => Number(b?.ctr || 0) - Number(a?.ctr || 0))[0] || null;
    const topRegionBySpend = [...regionPerformanceRows].sort((a: any, b: any) => Number(b?.spend || 0) - Number(a?.spend || 0))[0] || null;
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
    const spendComparisonLabel = useMemo(() => {
        const startD = new Date(dateRange.startDate);
        const endD = new Date(dateRange.endDate);
        const daySpan = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
        if (daySpan === 1 && datePreset === 'today') return 'Today vs yesterday';
        if (daySpan === 1) return 'Selected day vs previous day';
        return `Current ${daySpan} days vs previous ${daySpan} days`;
    }, [dateRange, datePreset]);

    const overviewMetricCards = buildMetaAdsOverviewMetrics({
        accountProfile,
        summary,
        roas,
        clickMetrics,
        conversions,
        actionValues,
        costPerAction,
        trendLabel: spendComparisonLabel
    });
    const showRoasSection = ['sales', 'mixed'].includes(accountProfile?.type) || Number(roas.purchaseRoas || 0) > 0 || Number(roas.websitePurchaseRoas || 0) > 0;
    const showConversionsSection = accountProfile?.type !== 'awareness';
    const showDiagnosticsSection = accountProfile?.type !== 'app_promotion';
    const showVideoRetentionSection = ['awareness', 'engagement', 'mixed'].includes(accountProfile?.type) || Object.values(videoViews || {}).some((value) => Number(value || 0) > 0);

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
    const campaignDerivedById = useMemo(() => {
        const byId = new Map<string, any>();
        const byName = new Map<string, any>();
        const normalizeName = (value?: string | null) => String(value || '').trim().toLowerCase();
        const ensure = (id?: string | number | null, name?: string | null) => {
            const key = id ? String(id) : '';
            const nameKey = normalizeName(name);
            const existing = (key && byId.get(key)) || (nameKey && byName.get(nameKey)) || { id: key || null, name: name || null };
            if (key) byId.set(key, existing);
            if (nameKey) byName.set(nameKey, existing);
            return existing;
        };

        (intelligenceData?.data?.campaigns || []).forEach((row: any) => {
            const item = ensure(row.id, row.name);
            item.scale = row;
        });
        ((advancedData?.data?.campaignQualityIndex || advancedData?.data?.leadQualityScore)?.campaigns || []).forEach((row: any) => {
            const item = ensure(row.id, row.name);
            item.cqi = row;
        });
        (deepInsightsData?.data?.campaignFunnels || []).forEach((row: any) => {
            const item = ensure(row.campaignId, row.campaignName);
            item.funnel = row;
        });
        (advancedData?.data?.learningPhase || []).forEach((row: any) => {
            const item = ensure(null, row.campaignName);
            const current = item.readiness;
            if (!current || Number(row.spend || 0) > Number(current.spend || 0)) {
                item.readiness = row;
            }
        });

        campaigns.forEach((campaign: any) => {
            const item = ensure(campaign.id, campaign.name);
            item.base = campaign;
            if (campaign.id) byId.set(String(campaign.id), item);
        });

        return byId;
    }, [campaigns, intelligenceData, advancedData, deepInsightsData]);
    const getCampaignDerived = (campaign: any) => campaignDerivedById.get(String(campaign?.id || '')) || {};
    const derivedCampaignDataLoading = showAdvancedFilters && (intelligenceLoading || advancedLoading || deepInsightsLoading);
    const derivedCampaignDataReady = Boolean(
        (intelligenceData?.data?.campaigns || []).length
        || ((advancedData?.data?.campaignQualityIndex || advancedData?.data?.leadQualityScore)?.campaigns || []).length
        || (deepInsightsData?.data?.campaignFunnels || []).length
        || (advancedData?.data?.learningPhase || []).length
    );
    const getCampaignSignal = (campaign: any) => {
        const derived = getCampaignDerived(campaign);
        const scale = derived.scale;
        const cqi = derived.cqi;
        const funnel = derived.funnel;
        const readiness = derived.readiness;
        const score = Number(scale?.efficiencyScore || 0);
        const cqiScore = Number(cqi?.lqs || 0);
        const roas = Number(funnel?.conversions?.roas ?? campaign?.metrics?.purchaseRoas ?? 0);
        const clickLoss = funnel?.dropoffs?.bounceGap;
        const readinessStatus = String(readiness?.learningStatus?.status || '').toLowerCase();

        if (readinessStatus === 'limited' || cqiScore > 0 && cqiScore < 45 || clickLoss !== null && clickLoss !== undefined && Number(clickLoss) >= 45) {
            return { key: 'fix', label: 'Fix first', color: '#f87171', bg: 'rgba(239,68,68,0.14)', metric: cqiScore ? `CQI ${Math.round(cqiScore)}` : clickLoss !== null && clickLoss !== undefined ? `${clickLoss}% click loss` : 'Learning limited' };
        }
        if (score >= 70 || roas >= 2.5 && Number(campaign?.metrics?.spend || 0) > 0) {
            return { key: 'scale', label: 'Scale candidate', color: '#34d399', bg: 'rgba(16,185,129,0.14)', metric: score ? `Score ${Math.round(score)}` : `${roas.toFixed(1)}x ROAS` };
        }
        if (readinessStatus === 'learning' || readinessStatus === 'delivery_learning' || Number(campaign?.metrics?.spend || 0) > 0) {
            return { key: 'watch', label: 'Watch', color: '#fbbf24', bg: 'rgba(245,158,11,0.14)', metric: readinessStatus.includes('learning') ? 'Learning' : 'Needs proof' };
        }
        return { key: 'idle', label: 'No signal', color: '#cbd5e1', bg: 'rgba(148,163,184,0.14)', metric: 'Low delivery' };
    };
    const filteredCampaigns = useMemo(() => {
        const search = campaignSearch.trim().toLowerCase();
        const filtered = campaigns.filter((campaign: any) => {
            const derived = campaignDerivedById.get(String(campaign?.id || '')) || {};
            const signal = getCampaignSignal(campaign);
            const cqiScore = Number(derived.cqi?.lqs || 0);
            const clickLoss = derived.funnel?.dropoffs?.bounceGap;
            const atcToPurchase = Number(derived.funnel?.conversions?.atcToPurchaseRate || 0);
            const readinessStatus = String(derived.readiness?.learningStatus?.status || '').toLowerCase();
            const matchesSearch = !search || String(campaign?.name || '').toLowerCase().includes(search);
            const matchesType = campaignTypeFilter === 'all' || campaign?.type === campaignTypeFilter;
            const matchesStatus = campaignStatusFilter === 'all' || campaign?.effectiveStatus === campaignStatusFilter;
            const matchesSignal = campaignSignalFilter === 'all' || signal.key === campaignSignalFilter;
            const matchesQuality = campaignQualityFilter === 'all'
                || (campaignQualityFilter === 'strong' && cqiScore >= 70)
                || (campaignQualityFilter === 'average' && cqiScore >= 45 && cqiScore < 70)
                || (campaignQualityFilter === 'weak' && cqiScore > 0 && cqiScore < 45)
                || (campaignQualityFilter === 'unknown' && cqiScore === 0);
            const matchesFunnel = campaignFunnelFilter === 'all'
                || (campaignFunnelFilter === 'clean_handoff' && clickLoss !== null && clickLoss !== undefined && Number(clickLoss) <= 25)
                || (campaignFunnelFilter === 'click_loss' && clickLoss !== null && clickLoss !== undefined && Number(clickLoss) >= 40)
                || (campaignFunnelFilter === 'cart_strength' && atcToPurchase >= 40)
                || (campaignFunnelFilter === 'no_lpv' && derived.funnel && clickLoss === null)
                || (campaignFunnelFilter === 'unknown' && !derived.funnel);
            const matchesReadiness = campaignReadinessFilter === 'all'
                || (campaignReadinessFilter === 'stable' && ['active', 'delivery_active'].includes(readinessStatus))
                || (campaignReadinessFilter === 'learning' && ['learning', 'delivery_learning'].includes(readinessStatus))
                || (campaignReadinessFilter === 'limited' && readinessStatus === 'limited')
                || (campaignReadinessFilter === 'unknown' && !readinessStatus);
            const minRoasVal = parseFloat(campaignMinRoas);
            const matchesRoas = !minRoasVal || (campaign?.metrics?.purchaseRoas || 0) >= minRoasVal;
            const minCtrVal = parseFloat(campaignMinCtr);
            const matchesCtr = !minCtrVal || (campaign?.metrics?.ctr || 0) >= minCtrVal;
            const maxCpmVal = parseFloat(campaignMaxCpm);
            const matchesCpm = !maxCpmVal || (campaign?.metrics?.cpm || 0) <= maxCpmVal || (campaign?.metrics?.cpm || 0) === 0;
            const minSpendVal = parseFloat(campaignMinSpend);
            const matchesSpend = !minSpendVal || (campaign?.metrics?.spend || 0) >= minSpendVal;
            return matchesSearch && matchesType && matchesStatus && matchesSignal && matchesQuality && matchesFunnel && matchesReadiness && matchesRoas && matchesCtr && matchesCpm && matchesSpend;
        });

        const sortValue = (campaign: any) => {
            const derived = campaignDerivedById.get(String(campaign?.id || '')) || {};
            switch (campaignSort) {
                case 'signal_desc':
                    return { scale: 4, watch: 3, fix: 2, idle: 1 }[getCampaignSignal(campaign).key] || 0;
                case 'score_desc':
                    return derived.scale?.efficiencyScore || 0;
                case 'cqi_desc':
                    return derived.cqi?.lqs || 0;
                case 'atc_desc':
                    return derived.funnel?.conversions?.atcToPurchaseRate || 0;
                case 'click_loss_asc':
                    return derived.funnel?.dropoffs?.bounceGap ?? Number.MAX_SAFE_INTEGER;
                case 'pace_desc':
                    return derived.readiness?.benchmarkProgress ?? 0;
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
            if (campaignSort === 'cost_asc' || campaignSort === 'cpm_asc' || campaignSort === 'click_loss_asc') {
                return Number(sortValue(a)) - Number(sortValue(b));
            }
            return Number(sortValue(b)) - Number(sortValue(a));
        });
    }, [campaigns, campaignDerivedById, campaignSearch, campaignTypeFilter, campaignStatusFilter, campaignSignalFilter, campaignQualityFilter, campaignFunnelFilter, campaignReadinessFilter, campaignSort, campaignMinRoas, campaignMinCtr, campaignMaxCpm, campaignMinSpend]);
    const campaignPageSize = 50;
    const campaignTotalPages = Math.max(1, Math.ceil(filteredCampaigns.length / campaignPageSize));
    const campaignPageStart = (campaignPage - 1) * campaignPageSize;
    const paginatedCampaigns = filteredCampaigns.slice(campaignPageStart, campaignPageStart + campaignPageSize);
    const campaignStatusHeadline = campaignStatusFilter === 'all' ? `${campaignSummary.active || 0} active now` : `${filteredCampaigns.length} matching ${campaignStatusFilter.toLowerCase()}`;
    const campaignRangeLabel = filteredCampaigns.length > 0
        ? `${campaignPageStart + 1}-${Math.min(campaignPageStart + campaignPageSize, filteredCampaigns.length)}`
        : '0-0';
    const sectionPageSize = 8;
    const intelligenceCampaignRows = useMemo(() => intelligenceData?.data?.campaigns || [], [intelligenceData]);
    const intelligenceObjectiveOptions = useMemo(() => {
        const values = Array.from(new Set(intelligenceCampaignRows.map((campaign: any) => normalizeObjectiveGroup(campaign.objectiveGroup || campaign.objective)))) as string[];
        return [{ value: 'all', label: 'All objectives' }, ...values.map((value) => ({ value, label: getObjectiveFilterLabel(value) }))];
    }, [intelligenceCampaignRows]);
    const filteredScaleCampaigns = useMemo(() => {
        const search = scaleFilters.search.trim().toLowerCase();
        const rows = intelligenceCampaignRows.filter((campaign: any) => {
            const objectiveGroup = normalizeObjectiveGroup(campaign.objectiveGroup || campaign.objective);
            return (!search || String(campaign.name || '').toLowerCase().includes(search))
                && (scaleFilters.objective === 'all' || objectiveGroup === scaleFilters.objective)
                && statusMatchesFilter(campaign.effectiveStatus || campaign.status, scaleFilters.status);
        });

        return [...rows].sort((a: any, b: any) => {
            switch (scaleFilters.sort) {
                case 'headroom_desc':
                    return Number(b.scaleHeadroom?.score || 0) - Number(a.scaleHeadroom?.score || 0);
                case 'roas_desc':
                    return Number(b.roas || 0) - Number(a.roas || 0);
                case 'spend_desc':
                    return Number(b.spend || 0) - Number(a.spend || 0);
                case 'purchases_desc':
                    return Number(b.purchases || 0) - Number(a.purchases || 0);
                case 'ctr_desc':
                    return Number(b.ctr || 0) - Number(a.ctr || 0);
                default:
                    return Number(b.efficiencyScore || 0) - Number(a.efficiencyScore || 0);
            }
        });
    }, [intelligenceCampaignRows, scaleFilters]);
    const pagedScaleCampaigns = paginateItems(filteredScaleCampaigns, scaleFilters.page, sectionPageSize);

    const cqiRows = useMemo(() => (advancedData?.data?.campaignQualityIndex || advancedData?.data?.leadQualityScore)?.campaigns || [], [advancedData]);
    const cqiObjectiveOptions = useMemo(() => {
        const values = Array.from(new Set(cqiRows.map((campaign: any) => normalizeObjectiveGroup(campaign.objectiveGroup || campaign.objective)))) as string[];
        return [{ value: 'all', label: 'All objectives' }, ...values.map((value) => ({ value, label: getObjectiveFilterLabel(value) }))];
    }, [cqiRows]);
    const filteredCqiCampaigns = useMemo(() => {
        const search = cqiFilters.search.trim().toLowerCase();
        const rows = cqiRows.filter((campaign: any) => {
            const objectiveGroup = normalizeObjectiveGroup(campaign.objectiveGroup || campaign.objective);
            return (!search || String(campaign.name || '').toLowerCase().includes(search))
                && (cqiFilters.objective === 'all' || objectiveGroup === cqiFilters.objective)
                && statusMatchesFilter(campaign.effectiveStatus || campaign.status, cqiFilters.status)
                && (cqiFilters.confidence === 'all' || String(campaign.metrics?.confidenceLabel || '').toLowerCase() === cqiFilters.confidence);
        });

        return [...rows].sort((a: any, b: any) => {
            switch (cqiFilters.sort) {
                case 'roas_desc':
                    return Number(b.metrics?.roas || 0) - Number(a.metrics?.roas || 0);
                case 'ctr_desc':
                    return Number(b.metrics?.ctr || 0) - Number(a.metrics?.ctr || 0);
                case 'spend_desc':
                    return Number(b.spend || 0) - Number(a.spend || 0);
                default:
                    return Number(b.lqs || 0) - Number(a.lqs || 0);
            }
        });
    }, [cqiRows, cqiFilters]);
    const pagedCqiCampaigns = paginateItems(filteredCqiCampaigns, cqiFilters.page, sectionPageSize);

    const creativeRows = useMemo(() => advancedData?.data?.creativeForensics || [], [advancedData]);
    const filteredCreativeRows = useMemo(() => {
        const search = creativeFilters.search.trim().toLowerCase();
        const rows = creativeRows.filter((creative: any) =>
            (!search || String(creative.name || '').toLowerCase().includes(search))
            && statusMatchesFilter(creative.effectiveStatus || creative.status, creativeFilters.status)
            && (creativeFilters.format === 'all' || String(creative.format || (creative.hasVideo ? 'video' : 'static')) === creativeFilters.format)
            && (creativeFilters.diagnosis === 'all' || String(creative.pattern?.type || 'mixed') === creativeFilters.diagnosis)
        );

        return [...rows].sort((a: any, b: any) => {
            switch (creativeFilters.sort) {
                case 'roas_desc':
                    return Number(b.roas || 0) - Number(a.roas || 0);
                case 'spend_desc':
                    return Number(b.spend || 0) - Number(a.spend || 0);
                case 'results_desc':
                    return Number(b.conversions || 0) - Number(a.conversions || 0);
                default:
                    return Number(b.performanceScore || 0) - Number(a.performanceScore || 0);
            }
        });
    }, [creativeRows, creativeFilters]);
    const pagedCreativeRows = paginateItems(filteredCreativeRows, creativeFilters.page, sectionPageSize);

    const deliveryRows = useMemo(() => advancedData?.data?.learningPhase || [], [advancedData]);
    const deliveryObjectiveOptions = useMemo(() => {
        const values = Array.from(new Set(deliveryRows.map((row: any) => normalizeObjectiveGroup(row.campaignObjective || row.objectiveType)))) as string[];
        return [{ value: 'all', label: 'All objectives' }, ...values.map((value) => ({ value, label: getObjectiveFilterLabel(value) }))];
    }, [deliveryRows]);
    const filteredDeliveryRows = useMemo(() => {
        const search = deliveryFilters.search.trim().toLowerCase();
        const rows = deliveryRows.filter((row: any) => {
            const objectiveGroup = normalizeObjectiveGroup(row.campaignObjective || row.objectiveType);
            const readiness = String(row.learningStatus?.status || 'unknown');
            return (!search || String(row.name || '').toLowerCase().includes(search))
                && (deliveryFilters.objective === 'all' || objectiveGroup === deliveryFilters.objective)
                && statusMatchesFilter(row.effectiveStatus, deliveryFilters.status)
                && (deliveryFilters.readiness === 'all' || readiness === deliveryFilters.readiness);
        });

        return [...rows].sort((a: any, b: any) => {
            switch (deliveryFilters.sort) {
                case 'pace_desc':
                    return Number(b.weeklyPace || 0) - Number(a.weeklyPace || 0);
                case 'days_desc':
                    return Number(b.daysActive || 0) - Number(a.daysActive || 0);
                default:
                    return Number(b.spend || 0) - Number(a.spend || 0);
            }
        });
    }, [deliveryRows, deliveryFilters]);
    const pagedDeliveryRows = paginateItems(filteredDeliveryRows, deliveryFilters.page, sectionPageSize);

    const funnelRows = useMemo(() => deepInsightsData?.data?.campaignFunnels || [], [deepInsightsData]);
    const funnelObjectiveOptions = useMemo(() => {
        const values = Array.from(new Set(funnelRows.map((campaign: any) => normalizeObjectiveGroup(campaign.objectiveGroup || campaign.objective)))) as string[];
        return [{ value: 'all', label: 'All objectives' }, ...values.map((value) => ({ value, label: getObjectiveFilterLabel(value) }))];
    }, [funnelRows]);
    const filteredFunnelRows = useMemo(() => {
        const search = funnelFilters.search.trim().toLowerCase();
        const rows = funnelRows.filter((campaign: any) => {
            const objectiveGroup = normalizeObjectiveGroup(campaign.objectiveGroup || campaign.objective);
            return (!search || String(campaign.campaignName || '').toLowerCase().includes(search))
                && (funnelFilters.objective === 'all' || objectiveGroup === funnelFilters.objective)
                && statusMatchesFilter(campaign.effectiveStatus || campaign.status, funnelFilters.status);
        });

        return [...rows].sort((a: any, b: any) => {
            switch (funnelFilters.sort) {
                case 'click_loss_asc':
                    return Number(a.dropoffs?.bounceGap ?? Number.MAX_SAFE_INTEGER) - Number(b.dropoffs?.bounceGap ?? Number.MAX_SAFE_INTEGER);
                case 'atc_desc':
                    return Number(b.conversions?.atcToPurchaseRate || 0) - Number(a.conversions?.atcToPurchaseRate || 0);
                case 'spend_desc':
                    return Number(b.spend || 0) - Number(a.spend || 0);
                default:
                    return Number(b.conversions?.roas || 0) - Number(a.conversions?.roas || 0);
            }
        });
    }, [funnelRows, funnelFilters]);
    const pagedFunnelRows = paginateItems(filteredFunnelRows, funnelFilters.page, sectionPageSize);

    const videoRows = useMemo(() => deepDiagnosticsData?.data?.videoHookAnalysis || [], [deepDiagnosticsData]);
    const filteredVideoRows = useMemo(() => {
        const search = videoFilters.search.trim().toLowerCase();
        const rows = videoRows.filter((video: any) =>
            (!search || String(video.adName || '').toLowerCase().includes(search))
            && statusMatchesFilter(video.isActive ? 'ACTIVE' : 'INACTIVE', videoFilters.status)
            && (videoFilters.confidence === 'all' || String(video.confidenceLabel || '').toLowerCase() === videoFilters.confidence)
            && (videoFilters.diagnosis === 'all' || String(video.pattern || '').toLowerCase().includes(videoFilters.diagnosis))
        );

        return [...rows].sort((a: any, b: any) => {
            switch (videoFilters.sort) {
                case 'hook_desc':
                    return Number(b.retention?.hookRate || 0) - Number(a.retention?.hookRate || 0);
                case 'spend_desc':
                    return Number(b.spend || 0) - Number(a.spend || 0);
                case 'results_desc':
                    return Number(b.conversions || 0) - Number(a.conversions || 0);
                default:
                    return Number(b.qualityScore || 0) - Number(a.qualityScore || 0);
            }
        });
    }, [videoRows, videoFilters]);
    const pagedVideoRows = paginateItems(filteredVideoRows, videoFilters.page, sectionPageSize);
    useEffect(() => {
        setCampaignPage(1);
    }, [campaignSearch, campaignTypeFilter, campaignStatusFilter, campaignSort, campaignMinRoas, campaignMinCtr, campaignMaxCpm, campaignMinSpend, campaignSignalFilter, campaignQualityFilter, campaignFunnelFilter, campaignReadinessFilter, datePreset, effectiveAccount]);

    useEffect(() => {
        setScaleFilters((current) => ({ ...current, page: 1 }));
    }, [scaleFilters.search, scaleFilters.objective, scaleFilters.status, scaleFilters.sort, datePreset, effectiveAccount]);

    useEffect(() => {
        setCqiFilters((current) => ({ ...current, page: 1 }));
    }, [cqiFilters.search, cqiFilters.objective, cqiFilters.status, cqiFilters.confidence, cqiFilters.sort, datePreset, effectiveAccount]);

    useEffect(() => {
        setCreativeFilters((current) => ({ ...current, page: 1 }));
    }, [creativeFilters.search, creativeFilters.status, creativeFilters.format, creativeFilters.diagnosis, creativeFilters.sort, datePreset, effectiveAccount]);

    useEffect(() => {
        setDeliveryFilters((current) => ({ ...current, page: 1 }));
    }, [deliveryFilters.search, deliveryFilters.objective, deliveryFilters.status, deliveryFilters.readiness, deliveryFilters.sort, datePreset, effectiveAccount]);

    useEffect(() => {
        setFunnelFilters((current) => ({ ...current, page: 1 }));
    }, [funnelFilters.search, funnelFilters.objective, funnelFilters.status, funnelFilters.sort, datePreset, effectiveAccount]);

    useEffect(() => {
        setVideoFilters((current) => ({ ...current, page: 1 }));
    }, [videoFilters.search, videoFilters.status, videoFilters.confidence, videoFilters.diagnosis, videoFilters.sort, datePreset, effectiveAccount]);

    useEffect(() => {
        if (campaignPage > campaignTotalPages) {
            setCampaignPage(campaignTotalPages);
        }
    }, [campaignPage, campaignTotalPages]);

    useEffect(() => {
        if (scaleFilters.page > pagedScaleCampaigns.totalPages) {
            setScaleFilters((current) => ({ ...current, page: pagedScaleCampaigns.totalPages }));
        }
    }, [scaleFilters.page, pagedScaleCampaigns.totalPages]);

    useEffect(() => {
        if (cqiFilters.page > pagedCqiCampaigns.totalPages) {
            setCqiFilters((current) => ({ ...current, page: pagedCqiCampaigns.totalPages }));
        }
    }, [cqiFilters.page, pagedCqiCampaigns.totalPages]);

    useEffect(() => {
        if (creativeFilters.page > pagedCreativeRows.totalPages) {
            setCreativeFilters((current) => ({ ...current, page: pagedCreativeRows.totalPages }));
        }
    }, [creativeFilters.page, pagedCreativeRows.totalPages]);

    useEffect(() => {
        if (deliveryFilters.page > pagedDeliveryRows.totalPages) {
            setDeliveryFilters((current) => ({ ...current, page: pagedDeliveryRows.totalPages }));
        }
    }, [deliveryFilters.page, pagedDeliveryRows.totalPages]);

    useEffect(() => {
        if (funnelFilters.page > pagedFunnelRows.totalPages) {
            setFunnelFilters((current) => ({ ...current, page: pagedFunnelRows.totalPages }));
        }
    }, [funnelFilters.page, pagedFunnelRows.totalPages]);

    useEffect(() => {
        if (videoFilters.page > pagedVideoRows.totalPages) {
            setVideoFilters((current) => ({ ...current, page: pagedVideoRows.totalPages }));
        }
    }, [videoFilters.page, pagedVideoRows.totalPages]);

    useEffect(() => {
        setSelectedCampaignId(null);
        setSelectedCreativeId(null);
    }, [effectiveAccount, datePreset]);

    useEffect(() => {
        setSelectedCreativeId(null);
    }, [selectedCampaignId]);

    useEffect(() => {
        if (activeTab !== 'campaigns') {
            setSelectedCampaignId(null);
            setSelectedCreativeId(null);
        }
    }, [activeTab]);

    useEffect(() => {
        if (!selectedCampaignId) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [selectedCampaignId]);

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
    const deepProfileType = deepDiagnosticsData?.data?.accountProfile?.type || 'general';
    const deepPlacementSummary = deepDiagnosticsData?.data?.placementSummary || null;
    const deepPlacementRows = deepDiagnosticsData?.data?.placementDiagnostics || [];
    const deepVideoSummary = deepDiagnosticsData?.data?.videoSummary || null;
    const deepFunnelData = deepInsightsData?.data || {};
    const deepHasAnySectionData = Boolean(
        deepPlacementSummary
        || deepVideoSummary
    );
    const campaignDrilldownPageList = campaignDrilldownPages?.pages?.filter(Boolean) || [];
    const selectedCampaignDrilldown = campaignDrilldownPageList[0]?.data
        ? {
            ...campaignDrilldownPageList[0].data,
            creatives: campaignDrilldownPageList.flatMap((page: any) => page?.data?.creatives || []),
            pagination: campaignDrilldownPageList[campaignDrilldownPageList.length - 1]?.data?.pagination || campaignDrilldownPageList[0]?.data?.pagination || null
        }
        : null;
    const selectedCreative = selectedCampaignDrilldown?.creatives?.find((creative: any) => creative.adId === selectedCreativeId) || null;

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
            adsApi.getAdInsights(effectiveAccount, datePreset, customStartDate, customEndDate).then((res) => res.data).catch(() => insightsData),
            adsApi.getDemographics(effectiveAccount, datePreset, customStartDate, customEndDate).then((res) => res.data).catch(() => demographicsData),
            adsApi.getPlacements(effectiveAccount, datePreset, customStartDate, customEndDate).then((res) => res.data).catch(() => null),
            adsApi.getGeography(effectiveAccount, datePreset, customStartDate, customEndDate).then((res) => res.data).catch(() => geographyData),
            adsApi.getCampaigns(effectiveAccount, datePreset, customStartDate, customEndDate).then((res) => res.data).catch(() => campaignsData),
            adsApi.getConversionFunnel(effectiveAccount, datePreset, customStartDate, customEndDate).then((res) => res.data).catch(() => funnelData),
            adsApi.getCampaignIntelligence(effectiveAccount, datePreset, customStartDate, customEndDate).then((res) => res.data).catch(() => intelligenceData),
            adsApi.getAdvancedAnalytics(effectiveAccount, datePreset, customStartDate, customEndDate).then((res) => res.data).catch(() => advancedData),
            adsApi.getDeepInsights(effectiveAccount, datePreset, 'all', customStartDate, customEndDate).then((res) => res.data).catch(() => deepInsightsData)
        ]);

        const accountName = selectedAccountMeta?.name || selectedAccountMeta?.account_name || `Account ${effectiveAccount}`;
        const reportTitle = `${accountName} Meta Ads Report`;
        const reportSubtitle = datePreset === 'custom'
            ? `${dateRange.startDate} to ${dateRange.endDate} performance export for ${effectiveAccount}`
            : `${toTitleCase(datePreset)} performance export for ${effectiveAccount}`;
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
                    
                    {/* Date Range Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <DateRangeSelector dateRange={dateRange} setDateRange={setDateRange} />
                        <PageExportMenu onExport={handlePageExport} />
                    </div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div
                        className="card"
                        style={{
                            padding: '12px 14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 12,
                            border: '1px solid rgba(99,102,241,0.18)',
                            background: 'rgba(99,102,241,0.06)',
                            minWidth: 0
                        }}
                    >
                        <div style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #10b981)',
                            flexShrink: 0
                        }} />
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                                    Account Focus
                                </span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{accountProfile.label}</span>
                            </div>
                            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                                {objectiveMixLabel || accountProfile.description}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(accountProfile.recommendedMetrics || []).slice(0, 4).map((metricKey: string) => (
                            <span
                                key={metricKey}
                                style={{
                                    padding: '5px 9px',
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: 'var(--muted)'
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
                                    <option value="signal_desc">Sort: Best action signal</option>
                                    <option value="score_desc">Sort: Optimize score</option>
                                    <option value="cqi_desc">Sort: Health score</option>
                                    <option value="atc_desc">Sort: Best cart-to-buy</option>
                                    <option value="click_loss_asc">Sort: Lowest click loss</option>
                                    <option value="pace_desc">Sort: Learning pace</option>
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

                            {/* Advanced metric filters */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                    style={{
                                        background: showAdvancedFilters ? 'rgba(99,102,241,0.14)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${showAdvancedFilters ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                                        color: showAdvancedFilters ? '#c7d2fe' : 'var(--muted)',
                                        padding: '8px 14px',
                                        borderRadius: 10,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                                    {showAdvancedFilters ? 'Hide metric filters' : 'Metric filters'}
                                    {(campaignMinRoas || campaignMinCtr || campaignMaxCpm || campaignMinSpend || campaignSignalFilter !== 'all' || campaignQualityFilter !== 'all' || campaignFunnelFilter !== 'all' || campaignReadinessFilter !== 'all') && (
                                        <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 800, marginLeft: 2 }}>
                                            {[campaignMinRoas, campaignMinCtr, campaignMaxCpm, campaignMinSpend, campaignSignalFilter !== 'all' ? campaignSignalFilter : '', campaignQualityFilter !== 'all' ? campaignQualityFilter : '', campaignFunnelFilter !== 'all' ? campaignFunnelFilter : '', campaignReadinessFilter !== 'all' ? campaignReadinessFilter : ''].filter(Boolean).length}
                                        </span>
                                    )}
                                </button>
                                {(campaignMinRoas || campaignMinCtr || campaignMaxCpm || campaignMinSpend || campaignSignalFilter !== 'all' || campaignQualityFilter !== 'all' || campaignFunnelFilter !== 'all' || campaignReadinessFilter !== 'all') && (
                                    <button
                                        type="button"
                                        onClick={() => { setCampaignMinRoas(''); setCampaignMinCtr(''); setCampaignMaxCpm(''); setCampaignMinSpend(''); setCampaignSignalFilter('all'); setCampaignQualityFilter('all'); setCampaignFunnelFilter('all'); setCampaignReadinessFilter('all'); }}
                                        style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 8px' }}
                                    >
                                        Clear all filters
                                    </button>
                                )}
                                {derivedCampaignDataLoading && (
                                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Loading Optimize, Health, and Funnel signals...</span>
                                )}
                            </div>
                            {showAdvancedFilters && (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <div style={{ padding: '12px 14px', borderRadius: 12, background: derivedCampaignDataReady ? 'rgba(99,102,241,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${derivedCampaignDataReady ? 'rgba(99,102,241,0.16)' : 'rgba(245,158,11,0.18)'}`, color: 'var(--muted)', fontSize: 12 }}>
                                        Metric filters blend raw campaign metrics with calculated signals from Conversion Funnel, Optimize, Health, and Diagnostics. Open this panel to load those richer campaign reads for the selected date range.
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                                        gap: 12,
                                        padding: '16px 18px',
                                        borderRadius: 14,
                                        background: 'rgba(99,102,241,0.04)',
                                        border: '1px solid rgba(99,102,241,0.1)'
                                    }}>
                                        <label style={{ display: 'grid', gap: 5 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Action signal</span>
                                            <select value={campaignSignalFilter} onChange={(e) => setCampaignSignalFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }}>
                                                <option value="all">All signals</option>
                                                <option value="scale">Scale candidates</option>
                                                <option value="watch">Watch / needs proof</option>
                                                <option value="fix">Fix first</option>
                                                <option value="idle">No clear signal</option>
                                            </select>
                                        </label>
                                        <label style={{ display: 'grid', gap: 5 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Health score</span>
                                            <select value={campaignQualityFilter} onChange={(e) => setCampaignQualityFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }}>
                                                <option value="all">Any CQI</option>
                                                <option value="strong">Strong CQI</option>
                                                <option value="average">Average CQI</option>
                                                <option value="weak">Weak CQI</option>
                                                <option value="unknown">No CQI yet</option>
                                            </select>
                                        </label>
                                        <label style={{ display: 'grid', gap: 5 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Funnel quality</span>
                                            <select value={campaignFunnelFilter} onChange={(e) => setCampaignFunnelFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }}>
                                                <option value="all">Any funnel</option>
                                                <option value="clean_handoff">Clean click handoff</option>
                                                <option value="click_loss">High click loss</option>
                                                <option value="cart_strength">Strong cart-to-buy</option>
                                                <option value="no_lpv">No LPV signal</option>
                                                <option value="unknown">No funnel row</option>
                                            </select>
                                        </label>
                                        <label style={{ display: 'grid', gap: 5 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Delivery readiness</span>
                                            <select value={campaignReadinessFilter} onChange={(e) => setCampaignReadinessFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }}>
                                                <option value="all">Any readiness</option>
                                                <option value="stable">Stable</option>
                                                <option value="learning">Learning</option>
                                                <option value="limited">Learning limited</option>
                                                <option value="unknown">No readiness row</option>
                                            </select>
                                        </label>
                                        <label style={{ display: 'grid', gap: 5 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Min ROAS</span>
                                            <input type="number" step="0.1" min="0" value={campaignMinRoas} onChange={(e) => setCampaignMinRoas(e.target.value)} placeholder="e.g. 2.0" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }} />
                                        </label>
                                        <label style={{ display: 'grid', gap: 5 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Min CTR %</span>
                                            <input type="number" step="0.1" min="0" value={campaignMinCtr} onChange={(e) => setCampaignMinCtr(e.target.value)} placeholder="e.g. 1.5" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }} />
                                        </label>
                                        <label style={{ display: 'grid', gap: 5 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Max CPM</span>
                                            <input type="number" step="1" min="0" value={campaignMaxCpm} onChange={(e) => setCampaignMaxCpm(e.target.value)} placeholder="e.g. 500" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }} />
                                        </label>
                                        <label style={{ display: 'grid', gap: 5 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Min Spend</span>
                                            <input type="number" step="100" min="0" value={campaignMinSpend} onChange={(e) => setCampaignMinSpend(e.target.value)} placeholder="e.g. 1000" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }} />
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div style={{ overflowX: 'auto' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Campaign <InfoTooltip text="Campaign name plus type, budget mode, days live, and raw delivery state so you can scan structure and maturity quickly." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Type <InfoTooltip text="Objective family derived from the campaign objective, such as Sales, Traffic, Awareness, or Engagement." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Delivery <InfoTooltip text="Effective delivery state returned by Meta. This is what Ads Manager uses to show whether a campaign is active, paused, limited, or otherwise constrained." /></span></th>
                                            <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Signal <InfoTooltip text="A blended action label from calculated Optimize score, Campaign Health/CQI, funnel handoff, and delivery-readiness signals when those datasets are loaded." /></span></th>
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
                                            const signal = getCampaignSignal(campaign);
                                            const derived = getCampaignDerived(campaign);
                                            const deliveryTone = campaign.effectiveStatus === 'ACTIVE'
                                                ? { bg: 'rgba(16,185,129,0.14)', color: '#86efac', border: 'rgba(16,185,129,0.22)' }
                                                : campaign.effectiveStatus?.includes('PAUSED')
                                                    ? { bg: 'rgba(148,163,184,0.16)', color: '#cbd5e1', border: 'rgba(148,163,184,0.22)' }
                                                    : { bg: 'rgba(245,158,11,0.14)', color: '#fcd34d', border: 'rgba(245,158,11,0.24)' };

                                            return (
                                                <tr key={campaign.id}>
                                                    <td style={{ minWidth: 260 }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedCampaignId(campaign.id);
                                                                setSelectedCreativeId(null);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                border: 'none',
                                                                background: 'transparent',
                                                                padding: 0,
                                                                margin: 0,
                                                                textAlign: 'left',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                                <MediaThumb
                                                                    src={campaign.thumbnail}
                                                                    alt={campaign.name}
                                                                    previewSource={campaign.previewSource}
                                                                    label={campaign.name}
                                                                    kind="Campaign"
                                                                    width={48}
                                                                    height={48}
                                                                    radius={12}
                                                                />
                                                                <div style={{ minWidth: 0 }}>
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
                                                                </div>
                                                            </div>
                                                        </button>
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
                                                        <div style={{ display: 'grid', gap: 4, minWidth: 128 }}>
                                                            <span style={{ padding: '5px 10px', borderRadius: 999, background: signal.bg, color: signal.color, fontSize: 11, fontWeight: 800, width: 'fit-content' }}>
                                                                {signal.label}
                                                            </span>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{signal.metric}</div>
                                                            {(derived.scale || derived.cqi || derived.funnel || derived.readiness) && (
                                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                                    {derived.scale && <span style={{ fontSize: 9, color: '#a5b4fc' }}>Opt {Math.round(derived.scale.efficiencyScore || 0)}</span>}
                                                                    {derived.cqi && <span style={{ fontSize: 9, color: '#86efac' }}>CQI {Math.round(derived.cqi.lqs || 0)}</span>}
                                                                    {derived.funnel?.dropoffs?.bounceGap !== undefined && <span style={{ fontSize: 9, color: '#fcd34d' }}>Loss {derived.funnel.dropoffs.bounceGap ?? 'NA'}%</span>}
                                                                </div>
                                                            )}
                                                        </div>
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
                    <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>Demographics <InfoTooltip text="Audience performance by age and gender. Useful for spotting where spend, click efficiency, and sales outcomes are concentrated." /></span>} subtitle="Audience performance by age and gender">
                        {demographicsLoading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                                <p className="text-muted">Loading demographics...</p>
                            </div>
                        ) : demographicRows.length > 0 ? (
                            <div style={{ display: 'grid', gap: 16 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Highest Spend Audience</div>
                                        <div style={{ fontSize: 18, fontWeight: 700 }}>{topDemographicRow ? `${topDemographicRow.age} ${topDemographicRow.gender}` : 'No data'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{topDemographicRow ? `${formatCurrency(topDemographicRow.spend)} spent` : 'No demographic spend yet'}</div>
                                    </div>
                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Best Demographic ROAS</div>
                                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                                            {demographicRows.find((row: any) => Number(row?.purchaseRoas || 0) > 0)?.age
                                                ? `${demographicRows.find((row: any) => Number(row?.purchaseRoas || 0) > 0)?.age} ${demographicRows.find((row: any) => Number(row?.purchaseRoas || 0) > 0)?.gender}`
                                                : 'No ROAS yet'}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                            {demographicRows.find((row: any) => Number(row?.purchaseRoas || 0) > 0)
                                                ? formatRoas(demographicRows.find((row: any) => Number(row?.purchaseRoas || 0) > 0)?.purchaseRoas || 0)
                                                : 'Meta did not return purchase value by demographic'}
                                        </div>
                                    </div>
                                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Audience Segments</div>
                                        <div style={{ fontSize: 22, fontWeight: 700 }}>{formatNumber(demographicRows.length)}</div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Age/gender groups with spend in this window</div>
                                    </div>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Audience <InfoTooltip text="Meta age and gender audience bucket." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Spend <InfoTooltip text="Spend for this audience segment in the selected window." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Spend Share <InfoTooltip text="How much of total demographic spend this audience consumed." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Reach <InfoTooltip text="Unique people reached in this audience segment." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>Clicks <InfoTooltip text="Clicks attributed to this audience segment." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CTR <InfoTooltip text="Click-through rate for this audience segment." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CPC <InfoTooltip text="Cost per click for this audience segment." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>CPM <InfoTooltip text="Cost per thousand impressions for this audience segment." /></span></th>
                                                <th><span style={{ display: 'inline-flex', alignItems: 'center' }}>ROAS <InfoTooltip text="Purchase ROAS if Meta returned purchase value at demographic level." /></span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {demographicRows.slice(0, 15).map((d: any, i: number) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600 }}>{d.age} {d.gender}</td>
                                                    <td>{formatCurrency(d.spend)}</td>
                                                    <td>{totalDemographicSpend > 0 ? `${((Number(d.spend || 0) / totalDemographicSpend) * 100).toFixed(1)}%` : '0%'}</td>
                                                    <td>{formatNumber(d.reach)}</td>
                                                    <td>{formatNumber(d.clicks)}</td>
                                                    <td>{formatPercent(d.ctr)}</td>
                                                    <td>{d.cpc ? formatCurrency(d.cpc) : '—'}</td>
                                                    <td>{d.cpm ? formatCurrency(d.cpm) : '—'}</td>
                                                    <td>{d.purchaseRoas ? formatRoas(d.purchaseRoas) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted">No demographic data available</p>
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                                        {showRegionPurchaseColumns ? 'Regions With ROAS' : 'Tracked Regions'}
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 700 }}>
                                        {formatNumber(showRegionPurchaseColumns ? regionRoasCoverage : regionPerformanceRows.length)}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                        {showRegionPurchaseColumns ? 'Regions where Meta returned purchase value and spend' : 'Regions with delivery data in this window'}
                                    </div>
                                </div>
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                                        {showRegionPurchaseColumns ? 'Top ROAS Region' : 'Top CTR Region'}
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                                        {showRegionPurchaseColumns ? (topRegionByRoas?.region || 'No ROAS yet') : (topRegionByCtr?.region || 'No CTR leader yet')}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                        {showRegionPurchaseColumns
                                            ? (topRegionByRoas ? `${formatRoas(topRegionByRoas.purchaseRoas)} on ${formatCurrency(topRegionByRoas.spend)}` : 'Meta did not return region-level purchase value')
                                            : (topRegionByCtr ? `${formatPercent(topRegionByCtr.ctr || 0)} CTR on ${formatCurrency(topRegionByCtr.spend)}` : 'Meta returned only limited geo delivery data')}
                                    </div>
                                </div>
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                                        {showRegionPurchaseColumns ? 'Top Revenue Region' : 'Highest Spend Region'}
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                                        {showRegionPurchaseColumns ? (topRegionByRevenue?.region || 'No revenue yet') : (topRegionBySpend?.region || 'No spend yet')}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                        {showRegionPurchaseColumns
                                            ? (topRegionByRevenue ? `${formatCurrency(topRegionByRevenue.purchaseValue)} from ${formatNumber(topRegionByRevenue.purchases)} purchases` : 'No region-level purchase value available')
                                            : (topRegionBySpend ? `${formatCurrency(topRegionBySpend.spend)} spent` : 'No geo spend available')}
                                    </div>
                                </div>
                                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.18)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                                        {showCountryPurchaseColumns ? 'Top ROAS Country' : 'Geo Revenue Signal'}
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                                        {showCountryPurchaseColumns ? (topCountryByRoas?.country || 'No ROAS yet') : 'Purchase data unavailable'}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                        {showCountryPurchaseColumns
                                            ? (topCountryByRoas ? `${formatRoas(topCountryByRoas.purchaseRoas)} on ${formatCurrency(topCountryByRoas.spend)}` : 'No country-level purchase value available')
                                            : 'Meta is returning delivery-only geo breakdowns for this view'}
                                    </div>
                                </div>
                            </div>

                            {/* Country Breakdown */}
                            <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>Country Performance <InfoTooltip text={showCountryPurchaseColumns ? "Country-level performance with spend, purchase value, ROAS, click efficiency, and purchase outcomes." : "Country-level delivery performance. Purchase-value fields are hidden here because Meta did not return usable country purchase data for this breakdown."} /></span>} subtitle={showCountryPurchaseColumns ? "How countries perform on both delivery and revenue efficiency" : "How countries perform on delivery efficiency for this breakdown"}>
                                {countryPerformanceRows.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Country</th>
                                                    <th>Spend</th>
                                                    {showCountryPurchaseColumns && <th>Purchase Value</th>}
                                                    {showCountryPurchaseColumns && <th>Purchases</th>}
                                                    {showCountryPurchaseColumns && <th>ROAS</th>}
                                                    {showCountryPurchaseColumns && <th>Cost / Purchase</th>}
                                                    <th>CTR</th>
                                                    <th>CPC</th>
                                                    <th>CPM</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {countryPerformanceRows.slice(0, 15).map((c: any, i: number) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: 500 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <Globe size={14} />
                                                                {c.country}
                                                            </div>
                                                        </td>
                                                        <td>{formatCurrency(c.spend)}</td>
                                                        {showCountryPurchaseColumns && <td>{c.purchaseValue ? formatCurrency(c.purchaseValue) : '—'}</td>}
                                                        {showCountryPurchaseColumns && <td>{formatNumber(c.purchases || 0)}</td>}
                                                        {showCountryPurchaseColumns && <td>{c.purchaseRoas ? formatRoas(c.purchaseRoas) : '—'}</td>}
                                                        {showCountryPurchaseColumns && <td>{c.costPerPurchase ? formatCurrency(c.costPerPurchase) : '—'}</td>}
                                                        <td>{formatPercent(c.ctr)}</td>
                                                        <td>{c.cpc ? formatCurrency(c.cpc) : '—'}</td>
                                                        <td>{c.cpm ? formatCurrency(c.cpm) : '—'}</td>
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
                            <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>Region Performance <InfoTooltip text={showRegionPurchaseColumns ? "Region or state breakdown with revenue efficiency and purchase metrics where Meta exposes them." : "Region or state breakdown focused on delivery and click efficiency. Purchase-value columns are hidden when Meta does not return usable region conversion data."} /></span>} subtitle={showRegionPurchaseColumns ? "Performance by state/region with ROAS and purchase efficiency" : "Performance by state/region with delivery efficiency"}>
                                {regionPerformanceRows.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Region</th>
                                                    <th>Spend</th>
                                                    {showRegionPurchaseColumns && <th>Purchase Value</th>}
                                                    {showRegionPurchaseColumns && <th>Purchases</th>}
                                                    {showRegionPurchaseColumns && <th>ROAS</th>}
                                                    {showRegionPurchaseColumns && <th>Cost / Purchase</th>}
                                                    <th>CTR</th>
                                                    <th>CPC</th>
                                                    <th>CPM</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {regionPerformanceRows.slice(0, 20).map((r: any, i: number) => (
                                                    <tr key={i}>
                                                        <td style={{ fontWeight: 500 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <MapPin size={14} />
                                                                {r.region}
                                                            </div>
                                                        </td>
                                                        <td>{formatCurrency(r.spend)}</td>
                                                        {showRegionPurchaseColumns && <td>{r.purchaseValue ? formatCurrency(r.purchaseValue) : '—'}</td>}
                                                        {showRegionPurchaseColumns && <td>{formatNumber(r.purchases || 0)}</td>}
                                                        {showRegionPurchaseColumns && <td>{r.purchaseRoas ? formatRoas(r.purchaseRoas) : '—'}</td>}
                                                        {showRegionPurchaseColumns && <td>{r.costPerPurchase ? formatCurrency(r.costPerPurchase) : '—'}</td>}
                                                        <td>{formatPercent(r.ctr || 0)}</td>
                                                        <td>{r.cpc ? formatCurrency(r.cpc) : '—'}</td>
                                                        <td>{r.cpm ? formatCurrency(r.cpm) : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 6, fontSize: 12, color: 'var(--muted)' }}>
                                            {showRegionPurchaseColumns
                                                ? `Showing top 20 regions sorted by ROAS first, then purchase value and spend. Total ${regions.length} regions tracked.`
                                                : `Showing top 20 regions sorted by delivery strength and spend. Purchase-value columns are hidden because Meta did not return usable geo purchase data for this breakdown. Total ${regions.length} regions tracked.`}
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
                                                {i < (funnelData.data.funnel?.length || 0) - 1 && (() => {
                                                    const nextStage = funnelData.data.funnel[i + 1];
                                                    return (
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                            padding: '8px 0',
                                                            color: nextStage.dropoffRate > 50 ? '#ef4444' : nextStage.dropoffRate < 0 ? '#10b981' : '#94a3b8'
                                                        }}>
                                                            <ArrowRight size={16} style={{ transform: 'rotate(90deg)' }} />
                                                            <span style={{ fontSize: 12, fontWeight: 500 }}>
                                                                {nextStage.dropoffRate < 0 ? `+${Math.abs(nextStage.dropoffRate)}% increase` : `${nextStage.dropoffRate}% drop off`}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
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
                                    {bounceComparable ? 'Landing Page Bounce Read' : 'Landing Page Handoff Quality'}
                                    <InfoTooltip text={bounceComparable
                                        ? 'This section compares Landing Page Views against View Content to estimate how much paid landing-page traffic continues deeper into the site.'
                                        : 'Landing Page View and View Content are both real Meta events, but for this account they are not behaving like a strict step-to-step pair. This card is shown as a landing-page handoff diagnostic instead of a true bounce calculation.'} />
                                </span>}
                                subtitle={bounceComparable
                                    ? 'Landing-page quality read using real Meta event counts from the selected period'
                                    : 'Directional landing-page health read using real Meta event counts when LPV and View Content are not directly comparable'}
                            >
                                {(() => {
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
                                                        helper: contentContinuationRate !== null && bounceComparable
                                                            ? `${contentContinuationRate.toFixed(1)}% of LPV volume continued to content`
                                                            : 'Real Meta View Content events recorded in the same reporting window.'
                                                    },
                                                    {
                                                        label: bounceComparable ? 'Overall Bounce Rate' : 'Comparability',
                                                        value: overallBounce !== null ? `${overallBounce.toFixed(1)}%` : 'Directional only',
                                                        col: overallBounce !== null
                                                            ? overallBounce > 70 ? '#ef4444' : '#f59e0b'
                                                            : '#0ea5e9',
                                                        warn: overallBounce !== null && overallBounce > 70,
                                                        helper: overallBounce !== null
                                                            ? 'Calculated as (Landing Page Views - Continued to Content) / Landing Page Views.'
                                                            : 'View Content exceeds Landing Page Views here, which usually means Meta event counting is capturing additional content events beyond the clean landing-page sequence.'
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

                                            <div style={{ padding: '12px 14px', background: bounceComparable ? 'rgba(16,185,129,0.06)' : 'rgba(14,165,233,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                                                <strong style={{ color: 'var(--foreground)' }}>
                                                    {bounceComparable ? 'How to interpret this:' : 'Why this is directional only:'}
                                                </strong>{' '}
                                                {bounceComparable
                                                    ? 'Landing Page View is the cleaner top-of-funnel denominator here, so the bounce read is usable. A high bounce rate usually points to message mismatch, slow page load, weak above-the-fold clarity, or trust gaps right after the click.'
                                                    : 'Meta is counting View Content more broadly than Landing Page View in this account, so a classic bounce formula would be misleading. Treat this as a landing-page handoff check instead: focus on LPV volume, downstream purchase strength, and whether landing-page messaging matches the ad promise.'}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </SectionCard>

                            {deepInsightsLoading ? (
                                <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(99, 102, 241, 0.08)', color: 'var(--muted)', fontSize: 13 }}>
                                    Loading campaign-level funnel diagnostics for this date range.
                                </div>
                            ) : deepInsightsError && !deepFunnelData?.bounceGapAnalysis && !(deepFunnelData?.campaignFunnels || []).length ? (
                                <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', color: 'var(--muted)', fontSize: 13 }}>
                                    Campaign-level funnel diagnostics did not finish for this refresh. The account-level funnel above is still valid, but the deeper campaign comparison is temporarily unavailable.
                                </div>
                            ) : null}

                            {deepFunnelData.bounceGapAnalysis && (
                                <SectionCard
                                    title={<span style={{ display: 'flex', alignItems: 'center' }}>🔍 Click-to-Landing Gap <InfoTooltip text="Uses Meta's real outbound clicks and landing-page-view events. This is the handoff loss between a paid click and the page actually loading enough for the landing-page-view event to fire." /></span>}
                                    subtitle="A sales account should watch how much paid click traffic is lost before the landing page actually loads"
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{
                                                width: 140,
                                                height: 140,
                                                borderRadius: '50%',
                                                background: deepFunnelData.bounceGapAnalysis.severity === 'critical'
                                                    ? 'linear-gradient(135deg, #ef4444, #f87171)'
                                                    : deepFunnelData.bounceGapAnalysis.severity === 'warning'
                                                        ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                                                        : deepFunnelData.bounceGapAnalysis.severity === 'acceptable'
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
                                                    {deepFunnelData.bounceGapAnalysis.bounceGap}%
                                                </div>
                                                <div style={{ fontSize: 11, color: 'white', opacity: 0.9 }}>
                                                    Click Loss
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                                                {deepFunnelData.bounceGapAnalysis.severity}
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(148, 163, 184, 0.08)', fontSize: 12, color: 'var(--muted)' }}>
                                                <strong>Traffic source:</strong> {deepFunnelData.bounceGapAnalysis.trafficMetricLabel}. {deepFunnelData.bounceGapAnalysis.trafficMetricNote}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                                                <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                    <div className="text-muted" style={{ fontSize: 11 }}>{deepFunnelData.bounceGapAnalysis.trafficMetricLabel}</div>
                                                    <div style={{ fontSize: 20, fontWeight: 700 }}>{formatNumber(deepFunnelData.bounceGapAnalysis.outboundClicks)}</div>
                                                </div>
                                                <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                    <div className="text-muted" style={{ fontSize: 11 }}>Landing Page Views</div>
                                                    <div style={{ fontSize: 20, fontWeight: 700 }}>{formatNumber(deepFunnelData.bounceGapAnalysis.landingPageViews)}</div>
                                                </div>
                                                <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                    <div className="text-muted" style={{ fontSize: 11 }}>Users Lost</div>
                                                    <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
                                                        {formatNumber(deepFunnelData.bounceGapAnalysis.outboundClicks - deepFunnelData.bounceGapAnalysis.landingPageViews)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, marginBottom: 12 }}>
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{deepFunnelData.bounceGapAnalysis.message}</div>
                                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{deepFunnelData.bounceGapAnalysis.recommendation}</div>
                                            </div>

                                            {(deepFunnelData.bounceGapAnalysis.possibleReasons || []).length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                    {deepFunnelData.bounceGapAnalysis.possibleReasons.map((reason: string, i: number) => (
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

                            {(deepFunnelData.campaignFunnels || []).length > 0 && (
                                <SectionCard
                                    title={<span style={{ display: 'flex', alignItems: 'center' }}>📊 Campaign Funnel Benchmarking <InfoTooltip text="Compares campaigns using real Meta funnel events. If a campaign has no landing-page-view event, the table will show a dash instead of estimating that step." /></span>}
                                    subtitle="Compare real funnel handoff and purchase efficiency across campaigns to see which ones turn traffic into revenue"
                                >
                                    {deepFunnelData.overallFunnel && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center' }}>
                                                    {deepFunnelData.overallFunnel.trafficMetricLabel}
                                                    <InfoTooltip text={deepFunnelData.overallFunnel.trafficMetricNote} />
                                                </div>
                                                <div style={{ fontSize: 22, fontWeight: 700 }}>{formatNumber(deepFunnelData.overallFunnel.totals.trafficClicks || 0)}</div>
                                            </div>
                                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center' }}>
                                                    Traffic → LPV
                                                    <InfoTooltip text="Weighted account-level handoff from traffic clicks to landing-page views, using campaign traffic volume as the denominator." />
                                                </div>
                                                <div style={{ fontSize: 22, fontWeight: 700 }}>{deepFunnelData.overallFunnel.weightedRates.trafficToLpvRate}%</div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{formatNumber(deepFunnelData.overallFunnel.totals.landingPageViews || 0)} / {formatNumber(deepFunnelData.overallFunnel.totals.trafficClicks || 0)}</div>
                                            </div>
                                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center' }}>
                                                    LPV → ATC
                                                    <InfoTooltip text="Weighted account-level conversion from landing-page views to add-to-cart events." />
                                                </div>
                                                <div style={{ fontSize: 22, fontWeight: 700 }}>{deepFunnelData.overallFunnel.weightedRates.lpvToAtcRate}%</div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{formatNumber(deepFunnelData.overallFunnel.totals.addToCart || 0)} / {formatNumber(deepFunnelData.overallFunnel.totals.landingPageViews || 0)}</div>
                                            </div>
                                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                                <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center' }}>
                                                    ATC → Purchase
                                                    <InfoTooltip text="Weighted account-level conversion from add-to-cart to purchase." />
                                                </div>
                                                <div style={{ fontSize: 22, fontWeight: 700 }}>{deepFunnelData.overallFunnel.weightedRates.atcToPurchaseRate}%</div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{formatNumber(deepFunnelData.overallFunnel.totals.purchases || 0)} / {formatNumber(deepFunnelData.overallFunnel.totals.addToCart || 0)}</div>
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                        {(deepFunnelData.overallFunnel?.confidenceFlags || []).map((flag: string) => (
                                            <span key={flag} style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(148, 163, 184, 0.14)', color: '#cbd5e1', fontSize: 11, fontWeight: 600 }}>
                                                {flag}
                                            </span>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                        <FilterInput
                                            label="Find campaign"
                                            value={funnelFilters.search}
                                            onChange={(value) => setFunnelFilters((current) => ({ ...current, search: value }))}
                                            placeholder="Search funnel campaign"
                                            tooltip="Search campaign funnels by campaign name for the selected date range."
                                        />
                                        <FilterSelect
                                            label="Objective"
                                            value={funnelFilters.objective}
                                            onChange={(value) => setFunnelFilters((current) => ({ ...current, objective: value }))}
                                            options={funnelObjectiveOptions}
                                            tooltip="Use this to compare campaigns inside the same objective family instead of mixing awareness and sales traffic."
                                        />
                                        <FilterSelect
                                            label="Status"
                                            value={funnelFilters.status}
                                            onChange={(value) => setFunnelFilters((current) => ({ ...current, status: value }))}
                                            options={[
                                                { value: 'active', label: 'Active only' },
                                                { value: 'all', label: 'All statuses' },
                                                { value: 'inactive', label: 'Inactive only' }
                                            ]}
                                            tooltip="Active only is the safest default when you want benchmark cards and table rows to stay operationally relevant."
                                        />
                                        <FilterSelect
                                            label="Sort"
                                            value={funnelFilters.sort}
                                            onChange={(value) => setFunnelFilters((current) => ({ ...current, sort: value }))}
                                            options={[
                                                { value: 'roas_desc', label: 'ROAS' },
                                                { value: 'atc_desc', label: 'ATC → Purchase' },
                                                { value: 'click_loss_asc', label: 'Lowest click loss' },
                                                { value: 'spend_desc', label: 'Spend' }
                                            ]}
                                            tooltip="Top 8 are shown per page. Changing sort lets you bias toward efficiency, click quality, or spend depth."
                                        />
                                    </div>
                                    {deepFunnelData.compareFunnels && (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto 1fr',
                                            gap: 20,
                                            marginBottom: 24,
                                            padding: 16,
                                            background: 'var(--background)',
                                            borderRadius: 12
                                        }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ color: '#10b981', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>🏆 BEST PERFORMER</div>
                                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                                                    {deepFunnelData.compareFunnels.best?.campaignName}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                                                    <div>
                                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                                                            {deepFunnelData.compareFunnels.best?.conversions.roas}x
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>ROAS</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
                                                            {deepFunnelData.compareFunnels.best?.conversions.atcToPurchaseRate}%
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Cart→Purchase</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--muted)' }}>VS</div>
                                                {deepFunnelData.compareFunnels.comparison && (
                                                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
                                                        {Number(deepFunnelData.compareFunnels.comparison.roasDiff || 0) >= 0 ? '+' : ''}{deepFunnelData.compareFunnels.comparison.roasDiff}x ROAS<br />
                                                        {Number(deepFunnelData.compareFunnels.comparison.atcRateDiff || 0) >= 0 ? '+' : ''}{deepFunnelData.compareFunnels.comparison.atcRateDiff}% ATC to buy
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚠️ NEEDS WORK</div>
                                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                                                    {deepFunnelData.compareFunnels.worst?.campaignName}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                                                    <div>
                                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
                                                            {deepFunnelData.compareFunnels.worst?.conversions.roas}x
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>ROAS</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>
                                                            {deepFunnelData.compareFunnels.worst?.conversions.atcToPurchaseRate}%
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Cart→Purchase</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {deepFunnelData.compareFunnels?.note && (
                                        <div style={{ marginTop: -12, marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'rgba(148, 163, 184, 0.08)', fontSize: 12, color: 'var(--muted)' }}>
                                            <strong>Comparison note:</strong> {deepFunnelData.compareFunnels.note}
                                            {deepFunnelData.compareFunnels.methodologyLabel ? ` ${deepFunnelData.compareFunnels.methodologyLabel}.` : ''}
                                        </div>
                                    )}

                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Campaign</th>
                                                    <th>Click Loss</th>
                                                    <th>Traffic→LPV</th>
                                                    <th>LPV→ATC</th>
                                                    <th>ATC→Buy</th>
                                                    <th>ROAS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagedFunnelRows.items.map((c: any) => (
                                                    <tr key={c.campaignId}>
                                                        <td>
                                                            <div style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {c.campaignName}
                                                            </div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                {formatCurrency(c.spend)} spent • {c.objectiveLabel || getObjectiveFilterLabel(normalizeObjectiveGroup(c.objective))} • {c.status}
                                                            </div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                {(c.confidenceFlags || []).join(' • ')}
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
                                                            <div>{formatNumber(c.funnel.trafficClicks || 0)} → {c.funnel.landingPageViews > 0 ? formatNumber(c.funnel.landingPageViews) : '—'}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{c.trafficMetric?.label || 'Traffic clicks'}</div>
                                                        </td>
                                                        <td style={{ fontSize: 13 }}>
                                                            <div>{c.funnel.landingPageViews > 0 ? formatNumber(c.funnel.landingPageViews) : '—'} → {formatNumber(c.funnel.addToCart || 0)}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                {c.benchmarkDelta?.clickLoss !== null && c.benchmarkDelta?.clickLoss !== undefined ? `${formatSignedPercent(c.benchmarkDelta.clickLoss, 1)} vs median click-loss` : 'No median click-loss baseline'}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span style={{ fontWeight: 600, color: c.conversions.atcToPurchaseRate >= 50 ? '#10b981' : '#f59e0b' }}>
                                                                {c.conversions.atcToPurchaseRate}%
                                                            </span>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                {c.funnel.purchase > 0 ? `${formatNumber(c.funnel.purchase)} / ${formatNumber(c.funnel.addToCart || 0)}` : 'No purchase signal'}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span style={{ fontWeight: 700, color: c.conversions.roas >= 1 ? '#10b981' : '#ef4444' }}>
                                                                {c.conversions.roas}x
                                                            </span>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                                {c.benchmarkDelta?.roas !== null && c.benchmarkDelta?.roas !== undefined ? `${formatSignedPercent(c.benchmarkDelta.roas, 1)} vs median ROAS` : 'No ROAS baseline'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {!pagedFunnelRows.items.length && (
                                        <div style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(148, 163, 184, 0.12)', color: 'var(--muted)', fontSize: 13 }}>
                                            No campaign funnels match the current filters for this date range.
                                        </div>
                                    )}
                                    <SectionPager
                                        page={pagedFunnelRows.page}
                                        totalPages={pagedFunnelRows.totalPages}
                                        count={filteredFunnelRows.length}
                                        pageSize={sectionPageSize}
                                        onPageChange={(page) => setFunnelFilters((current) => ({ ...current, page }))}
                                    />
                                </SectionCard>
                            )}
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
                                        {intelligenceData.data.scaleHeadroomSummary && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                                                {[
                                                    { label: 'Avg headroom', value: Math.round(intelligenceData.data.scaleHeadroomSummary.averageScore || 0), sub: '0-100 modeled score', color: '#60a5fa' },
                                                    { label: 'Scale now', value: intelligenceData.data.scaleHeadroomSummary.scaleNow || 0, sub: `${formatCurrency(intelligenceData.data.scaleHeadroomSummary.scalableSpend || 0)} spend base`, color: '#10b981' },
                                                    { label: 'Hold', value: intelligenceData.data.scaleHeadroomSummary.hold || 0, sub: 'Keep budget steady', color: '#94a3b8' },
                                                    { label: 'Refresh first', value: intelligenceData.data.scaleHeadroomSummary.creativeRefresh || 0, sub: 'Fatigue risk present', color: '#f59e0b' },
                                                    { label: 'Do not scale', value: intelligenceData.data.scaleHeadroomSummary.doNotScale || 0, sub: 'Efficiency degrading', color: '#ef4444' }
                                                ].map((item) => (
                                                    <div key={item.label} style={{ padding: 12, borderRadius: 10, background: 'rgba(15, 23, 42, 0.48)', border: '1px solid var(--border)' }}>
                                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{item.label}</div>
                                                        <div style={{ fontSize: 22, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{item.sub}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                            <FilterInput
                                                label="Find campaign"
                                                value={scaleFilters.search}
                                                onChange={(value) => setScaleFilters((current) => ({ ...current, search: value }))}
                                                placeholder="Search campaign name"
                                                tooltip="Filter the ranked list by campaign name inside the selected date range."
                                            />
                                            <FilterSelect
                                                label="Objective"
                                                value={scaleFilters.objective}
                                                onChange={(value) => setScaleFilters((current) => ({ ...current, objective: value }))}
                                                options={intelligenceObjectiveOptions}
                                                tooltip="Keep the ranking apples-to-apples by narrowing to a single objective family."
                                            />
                                            <FilterSelect
                                                label="Status"
                                                value={scaleFilters.status}
                                                onChange={(value) => setScaleFilters((current) => ({ ...current, status: value }))}
                                                options={[
                                                    { value: 'active', label: 'Active only' },
                                                    { value: 'all', label: 'All statuses' },
                                                    { value: 'inactive', label: 'Inactive only' }
                                                ]}
                                                tooltip="Use Active only to focus on campaigns you can actually scale right now."
                                            />
                                            <FilterSelect
                                                label="Sort"
                                                value={scaleFilters.sort}
                                                onChange={(value) => setScaleFilters((current) => ({ ...current, sort: value }))}
                                                options={[
                                                    { value: 'score_desc', label: 'Performance score' },
                                                    { value: 'headroom_desc', label: 'Scale headroom' },
                                                    { value: 'roas_desc', label: 'ROAS' },
                                                    { value: 'spend_desc', label: 'Spend' },
                                                    { value: 'purchases_desc', label: 'Purchases' },
                                                    { value: 'ctr_desc', label: 'CTR' }
                                                ]}
                                                tooltip="Top 8 are shown per page. Change sort if you want to bias toward efficiency, spend depth, or pure result volume."
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gap: 12 }}>
                                            {pagedScaleCampaigns.items.map((c: any, i: number) => {
                                                const scoreTone = getScoreTone(c.efficiencyScore || 0);
                                                const confidenceTone = getConfidenceTone(c.confidenceLabel || 'Low confidence');
                                                const maturityTone = getMaturityTone(c.maturity?.label || 'Early');
                                                const statusLabel = c.effectiveStatus || c.status || 'UNKNOWN';
                                                const hasDelivery = Number(c.spend || 0) > 0 || Number(c.clicks || 0) > 0 || Number(c.purchases || 0) > 0;
                                                const headroom = c.scaleHeadroom || null;
                                                const headroomTone = headroom?.recommendationKey === 'scale_10_20'
                                                    ? { bg: 'rgba(16, 185, 129, 0.14)', color: '#86efac', border: 'rgba(16, 185, 129, 0.28)' }
                                                    : headroom?.recommendationKey === 'creative_refresh'
                                                        ? { bg: 'rgba(245, 158, 11, 0.14)', color: '#fcd34d', border: 'rgba(245, 158, 11, 0.28)' }
                                                        : headroom?.recommendationKey === 'do_not_scale'
                                                            ? { bg: 'rgba(239, 68, 68, 0.14)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.28)' }
                                                            : { bg: 'rgba(148, 163, 184, 0.14)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.28)' };
                                                return (
                                                    <div key={c.id} style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '40px minmax(0, 1.25fr) minmax(300px, 1fr) minmax(180px, 0.72fr) 110px',
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
                                                            background: COLORS[(pagedScaleCampaigns.start + i) % COLORS.length],
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 700
                                                        }}>
                                                            {pagedScaleCampaigns.start + i + 1}
                                                        </div>

                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: 700, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                                <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', fontSize: 12 }}>
                                                                    {c.objectiveLabel || toTitleCase((c.objective || '').replace('OUTCOME_', '').toLowerCase()) || 'Unknown Objective'}
                                                                </span>
                                                                <span style={{ padding: '4px 8px', borderRadius: 999, background: statusLabel === 'ACTIVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.16)', color: statusLabel === 'ACTIVE' ? '#86efac' : '#cbd5e1', fontSize: 12 }}>
                                                                    {statusLabel}
                                                                </span>
                                                                <span style={{ padding: '4px 8px', borderRadius: 999, background: confidenceTone.bg, color: confidenceTone.color, fontSize: 12, fontWeight: 600 }}>
                                                                    {c.confidenceLabel || 'Low confidence'}
                                                                </span>
                                                                <span style={{ padding: '4px 8px', borderRadius: 999, background: maturityTone.bg, color: maturityTone.color, fontSize: 12, fontWeight: 600 }}>
                                                                    {c.maturity?.label || 'Early'}
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
                                                                <div className="text-muted" style={{ fontSize: 11 }}>CVR {formatCompactPercent(c.conversionRate || 0)} from {formatNumber(c.purchases || 0)} / {formatNumber(c.clicks || 0)} clicks</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted" style={{ fontSize: 11 }}>ROAS</div>
                                                                <div style={{ fontWeight: 700 }}>{formatRoas(c.roas)}</div>
                                                                <div className="text-muted" style={{ fontSize: 11 }}>
                                                                    {hasDelivery ? `CTR ${formatCompactPercent(c.ctr || 0, 2)}` : 'No delivery in range'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ padding: '10px 12px', borderRadius: 10, background: headroomTone.bg, border: `1px solid ${headroomTone.border}` }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                                <span style={{ fontSize: 11, color: headroomTone.color, fontWeight: 700 }}>Headroom</span>
                                                                <span style={{ fontSize: 18, color: headroomTone.color, fontWeight: 800 }}>{Math.round(headroom?.score || 0)}</span>
                                                            </div>
                                                            <div style={{ fontSize: 12, color: headroomTone.color, fontWeight: 700, lineHeight: 1.25 }}>
                                                                {headroom?.recommendation || 'Hold budget'}
                                                            </div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                                                                Vol {Math.round(headroom?.conversionVolumeScore || 0)} • Fatigue {Math.round(headroom?.fatiguePressure || 0)} • Efficiency {Math.round(headroom?.degradationPressure || 0)}
                                                            </div>
                                                            {(headroom?.riskFlags || []).length > 0 && (
                                                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {(headroom.riskFlags || []).slice(0, 2).join(' • ')}
                                                                </div>
                                                            )}
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
                                        {!pagedScaleCampaigns.items.length && (
                                            <div style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(148, 163, 184, 0.12)', color: 'var(--muted)', fontSize: 13 }}>
                                                No campaigns match the current scale filters for this date range.
                                            </div>
                                        )}
                                        <SectionPager
                                            page={pagedScaleCampaigns.page}
                                            totalPages={pagedScaleCampaigns.totalPages}
                                            count={filteredScaleCampaigns.length}
                                            pageSize={sectionPageSize}
                                            onPageChange={(page) => setScaleFilters((current) => ({ ...current, page }))}
                                        />
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
                                    <div style={{ padding: '12px 16px', background: 'rgba(148, 163, 184, 0.08)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
                                        <strong>How to read this:</strong> the percentages and ratios shown in each card are the raw Meta trend signals for the selected date range. The small score is a modeled fatigue-pressure score from 0 to 100, not a Meta-native metric.
                                    </div>
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
                                                Blended Score: {advancedData.data.fatigueAnalysis?.score || 0}
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 12, fontWeight: 600 }}>
                                            {advancedData.data.fatigueAnalysis?.statusLabel || 'Unknown'}
                                        </div>
                                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                                            Derived heuristic, not a direct Meta field
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
                                                const tone = getRiskTone(item.score || 0);
                                                const derivedTone = getDerivedBadgeTone();
                                                return (
                                                    <div key={item.key} style={{ padding: 14, borderRadius: 12, background: 'var(--background)', border: `1px solid ${tone.border}` }}>
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                                                            <div>
                                                                <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                                                                    {item.label}
                                                                    <InfoTooltip text={`${item.description} The pressure score shown here is derived from thresholds in our fatigue model, not fetched directly from Meta Ads Manager.`} />
                                                                </div>
                                                                <div className="text-muted" style={{ fontSize: 10, marginTop: 3 }}>Raw Meta trend</div>
                                                            </div>
                                                            <span style={{
                                                                padding: '3px 8px',
                                                                borderRadius: 999,
                                                                background: derivedTone.bg,
                                                                border: `1px solid ${derivedTone.border}`,
                                                                color: derivedTone.color,
                                                                fontSize: 10,
                                                                fontWeight: 600
                                                            }}>
                                                                Modeled
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>{item.value}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
                                                                Derived pressure <InfoTooltip text="This 0-100 score is derived from the raw trend using fatigue-model thresholds. A low score does not mean the raw metric is zero; it means the model sees little fatigue pressure from it right now." />
                                                            </div>
                                                            <div style={{
                                                                padding: '4px 8px',
                                                                borderRadius: 999,
                                                                background: 'rgba(15, 23, 42, 0.7)',
                                                                border: `1px solid ${tone.border}`,
                                                                color: tone.color,
                                                                fontWeight: 700,
                                                                fontSize: 11
                                                            }}>
                                                                {Math.round(item.score || 0)}/100
                                                            </div>
                                                        </div>
                                                        <div style={{ height: 8, borderRadius: 999, background: 'rgba(148, 163, 184, 0.18)', overflow: 'hidden', marginBottom: 8 }}>
                                                            <div style={{ width: `${Math.min(item.score || 0, 100)}%`, height: '100%', background: tone.color }} />
                                                        </div>
                                                        <div style={{ fontSize: 11, color: tone.color }}>{tone.label}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {(advancedData.data.fatigueAnalysis?.sourceSplit || []).length > 0 && (
                                        <div style={{ display: 'grid', gap: 12 }}>
                                            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Fatigue Source Split</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                                                {(advancedData.data.fatigueAnalysis.sourceSplit || []).map((source: any) => {
                                                    const tone = getRiskTone(source.score || 0);
                                                    const confidenceTone = getConfidenceTone(source.confidenceLabel || 'Low confidence');
                                                    const derivedTone = getDerivedBadgeTone();
                                                    return (
                                                        <div key={source.key} style={{ padding: 14, borderRadius: 12, background: 'var(--background)', border: `1px solid ${tone.border}` }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                                <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                                                                    {source.label}
                                                                    <InfoTooltip text="This source split is inferred by weighting the component fatigue pressures. It is a diagnostic heuristic to explain likely cause, not a direct Meta breakdown." />
                                                                </div>
                                                                <span style={{
                                                                    padding: '3px 8px',
                                                                    borderRadius: 999,
                                                                    background: derivedTone.bg,
                                                                    border: `1px solid ${derivedTone.border}`,
                                                                    color: derivedTone.color,
                                                                    fontSize: 10,
                                                                    fontWeight: 600
                                                                }}>
                                                                    Derived
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                                <div style={{ fontSize: 11, color: tone.color, display: 'inline-flex', alignItems: 'center' }}>
                                                                    Modeled Contribution <InfoTooltip text="This 0-100 score shows how much this inferred source is contributing to fatigue pressure right now. It is not fetched directly from Meta Ads Manager." />
                                                                </div>
                                                                <div style={{ color: tone.color, fontWeight: 700 }}>{Math.round(source.score || 0)}</div>
                                                            </div>
                                                            <div style={{ height: 8, borderRadius: 999, background: 'rgba(148, 163, 184, 0.18)', overflow: 'hidden', marginBottom: 8 }}>
                                                                <div style={{ width: `${Math.min(source.score || 0, 100)}%`, height: '100%', background: tone.color }} />
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                                <span style={{ fontSize: 11, color: tone.color }}>{tone.label}</span>
                                                                <span style={{
                                                                    padding: '3px 8px',
                                                                    borderRadius: 999,
                                                                    background: confidenceTone.bg,
                                                                    color: confidenceTone.color,
                                                                    fontSize: 10,
                                                                    fontWeight: 600
                                                                }}>
                                                                    {source.confidenceLabel}
                                                                </span>
                                                            </div>
                                                            <div className="text-muted" style={{ fontSize: 12 }}>{source.detail}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
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
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                        <FilterInput
                                            label="Find campaign"
                                            value={cqiFilters.search}
                                            onChange={(value) => setCqiFilters((current) => ({ ...current, search: value }))}
                                            placeholder="Search CQI campaign"
                                            tooltip="Search within the campaigns included in the selected CQI date range."
                                        />
                                        <FilterSelect
                                            label="Objective"
                                            value={cqiFilters.objective}
                                            onChange={(value) => setCqiFilters((current) => ({ ...current, objective: value }))}
                                            options={cqiObjectiveOptions}
                                            tooltip="Narrow CQI to one objective family so score comparisons stay more apples-to-apples."
                                        />
                                        <FilterSelect
                                            label="Status"
                                            value={cqiFilters.status}
                                            onChange={(value) => setCqiFilters((current) => ({ ...current, status: value }))}
                                            options={[
                                                { value: 'active', label: 'Active only' },
                                                { value: 'all', label: 'All statuses' },
                                                { value: 'inactive', label: 'Inactive only' }
                                            ]}
                                            tooltip="Use Active only to focus on campaigns you can act on right now."
                                        />
                                        <FilterSelect
                                            label="Confidence"
                                            value={cqiFilters.confidence}
                                            onChange={(value) => setCqiFilters((current) => ({ ...current, confidence: value }))}
                                            options={[
                                                { value: 'all', label: 'All confidence' },
                                                { value: 'high confidence', label: 'High confidence' },
                                                { value: 'medium confidence', label: 'Medium confidence' },
                                                { value: 'low confidence', label: 'Low confidence' }
                                            ]}
                                            tooltip="Confidence reflects how much spend, clicks, and conversion evidence are behind the CQI read."
                                        />
                                        <FilterSelect
                                            label="Sort"
                                            value={cqiFilters.sort}
                                            onChange={(value) => setCqiFilters((current) => ({ ...current, sort: value }))}
                                            options={[
                                                { value: 'score_desc', label: 'CQI score' },
                                                { value: 'roas_desc', label: 'ROAS' },
                                                { value: 'ctr_desc', label: 'CTR' },
                                                { value: 'spend_desc', label: 'Spend' }
                                            ]}
                                            tooltip="Top 8 are shown per page, with sort deciding which campaigns surface first."
                                        />
                                    </div>
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
                                            {pagedCqiCampaigns.items.map((c: any) => {
                                                const confidenceTone = getConfidenceTone(c.metrics?.confidenceLabel || 'Low confidence');
                                                const maturityTone = getMaturityTone(c.maturity?.label || 'Early');
                                                const statusLabel = c.effectiveStatus || c.status || 'UNKNOWN';
                                                const hasDelivery = Number(c.spend || 0) > 0 || Number(c.clicks || 0) > 0 || Number(c.conversions || 0) > 0;
                                                return (
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
                                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                                            <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', fontSize: 10 }}>{c.objectiveLabel || getObjectiveFilterLabel(normalizeObjectiveGroup(c.objective))}</span>
                                                            <span style={{ padding: '3px 8px', borderRadius: 999, background: statusLabel === 'ACTIVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.16)', color: statusLabel === 'ACTIVE' ? '#86efac' : '#cbd5e1', fontSize: 10, fontWeight: 700 }}>{statusLabel}</span>
                                                            <span style={{ padding: '3px 8px', borderRadius: 999, background: confidenceTone.bg, color: confidenceTone.color, fontSize: 10, fontWeight: 700 }}>{c.metrics.confidenceLabel || 'Low confidence'}</span>
                                                            <span style={{ padding: '3px 8px', borderRadius: 999, background: maturityTone.bg, color: maturityTone.color, fontSize: 10, fontWeight: 700 }}>{c.maturity?.label || 'Early'}</span>
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                            CTR: {c.metrics.ctr}% • Click CVR: {c.metrics.conversionRate}% • CPA: {c.metrics.cpa ? formatCurrency(parseFloat(c.metrics.cpa)) : '—'}
                                                        </div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                                                            {hasDelivery
                                                                ? `ROAS: ${c.metrics.roas ? formatRoas(c.metrics.roas) : '—'} • ${formatNumber(c.conversions || 0)} conversions from ${formatNumber(c.clicks || 0)} clicks`
                                                                : 'No delivery in the selected date range, so this CQI row is informational only.'}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 700, color: c.gradeColor }}>{c.lqs}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                                            CTR {c.metrics.ctrScore} • CVR {c.metrics.conversionScore} • Vol {c.metrics.volumeScore}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                            })}
                                            {!pagedCqiCampaigns.items.length && (
                                                <div style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(148, 163, 184, 0.12)', color: 'var(--muted)', fontSize: 13 }}>
                                                    No campaigns match the current CQI filters for this date range.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <SectionPager
                                        page={pagedCqiCampaigns.page}
                                        totalPages={pagedCqiCampaigns.totalPages}
                                        count={filteredCqiCampaigns.length}
                                        pageSize={sectionPageSize}
                                        onPageChange={(page) => setCqiFilters((current) => ({ ...current, page }))}
                                    />
                                </SectionCard>
                            )}

                            {/* Creative Saturation by Campaign */}
                            {(advancedData.data.creativeSaturation?.campaigns || []).length > 0 && (
                                <SectionCard
                                    title={<span style={{ display: 'flex', alignItems: 'center' }}>🎛️ Creative Saturation by Campaign <InfoTooltip text="Campaign-level saturation combines real campaign frequency, CTR/CPC/CPM trend, active creative count, top-creative spend concentration, creative age, and creative performance spread." /></span>}
                                    subtitle="Flags whether the issue is creative rotation, one ad carrying spend, or audience saturation"
                                >
                                    {(() => {
                                        const saturation = advancedData.data.creativeSaturation;
                                        const summary = saturation.summary || {};
                                        const rows = (saturation.campaigns || []).slice(0, 6);
                                        return (
                                            <div style={{ display: 'grid', gap: 14 }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                                                    {[
                                                        { label: 'Avg saturation risk', value: Math.round(summary.averageRisk || 0), sub: '0-100 modeled score', color: '#60a5fa' },
                                                        { label: 'At risk campaigns', value: summary.atRiskCampaigns || 0, sub: `${summary.campaignsAnalyzed || 0} analyzed`, color: '#f59e0b' },
                                                        { label: 'Top concentration', value: `${Math.round(summary.topConcentration || 0)}%`, sub: 'Highest top-creative spend share', color: '#a78bfa' },
                                                        { label: 'Main read', value: summary.leadingCause || 'Healthy', sub: summary.comparisonLabel || 'Current range only', color: '#cbd5e1' }
                                                    ].map((item) => (
                                                        <div key={item.label} style={{ padding: 12, borderRadius: 10, background: 'rgba(15, 23, 42, 0.48)', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{item.label}</div>
                                                            <div style={{ fontSize: typeof item.value === 'string' && item.value.length > 18 ? 14 : 22, fontWeight: 800, color: item.color, lineHeight: 1.15 }}>{item.value}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{item.sub}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ display: 'grid', gap: 8 }}>
                                                    {rows.map((campaign: any) => {
                                                        const tone = campaign.statusKey === 'healthy'
                                                            ? { bg: 'rgba(16, 185, 129, 0.12)', color: '#86efac', border: 'rgba(16, 185, 129, 0.24)' }
                                                            : campaign.statusKey === 'audience_saturation'
                                                                ? { bg: 'rgba(99, 102, 241, 0.12)', color: '#c4b5fd', border: 'rgba(99, 102, 241, 0.24)' }
                                                                : campaign.statusKey === 'one_creative'
                                                                    ? { bg: 'rgba(245, 158, 11, 0.12)', color: '#fcd34d', border: 'rgba(245, 158, 11, 0.24)' }
                                                                    : { bg: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.24)' };
                                                        return (
                                                            <div key={campaign.campaignId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(220px, 0.8fr) 90px', gap: 14, alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: 'var(--background)', border: `1px solid ${tone.border}` }}>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.campaignName}</div>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                                                                        <span style={{ padding: '3px 8px', borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 10, fontWeight: 700 }}>{campaign.status}</span>
                                                                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{campaign.activeCreativeCount} active creative{campaign.activeCreativeCount === 1 ? '' : 's'}</span>
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                                                                    <div>
                                                                        <div className="text-muted" style={{ fontSize: 10 }}>Top spend</div>
                                                                        <div style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(campaign.topCreativeSpendShare || 0)}%</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-muted" style={{ fontSize: 10 }}>Freq</div>
                                                                        <div style={{ fontSize: 13, fontWeight: 700 }}>{campaign.campaignFrequency || 0}x</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-muted" style={{ fontSize: 10 }}>CTR trend</div>
                                                                        <div style={{ fontSize: 13, fontWeight: 700 }}>{campaign.trend?.ctr === null || campaign.trend?.ctr === undefined ? '—' : `${campaign.trend.ctr}%`}</div>
                                                                    </div>
                                                                </div>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <div style={{ fontSize: 24, fontWeight: 800, color: tone.color, lineHeight: 1 }}>{Math.round(campaign.saturationScore || 0)}</div>
                                                                    <div className="text-muted" style={{ fontSize: 10 }}>risk score</div>
                                                                </div>
                                                                {(campaign.reasons || []).length > 0 && (
                                                                    <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--muted)' }}>
                                                                        {(campaign.reasons || []).join(' • ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </SectionCard>
                            )}

                            {/* Creative Forensics */}
                            <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>🔍 Creative Forensics <InfoTooltip text="Reads each ad creative against its peers using real CTR, click-to-result rate, CPR, CPM, frequency, and video hook quality when available. The labels here are meant to help you decide whether to scale, refresh, or let the creative mature." /></span>} subtitle="Creative-by-creative diagnosis with visuals, cost signals, and practical next actions">
                                {advancedData.data.creativeForensicsMeta?.note && (
                                    <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
                                        <strong style={{ color: 'var(--foreground)' }}>Creative data note:</strong> {advancedData.data.creativeForensicsMeta.note}
                                    </div>
                                )}
                                {(advancedData.data.creativeForensics || []).length > 0 ? (
                                <>
                                <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
                                    The label is a diagnosis, not a vanity badge. Winners combine conversion proof and efficiency, and now also need to be active for at least 3 days with at least ₹2,000 spent. Traffic mismatch means the ad earns clicks but not enough downstream action. Early read means it simply has not spent enough yet to judge fairly.
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                    <FilterInput
                                        label="Find creative"
                                        value={creativeFilters.search}
                                        onChange={(value) => setCreativeFilters((current) => ({ ...current, search: value }))}
                                        placeholder="Search creative name"
                                        tooltip="Search creative cards by ad name in the selected date range."
                                    />
                                    <FilterSelect
                                        label="Status"
                                        value={creativeFilters.status}
                                        onChange={(value) => setCreativeFilters((current) => ({ ...current, status: value }))}
                                        options={[
                                            { value: 'all', label: 'All statuses' },
                                            { value: 'active', label: 'Active only' },
                                            { value: 'inactive', label: 'Inactive only' }
                                        ]}
                                        tooltip="Use Active only when you want the creative forensics view to focus on live ads."
                                    />
                                    <FilterSelect
                                        label="Format"
                                        value={creativeFilters.format}
                                        onChange={(value) => setCreativeFilters((current) => ({ ...current, format: value }))}
                                        options={[
                                            { value: 'all', label: 'All formats' },
                                            { value: 'video', label: 'Video only' },
                                            { value: 'static', label: 'Static only' }
                                        ]}
                                        tooltip="Separate video ads from static units when retention signals would otherwise dominate the read."
                                    />
                                    <FilterSelect
                                        label="Diagnosis"
                                        value={creativeFilters.diagnosis}
                                        onChange={(value) => setCreativeFilters((current) => ({ ...current, diagnosis: value }))}
                                        options={[
                                            { value: 'all', label: 'All diagnoses' },
                                            { value: 'winner', label: 'Winner' },
                                            { value: 'mixed', label: 'Mixed read' },
                                            { value: 'traffic_mismatch', label: 'Traffic mismatch' },
                                            { value: 'burning_spend', label: 'Burning spend' },
                                            { value: 'early_read', label: 'Early read' },
                                            { value: 'hook_issue', label: 'Hook weakness' }
                                        ]}
                                        tooltip="Filter to the specific creative diagnosis you want to investigate."
                                    />
                                    <FilterSelect
                                        label="Sort"
                                        value={creativeFilters.sort}
                                        onChange={(value) => setCreativeFilters((current) => ({ ...current, sort: value }))}
                                        options={[
                                            { value: 'score_desc', label: 'Creative score' },
                                            { value: 'roas_desc', label: 'ROAS' },
                                            { value: 'spend_desc', label: 'Spend' },
                                            { value: 'results_desc', label: 'Results' }
                                        ]}
                                        tooltip="Top 8 are shown per page. Sort determines which creative cards surface first."
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                    {pagedCreativeRows.items.map((ad: any) => {
                                        const pattern = ad.pattern || { label: 'Mixed Read', color: '#64748b', insight: 'Mixed performance signals.', action: 'Keep monitoring.' };
                                        const performanceScore = parseFloat(ad.performanceScore || 0);
                                        const shouldContainPreview = ad.previewSource === 'thumbnail';
                                        const confidenceTone = getConfidenceTone(ad.confidenceLabel || 'Low confidence');
                                        const maturityTone = getMaturityTone(ad.maturity?.label || 'Early');

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
                                                                    {ad.formatLabel || 'Video'}
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
                                                        Spend {formatCurrency(ad.spend)} • Freq {ad.frequency}x • {ad.isActive ? 'Active' : 'Inactive'} {ad.daysActive}d
                                                    </div>
                                                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        <span style={{ padding: '3px 8px', borderRadius: 999, background: confidenceTone.bg, color: confidenceTone.color, fontSize: 10, fontWeight: 700 }}>
                                                            {ad.confidenceLabel || 'Low confidence'}
                                                        </span>
                                                        <span style={{ padding: '3px 8px', borderRadius: 999, background: maturityTone.bg, color: maturityTone.color, fontSize: 10, fontWeight: 700 }}>
                                                            {ad.maturity?.label || 'Early'}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                            ROAS {ad.roas ? formatRoas(ad.roas) : '—'} • {formatNumber(ad.conversions)} results from {formatNumber(ad.clicks || 0)} clicks
                                                        </span>
                                                    </div>

                                                    {ad.hasVideo && ad.videoMetrics && (
                                                        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 6 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Video Retention</div>
                                                                <span style={{
                                                                    padding: '3px 8px',
                                                                    borderRadius: 999,
                                                                    background: getConfidenceTone(ad.videoMetrics.confidenceLabel || 'Low confidence').bg,
                                                                    color: getConfidenceTone(ad.videoMetrics.confidenceLabel || 'Low confidence').color,
                                                                    fontSize: 10,
                                                                    fontWeight: 600
                                                                }}>
                                                                    {ad.videoMetrics.confidenceLabel || 'Low confidence'}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: 12 }}>
                                                                Hook: <strong>{ad.videoMetrics.hookRate}%</strong> •
                                                                Complete: <strong>{ad.videoMetrics.completionRate}%</strong> •
                                                                Plays: <strong>{formatNumber(ad.videoMetrics.plays || 0)}</strong>
                                                            </div>
                                                            {!ad.videoMetrics.reliableForCreative && (
                                                                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                                                                    This video signal is directional only for the selected date range, so weak hook/completion is not used as a hard creative diagnosis.
                                                                </div>
                                                            )}
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
                                {!pagedCreativeRows.items.length && (
                                    <div style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(148, 163, 184, 0.12)', color: 'var(--muted)', fontSize: 13 }}>
                                        No creatives match the current diagnostics filters for this date range.
                                    </div>
                                )}
                                <SectionPager
                                    page={pagedCreativeRows.page}
                                    totalPages={pagedCreativeRows.totalPages}
                                    count={filteredCreativeRows.length}
                                    pageSize={sectionPageSize}
                                    onPageChange={(page) => setCreativeFilters((current) => ({ ...current, page }))}
                                />
                                </>
                                ) : (
                                    <div style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(15, 23, 42, 0.45)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
                                        No creative-level diagnostics were available for this refresh. This usually means Meta did not return ad-level insight rows for the selected date range, or the account required a reduced field fallback for ad creatives.
                                    </div>
                                )}
                            </SectionCard>

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
                                    {advancedData.data.learningOpportunityCost && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
                                            {(() => {
                                                const cost = advancedData.data.learningOpportunityCost;
                                                const tone = cost.consolidationRecommended
                                                    ? { bg: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.24)' }
                                                    : Number(cost.unstableSpendShare || 0) >= 15
                                                        ? { bg: 'rgba(245, 158, 11, 0.1)', color: '#fcd34d', border: 'rgba(245, 158, 11, 0.24)' }
                                                        : { bg: 'rgba(16, 185, 129, 0.1)', color: '#86efac', border: 'rgba(16, 185, 129, 0.24)' };
                                                return (
                                                    <>
                                                        <div style={{ padding: 12, borderRadius: 10, background: tone.bg, border: `1px solid ${tone.border}` }}>
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Unstable spend</div>
                                                            <div style={{ fontSize: 22, fontWeight: 800, color: tone.color, lineHeight: 1 }}>{formatCurrency(cost.unstableSpend || 0)}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{Math.round(cost.unstableSpendShare || 0)}% of delivery-readiness spend</div>
                                                        </div>
                                                        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(15, 23, 42, 0.48)', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Unlikely to exit</div>
                                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{cost.unlikelyCampaigns || 0}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{cost.unlikelyAdsets || 0} ad set{cost.unlikelyAdsets === 1 ? '' : 's'} at current pace</div>
                                                        </div>
                                                        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(15, 23, 42, 0.48)', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Unstable CPA</div>
                                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#cbd5e1', lineHeight: 1 }}>{cost.unstableCPA ? formatCurrency(cost.unstableCPA) : '—'}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{formatNumber(cost.unstableConversions || 0)} conversions in unstable states</div>
                                                        </div>
                                                        <div style={{ padding: 12, borderRadius: 10, background: tone.bg, border: `1px solid ${tone.border}` }}>
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Recommendation</div>
                                                            <div style={{ fontSize: 14, fontWeight: 800, color: tone.color, lineHeight: 1.25 }}>{cost.recommendation || 'Learning spend is contained'}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Based on readiness, event pace, age, and spend</div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                    {(advancedData.data.learningOpportunityCost?.readinessBuckets || []).length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                            {(advancedData.data.learningOpportunityCost.readinessBuckets || []).slice(0, 5).map((bucket: any) => (
                                                <div key={bucket.status} style={{ padding: '8px 10px', borderRadius: 999, background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.18)', fontSize: 11, color: 'var(--muted)' }}>
                                                    <strong style={{ color: 'var(--foreground)' }}>{bucket.label}</strong> {formatCurrency(bucket.spend || 0)} • {formatNumber(bucket.conversions || 0)} conv • CPA {bucket.cpa ? formatCurrency(bucket.cpa) : '—'}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
                                        This section is based on each ad set&apos;s <strong>objective</strong> and <strong>optimization goal</strong>. Conversion-style ad sets are judged on optimization-event pace. Awareness-style ad sets are judged on delivery stability, not a fake 50-conversion target.
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                        <FilterInput
                                            label="Find ad set"
                                            value={deliveryFilters.search}
                                            onChange={(value) => setDeliveryFilters((current) => ({ ...current, search: value }))}
                                            placeholder="Search ad set name"
                                            tooltip="Search delivery-readiness rows by ad set name within the selected date range."
                                        />
                                        <FilterSelect
                                            label="Objective"
                                            value={deliveryFilters.objective}
                                            onChange={(value) => setDeliveryFilters((current) => ({ ...current, objective: value }))}
                                            options={deliveryObjectiveOptions}
                                            tooltip="Filter to one objective family so delivery-readiness benchmarks stay comparable."
                                        />
                                        <FilterSelect
                                            label="Status"
                                            value={deliveryFilters.status}
                                            onChange={(value) => setDeliveryFilters((current) => ({ ...current, status: value }))}
                                            options={[
                                                { value: 'active', label: 'Active only' },
                                                { value: 'all', label: 'All statuses' },
                                                { value: 'paused', label: 'Paused only' },
                                                { value: 'inactive', label: 'Inactive only' }
                                            ]}
                                            tooltip="Focus on Active only if you want the list to reflect rows you can scale or fix now."
                                        />
                                        <FilterSelect
                                            label="Readiness"
                                            value={deliveryFilters.readiness}
                                            onChange={(value) => setDeliveryFilters((current) => ({ ...current, readiness: value }))}
                                            options={[
                                                { value: 'all', label: 'All readiness states' },
                                                { value: 'active', label: 'Stable delivery' },
                                                { value: 'delivery_active', label: 'Delivery stable' },
                                                { value: 'delivery_learning', label: 'New delivery' },
                                                { value: 'learning', label: 'Learning' },
                                                { value: 'limited', label: 'Learning limited' },
                                                { value: 'unknown', label: 'Unknown / paused' }
                                            ]}
                                            tooltip="Filter by the underlying readiness state so you can separate stable rows from learning or paused ones."
                                        />
                                        <FilterSelect
                                            label="Sort"
                                            value={deliveryFilters.sort}
                                            onChange={(value) => setDeliveryFilters((current) => ({ ...current, sort: value }))}
                                            options={[
                                                { value: 'spend_desc', label: 'Spend' },
                                                { value: 'pace_desc', label: 'Goal pace' },
                                                { value: 'days_desc', label: 'Days live' }
                                            ]}
                                            tooltip="Top 8 are shown per page, and sort determines which ad sets surface first."
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {pagedDeliveryRows.items.map((adset: any) => {
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
                                                        {(adset.warnings || []).length > 0 && (
                                                            <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24' }}>
                                                                Watchouts: {(adset.warnings || []).slice(0, 2).join(' ')}
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
                                    {!pagedDeliveryRows.items.length && (
                                        <div style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(148, 163, 184, 0.12)', color: 'var(--muted)', fontSize: 13 }}>
                                            No ad sets match the current delivery filters for this date range.
                                        </div>
                                    )}
                                    <SectionPager
                                        page={pagedDeliveryRows.page}
                                        totalPages={pagedDeliveryRows.totalPages}
                                        count={filteredDeliveryRows.length}
                                        pageSize={sectionPageSize}
                                        onPageChange={(page) => setDeliveryFilters((current) => ({ ...current, page }))}
                                    />
                                    <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, fontSize: 12 }}>
                                        <strong>Why this matters:</strong> Learning and learning-limited are ad set delivery states. Use event pace for conversion-style goals, but use delivery stability for awareness-style goals. Otherwise you end up penalizing the wrong campaigns with the wrong benchmark.
                                    </div>
                                </SectionCard>
                            )}

                            {/* Retargeting Lift */}
                            {advancedData.data.retargetingLift && (
                                <SectionCard title={<span style={{ display: 'flex', alignItems: 'center' }}>🔄 Retargeting Lift Analysis <InfoTooltip text="Measures whether retargeting converts better than cold traffic for the selected window. This uses click-to-conversion rate, not reach-to-conversion rate, so the comparison is closer to what performance marketers usually expect." /></span>} subtitle="Compares cold vs retargeting click-to-conversion efficiency and CPA">
                                    <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
                                        <strong>How to read this:</strong> click CVR means conversions divided by clicks in each bucket. A high lift is useful, but it is most reliable when retargeting has enough clicks and conversions behind it.
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                        <div style={{
                                            padding: '6px 10px',
                                            borderRadius: 999,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            ...getConfidenceTone(advancedData.data.retargetingLift.confidenceLabel || 'Low confidence')
                                        }}>
                                            {advancedData.data.retargetingLift.confidenceLabel || 'Low confidence'}
                                        </div>
                                        <div style={{
                                            padding: '6px 10px',
                                            borderRadius: 999,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            color: '#6366f1'
                                        }}>
                                            {formatMultiplier(
                                                (parseFloat(advancedData.data.retargetingLift.retarget.conversionRate || '0') || 0) /
                                                Math.max(parseFloat(advancedData.data.retargetingLift.cold.conversionRate || '0') || 0, 0.0001)
                                            )} retarget CVR vs cold
                                        </div>
                                        {advancedData.data.retargetingLift.cpaDelta !== null && advancedData.data.retargetingLift.cpaDelta !== undefined && (
                                            <div style={{
                                                padding: '6px 10px',
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: 'rgba(16, 185, 129, 0.1)',
                                                color: parseFloat(advancedData.data.retargetingLift.cpaDelta) >= 0 ? '#10b981' : '#ef4444'
                                            }}>
                                                {parseFloat(advancedData.data.retargetingLift.cpaDelta) >= 0 ? `${formatCompactPercent(advancedData.data.retargetingLift.cpaDelta, 1)} lower CPA` : `${formatCompactPercent(Math.abs(parseFloat(advancedData.data.retargetingLift.cpaDelta)), 1)} higher CPA`}
                                            </div>
                                        )}
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
                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                                {formatNumber(advancedData.data.retargetingLift.cold.conversions || 0)} conversions
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
                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                                {formatNumber(advancedData.data.retargetingLift.retarget.conversions || 0)} conversions
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
                                            <div style={{ fontSize: 13 }}>
                                                <div>{advancedData.data.retargetingLift.insight}</div>
                                                <div style={{ marginTop: 4, color: 'var(--muted)' }}>{advancedData.data.retargetingLift.sampleNote}</div>
                                            </div>
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
                    {deepDiagnosticsLoading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                            <p className="text-muted">Running deep analysis...</p>
                        </div>
                    ) : deepHasAnySectionData ? (
                        <>
                            {/* Video Hook Analysis */}
                            {deepVideoSummary ? (
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
                                            <div style={{ fontSize: 24, fontWeight: 700 }}>{deepVideoSummary.totalVideos}</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Weighted Hook Rate (25%)
                                                <InfoTooltip text={`Play-weighted share of video plays that reached the 25% watch milestone. This summary uses ${deepVideoSummary.weightingLabel || 'weighted averages'} instead of a simple ad-by-ad average.`} />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>{deepVideoSummary.avgHookRate}%</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Weighted Quality Score
                                                <InfoTooltip text="A play-weighted blended quality score from hook rate, hold rate, completion rate, spend depth, and result volume. This is more useful than ranking on hook rate alone." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{deepVideoSummary.weightedQualityScore}</div>
                                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Hold {deepVideoSummary.avgHoldRate}% • Complete {deepVideoSummary.avgCompletionRate}%</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8, textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                Needs Improvement
                                                <InfoTooltip text="Count of video ads whose hook or hold pattern suggests creative work is needed before scaling harder." />
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{deepVideoSummary.needsWork}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                                        <FilterInput
                                            label="Find creative"
                                            value={videoFilters.search}
                                            onChange={(value) => setVideoFilters((current) => ({ ...current, search: value }))}
                                            placeholder="Search video creative"
                                            tooltip="Search the video diagnostics list by creative name."
                                        />
                                        <FilterSelect
                                            label="Status"
                                            value={videoFilters.status}
                                            onChange={(value) => setVideoFilters((current) => ({ ...current, status: value }))}
                                            options={[
                                                { value: 'all', label: 'All statuses' },
                                                { value: 'active', label: 'Active only' },
                                                { value: 'inactive', label: 'Inactive only' }
                                            ]}
                                            tooltip="Use Active only if you want the top 8 to focus on creatives you can still improve or scale."
                                        />
                                        <FilterSelect
                                            label="Confidence"
                                            value={videoFilters.confidence}
                                            onChange={(value) => setVideoFilters((current) => ({ ...current, confidence: value }))}
                                            options={[
                                                { value: 'all', label: 'All confidence' },
                                                { value: 'high confidence', label: 'High confidence' },
                                                { value: 'medium confidence', label: 'Medium confidence' },
                                                { value: 'low confidence', label: 'Low confidence' }
                                            ]}
                                            tooltip="Confidence reflects how much play, spend, and result volume sit behind the video read."
                                        />
                                        <FilterSelect
                                            label="Diagnosis"
                                            value={videoFilters.diagnosis}
                                            onChange={(value) => setVideoFilters((current) => ({ ...current, diagnosis: value }))}
                                            options={[
                                                { value: 'all', label: 'All diagnoses' },
                                                { value: 'winner', label: 'Winner' },
                                                { value: 'promising', label: 'Promising' },
                                                { value: 'weak hook', label: 'Weak hook' },
                                                { value: 'content weak', label: 'Content weak' },
                                                { value: 'slow burn', label: 'Slow burn gem' },
                                                { value: 'needs more data', label: 'Needs more data' }
                                            ]}
                                            tooltip="Filter to the video pattern you want to inspect first."
                                        />
                                        <FilterSelect
                                            label="Sort"
                                            value={videoFilters.sort}
                                            onChange={(value) => setVideoFilters((current) => ({ ...current, sort: value }))}
                                            options={[
                                                { value: 'quality_desc', label: 'Quality score' },
                                                { value: 'hook_desc', label: 'Hook rate' },
                                                { value: 'spend_desc', label: 'Spend' },
                                                { value: 'results_desc', label: 'Results' }
                                            ]}
                                            tooltip="Top 8 are shown per page. Quality score is the new default because it blends hook, hold, completion, spend, and results."
                                        />
                                    </div>

                                    {/* Video Cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                                        {pagedVideoRows.items.map((v: any) => (
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
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                                        <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(99, 102, 241, 0.14)', color: '#c7d2fe', fontSize: 10, fontWeight: 700 }}>
                                                            Quality {v.qualityScore}
                                                        </span>
                                                        <span style={{ padding: '4px 8px', borderRadius: 999, background: getConfidenceTone(v.confidenceLabel || 'Low confidence').bg, color: getConfidenceTone(v.confidenceLabel || 'Low confidence').color, fontSize: 10, fontWeight: 700 }}>
                                                            {v.confidenceLabel || 'Low confidence'}
                                                        </span>
                                                        <span style={{ padding: '4px 8px', borderRadius: 999, background: getMaturityTone(v.maturity?.label || 'Early').bg, color: getMaturityTone(v.maturity?.label || 'Early').color, fontSize: 10, fontWeight: 700 }}>
                                                            {v.maturity?.label || 'Early'}
                                                        </span>
                                                    </div>

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
                                                        <span>{v.isActive ? 'Active' : 'Inactive'} {v.daysActive}d</span>
                                                        <span>•</span>
                                                        <span>Completion {v.retention.completionRate}% from {formatNumber(v.retention.p100 || 0)} / {formatNumber(v.retention.videoPlays || 0)} plays</span>
                                                        <span>•</span>
                                                        <span>{v.previewSource === 'creative' ? 'Creative preview' : v.previewSource === 'thumbnail' ? 'Thumbnail preview' : 'No preview source'}</span>
                                                    </div>
                                                    {(v.confidenceFlags || []).length > 0 && (
                                                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                                                            Flags: {(v.confidenceFlags || []).join(' • ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {!pagedVideoRows.items.length && (
                                        <div style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(148, 163, 184, 0.12)', color: 'var(--muted)', fontSize: 13 }}>
                                            No video creatives match the current diagnostics filters for this date range.
                                        </div>
                                    )}
                                    <SectionPager
                                        page={pagedVideoRows.page}
                                        totalPages={pagedVideoRows.totalPages}
                                        count={filteredVideoRows.length}
                                        pageSize={sectionPageSize}
                                        onPageChange={(page) => setVideoFilters((current) => ({ ...current, page }))}
                                    />
                                </SectionCard>
                            ) : (
                                <SectionCard
                                    title={<span style={{ display: 'flex', alignItems: 'center' }}>📹 Video Hook & Retention Analysis <InfoTooltip text="Uses Meta's real video-play and watch-depth actions. Hook rate is the share of plays that reached 25%. Hold rate is the share of 25% viewers who stayed through 75%." /></span>}
                                    subtitle="Use this when the account is spending materially on video and you want to see whether the opening and middle of the video are keeping attention"
                                >
                                    <div style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.18)', color: 'var(--muted)', fontSize: 13 }}>
                                        No video retention data was available for the selected date range.
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
                                                            <div style={{ display: 'grid', gap: 6 }}>
                                                                <span style={{
                                                                    padding: '4px 10px',
                                                                    borderRadius: 20,
                                                                    background: `${p.recommendationColor}20`,
                                                                    color: p.recommendationColor,
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    width: 'fit-content'
                                                                }}>
                                                                    {p.recommendation}
                                                                </span>
                                                                <span style={{
                                                                    padding: '4px 10px',
                                                                    borderRadius: 20,
                                                                    background: getMaturityTone(p.maturity?.label || 'Early').bg,
                                                                    color: getMaturityTone(p.maturity?.label || 'Early').color,
                                                                    fontSize: 10,
                                                                    fontWeight: 700,
                                                                    width: 'fit-content'
                                                                }}>
                                                                    {p.maturity?.label || 'Early'}
                                                                </span>
                                                            </div>
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
                    ) : deepDiagnosticsError ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <p className="text-muted" style={{ marginBottom: 8 }}>Deep diagnostics could not load for this account just now.</p>
                            <p className="text-muted" style={{ fontSize: 12 }}>
                                This refresh likely hit a temporary Meta response issue while fetching the diagnostics dataset.
                            </p>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <p className="text-muted">Diagnostics could not load any section for this account just now.</p>
                            <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                                This refresh likely timed out across multiple Meta diagnostics requests. Retry once the account load settles.
                            </p>
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
            <CampaignDrilldownDrawer
                open={Boolean(selectedCampaignId)}
                loading={campaignDrilldownLoading}
                loadingMore={campaignDrilldownLoadingMore}
                hasMore={Boolean(campaignDrilldownHasNextPage)}
                data={selectedCampaignDrilldown}
                onClose={() => {
                    setSelectedCampaignId(null);
                    setSelectedCreativeId(null);
                }}
                onCreativeSelect={(creative) => setSelectedCreativeId(creative.adId)}
                onLoadMore={() => {
                    void fetchMoreCampaignCreatives();
                }}
            />
            {selectedCreative && (
                <CreativeSpendModal
                    creative={selectedCreative}
                    comparisonLabel={selectedCampaignDrilldown?.spendTrend?.comparisonLabel || null}
                    onClose={() => setSelectedCreativeId(null)}
                />
            )}
        </div>
    );
}
