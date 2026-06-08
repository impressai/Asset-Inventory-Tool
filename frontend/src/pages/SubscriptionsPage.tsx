import React, { useEffect, useState, useMemo } from 'react';
import { subscriptionsApi, Subscription, extractApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';

const BILLING_CYCLES = ['monthly', 'quarterly', 'annually', 'one-time'];
const STATUSES       = ['active', 'expired', 'cancelled', 'paused'];
const CATEGORIES     = ['Productivity', 'Design', 'Security', 'Communication', 'Development', 'Analytics', 'HR', 'Finance', 'Cloud', 'Other'];

function daysUntil(d?: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function daysColor(n: number | null): string {
  if (n === null) return '#94a3b8';
  if (n <= 0)   return '#ef4444';
  if (n <= 14)  return '#ef4444';
  if (n <= 30)  return '#f59e0b';
  return '#22c55e';
}

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    active:    { background: '#dcfce7', color: '#16a34a' },
    expired:   { background: '#fee2e2', color: '#dc2626' },
    cancelled: { background: '#f1f5f9', color: '#64748b' },
    paused:    { background: '#fef9c3', color: '#92400e' },
  };
  return map[status] || map.cancelled;
}

const fmtCost = (n?: number | null) =>
  n != null ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';

/** Returns available licenses, computing it from num_licenses - licenses_used if the server didn't send it */
function getAvailable(sub: Subscription): number | null {
  if (sub.num_licenses == null) return null;
  if (sub.licenses_available != null) return sub.licenses_available;
  return Math.max(0, sub.num_licenses - (sub.licenses_used ?? 0));
}

/** Usage bar colours: green → amber → red */
function usageColor(pct: number) {
  if (pct >= 100) return '#ef4444';
  if (pct >= 80)  return '#f59e0b';
  return '#22c55e';
}

