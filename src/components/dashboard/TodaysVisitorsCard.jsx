import React, { useState } from 'react';
import { UserCheck, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useVisitors } from '../../context/VisitorContext';
import { isBranchMatch } from '../../utils/branchUtils';
import { formatDisplayName } from '../../utils/nameFormatter';

const TodaysVisitorsCard = () => {
  const { visitors, loading } = useVisitors();
  const { activeBranch } = useBranch();
  const { user: currentUser } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const queryBranch = activeBranch || 'All Branches';
  const safeVisitors = Array.isArray(visitors) ? visitors : [];

  // Helper to extract YYYY-MM-DD from any date string or Date object
  const getYYYYMMDD = (rawDate) => {
    if (!rawDate) return '';
    const str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    if (str.includes('T')) {
      return str.split('T')[0];
    }
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}
    return str.split('T')[0];
  };

  // Filter visitors for the selected date and branch
  const filteredVisitors = safeVisitors.filter(v => {
    // Branch filter
    if (!isBranchMatch(v.branch || v.branchLocation, queryBranch)) {
      return false;
    }

    // Date filter: check visitDate, date, or createdAt
    const rawDate = v.visitDate || v.date || v.createdAt;
    if (!rawDate) return false;
    const vDateStr = getYYYYMMDD(rawDate);

    return vDateStr === selectedDate;
  });

  // Group visitors by host (only hosts with visitors on this date)
  const hostMap = {};

  filteredVisitors.forEach(v => {
    const rawHost = formatDisplayName(v.hostName || v.hostEmployee || v.host || 'Direct Visits', 'Direct Visits');
    const visitorName = formatDisplayName(v.visitorName || v.fullName || v.name || 'Visitor', 'Visitor');
    const count = parseInt(v.visitorCount, 10) || 1;

    if (!hostMap[rawHost]) {
      hostMap[rawHost] = {
        hostName: rawHost,
        count: 0,
        visitorNames: []
      };
    }

    hostMap[rawHost].count += count;
    if (!hostMap[rawHost].visitorNames.includes(visitorName)) {
      hostMap[rawHost].visitorNames.push(visitorName);
    }
  });

  const hostList = Object.values(hostMap).sort((a, b) => b.count - a.count);
  const totalVisitorsToday = filteredVisitors.reduce((sum, v) => sum + (parseInt(v.visitorCount, 10) || 1), 0);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mt-6">
      <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Visitor Count by Host</h2>
          <p className="text-xs text-gray-500 mt-1">{isToday ? "Today's Live Summary" : `Summary for ${selectedDate}`}</p>
        </div>
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)]"
        />
      </div>

      <div className="px-6 py-4 max-h-[360px] overflow-y-auto divide-y divide-gray-100">
        {loading && hostList.length === 0 ? (
          <div className="text-center text-gray-400 py-6">Loading live data...</div>
        ) : hostList.length === 0 ? (
          <div className="text-center text-gray-500 py-6 font-medium">
            No visitors registered for this date.
          </div>
        ) : (
          hostList.map((item, index) => (
            <div key={index} className="py-3 group first:pt-1 last:pb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[var(--color-brand-indigo)] group-hover:bg-indigo-100 transition-colors">
                    <UserCheck size={14} />
                  </div>
                  <span className="text-gray-900 font-bold text-sm">
                    {item.hostName}
                  </span>
                </div>
                <div className="text-gray-600 font-medium text-sm flex items-center gap-1">
                  <span className="text-base text-[var(--color-brand-indigo)] font-extrabold mr-1">
                    {item.count}
                  </span>
                  <span className="text-xs text-gray-500 font-semibold">
                    {item.count === 1 ? 'Visitor' : 'Visitors'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-6 py-4 bg-[var(--color-brand-indigo)] text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-indigo-100">Total Visitors:</span>
          <span className="text-xl font-black">{totalVisitorsToday}</span>
        </div>
      </div>
    </div>
  );
};

export default TodaysVisitorsCard;
