// src/pages/TravelAgencies.js
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './TravelAgencies.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';

const authHeaders = () => {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function apiGet(path) {
  const res = await fetch(API_BASE + path, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return await res.json();
}
async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  const data = txt ? JSON.parse(txt) : {};
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export default function TravelAgencies() {
  const [loading, setLoading] = useState(true);
  const [agencies, setAgencies] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Add modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ agency_name: '', agency_id: '', contact_email: '' });
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Import state
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiGet('/agencies');
      const list = data?.data?.agencies || data?.agencies || [];
      setAgencies(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e.message || 'Failed to load agencies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filtered list
  const filteredAgencies = agencies.filter(a => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (a.agency_name || '').toLowerCase().includes(q) ||
      String(a.agency_id || '').toLowerCase().includes(q) ||
      (a.contact_person || '').toLowerCase().includes(q) ||
      (a.contact_email || '').toLowerCase().includes(q)
    );
  });

  // --- Add Agency handlers ---
  const openAdd = () => {
    setForm({ agency_name: '', agency_id: '', contact_email: '' });
    setFormErr('');
    setIsAddOpen(true);
  };
  const closeAdd = () => {
    if (!saving) setIsAddOpen(false);
  };
  const validateEmail = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const handleSave = async (e) => {
    e.preventDefault();
    setFormErr('');

    const { agency_name, agency_id, contact_email } = form;
    if (!agency_name.trim() || !agency_id.trim()) {
      setFormErr('Agency name and ID are required.');
      return;
    }
    if (!validateEmail(contact_email)) {
      setFormErr('Please enter a valid email (or leave blank).');
      return;
    }

    try {
      setSaving(true);
      await apiPost('/agencies', {
        agency_name: agency_name.trim(),
        agency_id: agency_id.trim(),
        contact_email: contact_email.trim() || null,
        is_active: true,
      });
      setIsAddOpen(false);
      await load();
    } catch (err) {
      setFormErr(err.message || 'Failed to add agency');
    } finally {
      setSaving(false);
    }
  };

  // --- Import handlers ---
  const triggerImport = () => fileInputRef.current?.click();

  const parseCSV = (text) => {
    // very small CSV parser for comma-separated with header
    // expected headers: agency_name,agency_id,contact_email
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idxName = header.indexOf('agency_name');
    const idxId = header.indexOf('agency_id');
    const idxEmail = header.indexOf('contact_email');
    const out = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const row = {
        agency_name: idxName >= 0 ? cols[idxName] : '',
        agency_id: idxId >= 0 ? cols[idxId] : '',
        contact_email: idxEmail >= 0 ? cols[idxEmail] : '',
      };
      if (row.agency_name || row.agency_id) out.push(row);
    }
    return out;
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setImporting(true);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (!rows.length) {
        setImportResult({ ok: false, message: 'No valid rows found in the CSV.' });
        setImporting(false);
        return;
      }

      // Prefer bulk endpoint if your backend supports it: POST /agencies/bulk
      // Fallback: POST each row individually
      let success = 0;
      let failed = 0;
      const errors = [];

      // Try bulk first
      try {
        const bulkRes = await apiPost('/agencies/bulk', {
          agencies: rows.map(r => ({
            agency_name: r.agency_name?.trim(),
            agency_id: r.agency_id?.trim(),
            contact_email: r.contact_email?.trim() || null,
            is_active: true,
          })),
        });
        // assume backend returns counts
        success = bulkRes?.data?.inserted || rows.length;
      } catch {
        // fallback to one-by-one
        for (const r of rows) {
          try {
            if (!r.agency_name?.trim() || !r.agency_id?.trim()) { failed++; continue; }
            if (r.contact_email && !validateEmail(r.contact_email)) { failed++; continue; }
            await apiPost('/agencies', {
              agency_name: r.agency_name.trim(),
              agency_id: r.agency_id.trim(),
              contact_email: r.contact_email?.trim() || null,
              is_active: true,
            });
            success++;
          } catch (err) {
            failed++;
            errors.push(`${r.agency_id || r.agency_name}: ${err.message}`);
          }
        }
      }

      setImportResult({
        ok: true,
        message: `Imported ${success} item(s). ${failed ? failed + ' failed.' : ''}`,
        errors,
      });
      await load();
    } catch (err) {
      setImportResult({ ok: false, message: err.message || 'Import failed.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="agencies-page">
      <div className="agencies-header">
        <div>
          <h2 className="agencies-title">Travel Agencies</h2>
          <p className="agencies-subtitle">Manage your travel agency partners</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="agencies-btn agencies-btn--ghost" onClick={triggerImport} disabled={importing}>
            {importing ? 'Importing…' : '↥ Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={onImportFile}
          />
          <button className="agencies-btn" onClick={openAdd}>+ Add Agency</button>
        </div>
      </div>

      {/* Stats */}
      <div className="agencies-stats">
        <div className="agencies-stat-card">
          <div className="agencies-stat-icon">🏢</div>
          <div className="agencies-stat-content">
            <div className="agencies-stat-value">{agencies.length}</div>
            <div className="agencies-stat-label">Total Agencies</div>
          </div>
        </div>
        <div className="agencies-stat-card">
          <div className="agencies-stat-icon">✅</div>
          <div className="agencies-stat-content">
            <div className="agencies-stat-value">{agencies.filter(a => a.is_active).length}</div>
            <div className="agencies-stat-label">Active</div>
          </div>
        </div>
        <div className="agencies-stat-card">
          <div className="agencies-stat-icon">⏸️</div>
          <div className="agencies-stat-content">
            <div className="agencies-stat-value">{agencies.filter(a => !a.is_active).length}</div>
            <div className="agencies-stat-label">Inactive</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="agencies-search-bar">
        <input
          type="text"
          className="agencies-search-input"
          placeholder="🔍 Search agencies by name, ID, email, or contact…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="agencies-search-clear" onClick={() => setSearchTerm('')}>
            ✕
          </button>
        )}
      </div>

      <div className="agencies-card">
        {error && <div className="agencies-error">{error}</div>}
        {importResult && (
          <div className={`agencies-import-result ${importResult.ok ? 'ok' : 'err'}`}>
            <div className="import-title">{importResult.ok ? 'Import Complete' : 'Import Failed'}</div>
            <div className="import-msg">{importResult.message}</div>
            {!!importResult.errors?.length && (
              <details className="import-errors">
                <summary>View errors ({importResult.errors.length})</summary>
                <ul>
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
        {loading ? (
          <div className="agencies-loading">Loading agencies...</div>
        ) : filteredAgencies.length === 0 ? (
          <div className="agencies-empty">
            {searchTerm ? 'No agencies match your search.' : 'No agencies found.'}
          </div>
        ) : (
          <div className="agencies-grid">
            {filteredAgencies.map((agency) => (
              <div key={agency.id || agency.agency_id} className="agency-card">
                <div className="agency-card-header">
                  <div className="agency-avatar">
                    {(agency.agency_name || 'A')[0].toUpperCase()}
                  </div>
                  <div className={`agency-status ${agency.is_active ? 'agency-status--active' : 'agency-status--inactive'}`}>
                    {agency.is_active ? '✓ Active' : '⏸ Inactive'}
                  </div>
                </div>

                <div className="agency-card-body">
                  <h3 className="agency-name">{agency.agency_name || 'Unnamed Agency'}</h3>
                  <div className="agency-id">ID: {agency.agency_id || 'N/A'}</div>

                  <div className="agency-details">
                    <div className="agency-detail">
                      <span className="agency-detail-icon">✉️</span>
                      <span className="agency-detail-text">{agency.contact_email || 'No email'}</span>
                    </div>
                    {agency.contact_person && (
                      <div className="agency-detail">
                        <span className="agency-detail-icon">👤</span>
                        <span className="agency-detail-text">{agency.contact_person}</span>
                      </div>
                    )}
                    {agency.contact_phone && (
                      <div className="agency-detail">
                        <span className="agency-detail-icon">📞</span>
                        <span className="agency-detail-text">{agency.contact_phone}</span>
                      </div>
                    )}
                    {agency.location && (
                      <div className="agency-detail">
                        <span className="agency-detail-icon">📍</span>
                        <span className="agency-detail-text">{agency.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="agency-card-footer">
                  <Link to={`/agencies/${agency.id || agency.agency_id}`} className="agency-btn agency-btn--view">
                    View Details
                  </Link>
                  <button className="agency-btn agency-btn--edit" title="Coming soon">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Agency Modal */}
      {isAddOpen && (
        <div className="agencies-modal-overlay" onClick={closeAdd}>
          <div className="agencies-modal" onClick={(e) => e.stopPropagation()}>
            <div className="agencies-modal-header">
              <h3>Add New Agency</h3>
              <button className="modal-close" onClick={closeAdd} disabled={saving}>✕</button>
            </div>
            <form onSubmit={handleSave} className="agencies-form">
              <div className="form-row">
                <label>Agency Name<span className="req">*</span></label>
                <input
                  type="text"
                  value={form.agency_name}
                  onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                  placeholder="e.g., SKY TOURS JUBA"
                  required
                />
              </div>
              <div className="form-row">
                <label>Agency ID<span className="req">*</span></label>
                <input
                  type="text"
                  value={form.agency_id}
                  onChange={(e) => setForm({ ...form, agency_id: e.target.value })}
                  placeholder="e.g., 789456"
                  required
                />
              </div>
              <div className="form-row">
                <label>Email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="e.g., sky.tours@example.com"
                />
              </div>

              {formErr && <div className="form-error">{formErr}</div>}

              <div className="modal-actions">
                <button type="button" className="agencies-btn agencies-btn--ghost" onClick={closeAdd} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="agencies-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Agency'}
                </button>
              </div>

              <div className="modal-help">
                Tip: to import multiple, click <strong>“Import CSV”</strong>. Expected headers:
                <code> agency_name, agency_id, contact_email </code>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}