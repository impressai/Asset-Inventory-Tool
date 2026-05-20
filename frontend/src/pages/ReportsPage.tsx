import React, { useEffect, useRef, useState } from 'react';
import { reportsApi } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
  stock: '#22c55e', assigned: '#3b82f6', faulty: '#ef4444', sold: '#94a3b8',
};
const CATEGORY_COLORS = [
  '#f97316','#8b5cf6','#3b82f6','#22c55e','#ef4444',
  '#06b6d4','#ec4899','#f59e0b','#84cc16','#6366f1',
];

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.10)',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
};

type ReportType = 'all' | 'assigned' | 'stock' | 'warranty_expiring' | 'license_expiring' | 'overdue';

interface ReportAsset {
  id: string; asset_tag: string; name: string; category: string;
  brand?: string; model_number?: string; serial_number?: string;
  status?: string; condition?: string; location?: string;
  purchase_date?: string; warranty_expiry_date?: string;
  expiry_date?: string; license_start_date?: string; notes?: string;
  current_assignee?: string; assignee_email?: string;
  employee_id?: string; designation?: string; department?: string;
  assignment_date?: string; expected_return_date?: string;
  days_overdue?: number; days_left?: number;
}

type Column = { key: keyof ReportAsset | string; label: string; render?: (r: ReportAsset) => React.ReactNode };

const REPORT_TYPES: { value: ReportType; label: string; icon: string }[] = [
  { value: 'all',               label: 'Full Inventory',                icon: '📦' },
  { value: 'assigned',          label: 'Assigned Assets',               icon: '👤' },
  { value: 'stock',             label: 'Assets In Stock',               icon: '🏪' },
  { value: 'warranty_expiring', label: 'Warranty Expiring',             icon: '⚠️' },
  { value: 'license_expiring',  label: 'License / Subscription Expiry', icon: '📋' },
  { value: 'overdue',           label: 'Overdue Returns',               icon: '🔴' },
];

function getColumns(t: ReportType): Column[] {
  const tag:   Column = { key: 'asset_tag',  label: 'Tag' };
  const name:  Column = { key: 'name',       label: 'Asset Name' };
  const cat:   Column = { key: 'category',   label: 'Category' };
  const brand: Column = { key: 'brand',      label: 'Brand' };
  const serial:Column = { key: 'serial_number', label: 'Serial #' };
  const loc:   Column = { key: 'location',   label: 'Location' };
  const pur:   Column = { key: 'purchase_date', label: 'Purchase Date' };
  const status:Column = { key: 'status',     label: 'Status', render: r => r.status ? (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: (STATUS_COLORS[r.status] || '#94a3b8') + '22', color: STATUS_COLORS[r.status] || '#94a3b8' }}>
      {r.status}
    </span>) : '—' };
  const cond:  Column = { key: 'condition',  label: 'Condition' };
  const warr:  Column = { key: 'warranty_expiry_date', label: 'Warranty Expiry' };
  const licExp:Column = { key: 'expiry_date', label: 'License Expiry' };
  const assignee: Column = { key: 'current_assignee', label: 'Assignee' };
  const email: Column = { key: 'assignee_email', label: 'Email' };
  const dept:  Column = { key: 'department', label: 'Department' };
  const aDate: Column = { key: 'assignment_date', label: 'Assigned On' };
  const retDate: Column = { key: 'expected_return_date', label: 'Expected Return' };
  const daysLeft: Column = { key: 'days_left', label: 'Days Left',
    render: r => r.days_left != null ? (
      <span style={{ fontWeight: 700, color: r.days_left < 0 ? '#ef4444' : r.days_left <= 7 ? '#f59e0b' : '#22c55e' }}>
        {r.days_left < 0 ? `${Math.abs(r.days_left)}d ago` : r.days_left === 0 ? 'Today' : `${r.days_left}d`}
      </span>) : '—' };
  const daysOverdue: Column = { key: 'days_overdue', label: 'Days Overdue',
    render: r => r.days_overdue != null ? (
      <span style={{ fontWeight: 700, color: '#ef4444' }}>{r.days_overdue}d</span>) : '—' };

  if (t === 'assigned') return [tag, name, cat, brand, assignee, email, dept, aDate, retDate, status];
  if (t === 'overdue')  return [tag, name, cat, assignee, dept, retDate, daysOverdue, status];
  if (t === 'warranty_expiring') return [tag, name, cat, brand, warr, daysLeft, status, loc];
  if (t === 'license_expiring')  return [tag, name, cat, brand, licExp, daysLeft, status, loc];
  return [tag, name, cat, brand, serial, status, cond, loc, pur, warr, licExp, assignee];
}

