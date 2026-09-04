import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, CheckCircle, CreditCard, Loader2, X, Lock, Sparkles, ArrowRight, Building2, Clock, Headset, LogOut, CheckCircle2 } from 'lucide-react';
import { io } from 'socket.io-client';

const SubscriptionModals = () => {
  const { user, logout, updateUser } = useAuth();
  
  // lock, choose_plan, payment, success
  const [mode, setMode] = useState(user?.isExpired && user?.role !== 'SaaS Super Admin' ? 'lock' : 'none');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState('');

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');

  useEffect(() => {
    const handleLock = (e) => {
      if (user?.role !== 'SaaS Super Admin') {
        setMode(prev => (prev === 'none' ? 'lock' : prev));
      }
    };
    const handleOpenModal = (e) => {
      setMode('choose_plan');
    };
    
    window.addEventListener('subscription-lock', handleLock);
    window.addEventListener('open-upgrade-modal', handleOpenModal);
    
    return () => {
      window.removeEventListener('subscription-lock', handleLock);
      window.removeEventListener('open-upgrade-modal', handleOpenModal);
    };
  }, [user]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setPlansLoading(true);
        setPlansError('');

        const baseUrl = String(
          import.meta.env.VITE_API_URL ||
          'http://localhost:5000'
        ).replace(/\/api\/?$/, '');

        const response = await fetch(
          `${baseUrl}/api/plans`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message ||
            'Unable to load subscription plans.'
          );
        }

        // Trial is not displayed on the paid upgrade page
        const paidPlans = (result.data || []).filter(
          (plan) =>
            plan.name !== 'One Day Trial' &&
            plan.isActive
        );

        setPlans(paidPlans);
      } catch (error) {
        setPlansError(error.message);
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlans();
  }, []);

  useEffect(() => {
    const socketUrl = String(
      import.meta.env.VITE_API_URL ||
      'http://localhost:5000'
    ).replace(/\/api\/?$/, '');

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    const handlePlanUpdated = ({ plan }) => {
      if (!plan?._id) return;

      setPlans((currentPlans) => {
        // Remove inactive plans immediately
        if (
          !plan.isActive ||
          plan.name === 'One Day Trial'
        ) {
          return currentPlans.filter(
            (item) => item._id !== plan._id
          );
        }

        const alreadyExists =
          currentPlans.some(
            (item) => item._id === plan._id
          );

        if (alreadyExists) {
          return currentPlans.map((item) =>
            item._id === plan._id
              ? plan
              : item
          );
        }

        return [...currentPlans, plan].sort(
          (first, second) =>
            first.price - second.price
        );
      });
    };

    const joinCompanyRoom = () => {
      if (user?.companyId) {
        socket.emit('join-notification-room', {
          userId: user?._id || user?.id,
          role: user?.role,
          companyId: user.companyId
        });
      }
    };

    const handleSubscriptionUpdated = (data) => {
      if (!data) return;

      updateUser({
        isExpired: false,
        status: data.status || 'Active',
        subscription: data.subscription,
        subscriptionExpiresAt:
          data.subscriptionExpiresAt
      });

      // Close only the expired lock screen.
      // Do not interrupt the payment success screen.
      setMode((currentMode) =>
        currentMode === 'lock' ? 'none' : currentMode
      );
    };

    socket.on('connect', joinCompanyRoom);

    socket.on(
      'company_subscription_updated',
      handleSubscriptionUpdated
    );

    socket.on(
      'subscription_plan_updated',
      handlePlanUpdated
    );

    return () => {
      socket.off('connect', joinCompanyRoom);

      socket.off(
        'company_subscription_updated',
        handleSubscriptionUpdated
      );

      socket.off(
        'subscription_plan_updated',
        handlePlanUpdated
      );

      socket.disconnect();
    };
  }, [user?.companyId, user?.role]);

  const displayLimit = (value) => {
    if (Number(value) === -1) {
      return 'Unlimited';
    }

    return Number(value).toLocaleString('en-IN');
  };

  // If not locked and no modal is active, render nothing
  if (mode === 'none') return null;

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setMode('payment');
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    const res = await loadRazorpay();
    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      setIsProcessing(false);
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
      const authToken = localStorage.getItem('token') || user?.token;
      const companyId = user?.companyId || '';

      const reqHeaders = {
        'Content-Type': 'application/json'
      };
      if (authToken && authToken !== 'null' && authToken !== 'undefined') {
        reqHeaders['Authorization'] = `Bearer ${authToken}`;
      }
      if (companyId) {
        reqHeaders['X-Company-Id'] = companyId;
      }
      if (user?.role) {
        reqHeaders['X-User-Role'] = user.role;
      }
      if (user?.id || user?._id) {
        reqHeaders['X-User-Id'] = user.id || user._id;
      }
      
      const orderRes = await fetch(`${baseUrl}/api/payment/create-order`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          requestedPlan: selectedPlan.name
        })
      });
      
      const orderData = await orderRes.json();
      
      if (!orderRes.ok) {
        alert(orderData.message || 'Error creating order');
        setIsProcessing(false);
        return;
      }

      if (orderData.keyId === 'rzp_test_fallback_id') {
        alert('Payment Configuration Missing: Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your backend .env file to enable checkout.');
        setIsProcessing(false);
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Zone Monitor',
        description: `Upgrade to ${selectedPlan.name} Plan`,
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${baseUrl}/api/payment/verify`, {
              method: 'POST',
              headers: reqHeaders,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                companyId: user?.companyId || companyId || '',
                selectedPlan: selectedPlan?.name
              })
            });
            
            const verifyData = await verifyRes.json();
            
            if (verifyRes.ok) {
              setTransactionId(response.razorpay_payment_id);
              localStorage.removeItem('zmvms_pending_upgrade');
              
              updateUser({
                isExpired: false,
                subscription: selectedPlan.name,
                subscriptionExpiresAt: verifyData.subscriptionExpiresAt
              });
              
              setMode('success');
            } else {
              alert(verifyData.message || 'Payment verification failed');
            }
          } catch (err) {
            console.error(err);
            alert('Verification Error');
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: ''
        },
        theme: {
          color: '#1E1B6E'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', function (response) {
        alert('Payment Failed: ' + response.error.description);
      });
      paymentObject.open();

    } catch (err) {
      console.error(err);
      alert(err.message || 'Network error while processing payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (user?.isExpired && user?.role !== 'SaaS Super Admin') {
      setMode('lock');
    } else {
      setMode('none');
    }
  };

  const WizardStepper = ({ step }) => (
    <div className="flex items-center justify-center w-full max-w-2xl mx-auto mb-10">
      <div className="flex items-center w-full">
        <div className={`flex flex-col items-center relative ${step >= 1 ? 'text-[#1E1B6E]' : 'text-gray-400'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 bg-white z-10 ${step >= 1 ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-gray-300'}`}>
            1
          </div>
          <span className="absolute -bottom-6 text-xs font-bold whitespace-nowrap">Choose Plan</span>
        </div>
        <div className={`flex-1 h-1 mx-2 rounded ${step >= 2 ? 'bg-[#1E1B6E]' : 'bg-gray-200'}`}></div>
        <div className={`flex flex-col items-center relative ${step >= 2 ? 'text-[#1E1B6E]' : 'text-gray-400'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 bg-white z-10 ${step >= 2 ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-gray-300'}`}>
            2
          </div>
          <span className="absolute -bottom-6 text-xs font-bold whitespace-nowrap">Payment</span>
        </div>
        <div className={`flex-1 h-1 mx-2 rounded ${step >= 3 ? 'bg-[#1E1B6E]' : 'bg-gray-200'}`}></div>
        <div className={`flex flex-col items-center relative ${step >= 3 ? 'text-[#1E1B6E]' : 'text-gray-400'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 bg-white z-10 ${step >= 3 ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-gray-300'}`}>
            3
          </div>
          <span className="absolute -bottom-6 text-xs font-bold whitespace-nowrap">Confirmation</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${mode === 'lock' ? 'bg-slate-950/75 backdrop-blur-2xl' : 'bg-slate-900/80 backdrop-blur-sm'} animate-in fade-in duration-200`}>
      
      {/* 1. LOCK SCREEN (Enterprise Premium Freeze Screen) */}
      {mode === 'lock' && (
        <div className="relative bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200/80 animate-in zoom-in-95 duration-300">
          
          {/* Left Side: Expiry Status & Branding */}
          <div className="md:w-1/2 p-8 md:p-10 flex flex-col justify-between items-center text-center bg-gradient-to-b from-slate-900 via-slate-900 to-[#002D59] text-white relative overflow-hidden">
            
            {/* Background Glow Overlay */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#005BAA]/30 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-red-500/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header Brand */}
            <div className="relative z-10 flex items-center gap-3 w-full justify-center pb-6 border-b border-white/10">
              <img 
                src="/forge-india-logo-icon.svg" 
                alt="Forge India Logo" 
                className="h-10 w-auto object-contain drop-shadow" 
              />
              <div className="flex flex-col text-left">
                <span className="text-base font-black tracking-tight text-white leading-none flex items-center gap-1">
                  FORGE INDIA <span className="text-[#E6B800]">VMS</span>
                </span>
                <span className="text-[9px] tracking-wider text-blue-200 uppercase font-bold mt-0.5">
                  CONNECT PVT. LTD. • SHAPING FUTURE
                </span>
              </div>
            </div>

            {/* Central Warning / Expired Lock Banner */}
            <div className="relative z-10 my-6 flex flex-col items-center">
              <div className="relative mb-5">
                <div className="w-20 h-20 bg-red-500/20 rounded-3xl border border-red-500/40 flex items-center justify-center text-red-400 shadow-xl backdrop-blur-md">
                  <Lock size={38} className="animate-pulse text-red-400" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
              </div>

              <span className="px-3.5 py-1 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
                Subscription Concluded
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Subscription Expired</h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-xs">
                Your organization's active plan period has ended. Access is temporarily locked.
              </p>
            </div>

            {/* Account Details Box */}
            <div className="relative z-10 w-full bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-3 text-xs text-left">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Building2 size={14} className="text-[#E6B800]" /> Company
                </span>
                <span className="font-bold text-white truncate max-w-[160px]">{user?.companyName || user?.companyId}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Sparkles size={14} className="text-blue-400" /> Current Plan
                </span>
                <span className="font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {user?.subscription || 'One Day Trial'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Clock size={14} className="text-red-400" /> Expired On
                </span>
                <span className="font-extrabold text-red-300">
                  {user?.subscriptionExpiresAt 
                    ? new Date(user.subscriptionExpiresAt).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'N/A'}
                </span>
              </div>
            </div>

          </div>
          
          {/* Right Side: Why Upgrade & Action CTAs */}
          <div className="md:w-1/2 p-8 md:p-10 flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-[#005BAA]/10 text-[#005BAA] text-[11px] font-extrabold rounded-full border border-[#005BAA]/20">
                  PREMIUM VMS ACCESS
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Unlock Full Features</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 mb-6">
                Upgrade now to instantly restore workspace functionality for your security team.
              </p>

              <div className="space-y-3.5">
                {[
                  { title: 'Continuous Visitor Registration', desc: 'Instant check-in & digital pass issuance' },
                  { title: 'Contactless QR Scanner', desc: 'Express gate scans under 4 seconds' },
                  { title: 'Security & Premises Dashboard', desc: 'Live visitor tracking & emergency logs' },
                  { title: 'Analytics & Audit Reports', desc: 'Exportable logs & automated compliance' },
                  { title: 'Host & Mobile Alerts', desc: 'Push, SMS & WhatsApp notifications' }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                      <CheckCircle2 size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{item.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-8 space-y-3">
              <button
                onClick={() => setMode('choose_plan')}
                className="w-full bg-gradient-to-r from-[#005BAA] via-[#004b8d] to-[#003B73] text-white rounded-xl py-3.5 px-6 font-extrabold text-sm hover:opacity-95 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 group cursor-pointer"
              >
                <Sparkles size={18} className="text-[#E6B800]" />
                <span>Renew / Upgrade Subscription</span>
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>

              <div className="flex gap-2.5">
                <button
                  onClick={() => window.open(`https://wa.me/916369406416?text=Hi,%20I%20need%20Subscription%20Support%20for%20company:%20${user?.companyName || user?.companyId}`, '_blank')}
                  className="flex-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold hover:bg-slate-200 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Headset size={15} className="text-[#005BAA]" />
                  <span>Support</span>
                </button>
                
                <button
                  onClick={logout}
                  className="flex-1 bg-red-50 text-red-600 border border-red-200 rounded-xl py-2.5 px-3 text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CHOOSE PLAN (Step 1) */}
      {mode === 'choose_plan' && (
        <div className="bg-white rounded-2xl p-6 md:p-8 max-w-5xl w-full shadow-2xl overflow-y-auto hide-scrollbar max-h-[90vh] relative">
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          
          <WizardStepper step={1} />
          
          <div className="text-center mb-10 mt-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Upgrade Your Plan</h2>
            <p className="text-gray-500 text-lg">Choose the best plan for your company.</p>
          </div>
          
          {plansLoading && (
            <p className="text-center text-slate-500 my-8">
              Loading available plans...
            </p>
          )}

          {plansError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 my-4">
              {plansError}
            </div>
          )}

          {!plansLoading && !plansError && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan._id || plan.name}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {plan.name}
                    </h2>

                    <div className="mt-3">
                      <span className="text-3xl font-bold text-[#1E1B6E]">
                        ₹{Number(plan.price).toLocaleString('en-IN')}
                      </span>

                      <span className="text-sm text-slate-500">
                        {' '}/ {plan.durationDays === 30
                          ? 'Month'
                          : `${plan.durationDays} Days`}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">
                      {plan.description}
                    </p>

                    <ul className="mt-6 space-y-3 text-sm text-slate-700">
                      <li>
                        ✓ {displayLimit(plan.visitorPasses)} Passes
                      </li>

                      <li>
                        ✓ {displayLimit(plan.branches)} Branches
                      </li>

                      <li>
                        ✓ {displayLimit(plan.users)} System Users
                      </li>

                      <li>
                        ✓ {displayLimit(plan.securityUsers)} Security Users
                      </li>

                      <li>
                        ✓ {displayLimit(plan.admins)} Admins
                      </li>

                      <li>
                        ✓ {plan.features?.advancedReports
                          ? 'Advanced Reports'
                          : 'Standard Reports'}
                      </li>

                      {plan.features?.customBranding && (
                        <li>✓ Custom Branding</li>
                      )}

                      {plan.features?.apiAccess && (
                        <li>✓ API Access</li>
                      )}

                      {plan.features?.prioritySupport && (
                        <li>✓ Priority Support</li>
                      )}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePlanSelect(plan)}
                    className="mt-6 w-full rounded-lg bg-[#1E1B6E] px-4 py-3 font-semibold text-white hover:bg-indigo-800 transition-colors"
                  >
                    Choose Plan
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {!user?.isExpired && (
            <div className="mt-8 text-center">
              <button onClick={handleClose} className="text-gray-500 hover:text-gray-800 font-medium">Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* 3. PAYMENT METHOD (Step 2) */}
      {mode === 'payment' && (
        <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh] hide-scrollbar">
          <WizardStepper step={2} />
          
          <div className="flex items-center justify-between mb-8 mt-6">
            <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
            <button 
              onClick={handleClose} 
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
              type="button"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500 font-medium">Company</span>
              <span className="font-bold text-gray-900 text-lg">{user?.companyName || user?.companyId}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500 font-medium">Selected Plan</span>
              <span className="font-bold text-gray-900 text-lg">{selectedPlan?.name}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500 font-medium">Amount</span>
              <span className="font-bold text-gray-900">₹{selectedPlan?.price}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-500 font-medium">GST (18%)</span>
              <span className="font-bold text-gray-900">₹{Math.round(selectedPlan?.price * 0.18)}</span>
            </div>
            <div className="border-t border-slate-200 pt-3 mt-1 flex justify-between items-center">
              <span className="text-gray-700 font-semibold">Total</span>
              <span className="font-black text-[#1E1B6E] text-xl">₹{selectedPlan?.price + Math.round(selectedPlan?.price * 0.18)}</span>
            </div>
          </div>
          
          <h3 className="font-bold text-gray-900 mb-4">Choose Payment Method</h3>
          <form onSubmit={handlePaymentSubmit}>
            <div className="space-y-3 mb-8">
              {['UPI', 'Credit Card', 'Debit Card', 'Net Banking'].map((method) => (
                <label key={method} className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="radio" name="paymentMethod" value={method} defaultChecked={method === 'UPI'} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                  <span className="font-medium text-gray-700">{method}</span>
                </label>
              ))}
            </div>
            
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-[#1E1B6E] text-white rounded-xl py-4 font-bold hover:bg-indigo-900 transition-colors shadow-lg flex items-center justify-center"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Processing...
                </>
              ) : (
                `Pay Now (₹${selectedPlan?.price + Math.round(selectedPlan?.price * 0.18)})`
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode('choose_plan')}
              disabled={isProcessing}
              className="w-full mt-4 text-gray-500 hover:text-gray-800 font-medium py-2"
            >
              Back to Plans
            </button>
          </form>
        </div>
      )}

      {/* 4. SUCCESS (Step 3) */}
      {mode === 'success' && (
        <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in duration-300">
          <WizardStepper step={3} />
          
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 mt-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Successful!</h2>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Transaction ID</span>
              <span className="font-bold text-gray-900 text-sm">{transactionId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Plan</span>
              <span className="font-bold text-gray-900">{selectedPlan?.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Amount Paid</span>
              <span className="font-bold text-gray-900">₹{selectedPlan?.price + Math.round(selectedPlan?.price * 0.18)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Status</span>
              <span className="font-bold text-green-600">Active</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-8 px-4 font-medium">
            Your subscription has been activated successfully. You now have full access to all features on your dashboard.
          </p>
          
          <button
            onClick={() => {
              setMode('none');
              window.location.reload();
            }}
            className="w-full bg-[#1E1B6E] text-white rounded-xl py-3.5 font-bold hover:bg-indigo-900 transition-colors shadow-lg"
          >
            Go to Dashboard
          </button>
        </div>
      )}
      
    </div>
  );
};

export default SubscriptionModals;
