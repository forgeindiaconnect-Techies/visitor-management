import React, { useState } from 'react';
import { X } from 'lucide-react';

const ApprovalModal = ({ isOpen, onClose, onConfirm, actionType, visitorName }) => {
  const [remarks, setRemarks] = useState('');

  if (!isOpen) return null;

  const isApprove = actionType === 'Approve';
  const isHold = actionType === 'Hold';

  const modalColor = isApprove ? 'bg-blue-50 border-blue-100' : isHold ? 'bg-orange-50 border-orange-100' : 'bg-red-50 border-red-100';
  const textColor = isApprove ? 'text-blue-800' : isHold ? 'text-orange-800' : 'text-red-800';
  const btnColor = isApprove ? 'bg-blue-600 hover:bg-blue-700' : isHold ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700';

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(remarks);
    setRemarks('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className={`px-6 py-4 border-b ${modalColor} flex justify-between items-center`}>
          <h3 className={`text-lg font-semibold ${textColor}`}>
            {actionType} Visitor
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-gray-600 text-sm">
            You are about to {actionType.toLowerCase()} the visit request for <span className="font-semibold text-gray-900">{visitorName}</span>.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks {isApprove ? '(Optional)' : '(Required)'}
            </label>
            <textarea
              required={!isApprove}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none resize-none"
              rows="3"
              placeholder={isApprove ? "Add any approval notes..." : isHold ? "Reason for placing on hold..." : "Reason for rejection..."}
            ></textarea>
          </div>
          
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-white font-medium rounded-lg transition-colors shadow-sm ${btnColor}`}
            >
              Confirm {actionType}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApprovalModal;
