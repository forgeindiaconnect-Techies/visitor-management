import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CreditCard, Calendar, ShieldAlert, CheckCircle, FileText, Download } from 'lucide-react';
import InvoiceModal from '../../components/subscription/InvoiceModal';

const Subscription = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companyDetails, setCompanyDetails] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    fetchCompanyDetails();
  }, []);

  const fetchCompanyDetails = async () => {
    try {
      const url = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/company/me`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Company-Id': user?.companyId
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanyDetails(data);
        
        // Fetch history
        const histRes = await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/payment/history`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (histRes.ok) {
          const histData = await histRes.json();
          setHistory(histData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch company details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeRequest = () => {
    window.dispatchEvent(new CustomEvent('open-upgrade-modal'));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E1B6E]"></div>
      </div>
    );
  }

  const isExpired = user?.isExpired || false;
  
  // Calculate remaining
  let remainingDays = 0;
  if (companyDetails?.expiryDate) {
    const expiry = new Date(companyDetails.expiryDate);
    const now = new Date();
    const diffTime = expiry - now;
    remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <CreditCard className="text-[#1E1B6E]" size={32} />
          Subscription Details
        </h1>
        <p className="text-gray-500 mt-2">Manage your company's plan and billing status.</p>
      </div>

      {isExpired && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4 shadow-sm animate-in fade-in">
          <ShieldAlert className="text-red-600 shrink-0 mt-1" size={28} />
          <div>
            <h3 className="text-lg font-bold text-red-900">Your trial has expired.</h3>
            <p className="text-red-700 mt-1">
              Your access to the dashboard features has been restricted. Please contact the SaaS Administrator to activate a new subscription and restore full functionality.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Current Plan Overview</h2>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              {isExpired ? 'Expired' : 'Active'}
            </span>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              {companyDetails?.paymentStatus || 'Paid'}
            </span>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Company Name</p>
                <p className="font-semibold text-gray-900 text-lg">{companyDetails?.companyName || user?.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Current Plan</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#1E1B6E] text-2xl">{companyDetails?.subscription || user?.subscription || 'N/A'}</p>
                  {!isExpired && <CheckCircle className="text-green-500" size={20} />}
                </div>
              </div>
            </div>
            
            <div className="space-y-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <Calendar className="text-gray-400" size={20} />
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="font-medium text-gray-900">
                    {companyDetails?.createdAt ? new Date(companyDetails.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className={`size-5 ${isExpired ? 'text-red-400' : 'text-gray-400'}`} />
                <div>
                  <p className="text-xs text-gray-500">Expiry Date</p>
                  <p className={`font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                    {companyDetails?.expiryDate ? new Date(companyDetails.expiryDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                {remainingDays > 0 ? (
                  <p className="font-medium text-gray-900">{remainingDays} Day{remainingDays !== 1 ? 's' : ''} Remaining</p>
                ) : remainingDays === 0 ? (
                  <p className="font-medium text-yellow-600">Expires Today</p>
                ) : (
                  <p className="font-bold text-red-600">Expired</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Need to Renew or Upgrade?</h3>
              <p className="text-xs text-gray-500 mt-1">Contact the SaaS administrator to renew your billing cycle or adjust your plan tier.</p>
            </div>
            <button
              onClick={handleUpgradeRequest}
              disabled={requesting}
              className={`px-8 py-3 rounded-lg font-semibold transition-all shadow-sm flex items-center justify-center space-x-2 shrink-0 ${
                isExpired 
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200' 
                  : 'bg-[#1E1B6E] hover:bg-opacity-95 text-white'
              } disabled:opacity-50`}
            >
              {requesting ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Renew Plan / Upgrade</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Subscription History Table */}
      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Subscription History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((record) => (
                <tr key={record._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {new Date(record.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-[#1E1B6E]">
                    {record.plan}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-700">
                    ₹{record.total?.toLocaleString('en-IN') || record.amount?.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      record.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedInvoice(record)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1E1B6E] hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
                    >
                      <FileText size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 text-sm">
                    No billing history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
};

export default Subscription;
