import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { io } from 'socket.io-client';
import { 
  Search, 
  Filter, 
  Trash2, 
  CheckCircle, 
  BellOff, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  LogIn,
  LogOut,
  UserCheck,
  CalendarClock,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { formatNotificationDate } from '../../utils/dateFormatter';
import { normalizeNotifications } from '../../utils/notificationUtils';

const rawApi = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')).replace(/\/api\/?$/, '');
const API_URL = `${rawApi}/api/notifications`;

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBranch } = useBranch();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterDate, setFilterDate] = useState('All');
  
  const modules = ['All', 'Company', 'Visitors', 'Users', 'Branch', 'Subscription', 'System', 'Admin'];
  const types = ['All', 'success', 'info', 'warning', 'error'];
  const dates = ['All', 'Today', 'Yesterday', 'Last Week', 'Last Month'];

  const getHeaders = () => ({
    'X-Company-Id': user?.companyId || 'FIC001',
    'X-User-Id': user?._id || user?.id || 'bootstrap',
    'X-User-Role': user?.role || 'User',
    'X-Branch-Id': user?.branch || 'All Branches',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      let url = new URL(API_URL);
      if (user?.role === 'Super Admin' && activeBranch !== 'All Branches') {
        url.searchParams.append('branch', activeBranch);
      }
      
      const res = await fetch(url.toString(), {
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
          return true;
        });

        setNotifications(uniqueList);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.match(/^\d{1,3}\./);
    const socketUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : (isLocalhost ? `http://${window.location.hostname}:5000` : 'https://fic-visitor-1.onrender.com');
    const socket = io(socketUrl);
    
    socket.on('new_notification', (notification) => {
      let queryBranch = user?.branch;
      if (['Super Admin', 'MD', 'Senior HR', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'HR'].includes(user?.role)) {
        queryBranch = activeBranch === 'All Branches' ? null : activeBranch;
      }
      if (queryBranch && queryBranch !== 'All Branches' && notification.branchId && notification.branchId !== queryBranch && notification.branchId !== 'All Branches') return;
      
      if (user?.role === 'SaaS Super Admin') {
        if (!['Company', 'Subscription', 'System', 'Branch', 'Admin', 'Announcement'].includes(notification.module || notification.type)) return;
      } else if (user?.role !== 'SaaS Super Admin' && notification.companyId && notification.companyId !== 'SYSTEM' && notification.companyId.toUpperCase() !== (user?.companyId || 'FIC001').toUpperCase()) {
        return;
      }

      // Filter out Security Attendance notifications for non-super users
      if (notification.type === 'Attendance' && user?.role !== 'Super Admin' && user?.role !== 'SaaS Super Admin' && user?.role !== 'MD') {
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
    });

    return () => socket.disconnect();
  }, [user, activeBranch]);

  const markAsRead = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}/read`, { method: 'PATCH', headers: getHeaders() });
      if (res.ok) setNotifications(prev => (Array.isArray(prev) ? prev : []).map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) { console.error('Failed to mark read', err); }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch(`${API_URL}/read-all`, { method: 'PATCH', headers: getHeaders() });
      if (res.ok) setNotifications(prev => (Array.isArray(prev) ? prev : []).map(n => ({ ...n, isRead: true })));
    } catch (err) { console.error('Failed to mark all read', err); }
  };

  const deleteNotification = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) setNotifications(prev => (Array.isArray(prev) ? prev : []).filter(n => n._id !== id));
    } catch (err) { console.error('Failed to delete notification', err); }
  };

  const clearAllNotifications = async () => {
    if (!window.confirm("Are you sure you want to clear all notifications?")) return;
    try {
      const res = await fetch(API_URL, { method: 'DELETE', headers: getHeaders() });
      if (res.ok) setNotifications([]);
    } catch (err) { console.error('Failed to clear notifications', err); }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    const preBookingId = notification.preBookingId?._id || notification.preBookingId;
    if (preBookingId) {
      navigate(`/pre-bookings?preBookingId=${preBookingId}`);
    }
  };

  const getTypeMeta = (title = '', type = '') => {
    const t = (title || type || '').toLowerCase();

    if (t.includes('checked in') || t.includes('checkin') || t.includes('arrived')) {
      return {
        icon: <LogIn size={18} className="text-blue-600" />,
        badge: 'Checked In',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/70',
        iconBg: 'bg-blue-50 border-blue-100'
      };
    }
    if (t.includes('checked out') || t.includes('checkout') || t.includes('departed')) {
      return {
        icon: <LogOut size={18} className="text-slate-600" />,
        badge: 'Checked Out',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/70',
        iconBg: 'bg-slate-50 border-slate-200'
      };
    }
    if (t.includes('approved')) {
      return {
        icon: <CheckCircle2 size={18} className="text-emerald-600" />,
        badge: 'Approved',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        iconBg: 'bg-emerald-50 border-emerald-100'
      };
    }
    if (t.includes('rejected') || t.includes('denied')) {
      return {
        icon: <XCircle size={18} className="text-rose-600" />,
        badge: 'Rejected',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/70',
        iconBg: 'bg-rose-50 border-rose-100'
      };
    }
    if (t.includes('rescheduled') || t.includes('appointment')) {
      return {
        icon: <CalendarClock size={18} className="text-indigo-600" />,
        badge: 'Rescheduled',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
        iconBg: 'bg-indigo-50 border-indigo-100'
      };
    }
    if (t.includes('returning')) {
      return {
        icon: <ShieldCheck size={18} className="text-teal-600" />,
        badge: 'Returning',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/70',
        iconBg: 'bg-teal-50 border-teal-100'
      };
    }
    return {
      icon: <UserCheck size={18} className="text-amber-600" />,
      badge: 'Pre-Booking',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/70',
      iconBg: 'bg-amber-50 border-amber-100'
    };
  };

  const getFilteredAndGrouped = () => {
    let filtered = (Array.isArray(notifications) ? notifications : []).filter(n => {
      const matchesSearch = n.title?.toLowerCase().includes(searchTerm.toLowerCase()) || n.message?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesModule = filterModule === 'All' || (n.module || n.type) === filterModule;
      const matchesType = filterType === 'All' || n.type === filterType;
      return matchesSearch && matchesModule && matchesType;
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today); lastMonth.setMonth(lastMonth.getMonth() - 1);

    const grouped = {
      "Today's": [],
      "Yesterday": [],
      "Last Week": [],
      "Last Month": [],
      "Older": []
    };

    filtered.forEach(n => {
      const d = new Date(n.createdAt);
      if (d >= today) grouped["Today's"].push(n);
      else if (d >= yesterday) grouped["Yesterday"].push(n);
      else if (d >= lastWeek) grouped["Last Week"].push(n);
      else if (d >= lastMonth) grouped["Last Month"].push(n);
      else grouped["Older"].push(n);
    });

    if (filterDate === 'Today') return { "Today's": grouped["Today's"] };
    if (filterDate === 'Yesterday') return { "Yesterday": grouped["Yesterday"] };
    if (filterDate === 'Last Week') return { "Last Week": grouped["Last Week"] };
    if (filterDate === 'Last Month') return { "Last Month": grouped["Last Month"] };
    
    return grouped;
  };

  const groupedNotifications = getFilteredAndGrouped();

  return (
    <div className="p-6 max-w-6xl mx-auto mt-16 md:mt-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your alerts and activity logs</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={markAllAsRead} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-[var(--color-brand-indigo)] rounded-lg hover:bg-indigo-100 font-medium">
            <CheckCircle size={16} /> Mark All as Read
          </button>
          <button onClick={clearAllNotifications} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium">
            <Trash2 size={16} /> Clear All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6 p-4 flex flex-wrap gap-4 items-center">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
        </div>
        <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none">
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterModule} onChange={e => setFilterModule(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none">
          <option value="All">All Modules</option>
          {modules.filter(m => m !== 'All').map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none">
          <option value="All">All Types</option>
          {types.filter(t => t !== 'All').map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full"></div></div>
        ) : Object.values(groupedNotifications).every(arr => arr.length === 0) ? (
          <div className="p-16 flex flex-col items-center text-gray-500"><BellOff size={48} className="text-gray-300 mb-4" /><h3>No Notifications Found</h3></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(groupedNotifications).map(([groupName, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={groupName}>
                  <div className="bg-gray-50 px-5 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">{groupName}</div>
                  <div className="divide-y divide-gray-50">
                    {items.map(notification => {
                      const meta = getTypeMeta(notification.title, notification.type);
                      const isUnread = !notification.isRead;

                      return (
                        <div 
                          key={notification._id || notification.id || notification.eventId} 
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-5 flex gap-4 transition-colors relative group cursor-pointer ${isUnread ? 'bg-indigo-50/20' : 'hover:bg-gray-50'}`}
                        >
                          <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border shadow-xs ${meta.iconBg}`}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h4 className={`text-sm font-semibold ${isUnread ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>{notification.title}</h4>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 uppercase tracking-wider ${meta.badgeClass}`}>
                                {meta.badge}
                              </span>
                            </div>
                            <p className={`text-sm leading-relaxed ${isUnread ? 'text-gray-800' : 'text-gray-500'}`}>{notification.message}</p>
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                              <Clock size={12} className="text-gray-400 shrink-0" />
                              <span>{formatNotificationDate(notification.createdAt)}</span>
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 shrink-0">
                            {isUnread && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification._id);
                                }} 
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification._id);
                              }} 
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
