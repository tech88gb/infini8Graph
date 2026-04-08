'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { instagramApi } from '@/lib/api';
import { Download, FileJson, FileText, FileSpreadsheet, FileCode2, FileImage, Check, CalendarRange, Target, BarChart3, X, Sparkles } from 'lucide-react';

type ExportFormat = 'json' | 'csv' | 'tsv' | 'md' | 'html';

const exportFormats: Array<{
    id: ExportFormat;
    label: string;
    description: string;
    icon: ComponentType<{ size?: number; className?: string }>;
}> = [
    { id: 'json', label: 'JSON Bundle', description: 'Complete nested dataset for BI tools and custom analysis.', icon: FileJson },
    { id: 'csv', label: 'CSV Workbook', description: 'Spreadsheet-friendly flat tables for performance marketers.', icon: FileSpreadsheet },
    { id: 'tsv', label: 'TSV Tables', description: 'Excel-safe tab-separated export with less quote cleanup.', icon: FileText },
    { id: 'md', label: 'Markdown Brief', description: 'Readable strategy brief with KPI snapshots and table previews.', icon: FileCode2 },
    { id: 'html', label: 'HTML Report', description: 'Polished report view for sharing with clients or teams.', icon: FileImage },
];

const exportOptions = [
    { id: 'overview', label: 'Overview', description: 'Core profile KPIs, recent post metrics, and account-level summary.' },
    { id: 'growth', label: 'Growth', description: 'Daily growth trend lines and weekly momentum indicators.' },
    { id: 'posts', label: 'Posts', description: 'Flat post-performance table with reach, saves, impressions, and engagement.' },
    { id: 'reels', label: 'Reels', description: 'Video-focused performance rows for reel-led growth analysis.' },
    { id: 'bestTime', label: 'Best Time', description: 'Best posting days and hours for scheduling decisions.' },
    { id: 'hashtags', label: 'Hashtags', description: 'Top performers plus reach-expander hashtag breakdowns.' },
    { id: 'contentIntelligence', label: 'Creative Intelligence', description: 'Format winners, quality scores, and content strategy signals.' },
];

function formatDateForInput(date: Date) {
    return date.toISOString().split('T')[0];
}

function defaultStartDate() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return formatDateForInput(date);
}

function parseFileName(header?: string | null) {
    if (!header) return null;
    const match = header.match(/filename="?([^"]+)"?/i);
    return match?.[1] || null;
}

