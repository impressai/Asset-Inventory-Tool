import React, { useEffect, useState } from 'react';
import api, { purchasesApi } from '../services/api';
import { Purchase } from '../types';

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
};

const s: Record<string, React.CSSProperties> = {
  heading:  { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 20 },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  btnGreen:  { padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnBlue:   { padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnGhost:  { padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnRed:    { padding: '5px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnEdit:   { padding: '5px 12px', background: '#f1f5f9', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  table:    { width: '100%', borderCollapse: 'collapse', ...glass, borderRadius: 12, overflow: 'hidden' },
  th:       { textAlign: 'left', padding: '10px 16px', fontSize: 12, color: '#374151', background: 'rgba(255,255,255,0.3)', fontWeight: 600 },
  td:       { padding: '10px 16px', fontSize: 13, color: '#0f172a', borderTop: '1px solid rgba(0,0,0,0.06)' },
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:    { background: '#fff', borderRadius: 14, padding: '32px 28px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  title:    { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 },
  label:    { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 },
  field:    { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' as const },
  row2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  actions:  { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 },
};

const EMPTY_FORM = { vendor_name: '', invoice_number: '', purchase_date: '', total_cost: '', warranty_details: '' };

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError]   = useState('');

  /* edit */
  const [editTarget, setEditTarget]   = useState<Purchase | null>(null);
  const [editForm, setEditForm]       = useState(EMPTY_FORM);
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');

  /* delete */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting]               = useState(false);

  /* preview */
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [previewMime, setPreviewMime] = useState('');
  const [previewing,  setPreviewing]  = useState<string | null>(null);

  const load = () => purchasesApi.list().then(setPurchases).catch(() => {});
  useEffect(() => { load(); }, []);

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const openModal  = () => { setForm(EMPTY_FORM); setError(''); setCreatedId(null); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setCreatedId(null); load(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor_name.trim() || !form.invoice_number.trim() || !form.total_cost) {
      setError('Vendor, invoice number, and total cost are required.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload: any = {
        vendor_name:    form.vendor_name.trim(),
        invoice_number: form.invoice_number.trim(),
        total_cost:     parseFloat(form.total_cost),
      };
      if (form.purchase_date)          payload.purchase_date     = form.purchase_date;
      if (form.warranty_details.trim()) payload.warranty_details = form.warranty_details.trim();
      const result = await purchasesApi.create(payload);
      setCreatedId(result.id);
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to create purchase.');
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (purchaseId: string, file: File) => {
    setUploadingFor(purchaseId); setUploadError('');
    try {
      await purchasesApi.uploadDocument(purchaseId, file);
      load();
    } catch {
      setUploadError('Upload failed.');
    } finally { setUploadingFor(null); }
  };

  const setE = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm((p) => ({ ...p, [f]: e.target.value }));

  const openEdit = (p: Purchase) => {
    setEditTarget(p);
    setEditForm({
      vendor_name:      p.vendor_name,
      invoice_number:   p.invoice_number,
      purchase_date:    p.purchase_date || '',
      total_cost:       String(p.total_cost),
      warranty_details: p.warranty_details || '',
    });
    setEditError('');
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.vendor_name.trim() || !editForm.invoice_number.trim() || !editForm.total_cost) {
      setEditError('Vendor, invoice number, and total cost are required.'); return;
    }
    setEditSaving(true); setEditError('');
    try {
      const payload: any = {
        vendor_name:    editForm.vendor_name.trim(),
        invoice_number: editForm.invoice_number.trim(),
        total_cost:     parseFloat(editForm.total_cost),
        purchase_date:  editForm.purchase_date || undefined,
        warranty_details: editForm.warranty_details.trim() || undefined,
      };
      await purchasesApi.update(editTarget.id, payload);
      setEditTarget(null);
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Failed to update invoice.');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await purchasesApi.delete(id);
      setConfirmDeleteId(null);
      load();
    } finally { setDeleting(false); }
  };

  const docName = (key: string) => key.split('/').pop() || key;

  const fetchBlob = async (purchaseId: string, key: string) => {
    const filename = docName(key);
    const resp = await api.get(
      `/purchases/${purchaseId}/documents/${encodeURIComponent(filename)}`,
      { responseType: 'blob' },
    );
    return { blob: resp.data as Blob, filename };
  };

  const downloadDoc = async (purchaseId: string, key: string) => {
    try {
      const { blob, filename } = await fetchBlob(purchaseId, key);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl; a.download = filename; a.click();
      URL.revokeObjectURL(objUrl);
    } catch { alert('Could not download file.'); }
  };

  const openPreview = async (purchaseId: string, key: string) => {
    setPreviewing(key);
    try {
      const { blob, filename } = await fetchBlob(purchaseId, key);
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const mime = blob.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewName(filename);
      setPreviewMime(mime);
    } catch { alert('Could not load preview.'); }
    finally { setPreviewing(null); }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setPreviewName(''); setPreviewMime('');
  };

  const downloadFromPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl; a.download = previewName; a.click();
  };

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.heading}>Purchases</h2>
        <button style={s.btnGreen} onClick={openModal}>+ Add Invoice</button>
      </div>

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Invoice #</th>
            <th style={s.th}>Vendor</th>
            <th style={s.th}>Date</th>
            <th style={s.th}>Total Cost</th>
            <th style={s.th}>Warranty</th>
            <th style={s.th}>Documents</th>
            <th style={s.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {purchases.length === 0 ? (
            <tr><td style={s.td} colSpan={6}>No purchases found.</td></tr>
          ) : purchases.map((p) => (
            <tr key={p.id}>
              <td style={{ ...s.td, fontWeight: 700, fontFamily: 'monospace' }}>{p.invoice_number}</td>
              <td style={s.td}>{p.vendor_name}</td>
              <td style={s.td}>{p.purchase_date}</td>
              <td style={s.td}>₹{p.total_cost.toLocaleString()}</td>
              <td style={{ ...s.td, fontSize: 12, color: '#64748b' }}>{p.warranty_details || '—'}</td>
              <td style={s.td}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {(p.documents || []).map((key) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f1f5f9', borderRadius: 6, padding: '2px 4px 2px 8px' }}>
                      <button onClick={() => openPreview(p.id, key)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, color: '#3b82f6', maxWidth: 110, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: 0,
                      }} title={`Preview ${docName(key)}`}>
                        {previewing === key ? '…' : docName(key)}
                      </button>
                      <button onClick={() => downloadDoc(p.id, key)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#64748b', fontSize: 14, padding: '0 4px', lineHeight: 1,
                      }} title="Download">↓</button>
                    </div>
                  ))}
                  <label style={{ ...s.btnBlue, padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 6 }}>
                    {uploadingFor === p.id ? 'Uploading…' : '+ Doc'}
                    <input type="file" style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(p.id, f); e.target.value = ''; }} />
                  </label>
                </div>
                {uploadError && uploadingFor === p.id && (
                  <div style={{ color: '#b91c1c', fontSize: 11, marginTop: 4 }}>{uploadError}</div>
                )}
              </td>
              <td style={s.td}>
                {confirmDeleteId === p.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>Delete?</span>
                    <button style={s.btnRed} onClick={() => handleDelete(p.id)} disabled={deleting}>
                      {deleting ? '…' : 'Yes'}
                    </button>
                    <button style={s.btnEdit} onClick={() => setConfirmDeleteId(null)}>No</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={s.btnEdit} onClick={() => openEdit(p)}>Edit</button>
                    <button style={s.btnRed} onClick={() => setConfirmDeleteId(p.id)}>Delete</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Add Invoice Modal ── */}
      {showModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={s.modal}>
            {createdId ? (
              <>
                <div style={{ ...s.title, color: '#166534' }}>Invoice Saved</div>
                <p style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
                  Purchase record created. Attach a document now or close.
                </p>
                <label style={{ ...s.btnBlue, display: 'inline-block', padding: '8px 16px', cursor: 'pointer', borderRadius: 8 }}>
                  {uploadingFor === createdId ? 'Uploading…' : '⬆ Upload Document'}
                  <input type="file" style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(createdId, f); e.target.value = ''; }} />
                </label>
                {uploadError && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>{uploadError}</div>}
                <div style={s.actions}>
                  <button style={s.btnGhost} onClick={closeModal}>Close</button>
                </div>
              </>
            ) : (
              <>
                <div style={s.title}>Add Invoice</div>
                {error && <div style={s.errorBox}>{error}</div>}
                <form onSubmit={handleSubmit}>
                  <div style={s.row2}>
                    <div>
                      <label style={s.label}>Vendor Name *</label>
                      <input style={s.field} value={form.vendor_name} onChange={set('vendor_name')} placeholder="e.g. Apple India" required />
                    </div>
                    <div>
                      <label style={s.label}>Invoice Number *</label>
                      <input style={s.field} value={form.invoice_number} onChange={set('invoice_number')} placeholder="e.g. INV-2024-001" required />
                    </div>
                  </div>
                  <div style={s.row2}>
                    <div>
                      <label style={s.label}>Purchase Date</label>
                      <input style={s.field} type="date" value={form.purchase_date} onChange={set('purchase_date')} />
                    </div>
                    <div>
                      <label style={s.label}>Total Cost (₹) *</label>
                      <input style={s.field} type="number" min="0" step="0.01" value={form.total_cost} onChange={set('total_cost')} placeholder="0.00" required />
                    </div>
                  </div>
                  <label style={s.label}>Warranty Details</label>
                  <textarea style={{ ...s.field, height: 68, resize: 'vertical' } as React.CSSProperties}
                    value={form.warranty_details} onChange={set('warranty_details')} placeholder="Optional warranty notes…" />
                  <div style={s.actions}>
                    <button type="button" style={s.btnGhost} onClick={closeModal}>Cancel</button>
                    <button type="submit" style={{ ...s.btnGreen, padding: '8px 22px' }} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Invoice'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {/* ── Edit Invoice Modal ── */}
      {editTarget && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setEditTarget(null)}>
          <div style={s.modal}>
            <div style={s.title}>Edit Invoice</div>
            {editError && <div style={s.errorBox}>{editError}</div>}
            <form onSubmit={handleEditSave}>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Vendor Name *</label>
                  <input style={s.field} value={editForm.vendor_name} onChange={setE('vendor_name')} required />
                </div>
                <div>
                  <label style={s.label}>Invoice Number *</label>
                  <input style={s.field} value={editForm.invoice_number} onChange={setE('invoice_number')} required />
                </div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Purchase Date</label>
                  <input style={s.field} type="date" value={editForm.purchase_date} onChange={setE('purchase_date')} />
                </div>
                <div>
                  <label style={s.label}>Total Cost (₹) *</label>
                  <input style={s.field} type="number" min="0" step="0.01" value={editForm.total_cost} onChange={setE('total_cost')} required />
                </div>
              </div>
              <label style={s.label}>Warranty Details</label>
              <textarea style={{ ...s.field, height: 68, resize: 'vertical' } as React.CSSProperties}
                value={editForm.warranty_details} onChange={setE('warranty_details')} placeholder="Optional warranty notes…" />
              <div style={s.actions}>
                <button type="button" style={s.btnGhost} onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" style={{ ...s.btnGreen, padding: '8px 22px' }} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Document Preview Modal ── */}
      {previewUrl && (
        <div style={{ ...s.overlay, zIndex: 1100 }} onClick={(e) => e.target === e.currentTarget && closePreview()}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '20px 24px',
            width: '88vw', maxWidth: 960, maxHeight: '92vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 8px 40px rgba(0,0,0,0.28)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                {previewName}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.btnBlue} onClick={downloadFromPreview}>Download</button>
                <button style={s.btnGhost} onClick={closePreview}>Close</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: 0 }}>
              {previewMime.startsWith('image/') ? (
                <img src={previewUrl} alt={previewName} style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 6 }} />
              ) : previewMime === 'application/pdf' ? (
                <iframe src={previewUrl} title={previewName} style={{ width: '100%', height: '78vh', border: 'none', borderRadius: 6 }} />
              ) : (
                <div style={{ padding: 48, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
                  Preview not available for this file type.<br />Use the Download button instead.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
