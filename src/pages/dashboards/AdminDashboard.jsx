import React from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useBranch } from '../../context/BranchContext';
import { useZones } from '../../context/ZoneContext';
import { useAuth } from '../../context/AuthContext';
import { Users, Clock, Building, ShieldAlert, AlertTriangle, CreditCard, Activity } from 'lucide-react';
import { calculateTimeSpent } from '../../utils/timeUtils';
import TodaysVisitorsCard from '../../components/dashboard/TodaysVisitorsCard';
import VisitorStatusSummaryCard from '../../components/dashboard/VisitorStatusSummaryCard';
import SubscriptionCountdown from '../../components/subscription/SubscriptionCountdown';
import CompanyPreBookingLink from '../../components/CompanyPreBookingLink';
import { formatDisplayTime, formatDisplayDate } from '../../utils/dateUtils';

import { useNavigate } from 'react-router-dom';
import { getDistinctBranches, isBranchMatch, normalizeBranchName } from '../../utils/branchUtils';

const DashboardCard = ({ title, value, icon: Icon, colorClass, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-xl shadow-md border border-gray-200 p-6 flex items-center space-x-4 transition-transform hover:-translate-y-1 hover:shadow-lg duration-300 ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${colorClass}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { visitors, updateVisitorStatus } = useVisitors();
  const { branches } = useBranch();
  const { zones } = useZones();
  const { user: currentUser, hasApprovalPermission } = useAuth();

  const safeVisitors = Array.isArray(visitors) ? visitors : [];
  const safeBranches = Array.isArray(branches) ? branches : [];

  // Metrics calculations
  const today = new Date().toISOString().split('T')[0];
  
  const isDirectVisit = (v) => {
    const host = String(v.hostEmployee || v.hostName || '').trim().toLowerCase();
    const isDirect = host === 'direct visits' || host === 'direct visit' || host.includes('direct') ||
                     v.registrationType === 'Direct Visit' || v.registrationType === 'Walk-in' ||
                     v.visitType === 'DIRECT_VISIT' || v.visitorType === 'NEW_VISITOR' || v.bookingType === 'DIRECT_VISIT' ||
                     !v.isPreBooking || v.isReturning || v.returningVisitor;
    return isDirect;
  };

  const directVisitors = safeVisitors.filter(v => isDirectVisit(v));
  const preBookedVisitors = safeVisitors.filter(v => !isDirectVisit(v));
  
  const totalDirectVisits = directVisitors.length;
  const totalPreBookings = preBookedVisitors.length;
  const insideVisitors = safeVisitors.filter(v => ['Inside', 'Checked In', 'CHECKED_IN'].includes(v.status));
  const pendingApprovals = safeVisitors.filter(v => ['PENDING', 'PENDING APPROVAL', 'Pending', 'Pending Approval'].includes(v.status)).length;
  const blockedVisitors = safeVisitors.filter(v => ['Rejected', 'REJECTED', 'Blocked'].includes(v.status)).length;

  // Distinct branches discovered from settings and visitor data
  const chartBranches = getDistinctBranches(safeBranches, safeVisitors);
  const totalBranches = chartBranches.length;

  // Visitor Trends Data
  const trendsDataMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  safeVisitors.forEach(v => {
    const rawDate = v.visitDate || v.date || v.createdAt;
    if (!rawDate) return;
    const visitDate = new Date(rawDate);
    if (!isNaN(visitDate.getTime()) && visitDate >= sevenDaysAgo) {
      const dayName = visitDate.toLocaleDateString('en-US', { weekday: 'short' });
      if (trendsDataMap[dayName] !== undefined) {
        trendsDataMap[dayName]++;
      }
    }
  });

  const trendsData = [
    { day: 'Mon', visitors: trendsDataMap.Mon },
    { day: 'Tue', visitors: trendsDataMap.Tue },
    { day: 'Wed', visitors: trendsDataMap.Wed },
    { day: 'Thu', visitors: trendsDataMap.Thu },
    { day: 'Fri', visitors: trendsDataMap.Fri },
    { day: 'Sat', visitors: trendsDataMap.Sat },
    { day: 'Sun', visitors: trendsDataMap.Sun },
  ];
  const maxTrend = Math.max(...trendsData.map(d => d.visitors), 1);

  // Branch Performance Data
  const branchData = chartBranches.map(b => {
    const branchVisitors = safeVisitors.filter(v => {
      const vBranch = v.branch || v.branchLocation || chartBranches[0] || 'Main Office';
      return isBranchMatch(vBranch, b);
    }).length;

    return {
      name: b,
      visitors: branchVisitors
    };
  });
  
  const maxBranchVisitors = Math.max(...branchData.map(b => b.visitors), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SubscriptionCountdown user={currentUser} />
      <CompanyPreBookingLink company={{ code: currentUser?.companyId, name: currentUser?.companyName }} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of branch visitor metrics and pending approvals.</p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 text-green-700 px-4 py-2 rounded-full font-medium text-sm border border-green-200">
          <Activity size={16} className="animate-pulse" />
          <span>Live Feed Active</span>
        </div>
      </div>



      {hasApprovalPermission && (() => {
        const pendingVisitorsList = safeVisitors.filter(v => {
          if (!v.status) return false;
          const s = String(v.status).toUpperCase();
          return s.includes('PENDING') || s.includes('MANUAL') || s.includes('REVIEW') || s === 'SUBMITTED';
        });

        if (pendingVisitorsList.length === 0) return null;

        return (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="text-orange-600" size={24} />
              <h2 className="text-lg font-bold text-orange-900">
                Action Required: Pending Approvals ({pendingVisitorsList.length})
              </h2>
            </div>
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left bg-white rounded-lg overflow-hidden shadow-sm min-w-max">
                <thead className="bg-orange-100/50">
                  <tr className="text-orange-800 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold">Visitor</th>
                    <th className="px-4 py-3 font-semibold">Host</th>
                    <th className="px-4 py-3 font-semibold">Purpose</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {pendingVisitorsList.map(v => (
                    <tr key={v._id || v.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{v.visitorName || v.fullName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.hostName || v.hostEmployee}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.purpose || v.visitPurpose}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => updateVisitorStatus(v._id || v.id, 'Approved', { approvedBy: currentUser?.name })}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 mr-2 shadow-xs transition cursor-pointer"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => {
                            const reason = window.prompt("Reason for rejection:");
                            if (reason !== null) {
                              updateVisitorStatus(v._id || v.id, 'Rejected', { approvedBy: currentUser?.name, remarks: reason });
                            }
                          }}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 shadow-xs transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <DashboardCard onClick={() => navigate('/visitors')} title="Direct Visits" value={totalDirectVisits} icon={Users} colorClass="bg-blue-100 text-blue-600" />
        <DashboardCard onClick={() => navigate('/pre-bookings')} title="Pre-Bookings" value={totalPreBookings} icon={Users} colorClass="bg-indigo-100 text-indigo-600" />
        <DashboardCard onClick={() => navigate('/tracking')} title="Visitors Inside" value={insideVisitors.length} icon={Users} colorClass="bg-green-100 text-green-600" />
        <DashboardCard onClick={() => navigate('/approvals')} title="Pending Approvals" value={pendingApprovals} icon={Clock} colorClass="bg-orange-100 text-orange-600" />
        <DashboardCard onClick={() => navigate('/blacklist')} title="Blocked Visitors" value={blockedVisitors} icon={ShieldAlert} colorClass="bg-red-100 text-red-600" />
        <DashboardCard onClick={() => navigate('/settings')} title="Total Branches" value={totalBranches} icon={Building} colorClass="bg-purple-100 text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        
        {/* Visitor Trends Chart */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-[11px] font-bold text-gray-500 mb-6 uppercase tracking-wider">Visitor Trends (This Week)</h3>
          <div className="flex items-end justify-between h-64 gap-2">
            {trendsData.map((data, index) => (
              <div key={index} className="flex flex-col items-center justify-end h-full flex-1 group">
                <div 
                  className="w-full bg-[#1E1B6E] rounded-t-sm transition-all duration-500 relative group-hover:bg-indigo-700"
                  style={{ height: `${(data.visitors / maxTrend) * 100}%` }}
                >
                  <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-700 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {data.visitors}
                  </span>
                </div>
                <span className="text-xs text-gray-500 mt-2">{data.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Branch Performance Chart */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col">
          <h3 className="text-[11px] font-bold text-gray-500 mb-6 uppercase tracking-wider">Branch Performance</h3>
          <div className="flex-1 space-y-6 flex flex-col justify-start mt-2">
            {chartBranches.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No branches created yet. Add your first branch in Branch Setup.</p>
            )}
            {branchData.map((branch, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{branch.name}</span>
                  <span className="font-bold text-gray-900">{branch.visitors} Visitors</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div 
                    className="bg-purple-500 h-2.5 rounded-full" 
                    style={{ width: `${(branch.visitors / maxBranchVisitors) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <TodaysVisitorsCard />
          <VisitorStatusSummaryCard />
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="text-[var(--color-brand-indigo)]" size={20} />
            Recent Visitor Activity
          </h3>
        </div>
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Visitor Name</th>
                <th className="px-6 py-4 font-medium">Host</th>
                <th className="px-6 py-4 font-medium">Branch</th>
                <th className="px-6 py-4 font-medium">Purpose</th>
                <th className="px-6 py-4 font-medium">Entry Time</th>
                <th className="px-6 py-4 font-medium">Exit Time</th>
                <th className="px-6 py-4 font-medium">Time Spent</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...visitors].reverse().slice(0, 10).map((visitor) => (
                <tr key={visitor.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{visitor.visitorName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{visitor.hostName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{visitor.branch}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{visitor.purpose}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">
                      {visitor.checkInTime 
                        ? formatDisplayTime(visitor.checkInTime)
                        : (visitor.entryTime && visitor.entryTime !== '-' ? formatDisplayTime(visitor.entryTime) : 'Not Checked In')}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {visitor.checkInTime 
                        ? formatDisplayDate(visitor.checkInTime)
                        : (visitor.visitDate ? formatDisplayDate(visitor.visitDate) : '-')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-800 font-mono">
                      {visitor.checkOutTime 
                        ? formatDisplayTime(visitor.checkOutTime)
                        : (visitor.exitTime && visitor.exitTime !== '-' ? formatDisplayTime(visitor.exitTime) : '-')}
                    </div>
                    {visitor.checkOutTime && (
                      <div className="text-xs text-gray-500 font-mono">
                        {formatDisplayDate(visitor.checkOutTime)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{calculateTimeSpent(visitor.visitDate, visitor.entryTime, visitor.exitTime, visitor.status)}</td>

                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      visitor.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                      visitor.status?.toUpperCase() === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                      visitor.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                      visitor.status === 'Inside' ? 'bg-yellow-100 text-yellow-700' :
                      visitor.status === 'Exited' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {visitor.status === 'Inside' ? '🟡 In Progress' : 
                       visitor.status === 'Exited' ? '🟢 Completed' : 
                       visitor.status}
                    </span>
                  </td>
                </tr>
              ))}
              {[...visitors].length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    No recent visitors found.
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

export default AdminDashboard;
