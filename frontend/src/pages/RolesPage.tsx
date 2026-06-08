import React, { useEffect, useState } from 'react';
import { rolePermissionsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

// ─── Permission catalogue ─────────────────────────────────────────────────────
const PERMISSION_GROUPS: { label: string; icon: string; items: { key: string; label: string; desc: string }[] }[] = [
  {
    label: 'Asset Management',
    icon: '📦',
    items: [
      { key: 'create_asset',  label: 'Create Asset',  desc: 'Add new assets to the inventory' },
      { key: 'edit_asset',    label: 'Edit Asset',    desc: 'Modify asset details and status' },
      { key: 'delete_asset',  label: 'Delete Asset',  desc: 'Permanently remove assets' },
      { key: 'assign_asset',  label: 'Assign Asset',  desc: 'Assign assets to users' },
      { key: 'return_asset',  label: 'Return Asset',  desc: 'Mark assigned assets as returned' },
    ],
  },
  {
    label: 'Data & Reports',
    icon: '📊',
    items: [
      { key: 'import_assets', label: 'Import CSV',   desc: 'Bulk-import assets via CSV upload' },
      { key: 'export_assets', label: 'Export CSV',   desc: 'Export asset list to CSV' },
      { key: 'view_reports',  label: 'View Reports', desc: 'Access the Reports page' },
    ],
  },
  {
    label: 'Administration',
    icon: '⚙️',
    items: [
      { key: 'manage_users', label: 'Manage Users', desc: 'Create and edit user accounts' },
    ],
  },
];

const ALL_KEYS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    icon: '👑',
    desc: 'Full unrestricted access',
    accent: '#b45309',
    accentBg: '#fef3c7',
    accentBorder: '#fcd34d',
    dot: '#d97706',
  },
  manager: {
    label: 'Manager',
    icon: '🛡️',
    desc: 'Operational access',
    accent: '#1d4ed8',
    accentBg: '#eff6ff',
    accentBorder: '#93c5fd',
    dot: '#3b82f6',
  },
  user: {
    label: 'User',
    icon: '👤',
    desc: 'Standard access',
    accent: '#7c3aed',
    accentBg: '#f5f3ff',
    accentBorder: '#c4b5fd',
    dot: '#8b5cf6',
  },
} as const;

