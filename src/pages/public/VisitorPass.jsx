import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { User, Phone, Mail, Building, MapPin, Calendar, Clock, LogIn, LogOut, ShieldCheck, AlertCircle, Clock3, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const VisitorPass = () => {
  const { visitId } = useParams();
  const [visitor, setVisitor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    fetchVisitor();
  }, [visitId]);

  const fetchVisitor = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
      
      let response = await fetch(`${baseUrl}/api/pass-lookup/${visitId}`);
      if (!response.ok) {
        response = await fetch(`${baseUrl}/api/visitors/pass/${visitId}`);
      }
      if (!response.ok) {
        response = await fetch(`${baseUrl}/api/prebookings/visitor/${visitId}`);
      }

      if (!response.ok) {
        throw new Error('Visitor pass not found or invalid QR code.');
      }
      const data = await response.json();
      const visitorObj = data.data || data;
      setVisitor(visitorObj);
      setPurpose(visitorObj.purpose || visitorObj.visitPurpose || 'Business Meeting');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (action) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
      const targetId = visitor.visitorId || visitor.visitId || visitor._id || visitor.id;
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      
      let response;

      if (action === 'checkIn') {
        // 1. Try Pre-Booking Check-In
        response = await fetch(`${baseUrl}/api/prebookings/visitor/${encodeURIComponent(targetId)}/check-in`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        });

        // 2. If it fails (Not Found / 404), fallback to normal Visitor check-in
        if (!response.ok && response.status === 404) {
          response = await fetch(`${baseUrl}/api/visitors/${targetId}/zone`, {
            method: 'PATCH',
            headers: { 
              'Content-Type': 'application/json',
              'X-Company-Id': visitor.companyId || 'FIC001'
            },
            body: JSON.stringify({
              status: 'Inside',
              currentZone: 'Reception',
              entryTime: timeString,
              purpose: purpose
            })
          });
        }
      } else if (action === 'checkOut') {
        // 1. Try Pre-Booking Check-Out
        response = await fetch(`${baseUrl}/api/prebookings/visitor/${encodeURIComponent(targetId)}/check-out`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exitNotes: notes, checkOutNotes: notes })
        });

        // 2. If it fails, fallback to normal Visitor check-out
        if (!response.ok && response.status === 404) {
          response = await fetch(`${baseUrl}/api/visitors/${targetId}/zone`, {
            method: 'PATCH',
            headers: { 
              'Content-Type': 'application/json',
              'X-Company-Id': visitor.companyId || 'FIC001'
            },
            body: JSON.stringify({
              status: 'Exited',
              exitTime: timeString,
              remarks: notes,
              purpose: purpose
            })
          });
        }
      }

      if (response && response.ok) {
        const result = await response.json();
        const updatedVisitor = result.data || result;
        setVisitor(updatedVisitor);
      } else {
        const errorData = await response.json();
        alert(`Failed to update status: ${errorData.message || 'Validation error'}`);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status. Please try again.');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-[var(--color-brand-indigo)] border-t-transparent rounded-full animate-spin"></div></div>;
  if (error) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50"><AlertCircle size={48} className="text-red-500 mb-4" /><h1 className="text-xl font-bold text-gray-900">Invalid Pass</h1><p className="text-gray-500">{error}</p></div>;
  if (!visitor) return null;

  const getStatusColor = (status) => {
    switch(status) {
      case 'Approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'Pending': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'Inside': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Exited': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const renderTimeline = () => {
    const steps = ['Pending', 'Approved', 'Inside', 'Exited'];
    let currentIndex = steps.indexOf(visitor.status);
    if (visitor.status === 'Rejected') currentIndex = -1;

    return (
      <div className="flex justify-between items-center w-full px-4 mb-6 mt-2 relative z-0">
        <div className="absolute left-8 right-8 top-1/2 h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
        <div className="absolute left-8 right-8 top-1/2 h-0.5 bg-[var(--color-brand-indigo)] -z-10 -translate-y-1/2 transition-all duration-500" 
             style={{ width: currentIndex >= 0 ? `${(currentIndex / 3) * 100}%` : '0%' }}></div>
        
        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={step} className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isCompleted ? 'bg-[var(--color-brand-indigo)] text-white shadow-md' : 'bg-gray-100 text-gray-400'
              } ${isCurrent ? 'ring-4 ring-indigo-100' : ''}`}>
                {index + 1}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>{step}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 flex justify-center pb-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #eef4ff 0%, #f8fbff 50%, #ffffff 100%)' }}>
      <style>
        {`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .pass-card-animate {
            animation: fadeUp 0.8s ease forwards;
          }
        `}
      </style>
      
      {/* Decorative Circles */}
      <div className="fixed w-[250px] h-[250px] bg-indigo-500/15 rounded-full -top-20 -left-20 blur-[80px] pointer-events-none"></div>
      <div className="fixed w-[250px] h-[250px] bg-emerald-500/12 rounded-full -bottom-20 -right-20 blur-[80px] pointer-events-none"></div>

      <div className="max-w-md w-full space-y-4 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-4 relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center p-2 mb-2">
             <img src="/logo.svg" alt="FIC Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black text-[var(--color-brand-indigo)] tracking-tight">FORGE INDIA CONNECT</h1>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">OFFICIAL VISITOR PASS</p>
        </div>

        {/* Timeline */}
        {renderTimeline()}

        {/* Main Pass Card */}
        <div className="bg-white rounded-[24px] shadow-2xl overflow-hidden border border-slate-100 relative pass-card-animate">
          
          {/* Top Header Banner */}
          <div className="h-24 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 relative flex items-start justify-between p-4">
            <span className="text-[11px] font-mono font-bold text-indigo-200 uppercase tracking-wider">
              ID: {visitor.visitId || visitor.profileId}
            </span>
            <span className={`font-bold px-3 py-1 rounded-full text-xs shadow-md flex items-center gap-1.5 ${getStatusColor(visitor.status)}`}>
              <div className={`w-2 h-2 rounded-full ${visitor.status === 'Approved' ? 'bg-green-500 animate-pulse' : visitor.status === 'Inside' ? 'bg-blue-500' : 'bg-current'}`}></div>
              {visitor.status === 'Approved' ? 'APPROVED ✓' : visitor.status}
            </span>
          </div>

          {/* Face Photo */}
          <div className="flex flex-col items-center -mt-12 px-6">
            <div className="w-28 h-28 bg-white rounded-3xl p-1 shadow-xl relative z-10 border-2 border-indigo-500/20">
              <div className="w-full h-full bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center">
                {visitor.photoUrl ? (
                  <img src={visitor.photoUrl} alt={visitor.visitorName} className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-slate-400" />
                )}
              </div>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-3 tracking-tight">{visitor.visitorName}</h2>
            <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-full mt-1">
              {visitor.companyName || 'Forge India Connect Private Limited'}
            </p>
          </div>

          {/* Details Table List */}
          <div className="p-5">
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-2.5 text-xs">
              
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Visitor ID</span>
                <span className="font-mono font-extrabold text-indigo-700 text-sm">{visitor.visitId || visitor.profileId}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Full Name</span>
                <span className="font-bold text-slate-900">{visitor.visitorName}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Mobile Number</span>
                <span className="font-semibold text-slate-800">{visitor.mobileNumber || 'N/A'}</span>
              </div>

              {visitor.email && (
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Email Address</span>
                  <span className="font-medium text-slate-700 truncate max-w-[180px]">{visitor.email}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Visiting Company</span>
                <span className="font-bold text-indigo-700">Forge India Connect Private Limited</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Host Employee</span>
                <span className="font-bold text-slate-900">{visitor.assignedHr?.name || visitor.hostName || 'Not Assigned'}</span>
              </div>

              {visitor.assignedHr?.email && (
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Host Email</span>
                  <span className="font-medium text-slate-700">{visitor.assignedHr.email}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Visit Purpose</span>
                <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{visitor.purpose || visitor.visitPurpose || 'Business Meeting'}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Date of Visit</span>
                <span className="font-semibold text-slate-800">{visitor.visitDate || 'Today'}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Expected Time</span>
                <span className="font-semibold text-slate-800">{visitor.expectedArrivalTime || '10:00 AM'}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Branch Location</span>
                <span className="font-semibold text-slate-800">{visitor.branch || 'Head Office'}</span>
              </div>

              {visitor.vehicleNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Vehicle Registration</span>
                  <span className="font-mono font-bold text-slate-800">{visitor.vehicleNumber}</span>
                </div>
              )}

            </div>

            {/* Embedded Gate QR Code */}
            <div className="mt-5 p-4 bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 border border-slate-800">
              <div className="p-3 bg-white rounded-xl shadow-md">
                <QRCodeSVG 
                  value={window.location.hostname === 'localhost' ? `http://${import.meta.env.VITE_NETWORK_IP || '192.168.1.10'}:5173/pass/${visitor.visitId}` : `${window.location.origin}/pass/${visitor.visitId}`}
                  size={120} 
                />
              </div>
              <span className="text-[10px] font-mono text-indigo-300 font-bold uppercase tracking-wider">
                SCAN AT GATE / RECEPTION KIOSK
              </span>
            </div>

          </div>
        </div>
        
        {/* Checkout Notes Section */}
        {visitor.status === 'Inside' && (
          <div className="bg-white p-5 shadow-md border border-gray-100 rounded-2xl animate-in slide-in-from-bottom-4 duration-300">
            <label className="font-semibold text-[var(--color-brand-indigo)] uppercase text-xs tracking-wider block mb-2 flex items-center gap-2">
              <FileText size={14} /> Mandatory Exit Notes
            </label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter exit remarks / meeting outcome before checking out..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:bg-white resize-none text-xs"
              rows="2"
              required
            ></textarea>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2">
          {(visitor.status === 'Approved' || visitor.status === 'Pending') && !visitor.entryTime && (
            <button 
              onClick={() => updateStatus('checkIn')}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-2xl font-bold text-base shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <LogIn size={20} /> Tap to Check In at Gate
            </button>
          )}

          {visitor.status === 'Inside' && !visitor.exitTime && (
            <button 
              onClick={() => updateStatus('checkOut')}
              disabled={notes.trim().length === 0}
              className={`w-full py-3.5 rounded-2xl font-bold text-base shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
                notes.trim().length === 0 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
              }`}
            >
              <LogOut size={20} /> {notes.trim().length === 0 ? 'Fill Exit Notes to Check Out' : 'Tap to Check Out'}
            </button>
          )}

          {visitor.status === 'Rejected' && (
            <div className="w-full bg-red-50 border border-red-200 text-red-800 py-3 rounded-2xl font-medium text-center text-xs flex flex-col items-center justify-center gap-1">
              <AlertCircle size={20} className="text-red-600" />
              <span>This visitor pass has been rejected.</span>
            </div>
          )}
          
          {visitor.status === 'Exited' && (
            <div className="w-full bg-gray-100 border border-gray-200 text-gray-600 py-3 rounded-2xl font-medium text-center text-xs flex flex-col items-center justify-center gap-1">
              <ShieldCheck size={20} className="text-green-600" />
              <span>Visit Completed Successfully</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default VisitorPass;
