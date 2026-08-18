import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [persistentNotifications, setPersistentNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

  const addNotification = useCallback((title, message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, title, message, type }]);
    
    // Auto remove toast after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Fetch persistent notifications from MongoDB API
  const fetchPersistentNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.notifications || []);
        setPersistentNotifications(list);
        setUnreadCount(list.filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error('Error fetching persistent notifications:', err);
    }
  }, [API_URL]);

  const markAllRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      setPersistentNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchPersistentNotifications();

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });

    try {
      const userStored = localStorage.getItem('user');
      const parsedUser = userStored ? JSON.parse(userStored) : null;
      if (parsedUser && parsedUser.role) {
        socket.emit('join-notification-room', {
          userId: parsedUser._id || parsedUser.id,
          role: parsedUser.role
        });
      }
    } catch (e) {}

    const handleNewNotif = (newNotif) => {
      if (!newNotif) return;
      setPersistentNotifications((prev) => {
        const alreadyExists = prev.some((item) => item.eventId && item.eventId === newNotif.eventId);
        if (alreadyExists) return prev;
        return [newNotif, ...prev];
      });
      setUnreadCount(prev => prev + 1);
      addNotification(newNotif.title || 'New Notification', newNotif.message || '', newNotif.type || 'info');
    };

    socket.on('notification-created', handleNewNotif);
    socket.on('notification:new', handleNewNotif);

    return () => {
      socket.off('notification-created');
      socket.off('notification:new');
      socket.disconnect();
    };
  }, [fetchPersistentNotifications, addNotification, API_URL]);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      addNotification, 
      removeNotification,
      persistentNotifications,
      unreadCount,
      fetchPersistentNotifications,
      markAllRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
export const useNotifications = () => useContext(NotificationContext);
