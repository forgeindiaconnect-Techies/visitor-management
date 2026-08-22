import React, { useState } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useAuth } from '../../context/AuthContext';
import { Search, MapPin, Building, Activity, LogOut } from 'lucide-react';

const LiveMonitoring = () => {
  const { allVisitors } = useVisitors();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter visitors who are actively Inside
  const safeAll = Array.isArray(allVisitors) ? allVisitors : [];
  const activeVisitors = safeAll.filter(v => {
    const st = (v.status || '').toUpperCase();
    return st === 'INSIDE' || st === 'CHECKED_IN' || st === 'CHECKED IN';
  });

  // Filter by search term
  const filteredVisitors = activeVisitors.filter(v => 
    (v.visitorName || v.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.companyName || v.visitingCompany || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.currentZone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.branch || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="text-[var(--color-brand-indigo)] animate-pulse" size={32} />
            Live Zone Monitoring
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            Real-time tracking of all active visitors currently inside the premises.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Inside</p>
            <p className="text-4xl font-bold text-[var(--color-brand-indigo)]">{activeVisitors.length}</p>
          </div>
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center">
            <MapPin size={24} className="text-[var(--color-brand-indigo)]" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Active Visitors List
          </h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by name, company, zone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] bg-white" 
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">Visitor</th>
                <th className="px-6 py-4 font-medium">Branch</th>
                <th className="px-6 py-4 font-medium">Current Zone</th>
                <th className="px-6 py-4 font-medium">Host</th>
                <th className="px-6 py-4 font-medium">Entry Time</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVisitors.map((visitor) => (
                <tr key={visitor.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-[var(--color-brand-indigo)] flex items-center justify-center font-bold mr-3 shadow-inner">
                        {(visitor.visitorName || visitor.fullName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{visitor.visitorName || visitor.fullName || 'Visitor'}</p>
                        <p className="text-xs text-gray-500 font-medium">{visitor.companyName || visitor.visitingCompany || 'Visitor'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium">
                      <Building size={14} className="text-gray-400"/>
                      {visitor.branch}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {visitor.currentZone ? (
                      <span className="px-3 py-1 bg-indigo-100 text-[var(--color-brand-indigo)] rounded-full text-xs font-bold border border-indigo-200 flex items-center gap-1 w-max shadow-sm">
                        <span className="text-[10px]">📍</span> {visitor.currentZone}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm font-medium">Not Assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{visitor.hostName}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm bg-gray-50 px-2 py-1 rounded border border-gray-100 text-gray-800 whitespace-nowrap">
                      {visitor.entryTime || '--:--'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1.5 w-max">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      Inside
                    </span>
                  </td>
                </tr>
              ))}
              {filteredVisitors.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400 max-w-md mx-auto">
                      <MapPin size={48} className="mb-4 text-gray-300" />
                      <p className="text-lg font-medium text-gray-600">No active visitors found</p>
                      <p className="text-sm mt-2 text-center text-gray-500">
                        Visitors will only appear on this live monitoring map after they have successfully <strong className="text-gray-700">Checked In</strong> at the security gate.
                      </p>
                    </div>
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

export default LiveMonitoring;
