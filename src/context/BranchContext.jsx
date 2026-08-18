import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const BranchContext = createContext(null);

export const BranchProvider = ({ children }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState(['All Branches']);
  const [activeBranch, setActiveBranch] = useState('All Branches');
  const [loadingBranches, setLoadingBranches] = useState(true);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!user) {
        setBranches(['All Branches']);
        setActiveBranch('All Branches');
        setLoadingBranches(false);
        return;
      }

      try {
        setLoadingBranches(true);
        const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
        const response = await fetch(`${API_URL}/api/branch-settings`, {
          headers: {
            ...(user.token && { 'Authorization': `Bearer ${user.token}` })
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data) ? data : (data && Array.isArray(data.branches) ? data.branches : []);
          const dynamicBranches = list.map(b => b.branchName).filter(Boolean);
          const allB = ['All Branches', ...dynamicBranches];
          setBranches(allB);
          
          // Roles that can view All Branches. Everyone else is locked to their assigned branch.
          if (!['Super Admin', 'MD', 'Senior HR', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'HR'].includes(user.role)) {
            setActiveBranch(user.branch || dynamicBranches[0] || 'All Branches');
          } else {
            setActiveBranch('All Branches');
          }
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [user]);

  return (
    <BranchContext.Provider value={{ branches, activeBranch, setActiveBranch, loadingBranches }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => useContext(BranchContext);
