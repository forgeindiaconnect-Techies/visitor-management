import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useNotification } from '../../context/NotificationContext';
import { 
  Bell, 
  User, 
  MapPin, 
  Check, 
  Menu, 
  Trash2, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  LogIn, 
  LogOut, 
  UserCheck, 
  XCircle, 
  CalendarClock, 
  ShieldCheck,
  Sparkles,
  Building,
  CreditCard
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { formatNotificationDate } from '../../utils/dateFormatter';
import { normalizeNotifications } from '../../utils/notificationUtils';
import { formatDisplayName } from '../../utils/nameFormatter';
import { normalizeBranchName } from '../../utils/branchUtils';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.match(/^\d{1,3}\./);
const rawApi = (import.meta.env.VITE_API_URL || (isLocalhost ? `http://${window.location.hostname}:5000` : 'https://fic-visitor-1.onrender.com')).replace(/\/api\/?$/, '');
const API_URL = `${rawApi}/api/notifications`;

const getNotificationMeta = (title = '', type = '') => {
  const t = (title || type || '').toLowerCase();

  if (t.includes('subscription') || t.includes('plan') || t.includes('upgrade') || t.includes('expiry') || t.includes('expired')) {
    return {
      icon: <CreditCard size={15} className="text-purple-600" />,
      badge: 'Subscription',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/70',
      iconBg: 'bg-purple-50 border-purple-100',
      accentBorder: 'bg-purple-500'
    };
  }
  if (t.includes('company') || t.includes('tenant')) {
    return {
      icon: <Building size={15} className="text-indigo-600" />,
      badge: 'Company',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
      iconBg: 'bg-indigo-50 border-indigo-100',
      accentBorder: 'bg-indigo-500'
    };
  }

  if (t.includes('checked in') || t.includes('checkin') || t.includes('arrived')) {
    return {
      icon: <LogIn size={15} className="text-blue-600" />,
      badge: 'Checked In',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/70',
      iconBg: 'bg-blue-50 border-blue-100',
      accentBorder: 'bg-blue-500'
    };
  }
  if (t.includes('checked out') || t.includes('checkout') || t.includes('departed')) {
    return {
      icon: <LogOut size={15} className="text-slate-600" />,
      badge: 'Checked Out',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/70',
      iconBg: 'bg-slate-50 border-slate-200',
      accentBorder: 'bg-slate-500'
    };
  }
  if (t.includes('approved')) {
    return {
      icon: <CheckCircle2 size={15} className="text-emerald-600" />,
      badge: 'Approved',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
      iconBg: 'bg-emerald-50 border-emerald-100',
      accentBorder: 'bg-emerald-500'
    };
  }
  if (t.includes('rejected') || t.includes('denied')) {
    return {
      icon: <XCircle size={15} className="text-rose-600" />,
      badge: 'Rejected',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
      iconBg: 'bg-rose-50 border-rose-100',
      accentBorder: 'bg-rose-500'
    };
  }
  if (t.includes('rescheduled') || t.includes('appointment')) {
    return {
      icon: <CalendarClock size={15} className="text-indigo-600" />,
      badge: 'Rescheduled',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
      iconBg: 'bg-indigo-50 border-indigo-100',
      accentBorder: 'bg-indigo-500'
    };
  }
  if (t.includes('returning')) {
    return {
      icon: <ShieldCheck size={15} className="text-teal-600" />,
      badge: 'Returning',
      badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/70',
      iconBg: 'bg-teal-50 border-teal-100',
      accentBorder: 'bg-teal-500'
    };
  }
  if (t.includes('pre-booking') || t.includes('visitor')) {
    return {
      icon: <UserCheck size={15} className="text-amber-600" />,
      badge: 'Pre-Booking',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70',
      iconBg: 'bg-amber-50 border-amber-100',
      accentBorder: 'bg-amber-500'
    };
  }
  return {
    icon: <Bell size={15} className="text-indigo-600" />,
    badge: 'Notification',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
    iconBg: 'bg-indigo-50 border-indigo-100',
    accentBorder: 'bg-indigo-500'
  };
};

const Header = ({ toggleSidebar, isSidebarOpen }) => {
  const { user } = useAuth();
  const { branches, activeBranch, setActiveBranch } = useBranch();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const getHeaders = () => ({
    'X-Company-Id': user?.companyId || '',
    'X-User-Id': user?._id || user?.id || 'bootstrap',
    'X-User-Role': user?.role || 'User',
    'X-Branch-Id': user?.branch || 'All Branches',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const fetchNotifications = async () => {
    try {
      const res = await fetch(API_URL, { 
        cache: 'no-store',
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();

        const rawList = Array.isArray(data)
          ? data
          : Array.isArray(data.notifications)
            ? data.notifications
            : [];

        const normalizedList = normalizeNotifications(rawList);

        const seen = new Set();

        const uniqueList = normalizedList.filter((item) => {
          const key =
            item.eventId ||
            `${item.type || ''}_${item.preBookingId || ''}_${item.message || ''}`;

          if (seen.has(key)) return false;
          seen.add(key);

          // Role-specific filtering:
          if (user?.role === 'SaaS Super Admin') {
            const isVisitor =
              ['PreBooking', 'Visitors', 'Visitor'].includes(item.module) ||
              ['Visitor', 'PREBOOKING_REGISTERED', 'PREBOOKING_APPROVED', 'PREBOOKING_REJECTED', 'VISITOR_REGISTERED', 'VISITOR_CHECKED_IN', 'VISITOR_CHECKED_OUT', 'PREBOOKING_CHECKIN', 'PREBOOKING_CHECKOUT', 'PREBOOKING_RESCHEDULED'].includes(item.type) ||
              Boolean(item.preBookingId || item.visitorId) ||
              /pre-booking|visitor|checked in|checked out|waiting for approval/i.test(item.title || '') ||
              /waiting for approval|checked in|checked out/i.test(item.message || '');
            return !isVisitor;
          } else {
            return item.companyId && item.companyId.toUpperCase() === (user?.companyId || '').toUpperCase();
          }
        });

        setNotifications(uniqueList);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    const socket = io(rawApi);
    
    socket.on('new_notification', (notification) => {
      if (!notification) return;

      // Filter by role:
      if (user?.role === 'SaaS Super Admin') {
        // SaaS Super Admin NEVER receives visitor/pre-booking notifications
        if (
          ['PreBooking', 'Visitors', 'Visitor'].includes(notification.module) ||
          ['Visitor', 'PREBOOKING_REGISTERED', 'PREBOOKING_APPROVED', 'PREBOOKING_REJECTED', 'VISITOR_REGISTERED', 'VISITOR_CHECKED_IN', 'VISITOR_CHECKED_OUT'].includes(notification.type)
        ) {
          return;
        }
      } else {
        // Company staff ONLY receives their own company's notifications
        if (!notification.companyId || notification.companyId === 'SYSTEM' || notification.companyId.toUpperCase() !== (user?.companyId || '').toUpperCase()) {
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
            <div className="fixed top-16 left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:-right-4 sm:mt-2 sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-gray-100/90 z-50 flex flex-col max-h-[80vh] sm:max-h-[85vh] overflow-hidden backdrop-blur-md">
              <div className="px-4 py-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm tracking-tight">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-indigo-50 text-[var(--color-brand-indigo)] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={markAllAsRead}
                    className="text-[11px] font-semibold text-gray-500 hover:text-[var(--color-brand-indigo)] transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-indigo-50/50"
                  >
                    <Check size={13} /> Mark All Read
                  </button>
                </div>
              </div>
              
              <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-sm text-gray-500 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-400 mb-3 border border-indigo-100">
                      <Bell size={22} />
                    </div>
                    <p className="font-semibold text-gray-700">No notifications yet</p>
                    <p className="text-xs text-gray-400 mt-0.5">We'll alert you when visitor events occur</p>
                  </div>
                ) : (
                  notifications.slice(0, 10).map(notification => {
                    const meta = getNotificationMeta(notification.title, notification.type);
                    const isUnread = !notification.isRead;

                    return (
                      <div 
                        key={notification._id || notification.id || notification.eventId} 
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-3.5 sm:p-4 transition-all duration-150 cursor-pointer flex gap-3.5 items-start relative hover:bg-slate-50/80 ${
                          isUnread ? 'bg-indigo-50/25' : 'bg-white'
                        }`}
                      >
                        {/* Unread Accent Indicator */}
                        {isUnread && (
                          <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${meta.accentBorder || 'bg-indigo-500'}`} />
                        )}

                        {/* Status Icon Badge */}
                        <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border shadow-xs transition-transform ${meta.iconBg}`}>
                          {meta.icon}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className={`text-xs sm:text-[13px] truncate ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                              {notification.title || 'Notification'}
                            </h4>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 uppercase tracking-wider ${meta.badgeClass}`}>
                              {meta.badge}
                            </span>
                          </div>

                          <p className={`text-xs leading-relaxed break-words line-clamp-2 ${isUnread ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                            {notification.message}
                          </p>

                          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400 font-medium">
                            <Clock size={11} className="text-gray-400 shrink-0" />
                            <span>{formatNotificationDate(notification.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="p-3 border-t border-gray-100 bg-gray-50/60 shrink-0">
                <button 
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/notifications');
                  }}
                  className="w-full py-2.5 text-xs font-semibold text-[var(--color-brand-indigo)] hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-indigo-100/60 shadow-2xs"
                >
                  View All Notifications <ExternalLink size={13} />
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
