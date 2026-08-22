import React, { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useVisitors } from '../../context/VisitorContext';
import { isBranchMatch } from '../../utils/branchUtils';

const TodaysVisitorsCard = () => {
  const { visitors, loading } = useVisitors();
  const { activeBranch } = useBranch();
  const { user: currentUser } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const queryBranch = activeBranch || 'All Branches';

  const safeVisitors = Array.isArray(visitors) ? visitors : [];

  // Filter visitors for the selected date and branch
  const filteredVisitors = safeVisitors.filter(v => {
    // Branch filter
    if (!isBranchMatch(v.branch || v.branchLocation, queryBranch)) {
      return false;
    }

    // Date filter: check visitDate, date, or createdAt
    const rawDate = v.visitDate || v.date || v.createdAt;
    if (!rawDate) return false;
    const vDateStr = typeof rawDate === 'string' && rawDate.includes('T') 
      ? rawDate.split('T')[0] 
      : (rawDate instanceof Date ? rawDate.toISOString().split('T')[0] : String(rawDate));

    return vDateStr === selectedDate;
  });

  // Aggregate host breakdown
  const aggregatedBreakdown = {};
  filteredVisitors.forEach(v => {
    const rawName = v.hostName || v.hostEmployee || v.team || 'Staff';
    const displayKey = rawName.split('(')[0].trim() || 'Staff';
    const key = displayKey.toLowerCase();
    
    if (!aggregatedBreakdown[key]) {
      aggregatedBreakdown[key] = { hostName: displayKey, count: 0 };
    }
    aggregatedBreakdown[key].count += (parseInt(v.visitorCount, 10) || 1);
  });

  const teamBreakdown = Object.values(aggregatedBreakdown).sort((a, b) => b.count - a.count);
  const totalVisitorsToday = teamBreakdown.reduce((sum, item) => sum + item.count, 0);

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

      <div className="px-6 py-4">
        {loading && teamBreakdown.length === 0 ? (
          <div className="text-center text-gray-400 py-6">Loading live data...</div>
        ) : teamBreakdown.length === 0 ? (
          <div className="text-center text-gray-500 py-6 font-medium">No visitors registered for this date.</div>
        ) : (
          <div className="space-y-4">
            {teamBreakdown.map((item, index) => (
              <div key={index} className="flex items-center justify-between group">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[var(--color-brand-indigo)] group-hover:bg-indigo-100 transition-colors">
                    <UserCheck size={14} />
                  </div>
                  <span className="text-gray-800 font-semibold text-sm">
                    {item.hostName}
                  </span>
                </div>
                <div className="text-gray-600 font-medium text-sm">
                  <span className="text-base text-gray-900 font-bold mr-1">{item.count}</span>
                  <span className="text-xs">Visitors</span>
                </div>
              </div>
            ))}
          </div>
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
