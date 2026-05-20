import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi, notificationsApi, assetsApi, assignmentsApi } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
  stock: '#4ade80', assigned: '#3b82f6', faulty: '#ef4444', sold: '#94a3b8',
};

const CATEGORY_PALETTE = [
  '#f97316', '#8b5cf6', '#3b82f6', '#4ade80', '#ef4444',
  '#06b6d4', '#ec4899', '#f59e0b', '#84cc16', '#6366f1',
];

const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, fontWeight: 600, background: color + '22', color,
});

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
};

const s: Record<string, React.CSSProperties> = {
  heading:    { fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#0f172a' },
  statGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 32 },
  statCard:   { ...glass, borderRadius: 14, padding: '18px 22px', cursor: 'pointer', transition: 'transform 0.15s' },
  statLabel:  { fontSize: 11, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 },
  statValue:  { fontSize: 34, fontWeight: 700, color: '#0f172a', marginTop: 4 },
  chartsRow:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 },
  chartCard:  { ...glass, borderRadius: 14, padding: '24px' },
  chartTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 20 },
  legend:     { display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 16 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1e293b', cursor: 'pointer' },
  legendDot:  { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  section:    { fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 12 },
  catGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 },
  catCard:    { ...glass, borderRadius: 14, padding: '20px', cursor: 'pointer', transition: 'transform 0.15s' },
  catName:    { fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 },
  catTotal:   { fontSize: 11, color: '#64748b', fontWeight: 500 },
  table:      { width: '100%', borderCollapse: 'collapse', ...glass, borderRadius: 12, overflow: 'hidden' },
  th:         { textAlign: 'left', padding: '10px 16px', fontSize: 12, color: '#374151', background: 'rgba(255,255,255,0.3)', fontWeight: 600 },
  td:         { padding: '10px 16px', fontSize: 13, color: '#0f172a', borderTop: '1px solid rgba(0,0,0,0.06)' },
};

