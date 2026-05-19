import React, { useEffect, useState } from 'react';
import { reportsApi } from '../services/api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  stock: '#22c55e', assigned: '#3b82f6', faulty: '#ef4444', sold: '#94a3b8',
};

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  card: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  cardTitle: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#0f172a' },
  stat: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  statLabel: { fontSize: 13, color: '#64748b' },
  statValue: { fontSize: 13, fontWeight: 700, color: '#0f172a' },
};

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [avail, setAvail] = useState<any>(null);

  useEffect(() => {
    reportsApi.summary().then(setSummary).catch(() => {});
    reportsApi.assignedVsAvailable().then(setAvail).catch(() => {});
  }, []);

  const pieData = summary?.by_status
    ? Object.entries(summary.by_status).map(([name, value]) => ({ name, value: value as number }))
    : [];

  return (
    <div>
      <h2 style={styles.heading}>Reports</h2>
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Asset Status Breakdown</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</p>}
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Summary</div>
          {summary && (
            <>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Total Assets</span>
                <span style={styles.statValue}>{summary.total_assets}</span>
              </div>
              {Object.entries(summary.by_status).map(([s, n]) => (
                <div key={s} style={styles.stat}>
                  <span style={styles.statLabel}>{s}</span>
                  <span style={{ ...styles.statValue, color: STATUS_COLORS[s] || '#0f172a' }}>{n as number}</span>
                </div>
              ))}
              {avail && (
                <div style={{ marginTop: 16 }}>
                  <div style={styles.stat}>
                    <span style={styles.statLabel}>Assigned</span>
                    <span style={styles.statValue}>{avail.assigned}</span>
                  </div>
                  <div style={styles.stat}>
                    <span style={styles.statLabel}>Available in Stock</span>
                    <span style={styles.statValue}>{avail.available}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
