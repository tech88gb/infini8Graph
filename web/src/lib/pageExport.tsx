'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

export type SectionExportFormat = 'excel' | 'html';

export type ExportSheet = {
    name: string;
    rows: Array<Array<string | number>>;
};

export type ExportTable = {
    title: string;
    subtitle?: string;
    headers: string[];
    rows: Array<Array<string | number>>;
    sheetName?: string;
};

export function sanitizeFileName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'section-export';
}

export function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

export function formatExportValue(value: unknown) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
}

export function buildTableMarkup(title: string, subtitle: string | undefined, headers: string[], rows: Array<Array<string | number>>) {
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

export function buildExportDocument(title: string, subtitle: string | undefined, sectionMarkup: string, format: SectionExportFormat) {
    const exportLabel = format === 'excel' ? 'Excel export' : 'HTML export';
    const generatedAt = new Date().toLocaleString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --background: #ffffff;
      --muted: #667085;
      --foreground: #101828;
      --primary: #4f46e5;
      --border: #dbe4f0;
      --border-light: #e7edf5;
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
      max-width: 1280px;
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
    .export-section h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .export-section p {
      margin: 6px 0 0;
      font-size: 13px;
      color: var(--muted);
      line-height: 1.5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border-light);
      border-radius: 12px;
      overflow: hidden;
      table-layout: fixed;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      font-size: 13px;
      border-bottom: 1px solid var(--border-light);
      vertical-align: top;
      word-wrap: break-word;
    }
    th {
      background: #f8fafc;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475467;
    }
    tr:nth-child(even) td {
      background: #fcfdff;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .export-shell {
        box-shadow: none;
        border: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <main class="export-shell">
    <header class="export-header">
      <div>
        <h1 class="export-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="export-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <div class="export-meta">
        <div>${escapeHtml(exportLabel)}</div>
        <div>Generated ${escapeHtml(generatedAt)}</div>
      </div>
    </header>
    <section class="export-content">
      ${sectionMarkup}
    </section>
  </main>
</body>
</html>`;
}

export function buildWorkbookBlob(title: string, sheets: ExportSheet[]) {
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
                ...sheet.rows.map((row) => formatExportValue(row[columnIndex]).length),
                12
            );
            return { wch: Math.min(longest + 2, 42) };
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

function flattenRecord(value: unknown, prefix = ''): Record<string, string | number> {
    if (value === null || value === undefined) {
        return prefix ? { [prefix]: '-' } : {};
    }

    if (typeof value !== 'object' || value instanceof Date) {
        return prefix ? { [prefix]: formatExportValue(value) } : { value: formatExportValue(value) };
    }

    if (Array.isArray(value)) {
        if (value.every((item) => item === null || item === undefined || typeof item !== 'object')) {
            return prefix ? { [prefix]: value.map((item) => formatExportValue(item)).join(', ') } : {};
        }
        return prefix ? { [prefix]: `${value.length} items` } : {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string | number>>((acc, [key, nestedValue]) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;

        if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue) && !(nestedValue instanceof Date)) {
            Object.assign(acc, flattenRecord(nestedValue, nextPrefix));
            return acc;
        }

        if (Array.isArray(nestedValue)) {
            if (nestedValue.every((item) => item === null || item === undefined || typeof item !== 'object')) {
                acc[nextPrefix] = nestedValue.map((item) => formatExportValue(item)).join(', ');
            } else {
                acc[nextPrefix] = `${nestedValue.length} items`;
            }
            return acc;
        }

        acc[nextPrefix] = formatExportValue(nestedValue);
        return acc;
    }, {});
}

export function createKeyValueRows(data: Record<string, unknown>) {
    return Object.entries(flattenRecord(data)).map(([key, value]) => [key, value]);
}

export function createRowsFromObjects(records: Array<Record<string, unknown>>) {
    const flattened = records.map((record) => flattenRecord(record));
    const headers = Array.from(new Set(flattened.flatMap((record) => Object.keys(record))));
    const rows = flattened.map((record) => headers.map((header) => record[header] ?? '-'));
    return { headers, rows };
}

export function tablesToMarkup(tables: ExportTable[]) {
    return tables
        .filter((table) => table.rows.length > 0)
        .map((table) => buildTableMarkup(table.title, table.subtitle, table.headers, table.rows))
        .join('');
}

export function tablesToSheets(tables: ExportTable[]) {
    return tables
        .filter((table) => table.rows.length > 0)
        .map((table) => ({
            name: table.sheetName || table.title,
            rows: [table.headers, ...table.rows]
        }));
}

export function appendDatasetTables(tables: ExportTable[], title: string, dataset: unknown, depth = 0) {
    if (dataset === null || dataset === undefined || depth > 3) return;

    if (Array.isArray(dataset)) {
        if (!dataset.length) return;

        if (dataset.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
            const normalized = createRowsFromObjects(dataset as Array<Record<string, unknown>>);
            if (normalized.headers.length && normalized.rows.length) {
                tables.push({
                    title,
                    headers: normalized.headers,
                    rows: normalized.rows,
                    sheetName: title
                });
            }
            return;
        }

        tables.push({
            title,
            headers: ['Index', 'Value'],
            rows: dataset.map((item, index) => [index + 1, formatExportValue(item)]),
            sheetName: title
        });
        return;
    }

    if (typeof dataset === 'object') {
        const record = dataset as Record<string, unknown>;
        const scalarRows = createKeyValueRows(record);

        if (scalarRows.length) {
            tables.push({
                title,
                headers: ['Metric', 'Value'],
                rows: scalarRows,
                sheetName: title
            });
        }

        Object.entries(record).forEach(([key, value]) => {
            if (value && typeof value === 'object') {
                const childTitle = `${title} - ${key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}`;
                appendDatasetTables(tables, childTitle, value, depth + 1);
            }
        });
        return;
    }

    tables.push({
        title,
        headers: ['Metric', 'Value'],
        rows: [['Value', formatExportValue(dataset)]],
        sheetName: title
    });
}

export function PageExportMenu({
    onExport
}: {
    onExport: (format: SectionExportFormat) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<SectionExportFormat | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

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
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setOpen((current) => !current)}
                disabled={!!isExporting}
            >
                <Download size={14} />
                {isExporting ? (isExporting === 'excel' ? 'Exporting Excel' : 'Exporting HTML') : 'Export Page'}
                <ChevronDown size={14} />
            </button>

            {open && (
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 8px)',
                        width: 260,
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.18)',
                        padding: 8,
                        zIndex: 50
                    }}
                >
                    <button
                        type="button"
                        onClick={() => handleExport('excel')}
                        style={{
                            width: '100%',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-start',
                            padding: 12,
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 10,
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: 'inherit'
                        }}
                    >
                        <FileSpreadsheet size={18} style={{ color: '#10b981', marginTop: 2, flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Export page as Excel</div>
                            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>Clean workbook with marketer-friendly tables</div>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleExport('html')}
                        style={{
                            width: '100%',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-start',
                            padding: 12,
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 10,
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: 'inherit'
                        }}
                    >
                        <FileText size={18} style={{ color: '#6366f1', marginTop: 2, flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Export page as HTML</div>
                            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>Shareable report layout with the same structured tables</div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}