function cellVal(col: Column, row: ReportAsset): React.ReactNode {
  if (col.render) return col.render(row);
  const v = (row as any)[col.key];
  return v != null && v !== '' ? String(v) : '—';
}

function exportCSV(assets: ReportAsset[], reportType: ReportType, title: string) {
  const cols = getColumns(reportType);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    cols.map(c => escape(c.label)).join(','),
    ...assets.map(r => cols.map(c => escape((r as any)[c.key])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const s: Record<string, React.CSSProperties> = {
  page:     { fontFamily: 'system-ui, sans-serif' },
  heading:  { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 24 },
  builder:  { ...glass, borderRadius: 14, padding: '22px 24px', marginBottom: 24 },
  bTitle:   { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 },
  label:    { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 },
  select:   { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.8)', boxSizing: 'border-box' as const },
  input:    { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.8)', boxSizing: 'border-box' as const },
  genBtn:   { padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 18 },
  exportBtn:{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.8)', color: '#374151' },
  summary:  { display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 20 },
  statPill: { padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 },
  catHeader:{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28, marginBottom: 10 },
  catDot:   { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  catTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a' },
  catCount: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  table:    { width: '100%', borderCollapse: 'collapse' as const, background: 'rgba(255,255,255,0.85)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 8 },
  th:       { textAlign: 'left' as const, padding: '9px 14px', fontSize: 11, color: '#64748b', background: 'rgba(248,250,252,0.9)', fontWeight: 700, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' as const },
  td:       { padding: '9px 14px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', whiteSpace: 'nowrap' as const },
  noData:   { padding: '40px 24px', textAlign: 'center' as const, color: '#94a3b8', fontSize: 13 },
};

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('all');
  const [category, setCategory]     = useState('');
  const [status, setStatus]         = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [days, setDays]             = useState(30);
  const [groupByCat, setGroupByCat] = useState(true);

  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState<ReportAsset[] | null>(null);
  const [genTitle, setGenTitle]     = useState('');
  const [genType, setGenType]       = useState<ReportType>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reportsApi.summary().then((s: any) => setCategories(Object.keys(s.by_category || {}))).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { report_type: reportType };
      if (category) params.category = category;
      if (status && reportType === 'all') params.status = status;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      if (reportType === 'warranty_expiring' || reportType === 'license_expiring') params.days = days;

      const result = await (reportsApi as any).assets(params);
      setReportData(result.assets);
      setGenType(reportType);

      const typLabel = REPORT_TYPES.find(t => t.value === reportType)?.label || reportType;
      const parts = [typLabel];
      if (category) parts.push(category);
      if (status && reportType === 'all') parts.push(status);
      setGenTitle(parts.join(' — '));
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  };

  /* ── grouped display ── */
  const grouped: Record<string, ReportAsset[]> | null =
    (genType === 'all' || genType === 'stock') && groupByCat && !category && reportData
      ? reportData.reduce((acc, a) => {
          const k = a.category || 'Uncategorized';
          if (!acc[k]) acc[k] = [];
          acc[k].push(a);
          return acc;
        }, {} as Record<string, ReportAsset[]>)
      : null;

  const cols = getColumns(genType);

  /* ── status summary counts ── */
  const statusCounts = reportData
    ? reportData.reduce((acc, a) => { if (a.status) acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {} as Record<string, number>)
    : {};

  const renderTable = (rows: ReportAsset[]) => (
    rows.length === 0
      ? <div style={s.noData}>No data</div>
      : <table style={s.table}>
          <thead>
            <tr>{cols.map(c => <th key={c.key} style={s.th}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id + i}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                {cols.map(c => (
                  <td key={c.key} style={{
                    ...s.td,
                    ...(c.key === 'asset_tag' ? { fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' } : {}),
                  }}>
                    {cellVal(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
  );

  return (
    <div style={s.page}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-area { box-shadow: none !important; }
        }
      `}</style>

      <h2 style={s.heading}>Reports</h2>

      {/* ── Report Builder ── */}
      <div style={s.builder} className="no-print">
        <div style={s.bTitle}>📊 Report Builder</div>
        <div style={s.grid}>
          {/* Report Type */}
          <div>
            <label style={s.label}>Report Type</label>
            <select style={s.select} value={reportType} onChange={e => setReportType(e.target.value as ReportType)}>
              {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>

          {/* Category */}
          {reportType !== 'overdue' && (
            <div>
              <label style={s.label}>Category</label>
              <select style={s.select} value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Status (only for full inventory) */}
          {reportType === 'all' && (
            <div>
              <label style={s.label}>Status</label>
              <select style={s.select} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="stock">In Stock</option>
                <option value="assigned">Assigned</option>
                <option value="faulty">Faulty</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          )}

          {/* Days window for expiry reports */}
          {(reportType === 'warranty_expiring' || reportType === 'license_expiring') && (
            <div>
              <label style={s.label}>Window</label>
              <select style={s.select} value={days} onChange={e => setDays(Number(e.target.value))}>
                <option value={30}>± 30 days</option>
                <option value={60}>± 60 days</option>
                <option value={90}>± 90 days</option>
              </select>
            </div>
          )}

          {/* Purchase date range */}
          {reportType === 'all' && (
            <>
              <div>
                <label style={s.label}>Purchase Date From</label>
                <input style={s.input} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Purchase Date To</label>
                <input style={s.input} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {/* Group by category checkbox */}
        {(reportType === 'all' || reportType === 'stock') && !category && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={groupByCat} onChange={e => setGroupByCat(e.target.checked)} />
            Group by Category
          </label>
        )}

        <button style={s.genBtn} onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating…' : '▶ Generate Report'}
        </button>
      </div>

      {/* ── Report Output ── */}
      {reportData && (
        <div ref={printRef} className="print-area">
          {/* Report header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{genTitle}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                {reportData.length} item{reportData.length !== 1 ? 's' : ''} · Generated {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }} className="no-print">
              <button style={s.exportBtn} onClick={() => exportCSV(reportData, genType, genTitle)}>⬇ Export CSV</button>
              <button style={{ ...s.exportBtn, background: '#0f172a', color: '#fff', border: 'none' }} onClick={() => window.print()}>🖨 Print / PDF</button>
            </div>
          </div>

          {/* Status summary pills */}
          {Object.keys(statusCounts).length > 0 && (
            <div style={s.summary}>
              <span style={{ ...s.statPill, background: '#f1f5f9', color: '#0f172a' }}>
                Total: {reportData.length}
              </span>
              {Object.entries(statusCounts).map(([st, n]) => (
                <span key={st} style={{ ...s.statPill, background: (STATUS_COLORS[st] || '#94a3b8') + '22', color: STATUS_COLORS[st] || '#94a3b8' }}>
                  {st}: {n}
                </span>
              ))}
            </div>
          )}

          {/* ── Grouped by category ── */}
          {grouped ? (
            Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, rows], idx) => {
              const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              const catStatus = rows.reduce((acc, r) => { if (r.status) acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);
              return (
                <div key={cat}>
                  <div style={s.catHeader}>
                    <div style={{ ...s.catDot, background: color }} />
                    <span style={s.catTitle}>{cat}</span>
                    <span style={s.catCount}>
                      {rows.length} asset{rows.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                      {Object.entries(catStatus).map(([st, n]) => `${n} ${st}`).join(', ')}
                    </span>
                  </div>
                  {renderTable(rows)}
                </div>
              );
            })
          ) : (
            reportData.length === 0
              ? <div style={{ ...s.noData, background: 'rgba(255,255,255,0.7)', borderRadius: 10 }}>
                  No data found for the selected filters.
                </div>
              : renderTable(reportData)
          )}
        </div>
      )}
    </div>
  );
}
