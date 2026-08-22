import React, { useState } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuth } from '../../context/AuthContext';
import { formatAppointmentDate, formatAppointmentTime } from '../../utils/dateUtils';

const isAllowedDay = (date) => {
  const day = date.getDay();
  return [1, 3, 6].includes(day);
};

const VisitorRescheduleModal = ({ visitor, onClose, onSuccess }) => {
  const { user } = useAuth();
  
  // Format current dates for inputs if they exist
  const getInitialDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const getInitialTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1]);
        const m = match[2];
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${m}`;
      }
      return timeStr;
    } catch (e) {
      return '';
    }
  };

  const [date, setDate] = useState(getInitialDate(visitor.visitDate));
  const [startTime, setStartTime] = useState(getInitialTime(visitor.expectedArrivalTime || visitor.expectedTime));
  const [endTime, setEndTime] = useState(getInitialTime(visitor.appointmentEndTime));
  const [reason, setReason] = useState('Host requested rescheduling');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatTo12Hour = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hInt = parseInt(h);
    const ampm = hInt >= 12 ? 'PM' : 'AM';
    hInt = hInt % 12;
    if (hInt === 0) hInt = 12;
    return `${hInt.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !startTime) {
      setError('Date and Start Time are required.');
      return;
    }

    const chosenDate = new Date(`${date}T00:00:00`);
    if (!isAllowedDay(chosenDate)) {
      setError('Pre-booking is allowed only on Monday, Wednesday, and Saturday.');
      return;
    }

    if (endTime && endTime <= startTime) {
      setError('End time must be later than start time.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        visitDate: date,
        expectedTime: formatTo12Hour(startTime),
        reason: reason || 'Appointment Rescheduled'
      };

      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
      const token = localStorage.getItem('token');
      const vId = visitor.visitorId || visitor.visitId || visitor._id || visitor.id;
      
      console.log('🔍 Rescheduling visitor:', visitor);
      console.log('🔍 Reschedule ID:', vId);
      
      let res = await fetch(`${API_URL}/api/prebookings/${vId}/reschedule`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok && res.status === 404) {
        res = await fetch(`${API_URL}/api/prebookings/${vId}/reschedule`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok && res.status === 404) {
        res = await fetch(`${API_URL}/api/visitors/${vId}/reschedule`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to reschedule appointment.');
      }

      const data = await res.json();

      if (onSuccess) {
        onSuccess(data);
      }
      onClose();
    } catch (err) {
      console.error('Error rescheduling:', err);
      setError(err.message || 'Failed to reschedule appointment.');
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-auto relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2 text-indigo-700">
            <Calendar size={22} className="stroke-[2.5]" />
            <h2 className="text-xl font-bold tracking-tight">Reschedule Appointment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {/* Current Info Display */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center text-sm">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Appointment</span>
              <p className="font-bold text-slate-800">{formatAppointmentDate(visitor.visitDate)}</p>
              <p className="text-slate-600 font-medium">{formatAppointmentTime(visitor.expectedArrivalTime || visitor.expectedTime)} {visitor.appointmentEndTime ? `- ${formatAppointmentTime(visitor.appointmentEndTime)}` : ''}</p>
            </div>
            <Clock size={32} className="text-slate-300" />
          </div>

          <hr className="border-slate-100" />

          {/* Inputs */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">New Date <span className="text-red-500">*</span></label>
            <DatePicker
              selected={date ? new Date(`${date}T00:00:00`) : null}
              onChange={(selectedDate) => {
                if (!selectedDate) {
                  setDate('');
                  return;
                }

                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');

                setDate(`${year}-${month}-${day}`);
              }}
              filterDate={isAllowedDay}
              minDate={new Date()}
              dateFormat="dd/MM/yyyy"
              placeholderText="Select visit date"
              className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm font-medium transition-shadow cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">New Start Time <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock size={16} className="text-gray-400" />
                </div>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm font-medium transition-shadow"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">New End Time</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock size={16} className="text-gray-400" />
                </div>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm font-medium transition-shadow"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Reason for Rescheduling</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm font-medium transition-shadow"
              placeholder="e.g. Host requested rescheduling"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default VisitorRescheduleModal;
