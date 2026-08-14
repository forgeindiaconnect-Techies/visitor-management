import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVisitors } from '../../context/VisitorContext';
import { useBlacklist } from '../../context/BlacklistContext';
import { Search, User, Calendar, Save, AlertCircle, Info, History, X } from 'lucide-react';
import { calculateTimeSpent } from '../../utils/timeUtils';

const ReturningVisitor = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addVisitor, allVisitors, networkIp } = useVisitors();
  const { isBlacklisted } = useBlacklist();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState(null); // 'searching', 'found', 'not-found', null
  const [profile, setProfile] = useState(null);

  // Form data for the NEW visit
  const [formData, setFormData] = useState({
    purpose: '',
    hostName: '',
    visitDate: new Date().toISOString().split('T')[0],
  });

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


  const handleSearch = async (e, forceQuery = null) => {
    e?.preventDefault();
    const query = forceQuery || searchQuery;
    if (!query || query.trim().length < 3) return;

    setSearchStatus('searching');
    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
      const res = await fetch(`${API_URL}/api/visitors/profile/${query}`);
      
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      
      const data = await res.json();
      
      if (!data.exists) {
        setSearchStatus('not-found');
        setProfile(null);
        return;
      }
      
      setProfile(data.profile);
      setSearchStatus('found');
    } catch (err) {
      console.error("Search error", err);
      // Fallback for when backend is down
      alert('Error connecting to the backend server. Please make sure the backend is running on port 5000.');
      setSearchStatus('not-found');
      setProfile(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mobile = params.get('mobile');
    if (mobile) {
      setSearchQuery(mobile);
      // Auto-trigger search
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
      status: 'Pending'
    };

    addVisitor(completeVisitData);
    navigate('/visitors'); // or directly to the pass view if addVisitor returned ID, but current context redirects to visitors
  };

  const inputClassName = "w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none";
  const activeInputClassName = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none transition-all";

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Returning Visitor</h1>
        <p className="text-gray-500 mt-1">Quickly generate a pass for an existing visitor.</p>
      </div>

      {/* Info Tip Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 shadow-sm">
        <Info className="flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-medium text-sm">Fast-Track Registration</p>
          <p className="text-xs opacity-80 mt-1">Search for an existing visitor to auto-fill their profile. You only need to select the purpose and host for their new visit today.</p>
        </div>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Search size={20} className="text-[var(--color-brand-indigo)]" />
            Search Visitor
          </h3>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input 
                type="text" 
                placeholder="Enter Mobile Number or Name..." 
                className={`${activeInputClassName} ${isBlacklisted(searchQuery) ? 'border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500' : ''}`}
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
              className="px-6 py-2.5 bg-[var(--color-brand-indigo)] text-white font-medium rounded-lg hover:bg-opacity-90 transition-all flex items-center justify-center min-w-[120px] self-start h-[42px]"
            >
              {searchStatus === 'searching' ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchStatus === 'not-found' && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-200 animate-in slide-in-from-top-2">
              <AlertCircle size={18} />
              <span className="font-medium text-sm">No existing visitor found. Please check the spelling or proceed to Direct Visit.</span>
            </div>
          )}
        </div>
      </div>

      {/* Display Profile & Form if Found */}
      {searchStatus === 'found' && profile && (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Read-Only Personal Details */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-[var(--color-brand-indigo)] rounded-lg">
                  <User size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Visitor Profile</h3>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider flex items-center">Verified Identity</span>
            </div>
            
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Photo Section */}
                <div className="flex flex-col items-center space-y-3 col-span-1">
                  <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                    {profile.photoUrl ? (
                      <img src={profile.photoUrl} alt={profile.visitorName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className="text-gray-300" />
                    )}
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-bold text-gray-900">{profile.visitorName}</h4>
                    <p className="text-sm font-mono text-[var(--color-brand-indigo)] mb-1">{profile.profileId || 'VIS---'}</p>
                    <p className="text-xs text-gray-500">{profile.companyName || 'Independent'}</p>
                  </div>
                </div>

                {/* Details Section */}
                <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mobile Number</label>
                    <div className="text-gray-900 font-medium">{profile.mobileNumber}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
                    <div className="text-gray-900 font-medium">{profile.email || '--'}</div>
                  </div>

                </div>

              </div>
            </div>
          </div>

          {/* Visit History Table */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-[var(--color-brand-indigo)] rounded-lg">
                <History size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Visit History Log</h3>
            </div>
            
            <div className="overflow-x-auto">
              {allVisitors && allVisitors.filter(v => v.mobileNumber === profile.mobileNumber).length > 0 ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Purpose</th>
                      <th className="px-6 py-3">Host</th>
                      <th className="px-6 py-3">Branch</th>
                      <th className="px-6 py-3">Time Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...allVisitors]
                      .filter(v => v.mobileNumber === profile.mobileNumber)
                      .reverse()
                      .map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-900">{v.visitDate}</td>
                        <td className="px-6 py-3 text-gray-600">{v.purpose || '-'}</td>
                        <td className="px-6 py-3 text-gray-600">{(v.hostName || 'Unknown').split(' ')[0]}</td>
                        <td className="px-6 py-3 text-gray-600">{v.branch}</td>
                        <td className="px-6 py-3 font-medium text-[var(--color-brand-indigo)]">
                          {calculateTimeSpent(v.visitDate, v.entryTime, v.exitTime, v.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center bg-gray-50/50">
                  <History size={32} className="text-gray-300 mb-2" />
                  <p>No historical visits found.</p>
                </div>
              )}
            </div>
          </div>

          {/* New Visit Form */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-brand-indigo)]"></div>
            <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Calendar size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Current Visit Details</h3>
            </div>
            
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Purpose of Visit *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Host to Visit *</label>
                  <select required name="hostName" value={formData.hostName} onChange={handleInputChange} className={activeInputClassName}>
                    <option value="">Select Host</option>
                    {hosts.map((host, idx) => (
                      <option key={idx} value={host}>{host}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Visit</label>
                  <input required type="date" name="visitDate" value={formData.visitDate} onChange={handleInputChange} className={activeInputClassName} />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-8 py-3 bg-[var(--color-brand-indigo)] text-white font-bold rounded-lg hover:bg-opacity-90 transition-all flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              <Save size={20} />
              <span>Generate New QR Pass</span>
            </button>
          </div>

        </form>
      )}



    </div>
  );
};

export default ReturningVisitor;
