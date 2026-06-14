import React, { useEffect, useRef, useState } from 'react';
import { assignmentsApi, assetsApi } from '../services/api';
import { Assignment, Asset } from '../types';

const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, fontWeight: 600, background: color + '22', color,
});

const s: Record<string, React.CSSProperties> = {
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading:    { fontSize: 22, fontWeight: 700, color: '#0f172a' },
  table:      { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th:         { textAlign: 'left', padding: '10px 16px', fontSize: 12, color: '#64748b', background: '#f8fafc', fontWeight: 600 },
  td:         { padding: '10px 16px', fontSize: 13, color: '#374151', borderTop: '1px solid #f1f5f9' },
  btnGreen:   { padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnRed:     { padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 12, padding: '32px 28px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 },
  label:      { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 },
  field:      { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' },
  row2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  actions:    { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  btnCancel:  { padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnBlue:    { padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  error:      { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14 },
  empty:      { color: '#94a3b8', fontStyle: 'italic', fontSize: 13 },
};

const today = () => new Date().toISOString().slice(0, 10);

type EmpEntry = { employee_id: string; name: string; email: string; designation: string; department: string };

const EMPTY_FORM = {
  asset_id: '',
  employee_id: '',
  assignee_name: '',
  assignee_email: '',
  designation: '',
  department: '',
  assignment_date: today(),
  expected_return_date: '',
  notes: '',
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [returning, setReturning] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [empList, setEmpList]     = useState<EmpEntry[]>([]);
  const [empSuggest, setEmpSuggest] = useState<EmpEntry[]>([]);
  const empInputRef = useRef<HTMLInputElement>(null);

  const load = () => assignmentsApi.list().then(setAssignments).catch(() => {});

  useEffect(() => {
    assignmentsApi.employees().then((list: any[]) => setEmpList(list)).catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, []);

  const openModal = async () => {
    setForm({ ...EMPTY_FORM, assignment_date: today() });
    setFormError('');
    setShowModal(true);
    setLoadingAssets(true);
    try {
      const res = await assetsApi.list({ status: 'stock', page_size: 100 });
      setAvailableAssets(res.items);
    } catch {
      setFormError('Failed to load available assets.');
    } finally {
      setLoadingAssets(false);
    }
  };

  const closeModal = () => setShowModal(false);

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleEmpIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(f => ({ ...f, employee_id: val }));
    if (val.trim()) {
      const q = val.trim().toLowerCase();
      setEmpSuggest(empList.filter(e =>
        e.employee_id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
      ).slice(0, 8));
    } else {
      setEmpSuggest([]);
    }
  };

  const selectEmployee = (emp: EmpEntry) => {
    setForm(f => ({ ...f, employee_id: emp.employee_id, assignee_name: emp.name, assignee_email: emp.email, designation: emp.designation, department: emp.department }));
    setEmpSuggest([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.asset_id)       { setFormError('Please select an asset.'); return; }
    if (!form.assignee_name.trim()) { setFormError('Assignee name is required.'); return; }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        asset_id:       form.asset_id,
        assignee_name:  form.assignee_name.trim(),
        assignment_date: form.assignment_date || today(),
      };
      if (form.employee_id.trim())        payload.employee_id        = form.employee_id.trim();
      if (form.assignee_email.trim())    payload.assignee_email     = form.assignee_email.trim();
      if (form.designation.trim())       payload.designation        = form.designation.trim();
      if (form.department.trim())        payload.department         = form.department.trim();
      if (form.expected_return_date)     payload.expected_return_date = form.expected_return_date;
      if (form.notes.trim())             payload.notes              = form.notes.trim();

      await assignmentsApi.create(payload as any);
      closeModal();
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Failed to create assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (id: string) => {
    setReturning(id);
    try {
      await assignmentsApi.returnAsset(id);
      load();
    } finally {
      setReturning(null);
    }
  };

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.heading}>Assignments ({assignments.length})</h2>
        <button style={s.btnGreen} onClick={openModal}>+ Assign Asset</button>
      </div>

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Asset</th>
            <th style={s.th}>Assigned To</th>
            <th style={s.th}>Department</th>
            <th style={s.th}>Assigned On</th>
            <th style={s.th}>Expected Return</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assignments.length === 0 ? (
            <tr><td style={s.td} colSpan={7}>No active assignments.</td></tr>
          ) : assignments.map((a) => (
            <tr key={a.id}>
              <td style={s.td}>
                {a.asset_id
                  ? <span style={s.empty}>{a.asset_id.slice(0, 8)}…</span>
                  : '—'}
              </td>
              <td style={s.td}>
                {(a as any).assignee_name
                  ? <>
                      <strong>{(a as any).assignee_name}</strong>
                      {(a as any).assignee_email && (
                        <><br /><span style={{ fontSize: 11, color: '#94a3b8' }}>{(a as any).assignee_email}</span></>
                      )}
                    </>
                  : <span style={s.empty}>{a.user_id ? a.user_id.slice(0, 8) + '…' : '—'}</span>}
              </td>
              <td style={s.td}>{a.department || '—'}</td>
              <td style={s.td}>{a.assignment_date}</td>
              <td style={s.td}>{a.expected_return_date || '—'}</td>
              <td style={s.td}>
                <span style={badge(a.approval_status === 'approved' ? '#22c55e' : '#f59e0b')}>
                  {a.approval_status}
                </span>
              </td>
              <td style={s.td}>
                <button style={s.btnRed} disabled={returning === a.id} onClick={() => handleReturn(a.id)}>
                  {returning === a.id ? '…' : 'Return'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Assign Asset</div>
            {formError && <div style={s.error}>{formError}</div>}

            {loadingAssets ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading available assets…</p>
            ) : (
              <form onSubmit={handleSubmit}>
                <label style={s.label}>Asset (available in stock) *</label>
                <select style={s.field} value={form.asset_id} onChange={set('asset_id')} required>
                  <option value="">— Select an asset —</option>
                  {availableAssets.length === 0
                    ? <option disabled>No stock assets available</option>
                    : availableAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.asset_tag} — {a.name}{a.brand ? ` (${a.brand})` : ''}
                      </option>
                    ))}
                </select>

                <div style={{ marginBottom: 14 }}>
                  <label style={s.label}>Employee ID</label>
                  <input ref={empInputRef} style={{ ...s.field, marginBottom: 0 }} value={form.employee_id} onChange={handleEmpIdChange} placeholder="Type ID or name…" autoComplete="off" />
                  {empSuggest.length > 0 && empInputRef.current && (() => {
                    const r = empInputRef.current!.getBoundingClientRect();
                    return (
                      <div style={{ position: 'fixed', top: r.bottom + 2, left: r.left, width: r.width, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 9999, maxHeight: 220, overflowY: 'auto' }}>
                        {empSuggest.map(e => (
                          <div key={e.employee_id} onMouseDown={() => selectEmployee(e)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={ev => (ev.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={ev => (ev.currentTarget.style.background = '')}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#3b82f6' }}>{e.employee_id}</div>
                            <div style={{ fontSize: 12, color: '#374151' }}>{e.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{e.email}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div style={s.row2}>
                  <div>
                    <label style={s.label}>Assignee Name *</label>
                    <input style={s.field} value={form.assignee_name} onChange={set('assignee_name')} placeholder="e.g. John Smith" required />
                  </div>
                  <div>
                    <label style={s.label}>Assignee Email</label>
                    <input style={s.field} type="email" value={form.assignee_email} onChange={set('assignee_email')} placeholder="john@company.com" />
                  </div>
                </div>

                <div style={s.row2}>
                  <div>
                    <label style={s.label}>Designation</label>
                    <input style={s.field} value={form.designation} onChange={set('designation')} placeholder="e.g. Software Engineer" />
                  </div>
                  <div>
                    <label style={s.label}>Department</label>
                    <input
                      style={s.field}
                      value={form.department}
                      onChange={set('department')}
                      placeholder="e.g. Engineering"
                    />
                  </div>
                </div>

                <div style={s.row2}>
                  <div>
                    <label style={s.label}>Assignment Date *</label>
                    <input style={s.field} type="date" value={form.assignment_date} onChange={set('assignment_date')} required />
                  </div>
                  <div>
                    <label style={s.label}>Expected Return Date</label>
                    <input style={s.field} type="date" value={form.expected_return_date} onChange={set('expected_return_date')} />
                  </div>
                </div>

                <label style={s.label}>Notes</label>
                <textarea
                  style={{ ...s.field, height: 72, resize: 'vertical' } as React.CSSProperties}
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Optional notes about this assignment…"
                />

                <div style={s.actions}>
                  <button type="button" style={s.btnCancel} onClick={closeModal}>Cancel</button>
                  <button type="submit" style={s.btnBlue} disabled={saving}>
                    {saving ? 'Assigning…' : 'Assign Asset'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
