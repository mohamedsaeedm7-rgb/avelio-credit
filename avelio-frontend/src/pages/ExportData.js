// src/pages/ExportData.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './ExportData.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';

async function apiGet(path) {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(API_BASE + path, { headers });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return await res.json();
}

export default function ExportData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    format: 'csv'
  });

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';

    const headers = [
      'Receipt Number',
      'Agency Name',
      'Agency ID',
      'Amount',
      'Currency',
      'Status',
      'Payment Method',
      'Issue Date',
      'Issue Time',
      'Payment Date',
      'Station',
      'Issued By'
    ];

    const rows = data.map(r => [
      r.receipt_number || '',
      r.agency?.agency_name || r.agency_name || '',
      r.agency?.agency_id || r.agency_id || '',
      r.amount || 0,
      r.currency || 'USD',
      r.status || '',
      r.payment_method || '',
      r.issue_date || '',
      r.issue_time || '',
      r.payment_date || '',
      r.station || '',
      r.issued_by || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Build query params
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;

      // Fetch data
      const queryString = new URLSearchParams(params).toString();
      const data = await apiGet(`/receipts${queryString ? `?${queryString}` : ''}`);
      const receipts = data?.data?.receipts || data?.receipts || [];

      if (receipts.length === 0) {
        setError('No receipts found matching the filters');
        return;
      }

      // Export based on format
      if (filters.format === 'csv') {
        const csv = convertToCSV(receipts);
        const filename = `receipts_export_${new Date().toISOString().split('T')[0]}.csv`;
        downloadFile(csv, filename, 'text/csv;charset=utf-8;');
        setSuccess(`Successfully exported ${receipts.length} receipts to CSV`);
      } else if (filters.format === 'json') {
        const json = JSON.stringify(receipts, null, 2);
        const filename = `receipts_export_${new Date().toISOString().split('T')[0]}.json`;
        downloadFile(json, filename, 'application/json');
        setSuccess(`Successfully exported ${receipts.length} receipts to JSON`);
      }
    } catch (e) {
      setError(e.message || 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="export-page">
      <div className="export-header">
        <div>
          <h2 className="export-title">Export Data</h2>
          <p className="export-subtitle">Download receipts in CSV or JSON format</p>
        </div>
        
      </div>

      <div className="export-card">
        <div className="export-section">
          <h3 className="export-section-title">Export Filters</h3>
          <p className="export-section-desc">
            Select filters to export specific receipts or leave blank to export all
          </p>

          <div className="export-form">
            <div className="export-field">
              <label className="export-label">Status</label>
              <select
                className="export-select"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="VOID">Void</option>
              </select>
            </div>

            <div className="export-field">
              <label className="export-label">Date From</label>
              <input
                type="date"
                className="export-input"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>

            <div className="export-field">
              <label className="export-label">Date To</label>
              <input
                type="date"
                className="export-input"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>

            <div className="export-field">
              <label className="export-label">Export Format</label>
              <select
                className="export-select"
                value={filters.format}
                onChange={(e) => setFilters({ ...filters, format: e.target.value })}
              >
                <option value="csv">CSV (Comma-separated values)</option>
                <option value="json">JSON (JavaScript Object Notation)</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="export-message export-message--error">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="export-message export-message--success">
            ✅ {success}
          </div>
        )}

        <div className="export-actions">
          <button
            className="export-btn"
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? '⏳ Exporting...' : '📥 Export Data'}
          </button>
          <button
            className="export-btn export-btn--secondary"
            onClick={() => setFilters({ status: '', dateFrom: '', dateTo: '', format: 'csv' })}
          >
            🔄 Reset Filters
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="export-info">
        <div className="export-info-card">
          <div className="export-info-icon">📄</div>
          <div className="export-info-content">
            <h4 className="export-info-title">CSV Format</h4>
            <p className="export-info-text">
              Best for Excel and spreadsheet applications. Includes all receipt data in comma-separated format.
            </p>
          </div>
        </div>

        <div className="export-info-card">
          <div className="export-info-icon">🔧</div>
          <div className="export-info-content">
            <h4 className="export-info-title">JSON Format</h4>
            <p className="export-info-text">
              Best for developers and API integrations. Provides structured data with all nested information.
            </p>
          </div>
        </div>

        <div className="export-info-card">
          <div className="export-info-content">
            <h4 className="export-info-title">Export includes:</h4>
            <ul className="export-info-list">
              <li>Receipt numbers and dates</li>
              <li>Agency information</li>
              <li>Payment amounts and status</li>
              <li>Station and user details</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}