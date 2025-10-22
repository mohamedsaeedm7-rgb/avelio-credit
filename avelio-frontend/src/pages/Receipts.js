// src/pages/Receipts.js
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ReceiptDetailsModal from '../pages/ReceiptDetailsModal';
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

// Helper: Check if receipt is overdue (PENDING + >3 days old)
const isOverdue = (receipt) => {
  if (receipt.status?.toUpperCase() !== 'PENDING') return false;
  const issueDate = new Date(receipt.issue_date);
  const daysDiff = Math.floor((Date.now() - issueDate) / (1000 * 60 * 60 * 24));
  return daysDiff > 3;
};

export default function Receipts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Modal state
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Read filters from URL or component state
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [overdueFilter, setOverdueFilter] = useState(false);

  // Initialize filters from URL params on mount
  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    const urlDate = searchParams.get('date') || '';
    const urlFilter = searchParams.get('filter') || '';
    
    // Handle "today" date filter
    if (urlDate === 'today') {
      const today = new Date().toISOString().split('T')[0];
      setDateFrom(today);
      setDateTo(today);
    }
    
    // Handle status filter
    if (urlStatus) {
      setStatusFilter(urlStatus.toUpperCase());
    }
    
    // Handle overdue filter
    if (urlFilter === 'overdue') {
      setOverdueFilter(true);
      setStatusFilter('PENDING');
    }
  }, [searchParams]);

  // Fetch receipts function
  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = { page, pageSize };
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      
      const data = await apiGet('/receipts', params);

      let list =
        data?.receipts ??
        data?.data?.receipts ??
        data?.data?.rows ??
        data?.rows ??
        data?.list ??
        [];

      // Apply client-side overdue filtering if needed
      if (overdueFilter) {
        list = list.filter(isOverdue);
      }

      const tot =
        (typeof data?.total === 'number' && data.total) ??
        (typeof data?.data?.total === 'number' && data.data.total) ??
        (typeof data?.pagination?.total === 'number' && data.pagination.total) ??
        list.length;

      setReceipts(Array.isArray(list) ? list : []);
      setTotal(overdueFilter ? list.length : Number(tot || 0));
    } catch (e) {
      setError(e.message || 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [page, statusFilter, dateFrom, dateTo, overdueFilter, refreshTrigger]);

  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  
  const statusPill = (s) => {
    const v = String(s || '').toUpperCase();
    const cls =
      v === 'PAID' ? 'receipts-status receipts-status--paid' :
      v === 'PENDING' ? 'receipts-status receipts-status--pending' :
      'receipts-status receipts-status--void';
    return <span className={cls}>{v || '-'}</span>;
  };

  const displayTZ = 'Africa/Juba';

  const formatDT = (dateStr, timeStr) => {
    if (!dateStr) return '-';

    if (timeStr) {
      const base = new Date(
        typeof dateStr === 'string' && dateStr.includes('T')
          ? dateStr
          : `${dateStr}T00:00:00Z`
      );

      const dateOnly = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: displayTZ,
      }).format(base);

      const hhmm = String(timeStr).slice(0, 5);
      return `${dateOnly}, ${hhmm}`;
    }

    const dt = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: displayTZ,
    }).format(dt);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setOverdueFilter(false);
    setPage(1);
    setSearchParams({});
  };

  const handleStatusFilterClick = (status) => {
    setStatusFilter(status);
    setOverdueFilter(false);
    setPage(1);
  };

  // Modal handlers
  const handleReceiptClick = (receipt) => {
    setSelectedReceipt(receipt);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReceipt(null);
  };

  const handleStatusUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="receipts-page">
      <div className="receipts-header">
        <div>
          <h2 className="receipts-title">All Receipts</h2>
          <p className="receipts-subtitle">{total} total receipts</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="receipts-btn" to="/new-receipt">+ New Receipt</Link>
        </div>
      </div>

      {/* Filters Section */}
      <div className="receipts-filters-section">
        {/* Status Filter Tabs */}
        <div className="receipts-filter-tabs">
          <button
            className={`receipts-filter-tab ${statusFilter === '' && !overdueFilter ? 'active' : ''}`}
            onClick={() => handleStatusFilterClick('')}
          >
            All
          </button>
          <button
            className={`receipts-filter-tab ${statusFilter === 'PAID' ? 'active' : ''}`}
            onClick={() => handleStatusFilterClick('PAID')}
          >
            Paid
          </button>
          <button
            className={`receipts-filter-tab ${statusFilter === 'PENDING' && !overdueFilter ? 'active' : ''}`}
            onClick={() => handleStatusFilterClick('PENDING')}
          >
            Pending
          </button>
          <button
            className={`receipts-filter-tab ${overdueFilter ? 'active' : ''}`}
            onClick={() => {
              setOverdueFilter(true);
              setStatusFilter('PENDING');
              setPage(1);
            }}
          >
            Overdue
          </button>
        </div>

        {/* Date Filters */}
        <div className="receipts-date-filters">
          <div className="receipts-date-input-group">
            <label className="receipts-date-label">From</label>
            <input
              type="date"
              className="receipts-date-input"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setOverdueFilter(false);
              }}
            />
          </div>
          <div className="receipts-date-input-group">
            <label className="receipts-date-label">To</label>
            <input
              type="date"
              className="receipts-date-input"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setOverdueFilter(false);
              }}
            />
          </div>
          {(dateFrom || dateTo || statusFilter || overdueFilter) && (
            <button className="receipts-clear-btn" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="receipts-card">
        {error && <div className="receipts-error">{error}</div>}
        {loading ? (
          <div className="receipts-loading">Loading…</div>
        ) : receipts.length === 0 ? (
          <div className="receipts-empty">No receipts found.</div>
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
                    <th className="receipts-th">Status</th>
                    <th className="receipts-th">Issue Date</th>
                    <th className="receipts-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr 
                      key={receipt.id || receipt.receipt_number}
                      onClick={() => handleReceiptClick(receipt)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="receipts-td">{receipt.receipt_number}</td>
                      <td className="receipts-td">{receipt.agency?.agency_name || receipt.agency_name || 'N/A'}</td>
                      <td className="receipts-td">{Number(receipt.amount || 0).toFixed(2)}</td>
                      <td className="receipts-td">{receipt.currency || '-'}</td>
                      <td className="receipts-td">{statusPill(receipt.status)}</td>
                      <td className="receipts-td">{formatDT(receipt.issue_date, receipt.issue_time)}</td>
                      <td className="receipts-td">
                        <button
                          className="receipts-btn receipts-btn--ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            (async () => {
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
                            })();
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

      {/* Receipt Details Modal */}
      <ReceiptDetailsModal
        receipt={selectedReceipt}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onStatusUpdated={handleStatusUpdated}
      />
    </div>
  );
}