import React, { useState } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { Users, CheckCircle, Clock } from 'lucide-react';
import { isBranchMatch } from '../../utils/branchUtils';

const VisitorStatusSummaryCard = () => {
  const { visitors } = useVisitors();
  const { activeBranch } = useBranch();
  const { user: currentUser } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const queryBranch = activeBranch || 'All Branches';

  const safeVisitors = Array.isArray(visitors) ? visitors : [];

  // Filter visitors by branch and selected date
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

  // Exclude rejected visitors from the metrics
  const validVisitors = filteredVisitors.filter(v => v.status !== 'Rejected' && v.status !== 'REJECTED');
  
  const totalVisitors = validVisitors.length;
  // Exited maps to Completed
  const completedVisits = validVisitors.filter(v => ['Exited', 'Checked Out', 'CHECKED_OUT', 'Completed'].includes(v.status)).length;
  // Everything else (Pending, Approved, Inside, Checked In) maps to In Progress
  const inProgressVisits = totalVisitors - completedVisits;

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mt-6">
      <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Visitor Status</h2>
          <p className="text-xs text-gray-500 mt-1">{isToday ? "Today's Live Overview" : `Overview for ${selectedDate}`}</p>
        </div>
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)]"
        />
      </div>

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Users size={16} />
            </div>
            <span className="text-gray-800 font-semibold text-sm">Total Visitors</span>
          </div>
          <span className="text-lg font-bold text-gray-900">{totalVisitors}</span>
        </div>

        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <CheckCircle size={16} />
            </div>
            <span className="text-gray-800 font-semibold text-sm">Completed Visits</span>
          </div>
          <span className="text-lg font-bold text-gray-900">{completedVisits}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
              <Clock size={16} />
            </div>
            <span className="text-gray-800 font-semibold text-sm">In Progress Visits</span>
          </div>
          <span className="text-lg font-bold text-gray-900">{inProgressVisits}</span>
        </div>
      </div>
    </div>
  );
};

export default VisitorStatusSummaryCard;
