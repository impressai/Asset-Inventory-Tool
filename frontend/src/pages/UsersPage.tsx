import React, { useEffect, useState } from 'react';
import { usersApi, rolePermissionsApi } from '../services/api';
import { User, UserRole } from '../types';
import { useAuthStore } from '../store/authStore';

const badge = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, fontWeight: 600, background: color + '22', color,
});

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef4444', manager: '#f59e0b', user: '#3b82f6',
};

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
};

const s: Record<string, React.CSSProperties> = {
  table:    { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th:       { textAlign: 'left', padding: '10px 16px', fontSize: 12, color: '#64748b', background: '#f8fafc', fontWeight: 600 },
  td:       { padding: '10px 16px', fontSize: 13, color: '#374151', borderTop: '1px solid #f1f5f9' },
  btn:      { padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnBlue:  { padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnRed:   { padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:      { background: '#fff', borderRadius: 12, padding: '32px 28px', width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 },
  label:      { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 },
  field:      { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' as const },
  row2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  actions:    { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  error:      { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14 },
  detailModal:  { background: '#fff', borderRadius: 14, padding: 0, width: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 48px rgba(0,0,0,0.22)', position: 'relative' as const },
  detailHeader: { background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', borderRadius: '14px 14px 0 0', padding: '24px 28px', color: '#fff' },
  detailName:   { fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 },
  detailEmail:  { fontSize: 13, color: '#94a3b8' },
  detailBody:   { padding: '24px 28px' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12, marginTop: 20 },
  detailGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 8 },
  detailKey:    { fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 },
  detailVal:    { fontSize: 13, color: '#1e293b', fontWeight: 500 },
  closeBtn:     { position: 'absolute' as const, top: 18, right: 22, background: 'none', border: 'none', color: '#94a3b8', fontSize: 24, cursor: 'pointer', lineHeight: 1, zIndex: 1 },
  tagLink:      { fontWeight: 700, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' as const },
  errorBox:     { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 },
};

const EMPTY_FORM = {
  full_name: '', email: '', password: '', confirm_password: '',
  role: 'user' as UserRole, department: '', employee_id: '',
};

// ─── Permissions config ──────────────────────────────────────
const PERMISSIONS = [
  { key: 'create_asset',  label: 'Create Asset',  description: 'Add new assets to the inventory' },
  { key: 'edit_asset',    label: 'Edit Asset',    description: 'Modify asset details and status' },
  { key: 'delete_asset',  label: 'Delete Asset',  description: 'Permanently remove assets' },
  { key: 'assign_asset',  label: 'Assign Asset',  description: 'Assign assets to users' },
  { key: 'return_asset',  label: 'Return Asset',  description: 'Mark assigned assets as returned' },
  { key: 'import_assets', label: 'Import CSV',    description: 'Bulk import assets via CSV upload' },
  { key: 'export_assets', label: 'Export CSV',    description: 'Export asset list to CSV' },
  { key: 'view_reports',  label: 'View Reports',  description: 'Access the Reports page' },
  { key: 'manage_users',  label: 'Manage Users',  description: 'Create and edit user accounts' },
];
const ROLES_LIST = ['admin', 'manager', 'user'] as const;
const ROLE_LABELS: Record<string, string> = { admin: 'Super Admin', manager: 'Admin', user: 'User' };

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={s.detailKey}>{label}</div>
      <div style={s.detailVal}>{value || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
    </div>
  );
}

export default function UsersPage() {
  const { user: me } = useAuthStore();
  const isAdmin = me?.role === 'admin';
  const canManage = me?.role === 'admin' || me?.role === 'manager';

  const [tab, setTab] = useState<'users' | 'roles'>('users');

  // ── Users state ──────────────────────────────────────────────
  const [users, setUsers]           = useState<User[]>([]);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [selected, setSelected]     = useState<User | null>(null);
  const [editMode, setEditMode]     = useState(false);
  const [editForm, setEditForm]     = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState('');
  const [editSaved, setEditSaved]   = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating]           = useState(false);

  // ── Roles state ───────────────────────────────────────────────
  const [perms, setPerms]       = useState<Record<string, Record<string, boolean>>>({});
  const [draft, setDraft]       = useState<Record<string, Record<string, boolean>>>({});
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsSaving, setPermsSaving]   = useState(false);
  const [permsSaved, setPermsSaved]     = useState(false);
  const [permsError, setPermsError]     = useState('');

  const loadUsers = () => usersApi.list().then(setUsers).catch(() => {});

  const loadPerms = () => {
    setPermsLoading(true);
    rolePermissionsApi.get().then(data => {
      setPerms(data); setDraft(JSON.parse(JSON.stringify(data)));
      setPermsLoading(false);
    }).catch(() => { setPermsError('Failed to load permissions.'); setPermsLoading(false); });
  };

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { if (tab === 'roles') loadPerms(); }, [tab]);

  // ── User handlers ────────────────────────────────────────────
  const openDetail = (u: User) => { setSelected(u); setEditMode(false); setEditError(''); setEditSaved(false); setConfirmDeactivate(false); };
  const closeDetail = () => { setSelected(null); setEditMode(false); setConfirmDeactivate(false); };
  const openEdit = (u: User) => {
    setEditForm({ full_name: u.full_name, department: u.department || '', employee_id: (u as any).employee_id || '', role: u.role });
    setEditError(''); setEditSaved(false); setEditMode(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setEditSaving(true); setEditError('');
    try {
      const payload: Record<string, unknown> = { role: editForm.role };
      if (editForm.full_name.trim())   payload.full_name   = editForm.full_name.trim();
      if (editForm.department.trim())  payload.department  = editForm.department.trim();
      if (editForm.employee_id.trim()) payload.employee_id = editForm.employee_id.trim();
      const updated = await usersApi.update(selected.id, payload);
      setSelected(updated);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      setEditMode(false); setEditSaved(true);
      setTimeout(() => setEditSaved(false), 3000);
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || 'Failed to save changes.');
    } finally { setEditSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    setDeactivating(true);
    try {
      await usersApi.update(selected.id, { is_active: false });
      closeDetail(); loadUsers();
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || 'Failed to deactivate user.');
    } finally { setDeactivating(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) { setFormError('Name, email and password are required.'); return; }
    if (form.password !== form.confirm_password) { setFormError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { full_name: form.full_name, email: form.email, password: form.password, role: form.role };
      if (form.department.trim())  payload.department  = form.department.trim();
      if (form.employee_id.trim()) payload.employee_id = form.employee_id.trim();
      await usersApi.create(payload);
      setShowModal(false); loadUsers();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Failed to create user.');
    } finally { setSaving(false); }
  };

  const set  = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [f]: e.target.value }));
  const setE = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEditForm(p => ({ ...p, [f]: e.target.value }));

  // ── Roles handlers ───────────────────────────────────────────
  const toggle = (role: string, key: string) => {
    if (!isAdmin || role === 'admin') return;
    setDraft(prev => ({ ...prev, [role]: { ...prev[role], [key]: !prev[role]?.[key] } }));
    setPermsSaved(false);
  };

  const savePerms = async () => {
    setPermsSaving(true); setPermsError('');
    try {
      await rolePermissionsApi.update(draft);
      setPerms(JSON.parse(JSON.stringify(draft)));
      setPermsSaved(true); setTimeout(() => setPermsSaved(false), 3000);
    } catch { setPermsError('Failed to save permissions.'); }
    finally { setPermsSaving(false); }
  };

  const hasPermChanges = JSON.stringify(draft) !== JSON.stringify(perms);

  // ── Tab bar ──────────────────────────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: active ? '#0f172a' : 'transparent',
    color: active ? '#fff' : '#64748b',
    transition: 'all 0.15s',
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: 4 }}>
          <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>Users</button>
          {canManage && <button style={tabStyle(tab === 'roles')} onClick={() => setTab('roles')}>Roles &amp; Permissions</button>}
        </div>
        {tab === 'users' && canManage && (
          <button style={s.btn} onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowModal(true); }}>+ Add User</button>
        )}
        {tab === 'roles' && isAdmin && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {permsSaved  && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Saved</span>}
            {permsError  && <span style={{ fontSize: 13, color: '#dc2626' }}>{permsError}</span>}
            <button onClick={savePerms} disabled={!hasPermChanges || permsSaving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: hasPermChanges ? 'pointer' : 'not-allowed',
                background: hasPermChanges ? '#0f172a' : '#94a3b8', color: '#fff', fontWeight: 600, fontSize: 13 }}>
              {permsSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* ══ Users Tab ══ */}
      {tab === 'users' && (
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
              : users.map(u => (
                <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(u)}>
                  <td style={s.td}><span style={s.tagLink}>{u.full_name}</span></td>
                  <td style={s.td}>{u.email}</td>
                  <td style={s.td}>{u.department || '—'}</td>
                  <td style={s.td}><span style={badge(ROLE_COLORS[u.role] || '#64748b')}>{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td style={s.td}>{(u as any).employee_id || '—'}</td>
                  <td style={s.td}>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {/* ══ Roles Tab ══ */}
      {tab === 'roles' && (
        permsLoading ? <div style={{ padding: 40, color: '#64748b' }}>Loading permissions…</div> : (
          <>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, marginTop: 0 }}>
              Define what each role can do. Super Admin permissions are locked and cannot be changed.
            </p>
            <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.3)' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8, width: '40%' }}>
                      Permission
                    </th>
                    {ROLES_LIST.map(role => (
                      <th key={role} style={{ padding: '14px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        <div>{ROLE_LABELS[role]}</div>
                        {role === 'admin' && <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginTop: 2 }}>locked</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((perm, idx) => (
                    <tr key={perm.key} style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{perm.label}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{perm.description}</div>
                      </td>
                      {ROLES_LIST.map(role => {
                        const allowed = draft[role]?.[perm.key] ?? false;
                        const locked  = role === 'admin' || !isAdmin;
                        return (
                          <td key={role} style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <button onClick={() => toggle(role, perm.key)}
                              style={{ width: 44, height: 24, borderRadius: 12, border: 'none',
                                cursor: locked ? 'default' : 'pointer',
                                background: allowed ? '#22c55e' : '#e2e8f0',
                                position: 'relative', transition: 'background 0.2s',
                                opacity: locked && role !== 'admin' ? 0.6 : 1 }}>
                              <span style={{ position: 'absolute', top: 3, left: allowed ? 23 : 3,
                                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isAdmin && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16, textAlign: 'center' }}>
                Only admins can modify permissions.
              </p>
            )}
          </>
        )
      )}

      {/* ══ User Detail Modal ══ */}
      {selected && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && closeDetail()}>
          <div style={s.detailModal}>
            <button style={s.closeBtn} onClick={closeDetail}>×</button>
            <div style={s.detailHeader}>
              <div style={{ marginBottom: 10 }}>
                <span style={{ ...badge(ROLE_COLORS[selected.role] || '#64748b'), fontSize: 12 }}>{ROLE_LABELS[selected.role] || selected.role}</span>
              </div>
              <div style={s.detailName}>{selected.full_name}</div>
              <div style={s.detailEmail}>{selected.email}</div>
            </div>
            <div style={s.detailBody}>
              {editSaved && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14 }}>✓ Changes saved successfully.</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ ...s.sectionTitle, marginTop: 0 }}>User Information</div>
                {!editMode && me?.id !== selected.id && (isAdmin || selected.role !== 'admin') && (
                  <button style={{ ...s.btnBlue, padding: '6px 14px', fontSize: 12 }} onClick={() => openEdit(selected)}>✎ Edit / Change Role</button>
                )}
              </div>
              {editMode ? (
                <form onSubmit={handleEditSave}>
                  {editError && <div style={s.errorBox}>{editError}</div>}
                  <div style={s.row2}>
                    <div><label style={s.label}>Full Name</label><input style={s.field} value={editForm.full_name} onChange={setE('full_name')} /></div>
                    <div><label style={s.label}>Department</label><input style={s.field} value={editForm.department} onChange={setE('department')} /></div>
                  </div>
                  <div style={s.row2}>
                    <div><label style={s.label}>Employee ID</label><input style={s.field} value={editForm.employee_id} onChange={setE('employee_id')} /></div>
                    <div>
                      <label style={s.label}>Role</label>
                      <select style={{ ...s.field, color: ROLE_COLORS[editForm.role] || '#374151', fontWeight: 600 }} value={editForm.role} onChange={setE('role')}>
                        <option value="user">User</option>
                        <option value="manager">Admin</option>
                        {isAdmin && <option value="admin">Super Admin</option>}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button type="button" style={s.btnGhost} onClick={() => setEditMode(false)}>Cancel</button>
                    <button type="submit" style={s.btnBlue} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                </form>
              ) : (
                <div style={s.detailGrid}>
                  <DetailRow label="Full Name"   value={selected.full_name} />
                  <DetailRow label="Email"       value={selected.email} />
                  <DetailRow label="Department"  value={selected.department} />
                  <DetailRow label="Employee ID" value={(selected as any).employee_id} />
                  <DetailRow label="Role"        value={ROLE_LABELS[selected.role] || selected.role} />
                  <DetailRow label="Status"      value={selected.is_active ? 'Active' : 'Inactive'} />
                  <DetailRow label="Created"     value={new Date(selected.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
                </div>
              )}
              {me?.id !== selected.id && !editMode && (isAdmin || selected.role !== 'admin') && (
                <>
                  <div style={s.sectionTitle}>Danger Zone</div>
                  {confirmDeactivate ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>Deactivate this user?</span>
                      <button style={s.btnRed} disabled={deactivating} onClick={handleDeactivate}>{deactivating ? 'Deactivating…' : 'Yes, Deactivate'}</button>
                      <button style={s.btnGhost} onClick={() => setConfirmDeactivate(false)}>Cancel</button>
                    </div>
                  ) : (
                    <button style={{ ...s.btnGhost, color: '#ef4444', border: '1px solid #fecaca' }} onClick={() => setConfirmDeactivate(true)}>Deactivate User</button>
                  )}
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button style={s.btnGhost} onClick={closeDetail}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Add User Modal ══ */}
      {showModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Add New User</div>
            {formError && <div style={s.error}>{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div style={s.row2}>
                <div><label style={s.label}>Full Name *</label><input style={s.field} value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" required /></div>
                <div><label style={s.label}>Email *</label><input style={s.field} type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" required /></div>
              </div>
              <div style={s.row2}>
                <div><label style={s.label}>Password *</label><input style={s.field} type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" required /></div>
                <div><label style={s.label}>Confirm Password *</label><input style={s.field} type="password" value={form.confirm_password} onChange={set('confirm_password')} placeholder="Repeat password" required /></div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Role</label>
                  <select style={s.field} value={form.role} onChange={set('role')}>
                    <option value="user">User</option>
                    <option value="manager">Admin</option>
                    {isAdmin && <option value="admin">Super Admin</option>}
                  </select>
                </div>
                <div><label style={s.label}>Department</label><input style={s.field} value={form.department} onChange={set('department')} placeholder="e.g. Engineering" /></div>
              </div>
              <label style={s.label}>Employee ID</label>
              <input style={s.field} value={form.employee_id} onChange={set('employee_id')} placeholder="e.g. EMP-042" />
              <div style={s.actions}>
                <button type="button" style={{ ...s.btnGhost, padding: '8px 18px' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" style={s.btnBlue} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
