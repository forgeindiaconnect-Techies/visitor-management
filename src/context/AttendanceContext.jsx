import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useBranch } from './BranchContext';

const AttendanceContext = createContext(null);
const API_URL = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/attendance`;

export const AttendanceProvider = ({ children }) => {
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  const [attendance, setAttendance] = useState(null);
  const [allAttendance, setAllAttendance] = useState([]);
  
  const today = new Date().toISOString().split('T')[0];

  const fetchAttendance = async () => {
    if (!user) return;
    
    try {
      let queryUrl = API_URL;
      
      if (user.role === 'Security') {
        // Fetch only today's attendance for the logged-in security user
        queryUrl = `${API_URL}?securityId=${user.id}&date=${today}`;
      } else {
        // Admin, MD, Super Admin fetch all attendance logs (filtered by branch)
        let queryBranch = user.branch;
        if (['Super Admin', 'SaaS Super Admin', 'MD', 'Admin'].includes(user.role)) {
          queryBranch = activeBranch === 'All Branches' ? null : activeBranch;
        }
        queryUrl = queryBranch ? `${API_URL}?branch=${encodeURIComponent(queryBranch)}` : API_URL;
      }
      
      const response = await fetch(queryUrl, { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token && { 'Authorization': `Bearer ${user.token}` }),
          'X-Company-Id': user?.companyId || '',
          'X-User-Id': user?.id || user?._id || '',
          'X-User-Role': user?.role || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        
        if (user.role === 'Security') {
          // It should be an array of length 0 or 1 for today
          setAttendance(data.length > 0 ? data[0] : null);
        } else {
          setAllAttendance(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    }
  };

  useEffect(() => {
    if (!user || !user.token) {
      setAttendance(null);
      setAllAttendance([]);
      return;
    }

    fetchAttendance();
    const interval = setInterval(fetchAttendance, 10000);
    return () => clearInterval(interval);
  }, [user, activeBranch]);

  const formatTime = (dateObj) => {
    return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const calculateHours = (startStr, endStr) => {
    const start = new Date(`1970/01/01 ${startStr}`);
    const end = new Date(`1970/01/01 ${endStr}`);
    let diff = (end - start) / 1000 / 60; // in minutes
    if (diff < 0) diff += 24 * 60;
    
    const h = Math.floor(diff / 60);
    const m = Math.floor(diff % 60);
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  };

  const checkIn = async (photoData, location = null) => {
    if (!user) return;
    
    const now = formatTime(new Date());
    const payload = {
      securityId: user.id,
      securityName: user.name,
      branch: user.branch,
      date: today,
      checkInTime: now,
      checkInPhoto: photoData,
      checkInLocation: location
    };

    try {
      const response = await fetch(`${API_URL}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const saved = await response.json();
        setAttendance(saved);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const checkOut = async (photoData, location = null) => {
    if (!attendance || attendance.attendanceStatus === 'Completed' || attendance.attendanceStatus === 'Auto Checked-Out') return;

    const now = formatTime(new Date());
    const workingHours = calculateHours(attendance.checkInTime, now);

    try {
      // NOTE: Using attendanceId because that's what the route expects now
      const idToUse = attendance.attendanceId || attendance._id;
      const response = await fetch(`${API_URL}/checkout/${idToUse}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          checkOutTime: now, 
          workingHours, 
          checkOutPhoto: photoData,
          checkOutLocation: location
        })
      });
      if (response.ok) {
        const updated = await response.json();
        setAttendance(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AttendanceContext.Provider value={{ attendance, allAttendance, checkIn, checkOut, fetchAttendance }}>
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => useContext(AttendanceContext);
