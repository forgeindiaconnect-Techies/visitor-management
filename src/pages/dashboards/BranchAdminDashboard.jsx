import React from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useBranch } from '../../context/BranchContext';
import { Building2, Users, FileCheck, AlertTriangle, ArrowRight, UserPlus, Clock, Search, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { calculateTimeSpent } from '../../utils/timeUtils';

const DashboardCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 flex items-center space-x-4 transition-transform hover:-translate-y-1 hover:shadow-lg duration-300">
    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${colorClass}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

const BranchAdminDashboard = () => {
  const { visitors } = useVisitors();
  const { activeBranch } = useBranch();
  const navigate = useNavigate();

  const branchVisitors = visitors.length;
  const approvedVisitors = visitors.filter(v => v.status === 'Approved').length;
  const rejectedVisitors = visitors.filter(v => v.status === 'Rejected').length;
  const activeVisitors = visitors.filter(v => v.status === 'Inside');
  const recentVisitors = [...visitors].slice(-5).reverse();

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Managing operations for <span className="font-semibold text-[var(--color-brand-indigo)]">{activeBranch}</span></p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => navigate('/visitors/new')}
            className="px-4 py-2 bg-[var(--color-brand-indigo)] text-white hover:bg-[var(--color-brand-indigo-light)] font-medium rounded-lg transition-colors shadow-sm"
          >
            + Direct Visit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Branch Visitors" value={branchVisitors} icon={Users} colorClass="bg-blue-100 text-blue-600" />
        <DashboardCard title="Approved Visitors" value={approvedVisitors} icon={FileCheck} colorClass="bg-green-100 text-green-600" />
        <DashboardCard title="Rejected Visitors" value={rejectedVisitors} icon={AlertTriangle} colorClass="bg-red-100 text-red-600" />
        <DashboardCard title="Active Visitors" value={activeVisitors.length} icon={Clock} colorClass="bg-orange-100 text-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Recent Branch Activity</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Search..." className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[var(--color-brand-indigo)]" />
            </div>
          </div>
          <div className="overflow-x-auto flex-1 pb-2">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-slate-50 border-y border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Visitor</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Entry Time</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Exit Time</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Time Spent</th>
                  <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentVisitors.map(visitor => (
                  <tr key={visitor.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">
                          {visitor.visitorName?.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{visitor.visitorName}</div>
                          <div className="text-xs text-gray-500">{visitor.hostName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {visitor.entryTime || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {visitor.exitTime || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                      {calculateTimeSpent(visitor.visitDate, visitor.entryTime, visitor.exitTime, visitor.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        visitor.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                        visitor.status === 'Inside' ? 'bg-indigo-100 text-[var(--color-brand-indigo)]' :
                        visitor.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        visitor.status === 'Pending' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {visitor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{visitor.entryTime || visitor.visitDate}</td>
                  </tr>
                ))}
                {visitors.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                      No visitors registered for this branch yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Branch Links */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h3 className="text-[11px] font-bold text-gray-500 mb-6 uppercase tracking-wider">Branch Management</h3>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-gray-100 cursor-pointer hover:border-[var(--color-brand-indigo)] transition-colors" onClick={() => navigate('/visitors')}>
              <div className="flex items-center gap-3 text-gray-700">
                <Users size={18} className="text-blue-500" />
                <span className="font-medium">All Visitors</span>
              </div>
              <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded font-bold text-xs">{visitors.length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-gray-100 cursor-pointer hover:border-[var(--color-brand-indigo)] transition-colors" onClick={() => navigate('/approvals')}>
              <div className="flex items-center gap-3 text-gray-700">
                <Clock size={18} className="text-orange-500" />
                <span className="font-medium">Pending Approvals</span>
              </div>
              <span className="bg-orange-100 text-orange-700 py-0.5 px-2 rounded font-bold text-xs">{visitors.filter(v => v.status === 'Pending').length}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-gray-100 cursor-pointer hover:border-[var(--color-brand-indigo)] transition-colors" onClick={() => navigate('/tracking')}>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin size={18} className="text-green-500" />
                <span className="font-medium">Live Tracking</span>
              </div>
              <span className="bg-green-100 text-green-700 py-0.5 px-2 rounded font-bold text-xs">{activeVisitors.length} Inside</span>
            </div>
          </div>
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

        {/* Branch Capacity Chart */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col justify-center items-center">
          <h3 className="text-[11px] font-bold text-gray-500 mb-6 uppercase tracking-wider w-full text-left">Branch Capacity</h3>
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <path
                className="text-slate-100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#1E1B6E]"
                strokeDasharray={`${Math.min(100, Math.max(0, (activeVisitors.length / 50) * 100))}, 100`}
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{activeVisitors.length}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Inside</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-6 text-center">Currently at {Math.round((activeVisitors.length / 50) * 100)}% of maximum branch capacity.</p>
        </div>
      </div>

    </div>
  );
};

export default BranchAdminDashboard;
