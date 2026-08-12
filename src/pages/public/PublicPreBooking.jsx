import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, User, Clock, Building, CheckCircle2, Phone, Mail, 
  Car, ShieldAlert, ArrowLeft, Printer, QrCode, Sparkles 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import FaceCamera from '../../components/FaceCamera';
import logoImg from '../../assets/logo.svg';

const PublicPreBooking = () => {
  const navigate = useNavigate();

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
    vehicleNumber: '',
    branch: 'Chennai',
  });

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [preBookResult, setPreBookResult] = useState(null);
  const [step, setStep] = useState(1); // 1: Form, 2: Success QR Pass

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePrintPass = () => {
    window.print();
  };

  const handleSubmit = async (e) => {
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
    if (!capturedPhoto) {
      setErrorMsg('Face photo capture is mandatory to pre-book a visit pass.');
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
        setStep(2);
      } else {
        throw new Error(data.message || 'Pre-booking registration failed.');
      }
    } catch (err) {
      console.error("Pre-booking Submit Error:", err);
      setErrorMsg(err.message || 'Failed to submit pre-booking request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClassName = "block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 hover:bg-gray-50/80 transition-all duration-300 text-gray-800 placeholder-gray-400 font-medium";
  const selectClassName = "block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 hover:bg-gray-50/80 transition-all duration-300 text-gray-700 font-semibold";

  return (
    <div className="min-h-screen bg-moving-gradient relative overflow-x-hidden flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      {/* White background overlay */}
      <div className="absolute inset-0 bg-white/85 pointer-events-none -z-10" />

      {/* Decorative floating yellow & blue blobs */}
      <div className="fixed -top-20 -left-20 w-96 h-96 bg-amber-200/50 rounded-full blur-[100px] pointer-events-none animate-float-bg -z-10" />
      <div className="fixed -bottom-20 -right-20 w-96 h-96 bg-sky-200/50 rounded-full blur-[100px] pointer-events-none animate-float-bg-reverse -z-10" />
      <div className="fixed top-1/3 right-1/4 w-72 h-72 bg-indigo-100/30 rounded-full blur-[90px] pointer-events-none animate-float-bg -z-10" />

      {/* Header Bar */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between mb-8 z-10">
        <button 
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm transition-all text-xs font-semibold"
        >
          <ArrowLeft size={14} /> Back to Sign In
        </button>
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Forge India Logo" className="h-14 w-14 object-contain" />
          <span className="font-black text-gray-950 text-base tracking-tight">Forge India Connect</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="max-w-3xl w-full mx-auto bg-white border border-gray-100 border-t-4 border-t-[#FFC20E] rounded-3xl shadow-2xl p-6 sm:p-8 flex-grow flex flex-col justify-center z-10">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="text-[var(--color-brand-indigo)] w-6 h-6 animate-pulse" /> Visitor Registration
              </h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto font-medium">
                Complete photo capture and meeting details to generate your official pass.
              </p>
            </div>

            {/* Camera Component Section */}
            <div className="bg-slate-50/50 border border-gray-100 rounded-2xl p-4 shadow-inner">
              <FaceCamera onCapture={(photo) => setCapturedPhoto(photo)} />
            </div>

            {/* Form Fields Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                  <input
                    type="text"
                    name="visitorName"
                    value={formData.visitorName}
                    onChange={handleChange}
                    placeholder="e.g. Rahul Verma"
                    className={inputClassName}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Mobile Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                  <input
                    type="tel"
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleChange}
                    placeholder="10-digit phone number"
                    className={inputClassName}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@company.com"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Visiting Company</label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                  <input
                    type="text"
                    name="companyName"
                    value="Forge India Connect Private Limited"
                    readOnly
                    disabled
                    className="block w-full pl-10 pr-3 py-2.5 border border-indigo-100 rounded-xl text-sm bg-indigo-50/30 text-indigo-900 font-bold cursor-not-allowed select-none transition-shadow"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Host Employee to Meet *</label>
                <select
                  name="hostName"
                  value={formData.hostName}
                  onChange={handleChange}
                  className={selectClassName}
                >
                  {hostsList.map((host, idx) => (
                    <option key={idx} value={host}>{host}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Purpose of Visit *</label>
                <select
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  className={selectClassName}
                >
                  <option value="Business Meeting">Business Meeting</option>
                  <option value="Job Interview">Job Interview</option>
                  <option value="Vendor / Client visit">Vendor / Client visit</option>
                  <option value="Delivery / Courier">Delivery / Courier</option>
                  <option value="Personal Visit">Personal Visit</option>
                  <option value="Audit / Inspection">Audit / Inspection</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Date of Visit *</label>
                <input
                  type="date"
                  name="visitDate"
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.visitDate}
                  onChange={handleChange}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 text-gray-800 transition-shadow font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Expected Arrival Time</label>
                <input
                  type="text"
                  name="expectedArrivalTime"
                  value={formData.expectedArrivalTime}
                  onChange={handleChange}
                  placeholder="e.g. 10:30 AM"
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 text-gray-800 transition-shadow font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Branch Location</label>
                <select
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  className={selectClassName}
                >
                  {branchesList.map((b, idx) => (
                    <option key={idx} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Vehicle Registration Number (Optional)</label>
              <div className="relative">
                <Car className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                <input
                  type="text"
                  name="vehicleNumber"
                  value={formData.vehicleNumber}
                  onChange={handleChange}
                  placeholder="e.g. TN-01-AB-1234"
                  className={inputClassName}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 transform active:scale-[0.99] text-base"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Pass...
                </>
              ) : (
                <>
                  Generate Pre-Booking Pass
                  <QrCode className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-center animate-fadeIn py-6">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 mb-1 shadow-sm">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            
            <div>
              <h4 className="text-2xl font-black text-gray-900 tracking-tight">Pre-Booking Submitted!</h4>
              <p className="text-xs text-amber-600 font-bold mt-1 bg-amber-50 inline-block px-3 py-1 rounded-full border border-amber-100">Status: PENDING Approval</p>
              <p className="text-xs text-gray-500 mt-3 max-w-sm mx-auto font-medium leading-relaxed">
                Scan this QR code or present your Visitor ID at the gate reception kiosk to complete entry validation.
              </p>
            </div>

            {/* QR Card */}
            <div className="bg-slate-50 border border-gray-200/80 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
              <div className="px-4 py-1.5 rounded-full bg-indigo-50 text-[var(--color-brand-indigo)] text-xs font-mono font-bold border border-indigo-100 shadow-sm">
                ID: {preBookResult.visitId}
              </div>

              <div className="p-5 bg-white rounded-3xl shadow-md flex flex-col items-center justify-center border border-gray-100">
                <QRCodeSVG 
                  value={`http://${window.location.hostname === 'localhost' ? (import.meta.env.VITE_NETWORK_IP || '192.168.1.10') : window.location.hostname}:${window.location.port || '5173'}/pass/${preBookResult.visitId}`} 
                  size={180} 
                />
                <span className="text-[10px] font-mono text-slate-700 mt-3 font-bold uppercase tracking-wider">
                  SCAN AT GATE / RECEPTION KIOSK
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-4">
              <button
                onClick={handlePrintPass}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-gray-300 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4 text-[var(--color-brand-indigo)]" />
                Print Pass
              </button>
              <button
                onClick={() => {
                  setCapturedPhoto(null);
                  setStep(1);
                  setFormData({
                    visitorName: '',
                    mobileNumber: '',
                    email: '',
                    companyName: 'Forge India Connect Private Limited',
                    hostName: 'Priyadharshini (HR)',
                    purpose: 'Business Meeting',
                    visitDate: new Date().toISOString().split('T')[0],
                    expectedArrivalTime: '10:00 AM',
                    vehicleNumber: '',
                    branch: 'Chennai',
                  });
                }}
                className="px-5 py-2.5 rounded-xl bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-semibold text-xs transition-colors shadow-md"
              >
                Book Another Visit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-slate-400 mt-8 font-medium">
        &copy; {new Date().getFullYear()} Forge India Connect Pvt Ltd. All rights reserved.
      </div>
    </div>
  );
};

export default PublicPreBooking;
