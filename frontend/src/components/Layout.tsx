import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/assets', label: 'Assets' },
  { to: '/purchases', label: 'Purchases' },
  { to: '/reports', label: 'Reports' },
  { to: '/users', label: 'Users' },
];

const styles: Record<string, React.CSSProperties> = {
  root:    { display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', position: 'relative' },
  header:  {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 56, padding: '0 24px 0 0',
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    borderBottom: '1px solid rgba(255,255,255,0.5)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
    position: 'sticky', top: 0, zIndex: 100,
    flexShrink: 0,
  },
  userInfo:  { fontSize: 13, color: '#1e293b', fontWeight: 500 },
  logoutBtn: {
    padding: '6px 14px', background: '#ef4444', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  body:    { display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' },
  sidebar: {
    width: 200,
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    display: 'flex', flexDirection: 'column',
    padding: '16px 0', flexShrink: 0, zIndex: 10,
    borderRight: '1px solid rgba(255,255,255,0.3)',
    boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.1)',
  },
  navLink:    { display: 'block', padding: '10px 20px', color: '#1e293b', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  activeLink: { color: '#ea580c', background: 'rgba(234,88,12,0.1)', borderLeft: '3px solid #ea580c', fontWeight: 600 },
  /* content wrapper — relative so the fixed bg stays beneath it */
  contentWrap: { flex: 1, position: 'relative', overflowY: 'auto' },
  /* blurred wallpaper layer — sits behind everything */
  bgLayer: {
    position: 'fixed', inset: 0,
    backgroundImage: 'url(/impress-bg.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(2px)',
    transform: 'scale(1.03)',
    zIndex: 0,
  },
  /* page content — sits above the blurred bg */
  contentInner: { position: 'relative', zIndex: 1, padding: 32 },
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <img src="/impress-logo.jpeg" alt="Impress" style={{ height: 56, objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={styles.userInfo}>{user?.full_name} &nbsp;·&nbsp; {user?.role}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div style={styles.body}>
        {/* shared blurred wallpaper behind sidebar + content */}
        <div style={styles.bgLayer} />

        <nav style={styles.sidebar}>
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.activeLink : {}) })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.contentWrap}>
          <div style={styles.contentInner}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
