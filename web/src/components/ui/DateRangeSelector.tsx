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
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 16px',
                    background: open
                        ? 'rgba(99,102,241,0.15)'
                        : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${open ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    color: 'var(--foreground)',
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    backdropFilter: 'blur(8px)',
                }}
            >
                <Calendar size={15} style={{ color: 'rgba(99,102,241,0.9)', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>{formatDisplay(dateRange.startDate)}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>→</span>
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>{formatDisplay(dateRange.endDate)}</span>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 1000,
                    background: '#13141f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
                    width: 320,
                    overflow: 'hidden',
                    animation: 'fadeInDown 0.15s ease',
                }}>
                    {/* Preset chips */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        padding: '14px 16px 10px',
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                    }}>
                        {PRESETS.map(p => (
                            <button
                                key={p.label}
                                onClick={() => applyPreset(p.days)}
                                style={{
                                    padding: '5px 11px',
                                    borderRadius: 20,
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    background: 'rgba(255,255,255,0.04)',
                                    color: 'rgba(255,255,255,0.8)',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => {
                                    (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.25)';
                                    (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.5)';
                                    (e.target as HTMLElement).style.color = 'white';
                                }}
                                onMouseLeave={e => {
                                    (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                                    (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                                    (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.8)';
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
                        padding: '14px 16px 0',
                    }}>
                        <button onClick={prevMonth} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.6)', padding:4, borderRadius:6, display:'flex', alignItems:'center' }}>
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <button
                            onClick={nextMonth}
                            disabled={!canGoNext}
                            style={{ background:'none', border:'none', cursor: canGoNext ? 'pointer' : 'default', color: canGoNext ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)', padding:4, borderRadius:6, display:'flex', alignItems:'center' }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Day labels */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, padding:'10px 16px 4px' }}>
                        {DAYS.map(d => (
                            <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.3)', padding:'4px 0' }}>{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, padding:'0 16px 16px' }}>
                        {cells.map((iso, i) => {
                            if (!iso) return <div key={`empty-${i}`} />;
                            const isFuture = iso > isoToday;
                            const isInRange = iso >= rangeStart && iso <= rangeEnd;
                            const isStart = iso === tempStart;
                            const isEnd = iso === (selecting === 'end' ? (hoveredDate ?? tempEnd) : tempEnd);
                            const isEdge = isStart || isEnd;
                            const isToday = iso === isoToday;

                            let bg = 'transparent';
                            let color = isFuture ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.75)';

                            if (!isFuture && isInRange) bg = 'rgba(99,102,241,0.15)';
                            if (!isFuture && isEdge) { bg = '#6366f1'; color = 'white'; }

                            return (
                                <div
                                    key={iso}
                                    onClick={() => !isFuture && handleDayClick(iso)}
                                    onMouseEnter={() => selecting === 'end' && !isFuture && setHoveredDate(iso)}
                                    onMouseLeave={() => setHoveredDate(null)}
                                    style={{
                                        textAlign: 'center',
                                        padding: '6px 0',
                                        borderRadius: 8,
                                        fontSize: 12,
                                        fontWeight: isEdge ? 700 : isToday ? 600 : 400,
                                        background: bg,
                                        color,
                                        cursor: isFuture ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.1s',
                                        userSelect: 'none',
                                        outline: isToday && !isEdge ? '1px solid rgba(99,102,241,0.4)' : 'none',
                                    }}
                                >
                                    {parseInt(iso.split('-')[2])}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer instruction */}
                    <div style={{
                        padding: '10px 16px 14px',
                        borderTop: '1px solid rgba(255,255,255,0.07)',
                        textAlign: 'center',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.35)',
                    }}>
                        {selecting === 'start'
                            ? '📅 Click to set start date'
                            : '📅 Click to set end date — or pick a preset above'}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
