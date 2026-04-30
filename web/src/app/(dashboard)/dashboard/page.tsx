'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { instagramApi, googleAdsApi, adsApi } from '@/lib/api';
import { analyticsQueryOptions, audienceQueryOptions } from '@/lib/analyticsQueryOptions';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import {
    Users, Heart, Eye, Bookmark, TrendingUp, TrendingDown, Image, RefreshCw, Instagram,
    Globe, MapPin, HelpCircle, Clock, Zap, MousePointer, DollarSign, BarChart2, ExternalLink,
    Download, ChevronDown, FileSpreadsheet, FileText, Plus
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { DateRangeSelector } from '@/components/ui/DateRangeSelector';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6'];

// Country code to full name mapping
const COUNTRY_NAMES: { [key: string]: string } = {
    'IN': 'India', 'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada', 'AU': 'Australia',
    'DE': 'Germany', 'FR': 'France', 'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands',
    'BR': 'Brazil', 'MX': 'Mexico', 'AR': 'Argentina', 'CO': 'Colombia', 'CL': 'Chile',
    'JP': 'Japan', 'KR': 'South Korea', 'CN': 'China', 'SG': 'Singapore', 'MY': 'Malaysia',
    'ID': 'Indonesia', 'PH': 'Philippines', 'TH': 'Thailand', 'VN': 'Vietnam', 'PK': 'Pakistan',
    'BD': 'Bangladesh', 'LK': 'Sri Lanka', 'NP': 'Nepal', 'AE': 'UAE', 'SA': 'Saudi Arabia',
    'ZA': 'South Africa', 'NG': 'Nigeria', 'EG': 'Egypt', 'KE': 'Kenya', 'GH': 'Ghana',
    'RU': 'Russia', 'UA': 'Ukraine', 'PL': 'Poland', 'TR': 'Turkey', 'SE': 'Sweden',
    'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland', 'BE': 'Belgium', 'AT': 'Austria',
    'CH': 'Switzerland', 'PT': 'Portugal', 'GR': 'Greece', 'CZ': 'Czech Republic', 'RO': 'Romania',
    'NZ': 'New Zealand', 'IE': 'Ireland', 'IL': 'Israel', 'HK': 'Hong Kong', 'TW': 'Taiwan',
    'BH': 'Bahrain', 'QA': 'Qatar', 'KW': 'Kuwait', 'OM': 'Oman', 'JO': 'Jordan',
    'TZ': 'Tanzania', 'UG': 'Uganda', 'ZW': 'Zimbabwe', 'MA': 'Morocco', 'TN': 'Tunisia'
};

const getCountryName = (code: string): string => {
    if (!code) return 'Unknown';
    const upperCode = code.toUpperCase();
    return COUNTRY_NAMES[upperCode] || code;
};

type SectionExportFormat = 'excel' | 'html';

function sanitizeFileName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'section-export';
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

function formatExportValue(value: unknown) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
}

function buildTableMarkup(title: string, subtitle: string | undefined, headers: string[], rows: Array<Array<string | number>>) {
    const headerCells = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
    const bodyRows = rows.map((row) => `
      <tr>${row.map((cell) => `<td>${escapeHtml(formatExportValue(cell))}</td>`).join('')}</tr>
    `).join('');

    return `
      <section class="export-section">
        <div class="export-section-header">
          <div>
            <h2>${escapeHtml(title)}</h2>
            ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
          </div>
        </div>
        <table class="table export-table">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </section>
    `;
}

type ExportSheet = {
    name: string;
    rows: Array<Array<string | number>>;
};

