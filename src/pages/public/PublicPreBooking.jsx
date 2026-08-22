import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, User, Clock, Building, CheckCircle2, Phone, Mail, 
  Car, ShieldAlert, ArrowLeft, Printer, QrCode, Sparkles, Upload, FileText, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import FaceCamera from '../../components/FaceCamera';
import logoImg from '../../assets/logo.svg';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TimeDropdown from '../../components/TimeDropdown';

const formatTimeTo12Hour = (timeStr) => {
  if (!timeStr) return '';
  if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
    return timeStr;
  }
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = hours < 10 ? '0' + hours : hours;
  return `${formattedHours}:${minutes} ${ampm}`;
};

const hostOptions = [
  { label: "Priyadharshini (HR)", name: "Priyadharshini", dbName: "PRIYADHARSHINI" },
  { label: "Ganesh Kumar (HR)", name: "Ganesh Kumar", dbName: "GANESH KUMAR" },
  { label: "Sandeep (CEO Sir)", name: "Sandeep", dbName: "SANDEEP" },
  { label: "Avinash (MD Sir)", name: "Avinash", dbName: "AVINASH" },
  { label: "Sabari (Admin)", name: "Sabari", dbName: "SABARI" },
  { label: "Agila (IT)", name: "Agila", dbName: "AGILA" },
  { label: "Joe Christo (Senior HR)", name: "Joe Christo", dbName: "JOE CHRISTO" },
  { label: "Direct Visits", name: "Direct Visits", dbName: "DIRECT VISITS" }
];

const isAllowedDay = (date) => {
  const day = date.getDay();
  // Monday = 1, Wednesday = 3, Saturday = 6
  return [1, 3, 6].includes(day);
};

