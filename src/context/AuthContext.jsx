import React, { createContext, useState, useContext, useEffect } from 'react';
import { getMessaging, getToken } from "firebase/messaging";
import { app } from "../firebase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('zmvms_user') || sessionStorage.getItem('zmvms_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [approvalRoles, setApprovalRoles] = useState([]);
  const [hasApprovalPermission, setHasApprovalPermission] = useState(false);

  // Set current user's approval permissions locally
  useEffect(() => {
    if (user) {
      const allowedRoles = ['Super Admin', 'SaaS Super Admin', 'MD', 'Admin'];
      const isAllowed = allowedRoles.includes(user.role);
      setHasApprovalPermission(isAllowed);
    } else {
      setHasApprovalPermission(false);
    }
  }, [user]);

  // Global API Interceptor (Phase 25 & Step 8)
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let response = await originalFetch(...args);
      
      // Handle 401 Unauthorized - Attempt Silent Refresh
      if (response.status === 401) {
        const refreshUrl = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/auth/refresh`;
        // Prevent infinite loops if the refresh itself is 401
        if (args[0] !== refreshUrl) {
          try {
            const refreshRes = await originalFetch(refreshUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // credentials: 'omit' is default, but cookies must be sent for refresh
              credentials: 'include' 
            });
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              // Update token
              localStorage.setItem('token', refreshData.token);
              updateUser({ token: refreshData.token });
              
              // Retry original request with new token
              const retryOpts = args[1] || {};
              const retryHeaders = new Headers(retryOpts.headers || {});
              retryHeaders.set('Authorization', `Bearer ${refreshData.token}`);
              
              response = await originalFetch(args[0], { ...retryOpts, headers: retryHeaders });
            } else {
              // Refresh failed, force logout
              logout();
            }
          } catch (err) {
            console.error('Refresh token error', err);
            logout();
          }
        }
      }

      // Handle 403 Forbidden - Subscription Expiry
      if (response.status === 403) {
        const clone = response.clone();
        try {
          const data = await clone.json();
          if (data.subscriptionExpired) {
            updateUser({ isExpired: true });
          }
        } catch (err) {}
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const login = async (email, password, rememberMe = false) => {
    try {
      const url = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/auth/login`;
      console.log('Attempting login to:', url);
      
      let fcmToken = "";

      if (window.REACT_NATIVE_PUSH_TOKEN) {
        fcmToken = window.REACT_NATIVE_PUSH_TOKEN;
        console.log("Using React Native Expo Push Token:", fcmToken);
      } else {
        try {
          if (('Notification' in window) && Notification.permission === 'granted') {
            const messaging = getMessaging(app);
            if (messaging) {
              const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BMi4WOvwwzgiCpfLZj4rtSWDM0bHHL1ciowr6sbaGD6aQjSWsrkKae0Cfale0Q-Z8huo8grneu2XI5pEzfREgV";
              fcmToken = await getToken(messaging, { vapidKey }).catch(() => "");
            }
          }
        } catch (error) {}
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fcmToken })
      });

      const userData = await response.json();

      if (response.ok) {
        setUser(userData);
        localStorage.setItem('token', userData.token); // Explicitly store token
        if (rememberMe) {
          localStorage.setItem('zmvms_user', JSON.stringify(userData));
        } else {
          sessionStorage.setItem('zmvms_user', JSON.stringify(userData));
        }
        return { success: true };
      }
      return { success: false, message: userData.message || `Server responded with status: ${response.status}` };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: `Network error: ${err.message}` };
    }
  };

  const logout = async () => {
    try {
      const url = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/auth/logout`;
      await fetch(url, { method: 'POST', credentials: 'include' });
    } catch(err) {
      console.error(err);
    }
    setUser(null);
    localStorage.removeItem('zmvms_user');
    sessionStorage.removeItem('zmvms_user');
    localStorage.removeItem('token'); // Clear token
    localStorage.removeItem('zmvms_visitors');
    sessionStorage.removeItem('zmvms_visitors');
  };

  const updateUser = (updates) => {
    setUser(prev => {
      if (!prev) return null;
      const updatedUser = { ...prev, ...updates };
      if (localStorage.getItem('zmvms_user')) {
        localStorage.setItem('zmvms_user', JSON.stringify(updatedUser));
      } else if (sessionStorage.getItem('zmvms_user')) {
        sessionStorage.setItem('zmvms_user', JSON.stringify(updatedUser));
      }
      return updatedUser;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, approvalRoles, hasApprovalPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
