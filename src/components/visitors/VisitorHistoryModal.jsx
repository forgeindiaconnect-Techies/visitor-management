import React, { useEffect, useState } from 'react';
import { X, Clock, CheckCircle, XCircle, Calendar, ShieldCheck, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVisitors } from '../../context/VisitorContext';

const VisitorHistoryModal = ({ visitor, onClose }) => {
  const { user } = useAuth();
  const { networkIp } = useVisitors();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? `http://${networkIp}:5000` : 'https://fic-visitor-1.onrender.com');
        const response = await fetch(`${API_URL}/api/visitors/${visitor._id || visitor.id || visitor.visitId}/status-history`, {
          headers: {
            'Authorization': user?.token ? `Bearer ${user.token}` : ''
          }
        });

        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
        } else {
          setError('Failed to load history');
        }
      } catch (err) {
        setError('Error fetching history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (visitor) {
      fetchHistory();
    }
  }, [visitor, user, networkIp]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'APPROVED':
      case 'Approved':
        return <CheckCircle className="text-green-500 w-5 h-5" />;
      case 'REJECTED':
      case 'Rejected':
        return <XCircle className="text-red-500 w-5 h-5" />;
      case 'DATE_CHANGED':
      case 'TIME_CHANGED':
        return <Calendar className="text-blue-500 w-5 h-5" />;
      case 'CHECKED_IN':
      case 'Inside':
      case 'Checked In':
        return <ShieldCheck className="text-indigo-500 w-5 h-5" />;
      case 'CHECKED_OUT':
      case 'Checked Out':
      case 'Exited':
        return <MapPin className="text-purple-500 w-5 h-5" />;
      default:
        return <Clock className="text-gray-500 w-5 h-5" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Approval History</h2>
            <p className="text-sm text-gray-500 mt-1">{visitor?.visitorName} ({visitor?.visitId})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto hide-scrollbar">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand-indigo)]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No history available for this visitor.</div>
          ) : (
            <div className="relative border-l-2 border-gray-100 ml-3 space-y-8 pb-4">
              {history.map((item, index) => (
                <div key={index} className="relative pl-6">
                  <div className="absolute -left-[11px] bg-white p-1 rounded-full">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-gray-900">{item.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-500 font-medium">
                        {formatDate(item.changedAt)} • {formatTime(item.changedAt)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--color-brand-indigo)]/10 flex items-center justify-center text-[var(--color-brand-indigo)] font-bold text-xs">
                        {(item.changedBy?.name || item.changedByRole || 'S').charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {item.changedBy?.name || 'System User'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {item.changedByRole || item.changedBy?.role || 'System'}
                      </span>
                    </div>

                    {item.reason && (
                      <p className="text-sm text-gray-600 mt-2 p-2 bg-white rounded-lg border border-gray-100">
                        <span className="font-semibold text-gray-700">Reason:</span> {item.reason}
                      </p>
                    )}

                    {(item.previousAppointmentDate || item.newAppointmentDate) && (
                      <div className="mt-3 text-sm flex flex-col gap-1 bg-white p-3 rounded-lg border border-gray-100">
                        {item.previousAppointmentDate && item.newAppointmentDate && item.previousAppointmentDate !== item.newAppointmentDate && (
                          <div className="flex justify-between items-center text-gray-600">
                            <span>Date:</span>
                            <span className="flex items-center gap-2">
                              <span className="line-through text-red-400">{formatDate(item.previousAppointmentDate)}</span>
                              <span>→</span>
                              <span className="font-medium text-green-600">{formatDate(item.newAppointmentDate)}</span>
                            </span>
                          </div>
                        )}
                        {item.previousAppointmentStartTime && item.newAppointmentStartTime && item.previousAppointmentStartTime !== item.newAppointmentStartTime && (
                          <div className="flex justify-between items-center text-gray-600">
                            <span>Time:</span>
                            <span className="flex items-center gap-2">
                              <span className="line-through text-red-400">{item.previousAppointmentStartTime}</span>
                              <span>→</span>
                              <span className="font-medium text-green-600">{item.newAppointmentStartTime}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisitorHistoryModal;
