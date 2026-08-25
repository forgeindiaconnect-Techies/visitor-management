import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVisitors } from '../../context/VisitorContext';
import { useBlacklist } from '../../context/BlacklistContext';
import { Search, User, Calendar, Save, AlertCircle, Info, History, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { calculateTimeSpent } from '../../utils/timeUtils';
import { formatDisplayDate, formatDisplayTime } from '../../utils/dateUtils';
import { formatDisplayName } from '../../utils/nameFormatter';

const ReturningVisitor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addVisitor, allVisitors } = useVisitors();
  const { isBlacklisted } = useBlacklist();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState(null); // 'searching', 'found', 'not-found', null
  const [profile, setProfile] = useState(null);
  const [visitHistory, setVisitHistory] = useState([]);

  // Form data for the NEW visit
  const [formData, setFormData] = useState({
    purpose: '',
    hostName: '',
    visitDate: new Date().toISOString().split('T')[0],
  });

  const [hosts, setHosts] = useState([
    'Priyadharshini (HR)',
    'Ganesh Kumar (HR)',
    'Sandeep (CEO Sir)',
    'Avinash (MD Sir)',
    'Sabari (Admin)',
    'Agila (IT)',
    'Joe Christo (Senior HR)',
    'Direct Visits'
  ]);

  const handleSearch = async (e, forceQuery = null) => {
    e?.preventDefault();
    const query = forceQuery || searchQuery;
    if (!query || query.trim().length < 3) return;

    setSearchStatus('searching');
    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      headers['X-Company-Id'] = localStorage.getItem('companyId') || 'FIC001';

      const res = await fetch(`${API_URL}/api/visitors/profile/${encodeURIComponent(query.trim())}`, {
        headers
      });
      
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      
      const data = await res.json();
      
      if (!data.exists) {
        setSearchStatus('not-found');
        setProfile(null);
        setVisitHistory([]);
        return;
      }
      
      setProfile(data.profile);
      setVisitHistory(Array.isArray(data.history) ? data.history : []);
      setSearchStatus('found');
    } catch (err) {
      console.error("Search error", err);
      setSearchStatus('not-found');
      setProfile(null);
      setVisitHistory([]);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mobile = params.get('mobile');
    if (mobile) {
      setSearchQuery(mobile);
      handleSearch(null, mobile);
    }
  }, [location.search]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!profile) return;

    if (isBlacklisted(profile.mobileNumber)) {
      alert("Registration Blocked: This visitor is on the Blacklist.");
      return;
    }

    // Combine profile data with new visit data
    const completeVisitData = {
      visitorName: profile.visitorName,
      mobileNumber: profile.mobileNumber,
      email: profile.email || '',
      companyName: profile.companyName || '',
      photoUrl: profile.photoUrl || '',
      purpose: formData.purpose,
      hostName: formData.hostName,
      visitDate: formData.visitDate,
      isReturning: true,
      returningVisitor: true,
      visitType: 'DIRECT_VISIT',
      registrationType: 'Direct Visit',
      bookingType: 'DIRECT_VISIT',
      status: 'Pending'
    };

    await addVisitor(completeVisitData);
    navigate('/visitors');
  };

  // Combine fetched history with local state history for immediate real-time sync
  const combinedHistory = visitHistory.length > 0 
    ? visitHistory 
    : (allVisitors || [])
        .filter(v => profile && (v.mobileNumber === profile.mobileNumber || String(v.mobileNumber || '').slice(-10) === String(profile.mobileNumber || '').slice(-10)))
        .map(v => ({
          id: v.visitorId || v.id || v._id,
          visitDate: v.visitDate || v.date || v.createdAt,
          purpose: v.purpose || v.visitPurpose || 'Visit',
          hostName: v.hostName || v.hostEmployee || 'Staff',
          branch: v.branch || v.branchLocation || 'Head Office',
          status: v.status || 'Completed',
          entryTime: v.checkInTime || v.entryTime || '',
          exitTime: v.checkOutTime || v.exitTime || '',
          type: v.isPreBooking ? 'Pre-Booking' : 'Direct Visit'
        }));

  const totalVisitsCount = combinedHistory.length;

  const activeInputClassName = "w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none transition-all text-sm font-medium bg-white";

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Returning Visitor Registration</h1>
          <p className="text-gray-500 mt-1 text-sm">View visit frequency and history log, and fast-track new pass generation.</p>
        </div>
        <button 
          onClick={() => navigate('/visitors')} 
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-2 text-sm font-semibold transition-colors"
        >
          <ArrowLeft size={16} /> Back to Visitor List
        </button>
      </div>

      {/* Info Tip Banner */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-indigo-900 shadow-xs">
        <Info className="flex-shrink-0 mt-0.5 text-[var(--color-brand-indigo)]" size={20} />
        <div>
          <p className="font-bold text-sm">Fast-Track Returning Visitor Registration</p>
          <p className="text-xs text-indigo-700 mt-0.5">Search for an existing visitor by mobile number to review their past visit history and immediately generate a new pass.</p>
        </div>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Search size={18} className="text-[var(--color-brand-indigo)]" />
            Search Visitor Profile
          </h3>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input 
                type="text" 
                placeholder="Enter 10-digit mobile number or name..." 
                className={`${activeInputClassName} ${isBlacklisted(searchQuery) ? 'border-red-500 bg-red-50 focus:ring-red-500' : ''}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isBlacklisted(searchQuery) && (
                <p className="text-xs text-red-600 mt-1.5 font-semibold flex items-center gap-1">
                  <AlertCircle size={12} /> This number is blacklisted. Registration blocked.
                </p>
              )}
            </div>
            <button 
              type="submit"
              disabled={searchStatus === 'searching' || isBlacklisted(searchQuery)}
              className="px-6 py-2.5 bg-[var(--color-brand-indigo)] hover:bg-indigo-900 text-white font-bold rounded-xl transition-all flex items-center justify-center min-w-[130px] shadow-sm"
            >
              {searchStatus === 'searching' ? 'Searching...' : 'Search Profile'}
            </button>
          </form>

          {searchStatus === 'not-found' && (
            <div className="mt-4 p-3.5 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 border border-red-200 animate-in slide-in-from-top-2">
              <AlertCircle size={18} />
              <span className="font-semibold text-xs">No existing visitor found with this mobile number. Please check the number or register via Direct Visit.</span>
            </div>
          )}
        </div>
      </div>

      {/* Display Profile & History if Found */}
      {searchStatus === 'found' && profile && (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-bottom-3 duration-500">
          
          {/* Visitor Profile Summary Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-[var(--color-brand-indigo)] flex items-center justify-center font-bold">
                  <User size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Visitor Profile</h3>
                  <p className="text-xs text-gray-500">Existing verified visitor profile loaded</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 text-[var(--color-brand-indigo)] border border-indigo-200 rounded-full text-xs font-bold">
                  {totalVisitsCount} Total {totalVisitsCount === 1 ? 'Visit' : 'Visits'}
                </span>
                <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Verified
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                
                {/* Photo Section */}
                <div className="flex flex-col items-center col-span-1 border-b md:border-b-0 md:border-r border-gray-100 pb-4 md:pb-0 md:pr-6">
                  <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-indigo-200 shadow-sm overflow-hidden flex items-center justify-center mb-2">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt={profile.visitorName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-indigo-400">{(profile.visitorName || 'V').charAt(0)}</span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-gray-900 text-center">{formatDisplayName(profile.visitorName)}</h4>
                  <p className="text-xs font-bold text-[var(--color-brand-indigo)] font-mono">{profile.profileId || 'VISITOR'}</p>
                </div>

                {/* Details Section */}
                <div className="col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-100">
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Mobile Number</label>
                    <div className="text-gray-900 font-bold text-sm">{profile.mobileNumber}</div>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-100">
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Email Address</label>
                    <div className="text-gray-900 font-semibold text-sm truncate">{profile.email || 'Not Provided'}</div>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-100">
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Company</label>
                    <div className="text-gray-900 font-semibold text-sm truncate">{profile.companyName || 'Forge India Connect Private Limited'}</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Visit History Log Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-[var(--color-brand-indigo)]" />
                <h3 className="text-base font-bold text-gray-900">Visit History Log</h3>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                Registered on {combinedHistory.length} separate {combinedHistory.length === 1 ? 'date' : 'dates'}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              {combinedHistory.length > 0 ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100/70 text-gray-600 font-semibold text-xs uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3.5">Visit Date</th>
                      <th className="px-6 py-3.5">Purpose</th>
                      <th className="px-6 py-3.5">Host Employee</th>
                      <th className="px-6 py-3.5">Branch</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Time Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {combinedHistory.map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-gray-900">
                          {formatDisplayDate(v.visitDate)}
                        </td>
                        <td className="px-6 py-3.5 font-medium text-gray-700">{v.purpose || 'Visit'}</td>
                        <td className="px-6 py-3.5 font-medium text-gray-700">{formatDisplayName(v.hostName || 'Staff')}</td>
                        <td className="px-6 py-3.5 text-gray-600 text-xs">{v.branch || 'Head Office'}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            String(v.status).toLowerCase().includes('check') ? 'bg-green-100 text-green-800' :
                            String(v.status).toLowerCase().includes('pending') ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-medium text-indigo-700 text-xs">
                          {v.entryTime && v.exitTime 
                            ? calculateTimeSpent(v.visitDate, v.entryTime, v.exitTime, v.status)
                            : (v.entryTime ? `Checked in ${formatDisplayTime(v.entryTime)}` : '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-400 flex flex-col items-center bg-gray-50/50">
                  <History size={28} className="text-gray-300 mb-1.5" />
                  <p className="text-xs">No historical visits found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Clean New Visit Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-[var(--color-brand-indigo)]" />
                <h3 className="text-base font-bold text-gray-900">New Appointment Details</h3>
              </div>
              <p className="text-xs text-gray-500">Select host and purpose for today's visit</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Purpose of Visit *</label>
                  <select required name="purpose" value={formData.purpose} onChange={handleInputChange} className={activeInputClassName}>
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
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Host Employee *</label>
                  <select required name="hostName" value={formData.hostName} onChange={handleInputChange} className={activeInputClassName}>
                    <option value="">Select Host</option>
                    {hosts.map((host, idx) => (
                      <option key={idx} value={host}>{host}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Date of Visit</label>
                  <input required type="date" name="visitDate" value={formData.visitDate} onChange={handleInputChange} className={activeInputClassName} />
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                <button type="submit" className="px-6 py-3 bg-[var(--color-brand-indigo)] hover:bg-indigo-900 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm text-sm">
                  <Save size={16} />
                  <span>Register & Generate Pass</span>
                </button>
              </div>
            </div>
          </div>

        </form>
      )}

    </div>
  );
};

export default ReturningVisitor;
