// src/pages/Analytics.js
import React, { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  Title, Tooltip, Legend, Filler, LineController, BarController, DoughnutController
} from 'chart.js';
import './Analytics.css';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  Title, Tooltip, Legend, Filler, LineController, BarController, DoughnutController
);

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';

async function apiGet(path) {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(API_BASE + path, { headers });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return await res.json();
}

const rollingAvg = (arr, n) => {
  if (n <= 1) return arr.slice();
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - n + 1);
    const slice = arr.slice(start, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
};

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [data, setData]     = useState(null);

  // quick range: 6 months | 12 months | YTD
  const [range, setRange] = useState('6m'); // '6m' | '12m' | 'ytd'

  // charts
  const revTrendRef   = useRef(null);
  const statusRef     = useRef(null);
  const agenciesRef   = useRef(null);
  const countRef      = useRef(null);
  const stackedRef    = useRef(null); // paid vs pending counts (stacked)

  const chartsRef = useRef({});

  // fetch & compute
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');

        const res = await apiGet('/receipts');
        const receipts = res?.data?.receipts || res?.receipts || [];

        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear  = now.getFullYear();
        const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const lastYear  = thisMonth === 0 ? thisYear - 1 : thisYear;

        const a = {
          totalRevenue: 0,
          paidRevenue: 0,
          pendingRevenue: 0,
          voidRevenue: 0,
          totalReceipts: receipts.length,
          paidReceipts: 0,
          pendingReceipts: 0,
          voidReceipts: 0,
          thisMonthRevenue: 0,
          lastMonthRevenue: 0,
          thisMonthReceipts: 0,
          lastMonthReceipts: 0,
          averageReceiptValue: 0,
          byStatus: { PAID: 0, PENDING: 0, VOID: 0 },
          byMonth: {},           // { 'YYYY-MM': { revenue, count } }
          byMonthStatus: {},     // { 'YYYY-MM': { PAID:count, PENDING:count, VOID:count } }
          topAgencies: {},       // { name: { count, revenue } }
          growthRate: 0
        };

        receipts.forEach(r => {
          const amount = parseFloat(r.amount || 0);
          const status = (r.status || 'UNKNOWN').toUpperCase();
          const d = new Date(r.issue_date);
          const m = d.getMonth();
          const y = d.getFullYear();
          const key = `${y}-${String(m + 1).padStart(2,'0')}`;

          a.totalRevenue += amount;
          a.byStatus[status] = (a.byStatus[status] || 0) + amount;

          if (status === 'PAID') { a.paidRevenue += amount; a.paidReceipts++; }
          else if (status === 'PENDING') { a.pendingRevenue += amount; a.pendingReceipts++; }
          else if (status === 'VOID') { a.voidRevenue += amount; a.voidReceipts++; }

          if (!a.byMonth[key]) a.byMonth[key] = { revenue: 0, count: 0 };
          a.byMonth[key].revenue += amount;
          a.byMonth[key].count++;

          if (!a.byMonthStatus[key]) a.byMonthStatus[key] = { PAID: 0, PENDING: 0, VOID: 0 };
          a.byMonthStatus[key][status] = (a.byMonthStatus[key][status] || 0) + 1;

          if (m === thisMonth && y === thisYear) { a.thisMonthRevenue += amount; a.thisMonthReceipts++; }
          if (m === lastMonth && y === lastYear) { a.lastMonthRevenue += amount; a.lastMonthReceipts++; }

          const agency = r.agency?.agency_name || r.agency_name || 'Unknown';
          if (!a.topAgencies[agency]) a.topAgencies[agency] = { count: 0, revenue: 0 };
          a.topAgencies[agency].count++;
          a.topAgencies[agency].revenue += amount;
        });

        a.averageReceiptValue = a.totalReceipts > 0 ? a.totalRevenue / a.totalReceipts : 0;
        if (a.lastMonthRevenue > 0) {
          a.growthRate = ((a.thisMonthRevenue - a.lastMonthRevenue) / a.lastMonthRevenue) * 100;
        }

        a.topAgenciesList = Object.entries(a.topAgencies)
          .map(([name, v]) => ({ name, ...v }))
          .sort((x, y) => y.revenue - x.revenue)
          .slice(0, 10);

        setData(a);
      } catch (e) {
        setError(e.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // charts render
  useEffect(() => {
    if (!data || loading) return;

    // destroy old
    Object.values(chartsRef.current).forEach(c => c && c.destroy());
    chartsRef.current = {};

    // prepare months range
    const allMonths = Object.keys(data.byMonth).sort();
    const months = (() => {
      if (range === 'ytd') {
        const y = new Date().getFullYear();
        return allMonths.filter(k => k.startsWith(String(y)));
      }
      if (range === '12m') return allMonths.slice(-12);
      return allMonths.slice(-6);
    })();

    const revArr = months.map(m => data.byMonth[m]?.revenue || 0);
    const cumRev = revArr.reduce((acc, v, i) => {
      acc.push(v + (acc[i-1] || 0));
      return acc;
    }, []);
    const movAvg = rollingAvg(revArr, 3);

    const labelsFull = months.map(m => {
      const [y, mo] = m.split('-');
      const d = new Date(y, parseInt(mo)-1);
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    // 1) Revenue Trend + 3M Moving Avg (line) + Cumulative (area)
    if (revTrendRef.current) {
      chartsRef.current.revenue = new ChartJS(revTrendRef.current, {
        type: 'line',
        data: {
          labels: labelsFull,
          datasets: [
            {
              label: 'Revenue',
              data: revArr,
              borderColor: '#0EA5E9',
              backgroundColor: 'rgba(14,165,233,0.12)',
              fill: true,
              tension: 0.4,
              borderWidth: 3,
              pointRadius: 4,
              pointBackgroundColor: '#0EA5E9'
            },
            {
              label: '3-mo Avg',
              data: movAvg,
              borderColor: '#0284C7',
              fill: false,
              tension: 0.3,
              borderDash: [6,4],
              pointRadius: 0,
              borderWidth: 2
            },
            {
              label: 'Cumulative',
              data: cumRev,
              borderColor: '#10B981',
              backgroundColor: 'rgba(16,185,129,0.10)',
              fill: true,
              tension: 0.25,
              pointRadius: 0,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              backgroundColor: '#1A202C',
              padding: 12,
              titleColor: '#fff',
              bodyColor: '#fff',
              callbacks: {
                label: ctx => {
                  const v = ctx.parsed.y || 0;
                  const name = ctx.dataset.label;
                  return `${name}: $${v.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#E2E8F0' },
              ticks: { callback: v => '$' + Number(v).toLocaleString() }
            },
            y1: {
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { callback: v => '$' + Number(v).toLocaleString() }
            },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 2) Revenue by Status (doughnut)
    if (statusRef.current) {
      chartsRef.current.status = new ChartJS(statusRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Pending', 'Void'],
          datasets: [{
            data: [
              data.byStatus.PAID || 0,
              data.byStatus.PENDING || 0,
              data.byStatus.VOID || 0
            ],
            backgroundColor: ['#10B981','#F59E0B','#EF4444'],
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 14, font: { size: 12, weight: '700' } } },
            tooltip: {
              backgroundColor: '#1A202C',
              padding: 12,
              callbacks: {
                label: ctx => {
                  const value = ctx.parsed || 0;
                  const total = ctx.dataset.data.reduce((a,b)=>a+b,0) || 1;
                  const p = (value/total*100).toFixed(1);
                  return `${ctx.label}: $${value.toLocaleString(undefined,{maximumFractionDigits:2})} (${p}%)`;
                }
              }
            }
          }
        }
      });
    }

    // 3) Top Agencies (horizontal bar)
    if (agenciesRef.current) {
      const top5 = (data.topAgenciesList || []).slice(0,5);
      chartsRef.current.agencies = new ChartJS(agenciesRef.current, {
        type: 'bar',
        data: {
          labels: top5.map(a => a.name.length>22 ? a.name.slice(0,22)+'…' : a.name),
          datasets: [{
            label: 'Revenue',
            data: top5.map(a => a.revenue),
            backgroundColor: 'rgba(14,165,233,0.85)',
            borderColor: '#0EA5E9',
            borderWidth: 2,
            borderRadius: 8
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display:false },
            tooltip: {
              backgroundColor:'#1A202C',
              padding:12,
              callbacks: { label: ctx => `Revenue: $${ctx.parsed.x.toLocaleString()}` }
            }
          },
          scales: {
            x: { beginAtZero:true, grid:{color:'#E2E8F0'}, ticks:{ callback:v=>'$'+Number(v).toLocaleString()} },
            y: { grid:{display:false} }
          }
        }
      });
    }

    // 4) Monthly Receipts Count (bar)
    if (countRef.current) {
      const counts = months.map(m => data.byMonth[m]?.count || 0);
      chartsRef.current.count = new ChartJS(countRef.current, {
        type: 'bar',
        data: {
          labels: labelsFull.map(l => l.split(' ')[0]),
          datasets: [{
            label: 'Receipts',
            data: counts,
            backgroundColor: 'rgba(2,132,199,0.85)',
            borderColor: '#0284C7',
            borderWidth: 2,
            borderRadius: 8
          }]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins: {
            legend:{display:false},
            tooltip:{ backgroundColor:'#1A202C', padding:12, callbacks:{ label: c => `${c.parsed.y} receipts` } }
          },
          scales: {
            y:{ beginAtZero:true, grid:{color:'#E2E8F0'}, ticks:{ stepSize:1 }},
            x:{ grid:{display:false} }
          }
        }
      });
    }

    // 5) Paid vs Pending counts by month (stacked)
    if (stackedRef.current) {
      const paid = months.map(m => data.byMonthStatus[m]?.PAID || 0);
      const pend = months.map(m => data.byMonthStatus[m]?.PENDING || 0);

      chartsRef.current.stacked = new ChartJS(stackedRef.current, {
        type: 'bar',
        data: {
          labels: labelsFull.map(l => l.split(' ')[0]),
          datasets: [
            { label:'Paid',    data: paid, backgroundColor:'rgba(16,185,129,.9)', borderColor:'#10B981', borderWidth:1, borderRadius:6, stack:'s' },
            { label:'Pending', data: pend, backgroundColor:'rgba(245,158,11,.9)', borderColor:'#F59E0B', borderWidth:1, borderRadius:6, stack:'s' },
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins: {
            legend:{ position:'bottom' },
            tooltip:{ backgroundColor:'#1A202C', padding:12 }
          },
          scales: {
            x: { stacked:true, grid:{display:false} },
            y: { stacked:true, beginAtZero:true, grid:{color:'#E2E8F0'} }
          }
        }
      });
    }

    return () => {
      Object.values(chartsRef.current).forEach(c => c && c.destroy());
    };
  }, [data, loading, range]);

  const formatCurrency = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  const exportSummaryCSV = () => {
    if (!data) return;
    const lines = [
      ['Metric','Value'],
      ['Total Revenue', data.totalRevenue],
      ['Paid Revenue', data.paidRevenue],
      ['Pending Revenue', data.pendingRevenue],
      ['Void Revenue', data.voidRevenue],
      ['Total Receipts', data.totalReceipts],
      ['Average Receipt', data.averageReceiptValue],
      ['This Month Revenue', data.thisMonthRevenue],
      ['Last Month Revenue', data.lastMonthRevenue],
      ['Growth Rate (%)', data.growthRate]
    ].map(r => r.join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'analytics-summary.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="analytics-page"><div className="analytics-loading">Loading analytics…</div></div>;
  }
  if (error) {
    return <div className="analytics-page"><div className="analytics-error">{error}</div></div>;
  }

  const collectionRate = data.totalRevenue > 0 ? (data.paidRevenue / data.totalRevenue) * 100 : 0;
  const pendingRatio   = data.totalRevenue > 0 ? (data.pendingRevenue / data.totalRevenue) * 100 : 0;
  const top1 = data.topAgenciesList?.[0];

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Analytics & Insights</h2>
          <p className="analytics-subtitle">Modern, actionable financial analytics for Avelio</p>
        </div>

        <div className="analytics-controls">
          <button className={`analytics-chip ${range==='6m' ? 'active':''}`} onClick={()=>setRange('6m')}>Last 6M</button>
          <button className={`analytics-chip ${range==='12m' ? 'active':''}`} onClick={()=>setRange('12m')}>Last 12M</button>
          <button className={`analytics-chip ${range==='ytd' ? 'active':''}`} onClick={()=>setRange('ytd')}>YTD</button>
          <button className="analytics-btn" onClick={exportSummaryCSV}>↧ Export</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon">💰</div>
          <div className="analytics-kpi-content">
            <div className="analytics-kpi-label">Total Revenue</div>
            <div className="analytics-kpi-value">{formatCurrency(data.totalRevenue)}</div>
            <div className="analytics-kpi-meta">{data.totalReceipts} total receipts</div>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon">📈</div>
          <div className="analytics-kpi-content">
            <div className="analytics-kpi-label">This Month</div>
            <div className="analytics-kpi-value">{formatCurrency(data.thisMonthRevenue)}</div>
            <div className={`analytics-kpi-change ${data.growthRate >= 0 ? 'positive':'negative'}`}>
              {data.growthRate >= 0 ? '↑' : '↓'} {Math.abs(data.growthRate).toFixed(1)}% vs last month
            </div>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon">🎯</div>
          <div className="analytics-kpi-content">
            <div className="analytics-kpi-label">Collection Rate</div>
            <div className="analytics-kpi-value">{collectionRate.toFixed(1)}%</div>
            <div className="analytics-kpi-meta">{formatCurrency(data.paidRevenue)} of {formatCurrency(data.totalRevenue)}</div>
          </div>
        </div>

        <div className="analytics-kpi-card">
          <div className="analytics-kpi-icon">⏳</div>
          <div className="analytics-kpi-content">
            <div className="analytics-kpi-label">Pending</div>
            <div className="analytics-kpi-value">{formatCurrency(data.pendingRevenue)}</div>
            <div className="analytics-kpi-meta">{pendingRatio.toFixed(1)}% of total</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="analytics-charts-grid">
        <div className="analytics-chart-card analytics-chart-card--wide">
          <div className="analytics-chart-header">
            <h3 className="analytics-chart-title">Revenue Trend</h3>
            <span className="analytics-chart-subtitle">Monthly revenue, 3-month moving average & cumulative</span>
          </div>
          <div className="analytics-chart-container"><canvas ref={revTrendRef} /></div>
        </div>

        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <h3 className="analytics-chart-title">Revenue by Status</h3>
            <span className="analytics-chart-subtitle">Paid vs Pending vs Void</span>
          </div>
          <div className="analytics-chart-container"><canvas ref={statusRef} /></div>
        </div>

        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <h3 className="analytics-chart-title">Receipts Count</h3>
            <span className="analytics-chart-subtitle">Monthly volume</span>
          </div>
          <div className="analytics-chart-container"><canvas ref={countRef} /></div>
        </div>

        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <h3 className="analytics-chart-title">Paid vs Pending (Counts)</h3>
            <span className="analytics-chart-subtitle">Workload mix, stacked by month</span>
          </div>
          <div className="analytics-chart-container"><canvas ref={stackedRef} /></div>
        </div>

        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <h3 className="analytics-chart-title">Top Agencies</h3>
            <span className="analytics-chart-subtitle">Highest revenue contributors</span>
          </div>
          <div className="analytics-chart-container"><canvas ref={agenciesRef} /></div>
        </div>
      </div>

      {/* Insights */}
      <div className="analytics-insights">
        <h3 className="analytics-insights-title">Key Insights</h3>
        <div className="analytics-insights-grid">
          <div className="analytics-insight-card">
            <div className="analytics-insight-icon">🏆</div>
            <div className="analytics-insight-content">
              <div className="analytics-insight-label">Top Performer</div>
              <div className="analytics-insight-value">{top1?.name?.slice(0,24) || 'N/A'}</div>
              <div className="analytics-insight-desc">{formatCurrency(top1?.revenue || 0)} in revenue</div>
            </div>
          </div>

          <div className="analytics-insight-card">
            <div className="analytics-insight-icon">📦</div>
            <div className="analytics-insight-content">
              <div className="analytics-insight-label">Avg Receipt</div>
              <div className="analytics-insight-value">{formatCurrency(data.averageReceiptValue)}</div>
              <div className="analytics-insight-desc">Across {data.totalReceipts} receipts</div>
            </div>
          </div>

          <div className="analytics-insight-card">
            <div className="analytics-insight-icon">⚠️</div>
            <div className="analytics-insight-content">
              <div className="analytics-insight-label">Pending Exposure</div>
              <div className="analytics-insight-value">{pendingRatio.toFixed(1)}%</div>
              <div className="analytics-insight-desc">{formatCurrency(data.pendingRevenue)} still outstanding</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}