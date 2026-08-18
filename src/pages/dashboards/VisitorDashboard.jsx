import React from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useAuth } from '../../context/AuthContext';
import { QrCode, Clock, CheckCircle, CalendarPlus, History, XCircle, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const VisitorDashboard = () => {
  const { visitors } = useVisitors();
  const { user } = useAuth();
  const navigate = useNavigate();

  // For the visitor dashboard, we simulate filtering the global visitors list 
  // to only show records belonging to the logged-in visitor.
  // Since we use a mock login ("Guest User"), we will just show a few recent ones
  // or simulate a specific visitor's data.
  const safeVisitors = Array.isArray(visitors) ? visitors : [];
  const myVisits = safeVisitors.slice(0, 4); // Simulate getting 4 past visits
  
  // Find the active/upcoming visit (if any)
  const activeVisit = myVisits.find(v => v.status === 'Approved' || v.status === 'Inside');
  const pendingRequests = myVisits.filter(v => v.status === 'Pending').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--color-brand-indigo)] p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
        {/* Background decorative pattern */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 text-white/10">
          <QrCode size={200} />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-3xl font-bold">Welcome, {user?.name || 'Visitor'}</h1>
          <p className="text-indigo-100 mt-2 text-lg">Manage your visits and access passes</p>
        </div>
        
        <div className="relative z-10">
          <button 
            onClick={() => navigate('/visitors/new')}
            className="px-6 py-3 bg-white text-[var(--color-brand-indigo)] hover:bg-gray-50 font-bold rounded-xl shadow-sm flex items-center gap-2 transition-transform hover:-translate-y-1"
          >
            <CalendarPlus size={20} />
            Register New Visit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        
        {/* Left Column: QR Pass & Status */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Virtual ID / QR Pass */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 p-4 text-center">
              <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Active Entry Pass</h3>
            </div>
            <div className="p-8 flex flex-col items-center justify-center border-b border-gray-100 bg-slate-50 relative">
              {activeVisit ? (
                <>
                  <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 mb-4">
                    {/* Simulated QR Code using the icon */}
                    <QrCode size={120} className="text-slate-900" />
                  </div>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    Valid for Entry
                  </span>
                  <p className="text-sm text-gray-500 font-mono text-center">PASS-ID: {activeVisit.id}</p>
                </>
              ) : (
                <div className="py-8 text-center flex flex-col items-center">
                  <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 mb-4">
                    <QrCode size={64} />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">No active passes available.</p>
                  <p className="text-xs text-gray-400 mt-1">Register a visit to generate a pass.</p>
                </div>
              )}
            </div>
            
            {activeVisit && (
              <div className="p-4 bg-white text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Host</span>
                  <span className="font-semibold text-gray-900">{activeVisit.hostName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Date</span>
                  <span className="font-semibold text-gray-900">{activeVisit.visitDate}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Zone</span>
                  <span className="font-semibold text-gray-900 flex items-center gap-1">
                    <MapPin size={14} className="text-[var(--color-brand-indigo)]" />
                    {activeVisit.currentZone || 'Reception'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 text-center">
               <div className="w-10 h-10 mx-auto bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-2">
                 <Clock size={20} />
               </div>
               <h4 className="text-2xl font-bold text-gray-900">{pendingRequests}</h4>
               <p className="text-xs text-gray-500 font-medium mt-1">Pending Requests</p>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200 text-center">
               <div className="w-10 h-10 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
                 <History size={20} />
               </div>
               <h4 className="text-2xl font-bold text-gray-900">{myVisits.length}</h4>
               <p className="text-xs text-gray-500 font-medium mt-1">Total Visits</p>
             </div>
          </div>
        </div>

        {/* Right Column: Visit History & Requests */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <History className="text-[var(--color-brand-indigo)]" size={16} />
                My Requests & Visit History
              </h3>
            </div>
            
            <div className="p-0 overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-4 font-medium">Date / Time</th>
                    <th className="px-6 py-4 font-medium">Host Details</th>
                    <th className="px-6 py-4 font-medium">Purpose</th>
                    <th className="px-6 py-4 font-medium text-right">Approval Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{visit.visitDate}</div>
                        {visit.entryTime && <div className="text-xs text-gray-500 font-mono mt-1">{visit.entryTime}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">{visit.hostName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[150px]">
                        {visit.purpose}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                          ${visit.status === 'Approved' || visit.status === 'Inside' || visit.status === 'Exited' ? 'bg-green-100 text-green-700' : ''}
                          ${visit.status === 'Pending' ? 'bg-orange-100 text-orange-700' : ''}
                          ${visit.status === 'Rejected' ? 'bg-red-100 text-red-700' : ''}
                        `}>
                          {visit.status === 'Pending' && <Clock size={12} />}
                          {(visit.status === 'Approved' || visit.status === 'Inside' || visit.status === 'Exited') && <CheckCircle size={12} />}
                          {visit.status === 'Rejected' && <XCircle size={12} />}
                          {visit.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {myVisits.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                        You have no recorded visits.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VisitorDashboard;
