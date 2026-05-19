import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { reportsApi, notificationsApi } from '../services/api';

const staticNavItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/purchases', label: 'Purchases' },
  { to: '/reports', label: 'Reports' },
  { to: '/users', label: 'Users' },
];

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', position: 'relative' },
  header: {
    display: 'flex', alignItems: 'center',
    height: 56, padding: '0 24px',
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    borderBottom: '1px solid rgba(255,255,255,0.5)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
    position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
  },
  nav: { display: 'flex', alignItems: 'stretch', flex: 1, marginLeft: 24, height: '100%' },
  navLink: {
    display: 'flex', alignItems: 'center',
    padding: '0 18px', color: '#1e293b',
    textDecoration: 'none', fontSize: 14, fontWeight: 500,
    borderBottom: '3px solid transparent',
    transition: 'color 0.15s', whiteSpace: 'nowrap',
  },
  activeLink: { color: '#ea580c', borderBottom: '3px solid #ea580c', fontWeight: 700 },
  userInfo: { fontSize: 13, color: '#1e293b', fontWeight: 500, whiteSpace: 'nowrap' },
  logoutBtn: {
    marginLeft: 14, padding: '6px 14px', background: '#ef4444', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  bgLayer: {
    position: 'fixed', inset: 0,
    backgroundImage: 'url(/impress-bg.png)',
    backgroundSize: 'cover', backgroundPosition: 'center',
    filter: 'blur(2px)', transform: 'scale(1.03)', zIndex: 0,
  },
  contentInner: { position: 'relative', zIndex: 1, padding: 32 },
};

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

