import React, { useEffect, useState } from 'react';
import { purchasesApi } from '../services/api';
import { Purchase } from '../types';

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 20 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  th: { textAlign: 'left', padding: '10px 16px', fontSize: 12, color: '#64748b', background: '#f8fafc', fontWeight: 600 },
  td: { padding: '10px 16px', fontSize: 13, color: '#374151', borderTop: '1px solid #f1f5f9' },
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    purchasesApi.list().then(setPurchases).catch(() => {});
  }, []);

  return (
    <div>
      <h2 style={styles.heading}>Purchases</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Invoice</th>
            <th style={styles.th}>Vendor</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Total Cost</th>
            <th style={styles.th}>Documents</th>
          </tr>
        </thead>
        <tbody>
          {purchases.length === 0 ? (
            <tr><td style={styles.td} colSpan={5}>No purchases found.</td></tr>
          ) : purchases.map((p) => (
            <tr key={p.id}>
              <td style={{ ...styles.td, fontWeight: 600 }}>{p.invoice_number}</td>
              <td style={styles.td}>{p.vendor_name}</td>
              <td style={styles.td}>{p.purchase_date}</td>
              <td style={styles.td}>${p.total_cost.toLocaleString()}</td>
              <td style={styles.td}>{p.documents?.length ?? 0} file(s)</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
