import React, { useState, useRef } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { Search, QrCode, LogIn, LogOut, User, Camera, ShieldCheck, Clock, Building, Calendar, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import Webcam from 'react-webcam';

const SecurityCheckIn = () => {
  const { updateVisitorStatus, updateVisitor, networkIp } = useVisitors();
  const { addNotification } = useNotification();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [visitor, setVisitor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const webcamRef = useRef(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearched(true);
    setVisitor(null);
    setCapturedPhotoUrl('');

    const cleanQuery = searchQuery.trim();

    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp || '192.168.1.10'}:5000` : 'https://fic-visitor-1.onrender.com');

      let response = await fetch(`${API_URL}/api/prebookings/visitor/${encodeURIComponent(cleanQuery)}`, {
        headers: {
          'x-company-id': user?.companyId || 'FIC001',
          'Authorization': user?.token ? `Bearer ${user.token}` : ''
        }
      });

      if (!response.ok) {
        response = await fetch(`${API_URL}/api/visitors/search/${encodeURIComponent(cleanQuery)}`, {
          headers: {
            'x-company-id': user?.companyId || 'FIC001',
            'Authorization': user?.token ? `Bearer ${user.token}` : ''
          }
        });
      }

      if (!response.ok) {
        response = await fetch(`${API_URL}/api/pass-lookup/${encodeURIComponent(cleanQuery)}`);
      }

      if (response.ok) {
        const json = await response.json();
        const raw = json.data || json;
        const normalized = {
          id: raw._id || raw.id,
          _id: raw._id || raw.id,
          visitorId: raw.visitorId || raw.visitId || raw.bookingId || raw._id,
          bookingId: raw.visitorId || raw.visitId || raw.bookingId || raw._id,
          visitorName: raw.fullName || raw.visitorName || 'Visitor',
          fullName: raw.fullName || raw.visitorName || 'Visitor',
          mobileNumber: raw.mobileNumber || '-',
          email: raw.email || '-',
          companyName: raw.visitingCompany || raw.companyName || 'Forge India Connect Private Limited',
          visitingCompany: raw.visitingCompany || raw.companyName || 'Forge India Connect Private Limited',
          hostName: raw.hostEmployee || raw.hostName || 'Staff',
          hostEmployee: raw.hostEmployee || raw.hostName || 'Staff',
          purpose: raw.visitPurpose || raw.purpose || 'Official Visit',
          visitPurpose: raw.visitPurpose || raw.purpose || 'Official Visit',
          visitDate: raw.visitDate || new Date().toISOString().split('T')[0],
          expectedTime: raw.expectedTime || raw.expectedArrivalTime || '10:00 AM',
          expectedArrivalTime: raw.expectedTime || raw.expectedArrivalTime || '10:00 AM',
          branch: raw.branchLocation || raw.branch || 'Head Office',
          branchLocation: raw.branchLocation || raw.branch || 'Head Office',
          vehicleNumber: raw.vehicleNumber || '-',
          photoUrl: raw.facePhoto || raw.photoUrl || '',
          facePhoto: raw.facePhoto || raw.photoUrl || '',
          status: raw.status || 'PENDING',
          entryTime: raw.entryTime || null,
          exitTime: raw.exitTime || null,
          exitNotes: raw.exitNotes || ''
        };
        setVisitor(normalized);
      } else {
        setVisitor(null);
      }
    } catch (err) {
      console.error('Search error:', err);
      addNotification('Search Error', 'Failed to search visitor details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const uploadCapturedPhoto = async (imageSrc) => {
    setUploadingPhoto(true);
    try {
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const file = new File([blob], "security_capture.jpg", { type: "image/jpeg" });
      const data = new FormData();
      data.append('photo', file);

      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp}:5000` : 'https://fic-visitor-1.onrender.com');
      const response = await fetch(`${API_URL}/api/visitors/upload`, {
        method: 'POST',
        body: data,
      });

      if (response.ok) {
        const result = await response.json();
        setCapturedPhotoUrl(result.url);
        addNotification('Photo Captured', 'Visitor photo updated.', 'success');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleWebcamSnap = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setShowWebcam(false);
      uploadCapturedPhoto(imageSrc);
    }
  };

  // Exit Notes Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [exitNotes, setExitNotes] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const handleCheckIn = async () => {
    if (!visitor) return;

    // STRICT APPROVAL VALIDATION
    const isApproved = visitor.status === 'APPROVED' || visitor.status === 'Approved' || visitor.status === 'Pre-Booked';
    if (!isApproved && visitor.status !== 'CHECKED_IN' && visitor.status !== 'Checked In') {
      alert(`❌ Check-In Blocked: Visitor cannot check in. Current status: ${visitor.status}`);
      addNotification('Check-In Denied', `Visitor status is ${visitor.status}. Super Admin must approve first.`, 'error');
      return;
    }

    const targetId = visitor.visitorId || visitor.visitId || visitor._id || visitor.id;

    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp || '192.168.1.10'}:5000` : 'https://fic-visitor-1.onrender.com');
      const response = await fetch(`${API_URL}/api/prebookings/visitor/${encodeURIComponent(targetId)}/check-in`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.token ? `Bearer ${user.token}` : ''
        }
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        const updated = resData.data || resData;
        setVisitor(prev => ({
          ...prev,
          status: 'CHECKED_IN',
          checkInTime: updated.checkInTime || new Date(),
          checkInBy: updated.checkInBy || user?.name || user?.fullName || 'Security',
          entryTime: updated.entryTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        }));
        alert('✅ Visitor checked in successfully!');
        addNotification('Visitor Checked In', `${visitor.fullName || visitor.visitorName} checked in successfully!`, 'success');
      } else {
        alert(`❌ Check-In Failed: ${resData.message || 'Validation error'}`);
      }
    } catch (e) {
      console.error('Backend Check-In Error:', e);
      alert('Failed to connect to backend server for Check-In.');
    }
  };

  const handleOpenCheckoutModal = () => {
    setExitNotes('');
    setCheckoutError('');
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckOut = async (e) => {
    e.preventDefault();
    setCheckoutError('');

    const notes = exitNotes ? exitNotes.trim() : '';
    if (!notes) {
      setCheckoutError('Exit notes are mandatory before checking out. Please enter your exit notes.');
      return;
    }

    if (!visitor) return;
    const targetId = visitor.visitorId || visitor.visitId || visitor._id || visitor.id;

    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp || '192.168.1.10'}:5000` : 'https://fic-visitor-1.onrender.com');
      const response = await fetch(`${API_URL}/api/prebookings/visitor/${encodeURIComponent(targetId)}/check-out`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.token ? `Bearer ${user.token}` : ''
        },
        body: JSON.stringify({ checkOutNotes: notes, exitNotes: notes })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        const updated = resData.data || resData;
        setVisitor(prev => ({
          ...prev,
          status: 'CHECKED_OUT',
          checkOutTime: updated.checkOutTime || new Date(),
          checkOutBy: updated.checkOutBy || user?.name || user?.fullName || 'Security',
          checkOutNotes: notes,
          exitNotes: notes,
          exitTime: updated.exitTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        }));
        setShowCheckoutModal(false);
        alert('✅ Visitor checked out successfully!');
        addNotification('Visitor Checked Out', `${visitor.fullName || visitor.visitorName} checked out with exit notes recorded!`, 'success');
      } else {
        setCheckoutError(resData.message || 'Check-out failed.');
      }
    } catch (err) {
      console.error('Check-Out Error:', err);
      setCheckoutError('Failed to connect to backend server for Check-Out.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
      case 'Pending':
      case 'Pending Approval':
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-300">⚠️ Waiting for approval</span>;
      case 'REJECTED':
      case 'Rejected':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-300">❌ Visitor rejected</span>;
      case 'APPROVED':
      case 'Approved':
      case 'Pre-Booked':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300">✅ Approved</span>;
      case 'Checked In':
      case 'Inside':
      case 'CHECKED_IN':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">🟢 Checked In</span>;
      case 'Checked Out':
      case 'Exited':
      case 'CHECKED_OUT':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold border border-gray-200">🚪 Checked Out</span>;
      case 'Cancelled':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">❌ Cancelled</span>;
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-[var(--color-brand-indigo)]" size={28} />
            Security Pre-Booking Search & Desk Check-In
          </h1>
          <p className="text-gray-500 mt-1">Search visitor by Generated Number (VIS-20260812-XXX) or Mobile, verify details, and check in.</p>
        </div>
      </div>

      {/* Search Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <label className="block text-sm font-bold text-gray-700">
            PRE-BOOKING SEARCH
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Visitor Number (e.g. VIS-20260812-001) or Mobile Number..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none text-sm font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 shrink-0"
            >
              {loading ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <Search size={18} />
              )}
              <span>SEARCH</span>
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Tip: You can also paste or scan QR payload directly in the search box.
          </p>
        </form>
      </div>

      {/* Search Results / Visitor Pass Card */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
          <RefreshCw className="animate-spin mx-auto mb-2 text-[var(--color-brand-indigo)]" size={28} />
          Searching visitor record...
        </div>
      )}

      {!loading && searched && !visitor && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center animate-in zoom-in-95">
          <AlertCircle className="mx-auto text-red-500 mb-2" size={36} />
          <h3 className="text-lg font-bold text-gray-900">Visitor Not Found</h3>
          <p className="text-sm text-gray-500 mt-1">No visitor record found for "{searchQuery}". Please verify the Visitor Number or Mobile Number.</p>
        </div>
      )}

      {!loading && visitor && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Card Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white font-mono text-xs font-bold tracking-wider">
                {visitor.visitorId || visitor.visitId}
              </div>
              <div>
                <h3 className="text-lg font-bold">VISITOR PASS</h3>
                <p className="text-xs text-slate-300">{visitor.visitingCompany || visitor.companyName || 'Forge India Connect Private Limited'}</p>
              </div>
            </div>
            <div>
              {getStatusBadge(visitor.status)}
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Grid details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Photo Column */}
              <div className="flex flex-col items-center justify-center p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-md bg-indigo-100 flex items-center justify-center mb-3">
                  {capturedPhotoUrl || visitor.facePhoto || visitor.photoUrl ? (
                    <img src={capturedPhotoUrl || visitor.facePhoto || visitor.photoUrl} alt={visitor.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={72} className="text-indigo-400" />
                  )}
                </div>

                <p className="text-xs font-semibold text-gray-500 mb-3">Visitor Face Photo</p>
                <button
                  type="button"
                  onClick={() => setShowWebcam(true)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Camera size={14} /> Update Photo
                </button>
              </div>

              {/* Information Columns */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Visitor Number</span>
                  <span className="font-mono font-bold text-indigo-900 text-base">{visitor.visitorId || visitor.visitId}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Full Name</span>
                  <span className="font-bold text-gray-900 text-base">{visitor.fullName || visitor.visitorName}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Mobile Number</span>
                  <span className="font-bold text-gray-900">{visitor.mobileNumber}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Email Address</span>
                  <span className="font-medium text-gray-800">{visitor.email || '-'}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Visiting Company</span>
                  <span className="font-bold text-indigo-900">{visitor.visitingCompany || visitor.companyName || 'Forge India Connect Private Limited'}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Host Employee</span>
                  <span className="font-bold text-indigo-900">{visitor.hostEmployee || visitor.hostName}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Purpose of Visit</span>
                  <span className="font-semibold text-gray-800">{visitor.visitPurpose || visitor.purpose}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Visit Date & Time</span>
                  <span className="font-semibold text-gray-800">{visitor.visitDate} ({visitor.expectedTime || visitor.expectedArrivalTime || '10:00 AM'})</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Branch Location</span>
                  <span className="font-semibold text-gray-800">📍 {visitor.branchLocation || visitor.branch}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium uppercase tracking-wider">Vehicle Number</span>
                  <span className="font-semibold text-gray-800">🚗 {visitor.vehicleNumber || '-'}</span>
                </div>

                {(visitor.status === 'CHECKED_IN' || visitor.status === 'Checked In' || visitor.checkInTime) && (
                  <>
                    <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                      <span className="text-xs text-emerald-700 block font-bold uppercase tracking-wider">Check-In Time</span>
                      <span className="font-bold text-emerald-900">{visitor.checkInTime ? new Date(visitor.checkInTime).toLocaleString() : visitor.entryTime || 'Just now'}</span>
                    </div>

                    <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                      <span className="text-xs text-emerald-700 block font-bold uppercase tracking-wider">Checked In By</span>
                      <span className="font-bold text-emerald-900">🛡️ {visitor.checkInBy || 'Security'}</span>
                    </div>
                  </>
                )}

                {(visitor.status === 'CHECKED_OUT' || visitor.status === 'Checked Out' || visitor.checkOutTime) && (
                  <>
                    <div className="bg-red-50 p-3.5 rounded-xl border border-red-200">
                      <span className="text-xs text-red-700 block font-bold uppercase tracking-wider">Check-Out Time</span>
                      <span className="font-bold text-red-900">{visitor.checkOutTime ? new Date(visitor.checkOutTime).toLocaleString() : visitor.exitTime || 'Today'}</span>
                    </div>

                    <div className="bg-red-50 p-3.5 rounded-xl border border-red-200">
                      <span className="text-xs text-red-700 block font-bold uppercase tracking-wider">Check-Out Notes</span>
                      <span className="font-medium text-red-900">{visitor.checkOutNotes || visitor.exitNotes || 'Visit Completed'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Check-In / Check-Out Action Bar */}
            <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-500">
                Current Status: <strong className="text-gray-900">{visitor.status}</strong>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* PENDING CHECK-IN DISABLED */}
                {(visitor.status === 'PENDING' || visitor.status === 'Pending Approval' || visitor.status === 'Pending') && (
                  <div className="px-6 py-3 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl font-bold text-sm flex items-center gap-2">
                    <span>⚠️ Waiting for Super Admin approval before Check-In</span>
                  </div>
                )}

                {/* REJECTED CHECK-IN DISABLED */}
                {(visitor.status === 'REJECTED' || visitor.status === 'Rejected') && (
                  <div className="px-6 py-3 bg-red-50 text-red-800 border border-red-300 rounded-xl font-bold text-sm flex items-center gap-2">
                    <span>❌ Visitor booking was rejected. Entry denied.</span>
                  </div>
                )}

                {/* APPROVED -> CHECK-IN ENABLED */}
                {(visitor.status === 'APPROVED' || visitor.status === 'Approved' || visitor.status === 'Pre-Booked') && (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    className="flex-1 sm:flex-initial px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 text-base"
                  >
                    <LogIn size={22} />
                    <span>CHECK IN</span>
                  </button>
                )}

                {/* CHECKED IN -> CHECK-OUT ENABLED */}
                {(visitor.status === 'Checked In' || visitor.status === 'Inside' || visitor.status === 'CHECKED_IN') && (
                  <button
                    type="button"
                    onClick={handleOpenCheckoutModal}
                    className="flex-1 sm:flex-initial px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 text-base"
                  >
                    <LogOut size={22} />
                    <span>CHECK OUT</span>
                  </button>
                )}

                {/* CHECKED OUT COMPLETED */}
                {(visitor.status === 'Checked Out' || visitor.status === 'Exited' || visitor.status === 'CHECKED_OUT') && (
                  <div className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm border flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-green-600" />
                    Visit Completed (Checked Out at {visitor.exitTime || 'Today'})
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY EXIT NOTES CHECKOUT MODAL */}
      {showCheckoutModal && visitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <LogOut className="text-red-600" size={20} />
                Visit Summary & Mandatory Check-Out
              </h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {checkoutError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {checkoutError}
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 text-sm">{visitor.visitorName}</div>
              <div className="text-slate-500">Order-Wise ID: <span className="font-mono text-indigo-600 font-semibold">{visitor.visitId}</span></div>
              <div className="text-slate-500">Check-In Time: {visitor.entryTime || 'Earlier today'}</div>
            </div>

            <form onSubmit={handleConfirmCheckOut} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Exit Notes * <span className="text-red-500">(Mandatory before logout)</span>
                </label>
                <textarea
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  placeholder="Enter visit summary / exit notes (e.g., Meeting completed successfully, badge returned to security)..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[var(--color-brand-indigo)] h-28"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center gap-1.5"
                >
                  <LogOut size={16} />
                  Submit Notes & Check Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Webcam Modal */}
      {showWebcam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Camera size={16} /> Live Photo Capture
              </h3>
              <button type="button" onClick={() => setShowWebcam(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="bg-black flex justify-center">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full object-cover max-h-[60vh]"
              />
            </div>
            <div className="p-4 bg-slate-50 flex justify-center">
              <button
                type="button"
                onClick={handleWebcamSnap}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg flex items-center gap-2"
              >
                <Camera size={18} /> Snap & Save Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityCheckIn;
