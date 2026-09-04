import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { normalizeBranchName } from '../utils/branchUtils';

const BranchContext = createContext(null);

export const BranchProvider = ({ children }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState('All Branches');
  const [loadingBranches, setLoadingBranches] = useState(true);

  useEffect(() => {
    const fetchBranches = async () => {
      if (!user || user.isExpired) {
        setBranches(['All Branches']);
        setActiveBranch('All Branches');
        setLoadingBranches(false);
        return;
      }

      try {
        setLoadingBranches(true);
        const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
        const token = localStorage.getItem('token') || user.token;
        const response = await fetch(`${API_URL}/api/branch-settings`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Company-Id': user?.companyId || '',
            'X-User-Id': user?._id || user?.id || 'bootstrap',
            'X-User-Role': user?.role || 'User',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });
        
        let dynamicBranches = [];
        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data) 
            ? data 
            : (data && Array.isArray(data.data) ? data.data : (data && Array.isArray(data.branches) ? data.branches : []));
          dynamicBranches = list.map(b => b.branchName).filter(Boolean);
        }

        const branchSet = new Set();
        dynamicBranches.forEach(b => {
          if (b && b !== 'All Branches') {
            const norm = normalizeBranchName(b);
            if (norm && norm !== 'All Branches') branchSet.add(norm);
          }
        });

        const allB = branchSet.size > 0 ? ['All Branches', ...Array.from(branchSet)] : ['All Branches'];
        setBranches(allB);
        
        // Roles that can view All Branches.
        if (!['Super Admin', 'Company Admin', 'MD', 'Senior HR', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'HR', 'Security', 'Receptionist'].includes(user.role)) {
          const userBranchNorm = user.branch ? normalizeBranchName(user.branch) : Array.from(branchSet)[0];
          setActiveBranch(userBranchNorm || 'All Branches');
        } else {
          setActiveBranch('All Branches');
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
        setBranches(['All Branches']);
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
