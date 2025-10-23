import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, Plane } from 'lucide-react';
import { handleLogin } from '../utils/auth';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔐 Attempting login...');
      
      // Get API URL from environment or use port 5001 with /api/v1
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';
      console.log('📡 API URL:', apiUrl);
      
      // Make login request
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      console.log('✅ Login successful');
      
      // Extract token from response
      const token = data?.token || data?.data?.token;
      const user = data?.user || data?.data?.user;
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      // Use auth utility to handle login
      handleLogin(token, user);
      
    } catch (err) {
      console.error('❌ Login error:', err);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.message === 'Failed to fetch' || err.message.includes('Network')) {
        errorMessage = 'Cannot connect to server. Please check if the backend is running on port 5001.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo Section */}
        <div className="login-logo">
          <div className="logo-icon">
            <Plane size={36} />
          </div>
          <h1 className="login-title">Avelio Credit</h1>
          <p className="login-subtitle">Kush Air Credit Management</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Email Input */}
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={20} className="input-icon" />
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@kushair.com"
                required
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={20} className="input-icon" />
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Forgot Password */}
          <div className="forgot-password">
            <button type="button" className="forgot-link" disabled>
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Info Box */}
          <div className="login-info">
            <p>
              <strong>Note:</strong> Use your Kush Air employee credentials to access the credit management system.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p className="powered-by">Powered by Avelio • Spirit of the South</p>
        </div>
      </div>
    </div>
  );
}

export default Login;