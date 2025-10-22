// src/pages/Dashboard.js
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReceiptDetailsModal from './ReceiptDetailsModal';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Modal state
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('token');

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';

  // Fetch stats from dedicated endpoint
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      return data?.data || null;
    } catch (err) {
      console.error('Stats fetch error:', err);
      return null;
    }
  };

  // Fetch recent receipts for display (last 8)
  const fetchReceipts = async () => {
    try {
      const res = await fetch(`${API_BASE}/receipts?pageSize=20`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch receipts');
      const data = await res.json();
      const list =
        data?.receipts ??
        data?.data?.receipts ??
        data?.data?.rows ??
        data?.rows ??
        data?.list ??
        [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.error('Receipts fetch error:', err);
      return [];
    }
  };

  // Calculate overdue count from receipts (PENDING + >3 days from issue_date)
  const calculateOverdue = (receiptsList) => {
    return receiptsList.filter(r => {
      if (r.status?.toUpperCase() !== 'PENDING') return false;
      const issueDate = new Date(r.issue_date);
      const daysDiff = Math.floor((Date.now() - issueDate) / (1000 * 60 * 60 * 24));
      return daysDiff > 3;
    }).length;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch both stats and receipts in parallel
        const [statsData, receiptsList] = await Promise.all([
          fetchStats(),
          fetchReceipts()
        ]);

        setStats(statsData);
        setReceipts(receiptsList);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [API_BASE, token, refreshTrigger]);

  // Calculate stats from stats API + overdue from receipts
  const todayCount = stats?.today?.receipt_count || 0;
  const paidCount = stats?.paid?.count || 0;
  const pendingCount = stats?.pending?.count || 0;
  const overdueCount = calculateOverdue(receipts);

  // Navigation handlers with query params
  const handleStatClick = (filterType) => {
    switch (filterType) {
      case 'today':
        navigate('/receipts?date=today');
        break;
      case 'paid':
        navigate('/receipts?status=PAID');
        break;
      case 'pending':
        navigate('/receipts?status=PENDING');
        break;
      case 'overdue':
        navigate('/receipts?filter=overdue');
        break;
      default:
        navigate('/receipts');
    }
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
    <div className="dashboard-container">
      <div className="dashboard-content">
        {/* === Page Header === */}
        <div className="page-header">
          <div className="page-title-section">
            <h2 className="page-title">Dashboard</h2>
            <span className="page-subtitle">
              Overview of latest receipts and quick navigation
            </span>
          </div>
          <Link to="/new-receipt" className="action-btn">+ New Receipt</Link>
        </div>

        {/* === Stats Grid === */}
        <div className="stats-grid">
          <div 
            className="stat-card" 
            onClick={() => handleStatClick('today')}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-header">
              <span className="stat-label">Today's Receipts</span>
              <div className="stat-icon">📅</div>
            </div>
            <div className="stat-value">{todayCount}</div>
            <div className="stat-subtext">Receipts issued today</div>
          </div>

          <div 
            className="stat-card"
            onClick={() => handleStatClick('paid')}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-header">
              <span className="stat-label">Paid</span>
              <div className="stat-icon">✅</div>
            </div>
            <div className="stat-value">{paidCount}</div>
            <div className="stat-subtext">Receipts fully paid</div>
          </div>

          <div 
            className="stat-card"
            onClick={() => handleStatClick('pending')}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-header">
              <span className="stat-label">Pending</span>
              <div className="stat-icon">⏳</div>
            </div>
            <div className="stat-value">{pendingCount}</div>
            <div className="stat-subtext">Awaiting payment</div>
          </div>

          <div 
            className="stat-card"
            onClick={() => handleStatClick('overdue')}
            style={{ cursor: 'pointer' }}
          >
            <div className="stat-header">
              <span className="stat-label">Overdue</span>
              <div className="stat-icon">⚠️</div>
            </div>
            <div className="stat-value">{overdueCount}</div>
            <div className="stat-subtext">Pending over 3 days</div>
          </div>
        </div>

        {/* === Latest Receipts === */}
        <div className="section-header">
          <h2 className="section-title">Latest Receipts</h2>
          <button
            className="action-btn"
            style={{ padding: '10px 18px' }}
            onClick={() => navigate('/receipts')}
          >
            View All Receipts
          </button>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">🌀</div>
            <div className="empty-title">Loading receipts…</div>
          </div>
        ) : receipts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔭</div>
            <div className="empty-title">No receipts found</div>
            <div className="empty-text">Start by creating your first receipt.</div>
            <Link to="/new-receipt" className="action-btn">+ New Receipt</Link>
          </div>
        ) : (
          <div className="receipts-list">
            {receipts.slice(0, 8).map(r => (
              <div 
                key={r.id || r.receipt_number} 
                className="receipt-card"
                onClick={() => handleReceiptClick(r)}
                style={{ cursor: 'pointer' }}
              >
                <div className="receipt-left">
                  <div className="receipt-avatar">💵</div>
                  <div className="receipt-info">
                    <div className="receipt-number">{r.receipt_number}</div>
                    <div className="receipt-agency">
                      <strong>{r.agency_name || r.agency?.agency_name || 'N/A'}</strong>
                    </div>
                    <div className="receipt-time">
                      {new Date(r.issue_date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
                <div className="receipt-meta">
                  <div className="receipt-amount">
                    {Number(r.amount || 0).toFixed(2)} {r.currency || 'USD'}
                  </div>
                  <div
                    className={`receipt-status ${
                      r.status?.toLowerCase() === 'paid' ? 'paid' : 'pending'
                    }`}
                  >
                    {r.status?.toUpperCase() || '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === Quick Navigation === */}
        <div className="quick-actions">
          <div className="quick-actions-header">
            <h3 className="quick-actions-title">Quick Navigation</h3>
          </div>
          <div className="quick-actions-grid">
            <div className="quick-action-btn" onClick={() => navigate('/new-receipt')}>
              <div className="quick-action-icon">➕</div>
              <div className="quick-action-text">Create Receipt</div>
            </div>
            <div className="quick-action-btn" onClick={() => navigate('/receipts')}>
              <div className="quick-action-icon">🧾</div>
              <div className="quick-action-text">All Receipts</div>
            </div>
            <div className="quick-action-btn" onClick={() => navigate('/agencies')}>
              <div className="quick-action-icon">🏢</div>
              <div className="quick-action-text">Travel Agencies</div>
            </div>
            <div className="quick-action-btn" onClick={() => navigate('/export')}>
              <div className="quick-action-icon">⬇️</div>
              <div className="quick-action-text">Export Data</div>
            </div>
            <div className="quick-action-btn" onClick={() => navigate('/analytics')}>
              <div className="quick-action-icon">📊</div>
              <div className="quick-action-text">Analytics</div>
            </div>
          </div>
        </div>

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