/* ── Donut Chart ── */
function DonutChart({ data, colors, size = 120, innerRatio = 0.5, centerLabel, onSliceClick }: {
  data: { label: string; value: number }[];
  colors: string[];
  size?: number;
  innerRatio?: number;
  centerLabel?: string;
  onSliceClick?: (label: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p style={{ fontSize: 12, color: '#94a3b8' }}>No data</p>;

  const cx = size / 2, cy = size / 2, r = size * 0.46, ir = r * innerRatio;
  let angle = -Math.PI / 2;

  const makePath = (startAngle: number, slice: number): string => {
    // SVG cannot draw a full-circle arc with a single A command — split into two halves
    if (slice >= 2 * Math.PI - 0.001) {
      const mid = startAngle + Math.PI;
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
      const xm = cx + r * Math.cos(mid),         ym = cy + r * Math.sin(mid);
      const ix1 = cx + ir * Math.cos(startAngle), iy1 = cy + ir * Math.sin(startAngle);
      const ixm = cx + ir * Math.cos(mid),         iym = cy + ir * Math.sin(mid);
      return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${xm} ${ym} A ${r} ${r} 0 1 1 ${x1} ${y1}
              L ${ix1} ${iy1} A ${ir} ${ir} 0 1 0 ${ixm} ${iym} A ${ir} ${ir} 0 1 0 ${ix1} ${iy1} Z`;
    }
    const endAngle = startAngle + slice;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + ir * Math.cos(startAngle), iy1 = cy + ir * Math.sin(startAngle);
    const ix2 = cx + ir * Math.cos(endAngle),   iy2 = cy + ir * Math.sin(endAngle);
    const large = slice > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        if (d.value === 0) return null;
        const slice = (d.value / total) * 2 * Math.PI;
        const path = makePath(angle, slice);
        angle += slice;
        return (
          <path key={i} d={path} fill={colors[i % colors.length]} opacity={0.88}
            style={{ cursor: onSliceClick ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
            onClick={() => onSliceClick?.(d.label)}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.88')}
          >
            <title>{d.label}: {d.value}</title>
          </path>
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size * 0.16} fontWeight={700} fill="#0f172a">
        {centerLabel ?? total}
      </text>
      <text x={cx} y={cy + size * 0.13} textAnchor="middle" fontSize={size * 0.08} fill="#64748b" fontWeight={600}>
        TOTAL
      </text>
    </svg>
  );
}

/* ── Mini stacked bar ── */
function StackedBar({ data, colors, onClick }: {
  data: { label: string; value: number }[];
  colors: string[];
  onClick?: (label: string) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  let x = 0;
  return (
    <svg width="100%" height={10} style={{ borderRadius: 6, overflow: 'hidden' }}>
      {data.map((d, i) => {
        if (d.value === 0) return null;
        const w = (d.value / total) * 100;
        const rect = <rect key={i} x={`${x}%`} y={0} width={`${w}%`} height={10} fill={colors[i % colors.length]}
          style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={() => onClick?.(d.label)}>
          <title>{d.label}: {d.value}</title>
        </rect>;
        x += w;
        return rect;
      })}
    </svg>
  );
}

/* ── Asset Preview Modal ── */
function AssetPreviewModal({ asset, onClose }: { asset: any; onClose: () => void }) {
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 };
  const valueStyle: React.CSSProperties = { fontSize: 13, color: '#0f172a', fontWeight: 500 };
  const fieldStyle: React.CSSProperties = { marginBottom: 14 };

  const Field = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <div style={fieldStyle}>
        <div style={labelStyle}>{label}</div>
        <div style={valueStyle}>{value}</div>
      </div>
    ) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: 480, maxHeight: '85vh', overflowY: 'auto', padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{asset.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, fontFamily: 'monospace' }}>{asset.asset_tag}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Status + Category */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <span style={{ ...badge(STATUS_COLORS[asset.status] || '#64748b'), fontSize: 12 }}>{asset.status}</span>
          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151' }}>{asset.category}</span>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', marginBottom: 18 }} />

        {/* Asset details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Field label="Brand / Model" value={[asset.brand, asset.model_number].filter(Boolean).join(' ')} />
          <Field label="Serial Number" value={asset.serial_number} />
          <Field label="Location" value={asset.location} />
          <Field label="Department" value={asset.department} />
          <Field label="Purchase Date" value={asset.purchase_date} />
          <Field label="Purchase Price" value={asset.purchase_price != null ? `₹${Number(asset.purchase_price).toLocaleString()}` : null} />
          <Field label="Warranty Expiry" value={asset.warranty_expiry_date} />
          <Field label="License Start" value={(asset as any).license_start_date} />
          <Field label="Expiry / License End" value={asset.expiry_date} />
        </div>

        {/* Current assignment */}
        {asset.current_assignment && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '8px 0 16px' }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Currently Assigned</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Field label="Assignee" value={(asset.current_assignment as any).assignee_name} />
              <Field label="Email" value={(asset.current_assignment as any).assignee_email} />
              <Field label="Employee ID" value={(asset.current_assignment as any).employee_id} />
              <Field label="Designation" value={(asset.current_assignment as any).designation} />
              <Field label="Department" value={(asset.current_assignment as any).department} />
              <Field label="Assigned On" value={(asset.current_assignment as any).assignment_date} />
              <Field label="Expected Return" value={(asset.current_assignment as any).expected_return_date} />
            </div>
          </>
        )}

        {asset.notes && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '8px 0 16px' }} />
            <div style={labelStyle}>Notes</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{asset.notes}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary]         = useState<any>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, Record<string, number>>>({});
  const [warnings, setWarnings]       = useState<any[]>([]);
  const [softwareExpiring, setSoftwareExpiring] = useState<any[]>([]);
  const [overdueAssignments, setOverdueAssignments] = useState<any[]>([]);
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  const navigate = useNavigate();

  const openPreview = (id: string) => {
    Promise.all([
      assetsApi.get(id),
      assignmentsApi.list({ asset_id: id }),
    ]).then(([asset, assignments]) => {
      const active = (assignments as any[]).find((a: any) => a.is_active);
      setPreviewAsset({ ...asset, current_assignment: active ?? null });
    }).catch(() => {});
  };

  useEffect(() => {
    reportsApi.summary().then(setSummary).catch(() => {});
    reportsApi.byCategory().then(setCategoryBreakdown).catch(() => {});
    notificationsApi.warrantyExpiring(30).then((r) => setWarnings(r.assets)).catch(() => {});
    notificationsApi.softwareExpiring(30).then((r) => setSoftwareExpiring(r.assets)).catch(() => {});
    (notificationsApi as any).overdueAssignments().then((r: any) => setOverdueAssignments(r.assignments)).catch(() => {});
  }, []);

  const statusData = summary?.by_status
    ? Object.entries(summary.by_status).map(([label, value]) => ({ label, value: value as number }))
    : [];

  const goStatus   = (v: string) => navigate(`/assets?status=${encodeURIComponent(v)}`);
  const goCategory = (v: string) => navigate(`/assets?category=${encodeURIComponent(v)}`);

  const categoryEntries = (Object.entries(categoryBreakdown) as [string, Record<string, number>][]).sort(
    ([, a], [, b]) => Object.values(b).reduce((s, n) => s + n, 0) - Object.values(a).reduce((s, n) => s + n, 0)
  );

  return (
    <div>
      <h2 style={s.heading}>Dashboard</h2>

      {/* ── Stat cards ── */}
      <div style={s.statGrid}>
        <div style={{ ...s.statCard, cursor: 'default' }}>
          <div style={s.statLabel}>Total Assets</div>
          <div style={s.statValue}>{summary?.total_assets ?? '—'}</div>
        </div>
        {statusData.map(({ label, value }) => (
          <div key={label} style={s.statCard} onClick={() => goStatus(label)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.22)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)'; }}
            title={`View ${label} assets`}
          >
            <div style={s.statLabel}>{label}</div>
            <div style={{ ...s.statValue, color: STATUS_COLORS[label] || '#0f172a' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Overall status donut ── */}
      <div style={s.chartsRow}>
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Assets by Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <DonutChart
              data={statusData}
              colors={statusData.map((d) => STATUS_COLORS[d.label] || '#94a3b8')}
              size={160}
              onSliceClick={goStatus}
            />
            <div style={s.legend}>
              {statusData.map((d, i) => (
                <div key={i} style={s.legendItem} onClick={() => goStatus(d.label)}>
                  <div style={{ ...s.legendDot, background: STATUS_COLORS[d.label] || '#94a3b8' }} />
                  <span>{d.label} <strong>({d.value})</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={s.chartCard}>
          <div style={s.chartTitle}>Category Overview</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
            {categoryEntries.length} categories · click any to filter
          </div>
          {categoryEntries.slice(0, 6).map(([cat, breakdown], i) => {
            const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
            const barData = Object.entries(breakdown).map(([label, value]) => ({ label, value }));
            return (
              <div key={cat} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => goCategory(cat)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{cat}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{total}</span>
                </div>
                <StackedBar data={barData} colors={Object.keys(breakdown).map(k => STATUS_COLORS[k] || '#94a3b8')} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Per-category charts ── */}
      <div style={s.section}>Assets by Category</div>
      <div style={s.catGrid}>
        {categoryEntries.map(([cat, breakdown], idx) => {
          const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
          const donutData = Object.entries(breakdown)
            .filter(([, v]) => v > 0)
            .map(([label, value]) => ({ label, value }));
          const donutColors = donutData.map(d => STATUS_COLORS[d.label] || '#94a3b8');
          return (
            <div key={cat} style={s.catCard}
              onClick={() => goCategory(cat)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.22)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={s.catName}>{cat}</div>
                  <div style={s.catTotal}>{total} asset{total !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length], marginTop: 4 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <DonutChart data={donutData} colors={donutColors} size={90} innerRatio={0.52} onSliceClick={goStatus} />
                <div style={{ flex: 1 }}>
                  {donutData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/assets?category=${encodeURIComponent(cat)}&status=${encodeURIComponent(d.label)}`); }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: donutColors[i] }} />
                        <span style={{ fontSize: 11, color: '#374151' }}>{d.label}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: donutColors[i] }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Overdue assignments ── */}
      {overdueAssignments.length > 0 && (
        <>
          <div style={s.section}>Overdue Returns (past expected return date)</div>
          <table style={{ ...s.table, marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={s.th}>Asset</th>
                <th style={s.th}>Tag</th>
                <th style={s.th}>Assigned To</th>
                <th style={s.th}>Employee ID</th>
                <th style={s.th}>Designation</th>
                <th style={s.th}>Department</th>
                <th style={s.th}>Expected Return</th>
                <th style={s.th}>Overdue By</th>
              </tr>
            </thead>
            <tbody>
              {overdueAssignments.map((a: any) => (
                <tr key={a.assignment_id} style={{ cursor: 'pointer' }} onClick={() => openPreview(a.asset_id)}>
                  <td style={s.td}>{a.asset_name}</td>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontWeight: 600 }}>{a.asset_tag}</td>
                  <td style={s.td}>{a.assignee_name || '—'}</td>
                  <td style={{ ...s.td, fontSize: 12 }}>{a.employee_id || '—'}</td>
                  <td style={{ ...s.td, fontSize: 12 }}>{a.designation || '—'}</td>
                  <td style={{ ...s.td, fontSize: 12 }}>{a.department || '—'}</td>
                  <td style={{ ...s.td, color: '#ef4444', fontWeight: 600 }}>{a.expected_return_date}</td>
                  <td style={s.td}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#ef4444' }}>
                      {a.days_overdue}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Software / license expiry warnings ── */}
      {softwareExpiring.length > 0 && (
        <>
          <div style={s.section}>🔔 License / Subscription Expiring Soon (next 30 days)</div>
          <table style={{ ...s.table, marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={s.th}>Tag</th><th style={s.th}>Asset Name</th>
                <th style={s.th}>Category</th><th style={s.th}>Expiry Date</th>
                <th style={s.th}>Days Left</th><th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {softwareExpiring.map((a: any) => {
                const daysLeft = Math.ceil((new Date(a.expiry_date).getTime() - Date.now()) / 86400000);
                const urgentColor = daysLeft <= 7 ? '#ef4444' : daysLeft <= 14 ? '#f59e0b' : '#3b82f6';
                return (
                  <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openPreview(a.id)}>
                    <td style={s.td}>{a.asset_tag}</td>
                    <td style={s.td}>{a.name}</td>
                    <td style={s.td}>{a.category}</td>
                    <td style={{ ...s.td, fontWeight: 600, color: urgentColor }}>{a.expiry_date}</td>
                    <td style={s.td}><span style={badge(urgentColor)}>{daysLeft}d</span></td>
                    <td style={s.td}><span style={badge(STATUS_COLORS[a.status] || '#64748b')}>{a.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* ── Warranty warnings ── */}
      {warnings.length > 0 && (
        <>
          <div style={s.section}>⚠ Warranty Expiring Soon (next 30 days)</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Tag</th><th style={s.th}>Asset Name</th>
                <th style={s.th}>Warranty Expiry</th><th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((a: any) => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openPreview(a.id)}>
                  <td style={s.td}>{a.asset_tag}</td>
                  <td style={s.td}>{a.name}</td>
                  <td style={s.td}>{a.warranty_expiry_date}</td>
                  <td style={s.td}><span style={badge(STATUS_COLORS[a.status] || '#64748b')}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {previewAsset && <AssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />}
    </div>
  );
}