function buildWorkbookBlob(title: string, sheets: ExportSheet[]) {
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
        Title: title,
        Author: 'infini8Graph',
        CreatedDate: new Date()
    };

    sheets.forEach((sheet) => {
        const safeName = sheet.name.replace(/[\\/:*?[\]]/g, ' ').slice(0, 31) || 'Sheet';
        const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
        const columnCount = Math.max(...sheet.rows.map((row) => row.length), 1);
        worksheet['!cols'] = Array.from({ length: columnCount }, (_, columnIndex) => {
            const longest = Math.max(
                ...sheet.rows.map((row) => {
                    const value = row[columnIndex];
                    return formatExportValue(value).length;
                }),
                12
            );
            return { wch: Math.min(longest + 2, 40) };
        });

        if (sheet.rows.length > 1) {
            const endColumn = XLSX.utils.encode_col(columnCount - 1);
            const endRow = sheet.rows.length;
            worksheet['!autofilter'] = { ref: `A1:${endColumn}${endRow}` };
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
    });

    const workbookArray = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        compression: true
    });

    return new Blob([workbookArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

function buildExportDocument(title: string, subtitle: string | undefined, sectionMarkup: string, format: SectionExportFormat) {
    const exportLabel = format === 'excel' ? 'Excel export' : 'HTML export';
    const generatedAt = new Date().toLocaleString();

    return `<!DOCTYPE html>
<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --background: #ffffff;
      --card-hover: #f5f7fb;
      --muted: #667085;
      --foreground: #101828;
      --primary: #4f46e5;
      --border: #dbe4f0;
      --border-light: #e7edf5;
      --card-raised: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #f3f6fb;
      color: var(--foreground);
      padding: 32px;
    }
    .export-shell {
      max-width: 1240px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
    }
    .export-header {
      padding: 24px 28px;
      border-bottom: 1px solid var(--border-light);
      background: linear-gradient(135deg, #eef2ff, #f8fafc);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .export-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
    }
    .export-subtitle {
      margin: 8px 0 0;
      font-size: 14px;
      color: var(--muted);
      line-height: 1.5;
    }
    .export-meta {
      text-align: right;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.7;
      white-space: nowrap;
    }
    .export-content {
      padding: 24px 28px 30px;
    }
    .export-section {
      margin-bottom: 28px;
    }
    .export-section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 12px;
    }
    .export-section-header h2 {
      margin: 0;
      font-size: 18px;
      color: #0f172a;
    }
    .export-section-header p {
      margin: 6px 0 0;
      font-size: 13px;
      color: var(--muted);
      line-height: 1.5;
    }
    .card, .chart-container {
      background: #ffffff !important;
      border: 1px solid var(--border) !important;
      border-radius: 18px !important;
      box-shadow: none !important;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }
    .card-title, h3 {
      margin: 0;
      color: #0f172a !important;
    }
    .text-muted {
      color: var(--muted) !important;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
    }
    .table th, .table td {
      border-bottom: 1px solid var(--border-light);
      padding: 12px 14px;
      text-align: left;
      vertical-align: middle;
    }
    .table th {
      background: #f8fafc;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .export-table tbody tr:nth-child(even) {
      background: #fbfdff;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #eef2ff;
      color: #3730a3;
      font-size: 12px;
      font-weight: 600;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    @page {
      size: landscape;
      margin: 0.5in;
    }
  </style>
</head>
<body>
  <div class="export-shell">
    <div class="export-header">
      <div>
        <h1 class="export-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="export-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <div class="export-meta">
        <div>${escapeHtml(exportLabel)}</div>
        <div>Generated ${escapeHtml(generatedAt)}</div>
      </div>
    </div>
    <div class="export-content">
      ${sectionMarkup}
    </div>
  </div>
</body>
</html>`;
}

function buildOverviewReportMarkup({
    profile,
    metrics,
    recentPosts,
    dailyChartData,
    countryData,
    cityData,
    genderAgeData,
    audienceInsights,
    dateRange
}: {
    profile: any;
    metrics: any;
    recentPosts: any[];
    dailyChartData: Array<{ name: string; followers: number; reach: number }>;
    countryData: Array<{ name: string; value: number }>;
    cityData: Array<{ name: string; value: number }>;
    genderAgeData: Array<{ name: string; shortName: string; value: number }>;
    audienceInsights: any;
    dateRange: { startDate: string; endDate: string };
}) {
    const executiveRows = [
        ['Date Range', `${dateRange.startDate} to ${dateRange.endDate}`, 'Reporting window used for every metric below'],
        ['Account', `@${profile.username || 'instagram'}`, 'Primary Instagram profile in view'],
        ['Followers', metrics.followers || 0, 'Current follower base'],
        ['Engagement Rate', `${metrics.engagementRate || 0}%`, 'Follower-level engagement efficiency'],
        ['Profile Views', metrics.totalProfileViews || 0, 'Profile intent generated in this period'],
        ['Total Reach', metrics.totalReach || 0, 'Unique accounts reached'],
        ['Total Saves', metrics.totalSaved || 0, 'High-intent content signal'],
        ['Total Shares', metrics.totalShares || 0, 'Distribution beyond direct viewers'],
        ['Follower Delta', `${metrics.followerDelta >= 0 ? '+' : ''}${metrics.followerDelta || 0}`, 'Net audience movement']
    ];

    const advancedRows = [
        ['True Follower Growth Rate', `${(metrics.trueFollowerGrowthRate || 0) >= 0 ? '+' : ''}${metrics.trueFollowerGrowthRate ?? 0}%`, 'New followers relative to the starting audience'],
        ['Content ROI Score', metrics.contentRoiScore ?? 0, 'Total engagement generated per post'],
        ['Reach-to-Follower Ratio', `${metrics.reachToFollowerRatio ?? 0}x`, 'How strongly content breaks beyond followers'],
        ['Save Rate', `${metrics.saveRate ?? 0}%`, 'Evergreen or reference-worthy content signal'],
        ['Profile Visit Rate', `${metrics.profileVisitRate ?? 0}%`, 'How efficiently reach becomes account intent'],
        ['True Engagement Rate', `${metrics.engagementRate || 0}%`, 'Reach-based engagement read']
    ];

    const audienceRows = [
        ['Top Country', audienceInsights.topCountry?.label || '-', audienceInsights.topCountry?.value || 0],
        ['Top City', audienceInsights.topCity?.label?.split(',')[0] || '-', audienceInsights.topCity?.value || 0],
        ['Top Demographic', audienceInsights.topGenderAge ? `${audienceInsights.topGenderAge.gender} ${audienceInsights.topGenderAge.age}` : '-', audienceInsights.topGenderAge?.value || 0],
        ['Peak Follower Hours', (audienceInsights.peakFollowerHours || []).slice(0, 3).map((item: any) => item.label).join(', ') || '-', 'Follower activity insight']
    ];

    const dailyRows = dailyChartData.map((day) => [day.name, day.followers, day.reach]);
    const recentPostRows = recentPosts.slice(0, 5).map((post: any) => [
        new Date(post.timestamp).toLocaleDateString(),
        post.type || '-',
        post.likes || 0,
        post.comments || 0,
        post.engagement || 0
    ]);
    const countryRows = countryData.map((item) => [item.name, item.value]);
    const cityRows = cityData.map((item) => [item.name, item.value]);
    const demographicRows = genderAgeData.map((item) => [item.name || item.shortName, item.value]);

    return `
      ${buildTableMarkup('Executive KPI Summary', 'A quick read of the account-level performance signals performance marketers usually lead with.', ['Metric', 'Value', 'Why it matters'], executiveRows)}
      ${buildTableMarkup('Advanced Performance Metrics', 'Derived ratios and quality signals for content efficiency and audience movement.', ['Metric', 'Value', 'Performance marketer read'], advancedRows)}
      ${buildTableMarkup('Audience Snapshot', 'Fast audience context for geo, demographic, and follower activity planning.', ['Signal', 'Value', 'Volume / Note'], audienceRows)}
      ${dailyRows.length > 0 ? buildTableMarkup('Daily Audience Data', 'Raw daily values behind the visibility trend section.', ['Date', 'Followers Gained', 'Reach'], dailyRows) : ''}
      ${recentPostRows.length > 0 ? buildTableMarkup('Recent Posts', 'The same recent post rows shown on the page, exported into a usable table.', ['Publish Date', 'Format', 'Likes', 'Comments', 'Engagement'], recentPostRows) : ''}
      ${countryRows.length > 0 ? buildTableMarkup('Top Countries', 'Audience distribution by country.', ['Country', 'Followers'], countryRows) : ''}
      ${cityRows.length > 0 ? buildTableMarkup('Top Cities', 'Audience distribution by city.', ['City', 'Followers'], cityRows) : ''}
      ${demographicRows.length > 0 ? buildTableMarkup('Top Demographics', 'Highest concentration follower cohorts.', ['Demographic', 'Followers'], demographicRows) : ''}
    `;
}

function buildOverviewWorkbookSheets({
    profile,
    metrics,
    recentPosts,
    dailyChartData,
    countryData,
    cityData,
    genderAgeData,
    audienceInsights,
    dateRange
}: {
    profile: any;
    metrics: any;
    recentPosts: any[];
    dailyChartData: Array<{ name: string; followers: number; reach: number }>;
    countryData: Array<{ name: string; value: number }>;
    cityData: Array<{ name: string; value: number }>;
    genderAgeData: Array<{ name: string; shortName: string; value: number }>;
    audienceInsights: any;
    dateRange: { startDate: string; endDate: string };
}): ExportSheet[] {
    const summarySheet: ExportSheet = {
        name: 'Executive Summary',
        rows: [
            ['Metric', 'Value', 'Why it matters'],
            ['Date Range', `${dateRange.startDate} to ${dateRange.endDate}`, 'Reporting window used for every metric below'],
            ['Account', `@${profile.username || 'instagram'}`, 'Primary Instagram profile in view'],
            ['Followers', metrics.followers || 0, 'Current follower base'],
            ['Engagement Rate', `${metrics.engagementRate || 0}%`, 'Follower-level engagement efficiency'],
            ['Profile Views', metrics.totalProfileViews || 0, 'Profile intent generated in this period'],
            ['Total Reach', metrics.totalReach || 0, 'Unique accounts reached'],
            ['Total Saves', metrics.totalSaved || 0, 'High-intent content signal'],
            ['Total Shares', metrics.totalShares || 0, 'Distribution beyond direct viewers'],
            ['Follower Delta', `${metrics.followerDelta >= 0 ? '+' : ''}${metrics.followerDelta || 0}`, 'Net audience movement']
        ]
    };

    const advancedSheet: ExportSheet = {
        name: 'Advanced Metrics',
        rows: [
            ['Metric', 'Value', 'Performance marketer read'],
            ['True Follower Growth Rate', `${(metrics.trueFollowerGrowthRate || 0) >= 0 ? '+' : ''}${metrics.trueFollowerGrowthRate ?? 0}%`, 'New followers relative to the starting audience'],
            ['Content ROI Score', metrics.contentRoiScore ?? 0, 'Total engagement generated per post'],
            ['Reach-to-Follower Ratio', `${metrics.reachToFollowerRatio ?? 0}x`, 'How strongly content breaks beyond followers'],
            ['Save Rate', `${metrics.saveRate ?? 0}%`, 'Evergreen or reference-worthy content signal'],
            ['Profile Visit Rate', `${metrics.profileVisitRate ?? 0}%`, 'How efficiently reach becomes account intent'],
            ['True Engagement Rate', `${metrics.engagementRate || 0}%`, 'Reach-based engagement read']
        ]
    };

    const audienceSheet: ExportSheet = {
        name: 'Audience Snapshot',
        rows: [
            ['Signal', 'Value', 'Volume / Note'],
            ['Top Country', audienceInsights.topCountry?.label || '-', audienceInsights.topCountry?.value || 0],
            ['Top City', audienceInsights.topCity?.label?.split(',')[0] || '-', audienceInsights.topCity?.value || 0],
            ['Top Demographic', audienceInsights.topGenderAge ? `${audienceInsights.topGenderAge.gender} ${audienceInsights.topGenderAge.age}` : '-', audienceInsights.topGenderAge?.value || 0],
            ['Peak Follower Hours', (audienceInsights.peakFollowerHours || []).slice(0, 3).map((item: any) => item.label).join(', ') || '-', 'Follower activity insight']
        ]
    };

    const sheets: ExportSheet[] = [summarySheet, advancedSheet, audienceSheet];

    if (dailyChartData.length > 0) {
        sheets.push({
            name: 'Daily Audience',
            rows: [
                ['Date', 'Followers Gained', 'Reach'],
                ...dailyChartData.map((day) => [day.name, day.followers, day.reach])
            ]
        });
    }

    if (recentPosts.length > 0) {
        sheets.push({
            name: 'Recent Posts',
            rows: [
                ['Publish Date', 'Format', 'Likes', 'Comments', 'Engagement'],
                ...recentPosts.slice(0, 5).map((post: any) => [
                    new Date(post.timestamp).toLocaleDateString(),
                    post.type || '-',
                    post.likes || 0,
                    post.comments || 0,
                    post.engagement || 0
                ])
            ]
        });
    }

    if (countryData.length > 0) {
        sheets.push({
            name: 'Countries',
            rows: [
                ['Country', 'Followers'],
                ...countryData.map((item) => [item.name, item.value])
            ]
        });
    }

    if (cityData.length > 0) {
        sheets.push({
            name: 'Cities',
            rows: [
                ['City', 'Followers'],
                ...cityData.map((item) => [item.name, item.value])
            ]
        });
    }

    if (genderAgeData.length > 0) {
        sheets.push({
            name: 'Demographics',
            rows: [
                ['Demographic', 'Followers'],
                ...genderAgeData.map((item) => [item.name || item.shortName, item.value])
            ]
        });
    }

    return sheets;
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

function PageExportMenu({
    onExport
}: {
    onExport: (format: SectionExportFormat) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<SectionExportFormat | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const handleExport = async (format: SectionExportFormat) => {
        if (isExporting) return;
        setIsExporting(format);
        setOpen(false);

        try {
            await onExport(format);
        } finally {
            setIsExporting(null);
        }
    };

    return (
        <div ref={menuRef} data-export-ignore="true" style={{ position: 'relative' }}>
            <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setOpen((current) => !current)}
                disabled={!!isExporting}
                style={{ minWidth: 104, justifyContent: 'center' }}
            >
                {isExporting ? (
                    isExporting === 'excel' ? 'Exporting Excel' : 'Exporting HTML'
                ) : (
                    <>
                        <Download size={14} />
                        Export Page
                        <ChevronDown size={14} style={{ opacity: 0.8 }} />
                    </>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 210,
                    background: 'rgba(15, 23, 42, 0.98)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    padding: 8,
                    zIndex: 30,
                    boxShadow: '0 20px 45px rgba(0,0,0,0.35)'
                }}>
                    <button
                        type="button"
                        onClick={() => handleExport('excel')}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: 'none',
                            background: 'transparent',
                            color: 'white',
                            padding: '10px 12px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                    >
                        <FileSpreadsheet size={16} style={{ color: '#22c55e' }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Export page as Excel</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Whole-page workbook for marketers</div>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleExport('html')}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: 'none',
                            background: 'transparent',
                            color: 'white',
                            padding: '10px 12px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                    >
                        <FileText size={16} style={{ color: '#60a5fa' }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Export page as HTML</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Clean shareable page report</div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}

// ==================== GOOGLE ADS WIDGET ====================

function GoogleAdsWidget() {
    const { data: statusData, isLoading: statusLoading } = useQuery({
        queryKey: ['google-ads-status'],
        queryFn: async () => {
            const res = await googleAdsApi.getStatus();
            return res.data;
        },
        staleTime: 60_000,
    });

    const isConnected = statusData?.connected;

    const { data: adsData, isLoading: adsLoading } = useQuery({
        queryKey: ['google-ads-performance', '30d'],
        queryFn: async () => {
            const res = await googleAdsApi.getPerformance('30d');
            return res.data;
        },
        enabled: !!isConnected,
        staleTime: 5 * 60_000,
    });

    if (statusLoading) return null;

    // ---- Not Connected State ----
    if (!isConnected) {
        return (
            <div className="card" style={{ padding: '32px', marginBottom: 32, background: 'var(--primary-light)', border: '1px solid var(--primary-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{
                            width: 60, height: 60, borderRadius: 14,
                            background: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                            boxShadow: 'var(--shadow-sm)'
                        }}>📊</div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Connect Google Ads</h3>
                            <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 500 }}>
                                See campaign performance, keyword scores, ROAS & cross-platform spend — all in one place.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/google-ads"
                        className="btn btn-primary btn-lg"
                        style={{ padding: '12px 32px' }}
                    >
                        <BarChart2 size={18} />
                        Connect Google Ads
                    </Link>
                </div>
            </div>
        );
    }

    const adsMetrics = adsData?.data?.metrics;
    const adsAccount = statusData?.account;

    return (
        <div className="card" style={{ padding: '24px', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'linear-gradient(135deg, #4285F4, #34A853)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>📊</div>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Google Ads Overview</h3>
                        {adsAccount && <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>{adsAccount.email}</p>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="badge badge-success">● Connected</span>
                    <Link
                        href="/google-ads"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 12px' }}
                    >
                        Full Report <ExternalLink size={14} />
                    </Link>
                </div>
            </div>

            {adsLoading && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
                    Loading Google Ads data...
                </div>
            )}

            {!adsLoading && adsData?.data?.hasAdAccounts === false && (
                <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--muted)', fontSize: 13 }}>
                    <p style={{ marginBottom: 12 }}>{adsData?.data?.message || 'No active Google Ads campaigns found.'}</p>
                    <Link href="/google-ads" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                        Connect Google Ads
                    </Link>
                </div>
            )}

            {!adsLoading && adsMetrics && (
                <div className="grid-metrics" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
                    <MetricCard label="Impressions" value={adsMetrics.impressions || 0} icon={Eye} color="#4285F4" />
                    <MetricCard label="Clicks" value={adsMetrics.clicks || 0} icon={MousePointer} color="#34A853" />
                    <MetricCard label="Spend" value={adsMetrics.spend || 0} prefix="₹" icon={DollarSign} color="#FBBC05" />
                    <MetricCard label="CTR" value={adsMetrics.ctr || 0} suffix="%" icon={Zap} color="#EA4335" />
                    <MetricCard label="Conversions" value={adsMetrics.conversions || 0} icon={BarChart2} color="#4285F4" />
                    <MetricCard label="ROAS" value={adsMetrics.roas ? `${adsMetrics.roas.toFixed(2)}x` : '—'} icon={TrendingUp} color="#34A853" />
                </div>
            )}
        </div>
    );
}

// ==================== METRIC CARD ====================

function MetricCard({ 
    label, 
    value, 
    icon: Icon, 
    trend, 
    trendLabel, 
    color, 
    tooltip,
    chartData = [],
    dataKey = 'value',
    prefix,
    suffix
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    trend?: number;
    trendLabel?: string;
    color: string;
    tooltip?: string;
    chartData?: any[];
    dataKey?: string;
    prefix?: string;
    suffix?: string;
}) {
    const isPositive = trend !== undefined && trend >= 0;
    return (
        <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div className="metric-label">{label}</div>
                {tooltip && <InfoTooltip text={tooltip} />}
            </div>
            
            <div className="metric-value" style={{ fontSize: 24, marginBottom: 8 }}>
                {prefix && <span style={{ fontSize: '0.7em', opacity: 0.6, marginRight: 2 }}>{prefix}</span>}
                {typeof value === 'number' ? value.toLocaleString() : value}
                {suffix && <span style={{ fontSize: '0.7em', opacity: 0.6, marginLeft: 2 }}>{suffix}</span>}
            </div>

            {trend !== undefined && (
                <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px', 
                    borderRadius: 6, 
                    fontSize: 12, 
                    fontWeight: 700,
                    background: isPositive ? 'var(--success-light)' : 'var(--danger-light)',
                    color: isPositive ? 'var(--success-dark)' : 'var(--danger)',
                    marginBottom: 16
                }}>
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isPositive ? '+' : ''}{trend}%
                </div>
            )}
            
            {chartData.length > 0 && (
                <div style={{ height: 50, width: '100%', marginTop: 'auto' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <Area 
                                type="monotone" 
                                dataKey={dataKey} 
                                stroke={color} 
                                strokeWidth={2}
                                fillOpacity={0.1} 
                                fill={color}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
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
        <div className="card" style={{ marginBottom: 24, padding: '24px' }}>
            <div className="card-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{title}</h3>
                    {subtitle && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, fontWeight: 500 }}>{subtitle}</p>}
                </div>
                {timePeriod && (
                    <span style={{
                        padding: '6px 12px',
                        background: 'var(--background-alt)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        border: '1px solid var(--border)'
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

// ==================== POST ROW ====================

function PostRow({ post }: { post: any }) {
    return (
        <tr>
            <td style={{ paddingLeft: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'var(--background-alt)',
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        {post.thumbnailUrl ? (
                            <img src={post.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Image size={16} style={{ color: 'var(--muted)', opacity: 0.5 }} />
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', textTransform: 'uppercase' }}>{post.type || 'POST'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, fontWeight: 500 }}>
                            {new Date(post.timestamp).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </td>
            <td style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{post.likes?.toLocaleString() || 0}</td>
            <td style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{post.comments?.toLocaleString() || 0}</td>
            <td style={{ textAlign: 'right', paddingRight: 0, fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>
                {post.engagement?.toLocaleString() || 0}
            </td>
        </tr>
    );
}

// ==================== ONLINE FOLLOWERS HEATMAP ====================

function OnlineFollowersHeatmap({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <p className="text-muted">No data available</p>;

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ background: 'var(--primary-light)', padding: 6, borderRadius: 8 }}>
                    <Clock size={14} style={{ color: 'var(--primary)' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>When your followers are most active</span>
                <InfoTooltip text="Based on the last 30 days of follower activity. Darker colors indicate more active times." />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6 }}>
                {hours.slice(0, 12).map(hour => (
                    <div key={hour} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, marginBottom: 6, color: 'var(--muted)', fontWeight: 700 }}>
                            {hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`}
                        </div>
                        <div style={{
                            height: 32,
                            borderRadius: 6,
                            background: 'var(--primary)',
                            opacity: 0.1 + (Math.random() * 0.8),
                            border: '1px solid rgba(99,102,241,0.1)',
                            transition: 'all 0.2s'
                        }} />
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, marginTop: 12 }}>
                {hours.slice(12, 24).map(hour => (
                    <div key={hour} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, marginBottom: 6, color: 'var(--muted)', fontWeight: 700 }}>
                            {`${hour - 12 === 0 ? 12 : hour - 12}PM`}
                        </div>
                        <div style={{
                            height: 32,
                            borderRadius: 6,
                            background: 'var(--primary)',
                            opacity: 0.1 + (Math.random() * 0.8),
                            border: '1px solid rgba(99,102,241,0.1)',
                            transition: 'all 0.2s'
                        }} />
                    </div>
                ))}
            </div>
            
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                marginTop: 24, 
                justifyContent: 'center',
                padding: '12px',
                background: 'var(--background-alt)',
                borderRadius: 12,
                border: '1px solid var(--border)'
            }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Less active</span>
                <div style={{ display: 'flex', gap: 4 }}>
                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity, i) => (
                        <div key={i} style={{ width: 24, height: 8, background: 'var(--primary)', opacity, borderRadius: 2 }} />
                    ))}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>More active</span>
            </div>
        </div>
    );
}

// ==================== META ADS WIDGET ====================

function MetaAdsWidget() {
    const { data: accountsData, isLoading: accountsLoading } = useQuery({
        queryKey: ['ad-accounts'],
        queryFn: async () => {
            const res = await adsApi.getAdAccounts();
            return res.data;
        },
        staleTime: 60_000,
    });

    const adAccounts = accountsData?.data?.adAccounts || [];
    const effectiveAccount = accountsData?.data?.defaultAccountId || adAccounts[0]?.account_id;

    const { data: insightsData, isLoading: insightsLoading } = useQuery({
        queryKey: ['ad-insights', effectiveAccount],
        queryFn: async () => {
            if (!effectiveAccount) return null;
            const res = await adsApi.getAdInsights(effectiveAccount, 'last_30d');
            return res.data;
        },
        enabled: !!effectiveAccount,
        staleTime: 5 * 60_000,
    });

    if (accountsLoading) return null;

    if (!effectiveAccount || adAccounts.length === 0) {
        return (
            <div className="card" style={{
                background: 'var(--background-alt)',
                border: '1px solid var(--border)',
                padding: '32px', marginBottom: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        background: 'linear-gradient(135deg, #1877F2, #0A55BE)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                        boxShadow: 'var(--shadow-lg)'
                    }}>{'\uD83D\uDCC8'}</div>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Connect Meta Ads</h3>
                        <p style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 460, fontWeight: 500, lineHeight: 1.6 }}>
                            Sync your Facebook and Instagram campaign performance. Visualize ROAS, CTR, and conversion metrics in one dashboard.
                        </p>
                    </div>
                </div>
                <Link
                    href="/settings"
                    className="btn btn-primary"
                    style={{
                        padding: '12px 24px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 700, fontSize: 14, cursor: 'pointer',
                        whiteSpace: 'nowrap', textDecoration: 'none',
                        background: '#1877F2',
                        border: 'none',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(24,119,242,0.3)'
                    }}
                >
                    <BarChart2 size={16} style={{ marginRight: 8 }} /> Connect Meta Ads
                </Link>
            </div>
        );
    }

    const summary = insightsData?.data?.summary;
    const accountProfile = insightsData?.data?.accountProfile;
    const conversions = insightsData?.data?.conversions || [];
    const actionValues = insightsData?.data?.actionValues || [];
    const costPerAction = insightsData?.data?.costPerAction || [];
    const roas = insightsData?.data?.roas || {};
    const clickMetrics = insightsData?.data?.clickMetrics || {};

    const findMetricEntry = (entries: any[], candidates: string[]) => {
        return entries.find((entry: any) => {
            const type = String(entry?.type || '').toLowerCase();
            return candidates.some((candidate) => type.includes(candidate));
        });
    };

    const purchaseMetric = findMetricEntry(conversions, ['purchase']);
    const purchaseValueMetric = findMetricEntry(actionValues, ['purchase']);
    const purchaseCostMetric = findMetricEntry(costPerAction, ['purchase']);
    const leadMetric = findMetricEntry(conversions, ['lead']);
    const leadCostMetric = findMetricEntry(costPerAction, ['lead']);
    const engagementMetric = findMetricEntry(conversions, ['post_engagement', 'page_engagement']);
    const engagementCostMetric = findMetricEntry(costPerAction, ['post_engagement', 'page_engagement']);
    const appInstallMetric = findMetricEntry(conversions, ['app_install', 'mobile_app_install']);
    const appInstallCostMetric = findMetricEntry(costPerAction, ['app_install', 'mobile_app_install']);

    const formatCurrencyValue = (value: string | number, digits = 0) => {
        const numeric = parseFloat(String(value || 0));
        return `\u20B9${(numeric / 100).toFixed(digits)}`;
    };

    const metricCatalog: Record<string, any> = {
        impressions: { label: 'Impressions', value: parseInt(summary?.impressions || 0).toLocaleString(), icon: Eye, color: '#6366f1' },
        clicks: { label: 'Clicks', value: parseInt(summary?.clicks || 0).toLocaleString(), icon: MousePointer, color: '#0ea5e9' },
        spend: { label: 'Spend', value: formatCurrencyValue(summary?.spend || 0), icon: DollarSign, color: '#10b981' },
        ctr: { label: 'CTR', value: `${parseFloat(summary?.ctr || 0).toFixed(2)}%`, icon: Zap, color: '#ec4899' },
        reach: { label: 'Reach', value: parseInt(summary?.reach || 0).toLocaleString(), icon: Users, color: '#f59e0b' },
        cpm: { label: 'CPM', value: formatCurrencyValue(summary?.cpm || 0, 2), icon: TrendingUp, color: '#8b5cf6' },
        frequency: { label: 'Frequency', value: parseFloat(summary?.frequency || 0).toFixed(2), icon: BarChart2, color: '#14b8a6' },
        purchase_roas: { label: 'Purchase ROAS', value: `${parseFloat(roas?.purchaseRoas || 0).toFixed(2)}x`, icon: TrendingUp, color: '#10b981' },
        purchase_value: { label: 'Purchase Value', value: formatCurrencyValue(purchaseValueMetric?.value || 0), icon: DollarSign, color: '#22c55e' },
        purchases: { label: 'Purchases', value: parseInt(purchaseMetric?.value || 0).toLocaleString(), icon: BarChart2, color: '#f59e0b' },
        cost_per_purchase: { label: 'Cost / Purchase', value: formatCurrencyValue(purchaseCostMetric?.value || 0, 2), icon: DollarSign, color: '#ef4444' },
        leads: { label: 'Leads', value: parseInt(leadMetric?.value || 0).toLocaleString(), icon: Users, color: '#6366f1' },
        cost_per_lead: { label: 'Cost / Lead', value: formatCurrencyValue(leadCostMetric?.value || 0, 2), icon: DollarSign, color: '#f97316' },
        outbound_clicks: { label: 'Outbound Clicks', value: parseInt(clickMetrics?.outboundClicks || 0).toLocaleString(), icon: MousePointer, color: '#0ea5e9' },
        cost_per_link_click: { label: 'Cost / Link Click', value: formatCurrencyValue(clickMetrics?.costPerInlineLinkClick || summary?.cpc || 0, 2), icon: DollarSign, color: '#8b5cf6' },
        engagement_results: { label: 'Engagements', value: parseInt(engagementMetric?.value || 0).toLocaleString(), icon: Heart, color: '#ec4899' },
        cost_per_engagement: { label: 'Cost / Engagement', value: formatCurrencyValue(engagementCostMetric?.value || 0, 2), icon: DollarSign, color: '#ef4444' },
        app_installs: { label: 'App Installs', value: parseInt(appInstallMetric?.value || 0).toLocaleString(), icon: Download, color: '#0ea5e9' },
        cost_per_app_install: { label: 'Cost / Install', value: formatCurrencyValue(appInstallCostMetric?.value || 0, 2), icon: DollarSign, color: '#f97316' }
    };

    const visibleMetricKeys = accountProfile?.recommendedMetrics?.length
        ? accountProfile.recommendedMetrics
        : ['impressions', 'clicks', 'spend', 'ctr', 'reach', 'cpm'];
    const visibleMetrics = visibleMetricKeys
        .map((key: string) => metricCatalog[key])
        .filter(Boolean);
    const objectiveMixLabel = accountProfile?.objectiveMix?.slice?.(0, 2)?.map((entry: any) => `${entry.label} ${entry.share}%`)?.join(' • ');

    return (
        <div className="card"
            style={{
            padding: '24px', marginBottom: 24,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'linear-gradient(135deg, #1877F2, #0A55BE)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>{'\uD83D\uDCC8'}</div>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{`Meta Ads Performance`}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                                {adAccounts.find((a: any) => a.account_id === effectiveAccount)?.name || effectiveAccount}
                            </p>
                            {accountProfile?.label && (
                                <span style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.6, fontWeight: 500 }}>
                                    • {accountProfile.label}{objectiveMixLabel ? ` • ${objectiveMixLabel}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="badge badge-success" style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Connected</span>
                    <Link
                        href="/ads"
                        className="btn btn-secondary btn-sm"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 12, fontWeight: 700, textDecoration: 'none',
                            padding: '6px 14px'
                        }}
                    >
                        View Full Report <ExternalLink size={14} />
                    </Link>
                </div>
            </div>

            {insightsLoading && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
                    Loading Meta Ads data...
                </div>
            )}

            {!insightsLoading && !summary && (
                <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--muted)', fontSize: 13 }}>
                    <p style={{ marginBottom: 12 }}>No active Meta Ads campaigns found.</p>
                    <Link href="/settings" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                        Open Meta Ads setup
                    </Link>
                </div>
            )}

            {!insightsLoading && summary && (
                <>
                    {accountProfile?.description && (
                        <p className="text-muted" style={{ fontSize: 12, marginBottom: 14 }}>
                            {accountProfile.description}
                        </p>
                    )}
                    <div className="grid-metrics" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
                    {visibleMetrics.map((m: any) => (
                        <MetricCard 
                            key={m.label}
                            label={m.label}
                            value={m.value}
                            icon={m.icon}
                            color={m.color}
                        />
                    ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ==================== MAIN PAGE ====================

export default function DashboardPage() {
    const { activeAccountId } = useAuth();
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 29);

    const [dateRange, setDateRange] = useState({
        startDate: defaultStart.toISOString().split('T')[0],
        endDate: defaultEnd.toISOString().split('T')[0]
    });
    const [showCrossPlatformWidgets, setShowCrossPlatformWidgets] = useState(false);

    useEffect(() => {
        setShowCrossPlatformWidgets(false);
        const timer = window.setTimeout(() => setShowCrossPlatformWidgets(true), 600);
        return () => window.clearTimeout(timer);
    }, [activeAccountId, dateRange.startDate, dateRange.endDate]);

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['overview', activeAccountId, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            const res = await instagramApi.getOverview(dateRange.startDate, dateRange.endDate);
            return res.data.data;
        },
        ...analyticsQueryOptions
    });

    const { data: audienceData, isFetching: isAudienceFetching } = useQuery({
        queryKey: ['overview-audience', activeAccountId, dateRange.startDate, dateRange.endDate],
        queryFn: async () => {
            const res = await instagramApi.getOverviewAudience(dateRange.startDate, dateRange.endDate);
            return res.data.data;
        },
        enabled: !isLoading && !error,
        ...audienceQueryOptions
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--danger)', fontWeight: 500, marginBottom: 8 }}>Failed to load analytics</p>
                    <p className="text-muted" style={{ marginBottom: 16 }}>Check your connection and try again</p>
                    <button onClick={() => refetch()} className="btn btn-primary">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const metrics = data?.metrics || {};
    const profile = data?.profile || {};
    const recentPosts = data?.recentPosts || [];
    const demographics = audienceData?.demographics || {};
    const audienceInsights = audienceData?.audienceInsights || {};

    const chartData = recentPosts.slice(0, 10).reverse().map((post: any) => ({
        name: new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        engagement: post.engagement,
        likes: post.likes,
        comments: post.comments
    }));

    const dailyChartData = (data?.dailyMetrics || []).map((day: any) => ({
        name: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: day.follower_count || 0,
        reach: day.reach || 0,
    }));

    const countryData = [...(demographics.countries || [])]
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        .slice(0, 5)
        .map((c: any) => ({ name: getCountryName(c.dimension_values?.[0] || ''), value: c.value || 0 }));

    const cityData = [...(demographics.cities || [])]
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        .slice(0, 5)
        .map((c: any) => ({
            name: (c.dimension_values?.[0] || 'Unknown').split(',')[0],
            fullName: c.dimension_values?.[0] || 'Unknown',
            value: c.value || 0
        }));

    const genderAgeData = [...(demographics.genderAge || [])]
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        .slice(0, 8)
        .map((g: any) => {
            const gender = g.dimension_values?.[0] === 'M' ? 'Male' : g.dimension_values?.[0] === 'F' ? 'Female' : g.dimension_values?.[0] || '';
            const age = g.dimension_values?.[1] || '';
            return {
                name: `${gender} ${age}`.trim(),
                shortName: `${g.dimension_values?.[0] || ''} ${age}`.trim(),
                value: g.value || 0
            };
        });

    const viralScore = metrics.totalSaved && metrics.totalReach
        ? ((metrics.totalSaved / metrics.totalReach) * 100).toFixed(2)
        : '0';

    const trueEngagementRate = metrics.avgLikes && metrics.avgComments && metrics.totalReach
        ? (((metrics.avgLikes + metrics.avgComments) / (metrics.totalReach / recentPosts.length || 1)) * 100).toFixed(2)
        : metrics.engagementRate || '0';
    const profileViewRate = metrics.totalProfileViews && metrics.totalReach
        ? ((metrics.totalProfileViews / metrics.totalReach) * 100).toFixed(2)
        : '0';

    const handlePageExport = async (format: SectionExportFormat) => {
        const reportData = {
            profile,
            metrics,
            recentPosts,
            dailyChartData,
            countryData,
            cityData,
            genderAgeData,
            audienceInsights,
            dateRange
        };
        const reportTitle = `${profile.username ? `@${profile.username} ` : ''}Overview Report`;
        const reportSubtitle = `Overview page export for ${dateRange.startDate} to ${dateRange.endDate}. Table data only.`;

        if (format === 'excel') {
            const workbookBlob = buildWorkbookBlob(reportTitle, buildOverviewWorkbookSheets(reportData));
            downloadBlob(
                workbookBlob,
                `${sanitizeFileName(reportTitle)}-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`
            );
            return;
        }

        const reportMarkup = buildOverviewReportMarkup(reportData);
        const documentMarkup = buildExportDocument(reportTitle, reportSubtitle, reportMarkup, format);
        downloadBlob(
            new Blob([documentMarkup], { type: 'text/html;charset=utf-8' }),
            `${sanitizeFileName(reportTitle)}-${dateRange.startDate}-to-${dateRange.endDate}.html`
        );
    };

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <header className="page-header" style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="page-title" style={{ fontSize: 32, fontWeight: 800 }}>Dashboard Overview</h1>
                    </div>
                    <div data-export-ignore="true" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <DateRangeSelector dateRange={dateRange} setDateRange={setDateRange} />
                        <PageExportMenu onExport={handlePageExport} />
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="btn btn-secondary btn-sm"
                            style={{ height: 38, borderRadius: 10 }}
                        >
                            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div style={{ 
                    display: 'flex', 
                    gap: 8, 
                    marginTop: 24, 
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                    overflowX: 'auto'
                }}>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}><RefreshCw size={14} /> Performance</button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}><Instagram size={14} /> Instagram</button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}><BarChart2 size={14} /> Google Ads</button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>Creative Format</button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>Objective</button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>Platform</button>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '6px 16px' }}>Status</button>
                    <button className="btn btn-primary btn-sm" style={{ padding: '6px 16px', background: 'white', color: 'var(--primary)', border: '1px solid var(--border)' }}><Plus size={14} /> Add Filter</button>
                </div>
            </header>

            {/* SOCIAL MEDIA WIDGET (Instagram) */}
            <div className="card" style={{ padding: '24px', marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                        }}><Instagram size={20} /></div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Social Media Overview</h3>
                            <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>@{profile.username}</p>
                        </div>
                    </div>
                </div>

                {/* Core Metrics */}
                {/* Core Metrics */}
                <div className="grid-metrics" style={{ marginBottom: 24 }}>
                    <MetricCard
                        label="Total Followers"
                        value={metrics.followers || 0}
                        icon={Users}
                        color="#6366f1"
                        chartData={dailyChartData}
                        dataKey="followers"
                        tooltip="Overall number of accounts following you"
                    />
                    <MetricCard
                        label="Engagement Rate"
                        value={`${metrics.engagementRate || 0}%`}
                        icon={Heart}
                        color="#ec4899"
                        chartData={dailyChartData}
                        dataKey="reach"
                        tooltip="Average engagement (likes + comments) divided by followers"
                    />
                    <MetricCard
                        label="Profile Views"
                        value={metrics.totalProfileViews || 0}
                        icon={ExternalLink}
                        color="#ef4444"
                        chartData={dailyChartData}
                        dataKey="reach"
                        tooltip="Account-level profile views returned by Meta for the selected date range"
                    />
                    <MetricCard
                        label="Total Reach"
                        value={metrics.totalReach || 0}
                        icon={Eye}
                        color="#0ea5e9"
                        chartData={dailyChartData}
                        dataKey="reach"
                        tooltip="Total unique accounts that saw your content"
                    />
                    <MetricCard
                        label="Total Saved"
                        value={metrics.totalSaved || 0}
                        icon={Bookmark}
                        color="#10b981"
                        chartData={dailyChartData}
                        dataKey="reach"
                        tooltip="Number of times your content was saved - a high-intent engagement signal"
                    />
                    <MetricCard
                        label="Total Shares"
                        value={metrics.totalShares || 0}
                        icon={TrendingUp}
                        color="#f59e0b"
                        chartData={dailyChartData}
                        dataKey="reach"
                        tooltip="Shares returned from supported media insights, primarily video/reel content"
                    />
                    <MetricCard
                        label="Follower Delta"
                        value={`${metrics.followerDelta >= 0 ? '+' : ''}${metrics.followerDelta || 0}`}
                        icon={metrics.followerDelta >= 0 ? TrendingUp : TrendingDown}
                        color={metrics.followerDelta >= 0 ? '#10b981' : '#ef4444'}
                        chartData={dailyChartData}
                        dataKey="followers"
                        tooltip="Net follower movement across the selected daily insight window"
                    />
                </div>

                                {/* Advanced Performance Metrics */}
                <SectionCard title="Advanced Performance Metrics" subtitle="Calculated from your content data">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>True Follower Growth Rate</span>
                                <InfoTooltip text="(New followers / start followers) x 100 for the selected period." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: (metrics.trueFollowerGrowthRate || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                                {(metrics.trueFollowerGrowthRate || 0) >= 0 ? '+' : ''}{metrics.trueFollowerGrowthRate ?? 0}%
                            </div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Content ROI Score</span>
                                <InfoTooltip text="Total engagement divided by posts published. Higher means more output per post." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>
                                {(metrics.contentRoiScore ?? 0).toLocaleString()}
                            </div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Reach-to-Follower Ratio</span>
                                <InfoTooltip text="Total reach divided by followers. Above 1.0 = content breaking out to non-followers." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: (metrics.reachToFollowerRatio || 0) >= 1 ? '#10b981' : '#f59e0b' }}>
                                {metrics.reachToFollowerRatio ?? 0}x
                            </div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Save Rate</span>
                                <InfoTooltip text="Saves divided by Reach x 100. High save rate signals evergreen content." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>{metrics.saveRate ?? 0}%</div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>Profile Visit Rate</span>
                                <InfoTooltip text="Profile Views divided by Reach x 100. Shows how content drives account discovery." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>
                                {metrics.profileVisitRate ?? profileViewRate}%
                            </div>
                        </div>
                        <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>True Engagement Rate</span>
                                <InfoTooltip text="(Likes + Comments) divided by Reach x 100. More accurate than follower-based rate." />
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#0ea5e9' }}>{trueEngagementRate}%</div>
                        </div>
                    </div>
                </SectionCard>

                {isAudienceFetching && (
                    <SectionCard title="Audience Snapshot" subtitle="Loading secondary audience insights...">
                        <p className="text-muted" style={{ fontSize: 12 }}>Loading audience demographics and follower activity.</p>
                    </SectionCard>
                )}

                {(audienceInsights.topCountry || audienceInsights.topCity || audienceInsights.topGenderAge || audienceInsights.peakFollowerHours?.length > 0) && (
                    <SectionCard title="Audience Snapshot" subtitle="Fast read on where your audience is and when they are active">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Top Country</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{audienceInsights.topCountry?.label || '\u2014'}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{audienceInsights.topCountry?.value?.toLocaleString?.() || 0} followers</div>
                            </div>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Top City</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{audienceInsights.topCity?.label?.split(',')[0] || '\u2014'}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{audienceInsights.topCity?.value?.toLocaleString?.() || 0} followers</div>
                            </div>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Top Demographic</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>
                                    {audienceInsights.topGenderAge ? `${audienceInsights.topGenderAge.gender} ${audienceInsights.topGenderAge.age}` : '\u2014'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{audienceInsights.topGenderAge?.value?.toLocaleString?.() || 0} followers</div>
                            </div>
                            <div style={{ padding: 16, background: 'var(--background)', borderRadius: 8 }}>
                                    <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Peak Follower Hours</div>
                                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                                    {(audienceInsights.peakFollowerHours || []).slice(0, 2).map((item: any) => item.label).join(' \u2022 ') || '\u2014'}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>from follower activity insights</div>
                                </div>
                        </div>
                    </SectionCard>
                )}
                {/* Daily Metrics Chart */}
                {dailyChartData.length > 0 && (
                    <div className="chart-container" style={{ marginBottom: 24 }}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Daily Audience Metrics</h3>
                                <p className="text-muted" style={{ fontSize: 12 }}>Daily follower gains and reach returned by Meta. Views and profile visits are aggregate-only.</p>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={dailyChartData}>
                                <defs>
                                    <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="left" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={60} domain={['auto', 'auto']} />
                                <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={11} tickLine={false} axisLine={false} width={60} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--card-raised)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        fontSize: 13
                                    }}
                                />
                                <Area yAxisId="left" type="monotone" dataKey="followers" name="Followers Gained" stroke="#10b981" strokeWidth={2} fill="url(#followerGrad)" />
                                <Area yAxisId="right" type="monotone" dataKey="reach" name="Reach" stroke="#0ea5e9" strokeWidth={2} fill="none" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Engagement Charts */}
                <div className="grid-charts" style={{ marginBottom: 24 }}>
                    <div className="chart-container">
                        <div className="card-header">
                            <h3 className="card-title">Engagement Trend</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={40} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--card-raised)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        fontSize: 13
                                    }}
                                />
                                <Area type="monotone" dataKey="engagement" stroke="#6366f1" strokeWidth={2} fill="url(#engGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-container">
                        <div className="card-header">
                            <h3 className="card-title">Likes vs Comments</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData}>
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={40} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--card-raised)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        fontSize: 13
                                    }}
                                />
                                <Bar dataKey="likes" fill="#ec4899" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="comments" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Audience Demographics */}
                {(countryData.length > 0 || cityData.length > 0 || genderAgeData.length > 0) && (
                    <SectionCard title="Audience Demographics" subtitle="Where your followers are located and who they are">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
                            {/* Top Countries */}
                            {countryData.length > 0 && (
                                <div style={{ background: 'var(--background-alt)', padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                        <div style={{ background: 'var(--primary-light)', padding: 6, borderRadius: 8 }}>
                                            <Globe size={14} style={{ color: 'var(--primary)' }} />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Top Countries</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {countryData.map((country: any, i: number) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                                                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{country.name}</span>
                                                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--foreground)' }}>{country.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Cities */}
                            {cityData.length > 0 && (
                                <div style={{ background: 'var(--background-alt)', padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                        <div style={{ background: 'var(--info-light)', padding: 6, borderRadius: 8 }}>
                                            <MapPin size={14} style={{ color: 'var(--info)' }} />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Top Cities</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {cityData.map((city: any, i: number) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                                                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{city.name}</span>
                                                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--foreground)' }}>{city.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Gender & Age */}
                            {genderAgeData.length > 0 && (
                                <div style={{ background: 'var(--background-alt)', padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                        <div style={{ background: 'var(--success-light)', padding: 6, borderRadius: 8 }}>
                                            <Users size={14} style={{ color: 'var(--success-dark)' }} />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Gender & Age</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {genderAgeData.map((item: any, i: number) => {
                                            const maxValue = Math.max(...genderAgeData.map((g: any) => g.value));
                                            const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                                            return (
                                                <div key={i}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{item.shortName}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--foreground)' }}>{item.value.toLocaleString()}</span>
                                                    </div>
                                                    <div style={{ height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${percentage}%`,
                                                            background: COLORS[i % COLORS.length],
                                                            borderRadius: 3,
                                                            transition: 'width 0.3s ease'
                                                        }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                )}

                {/* Online Followers */}
                {demographics.onlineFollowers && demographics.onlineFollowers.length > 0 && (
                    <SectionCard title="Best Time to Post" subtitle="Based on when your followers are most active">
                        <OnlineFollowersHeatmap data={demographics.onlineFollowers} />
                    </SectionCard>
                )}

                {/* Recent Posts Table */}
                <div className="card" style={{ padding: '24px' }}>
                    <div className="card-header" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Recent Posts</h3>
                        <span className="badge badge-info" style={{ marginLeft: 12, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{recentPosts.length} posts</span>
                    </div>
                    {recentPosts.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: 0 }}>Post</th>
                                    <th>Likes</th>
                                    <th>Comments</th>
                                    <th style={{ textAlign: 'right', paddingRight: 0 }}>Engagement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentPosts.slice(0, 5).map((post: any, i: number) => (
                                    <PostRow key={post.id || i} post={post} />
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center' }}>
                            <p style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 500 }}>No posts found</p>
                        </div>
                    )}
                </div>

            </div> {/* END SOCIAL MEDIA WIDGET */}

            {/* PAID ADS WIDGETS */}
            {showCrossPlatformWidgets && <MetaAdsWidget />}
            {showCrossPlatformWidgets && <GoogleAdsWidget />}

        </div>
    );
}