type RoleKey = keyof typeof ROLE_CONFIG;
const ROLES: RoleKey[] = ['admin', 'manager', 'user'];

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, locked, accent, onChange }: {
  on: boolean; locked: boolean; accent: string; onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={locked ? undefined : onChange}
      style={{
        width: 42, height: 23, borderRadius: 12, border: 'none', padding: 0,
        background: on ? accent : '#d1d5db',
        cursor: locked ? 'default' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        flexShrink: 0, opacity: locked ? 0.65 : 1, outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3.5, left: on ? 22 : 3.5,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transition: 'left 0.18s cubic-bezier(.4,0,.2,1)',
        display: 'block',
      }} />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [perms, setPerms]         = useState<Record<string, Record<string, boolean>>>({});
  const [draft, setDraft]         = useState<Record<string, Record<string, boolean>>>({});
  const [activeRole, setActiveRole] = useState<RoleKey>('manager');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    rolePermissionsApi.get()
      .then(data => {
        setPerms(data);
        setDraft(JSON.parse(JSON.stringify(data)));
        setLoading(false);
      })
      .catch(() => { setError('Failed to load permissions.'); setLoading(false); });
  }, []);

  const toggle = (key: string) => {
    if (!isAdmin || activeRole === 'admin') return;
    setDraft(prev => ({
      ...prev,
      [activeRole]: { ...prev[activeRole], [key]: !prev[activeRole]?.[key] },
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
      setError('Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const discard = () => {
    setDraft(JSON.parse(JSON.stringify(perms)));
    setSaved(false);
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(perms);

  // Per-role unsaved count (for sidebar badge)
  const unsavedFor = (role: string) =>
    ALL_KEYS.filter(k => (draft[role]?.[k] ?? false) !== (perms[role]?.[k] ?? false)).length;

  const cfg = ROLE_CONFIG[activeRole];
  const locked = activeRole === 'admin' || !isAdmin;
  const activeEnabledCount = ALL_KEYS.filter(k => draft[activeRole]?.[k]).length;

  if (loading) return (
    <div style={{ padding: 48, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      Loading permissions…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Roles & Permissions</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '5px 0 0' }}>
          Configure what each role can do. Admin permissions are fixed and cannot be modified.
        </p>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Left sidebar ── */}
        <div style={{
          width: 200, flexShrink: 0,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8' }}>
              Roles
            </span>
          </div>

          {ROLES.map(role => {
            const rc = ROLE_CONFIG[role];
            const isActive = role === activeRole;
            const badge = unsavedFor(role);
            return (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                style={{
                  width: '100%', border: 'none', textAlign: 'left',
                  padding: '12px 16px',
                  background: isActive ? rc.accentBg : 'transparent',
                  borderLeft: isActive ? `3px solid ${rc.accent}` : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{rc.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 600,
                    color: isActive ? rc.accent : '#374151',
                    lineHeight: 1.2,
                  }}>
                    {rc.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                    {rc.desc}
                  </div>
                </div>
                {badge > 0 && role !== 'admin' && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9,
                    background: '#f59e0b', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
          }}>

            {/* Panel header */}
            <div style={{
              padding: '18px 24px 16px',
              borderBottom: '1px solid #f1f5f9',
              background: cfg.accentBg,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    {cfg.label} Permissions
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {activeRole === 'admin'
                      ? 'All permissions enabled · Cannot be modified'
                      : `${activeEnabledCount} of ${ALL_KEYS.length} permissions enabled`
                    }
                  </div>
                </div>
              </div>

              {activeRole === 'admin' && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20,
                  background: '#fef3c7', color: '#92400e',
                  border: '1px solid #fcd34d', fontSize: 12, fontWeight: 600,
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="#92400e" strokeWidth="1.2"/>
                    <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="#92400e" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Locked
                </span>
              )}
            </div>

            {/* Permission groups */}
            <div style={{ padding: '8px 0' }}>
              {PERMISSION_GROUPS.map((group, gi) => (
                <div key={group.label}>
                  {/* Group header */}
                  <div style={{
                    padding: `${gi > 0 ? 20 : 12}px 24px 6px`,
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <span style={{ fontSize: 13 }}>{group.icon}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: 0.9, color: '#94a3b8',
                    }}>
                      {group.label}
                    </span>
                    <div style={{ flex: 1, height: 1, background: '#f1f5f9', marginLeft: 4 }} />
                  </div>

                  {/* Permission rows */}
                  {group.items.map(perm => {
                    const allowed = draft[activeRole]?.[perm.key] ?? false;
                    return (
                      <div
                        key={perm.key}
                        onClick={() => toggle(perm.key)}
                        style={{
                          display: 'flex', alignItems: 'center',
                          padding: '11px 24px', gap: 16,
                          cursor: locked ? 'default' : 'pointer',
                          transition: 'background 0.13s',
                          borderBottom: '1px solid #f8fafc',
                        }}
                        onMouseEnter={e => {
                          if (!locked) (e.currentTarget as HTMLDivElement).style.background = cfg.accentBg;
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        }}
                      >
                        {/* Status dot */}
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: allowed ? cfg.dot : '#e2e8f0',
                          boxShadow: allowed ? `0 0 0 3px ${cfg.accentBg}` : 'none',
                          transition: 'background 0.2s',
                        }} />

                        {/* Label + description */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600,
                            color: allowed ? '#0f172a' : '#64748b',
                            transition: 'color 0.15s',
                          }}>
                            {perm.label}
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                            {perm.desc}
                          </div>
                        </div>

                        {/* Toggle or lock */}
                        {activeRole === 'admin' ? (
                          <span style={{ fontSize: 13, color: '#d97706', fontWeight: 700 }}>✓</span>
                        ) : (
                          <Toggle
                            on={allowed}
                            locked={locked}
                            accent={cfg.accent}
                            onChange={() => toggle(perm.key)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Panel footer (save bar) */}
            {isAdmin && activeRole !== 'admin' && (
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid #f1f5f9',
                background: hasChanges ? '#fafafa' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {hasChanges
                    ? <span style={{ color: '#d97706', fontWeight: 600 }}>● Unsaved changes</span>
                    : saved
                      ? <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ All changes saved</span>
                      : 'No pending changes'}
                </div>
                {error && <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>}
                <div style={{ display: 'flex', gap: 10 }}>
                  {hasChanges && (
                    <button
                      onClick={discard}
                      style={{
                        padding: '7px 16px', borderRadius: 8,
                        border: '1.5px solid #e2e8f0',
                        background: '#fff', color: '#64748b',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Discard
                    </button>
                  )}
                  <button
                    onClick={save}
                    disabled={!hasChanges || saving}
                    style={{
                      padding: '7px 20px', borderRadius: 8, border: 'none',
                      background: hasChanges ? cfg.accent : '#e2e8f0',
                      color: hasChanges ? '#fff' : '#94a3b8',
                      fontSize: 13, fontWeight: 600,
                      cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'background 0.2s',
                    }}
                  >
                    {saving
                      ? <><svg style={{ animation: 'spin 1s linear infinite' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Saving…</>
                      : `Save ${cfg.label}`
                    }
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Read-only notice */}
          {!isAdmin && (
            <div style={{
              marginTop: 14, padding: '10px 16px',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6.3" stroke="#94a3b8" strokeWidth="1.2"/>
                <path d="M7 6v4M7 4.5V4" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Read-only view — only admins can modify permissions.
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
