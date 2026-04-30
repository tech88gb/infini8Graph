'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRange {
    startDate: string;
    endDate: string;
}

interface DateRangeSelectorProps {
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const PRESETS = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: 1 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 14 days', days: 14 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
];

function toLocalYMD(date: Date): string {
    return date.toLocaleDateString('en-CA'); // "YYYY-MM-DD"
}

function formatDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d} ${MONTHS[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
}

export function DateRangeSelector({ dateRange, setDateRange }: DateRangeSelectorProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [open, setOpen] = useState(false);
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [selecting, setSelecting] = useState<'start' | 'end'>('start');
    const [tempStart, setTempStart] = useState<string>(dateRange.startDate);
    const [tempEnd, setTempEnd] = useState<string>(dateRange.endDate);

    // Calendar month view
    const [viewYear, setViewYear] = useState(() => {
        const d = new Date(dateRange.endDate);
        return d.getFullYear();
    });
    const [viewMonth, setViewMonth] = useState(() => {
        const d = new Date(dateRange.endDate);
        return d.getMonth();
    });

    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setOpen(false);
                // Reset temp to committed values
                setTempStart(dateRange.startDate);
                setTempEnd(dateRange.endDate);
                setSelecting('start');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, dateRange]);

    const applyRange = useCallback((start: string, end: string) => {
        const s = start <= end ? start : end;
        const e = start <= end ? end : start;
        setDateRange({ startDate: s, endDate: e });
        setTempStart(s);
        setTempEnd(e);
        setOpen(false);
        setSelecting('start');
    }, [setDateRange]);

    const handleDayClick = (iso: string) => {
        if (iso > toLocalYMD(today)) return; // block future
        if (selecting === 'start') {
            setTempStart(iso);
            setTempEnd(iso);
            setSelecting('end');
        } else {
            applyRange(tempStart, iso);
        }
    };

    const applyPreset = (days: number) => {
        const end = new Date(today);
        const start = new Date(today);
        if (days === 0) {
            // Today only
        } else if (days === 1) {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
        } else {
            start.setDate(start.getDate() - (days - 1));
        }
        applyRange(toLocalYMD(start), toLocalYMD(end));
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        // Don't allow navigating to future months
        const nextMon = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
        if (nextYear > today.getFullYear() || (nextYear === today.getFullYear() && nextMon > today.getMonth())) return;
        setViewMonth(nextMon);
        setViewYear(nextYear);
    };

    const canGoNext = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

    // Build calendar cells
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const cells: (string | null)[] = [...Array(firstDay).fill(null)];
    for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(viewMonth + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        cells.push(`${viewYear}-${mm}-${dd}`);
    }

    const effectiveEnd = selecting === 'end' ? (hoveredDate ?? tempEnd) : tempEnd;
    const rangeStart = tempStart <= effectiveEnd ? tempStart : effectiveEnd;
    const rangeEnd = tempStart <= effectiveEnd ? effectiveEnd : tempStart;

    const isoToday = toLocalYMD(today);

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
            {/* Trigger button */}
            <button
                onClick={() => setOpen(o => !o)}
                className="btn btn-secondary"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 13,
                    fontWeight: 700,
                    background: 'white',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                <Calendar size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ color: 'var(--foreground)' }}>{formatDisplay(dateRange.startDate)}</span>
                <span style={{ color: 'var(--muted)', opacity: 0.5 }}>→</span>
                <span style={{ color: 'var(--foreground)' }}>{formatDisplay(dateRange.endDate)}</span>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    zIndex: 1000,
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-xl)',
                    width: 320,
                    overflow: 'hidden',
                    animation: 'fadeInDown 0.2s ease',
                }}>
                    {/* Preset chips */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        padding: '16px',
                        background: 'var(--background-alt)',
                        borderBottom: '1px solid var(--border)',
                    }}>
                        {PRESETS.map(p => (
                            <button
                                key={p.label}
                                onClick={() => applyPreset(p.days)}
                                className="btn btn-sm"
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: 20,
                                    border: '1px solid var(--border)',
                                    background: 'white',
                                    color: 'var(--muted)',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    boxShadow: 'var(--shadow-xs)'
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Calendar header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 16px 8px',
                    }}>
                        <button onClick={prevMonth} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:6, borderRadius:8 }}>
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <button
                            onClick={nextMonth}
                            disabled={!canGoNext}
                            style={{ background:'none', border:'none', cursor: canGoNext ? 'pointer' : 'default', color: canGoNext ? 'var(--muted)' : 'var(--border)', padding:6, borderRadius:8 }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Day labels */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, padding:'0 16px' }}>
                        {DAYS.map(d => (
                            <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'var(--muted)', opacity: 0.4, padding:'8px 0' }}>{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, padding:'0 16px 16px' }}>
                        {cells.map((iso, i) => {
                            if (!iso) return <div key={`empty-${i}`} />;
                            const isFuture = iso > isoToday;
                            const isInRange = iso >= rangeStart && iso <= rangeEnd;
                            const isStart = iso === tempStart;
                            const isEnd = iso === (selecting === 'end' ? (hoveredDate ?? tempEnd) : tempEnd);
                            const isEdge = isStart || isEnd;
                            const isToday = iso === isoToday;

                            let bg = 'transparent';
                            let color = isFuture ? 'var(--border)' : 'var(--foreground)';

                            if (!isFuture && isInRange) bg = 'var(--primary-light)';
                            if (!isFuture && isEdge) { bg = 'var(--primary)'; color = 'white'; }

                            return (
                                <div
                                    key={iso}
                                    onClick={() => !isFuture && handleDayClick(iso)}
                                    onMouseEnter={() => selecting === 'end' && !isFuture && setHoveredDate(iso)}
                                    onMouseLeave={() => setHoveredDate(null)}
                                    style={{
                                        textAlign: 'center',
                                        padding: '8px 0',
                                        borderRadius: 8,
                                        fontSize: 12,
                                        fontWeight: isEdge ? 800 : isToday ? 800 : 500,
                                        background: bg,
                                        color,
                                        cursor: isFuture ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.1s',
                                        userSelect: 'none',
                                        border: isToday && !isEdge ? '1px solid var(--primary-200)' : 'none',
                                    }}
                                >
                                    {parseInt(iso.split('-')[2])}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer instruction */}
                    <div style={{
                        padding: '12px 16px',
                        background: 'var(--background-alt)',
                        borderTop: '1px solid var(--border)',
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--muted)',
                    }}>
                        {selecting === 'start'
                            ? '📅 Set start date'
                            : '📅 Set end date'}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
