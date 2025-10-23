import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewReceipt from './pages/NewReceipt';
import ReceiptSuccess from './pages/ReceiptSuccess';
import Account from './pages/Account';
import Receipts from './pages/Receipts';          
import TravelAgencies from './pages/TravelAgencies';
import ExportData from './pages/ExportData';
import Analytics from './pages/Analytics';      
import AppHeader from './pages/AppHeader';      

function App() {
  // Use state for authentication to trigger re-renders
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication on mount and when localStorage changes
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      setIsAuthenticated(!!token);
      setIsLoading(false);
      console.log('🔐 Auth check:', !!token ? 'Authenticated' : 'Not authenticated');
    };

    // Initial check
    checkAuth();

    // Listen for storage changes (in case of logout in another tab)
    window.addEventListener('storage', checkAuth);

    // Custom event for when login happens
    window.addEventListener('login-success', checkAuth);

    // Custom event for when logout happens
    window.addEventListener('logout-success', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('login-success', checkAuth);
      window.removeEventListener('logout-success', checkAuth);
    };
  }, []);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #0ea5e9',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#64748b' }}>Loading...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <Router>
      <AppHeader />
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
        />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/new-receipt" 
          element={isAuthenticated ? <NewReceipt /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/receipt-success" 
          element={isAuthenticated ? <ReceiptSuccess /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/account" 
          element={isAuthenticated ? <Account /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/receipts" 
          element={isAuthenticated ? <Receipts /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/agencies" 
          element={isAuthenticated ? <TravelAgencies /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/export" 
          element={isAuthenticated ? <ExportData /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/analytics" 
          element={isAuthenticated ? <Analytics /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} 
        />
      </Routes>
    </Router>
  );
}

export default App;