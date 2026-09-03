import React from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useBranch } from '../../context/BranchContext';
import { useZones } from '../../context/ZoneContext';
import { Users, UserCheck, Clock, Ban, Building, MapPin, ShieldAlert, Activity, CreditCard, Copy, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TodaysVisitorsCard from '../../components/dashboard/TodaysVisitorsCard';
import VisitorStatusSummaryCard from '../../components/dashboard/VisitorStatusSummaryCard';
import SubscriptionCountdown from '../../components/subscription/SubscriptionCountdown';
import CompanyPreBookingLink from '../../components/CompanyPreBookingLink';
import { formatDisplayTime, formatDisplayDate } from '../../utils/dateUtils';

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

import { getDistinctBranches, isBranchMatch } from '../../utils/branchUtils';

const SuperAdminDashboard = () => {
  const { visitors, updateVisitorStatus } = useVisitors();
  const { branches, activeBranch } = useBranch();
  const { zones } = useZones();
  const { user: currentUser, hasApprovalPermission } = useAuth();
  const navigate = useNavigate();
  const [usageStats, setUsageStats] = React.useState(null);
  const [dashboardStats, setDashboardStats] = React.useState(null);
  const [company, setCompany] = React.useState(null);
  const [visitorPassUsage, setVisitorPassUsage] = React.useState(null);
  const [visitorPassUsageError, setVisitorPassUsageError] = React.useState('');

  React.useEffect(() => {
    if (currentUser?.role !== 'SaaS Super Admin') {
      const token = localStorage.getItem('token') || currentUser?.token;
      const headers = { 
        Authorization: `Bearer ${token}`,
        'X-Company-Id': currentUser?.companyId || ''
      };

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const rawBaseUrl = baseUrl.replace(/\/api\/?$/, '');

      fetch(`${rawBaseUrl}/api/companies/me/branding`, { headers })
        .then(res => res.json())
        .then(resData => {
          if (resData.success && resData.data) {
            setCompany(resData.data);
          } else {
            setCompany({ code: currentUser?.companyId, name: currentUser?.companyName });
          }
        })
        .catch(() => setCompany({ code: currentUser?.companyId, name: currentUser?.companyName }));

      fetch(`${baseUrl}/api/company/usage`, { headers })
        .then(res => res.json())
        .then(data => setUsageStats(data))
        .catch(console.error);

      fetch(`${rawBaseUrl}/api/visitors/subscription-usage`, {
        headers
      })
        .then(async (response) => {
          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(
              result.message ||
              'Unable to load visitor-pass usage.'
            );
          }

          return result;
        })
        .then((result) => {
          setVisitorPassUsage(result.data);
          setVisitorPassUsageError('');
        })
        .catch((error) => {
          console.error(
            'Visitor-pass usage error:',
            error
          );

          setVisitorPassUsage(null);
          setVisitorPassUsageError(error.message);
        });

      fetch(`${baseUrl}/api/dashboard/stats`, { headers })
        .then(res => res.json())
        .then(resData => {
          if (resData.success && resData.data) {
            setDashboardStats(resData.data);
          }
        })
        .catch(console.error);
    }
  }, [currentUser]);

  const safeVisitors = Array.isArray(visitors) ? visitors : [];
  const safeBranches = Array.isArray(branches) ? branches : [];

  const today = new Date().toISOString().split('T')[0];
  
  const isDirectVisit = (v) => {
    const name = String(v.visitorName || v.fullName || '').trim().toLowerCase();
    
    // 1. Exclude all test records
    if (
      name === 'test' ||
      name === 'test 1' ||
      name === 'test 2' ||
      name === 'test 3' ||
      name === 'lokeee' ||
      name.startsWith('test ') ||
      name.startsWith('test_') ||
      name === 'testing'
    ) {
      return false;
    }

    // 2. Exclude legacy test data before Thilagavathy U (Aug 26, 2026)
    const rawDate = v.visitDate || v.date || v.createdAt;
    if (rawDate && !name.includes('thilagavathy')) {
      const d = new Date(rawDate);
      const dateStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(rawDate);
      if (dateStr < '2026-08-26') {
        return false;
      }
    }

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

  // Check if a zone is restricted
  const isRestricted = (zoneName) => {
    const safeZones = Array.isArray(zones) ? zones : [];
    const zone = safeZones.find(z => z.name === zoneName);
    return zone?.restricted || false;
  };

  const restrictedAlerts = insideVisitors.filter(v => isRestricted(v.currentZone));

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
    const branchVisitors = safeVisitors.filter(v => isBranchMatch(v.branch || v.branchLocation, b)).length;

    return {
      name: b,
      visitors: branchVisitors
    };
  });

  const maxBranchVisitors = Math.max(...branchData.map(b => b.visitors), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SubscriptionCountdown />
      <CompanyPreBookingLink company={company || { code: currentUser?.companyId, name: currentUser?.companyName }} />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zone Monitoring Dashboard</h1>
          <p className="text-gray-500 mt-1">Real-time monitoring for {activeBranch}</p>
        </div>
        <div className="flex items-center space-x-2 bg-green-50 text-green-700 px-4 py-2 rounded-full font-medium text-sm border border-green-200">
          <Activity size={16} className="animate-pulse" />
          <span>Live Feed Active</span>
        </div>
      </div>





      {(pendingApprovals > 0 || (dashboardStats && dashboardStats.pendingApprovals > 0)) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="text-orange-600" size={24} />
            <h2 className="text-lg font-bold text-orange-900">Action Required: Pending Approvals ({Math.max(pendingApprovals, dashboardStats?.pendingApprovals || 0)})</h2>
          </div>
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-left bg-white rounded-lg overflow-hidden shadow-sm min-w-max">
              <thead className="bg-orange-100/50">
                <tr className="text-orange-800 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Visitor</th>
                  <th className="px-4 py-3 font-semibold">Host</th>
                  <th className="px-4 py-3 font-semibold">Branch</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {safeVisitors.filter(v => ['PENDING', 'PENDING APPROVAL'].includes(v.status?.toUpperCase())).map(v => (
                  <tr key={v._id || v.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{v.visitorName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.hostName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.branch}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.purpose}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => updateVisitorStatus(v._id || v.id, 'Approved', { approvedBy: currentUser?.name })}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 mr-2"
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

      {visitorPassUsage?.plan === 'One Day Trial' && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-amber-900">
                You are using the One Day Trial
              </h3>

              <p className="mt-1 text-sm text-amber-800">
                You can generate up to 25 visitor passes,
                create 1 branch, and add up to 3 system users.
              </p>

              <p className="mt-2 text-sm font-medium text-amber-900">
                Visitor Pass Usage:{' '}
                {visitorPassUsage.usageText}
              </p>

              <p className="mt-1 text-sm font-medium text-amber-900">
                Trial Expires:{' '}
                {new Date(
                  visitorPassUsage.renewalDate
                ).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/subscription')}
              className="rounded-lg bg-amber-600 px-5 py-2.5 font-semibold text-white hover:bg-amber-700"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <DashboardCard onClick={() => navigate('/visitors')} title="Direct Visits" value={dashboardStats ? Math.max(0, dashboardStats.totalVisitors - dashboardStats.totalPreBookings) : totalDirectVisits} icon={Users} colorClass="bg-blue-100 text-blue-600" />
        <DashboardCard onClick={() => navigate('/pre-bookings')} title="Pre-Bookings" value={dashboardStats ? dashboardStats.totalPreBookings : totalPreBookings} icon={Users} colorClass="bg-indigo-100 text-indigo-600" />
        <DashboardCard onClick={() => navigate('/tracking')} title="Visitors Inside" value={dashboardStats ? dashboardStats.visitorsInside : insideVisitors.length} icon={UserCheck} colorClass="bg-green-100 text-green-600" />
        <DashboardCard onClick={() => navigate('/approvals')} title="Pending Approvals" value={dashboardStats ? dashboardStats.pendingApprovals : pendingApprovals} icon={Clock} colorClass="bg-orange-100 text-orange-600" />
        <DashboardCard onClick={() => navigate('/blacklist')} title="Blocked Visitors" value={dashboardStats ? dashboardStats.blockedVisitors : blockedVisitors} icon={Ban} colorClass="bg-red-100 text-red-600" />
        <DashboardCard onClick={() => navigate('/settings')} title="Total Branches" value={dashboardStats ? dashboardStats.totalBranches : totalBranches} icon={Building} colorClass="bg-purple-100 text-purple-600" />
      </div>

      {currentUser?.role !== 'SaaS Super Admin' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Visitor Pass Usage
              </p>

              <h3 className="mt-1 text-3xl font-bold text-slate-900">
                {visitorPassUsage
                  ? visitorPassUsage.usageText
                  : 'Loading...'}
              </h3>

              {visitorPassUsage && (
                <p className="mt-1 text-sm text-slate-500">
                  {visitorPassUsage.plan} plan
                </p>
              )}
            </div>

            <div className="md:text-right">
              <p className="text-sm font-medium text-slate-500">
                Renewal Date
              </p>

              <p className="mt-1 text-lg font-semibold text-slate-900">
                {visitorPassUsage?.renewalDate
                  ? new Date(
                      visitorPassUsage.renewalDate
                    ).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })
                  : 'Loading...'}
              </p>
            </div>
          </div>

          {visitorPassUsage &&
            !visitorPassUsage.unlimited && (
              <div className="mt-5">
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      visitorPassUsage.visitorPassesUsed >=
                      visitorPassUsage.visitorPassLimit
                        ? 'bg-red-500'
                        : visitorPassUsage.visitorPassesUsed /
                              visitorPassUsage.visitorPassLimit >=
                            0.8
                          ? 'bg-orange-500'
                          : 'bg-blue-600'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (visitorPassUsage.visitorPassesUsed /
                          visitorPassUsage.visitorPassLimit) *
                          100
                      )}%`
                    }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>
                    {visitorPassUsage.visitorPassesUsed} used
                  </span>

                  <span>
                    {Math.max(
                      0,
                      visitorPassUsage.visitorPassLimit -
                        visitorPassUsage.visitorPassesUsed
                    )}{' '}
                    remaining
                  </span>
                </div>
              </div>
            )}

          {visitorPassUsage?.unlimited && (
            <div className="mt-5 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              Your Enterprise plan has unlimited visitor passes.
            </div>
          )}

          {visitorPassUsageError && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {visitorPassUsageError}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        
        {/* Live Feed Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="text-[var(--color-brand-indigo)]" size={20} />
              Recent Visitor Activity
            </h3>
          </div>
          <div className="overflow-x-auto flex-1 pb-2">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Visitor Name</th>
                  <th className="px-6 py-4 font-medium">Host</th>
                  <th className="px-6 py-4 font-medium">Branch</th>
                  <th className="px-6 py-4 font-medium">Purpose</th>
                  <th className="px-6 py-4 font-medium">Entry Time</th>
                  <th className="px-6 py-4 font-medium">Exit Time</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...visitors].reverse().slice(0, 50).map((visitor) => {
                  const restricted = isRestricted(visitor.currentZone);
                  return (
                    <tr key={visitor.id} className={`transition-colors ${restricted ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50/50'}`}>
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
                  );
                })}
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

        {/* Alerts & Actions */}
        <div className="space-y-6 flex flex-col">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-[11px] font-bold text-gray-500 mb-4 uppercase tracking-wider">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => navigate('/visitors')} className="w-full text-left px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-[var(--color-brand-indigo)] rounded-lg font-medium transition-colors shadow-sm">
                View Pre-registered Visitors
              </button>
              <button onClick={() => navigate('/tracking')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 text-gray-700 rounded-lg font-medium transition-colors shadow-sm">
                View Access Logs
              </button>
              <button onClick={() => navigate('/blacklist')} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 text-gray-700 rounded-lg font-medium transition-colors shadow-sm">
                Manage Blacklist
              </button>
            </div>
          </div>
          
          <TodaysVisitorsCard />
          <VisitorStatusSummaryCard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
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
      </div>

    </div>
  );
};

export default SuperAdminDashboard;
