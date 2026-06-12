import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { assetsApi, historyApi, assignmentsApi } from '../services/api';
import { Asset, AssetStatus, AssetCondition, AssetHistory, Assignment } from '../types';
import { useAuthStore } from '../store/authStore';

/* ── helpers ── */
const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, fontWeight: 600, background: color + '22', color,
});
const pageBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer',
  background: active ? '#3b82f6' : '#fff', color: active ? '#fff' : '#374151', fontSize: 13,
});

const STATUS_COLORS: Record<string, string> = {
  stock: '#22c55e', assigned: '#3b82f6', faulty: '#ef4444', sold: '#94a3b8',
};
const CONDITION_COLORS: Record<string, string> = {
  new: '#22c55e', good: '#3b82f6', damaged: '#f59e0b', retired: '#94a3b8',
};
const EVENT_COLORS: Record<string, string> = {
  created: '#22c55e', updated: '#3b82f6', assigned: '#8b5cf6',
  unassigned: '#f59e0b', maintenance: '#06b6d4', status_changed: '#64748b', disposed: '#ef4444',
};

const s: Record<string, React.CSSProperties> = {
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading:   { fontSize: 22, fontWeight: 700, color: '#0f172a' },
  toolbar:   { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  input:     { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 },
  select:    { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 },
  btn:       { padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGreen:  { padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnRed:    { padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost:  { padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnOutline:{ padding: '8px 14px', background: 'transparent', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  table:     { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th:        { textAlign: 'left', padding: '10px 16px', fontSize: 12, color: '#64748b', background: '#f8fafc', fontWeight: 600 },
  td:        { padding: '10px 16px', fontSize: 13, color: '#374151', borderTop: '1px solid #f1f5f9' },
  tagLink:   { fontWeight: 700, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' },
  pagination:{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  /* detail modal */
  detailModal:  { background: '#fff', borderRadius: 14, padding: 0, width: 660, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 48px rgba(0,0,0,0.22)', position: 'relative' },
  detailHeader: { background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', borderRadius: '14px 14px 0 0', padding: '24px 28px', color: '#fff' },
  detailTag:    { fontSize: 13, color: '#94a3b8', marginBottom: 4, fontFamily: 'monospace' },
  detailName:   { fontSize: 22, fontWeight: 700, color: '#fff' },
  detailBody:   { padding: '24px 28px' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 20 },
  detailGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 4 },
  detailKey:    { fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 },
  detailVal:    { fontSize: 13, color: '#1e293b', fontWeight: 500 },
  historyItem:  { display: 'flex', gap: 12, paddingBottom: 14, borderBottom: '1px solid #f1f5f9', marginBottom: 14 },
  historyDot:   { width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0 },
  historyText:  { fontSize: 13, color: '#374151' },
  historyTime:  { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  closeBtn:     { position: 'absolute', top: 18, right: 22, background: 'none', border: 'none', color: '#94a3b8', fontSize: 24, cursor: 'pointer', lineHeight: 1, zIndex: 1 },
  /* assign form */
  assignBox:    { background: '#f8fafc', borderRadius: 10, padding: '18px 20px', marginTop: 4 },
  label:        { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 },
  field:        { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: 'border-box' },
  row2:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  errorBox:     { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 },
  /* add modal */
  addModal:     { background: '#fff', borderRadius: 12, padding: '32px 28px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  addTitle:     { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 },
  addField:     { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' },
  addActions:   { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
};

const EMPTY_FORM = {
  name: '', category: '', asset_tag: '', brand: '', model_number: '', serial_number: '',
  condition: 'new' as AssetCondition, status: 'stock' as AssetStatus,
  location: '', notes: '', expiry_date: '', license_start_date: '',
};

type SpecField = { key: string; label: string; placeholder: string };

const LAPTOP_SPECS: SpecField[] = [
  { key: 'Processor', label: 'Processor',        placeholder: 'e.g. Intel Core i7-13th Gen' },
  { key: 'RAM',       label: 'RAM',              placeholder: 'e.g. 16 GB DDR5' },
  { key: 'Storage',   label: 'Storage',          placeholder: 'e.g. 512 GB SSD' },
  { key: 'Display',   label: 'Display',          placeholder: 'e.g. 15.6" FHD IPS' },
  { key: 'Graphics',  label: 'Graphics / GPU',   placeholder: 'e.g. Intel Iris Xe' },
  { key: 'OS',        label: 'Operating System', placeholder: 'e.g. Windows 11 Pro' },
  { key: 'Battery',   label: 'Battery',          placeholder: 'e.g. 72 Wh' },
];

const MONITOR_SPECS: SpecField[] = [
  { key: 'Screen Size',    label: 'Screen Size',    placeholder: 'e.g. 27"' },
  { key: 'Resolution',     label: 'Resolution',     placeholder: 'e.g. 1920×1080 (FHD)' },
  { key: 'Panel Type',     label: 'Panel Type',     placeholder: 'e.g. IPS' },
  { key: 'Refresh Rate',   label: 'Refresh Rate',   placeholder: 'e.g. 144 Hz' },
  { key: 'Connectivity',   label: 'Connectivity',   placeholder: 'e.g. HDMI, DisplayPort' },
  { key: 'Response Time',  label: 'Response Time',  placeholder: 'e.g. 1 ms GtG' },
];

function getSpecFields(category: string): SpecField[] {
  const cat = category.toLowerCase().trim();
  if (cat.includes('laptop') || cat.includes('macbook')) return LAPTOP_SPECS;
  if (cat.includes('monitor') || cat.includes('display') || cat.includes('screen')) return MONITOR_SPECS;
  return [];
}

const CATEGORIES = [
  'Laptop', 'Desktop', 'Monitor', 'Keyboard', 'Mouse', 'Printer',
  'Scanner', 'Projector', 'Network Switch', 'Router', 'Server',
  'UPS', 'Headset', 'Webcam', 'Mobile Phone', 'Tablet',
  'Hard Drive / SSD', 'Software', 'Other',
];

const CSV_HEADERS = ['name', 'category', 'brand', 'model_number', 'serial_number', 'condition', 'status', 'location', 'purchase_date', 'warranty_expiry_date', 'license_start_date', 'expiry_date', 'notes'];

/* Maps normalised header keys → internal field names */
const HEADER_MAP: Record<string, string> = {
  asset_name:              'name',
  owner_custodian:         'assignee_name',
  email_id:                'assignee_email',
  mail_id:                 'assignee_email',
  manufacturer_model:      'manufacturer_model',
  configuration_details:   'notes',
  asset_status:            'status',
  warranty_expiry_status:  'warranty_expiry_date',
  warranty_expiry_date:    'warranty_expiry_date',
};

const IMPORT_COLUMNS = ['Asset Name', 'Category', 'Employee ID', 'Owner/Custodian', 'Email ID', 'Designation', 'Manufacturer / Model', 'Serial Number', 'Configuration Details', 'Asset Status', 'Purchase Date', 'Warranty Expiry Status', 'Location'];

/* ── CSV helpers ── */
function toCSV(assets: Asset[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = assets.map(a => CSV_HEADERS.map(h => escape((a as any)[h])).join(','));
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => {
    const raw = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return HEADER_MAP[raw] || raw;
  });
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur); cur = ''; }
      else cur += ch;
    }
    vals.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

const today = () => new Date().toISOString().slice(0, 10);

const dropItem: React.CSSProperties = {
  display: 'block', width: '100%', padding: '10px 16px', background: 'none',
  border: 'none', textAlign: 'left', fontSize: 13, color: '#374151',
  cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
};

const extractError = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
  return fallback;
};

const EMPTY_ASSIGN = {
  assignee_name: '', assignee_email: '', employee_id: '', designation: '',
  department: '', assignment_date: today(), expected_return_date: '', notes: '',
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={s.detailKey}>{label}</div>
      <div style={s.detailVal}>{value || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
    </div>
  );
}

export default function AssetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isAdmin     = user?.role === 'admin';
  const canAdd      = user?.role === 'admin' || user?.role === 'manager';
  const canAssign   = user?.role === 'admin' || user?.role === 'manager';
  const canReturn   = user?.role === 'admin' || user?.role === 'manager';

  const [assets, setAssets]               = useState<Asset[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState(searchParams.get('status') || '');
  const [conditionFilter, setConditionFilter] = useState('');
  const [categoryFilter, setCategoryFilter]   = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy]     = useState('created_at');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');

  /* add modal */
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');

  /* detail modal */
  const [detailAsset, setDetailAsset]     = useState<Asset | null>(null);
  const [history, setHistory]             = useState<AssetHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [assignments, setAssignments]     = useState<Assignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  /* action panel inside detail */
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsOpen, setActionsOpen]       = useState(false);
  const [actionPanel, setActionPanel]       = useState<null | 'assign' | 'sell' | 'faulty'>(null);
  const [assignForm, setAssignForm]         = useState(EMPTY_ASSIGN);
  const [assignSaving, setAssignSaving]     = useState(false);
  const [assignError, setAssignError]       = useState('');
  const [returning, setReturning]           = useState(false);
  const [statusMoving, setStatusMoving]     = useState(false);

  /* edit assignment */
  const [editAssignMode, setEditAssignMode]   = useState(false);
  const [editAssignForm, setEditAssignForm]   = useState<Record<string, string>>({});
  const [editAssignSaving, setEditAssignSaving] = useState(false);
  const [editAssignError, setEditAssignError]   = useState('');

  /* sell form */
  const EMPTY_SALE = { sale_date: today(), buyer_name: '', buyer_email: '', buyer_contact: '', sale_price: '', sale_invoice_number: '', sale_notes: '' };
  const [saleForm, setSaleForm]   = useState<Record<string, string>>(EMPTY_SALE);
  const [saleSaving, setSaleSaving] = useState(false);
  const [saleError, setSaleError]   = useState('');

  /* edit form inside detail */
  const [editMode, setEditMode]     = useState(false);
  const [editForm, setEditForm]     = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState('');

  /* delete */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  /* specs */
  const [specForm, setSpecForm]         = useState<Record<string, string>>({});
  const [editSpecForm, setEditSpecForm] = useState<Record<string, string>>({});

  /* report dropdown */
  const [reportOpen, setReportOpen] = useState(false);


  /* import modal */
  const [showImport, setShowImport]       = useState(false);
  const [importRows, setImportRows]       = useState<Record<string, string>[]>([]);
  const [importError, setImportError]     = useState('');
  const [importing, setImporting]         = useState(false);
  const [importResult, setImportResult]   = useState<{ created: number; assigned: number; errors: { row: number; error: string }[] } | null>(null);
  const [defaultCategory, setDefaultCategory] = useState('General');

  const pageSize = 20;

  const load = () => {
    const params: Record<string, unknown> = { page, page_size: pageSize, sort_by: sortBy, sort_dir: sortDir };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (conditionFilter) params.condition = conditionFilter;
    if (categoryFilter) params.category = categoryFilter;
    assetsApi.list(params).then((r) => { setAssets(r.items); setTotal(r.total); }).catch(() => {});
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d: 'asc' | 'desc') => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  // Sync filters when URL params change (e.g. navigating from the Assets dropdown)
  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '');
    setCategoryFilter(searchParams.get('category') || '');
    setPage(1);
  }, [searchParams]); // eslint-disable-line

  // Open a specific asset detail when navigated from a notification (?open=<asset_id>)
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    setSearchParams((prev: URLSearchParams) => { const n = new URLSearchParams(prev); n.delete('open'); return n; }, { replace: true });
    assetsApi.get(openId).then(openDetail).catch(() => {});
  }, [searchParams]); // eslint-disable-line

  useEffect(() => { load(); }, [page, statusFilter, conditionFilter, categoryFilter, sortBy, sortDir]); // eslint-disable-line

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []); // eslint-disable-line

  /* ── open detail ── */
  const openDetail = async (asset: Asset) => {
    setDetailAsset(asset);
    setActionPanel(null);
    setAssignError('');
    setHistory([]);
    setAssignments([]);
    setHistoryLoading(true);
    setAssignLoading(true);

    const [hist, assigns] = await Promise.allSettled([
      historyApi.getAssetHistory(asset.id),
      assignmentsApi.list({ asset_id: asset.id }),
    ]);
    if (hist.status === 'fulfilled') setHistory(hist.value);
    if (assigns.status === 'fulfilled') setAssignments(assigns.value);
    setHistoryLoading(false);
    setAssignLoading(false);
  };

  const closeDetail = () => { setDetailAsset(null); setActionPanel(null); setActionsOpen(false); setEditMode(false); setConfirmDelete(false); setEditAssignMode(false); };

  const handleDelete = async () => {
    if (!detailAsset) return;
    setDeleting(true);
    try {
      await assetsApi.delete(detailAsset.id);
      closeDetail();
      setPage(1);
      load();
    } finally { setDeleting(false); }
  };

  /* ── open edit ── */
  const openEdit = () => {
    if (!detailAsset) return;
    setEditForm({
      name:          detailAsset.name,
      category:      detailAsset.category,
      brand:         detailAsset.brand || '',
      model_number:  detailAsset.model_number || '',
      serial_number: detailAsset.serial_number || '',
      location:      detailAsset.location || '',
      condition:     detailAsset.condition,
      status:        detailAsset.status,
      purchase_date:         detailAsset.purchase_date || '',
      warranty_expiry_date:  detailAsset.warranty_expiry_date || '',
      expiry_date:           detailAsset.expiry_date || '',
      license_start_date:    detailAsset.license_start_date || '',
      notes:         detailAsset.notes || '',
      // sale details
      sale_date:           detailAsset.sale_date || '',
      buyer_name:          detailAsset.buyer_name || '',
      buyer_email:         detailAsset.buyer_email || '',
      buyer_contact:       detailAsset.buyer_contact || '',
      sale_price:          detailAsset.sale_price != null ? String(detailAsset.sale_price) : '',
      sale_invoice_number: detailAsset.sale_invoice_number || '',
      sale_notes:          detailAsset.sale_notes || '',
    });
    const existingSpecs = (detailAsset.specifications as Record<string, string>) || {};
    setEditSpecForm({ ...existingSpecs });
    setEditError('');
    setEditMode(true);
  };

  const setE = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm((f) => ({ ...f, [field]: e.target.value }));

  /* ── save edit ── */
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailAsset) return;
    if (!editForm.name.trim() || !editForm.category.trim()) { setEditError('Name and Category are required.'); return; }
    setEditSaving(true); setEditError('');
    try {
      const payload: Record<string, unknown> = { ...editForm };
      ['brand', 'model_number', 'serial_number', 'location', 'notes', 'purchase_date', 'warranty_expiry_date', 'expiry_date', 'license_start_date',
       'sale_date', 'buyer_name', 'buyer_email', 'buyer_contact', 'sale_invoice_number', 'sale_notes']
        .forEach((k) => { if (!payload[k]) delete payload[k]; });
      if (payload.sale_price) payload.sale_price = parseFloat(payload.sale_price as string);
      else delete payload.sale_price;
      const specs: Record<string, string> = {};
      getSpecFields(editForm.category).forEach(({ key }) => { if (editSpecForm[key]?.trim()) specs[key] = editSpecForm[key].trim(); });
      payload.specifications = Object.keys(specs).length > 0 ? specs : null;
      const updated = await assetsApi.update(detailAsset.id, payload as Partial<Asset>);
      setDetailAsset(updated);
      setEditMode(false);
      load();
    } catch (err: any) {
      setEditError(extractError(err, 'Failed to save changes.'));
    } finally { setEditSaving(false); }
  };

  /* ── assign submit ── */
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailAsset) return;
    if (!assignForm.assignee_name.trim()) { setAssignError('Assignee name is required.'); return; }
    setAssignSaving(true); setAssignError('');
    try {
      const payload: Record<string, string> = {
        asset_id: detailAsset.id,
        assignee_name: assignForm.assignee_name.trim(),
        assignment_date: assignForm.assignment_date || today(),
      };
      if (assignForm.assignee_email.trim())  payload.assignee_email     = assignForm.assignee_email.trim();
      if (assignForm.employee_id.trim())     payload.employee_id        = assignForm.employee_id.trim();
      if (assignForm.designation.trim())     payload.designation        = assignForm.designation.trim();
      if (assignForm.department.trim())      payload.department         = assignForm.department.trim();
      if (assignForm.expected_return_date)   payload.expected_return_date = assignForm.expected_return_date;
      if (assignForm.notes.trim())           payload.notes              = assignForm.notes.trim();
      await assignmentsApi.create(payload as any);
      /* refresh asset status + detail data */
      const updated = await assetsApi.get(detailAsset.id);
      setDetailAsset(updated);
      setActionPanel(null);
      setAssignForm(EMPTY_ASSIGN);
      openDetail(updated);
      load();
    } catch (err: any) {
      setAssignError(extractError(err, 'Failed to assign asset.'));
    } finally { setAssignSaving(false); }
  };

  /* ── edit assignment ── */
  const openEditAssign = () => {
    if (!activeAssignment) return;
    setEditAssignForm({
      assignee_name:        (activeAssignment as any).assignee_name || '',
      assignee_email:       (activeAssignment as any).assignee_email || '',
      employee_id:          (activeAssignment as any).employee_id || '',
      designation:          (activeAssignment as any).designation || '',
      department:           activeAssignment.department || '',
      expected_return_date: activeAssignment.expected_return_date || '',
      notes:                activeAssignment.notes || '',
    });
    setEditAssignError('');
    setEditAssignMode(true);
  };

  const handleEditAssignSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;
    if (!editAssignForm.assignee_name.trim()) { setEditAssignError('Assignee name is required.'); return; }
    setEditAssignSaving(true); setEditAssignError('');
    try {
      const payload: Record<string, string> = {};
      Object.entries(editAssignForm).forEach(([k, v]) => { if ((v as string).trim()) payload[k] = (v as string).trim(); });
      await assignmentsApi.update(activeAssignment.id, payload as any);
      const updated = await assetsApi.get(detailAsset!.id);
      setDetailAsset(updated);
      await openDetail(updated);
      setEditAssignMode(false);
    } catch (err: any) {
      setEditAssignError(extractError(err, 'Failed to save changes.'));
    } finally { setEditAssignSaving(false); }
  };

  /* ── return asset ── */
  const handleReturn = async (assignmentId: string) => {
    setReturning(true);
    try {
      await assignmentsApi.returnAsset(assignmentId);
      const updated = await assetsApi.get(detailAsset!.id);
      setDetailAsset(updated);
      openDetail(updated);
      load();
    } finally { setReturning(false); }
  };

  /* ── status move handlers ── */
  const setSaleF = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setSaleForm(p => ({ ...p, [f]: e.target.value }));

  const handleMoveToSold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailAsset) return;
    setSaleSaving(true); setSaleError('');
    try {
      const payload: Record<string, unknown> = { status: 'sold' };
      if (saleForm.sale_date)           payload.sale_date           = saleForm.sale_date;
      if (saleForm.buyer_name)          payload.buyer_name          = saleForm.buyer_name;
      if (saleForm.buyer_email)         payload.buyer_email         = saleForm.buyer_email;
      if (saleForm.buyer_contact)       payload.buyer_contact       = saleForm.buyer_contact;
      if (saleForm.sale_price)          payload.sale_price          = parseFloat(saleForm.sale_price);
      if (saleForm.sale_invoice_number) payload.sale_invoice_number = saleForm.sale_invoice_number;
      if (saleForm.sale_notes)          payload.sale_notes          = saleForm.sale_notes;
      const updated = await assetsApi.update(detailAsset.id, payload as Partial<Asset>);
      setDetailAsset(updated); setActionPanel(null); setSaleForm(EMPTY_SALE); load();
    } catch (err: any) {
      setSaleError(extractError(err, 'Failed to mark as sold.'));
    } finally { setSaleSaving(false); }
  };

  const handleMoveToStatus = async (newStatus: AssetStatus) => {
    if (!detailAsset) return;
    setStatusMoving(true);
    try {
      const updated = await assetsApi.update(detailAsset.id, { status: newStatus } as Partial<Asset>);
      setDetailAsset(updated); setActionPanel(null); load();
    } catch {}
    finally { setStatusMoving(false); }
  };

  /* ── add asset submit ── */
  const openAdd  = () => { setForm(EMPTY_FORM); setSpecForm({}); setFormError(''); setShowAddModal(true); };
  const closeAdd = () => { setShowAddModal(false); setSpecForm({}); };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));
  const setA = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setAssignForm((f) => ({ ...f, [field]: e.target.value }));

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim()) { setFormError('Name and Category are required.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload: Record<string, unknown> = { ...form };
      ['brand', 'model_number', 'serial_number', 'location', 'notes', 'expiry_date', 'license_start_date'].forEach((k) => { if (!payload[k]) delete payload[k]; });
      const specs: Record<string, string> = {};
      getSpecFields(form.category).forEach(({ key }) => { if (specForm[key]?.trim()) specs[key] = specForm[key].trim(); });
      if (Object.keys(specs).length > 0) payload.specifications = specs;
      await assetsApi.create(payload as Partial<Asset>);
      closeAdd(); setPage(1); load();
    } catch (err: any) {
      setFormError(extractError(err, 'Failed to create asset.'));
    } finally { setSaving(false); }
  };

  /* ── Export CSV ── */
  const handleExportCSV = async () => {
    const params: Record<string, unknown> = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (conditionFilter) params.condition = conditionFilter;
    if (categoryFilter) params.category = categoryFilter;
    const res = await assetsApi.exportAll(params);
    downloadBlob(toCSV(res.items), `assets-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
  };

  /* ── Export PDF ── */
  const handleExportPDF = async () => {
    const params: Record<string, unknown> = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (conditionFilter) params.condition = conditionFilter;
    if (categoryFilter) params.category = categoryFilter;
    const res = await assetsApi.exportAll(params);
    const rows = res.items.map(a => `
      <tr>
        <td>${a.asset_tag}</td><td>${a.name}</td><td>${a.category}</td>
        <td>${a.brand || ''}</td><td>${a.status}</td><td>${a.condition}</td>
        <td>${a.location || ''}</td><td>${a.serial_number || ''}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Assets Export</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left}
      td{padding:7px 10px;border-bottom:1px solid #e2e8f0}
      tr:nth-child(even)td{background:#f8fafc}
      @media print{body{padding:0}}</style></head>
      <body><h1>Asset Inventory — ${new Date().toLocaleDateString()}</h1>
      <table><thead><tr><th>Tag</th><th>Asset Name</th><th>Category</th><th>Brand</th><th>Status</th><th>Condition</th><th>Location</th><th>Serial</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  /* ── Import CSV ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(''); setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target?.result as string);
        if (rows.length === 0) { setImportError('No data rows found. Check your CSV format.'); return; }
        if (!rows[0].name) { setImportError('CSV must have an "Asset Name" column.'); return; }
        setImportRows(rows);
      } catch { setImportError('Failed to parse CSV file.'); }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) return;
    setImporting(true); setImportError('');
    let created = 0, assigned = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < importRows.length; i++) {
      const r = importRows[i];
      try {
        // Split "Manufacturer / Model" into brand + model_number
        const mfgRaw = r.manufacturer_model || r.brand || '';
        const slashIdx = mfgRaw.indexOf('/');
        const brand       = slashIdx > -1 ? mfgRaw.slice(0, slashIdx).trim() : mfgRaw.trim() || undefined;
        const model_number = slashIdx > -1 ? mfgRaw.slice(slashIdx + 1).trim() : (r.model_number || undefined);

        // If "Asset Name" looks like a tag (e.g. IMP-LAP001), use it as the tag
        // and build the actual name from Manufacturer + Model (e.g. "Dell Latitude 5490")
        const nameRaw = (r.name || '').trim();
        const isTagFormat = /^[A-Z]{2,6}-[A-Z]+\d+$/i.test(nameRaw);
        const mfgName = [brand, model_number].filter(Boolean).join(' ');
        const assetName = isTagFormat ? nameRaw : (nameRaw || mfgName || '');
        const assetTag  = isTagFormat ? nameRaw.toUpperCase() : undefined;

        // Normalise status
        const rawStatus = (r.status || '').toLowerCase().trim();
        const status: AssetStatus = (
          ['stock','assigned','faulty','sold'].includes(rawStatus) ? rawStatus :
          rawStatus.includes('assign') || rawStatus.includes('use') || rawStatus.includes('issued') ? 'assigned' :
          rawStatus.includes('fault') || rawStatus.includes('damage') || rawStatus.includes('repair') ? 'faulty' :
          rawStatus.includes('sold') || rawStatus.includes('dispos') || rawStatus.includes('retire') ? 'sold' : 'stock'
        ) as AssetStatus;

        // Try to extract a real date from "Warranty Expiry Status"
        const parseDate = (s: string) => {
          if (!s) return undefined;
          const d = new Date(s);
          return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
        };

        // For 'assigned' rows create as 'stock' first so the assignment endpoint
        // can accept it (it rejects if status is already 'assigned') and will
        // set status → 'assigned' itself after creating the record.
        const createStatus = status === 'assigned' ? 'stock' : status;

        const asset = await assetsApi.create({
          name:                 assetName,
          asset_tag:            assetTag,
          category:             r.category || defaultCategory,
          brand:                brand || undefined,
          model_number:         model_number || undefined,
          serial_number:        r.serial_number || undefined,
          condition:            (['new','good','damaged','retired'].includes(r.condition || '') ? r.condition : 'good') as AssetCondition,
          status:               createStatus,
          location:             r.location || undefined,
          purchase_date:        r.purchase_date || undefined,
          warranty_expiry_date: parseDate(r.warranty_expiry_date || ''),
          notes:                r.notes || undefined,
        });

        created++;

        // Only create assignment when status is 'assigned' — skipping this for
        // sold/faulty/stock assets prevents their status from being overridden.
        if (status === 'assigned' && (r.assignee_name || r.employee_id || r.assignee_email)) {
          try {
            await assignmentsApi.create({
              asset_id:       asset.id,
              assignee_name:  r.assignee_name || undefined,
              assignee_email: r.assignee_email || undefined,
              employee_id:    r.employee_id || undefined,
              designation:    r.designation || undefined,
              assignment_date: today(),
            });
            assigned++;
          } catch { /* asset created but assignment failed — not fatal */ }
        }
      } catch (err: any) {
        errors.push({ row: i + 2, error: extractError(err, 'Failed to create asset') });
      }
    }

    setImportResult({ created, assigned, errors });
    setImportRows([]);
    load();
    setImporting(false);
  };

  const totalPages = Math.ceil(total / pageSize);
  const fmt     = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined;
  const fmtTime = (d: string)  => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const activeAssignment = assignments.find((a) => a.is_active);

  return (
    <div>
      <div style={s.toolbar}>
        <input style={s.input} placeholder="Search name / tag / serial / assignee…" value={search}
          onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select style={s.select} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {(['stock', 'assigned', 'faulty', 'sold'] as AssetStatus[]).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select style={s.select} value={conditionFilter} onChange={(e) => { setConditionFilter(e.target.value); setPage(1); }}>
          <option value="">All conditions</option>
          {(['new', 'good', 'damaged', 'retired'] as AssetCondition[]).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select style={s.select} value={categoryFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button style={s.btn} onClick={() => { setPage(1); load(); }}>Search</button>
      </div>

      <div style={s.header}>
        <h2 style={s.heading}>Assets ({total})</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Report dropdown */}
          <div style={{ position: 'relative' }}>
            <button style={s.btnOutline} onClick={() => setReportOpen((o) => !o)}>
              Report ▾
            </button>
            {reportOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden',
              }}
                onMouseLeave={() => setReportOpen(false)}
              >
                {[
                  { label: '⬇ Export CSV', action: () => { setReportOpen(false); handleExportCSV(); }, adminOnly: false },
                  { label: '⬇ Export PDF', action: () => { setReportOpen(false); handleExportPDF(); }, adminOnly: false },
                  { label: '⬆ Import CSV', action: () => { setReportOpen(false); setShowImport(true); setImportRows([]); setImportError(''); setImportResult(null); }, adminOnly: true },
                ].filter(item => !item.adminOnly || isAdmin).map(({ label, action }) => (
                  <button key={label} onClick={action} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 16px', fontSize: 13, fontWeight: 500,
                    background: 'none', border: 'none', cursor: 'pointer', color: '#374151',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {canAdd && <button style={s.btnGreen} onClick={openAdd}>+ Add Asset</button>}
        </div>
      </div>

      <table style={s.table}>
        <thead>
          <tr>
            {([
              { label: 'Asset Name',  col: 'name' },
              { label: 'Category',    col: 'category' },
              { label: 'Brand',       col: 'brand' },
              { label: 'Status',      col: 'status' },
              { label: 'Condition',   col: 'condition' },
              { label: 'Location',    col: 'location' },
              { label: 'Assigned To', col: 'assignee_name' },
            ] as { label: string; col: string }[]).map(({ label, col }) => (
              <th key={label} style={{ ...s.th, cursor: col ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                onClick={() => col && handleSort(col)}>
                {label}
                {col && (
                  <span style={{ marginLeft: 4, opacity: sortBy === col ? 1 : 0.3, fontSize: 10 }}>
                    {sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.length === 0
            ? <tr><td style={s.td} colSpan={7}>No assets found.</td></tr>
            : assets.map((a) => (
              <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(a)}>
                <td style={s.td}><span style={s.tagLink}>{a.name}</span></td>
                <td style={s.td}>{a.category}</td>
                <td style={s.td}>{a.brand || '—'}</td>
                <td style={s.td}><span style={badge(STATUS_COLORS[a.status] || '#64748b')}>{a.status}</span></td>
                <td style={s.td}><span style={badge(CONDITION_COLORS[a.condition] || '#64748b')}>{a.condition}</span></td>
                <td style={s.td}>{a.location || '—'}</td>
                <td style={s.td}>{a.current_assignee_name || '—'}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={s.pagination}>
          <button style={pageBtn(false)} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} style={pageBtn(p === page)} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button style={pageBtn(false)} disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {/* ══ Asset Detail Modal ══ */}
      {detailAsset && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && closeDetail()}>
          <div style={s.detailModal}>
            <button style={s.closeBtn} onClick={closeDetail}>×</button>

            {/* Header */}
            <div style={s.detailHeader}>
              <div style={s.detailTag}>{detailAsset.asset_tag}</div>
              <div style={s.detailName}>{editMode ? (editForm.name || detailAsset.name) : detailAsset.name}</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ ...badge(STATUS_COLORS[editMode ? editForm.status : detailAsset.status] || '#64748b'), fontSize: 12 }}>
                  {editMode ? editForm.status : detailAsset.status}
                </span>
                <span style={{ ...badge(CONDITION_COLORS[editMode ? editForm.condition : detailAsset.condition] || '#64748b'), fontSize: 12 }}>
                  {editMode ? editForm.condition : detailAsset.condition}
                </span>
              </div>
            </div>

            <div style={s.detailBody}>

              {/* ── Actions Dropdown ── */}
              <div ref={actionsRef} style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                <button
                  style={{ ...s.btn, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setActionsOpen((o) => !o)}
                >
                  Actions <span style={{ fontSize: 10 }}>{actionsOpen ? '▲' : '▼'}</span>
                </button>
                {actionsOpen && (
                  <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 50, overflow: 'hidden' }}>
                    {canAssign && (detailAsset.status === 'stock' || detailAsset.status === 'faulty') && (
                      <button style={dropItem} onClick={() => { setActionsOpen(false); setActionPanel(actionPanel === 'assign' ? null : 'assign'); setAssignForm({ ...EMPTY_ASSIGN, assignment_date: today() }); setAssignError(''); }}>
                        Assign Asset
                      </button>
                    )}
                    {detailAsset.status !== 'sold' && (
                      <button style={dropItem} onClick={() => { setActionsOpen(false); setActionPanel(actionPanel === 'sell' ? null : 'sell'); setSaleForm(EMPTY_SALE); setSaleError(''); }}>
                        Mark as Sold
                      </button>
                    )}
                    {(detailAsset.status === 'stock' || detailAsset.status === 'assigned') && (
                      <button style={{ ...dropItem, color: '#ef4444' }} disabled={statusMoving} onClick={() => { setActionsOpen(false); handleMoveToStatus('faulty' as AssetStatus); }}>
                        {statusMoving ? 'Moving…' : 'Mark as Faulty'}
                      </button>
                    )}
                    {detailAsset.status !== 'stock' && (
                      <button style={dropItem} disabled={statusMoving} onClick={() => { setActionsOpen(false); handleMoveToStatus('stock' as AssetStatus); }}>
                        {statusMoving ? 'Moving…' : 'Move to Stock'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Assignment section ── */}
              <div style={s.sectionTitle}>Assignment</div>

              {assignLoading ? (
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading…</p>
              ) : activeAssignment ? (
                <div style={{ ...s.assignBox, borderLeft: '4px solid #3b82f6' }}>
                  {editAssignMode ? (
                    <form onSubmit={handleEditAssignSave}>
                      {editAssignError && <div style={s.errorBox}>{editAssignError}</div>}
                      <div style={s.row2}>
                        <div><label style={s.label}>Assignee Name *</label>
                          <input style={s.field} value={editAssignForm.assignee_name} onChange={e => setEditAssignForm(f => ({ ...f, assignee_name: e.target.value }))} required />
                        </div>
                        <div><label style={s.label}>Employee ID</label>
                          <input style={s.field} value={editAssignForm.employee_id} onChange={e => setEditAssignForm(f => ({ ...f, employee_id: e.target.value }))} />
                        </div>
                      </div>
                      <div style={s.row2}>
                        <div><label style={s.label}>Designation</label>
                          <input style={s.field} value={editAssignForm.designation} onChange={e => setEditAssignForm(f => ({ ...f, designation: e.target.value }))} />
                        </div>
                        <div><label style={s.label}>Email</label>
                          <input style={s.field} type="email" value={editAssignForm.assignee_email} onChange={e => setEditAssignForm(f => ({ ...f, assignee_email: e.target.value }))} />
                        </div>
                      </div>
                      <div style={s.row2}>
                        <div><label style={s.label}>Department</label>
                          <input style={s.field} value={editAssignForm.department} onChange={e => setEditAssignForm(f => ({ ...f, department: e.target.value }))} />
                        </div>
                        <div><label style={s.label}>Expected Return Date</label>
                          <input style={s.field} type="date" value={editAssignForm.expected_return_date} onChange={e => setEditAssignForm(f => ({ ...f, expected_return_date: e.target.value }))} />
                        </div>
                      </div>
                      <div><label style={s.label}>Notes</label>
                        <input style={s.field} value={editAssignForm.notes} onChange={e => setEditAssignForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button type="button" style={s.btnGhost} onClick={() => setEditAssignMode(false)}>Cancel</button>
                        <button type="submit" style={s.btn} disabled={editAssignSaving}>{editAssignSaving ? 'Saving…' : 'Save Changes'}</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={s.detailGrid}>
                          <DetailRow label="Assigned To"   value={(activeAssignment as any).assignee_name || '—'} />
                          <DetailRow label="Employee ID"   value={(activeAssignment as any).employee_id} />
                          <DetailRow label="Designation"   value={(activeAssignment as any).designation} />
                          <DetailRow label="Email"         value={(activeAssignment as any).assignee_email} />
                          <DetailRow label="Department"    value={activeAssignment.department} />
                          <DetailRow label="Assigned On"   value={fmt(activeAssignment.assignment_date)} />
                          <DetailRow label="Expected Back" value={fmt(activeAssignment.expected_return_date)} />
                        </div>
                        {canAssign && (
                          <button style={{ ...s.btnGhost, padding: '5px 12px', fontSize: 12, flexShrink: 0 }} onClick={openEditAssign}>✎ Edit</button>
                        )}
                      </div>
                      {activeAssignment.notes && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{activeAssignment.notes}</div>
                      )}
                      {canReturn && (
                        <div style={{ marginTop: 14 }}>
                          <button style={s.btnRed} disabled={returning} onClick={() => handleReturn(activeAssignment.id)}>
                            {returning ? 'Returning…' : 'Return Asset'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                actionPanel === null && (
                  <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
                    {detailAsset.status === 'stock' ? 'Not currently assigned. Use "+ Assign Asset" above to assign.' : 'No active assignment.'}
                  </p>
                )
              )}

              {/* ── Inline Assign Form ── */}
              {actionPanel === 'assign' && (
                <div style={s.assignBox}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Assign Asset</div>
                  {assignError && <div style={s.errorBox}>{assignError}</div>}
                  <form onSubmit={handleAssign}>
                    <div style={s.row2}>
                      <div>
                        <label style={s.label}>Assignee Name *</label>
                        <input style={s.field} value={assignForm.assignee_name} onChange={setA('assignee_name')} placeholder="e.g. John Smith" required />
                      </div>
                      <div>
                        <label style={s.label}>Employee ID</label>
                        <input style={s.field} value={assignForm.employee_id} onChange={setA('employee_id')} placeholder="e.g. EMP-001" />
                      </div>
                    </div>
                    <div style={s.row2}>
                      <div>
                        <label style={s.label}>Designation</label>
                        <input style={s.field} value={assignForm.designation} onChange={setA('designation')} placeholder="e.g. Software Engineer" />
                      </div>
                      <div>
                        <label style={s.label}>Email</label>
                        <input style={s.field} type="email" value={assignForm.assignee_email} onChange={setA('assignee_email')} placeholder="john@company.com" />
                      </div>
                    </div>
                    <div style={s.row2}>
                      <div>
                        <label style={s.label}>Department</label>
                        <input style={s.field} value={assignForm.department} onChange={setA('department')} placeholder="e.g. Engineering" />
                      </div>
                      <div>
                        <label style={s.label}>Assignment Date *</label>
                        <input style={s.field} type="date" value={assignForm.assignment_date} onChange={setA('assignment_date')} required />
                      </div>
                    </div>
                    <div>
                      <label style={s.label}>Expected Return Date</label>
                      <input style={s.field} type="date" value={assignForm.expected_return_date} onChange={setA('expected_return_date')} />
                    </div>
                    <div>
                      <label style={s.label}>Notes</label>
                      <textarea style={{ ...s.field, height: 60, resize: 'vertical' } as React.CSSProperties}
                        value={assignForm.notes} onChange={setA('notes')} placeholder="Optional notes…" />
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button type="button" style={s.btnGhost} onClick={() => setActionPanel(null)}>Cancel</button>
                      <button type="submit" style={s.btn} disabled={assignSaving}>{assignSaving ? 'Assigning…' : 'Confirm Assignment'}</button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Inline Sell Form ── */}
              {actionPanel === 'sell' && (
                <div style={s.assignBox}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Mark as Sold</div>
                  {saleError && <div style={s.errorBox}>{saleError}</div>}
                  <form onSubmit={handleMoveToSold}>
                    <div style={s.row2}>
                      <div>
                        <label style={s.label}>Buyer Name</label>
                        <input style={s.field} value={saleForm.buyer_name} onChange={setSaleF('buyer_name')} placeholder="e.g. John Doe" />
                      </div>
                      <div>
                        <label style={s.label}>Buyer Email</label>
                        <input style={s.field} type="email" value={saleForm.buyer_email} onChange={setSaleF('buyer_email')} placeholder="buyer@email.com" />
                      </div>
                    </div>
                    <div style={s.row2}>
                      <div>
                        <label style={s.label}>Buyer Contact</label>
                        <input style={s.field} value={saleForm.buyer_contact} onChange={setSaleF('buyer_contact')} placeholder="Phone number" />
                      </div>
                      <div>
                        <label style={s.label}>Sale Date</label>
                        <input style={s.field} type="date" value={saleForm.sale_date} onChange={setSaleF('sale_date')} />
                      </div>
                    </div>
                    <div style={s.row2}>
                      <div>
                        <label style={s.label}>Sale Price (₹)</label>
                        <input style={s.field} type="number" min="0" step="0.01" value={saleForm.sale_price} onChange={setSaleF('sale_price')} placeholder="0.00" />
                      </div>
                      <div>
                        <label style={s.label}>Invoice / Reference No.</label>
                        <input style={s.field} value={saleForm.sale_invoice_number} onChange={setSaleF('sale_invoice_number')} placeholder="e.g. INV-2024-001" />
                      </div>
                    </div>
                    <label style={s.label}>Sale Notes</label>
                    <textarea style={{ ...s.field, height: 60, resize: 'vertical' } as React.CSSProperties}
                      value={saleForm.sale_notes} onChange={setSaleF('sale_notes')} placeholder="Additional sale remarks…" />
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button type="button" style={s.btnGhost} onClick={() => setActionPanel(null)}>Cancel</button>
                      <button type="submit" style={{ ...s.btn, background: '#64748b' }} disabled={saleSaving}>{saleSaving ? 'Processing…' : 'Confirm Sale'}</button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Asset Info / Edit ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={s.sectionTitle}>Asset Information</div>
                {!editMode && (
                  <button style={{ ...s.btn, padding: '6px 14px', fontSize: 12 }} onClick={openEdit}>✎ Edit</button>
                )}
              </div>

              {editMode ? (
                <form onSubmit={handleEditSave}>
                  {editError && <div style={s.errorBox}>{editError}</div>}
                  <div style={s.row2}>
                    <div>
                      <label style={s.label}>Name *</label>
                      <input style={s.field} value={editForm.name} onChange={setE('name')} required />
                    </div>
                    <div>
                      <label style={s.label}>Category *</label>
                      <select style={s.field} value={editForm.category} onChange={setE('category')} required>
                        <option value="">Select a category</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={s.row2}>
                    <div>
                      <label style={s.label}>Brand</label>
                      <input style={s.field} value={editForm.brand} onChange={setE('brand')} placeholder="e.g. Dell" />
                    </div>
                    <div>
                      <label style={s.label}>Model Number</label>
                      <input style={s.field} value={editForm.model_number} onChange={setE('model_number')} />
                    </div>
                  </div>
                  <div style={s.row2}>
                    <div>
                      <label style={s.label}>Serial Number</label>
                      <input style={s.field} value={editForm.serial_number} onChange={setE('serial_number')} />
                    </div>
                    <div>
                      <label style={s.label}>Location</label>
                      <input style={s.field} value={editForm.location} onChange={setE('location')} />
                    </div>
                  </div>
                  <div style={s.row2}>
                    <div>
                      <label style={s.label}>Condition</label>
                      <select style={s.field} value={editForm.condition} onChange={setE('condition')}>
                        {(['new', 'good', 'damaged', 'retired'] as AssetCondition[]).map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Status</label>
                      <select style={s.field} value={editForm.status} onChange={setE('status')}>
                        {(['stock', 'assigned', 'faulty', 'sold'] as AssetStatus[]).map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={s.row2}>
                    <div>
                      <label style={s.label}>Purchase Date</label>
                      <input style={s.field} type="date" value={editForm.purchase_date} onChange={setE('purchase_date')} />
                    </div>
                    <div>
                      <label style={s.label}>Warranty Expiry</label>
                      <input style={s.field} type="date" value={editForm.warranty_expiry_date} onChange={setE('warranty_expiry_date')} />
                    </div>
                  </div>
                  <div style={s.row2}>
                    <div>
                      <label style={s.label}>License / Subscription Start</label>
                      <input style={s.field} type="date" value={editForm.license_start_date} onChange={setE('license_start_date')} />
                    </div>
                    <div>
                      <label style={s.label}>License / Subscription Expiry</label>
                      <input style={s.field} type="date" value={editForm.expiry_date} onChange={setE('expiry_date')} />
                    </div>
                  </div>
                  {getSpecFields(editForm.category).length > 0 && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, marginTop: 4, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                        Technical Specifications (optional)
                      </div>
                      <div style={s.row2}>
                        {getSpecFields(editForm.category).map(({ key, label, placeholder }: SpecField) => (
                          <div key={key}>
                            <label style={s.label}>{label}</label>
                            <input style={s.field} value={editSpecForm[key] || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setEditSpecForm((f: Record<string, string>) => ({ ...f, [key]: e.target.value }))}
                              placeholder={placeholder} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <label style={s.label}>Notes</label>
                  <textarea style={{ ...s.field, height: 72, resize: 'vertical' } as React.CSSProperties}
                    value={editForm.notes} onChange={setE('notes')} placeholder="Optional notes…" />

                  {/* Sale details — shown only when status = sold */}
                  {editForm.status === 'sold' && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: '16px 0 10px', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                        Sale Details
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={s.label}>Buyer Name</label>
                          <input style={s.field} value={editForm.buyer_name} onChange={setE('buyer_name')} placeholder="e.g. John Doe" />
                        </div>
                        <div>
                          <label style={s.label}>Buyer Email</label>
                          <input style={s.field} type="email" value={editForm.buyer_email} onChange={setE('buyer_email')} placeholder="buyer@email.com" />
                        </div>
                        <div>
                          <label style={s.label}>Buyer Contact</label>
                          <input style={s.field} value={editForm.buyer_contact} onChange={setE('buyer_contact')} placeholder="Phone number" />
                        </div>
                        <div>
                          <label style={s.label}>Sale Date</label>
                          <input style={s.field} type="date" value={editForm.sale_date} onChange={setE('sale_date')} />
                        </div>
                        <div>
                          <label style={s.label}>Sale Price (₹)</label>
                          <input style={s.field} type="number" min="0" step="0.01" value={editForm.sale_price} onChange={setE('sale_price')} placeholder="0.00" />
                        </div>
                        <div>
                          <label style={s.label}>Invoice / Reference No.</label>
                          <input style={s.field} value={editForm.sale_invoice_number} onChange={setE('sale_invoice_number')} placeholder="e.g. INV-2024-001" />
                        </div>
                      </div>
                      <label style={s.label}>Sale Notes</label>
                      <textarea style={{ ...s.field, height: 60, resize: 'vertical' } as React.CSSProperties}
                        value={editForm.sale_notes} onChange={setE('sale_notes')} placeholder="Additional sale remarks…" />
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button type="button" style={s.btnGhost} onClick={() => setEditMode(false)}>Cancel</button>
                    <button type="submit" style={s.btn} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={s.detailGrid}>
                    <DetailRow label="Category"      value={detailAsset.category} />
                    <DetailRow label="Brand"         value={detailAsset.brand} />
                    <DetailRow label="Model Number"  value={detailAsset.model_number} />
                    <DetailRow label="Serial Number" value={detailAsset.serial_number} />
                    <DetailRow label="Location"      value={detailAsset.location} />
                  </div>

                  <div style={s.sectionTitle}>Dates</div>
                  <div style={s.detailGrid}>
                    <DetailRow label="Purchase Date"   value={fmt(detailAsset.purchase_date)} />
                    <DetailRow label="Warranty Expiry" value={fmt(detailAsset.warranty_expiry_date)} />
                    <DetailRow label="License / Subscription Start" value={fmt(detailAsset.license_start_date)} />
                    <DetailRow label="License / Subscription Expiry" value={fmt(detailAsset.expiry_date)} />
                    <DetailRow label="Added On"        value={fmt(detailAsset.created_at)} />
                    <DetailRow label="Last Updated"    value={detailAsset.updated_at ? fmt(detailAsset.updated_at) : undefined} />
                  </div>

                  {detailAsset.specifications && Object.keys(detailAsset.specifications).length > 0 && (
                    <>
                      <div style={s.sectionTitle}>Specifications</div>
                      <div style={s.detailGrid}>
                        {Object.entries(detailAsset.specifications).map(([k, v]) => (
                          <DetailRow key={k} label={k} value={String(v)} />
                        ))}
                      </div>
                    </>
                  )}

                  {detailAsset.notes && (
                    <>
                      <div style={s.sectionTitle}>Notes</div>
                      <div style={{ fontSize: 13, color: '#374151', background: '#f8fafc', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6 }}>
                        {detailAsset.notes}
                      </div>
                    </>
                  )}

                  {detailAsset.status === 'sold' && (detailAsset.buyer_name || detailAsset.sale_date || detailAsset.sale_price != null) && (
                    <>
                      <div style={{ ...s.sectionTitle, color: '#94a3b8' }}>Sale Details</div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={s.detailGrid}>
                          <DetailRow label="Buyer Name"    value={detailAsset.buyer_name} />
                          <DetailRow label="Buyer Email"   value={detailAsset.buyer_email} />
                          <DetailRow label="Buyer Contact" value={detailAsset.buyer_contact} />
                          <DetailRow label="Sale Date"     value={fmt(detailAsset.sale_date)} />
                          <DetailRow label="Sale Price"    value={detailAsset.sale_price != null ? `₹${Number(detailAsset.sale_price).toLocaleString()}` : undefined} />
                          <DetailRow label="Invoice / Ref" value={detailAsset.sale_invoice_number} />
                        </div>
                        {detailAsset.sale_notes && (
                          <div style={{ marginTop: 8 }}>
                            <div style={s.detailKey}>Sale Notes</div>
                            <div style={{ ...s.detailVal, lineHeight: 1.6 }}>{detailAsset.sale_notes}</div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── History ── */}
              <div style={s.sectionTitle}>Activity History</div>
              {historyLoading ? (
                <p style={{ fontSize: 13, color: '#94a3b8' }}>Loading history…</p>
              ) : history.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No history recorded.</p>
              ) : (
                history.map((h) => {
                  const snap = h.event_type === 'unassigned' && h.changed_fields
                    ? (h.changed_fields as any).return_snapshot
                    : null;
                  return (
                    <div key={h.id} style={s.historyItem}>
                      <div style={{ ...s.historyDot, background: EVENT_COLORS[h.event_type] || '#94a3b8' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ ...s.historyText, fontWeight: 600 }}>
                          {h.event_type === 'unassigned' ? 'Asset Returned' : h.description}
                        </div>
                        {snap && (
                          <div style={{ marginTop: 8, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                            {snap.assignee_name && (
                              <div><div style={s.detailKey}>Previous Holder</div><div style={{ ...s.detailVal, color: '#c2410c' }}>{snap.assignee_name}</div></div>
                            )}
                            {snap.employee_id && (
                              <div><div style={s.detailKey}>Employee ID</div><div style={s.detailVal}>{snap.employee_id}</div></div>
                            )}
                            {snap.designation && (
                              <div><div style={s.detailKey}>Designation</div><div style={s.detailVal}>{snap.designation}</div></div>
                            )}
                            {snap.assignee_email && (
                              <div><div style={s.detailKey}>Email</div><div style={s.detailVal}>{snap.assignee_email}</div></div>
                            )}
                            {snap.department && (
                              <div><div style={s.detailKey}>Department</div><div style={s.detailVal}>{snap.department}</div></div>
                            )}
                            {snap.assignment_date && (
                              <div><div style={s.detailKey}>Assigned On</div><div style={s.detailVal}>{snap.assignment_date}</div></div>
                            )}
                            {snap.return_date && (
                              <div><div style={s.detailKey}>Returned On</div><div style={s.detailVal}>{snap.return_date}</div></div>
                            )}
                            {snap.expected_return_date && (
                              <div><div style={s.detailKey}>Expected Return</div><div style={s.detailVal}>{snap.expected_return_date}</div></div>
                            )}
                            {snap.returned_by && (
                              <div><div style={s.detailKey}>Returned By</div><div style={s.detailVal}>{snap.returned_by}</div></div>
                            )}
                            {snap.notes && (
                              <div style={{ gridColumn: '1 / -1' }}><div style={s.detailKey}>Notes</div><div style={s.detailVal}>{snap.notes}</div></div>
                            )}
                          </div>
                        )}
                        <div style={s.historyTime}>{fmtTime(h.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                {isAdmin && (confirmDelete ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>Delete this asset permanently?</span>
                    <button style={s.btnRed} disabled={deleting} onClick={handleDelete}>
                      {deleting ? 'Deleting…' : 'Yes, Delete'}
                    </button>
                    <button style={s.btnGhost} onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                ) : (
                  <button style={{ ...s.btnGhost, color: '#ef4444', border: '1px solid #fecaca' }}
                    onClick={() => setConfirmDelete(true)}>
                    Delete Asset
                  </button>
                ))}
                <button style={s.btnGhost} onClick={closeDetail}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Import CSV Modal ══ */}
      {showImport && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setShowImport(false)}>
          <div style={{ ...s.addModal, width: 640 }}>
            <div style={s.addTitle}>Bulk Import Assets from CSV</div>

            {/* Template download */}
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              <strong>Expected columns:</strong> {IMPORT_COLUMNS.join(', ')}
              <br />
              <span style={{ color: '#0369a1' }}>Asset Name is required. Category defaults to the value below if omitted. Asset Status auto-maps common values.</span>
              <br />
              <span style={{ color: '#0369a1', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => downloadBlob(
                  IMPORT_COLUMNS.join(',') + '\nDell Laptop,Laptop,EMP001,John Doe,john.doe@company.com,IT Engineer,Dell / XPS-9310,SN12345,Intel i7 16GB 512GB SSD,stock,2024-01-15,2027-01-15,Office 3B',
                  'assets-template.csv', 'text/csv'
                )}>
                ⬇ Download template CSV
              </span>
            </div>

            {/* Default category */}
            <label style={{ ...s.label, fontSize: 13, marginBottom: 14 }}>
              Default Category <span style={{ fontWeight: 400, color: '#64748b' }}>(used when Category column is blank)</span>
              <input style={{ ...s.input, marginTop: 4 }} value={defaultCategory}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultCategory(e.target.value)} placeholder="e.g. General" />
            </label>

            {importError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{importError}</div>}

            {importResult ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>✓ Import Complete</div>
                <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>
                  {importResult.created} asset{importResult.created !== 1 ? 's' : ''} created
                  {importResult.assigned > 0 ? ` · ${importResult.assigned} assigned` : ''}.
                </div>
                {importResult.errors.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c', marginBottom: 4 }}>{importResult.errors.length} row(s) failed:</div>
                    {importResult.errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#b91c1c' }}>Row {e.row}: {e.error}</div>)}
                  </div>
                )}
              </div>
            ) : (
              <>
                <label style={{ ...s.label, fontSize: 13, marginBottom: 10 }}>
                  Select CSV file
                  <input type="file" accept=".csv,text/csv" onChange={handleFileChange}
                    style={{ display: 'block', marginTop: 6, fontSize: 13 }} />
                </label>

                {importRows.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600, marginBottom: 8 }}>
                      Preview — {importRows.length} row{importRows.length !== 1 ? 's' : ''} detected:
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: 240, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 14 }}>
                      <table style={{ ...s.table, borderRadius: 0 }}>
                        <thead>
                          <tr>{['name','assignee_name','manufacturer_model','serial_number','status','location'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 10).map((r, i) => (
                            <tr key={i}>
                              {['name','assignee_name','manufacturer_model','serial_number','status','location'].map(h => <td key={h} style={s.td}>{r[h] || '—'}</td>)}
                            </tr>
                          ))}
                          {importRows.length > 10 && <tr><td style={s.td} colSpan={6}>…and {importRows.length - 10} more rows</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            <div style={s.addActions}>
              <button style={s.btnGhost} onClick={() => setShowImport(false)}>
                {importResult ? 'Close' : 'Cancel'}
              </button>
              {!importResult && (
                <button style={s.btn} disabled={importing || importRows.length === 0} onClick={handleImportSubmit}>
                  {importing ? 'Importing…' : `Import ${importRows.length > 0 ? importRows.length + ' assets' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Add Asset Modal ══ */}
      {showAddModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && closeAdd()}>
          <div style={s.addModal}>
            <div style={s.addTitle}>Add New Asset</div>
            {formError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14 }}>{formError}</div>}
            <form onSubmit={handleAddSubmit}>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Name *</label>
                  <input style={s.addField} value={form.name} onChange={set('name')} placeholder="e.g. Dell Laptop" required />
                </div>
                <div>
                  <label style={s.label}>Category *</label>
                  <select style={s.addField} value={form.category} onChange={async (e) => {
                    const cat = e.target.value;
                    setForm((f) => ({ ...f, category: cat, asset_tag: '' }));
                    if (cat) {
                      try {
                        const res = await assetsApi.nextTag(cat);
                        setForm((f) => ({ ...f, asset_tag: res.asset_tag }));
                      } catch {}
                    }
                  }} required>
                    <option value="">Select a category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Asset Tag</label>
                  <input style={s.addField} value={form.asset_tag} onChange={set('asset_tag')} placeholder="Auto-generated" />
                </div>
                <div />
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Brand</label>
                  <input style={s.addField} value={form.brand} onChange={set('brand')} placeholder="e.g. Dell" />
                </div>
                <div>
                  <label style={s.label}>Model Number</label>
                  <input style={s.addField} value={form.model_number} onChange={set('model_number')} placeholder="e.g. XPS-9310" />
                </div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Serial Number</label>
                  <input style={s.addField} value={form.serial_number} onChange={set('serial_number')} placeholder="Unique serial" />
                </div>
                <div>
                  <label style={s.label}>Location</label>
                  <input style={s.addField} value={form.location} onChange={set('location')} placeholder="e.g. Office 3B" />
                </div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Condition</label>
                  <select style={s.addField} value={form.condition} onChange={set('condition')}>
                    {(['new', 'good', 'damaged', 'retired'] as AssetCondition[]).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Status</label>
                  <select style={s.addField} value={form.status} onChange={set('status')}>
                    {(['stock', 'assigned', 'faulty', 'sold'] as AssetStatus[]).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>License / Subscription Start</label>
                  <input style={s.addField} type="date" value={form.license_start_date} onChange={set('license_start_date')} />
                </div>
                <div>
                  <label style={s.label}>License / Subscription Expiry</label>
                  <input style={s.addField} type="date" value={form.expiry_date} onChange={set('expiry_date')} />
                </div>
              </div>
              {getSpecFields(form.category).length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, marginTop: 4, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                    Technical Specifications (optional)
                  </div>
                  <div style={s.row2}>
                    {getSpecFields(form.category).map(({ key, label, placeholder }: SpecField) => (
                      <div key={key}>
                        <label style={s.label}>{label}</label>
                        <input style={s.addField} value={specForm[key] || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSpecForm((f: Record<string, string>) => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <label style={s.label}>Notes</label>
              <textarea style={{ ...s.addField, height: 72, resize: 'vertical' } as React.CSSProperties}
                value={form.notes} onChange={set('notes')} placeholder="Optional notes…" />
              <div style={s.addActions}>
                <button type="button" style={s.btnGhost} onClick={closeAdd}>Cancel</button>
                <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving…' : 'Create Asset'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
