import React from 'react';
import { Clock } from 'lucide-react';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangeSelectorProps {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

export function DateRangeSelector({ dateRange, setDateRange }: DateRangeSelectorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--background)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
        <Clock size={14} style={{ color: 'var(--muted)' }} />
        <input 
            type="date" 
            value={dateRange.startDate} 
            onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
            style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', fontSize: 13, outline: 'none' }}
        />
        <span style={{ color: 'var(--muted)' }}>-</span>
        <input 
            type="date" 
            value={dateRange.endDate} 
            onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
            style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', fontSize: 13, outline: 'none' }}
        />
    </div>
  );
}
