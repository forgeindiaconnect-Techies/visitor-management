import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, UserCheck, Lock, Mail, Phone, Building, MapPin, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

const PreRegister = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [invitation, setInvitation] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    visitorName: '',
    email: '',
    mobileNumber: '',
    address: '',
    companyName: 'Forge India Connect Private Limited',
    password: '',
    confirmPassword: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [registeredResult, setRegisteredResult] = useState(null);

  const _rawUrl = import.meta.env.VITE_API_URL || 'https://fic-visitor-1.onrender.com';
  const API_BASE = _rawUrl.replace(/\/api\/?$/, '') + '/api';

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setValid(false);
      setErrorMessage('No registration token provided.');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`${API_BASE}/invitations/verify/${token}`);
        const data = await response.json();

        if (response.ok && data.valid) {
          setValid(true);
          setInvitation(data.invitation);
          setFormData(prev => ({
            ...prev,
            visitorName: data.invitation.visitorName || '',
            email: data.invitation.email || '',
            mobileNumber: data.invitation.mobileNumber || '',
            companyName: data.invitation.companyName || 'Forge India Connect Private Limited',
            address: data.invitation.notes || ''
          }));
        } else {
          setValid(false);
          setErrorMessage(data.message || 'This registration link is invalid or has expired.');
        }
      } catch (err) {
        setValid(false);
        setErrorMessage('Failed to verify registration link. Please check your network connection.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token, API_BASE]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (formData.password.length < 4) {
      setFormError('Password must be at least 4 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/invitations/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          visitorName: formData.visitorName,
          mobileNumber: formData.mobileNumber,
          address: formData.address,
          companyName: formData.companyName,
          password: formData.password
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setRegisteredResult(data);
      } else {
        setFormError(data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white space-y-4">
          <Loader2 size={48} className="animate-spin text-indigo-500 mx-auto" />
          <p className="text-slate-400 font-medium text-sm">Verifying your secure registration link...</p>
        </div>
      </div>
    );
  }

  // Friendly Error Screen if Token is Invalid / Expired / Used
  if (!valid) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
            <AlertCircle size={36} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Link Invalid or Expired</h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {errorMessage || 'This registration link is invalid or has expired.'}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 text-left space-y-1">
            <p className="font-bold text-slate-700">Need Assistance?</p>
            <p>Please contact the host or reception to issue a new pre-booking registration link.</p>
          </div>
          <Link 
            to="/login"
            className="block w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors shadow-md"
          >
            Go to Portal Login
          </Link>
        </div>
      </div>
    );
  }

  // Success Screen After Registration
  if (registeredResult) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
            <CheckCircle2 size={44} />
          </div>
          <div>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
              Registration Activated
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">Registration Complete!</h2>
            <p className="text-sm text-slate-600 mt-1">
              Your account has been activated and your Visitor Pass has been generated.
            </p>
          </div>

          <div className="bg-slate-50 border border-indigo-100 rounded-xl p-4 text-left space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Booking ID</span>
              <span className="font-mono font-bold text-indigo-600">{registeredResult.bookingId}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">Visit ID</span>
              <span className="font-mono font-bold text-slate-800">{registeredResult.visitId}</span>
            </div>
          </div>

          <div className="space-y-3">
            <a 
              href={registeredResult.passUrl} 
              target="_blank" 
              rel="noreferrer"
              className="w-full py-3 bg-[var(--color-brand-indigo)] hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <span>View Visitor Pass & QR Code</span>
              <ArrowRight size={18} />
            </a>
            <button 
              onClick={() => navigate('/login')}
              className="w-full py-3 border border-slate-300 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              Sign In to Your Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Registration Form Page
  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-8 py-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Complete Visitor Registration</h2>
            <p className="text-xs text-slate-400 mt-1">Pre-Booking Invitation Verified</p>
          </div>
          <div className="h-10 w-10 bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30">
            <UserCheck size={24} />
          </div>
        </div>

        {/* Invitation Info Card */}
        <div className="bg-indigo-50/60 px-8 py-4 border-b border-indigo-100 flex items-center justify-between text-xs">
          <div>
            <span className="text-indigo-500 font-semibold block">Scheduled Visit</span>
            <span className="font-bold text-slate-800">{invitation.visitDate} ({invitation.visitTime || '10:00 AM'})</span>
          </div>
          <div className="text-right">
            <span className="text-indigo-500 font-semibold block">Branch</span>
            <span className="font-bold text-slate-800">📍 {invitation.branch}</span>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Full Name</label>
              <div className="relative">
                <input 
                  type="text" 
                  name="visitorName" 
                  value={formData.visitorName} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Email Address (Read Only)</label>
                <div className="relative">
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    readOnly 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Mobile Number</label>
                <div className="relative">
                  <input 
                    type="text" 
                    name="mobileNumber" 
                    value={formData.mobileNumber} 
                    onChange={handleChange} 
                    required
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Company Name</label>
              <input 
                type="text" 
                name="companyName" 
                value={formData.companyName} 
                onChange={handleChange} 
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Address / Notes</label>
              <textarea 
                name="address" 
                rows="2"
                value={formData.address} 
                onChange={handleChange} 
                placeholder="Enter your address..."
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Create Password *</label>
                <input 
                  type="password" 
                  name="password" 
                  value={formData.password} 
                  onChange={handleChange} 
                  required
                  placeholder="Min 4 chars"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Confirm Password *</label>
                <input 
                  type="password" 
                  name="confirmPassword" 
                  value={formData.confirmPassword} 
                  onChange={handleChange} 
                  required
                  placeholder="Re-enter password"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm bg-white"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors shadow-lg flex items-center justify-center gap-2 mt-4"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Completing Registration...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Complete Registration</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PreRegister;
