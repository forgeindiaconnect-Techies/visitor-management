import React, { useState, useRef } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useBlacklist } from '../../context/BlacklistContext';
import { useNotification } from '../../context/NotificationContext';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, User, Calendar, FileText, Camera, Shield, CheckCircle, Clock, Car, IdCard, Info, AlertCircle, QrCode, X, Ban } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { QRCodeSVG } from 'qrcode.react';
import TimeDropdown from '../../components/TimeDropdown';

const PreBookingForm = () => {
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
    'Direct Visits'
  ]);

  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [newHostName, setNewHostName] = useState('');
  const [existingVisitorMatch, setExistingVisitorMatch] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [blacklistedVisitor, setBlacklistedVisitor] = useState(null);
  const [mobileError, setMobileError] = useState('');

  const [formData, setFormData] = useState({
    visitorName: '',
    mobileNumber: '',
    email: '',
    companyName: 'Forge India Connect Private Limited',
    idType: 'Govt ID',
    vehicleNumber: '',
    hostName: '',
    purpose: '',
    visitDate: new Date().toISOString().split('T')[0],
    expectedArrivalTime: '10:00',
    expectedDuration: '1 Hour',
    notes: '',
    idProofUrl: '',
    registrationType: 'Pre-Booking',
    status: 'Pre-Booked',
    branch: (user?.role === 'Super Admin' && activeBranch !== 'All Branches') ? activeBranch : (user?.branch || 'Head Office(KRISHNAGIRI)')
  });

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [idDocPreview, setIdDocPreview] = useState('');
  const fileInputRef = useRef(null);

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
    let cleanVal = value;
    if (name === 'mobileNumber') {
      cleanVal = value.replace(/\D/g, '').slice(0, 10);
      if (cleanVal.length === 0) {
        setMobileError("");
      } else if (!/^[6-9]\d{9}$/.test(cleanVal)) {
        setMobileError("Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
      } else {
        setMobileError("");
      }
    }
    setFormData(prev => ({ ...prev, [name]: cleanVal }));

    if (name === 'mobileNumber' && cleanVal.length >= 10) {
      checkBlacklist(cleanVal);
      const existing = allVisitors.find(v => v.mobileNumber === cleanVal);
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

  const handleIdDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setIdDocPreview(objectUrl);
    setUploadingDoc(true);

    const data = new FormData();
    data.append('photo', file);

    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp}:5000` : 'https://fic-visitor-1.onrender.com');
      const response = await fetch(`${API_URL}/api/visitors/upload`, {
        method: 'POST',
        body: data,
      });

      if (!response.ok) throw new Error('Document upload failed');

      const result = await response.json();
      setFormData(prev => ({ ...prev, idProofUrl: result.url }));
      addNotification('ID Proof Uploaded', 'Document proof uploaded successfully.', 'success');
    } catch (error) {
      console.error('Error uploading ID document:', error);
      addNotification('Upload Failed', 'Failed to upload document proof. Please try again.', 'error');
      setIdDocPreview('');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleFormSubmit = async (e, isDraft = false) => {
    if (e) e.preventDefault();

    if (uploadingDoc) {
      addNotification('Action Required', 'Please wait for document upload to finish.', 'warning');
      return;
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test((formData.mobileNumber || '').trim())) {
      setMobileError('Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      addNotification('Validation Error', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.', 'error');
      return;
    } else {
      setMobileError('');
    }

    if (user?.role === 'Super Admin' && !formData.branch && activeBranch === 'All Branches') {
      addNotification('Action Required', 'Please select a branch location.', 'warning');
      return;
    }

    let submitStatus = isDraft ? 'Draft' : 'Pending Approval';
    if (blacklistedVisitor || isBlacklisted(formData.mobileNumber)) {
      submitStatus = 'Rejected';
      addNotification('Blocked Attempt Logged', 'The blacklisted visitor attempt has been logged.', 'info');
    }

    let hostTeam = 'General';
    const match = formData.hostName.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      hostTeam = match[1].trim();
    }

    const finalData = {
      ...formData,
      companyName: user?.companyName || 'Forge India Connect Private Limited',
      hostTeam,
      isDraft,
      status: submitStatus,
      registrationType: 'Pre-Booking'
    };

    await addVisitor(finalData);
    if (isDraft) {
      addNotification('Draft Saved', 'Pre-booking draft has been saved successfully.', 'info');
    } else {
      addNotification('Pre-Booking Created', 'Visitor Pre-Booking submitted. Status: Pending Approval.', 'success');
    }
    navigate('/approvals');
  };

  const inputClassName = "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none transition-shadow placeholder-gray-300 text-sm bg-white";

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
          <h1 className="text-2xl font-bold text-gray-900">Pre-Booking Visitor Registration</h1>
          <p className="text-gray-500 mt-1">Host or Admin registers visitor prior to their expected arrival.</p>
        </div>
      </div>

      {/* Registration Mode Tabs */}
      <div className="bg-slate-100 p-1.5 rounded-xl flex gap-2 shadow-inner border border-slate-200">
        <button
          type="button"
          onClick={() => navigate('/visitors/new')}
          className="flex-1 py-3 px-4 text-center font-bold text-sm rounded-lg text-slate-700 hover:bg-white transition-all flex items-center justify-center gap-2"
        >
          <span>🚶 Direct Visit</span>
          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-normal">Arrives First</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/visitors/pre-booking')}
          className="flex-1 py-3 px-4 text-center font-bold text-sm rounded-lg bg-[var(--color-brand-indigo)] text-white shadow-md transition-all flex items-center justify-center gap-2"
        >
          <span>📅 Pre-Booking</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-normal">Register in Advance</span>
        </button>
      </div>

      {/* Info Tip Banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3 text-indigo-900 shadow-sm">
        <Info className="flex-shrink-0 mt-0.5 text-indigo-600" size={20} />
        <div>
          <p className="font-bold text-sm">Pre-Booking Workflow Enabled</p>
          <p className="text-xs text-indigo-700 mt-0.5">
            Your request will be submitted for approval. Once approved, your visitor pass and QR code will be activated.
          </p>
        </div>
      </div>

      {/* Blacklisted Visitor Alert */}
      {blacklistedVisitor && (
        <div className="bg-red-50 border-2 border-red-500 rounded-xl p-5 flex flex-col gap-3 shadow-md animate-in slide-in-from-top-2">
          <div className="flex gap-3">
            <AlertCircle className="flex-shrink-0 mt-0.5 text-red-600" size={24} />
            <div>
              <p className="font-bold text-red-700 text-lg">🚨 BLOCKED VISITOR DETECTED</p>
              <p className="text-sm text-red-800 mt-1 font-medium">
                This mobile number has been blacklisted. Registration will be recorded as Rejected.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={(e) => handleFormSubmit(e, false)} className="space-y-6">
        
        {/* Section 1: Personal Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-[var(--color-brand-indigo)] rounded-lg">
              <User size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
          </div>
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input 
                  required 
                  type="text" 
                  name="visitorName" 
                  value={formData.visitorName} 
                  onChange={handleChange} 
                  className={inputClassName} 
                  placeholder="e.g., Ravi Kumar" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number *</label>
                <input 
                  required 
                  type="tel" 
                  inputMode="numeric"
                  maxLength={10}
                  name="mobileNumber" 
                  value={formData.mobileNumber} 
                  onChange={handleChange} 
                  className={`${inputClassName} ${mobileError ? 'border-red-500 focus:ring-red-500' : ''}`} 
                  placeholder="Enter 10-digit mobile number" 
                />
                {mobileError && (
                  <p className="text-red-500 text-xs mt-1 font-semibold flex items-center gap-1">
                    ⚠️ {mobileError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  className={inputClassName} 
                  placeholder="e.g., ravi.kumar@example.com" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <input 
                  type="text" 
                  name="companyName" 
                  value={user?.companyName || 'Forge India Connect Private Limited'} 
                  readOnly 
                  className={`${inputClassName} bg-gray-100 font-bold text-gray-800 cursor-not-allowed`} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <IdCard size={16} className="text-[var(--color-brand-indigo)]" />
                  <span>Aadhaar Card Number *</span>
                </label>
                <input 
                  required 
                  type="text" 
                  name="aadhaarNumber" 
                  value={formData.aadhaarNumber || ''} 
                  onChange={handleChange} 
                  className={inputClassName} 
                  placeholder="e.g., 1234 5678 9012" 
                  maxLength={14}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Visit Details */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg">
              <Calendar size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Visit Details</h3>
          </div>
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {user?.role === 'Super Admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch Location *</label>
                  <select required name="branch" value={formData.branch} onChange={handleChange} className={inputClassName}>
                    <option value="">Select Branch</option>
                    {branches.filter(b => b !== 'All Branches').map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
              )}
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
                <select required name="hostName" value={formData.hostName} onChange={handleChange} className={inputClassName}>
                  <option value="">Select Host</option>
                  {hosts.map(host => (
                    <option key={host} value={host}>{host}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purpose of Visit *</label>
                <select required name="purpose" value={formData.purpose} onChange={handleChange} className={inputClassName}>
                  <option value="">Select Purpose</option>
                  <option value="Interview">Interview</option>
                  <option value="Vendor Meeting">Vendor Meeting</option>
                  <option value="Official Meeting">Official Meeting</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <Clock size={16} className="text-gray-500" />
                  <span>Expected Arrival Time</span>
                </label>
                <TimeDropdown
                  name="expectedArrivalTime"
                  value={formData.expectedArrivalTime}
                  onChange={handleChange}
                  className={`${inputClassName} !px-0`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Duration</label>
                <select name="expectedDuration" value={formData.expectedDuration} onChange={handleChange} className={inputClassName}>
                  <option value="30 Mins">30 Mins</option>
                  <option value="1 Hour">1 Hour</option>
                  <option value="2 Hours">2 Hours</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Full Day">Full Day</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes for Host / Security</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className={inputClassName} placeholder="Additional meeting notes, special clearance, badge requirements..."></textarea>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Documents */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <FileText size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Documents (Optional)</h3>
          </div>
          <div className="p-6 sm:p-8">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleIdDocUpload} 
                accept="image/*,application/pdf" 
                className="hidden" 
              />
              
              {idDocPreview ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center text-green-600 font-bold">
                    <CheckCircle size={32} />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {uploadingDoc ? 'Uploading document...' : 'ID Proof Uploaded'}
                  </p>
                  <button 
                    type="button" 
                    onClick={() => setIdDocPreview('')}
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    Remove & Re-upload
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-gray-100 text-gray-500 rounded-full">
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Upload Visitor ID Proof</p>
                  <p className="text-xs text-gray-400">Supports JPG, PNG, WebP or PDF (Max 5MB)</p>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-300"
                  >
                    Select Document File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
          <button 
            type="button" 
            onClick={(e) => handleFormSubmit(e, true)} 
            className="px-6 py-3 border border-gray-300 bg-white text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Save Draft
          </button>
          <button 
            type="submit" 
            className="px-8 py-3 bg-[var(--color-brand-indigo)] text-white font-bold rounded-lg hover:bg-[var(--color-brand-indigo-light)] transition-colors flex items-center justify-center space-x-2 shadow-md"
          >
            <QrCode size={20} />
            <span>Generate Pre-Booking</span>
          </button>
        </div>
      </form>

      {/* Add Host Modal */}
      {isHostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="text-[var(--color-brand-indigo)]" size={18} />
                Add New Host
              </h3>
              <button 
                type="button"
                onClick={() => { setIsHostModalOpen(false); setNewHostName(''); }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Host Name & Department</label>
              <input 
                type="text" 
                autoFocus
                value={newHostName} 
                onChange={(e) => setNewHostName(e.target.value)} 
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)]" 
                placeholder="e.g. Priyadharshini (HR)" 
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => { setIsHostModalOpen(false); setNewHostName(''); }} 
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-white"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => {
                  if (newHostName.trim()) {
                    setHosts([...hosts, newHostName.trim()]);
                    setFormData({ ...formData, hostName: newHostName.trim() });
                    setIsHostModalOpen(false);
                    setNewHostName('');
                  }
                }}
                className="px-4 py-2 bg-[var(--color-brand-indigo)] text-white rounded-lg font-medium"
              >
                Add Host
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PreBookingForm;
