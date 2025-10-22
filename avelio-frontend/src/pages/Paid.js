// src/pages/Paid.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Receipts.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';

async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return await res.json();
}

export default function Paid() {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        // Fetch only PAID receipts
        const data = await apiGet('/receipts', { page, pageSize, status: 'PAID' });

        const list =
          data?.receipts ??
          data?.data?.receipts ??
          data?.data?.rows ??
          data?.rows ??
          data?.list ??
          [];

        const tot =
          (typeof data?.total === 'number' && data.total) ??
          (typeof data?.data?.total === 'number' && data.data.total) ??
          (typeof data?.pagination?.total === 'number' && data.pagination.total) ??
          list.length;

        setReceipts(Array.isArray(list) ? list : []);
        setTotal(Number(tot || 0));
      } catch (e) {
        setError(e.message || 'Failed to load paid receipts');
      } finally {
        setLoading(false);
      }
    })();
  }, [page, pageSize]);

  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));

  const formatDT = (dateStr, timeStr) => {
    try {
      if (!dateStr) return '-';
      
      let datePart;
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        datePart = dateStr.split('T')[0];
      } else {
        datePart = dateStr;
      }
      
      if (timeStr) {
        const [year, month, day] = datePart.split('-');
        const [hours, minutes] = timeStr.split(':');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = months[parseInt(month) - 1];
        return `${day} ${monthName} ${year}, ${hours}:${minutes}`;
      }
      
      const [year, month, day] = datePart.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = months[parseInt(month) - 1];
      return `${day} ${monthName} ${year}`;
    } catch (err) {
      return dateStr || '-';
    }
  };

  // Calculate total paid amount
  const totalPaid = receipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  return (
    <div className="receipts-page">
      <div className="receipts-header">
        <div>
          <h2 className="receipts-title">Paid Receipts</h2>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '8px 0 0 0' }}>
            {total} paid receipts • Total Revenue: ${totalPaid.toFixed(2)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="receipts-btn receipts-btn--ghost" to="/dashboard">← Back to Dashboard</Link>
          <Link className="receipts-btn" to="/new-receipt">+ New Receipt</Link>
        </div>
      </div>

      <div className="receipts-card">
        {error && <div className="receipts-error">{error}</div>}
        {loading ? (
          <div className="receipts-loading">Loading…</div>
        ) : receipts.length === 0 ? (
          <div className="receipts-empty">No paid receipts found.</div>
        ) : (
          <>
            <div className="receipts-table-wrap">
              <table className="receipts-table">
                <thead>
                  <tr>
                    <th className="receipts-th">Receipt #</th>
                    <th className="receipts-th">Agency</th>
                    <th className="receipts-th">Amount</th>
                    <th className="receipts-th">Currency</th>
                    <th className="receipts-th">Issue Date</th>
                    <th className="receipts-th">Payment Date</th>
                    <th className="receipts-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id || receipt.receipt_number}>
                      <td className="receipts-td">{receipt.receipt_number}</td>
                      <td className="receipts-td">{receipt.agency?.agency_name || receipt.agency_name || 'N/A'}</td>
                      <td className="receipts-td">{Number(receipt.amount || 0).toFixed(2)}</td>
                      <td className="receipts-td">{receipt.currency || '-'}</td>
                      <td className="receipts-td">{formatDT(receipt.issue_date, receipt.issue_time)}</td>
                      <td className="receipts-td">{receipt.payment_date ? formatDT(receipt.payment_date) : '-'}</td>
                      <td className="receipts-td">
                        <button
                          className="receipts-btn receipts-btn--ghost"
                          onClick={async () => {
                            try {
                              const token =
                                localStorage.getItem('token') ||
                                localStorage.getItem('authToken') ||
                                sessionStorage.getItem('token');
                              const res = await fetch(`${API_BASE}/receipts/${receipt.id}/pdf`, {
                                headers: token ? { Authorization: `Bearer ${token}` } : {},
                              });
                              if (!res.ok) throw new Error('Failed to fetch PDF');
                              const blob = await res.blob();
                              const url = window.URL.createObjectURL(blob);
                              window.open(url, '_blank');
                            } catch (err) {
                              alert('Error downloading PDF: ' + err.message);
                            }
                          }}
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="receipts-pagination">
              <button
                className="receipts-pagebtn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span>Page {page} / {pages}</span>
              <button
                className="receipts-pagebtn"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}