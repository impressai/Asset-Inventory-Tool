import React, { useEffect, useState } from 'react';
import { usersApi } from '../services/api';
import { User, UserRole } from '../types';

/* ── helpers ── */
const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, fontWeight: 600, background: color + '22', color,
});

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef4444', manager: '#f59e0b', user: '#3b82f6',
};

/* ── styles ── */
const s: Record<string, React.CSSProperties> = {
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: 700, color: '#0f172a' },
  table:   { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th:      { textAlign: 'left', padding: '10px 16px', fontSize: 12, color: '#64748b', background: '#f8fafc', fontWeight: 600 },
  td:      { padding: '10px 16px', fontSize: 13, color: '#374151', borderTop: '1px solid #f1f5f9' },
  btn:     { padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnBlue: { padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  /* modal */
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:   { background: '#fff', borderRadius: 12, padding: '32px 28px', width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 },
  label:   { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 },
  field:   { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' },
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  btnCancel: { padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  error:   { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14 },
  success: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14 },
  hint:    { fontSize: 11, color: '#94a3b8', marginTop: -10, marginBottom: 14 },
};

const EMPTY_FORM = {
  full_name: '', email: '', password: '', confirm_password: '',
  role: 'user' as UserRole, department: '', employee_id: '',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const load = () => usersApi.list().then(setUsers).catch(() => {});

  useEffect(() => { load(); }, []);

  const openModal = () => { setForm(EMPTY_FORM); setFormError(''); setSuccessMsg(''); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError('Name, email and password are required.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setFormError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
      };
      if (form.department.trim()) payload.department = form.department.trim();
      if (form.employee_id.trim()) payload.employee_id = form.employee_id.trim();
      await usersApi.create(payload);
      closeModal();
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.heading}>Users ({users.length})</h2>
        <button style={s.btn} onClick={openModal}>+ Add User</button>
      </div>

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Name</th>
            <th style={s.th}>Email</th>
            <th style={s.th}>Department</th>
            <th style={s.th}>Role</th>
            <th style={s.th}>Employee ID</th>
            <th style={s.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0
            ? <tr><td style={s.td} colSpan={6}>No users found.</td></tr>
            : users.map((u) => (
              <tr key={u.id}>
                <td style={{ ...s.td, fontWeight: 600 }}>{u.full_name}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}>{u.department || '—'}</td>
                <td style={s.td}>
                  <span style={badge(ROLE_COLORS[u.role] || '#64748b')}>{u.role}</span>
                </td>
                <td style={s.td}>{u.employee_id || '—'}</td>
                <td style={s.td}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* ── Add User Modal ── */}
      {showModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Add New User</div>
            {formError && <div style={s.error}>{formError}</div>}
            {successMsg && <div style={s.success}>{successMsg}</div>}
            <form onSubmit={handleSubmit}>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Full Name *</label>
                  <input style={s.field} value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" required />
                </div>
                <div>
                  <label style={s.label}>Email *</label>
                  <input style={s.field} type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" required />
                </div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Password *</label>
                  <input style={s.field} type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" required />
                </div>
                <div>
                  <label style={s.label}>Confirm Password *</label>
                  <input style={s.field} type="password" value={form.confirm_password} onChange={set('confirm_password')} placeholder="Repeat password" required />
                </div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Role</label>
                  <select style={s.field} value={form.role} onChange={set('role')}>
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Department</label>
                  <input style={s.field} value={form.department} onChange={set('department')} placeholder="e.g. Engineering" />
                </div>
              </div>
              <label style={s.label}>Employee ID</label>
              <input style={s.field} value={form.employee_id} onChange={set('employee_id')} placeholder="e.g. EMP-042" />
              <div style={s.actions}>
                <button type="button" style={s.btnCancel} onClick={closeModal}>Cancel</button>
                <button type="submit" style={s.btnBlue} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
