import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, CheckCircle, Eye, EyeOff, Building, User, Phone, Sparkles } from 'lucide-react';
import logoImg from '../assets/logo.svg';

const Login = () => {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  
  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [plan, setPlan] = useState('Basic');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successCode, setSuccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isExiting, setIsExiting] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    if (mode === 'login') {
      const result = await login(email, password, rememberMe);
      if (result.success) {
        setIsLoading(false);
        setIsSuccess(true);
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(() => {
            navigate('/dashboard');
          }, 500);
        }, 1000);
      } else {
        setIsLoading(false);
        setErrorMsg(result.message || 'Login failed. Please try again.');
        setShakeKey(prev => prev + 1);
      }
    } else {
      // Register company
      try {
        const response = await fetch(`${API_BASE}/api/auth/register-company`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName,
            adminName,
            email,
            mobileNumber,
            password,
            plan
          })
        });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Registration failed');
        }

        setSuccessCode(data.company.code);
        setIsSuccess(true);
        setIsLoading(false);
        
        setTimeout(() => {
          setMode('login');
          setIsSuccess(false);
          setErrorMsg('');
        }, 6000);
      } catch (err) {
        setIsLoading(false);
        setErrorMsg(err.message || 'Registration failed');
        setShakeKey(prev => prev + 1);
      }
    }
  };

  const inputClassName = "block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 hover:bg-gray-50/80 transition-all duration-300 text-gray-800 placeholder-gray-400 font-medium";
  const passwordInputClassName = "block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 hover:bg-gray-50/80 transition-all duration-300 text-gray-800 placeholder-gray-400 font-medium";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-moving-gradient relative overflow-y-auto overflow-x-hidden py-6 px-4 transition-colors duration-500">
      {/* White background overlay */}
      <div className="absolute inset-0 bg-white/85 pointer-events-none"></div>

      {/* Decorative floating yellow & blue blobs */}
      <div className="fixed -top-20 -left-20 w-96 h-96 bg-amber-200/50 rounded-full blur-[100px] pointer-events-none animate-float-bg"></div>
      <div className="fixed -bottom-20 -right-20 w-96 h-96 bg-sky-200/50 rounded-full blur-[100px] pointer-events-none animate-float-bg-reverse"></div>
      <div className="fixed top-1/3 right-1/4 w-72 h-72 bg-indigo-100/30 rounded-full blur-[90px] pointer-events-none animate-float-bg"></div>

      <div key={shakeKey} className={`w-full max-w-md p-6 sm:p-8 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl z-10 border border-white border-t-4 border-t-[#FFC20E] animate-slide-up-fade hover:shadow-indigo-500/10 hover:shadow-[0_20px_50px_rgba(0,94,184,0.12)] transition-all duration-500 ${isExiting ? 'animate-fade-out' : ''} ${errorMsg ? 'animate-shake' : ''}`}>
        <div className="text-center mb-6">
          <div className="mx-auto w-32 h-32 flex items-center justify-center mb-2">
            <img src={logoImg} alt="Forge India Connect Logo" className="w-full h-full object-contain animate-logo-zoom" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">FIC VMS</h1>
          <p className="text-gray-500 text-sm font-medium">{mode === 'login' ? 'Zone Monitoring & Visitor Management' : 'SaaS Company Registration'}</p>
        </div>

        {isSuccess && mode === 'register' ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-200">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Tenant Registered Successfully!</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">Your Company Code</p>
              <p className="text-2xl font-extrabold text-[#005EB8] tracking-widest">{successCode}</p>
            </div>
            <p className="text-xs text-gray-500">
              Use this company code to log in. Proceeding to login screen...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Company Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building size={16} className="text-[var(--color-brand-indigo)]" />
                    </div>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className={inputClassName}
                      placeholder="e.g. Acme Corp"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Admin User Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={16} className="text-[var(--color-brand-indigo)]" />
                    </div>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className={inputClassName}
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone size={16} className="text-[var(--color-brand-indigo)]" />
                      </div>
                      <input
                        type="text"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className={inputClassName}
                        placeholder="9876543210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Select Plan</label>
                    <select
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 hover:bg-gray-50/80 transition-all duration-300 font-medium text-gray-700"
                    >
                      <option value="Basic">Basic (Free Trial)</option>
                      <option value="Standard">Standard ($29/mo)</option>
                      <option value="Enterprise">Enterprise ($99/mo)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className="text-[var(--color-brand-indigo)]" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClassName}
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-[var(--color-brand-indigo)]" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={passwordInputClassName}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[var(--color-brand-indigo)] focus:outline-none"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-500 text-xs py-2 px-3 rounded-lg text-center border border-red-100 font-medium">
                {errorMsg}
              </div>
            )}


            
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className={`w-full text-white font-bold py-2.5 rounded-lg transition-all duration-300 transform shadow-md flex items-center justify-center space-x-2 ${
                isSuccess 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] hover:-translate-y-0.5 hover:shadow-indigo-500/20 active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{mode === 'login' ? 'Authenticating...' : 'Registering...'}</span>
                </>
              ) : isSuccess && mode === 'login' ? (
                <>
                  <CheckCircle size={18} className="text-white animate-bounce" />
                  <span>Login Successful</span>
                </>
              ) : (
                <span>{mode === 'login' ? 'Sign In to Dashboard' : 'Register Company & Get Code'}</span>
              )}
            </button>

            <div className="mt-4 text-center text-xs text-gray-500 border-t border-slate-100 pt-4 space-y-2 font-medium">
              {mode === 'login' ? (
                <>

                  <div>
                    Visiting an office?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/prebook')}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold underline transition-colors"
                    >
                      Pre-Book Visit & Generate Pass
                    </button>
                  </div>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <button 
                    type="button" 
                    onClick={() => {
                      setMode('login');
                      setErrorMsg('');
                    }} 
                    className="text-[var(--color-brand-indigo)] hover:text-indigo-800 font-bold underline transition-colors"
                  >
                    Back to Sign In
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
