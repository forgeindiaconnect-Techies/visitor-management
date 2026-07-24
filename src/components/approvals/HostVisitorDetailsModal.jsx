import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, User, Calendar, Clock, MapPin, FileText, IdCard, Building, ShieldAlert } from 'lucide-react';

const HostVisitorDetailsModal = ({ isOpen, onClose, visitor, onApprove, onReject }) => {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Meeting Cancelled');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen || !visitor) return null;

  const handleConfirmReject = () => {
    const finalReason = rejectionReason === 'Other' ? (customReason || 'Other') : rejectionReason;
    onReject(visitor._id || visitor.id, finalReason);
    setRejecting(false);
    onClose();
  };

  const handleConfirmApprove = () => {
    onApprove(visitor._id || visitor.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white font-bold text-xs uppercase tracking-wider">
              {visitor.bookingId || visitor.visitId || 'REQUEST'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{visitor.visitorName}</h3>
              <p className="text-xs text-slate-300">Pending Host Approval</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Section 1: Personal Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User size={14} className="text-[var(--color-brand-indigo)]" />
              Personal Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-gray-400 block">Full Name</span>
                <span className="font-bold text-gray-900">{visitor.visitorName}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Mobile Number</span>
                <span className="font-semibold text-gray-800">{visitor.mobileNumber}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Email Address</span>
                <span className="font-semibold text-gray-800">{visitor.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Company Name</span>
                <span className="font-semibold text-gray-800">{visitor.companyName}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-xs text-gray-400 block">Aadhaar Card Number</span>
                <span className="font-bold text-indigo-900">{visitor.aadhaarNumber || 'Not Provided'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Visit Details */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <Calendar size={14} />
              Visit Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-indigo-400 block">Branch</span>
                <span className="font-bold text-indigo-900">📍 {visitor.branch}</span>
              </div>
              <div>
                <span className="text-xs text-indigo-400 block">Host Name</span>
                <span className="font-bold text-indigo-900">{visitor.hostName}</span>
              </div>
              <div>
                <span className="text-xs text-indigo-400 block">Purpose of Visit</span>
                <span className="font-semibold text-gray-900">{visitor.purpose}</span>
              </div>
              <div>
                <span className="text-xs text-indigo-400 block">Visit Date & Time</span>
                <span className="font-semibold text-gray-900">{visitor.visitDate} ({visitor.expectedArrivalTime || '10:00 AM'})</span>
              </div>
              {visitor.notes && (
                <div className="sm:col-span-2 bg-white p-3 rounded-lg border border-indigo-100">
                  <span className="text-xs text-indigo-500 block font-semibold mb-1">Notes from Visitor/Host</span>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{visitor.notes || visitor.hostNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Rejection Form (Inline) */}
          {rejecting && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2">
              <h4 className="text-sm font-bold text-red-900 flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-red-600" />
                Select Reason for Rejection
              </h4>
              <div className="space-y-2">
                {['Host Not Available', 'Meeting Cancelled', 'Invalid Request', 'Other'].map(reason => (
                  <label key={reason} className="flex items-center gap-2 text-xs font-semibold text-red-800 cursor-pointer">
                    <input 
                      type="radio" 
                      name="rejectionReason" 
                      value={reason} 
                      checked={rejectionReason === reason} 
                      onChange={(e) => setRejectionReason(e.target.value)} 
                    />
                    <span>{reason}</span>
                  </label>
                ))}
                {rejectionReason === 'Other' && (
                  <input 
                    type="text" 
                    placeholder="Enter custom rejection reason..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full px-3 py-1.5 border border-red-300 rounded text-xs outline-none bg-white"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-white transition-colors"
          >
            Close
          </button>

          {!rejecting ? (
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setRejecting(true)} 
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md transition-colors"
              >
                <XCircle size={16} /> Reject
              </button>
              <button 
                type="button" 
                onClick={handleConfirmApprove} 
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md transition-colors"
              >
                <CheckCircle2 size={16} /> Approve (Generate QR)
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setRejecting(false)} 
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmReject} 
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-md"
              >
                Confirm Rejection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostVisitorDetailsModal;
