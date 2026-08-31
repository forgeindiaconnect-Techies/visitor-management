import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, CheckCircle, CreditCard, Loader2, X } from 'lucide-react';

const SubscriptionModals = () => {
  const { user, logout, updateUser } = useAuth();
  
  // lock, choose_plan, payment, success
  const [mode, setMode] = useState(user?.isExpired && user?.role !== 'SaaS Super Admin' ? 'lock' : 'none');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState('');

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

  // If not locked and no modal is active, render nothing
  if (mode === 'none') return null;

  const plans = [
    { name: 'Basic', price: 999, features: ['500 Visitors', '2 Branches', '5 Security Users', 'Reports'], color: 'green' },
    { name: 'Standard', price: 2999, features: ['Unlimited Visitors', '10 Branches', '20 Security Users', 'Analytics'], color: 'blue' },
    { name: 'Enterprise', price: 6999, features: ['Unlimited Everything', 'Priority Support', 'Custom Branding'], color: 'purple' }
  ];

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
      
      const orderRes = await fetch(`${baseUrl}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: selectedPlan.price + Math.round(selectedPlan.price * 0.18),
          plan: selectedPlan.name,
          durationDays: 30
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
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
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
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${mode === 'lock' ? 'bg-slate-900/40 backdrop-blur-xl' : 'bg-slate-900/80 backdrop-blur-sm'} animate-in fade-in duration-200`}>
      
      {/* 1. LOCK SCREEN (Professional Freeze Screen) */}
      {mode === 'lock' && (
        <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
          
          {/* Left Side: Expiry Details */}
          <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center items-center text-center bg-slate-50 border-r border-slate-200">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <ShieldAlert size={40} className="text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Subscription Expired</h2>
            <p className="text-gray-600 font-medium mb-8">Your trial has ended.</p>
            
            <div className="w-full space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-500 font-medium text-sm">Company</span>
                <span className="font-bold text-gray-900">{user?.companyName || user?.companyId}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-500 font-medium text-sm">Current Plan</span>
                <span className="font-bold text-gray-900">{user?.subscription || 'One Day Trial'}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-500 font-medium text-sm">Expired</span>
                <span className="font-bold text-red-600 text-right">
                  {user?.subscriptionExpiresAt 
                    ? new Date(user.subscriptionExpiresAt).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Right Side: Why Upgrade? */}
          <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-between bg-white">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-6">Why upgrade?</h3>
              <ul className="space-y-4">
                {[
                  'Continue Visitor Registration',
                  'QR Code Access',
                  'Security Dashboard',
                  'Reports',
                  'Notifications'
                ].map((feature, i) => (
                  <li key={i} className="flex items-center text-gray-700 font-medium">
                    <CheckCircle size={20} className="text-green-500 mr-3 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="mt-10 space-y-3">
              <button
                onClick={() => setMode('choose_plan')}
                className="w-full bg-[#1E1B6E] text-white rounded-xl py-4 font-bold text-lg hover:bg-indigo-900 transition-colors shadow-lg"
              >
                Upgrade Now
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={() => window.open(`https://wa.me/916369406416?text=Hi,%20I%20need%20Subscription%20Support%20for%20company:%20${user?.companyName || user?.companyId}`, '_blank')}
                  className="flex-1 bg-white text-gray-700 border border-gray-300 rounded-xl py-3 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Contact Support
                </button>
                <button
                  onClick={logout}
                  className="flex-1 bg-white text-red-600 border border-red-200 rounded-xl py-3 font-semibold hover:bg-red-50 transition-colors"
                >
                  Logout
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className="border-2 border-slate-100 hover:border-slate-300 rounded-2xl p-6 flex flex-col transition-all hover:shadow-xl bg-white">
                <div className="mb-6">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-${plan.color}-100 text-${plan.color}-700 mb-4`}>
                    <div className={`w-2 h-2 rounded-full bg-${plan.color}-500`}></div>
                    {plan.name}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-gray-900">₹{plan.price}</span>
                    <span className="text-gray-500 font-medium">/ Month</span>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-700">
                      <CheckCircle className={`text-${plan.color}-500 shrink-0 mt-0.5`} size={18} />
                      <span className="font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={() => handlePlanSelect(plan)}
                  className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg ${
                    plan.name === 'Enterprise' ? 'bg-purple-600 hover:bg-purple-700' :
                    plan.name === 'Standard' ? 'bg-blue-600 hover:bg-blue-700' :
                    'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  Choose Plan
                </button>
              </div>
            ))}
          </div>
          
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
