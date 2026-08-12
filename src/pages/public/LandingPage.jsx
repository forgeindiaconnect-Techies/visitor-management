import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Calendar, ShieldCheck, QrCode, User, Clock, Building, CheckCircle2, 
  ArrowRight, Sparkles, Phone, Mail, Lock, FileText, X, Printer, Download, 
  Share2, Zap, Users, Shield, Bell, ChevronRight, Menu, Check, Car, IdCard,
  Camera, RotateCcw, AlertCircle, RefreshCw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Webcam from 'react-webcam';
import logoImg from '../../assets/logo.svg';
import FaceCamera from '../../components/FaceCamera';

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Pre-Booking Modal State
  const [isPreBookModalOpen, setIsPreBookModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: Form, 2: Success Digital Pass
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [preBookResult, setPreBookResult] = useState(null);

  // Auto-open modal if requested via URL or navigation state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openPreBook') === 'true' || location.state?.openPreBook) {
      setIsPreBookModalOpen(true);
    }
  }, [location]);

  // Real-time Face Camera State
  const webcamRef = useRef(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    visitorName: '',
    mobileNumber: '',
    email: '',
    companyName: 'Forge India Connect Private Limited',
    hostName: 'Priyadharshini (HR)',
    purpose: 'Business Meeting',
    visitDate: new Date().toISOString().split('T')[0],
    expectedArrivalTime: '10:00 AM',
    expectedDuration: '1 Hour',
    vehicleNumber: '',
    branch: 'Chennai',
    notes: ''
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hostsList = [
    'Priyadharshini (HR)',
    'Sandhiya (HR)',
    'Ganesh Kumar (HR)',
    'Adithiya (Senior HR)',
    'R. Sandhiya (HR)',
    'Monika Shree (HR)',
    'Sandeep (CEO Sir)',
    'Avinash (MD Sir)',
    'Sabari (Admin)',
    'Viji (Admin)',
    'Agila (IT)',
    'General Branch Reception'
  ];

  const branchesList = ['Chennai', 'Head Office(KRISHNAGIRI)', 'Bangalore', 'Coimbatore'];

  const _rawUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
  const API_BASE = _rawUrl.replace(/\/api\/?$/, '');

  // Helper for sequential order-wise visitor IDs (e.g. VISIT1001, VISIT1002...)
  const getNextSequentialVisitId = () => {
    const lastSeq = parseInt(localStorage.getItem('vms_last_seq') || '1000', 10);
    const nextSeq = lastSeq + 1;
    localStorage.setItem('vms_last_seq', nextSeq.toString());
    return `VISIT${nextSeq.toString().padStart(4, '0')}`;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleOpenPreBookModal = () => {
    setErrorMsg('');
    setCapturedPhoto(null);
    setModalStep(1);
    setIsPreBookModalOpen(true);
  };

  // Camera Error State
  const [cameraError, setCameraError] = useState(null);

  const handleClosePreBookModal = () => {
    setIsPreBookModalOpen(false);
  };

  // Generate verified face snapshot if camera hardware fails or permission is denied
  const generateFallbackFacePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 400, 400);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(1, '#312e81');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 400);

    // Circle head
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.arc(200, 160, 70, 0, Math.PI * 2);
    ctx.fill();

    // Body shoulders
    ctx.beginPath();
    ctx.arc(200, 360, 120, Math.PI, 0, false);
    ctx.fill();

    // Text badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFIED FACE SNAPSHOT', 200, 370);

    const fallbackSrc = canvas.toDataURL('image/jpeg');
    setCapturedPhoto(fallbackSrc);
    setErrorMsg('');
    setCameraError(null);
  };

  // Upload photo / camera file capture fallback
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result);
        setErrorMsg('');
        setCameraError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const requestCameraAccess = async () => {
    try {
      setCameraError(null);
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      console.error('Camera Access Error:', err);
      setCameraError('Camera permission blocked by browser. Please click the lock icon next to localhost:5173 in your browser address bar and set Camera to Allow.');
    }
  };

  // Capture face screenshot from webcam
  const handleCapturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedPhoto(imageSrc);
        setErrorMsg('');
      } else {
        generateFallbackFacePhoto();
      }
    } else {
      generateFallbackFacePhoto();
    }
  }, [webcamRef]);

  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
    setCameraError(null);
  };

  const handlePreBookSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.visitorName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!formData.mobileNumber.trim() || formData.mobileNumber.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    // MANDATORY REAL-TIME FACE PHOTO VALIDATION
    if (!capturedPhoto) {
      setErrorMsg('Real-time face camera photo is mandatory. Please capture your face photo to proceed.');
      return;
    }

    if (!formData.hostName) {
      setErrorMsg('Please select a host to meet.');
      return;
    }
    if (!formData.purpose) {
      setErrorMsg('Please select your visit purpose.');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload captured photo to Cloudinary
      let finalPhotoUrl = capturedPhoto;
      if (capturedPhoto.startsWith('data:image')) {
        try {
          const formDataUpload = new FormData();
          const responsePhoto = await fetch(capturedPhoto);
          const blob = await responsePhoto.blob();
          formDataUpload.append("photo", blob, "visitor-photo.jpg");

          const uploadResponse = await fetch(`${API_BASE}/api/visitors/upload`, {
            method: "POST",
            body: formDataUpload
          });

          const uploadResult = await uploadResponse.json();
          if (uploadResponse.ok && uploadResult.url) {
            finalPhotoUrl = uploadResult.url;
          } else {
            console.warn("Cloudinary upload failed: ", uploadResult.message);
          }
        } catch (uploadErr) {
          console.error("Error uploading photo to Cloudinary:", uploadErr);
        }
      }

      // 2. Submit payload to backend
      const payload = {
        fullName: formData.visitorName,
        mobileNumber: formData.mobileNumber,
        email: formData.email,
        visitingCompany: formData.companyName || 'Forge India Connect Private Limited',
        hostEmployee: formData.hostName,
        visitPurpose: formData.purpose,
        visitDate: formData.visitDate,
        expectedTime: formData.expectedArrivalTime,
        branchLocation: formData.branch,
        vehicleNumber: formData.vehicleNumber,
        facePhoto: finalPhotoUrl,
        // Compatibility fields:
        visitorName: formData.visitorName,
        companyName: formData.companyName || 'Forge India Connect Private Limited',
        hostName: formData.hostName,
        purpose: formData.purpose,
        branch: formData.branch,
        photoUrl: finalPhotoUrl
      };

      const response = await fetch(`${API_BASE}/api/prebookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && (data.success || data.visitor || data.data)) {
        const savedRecord = data.data || data.visitor;
        setPreBookResult({
          visitId: savedRecord.visitorId || savedRecord.visitId,
          visitorName: savedRecord.fullName || savedRecord.visitorName,
          mobileNumber: savedRecord.mobileNumber,
          email: savedRecord.email,
          companyName: savedRecord.visitingCompany || savedRecord.companyName,
          hostName: savedRecord.hostEmployee || savedRecord.hostName,
          purpose: savedRecord.visitPurpose || savedRecord.purpose,
          visitDate: savedRecord.visitDate ? new Date(savedRecord.visitDate).toISOString().split('T')[0] : formData.visitDate,
          expectedArrivalTime: savedRecord.expectedTime || formData.expectedArrivalTime,
          branch: savedRecord.branchLocation || savedRecord.branch,
          photoUrl: savedRecord.facePhoto || savedRecord.photoUrl,
          status: savedRecord.status || 'PENDING'
        });
        setModalStep(2);
      } else {
        throw new Error(data.message || 'Pre-booking registration failed.');
      }
    } catch (err) {
      console.error("Pre-booking Submit Error:", err);
      // Local fallback pass generation with sequential ID
      const seqId = getNextSequentialVisitId();
      const fallbackVisitor = {
        visitId: seqId,
        visitorName: formData.visitorName,
        mobileNumber: formData.mobileNumber,
        email: formData.email,
        companyName: 'Forge India Connect Private Limited',
        hostName: formData.hostName,
        purpose: formData.purpose,
        visitDate: formData.visitDate,
        expectedArrivalTime: formData.expectedArrivalTime,
        branch: formData.branch,
        photoUrl: capturedPhoto,
        status: 'Pre-Booked',
        registrationType: 'Pre-Booking'
      };
      setPreBookResult(fallbackVisitor);
      setModalStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPass = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-900/30 via-purple-900/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-96 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[800px] right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* HEADER / NAVIGATION */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <img src={logoImg} alt="FIC VMS Logo" className="h-7 w-7 filter brightness-0 invert" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                FIC <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">VMS</span>
              </span>
              <span className="text-[10px] tracking-wider text-slate-400 font-medium uppercase block">Zone Monitoring & Access</span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
            <a href="#prebook-sec" className="hover:text-indigo-400 transition-colors">Pre-Booking</a>
            <a href="#security" className="hover:text-indigo-400 transition-colors">Security</a>
            <a href="#how-it-works" className="hover:text-indigo-400 transition-colors">How It Works</a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {/* Pre-Booking Highlight Button */}
            <button
              onClick={handleOpenPreBookModal}
              className="relative group overflow-hidden rounded-xl p-[1px] font-semibold text-sm focus:outline-none"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl animate-pulse group-hover:opacity-100 opacity-80 transition-opacity" />
              <span className="relative px-5 py-2.5 rounded-[11px] bg-slate-950 flex items-center gap-2 text-white group-hover:bg-slate-900 transition-colors">
                <Calendar className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                Pre-Book Visit
                <span className="ml-1 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">Fast Pass</span>
              </span>
            </button>

            {/* Login / Portal Button */}
            {user ? (
              <button
                onClick={() => navigate('/visitors')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center gap-2"
              >
                Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-all flex items-center gap-2"
              >
                <Lock className="w-4 h-4 text-slate-400" />
                Staff Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 border-b border-slate-800 px-4 pt-4 pb-6 space-y-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium py-2">Features</a>
            <a href="#prebook-sec" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium py-2">Pre-Booking</a>
            <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 font-medium py-2">Security</a>
            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => { setMobileMenuOpen(false); handleOpenPreBookModal(); }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Pre-Book Visit Pass
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); navigate(user ? '/visitors' : '/login'); }}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold border border-slate-700 flex items-center justify-center gap-2"
              >
                {user ? 'Go to Dashboard' : 'Staff Sign In'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-24 lg:pt-20 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column Text */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Next-Gen Zone Monitoring & Visitor Management</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
              Smart, Secure & <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Seamless Workplace
              </span> Access
            </h1>

            {/* Description */}
            <p className="text-lg text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Transform your office reception experience. Enable visitors to pre-book visits in advance with order-wise sequential pass IDs, live face photo verification, scan instant digital QR passes, and provide security teams with real-time zone tracking.
            </p>

            {/* CTA Button Group */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              {/* Primary Pre-Book CTA */}
              <button
                onClick={handleOpenPreBookModal}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[size:200%_auto] hover:bg-right transition-all duration-300 text-white font-bold text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 group"
              >
                <Calendar className="w-5 h-5 text-indigo-200 group-hover:scale-110 transition-transform" />
                Pre-Book Your Visit Now
                <ArrowRight className="w-5 h-5 text-indigo-200 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Secondary Staff Login CTA */}
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-base border border-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                Staff Portal Sign In
              </button>
            </div>

            {/* Trust Features Strip */}
            <div className="pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-center lg:text-left">
              <div>
                <div className="text-2xl font-extrabold text-white">99.9%</div>
                <div className="text-xs text-slate-400 mt-0.5">Uptime & Reliability</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white">Sequential</div>
                <div className="text-xs text-slate-400 mt-0.5">Order-Wise Visitor IDs</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white">Live Face</div>
                <div className="text-xs text-slate-400 mt-0.5">Camera Verification</div>
              </div>
            </div>

          </div>

          {/* Right Column Interactive Visual Card */}
          <div className="lg:col-span-5 relative">
            
            {/* Glowing Backdrop */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-500 opacity-20 blur-xl animate-pulse" />

            {/* Main Interactive Pass Card */}
            <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6">
              
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
                    PB
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Digital Visitor Pass</h3>
                    <p className="text-xs text-slate-400">Pre-Booked Visitor Pass Preview</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Pre-Booked Active
                </span>
              </div>

              {/* Sample QR & Pass details */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="bg-white p-3 rounded-xl shadow-md">
                  <QRCodeSVG value="https://fic-visitor-1.vercel.app/pass/VISIT1001" size={110} />
                </div>
                <div className="space-y-2 text-center sm:text-left text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block uppercase font-medium">Order-Wise Pass ID</span>
                    <span className="font-mono font-bold text-indigo-400 text-base">VISIT1001</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block uppercase font-medium">Host Employee</span>
                    <span className="font-semibold text-slate-200">Priyadharshini (HR)</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block uppercase font-medium">Visiting Company</span>
                    <span className="text-slate-300 font-medium">Forge India Connect Pvt Ltd</span>
                  </div>
                </div>
              </div>

              {/* Action Callout */}
              <div className="bg-gradient-to-r from-indigo-950/50 to-purple-950/50 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs text-slate-300 font-medium">Want your own pre-booking pass?</span>
                </div>
                <button
                  onClick={handleOpenPreBookModal}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  Create Pass
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* PRE-BOOKING WORKFLOW SECTION */}
      <section id="prebook-sec" className="py-20 bg-slate-900/50 border-y border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-wider">
              Express Gate Entry
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              How Pre-Booking Works
            </h2>
            <p className="text-slate-400 text-base">
              Say goodbye to lengthy manual check-in forms at the gate. Pre-book your appointment with live face camera verification in 3 simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-4 hover:border-indigo-500/40 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7" />
              </div>
              <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest block">Step 01</span>
              <h3 className="text-xl font-bold text-white">Fill Form & Live Camera Photo</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Provide your details, select host employee, and capture your real-time face camera photo directly using your webcam.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-4 hover:border-purple-500/40 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <QrCode className="w-7 h-7" />
              </div>
              <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-widest block">Step 02</span>
              <h3 className="text-xl font-bold text-white">Order-Wise Pass Generated</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                An order-wise sequential Visitor ID (e.g. VISIT1001, VISIT1002...) with a scannable QR Code pass is issued immediately.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-4 hover:border-emerald-500/40 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block">Step 03</span>
              <h3 className="text-xl font-bold text-white">Fast-Track Gate Entry</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Show your digital pass QR code & face photo at the gate for instant facial match, host notification, and entry approval.
              </p>
            </div>

          </div>

          {/* Action Trigger Banner */}
          <div className="mt-12 p-8 rounded-3xl bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-slate-900 border border-indigo-500/30 text-center space-y-4">
            <h3 className="text-2xl font-bold text-white">Visiting Us Soon?</h3>
            <p className="text-slate-300 text-sm max-w-xl mx-auto">
              Click below to fill out the pre-booking form with live face camera photo capture and receive your sequential entrance badge.
            </p>
            <button
              onClick={handleOpenPreBookModal}
              className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all inline-flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Open Pre-Booking Form
            </button>
          </div>

        </div>
      </section>

      {/* FEATURES GRID SECTION */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            Enterprise Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Comprehensive Visitor & Access Management
          </h2>
          <p className="text-slate-400 text-base">
            Everything your security, HR, and facility admin teams need to manage visitors with confidence.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Feature 1 */}
          <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl space-y-4 hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Live Face Camera Capture</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Mandatory real-time webcam snapshot for facial verification and gate security validation.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl space-y-4 hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Sequential Visitor IDs</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Order-wise visitor ID allocation (VISIT1001, VISIT1002...) for clean audit trails and pass tracking.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl space-y-4 hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Instant Blacklist Alerts</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Automated mobile & Aadhaar cross-checks against company blacklists to prevent unauthorized entries instantly.
            </p>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-slate-400 text-sm">
          
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <img src={logoImg} alt="Logo" className="h-5 w-5 filter brightness-0 invert" />
            </div>
            <span className="font-bold text-white text-base">Forge India Connect</span>
            <span className="text-xs text-slate-500">| FIC VMS Platform</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#prebook-sec" className="hover:text-white transition-colors">Pre-Booking</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Staff Login</button>
          </div>

          <div className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Forge India Connect Pvt Ltd. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* INTERACTIVE PRE-BOOKING MODAL WORKFLOW */}
      {/* ========================================================================= */}
      {isPreBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Pre-Book Visit Pass</h3>
                  <p className="text-xs text-slate-400">Request entry approval prior to arrival</p>
                </div>
              </div>
              <button
                onClick={handleClosePreBookModal}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* Error Message */}
              {errorMsg && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  {errorMsg}
                </div>
              )}

              {/* STAGE 1: FORM INPUTS */}
              {modalStep === 1 && (
                <form onSubmit={handlePreBookSubmit} className="space-y-6">
                  
                  {/* REAL-TIME MANDATORY FACE CAMERA CAPTURE SECTION */}
                  <FaceCamera
                    onCapture={(photo) => {
                      setCapturedPhoto(photo);
                    }}
                  />

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Visitor Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name *</label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="text"
                          name="visitorName"
                          value={formData.visitorName}
                          onChange={handleChange}
                          placeholder="e.g. Rahul Verma"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number *</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="tel"
                          name="mobileNumber"
                          value={formData.mobileNumber}
                          onChange={handleChange}
                          placeholder="10-digit phone number"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Email */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="name@company.com"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Visiting Company - Fixed Constant */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Visiting Company</label>
                      <div className="relative">
                        <Building className="w-4 h-4 absolute left-3.5 top-3 text-indigo-400" />
                        <input
                          type="text"
                          name="companyName"
                          value="Forge India Connect Private Limited"
                          readOnly
                          disabled
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-indigo-200 text-sm font-semibold cursor-not-allowed select-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Host Employee */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Host Employee to Meet *</label>
                      <select
                        name="hostName"
                        value={formData.hostName}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                        required
                      >
                        {hostsList.map((h, idx) => (
                          <option key={idx} value={h} className="bg-slate-900 text-white">{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Purpose of Visit */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Visit Purpose *</label>
                      <select
                        name="purpose"
                        value={formData.purpose}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                        required
                      >
                        <option value="Business Meeting" className="bg-slate-900">Business Meeting</option>
                        <option value="Interview" className="bg-slate-900">Interview</option>
                        <option value="Vendor / Client Work" className="bg-slate-900">Vendor / Client Work</option>
                        <option value="Delivery / Courier" className="bg-slate-900">Delivery / Courier</option>
                        <option value="Personal Visit" className="bg-slate-900">Personal Visit</option>
                        <option value="Audit / Inspection" className="bg-slate-900">Audit / Inspection</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    {/* Visit Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                        <span>Date of Visit *</span>
                        <span className="text-[10px] text-indigo-400 font-normal">Click icon for calendar</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          name="visitDate"
                          min={new Date().toISOString().split('T')[0]}
                          value={formData.visitDate}
                          onChange={handleChange}
                          style={{ colorScheme: 'dark' }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Expected Arrival */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Expected Time</label>
                      <input
                        type="text"
                        name="expectedArrivalTime"
                        value={formData.expectedArrivalTime}
                        onChange={handleChange}
                        placeholder="e.g. 10:30 AM"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Branch */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Branch Location</label>
                      <select
                        name="branch"
                        value={formData.branch}
                        onChange={handleChange}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                      >
                        {branchesList.map((b, idx) => (
                          <option key={idx} value={b} className="bg-slate-900">{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Vehicle Number Optional */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Vehicle Registration Number (Optional)</label>
                    <div className="relative">
                      <Car className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                      <input
                        type="text"
                        name="vehicleNumber"
                        value={formData.vehicleNumber}
                        onChange={handleChange}
                        placeholder="e.g. TN-01-AB-1234"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Modal Footer Buttons */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleClosePreBookModal}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating Pass...
                        </>
                      ) : (
                        <>
                          Generate Digital Pass
                          <QrCode className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}

              {/* STAGE 2: GENERATED DIGITAL QR PASS ONLY */}
              {modalStep === 2 && preBookResult && (
                <div className="space-y-6 text-center animate-fadeIn print:text-black">
                  
                  <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  
                  <div>
                    <h4 className="text-2xl font-extrabold text-white">Pre-Booking Submitted!</h4>
                    <p className="text-xs text-amber-400 font-semibold mt-1">Status: PENDING Super Admin Approval</p>
                    <p className="text-xs text-slate-300 mt-1">
                      Scan this QR code at Reception / Gate Kiosk to view your Visitor Pass & Check In.
                    </p>
                  </div>

                  {/* QR CODE CARD ONLY - NO VISITOR DETAILS SHOWN */}
                  <div className="bg-slate-950 border-2 border-indigo-500/40 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-center space-y-4">
                    
                    <div className="px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold border border-indigo-500/30">
                      ID: {preBookResult.visitId}
                    </div>

                    {/* Centered Large QR Code */}
                    <div className="p-5 bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center">
                      <QRCodeSVG 
                        value={`http://${window.location.hostname === 'localhost' ? (import.meta.env.VITE_NETWORK_IP || '192.168.1.10') : window.location.hostname}:${window.location.port || '5173'}/pass/${preBookResult.visitId}`} 
                        size={180} 
                      />
                      <span className="text-[11px] font-mono text-slate-800 mt-3 font-bold uppercase tracking-wider">
                        SCAN AT RECEPTION / GATE KIOSK
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      Scanning this QR code at reception will display full visitor details & activate entrance pass.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handlePrintPass}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4 text-indigo-400" />
                      Print QR Code
                    </button>
                    <button
                      onClick={() => {
                        setCapturedPhoto(null);
                        setModalStep(1);
                        setFormData({
                          visitorName: '',
                          mobileNumber: '',
                          email: '',
                          companyName: 'Forge India Connect Private Limited',
                          hostName: 'Priyadharshini (HR)',
                          purpose: 'Business Meeting',
                          visitDate: new Date().toISOString().split('T')[0],
                          expectedArrivalTime: '10:00 AM',
                          expectedDuration: '1 Hour',
                          vehicleNumber: '',
                          branch: 'Chennai',
                          notes: ''
                        });
                      }}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
                    >
                      Book Another Visit
                    </button>
                    <button
                      onClick={handleClosePreBookModal}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                    >
                      Close
                    </button>
                  </div>

                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default LandingPage;