export default function ExportPage() {
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['overview', 'growth', 'posts', 'contentIntelligence']);
    const [format, setFormat] = useState<ExportFormat>('csv');
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(defaultStartDate());
    const [endDate, setEndDate] = useState(formatDateForInput(new Date()));
    const [status, setStatus] = useState<string | null>(null);
    const [showTip, setShowTip] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const dismissed = window.localStorage.getItem('onboarding-tip:export');
        if (!dismissed) {
            setShowTip(true);
        }
    }, []);

    const dismissTip = () => {
        setShowTip(false);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('onboarding-tip:export', 'dismissed');
        }
    };

    const selectedLabels = useMemo(
        () => exportOptions.filter(option => selectedMetrics.includes(option.id)).map(option => option.label),
        [selectedMetrics]
    );

    const toggleMetric = (id: string) => {
        setSelectedMetrics(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const handleExport = async () => {
        if (selectedMetrics.length === 0 || !startDate || !endDate) return;

        setLoading(true);
        setStatus(null);
        try {
            const response = await instagramApi.exportData(format, selectedMetrics.join(','), startDate, endDate);

            if (format === 'json') {
                const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `infini8graph-export-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const contentType = response.headers['content-type'] || 'text/plain';
                const filename = parseFileName(response.headers['content-disposition']) || `infini8graph-export-${Date.now()}.${format}`;
                const blob = new Blob([response.data], { type: contentType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }

            setStatus(`Export ready: ${selectedLabels.join(', ') || 'No datasets'} (${format.toUpperCase()})`);
        } catch (error) {
            console.error('Export failed:', error);
            setStatus('Export failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-6xl">
            <div>
                <h1 className="text-3xl font-bold mb-2">Export Studio</h1>
                <p className="text-[var(--muted)]">Build performance-marketing exports that are ready for spreadsheets, client decks, and deeper analysis.</p>
            </div>

            {showTip && (
                <div
                    className="card"
                    style={{
                        border: '1px solid rgba(59,130,246,0.22)',
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(14,165,233,0.08))',
                    }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(59,130,246,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Sparkles size={18} className="text-sky-300" />
                            </div>
                            <div>
                                <div className="font-semibold text-white mb-1">Quick start tip</div>
                                <p className="text-sm text-[var(--muted)] leading-6">
                                    Pick `CSV Workbook` when you want spreadsheet-ready reporting, or `HTML Report` when you need a client-facing shareout. The export scope can mix KPI summaries, post tables, and content-intelligence in one run.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={dismissTip}
                            className="btn btn-ghost btn-sm"
                            style={{ flexShrink: 0 }}
                        >
                            <X size={14} />
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
                <div className="card">
                    <div className="flex items-center gap-3 mb-4">
                        <CalendarRange size={20} className="text-[var(--primary)]" />
                        <h3 className="text-lg font-semibold">Export Scope</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium">Start Date</span>
                            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium">End Date</span>
                            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </label>
                    </div>

                    <div className="mt-5 p-4 rounded-2xl border border-[var(--border)] bg-[var(--card-hover)]">
                        <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                            <Target size={16} className="text-[var(--primary)]" />
                            Built for Performance Marketers
                        </div>
                        <p className="text-sm text-[var(--muted)] leading-6">
                            The upgraded export flow now produces flat KPI tables, post-level performance rows, creative insights, hashtag opportunity lists, and readable briefing formats.
                        </p>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3 mb-4">
                        <BarChart3 size={20} className="text-[var(--primary)]" />
                        <h3 className="text-lg font-semibold">What You&apos;ll Get</h3>
                    </div>
                    <div className="space-y-3 text-sm text-[var(--muted)]">
                        <p>Executive KPI summary for quick reporting.</p>
                        <p>Post and reel tables with reach, engagement, impressions, and saves.</p>
                        <p>Best-time and hashtag exports for scheduling and optimization.</p>
                        <p>Creative-intelligence tables for content strategy review.</p>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3 className="text-lg font-semibold mb-4">Export Format</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {exportFormats.map((option) => {
                        const Icon = option.icon;
                        const selected = format === option.id;
                        return (
                            <button
                                key={option.id}
                                onClick={() => setFormat(option.id)}
                                className={`p-4 rounded-2xl border-2 transition-all flex items-start gap-4 text-left ${selected
                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                    : 'border-[var(--border)] hover:border-[var(--muted)]'
                                }`}
                            >
                                <Icon size={28} className={selected ? 'text-[var(--primary)]' : 'text-[var(--muted)]'} />
                                <div>
                                    <div className="font-semibold">{option.label}</div>
                                    <div className="text-sm text-[var(--muted)] leading-6">{option.description}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="card">
                <h3 className="text-lg font-semibold mb-4">Datasets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exportOptions.map(option => {
                        const selected = selectedMetrics.includes(option.id);
                        return (
                            <button
                                key={option.id}
                                onClick={() => toggleMetric(option.id)}
                                className={`p-4 rounded-2xl border-2 transition-all text-left flex items-start gap-4 ${selected
                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                    : 'border-[var(--border)] hover:border-[var(--muted)]'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${selected
                                    ? 'bg-[var(--primary)]'
                                    : 'bg-[var(--border)]'
                                }`}>
                                    {selected && <Check size={16} className="text-white" />}
                                </div>
                                <div>
                                    <div className="font-semibold">{option.label}</div>
                                    <div className="text-sm text-[var(--muted)] leading-6">{option.description}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="card">
                <h3 className="text-lg font-semibold mb-4">Export Preview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <div className="p-4 rounded-2xl bg-[var(--card-hover)] border border-[var(--border)]">
                        <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">Format</div>
                        <div className="font-semibold">{exportFormats.find(item => item.id === format)?.label}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--card-hover)] border border-[var(--border)]">
                        <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">Range</div>
                        <div className="font-semibold">{startDate} {'->'} {endDate}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--card-hover)] border border-[var(--border)]">
                        <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">Datasets</div>
                        <div className="font-semibold">{selectedMetrics.length} selected</div>
                    </div>
                </div>

                <div className="text-sm text-[var(--muted)] leading-6">
                    {selectedLabels.length > 0 ? selectedLabels.join(', ') : 'No datasets selected'}
                </div>
            </div>

            <button
                onClick={handleExport}
                disabled={loading || selectedMetrics.length === 0 || !startDate || !endDate || endDate < startDate}
                className="btn btn-primary w-full py-4 text-lg"
            >
                {loading ? (
                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }}></div>
                ) : (
                    <>
                        <Download size={20} />
                        Export {selectedMetrics.length} Dataset{selectedMetrics.length !== 1 ? 's' : ''} as {format.toUpperCase()}
                    </>
                )}
            </button>

            {status && (
                <div className="card">
                    <p className="text-sm">{status}</p>
                </div>
            )}
        </div>
    );
}
