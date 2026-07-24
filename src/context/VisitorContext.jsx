import React, { createContext, useState, useContext, useEffect } from 'react';
import { useBranch } from './BranchContext';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';

const VisitorContext = createContext(null);
const API_URL = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/visitors`;

export const VisitorProvider = ({ children }) => {
  const { activeBranch } = useBranch();
  const { addNotification } = useNotification();
  const { user: currentUser } = useAuth();
  
  const [allVisitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [networkIp, setNetworkIp] = useState(window.location.hostname);
  const allVisitorsRef = React.useRef([]);

  useEffect(() => {
    // Fetch network IP for mobile QR code scanning
    fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/network-ip`)
      .then(res => res.json())
      .then(data => {
        if (data && data.ip) {
          setNetworkIp(data.ip);
        }
      })
      .catch(console.error);
  }, []);

  // Clear visitors explicitly if company changes (prevent cross-tenant leakage)
  const currentCompanyRef = React.useRef(currentUser?.companyId);

  // Fetch visitors from backend
  const fetchVisitors = async () => {
    if (!currentUser) {
      setVisitors([]);
      allVisitorsRef.current = [];
      setLoading(false);
      return;
    }

    if (currentCompanyRef.current !== currentUser.companyId) {
      setVisitors([]);
      allVisitorsRef.current = [];
      currentCompanyRef.current = currentUser.companyId;
    }
    try {
      let queryBranch = currentUser?.branch;
      if (currentUser?.role === 'Super Admin') {
        queryBranch = activeBranch === 'All Branches' ? null : activeBranch;
      }
      
      const fetchUrl = queryBranch && queryBranch !== 'All Branches' 
        ? `${API_URL}?branch=${encodeURIComponent(queryBranch)}` 
        : API_URL;
      
      const headers = currentUser?.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {};
      if (currentUser) {
        headers['x-user-id'] = currentUser.id || currentUser._id;
        headers['x-company-id'] = currentUser.companyId;
        headers['x-user-role'] = currentUser.role;
        headers['x-branch-id'] = currentUser.branch;
      }
      
      console.log('Fetching visitors from API...', fetchUrl);
      const response = await fetch(fetchUrl, { 
        cache: 'no-store',
        headers
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Visitors fetched successfully:', data);

        if (allVisitorsRef.current.length > 0) {
          const existingIds = new Set(allVisitorsRef.current.map(v => v._id || v.id));
          const newVisitors = data.filter(v => !(existingIds.has(v._id || v.id)));
          
          newVisitors.forEach(nv => {
            // Only notify if the new visitor is relevant to the active branch view
            if (activeBranch === 'All Branches' || (nv.branch && nv.branch.includes(activeBranch))) {
              addNotification('New Visitor Alert', `${nv.visitorName} has been registered at ${nv.branch || 'Facility'}.`, 'info');
            }
          });
        }
        
        allVisitorsRef.current = data;
        setVisitors(data);
      } else {
        console.error('Failed to fetch visitors');
      }
    } catch (err) {
      console.error('API connection error:', err);
      // Fallback to local storage if API is down
      const saved = localStorage.getItem('zmvms_visitors');
      if (saved) {
        setVisitors(JSON.parse(saved));
      } else {
        // Fallback dummy data if nothing exists
        setVisitors([{
          id: '1',
          visitorName: 'John Doe',
          mobileNumber: '1234567890',
          email: 'john@example.com',
          companyName: 'Acme Corp',
          hostName: 'Jane Smith',
          purpose: 'Meeting',
          visitDate: new Date().toISOString().split('T')[0],
          status: 'Pending',
          branch: 'Chennai',
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setVisitors([]);
      allVisitorsRef.current = [];
      setLoading(false);
      return;
    }

    fetchVisitors();
    
    // Auto-refresh data every 5 seconds so Admin dashboard updates in real-time
    const interval = setInterval(fetchVisitors, 5000);
    return () => clearInterval(interval);
  }, [activeBranch, currentUser]);

  const visitors = React.useMemo(() => {
    // If not restricted (Super Admin) and 'All Branches' is selected
    if (activeBranch === 'All Branches') return allVisitors;
    // Otherwise return visitors matching the active branch
    return allVisitors.filter(v => {
      if (!v.branch) return false;
      const vBranchUpper = v.branch.toUpperCase();
      const activeUpper = activeBranch.toUpperCase();
      if (vBranchUpper === activeUpper) return true;
      if (activeUpper.includes('THIRUPATTUR') && vBranchUpper === 'TIRUPATTUR') return true;
      if (activeUpper.includes('KRISHNAGIRI') && vBranchUpper === 'SALEM') return true;
      if (activeUpper === 'BANGALORE' && vBranchUpper === 'BANGALORE') return true;
      return false;
    });
  }, [allVisitors, activeBranch]);

  const addVisitor = async (visitorData) => {
    // Only Super Admin uses the activeBranch from dropdown or form.
    // Admin, Security, and MD are locked to their own branch.
    let userBranch = visitorData.branch;
    if (!userBranch) {
      userBranch = currentUser && !['Super Admin'].includes(currentUser.role) 
        ? currentUser.branch 
        : (activeBranch === 'All Branches' ? 'Chennai' : activeBranch);
    }
    
    const newVisitor = {
      ...visitorData,
      status: visitorData.status || 'Pending',
      branch: userBranch,
    };
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        },
        body: JSON.stringify(newVisitor)
      });
      
      if (response.ok) {
        const savedVisitor = await response.json();
        setVisitors(prev => {
          const newList = [...prev, savedVisitor];
          allVisitorsRef.current = newList;
          return newList;
        });
        addNotification('Visitor Registered', `${savedVisitor.visitorName} has been pre-registered.`, 'success');
      } else {
        const errorData = await response.json();
        addNotification('Registration Failed', errorData.message || 'Server rejected the request', 'error');
      }
    } catch (err) {
      console.error(err);
      // Fallback for when backend is completely unreachable (NetworkError)
      const fallbackVisitor = { ...newVisitor, id: Date.now().toString() };
      setVisitors(prev => {
        const newList = [...prev, fallbackVisitor];
        allVisitorsRef.current = newList;
        return newList;
      });
      addNotification('Visitor Registered (Offline)', `${fallbackVisitor.visitorName} saved locally.`, 'warning');
    }
  };

  const updateVisitorStatus = async (id, newStatus, approvalData = {}) => {
    const updates = { 
      status: newStatus,
      remarks: approvalData.remarks,
      approvedBy: approvalData.approvedBy
    };

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updatedVisitor = await response.json();
        setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) ? updatedVisitor : v));
      }
    } catch (err) {
      console.error(err);
      setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) ? { ...v, ...updates } : v));
    }
    
    if (newStatus === 'Approved') {
      addNotification('Visitor Approved', `Access granted for visitor ID: ${id}`, 'success');
    } else if (newStatus === 'Rejected') {
      addNotification('Visitor Rejected', `Access denied for visitor ID: ${id}`, 'error');
    }
  };

  const approveVisitor = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}/approve`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        }
      });
      if (response.ok) {
        const updated = await response.json();
        setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) ? updated : v));
        addNotification('Visitor Approved', `QR Pass generated for ${updated.visitorName} (Booking ID: ${updated.bookingId || id})`, 'success');
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const rejectVisitor = async (id, rejectionReason = 'Meeting Cancelled') => {
    try {
      const response = await fetch(`${API_URL}/${id}/reject`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        },
        body: JSON.stringify({ rejectionReason })
      });
      if (response.ok) {
        const updated = await response.json();
        setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) ? updated : v));
        addNotification('Visitor Rejected', `Pre-booking request for ${updated.visitorName} rejected.`, 'info');
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const updateVisitor = async (id, updates) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updatedVisitor = await response.json();
        setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) ? updatedVisitor : v));
        addNotification('Visitor Updated', 'Visitor details updated successfully', 'success');
        return true;
      } else {
         throw new Error('API Update failed');
      }
    } catch (err) {
      console.error(err);
      addNotification('Update Failed', 'Failed to update visitor details', 'error');
      return false;
    }
  };

  const updateVisitorTracking = async (id, trackingData) => {
    try {
      const response = await fetch(`${API_URL}/${id}/zone`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        },
        body: JSON.stringify(trackingData)
      });
      
      if (response.ok) {
        const updatedVisitor = await response.json();
        setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) ? updatedVisitor : v));
      } else {
         throw new Error('API Update failed');
      }
    } catch (err) {
      console.error(err);
      setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) ? { ...v, ...trackingData } : v));
    }
    
    if (trackingData.status === 'Inside') {
      addNotification('Visitor Entered', `Visitor entered ${trackingData.currentZone}`, 'info');
    } else if (trackingData.status === 'Exited') {
      addNotification('Visitor Exited', `Visitor exited the premises`, 'info');
    }
  };

  // Keep local storage updated as a backup
  useEffect(() => {
    if (allVisitors) {
      localStorage.setItem('zmvms_visitors', JSON.stringify(allVisitors));
    }
  }, [allVisitors]);

  return (
    <VisitorContext.Provider value={{ visitors, allVisitors, addVisitor, updateVisitorStatus, approveVisitor, rejectVisitor, updateVisitorTracking, updateVisitor, loading, networkIp }}>
      {children}
    </VisitorContext.Provider>
  );
};

export const useVisitors = () => useContext(VisitorContext);
