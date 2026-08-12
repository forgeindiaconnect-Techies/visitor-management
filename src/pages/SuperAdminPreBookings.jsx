import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Search, Filter, CalendarCheck, UserPlus, Eye, Check, X, QrCode, Trash2, MapPin, Calendar, Clock, RefreshCw, User, Building, ShieldAlert, CheckCircle2, XCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

export default function SuperAdminPreBookings() {
  const navigate = useNavigate();
  const [preBookings, setPreBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [approvedQR, setApprovedQR] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveActionMenuId(null);
      setIsFilterOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchPreBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/prebookings`);
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

  useEffect(() => {
    fetchPreBookings();
  }, []);

  const getStatusBadge = (status) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'APPROVED':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200 inline-flex items-center gap-1">🟢 APPROVED ✓</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200 inline-flex items-center gap-1">🔴 REJECTED ✕</span>;
      case 'CHECKED_IN':
      case 'CHECKED IN':
      case 'INSIDE':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">🔵 CHECKED IN</span>;
      case 'CHECKED_OUT':
      case 'CHECKED OUT':
      case 'EXITED':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">🟣 CHECKED OUT</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-200 inline-flex items-center gap-1">🟠 PENDING</span>;
    }
  };

  const filteredPreBookings = preBookings.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (item.visitorId && item.visitorId.toLowerCase().includes(q)) ||
      (item.fullName && item.fullName.toLowerCase().includes(q)) ||
      (item.mobileNumber && item.mobileNumber.includes(q)) ||
      (item.visitingCompany && item.visitingCompany.toLowerCase().includes(q)) ||
      (item.hostEmployee && item.hostEmployee.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "ALL" ||
      item.status?.toUpperCase() === statusFilter.toUpperCase();

    const matchesDate = !dateFilter || (item.visitDate && item.visitDate.startsWith(dateFilter));

    return matchesQuery && matchesStatus && matchesDate;
  });

  const approveVisitor = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/prebookings/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
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
        headers: { "Content-Type": "application/json" }
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

  const deletePreBooking = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete pre-booking for ${name}?`)) return;
    try {
      await fetch(`${API_URL}/api/prebookings/${id}`, { method: 'DELETE' });
      setPreBookings(prev => prev.filter(p => (p._id || p.id) !== id));
    } catch (err) {
      console.error("Delete Error:", err);
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
                filteredPreBookings.map((visitor) => {
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
                                {visitor.visitorId || 'PRE-BOOKED'}
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
                          <button
                            onClick={() => setActiveActionMenuId(activeActionMenuId === id ? null : id)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors text-sm"
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

                              {visitor.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => {
                                      approveVisitor(id);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-4 py-2.5 hover:bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2 transition-colors"
                                  >
                                    <Check size={14} className="text-emerald-600" /> Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      rejectVisitor(id);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-4 py-2.5 hover:bg-red-50 text-red-600 text-xs font-bold flex items-center gap-2 transition-colors"
                                  >
                                    <X size={14} className="text-red-500" /> Reject
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => {
                                  window.open(`/pass/${visitor.visitorId || id}`, '_blank');
                                  setActiveActionMenuId(null);
                                }}
                                className="w-full px-4 py-2.5 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-2 transition-colors"
                              >
                                <QrCode size={14} className="text-indigo-600" /> View QR Pass
                              </button>

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
              <QRCodeSVG value={approvedQR.qrToken || approvedQR.visitorId} size={180} level="H" className="mx-auto" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden my-8">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Pre-Booking Details</h3>
                  <p className="text-xs text-slate-400 font-mono">Visitor Number: {selectedVisitor.visitorId || 'PENDING'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVisitor(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
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
                  <h4 className="text-xl font-bold text-gray-900">{selectedVisitor.fullName}</h4>
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
                  <span className="font-semibold text-gray-800">{selectedVisitor.visitDate ? new Date(selectedVisitor.visitDate).toLocaleDateString() : '-'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-xs text-gray-400 font-semibold uppercase block">Expected Time</span>
                  <span className="font-semibold text-gray-800">{selectedVisitor.expectedTime || '10:00 AM'}</span>
                </div>
              </div>

              {selectedVisitor.status === 'PENDING' && (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
