import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  DollarSign, 
  CreditCard, 
  Banknote,
  CheckCircle,
  Clock,
  FileText,
  AlertCircle,
  Search
} from 'lucide-react';
import api, { receiptsAPI } from '../services/api';
import './NewReceipt.css';

function NewReceipt() {
  const [selectedAgency, setSelectedAgency] = useState('');
  const [agencies, setAgencies] = useState([]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [status, setStatus] = useState('PAID');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const amountInputRef = useRef(null);

  // Auto-focus amount input
  useEffect(() => {
    if (amountInputRef.current && selectedAgency) {
      amountInputRef.current.focus();
    }
  }, [selectedAgency]);

  useEffect(() => {
  let isMounted = true;
  (async () => {
    try {
      const res = await api.get('/agencies');
      // normalize shapes: {data:{agencies}} or {data:{rows}} or {agencies}/{rows}
      const list =
        res?.data?.data?.agencies ??
        res?.data?.data?.rows ??
        res?.data?.agencies ??
        res?.data?.rows ??
        [];
      if (isMounted) setAgencies(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Fetch agencies error:', err?.response?.data || err.message);
    }
    const token =
  localStorage.getItem('token') ||
  localStorage.getItem('authToken') ||
  sessionStorage.getItem('token');
  })();
  return () => { isMounted = false; };
}, []);

  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = value.split('.');
    if (parts.length > 2) return;
    setAmount(value);
  };

  const formatAmount = (value) => {
    if (!value) return '';
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredAgencies = agencies.filter(agency =>
    agency.agency_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.agency_id.includes(searchTerm)
  );

  const handleSelectAgency = (agencyId) => {
    setSelectedAgency(agencyId);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const getSelectedAgencyName = () => {
    const agency = agencies.find(a => a.id === selectedAgency);
    return agency ? `${agency.agency_name} (${agency.agency_id})` : '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!selectedAgency) {
      setError('Please select an agency');
      return;
    }
    
const amountNum = parseFloat(String(amount).replace(/,/g, ''));    if (!amount || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      const response = await receiptsAPI.create({
        agency_id: selectedAgency,
        amount: amountNum,
        currency: 'USD',
        payment_method: paymentMethod,
        status: status,
        remarks: ''
      });

      // Success! Navigate to receipt view
      navigate('/receipt-success', { 
        state: { receipt: response.data.data.receipt } 
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create receipt. Please try again.');
      setLoading(false);
    }
  };

  const navigate = useNavigate();
  const isFormValid = selectedAgency && amount && parseFloat(amount) > 0;

  return (
    <div className="new-receipt-container">

      <main className="form-main">
        <form onSubmit={handleSubmit} className="receipt-form">
          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Agency Selector with Search */}
          <div className="form-group">
            <label>
              <Building2 size={18} />
              Travel Agency
            </label>
            
            {!selectedAgency ? (
              <div className="search-select-wrapper">
                <div className="search-input-wrapper">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search agencies..."
                    className="search-input"
                  />
                </div>
                
                {showDropdown && (
                  <div className="agency-dropdown">
                    {filteredAgencies.length > 0 ? (
                      filteredAgencies.map((agency) => (
                        <div
                          key={agency.agency_id}
                          className="agency-option"
                          onClick={() => handleSelectAgency(agency.id)}                        >
                          <Building2 size={16} />
                          <div className="agency-option-info">
                            <div className="agency-option-name">{agency.agency_name}</div>
                            <div className="agency-option-id">{agency.agency_id}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="agency-option-empty">No agencies found</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="selected-agency">
                <Building2 size={18} />
                <span>{getSelectedAgencyName()}</span>
                <button
                  type="button"
                  onClick={() => setSelectedAgency('')}
                  className="change-btn"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Amount Input - REDUCED SIZE */}
          <div className="form-group amount-group">
            <label>
              <DollarSign size={18} />
              Deposit Amount
            </label>
            <div className="amount-display-small">
              <span className="currency-small">$</span>
              <span className="amount-value-small">
                {amount ? formatAmount(amount) : '0.00'}
              </span>
            </div>
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              placeholder="Enter amount"
              required
              className="amount-input"
            />
            {amount && parseFloat(amount) > 0 && (
              <div className="amount-valid">
                <CheckCircle size={14} />
                Validated – Ready to Issue
              </div>
            )}
          </div>

          {/* Payment Method Toggle - SOLID FILL FOR ACTIVE */}
          <div className="form-group">
            <label>
              <CreditCard size={18} />
              Payment Method
            </label>
            <div className="status-toggle">
              <button
                type="button"
                className={`toggle-btn ${paymentMethod === 'CASH' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('CASH')}
              >
                <Banknote size={18} />
                Cash
              </button>
              <button
                type="button"
                className={`toggle-btn ${paymentMethod === 'BANK TRANSFER' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('BANK TRANSFER')}
              >
                <CreditCard size={18} />
                Bank Transfer
              </button>
            </div>
          </div>

          {/* Receipt Status - RENAMED FROM "PAYMENT STATUS" */}
          <div className="form-group">
            <label>
              <FileText size={18} />
              Receipt Status
            </label>
            <div className="status-toggle">
              <button
                type="button"
                className={`toggle-btn ${status === 'PAID' ? 'active' : ''}`}
                onClick={() => setStatus('PAID')}
              >
                <CheckCircle size={18} />
                Paid
              </button>
              <button
                type="button"
                className={`toggle-btn ${status === 'PENDING' ? 'active' : ''}`}
                onClick={() => setStatus('PENDING')}
              >
                <Clock size={18} />
                Pending
              </button>
            </div>
          </div>

          {/* Submit Button - AVELIO BLUE & DISABLED UNTIL VALID */}
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="submit-btn"
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Creating Receipt...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                Issue Receipt
              </>
            )}
          </button>

          {/* Info Box - MOVED TO BOTTOM, GRAY BORDER, SMALLER FONT */}
          <div className="form-info-bottom">
            <p>
              <strong>Note:</strong> This receipt confirms the agency's credit deposit. 
              The PDF will include employee signature, company stamp, and QR verification code.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}

export default NewReceipt;