import React, { useState } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useZones } from '../../context/ZoneContext';
import { useBranch } from '../../context/BranchContext';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, MoreVertical, QrCode, X, FileText, Edit, Save, CalendarCheck, UserPlus, Eye, User, Trash2, LogIn, LogOut, Clock, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import VisitorHistoryModal from '../../components/visitors/VisitorHistoryModal';
import VisitorRescheduleModal from '../../components/visitors/VisitorRescheduleModal';
import { formatDisplayTime, formatDisplayDateTime, formatDisplayDate } from '../../utils/dateUtils';

const VisitorList = () => {
  const { visitors, allVisitors, updateVisitorStatus, updateVisitorTracking, updateVisitor, deleteVisitor, networkIp } = useVisitors();
  const { zones } = useZones();
  const { activeBranch, branches } = useBranch();
  const { addNotification } = useNotification();
  const { user, hasApprovalPermission } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisitorQR, setSelectedVisitorQR] = useState(null);
  const [selectedVisitorHistory, setSelectedVisitorHistory] = useState(null);
  const [selectedVisitorUpdateZone, setSelectedVisitorUpdateZone] = useState(null);
  const [selectedVisitorEdit, setSelectedVisitorEdit] = useState(null);
  const [selectedVisitorDetails, setSelectedVisitorDetails] = useState(null);
  const [reschedulingVisitor, setReschedulingVisitor] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  const calculateDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 'N/A';
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'N/A';
    
    const diffMs = end - start;
    if (diffMs < 0) return 'N/A';
    
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) {
      return diffSecs <= 0 ? '< 1m' : `${diffSecs}s`;
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const cleanStr = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
    } catch (e) {}
    return String(dateStr);
  };

  const formatVisitorId = (rawId, index = 0) => {
    if (!rawId) return `VIS-${1001 + index}`;
    const str = String(rawId).trim();
    if (str.startsWith('VIS-') || str.startsWith('VISIT-') || str.startsWith('VIS')) {
      return str.toUpperCase();
    }
    return `VIS-${str}`;
  };

  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('ALL');
  const [reportDateFilter, setReportDateFilter] = useState('');

  const [hosts, setHosts] = useState([
    'PRIYADHARSHINI(HR)',
    'GANESH KUMAR(HR)',
    'SANDEEP(CEO SIR)',
    'AVINASH(MD SIR)',
    'SABARI(ADMIN)',
    'AGILA(IT)',
    'DIRECT VISITS'
  ]);


  // Handle URL params for filtering
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('filter') === 'checked-in') {
      setStatusFilter('Checked In');
      // Intentionally not setting dateFilter to allow all-time QR Scans
    }
  }, [location]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getStatusColor = (status) => {
    const s = String(status || '').toUpperCase().trim();
    switch (s) {
      case 'DRAFT': return 'bg-gray-100 text-gray-700 border border-gray-200';
      case 'PENDING APPROVAL':
      case 'PENDING': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'APPROVED': return 'bg-green-100 text-green-800 border border-green-200';
      case 'REJECTED':
      case 'CANCELLED': return 'bg-red-100 text-red-800 border border-red-200';
      case 'CHECKED_IN':
      case 'CHECKED IN':
      case 'INSIDE': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'CHECKED_OUT':
      case 'CHECKED OUT':
      case 'EXITED': return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'EXPIRED': return 'bg-slate-800 text-white border border-slate-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const directVisitors = (Array.isArray(visitors) ? visitors : []).filter(v => {
    // If it's a scheduled pre-booking assigned to an HR/Staff host, exclude from Direct Visits
    const host = String(v.hostEmployee || v.hostName || '').trim().toLowerCase();
    const isDirectHost = host === 'direct visits' || host === 'direct visit' || host.includes('direct');

    if (v.isPreBooking && !isDirectHost) {
      return false;
    }

    return true;
  });

  const statusCounts = {
    all: directVisitors.length,
    pending: directVisitors.filter(v => (v.status || '').toUpperCase() === 'PENDING').length,
    approved: directVisitors.filter(v => (v.status || '').toUpperCase() === 'APPROVED').length,
    rejected: directVisitors.filter(v => ['REJECTED', 'CANCELLED'].includes((v.status || '').toUpperCase())).length,
    checkedIn: directVisitors.filter(v => ['CHECKED_IN', 'CHECKED IN', 'INSIDE'].includes((v.status || '').toUpperCase())).length,
    checkedOut: directVisitors.filter(v => ['CHECKED_OUT', 'CHECKED OUT', 'EXITED'].includes((v.status || '').toUpperCase())).length,
  };

  const filteredVisitors = directVisitors.filter(v => {
    const matchesSearch = (v.visitorName || v.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.companyName || v.visitingCompany || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.mobileNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.bookingId || v.visitorId || v.visitId || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const normStatus = (v.status || '').toUpperCase().replace(/\s+/g, '_');
    const targetStatus = statusFilter.toUpperCase().replace(/\s+/g, '_');

    const matchesStatus = statusFilter === 'All' || statusFilter === 'ALL' || statusFilter === 'Reports' ||
                          (targetStatus === 'CHECKED_IN' && (normStatus === 'INSIDE' || normStatus === 'CHECKED_IN')) ||
                          (targetStatus === 'CHECKED_OUT' && (normStatus === 'EXITED' || normStatus === 'CHECKED_OUT')) ||
                          normStatus === targetStatus;

    const matchesDate = !dateFilter || v.visitDate === dateFilter || (v.visitDate && new Date(v.visitDate).toISOString().split('T')[0] === dateFilter);

    return matchesSearch && matchesStatus && matchesDate;
  });

  const filteredReports = directVisitors.filter((r) => {
    const q = reportSearchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (r.visitId && String(r.visitId).toLowerCase().includes(q)) ||
      (r.visitorId && String(r.visitorId).toLowerCase().includes(q)) ||
      (r.visitorName && r.visitorName.toLowerCase().includes(q)) ||
      (r.fullName && r.fullName.toLowerCase().includes(q)) ||
      (r.mobileNumber && r.mobileNumber.includes(q)) ||
      (r.companyName && r.companyName.toLowerCase().includes(q)) ||
      (r.visitingCompany && r.visitingCompany.toLowerCase().includes(q));

    const itemStatus = (r.status || '').toUpperCase().replace(/\s+/g, '_');
    const targetStatus = reportStatusFilter.toUpperCase().replace(/\s+/g, '_');

    const matchesStatus =
      reportStatusFilter === 'ALL' ||
      itemStatus === targetStatus ||
      (targetStatus === 'CHECKED_IN' && (itemStatus === 'INSIDE' || itemStatus === 'CHECKED_IN')) ||
      (targetStatus === 'CHECKED_OUT' && (itemStatus === 'EXITED' || itemStatus === 'CHECKED_OUT'));

    const matchesDate =
      !reportDateFilter ||
      (r.visitDate && new Date(r.visitDate).toISOString().split('T')[0] === reportDateFilter);

    return matchesQuery && matchesStatus && matchesDate;
  });

  const exportToExcel = () => {
    if (filteredReports.length === 0) return;
    const headers = [
      "Visitor Number", "Visitor Name", "Mobile", "Company", 
      "Host", "Purpose", "Visit Date", "Expected Time", "Branch", 
      "Status", "Check-In Time", "Check-Out Time", "Duration", "Checkout Notes"
    ];
    const rows = filteredReports.map(r => [
      r.visitorId || r.visitId || r.id || '',
      r.visitorName || r.fullName || '',
      r.mobileNumber || '',
      r.companyName || r.visitingCompany || '',
      r.hostName || r.hostEmployee || '',
      r.purpose || r.visitPurpose || '',
      r.visitDate ? formatDisplayDate(r.visitDate) : '',
      formatDisplayTime(r.expectedArrivalTime || r.expectedTime),
      r.branch || r.branchLocation || 'Head Office',
      r.status || '',
      r.checkInTime ? formatDisplayTime(r.checkInTime) : '',
      r.checkOutTime ? formatDisplayTime(r.checkOutTime) : '',
      calculateDuration(r.checkInTime, r.checkOutTime),
      r.remarks || r.exitNotes || r.notes || r.checkoutNotes || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Direct_Visits_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    window.print();
  };

  const isReturningVisitor = (visitor) => {
    if (!visitor) return false;
    if (visitor.isReturning === true) return true;
    if (visitor.registrationType === 'Returning') return true;

    const listToCheck = allVisitors && allVisitors.length > 0 ? allVisitors : visitors;
    const mobile = String(visitor.mobileNumber || '').replace(/\D/g, '').slice(-10);

    if (mobile && listToCheck.length > 0) {
      // Find all records matching this mobile number
      const sameMobileVisits = listToCheck.filter(v => {
        const vMobile = String(v.mobileNumber || '').replace(/\D/g, '').slice(-10);
        return vMobile && vMobile === mobile;
      });

      if (sameMobileVisits.length > 1) {
        // Sort chronologically (oldest first)
        sameMobileVisits.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.visitDate || a.date || 0).getTime();
          const timeB = new Date(b.createdAt || b.visitDate || b.date || 0).getTime();
          return timeA - timeB;
        });

        // The very first visit is the initial visit ('New'). All subsequent visits are 'Returning'.
        const earliestVisit = sameMobileVisits[0];
        const isCurrentEarliest = String(earliestVisit._id || earliestVisit.id || earliestVisit.visitorId) === String(visitor._id || visitor.id || visitor.visitorId);
        return !isCurrentEarliest;
      }
    }

    return false;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Direct Visit Management</h1>
          <p className="text-gray-500 mt-1">Manage and track on-site direct visit visitors across zones.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        {/* Status Filter Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto bg-white rounded-t-xl px-2 pt-2 gap-1">
          {[
            { key: 'All', label: 'All Direct Visits', count: statusCounts.all },
            { key: 'Pending', label: 'Pending', count: statusCounts.pending },
            { key: 'Approved', label: 'Approved', count: statusCounts.approved },
            { key: 'Rejected', label: 'Rejected', count: statusCounts.rejected },
            { key: 'Checked In', label: 'Checked In', count: statusCounts.checkedIn },
            { key: 'Checked Out', label: 'Checked Out', count: statusCounts.checkedOut },
            ...((['Super Admin', 'SaaS Super Admin', 'MD'].includes(user?.role)) ? [{ key: 'Reports', label: '📊 Reports', count: statusCounts.all }] : [])
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                statusFilter.toLowerCase() === tab.key.toLowerCase()
                  ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {(statusFilter === 'Reports' && ['Super Admin', 'SaaS Super Admin', 'MD'].includes(user?.role)) ? (

          /* REPORTS DASHBOARD VIEW MATCHING SCREENSHOT 2 */
          <div className="p-4 space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { title: 'Total Visitors', count: filteredReports.length, color: 'bg-slate-50 text-slate-800 border-slate-200' },
                { title: 'Pending', count: filteredReports.filter(r => (r.status || '').toUpperCase() === 'PENDING').length, color: 'bg-orange-50 text-orange-800 border-orange-200' },
                { title: 'Approved', count: filteredReports.filter(r => (r.status || '').toUpperCase() === 'APPROVED').length, color: 'bg-green-50 text-green-800 border-green-200' },
                { title: 'Rejected', count: filteredReports.filter(r => ['REJECTED', 'CANCELLED'].includes((r.status || '').toUpperCase())).length, color: 'bg-red-50 text-red-800 border-red-200' },
                { title: 'Checked In', count: filteredReports.filter(r => ['CHECKED_IN', 'CHECKED IN', 'INSIDE'].includes((r.status || '').toUpperCase())).length, color: 'bg-blue-50 text-blue-800 border-blue-200' },
                { title: 'Checked Out', count: filteredReports.filter(r => ['CHECKED_OUT', 'CHECKED OUT', 'EXITED'].includes((r.status || '').toUpperCase())).length, color: 'bg-purple-50 text-purple-800 border-purple-200' },
              ].map((stat, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${stat.color} flex flex-col shadow-sm`}>
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-85">{stat.title}</span>
                  <span className="text-2xl font-bold mt-1">{stat.count}</span>
                </div>
              ))}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
              <div className="relative flex-1 max-w-md w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search reports by visitor name, ID, phone..."
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] bg-white cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CHECKED_IN">Checked In</option>
                  <option value="CHECKED_OUT">Checked Out</option>
                </select>

                <input 
                  type="date" 
                  value={reportDateFilter}
                  onChange={(e) => setReportDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] font-medium"
                />

                <button
                  onClick={() => {
                    setReportSearchQuery("");
                    setReportStatusFilter("ALL");
                    setReportDateFilter("");
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors border border-gray-200 cursor-pointer"
                >
                  Clear Filters
                </button>

                <button
                  onClick={exportToExcel}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-2 rounded-lg flex items-center space-x-1.5 text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <span>📊 Export Excel</span>
                </button>
                <button
                  onClick={exportToPDF}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-lg flex items-center space-x-1.5 text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <span>📄 Export PDF</span>
                </button>
              </div>
            </div>

            {/* Reports Table */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[1300px]">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-100 whitespace-nowrap">
                    <th className="px-4 py-3 font-semibold">Visitor No</th>
                    <th className="px-4 py-3 font-semibold">Photo</th>
                    <th className="px-4 py-3 font-semibold">Visitor Name</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Host Employee</th>
                    <th className="px-4 py-3 font-semibold">Purpose</th>
                    <th className="px-4 py-3 font-semibold">Visit Date</th>
                    <th className="px-4 py-3 font-semibold">Expected Time</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Check-In Time</th>
                    <th className="px-4 py-3 font-semibold">Check-Out Time</th>
                    <th className="px-4 py-3 font-semibold">Duration</th>
                    <th className="px-4 py-3 font-semibold">Checkout Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm whitespace-nowrap">
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="13" className="px-6 py-12 text-center text-gray-500 font-medium">
                        No report records found.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((r, index) => (
                      <tr 
                        key={r._id || r.id || index} 
                        onClick={() => setSelectedVisitorDetails(r)}
                        className="hover:bg-indigo-50/20 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 text-xs shadow-xs">
                            {formatVisitorId(r.visitorId || r.visitId || r.id, index)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.photoUrl || r.facePhoto ? (
                            <img src={r.photoUrl || r.facePhoto} alt="Visitor" className="w-10 h-10 object-cover rounded-lg border border-gray-100" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-gray-400 text-xs font-bold">
                              {(r.visitorName || r.fullName || 'V').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{r.visitorName || r.fullName}</td>
                        <td className="px-4 py-3 text-gray-600">{r.companyName || r.visitingCompany || 'Forge India Connect Private Limited'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{r.hostName || r.hostEmployee || 'Direct Visits'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.purpose || r.visitPurpose || 'Meeting'}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDisplayDate(r.visitDate)}</td>
                        <td className="px-4 py-3 text-gray-600 font-medium">{formatDisplayTime(r.expectedArrivalTime || r.expectedTime)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">
                          {r.checkInTime ? (
                            <span className="bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold inline-flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {formatDisplayTime(r.checkInTime)}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">
                          {r.checkOutTime ? (
                            <span className="bg-purple-50 text-purple-800 px-2.5 py-1 rounded-md border border-purple-200 font-semibold inline-flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                              {formatDisplayTime(r.checkOutTime)}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold font-mono text-xs whitespace-nowrap">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100 font-bold">{calculateDuration(r.checkInTime, r.checkOutTime)}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 min-w-[220px] max-w-[360px]">
                          {(r.remarks || r.exitNotes || r.notes || r.checkoutNotes) ? (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-xs leading-relaxed whitespace-normal break-words shadow-2xs">
                              <span className="font-medium text-slate-800">{r.remarks || r.exitNotes || r.notes || r.checkoutNotes}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">No notes</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* REGULAR DIRECT VISIT TABLE VIEW */
          <div>
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search visitors or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)]"
                />
                {dateFilter && (
                  <button 
                    onClick={() => setDateFilter('')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Clear Date Filter"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="relative">
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center space-x-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${isFilterOpen || statusFilter !== 'All' ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)] bg-indigo-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <Filter size={18} />
                  <span>{statusFilter !== 'All' ? statusFilter : 'Filters'}</span>
                </button>
                
                {isFilterOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="p-2 space-y-1">
                      {['All', 'Pending', 'Approved', 'Checked In', 'Checked Out', 'Rejected'].map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setStatusFilter(status);
                            setIsFilterOpen(false);
                          }}
                          className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${statusFilter === status ? 'bg-indigo-50 text-[var(--color-brand-indigo)] font-semibold' : 'text-gray-700 hover:bg-slate-50'}`}
                        >
                          {status === 'All' ? 'All Statuses' : status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Visitor</th>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-6 py-4 font-medium">Host</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Current Zone</th>
                <th className="px-6 py-4 font-medium">Status</th>
                {user?.role !== 'HR' && (
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVisitors.map((visitor) => (
                <tr key={visitor.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-[var(--color-brand-indigo)] flex items-center justify-center font-bold mr-3">
                        {(visitor.visitorName || 'U').charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{visitor.visitorName || 'Unknown'}</p>
                          {isReturningVisitor(visitor) ? (
                            <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Returning</span>
                          ) : (
                            <span className="text-[9px] bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">New</span>
                          )}
                        </div>
                        <div className="flex flex-col items-start mt-0.5 gap-1">
                          <p className="text-xs text-gray-500">{visitor.mobileNumber}</p>
                          {activeBranch === 'All Branches' && visitor.branch && (
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded border border-slate-200 uppercase tracking-wider font-semibold shadow-sm">
                              📍 {visitor.branch}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium whitespace-nowrap">{visitor.companyName || visitor.visitingCompany || visitor.company || 'Forge India Connect Private Limited'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{visitor.hostName || visitor.hostEmployee || visitor.host || 'Staff'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDisplayDate(visitor.visitDate)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {visitor.currentZone ? (
                      <span className="px-3 py-1 bg-indigo-100 text-[var(--color-brand-indigo)] rounded-full text-xs font-bold border border-indigo-200 flex items-center gap-1 w-max">
                        <span className="text-[10px]">📍</span> {visitor.currentZone}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm font-medium">Not Assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(visitor.status)}`}>
                      {visitor.status === 'Inside' || visitor.status === 'CHECKED_IN' || visitor.status === 'Checked In' ? 'Checked In' : 
                       visitor.status === 'Exited' || visitor.status === 'CHECKED_OUT' || visitor.status === 'Checked Out' ? 'Checked Out' : 
                       visitor.status === 'PENDING' || visitor.status === 'Pending' ? 'Pending' :
                       visitor.status === 'APPROVED' || visitor.status === 'Approved' ? 'Approved' :
                       visitor.status === 'REJECTED' || visitor.status === 'Rejected' ? 'Rejected' :
                       visitor.status}
                    </span>
                  </td>
                  {user?.role !== 'HR' && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">


                        <div className="relative inline-block">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              setOpenDropdownId(openDropdownId === visitor.id ? null : visitor.id);
                            }}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                                   {openDropdownId === visitor.id && (
                          <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 z-50 text-left overflow-hidden animate-in fade-in duration-150">
                            <button 
                              onClick={() => { setSelectedVisitorDetails(visitor); setOpenDropdownId(null); }} 
                              className="w-full px-3.5 py-2 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                            >
                              <Eye size={14} className="text-slate-500" /> View Details
                            </button>

                            <button 
                              onClick={() => { setSelectedVisitorEdit(visitor); setOpenDropdownId(null); }} 
                              className="w-full px-3.5 py-2 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-2.5 transition-colors border-t border-gray-100"
                            >
                              <Edit size={14} className="text-indigo-600" /> Edit Details
                            </button>

                            {!['CHECKED_IN', 'CHECKED IN', 'INSIDE', 'CHECKED_OUT', 'CHECKED OUT', 'EXITED'].includes((visitor.status || '').toUpperCase()) && (
                              <button 
                                onClick={() => { updateVisitorStatus(visitor._id || visitor.id, 'Checked In'); setOpenDropdownId(null); }} 
                                className="w-full px-3.5 py-2 hover:bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2.5 transition-colors border-t border-gray-100"
                              >
                                <LogIn size={14} className="text-emerald-600" /> Check In
                              </button>
                            )}

                            {['CHECKED_IN', 'CHECKED IN', 'INSIDE'].includes((visitor.status || '').toUpperCase()) && (
                              <button 
                                onClick={() => { updateVisitorStatus(visitor._id || visitor.id, 'Checked Out'); setOpenDropdownId(null); }} 
                                className="w-full px-3.5 py-2 hover:bg-purple-50 text-purple-700 text-xs font-bold flex items-center gap-2.5 transition-colors border-t border-gray-100"
                              >
                                <LogOut size={14} className="text-purple-600" /> Check Out
                              </button>
                            )}

                            <button 
                              onClick={() => { setSelectedVisitorQR(visitor); setOpenDropdownId(null); }} 
                              className="w-full px-3.5 py-2 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-2.5 transition-colors border-t border-gray-100"
                            >
                              <QrCode size={14} className="text-indigo-600" /> View QR Pass
                            </button>

                            {visitor.mobileNumber && (
                              <>
                                <button 
                                  onClick={() => { navigate(`/visitors/returning?mobile=${encodeURIComponent(visitor.mobileNumber)}`); setOpenDropdownId(null); }} 
                                  className="w-full px-3.5 py-2 hover:bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2.5 transition-colors border-t border-gray-100"
                                >
                                  <UserPlus size={14} className="text-emerald-600" /> Direct Visit (Register Again)
                                </button>
                                <button 
                                  onClick={() => { window.open(`/prebook?mobile=${encodeURIComponent(visitor.mobileNumber)}`, '_blank'); setOpenDropdownId(null); }} 
                                  className="w-full px-3.5 py-2 hover:bg-indigo-50 text-[var(--color-brand-indigo)] text-xs font-bold flex items-center gap-2.5 transition-colors border-t border-indigo-100"
                                >
                                  <CalendarCheck size={14} className="text-[var(--color-brand-indigo)]" /> Pre-Booking (Register Again)
                                </button>
                              </>
                            )}

                            <div className="border-t border-gray-100 my-1" />

                            <button 
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to delete visitor record for ${visitor.visitorName || visitor.fullName}?`)) {
                                  await deleteVisitor(visitor._id || visitor.id, false);
                                  setOpenDropdownId(null);
                                }
                              }} 
                              className="w-full px-3.5 py-2 hover:bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-2.5 transition-colors"
                            >
                              <Trash2 size={14} className="text-red-500" /> Delete Record
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                )}
                </tr>
              ))}
              
              {filteredVisitors.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No visitors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>

      {/* QR Code Modal */}
      {selectedVisitorQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <button 
              onClick={() => setSelectedVisitorQR(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="mb-4 text-[var(--color-brand-indigo)] flex justify-center">
              <QrCode size={40} />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Visitor Pass</h2>
            <p className="text-gray-500 text-sm mb-6">Scan with any phone camera</p>
            
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm inline-block mb-6">
              <QRCodeSVG 
                value={window.location.hostname === 'localhost' ? `http://${networkIp}:${window.location.port}/pass/${selectedVisitorQR.visitId || selectedVisitorQR.id}` : `${window.location.origin}/pass/${selectedVisitorQR.visitId || selectedVisitorQR.id}`} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-2">
              <p className="font-bold text-[var(--color-brand-indigo)]">{selectedVisitorQR.visitorName}</p>
              <p className="text-sm text-indigo-700 font-mono mt-1">{selectedVisitorQR.visitId}</p>
            </div>
            <p className="text-xs text-gray-400">Status: {selectedVisitorQR.status}</p>
          </div>
        </div>
      )}



      {/* Update Zone Modal */}
      {selectedVisitorUpdateZone && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden relative">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Update Visitor Zone</h3>
              <button 
                onClick={() => setSelectedVisitorUpdateZone(null)} 
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Visitor: <strong className="text-gray-900">{selectedVisitorUpdateZone.visitorName}</strong></p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Zone</label>
                <select 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent bg-white shadow-sm"
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                >
                  <option value="" disabled>▼ Select Zone</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.name}>▼ {zone.name}</option>
                  ))}
                  <option value="Exit" className="text-red-600 font-bold">▼ Exit (Check Out)</option>
                </select>
              </div>
              <button 
                onClick={() => {
                  if (selectedZone) {
                    if (selectedZone === 'Exit') {
                      updateVisitorStatus(selectedVisitorUpdateZone.id, 'Exited');
                    } else {
                      updateVisitorTracking(selectedVisitorUpdateZone.id, {
                        status: 'Inside',
                        currentZone: selectedZone
                      });
                    }
                    setSelectedVisitorUpdateZone(null);
                    setSelectedZone('');
                  } else {
                    addNotification('Action Required', 'Please select a zone first.', 'warning');
                  }
                }}
                className="w-full mt-4 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-medium py-3 rounded-lg shadow-md transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Visitor Modal */}
      {selectedVisitorEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden relative">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Edit size={18} className="text-[var(--color-brand-indigo)]" />
                Edit Visitor Details
              </h3>
              <button 
                onClick={() => setSelectedVisitorEdit(null)} 
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const updates = {
                visitorName: formData.get('visitorName'),
                mobileNumber: formData.get('mobileNumber'),
                hostName: formData.get('hostName'),
                purpose: formData.get('purpose')
              };
              if (formData.has('branch')) {
                updates.branch = formData.get('branch');
              }
              const success = await updateVisitor(selectedVisitorEdit.id, updates);
              if (success) {
                setSelectedVisitorEdit(null);
              }
            }}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name</label>
                  <input required name="visitorName" defaultValue={selectedVisitorEdit.visitorName} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input required name="mobileNumber" defaultValue={selectedVisitorEdit.mobileNumber} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none" />
                </div>
                {user?.role === 'Super Admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <select required name="branch" defaultValue={selectedVisitorEdit.branch} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white">
                      <option value="">Select Branch</option>
                      {branches.filter(b => b !== 'All Branches').map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Host Name</label>
                  <select required name="hostName" defaultValue={selectedVisitorEdit.hostName} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white">
                    <option value="">Select Host</option>
                    {hosts.map(host => (
                      <option key={host} value={host}>{host}</option>
                    ))}
                    {!hosts.includes(selectedVisitorEdit.hostName) && (
                      <option value={selectedVisitorEdit.hostName}>{selectedVisitorEdit.hostName}</option>
                    )}
                  </select>

                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                  <select required name="purpose" defaultValue={selectedVisitorEdit.purpose} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white">
                    <option value="">Select Purpose</option>
                    <option value="Interview">Interview</option>
                    <option value="Follow up">Follow up</option>
                    <option value="Job consulting">Job consulting</option>
                    <option value="Banking">Banking</option>
                    <option value="CEO meeting">CEO meeting</option>
                    <option value="Visitors">Visitors</option>
                    <option value="Guest">Guest</option>
                    {/* Include the current purpose if it's not in the predefined list */}
                    {!['Interview', 'Follow up', 'Job consulting', 'Banking', 'CEO meeting', 'Visitors', 'Guest'].includes(selectedVisitorEdit.purpose) && (
                      <option value={selectedVisitorEdit.purpose}>{selectedVisitorEdit.purpose}</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setSelectedVisitorEdit(null)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--color-brand-indigo)] text-white rounded-lg font-medium flex items-center gap-2 hover:bg-[var(--color-brand-indigo-light)]">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Visitor Details Modal */}
      {selectedVisitorDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedVisitorDetails(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
            >
              <X size={18} />
            </button>
            
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
              <div className="w-20 h-20 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-indigo-500/20 shadow-md flex-shrink-0">
                {selectedVisitorDetails.photoUrl ? (
                  <img src={selectedVisitorDetails.photoUrl} alt={selectedVisitorDetails.visitorName} className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-gray-400" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block">Visitor Profile Details</span>
                <h3 className="text-xl font-bold text-gray-900">{selectedVisitorDetails.visitorName}</h3>
                <span className="text-xs font-semibold text-slate-500">{selectedVisitorDetails.companyName || 'Forge India Connect Private Limited'}</span>
                <div className="mt-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedVisitorDetails.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Visitor ID</span>
                <span className="font-mono font-bold text-indigo-700 text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/80">{formatVisitorId(selectedVisitorDetails.visitId || selectedVisitorDetails.visitorId || selectedVisitorDetails.id)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Mobile Number</span>
                <span className="font-bold text-slate-800">{selectedVisitorDetails.mobileNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Host Employee</span>
                <span className="font-bold text-slate-800">{selectedVisitorDetails.hostName || 'Not Assigned'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Purpose</span>
                <span className="font-semibold text-purple-700">{selectedVisitorDetails.purpose || 'Business Meeting'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Date & Time</span>
                <span className="font-semibold text-slate-800">{formatDisplayDate(selectedVisitorDetails.visitDate)} @ {formatDisplayTime(selectedVisitorDetails.expectedArrivalTime || selectedVisitorDetails.expectedTime)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Branch</span>
                <span className="font-semibold text-slate-800">{selectedVisitorDetails.branch || 'Chennai'}</span>
              </div>
            </div>

            {/* Check-In & Check-Out Times */}
            {(selectedVisitorDetails.checkInTime || selectedVisitorDetails.checkOutTime) && (
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-emerald-700 font-bold uppercase text-[10px] block">Check-In Time</span>
                  <span className="font-mono font-bold text-emerald-950 text-sm">
                    {formatDisplayTime(selectedVisitorDetails.checkInTime)}
                  </span>
                  {selectedVisitorDetails.checkInBy && (
                    <span className="text-[10px] text-gray-400 block mt-0.5">By: {selectedVisitorDetails.checkInBy}</span>
                  )}
                </div>
                <div>
                  <span className="text-purple-700 font-bold uppercase text-[10px] block">Check-Out Time</span>
                  <span className="font-mono font-bold text-purple-950 text-sm">
                    {formatDisplayTime(selectedVisitorDetails.checkOutTime)}
                  </span>
                  {selectedVisitorDetails.checkOutBy && (
                    <span className="text-[10px] text-gray-400 block mt-0.5">By: {selectedVisitorDetails.checkOutBy}</span>
                  )}
                </div>
                {selectedVisitorDetails.checkInTime && selectedVisitorDetails.checkOutTime && (
                  <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Total Duration:</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{calculateDuration(selectedVisitorDetails.checkInTime, selectedVisitorDetails.checkOutTime)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Current Approval Information */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3 border-b border-slate-200 pb-2">Approval Details</span>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="font-semibold text-gray-500">Approval Status</span>
                  <span className={`font-bold ${selectedVisitorDetails.approvalStatus === 'APPROVED' ? 'text-green-600' : selectedVisitorDetails.approvalStatus === 'REJECTED' ? 'text-red-600' : 'text-orange-500'}`}>
                    {selectedVisitorDetails.approvalStatus || selectedVisitorDetails.status}
                  </span>
                </div>
                {selectedVisitorDetails.approvedBy && (
                  <>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="font-semibold text-gray-500">Approved By</span>
                      <span className="font-medium">{selectedVisitorDetails.approvedBy?.name || 'System'} ({selectedVisitorDetails.approvedByRole || 'System'})</span>
                    </div>
                    {selectedVisitorDetails.approvedAt && (
                      <div className="flex justify-between border-b border-gray-100 pb-2">
                        <span className="font-semibold text-gray-500">Approved On</span>
                        <span className="font-medium">
                          {formatDisplayDateTime(selectedVisitorDetails.approvedAt)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {selectedVisitorDetails.rejectionReason && (
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="font-semibold text-gray-500">Rejection Reason</span>
                    <span className="font-medium text-red-600 bg-red-50 p-2 rounded-lg">{selectedVisitorDetails.rejectionReason}</span>
                  </div>
                )}
                <div className="pt-2">
                  <button 
                    onClick={() => { setSelectedVisitorHistory(selectedVisitorDetails); setSelectedVisitorDetails(null); }}
                    className="text-indigo-600 text-xs font-bold hover:underline"
                  >
                    View Full Audit Trail &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Checkout / Exit Notes */}
            {(selectedVisitorDetails.remarks || selectedVisitorDetails.exitNotes || selectedVisitorDetails.notes || selectedVisitorDetails.checkoutNotes) && (
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  📝 Visitor Checkout / Exit Notes
                </span>
                <p className="text-sm font-semibold text-amber-950 bg-white p-3 rounded-xl border border-amber-200/60 whitespace-pre-wrap shadow-sm">
                  {selectedVisitorDetails.remarks || selectedVisitorDetails.exitNotes || selectedVisitorDetails.notes || selectedVisitorDetails.checkoutNotes}
                </p>
              </div>
            )}

            {/* QR Code Section */}
            <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-between">
              <div className="bg-white p-2 rounded-xl shadow-md">
                <QRCodeSVG 
                  value={window.location.hostname === 'localhost' ? `http://${import.meta.env.VITE_NETWORK_IP || '192.168.1.10'}:5173/pass/${selectedVisitorDetails.visitId || selectedVisitorDetails.id}` : `${window.location.origin}/pass/${selectedVisitorDetails.visitId || selectedVisitorDetails.id}`} 
                  size={70} 
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-indigo-300 font-bold uppercase tracking-wider block">DIGITAL GATE PASS</span>
                <button 
                  onClick={() => window.open(`/pass/${selectedVisitorDetails.visitId || selectedVisitorDetails.id}`, '_blank')}
                  className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                >
                  Open Digital Pass ↗
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedVisitorDetails(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVisitorHistory && (
        <VisitorHistoryModal
          visitor={selectedVisitorHistory}
          onClose={() => setSelectedVisitorHistory(null)}
        />
      )}

      {reschedulingVisitor && (
        <VisitorRescheduleModal
          visitor={reschedulingVisitor}
          onClose={() => setReschedulingVisitor(null)}
          onSuccess={() => {
            // Re-fetch the page data dynamically by reloading the window or calling a refresh function if available
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default VisitorList;
