import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { reportsApi, notificationsApi, notificationSettingsApi, NotificationConfig, subscriptionsApi } from '../services/api';

const staticNavItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/purchases', label: 'Purchases' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/reports', label: 'Reports' },
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
  bgLayer: {
    position: 'fixed', inset: 0,
    backgroundImage: 'url(/impress-bg.png)',
    backgroundSize: 'cover', backgroundPosition: 'center',
    filter: 'blur(2px)', transform: 'scale(1.03)', zIndex: -1,
  },
  contentInner: { position: 'relative', padding: 32 },
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
  id: string; asset_id: string; asset_tag: string; name: string; category: string;
  date: string; daysLeft: number;
  type: 'license' | 'warranty' | 'overdue' | 'subscription';
  assignee_name?: string; employee_id?: string; designation?: string; department?: string;
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<string[]>([]);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  /* inactivity auto-logout */
  const IDLE_MS      = 60 * 60 * 1000;   // 1 hour
  const WARN_MS      = 55 * 60 * 1000;   // warn at 55 min
  const [showIdleWarn, setShowIdleWarn] = useState(false);
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* notifications */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [notifConfig, setNotifConfig] = useState<NotificationConfig | null>(null);
  const [notifConfigDraft, setNotifConfigDraft] = useState<NotificationConfig | null>(null);
  const [notifConfigSaving, setNotifConfigSaving] = useState(false);
  const [notifConfigSaved, setNotifConfigSaved] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_seen') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    reportsApi.summary().then((s) => {
      setCategories(Object.keys(s.by_category || {}));
    }).catch(() => {});

    // Load notification settings then fetch notifications using configured days
    notificationSettingsApi.get().then(cfg => {
      setNotifConfig(cfg);
      setNotifConfigDraft(cfg);

      const now = Date.now();
      const fetches = [
        cfg.license_enabled  ? notificationsApi.softwareExpiring(cfg.license_days)        : Promise.resolve(null),
        cfg.warranty_enabled ? notificationsApi.warrantyExpiring(cfg.warranty_days)       : Promise.resolve(null),
        cfg.overdue_enabled  ? notificationsApi.overdueAssignments()                      : Promise.resolve(null),
        cfg.license_enabled  ? subscriptionsApi.expiring(cfg.license_days)                : Promise.resolve(null),
      ];

      Promise.allSettled(fetches).then(([sw, wa, ov, subs]) => {
        const items: NotifItem[] = [];
        if (sw.status === 'fulfilled' && sw.value) {
          sw.value.assets.forEach((a: any) => {
            const daysLeft = Math.ceil((new Date(a.expiry_date).getTime() - now) / 86400000);
            items.push({ id: a.id, asset_id: a.id, asset_tag: a.asset_tag, name: a.name, category: a.category, date: a.expiry_date, daysLeft, type: 'license' });
          });
        }
        if (wa.status === 'fulfilled' && wa.value) {
          wa.value.assets.forEach((a: any) => {
            const daysLeft = Math.ceil((new Date(a.warranty_expiry_date).getTime() - now) / 86400000);
            items.push({ id: a.id, asset_id: a.id, asset_tag: a.asset_tag, name: a.name, category: a.category, date: a.warranty_expiry_date, daysLeft, type: 'warranty' });
          });
        }
        if (ov.status === 'fulfilled' && ov.value) {
          ov.value.assignments.forEach((a: any) => {
            items.push({
              id: a.assignment_id, asset_id: a.asset_id, asset_tag: a.asset_tag, name: a.asset_name,
              category: a.category, date: a.expected_return_date,
              daysLeft: -a.days_overdue,
              type: 'overdue',
              assignee_name: a.assignee_name, employee_id: a.employee_id,
              designation: a.designation, department: a.department,
            });
          });
        }
        if (subs.status === 'fulfilled' && subs.value) {
          subs.value.subscriptions.forEach((s: any) => {
            items.push({
              id: s.id, asset_id: s.id, asset_tag: s.vendor || '—',
              name: s.name, category: s.category || 'Subscription',
              date: s.renewal_date, daysLeft: s.days_left, type: 'subscription',
            });
          });
        }
        items.sort((a, b) => a.daysLeft - b.daysLeft);
        setNotifications(items);

        if (cfg.email_enabled && items.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          if (localStorage.getItem('last_alert_email_date') !== today) {
            (notificationsApi as any).sendAlerts(Math.max(cfg.warranty_days, cfg.license_days))
              .then(() => localStorage.setItem('last_alert_email_date', today))
              .catch(() => {});
          }
        }
      });
    }).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setAssetsOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const reset = () => {
      setShowIdleWarn(false);
      if (warnTimer.current)  clearTimeout(warnTimer.current);
      if (idleTimer.current)  clearTimeout(idleTimer.current);
      warnTimer.current = setTimeout(() => setShowIdleWarn(true), WARN_MS);
      idleTimer.current = setTimeout(() => handleLogout(), IDLE_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []); // eslint-disable-line

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
                        : n.daysLeft < 0 ? `${-n.daysLeft}d ago`
                        : n.daysLeft === 0 ? 'Today' : `${n.daysLeft}d`;
                      const subtitle = n.type === 'overdue'
                        ? `Not returned · due ${n.date}`
                        : n.type === 'license'
                          ? (n.daysLeft < 0 ? `License expired: ${n.date}` : `License expires: ${n.date}`)
                          : n.type === 'subscription'
                            ? (n.daysLeft < 0 ? `Subscription expired: ${n.date}` : `Renewal due: ${n.date}`)
                            : (n.daysLeft < 0 ? `Warranty expired: ${n.date}` : `Warranty expires: ${n.date}`);
                      return (
                        <div
                          key={`${n.type}-${n.id}`}
                          onClick={() => { navigate(n.type === 'subscription' ? '/subscriptions' : `/assets?open=${n.asset_id}`); setNotifOpen(false); }}
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

          {/* ── Profile Dropdown ── */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 8px', borderRadius: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg,#ea580c,#f97316)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>{user?.full_name}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>
                  {({ admin: 'Super Admin', manager: 'Admin', user: 'User', SUBSCRIPTION_MANAGER: 'Subscription Manager' } as Record<string, string>)[user?.role ?? ''] ?? user?.role}
                </div>
              </div>
              <span style={{ fontSize: 10, color: '#64748b', marginLeft: 2 }}>{profileOpen ? '▲' : '▼'}</span>
            </button>

            {profileOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
                background: '#fff', borderRadius: 10,
                boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
                border: '1px solid #e2e8f0',
                minWidth: 160, overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{user?.full_name}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{user?.email}</div>
                </div>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/users'); }}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%',
                    padding: '10px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151',
                    textAlign: 'left', borderBottom: '1px solid #f1f5f9',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  Users & Roles
                </button>
                <button
                  onClick={() => { setProfileOpen(false); setNotifConfigDraft(notifConfig ? { ...notifConfig } : null); setNotifConfigSaved(false); setShowNotifSettings(true); }}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%',
                    padding: '10px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151',
                    textAlign: 'left', borderBottom: '1px solid #f1f5f9',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  Notification Settings
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '10px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#ef4444',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative', overflowY: 'auto' }}>
        <div style={styles.contentInner}>
          <Outlet />
        </div>
      </div>

      {/* ── Notification Settings Modal ── */}
      {showNotifSettings && notifConfigDraft && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 48px rgba(0,0,0,0.22)' }}>
            <div style={{ background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', borderRadius: '14px 14px 0 0', padding: '20px 24px', color: '#fff' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Notification Settings</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Configure what alerts you receive and when</div>
            </div>
            <div style={{ padding: '24px' }}>
              {notifConfigSaved && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 16 }}>✓ Settings saved.</div>}

              {/* Warranty */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Warranty Expiry</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Alert when warranty is nearing expiry</div>
                  </div>
                  <button onClick={() => setNotifConfigDraft(d => d ? { ...d, warranty_enabled: !d.warranty_enabled } : d)}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: notifConfigDraft.warranty_enabled ? '#22c55e' : '#e2e8f0', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: 3, left: notifConfigDraft.warranty_enabled ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {notifConfigDraft.warranty_enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Notify within</span>
                    <select value={notifConfigDraft.warranty_days} onChange={e => setNotifConfigDraft(d => d ? { ...d, warranty_days: Number(e.target.value) } : d)}
                      style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                      {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: '#64748b' }}>of expiry</span>
                  </div>
                )}
              </div>

              {/* License */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>License / Subscription Expiry</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Alert when software licenses are nearing expiry</div>
                  </div>
                  <button onClick={() => setNotifConfigDraft(d => d ? { ...d, license_enabled: !d.license_enabled } : d)}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: notifConfigDraft.license_enabled ? '#22c55e' : '#e2e8f0', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: 3, left: notifConfigDraft.license_enabled ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {notifConfigDraft.license_enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Notify within</span>
                    <select value={notifConfigDraft.license_days} onChange={e => setNotifConfigDraft(d => d ? { ...d, license_days: Number(e.target.value) } : d)}
                      style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                      {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: '#64748b' }}>of expiry</span>
                  </div>
                )}
              </div>

              {/* Overdue */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Overdue Assignments</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Alert when asset returns are past due</div>
                  </div>
                  <button onClick={() => setNotifConfigDraft(d => d ? { ...d, overdue_enabled: !d.overdue_enabled } : d)}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: notifConfigDraft.overdue_enabled ? '#22c55e' : '#e2e8f0', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: 3, left: notifConfigDraft.overdue_enabled ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {notifConfigDraft.overdue_enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Alert after</span>
                    <input
                      type="number" min={0} max={365}
                      value={notifConfigDraft.overdue_threshold_days}
                      onChange={e => setNotifConfigDraft(d => d ? { ...d, overdue_threshold_days: Math.max(0, Number(e.target.value)) } : d)}
                      style={{ width: 60, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 12, color: '#64748b' }}>days past due date (0 = immediately)</span>
                  </div>
                )}
              </div>

              {/* Asset Event Notifications */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Asset Event Emails</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Send email to assignee when an asset event occurs</div>
                {([
                  { key: 'notify_on_asset_created',  label: 'Asset Added',    desc: 'Notify all users when a new asset is added' },
                  { key: 'notify_on_asset_assigned',  label: 'Asset Assigned', desc: 'Notify assignee when an asset is assigned to them' },
                  { key: 'notify_on_asset_returned',  label: 'Asset Returned', desc: 'Notify assignee when an asset is marked returned' },
                  { key: 'notify_on_asset_deleted',   label: 'Asset Deleted',  desc: 'Notify all users when an asset is removed' },
                ] as { key: keyof NotificationConfig; label: string; desc: string }[]).map(({ key, label, desc }) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{desc}</div>
                    </div>
                    <button onClick={() => setNotifConfigDraft(d => d ? { ...d, [key]: !d[key] } : d)}
                      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
                        background: notifConfigDraft[key] ? '#22c55e' : '#e2e8f0', position: 'relative', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 3, left: notifConfigDraft[key] ? 23 : 3,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Email Alert Summary */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 18, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Scheduled Email Alerts</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Periodic digest for warranty/license/overdue alerts</div>
                  </div>
                  <button onClick={() => setNotifConfigDraft(d => d ? { ...d, email_enabled: !d.email_enabled } : d)}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: notifConfigDraft.email_enabled ? '#22c55e' : '#e2e8f0', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: 3, left: notifConfigDraft.email_enabled ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {notifConfigDraft.email_enabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Recipients */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748b', minWidth: 70 }}>Recipients</span>
                      <select
                        value={notifConfigDraft.email_recipients}
                        onChange={e => setNotifConfigDraft(d => d ? { ...d, email_recipients: e.target.value } : d)}
                        style={{ flex: 1, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                      >
                        <option value="all">All Users</option>
                        <option value="managers_and_admins">Managers &amp; Admins only</option>
                        <option value="admins_only">Admins only</option>
                      </select>
                    </div>
                    {/* Frequency */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#64748b', minWidth: 70 }}>Frequency</span>
                      <select
                        value={notifConfigDraft.email_frequency}
                        onChange={e => setNotifConfigDraft(d => d ? { ...d, email_frequency: e.target.value } : d)}
                        style={{ flex: 1, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="on_demand">On-demand only</option>
                      </select>
                    </div>
                    {/* Weekday picker (only for weekly) */}
                    {notifConfigDraft.email_frequency === 'weekly' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b', minWidth: 70 }}>Day</span>
                        <select
                          value={notifConfigDraft.email_weekly_day}
                          onChange={e => setNotifConfigDraft(d => d ? { ...d, email_weekly_day: Number(e.target.value) } : d)}
                          style={{ flex: 1, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                        >
                          {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day, i) => (
                            <option key={i} value={i}>{day}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {/* Send hour (only for daily/weekly) */}
                    {notifConfigDraft.email_frequency !== 'on_demand' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b', minWidth: 70 }}>Send at</span>
                        <select
                          value={notifConfigDraft.email_send_hour}
                          onChange={e => setNotifConfigDraft(d => d ? { ...d, email_send_hour: Number(e.target.value) } : d)}
                          style={{ flex: 1, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                        >
                          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00 IST</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNotifSettings(false)}
                  style={{ padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button disabled={notifConfigSaving} onClick={async () => {
                  if (!notifConfigDraft) return;
                  setNotifConfigSaving(true);
                  try {
                    const saved = await notificationSettingsApi.update(notifConfigDraft);
                    setNotifConfig(saved);
                    setNotifConfigDraft(saved);
                    setNotifConfigSaved(true);
                    setTimeout(() => setNotifConfigSaved(false), 3000);
                  } catch {}
                  setNotifConfigSaving(false);
                }}
                  style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {notifConfigSaving ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Idle Warning Modal ── */}
      {showIdleWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px 28px', width: 360, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏱</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Still there?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
              You'll be signed out in <strong>5 minutes</strong> due to inactivity.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setShowIdleWarn(false)}
                style={{ padding: '9px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Stay Signed In
              </button>
              <button
                onClick={handleLogout}
                style={{ padding: '9px 24px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Sign Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
