import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Building, LinkIcon } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

const VisitorStatus = () => {
  const { token } = useParams();
  const [visitorData, setVisitorData] = useState(null);
  const [approvalData, setApprovalData] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/visitors/public-status/${token}`);
      
      if (response.status === 410) {
        setExpired(true);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setVisitorData(data.visitor);
        setApprovalData(data.approval);
        setStatusHistory(data.statusHistory || []);
        setExpired(false);
      } else {
        setError(data.message || 'Could not find visitor.');
      }
    } catch (err) {
      setError('An error occurred while fetching status.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();

    const socketUrl = API_URL ? API_URL.replace(/\/api\/?$/, '') : (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
    const socket = io(socketUrl);
    socket.on('visitor:status-updated', () => {
      // Any status update — re-fetch to get latest
      fetchStatus();
    });

    return () => socket.disconnect();
  }, [token, fetchStatus]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Checking your appointment...</p>
        </div>
      </div>
    );
  }

  // ── Expired Link ─────────────────────────────────────────────────────────
  if (expired) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100">
          <div className="bg-gray-800 text-white p-6 text-center">
            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <LinkIcon className="w-6 h-6" />
            </div>
            <div className="text-xs tracking-[0.3em] text-gray-400 uppercase font-medium">
              ── LINK EXPIRED ──
            </div>
          </div>
          <div className="p-8 text-center">
            <p className="text-gray-700 font-medium text-sm leading-relaxed">
              This visitor tracking link has expired.
            </p>
            <p className="text-gray-500 text-sm mt-3 leading-relaxed">
              Please contact the organization<br />for assistance.
            </p>
          </div>
        </div>
        <div className="text-center text-xs text-gray-400 font-medium tracking-wide absolute bottom-6">
          Powered by FIC Visitor Management
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!visitorData) return null;

  const { approvalStatus } = visitorData;

  const renderStatusBanner = () => {
    switch (approvalStatus) {
      case 'PENDING':
      case 'Pending':
      case 'Pending Approval':
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
        return (
          <div className="bg-yellow-50 p-6 text-center border-b border-yellow-100">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-yellow-800 tracking-wide">⚠ APPOINTMENT RESCHEDULED</h2>
            <p className="text-sm text-yellow-700 mt-2 font-medium">Your appointment date has changed. See new details below.</p>
          </div>
        );
      case 'TIME_CHANGED':
        return (
          <div className="bg-yellow-50 p-6 text-center border-b border-yellow-100">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-yellow-800 tracking-wide">⚠ APPOINTMENT RESCHEDULED</h2>
            <p className="text-sm text-yellow-700 mt-2 font-medium">Your appointment time has changed. See new details below.</p>
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) 
        + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans flex flex-col items-center justify-center">

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 mb-8">

        {renderStatusBanner()}

        <div className="p-6">
          <div className="text-center mb-6">
            <h1 className="text-xs font-bold text-gray-400 tracking-widest border-b border-dashed border-gray-200 pb-4 uppercase">
              Visitor Appointment
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
                <div className="font-bold text-gray-900">{formatDate(visitorData.appointmentDate)}</div>
                <div className="text-sm text-gray-600 font-medium">
                  {visitorData.appointmentStartTime}
                  {visitorData.appointmentEndTime ? ` - ${visitorData.appointmentEndTime}` : ''}
                </div>
              </div>
            </div>

            {/* Rejection reason */}
            {['REJECTED', 'Rejected'].includes(approvalStatus) && statusHistory?.length > 0 && (
              <div className="flex justify-between items-start mt-4 pt-4 border-t border-gray-50">
                <span className="text-red-500 text-sm font-medium shrink-0 mr-4">Reason</span>
                <span className="font-medium text-red-700 text-right text-sm">
                  {statusHistory.find(h => ['REJECTED', 'Rejected'].includes(h.status))?.reason || 'Appointment not possible at this time.'}
                </span>
              </div>
            )}

            {/* Approval details */}
            {approvalData?.approvedBy && (
              <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm font-medium">
                    {['REJECTED', 'Rejected'].includes(approvalStatus) ? 'Rejected By' : 'Approved By'}
                  </span>
                  <span className="font-bold text-gray-900">
                    {approvalData.approvedBy}
                    {approvalData.approvedByRole ? ` · ${approvalData.approvedByRole}` : ''}
                  </span>
                </div>
                {approvalData.approvedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm font-medium">At</span>
                    <span className="font-semibold text-gray-700 text-sm">{formatDateTime(approvalData.approvedAt)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* QR Pass — only for approved/checked-in. Uses passId (internal _id), NOT the trackingToken */}
        {['APPROVED', 'Approved', 'DATE_CHANGED', 'TIME_CHANGED', 'CHECKED_IN', 'Checked In', 'Inside'].includes(approvalStatus) && visitorData.passId && (
          <div className="bg-slate-50 p-8 border-t border-b border-gray-200 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none flex items-center justify-center">
              <Building className="w-64 h-64 text-indigo-900" />
            </div>
            <h3 className="text-xs font-bold text-indigo-400 tracking-widest mb-6 relative z-10 uppercase">QR Entry Pass</h3>
            <div className="inline-block p-4 bg-white rounded-2xl shadow-md border border-gray-100 relative z-10 transition-transform hover:scale-105 duration-300">
              <QRCodeSVG
                value={`https://visitor-management-indol.vercel.app/pass/${visitorData.passId}`}
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

        {/* Visit Timeline */}
        {statusHistory && statusHistory.length > 0 && (
          <div className="p-6 bg-white border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 tracking-widest mb-6 text-center uppercase">Visit Timeline</h3>
            <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6 pb-2">

              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm"></div>
                <h4 className="font-bold text-gray-900 text-sm">Booking Submitted</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDate(visitorData.appointmentDate)}
                </p>
              </div>

              {statusHistory.map((history, idx) => {
                let dotColor = 'bg-indigo-500';
                let label = history.status;

                if (['APPROVED', 'Approved'].includes(history.status)) { dotColor = 'bg-emerald-500'; label = 'Approved'; }
                else if (['REJECTED', 'Rejected'].includes(history.status)) { dotColor = 'bg-red-500'; label = 'Rejected'; }
                else if (['CHECKED_IN', 'Checked In', 'Inside'].includes(history.status)) { dotColor = 'bg-blue-500'; label = 'Checked In'; }
                else if (['CHECKED_OUT', 'Checked Out', 'Exited'].includes(history.status)) { dotColor = 'bg-gray-500'; label = 'Checked Out'; }
                else if (history.status === 'DATE_CHANGED') { dotColor = 'bg-yellow-500'; label = 'Date Changed'; }
                else if (history.status === 'TIME_CHANGED') { dotColor = 'bg-yellow-500'; label = 'Time Changed'; }

                return (
                  <div key={idx} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${dotColor} border-4 border-white shadow-sm`}></div>
                    <h4 className="font-bold text-gray-900 text-sm">{label}</h4>
                    {history.changedByName && (
                      <p className="text-xs text-gray-600 mt-0.5 font-medium">
                        By {history.changedByName}{history.changedByRole ? ` · ${history.changedByRole}` : ''}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(history.changedAt)}</p>
                    {history.reason && (
                      <p className="text-xs text-orange-600 mt-1 font-medium bg-orange-50 px-2 py-1 rounded inline-block">{history.reason}</p>
                    )}
                  </div>
                );
              })}

              {/* Future placeholder steps */}
              {!['REJECTED', 'Rejected', 'CHECKED_OUT', 'Checked Out', 'Exited'].includes(approvalStatus) && (
                <>
                  {!['CHECKED_IN', 'Checked In', 'Inside'].includes(approvalStatus) && (
                    <div className="relative pl-6 opacity-35">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-200 border-4 border-white"></div>
                      <h4 className="font-bold text-gray-500 text-sm">Check In</h4>
                    </div>
                  )}
                  <div className="relative pl-6 opacity-35">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-200 border-4 border-white"></div>
                    <h4 className="font-bold text-gray-500 text-sm">Check Out</h4>
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

export default VisitorStatus;
