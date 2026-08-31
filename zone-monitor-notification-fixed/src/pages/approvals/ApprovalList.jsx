import React, { useState } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, XCircle, Clock, Search, Filter, Eye, ShieldCheck, Check, X } from 'lucide-react';
import HostVisitorDetailsModal from '../../components/approvals/HostVisitorDetailsModal';
import { formatDisplayDate, formatDisplayTime } from '../../utils/dateUtils';

const ApprovalList = () => {
  const { allVisitors, approveVisitor, rejectVisitor } = useVisitors();
  const { user, hasApprovalPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [tabFilter, setTabFilter] = useState('Pending'); // 'Pending' | 'Approved' | 'Rejected' | 'All'

  // Details Modal State
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold border border-gray-200">Draft</span>;
      case 'Pending Approval':
      case 'Pending':
        return <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold border border-orange-200 flex items-center gap-1 w-max"><Clock size={12} /> Pending Approval</span>;
      case 'Approved':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1 w-max"><CheckCircle2 size={12} /> Approved</span>;
      case 'Rejected':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1 w-max"><XCircle size={12} /> Rejected</span>;
      case 'Checked In':
      case 'Inside':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold border border-blue-200 flex items-center gap-1 w-max">🔵 Checked In</span>;
      case 'Checked Out':
      case 'Exited':
        return <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold border border-purple-200 flex items-center gap-1 w-max">🟣 Checked Out</span>;
      case 'Expired':
        return <span className="px-3 py-1 bg-slate-800 text-white rounded-full text-xs font-bold border border-slate-700">Expired</span>;
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const filteredVisitors = allVisitors.filter(v => {
    const matchesSearch = (v.visitorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.hostName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const todayStr = new Date().toISOString().split('T')[0];
    const matchesTab = tabFilter === 'All' ? true :
                       tabFilter === 'Pending' ? (v.status === 'Pending Approval' || v.status === 'Pending') :
                       tabFilter === 'MyVisitors' ? (user?.name && v.hostName?.toLowerCase().includes(user.name.toLowerCase())) :
                       tabFilter === 'Today' ? (v.visitDate === todayStr || new Date(v.visitDate).toDateString() === new Date().toDateString()) :
                       tabFilter === 'Approved' ? (v.status === 'Approved') :
                       tabFilter === 'Rejected' ? (v.status === 'Rejected') :
                       tabFilter === 'History' ? (['Checked Out', 'Exited', 'Expired', 'Rejected', 'Cancelled'].includes(v.status)) : true;

    return matchesSearch && matchesTab;
  }).sort((a, b) => new Date(b.createdAt || b.visitDate) - new Date(a.createdAt || a.visitDate));

  const handleQuickApprove = (e, visitorId) => {
    e.stopPropagation();
    approveVisitor(visitorId);
  };

  const handleOpenDetails = (visitor) => {
    setSelectedVisitor(visitor);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-[var(--color-brand-indigo)]" size={28} />
            Pending Approvals (Host Dashboard)
          </h1>
          <p className="text-gray-500 mt-1">Review, approve, or reject pre-booked visitor requests.</p>
        </div>
      </div>

      {/* Host Dashboard Tabs Bar */}
      <div className="bg-slate-100 p-1.5 rounded-xl flex flex-wrap gap-2 border border-slate-200">
        {[
          { key: 'Pending', label: '⏳ Pending Approvals' },
          { key: 'MyVisitors', label: '👤 My Visitors' },
          { key: 'Today', label: '📅 Today\'s Visitors' },
          { key: 'Approved', label: '✅ Approved' },
          { key: 'Rejected', label: '❌ Rejected' },
          { key: 'History', label: '📜 Visitor History' },
          { key: 'All', label: '📋 All Requests' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setTabFilter(tab.key)}
            className={`py-2 px-3 text-center font-bold text-xs rounded-lg transition-all ${
              tabFilter === tab.key
                ? 'bg-[var(--color-brand-indigo)] text-white shadow-md'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Search by visitor, company, or host..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Visitor Name</th>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-6 py-4 font-medium">Visit Date</th>
                <th className="px-6 py-4 font-medium">Purpose</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVisitors.map((visitor) => (
                <tr 
                  key={visitor._id || visitor.id} 
                  onClick={() => handleOpenDetails(visitor)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                    <div>
                      <span>{visitor.visitorName || visitor.fullName || visitor.name || 'Visitor'}</span>
                      {(visitor.bookingId || visitor.visitorId) && (
                        <span className="block text-[10px] font-mono text-indigo-600 font-semibold">{visitor.bookingId || visitor.visitorId}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {visitor.companyName || visitor.visitingCompany || 'Forge India Connect Private Limited'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap font-medium">
                    {formatDisplayDate(visitor.visitDate || visitor.date || visitor.createdAt)} {visitor.expectedArrivalTime || visitor.expectedTime ? `(${formatDisplayTime(visitor.expectedArrivalTime || visitor.expectedTime)})` : ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium whitespace-nowrap">{visitor.purpose || visitor.visitPurpose || 'Official Visit'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(visitor.status)}
                    {visitor.rejectionReason && (
                      <span className="block text-[10px] text-red-600 mt-1 font-semibold">Reason: {visitor.rejectionReason}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(visitor)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>

                      {(visitor.status === 'Pending Approval' || visitor.status === 'Pending') && hasApprovalPermission && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleQuickApprove(e, visitor._id || visitor.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(visitor)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1"
                          >
                            <X size={14} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredVisitors.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No approval requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Host Visitor Details Popup */}
      <HostVisitorDetailsModal 
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        visitor={selectedVisitor}
        onApprove={approveVisitor}
        onReject={rejectVisitor}
      />
    </div>
  );
};

export default ApprovalList;