// ─── License usage bar ───────────────────────────────────────────────────────
function LicenseBar({ sub }: { sub: Subscription }) {
  if (sub.num_licenses == null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const used      = sub.licenses_used ?? 0;
  const total     = sub.num_licenses;
  const available = Math.max(0, total - used);
  const pct       = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const color     = usageColor(pct);

  return (
    <div style={{ minWidth: 100 }}>
      {/* numbers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ fontWeight: 700, color: '#0f172a' }}>{available} left</span>
        <span style={{ color: '#94a3b8' }}>{used}/{total}</span>
      </div>
      {/* bar */}
      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

const EMPTY: Partial<Subscription> = {
  name: '', vendor: '', category: '', plan_name: '', num_licenses: undefined,
  licenses_used: 0, cost_per_license: undefined, billing_cycle: 'annually',
  total_cost: undefined, start_date: '', renewal_date: '', auto_renew: false, status: 'active', notes: '',
};

export default function SubscriptionsPage() {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'SUBSCRIPTION_MANAGER';

  const [items, setItems]     = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCat, setFilterCat]     = useState('');

  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Subscription | null>(null);
  const [form, setForm]             = useState<Partial<Subscription>>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [modalError, setModalError] = useState('');
  const [totalCostManual, setTotalCostManual] = useState(false);

  const [selected, setSelected]     = useState<Subscription | null>(null);
  const [deleting, setDeleting]     = useState(false);

  // license issue/return controls
  const [licenseCount, setLicenseCount] = useState(1);
  const [licenseOp, setLicenseOp]       = useState<'idle' | 'issuing' | 'returning'>('idle');
  const [licenseError, setLicenseError] = useState('');

  const load = () => {
    setLoading(true);
    subscriptionsApi.list()
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => { setError('Failed to load subscriptions'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterCat && s.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(s.name.toLowerCase().includes(q) || (s.vendor || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q))) return false;
    }
    return true;
  }), [items, search, filterStatus, filterCat]);

  const stats = useMemo(() => {
    const active         = items.filter(s => s.status === 'active');
    const totalLicenses  = active.reduce((sum, s) => sum + (s.num_licenses || 0), 0);
    const usedLicenses   = active.reduce((sum, s) => sum + (s.licenses_used || 0), 0);
    const availLicenses  = active.reduce((sum, s) => sum + (getAvailable(s) ?? 0), 0);
    const totalCost      = active.reduce((sum, s) => sum + (s.total_cost ?? (s.num_licenses && s.cost_per_license ? s.num_licenses * s.cost_per_license : 0)), 0);
    const expiringSoon   = active.filter(s => { const d = daysUntil(s.renewal_date); return d !== null && d >= 0 && d <= 30; }).length;
    return { total: items.length, active: active.length, totalLicenses, usedLicenses, availLicenses, totalCost, expiringSoon };
  }, [items]);

  const openAdd  = () => { setEditing(null); setForm({ ...EMPTY }); setModalError(''); setTotalCostManual(false); setShowModal(true); };
  const openEdit = (s: Subscription) => { setEditing(s); setForm({ ...s }); setModalError(''); setTotalCostManual(false); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name?.trim()) { setModalError('Name is required'); return; }
    setSaving(true); setModalError('');
    try {
      const payload = { ...form };
      if (!payload.start_date)   delete payload.start_date;
      if (!payload.renewal_date) delete payload.renewal_date;
      if (!payload.vendor)       payload.vendor = undefined;
      if (!payload.category)     payload.category = undefined;
      if (!payload.plan_name)    payload.plan_name = undefined;
      if (!payload.notes)        payload.notes = undefined;

      if (editing) {
        const updated = await subscriptionsApi.update(editing.id, payload);
        setItems(prev => prev.map(s => s.id === updated.id ? updated : s));
        setSelected(updated);
      } else {
        const created = await subscriptionsApi.create(payload);
        setItems(prev => [created, ...prev]);
      }
      setShowModal(false);
    } catch (e: any) {
      setModalError(extractApiError(e));
    }
    setSaving(false);
  };

  const handleDelete = async (s: Subscription) => {
    if (!window.confirm(`Delete subscription "${s.name}"?`)) return;
    setDeleting(true);
    try {
      await subscriptionsApi.delete(s.id);
      setItems(prev => prev.filter(i => i.id !== s.id));
      setSelected(null);
    } catch {}
    setDeleting(false);
  };

  const handleIssueLicenses = async () => {
    if (!selected || licenseCount < 1) return;
    setLicenseOp('issuing'); setLicenseError('');
    try {
      const updated = await subscriptionsApi.issueLicenses(selected.id, licenseCount);
      setItems(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSelected(updated);
      setLicenseCount(1);
    } catch (e: any) {
      setLicenseError(extractApiError(e, 'Failed to issue licenses'));
    }
    setLicenseOp('idle');
  };

  const handleReturnLicenses = async () => {
    if (!selected || licenseCount < 1) return;
    setLicenseOp('returning'); setLicenseError('');
    try {
      const updated = await subscriptionsApi.returnLicenses(selected.id, licenseCount);
      setItems(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSelected(updated);
      setLicenseCount(1);
    } catch (e: any) {
      setLicenseError(extractApiError(e, 'Failed to return licenses'));
    }
    setLicenseOp('idle');
  };

  const f = (k: keyof Subscription, v: any) => setForm(prev => {
    const next = { ...prev, [k]: v };
    if (k === 'num_licenses' || k === 'cost_per_license') {
      const licenses = k === 'num_licenses' ? v : prev.num_licenses;
      const cost     = k === 'cost_per_license' ? v : prev.cost_per_license;
      if (licenses && cost) { next.total_cost = Math.round(licenses * cost * 100) / 100; setTotalCostManual(false); }
    }
    return next;
  });

  const s: Record<string, React.CSSProperties> = {
    page:     { maxWidth: 1200, margin: '0 auto' },
    header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title:    { fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 },
    addBtn:   { padding: '9px 20px', background: 'linear-gradient(135deg,#ea580c,#f97316)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 },
    card:     { background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid rgba(255,255,255,0.6)' },
    cardVal:  { fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 },
    cardLbl:  { fontSize: 12, color: '#64748b', marginTop: 3 },
    filters:  { display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' as const },
    input:    { padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.8)' },
    table:    { width: '100%', borderCollapse: 'collapse' as const, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
    th:       { padding: '11px 14px', textAlign: 'left' as const, fontSize: 12, fontWeight: 700, color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' as const },
    td:       { padding: '11px 14px', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' as const },
    badge:    { display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
    detailPanel: { position: 'fixed' as const, top: 0, right: 0, width: 380, height: '100vh', background: '#fff', boxShadow: '-4px 0 32px rgba(0,0,0,0.13)', zIndex: 500, display: 'flex', flexDirection: 'column' as const, overflowY: 'auto' as const },
    detailHeader: { background: 'linear-gradient(135deg,#1e293b,#0f172a)', padding: '20px 22px', color: '#fff', flexShrink: 0 },
    overlay:  { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 499 },
    modal:    { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600 },
    modalBox: { background: '#fff', borderRadius: 14, width: 540, maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 8px 48px rgba(0,0,0,0.22)' },
    mHead:    { background: 'linear-gradient(135deg,#1e293b,#0f172a)', borderRadius: '14px 14px 0 0', padding: '18px 22px', color: '#fff' },
    mBody:    { padding: '22px 22px' },
    label:    { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' },
    fInput:   { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' as const },
    fRow:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
    fFull:    { marginBottom: 14 },
    sectionTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.6, color: '#94a3b8', marginBottom: 10 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Subscriptions</h1>
        {canEdit && <button style={s.addBtn} onClick={openAdd}>+ Add Subscription</button>}
      </div>

      {/* ── Stats ── */}
      <div style={s.statsRow}>
        <div style={s.card}>
          <div style={s.cardVal}>{stats.total}</div>
          <div style={s.cardLbl}>Total</div>
        </div>
        <div style={s.card}>
          <div style={{ ...s.cardVal, color: '#16a34a' }}>{stats.active}</div>
          <div style={s.cardLbl}>Active</div>
        </div>
        {/* License availability card */}
        <div style={{ ...s.card, border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...s.cardVal, color: '#16a34a' }}>{stats.availLicenses.toLocaleString()}</div>
              <div style={s.cardLbl}>Available Licenses</div>
            </div>
            <div style={{ textAlign: 'right' as const }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{stats.usedLicenses.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>in use</div>
            </div>
          </div>
          {stats.totalLicenses > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2 }}>
                <div style={{
                  width: `${Math.min(100, stats.usedLicenses / stats.totalLicenses * 100)}%`,
                  height: '100%',
                  background: usageColor(stats.usedLicenses / stats.totalLicenses * 100),
                  borderRadius: 2, transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                {stats.totalLicenses.toLocaleString()} total
              </div>
            </div>
          )}
        </div>
        <div style={s.card}>
          <div style={s.cardVal}>{fmtCost(stats.totalCost)}</div>
          <div style={s.cardLbl}>Total Cost (active)</div>
        </div>
        <div style={s.card}>
          <div style={{ ...s.cardVal, color: stats.expiringSoon > 0 ? '#f59e0b' : '#0f172a' }}>{stats.expiringSoon}</div>
          <div style={s.cardLbl}>Expiring in 30 days</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={s.filters}>
        <input style={{ ...s.input, width: 220 }} placeholder="Search name, vendor…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={s.input} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
        </select>
        <select style={s.input} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || filterStatus || filterCat) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterCat(''); }}
            style={{ ...s.input, cursor: 'pointer', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca' }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#ef4444' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', background: 'rgba(255,255,255,0.7)', borderRadius: 12 }}>
          No subscriptions found.{canEdit && <> <button style={{ color: '#ea580c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }} onClick={openAdd}>Add one</button></>}
        </div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Name</th>
              <th style={s.th}>Vendor</th>
              <th style={s.th}>Category</th>
              <th style={s.th}>License Usage</th>
              <th style={s.th}>Cost/License</th>
              <th style={s.th}>Total Cost</th>
              <th style={s.th}>Billing</th>
              <th style={s.th}>Renewal Date</th>
              <th style={s.th}>Days Left</th>
              <th style={s.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(sub => {
              const days = daysUntil(sub.renewal_date);
              const computedTotal = sub.total_cost ?? (sub.num_licenses && sub.cost_per_license ? sub.num_licenses * sub.cost_per_license : null);
              return (
                <tr key={sub.id}
                  onClick={() => { setSelected(selected?.id === sub.id ? null : sub); setLicenseCount(1); setLicenseError(''); }}
                  style={{ cursor: 'pointer', background: selected?.id === sub.id ? '#fff7ed' : 'transparent' }}
                  onMouseEnter={e => { if (selected?.id !== sub.id) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (selected?.id !== sub.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ ...s.td, fontWeight: 600 }}>
                    {sub.name}
                    {sub.plan_name && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{sub.plan_name}</span>}
                  </td>
                  <td style={s.td}>{sub.vendor || '—'}</td>
                  <td style={s.td}>{sub.category || '—'}</td>
                  <td style={{ ...s.td, minWidth: 130 }}>
                    <LicenseBar sub={sub} />
                  </td>
                  <td style={s.td}>{sub.cost_per_license != null ? fmtCost(sub.cost_per_license) : '—'}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{fmtCost(computedTotal)}</td>
                  <td style={s.td}>{sub.billing_cycle || '—'}</td>
                  <td style={s.td}>{sub.renewal_date || '—'}</td>
                  <td style={s.td}>
                    {days !== null ? (
                      <span style={{ color: daysColor(days), fontWeight: 700, fontSize: 12 }}>
                        {days < 0 ? `${-days}d ago` : days === 0 ? 'Today' : `${days}d`}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...statusBadge(sub.status) }}>
                      {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── Detail Panel ── */}
      {selected && (
        <>
          <div style={s.overlay} onClick={() => setSelected(null)} />
          <div style={s.detailPanel}>
            <div style={s.detailHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}</div>
                  {selected.plan_name && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{selected.plan_name}</div>}
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', padding: 0 }}>✕</button>
              </div>
              <span style={{ ...s.badge, ...statusBadge(selected.status), marginTop: 8, display: 'inline-block' }}>
                {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
              </span>
            </div>

            <div style={{ padding: '20px 22px', flex: 1 }}>

              {/* ── License Tracking ── */}
              {selected.num_licenses != null && (
                <div style={{ marginBottom: 20 }}>
                  <div style={s.sectionTitle}>License Usage</div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                    {/* Metrics row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                      {[
                        { label: 'Total',     value: selected.num_licenses,                 color: '#0f172a' },
                        { label: 'In Use',    value: selected.licenses_used ?? 0,           color: '#f59e0b' },
                        { label: 'Available', value: getAvailable(selected) ?? 0,           color: '#16a34a' },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign: 'center' as const, background: '#fff', borderRadius: 8, padding: '8px 6px', border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    {(() => {
                      const used  = selected.licenses_used ?? 0;
                      const total = selected.num_licenses!;
                      const pct   = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                      return (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: usageColor(pct), borderRadius: 4, transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                            {pct.toFixed(0)}% in use
                          </div>
                        </div>
                      );
                    })()}

                    {/* Issue / Return controls */}
                    {canEdit && (
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="number" min={1}
                            max={selected.num_licenses ?? undefined}
                            value={licenseCount}
                            onChange={e => setLicenseCount(Math.max(1, parseInt(e.target.value) || 1))}
                            style={{ width: 60, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, textAlign: 'center' as const }}
                          />
                          <button
                            onClick={handleIssueLicenses}
                            disabled={licenseOp !== 'idle' || (getAvailable(selected) ?? 0) < licenseCount}
                            style={{
                              flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none',
                              background: (getAvailable(selected) ?? 0) >= licenseCount ? '#0f172a' : '#e2e8f0',
                              color: (getAvailable(selected) ?? 0) >= licenseCount ? '#fff' : '#94a3b8',
                              fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {licenseOp === 'issuing' ? '…' : '↑ Issue'}
                          </button>
                          <button
                            onClick={handleReturnLicenses}
                            disabled={licenseOp !== 'idle' || (selected.licenses_used ?? 0) < licenseCount}
                            style={{
                              flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none',
                              background: (selected.licenses_used ?? 0) >= licenseCount ? '#dcfce7' : '#e2e8f0',
                              color: (selected.licenses_used ?? 0) >= licenseCount ? '#16a34a' : '#94a3b8',
                              fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {licenseOp === 'returning' ? '…' : '↓ Return'}
                          </button>
                        </div>
                        {licenseError && (
                          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>{licenseError}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Cost metrics ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Cost / License', value: selected.cost_per_license != null ? fmtCost(selected.cost_per_license) : '—' },
                  { label: 'Total Cost',     value: fmtCost(selected.total_cost ?? (selected.num_licenses && selected.cost_per_license ? selected.num_licenses * selected.cost_per_license : null)) },
                  { label: 'Billing Cycle',  value: selected.billing_cycle || '—' },
                  { label: 'Auto-renew',     value: selected.auto_renew ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{String(value)}</div>
                  </div>
                ))}
              </div>

              {/* ── Dates ── */}
              <div style={{ marginBottom: 18 }}>
                <div style={s.sectionTitle}>Dates</div>
                {[
                  { label: 'Start Date',    value: selected.start_date },
                  { label: 'Renewal Date',  value: selected.renewal_date },
                ].map(({ label, value }) => {
                  const days = label === 'Renewal Date' ? daysUntil(value) : null;
                  return (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{value || '—'}</span>
                        {days !== null && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: daysColor(days) }}>
                            {days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : `in ${days}d`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Details ── */}
              <div style={{ marginBottom: 18 }}>
                <div style={s.sectionTitle}>Details</div>
                {[
                  { label: 'Vendor',   value: selected.vendor },
                  { label: 'Category', value: selected.category },
                ].map(({ label, value }) => value ? (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
                    <span style={{ fontSize: 13 }}>{value}</span>
                  </div>
                ) : null)}
              </div>

              {selected.notes && (
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' as const }}>{selected.notes}</div>
                </div>
              )}

              {canEdit && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => openEdit(selected)} style={{ flex: 1, padding: '9px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(selected)} disabled={deleting} style={{ padding: '9px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {deleting ? '…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={s.mHead}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{editing ? 'Edit Subscription' : 'Add Subscription'}</div>
            </div>
            <div style={s.mBody}>
              {modalError && <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14 }}>{modalError}</div>}

              <div style={s.fFull}>
                <label style={s.label}>Subscription Name *</label>
                <input style={s.fInput} value={form.name || ''} onChange={e => f('name', e.target.value)} placeholder="e.g. Adobe Creative Cloud" />
              </div>

              <div style={s.fRow}>
                <div><label style={s.label}>Vendor</label>
                  <input style={s.fInput} value={form.vendor || ''} onChange={e => f('vendor', e.target.value)} placeholder="e.g. Adobe" /></div>
                <div><label style={s.label}>Plan / Tier</label>
                  <input style={s.fInput} value={form.plan_name || ''} onChange={e => f('plan_name', e.target.value)} placeholder="e.g. Enterprise" /></div>
              </div>

              <div style={s.fRow}>
                <div><label style={s.label}>Category</label>
                  <select style={s.fInput} value={form.category || ''} onChange={e => f('category', e.target.value)}>
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select></div>
                <div><label style={s.label}>Billing Cycle</label>
                  <select style={s.fInput} value={form.billing_cycle || 'annually'} onChange={e => f('billing_cycle', e.target.value)}>
                    {BILLING_CYCLES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select></div>
              </div>

              <div style={s.fRow}>
                <div><label style={s.label}>Total Licenses</label>
                  <input style={s.fInput} type="number" min={1} value={form.num_licenses ?? ''} onChange={e => f('num_licenses', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 25" /></div>
                <div><label style={s.label}>Cost per License</label>
                  <input style={s.fInput} type="number" min={0} step="0.01" value={form.cost_per_license ?? ''} onChange={e => f('cost_per_license', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 1200" /></div>
              </div>

              <div style={s.fFull}>
                <label style={s.label}>
                  Total Cost
                  {!totalCostManual && form.num_licenses && form.cost_per_license ? (
                    <span style={{ fontWeight: 600, color: '#16a34a', marginLeft: 8, fontSize: 11, background: '#dcfce7', padding: '1px 7px', borderRadius: 10 }}>auto-calculated</span>
                  ) : totalCostManual ? (
                    <button onClick={() => {
                      if (form.num_licenses && form.cost_per_license) {
                        setForm(prev => ({ ...prev, total_cost: Math.round(form.num_licenses! * form.cost_per_license! * 100) / 100 }));
                        setTotalCostManual(false);
                      }
                    }} style={{ marginLeft: 8, fontSize: 11, color: '#ea580c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>↺ reset</button>
                  ) : null}
                </label>
                <input style={{ ...s.fInput, background: !totalCostManual && form.num_licenses && form.cost_per_license ? '#f0fdf4' : undefined }}
                  type="number" min={0} step="0.01" value={form.total_cost ?? ''}
                  onChange={e => { setTotalCostManual(true); f('total_cost', e.target.value ? Number(e.target.value) : undefined); }}
                  placeholder="Auto-calculated from licenses × cost" />
              </div>

              <div style={s.fRow}>
                <div><label style={s.label}>Start Date</label>
                  <input style={s.fInput} type="date" value={form.start_date || ''} onChange={e => f('start_date', e.target.value)} /></div>
                <div><label style={s.label}>Renewal / Expiry Date</label>
                  <input style={s.fInput} type="date" value={form.renewal_date || ''} onChange={e => f('renewal_date', e.target.value)} /></div>
              </div>

              <div style={s.fRow}>
                <div><label style={s.label}>Status</label>
                  <select style={s.fInput} value={form.status || 'active'} onChange={e => f('status', e.target.value)}>
                    {STATUSES.map(st => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
                  </select></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                  <input type="checkbox" id="auto_renew" checked={form.auto_renew || false} onChange={e => f('auto_renew', e.target.checked)} />
                  <label htmlFor="auto_renew" style={{ fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>Auto-renew</label>
                </div>
              </div>

              <div style={s.fFull}>
                <label style={s.label}>Notes</label>
                <textarea style={{ ...s.fInput, minHeight: 70, resize: 'vertical' as const }} value={form.notes || ''} onChange={e => f('notes', e.target.value)} placeholder="Any additional details…" />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', background: 'linear-gradient(135deg,#ea580c,#f97316)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Subscription'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
