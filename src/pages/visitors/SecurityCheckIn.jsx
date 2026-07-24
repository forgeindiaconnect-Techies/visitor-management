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

    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp}:5000` : 'https://fic-visitor-1.onrender.com');
      const response = await fetch(`${API_URL}/api/visitors/search/${encodeURIComponent(searchQuery.trim())}`, {
        headers: {
          'x-company-id': user?.companyId || 'FIC001',
          'Authorization': user?.token ? `Bearer ${user.token}` : ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVisitor(data);
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

  const handleCheckIn = async () => {
    if (!visitor) return;
    const updates = {
      status: 'Checked In',
      entryTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      checkedIn: true
    };
    if (capturedPhotoUrl) {
      updates.photoUrl = capturedPhotoUrl;
    }

    const targetId = visitor._id || visitor.id;
    await updateVisitorStatus(targetId, 'Checked In');
    if (capturedPhotoUrl) {
      await updateVisitor(targetId, { photoUrl: capturedPhotoUrl });
    }
    
    setVisitor(prev => ({ ...prev, status: 'Checked In', checkedIn: true, entryTime: updates.entryTime, photoUrl: capturedPhotoUrl || prev.photoUrl }));
    addNotification('Visitor Checked In', `${visitor.visitorName} has checked in. Visitor Pass Activated!`, 'success');
  };

  const handleCheckOut = async () => {
    if (!visitor) return;
    const targetId = visitor._id || visitor.id;
    const exitTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    await updateVisitorStatus(targetId, 'Checked Out');
    setVisitor(prev => ({ ...prev, status: 'Checked Out', exitTime }));
    addNotification('Visitor Checked Out', `${visitor.visitorName} has checked out successfully.`, 'info');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pre-Booked':
        return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200">📅 Pre-Booked</span>;
      case 'Approved':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-200">✅ Approved</span>;
      case 'Checked In':
      case 'Inside':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">🟢 Checked In</span>;
      case 'Checked Out':
      case 'Exited':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold border border-gray-200">🚪 Checked Out</span>;
      case 'Cancelled':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">❌ Cancelled</span>;
      case 'Expired':
        return <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold border border-orange-200">⏰ Expired</span>;
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
            Security Check-In & Check-Out Desk
          </h1>
          <p className="text-gray-500 mt-1">Search booking, verify visitor details, capture photo, and manage entry/exit.</p>
        </div>
      </div>

      {/* Search Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <label className="block text-sm font-bold text-gray-700">
            Search Option (Mobile Number, Booking ID, or QR Scan Payload)
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
                placeholder="Enter Mobile Number (e.g. 9876543210) OR Booking ID (BK000231)..."
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
              <span>Search Booking</span>
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Tip: You can also paste or scan QR Code JSON string: <code className="bg-gray-100 text-indigo-800 px-1 py-0.5 rounded">{`{"bookingId":"BK000231","visitorId":"VIS102","mobile":"9876543210"}`}</code>
          </p>
        </form>
      </div>

      {/* Search Results / Details Card */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
          <RefreshCw className="animate-spin mx-auto mb-2 text-[var(--color-brand-indigo)]" size={28} />
          Fetching booking details...
        </div>
      )}

      {!loading && searched && !visitor && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center animate-in zoom-in-95">
          <AlertCircle className="mx-auto text-red-500 mb-2" size={36} />
          <h3 className="text-lg font-bold text-gray-900">No Booking Found</h3>
          <p className="text-sm text-gray-500 mt-1">No visitor record found for "{searchQuery}". Please check the Mobile Number or Booking ID.</p>
        </div>
      )}

      {!loading && visitor && (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white font-mono text-xs font-bold">
                {visitor.bookingId || visitor.visitId}
              </div>
              <div>
                <h3 className="text-lg font-bold">{visitor.visitorName}</h3>
                <p className="text-xs text-slate-300">{visitor.companyName || 'Visitor'}</p>
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
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-white shadow-md bg-indigo-100 flex items-center justify-center mb-3">
                  {capturedPhotoUrl || visitor.photoUrl ? (
                    <img src={capturedPhotoUrl || visitor.photoUrl} alt={visitor.visitorName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={64} className="text-indigo-400" />
                  )}
                </div>

                <p className="text-xs font-semibold text-gray-500 mb-3">Visitor Live Photo (Optional)</p>
                <button
                  type="button"
                  onClick={() => setShowWebcam(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Camera size={14} /> Capture Photo
                </button>
              </div>

              {/* Information Columns */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium">Mobile Number</span>
                  <span className="font-bold text-gray-900">{visitor.mobileNumber}</span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium">Aadhaar Card Number</span>
                  <span className="font-bold text-indigo-900">{visitor.aadhaarNumber || 'Not Provided'}</span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium">Host Name</span>
                  <span className="font-bold text-indigo-900">{visitor.hostName}</span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium">Purpose of Visit</span>
                  <span className="font-semibold text-gray-800">{visitor.purpose}</span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium">Visit Date & Time</span>
                  <span className="font-semibold text-gray-800">{visitor.visitDate} ({visitor.expectedArrivalTime || 'N/A'})</span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium">Branch Location</span>
                  <span className="font-semibold text-gray-800">📍 {visitor.branch}</span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-400 block font-medium">Entry / Exit Log</span>
                  <span className="font-semibold text-gray-800">
                    In: {visitor.entryTime || 'Not checked in'} | Out: {visitor.exitTime || '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* Check-In / Check-Out Action Bar */}
            <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-500">
                Visitor Pass Status: <strong className="text-gray-900">{visitor.status}</strong>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {visitor.status !== 'Checked In' && visitor.status !== 'Inside' && visitor.status !== 'Checked Out' && visitor.status !== 'Exited' && (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    className="flex-1 sm:flex-initial px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                    <LogIn size={20} />
                    <span>Check In (Activate Pass)</span>
                  </button>
                )}

                {(visitor.status === 'Checked In' || visitor.status === 'Inside') && (
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    className="flex-1 sm:flex-initial px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                    <LogOut size={20} />
                    <span>Check Out</span>
                  </button>
                )}

                {(visitor.status === 'Checked Out' || visitor.status === 'Exited') && (
                  <div className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm border flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-600" />
                    Visit Completed (Checked Out at {visitor.exitTime})
                  </div>
                )}
              </div>
            </div>
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
