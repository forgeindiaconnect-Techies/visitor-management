import React from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useBranch } from '../../context/BranchContext';
import { useZones } from '../../context/ZoneContext';
import { useAuth } from '../../context/AuthContext';
import { Users, Clock, Building, ShieldAlert, AlertTriangle } from 'lucide-react';
import { calculateTimeSpent } from '../../utils/timeUtils';
import TodaysVisitorsCard from '../../components/dashboard/TodaysVisitorsCard';
import VisitorStatusSummaryCard from '../../components/dashboard/VisitorStatusSummaryCard';

import { useNavigate } from 'react-router-dom';

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
  const walkInVisitors = safeVisitors.filter(v => v.registrationType !== 'Pre-Booking' && !v.isPreBooking);
  const preBookedVisitors = safeVisitors.filter(v => v.registrationType === 'Pre-Booking' || v.isPreBooking);
  
  const totalWalkIns = walkInVisitors.length;
  const totalPreBookings = preBookedVisitors.length;
  const insideVisitors = safeVisitors.filter(v => v.status === 'Inside');
  const pendingApprovals = safeVisitors.filter(v => v.status?.toUpperCase() === 'PENDING').length;
  const blockedVisitors = safeVisitors.filter(v => v.status === 'Rejected').length;
  const totalBranches = safeBranches.length;

  // Visitor Trends Data
  const trendsDataMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  visitors.forEach(v => {
    if (!v.visitDate) return;
    const visitDate = new Date(v.visitDate);
    if (visitDate >= sevenDaysAgo) {
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
  const chartBranches = safeBranches.filter(b => b !== 'All Branches');
  
  const branchData = chartBranches.map(b => {
    const branchVisitors = safeVisitors.filter(v => {
      if (!v.branch) return false;
      return v.branch.toUpperCase() === b.toUpperCase();
    }).length;

    return {
      name: b,
      visitors: branchVisitors
    };
  });
  
  const maxBranchVisitors = Math.max(...branchData.map(b => b.visitors), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branch Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of branch visitor metrics and pending approvals.</p>
      </div>

      {pendingApprovals > 0 && hasApprovalPermission && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="text-orange-600" size={24} />
            <h2 className="text-lg font-bold text-orange-900">Action Required: Pending Approvals ({pendingApprovals})</h2>
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
                {safeVisitors.filter(v => v.status?.toUpperCase() === 'PENDING').map(v => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{v.visitorName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.hostName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.purpose}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => updateVisitorStatus(v.id, 'Approved', { approvedBy: currentUser?.name })}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 mr-2"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => {
                          const reason = window.prompt("Reason for rejection:");
                          if (reason !== null) {
                            updateVisitorStatus(v.id, 'Rejected', { approvedBy: currentUser?.name, remarks: reason });
                          }
                        }}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700"
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
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <DashboardCard onClick={() => navigate('/visitors')} title="Total Visitors" value={visitors.length} icon={Users} colorClass="bg-blue-100 text-blue-600" />
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
          <div className="flex-1 space-y-6 flex flex-col justify-center">
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
                <th className="px-6 py-4 font-medium text-center">Group Size</th>
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
                  <td className="px-6 py-4 font-bold text-gray-700 text-center">{visitor.visitorCount || 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{visitor.hostName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{visitor.branch}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{visitor.purpose}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-900">
                      {visitor.checkInTime 
                        ? new Date(visitor.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                        : (visitor.entryTime && visitor.entryTime !== '-' ? visitor.entryTime : 'Not Checked In')}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {visitor.checkInTime 
                        ? new Date(visitor.checkInTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : (visitor.visitDate ? (visitor.visitDate.includes('T') ? visitor.visitDate.split('T')[0] : visitor.visitDate) : '-')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{visitor.exitTime || '-'}</td>
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
