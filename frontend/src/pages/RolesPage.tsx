import React, { useEffect, useState } from 'react';
import { rolePermissionsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: 'create_asset',  label: 'Create Asset',   description: 'Add new assets to the inventory' },
  { key: 'edit_asset',    label: 'Edit Asset',     description: 'Modify asset details and status' },
  { key: 'delete_asset',  label: 'Delete Asset',   description: 'Permanently remove assets' },
  { key: 'assign_asset',  label: 'Assign Asset',   description: 'Assign assets to users' },
  { key: 'return_asset',  label: 'Return Asset',   description: 'Mark assigned assets as returned' },
  { key: 'import_assets', label: 'Import CSV',     description: 'Bulk import assets via CSV upload' },
  { key: 'export_assets', label: 'Export CSV',     description: 'Export asset list to CSV' },
  { key: 'view_reports',  label: 'View Reports',   description: 'Access the Reports page' },
  { key: 'manage_users',  label: 'Manage Users',   description: 'Create and edit user accounts' },
];

const ROLES = ['admin', 'manager', 'user'] as const;
type RoleKey = typeof ROLES[number];

const ROLE_LABELS: Record<RoleKey, string> = {
  admin:   'Admin',
  manager: 'Manager',
  user:    'User',
};

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
};

export default function RolesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [perms, setPerms]     = useState<Record<string, Record<string, boolean>>>({});
  const [draft, setDraft]     = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    rolePermissionsApi.get().then(data => {
      setPerms(data);
      setDraft(JSON.parse(JSON.stringify(data)));
      setLoading(false);
    }).catch(() => { setError('Failed to load permissions.'); setLoading(false); });
  }, []);

  const toggle = (role: string, key: string) => {
    if (!isAdmin || role === 'admin') return;
    setDraft(prev => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role]?.[key] },
    }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await rolePermissionsApi.update(draft);
      setPerms(JSON.parse(JSON.stringify(draft)));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save permissions.');
    } finally { setSaving(false); }
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(perms);

  if (loading) return <div style={{ padding: 40, color: '#64748b' }}>Loading permissions…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Roles & Permissions</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
            Define what each role can do. Admin permissions are locked and cannot be changed.
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saved && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Saved</span>}
            {error && <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>}
            <button
              onClick={save}
              disabled={!hasChanges || saving}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: hasChanges ? 'pointer' : 'not-allowed',
                background: hasChanges ? '#0f172a' : '#94a3b8', color: '#fff', fontWeight: 600, fontSize: 13,
              }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div style={{ ...glass, borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.3)' }}>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8, width: '40%' }}>
                Permission
              </th>
              {ROLES.map(role => (
                <th key={role} style={{ padding: '14px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  <div>{ROLE_LABELS[role]}</div>
                  {role === 'admin' && (
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginTop: 2 }}>locked</div>
                  )}
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
                {ROLES.map(role => {
                  const allowed = draft[role]?.[perm.key] ?? false;
                  const locked  = role === 'admin' || !isAdmin;
                  return (
                    <td key={role} style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggle(role, perm.key)}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none',
                          cursor: locked ? 'default' : 'pointer',
                          background: allowed ? '#22c55e' : '#e2e8f0',
                          position: 'relative', transition: 'background 0.2s',
                          opacity: locked && role !== 'admin' ? 0.6 : 1,
                        }}
                        title={locked && role !== 'admin' ? 'Only admins can change permissions' : undefined}
                      >
                        <span style={{
                          position: 'absolute', top: 3, left: allowed ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                        }} />
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
          You have read-only access to this page. Only admins can modify permissions.
        </p>
      )}
    </div>
  );
}
