import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useNotification } from '../../context/NotificationContext';
import { Bell, User, MapPin, Check, Menu, Trash2, ExternalLink } from 'lucide-react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { formatNotificationDate } from '../../utils/dateFormatter';
import { normalizeNotifications } from '../../utils/notificationUtils';
import { formatDisplayName } from '../../utils/nameFormatter';
import { normalizeBranchName } from '../../utils/branchUtils';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.match(/^\d{1,3}\./);
const API_URL = `${import.meta.env.VITE_API_URL || (isLocalhost ? `http://${window.location.hostname}:5000` : 'https://fic-visitor-1.onrender.com')}/api/notifications`;

const Header = ({ toggleSidebar, isSidebarOpen }) => {
  const { user } = useAuth();
  const { branches, activeBranch, setActiveBranch } = useBranch();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const getHeaders = () => ({
    'X-Company-Id': user?.companyId || 'FIC001',
    'X-User-Id': user?._id || user?.id || 'bootstrap',
    'X-User-Role': user?.role || 'User',
    'X-Branch-Id': user?.branch || 'All Branches',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const fetchNotifications = async () => {
    try {
      let queryBranch = user?.branch;
      if (user?.role === 'Super Admin' || user?.role === 'SaaS Super Admin') {
        queryBranch = activeBranch === 'All Branches' ? null : activeBranch;
      }
      
      let fetchUrl = new URL(API_URL);
      if (queryBranch && queryBranch !== 'All Branches') {
        fetchUrl.searchParams.append('branch', queryBranch);
      }
      
      const res = await fetch(fetchUrl.toString(), { 
        cache: 'no-store',
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = normalizeNotifications(data);
        const seen = new Set();
        const uniqueList = rawList.filter((item) => {
          const key =
            item.eventId ||
            `${item.type || ''}_${item.preBookingId || ''}_${item.message || ''}`;

          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setNotifications(uniqueList);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    const socketUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : (isLocalhost ? `http://${window.location.hostname}:5000` : 'https://fic-visitor-1.onrender.com');
    const socket = io(socketUrl);
    
    socket.on('new_notification', (notification) => {
      let queryBranch = user?.branch;
      if (['Super Admin', 'MD', 'Senior HR', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'HR'].includes(user?.role)) {
        queryBranch = activeBranch === 'All Branches' ? null : activeBranch;
      }
      
      // Basic role/branch filtering on socket client
      if (queryBranch && queryBranch !== 'All Branches' && notification.branchId && notification.branchId !== queryBranch && notification.branchId !== 'All Branches') {
        return;
      }

      if (user?.role === 'SaaS Super Admin') {
        const saasTypes = ['Tenant', 'Subscription', 'System', 'Branch', 'Admin', 'Announcement', 'info', 'success', 'warning'];
        if (!saasTypes.includes(notification.type) && notification.createdBy !== 'SaaS Super Admin') {
          return;
        }
      } else if (user?.role !== 'SaaS Super Admin' && notification.companyId && notification.companyId !== 'SYSTEM' && notification.companyId.toUpperCase() !== (user?.companyId || 'FIC001').toUpperCase()) {
        return;
      }

      // Filter out Security Attendance notifications for non-super users
      if (notification.type === 'Attendance' && user?.role !== 'Super Admin' && user?.role !== 'SaaS Super Admin') {
        return;
      }

      // If notification has a recipient or recipients list, verify match
      const currentUserId = String(user?._id || user?.id || '');
      const currentUserRole = user?.role || '';
      
      if (notification.recipients && Array.isArray(notification.recipients) && notification.recipients.length > 0) {
        const matchesUser = notification.recipients.some(r => {
          if (!r) return false;
          if (typeof r === 'string') {
            return (currentUserId && r === currentUserId) || (currentUserRole && r.toLowerCase() === currentUserRole.toLowerCase());
          }
          const rUserId = String(r.userId || r.user || r._id || '');
          const rRole = String(r.role || '');
          return (currentUserId && rUserId === currentUserId) || (currentUserRole && rRole.toLowerCase() === currentUserRole.toLowerCase());
        });
        if (!matchesUser) {
          return;
        }
      } else if (notification.recipient) {
        const rStr = typeof notification.recipient === 'object' ? String(notification.recipient._id || notification.recipient.id || '') : String(notification.recipient);
        if (rStr !== currentUserId && rStr.toLowerCase() !== currentUserRole.toLowerCase()) {
          return;
        }
      }

      const cleanedNotif = normalizeNotifications([notification])[0] || notification;

      setNotifications(prev => {
        const list = Array.isArray(prev) ? prev : [];
        const exists = list.some(item => 
          String(item._id || item.id) === String(cleanedNotif._id || cleanedNotif.id) ||
          (item.eventId && cleanedNotif.eventId && item.eventId === cleanedNotif.eventId)
        );
        if (exists) return list;
        return [cleanedNotif, ...list];
      });
      addNotification(cleanedNotif.title, cleanedNotif.message, 'info');
    });

    return () => socket.disconnect();
  }, [user, activeBranch, addNotification]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}/read`, { 
        method: 'PATCH',
        headers: getHeaders()
      });
      if (res.ok) {
        setNotifications(prev => (Array.isArray(prev) ? prev : []).map(n => n._id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleNotificationClick = (notification) => {
    setNotifications(prev => (Array.isArray(prev) ? prev : []).map(n => n.id === notification.id ? { ...n, isRead: true } : n));
    setShowDropdown(false);
    
    const preBookingId = notification.preBookingId?._id || notification.preBookingId;
    if (preBookingId) {
      if (user?.role === 'Security') {
        navigate(`/visitors/security?searchId=${preBookingId}`);
      } else {
        navigate(`/pre-bookings?preBookingId=${preBookingId}`);
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch(`${API_URL}/read-all`, { 
        method: 'PATCH',
        headers: getHeaders()
      });
      if (res.ok) {
        setNotifications(prev => (Array.isArray(prev) ? prev : []).map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter(n => !n.isRead).length;

  return (
    <header className={`h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-0 ${isSidebarOpen ? 'md:left-64' : ''} flex items-center justify-between px-4 sm:px-6 z-10 shadow-sm transition-all duration-300`}>
      <div className="flex items-center space-x-2 sm:space-x-4">
        {toggleSidebar && (
          <button 
            onClick={toggleSidebar}
            className="text-gray-500 hover:text-[var(--color-brand-indigo)] transition-colors mr-1 sm:mr-2"
          >
            <Menu size={24} />
          </button>
        )}
        <div className="flex flex-col hidden sm:block">
          <h2 className="text-xl font-semibold text-gray-800">
            Welcome back, {formatDisplayName(user?.name, 'User')}
          </h2>
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-lg border border-gray-200">
          <MapPin size={16} className="text-[var(--color-brand-indigo)] shrink-0" />
          {['Super Admin', 'MD', 'Senior HR', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'HR'].includes(user?.role) ? (
            <select 
              value={activeBranch} 
              onChange={(e) => setActiveBranch(e.target.value)}
              className="bg-transparent outline-none text-xs sm:text-sm font-medium text-gray-700 cursor-pointer w-24 sm:w-40"
            >
              {Array.from(new Set((branches || []).map(b => normalizeBranchName(b)).filter(Boolean))).map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-gray-700">{activeBranch}</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2 text-gray-400 hover:text-[var(--color-brand-indigo)] hover:bg-indigo-50 rounded-full transition-colors relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          
          {showDropdown && (
            <div className="fixed top-16 left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:-right-4 sm:mt-2 sm:w-[380px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col max-h-[80vh] sm:max-h-[85vh] overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-indigo-100 text-[var(--color-brand-indigo)] text-xs font-bold px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={markAllAsRead}
                    className="text-[11px] font-medium text-gray-500 hover:text-[var(--color-brand-indigo)] transition-colors flex items-center gap-1"
                  >
                    <Check size={12} /> Mark All Read
                  </button>
                </div>
              </div>
              
              <div className="divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center justify-center">
                    <Bell size={32} className="text-gray-300 mb-2" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 10).map(notification => (
                    <div 
                      key={notification._id || notification.id || notification.eventId} 
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 transition-colors cursor-pointer flex gap-3 ${!notification.isRead ? 'bg-indigo-50/40 hover:bg-indigo-50/80' : 'hover:bg-gray-50'}`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {!notification.isRead ? (
                          <div className="w-2 h-2 bg-[var(--color-brand-indigo)] rounded-full mt-1.5"></div>
                        ) : (
                          <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'} truncate`}>
                            {notification.title}
                          </h4>
                          <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                            {formatNotificationDate(notification.createdAt)}
                          </span>
                        </div>
                        <p className={`text-xs ${!notification.isRead ? 'text-gray-700' : 'text-gray-500'} line-clamp-2 leading-relaxed`}>
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-3 border-t border-gray-100 bg-gray-50/80 shrink-0">
                <button 
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/notifications');
                  }}
                  className="w-full py-2 text-sm font-medium text-[var(--color-brand-indigo)] hover:bg-indigo-50 rounded-md transition-colors flex items-center justify-center gap-1.5"
                >
                  View All Notifications <ExternalLink size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="h-8 w-px bg-gray-200"></div>
        
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-brand-indigo)] text-white flex items-center justify-center font-bold">
            {user?.name?.charAt(0) || <User size={18} />}
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-medium text-gray-700">{formatDisplayName(user?.name, 'Admin')}</span>
            <span className="text-xs text-gray-500">{user?.role || 'Role'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
