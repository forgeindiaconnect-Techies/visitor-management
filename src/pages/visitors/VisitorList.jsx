import React, { useState } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useZones } from '../../context/ZoneContext';
import { useBranch } from '../../context/BranchContext';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Filter, MoreVertical, QrCode, X, FileText, Edit, Save, CalendarCheck, UserPlus, Eye, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const VisitorList = () => {
  const { visitors, allVisitors, updateVisitorStatus, updateVisitorTracking, updateVisitor, networkIp } = useVisitors();
  const { zones } = useZones();
  const { activeBranch, branches } = useBranch();
  const { addNotification } = useNotification();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisitorQR, setSelectedVisitorQR] = useState(null);
  const [selectedVisitorHistory, setSelectedVisitorHistory] = useState(null);
  const [selectedVisitorUpdateZone, setSelectedVisitorUpdateZone] = useState(null);
  const [selectedVisitorEdit, setSelectedVisitorEdit] = useState(null);
  const [selectedVisitorDetails, setSelectedVisitorDetails] = useState(null);
  const [selectedZone, setSelectedZone] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  const [hosts, setHosts] = useState([
    'PRIYADHARSHINI(HR)',
    'SANDHIYA(HR)',
    'GANESH KUMAR(HR)',
    'ADITHIYA(SENIOR HR)',
    'R.SANDHIYA(HR)',
    'MONIKA SHREE(HR)',
    'SANDEEP(CEO SIR)',
    'AVINASH(MD SIR)',
    'SABARI(ADMIN)',
    'VIJI(ADMIN)',
    'AGILA(IT)',
    'NEW VISITORS'
  ]);


  // Handle URL params for filtering
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('filter') === 'checked-in') {
      setStatusFilter('Checked In');
      // Intentionally not setting dateFilter to allow all-time QR Scans
    }
  }, [location]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700 border border-gray-200';
      case 'Pending Approval':
      case 'Pending': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'Approved': return 'bg-green-100 text-green-800 border border-green-200';
      case 'Rejected':
      case 'Cancelled': return 'bg-red-100 text-red-800 border border-red-200';
      case 'Checked In':
      case 'Inside': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Checked Out':
      case 'Exited': return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'Expired': return 'bg-slate-800 text-white border border-slate-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredVisitors = visitors.filter(v => {
    const matchesSearch = (v.visitorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.mobileNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.bookingId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || 
                          (statusFilter === 'Checked In' ? (v.status === 'Checked In' || v.status === 'Inside') : 
                           statusFilter === 'Checked Out' ? (v.status === 'Checked Out' || v.status === 'Exited') : 
                           v.status === statusFilter);
    const matchesDate = !dateFilter || v.visitDate === dateFilter;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const isReturningVisitor = (visitor) => {
    if (!allVisitors || allVisitors.length === 0) return false;
    // Check if there is any visit for this profile that occurred BEFORE this specific visit
    return allVisitors.some(v => 
      v.profileId === visitor.profileId && 
      new Date(v.createdAt) < new Date(visitor.createdAt)
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visitors Management</h1>
          <p className="text-gray-500 mt-1">Manage and track all visitors across zones.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => navigate('/visitors/new')}
            className="bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white px-4 py-2.5 rounded-lg flex items-center space-x-2 font-medium transition-colors shadow-md text-sm"
          >
            <UserPlus size={18} />
            <span>+ Walk-in Visitor</span>
          </button>
          <button 
            onClick={() => navigate('/invitations')}
            className="bg-indigo-50 border border-indigo-200 text-[var(--color-brand-indigo)] hover:bg-indigo-100 px-4 py-2.5 rounded-lg flex items-center space-x-2 font-bold transition-colors shadow-sm text-sm"
          >
            <CalendarCheck size={18} />
            <span>+ Pre-Booking</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search visitors or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)]"
            />
            {dateFilter && (
              <button 
                onClick={() => setDateFilter('')}
                className="text-gray-400 hover:text-gray-600"
                title="Clear Date Filter"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center space-x-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${isFilterOpen || statusFilter !== 'All' ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)] bg-indigo-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter size={18} />
              <span>{statusFilter !== 'All' ? statusFilter : 'Filters'}</span>
            </button>
            
            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                <div className="p-2 space-y-1">
                  {['All', 'Pre-Booked', 'Approved', 'Checked In', 'Checked Out', 'Cancelled', 'Expired', 'Draft', 'Pending', 'Rejected'].map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setIsFilterOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${statusFilter === status ? 'bg-indigo-50 text-[var(--color-brand-indigo)] font-semibold' : 'text-gray-700 hover:bg-slate-50'}`}
                    >
                      {status === 'All' ? 'All Statuses' : status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px] w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Visitor</th>
                <th className="px-6 py-4 font-medium">Company</th>
                <th className="px-6 py-4 font-medium">Host</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Current Zone</th>
                <th className="px-6 py-4 font-medium">Status</th>
                {user?.role !== 'HR' && (
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVisitors.map((visitor) => (
                <tr key={visitor.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-[var(--color-brand-indigo)] flex items-center justify-center font-bold mr-3">
                        {(visitor.visitorName || 'U').charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{visitor.visitorName || 'Unknown'}</p>
                          {isReturningVisitor(visitor) ? (
                            <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Returning</span>
                          ) : (
                            <span className="text-[9px] bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">New</span>
                          )}
                        </div>
                        <div className="flex flex-col items-start mt-0.5 gap-1">
                          <p className="text-xs text-gray-500">{visitor.mobileNumber}</p>
                          {activeBranch === 'All Branches' && visitor.branch && (
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded border border-slate-200 uppercase tracking-wider font-semibold shadow-sm">
                              📍 {visitor.branch}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{visitor.companyName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{visitor.hostName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{visitor.visitDate}</td>
                  <td className="px-6 py-4">
                    {visitor.status === 'Exited' ? (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold border border-gray-200 flex items-center gap-1 w-max">
                        <span className="text-[10px]">🚪</span> Checked Out
                      </span>
                    ) : visitor.currentZone ? (
                      <span className="px-3 py-1 bg-indigo-100 text-[var(--color-brand-indigo)] rounded-full text-xs font-bold border border-indigo-200 flex items-center gap-1 w-max">
                        <span className="text-[10px]">📍</span> {visitor.currentZone}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm font-medium">Not Assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(visitor.status)}`}>
                      {visitor.status === 'Inside' ? '🟡 In Progress' : 
                       visitor.status === 'Exited' ? '🟢 Completed' : 
                       visitor.status}
                    </span>
                  </td>
                  {user?.role !== 'HR' && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">


                        <div className="relative inline-block">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              setOpenDropdownId(openDropdownId === visitor.id ? null : visitor.id);
                            }}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                        
                        {openDropdownId === visitor.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl border border-gray-200 z-50">
                            <div className="py-1">
                              <button 
                                onClick={() => { setSelectedVisitorDetails(visitor); setOpenDropdownId(null); }} 
                                className="block w-full text-left px-4 py-2 text-sm text-slate-800 font-bold hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-100"
                              >
                                <Eye size={15} className="text-indigo-600" /> View Details
                              </button>
                              <button onClick={() => { setSelectedVisitorEdit(visitor); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 font-medium hover:bg-slate-50 flex items-center gap-2">
                                <Edit size={14} /> Edit Details
                              </button>
                              <button onClick={() => { updateVisitorStatus(visitor._id || visitor.id, 'Checked In'); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-green-700 font-semibold hover:bg-green-50 border-t border-gray-100">Check In</button>
                              <button onClick={() => { updateVisitorStatus(visitor._id || visitor.id, 'Checked Out'); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 font-semibold hover:bg-slate-50">Check Out</button>
                              {user?.role !== 'Security' && (
                                <>
                                  <button onClick={() => { setSelectedVisitorUpdateZone(visitor); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-indigo-600 font-medium hover:bg-slate-50 border-t border-gray-100">Update Zone</button>
                                  <button onClick={() => { updateVisitorStatus(visitor._id || visitor.id, 'Approved'); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-slate-50 border-t border-gray-100">Approve</button>
                                  <button onClick={() => { updateVisitorStatus(visitor._id || visitor.id, 'Cancelled'); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50">Cancel Booking</button>
                                  <button onClick={() => { setSelectedVisitorHistory(visitor); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 border-t border-gray-100">
                                    View Zone History
                                  </button>
                                </>
                              )}
                              <button onClick={() => { setSelectedVisitorQR(visitor); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-slate-50">
                                View QR Pass
                              </button>
                              <button onClick={() => { navigate(`/visitors/returning?mobile=${visitor.mobileNumber}`); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm font-bold text-[var(--color-brand-indigo)] hover:bg-indigo-50 border-t border-indigo-100">
                                Schedule Return Visit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                )}
                </tr>
              ))}
              
              {filteredVisitors.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No visitors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Modal */}
      {selectedVisitorQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <button 
              onClick={() => setSelectedVisitorQR(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="mb-4 text-[var(--color-brand-indigo)] flex justify-center">
              <QrCode size={40} />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Visitor Pass</h2>
            <p className="text-gray-500 text-sm mb-6">Scan with any phone camera</p>
            
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm inline-block mb-6">
              <QRCodeSVG 
                value={window.location.hostname === 'localhost' ? `http://${networkIp}:${window.location.port}/pass/${selectedVisitorQR.visitId || selectedVisitorQR.id}` : `${window.location.origin}/pass/${selectedVisitorQR.visitId || selectedVisitorQR.id}`} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-2">
              <p className="font-bold text-[var(--color-brand-indigo)]">{selectedVisitorQR.visitorName}</p>
              <p className="text-sm text-indigo-700 font-mono mt-1">{selectedVisitorQR.visitId}</p>
            </div>
            <p className="text-xs text-gray-400">Status: {selectedVisitorQR.status}</p>
          </div>
        </div>
      )}

      {/* Zone History Modal */}
      {selectedVisitorHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelectedVisitorHistory(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold text-gray-900 mb-1">Zone Movement History</h2>
            <p className="text-gray-500 text-sm mb-6">Tracking log for {selectedVisitorHistory.visitorName} ({selectedVisitorHistory.visitId})</p>
            
            <div className="overflow-x-auto bg-slate-50 rounded-xl border border-gray-100">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Zone</th>
                    <th className="px-4 py-3 font-medium">Entry Time</th>
                    <th className="px-4 py-3 font-medium">Exit Time</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {selectedVisitorHistory.zoneLogs && selectedVisitorHistory.zoneLogs.length > 0 ? (
                    selectedVisitorHistory.zoneLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{log.zoneName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(log.entryTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.exitTime ? new Date(log.exitTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : <span className="text-green-600 font-semibold">Active</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.durationMinutes !== undefined ? `${log.durationMinutes} min` : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                        No movement history recorded for this visitor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Checkout Notes Section */}
            {selectedVisitorHistory.remarks && selectedVisitorHistory.status === 'Exited' && (
              <div className="mt-6 bg-orange-50 border border-orange-100 rounded-xl p-4">
                <h3 className="text-sm font-bold text-orange-900 mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-orange-600" />
                  Visitor Checkout Notes
                </h3>
                <p className="text-sm text-orange-800 bg-white p-3 rounded border border-orange-100 whitespace-pre-wrap">
                  {selectedVisitorHistory.remarks}
                </p>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setSelectedVisitorHistory(null)}
                className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Zone Modal */}
      {selectedVisitorUpdateZone && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden relative">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Update Visitor Zone</h3>
              <button 
                onClick={() => setSelectedVisitorUpdateZone(null)} 
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Visitor: <strong className="text-gray-900">{selectedVisitorUpdateZone.visitorName}</strong></p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Zone</label>
                <select 
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent bg-white shadow-sm"
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                >
                  <option value="" disabled>▼ Select Zone</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.name}>▼ {zone.name}</option>
                  ))}
                  <option value="Exit" className="text-red-600 font-bold">▼ Exit (Check Out)</option>
                </select>
              </div>
              <button 
                onClick={() => {
                  if (selectedZone) {
                    if (selectedZone === 'Exit') {
                      updateVisitorStatus(selectedVisitorUpdateZone.id, 'Exited');
                    } else {
                      updateVisitorTracking(selectedVisitorUpdateZone.id, {
                        status: 'Inside',
                        currentZone: selectedZone
                      });
                    }
                    setSelectedVisitorUpdateZone(null);
                    setSelectedZone('');
                  } else {
                    addNotification('Action Required', 'Please select a zone first.', 'warning');
                  }
                }}
                className="w-full mt-4 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-medium py-3 rounded-lg shadow-md transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Visitor Modal */}
      {selectedVisitorEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden relative">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Edit size={18} className="text-[var(--color-brand-indigo)]" />
                Edit Visitor Details
              </h3>
              <button 
                onClick={() => setSelectedVisitorEdit(null)} 
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const updates = {
                visitorName: formData.get('visitorName'),
                mobileNumber: formData.get('mobileNumber'),
                hostName: formData.get('hostName'),
                purpose: formData.get('purpose')
              };
              if (formData.has('branch')) {
                updates.branch = formData.get('branch');
              }
              const success = await updateVisitor(selectedVisitorEdit.id, updates);
              if (success) {
                setSelectedVisitorEdit(null);
              }
            }}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name</label>
                  <input required name="visitorName" defaultValue={selectedVisitorEdit.visitorName} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input required name="mobileNumber" defaultValue={selectedVisitorEdit.mobileNumber} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none" />
                </div>
                {user?.role === 'Super Admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <select required name="branch" defaultValue={selectedVisitorEdit.branch} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white">
                      <option value="">Select Branch</option>
                      {branches.filter(b => b !== 'All Branches').map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Host Name</label>
                  <select required name="hostName" defaultValue={selectedVisitorEdit.hostName} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white">
                    <option value="">Select Host</option>
                    {hosts.map(host => (
                      <option key={host} value={host}>{host}</option>
                    ))}
                    {!hosts.includes(selectedVisitorEdit.hostName) && (
                      <option value={selectedVisitorEdit.hostName}>{selectedVisitorEdit.hostName}</option>
                    )}
                  </select>

                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                  <select required name="purpose" defaultValue={selectedVisitorEdit.purpose} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white">
                    <option value="">Select Purpose</option>
                    <option value="Interview">Interview</option>
                    <option value="Follow up">Follow up</option>
                    <option value="Job consulting">Job consulting</option>
                    <option value="Banking">Banking</option>
                    <option value="CEO meeting">CEO meeting</option>
                    <option value="Visitors">Visitors</option>
                    <option value="Guest">Guest</option>
                    {/* Include the current purpose if it's not in the predefined list */}
                    {!['Interview', 'Follow up', 'Job consulting', 'Banking', 'CEO meeting', 'Visitors', 'Guest'].includes(selectedVisitorEdit.purpose) && (
                      <option value={selectedVisitorEdit.purpose}>{selectedVisitorEdit.purpose}</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setSelectedVisitorEdit(null)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--color-brand-indigo)] text-white rounded-lg font-medium flex items-center gap-2 hover:bg-[var(--color-brand-indigo-light)]">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Visitor Details Modal */}
      {selectedVisitorDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 animate-fadeIn">
            <button 
              onClick={() => setSelectedVisitorDetails(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
            >
              <X size={18} />
            </button>
            
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
              <div className="w-20 h-20 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-indigo-500/20 shadow-md flex-shrink-0">
                {selectedVisitorDetails.photoUrl ? (
                  <img src={selectedVisitorDetails.photoUrl} alt={selectedVisitorDetails.visitorName} className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-gray-400" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block">Visitor Profile Details</span>
                <h3 className="text-xl font-bold text-gray-900">{selectedVisitorDetails.visitorName}</h3>
                <span className="text-xs font-semibold text-slate-500">{selectedVisitorDetails.companyName || 'Forge India Connect Private Limited'}</span>
                <div className="mt-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedVisitorDetails.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Visitor ID</span>
                <span className="font-mono font-bold text-indigo-700 text-sm">{selectedVisitorDetails.visitId || selectedVisitorDetails.id}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Mobile Number</span>
                <span className="font-bold text-slate-800">{selectedVisitorDetails.mobileNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Host Employee</span>
                <span className="font-bold text-slate-800">{selectedVisitorDetails.hostName || 'Not Assigned'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Purpose</span>
                <span className="font-semibold text-purple-700">{selectedVisitorDetails.purpose || 'Business Meeting'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Date & Time</span>
                <span className="font-semibold text-slate-800">{selectedVisitorDetails.visitDate || 'Today'} @ {selectedVisitorDetails.expectedArrivalTime || '10:00 AM'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Branch</span>
                <span className="font-semibold text-slate-800">{selectedVisitorDetails.branch || 'Chennai'}</span>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-between">
              <div className="bg-white p-2 rounded-xl shadow-md">
                <QRCodeSVG 
                  value={window.location.hostname === 'localhost' ? `http://${import.meta.env.VITE_NETWORK_IP || '192.168.1.10'}:5173/pass/${selectedVisitorDetails.visitId || selectedVisitorDetails.id}` : `${window.location.origin}/pass/${selectedVisitorDetails.visitId || selectedVisitorDetails.id}`} 
                  size={70} 
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-indigo-300 font-bold uppercase tracking-wider block">DIGITAL GATE PASS</span>
                <button 
                  onClick={() => window.open(`/pass/${selectedVisitorDetails.visitId || selectedVisitorDetails.id}`, '_blank')}
                  className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                >
                  Open Digital Pass ↗
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSelectedVisitorDetails(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitorList;
