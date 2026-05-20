import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.pageBg} />
      <div style={styles.card}>
        <h1 style={styles.title}>Forgot Password</h1>
        <p style={styles.sub}>Enter your email and we'll send you a reset link.</p>

        {error && <div style={styles.error}>{error}</div>}

        {sent ? (
          <div style={styles.success}>
            ✓ If that email is registered, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required autoFocus />
            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <Link to="/login" style={styles.back}>← Back to Sign In</Link>
      </div>
    </div>
  );
}
