import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Building } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const VisitorStatusTracking = () => {
  const { id } = useParams();
  const [visitorData, setVisitorData] = useState(null);
  const [approvalData, setApprovalData] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/visitors/${id}/status`);
      const data = await response.json();
      if (data.success) {
        setVisitorData(data.visitor);
        setApprovalData(data.approval);
        setStatusHistory(data.statusHistory);
      } else {
        setError(data.message || 'Could not find visitor.');
      }
    } catch (err) {
      setError('An error occurred while fetching status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    const socket = io(API_URL);
    socket.on('visitor:status-updated', (data) => {
      if (data.visitorId === id) {
        fetchStatus();
      }
    });

    return () => socket.disconnect();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!visitorData) return null;

  const { approvalStatus, visitType } = visitorData;

  const renderStatusBanner = () => {
    switch (approvalStatus) {
      case 'PENDING':
        return (
          <div className="bg-orange-50 p-6 text-center border-b border-orange-100">
            <Clock className="w-12 h-12 text-orange-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-orange-800 tracking-wide">⏳ WAITING FOR APPROVAL</h2>
            <p className="text-sm text-orange-700 mt-2 font-medium">Your appointment request has been submitted.</p>
          </div>
        );
      case 'APPROVED':
      case 'Approved':
        return (
          <div className="bg-emerald-50 p-6 text-center border-b border-emerald-100">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-emerald-800 tracking-wide">✓ APPOINTMENT APPROVED</h2>
          </div>
        );
      case 'REJECTED':
      case 'Rejected':
        return (
          <div className="bg-red-50 p-6 text-center border-b border-red-100">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-red-800 tracking-wide">✕ APPOINTMENT REJECTED</h2>
          </div>
        );
      case 'DATE_CHANGED':
      case 'TIME_CHANGED':
        return (
          <div className="bg-yellow-50 p-6 text-center border-b border-yellow-100">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-yellow-800 tracking-wide">
              ⚠ APPOINTMENT {approvalStatus === 'DATE_CHANGED' ? 'DATE' : 'TIME'} CHANGED
            </h2>
          </div>
        );
      case 'CHECKED_IN':
      case 'Checked In':
      case 'Inside':
        return (
          <div className="bg-blue-50 p-6 text-center border-b border-blue-100">
            <CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-blue-800 tracking-wide">✓ CHECKED IN</h2>
            <p className="text-sm text-blue-700 mt-2 font-medium">Your visit is currently active.</p>
          </div>
        );
      case 'CHECKED_OUT':
      case 'Checked Out':
      case 'Exited':
        return (
          <div className="bg-gray-50 p-6 text-center border-b border-gray-200">
            <CheckCircle className="w-12 h-12 text-gray-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-gray-800 tracking-wide">✓ VISIT COMPLETED</h2>
            <p className="text-sm text-gray-600 mt-2 font-medium">Thank you for visiting.</p>
          </div>
        );
      default:
        return (
          <div className="bg-gray-50 p-6 text-center border-b border-gray-200">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-gray-700 tracking-wide">{approvalStatus}</h2>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans flex flex-col items-center justify-center">
      
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mb-8">
        
        {renderStatusBanner()}

        <div className="p-6">
          <div className="text-center mb-6">
            <h1 className="text-sm font-bold text-gray-400 tracking-widest border-b border-dashed border-gray-200 pb-4">
              VISITOR APPOINTMENT
            </h1>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm font-medium">Visitor</span>
              <span className="font-bold text-gray-900">{visitorData.name}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm font-medium">Host</span>
              <span className="font-bold text-gray-900">{visitorData.hostName}</span>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
              <span className="text-gray-500 text-sm font-medium">Appointment</span>
              <div className="text-right">
                <div className="font-bold text-gray-900">
                  {visitorData.appointmentDate ? new Date(visitorData.appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  {visitorData.appointmentStartTime} {visitorData.appointmentEndTime ? `- ${visitorData.appointmentEndTime}` : ''}
                </div>
              </div>
            </div>

            {/* Rejection Reason (only if rejected) */}
            {['REJECTED', 'Rejected'].includes(approvalStatus) && statusHistory?.length > 0 && (
              <div className="flex justify-between items-start mt-4 pt-4 border-t border-gray-50">
                <span className="text-red-500 text-sm font-medium">Reason</span>
                <span className="font-medium text-red-700 text-right text-sm">
                  {statusHistory.find(h => h.status === 'REJECTED' || h.status === 'Rejected')?.reason || 'Host unavailable'}
                </span>
              </div>
            )}

            {/* Approval Details */}
            {approvalData && approvalData.approvedBy && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 text-sm font-medium">Status Updated By</span>
                  <span className="font-bold text-gray-900">
                    {approvalData.approvedBy} {approvalData.approvedByRole ? `- ${approvalData.approvedByRole}` : ''}
                  </span>
                </div>
                {approvalData.approvedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm font-medium">Updated At</span>
                    <span className="font-semibold text-gray-700 text-sm">
                      {new Date(approvalData.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(approvalData.approvedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* QR Pass Section */}
        {['APPROVED', 'Approved', 'DATE_CHANGED', 'TIME_CHANGED', 'CHECKED_IN', 'Checked In'].includes(approvalStatus) && (
          <div className="bg-slate-50 p-8 border-t border-b border-gray-200 text-center relative overflow-hidden">
            {/* Background design */}
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none flex items-center justify-center">
              <Building className="w-64 h-64 text-indigo-900" />
            </div>

            <h3 className="text-xs font-bold text-indigo-400 tracking-widest mb-6 relative z-10">QR PASS</h3>
            <div className="inline-block p-4 bg-white rounded-2xl shadow-md border border-gray-100 relative z-10 transition-transform hover:scale-105 duration-300">
              <QRCodeSVG 
                value={window.location.hostname === 'localhost' ? `http://${window.location.hostname}:5173/pass/${visitorData.id}` : `${window.location.origin}/pass/${visitorData.id}`} 
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-xs font-semibold text-gray-500 mt-6 relative z-10 uppercase tracking-widest bg-gray-200 inline-block px-3 py-1 rounded-full">
              Show this QR at reception
            </p>
          </div>
        )}

        {/* Timeline Section */}
        {statusHistory && statusHistory.length > 0 && (
          <div className="p-6 bg-white border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 tracking-widest mb-6 text-center">VISIT TIMELINE</h3>
            <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6 pb-2">
              
              {/* Always show Booking Submitted as the first step implicitly if they have history */}
              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm"></div>
                <h4 className="font-bold text-gray-900 text-sm">Booking Submitted</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {visitorData.appointmentDate ? new Date(visitorData.appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Recently'}
                </p>
              </div>

              {/* Render History Events */}
              {statusHistory.map((history, idx) => {
                let statusColor = "bg-indigo-500";
                let statusText = history.status;
                
                if (statusText === 'APPROVED' || statusText === 'Approved') {
                  statusColor = "bg-emerald-500";
                  statusText = "Approved";
                } else if (statusText === 'REJECTED' || statusText === 'Rejected') {
                  statusColor = "bg-red-500";
                  statusText = "Rejected";
                } else if (statusText === 'CHECKED_IN' || statusText === 'Checked In') {
                  statusColor = "bg-blue-500";
                  statusText = "Check In";
                } else if (statusText === 'CHECKED_OUT' || statusText === 'Checked Out') {
                  statusColor = "bg-gray-500";
                  statusText = "Check Out";
                }

                return (
                  <div key={idx} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${statusColor} border-4 border-white shadow-sm`}></div>
                    <h4 className="font-bold text-gray-900 text-sm">{statusText}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(history.changedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {new Date(history.changedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {history.reason && (
                      <p className="text-xs text-orange-600 mt-1 font-medium bg-orange-50 px-2 py-1 rounded inline-block">{history.reason}</p>
                    )}
                  </div>
                )
              })}
              
              {/* Future Steps placeholders if not completed yet */}
              {!['REJECTED', 'Rejected', 'CHECKED_OUT', 'Checked Out'].includes(approvalStatus) && (
                <>
                  {!['CHECKED_IN', 'Checked In'].includes(approvalStatus) && (
                    <div className="relative pl-6 opacity-40">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-200 border-4 border-white"></div>
                      <h4 className="font-bold text-gray-600 text-sm">Check In</h4>
                    </div>
                  )}
                  <div className="relative pl-6 opacity-40">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-200 border-4 border-white"></div>
                    <h4 className="font-bold text-gray-600 text-sm">Check Out</h4>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>

      <div className="text-center text-xs text-gray-400 font-medium tracking-wide">
        Powered by FIC Visitor Management
      </div>
    </div>
  );
};

export default VisitorStatusTracking;
