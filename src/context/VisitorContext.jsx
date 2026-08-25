import React, { createContext, useState, useContext, useEffect } from 'react';
import { useBranch } from './BranchContext';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';

const VisitorContext = createContext(null);
const rawBase = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')).replace(/\/api\/?$/, '');
const API_URL = `${rawBase}/api/visitors`;
const PREBOOKINGS_API_URL = `${rawBase}/api/prebookings`;

export const VisitorProvider = ({ children }) => {
  const { activeBranch } = useBranch();
  const { addNotification } = useNotification();
  const { user: currentUser } = useAuth();

  const getHeaders = (isJson = true) => {
    const token = currentUser?.token || localStorage.getItem('token');
    const headers = {};
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (currentUser) {
      headers['x-user-id'] = currentUser.id || currentUser._id;
      headers['x-company-id'] = currentUser.companyId;
      headers['x-user-role'] = currentUser.role;
      headers['x-branch-id'] = currentUser.branch;
    }
    return headers;
  };
  
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
      if (['Super Admin', 'MD', 'Senior HR', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'HR'].includes(currentUser?.role)) {
        queryBranch = activeBranch === 'All Branches' ? null : activeBranch;
      }
      
      const fetchUrl = queryBranch && queryBranch !== 'All Branches' 
        ? `${API_URL}?branch=${encodeURIComponent(queryBranch)}` 
        : API_URL;
      
      const headers = getHeaders(false);
      
      const prebookingFetchUrl = queryBranch && queryBranch !== 'All Branches' 
        ? `${PREBOOKINGS_API_URL}?branch=${encodeURIComponent(queryBranch)}` 
        : PREBOOKINGS_API_URL;

      console.log('Fetching visitors and pre-bookings from API...');
      const [visitorsRes, preBookingsRes] = await Promise.all([
        fetch(fetchUrl, { cache: 'no-store', headers }).catch(() => ({ ok: false })),
        fetch(prebookingFetchUrl, { cache: 'no-store', headers }).catch(() => ({ ok: false }))
      ]);

      let visitorsData = [];
      let preBookingsData = [];

      if (visitorsRes.ok) {
        const vJson = await visitorsRes.json();
        visitorsData = Array.isArray(vJson)
          ? vJson
          : Array.isArray(vJson?.visitors)
            ? vJson.visitors
            : Array.isArray(vJson?.data)
              ? vJson.data
              : [];
      }
      if (preBookingsRes.ok) {
        const pbJson = await preBookingsRes.json();
        preBookingsData = Array.isArray(pbJson)
          ? pbJson
          : Array.isArray(pbJson?.prebookings)
            ? pbJson.prebookings
            : Array.isArray(pbJson?.data)
              ? pbJson.data
              : [];
      }

      const safePBData = Array.isArray(preBookingsData) ? preBookingsData : [];
      const safeVData = Array.isArray(visitorsData) ? visitorsData : [];

      // Normalize pre-bookings to match visitor schema for the Dashboard UI
      const normalizedPreBookings = safePBData.map(pb => {
        if (!pb) return null;
        // Dashboard uses v.status === 'Pending', but prebookings use 'Pending Approval' or 'PENDING'
        const rawStatus = pb.status || '';
        let normalizedStatus = rawStatus;
        if (rawStatus.toUpperCase() === 'PENDING APPROVAL' || rawStatus.toUpperCase() === 'PENDING') {
          normalizedStatus = 'Pending';
        }

        return {
          ...pb,
          id: pb._id || pb.id,
          isPreBooking: true,
          visitorName: pb.fullName || pb.visitorName || 'Visitor',
          purpose: pb.visitPurpose || pb.purpose || 'Visit',
          branch: pb.branchLocation || pb.branch || 'Head Office',
          hostName: pb.hostEmployee || pb.hostName || 'Staff',
          status: normalizedStatus
        };
      }).filter(Boolean);

      // Sort newest first before deduplication
      const allCombined = [...safeVData, ...normalizedPreBookings].sort(
        (a, b) => new Date(b.createdAt || b.date || b.visitDate || 0) - new Date(a.createdAt || a.date || a.visitDate || 0)
      );

      // Deduplicate strictly by Document ID (preventing cross-endpoint duplication of the exact same document)
      const seenIds = new Set();
      const mergedData = [];

      for (const item of allCombined) {
        const idKey = String(item._id || item.id || item.visitorId || '');

        if (idKey && seenIds.has(idKey)) continue;

        if (idKey) seenIds.add(idKey);
        mergedData.push(item);
      }

      // Filter by host name for HR / Employee roles to enforce visibility isolation
      let finalData = mergedData;
      if (currentUser && ['HR', 'Employee'].includes(currentUser.role)) {
        const currentUserNameLower = (currentUser.name || '').toLowerCase().trim();
        finalData = mergedData.filter(v => 
          (v.hostName || '').toLowerCase().trim() === currentUserNameLower ||
          (v.hostEmployee || '').toLowerCase().trim() === currentUserNameLower
        );
      }

      if (allVisitorsRef.current.length > 0) {
        const existingIds = new Set(allVisitorsRef.current.map(v => v._id || v.id));
        const newVisitors = finalData.filter(v => !(existingIds.has(v._id || v.id)));
        
        newVisitors.forEach(nv => {
          if (activeBranch === 'All Branches' || (nv.branch && nv.branch.includes(activeBranch))) {
            const label = nv.isPreBooking ? 'Pre-Booking Alert' : 'Direct Visit Alert';
            addNotification(label, `${nv.visitorName} has been registered at ${nv.branch || 'Facility'}.`, 'info');
          }
        });
      }
      
      allVisitorsRef.current = finalData;
      setVisitors(finalData);
    } catch (err) {
      console.error('API connection error:', err);
      // Fallback to local storage if API is down
      const saved = localStorage.getItem('zmvms_visitors');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setVisitors(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setVisitors([]);
        }
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
          branch: 'Head Office(KRISHNAGIRI)',
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
    const safeAll = Array.isArray(allVisitors) ? allVisitors : [];
    // If not restricted (Super Admin) and 'All Branches' is selected
    if (activeBranch === 'All Branches') return safeAll;
    // Otherwise return visitors matching the active branch
    return safeAll.filter(v => {
      if (!v || !v.branch) return false;
      const vBranchUpper = (v.branch || '').toUpperCase();
      const activeUpper = (activeBranch || '').toUpperCase();
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
        : (activeBranch === 'All Branches' ? 'Head Office(KRISHNAGIRI)' : activeBranch);
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
    const visitor = allVisitorsRef.current.find(v => String(v._id || v.id) === String(id));
    const targetId = visitor?._id || visitor?.id || id;
    
    // Check if this is a Pre-Booking and route to the correct API endpoint
    if (visitor?.isPreBooking) {
      const PREBOOKINGS_API_URL = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/prebookings`;
      
      try {
        let endpointUrl = '';
        if (newStatus === 'Approved') endpointUrl = `${PREBOOKINGS_API_URL}/${targetId}/approve`;
        else if (newStatus === 'Rejected') endpointUrl = `${PREBOOKINGS_API_URL}/${targetId}/reject`;
        
        if (endpointUrl) {
          const response = await fetch(endpointUrl, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
              approvedBy: approvalData.approvedBy,
              remarks: approvalData.remarks
            })
          });
          
          if (response.ok) {
            const updatedVisitor = await response.json();
            // Re-normalize it before saving to state
            const rawData = updatedVisitor.data || updatedVisitor;
            const normalized = {
              ...rawData,
              id: rawData._id || targetId,
              isPreBooking: true,
              status: newStatus,
              approvalStatus: newStatus === 'Approved' ? 'APPROVED' : 'REJECTED',
              visitorName: rawData.fullName || rawData.visitorName,
              purpose: rawData.visitPurpose || rawData.purpose,
              branch: rawData.branchLocation || rawData.branch,
              hostName: rawData.hostEmployee || rawData.hostName,
            };
            setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) || String(v._id || v.id) === String(targetId) ? normalized : v));
            addNotification(`Pre-Booking ${newStatus}`, `Access ${newStatus === 'Approved' ? 'granted' : 'denied'} for ${normalized.visitorName}`, newStatus === 'Approved' ? 'success' : 'error');
            return true;
          } else {
            const errData = await response.json().catch(() => ({}));
            addNotification('Approval Failed', errData.message || `Failed to ${newStatus.toLowerCase()} booking`, 'error');
            return false;
          }
        }
      } catch (err) {
        console.error("Error updating pre-booking:", err);
        addNotification('Error', 'Failed to connect to server', 'error');
        return false;
      }
    }

    const updates = { 
      status: newStatus,
      remarks: approvalData.remarks,
      approvedBy: approvalData.approvedBy
    };

    try {
      const response = await fetch(`${API_URL}/${targetId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updatedVisitor = await response.json();
        setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) || String(v._id || v.id) === String(targetId) ? updatedVisitor : v));
        if (newStatus === 'Approved') {
          addNotification('Visitor Approved', `Access granted for visitor ID: ${id}`, 'success');
        } else if (newStatus === 'Rejected') {
          addNotification('Visitor Rejected', `Access denied for visitor ID: ${id}`, 'error');
        }
        return true;
      } else {
        const errData = await response.json().catch(() => ({}));
        addNotification('Approval Failed', errData.message || 'Failed to update status', 'error');
        return false;
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to connect to server', 'error');
      return false;
    }
  };

  const approveVisitor = async (id) => {
    return updateVisitorStatus(id, 'Approved');
  };

  const rejectVisitor = async (id, rejectionReason = 'Meeting Cancelled') => {
    return updateVisitorStatus(id, 'Rejected', { remarks: rejectionReason });
  };

  const updateVisitor = async (id, updates) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updatedVisitor = await response.json();
        setVisitors(prev => prev.map(v => String(v._id || v.id) === String(id) ? updatedVisitor : v));
        addNotification('Visitor Updated', 'visitor details updated successfully', 'success');
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
        headers: getHeaders(),
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

  const deleteVisitor = async (id, isPreBooking = false) => {
    try {
      const endpoint = isPreBooking 
        ? `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/prebookings/${id}`
        : `${API_URL}/${id}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (res.ok) {
        setVisitors(prev => prev.filter(v => String(v._id || v.id) !== String(id) && String(v.visitorId) !== String(id)));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Delete visitor error:', err);
      return false;
    }
  };

  // Keep local storage updated as a backup
  useEffect(() => {
    if (allVisitors) {
      localStorage.setItem('zmvms_visitors', JSON.stringify(allVisitors));
    }
  }, [allVisitors]);

  return (
    <VisitorContext.Provider value={{ visitors, allVisitors, addVisitor, deleteVisitor, updateVisitorStatus, approveVisitor, rejectVisitor, updateVisitorTracking, updateVisitor, loading, networkIp }}>
      {children}
    </VisitorContext.Provider>
  );
};

export const useVisitors = () => useContext(VisitorContext);
