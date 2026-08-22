import React, { useState, useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { useVisitors } from '../../context/VisitorContext';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { Users, UserCheck, QrCode, ShieldAlert, Ban, Search, Clock, AlertTriangle, FileText, Settings, Camera } from 'lucide-react';
import Webcam from 'react-webcam';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { calculateTimeSpent } from '../../utils/timeUtils';
import { useAttendance } from '../../context/AttendanceContext';
import TodaysVisitorsCard from '../../components/dashboard/TodaysVisitorsCard';
import VisitorStatusSummaryCard from '../../components/dashboard/VisitorStatusSummaryCard';

const DashboardCard = ({ title, value, icon: Icon, colorClass, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-xl shadow-md border border-gray-200 p-6 flex items-center space-x-4 transition-transform hover:-translate-y-1 hover:shadow-lg duration-300 ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${colorClass}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

const SecurityDashboard = () => {
  const { visitors } = useVisitors();
  const { activeBranch } = useBranch();
  const { attendance, checkIn, checkOut } = useAttendance();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('prebooking'); // 'prebooking' | 'attendance' | 'all'
  
  const { addNotification } = useNotification();
  
  // Webcam and Location state
  const webcamRef = React.useRef(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [webcamAction, setWebcamAction] = useState(null); // 'checkIn' or 'checkOut'
  const [currentLocation, setCurrentLocation] = useState(null);

  // QR Scanner Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrVisitId, setQrVisitId] = useState('');
  const [qrScanMode, setQrScanMode] = useState('camera'); // 'camera' or 'manual'
  const [qrScannerError, setQrScannerError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Real-Time Socket.IO Synchronization Effect
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
    const socketUrl = API_URL ? API_URL.replace(/\/api\/?$/, '') : (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });

    socket.on('visitor-status-updated', (data) => {
      console.log('⚡ Real-time visitor status update received:', data);

      if (data.visitorType === 'PRE_BOOKING') {
        if (typeof fetchPbList === 'function') fetchPbList();
      } else if (data.visitorType === 'DIRECT_VISIT') {
        if (typeof fetchVisitors === 'function') fetchVisitors();
      }

      setPbVisitor((current) => {
        if (!current) return current;
        const currentTargetId = current._id || current.id || current.visitorId || current.visitId;
        if (String(currentTargetId) !== String(data.visitorId) && String(current.visitorId) !== String(data.visitorId)) {
          return current;
        }
        return {
          ...current,
          status: data.status,
          visitDate: data.visitor?.visitDate || data.visitDate || current.visitDate,
          expectedTime: data.visitor?.expectedTime || data.visitor?.expectedArrivalTime || data.expectedTime || current.expectedTime,
          ...(data.visitor ? {
            checkInTime: data.visitor.checkInTime || current.checkInTime,
            checkOutTime: data.visitor.checkOutTime || current.checkOutTime
          } : {})
        };
      });
    });

    socket.on('visitor:status-updated', (data) => {
      if (typeof fetchPbList === 'function') fetchPbList();
      if (typeof fetchVisitors === 'function') fetchVisitors();
    });

    socket.on('notification-created', (data) => {
      if (typeof fetchPbList === 'function') fetchPbList();
      if (typeof fetchVisitors === 'function') fetchVisitors();
    });

    return () => {
      socket.disconnect();
    };
  }, []);
  const [pbSearchQuery, setPbSearchQuery] = useState('');
  const [pbVisitor, setPbVisitor] = useState(null);
  const [pbSearchLoading, setPbSearchLoading] = useState(false);
  const [pbSearchError, setPbSearchError] = useState('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const handlePbSearch = async (e) => {
    if (e) e.preventDefault();
    const cleanQuery = pbSearchQuery.trim();
    if (!cleanQuery) {
      setPbSearchError('Please enter a Visitor ID or mobile number.');
      return;
    }

    setPbSearchLoading(true);
    setPbSearchError('');
    setPbVisitor(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
      const reqHeaders = {
        'x-company-id': user?.companyId || 'FIC001',
        'Authorization': user?.token ? `Bearer ${user.token}` : `Bearer ${localStorage.getItem('token')}`
      };

      const isMobile = /^\d{10}$/.test(cleanQuery);
      const paramKey = isMobile ? 'mobile' : 'visitorId';

      let response = await fetch(`${API_URL}/api/security/visitor/search?${paramKey}=${encodeURIComponent(cleanQuery)}`, { headers: reqHeaders });
      
      if (!response.ok) {
        response = await fetch(`${API_URL}/api/security/visitor/search?query=${encodeURIComponent(cleanQuery)}`, { headers: reqHeaders });
      }
      if (!response.ok) {
        response = await fetch(`${API_URL}/api/prebookings/visitor/${encodeURIComponent(cleanQuery)}`, { headers: reqHeaders });
      }

      if (response.ok) {
        const json = await response.json();
        const vType = json.visitorType || (json.data?.bookingType === 'DIRECT_VISIT' ? 'DIRECT_VISIT' : 'PRE_BOOKING');
        const raw = json.visitor || json.data || json;

        setPbVisitor({
          id: raw._id || raw.id,
          _id: raw._id || raw.id,
          visitorId: raw.visitorId || raw.visitId || raw._id,
          visitorType: vType,
          fullName: raw.fullName || raw.visitorName || raw.name || 'Visitor',
          name: raw.fullName || raw.visitorName || raw.name || 'Visitor',
          mobileNumber: raw.mobileNumber || raw.mobile || '-',
          email: raw.email || '-',
          visitingCompany: raw.visitingCompany || raw.companyName || 'Forge India Connect Private Limited',
          hostEmployee: raw.hostEmployee || raw.hostName || raw.host || 'Staff',
          visitPurpose: raw.visitPurpose || raw.purpose || 'Official Visit',
          visitDate: raw.visitDate || new Date().toISOString().split('T')[0],
          expectedTime: raw.expectedTime || raw.expectedArrivalTime || '10:00 AM',
          branchLocation: raw.branchLocation || raw.branch || activeBranch || 'Head Office',
          vehicleNumber: raw.vehicleNumber || '-',
          facePhoto: raw.facePhoto || raw.photoUrl || '',
          status: raw.status || 'PENDING',
          checkInTime: raw.checkInTime || null,
          checkInBy: raw.checkInBy || null,
          checkOutTime: raw.checkOutTime || null,
          checkOutBy: raw.checkOutBy || null,
          checkOutNotes: raw.checkOutNotes || raw.exitNotes || ''
        });
      } else {
        const errJson = await response.json().catch(() => ({}));
        if (errJson.code === 'VISITOR_NOT_FOUND' || response.status === 404) {
          setPbSearchError('Visitor not found.');
        } else {
          setPbSearchError(errJson.message || 'Unable to search visitor.');
        }
      }
    } catch (err) {
      setPbSearchError('Search failed. Check server connection.');
    } finally {
      setPbSearchLoading(false);
    }
  };

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const handleVisitorAction = async (action) => {
    if (!pbVisitor) return;

    try {
      setActionLoading(true);
      setActionError('');
      setActionSuccess('');

      const targetId = pbVisitor._id || pbVisitor.id || pbVisitor.visitId || pbVisitor.visitorId;
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

      const response = await fetch(`${API_URL}/api/security/visitor/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user?.token ? `Bearer ${user.token}` : `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          visitorId: targetId,
          visitorType: pbVisitor.visitorType || 'PRE_BOOKING',
          action,
          notes: action === 'CHECK_OUT' ? checkoutNotes.trim() : undefined
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const newStatus = action === 'CHECK_IN' ? (pbVisitor.visitorType === 'DIRECT_VISIT' ? 'Checked In' : 'CHECKED_IN') : (pbVisitor.visitorType === 'DIRECT_VISIT' ? 'Checked Out' : 'CHECKED_OUT');
        setPbVisitor(prev => ({
          ...prev,
          status: newStatus,
          ...(action === 'CHECK_IN' ? { checkInTime: new Date(), checkInBy: 'Security' } : { checkOutTime: new Date(), checkOutBy: 'Security', checkOutNotes: checkoutNotes.trim() })
        }));
        setActionSuccess(data.message || `Visitor ${action === 'CHECK_IN' ? 'checked in' : 'checked out'} successfully.`);
        if (action === 'CHECK_OUT') setShowCheckoutModal(false);
        addNotification(action === 'CHECK_IN' ? 'Check-In Success' : 'Check-Out Success', `${pbVisitor.fullName} ${action === 'CHECK_IN' ? 'is now checked in.' : 'has checked out.'}`, 'success');

        // Automatically refresh corresponding tab data
        if (data.visitorType === 'PRE_BOOKING' || pbVisitor.visitorType === 'PRE_BOOKING') {
          if (typeof fetchPbList === 'function') fetchPbList();
        } else {
          if (typeof fetchVisitors === 'function') fetchVisitors();
        }
      } else {
        setActionError(data.message || 'Unable to update visitor status.');
      }
    } catch (err) {
      setActionError('Failed to execute security action. Check server connection.');
    } finally {
      setActionLoading(false);
    }
  };

  // Camera QR Scanner Lifecycle
  useEffect(() => {
    let html5QrCode;
    
    const startScanner = async () => {
      if (showQrModal && qrScanMode === 'camera') {
        setQrScannerError(null);
        setIsScanning(false);
        try {
          html5QrCode = new Html5Qrcode("qr-reader");
          
          const qrCodeSuccessCallback = (decodedText) => {
            let visitId = decodedText;
            if (decodedText.includes('/pass/')) {
              const parts = decodedText.split('/pass/');
              visitId = parts[parts.length - 1];
            }
            handleScanQrSuccess(visitId);
          };

          const config = { 
            fps: 10, 
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          };

          await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            qrCodeSuccessCallback
          );
          setIsScanning(true);
        } catch (err) {
          console.error("Error starting QR Code scanner: ", err);
          setQrScannerError("Could not access camera. Please check permissions or switch to Manual Entry.");
          setIsScanning(false);
        }
      }
    };

    startScanner();

    return () => {
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop()
            .then(() => {
              html5QrCode.clear();
            })
            .catch(err => console.error("Error stopping scanner: ", err));
        } else {
          try {
            html5QrCode.clear();
          } catch(e) {}
        }
      }
    };
  }, [showQrModal, qrScanMode]);


  // Hardcoded branch settings as requested
  const getBranchSettings = (branchName) => {
    // Only Krishnagiri has strict settings for now
    if (branchName.toUpperCase().includes('KRISHNAGIRI') || branchName.toUpperCase() === 'SALEM') { // Salem legacy mapped to Krishnagiri previously? Actually Krishnagiri is the new branch.
      return {
        branchName: 'Krishnagiri',
        latitude: 12.5269722,
        longitude: 78.2025000,
        radius: 500000,
        checkInStart: '08:00',
        checkInEnd: '10:30',
        checkOutTime: '20:00'
      };
    }
    // Default fallback for other branches (no strict GPS or time if not specified)
    return null;
  };

  const branchSettings = getBranchSettings(activeBranch);

  // Haversine formula to calculate distance between two coordinates in meters
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // in metres
  };

  const handleCapture = React.useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedPhoto(imageSrc);
  }, [webcamRef]);

  const handleConfirmPhoto = () => {
    if (webcamAction === 'checkIn') {
      checkIn(capturedPhoto, currentLocation);
    } else if (webcamAction === 'checkOut') {
      checkOut(capturedPhoto, currentLocation);
    }
    setShowWebcam(false);
    setCapturedPhoto(null);
    setWebcamAction(null);
  };

  const openWebcam = (action) => {
    if (!branchSettings) {
      // If no strict settings, just open webcam directly
      setWebcamAction(action);
      setShowWebcam(true);
      setCapturedPhoto(null);
      return;
    }

    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    // Time constraint check for Check-In
    if (action === 'checkIn') {
      if (currentTimeStr < branchSettings.checkInStart || currentTimeStr > branchSettings.checkInEnd) {
        addNotification('Check-In Closed', `Allowed time: ${branchSettings.checkInStart} - ${branchSettings.checkInEnd}`, 'error');
        return;
      }
    }

    // Geolocation check
    if (!navigator.geolocation) {
      addNotification('Error', 'Geolocation is not supported by your browser', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setCurrentLocation({ lat, lng });

      const distance = getDistance(lat, lng, branchSettings.latitude, branchSettings.longitude);
      
      if (distance > branchSettings.radius) {
        addNotification('Location Error', `You are outside the allowed branch location (${Math.round(distance)}m away). Please move within ${branchSettings.radius} meters of ${activeBranch}.`, 'error');
        return;
      }

      setWebcamAction(action);
      setShowWebcam(true);
      setCapturedPhoto(null);
    }, (err) => {
      addNotification('Location Error', 'Failed to get your location. Please enable GPS permissions.', 'error');
    });
  };

  const [scannerLocked, setScannerLocked] = useState(false);

  const processQrScan = async (scannedValue) => {
    if (!scannedValue || scannerLocked) return;

    let cleanToken = scannedValue.trim();
    if (cleanToken.includes('/pass/')) {
      const parts = cleanToken.split('/pass/');
      cleanToken = parts[parts.length - 1];
    }
    cleanToken = cleanToken.trim();
    if (!cleanToken) return;

    setScannerLocked(true);

    try {
      setPbSearchLoading(true);
      setPbSearchError('');
      setPbVisitor(null);

      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
      const reqHeaders = {
        'x-company-id': user?.companyId || 'FIC001',
        'Authorization': user?.token ? `Bearer ${user.token}` : `Bearer ${localStorage.getItem('token')}`
      };

      let response = await fetch(`${API_URL}/api/security/visitor/search?qrToken=${encodeURIComponent(cleanToken)}`, { headers: reqHeaders });
      
      if (!response.ok) {
        response = await fetch(`${API_URL}/api/security/visitor/search?query=${encodeURIComponent(cleanToken)}`, { headers: reqHeaders });
      }
      if (!response.ok) {
        response = await fetch(`${API_URL}/api/visitors/scan-pass`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passToken: cleanToken })
        });
      }

      if (response.ok) {
        const json = await response.json();
        const vType = json.visitorType || (json.visitor?.visitorType || (json.data?.bookingType === 'DIRECT_VISIT' ? 'DIRECT_VISIT' : 'PRE_BOOKING'));
        const raw = json.visitor || json.data || json;

        setPbVisitor({
          id: raw._id || raw.id,
          _id: raw._id || raw.id,
          visitorId: raw.visitorId || raw.visitId || raw._id,
          visitorType: vType,
          fullName: raw.fullName || raw.visitorName || raw.name || 'Visitor',
          name: raw.fullName || raw.visitorName || raw.name || 'Visitor',
          mobileNumber: raw.mobileNumber || raw.mobile || '-',
          email: raw.email || '-',
          visitingCompany: raw.visitingCompany || raw.companyName || 'Forge India Connect Private Limited',
          hostEmployee: raw.hostEmployee || raw.hostName || raw.host || 'Staff',
          visitPurpose: raw.visitPurpose || raw.purpose || 'Official Visit',
          visitDate: raw.visitDate || new Date().toISOString().split('T')[0],
          expectedTime: raw.expectedTime || raw.expectedArrivalTime || '10:00 AM',
          branchLocation: raw.branchLocation || raw.branch || activeBranch || 'Head Office',
          vehicleNumber: raw.vehicleNumber || '-',
          facePhoto: raw.facePhoto || raw.photoUrl || '',
          status: raw.status || 'PENDING',
          checkInTime: raw.checkInTime || null,
          checkInBy: raw.checkInBy || null,
          checkOutTime: raw.checkOutTime || null,
          checkOutBy: raw.checkOutBy || null,
          checkOutNotes: raw.checkOutNotes || raw.exitNotes || ''
        });
        setShowQrModal(false);
        setQrVisitId('');
        addNotification('QR Scan Success', `Visitor Pass verified for ${raw.fullName || raw.visitorName || raw.name}`, 'success');
      } else {
        const errJson = await response.json().catch(() => ({}));
        if (errJson.code === 'VISITOR_NOT_FOUND' || response.status === 404) {
          setPbSearchError('Visitor not found.');
        } else {
          setPbSearchError(errJson.message || 'Unable to find visitor.');
        }
        addNotification('QR Validation Failed', errJson.message || 'Visitor not found.', 'error');
        setShowQrModal(false);
      }
    } catch (err) {
      console.error("QR Lookup Error:", err);
      setPbSearchError('Failed to process QR scan. Check server connection.');
      addNotification('Scan Error', 'Network error during QR lookup', 'error');
    } finally {
      setPbSearchLoading(false);
      setTimeout(() => {
        setScannerLocked(false);
      }, 1500);
    }
  };

  const handleScanQr = async (e) => {
    e.preventDefault();
    await processQrScan(qrVisitId);
  };

  const handleScanQrSuccess = async (visitId) => {
    await processQrScan(visitId);
  };


  // Metrics
  const today = new Date().toISOString().split('T')[0];
  const safeVisitors = Array.isArray(visitors) ? visitors : [];
  const todaysVisitors = safeVisitors.filter(v => v.visitDate === today).length;
  const visitorsInside = safeVisitors.filter(v => v.status === 'Inside');
  const qrScans = safeVisitors.filter(v => v.status === 'Inside' || v.status === 'Exited').length;
  const blockedAttempts = safeVisitors.filter(v => v.status === 'Rejected').length; // Treating rejected as blocked for security proxy
  const securityAlerts = 0; // Simulated

  // Change to recent registrations to improve UX
  // Show expected arrivals (Approved) and visitors currently Inside
  const recentRegistrations = safeVisitors
    .filter(v => 
      ((v.visitorName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (v.mobileNumber || '').includes(searchQuery))
    )
    .slice(0, 10);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Security Checkpoint Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Live operational terminal for <span className="font-semibold text-gray-700">{activeBranch}</span></p>
        </div>
        <div className="flex w-full sm:w-auto">
          <button 
            onClick={() => navigate('/tracking')}
            className="w-full sm:w-auto justify-center px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
          >
            <ShieldAlert size={18} />
            Zone Tracker
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <DashboardCard onClick={() => navigate('/visitors')} title="Total Visitors" value={safeVisitors.length} icon={Users} colorClass="bg-blue-100 text-blue-600" />
        <DashboardCard onClick={() => navigate('/pre-bookings')} title="Pre-Bookings" value={safeVisitors.filter(v => v.registrationType === 'Pre-Booking' || v.isPreBooking).length} icon={Users} colorClass="bg-indigo-100 text-indigo-600" />
        <DashboardCard onClick={() => navigate('/tracking')} title="Visitors Inside" value={visitorsInside.length} icon={UserCheck} colorClass="bg-green-100 text-green-600" />
        <DashboardCard onClick={() => navigate('/visitors?filter=checked-in')} title="QR Scans" value={qrScans} icon={QrCode} colorClass="bg-purple-100 text-purple-600" />
        <DashboardCard onClick={() => navigate('/tracking')} title="Security Alerts" value={securityAlerts} icon={ShieldAlert} colorClass="bg-red-100 text-red-600" />
        <DashboardCard onClick={() => navigate('/blacklist')} title="Blocked Attempts" value={blockedAttempts} icon={Ban} colorClass="bg-orange-100 text-orange-600" />
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex border-b border-gray-200 gap-4 mt-6">
        <button
          onClick={() => setActiveSubTab('prebooking')}
          className={`pb-3 px-2 font-bold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeSubTab === 'prebooking'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search size={18} />
          Pre-Booking Search & Verification
        </button>

        <button
          onClick={() => setActiveSubTab('attendance')}
          className={`pb-3 px-2 font-bold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeSubTab === 'attendance'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock size={18} />
          Daily Attendance & Camera Scanner
        </button>
      </div>

      {/* PRE-BOOKING SEARCH TAB CONTENT */}
      {activeSubTab === 'prebooking' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 sm:p-8 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Search className="text-indigo-600" size={22} />
              PRE-BOOKING SEARCH
            </h2>

            <form onSubmit={handlePbSearch} className="space-y-3">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                Enter Visitor Number or Mobile Number
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={pbSearchQuery}
                    onChange={(e) => setPbSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePbSearch(e); }}
                    placeholder="Example: VIS-20260812-001 or 9876543210..."
                    className="w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-semibold"
                  />
                  <Search size={18} className="absolute left-3.5 top-4 text-gray-400" />
                </div>
                <button
                  type="submit"
                  disabled={pbSearchLoading}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 text-sm shrink-0"
                >
                  {pbSearchLoading ? 'SEARCHING...' : 'SEARCH'}
                </button>
              </div>

              <div className="relative my-4 flex items-center justify-center">
                <div className="border-t border-gray-200 w-full" />
                <span className="bg-white px-4 text-xs font-bold text-gray-400 uppercase tracking-widest absolute">OR</span>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  <QrCode size={20} className="text-indigo-400" />
                  <span>OPEN QR SCANNER</span>
                </button>
              </div>
            </form>
          </div>

          {pbSearchError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center font-semibold text-sm">
              ⚠️ {pbSearchError}
            </div>
          )}

          {pbVisitor && (
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in duration-300">
              {/* Pass Header */}
              <div className="bg-gradient-to-r from-[#003A70] via-[#004B93] to-[#005EB8] text-white px-6 py-4 flex items-center justify-between shadow-sm">
                <div>
                  <h3 className="text-lg font-bold">VISITOR DETAILS</h3>
                  <p className="text-xs text-slate-300">{pbVisitor.visitingCompany}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    (pbVisitor.status === 'PENDING' || pbVisitor.status === 'Pending' || pbVisitor.status === 'Pending Approval') ? 'bg-amber-100 text-amber-800' :
                    (pbVisitor.status === 'APPROVED' || pbVisitor.status === 'Approved') ? 'bg-emerald-100 text-emerald-800' :
                    (pbVisitor.status === 'CHECKED_IN' || pbVisitor.status === 'Checked In') ? 'bg-green-100 text-green-800' :
                    (pbVisitor.status === 'CHECKED_OUT' || pbVisitor.status === 'Checked Out') ? 'bg-slate-100 text-slate-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {(pbVisitor.status === 'PENDING' || pbVisitor.status === 'Pending' || pbVisitor.status === 'Pending Approval') ? '🟠 PENDING' :
                     (pbVisitor.status === 'APPROVED' || pbVisitor.status === 'Approved') ? '🟢 APPROVED' :
                     (pbVisitor.status === 'CHECKED_IN' || pbVisitor.status === 'Checked In') ? '🟢 CHECKED IN' :
                     (pbVisitor.status === 'CHECKED_OUT' || pbVisitor.status === 'Checked Out') ? '🔵 CHECKED OUT' : pbVisitor.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPbVisitor(null);
                      setPbSearchError('');
                      setActionError('');
                      setActionSuccess('');
                    }}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border border-white/20"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Face Photo Column */}
                  <div className="flex flex-col items-center justify-center p-5 bg-slate-50 border rounded-2xl">
                    <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-white shadow-md bg-indigo-100 flex items-center justify-center mb-2">
                      {pbVisitor.facePhoto ? (
                        <img src={pbVisitor.facePhoto} alt="Visitor Face" className="w-full h-full object-cover" />
                      ) : (
                        <Users size={64} className="text-indigo-400" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-gray-500">Visitor Face Photo</span>
                  </div>

                  {/* Details Grid */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Visitor Number</span>
                      <span className="font-mono font-bold text-indigo-900 text-base">{pbVisitor.visitorId}</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Visitor Type</span>
                      {pbVisitor.visitorType === 'DIRECT_VISIT' ? (
                        <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-xs border border-amber-300 mt-1">
                          ⚡ DIRECT VISIT
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-lg text-xs border border-indigo-300 mt-1">
                          📅 PRE-BOOKING
                        </span>
                      )}
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Full Name</span>
                      <span className="font-bold text-gray-900 text-base">{pbVisitor.fullName}</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Mobile</span>
                      <span className="font-bold text-gray-900">{pbVisitor.mobileNumber}</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Email</span>
                      <span className="font-medium text-gray-800">{pbVisitor.email}</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Company</span>
                      <span className="font-bold text-indigo-900">{pbVisitor.visitingCompany}</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Host</span>
                      <span className="font-bold text-indigo-900">{pbVisitor.hostEmployee}</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Purpose</span>
                      <span className="font-semibold text-gray-800">{pbVisitor.visitPurpose}</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Date & Time</span>
                      <span className="font-semibold text-gray-800">{pbVisitor.visitDate} ({pbVisitor.expectedTime})</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Branch</span>
                      <span className="font-semibold text-gray-800">📍 {pbVisitor.branchLocation}</span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl border">
                      <span className="text-xs text-gray-400 block font-medium uppercase">Vehicle</span>
                      <span className="font-semibold text-gray-800">🚗 {pbVisitor.vehicleNumber}</span>
                    </div>

                    {/* CHECK-IN & CHECK-OUT TIME LOGS */}
                    {pbVisitor.checkInTime && (
                      <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                        <span className="text-xs text-emerald-700 block font-bold uppercase">Check-In Time</span>
                        <span className="font-bold text-emerald-900">{new Date(pbVisitor.checkInTime).toLocaleString()}</span>
                        <span className="text-xs text-emerald-700 block mt-0.5">By: {pbVisitor.checkInBy || 'Security'}</span>
                      </div>
                    )}

                    {pbVisitor.checkOutTime && (
                      <div className="bg-red-50 p-3.5 rounded-xl border border-red-200">
                        <span className="text-xs text-red-700 block font-bold uppercase">Check-Out Time</span>
                        <span className="font-bold text-red-900">{new Date(pbVisitor.checkOutTime).toLocaleString()}</span>
                        <span className="text-xs text-red-700 block mt-0.5">Notes: {pbVisitor.checkOutNotes || 'Completed'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ACTION ALERTS */}
                {actionError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl">
                    ⚠️ {actionError}
                  </div>
                )}
                {actionSuccess && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-xl">
                    ✅ {actionSuccess}
                  </div>
                )}

                {/* PASS ACTION BAR */}
                <div className="pt-4 border-t flex items-center justify-between mt-4">
                  <span className="text-xs font-semibold text-gray-500">Status: {pbVisitor.status}</span>

                  <div>
                    {(pbVisitor.status === 'PENDING' || pbVisitor.status === 'Pending' || pbVisitor.status === 'Pending Approval') && (
                      <div className="px-6 py-3 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl font-bold text-sm flex items-center gap-2">
                        <Clock size={18} />
                        <span>Awaiting Host Approval</span>
                      </div>
                    )}

                    {(pbVisitor.status === 'REJECTED' || pbVisitor.status === 'Rejected') && (
                      <span className="px-6 py-3 bg-red-50 text-red-800 border border-red-300 rounded-xl font-bold text-sm">
                        ❌ Visitor rejected
                      </span>
                    )}

                    {(pbVisitor.status === 'APPROVED' || pbVisitor.status === 'Approved' || pbVisitor.status === 'Pre-Booked') && (
                      <button
                        onClick={() => handleVisitorAction('CHECK_IN')}
                        disabled={actionLoading}
                        className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-base cursor-pointer"
                      >
                        {actionLoading ? 'Processing...' : 'CHECK IN'}
                      </button>
                    )}

                    {(pbVisitor.status === 'CHECKED_IN' || pbVisitor.status === 'Checked In') && (
                      <button
                        onClick={() => handleVisitorAction('CHECK_OUT')}
                        disabled={actionLoading}
                        className="px-8 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-base cursor-pointer"
                      >
                        {actionLoading ? 'Processing...' : 'CHECK OUT'}
                      </button>
                    )}

                    {(pbVisitor.status === 'CHECKED_OUT' || pbVisitor.status === 'Checked Out') && (
                      <span className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm border">
                        Visit Completed (Checked Out)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DAILY ATTENDANCE & TOOLS TAB CONTENT */}
      {(activeSubTab === 'attendance' || activeSubTab === 'all') && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Left Column: Attendance, Quick Verification, Security Tools */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Daily Attendance Card */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Daily Attendance</h3>
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                Date: {today.split('-').reverse().join('-')}
              </span>
            </div>
            
            <div className="space-y-4">
              {showWebcam ? (
                <div className="space-y-3">
                  {!capturedPhoto ? (
                    <>
                      <div className="rounded-lg overflow-hidden border-2 border-[var(--color-brand-indigo)] bg-black">
                        <Webcam
                          audio={false}
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          className="w-full h-auto"
                          videoConstraints={{ facingMode: "user" }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setShowWebcam(false);
                            setWebcamAction(null);
                          }}
                          className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleCapture}
                          className="flex-1 py-2 bg-[var(--color-brand-indigo)] hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                        >
                          <Camera size={16} /> Capture
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg overflow-hidden border-2 border-green-500">
                        <img src={capturedPhoto} alt="Captured" className="w-full h-auto" />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setCapturedPhoto(null)}
                          className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                        >
                          Retake
                        </button>
                        <button 
                          onClick={handleConfirmPhoto}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
                        >
                          Confirm & {webcamAction === 'checkIn' ? 'Check In' : 'Check Out'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : !attendance ? (
                <>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-500">Status:</span>
                    <span className="font-bold text-gray-700">Not Checked In</span>
                  </div>
                  <button 
                    onClick={() => openWebcam('checkIn')}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Camera size={18} />
                    Open Camera to Check In
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center bg-green-50 text-green-700 px-3 py-2 rounded-lg font-medium">
                      <span>Status:</span>
                      <span>Present</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Check In:</span>
                      <span className="font-bold text-gray-900">{attendance.checkInTime}</span>
                    </div>
                    {attendance.checkInPhoto && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 flex items-center gap-1"><Camera size={14} /> Photo:</span>
                        <span className="text-green-600 text-xs font-bold flex items-center gap-1">✔ Captured</span>
                      </div>
                    )}
                    
                    {attendance.checkOutTime && (
                      <>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <span className="text-gray-500">Check Out:</span>
                          <span className="font-bold text-gray-900">{attendance.checkOutTime}</span>
                        </div>
                        {attendance.checkOutPhoto && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1"><Camera size={14} /> Photo:</span>
                            <span className="text-green-600 text-xs font-bold flex items-center gap-1">✔ Captured</span>
                          </div>
                        )}
                      </>
                    )}
                    {attendance.workingHours && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-500">Working Hours:</span>
                        <span className="font-bold text-[var(--color-brand-indigo)]">{attendance.workingHours}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    {attendance.status === 'Completed' ? (
                      <div className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-center border border-gray-200">
                        Attendance Completed
                      </div>
                    ) : (
                      <button 
                        onClick={() => openWebcam('checkOut')}
                        className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera size={18} />
                        Open Camera to Check Out
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 border-t-4 border-t-[var(--color-brand-indigo)]">
            <h3 className="text-[11px] font-bold text-gray-500 mb-4 uppercase tracking-wider">Quick Operations</h3>
            
            <div className="space-y-4">
              <button 
                onClick={() => setShowQrModal(true)}
                className="w-full py-4 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors text-gray-600 hover:text-gray-900 hover:border-gray-400"
              >
                <QrCode size={32} />
                <span className="font-medium">Scan QR Pass</span>
              </button>

              <button 
                onClick={() => navigate('/visitors/new')}
                className="w-full py-3 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white rounded-xl flex items-center justify-center gap-2 transition-colors font-medium shadow-sm"
              >
                <UserCheck size={20} />
                Direct Visit
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
             <h3 className="text-[11px] font-bold text-gray-500 mb-4 uppercase tracking-wider">Security Tools</h3>
             <div className="space-y-2 text-sm">
               <button onClick={() => navigate('/blacklist')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-gray-200 transition-all text-gray-700">
                 <div className="flex items-center gap-3"><Ban size={18} className="text-red-500" /> Blacklist Verification</div>
                 <Search size={14} className="text-gray-400" />
               </button>
               <button onClick={() => navigate('/tracking')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-gray-200 transition-all text-gray-700">
                 <div className="flex items-center gap-3"><ShieldAlert size={18} className="text-orange-500" /> Restrict Access Flags</div>
                 <Search size={14} className="text-gray-400" />
               </button>
             </div>
          </div>

          <TodaysVisitorsCard />
          <VisitorStatusSummaryCard />
        </div>

        {/* Expected Arrivals Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Recent Registrations</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search name or mobile..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] bg-white" 
              />
            </div>
          </div>
          <div className="overflow-x-auto hide-scrollbar flex-1 pb-2">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-white text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                  <th className="px-6 py-4 font-medium">Visitor</th>
                  <th className="px-6 py-4 font-medium">Host / Purpose</th>
                  <th className="px-6 py-4 font-medium">Entry Time</th>
                  <th className="px-6 py-4 font-medium">Exit Time</th>
                  <th className="px-6 py-4 font-medium">Time Spent</th>
                  <th className="px-6 py-4 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentRegistrations.map((visitor) => (
                  <tr key={visitor.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{visitor.visitorName || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{visitor.mobileNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{visitor.hostName || '-'}</div>
                      <div className="text-xs text-gray-500">{visitor.purpose || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {visitor.checkInTime 
                          ? new Date(visitor.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                          : (visitor.entryTime && visitor.entryTime !== '-' ? visitor.entryTime : 'Not Checked In')}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {visitor.checkInTime 
                          ? new Date(visitor.checkInTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : (visitor.visitDate ? (visitor.visitDate.includes('T') ? visitor.visitDate.split('T')[0] : visitor.visitDate) : '-')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {visitor.exitTime || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {calculateTimeSpent(visitor.visitDate, visitor.entryTime, visitor.exitTime, visitor.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium flex items-center justify-end gap-1 ${
                        visitor.status === 'Approved' ? 'bg-green-50 text-green-600' :
                        visitor.status === 'Rejected' ? 'bg-red-50 text-red-600' :
                        visitor.status === 'Inside' ? 'bg-yellow-50 text-yellow-600' :
                        visitor.status === 'Exited' ? 'bg-green-50 text-green-700' :
                        'bg-orange-50 text-orange-600'
                      }`}>
                        {visitor.status === 'Inside' ? '🟡 In Progress' : 
                         visitor.status === 'Exited' ? '🟢 Completed' : 
                         visitor.status} 
                        {visitor.status === 'Approved' && '✅'}
                        {visitor.status === 'Pending' && '⏳'}
                        {visitor.status === 'Rejected' && '❌'}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentRegistrations.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No recent visitors found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      )}

      {/* QR Scanner Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <style>{`
            @keyframes scanner-laser {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
            .animate-scanner-laser {
              animation: scanner-laser 2.5s infinite linear;
            }
            #qr-reader video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
          `}</style>
          <div className="bg-white rounded-2xl shadow-2xl border max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1E1B6E] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-md flex items-center gap-2">
                <QrCode size={18} /> {qrScanMode === 'camera' ? 'Scan QR Pass' : 'Manual Entry'}
              </h3>
              <button 
                onClick={() => {
                  setShowQrModal(false);
                  setQrVisitId('');
                }} 
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <span className="font-bold text-xl">&times;</span>
              </button>
            </div>
            
            <div className="p-6">
              {/* Scan Mode Toggle */}
              <div className="flex justify-center mb-6 gap-2 bg-slate-100 p-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setQrScanMode('camera')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    qrScanMode === 'camera' 
                      ? 'bg-white text-[#1E1B6E] shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Camera Scan
                </button>
                <button
                  type="button"
                  onClick={() => setQrScanMode('manual')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    qrScanMode === 'manual' 
                      ? 'bg-white text-[#1E1B6E] shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Manual Entry
                </button>
              </div>

              {qrScanMode === 'camera' ? (
                <div>
                  <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border-2 border-indigo-500 mb-4 shadow-inner">
                    <div id="qr-reader" className="w-full h-full"></div>
                    
                    {/* Laser animation line */}
                    {isScanning && (
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-green-500 shadow-[0_0_10px_#22c55e] animate-scanner-laser"></div>
                    )}
                    
                    {/* Corner highlights */}
                    <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-green-500"></div>
                    <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-green-500"></div>
                    <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-green-500"></div>
                    <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-green-500"></div>

                    {!isScanning && !qrScannerError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white text-xs font-semibold">
                        Initializing camera...
                      </div>
                    )}

                    {qrScannerError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-red-400 p-6 text-center text-xs font-semibold">
                        <p className="mb-3">{qrScannerError}</p>
                        <button 
                          type="button" 
                          onClick={() => setQrScanMode('manual')}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-colors"
                        >
                          Use Manual Entry
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-xs text-gray-500 font-medium">
                    Align the visitor's QR pass inside the camera frame.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleScanQr}>
                  <p className="text-sm text-gray-600 mb-4 font-medium">
                    Please manually enter the visitor's <strong>Visit ID</strong> (e.g., VISIT0001) that is embedded in their QR Code.
                  </p>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Visit ID</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. VISIT0001"
                      value={qrVisitId}
                      onChange={(e) => setQrVisitId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1E1B6E] focus:border-transparent outline-none uppercase font-mono bg-slate-50"
                    />
                  </div>
                  <div className="flex justify-end gap-3 border-t pt-4">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowQrModal(false);
                        setQrVisitId('');
                      }} 
                      className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2 bg-[#1E1B6E] text-white font-medium rounded-lg hover:bg-indigo-900 transition-colors shadow-sm"
                    >
                      Process Scan
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MANDATORY CHECK-OUT POPUP MODAL */}
      {showCheckoutModal && pbVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Visitor Check-Out
              </h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 text-sm">Visitor: {pbVisitor.fullName}</div>
              <div className="text-slate-500">Visitor No: <span className="font-mono text-indigo-600 font-semibold">{pbVisitor.visitorId}</span></div>
            </div>

            {checkoutError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl">
                ⚠️ {checkoutError}
              </div>
            )}

            <form onSubmit={handlePbCheckOut} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Checkout Notes * <span className="text-red-500">(Required)</span>
                </label>
                <textarea
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Example: Meeting completed successfully..."
                  rows={5}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 h-28"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCheckoutModal(false); setCheckoutNotes(''); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!checkoutNotes.trim()}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
                >
                  Confirm Check-Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;
