import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVisitors } from '../../context/VisitorContext';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, CheckCircle, XCircle, User, FileText, Calendar, Building, Info, Clock } from 'lucide-react';
import ApprovalModal from '../../components/approvals/ApprovalModal';

const ApprovalDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { allVisitors, updateVisitorStatus } = useVisitors();
  const { user, hasApprovalPermission } = useAuth();
  
  const visitor = allVisitors.find(v => String(v._id || v.id) === String(id));

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState('Approve');

  if (!visitor) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
          <XCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Visitor not found</h2>
        <button onClick={() => navigate('/approvals')} className="text-[var(--color-brand-indigo)] hover:underline">
          Return to Approvals
        </button>
      </div>
    );
  }

  const handleConfirmAction = async (remarks) => {
    try {
      await updateVisitorStatus(visitor._id || visitor.id, modalAction, { remarks, approvedBy: user?.name });
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
    setIsModalOpen(false);
  };

  const canTakeAction = ['Pending', 'Hold'].includes(visitor.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Approval Details</h1>
            <p className="text-gray-500 mt-1">Review visitor information and documents.</p>
          </div>
        </div>

        {canTakeAction && hasApprovalPermission && (
          <div className="flex space-x-3">
            <button 
              onClick={() => { setModalAction('Reject'); setIsModalOpen(true); }}
              className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-medium rounded-lg transition-colors flex items-center space-x-2 border border-red-200"
            >
              <XCircle size={18} />
              <span>Reject</span>
            </button>
            <button 
              onClick={() => { setModalAction('Hold'); setIsModalOpen(true); }}
              className="px-4 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 font-medium rounded-lg transition-colors flex items-center space-x-2 border border-orange-200"
            >
              <Clock size={18} />
              <span>Hold</span>
            </button>
            <button 
              onClick={() => { setModalAction('Approve'); setIsModalOpen(true); }}
              className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-medium rounded-lg transition-colors flex items-center space-x-2 shadow-sm"
            >
              <CheckCircle size={18} />
              <span>Approve</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="w-20 h-20 rounded-full bg-slate-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden text-slate-500 text-2xl font-bold">
              {visitor.photoUrl ? (
                <img src={visitor.photoUrl} alt={visitor.visitorName} className="w-full h-full object-cover" />
              ) : (
                visitor.visitorName.charAt(0)
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{visitor.visitorName}</h2>
              <p className="text-gray-500">{visitor.companyName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${
              visitor.status === 'Pending' ? 'bg-orange-50 text-orange-700 border-orange-200' :
              visitor.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
              visitor.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
              visitor.status === 'Hold' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
              visitor.status === 'Inside' ? 'bg-indigo-50 text-[var(--color-brand-indigo)] border-indigo-200' :
              'bg-gray-50 text-gray-700 border-gray-200'
            }`}>
              Current Status: {visitor.status}
            </span>
            {visitor.approvedBy && (
              <p className="text-xs text-gray-400 mt-2">Processed by {visitor.approvedBy}</p>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
              <User size={18} className="text-gray-400" /> Personal Details
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Mobile Number</p>
                <p className="font-medium text-gray-900">{visitor.mobileNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Email Address</p>
                <p className="font-medium text-gray-900">{visitor.email || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
              <Building size={18} className="text-gray-400" /> Visit Context
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Host Name</p>
                <p className="font-medium text-gray-900">{visitor.hostName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Purpose of Visit</p>
                <p className="font-medium text-gray-900">{visitor.purpose}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Scheduled Date</p>
                <p className="font-medium text-gray-900">{visitor.visitDate}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
              <FileText size={18} className="text-gray-400" /> Submitted Documents
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="border rounded-lg p-4 bg-slate-50 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Visitor Photo</span>
                {visitor.photoUrl ? (
                  <button 
                    onClick={() => window.open(visitor.photoUrl, '_blank')}
                    className="text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-[var(--color-brand-indigo)] px-3 py-1.5 rounded transition-colors cursor-pointer"
                  >
                    View Photo
                  </button>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Not Provided</span>
                )}
              </div>
            </div>
          </div>

          {visitor.remarks && (
            <div className="space-y-6 md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                <Info size={18} className="text-gray-400" /> Approval Remarks
              </h3>
              <div className={`p-4 rounded-lg border ${visitor.status === 'Rejected' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                <p className="text-sm">{visitor.remarks}</p>
              </div>
            </div>
          )}

        </div>
      </div>

      <ApprovalModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmAction}
        actionType={modalAction}
        visitorName={visitor.visitorName}
      />
    </div>
  );
};

export default ApprovalDetails;
