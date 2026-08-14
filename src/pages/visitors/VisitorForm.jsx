import React, { useState } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useBlacklist } from '../../context/BlacklistContext';
import { useNotification } from '../../context/NotificationContext';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, User, Calendar, FileText, Camera, IdCard, Info, Search, AlertCircle, QrCode, X, Ban } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Webcam from 'react-webcam';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TimeDropdown from '../../components/TimeDropdown';

const VisitorForm = () => {
  const { addVisitor, allVisitors, networkIp } = useVisitors();
  const { isBlacklisted } = useBlacklist();
  const { addNotification } = useNotification();
  const { branches, activeBranch } = useBranch();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [hosts, setHosts] = useState([
    'Priyadharshini (HR)',
    'Sandhiya (HR)',
    'Ganesh Kumar (HR)',
    'R. Sandhiya (HR)',
    'Sandeep (CEO Sir)',
    'Avinash (MD Sir)',
    'Sabari (Admin)',
    'Agila (IT)',
    'Joe Christo (Senior HR)',
    'New Visitors'
  ]);

  const [isHostModalOpen, setIsHostModalOpen] = useState(false);

  const [newHostName, setNewHostName] = useState('');
  const [existingVisitorMatch, setExistingVisitorMatch] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showWebcamModal, setShowWebcamModal] = useState(false);
  const webcamRef = React.useRef(null);
  
  const [formData, setFormData] = useState({
    visitorName: '',
    mobileNumber: '',
    email: '',
    companyName: 'Forge India Connect Private Limited',
    hostName: '',
    visitorCount: 1,
    purpose: '',
    visitDate: new Date().toISOString().split('T')[0],
    expectedArrivalTime: '',
    hostNotes: '',
    status: 'Pending',
    photoUrl: '',
    branch: (user?.role === 'Super Admin' && activeBranch !== 'All Branches') ? activeBranch : ''
  });

  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [blacklistedVisitor, setBlacklistedVisitor] = useState(null);

  const checkBlacklist = async (mobileNumber) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp}:5000` : 'https://fic-visitor-1.onrender.com');
      const response = await fetch(`${API_URL}/api/blacklist/check/${mobileNumber}`, {
        headers: {
          'x-company-id': user?.companyId || 'FIC001',
          'Authorization': user?.token ? `Bearer ${user.token}` : ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.isBlacklisted) {
          setBlacklistedVisitor(data);
        } else {
          setBlacklistedVisitor(null);
        }
      }
    } catch (err) {
      console.error('Error checking blacklist:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Check for existing visitor when mobile number is typed
    if (name === 'mobileNumber' && value.length >= 10) {
      checkBlacklist(value);
      const existing = allVisitors.find(v => v.mobileNumber === value);
      if (existing) {
        setExistingVisitorMatch(existing);
      } else {
        setExistingVisitorMatch(null);
      }
    } else if (name === 'mobileNumber') {
      setExistingVisitorMatch(null);
      setBlacklistedVisitor(null);
    }
  };

  const fileInputRef = React.useRef(null);

  const uploadFileToCloudinary = async (file) => {
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);

    const data = new FormData();
    data.append('photo', file);

    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp}:5000` : 'https://fic-visitor-1.onrender.com');
      const response = await fetch(`${API_URL}/api/visitors/upload`, {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setFormData(prev => ({ ...prev, photoUrl: result.url }));
    } catch (error) {
      console.error('Error uploading photo:', error);
      addNotification('Upload Failed', 'Failed to upload photo. Please try again.', 'error');
      setPreviewUrl(''); // Clear the preview if upload fails
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadFileToCloudinary(file);
  };

  const handleWebcamCapture = React.useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setShowWebcamModal(false);
      // Convert base64 to File
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" });
          uploadFileToCloudinary(file);
        });
    }
  }, [webcamRef]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) {
      addNotification('Action Required', 'Please wait for the photo to finish uploading.', 'warning');
      return;
    }
    if (user?.role === 'Super Admin' && !formData.branch && activeBranch === 'All Branches') {
      addNotification('Action Required', 'Please select a branch location.', 'warning');
      return;
    }
    
    let submitStatus = 'Pending';
    if (blacklistedVisitor || isBlacklisted(formData.mobileNumber)) {
      submitStatus = 'Rejected';
      addNotification('Blocked Attempt Logged', 'The blacklisted attempt has been recorded in the security logs.', 'info');
    }
    
    let hostTeam = 'General';
    const match = formData.hostName.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      hostTeam = match[1].trim();
    }
    
    const finalData = { ...formData, hostTeam, status: submitStatus };
    addVisitor(finalData);
    navigate(submitStatus === 'Rejected' ? '/dashboard' : '/visitors');
  };

  // Reusable input class
  const inputClassName = "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[var(--color-brand-indigo)] focus:border-[var(--color-brand-indigo)] outline-none transition-shadow placeholder-gray-300";

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button 
          onClick={() => navigate('/visitors')}
          className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 text-gray-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Walk-in Visitor Registration</h1>
          <p className="text-gray-500 mt-1">For visitors who arrive at facility without prior registration.</p>
        </div>
      </div>

      {/* Registration Mode Tabs */}
      <div className="bg-slate-100 p-1.5 rounded-xl flex gap-2 shadow-inner border border-slate-200">
        <button
          type="button"
          onClick={() => navigate('/visitors/new')}
          className="flex-1 py-3 px-4 text-center font-bold text-sm rounded-lg bg-[var(--color-brand-indigo)] text-white shadow-md transition-all flex items-center justify-center gap-2"
        >
          <span>🚶 Walk-in Visitor</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-normal">Arrives First</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/visitors/pre-booking')}
          className="flex-1 py-3 px-4 text-center font-bold text-sm rounded-lg text-slate-700 hover:bg-white transition-all flex items-center justify-center gap-2"
        >
          <span>📅 Pre-Booking</span>
          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-normal">Register in Advance</span>
        </button>
      </div>



      {/* Info Tip Banner */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex gap-3 text-purple-800 shadow-sm">
        <Info className="flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-medium text-sm">Automated QR Pass Generation</p>
          <p className="text-xs opacity-80 mt-1">Fields marked with an asterisk (*) are mandatory. Once approved, the visitor will automatically receive a QR Code Entry Pass via SMS/Email.</p>
        </div>
      </div>

      {/* Blacklisted Visitor Alert */}
      {blacklistedVisitor && (
        <div className="bg-red-50 border-2 border-red-500 rounded-xl p-5 flex flex-col gap-4 items-start justify-between shadow-md animate-in slide-in-from-top-2">
          <div className="flex gap-3">
            <AlertCircle className="flex-shrink-0 mt-0.5 text-red-600" size={24} />
            <div>
              <p className="font-bold text-red-700 text-lg">🚨 BLOCKED VISITOR DETECTED</p>
              <p className="text-sm text-red-800 mt-1 font-medium">
                This mobile number has been blocked by the Super Admin. You cannot register this visitor.
              </p>
              {blacklistedVisitor.reason && (
                <div className="mt-3 bg-red-100 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold">
                  Reason: {blacklistedVisitor.reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Existing Visitor Alert */}
      {existingVisitorMatch && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm animate-in slide-in-from-top-2">
          <div className="flex gap-3">
            <AlertCircle className="flex-shrink-0 mt-0.5 text-blue-600" size={24} />
            <div>
              <p className="font-bold text-blue-900 text-lg">Already Registered Candidate Exists</p>
              <p className="text-sm text-blue-700 mt-1">
                A visitor with mobile number <strong>{existingVisitorMatch.mobileNumber}</strong> is already registered in the system as <strong>{existingVisitorMatch.visitorName}</strong>.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {existingVisitorMatch.qrCode && (
              <button 
                type="button"
                onClick={() => setShowQRModal(true)}
                className="px-4 py-2 bg-white text-blue-700 border border-blue-300 font-bold rounded-lg hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
              >
                <QrCode size={18} />
                View QR Pass
              </button>
            )}
            <button 
              type="button"
              onClick={() => navigate('/visitors/returning')}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
            >
              Go to Returning Visitor
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        

        {/* Section 1: Personal Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <User size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
          </div>
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input required type="text" name="visitorName" value={formData.visitorName} onChange={handleChange} className={inputClassName} placeholder="e.g., Jane Doe" />
              </div>
              {user?.role === 'Super Admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch Location *</label>
                  <select required name="branch" value={formData.branch} onChange={handleChange} className={`${inputClassName} bg-white`}>
                    <option value="">Select Branch</option>
                    {branches.filter(b => b !== 'All Branches').map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
                  <span>Mobile Number *</span>
                  <span className="text-[10px] text-gray-400">Auto-fills for returning visitors</span>
                </label>
                <input 
                  required 
                  type="tel" 
                  name="mobileNumber" 
                  value={formData.mobileNumber} 
                  onChange={handleChange} 
                  className={`${inputClassName} ${isBlacklisted(formData.mobileNumber) ? 'border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500' : ''}`} 
                  placeholder="e.g., 9876543210" 
                />
                {isBlacklisted(formData.mobileNumber) && (
                  <p className="text-xs text-red-600 mt-1.5 font-semibold flex items-center gap-1">
                    <AlertCircle size={12} /> This number is blacklisted. Registration blocked.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClassName} placeholder="e.g., jane@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Aadhaar Card Number *</label>
                <input required type="text" name="aadhaarNumber" value={formData.aadhaarNumber || ''} onChange={handleChange} className={inputClassName} placeholder="e.g., 1234 5678 9012" maxLength={14} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <input type="text" name="companyName" value={formData.companyName} readOnly className={`${inputClassName} bg-gray-100 text-gray-600 cursor-not-allowed`} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Visit Details */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
              <Calendar size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Visit Details</h3>
          </div>
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between items-center">
                  <span>Host Name *</span>
                  <button 
                    type="button" 
                    onClick={() => setIsHostModalOpen(true)}
                    className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-brand-indigo)] hover:bg-indigo-50 px-2 py-1 rounded border border-indigo-100 transition-colors"
                  >
                    + Add Host
                  </button>
                </label>
                <select required name="hostName" value={formData.hostName} onChange={handleChange} className={`${inputClassName} bg-white`}>
                  <option value="">Select Host</option>
                  {hosts.map(host => (
                    <option key={host} value={host}>{host}</option>
                  ))}
                </select>
              </div>
              {/* Number of Visitors field removed as per request */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purpose of Visit *</label>
                <select required name="purpose" value={formData.purpose} onChange={handleChange} className={`${inputClassName} bg-white`}>
                  <option value="">Select Purpose</option>
                  <option value="Interview">Interview</option>
                  <option value="Follow up">Follow up</option>
                  <option value="Job consulting">Job consulting</option>
                  <option value="Banking">Banking</option>
                  <option value="CEO meeting">CEO meeting</option>
                  <option value="Visitors">Visitors</option>
                  <option value="Guest">Guest</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Visit Date *</label>
                <DatePicker
                  required
                  selected={formData.visitDate ? new Date(formData.visitDate) : null}
                  onChange={(date) => {
                    if (date) {
                      handleChange({ target: { name: 'visitDate', value: date.toISOString().split('T')[0] }});
                    }
                  }}
                  minDate={new Date()}
                  dateFormat="yyyy-MM-dd"
                  className={inputClassName}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Arrival Time</label>
                <TimeDropdown
                  name="expectedArrivalTime"
                  value={formData.expectedArrivalTime}
                  onChange={handleChange}
                  className={`${inputClassName} !px-0`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes for Host (Optional)</label>
                <textarea name="hostNotes" value={formData.hostNotes} onChange={handleChange} rows="3" className={inputClassName} placeholder="Any specific instructions, parking requests, or context for the meeting..."></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Documents & Verification */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <FileText size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Documents & Verification</h3>
          </div>
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-blue-50 hover:border-blue-300 transition-colors group overflow-hidden">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handlePhotoUpload} 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                />
                
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                    <div className="relative z-10 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-sm mb-2">
                      {uploading ? (
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Camera className="text-green-600" size={24} />
                      )}
                    </div>
                    <p className="relative z-10 text-sm font-bold text-gray-900 bg-white/80 px-2 py-1 rounded mb-3">
                      {uploading ? 'Uploading...' : 'Photo Uploaded'}
                    </p>
                    <button 
                      type="button"
                      onClick={() => setPreviewUrl('')}
                      className="relative z-10 text-xs font-semibold text-red-600 bg-white/90 px-3 py-1 rounded-full shadow-sm hover:bg-red-50 transition-colors"
                    >
                      Clear & Retake
                    </button>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-gray-50 rounded-full group-hover:bg-blue-100 transition-colors mb-3">
                      <Camera className="text-gray-400 group-hover:text-blue-600 transition-colors" size={28} />
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-4">Capture Visitor Photo</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[200px]">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowWebcamModal(true); }}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        <Camera size={14} /> PC Webcam
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-800 text-xs font-bold py-2 px-3 rounded hover:bg-gray-300 transition-colors shadow-sm"
                      >
                        <Upload size={14} /> Upload / Mobile
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-4">
          <button type="button" onClick={() => navigate('/visitors')} className="px-6 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          {blacklistedVisitor ? (
            <button 
              type="submit" 
              className="px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 shadow-md"
            >
              <Ban size={20} />
              <span>Log Blocked Attempt</span>
            </button>
          ) : (
            <button 
              type="submit" 
              className="px-8 py-3 bg-[var(--color-brand-indigo)] text-white font-bold rounded-lg hover:bg-[var(--color-brand-indigo-light)] transition-colors flex items-center space-x-2 shadow-md"
            >
              <Save size={20} />
              <span>Generate Visitor Pass</span>
            </button>
          )}
        </div>
      </form>

      {/* Add Host Modal */}
      {isHostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="text-[var(--color-brand-indigo)]" size={18} />
                Add New Host
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsHostModalOpen(false);
                  setNewHostName('');
                }} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Host Name & Department</label>
              <input 
                type="text" 
                autoFocus
                value={newHostName} 
                onChange={(e) => setNewHostName(e.target.value)} 
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] transition-all" 
                placeholder="e.g. Mike Smith (Sales)" 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newHostName.trim() !== '') {
                      setHosts([...hosts, newHostName.trim()]);
                      setFormData({...formData, hostName: newHostName.trim()});
                      setIsHostModalOpen(false);
                      setNewHostName('');
                    }
                  }
                }}
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => {
                  setIsHostModalOpen(false);
                  setNewHostName('');
                }} 
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => {
                  if (newHostName.trim() !== '') {
                    setHosts([...hosts, newHostName.trim()]);
                    setFormData({...formData, hostName: newHostName.trim()});
                    setIsHostModalOpen(false);
                    setNewHostName('');
                  }
                }}
                className="px-4 py-2 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white rounded-lg transition-colors font-medium shadow-sm"
              >
                Add Host
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webcam Modal */}
      {showWebcamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Camera size={16} /> Live Webcam Capture
              </h3>
              <button 
                type="button"
                onClick={() => setShowWebcamModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="bg-black flex flex-col items-center justify-center relative">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full object-cover max-h-[60vh]"
              />
            </div>
            <div className="p-4 bg-slate-50 flex justify-center">
              <button 
                type="button"
                onClick={handleWebcamCapture}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg flex items-center gap-2 transition-transform active:scale-95"
              >
                <Camera size={20} /> Snap Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal for Existing Visitor */}
      {showQRModal && existingVisitorMatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <button 
              type="button"
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="mb-4 text-[var(--color-brand-indigo)] flex justify-center">
              <QrCode size={40} />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Existing Visitor Pass</h2>
            <p className="text-gray-500 text-sm mb-6">Scan with any phone camera</p>
            
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm inline-block mb-6">
              <QRCodeSVG 
                value={window.location.hostname === 'localhost' ? `http://${networkIp}:${window.location.port}/pass/${existingVisitorMatch.visitId || existingVisitorMatch.id}` : `${window.location.origin}/pass/${existingVisitorMatch.visitId || existingVisitorMatch.id}`} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-2">
              <p className="font-bold text-[var(--color-brand-indigo)]">{existingVisitorMatch.visitorName}</p>
              <p className="text-sm text-indigo-700 font-mono mt-1">{existingVisitorMatch.visitId}</p>
            </div>
            <p className="text-xs text-gray-400">Status: {existingVisitorMatch.status}</p>
          </div>
        </div>
      )}

    </div>
  );
};

export default VisitorForm;
