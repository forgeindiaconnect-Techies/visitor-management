import React, { createContext, useState, useContext, useEffect } from 'react';
import { useBranch } from './BranchContext';
import { useAuth } from './AuthContext';

const BlacklistContext = createContext(null);
const API_URL = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/blacklist`;

export const BlacklistProvider = ({ children }) => {
  const { activeBranch } = useBranch();
  const { user: currentUser } = useAuth();
  const [allBlacklisted, setBlacklisted] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBlacklist = async () => {
    try {
      const response = await fetch(API_URL, { 
        cache: 'no-store',
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
        setBlacklisted(data);
      }
    } catch (err) {
      console.error('Failed to fetch blacklist:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!currentUser || !currentUser.token) {
      setBlacklisted([]);
      setLoading(false);
      return;
    }

    fetchBlacklist();
    const interval = setInterval(fetchBlacklist, 10000); // Auto-refresh every 10 seconds
    return () => clearInterval(interval);
  }, [currentUser, activeBranch]);

  const blacklisted = React.useMemo(() => {
    if (activeBranch === 'All Branches') return allBlacklisted;
    return allBlacklisted.filter(b => b.branch === activeBranch);
  }, [allBlacklisted, activeBranch]);

  const addToBlacklist = async (data) => {
    const userBranch = currentUser && !['Super Admin'].includes(currentUser.role) 
      ? currentUser.branch 
      : (activeBranch === 'All Branches' ? '' : activeBranch);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(currentUser?.token && { 'Authorization': `Bearer ${currentUser.token}` })
        },
        body: JSON.stringify({ ...data, branch: userBranch, blockedDate: new Date().toISOString().split('T')[0] })
      });
      if (response.ok) {
        const saved = await response.json();
        setBlacklisted([...allBlacklisted, saved]);
      }
    } catch (err) {
      console.error('Failed to add to blacklist:', err);
    }
  };

  const isBlacklisted = (mobileNumber) => {
    return blacklisted.some(b => b.mobileNumber === mobileNumber);
  };

  return (
    <BlacklistContext.Provider value={{ blacklisted, addToBlacklist, isBlacklisted }}>
      {children}
    </BlacklistContext.Provider>
  );
};

export const useBlacklist = () => useContext(BlacklistContext);
