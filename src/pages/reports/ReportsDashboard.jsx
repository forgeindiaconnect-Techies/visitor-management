import React, { useState } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useZones } from '../../context/ZoneContext';
import { useBlacklist } from '../../context/BlacklistContext';
import { Download, FileText, FileSpreadsheet, ShieldCheck, Map, Building2, Users, Clock, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { calculateTimeSpent } from '../../utils/timeUtils';
import { formatDisplayTime } from '../../utils/dateUtils';

const ReportsDashboard = () => {
  const { allVisitors } = useVisitors();
  const { zones } = useZones();
  const { blacklisted } = useBlacklist();
  
  const { user } = useAuth();
  
  // Apply Strict Branch Filtering
  // If the user is assigned to a specific branch, they should ONLY see that branch's data, regardless of their role.
  const safeAll = Array.isArray(allVisitors) ? allVisitors : [];
  const baseFilteredVisitors = user?.branch && user?.branch !== 'All' && user?.branch !== 'All Branches'
    ? safeAll.filter(v => v.branch === user.branch && !v.isPreBooking && v.registrationType !== 'Pre-Booking')
    : safeAll.filter(v => !v.isPreBooking && v.registrationType !== 'Pre-Booking');

  const [dateFilter, setDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState('visitor');

  const filteredVisitors = dateFilter
    ? baseFilteredVisitors.filter(v => v.visitDate === dateFilter)
    : baseFilteredVisitors;


  // User-Friendly Excel Exporter
  const exportExcel = (data, filename) => {
    if (!data || !data.length) return alert("No data to export!");
    
    let tableStr = '<table border="1"><thead><tr>';
    const headers = Object.keys(data[0]);
    headers.forEach(h => { tableStr += `<th style="background-color: #f3f4f6; font-weight: bold; padding: 8px;">${h}</th>`; });
    tableStr += '</tr></thead><tbody>';
    
    data.forEach(row => {
      tableStr += '<tr>';
      headers.forEach(h => { tableStr += `<td style="padding: 6px;">${row[h]}</td>`; });
      tableStr += '</tr>';
    });
    tableStr += '</tbody></table>';
    
    const htmlTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"></head>
      <body>${tableStr}</body>
      </html>
    `;
    
    const blob = new Blob([htmlTemplate], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    window.print(); // Simple browser print implementation for PDF
  };

  // 1. Visitor Report Data
  const visitorReportData = filteredVisitors.map(v => {
    const isCheckedOut = ['Exited', 'Completed'].includes(v.status);
    const rawExit = v.exitTime || v.checkOutTime;
    const displayExitTime = isCheckedOut ? (rawExit ? formatDisplayTime(rawExit) : 'N/A') : 'N/A';
    const rawEntry = v.entryTime || v.checkInTime;

    return {
      "Visitor": v.visitorName,
      "Host": v.hostName || 'N/A',
      "Branch": v.branch,
      "Purpose": v.purpose,
      "Entry": rawEntry ? formatDisplayTime(rawEntry) : 'N/A',
      "Exit": displayExitTime,
      "Time Spent": calculateTimeSpent(v.visitDate, v.entryTime, v.exitTime, v.status),
      "Status": v.status,
      "Notes": [v.hostNotes, v.remarks, v.exitNotes, v.checkOutNotes, v.notes].filter(Boolean).join(' | ') || '-'
    };
  });

  // Zone Report Data removed per request

  // 3. Branch Report Data
  const uniqueBranches = [...new Set(filteredVisitors.map(v => v.branch).filter(Boolean))];
  const branchReportData = uniqueBranches.map(branch => {
    const branchVisitors = filteredVisitors.filter(v => v.branch === branch);
    const inside = branchVisitors.filter(v => v.status === 'Inside').length;
    const completed = branchVisitors.filter(v => ['Completed', 'Exited'].includes(v.status)).length;

    return {
      "Branch": branch,
      "Total Visitors": branchVisitors.length,
      "Inside": inside,
      "Completed": completed
    };
  });

  const renderTable = (data) => {
    if (!data.length) return <p className="text-gray-500 py-8 text-center">No records found for this report.</p>;
    
    const headers = Object.keys(data[0]);
    
    const getColumnClass = (header) => {
      if (['Entry', 'Exit', 'Time Spent', 'Status'].includes(header)) return 'whitespace-nowrap';
      if (['Notes'].includes(header)) return 'min-w-[250px] max-w-[380px]';
      if (['Host', 'Branch', 'Purpose'].includes(header)) return 'min-w-[150px]';
      return 'whitespace-nowrap';
    };
    
    return (
      <div className="overflow-x-auto print:overflow-visible print:block print:opacity-100 print:w-full">
        <table className="w-full text-left border-collapse print:w-full print:table print:opacity-100 print:visible">
          <thead>
            <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider print:text-[10px]">
              {headers.map(h => <th key={h} className={`px-6 py-4 font-medium align-top ${getColumnClass(h)}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                {headers.map(h => {
                  if (h === 'Notes') {
                    return (
                      <td key={`${i}-${h}`} className="px-6 py-4 text-xs text-gray-800 align-top min-w-[250px] max-w-[380px]">
                        {row[h] && row[h] !== '-' ? (
                          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed whitespace-normal break-words shadow-2xs">
                            {row[h]}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </td>
                    );
                  }
                  return (
                    <td key={`${i}-${h}`} className={`px-6 py-4 text-sm text-gray-700 align-top ${getColumnClass(h)} print:text-[11px] print:px-2 print:py-2 print:whitespace-normal`}>
                      {row[h]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'visitor': return visitorReportData;
      case 'branch': return branchReportData;
      default: return [];
    }
  };

  // Security Report Aggregates
  const totalVisitors = filteredVisitors.length;
  // Let's assume 'Approved' includes anything that progressed past Pending
  const approvedVisitors = filteredVisitors.filter(v => ['Approved', 'Inside', 'Exited', 'Completed'].includes(v.status)).length;
  const rejectedVisitors = filteredVisitors.filter(v => v.status === 'Rejected').length;
  const insideVisitors = filteredVisitors.filter(v => v.status === 'Inside').length;
  const checkedOutVisitors = filteredVisitors.filter(v => ['Exited', 'Completed'].includes(v.status)).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:animate-none print:opacity-100 print:block print:visible print-friendly">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Reports</h1>
          <p className="text-gray-500 mt-1 print:hidden">Generate and export data across all modules.</p>
        </div>
        <div className="flex items-center space-x-3 print:hidden">
          <input 
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent bg-white shadow-sm"
            title="Filter by Date"
          />
          <button 
            onClick={() => exportExcel(activeTab === 'security' ? [
              { "Total Visitors": totalVisitors, "Approved": approvedVisitors, "Rejected": rejectedVisitors, "Inside": insideVisitors, "Checked Out": checkedOutVisitors }
            ] : getActiveData(), `${activeTab}_report`)}
            className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 font-medium rounded-lg transition-colors flex items-center space-x-2 border border-green-200"
          >
            <FileSpreadsheet size={18} />
            <span>Export Excel</span>
          </button>
          <button 
            onClick={exportPDF}
            className="px-4 py-2 bg-[var(--color-brand-indigo)] text-white hover:bg-[var(--color-brand-indigo-light)] font-medium rounded-lg transition-colors flex items-center space-x-2 shadow-sm"
          >
            <Download size={18} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:overflow-visible print:border-none print:shadow-none">
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto print:hidden">
          <button 
            onClick={() => setActiveTab('visitor')}
            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'visitor' ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={16}/> Visitor Report
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'security' ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <ShieldCheck size={16}/> Security Report
          </button>
          <button 
            onClick={() => setActiveTab('branch')}
            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'branch' ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Building2 size={16}/> Branch Report
          </button>
        </div>

        {/* Report Content */}
        {activeTab === 'security' && (
          <div className="p-8 bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                <span className="text-3xl font-bold text-gray-900 mb-2">{totalVisitors}</span>
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Visitors</span>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                <span className="text-3xl font-bold text-green-600 mb-2">{approvedVisitors}</span>
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Approved</span>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                <span className="text-3xl font-bold text-red-600 mb-2">{rejectedVisitors}</span>
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Rejected</span>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                <span className="text-3xl font-bold text-[var(--color-brand-indigo)] mb-2">{insideVisitors}</span>
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Inside</span>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                <span className="text-3xl font-bold text-gray-700 mb-2">{checkedOutVisitors}</span>
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Checked Out</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branch' && (
          <div className="p-0">
            {renderTable(branchReportData)}
          </div>
        )}

        {activeTab === 'visitor' && (
          <div className="p-0 print:block print:visible print:opacity-100 print:w-full">
            {renderTable(visitorReportData)}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsDashboard;
