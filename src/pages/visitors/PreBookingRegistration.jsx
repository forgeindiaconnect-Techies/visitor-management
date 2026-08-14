import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { 
  Send, 
  Link as LinkIcon, 
  Copy, 
  RefreshCw, 
  XCircle, 
  CheckCircle2, 
  Clock, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Loader2, 
  Calendar, 
  Mail, 
  Building, 
  FileText,
  MapPin
} from 'lucide-react';

const PreBookingRegistration = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const _rawUrl = import.meta.env.VITE_API_URL || 'https://fic-visitor-1.onrender.com';
  const API_BASE = _rawUrl.replace(/\/api\/?$/, '') + '/api';

  // Form State
  const [formData, setFormData] = useState({
    visitorName: '',
    email: '',
    mobileNumber: '',
    companyName: user?.companyName || 'Forge India Connect Private Limited',
    purpose: 'Business Meeting',
    visitDate: new Date().toISOString().split('T')[0],
    visitTime: '10:00 AM',
    branch: user?.branch && user.branch !== 'All Branches' ? user.branch : 'Head Office(KRISHNAGIRI)',
    visitorCount: 1,
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Invitations List State
  const [invitations, setInvitations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Selected Invitation Modal
  const [selectedInv, setSelectedInv] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchInvitations = async () => {
    setListLoading(true);
    try {
      const response = await fetch(`${API_BASE}/invitations/list?status=${statusFilter}&search=${searchTerm}`, {
        headers: {
          ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
        }
      });
      if (response.ok) {
        const data = await response.json();
        setInvitations(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [statusFilter]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    if (!formData.email) {
      addNotification('Validation Error', 'Visitor Email Address is required.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/visitor-invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
        },
        body: JSON.stringify({
          visitorName: formData.visitorName,
          email: formData.email,
          mobile: formData.mobileNumber,
          companyName: formData.companyName,
          purposeOfVisit: formData.purpose,
          visitDate: formData.visitDate,
          visitTime: formData.visitTime,
          branch: formData.branch,
          numberOfVisitors: formData.visitorCount,
          notes: formData.notes,
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert("Invitation created successfully!");
        console.log("Invitation URL:", data.invitationUrl);
        console.log("QR Code:", data.qrCode);
        
        setGeneratedLink(data.invitationUrl);
        fetchInvitations();
      } else {
        addNotification('Error', data.message || 'Failed to generate invitation.', 'error');
        alert(data.message || "Failed to create invitation");
      }
    } catch (err) {
      addNotification('Error', 'Network error generating invitation.', 'error');
      console.error("Invitation error:", err);
      alert("Failed to create invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (linkToCopy) => {
    const targetLink = linkToCopy || generatedLink;
    if (!targetLink) return;
    navigator.clipboard.writeText(targetLink);
    setCopied(true);
    addNotification('Copied', 'Registration link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleResend = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/invitations/${id}/resend`, {
        method: 'POST',
        headers: {
          ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
        }
      });
      if (response.ok) {
        addNotification('Success', 'Invitation email resent successfully.', 'success');
        fetchInvitations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerate = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/invitations/${id}/regenerate`, {
        method: 'POST',
        headers: {
          ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
        }
      });
      if (response.ok) {
        const data = await response.json();
        addNotification('Regenerated', 'New registration token generated and email resent.', 'success');
        if (data.registrationLink) setGeneratedLink(data.registrationLink);
        fetchInvitations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelInv = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/invitations/${id}/cancel`, {
        method: 'POST',
        headers: {
          ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
        }
      });
      if (response.ok) {
        addNotification('Cancelled', 'Invitation link has been cancelled.', 'info');
        fetchInvitations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const inputClassName = "w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none text-sm bg-white";

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending Invitation':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold border border-yellow-200">Pending Invitation</span>;
      case 'Invitation Sent':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold border border-blue-200">Invitation Sent</span>;
      case 'Registration Pending':
        return <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold border border-orange-200">Registration Pending</span>;
      case 'Registered':
      case 'Visitor Pass Generated':
      case 'Completed':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-200">Registered Pass Generated</span>;
      case 'Cancelled':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-200">Cancelled</span>;
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const filteredInvitations = invitations.filter(inv => 
    (inv.visitorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.companyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Mail className="text-[var(--color-brand-indigo)]" size={28} />
          Pre-Booking Registration & Visitor Invitation
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Create visitor pre-bookings, generate secure expiring registration tokens, and automate email invitations.
        </p>
      </div>

      {/* Invitation Form Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <UserPlus size={18} className="text-indigo-600" />
          Create Visitor Pre-Booking Invitation
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Visitor Name</label>
            <input 
              type="text" 
              name="visitorName" 
              value={formData.visitorName} 
              onChange={handleChange}
              placeholder="e.g., Ravi Kumar"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Email Address *</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange}
              required
              placeholder="e.g., visitor@example.com"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Mobile Number</label>
            <input 
              type="text" 
              name="mobileNumber" 
              value={formData.mobileNumber} 
              onChange={handleChange}
              placeholder="e.g., 9876543210"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Company Name</label>
            <input 
              type="text" 
              name="companyName" 
              value={formData.companyName} 
              readOnly 
              className={`${inputClassName} bg-slate-100 text-slate-600 font-bold cursor-not-allowed`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Purpose of Visit</label>
            <input 
              type="text" 
              name="purpose" 
              value={formData.purpose} 
              onChange={handleChange}
              placeholder="e.g., Business Meeting"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Visit Date & Time</label>
            <div className="flex gap-2">
              <input 
                type="date" 
                name="visitDate" 
                value={formData.visitDate} 
                onChange={handleChange}
                className="w-1/2 px-3 py-2.5 border border-slate-200 rounded-lg text-xs outline-none bg-white"
              />
              <input 
                type="text" 
                name="visitTime" 
                value={formData.visitTime} 
                onChange={handleChange}
                placeholder="10:00 AM"
                className="w-1/2 px-3 py-2.5 border border-slate-200 rounded-lg text-xs outline-none bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Branch / Location</label>
            <input 
              type="text" 
              name="branch" 
              value={formData.branch} 
              onChange={handleChange}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Number of Visitors</label>
            <input 
              type="number" 
              min="1"
              name="visitorCount" 
              value={formData.visitorCount} 
              onChange={handleChange}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Notes</label>
            <input 
              type="text" 
              name="notes" 
              value={formData.notes} 
              onChange={handleChange}
              placeholder="Optional instructions..."
              className={inputClassName}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button 
            type="button" 
            onClick={() => handleGenerate(true)}
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-md transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span>Send Invitation Email</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleGenerate(false)}
            disabled={loading}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-md transition-colors"
          >
            <LinkIcon size={16} />
            <span>Generate Link Only</span>
          </button>

          {generatedLink && (
            <button 
              type="button" 
              onClick={() => handleCopyLink(generatedLink)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-md transition-colors"
            >
              <Copy size={16} />
              <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
            </button>
          )}
        </div>

        {/* Generated Link Result Display */}
        {generatedLink && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2 animate-in fade-in">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Generated Secure Registration Link</span>
            <div className="flex gap-2 items-center">
              <input 
                type="text" 
                readOnly 
                value={generatedLink}
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-xs font-mono bg-white text-indigo-900"
              />
              <button 
                onClick={() => handleCopyLink(generatedLink)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 whitespace-nowrap"
              >
                Copy
              </button>
            </div>
            <p className="text-[11px] text-indigo-600">Valid for 48 hours. One-time use link.</p>
          </div>
        )}
      </div>

      {/* Invitation Management Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 items-center">
          <div className="relative flex-1 max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-xs"
            />
          </div>

          <div className="flex gap-2 items-center w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none bg-white"
            >
              <option value="All">All Invitations</option>
              <option value="Invitation Sent">Invitation Sent</option>
              <option value="Visitor Pass Generated">Registered / Generated</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-6 py-3.5 font-bold">Visitor Name</th>
                <th className="px-6 py-3.5 font-bold">Email</th>
                <th className="px-6 py-3.5 font-bold">Visit Date</th>
                <th className="px-6 py-3.5 font-bold">Invitation Status</th>
                <th className="px-6 py-3.5 font-bold">Expires</th>
                <th className="px-6 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvitations.map((inv) => (
                <tr key={inv._id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                    {inv.visitorName}
                    {inv.bookingId && (
                      <span className="block text-[10px] text-indigo-600 font-mono font-bold">{inv.bookingId}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{inv.email}</td>
                  <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{inv.visitDate} ({inv.visitTime || '10:00 AM'})</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(inv.status)}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-[11px] whitespace-nowrap">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/pre-register?token=${inv.token}`;
                          handleCopyLink(link);
                        }}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Copy Registration Link"
                      >
                        <Copy size={16} />
                      </button>

                      {!inv.used && !inv.cancelled && (
                        <>
                          <button
                            onClick={() => handleResend(inv._id)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Resend Invitation Email"
                          >
                            <Send size={16} />
                          </button>

                          <button
                            onClick={() => handleRegenerate(inv._id)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Regenerate Token & Link"
                          >
                            <RefreshCw size={16} />
                          </button>

                          <button
                            onClick={() => handleCancelInv(inv._id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancel Invitation"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredInvitations.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    {listLoading ? 'Loading invitations...' : 'No pre-booking invitations found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PreBookingRegistration;
