import React, { createContext, useState, useContext, useEffect } from 'react';
import { useBranch } from './BranchContext';
import { useAuth } from './AuthContext';

const ZoneContext = createContext(null);
const API_URL = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/zones`;

export const ZoneProvider = ({ children }) => {
  const { activeBranch } = useBranch();
  const { user: currentUser } = useAuth();
  const [allZones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch zones from backend
  const fetchZones = async () => {
    if (!currentUser || currentUser.isExpired) return;
    try {
      const response = await fetch(API_URL, {
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` }),
          'X-Company-Id': currentUser?.companyId || '',
          'X-User-Id': currentUser?.id || currentUser?._id || '',
          'X-User-Role': currentUser?.role || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.zones) ? data.zones : []);
        setZones(list);
      }
    } catch (err) {
      console.error('Failed to fetch zones from backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || !currentUser.token || currentUser.isExpired) {
      setZones([]);
      setLoading(false);
      return;
    }

    fetchZones();
    const interval = setInterval(fetchZones, 10000);
    return () => clearInterval(interval);
  }, [currentUser, activeBranch]);

  const zones = React.useMemo(() => {
    const safeAll = Array.isArray(allZones) ? allZones : [];
    if (activeBranch === 'All Branches') return safeAll;
    return safeAll.filter(z => z.branch === activeBranch);
  }, [allZones, activeBranch]);

  const addZone = async (zoneData) => {
    const userBranch = currentUser && !['Super Admin'].includes(currentUser.role) 
      ? currentUser.branch 
      : (activeBranch === 'All Branches' ? '' : activeBranch);
    const newZone = { ...zoneData, branch: userBranch };
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        },
        body: JSON.stringify(newZone)
      });
      if (response.ok) {
        const savedZone = await response.json();
        setZones([...allZones, savedZone]);
      }
    } catch (err) {
      console.error('Failed to save zone:', err);
    }
  };

  const updateZone = async (id, updatedData) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        },
        body: JSON.stringify(updatedData)
      });
      if (response.ok) {
        const updated = await response.json();
        setZones(allZones.map(z => z.id === id ? updated : z));
      }
    } catch (err) {
      console.error('Failed to update zone:', err);
    }
  };

  return (
    <ZoneContext.Provider value={{ zones, addZone, updateZone }}>
      {children}
    </ZoneContext.Provider>
  );
};

export const useZones = () => useContext(ZoneContext);