const getNextAllowedVisitDate = () => {
  const d = new Date();
  while (![1, 3, 6].includes(d.getDay())) {
    d.setDate(d.getDate() + 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const PublicPreBooking = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    visitorName: '',
    mobileNumber: '',
    email: '',
    companyName: 'Forge India Connect Private Limited',
    hostName: '',
    assignedHr: '',
    selectedHostLabel: '',
    purpose: 'Business Meeting',
    visitDate: getNextAllowedVisitDate(),
    expectedArrivalTime: '10:00',
    vehicleNumber: '',
    branch: 'Head Office(KRISHNAGIRI)',
    idType: '',
    idProofUrl: '',
  });

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [idProofPreview, setIdProofPreview] = useState('');
  const [uploadingIdProof, setUploadingIdProof] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [alreadyRegisteredModal, setAlreadyRegisteredModal] = useState(false);
  const [preBookResult, setPreBookResult] = useState(null);
  const [step, setStep] = useState(1); // 1: Form, 2: Success QR Pass

  const [hrUsers, setHrUsers] = useState([]);

  const getHrId = (dbName) => {
    if (!dbName || dbName === 'DIRECT VISITS') return '';
    const found = hrUsers.find(u => u.name.toUpperCase().replace(/\s/g, '') === dbName.replace(/\s/g, ''));
    if (found) return found._id || found.id;
    // Fallback to Priyadharshini's ID for other normal visitors
    const priya = hrUsers.find(u => u.name.toUpperCase().includes('PRIYA'));
    if (priya) return priya._id || priya.id;
    return hrUsers.length > 0 ? (hrUsers[0]._id || hrUsers[0].id) : '';
  };

  const branchesList = ['Head Office(KRISHNAGIRI)', 'Bangalore'];

  const _rawUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
  const API_BASE = _rawUrl.replace(/\/api\/?$/, '');

  useEffect(() => {
    const fetchHRUsers = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/users/hr`);
        const result = await response.json();
        if (response.ok && result.success && result.data) {
          setHrUsers(result.data);
        }
      } catch (err) {
        console.error("Error loading HR users:", err);
      }
    };
    fetchHRUsers();
  }, [API_BASE]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mobileNumber') {
      const cleanVal = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: cleanVal }));

      if (cleanVal.length === 0) {
        setMobileError("");
      } else if (!/^[6-9]\d{9}$/.test(cleanVal)) {
        setMobileError("Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
      } else {
        setMobileError("");
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleIdProofChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setIdProofPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    setUploadingIdProof(true);
    setErrorMsg('');
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("photo", file);

      const uploadResponse = await fetch(`${API_BASE}/api/visitors/upload`, {
        method: "POST",
        body: formDataUpload
      });

      const uploadResult = await uploadResponse.json();
      if (uploadResponse.ok && uploadResult.url) {
        setFormData(prev => ({ ...prev, idProofUrl: uploadResult.url }));
      } else {
        console.error("Cloudinary upload failed: ", uploadResult.message);
        setErrorMsg("Failed to upload ID proof photo. Please try again.");
      }
    } catch (uploadErr) {
      console.error("Error uploading ID proof:", uploadErr);
      setErrorMsg("Error uploading ID proof photo.");
    } finally {
      setUploadingIdProof(false);
    }
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
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(formData.mobileNumber.trim())) {
      setMobileError('Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      setErrorMsg('Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    } else {
      setMobileError('');
    }
    if (!formData.visitDate) {
      setErrorMsg('Please select a visit date.');
      return;
    }
    const chosenDate = new Date(`${formData.visitDate}T00:00:00`);
    if (!isAllowedDay(chosenDate)) {
      setErrorMsg('Visits can only be booked on Monday, Wednesday, or Saturday.');
      return;
    }
    if (!capturedPhoto) {
      setErrorMsg('Face photo capture is mandatory to pre-book a visit pass.');
      return;
    }
    if (uploadingIdProof) {
      setErrorMsg('Please wait for the ID proof photo to finish uploading.');
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
        expectedTime: formatTimeTo12Hour(formData.expectedArrivalTime),
        branchLocation: formData.branch,
        vehicleNumber: formData.vehicleNumber,
        facePhoto: finalPhotoUrl,
        idType: formData.idType,
        idProofUrl: formData.idProofUrl,
        assignedHr: formData.assignedHr,
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

      if (response.status === 409 || data.code === "ALREADY_REGISTERED") {
        const errorText = "Already Registered — You already have an active pre-booking. Please wait until your existing visit is completed before registering again.";
        setErrorMsg(errorText);
        setAlreadyRegisteredModal(true);
        return;
      }

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
          idType: savedRecord.idType || formData.idType,
          idProofUrl: savedRecord.idProofUrl || formData.idProofUrl,
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

  const handleDownloadQR = () => {
    try {
      const svgElement = document.querySelector('#prebooking-qr-code svg') || document.querySelector('.prebooking-qr-box svg') || document.querySelector('svg');
      if (!svgElement) {
        alert("QR Code element not found for download.");
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const padding = 40;
        const qrSize = 300;
        canvas.width = qrSize + (padding * 2);
        canvas.height = qrSize + (padding * 2) + 90;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        ctx.drawImage(image, padding, padding, qrSize, qrSize);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        const visitIdText = preBookResult?.visitId ? `ID: ${preBookResult.visitId}` : 'VISITOR PASS QR';
        ctx.fillText(visitIdText, canvas.width / 2, padding + qrSize + 35);

        ctx.fillStyle = '#475569';
        ctx.font = '12px sans-serif';
        ctx.fillText('SCAN AT GATE / RECEPTION KIOSK', canvas.width / 2, padding + qrSize + 58);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `PreBooking_QR_${preBookResult?.visitId || 'Pass'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error("QR Download Error:", err);
      alert("Failed to download QR Code image.");
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
      <div className="max-w-3xl w-full mx-auto flex items-center justify-center mb-8 z-10">
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
                    inputMode="numeric"
                    maxLength={10}
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={handleChange}
                    placeholder="Enter 10-digit mobile number"
                    className={`${inputClassName} ${mobileError ? 'border-red-500 focus:ring-red-500' : ''}`}
                    required
                  />
                </div>
                {mobileError && (
                  <p className="text-red-500 text-xs mt-1 font-semibold flex items-center gap-1">
                    ⚠️ {mobileError}
                  </p>
                )}
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
                  name="assignedHr"
                  value={formData.selectedHostLabel || ""}
                  onChange={(e) => {
                    const label = e.target.value;
                    const option = hostOptions.find(o => o.label === label);
                    const resolvedId = getHrId(option ? option.dbName : '');
                    setFormData(prev => ({
                      ...prev,
                      selectedHostLabel: label,
                      assignedHr: resolvedId,
                      hostName: option ? option.name : ''
                    }));
                  }}
                  className={selectClassName}
                  required
                >
                  <option value="">Select Host</option>
                  {hostOptions.map((opt, idx) => (
                    <option key={idx} value={opt.label}>{opt.label}</option>
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
                  <option value="Interview">Interview</option>
                  <option value="Vendor / Client visit">Vendor / Client visit</option>
                  <option value="Delivery / Courier">Delivery / Courier</option>
                  <option value="Personal Visit">Personal Visit</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Date of Visit *</label>
                <DatePicker
                  selected={formData.visitDate ? new Date(`${formData.visitDate}T00:00:00`) : null}
                  onChange={(date) => {
                    if (!date) {
                      handleChange({ target: { name: 'visitDate', value: '' } });
                      return;
                    }
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const day = String(date.getDate()).padStart(2, "0");
                    handleChange({ target: { name: 'visitDate', value: `${year}-${month}-${day}` } });
                  }}
                  filterDate={isAllowedDay}
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select visit date"
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 text-gray-800 transition-shadow font-semibold cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Expected Arrival Time</label>
                <TimeDropdown
                  name="expectedArrivalTime"
                  value={formData.expectedArrivalTime}
                  onChange={handleChange}
                  className="block w-full py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 text-gray-800 transition-shadow font-semibold cursor-pointer"
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

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">ID Proof Type (Optional)</label>
                <select
                  name="idType"
                  value={formData.idType}
                  onChange={handleChange}
                  className={selectClassName}
                >
                  <option value="">-- Select ID Type --</option>
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Ration Card">Ration Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Other">Other ID Proof</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Upload ID Photo (Optional)</label>
                <div className="relative flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleIdProofChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-grow flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold py-3 px-4 rounded-xl transition-all shadow-sm h-11"
                  >
                    <Upload size={14} className="text-[var(--color-brand-indigo)]" />
                    {uploadingIdProof ? 'Uploading ID...' : 'Choose / Capture'}
                  </button>
                  {idProofPreview && (
                    <div className="w-11 h-11 rounded-xl overflow-hidden border border-gray-200 relative group flex-shrink-0">
                      <img src={idProofPreview} alt="ID Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setIdProofPreview('');
                          setFormData(prev => ({ ...prev, idProofUrl: '' }));
                        }}
                        className="absolute inset-0 bg-black/50 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
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
              {preBookResult.status === 'APPROVED' || preBookResult.status === 'Approved' ? (
                <p className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-50 inline-block px-3 py-1 rounded-full border border-emerald-100">Status: APPROVED ✓</p>
              ) : (
                <p className="text-xs text-amber-600 font-bold mt-1 bg-amber-50 inline-block px-3 py-1 rounded-full border border-amber-100">Status: PENDING Approval</p>
              )}
              <p className="text-xs text-gray-500 mt-3 max-w-sm mx-auto font-medium leading-relaxed">
                Scan this QR code or present your Visitor ID at the gate reception kiosk to complete entry validation.
              </p>
            </div>

            {/* QR Card */}
            <div className="bg-slate-50 border border-gray-200/80 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
              <div className="px-4 py-1.5 rounded-full bg-indigo-50 text-[var(--color-brand-indigo)] text-xs font-mono font-bold border border-indigo-100 shadow-sm">
                ID: {preBookResult.visitId}
              </div>

              <div id="prebooking-qr-code" className="p-5 bg-white rounded-3xl shadow-md flex flex-col items-center justify-center border border-gray-100 prebooking-qr-box">
                <QRCodeSVG 
                  value={window.location.hostname === 'localhost' ? `http://${import.meta.env.VITE_NETWORK_IP || '192.168.1.10'}:5173/pass/${preBookResult.visitId}` : `${window.location.origin}/pass/${preBookResult.visitId}`}
                  size={180} 
                />
                <span className="text-[10px] font-mono text-slate-700 mt-3 font-bold uppercase tracking-wider">
                  SCAN AT GATE / RECEPTION KIOSK
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleDownloadQR}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </button>
              <button
                type="button"
                onClick={handlePrintPass}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-gray-300 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
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
                    hostName: '',
                    purpose: 'Business Meeting',
                    visitDate: new Date().toISOString().split('T')[0],
                    expectedArrivalTime: '10:00 AM',
                    vehicleNumber: '',
                    branch: 'Head Office(KRISHNAGIRI)',
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

      {/* Already Registered Custom Modal */}
      {alreadyRegisteredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-amber-200 shadow-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 animate-scaleUp">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-200">
              <ShieldAlert size={36} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Already Registered</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed font-medium">
                You already have an active pre-booking. Please wait until your existing visit is completed before registering again.
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-xs font-semibold">
              🔒 Multiple active pre-bookings per visitor are restricted.
            </div>
            <button
              type="button"
              onClick={() => setAlreadyRegisteredModal(false)}
              className="w-full py-3 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-bold rounded-xl transition-all shadow-md text-sm cursor-pointer"
            >
              OK / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicPreBooking;
