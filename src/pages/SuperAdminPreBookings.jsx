import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Search, Filter, CalendarCheck, UserPlus, Eye, Check, X, QrCode, Trash2, MapPin, Calendar, Clock, RefreshCw, User, Building, ShieldAlert, CheckCircle2, XCircle, Download, Edit, Save
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import { io } from "socket.io-client";
import VisitorHistoryModal from '../components/visitors/VisitorHistoryModal';
import VisitorRescheduleModal from '../components/visitors/VisitorRescheduleModal';
import { formatDisplayTime, formatDisplayDateTime, formatDisplayDate } from '../utils/dateUtils';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

export default function SuperAdminPreBookings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasApprovalPermission } = useAuth();
  const [preBookings, setPreBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [selectedVisitorHistory, setSelectedVisitorHistory] = useState(null);
  const [reschedulingVisitor, setReschedulingVisitor] = useState(null);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [approvedQR, setApprovedQR] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [reApprovingId, setReApprovingId] = useState(null);

  // Reports State
  const [activeTab, setActiveTab] = useState("ALL");
  const [reportsData, setReportsData] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
  const [reportDateFilter, setReportDateFilter] = useState("");
  const [reportHrFilter, setReportHrFilter] = useState("ALL");
  const [hrUsers, setHrUsers] = useState([]);
  const formatVisitorId = (rawId, index = 0) => {
    if (!rawId) return `VIS-${1001 + index}`;
    const str = String(rawId).trim();
    if (str.startsWith('VIS-') || str.startsWith('VISIT-') || str.startsWith('VIS')) {
      return str.toUpperCase();
    }
    return `VIS-${str}`;
  };

  const fetchReports = async () => {
    try {
      setReportsLoading(true);
      const response = await fetch(`${API_URL}/api/prebookings/reports`, {
        headers: getHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      const result = await response.json();
      setReportsData(result.data || []);
    } catch (error) {
      console.error("Fetch reports error:", error);
    } finally {
      setReportsLoading(false);
    }
  };

  // Auto-open details modal if query parameter has preBookingId
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paramId = params.get('preBookingId');
    if (paramId && preBookings.length > 0) {
      const match = preBookings.find(p => p._id === paramId || p.id === paramId);
      if (match) {
        setSelectedVisitor(match);
      }
    }
  }, [location.search, preBookings]);

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveActionMenuId(null);
      setIsFilterOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const getHeaders = () => ({
    'X-Company-Id': user?.companyId || 'SYSTEM',
    'X-User-Id': user?.id || user?._id || 'bootstrap',
    'X-User-Role': user?.role || 'User',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const fetchPreBookings = async () => {
    try {
      setLoading(true);
      const isHostRestricted = ['HR', 'Employee'].includes(user?.role);
      const endpoint = isHostRestricted
        ? `${API_URL}/api/prebookings/my`
        : `${API_URL}/api/prebookings`;

      const response = await fetch(endpoint, {
        headers: getHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch pre-bookings");
      const result = await response.json();
      const list = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
      setPreBookings(list);
    } catch (error) {
      console.error("Pre-booking fetch error:", error);
      setPreBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (visitor) => {
    setEditingVisitor(visitor);
    setEditFormData({
      fullName: visitor.fullName || visitor.visitorName || '',
      mobileNumber: visitor.mobileNumber || '',
      email: visitor.email || '',
      visitingCompany: visitor.visitingCompany || visitor.companyName || '',
      hostEmployee: visitor.hostEmployee || visitor.hostName || '',
      visitPurpose: visitor.visitPurpose || visitor.purpose || 'Interview',
      visitDate: visitor.visitDate ? String(visitor.visitDate).split('T')[0] : new Date().toISOString().split('T')[0],
      expectedTime: visitor.expectedTime || visitor.expectedArrivalTime || '10:00 AM',
      branchLocation: visitor.branchLocation || visitor.branch || 'Head Office(KRISHNAGIRI)',
      vehicleNumber: visitor.vehicleNumber || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingVisitor) return;
    try {
      setEditSaving(true);
      const id = editingVisitor._id || editingVisitor.id || editingVisitor.visitorId;
      const response = await fetch(`${API_URL}/api/prebookings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders()
        },
        body: JSON.stringify(editFormData)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to update pre-booking");

      setEditingVisitor(null);
      await fetchPreBookings();
      if (activeTab === 'REPORTS') {
        await fetchReports();
      }
    } catch (err) {
      console.error("Save edit error:", err);
      alert(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    fetchPreBookings();
    
    const fetchHRUsers = async () => {
      try {
        const response = await fetch(`${API_URL}/api/users/hr`);
        const result = await response.json();
        if (response.ok && result.success && result.data) {
          setHrUsers(result.data);
        }
      } catch (err) {
        console.error("Error loading HR users:", err);
      }
    };
    fetchHRUsers();

    const socketUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : (window.location.hostname === 'localhost' ? `http://localhost:5000` : 'https://fic-visitor-1.onrender.com');
    const socket = io(socketUrl);

    socket.on('new_notification', (notification) => {
      if (notification?.type?.startsWith('PREBOOKING')) {
        fetchPreBookings();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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

  const getStatusBadge = (status) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'APPROVED':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200 inline-flex items-center gap-1 whitespace-nowrap">🟢 APPROVED ✓</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200 inline-flex items-center gap-1 whitespace-nowrap">🔴 REJECTED ✕</span>;
      case 'CHECKED_IN':
      case 'CHECKED IN':
      case 'INSIDE':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1 whitespace-nowrap">🔵 CHECKED IN</span>;
      case 'CHECKED_OUT':
      case 'CHECKED OUT':
      case 'EXITED':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1 whitespace-nowrap">🟣 CHECKED OUT</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-200 inline-flex items-center gap-1 whitespace-nowrap">🟠 PENDING</span>;
    }
  };

  const filteredReports = (Array.isArray(reportsData) ? reportsData : []).filter((r) => {
    // Strictly exclude Direct Visits from Pre-Bookings Report
    const host = String(r.hostEmployee || r.hostName || '').toLowerCase();
    const purpose = String(r.visitPurpose || r.purpose || '').toLowerCase();
    const regType = String(r.registrationType || '').toLowerCase();
    const vType = String(r.visitType || r.visitorType || '').toLowerCase();
    const isDirect = host.includes('direct') || 
                     purpose.includes('direct') || 
                     regType.includes('direct') || 
                     vType.includes('direct') || 
                     vType === 'new_visitor' ||
                     r.isDirectVisit || 
                     r.isDirect;
    if (isDirect) {
      return false;
    }

    const q = reportSearchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (r.visitorId && r.visitorId.toLowerCase().includes(q)) ||
      (r.fullName && r.fullName.toLowerCase().includes(q)) ||
      (r.mobileNumber && r.mobileNumber.includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.visitingCompany && r.visitingCompany.toLowerCase().includes(q)) ||
      (r.hostEmployee && r.hostEmployee.toLowerCase().includes(q));

    const itemStatus = (r.status || '').toUpperCase().replace(/\s+/g, '_');
    const targetStatus = reportStatusFilter.toUpperCase().replace(/\s+/g, '_');

    const matchesStatus =
      reportStatusFilter === "ALL" ||
      itemStatus === targetStatus ||
      (targetStatus === 'CHECKED_IN' && (itemStatus === 'INSIDE' || itemStatus === 'CHECKED_IN')) ||
      (targetStatus === 'CHECKED_OUT' && (itemStatus === 'EXITED' || itemStatus === 'CHECKED_OUT'));

    const matchesHR =
      reportHrFilter === "ALL" ||
      (r.assignedHr && (r.assignedHr._id === reportHrFilter || r.assignedHr.id === reportHrFilter));

    const matchesDate =
      !reportDateFilter ||
      (r.visitDate && new Date(r.visitDate).toISOString().split("T")[0] === reportDateFilter);

    return matchesQuery && matchesStatus && matchesHR && matchesDate;
  });

  const exportToExcel = () => {
    if (filteredReports.length === 0) return;
    const headers = [
      "Visitor Number", "Visitor Name", "Email", "Company", 
      "Host Employee", "Assigned HR", "Purpose", "Visit Date", "Visit Time", "Branch", 
      "QR Token", "Status", "Created Date", 
      "Approved Date", "Check-In Time", "Check-Out Time", "Duration", "Exit Notes"
    ];
    const rows = filteredReports.map(r => [
      r.visitorId || '',
      r.fullName || '',
      r.email || '',
      r.visitingCompany || '',
      r.hostEmployee || '',
      r.assignedHr?.name || '',
      r.visitPurpose || '',
      r.visitDate ? formatDisplayDate(r.visitDate) : '',
      r.expectedTime ? formatDisplayTime(r.expectedTime) : '',
      r.branchLocation || '',
      r.qrToken || '',
      r.status || '',
      r.createdAt ? formatDisplayDateTime(r.createdAt) : '',
      r.approvedAt ? formatDisplayDateTime(r.approvedAt) : '',
      r.checkInTime ? formatDisplayTime(r.checkInTime) : '',
      r.checkOutTime ? formatDisplayTime(r.checkOutTime) : '',
      calculateDuration(r.checkInTime, r.checkOutTime),
      r.exitNotes || r.checkOutNotes || r.remarks || r.notes || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PreBooking_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (filteredReports.length === 0) return;
    const printWindow = window.open('', '_blank');
    const headers = ["Visitor No", "Name", "Company", "Host Employee", "Status", "Visit Date", "Check-In", "Check-Out", "Duration", "Checkout Notes"];
    const htmlContent = `
      <html>
        <head>
          <title>Pre-Booking Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #333; font-size: 24px; margin-bottom: 5px; }
            .date { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
            th { background-color: #f4f4f4; color: #333; font-weight: bold; }
            tr:nth-child(even) { background-color: #fafafa; }
          </style>
        </head>
        <body>
          <h1>Pre-Booking Report</h1>
          <div class="date">Generated on: ${formatDisplayDateTime(new Date())}</div>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${filteredReports.map(r => `
                <tr>
                  <td>${r.visitorId || ''}</td>
                  <td>${r.fullName || ''}</td>
                  <td>${r.visitingCompany || ''}</td>
                  <td>${r.hostEmployee || ''} ${r.assignedHr ? `(HR: ${r.assignedHr.name})` : ''}</td>
                  <td>${r.status || ''}</td>
                  <td>${r.visitDate ? formatDisplayDate(r.visitDate) : ''}</td>
                  <td>${r.checkInTime ? formatDisplayTime(r.checkInTime) : '-'}</td>
                  <td>${r.checkOutTime ? formatDisplayTime(r.checkOutTime) : '-'}</td>
                  <td>${calculateDuration(r.checkInTime, r.checkOutTime)}</td>
                  <td>${r.exitNotes || r.checkOutNotes || r.remarks || r.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);

    printWindow.document.close();
  };

  const filteredPreBookings = (Array.isArray(preBookings) ? preBookings : []).filter((item) => {
    // Strict Host Name Match ONLY for HR and Employee roles:
    const isHostRestrictedRole = ['HR', 'Employee'].includes(user?.role);
    if (isHostRestrictedRole) {
      const myName = String(
        user?.name || 
        user?.fullName || 
        user?.username || 
        user?.displayName || 
        ''
      ).toLowerCase().trim();

      if (myName) {
        const hostName = String(item.hostEmployee || item.hostName || item.host || '').toLowerCase().trim();

        // If the visitor's host name is not this HR's name, STRICTLY EXCLUDE IT
        if (!hostName || (!hostName.includes(myName) && !myName.includes(hostName))) {
          return false;
        }
      }
    }

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (item.visitorId && item.visitorId.toLowerCase().includes(q)) ||
      (item.fullName && item.fullName.toLowerCase().includes(q)) ||
      (item.mobileNumber && item.mobileNumber.includes(q)) ||
      (item.visitingCompany && item.visitingCompany.toLowerCase().includes(q)) ||
      (item.hostEmployee && item.hostEmployee.toLowerCase().includes(q));

    const itemStatus = (item.status || "").toUpperCase().replace(/\s+/g, "_");
    const targetStatus = statusFilter.toUpperCase().replace(/\s+/g, "_");

    const matchesStatus =
      statusFilter === "ALL" ||
      itemStatus === targetStatus ||
      (targetStatus === "CHECKED_IN" && (itemStatus === "INSIDE" || itemStatus === "CHECKED_IN")) ||
      (targetStatus === "CHECKED_OUT" && (itemStatus === "EXITED" || itemStatus === "CHECKED_OUT"));

    const matchesDate = !dateFilter || (item.visitDate && item.visitDate.startsWith(dateFilter));

    const host = String(item.hostEmployee || item.hostName || '').toLowerCase();
    const purpose = String(item.visitPurpose || item.purpose || '').toLowerCase();
    const regType = String(item.registrationType || '').toLowerCase();
    const vType = String(item.visitType || item.visitorType || '').toLowerCase();
    const isDirectVisit = host.includes('direct') || 
                          purpose.includes('direct') || 
                          regType.includes('direct') || 
                          vType.includes('direct') || 
                          vType === 'new_visitor' ||
                          item.isDirectVisit || 
                          item.isDirect;

    return matchesQuery && matchesStatus && matchesDate && !isDirectVisit;
  });

  const approveVisitor = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/prebookings/${id}/approve`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...getHeaders()
        }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Approval failed");
      setApprovedQR(result.data);
      setSelectedVisitor(null);
      await fetchPreBookings();
    } catch (error) {
      console.error("Approve error:", error);
      alert(error.message);
    }
  };

  const rejectVisitor = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/prebookings/${id}/reject`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...getHeaders()
        }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Rejection failed");
      setSelectedVisitor(null);
      await fetchPreBookings();
    } catch (error) {
      console.error("Reject error:", error);
      alert(error.message);
    }
  };

  const handleReApprove = async (id) => {
    if (reApprovingId) return;

    const confirmed = window.confirm(
      "Are you sure you want to re-approve this rejected visitor?"
    );

    if (!confirmed) return;

    try {
      setReApprovingId(id);
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${API_URL}/api/prebookings/${id}/reapprove`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...getHeaders()
          }
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to re-approve visitor.");
        return;
      }

      // Optimistically update local state immediately
      setPreBookings((prev) =>
        prev.map((item) =>
          (item._id === id || item.id === id || item.visitorId === id)
            ? { ...item, status: "APPROVED", approvalStatus: "APPROVED" }
            : item
        )
      );

      alert("Visitor re-approved successfully.");

      await fetchPreBookings();
    } catch (error) {
      console.error("Re-Approve Error:", error);
      alert("Something went wrong while re-approving.");
    } finally {
      setReApprovingId(null);
    }
  };

  const deletePreBooking = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete pre-booking for ${name || 'this visitor'}?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/prebookings/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setPreBookings(prev => (Array.isArray(prev) ? prev : []).filter(p => (p._id || p.id) !== id && p.visitorId !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to delete pre-booking.');
      }
    } catch (err) {
      console.error("Delete Error:", err);
      alert("Error deleting pre-booking record.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pre-Bookings Management</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage visitor pre-bookings, approvals, and digital pass verification.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={fetchPreBookings}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center space-x-2 font-medium transition-colors text-sm"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button 
            onClick={() => navigate('/invitations')}
            className="bg-indigo-50 border border-indigo-200 text-[var(--color-brand-indigo)] hover:bg-indigo-100 px-4 py-2.5 rounded-lg flex items-center space-x-2 font-bold transition-colors shadow-sm text-sm"
          >
            <CalendarCheck size={18} />
            <span>+ Pre-Booking</span>
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        {/* Tabs Bar */}
        <div className="border-b border-gray-100 flex flex-wrap px-4 pt-2 bg-slate-50/50">
          {[
            { label: 'All Pre-Bookings', val: 'ALL' },
            { label: 'Pending', val: 'PENDING' },
            { label: 'Approved', val: 'APPROVED' },
            { label: 'Rejected', val: 'REJECTED' },
            { label: 'Checked In', val: 'CHECKED_IN' },
            { label: 'Checked Out', val: 'CHECKED_OUT' },
          ].map((tab) => (
            <button
              key={tab.val}
              onClick={() => {
                if (activeTab === 'REPORTS') {
                  fetchPreBookings();
                }
                setActiveTab(tab.val);
                setStatusFilter(tab.val);
              }}
              className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.val
                  ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)] font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {['Super Admin', 'SaaS Super Admin', 'MD'].includes(user?.role) && (
            <button
              onClick={() => {
                setActiveTab('REPORTS');
                fetchReports();
              }}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'REPORTS'
                  ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>📊 Reports</span>
            </button>
          )}
        </div>

        {(activeTab === 'REPORTS' && ['Super Admin', 'SaaS Super Admin', 'MD'].includes(user?.role)) ? (

          // REPORTS VIEW
          <div className="p-4 space-y-6">
             {/* Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { title: 'Total Visitors', count: filteredReports.length, color: 'bg-slate-50 text-slate-800 border-slate-200' },
                { title: 'Pending', count: filteredReports.filter(r => r.status === 'PENDING').length, color: 'bg-orange-50 text-orange-800 border-orange-200' },
                { title: 'Approved', count: filteredReports.filter(r => r.status === 'APPROVED').length, color: 'bg-green-50 text-green-800 border-green-200' },
                { title: 'Rejected', count: filteredReports.filter(r => r.status === 'REJECTED').length, color: 'bg-red-50 text-red-800 border-red-200' },
                { title: 'Checked In', count: filteredReports.filter(r => r.status === 'CHECKED_IN').length, color: 'bg-blue-50 text-blue-800 border-blue-200' },
                { title: 'Checked Out', count: filteredReports.filter(r => r.status === 'CHECKED_OUT').length, color: 'bg-purple-50 text-purple-800 border-purple-200' },
              ].map((stat, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${stat.color} flex flex-col`}>
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

                <select
                  value={reportHrFilter}
                  onChange={(e) => setReportHrFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] bg-white cursor-pointer"
                >
                  <option value="ALL">All HR</option>
                  {hrUsers.map((hr) => (
                    <option key={hr._id || hr.id} value={hr._id || hr.id}>
                      {hr.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                    </option>
                  ))}
                </select>

                <input 
                  type="date" 
                  value={reportDateFilter}
                  onChange={(e) => setReportDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)]"
                />

                <button
                  onClick={() => {
                    setReportSearchQuery("");
                    setReportStatusFilter("ALL");
                    setReportHrFilter("ALL");
                    setReportDateFilter("");
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors border border-gray-200"
                >
                  Clear Filters
                </button>

                <button
                  onClick={exportToExcel}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs transition-colors shadow-sm"
                >
                  <span>📊 Export Excel</span>
                </button>
                <button
                  onClick={exportToPDF}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs transition-colors shadow-sm"
                >
                  <span>📄 Export PDF</span>
                </button>
              </div>
            </div>

            {/* Reports Table */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[1500px]">
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
                    <th className="px-4 py-3 font-semibold">Branch</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Approved Date</th>
                    <th className="px-4 py-3 font-semibold">Check-In Time</th>
                    <th className="px-4 py-3 font-semibold">Check-Out Time</th>
                    <th className="px-4 py-3 font-semibold">Duration</th>
                    <th className="px-4 py-3 font-semibold">Checkout Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm whitespace-nowrap">
                  {reportsLoading ? (
                    <tr>
                      <td colSpan="14" className="px-6 py-12 text-center text-gray-500">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading reports...
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="14" className="px-6 py-12 text-center text-gray-500 font-medium">
                        No report records found.
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((r, index) => (
                      <tr 
                        key={index} 
                        onClick={() => setSelectedVisitor(r)}
                        className="hover:bg-indigo-50/20 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 text-xs shadow-xs">
                            {formatVisitorId(r.visitorId, index)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.facePhoto ? (
                            <img src={r.facePhoto} alt="Visitor" className="w-10 h-10 object-cover rounded-lg border border-gray-100" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">No img</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{r.fullName}</td>
                        <td className="px-4 py-3 text-gray-600">{r.visitingCompany || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{r.hostEmployee || 'N/A'}</div>
                          {r.assignedHr?.name && <div className="text-xs text-indigo-600 mt-0.5">HR: {r.assignedHr.name}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{r.visitPurpose}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {r.visitDate ? formatDisplayDate(r.visitDate) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-medium">{formatDisplayTime(r.expectedTime)}</td>
                        <td className="px-4 py-3 text-gray-600">{r.branchLocation}</td>
                        <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {r.approvedAt ? formatDisplayDateTime(r.approvedAt) : 'N/A'}
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
                          {(r.exitNotes || r.checkOutNotes || r.remarks || r.notes) ? (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-xs leading-relaxed whitespace-normal break-words shadow-2xs">
                              <span className="font-medium text-slate-800">{r.exitNotes || r.checkOutNotes || r.remarks || r.notes}</span>
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
          // STANDARD PRE-BOOKING VIEW
          <>
            {/* Search & Filter Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search visitor number, name, mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Date Filter */}
            <div className="flex items-center gap-1">
              <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)]"
              />
              {dateFilter && (
                <button 
                  onClick={() => setDateFilter('')}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  title="Clear Date Filter"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Status Filter Dropdown */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center space-x-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${isFilterOpen || statusFilter !== 'ALL' ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)] bg-indigo-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <Filter size={18} />
                <span>{statusFilter !== 'ALL' ? statusFilter : 'Filters'}</span>
              </button>
              
              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                  <div className="p-2 space-y-1">
                    {[
                      { label: 'All Statuses', val: 'ALL' },
                      { label: 'Pending', val: 'PENDING' },
                      { label: 'Approved', val: 'APPROVED' },
                      { label: 'Rejected', val: 'REJECTED' },
                      { label: 'Checked In', val: 'CHECKED_IN' },
                      { label: 'Checked Out', val: 'CHECKED_OUT' },
                    ].map((st) => (
                      <button
                        key={st.val}
                        onClick={() => {
                          setStatusFilter(st.val);
                          setIsFilterOpen(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${statusFilter === st.val ? 'bg-indigo-50 text-[var(--color-brand-indigo)] font-semibold' : 'text-gray-700 hover:bg-slate-50'}`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px] w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Visitor</th>
                <th className="px-6 py-4 font-semibold">Company</th>
                <th className="px-6 py-4 font-semibold">Host</th>
                <th className="px-6 py-4 font-semibold">Date & Time</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-medium">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading Pre-Bookings...
                  </td>
                </tr>
              ) : filteredPreBookings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-medium">
                    No pre-bookings found matching your search.
                  </td>
                </tr>
              ) : (
                filteredPreBookings.map((visitor, index) => {
                  const id = visitor._id || visitor.id;
                  return (
                    <tr key={id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Visitor Details */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {visitor.facePhoto ? (
                            <img
                              src={visitor.facePhoto}
                              alt={visitor.fullName}
                              className="w-10 h-10 rounded-full object-cover border border-gray-200 mr-3 shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-[var(--color-brand-indigo)] flex items-center justify-center font-bold mr-3">
                              {(visitor.fullName || 'V').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 text-sm">{visitor.fullName || 'Unknown'}</p>
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                                {formatVisitorId(visitor.visitorId || visitor.visitId || visitor.id, index)}
                              </span>
                            </div>
                            <div className="flex flex-col items-start mt-0.5 gap-0.5">
                              <span className="text-xs text-gray-500 font-medium">{visitor.mobileNumber}</span>
                              <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                <MapPin size={10} className="text-gray-400" />
                                {visitor.branchLocation || 'Head Office'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {visitor.visitingCompany || 'Forge India Connect Private Limited'}
                      </td>

                      {/* Host */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {visitor.hostEmployee || '-'}
                      </td>

                      {/* Visit Date & Time */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {visitor.visitDate ? new Date(visitor.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">{visitor.expectedTime || '10:00 AM'}</div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(visitor.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          {(visitor.status?.toUpperCase() === 'PENDING' || visitor.status?.toUpperCase() === 'PENDING APPROVAL') && hasApprovalPermission && (
                            <div className="flex gap-2 mr-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  approveVisitor(id);
                                }}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 hover:border-emerald-500 rounded-md text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  rejectVisitor(id);
                                }}
                                className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 hover:border-red-500 rounded-md text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId(activeActionMenuId === id ? null : id);
                            }}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors text-sm flex-shrink-0"
                            title="Actions Menu"
                          >
                            ⋮
                          </button>

                          {activeActionMenuId === id && (
                            <div className="absolute right-6 top-12 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 min-w-[170px] py-1.5 overflow-hidden text-left animate-in fade-in duration-200">
                              <button
                                onClick={() => {
                                  setSelectedVisitor(visitor);
                                  setActiveActionMenuId(null);
                                }}
                                className="w-full px-4 py-2.5 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors"
                              >
                                <Eye size={14} className="text-slate-500" /> View Details
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  startEditing(visitor);
                                  setActiveActionMenuId(null);
                                }}
                                className="w-full px-4 py-2.5 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-2 transition-colors border-t border-gray-100"
                              >
                                <Edit size={14} className="text-indigo-600" /> Edit Details
                              </button>

                              {(user?.role === "Super Admin" || user?.role === "SaaS Super Admin") &&
                                (visitor.status === "REJECTED" || visitor.status === "Rejected") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      handleReApprove(visitor._id || id);
                                    }}
                                    disabled={reApprovingId === (visitor._id || id)}
                                    className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                  >
                                    {reApprovingId === (visitor._id || id)
                                      ? "Re-Approving..."
                                      : "Re-Approve"}
                                  </button>
                                )}

                              {hasApprovalPermission && visitor.status !== "CHECKED_IN" && visitor.status !== "CHECKED_OUT" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReschedulingVisitor(visitor);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full px-4 py-2.5 hover:bg-slate-50 text-blue-600 text-xs font-semibold flex items-center gap-2 transition-colors border-t border-gray-100"
                                >
                                  <Clock size={14} className="text-blue-500" /> Reschedule Appointment
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  window.open(`/pass/${visitor.visitorId || id}`, '_blank');
                                  setActiveActionMenuId(null);
                                }}
                                className="w-full px-4 py-2.5 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-2 transition-colors border-t border-gray-100"
                              >
                                <QrCode size={14} className="text-indigo-600" /> View QR Pass
                              </button>

                              {visitor.mobileNumber && (
                                <>
                                  <button
                                    onClick={() => {
                                      navigate(`/visitors/returning?mobile=${encodeURIComponent(visitor.mobileNumber)}`);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-4 py-2.5 hover:bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2 transition-colors border-t border-gray-100"
                                  >
                                    <UserPlus size={14} className="text-emerald-600" /> Direct Visit (Register Again)
                                  </button>

                                  <button
                                    onClick={() => {
                                      window.open(`/prebook?mobile=${encodeURIComponent(visitor.mobileNumber)}`, '_blank');
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-4 py-2.5 hover:bg-indigo-50 text-[var(--color-brand-indigo)] text-xs font-bold flex items-center gap-2 transition-colors border-t border-gray-100"
                                  >
                                    <CalendarCheck size={14} className="text-[var(--color-brand-indigo)]" /> Pre-Booking (Register Again)
                                  </button>
                                </>
                              )}

                              <div className="border-t border-gray-100 my-1" />

                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  deletePreBooking(id, visitor.fullName);
                                }}
                                className="w-full px-4 py-2.5 hover:bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-2 transition-colors"
                              >
                                <Trash2 size={14} className="text-red-500" /> Delete Record
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>

      {/* Approved QR Popup Banner */}
      {approvedQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Pre-Booking Approved!</h2>
            <p className="text-sm text-slate-500">
              Visitor Number: <strong className="text-indigo-600 font-mono text-base">{approvedQR.visitorId}</strong>
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block my-2">
              <QRCodeSVG value={`${window.location.origin}/pass/${approvedQR.qrToken || approvedQR.visitorId}`} size={180} level="H" className="mx-auto" />
            </div>

            <p className="text-xs text-slate-500">QR code token activated. Security can now verify and check in this visitor.</p>

            <button
              onClick={() => setApprovedQR(null)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md text-sm"
            >
              Close Window
            </button>
          </div>
        </div>
      )}

      {/* Visitor Details Modal */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            <div className="p-5 sm:p-6 bg-gradient-to-r from-[#003A70] via-[#004B93] to-[#005EB8] text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl text-white border border-white/20">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Pre-Booking Details</h3>
                  <p className="text-xs text-blue-100/80 font-mono">Visitor Number: {selectedVisitor.visitorId || 'PENDING'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVisitor(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-100">
                {selectedVisitor.facePhoto ? (
                  <img
                    src={selectedVisitor.facePhoto}
                    alt={selectedVisitor.fullName}
                    className="w-32 h-32 rounded-2xl object-cover border-4 border-slate-100 shadow-md shrink-0"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-indigo-50 text-[var(--color-brand-indigo)] flex items-center justify-center font-bold text-3xl shrink-0">
                    {(selectedVisitor.fullName || 'V').charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="space-y-2 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                    <h4 className="text-xl font-bold text-gray-900">{selectedVisitor.fullName}</h4>
                    <span className="font-mono font-bold text-indigo-700 text-xs bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                      {formatVisitorId(selectedVisitor.visitorId || selectedVisitor.visitId || selectedVisitor._id)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">📞 {selectedVisitor.mobileNumber}</p>
                  <p className="text-sm text-gray-500 font-medium">✉️ {selectedVisitor.email || '-'}</p>
                  <div>{getStatusBadge(selectedVisitor.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase block">Company</span>
                  <span className="font-semibold text-gray-800">{selectedVisitor.visitingCompany || 'Forge India Connect'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase block">Host Employee</span>
                  <span className="font-semibold text-gray-800">{selectedVisitor.hostEmployee || '-'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase block">Visit Purpose</span>
                  <span className="font-semibold text-gray-800">{selectedVisitor.visitPurpose || '-'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase block">Branch Location</span>
                  <span className="font-semibold text-gray-800">{selectedVisitor.branchLocation || 'Head Office'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase block">Visit Date</span>
                  <span className="font-semibold text-gray-800">{selectedVisitor.visitDate ? formatDisplayDate(selectedVisitor.visitDate) : '-'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase block">Expected Time</span>
                  <span className="font-semibold text-gray-800">{formatDisplayTime(selectedVisitor.expectedTime)}</span>
                </div>
              </div>

              {/* Check-In & Check-Out Times */}
              {(selectedVisitor.checkInTime || selectedVisitor.checkOutTime) && (
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-emerald-700 font-bold uppercase text-[10px] block">Check-In Time</span>
                    <span className="font-mono font-bold text-emerald-950 text-sm">
                      {formatDisplayTime(selectedVisitor.checkInTime)}
                    </span>
                    {selectedVisitor.checkInBy && (
                      <span className="text-[10px] text-gray-400 block mt-0.5">By: {selectedVisitor.checkInBy}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-purple-700 font-bold uppercase text-[10px] block">Check-Out Time</span>
                    <span className="font-mono font-bold text-purple-950 text-sm">
                      {formatDisplayTime(selectedVisitor.checkOutTime)}
                    </span>
                    {selectedVisitor.checkOutBy && (
                      <span className="text-[10px] text-gray-400 block mt-0.5">By: {selectedVisitor.checkOutBy}</span>
                    )}
                  </div>
                  {selectedVisitor.checkInTime && selectedVisitor.checkOutTime && (
                    <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Total Duration:</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{calculateDuration(selectedVisitor.checkInTime, selectedVisitor.checkOutTime)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Checkout / Exit Notes */}
              {(selectedVisitor.exitNotes || selectedVisitor.checkOutNotes || selectedVisitor.remarks || selectedVisitor.notes) && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                    📝 Visitor Checkout Notes
                  </span>
                  <p className="text-sm font-medium text-amber-950 bg-white p-3 rounded-xl border border-amber-200/60 whitespace-pre-wrap shadow-2xs">
                    {selectedVisitor.exitNotes || selectedVisitor.checkOutNotes || selectedVisitor.remarks || selectedVisitor.notes}
                  </p>
                </div>
              )}

              {selectedVisitor.idType && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span>Verification Document</span>
                    <span className="text-[var(--color-brand-indigo)] font-bold">{selectedVisitor.idType}</span>
                  </div>
                  {selectedVisitor.idProofUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 aspect-[1.6/1] bg-slate-900 group">
                      <img
                        src={selectedVisitor.idProofUrl}
                        alt="ID Proof Document"
                        className="w-full h-full object-contain"
                      />
                      <a
                        href={selectedVisitor.idProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/45 text-white font-semibold text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                      >
                        View Full Screen
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 font-bold bg-amber-50 p-2 rounded-lg border border-amber-100 text-center">
                      No document image uploaded.
                    </p>
                  )}
                </div>
              )}

              {/* Approval Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3 border-b border-slate-200 pb-2">Approval Details</span>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="font-semibold text-gray-500">Approval Status</span>
                    <span className={`font-bold ${selectedVisitor.approvalStatus === 'APPROVED' ? 'text-green-600' : selectedVisitor.approvalStatus === 'REJECTED' ? 'text-red-600' : 'text-orange-500'}`}>
                      {selectedVisitor.approvalStatus || selectedVisitor.status}
                    </span>
                  </div>
                  {selectedVisitor.approvedBy && (
                    <>
                      <div className="flex justify-between border-b border-gray-100 pb-2">
                        <span className="font-semibold text-gray-500">Approved By</span>
                        <span className="font-medium">{selectedVisitor.approvedBy?.name || 'System'} ({selectedVisitor.approvedByRole || 'System'})</span>
                      </div>
                      {selectedVisitor.approvedAt && (
                        <div className="flex justify-between border-b border-gray-100 pb-2">
                          <span className="font-semibold text-gray-500">Approved On</span>
                          <span className="font-medium">
                            {formatDisplayDateTime(selectedVisitor.approvedAt)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {selectedVisitor.rejectionReason && (
                    <div className="flex flex-col gap-1 pt-1">
                      <span className="font-semibold text-gray-500">Rejection Reason</span>
                      <span className="font-medium text-red-600 bg-red-50 p-2 rounded-lg">{selectedVisitor.rejectionReason}</span>
                    </div>
                  )}
                  <div className="pt-2">
                    <button 
                      onClick={() => { setSelectedVisitorHistory(selectedVisitor); setSelectedVisitor(null); }}
                      className="text-indigo-600 text-xs font-bold hover:underline"
                    >
                      View Full Audit Trail &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {selectedVisitor.status === 'PENDING' && hasApprovalPermission && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => approveVisitor(selectedVisitor._id || selectedVisitor.id)}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 text-sm"
                  >
                    <Check size={18} />
                    <span>Approve Pre-Booking</span>
                  </button>

                  <button
                    onClick={() => rejectVisitor(selectedVisitor._id || selectedVisitor.id)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 text-sm"
                  >
                    <X size={18} />
                    <span>Reject Pre-Booking</span>
                  </button>
                </div>
              )}

              {['REJECTED', 'Rejected'].includes(selectedVisitor.status) && (user?.role === 'Super Admin' || user?.role === 'SaaS Super Admin') && (
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={Boolean(reApprovingId)}
                    onClick={() => {
                      const id = selectedVisitor._id || selectedVisitor.id;
                      setSelectedVisitor(null);
                      handleReApprove(id);
                    }}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 text-sm"
                  >
                    {reApprovingId ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Re-Approving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        <span>Re-Approve Pre-Booking</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {selectedVisitor.visitType !== 'DIRECT_VISIT' && hasApprovalPermission && (
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => { 
                      const v = selectedVisitor;
                      setSelectedVisitor(null);
                      startEditing(v);
                    }}
                    className="flex-1 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-[var(--color-brand-indigo)] font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-indigo-200 text-sm"
                  >
                    <Edit size={16} /> Edit Details
                  </button>

                  <button
                    onClick={() => { setReschedulingVisitor(selectedVisitor); setSelectedVisitor(null); }}
                    className="flex-1 px-4 py-2.5 border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                  >
                    <Clock size={16} /> Reschedule
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Pre-Booking Modal */}
      {editingVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl text-white border border-white/20">
                  <Edit size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Edit Pre-Booking Details</h3>
                  <p className="text-xs text-indigo-200 font-mono">Visitor Number: {editingVisitor.visitorId || 'VISITOR'}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingVisitor(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.fullName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={editFormData.mobileNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, mobileNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Visiting Company</label>
                  <input
                    type="text"
                    value={editFormData.visitingCompany || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, visitingCompany: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Host Employee *</label>
                  <select
                    required
                    value={editFormData.hostEmployee || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, hostEmployee: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select Host Employee</option>
                    <option value="PRIYADHARSHINI(HR)">PRIYADHARSHINI(HR)</option>
                    <option value="GANESH KUMAR(HR)">GANESH KUMAR(HR)</option>
                    <option value="SANDEEP(CEO SIR)">SANDEEP(CEO SIR)</option>
                    <option value="AVINASH(MD SIR)">AVINASH(MD SIR)</option>
                    <option value="SABARI(ADMIN)">SABARI(ADMIN)</option>
                    <option value="AGILA(IT)">AGILA(IT)</option>
                    {hrUsers && hrUsers.map((hr, idx) => (
                      <option key={idx} value={hr.name}>{hr.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Purpose of Visit *</label>
                  <select
                    required
                    value={editFormData.visitPurpose || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, visitPurpose: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select Purpose</option>
                    <option value="Interview">Interview</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Follow up">Follow up</option>
                    <option value="Job consulting">Job consulting</option>
                    <option value="Banking">Banking</option>
                    <option value="CEO meeting">CEO meeting</option>
                    <option value="Client Visit">Client Visit</option>
                    <option value="Vendor Visit">Vendor Visit</option>
                    <option value="Guest">Guest</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Branch Location</label>
                  <select
                    value={editFormData.branchLocation || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, branchLocation: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="Head Office(KRISHNAGIRI)">Head Office(KRISHNAGIRI)</option>
                    <option value="Thirupattur Branch">Thirupattur Branch</option>
                    <option value="Salem Branch">Salem Branch</option>
                    <option value="Bangalore Branch">Bangalore Branch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Visit Date *</label>
                  <input
                    type="date"
                    required
                    value={editFormData.visitDate || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, visitDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Expected Time</label>
                  <select
                    value={editFormData.expectedTime || '10:00 AM'}
                    onChange={(e) => setEditFormData({ ...editFormData, expectedTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  >
                    {['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '01:00 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM'].map((t, idx) => (
                      <option key={idx} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Vehicle Number</label>
                  <input
                    type="text"
                    placeholder="e.g. TN-24-AB-1234"
                    value={editFormData.vehicleNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, vehicleNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingVisitor(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors shadow-md flex items-center gap-2"
                >
                  <Save size={16} />
                  <span>{editSaving ? 'Saving Changes...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
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
}
