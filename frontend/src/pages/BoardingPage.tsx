import React, { useMemo, useRef, useState } from 'react';
import { assignmentsApi } from '../services/api';
import { Assignment } from '../types';
import { useAuthStore } from '../store/authStore';

interface EmployeeGroup {
  key: string;
  assignee_name: string;
  employee_id?: string;
  assignee_email?: string;
  designation?: string;
  department?: string;
  active: Assignment[];
  history: Assignment[];
}

function groupByEmployee(assignments: Assignment[]): EmployeeGroup[] {
  const map = new Map<string, EmployeeGroup>();
  for (const a of assignments) {
    const key = a.employee_id || a.assignee_name || a.assignee_email || a.id;
    if (!map.has(key)) {
      map.set(key, {
        key,
        assignee_name: a.assignee_name || '—',
        employee_id: a.employee_id,
        assignee_email: a.assignee_email,
        designation: a.designation,
        department: a.department,
        active: [],
        history: [],
      });
    }
    const g = map.get(key)!;
    if (a.is_active) g.active.push(a);
    else g.history.push(a);
    // Keep the most complete metadata (e.g. department may be null on old records)
    if (a.designation && !g.designation) g.designation = a.designation;
    if (a.department && !g.department) g.department = a.department;
    if (a.assignee_email && !g.assignee_email) g.assignee_email = a.assignee_email;
  }
  return [...map.values()];
}

function daysBetween(start: string, end?: string | null): number {
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  return Math.round((b - a) / 86400000);
}