interface NotifItem {
  id: string; asset_tag: string; name: string; category: string;
  date: string; daysLeft: number;
  type: 'license' | 'warranty' | 'overdue';
  assignee_name?: string; employee_id?: string; designation?: string; department?: string;
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* notifications */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_seen') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    reportsApi.summary().then((s) => {
      setCategories(Object.keys(s.by_category || {}));
    }).catch(() => {});

    const now = Date.now();
    Promise.allSettled([
      notificationsApi.softwareExpiring(30),
      notificationsApi.warrantyExpiring(30),
      notificationsApi.overdueAssignments(),
    ]).then(([sw, wa, ov]) => {
      const items: NotifItem[] = [];
      if (sw.status === 'fulfilled') {
        sw.value.assets.forEach((a: any) => {
          const daysLeft = Math.ceil((new Date(a.expiry_date).getTime() - now) / 86400000);
          items.push({ id: a.id, asset_tag: a.asset_tag, name: a.name, category: a.category, date: a.expiry_date, daysLeft, type: 'license' });
        });
      }
      if (wa.status === 'fulfilled') {
        wa.value.assets.forEach((a: any) => {
          const daysLeft = Math.ceil((new Date(a.warranty_expiry_date).getTime() - now) / 86400000);
          items.push({ id: a.id, asset_tag: a.asset_tag, name: a.name, category: a.category, date: a.warranty_expiry_date, daysLeft, type: 'warranty' });
        });
      }
      if (ov.status === 'fulfilled') {
        ov.value.assignments.forEach((a: any) => {
          items.push({
            id: a.assignment_id, asset_tag: a.asset_tag, name: a.asset_name,
            category: a.category, date: a.expected_return_date,
            daysLeft: -a.days_overdue,
            type: 'overdue',
            assignee_name: a.assignee_name, employee_id: a.employee_id,
            designation: a.designation, department: a.department,
          });
        });
      }
      items.sort((a, b) => a.daysLeft - b.daysLeft);
      setNotifications(items);
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setAssetsOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const notifKey  = (n: NotifItem) => `${n.type}-${n.id}-${n.date}`;
  const unseenCount = notifications.filter(n => !seenIds.has(notifKey(n))).length;

  const openNotif = () => {
    setNotifOpen(true);
    if (notifications.length > 0) {
      const updated = new Set(seenIds);
      notifications.forEach(n => updated.add(notifKey(n)));
      setSeenIds(updated);
      localStorage.setItem('notif_seen', JSON.stringify([...updated]));
    }
  };

  const urgentColor = (n: NotifItem) => {
    if (n.type === 'overdue') return '#ef4444';
    return n.daysLeft <= 7 ? '#ef4444' : n.daysLeft <= 14 ? '#f59e0b' : '#3b82f6';
  };

  return (
    <div style={styles.root}>
      <div style={styles.bgLayer} />

      <header style={styles.header}>
        <img src="/impress-logo.jpeg" alt="Impress" style={{ height: 56, objectFit: 'contain', flexShrink: 0 }} />

        <nav style={styles.nav}>
          <NavLink to="/dashboard"
            style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.activeLink : {}) })}>
            Dashboard
          </NavLink>

          <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
            <NavLink
              to="/assets"
              style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.activeLink : {}) })}
              onClick={() => setAssetsOpen(false)}
            >
              Assets ▾
            </NavLink>
            <div style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} onMouseEnter={() => setAssetsOpen(true)} />
            {assetsOpen && (
              <div
                onMouseLeave={() => setAssetsOpen(false)}
                style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 200,
                  background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.6)', borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  minWidth: 180, overflow: 'hidden', paddingTop: 6, paddingBottom: 6,
                }}
              >
                <button onClick={() => { navigate('/assets'); setAssetsOpen(false); }} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 18px', fontSize: 13, fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a',
                  borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 4,
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(234,88,12,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  All Assets
                </button>
                {categories.map((cat) => (
                  <button key={cat} onClick={() => { navigate(`/assets?category=${encodeURIComponent(cat)}`); setAssetsOpen(false); }} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 18px', fontSize: 13, fontWeight: 500,
                    background: 'none', border: 'none', cursor: 'pointer', color: '#374151',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(234,88,12,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {staticNavItems.slice(1).map(({ to, label }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.activeLink : {}) })}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>

          {/* ── Notification Bell ── */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              onClick={() => notifOpen ? setNotifOpen(false) : openNotif()}
              style={{
                position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
                color: unseenCount > 0 ? '#f59e0b' : '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              title="Notifications"
            >
              <BellIcon />
              {unseenCount > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  background: '#ef4444', color: '#fff',
                  fontSize: 10, fontWeight: 700, lineHeight: 1,
                  borderRadius: 10, minWidth: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', border: '2px solid white',
                }}>
                  {unseenCount > 9 ? '9+' : unseenCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
                background: '#fff', borderRadius: 14,
                boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                border: '1px solid #e2e8f0',
                width: 340, maxHeight: 480, overflowY: 'auto',
              }}>
                {/* Header */}
                <div style={{
                  padding: '14px 18px 10px', borderBottom: '1px solid #f1f5f9',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Notifications</span>
                  {unseenCount > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', background: '#fef2f2', borderRadius: 20, padding: '2px 8px' }}>
                      {unseenCount} new
                    </span>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 18px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    All clear — no expiry alerts
                  </div>
                ) : (
                  <div>
                    {notifications.map((n) => {
                      const color = urgentColor(n);
                      const daysLabel = n.type === 'overdue'
                        ? `${-n.daysLeft}d overdue`
                        : n.daysLeft <= 0 ? 'Today' : `${n.daysLeft}d`;
                      const subtitle = n.type === 'overdue'
                        ? `Not returned · due ${n.date}`
                        : n.type === 'license' ? `License expires: ${n.date}`
                        : `Warranty expires: ${n.date}`;
                      return (
                        <div
                          key={`${n.type}-${n.id}`}
                          onClick={() => { navigate('/assets'); setNotifOpen(false); }}
                          style={{
                            padding: '12px 18px', borderBottom: '1px solid #f8fafc',
                            cursor: 'pointer', transition: 'background 0.12s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                {!seenIds.has(notifKey(n)) && (
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0, display: 'inline-block' }} />
                                )}
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {n.name}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {n.asset_tag} · {n.category}
                              </div>
                              {n.type === 'overdue' && n.assignee_name && (
                                <div style={{ fontSize: 11, color: '#374151', marginTop: 1 }}>
                                  {n.assignee_name}
                                  {n.employee_id ? ` (${n.employee_id})` : ''}
                                  {n.designation ? ` · ${n.designation}` : ''}
                                  {n.department ? ` · ${n.department}` : ''}
                                </div>
                              )}
                              <div style={{ fontSize: 11, color, marginTop: 2, fontWeight: 500 }}>
                                {subtitle}
                              </div>
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 8px',
                                borderRadius: 12, fontSize: 11, fontWeight: 700,
                                background: color + '18', color,
                              }}>
                                {daysLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <button onClick={() => { navigate('/dashboard'); setNotifOpen(false); }} style={{
                    fontSize: 12, color: '#3b82f6', fontWeight: 600,
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}>
                    View all in Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>

          <span style={styles.userInfo}>{user?.full_name} &nbsp;·&nbsp; {user?.role}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative', overflowY: 'auto' }}>
        <div style={styles.contentInner}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
