import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const emailInputRef = useRef(null);

  // Autofocus email field on mount
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({ email, password });
      
      // Store token and user data
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
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
          <h1 className="login-title">Kush Air</h1>
          <p className="login-subtitle">Avelio Credit Platform</p>
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
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="form-input"
                autoComplete="email"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="form-input"
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="forgot-password">
            <button type="button" className="forgot-link" disabled>
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="login-btn"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Info Box */}
        <div className="login-info">
          <p>
            <strong>Demo Credentials:</strong><br />
            Email: admin@kushair.com<br />
            Password: admin123
          </p>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p className="powered-by">
            Powered by Avelio
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;