function durationLabel(start: string, end?: string | null): string {
  const d = daysBetween(start, end);
  if (d < 1) return 'Same day';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

interface ClearanceCert {
  group: EmployeeGroup;
  date: string;
}

interface EmailModal {
  group: EmployeeGroup;
  employeeEmail: string;
  managerEmails: string[];
  managerEmailInput: string;
  sendToEmployee: boolean;
  sendToManager: boolean;
  note: string;
}

function toAssetPayload(assignments: Assignment[]) {
  return assignments.map(a => ({
    asset_tag: a.asset?.asset_tag,
    name: a.asset?.name,
    category: a.asset?.category,
    brand: a.asset?.brand,
    model_number: a.asset?.model_number,
    serial_number: a.asset?.serial_number,
    assignment_date: a.assignment_date,
    return_date: a.return_date,
  }));
}

export default function BoardingPage() {
  const { user } = useAuthStore();
  const canReturn = user?.role === 'admin' || user?.role === 'manager';

  const [query, setQuery] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returning, setReturning] = useState<Set<string>>(new Set());
  const [cert, setCert] = useState<ClearanceCert | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [emailModal, setEmailModal] = useState<EmailModal | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: string[]; failed: string[] } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupByEmployee(assignments), [assignments]);

  const toggleHistory = (key: string) =>
    setExpandedHistory(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const results = await assignmentsApi.list({ assignee_search: q, include_inactive: true });
      setAssignments(results);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const removeAssignments = (ids: string[]) =>
    setAssignments(prev =>
      prev.map(a => ids.includes(a.id) ? { ...a, is_active: false, return_date: new Date().toISOString().slice(0, 10) } : a)
    );

  const handleReturn = async (assignmentId: string) => {
    setReturning(prev => new Set([...prev, assignmentId]));
    try {
      await assignmentsApi.returnAsset(assignmentId);
      removeAssignments([assignmentId]);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to return asset');
    } finally {
      setReturning(prev => { const s = new Set(prev); s.delete(assignmentId); return s; });
    }
  };

  const handleBulkReturn = async (group: EmployeeGroup) => {
    const ids = group.active.map(a => a.id);
    setReturning(prev => new Set([...prev, ...ids]));
    try {
      const res = await assignmentsApi.bulkReturn(ids);
      removeAssignments(ids);
      if (res.failed > 0) alert(`${res.returned} returned. ${res.failed} failed.`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Bulk return failed');
    } finally {
      setReturning(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    }
  };

  const handlePrint = (group: EmployeeGroup) => {
    setCert({ group, date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) });
    setTimeout(() => window.print(), 300);
  };

  const openEmailModal = (group: EmployeeGroup) => {
    setEmailResult(null);
    setEmailModal({
      group,
      employeeEmail: group.assignee_email || '',
      managerEmails: [],
      managerEmailInput: '',
      sendToEmployee: !!group.assignee_email,
      sendToManager: false,
      note: '',
    });
  };

  const addManagerEmail = (email: string) => {
    const trimmed = email.replace(/,/g, '').trim();
    if (!trimmed || !trimmed.includes('@')) return;
    setEmailModal(m => m && !m.managerEmails.includes(trimmed)
      ? { ...m, managerEmails: [...m.managerEmails, trimmed], managerEmailInput: '' }
      : m ? { ...m, managerEmailInput: '' } : m
    );
  };

  const removeManagerEmail = (email: string) =>
    setEmailModal(m => m ? { ...m, managerEmails: m.managerEmails.filter(e => e !== email) } : m);

  const handleSendEmail = async () => {
    if (!emailModal) return;
    const { group, employeeEmail, managerEmails, managerEmailInput, sendToEmployee, sendToManager, note } = emailModal;

    // Include anything still typed but not yet confirmed as a chip
    const finalManagerEmails = sendToManager
      ? [...managerEmails, ...(managerEmailInput.trim().includes('@') ? [managerEmailInput.trim()] : [])]
      : [];

    if (!sendToEmployee && finalManagerEmails.length === 0) return;

    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await assignmentsApi.sendClearanceEmail({
        employee_name: group.assignee_name,
        employee_id: group.employee_id,
        department: group.department,
        designation: group.designation,
        employee_email: sendToEmployee ? employeeEmail : undefined,
        manager_emails: finalManagerEmails.length > 0 ? finalManagerEmails : undefined,
        current_assets: toAssetPayload(group.active),
        history_assets: toAssetPayload(group.history),
        note: note || undefined,
      });
      setEmailResult(res);
    } catch (e: any) {
      setEmailResult({ sent: [], failed: [e?.response?.data?.detail || 'Email failed'] });
    } finally {
      setEmailSending(false);
    }
  };

  const isGroupReturning = (group: EmployeeGroup) =>
    group.active.some(a => returning.has(a.id));

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #boarding-print-area {
            display: block !important;
            visibility: visible;
            position: fixed;
            top: 0; left: 0;
            width: 100%;
          }
          #boarding-print-area * { visibility: visible; }
        }
        #boarding-print-area { display: none; }
      `}</style>

      {/* ── Print Area ── */}
      <div id="boarding-print-area" ref={printRef}>
        {cert && (
          <div style={{ fontFamily: 'serif', padding: '40px 60px', maxWidth: 700, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>ASSET CLEARANCE CERTIFICATE</div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Employee Exit Clearance — Asset Inventory</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 13 }}>
              <tbody>
                <tr><td style={{ padding: '5px 0', fontWeight: 700, width: 160 }}>Employee Name</td><td>: {cert.group.assignee_name}</td></tr>
                {cert.group.employee_id && <tr><td style={{ padding: '5px 0', fontWeight: 700 }}>Employee ID</td><td>: {cert.group.employee_id}</td></tr>}
                {cert.group.department && <tr><td style={{ padding: '5px 0', fontWeight: 700 }}>Department</td><td>: {cert.group.department}</td></tr>}
                {cert.group.designation && <tr><td style={{ padding: '5px 0', fontWeight: 700 }}>Designation</td><td>: {cert.group.designation}</td></tr>}
                {cert.group.assignee_email && <tr><td style={{ padding: '5px 0', fontWeight: 700 }}>Email</td><td>: {cert.group.assignee_email}</td></tr>}
                <tr><td style={{ padding: '5px 0', fontWeight: 700 }}>Clearance Date</td><td>: {cert.date}</td></tr>
              </tbody>
            </table>

            {/* Clearance status banner */}
            {cert.group.active.length === 0 ? (
              <div style={{
                border: '2px solid #166534', borderRadius: 6, padding: '14px 18px',
                background: '#f0fdf4', marginBottom: 20, textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                  ✓ CLEARED FOR EXIT
                </div>
                <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
                  This is to certify that <strong>{cert.group.assignee_name}</strong> has returned all company assets
                  in their possession. All items have been duly accounted for and verified. This employee is
                  formally cleared of any outstanding asset obligations and is approved for offboarding.
                </div>
              </div>
            ) : (
              <div style={{
                border: '2px solid #b91c1c', borderRadius: 6, padding: '12px 16px',
                background: '#fef2f2', marginBottom: 20, textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
                  ⚠ PENDING — {cert.group.active.length} asset{cert.group.active.length !== 1 ? 's' : ''} yet to be returned
                </div>
              </div>
            )}

            {/* Currently held */}
            {cert.group.active.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Assets Pending Return</div>
                <AssetTable rows={cert.group.active} returnDate={cert.date} />
              </div>
            )}

            {/* History */}
            {cert.group.history.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Previously Returned Assets</div>
                <AssetTable rows={cert.group.history} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60 }}>
              {['Employee Signature', 'HR / Admin Signature', 'IT / Asset Manager'].map(label => (
                <div key={label} style={{ textAlign: 'center', width: 180 }}>
                  <div style={{ borderTop: '1px solid #000', paddingTop: 6, fontSize: 12 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 40, fontSize: 11, color: '#888' }}>
              Generated by Asset Inventory System on {cert.date}
            </div>
          </div>
        )}
      </div>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Employee Boarding</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Search employees to view current assignments and full asset history — for onboarding checks or offboarding clearance
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div style={{
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderRadius: 14, border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.07)', padding: '20px 24px', marginBottom: 28,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Search Employee</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="Enter employee name, ID, or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1, padding: '10px 14px', fontSize: 14, border: '1.5px solid #e2e8f0',
              borderRadius: 8, outline: 'none', background: '#f8fafc',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            style={{
              padding: '10px 24px', background: '#ea580c', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !query.trim() ? 0.65 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          {searched && (
            <button
              onClick={() => { setQuery(''); setAssignments([]); setSearched(false); setExpandedHistory(new Set()); }}
              style={{
                padding: '10px 16px', background: '#f1f5f9', color: '#374151',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
          Search by name (e.g., "John"), employee ID (e.g., "EMP-001"), or email. Shows current assignments + full history.
        </div>
      </div>

      {/* ── No results ── */}
      {searched && !loading && assignments.length === 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
          borderRadius: 14, border: '1px solid rgba(255,255,255,0.7)',
          padding: '48px 24px', textAlign: 'center', color: '#94a3b8',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>No records found</div>
          <div style={{ fontSize: 13 }}>No assignments (active or past) match "{query}"</div>
        </div>
      )}

      {/* ── Employee Groups ── */}
      {groups.map(group => (
        <div
          key={group.key}
          style={{
            background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)',
            borderRadius: 14, border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.07)', marginBottom: 24, overflow: 'hidden',
          }}
        >
          {/* Employee header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            padding: '16px 24px', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{group.assignee_name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {group.employee_id && <span>ID: {group.employee_id}</span>}
                {group.department && <span>Dept: {group.department}</span>}
                {group.designation && <span>{group.designation}</span>}
                {group.assignee_email && <span>{group.assignee_email}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ background: group.active.length > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {group.active.length} currently assigned
              </span>
              <span style={{ background: 'rgba(255,255,255,0.1)', color: '#94a3b8', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {group.history.length} past
              </span>
              <button
                onClick={() => handlePrint(group)}
                style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Print Clearance
              </button>
              <button
                onClick={() => openEmailModal(group)}
                style={{ padding: '6px 14px', background: 'rgba(59,130,246,0.7)', color: '#fff', border: '1px solid rgba(59,130,246,0.5)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Email Clearance
              </button>
              {canReturn && group.active.length > 0 && (
                <button
                  onClick={() => handleBulkReturn(group)}
                  disabled={isGroupReturning(group)}
                  style={{
                    padding: '6px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 7,
                    fontSize: 12, fontWeight: 600,
                    cursor: isGroupReturning(group) ? 'not-allowed' : 'pointer',
                    opacity: isGroupReturning(group) ? 0.65 : 1,
                  }}
                >
                  {isGroupReturning(group) ? 'Returning…' : 'Return All (Offboarding)'}
                </button>
              )}
            </div>
          </div>

          {/* ── Currently Assigned ── */}
          {group.active.length > 0 && (
            <div>
              <div style={{ padding: '10px 24px 6px', fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
                Currently Assigned — {group.active.length} asset{group.active.length !== 1 ? 's' : ''}
              </div>
              {group.active.map((a, idx) => (
                <AssetRow
                  key={a.id}
                  assignment={a}
                  isReturning={returning.has(a.id)}
                  onReturn={canReturn ? () => handleReturn(a.id) : undefined}
                  zebra={idx % 2 === 0}
                  isLast={idx === group.active.length - 1}
                />
              ))}
            </div>
          )}

          {/* ── History ── */}
          {group.history.length > 0 && (
            <div>
              <button
                onClick={() => toggleHistory(group.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 24px', background: '#f8fafc',
                  border: 'none', borderTop: group.active.length > 0 ? '1px solid #e2e8f0' : 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
              >
                <span>Assignment History — {group.history.length} past asset{group.history.length !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: 14, transition: 'transform 0.2s', transform: expandedHistory.has(group.key) ? 'rotate(180deg)' : 'none' }}>▾</span>
              </button>

              {expandedHistory.has(group.key) && (
                <div style={{ borderTop: '1px solid #f1f5f9' }}>
                  {group.history.map((a, idx) => (
                    <HistoryRow key={a.id} assignment={a} zebra={idx % 2 === 0} isLast={idx === group.history.length - 1} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state: no active, no history */}
          {group.active.length === 0 && group.history.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No assignment records found for this employee.
            </div>
          )}
        </div>
      ))}

      {/* ── Initial empty state ── */}
      {!searched && (
        <div style={{
          background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)',
          borderRadius: 14, border: '1px solid rgba(255,255,255,0.7)',
          padding: '56px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Employee Asset Lookup</div>
          <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
            Search an employee to see their current assets and full assignment history. Use for exit clearance, offboarding, or onboarding asset checks.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 28, flexWrap: 'wrap' }}>
            {[
              { icon: '🔍', label: 'Search by name or ID' },
              { icon: '📋', label: 'View current assets' },
              { icon: '🕒', label: 'Full assignment history' },
              { icon: '↩️', label: 'Bulk return for offboarding' },
              { icon: '🖨️', label: 'Print clearance certificate' },
              { icon: '📧', label: 'Email to employee & manager' },
            ].map(({ icon, label }) => (
              <div key={label} style={{ textAlign: 'center', width: 110 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Email Clearance Modal ── */}
      {emailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 48px rgba(0,0,0,0.22)' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1e3a8a,#1e40af)', borderRadius: '14px 14px 0 0', padding: '20px 24px', color: '#fff' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Email Clearance Certificate</div>
              <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 3 }}>{emailModal.group.assignee_name}</div>
            </div>

            <div style={{ padding: 24 }}>
              {/* Success / error result */}
              {emailResult && (
                <div style={{
                  background: emailResult.sent.length > 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${emailResult.sent.length > 0 ? '#bbf7d0' : '#fecaca'}`,
                  color: emailResult.sent.length > 0 ? '#166534' : '#991b1b',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
                }}>
                  {emailResult.sent.length > 0
                    ? `✓ Sent to: ${emailResult.sent.join(', ')}`
                    : `✗ Failed: ${emailResult.failed.join(', ')}`}
                  {emailResult.sent.length > 0 && emailResult.failed.length > 0 && (
                    <div style={{ marginTop: 4 }}>Failed: {emailResult.failed.join(', ')}</div>
                  )}
                </div>
              )}

              {/* Send to Employee */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={emailModal.sendToEmployee}
                    onChange={e => setEmailModal(m => m ? { ...m, sendToEmployee: e.target.checked } : m)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Send to Employee</span>
                </label>
                {emailModal.sendToEmployee && (
                  <input
                    type="email"
                    placeholder="Employee email address"
                    value={emailModal.employeeEmail}
                    onChange={e => setEmailModal(m => m ? { ...m, employeeEmail: e.target.value } : m)}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  />
                )}
              </div>

              {/* Send to Manager / HR */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={emailModal.sendToManager}
                    onChange={e => setEmailModal(m => m ? { ...m, sendToManager: e.target.checked } : m)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Send to Manager / HR</span>
                </label>
                {emailModal.sendToManager && (
                  <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '6px 10px', background: '#f8fafc' }}>
                    {/* Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: emailModal.managerEmails.length > 0 ? 8 : 0 }}>
                      {emailModal.managerEmails.map(email => (
                        <span key={email} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: '#dbeafe', color: '#1e40af',
                          borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500,
                        }}>
                          {email}
                          <button
                            onClick={() => removeManagerEmail(email)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontWeight: 700, fontSize: 14, lineHeight: 1, padding: 0 }}
                          >×</button>
                        </span>
                      ))}
                    </div>
                    {/* Input */}
                    <input
                      type="email"
                      placeholder="Type email and press Enter or comma to add…"
                      value={emailModal.managerEmailInput}
                      onChange={e => setEmailModal(m => m ? { ...m, managerEmailInput: e.target.value } : m)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addManagerEmail(emailModal.managerEmailInput);
                        }
                        if (e.key === 'Backspace' && !emailModal.managerEmailInput && emailModal.managerEmails.length > 0) {
                          removeManagerEmail(emailModal.managerEmails[emailModal.managerEmails.length - 1]);
                        }
                      }}
                      onBlur={() => { if (emailModal.managerEmailInput.trim()) addManagerEmail(emailModal.managerEmailInput); }}
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, padding: '2px 0', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Press Enter or comma after each email address
                    </div>
                  </div>
                )}
              </div>

              {/* Note */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Note (optional)</div>
                <textarea
                  placeholder="Add a note to include in the email…"
                  value={emailModal.note}
                  onChange={e => setEmailModal(m => m ? { ...m, note: e.target.value } : m)}
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {/* Summary */}
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#64748b', marginBottom: 20 }}>
                The email will include <strong>{emailModal.group.active.length}</strong> active asset{emailModal.group.active.length !== 1 ? 's' : ''} and <strong>{emailModal.group.history.length}</strong> past assignment{emailModal.group.history.length !== 1 ? 's' : ''}.
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setEmailModal(null); setEmailResult(null); }}
                  style={{ padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  disabled={emailSending || (
                    !emailModal.sendToEmployee &&
                    !(emailModal.sendToManager && (emailModal.managerEmails.length > 0 || emailModal.managerEmailInput.trim().includes('@')))
                  )}
                  onClick={handleSendEmail}
                  style={{
                    padding: '8px 22px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    opacity: emailSending ? 0.65 : 1,
                  }}
                >
                  {emailSending ? 'Sending…' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Asset Row (active) ─────────────────────────────────────── */
function AssetRow({ assignment: a, isReturning, onReturn, zebra, isLast }: {
  assignment: Assignment;
  isReturning: boolean;
  onReturn?: () => void;
  zebra: boolean;
  isLast: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 24px',
      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
      background: zebra ? 'transparent' : 'rgba(248,250,252,0.6)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg,#ea580c18,#f9731618)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>
        {categoryIcon(a.asset?.category)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{a.asset?.name || '—'}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#ea580c', background: '#fff7ed', padding: '2px 8px', borderRadius: 12 }}>{a.asset?.asset_tag}</span>
          <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>{a.asset?.category}</span>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {a.asset?.brand && <span>{a.asset.brand}{a.asset.model_number ? ` · ${a.asset.model_number}` : ''}</span>}
          {a.asset?.serial_number && <span>S/N: {a.asset.serial_number}</span>}
          <span>Assigned: {a.assignment_date}</span>
          {a.expected_return_date && (
            <span style={{ color: isOverdue(a.expected_return_date) ? '#ef4444' : '#64748b', fontWeight: isOverdue(a.expected_return_date) ? 600 : 400 }}>
              Due: {a.expected_return_date}{isOverdue(a.expected_return_date) ? ' ⚠ Overdue' : ''}
            </span>
          )}
          {a.notes && <span>Notes: {a.notes}</span>}
        </div>
      </div>

      {onReturn && (
        <button
          onClick={onReturn}
          disabled={isReturning}
          style={{
            padding: '7px 16px',
            background: isReturning ? '#f1f5f9' : '#fff',
            color: isReturning ? '#94a3b8' : '#ef4444',
            border: `1px solid ${isReturning ? '#e2e8f0' : '#fca5a5'}`,
            borderRadius: 7, fontSize: 12, fontWeight: 600,
            cursor: isReturning ? 'not-allowed' : 'pointer',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          {isReturning ? 'Returning…' : 'Return Asset'}
        </button>
      )}
    </div>
  );
}

/* ── History Row (returned) ─────────────────────────────────── */
function HistoryRow({ assignment: a, zebra, isLast }: {
  assignment: Assignment;
  zebra: boolean;
  isLast: boolean;
}) {
  const duration = durationLabel(a.assignment_date, a.return_date);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 24px',
      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
      background: zebra ? 'transparent' : 'rgba(248,250,252,0.4)',
      opacity: 0.85,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
        background: '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>
        {categoryIcon(a.asset?.category)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{a.asset?.name || '—'}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '2px 7px', borderRadius: 10 }}>{a.asset?.asset_tag}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', background: '#f1f5f9', padding: '2px 7px', borderRadius: 10 }}>{a.asset?.category}</span>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {a.asset?.brand && <span>{a.asset.brand}</span>}
          <span>Assigned: {a.assignment_date}</span>
          {a.return_date && <span>Returned: {a.return_date}</span>}
          <span style={{ color: '#64748b', fontWeight: 600 }}>Duration: {duration}</span>
          {a.notes && <span>Notes: {a.notes}</span>}
        </div>
      </div>

      <span style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', background: '#f0fdf4', padding: '4px 10px', borderRadius: 10, flexShrink: 0 }}>
        Returned
      </span>
    </div>
  );
}

/* ── Print table component ──────────────────────────────────── */
function AssetTable({ rows, returnDate }: { rows: Assignment[]; returnDate?: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f0f0f0' }}>
          {['Asset Tag', 'Name', 'Category', 'Brand / Model', 'Assigned', 'Returned', 'Condition'].map(h => (
            <th key={h} style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((a, i) => (
          <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>{a.asset?.asset_tag}</td>
            <td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>{a.asset?.name}</td>
            <td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>{a.asset?.category}</td>
            <td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>{[a.asset?.brand, a.asset?.model_number].filter(Boolean).join(' / ') || '—'}</td>
            <td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>{a.assignment_date}</td>
            <td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>{returnDate || a.return_date || '—'}</td>
            <td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function categoryIcon(category?: string): string {
  if (!category) return '📦';
  const c = category.toLowerCase();
  if (c.includes('laptop') || c.includes('computer')) return '💻';
  if (c.includes('phone') || c.includes('mobile')) return '📱';
  if (c.includes('monitor') || c.includes('display')) return '🖥️';
  if (c.includes('tablet')) return '📱';
  if (c.includes('camera')) return '📷';
  if (c.includes('printer')) return '🖨️';
  if (c.includes('keyboard') || c.includes('mouse') || c.includes('access')) return '🖱️';
  if (c.includes('software') || c.includes('license')) return '💿';
  if (c.includes('vehicle') || c.includes('car')) return '🚗';
  if (c.includes('furniture') || c.includes('chair') || c.includes('desk')) return '🪑';
  return '📦';
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}
