import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

const styles: Record<string, React.CSSProperties> = {
  page:    { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden' },
  pageBg:  { position: 'fixed', inset: 0, backgroundImage: 'url(/impress-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(2px)', transform: 'scale(1.03)', zIndex: 0 },
  card:    { background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 16, padding: '40px 36px', boxShadow: '0 8px 40px rgba(0,0,0,0.15)', width: '100%', maxWidth: 400, border: '1px solid rgba(255,255,255,0.6)', position: 'relative', zIndex: 1 },
  title:   { fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#0f172a' },
  sub:     { fontSize: 14, color: '#64748b', marginBottom: 28 },
  label:   { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input:   { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: 'border-box' },
  button:  { width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  error:   { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  success: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  back:    { display: 'block', textAlign: 'center', marginTop: 18, fontSize: 13, color: '#3b82f6', textDecoration: 'none' },
};

export default function ResetPasswordPage() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const token                   = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  if (!token) {
    return (
      <div style={styles.page}>
        <div style={styles.pageBg} />
        <div style={styles.card}>
          <div style={styles.error}>Invalid or missing reset token. Please request a new link.</div>
          <Link to="/forgot-password" style={styles.back}>Request new link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid or expired reset link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.pageBg} />
      <div style={styles.card}>
        <h1 style={styles.title}>Set New Password</h1>
        <p style={styles.sub}>Choose a new password for your account.</p>

        {error && <div style={styles.error}>{error}</div>}

        {done ? (
          <div style={styles.success}>
            ✓ Password reset successfully! Redirecting to sign in…
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={styles.label}>New Password</label>
            <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required autoFocus />
            <label style={styles.label}>Confirm Password</label>
            <input style={styles.input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" required />
            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Reset Password'}
            </button>
          </form>
        )}

        <Link to="/login" style={styles.back}>← Back to Sign In</Link>
      </div>
    </div>
  );
}
