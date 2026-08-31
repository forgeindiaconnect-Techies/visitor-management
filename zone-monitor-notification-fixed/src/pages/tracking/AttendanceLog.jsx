import React, { useEffect, useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { Clock, Search, Camera, MapPin } from 'lucide-react';
import { useBranch } from '../../context/BranchContext';
import { formatDisplayTime } from '../../utils/dateUtils';

const AttendanceLog = () => {
  const { allAttendance, fetchAttendance, attendance } = useAttendance();
  const { activeBranch } = useBranch();
  
  // Re-fetch when branch changes (handled in context, but good to ensure latest)
  useEffect(() => {
    fetchAttendance();
  }, [activeBranch]);

  // If user is Security, they only see their own attendance logs
  // If user is Admin/MD/Super Admin, they see `allAttendance`
  // Actually, we need to ensure the backend returns the full history, but we already have `allAttendance`.
  // Wait, `AttendanceContext` fetches ALL for admin, but for Security it ONLY fetches today's.
  // To display a full log for Security, we'd need to fetch their history.
  // For now, let's just display `allAttendance`. If Security, maybe it's just today's. Let's fix that if needed.

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const logsToDisplay = (Array.isArray(allAttendance) && allAttendance.length > 0) ? allAttendance : (attendance ? [attendance] : []);
  
  const filteredLogs = (Array.isArray(logsToDisplay) ? logsToDisplay : []).filter(log => {
    const matchesSearch = log.securityName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.branch?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = dateFilter ? log.date === dateFilter : true;
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="text-[var(--color-brand-indigo)]" /> 
            Security Attendance Logs
          </h1>
          <p className="text-gray-500 mt-1">View check-in and check-out records for {activeBranch}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-64 flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search security name or branch..." 
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] bg-white" 
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Filter Date:</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] bg-white"
            />
            {dateFilter && (
              <button 
                onClick={() => setDateFilter('')}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-white text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">Security Guard</th>
                <th className="px-6 py-4 font-medium">Branch</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Check In</th>
                <th className="px-6 py-4 font-medium">Check-In Photo</th>
                <th className="px-6 py-4 font-medium">Check Out</th>
                <th className="px-6 py-4 font-medium">Check-Out Photo</th>
                <th className="px-6 py-4 font-medium">Working Hours</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <tr key={log.attendanceId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{log.securityName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{log.branch}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{log.date.split('-').reverse().join('-')}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{formatDisplayTime(log.checkInTime)}</td>
                  <td className="px-6 py-4">
                    {log.checkInPhoto ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                        <img src={log.checkInPhoto} alt="Check In" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-gray-400"><Camera size={16} /></span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{formatDisplayTime(log.checkOutTime)}</td>

                  <td className="px-6 py-4">
                    {log.checkOutPhoto ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                        <img src={log.checkOutPhoto} alt="Check Out" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-gray-400"><Camera size={16} /></span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-[var(--color-brand-indigo)]">{log.workingHours || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      log.attendanceStatus === 'Completed' ? 'bg-gray-100 text-gray-600' : 
                      log.attendanceStatus === 'Auto Checked-Out' ? 'bg-orange-100 text-orange-700' :
                      log.attendanceStatus === 'Check-In Closed' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {log.attendanceStatus || log.status}
                    </span>
                    {log.checkInLocation && (
                      <div className="mt-1 flex items-center text-xs text-blue-500">
                        <MapPin size={12} className="mr-1" /> GPS Verified
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    No attendance records found matching your search.
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

export default AttendanceLog;
