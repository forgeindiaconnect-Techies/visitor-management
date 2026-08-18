import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getNotifications } from '../services/notificationService';
import { normalizeNotifications } from '../utils/notificationUtils';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotificationsState] = useState([]);
  const [persistentNotifications, setPersistentNotificationsState] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

  const setNotifications = useCallback((value) => {
    setNotificationsState((previous) => {
      const nextValue = typeof value === 'function'
        ? value(Array.isArray(previous) ? previous : [])
        : value;
      return normalizeNotifications(nextValue);
    });
  }, []);

  const setPersistentNotifications = useCallback((value) => {
    setPersistentNotificationsState((previous) => {
      const nextValue = typeof value === 'function'
        ? value(Array.isArray(previous) ? previous : [])
        : value;
      return normalizeNotifications(nextValue);
    });
  }, []);

  const addNotification = useCallback((title, message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, title, message, type }]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, [setNotifications]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, [setNotifications]);

  const fetchPersistentNotifications = useCallback(async () => {
    try {
      const response = await getNotifications();
      const list = normalizeNotifications(response);
      setPersistentNotifications(list);
      setUnreadCount(list.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Error fetching persistent notifications:', err);
      setPersistentNotifications([]);
    }
  }, [setPersistentNotifications]);

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
  }, [API_URL, setPersistentNotifications]);

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
        const safePrev = Array.isArray(prev) ? prev : [];
        const exists = safePrev.some(
          (item) => newNotif?.eventId && item?.eventId === newNotif.eventId
        );
        if (exists) return safePrev;
        return [newNotif, ...safePrev];
      });

      setUnreadCount((previous) => (Number.isFinite(previous) ? previous + 1 : 1));

      addNotification(
        newNotif.title || 'New Notification',
        newNotif.message || '',
        newNotif.type || 'info'
      );
    };

    socket.on('notification-created', handleNewNotif);
    socket.on('notification:new', handleNewNotif);

    return () => {
      socket.off('notification-created', handleNewNotif);
      socket.off('notification:new', handleNewNotif);
      socket.disconnect();
    };
  }, [fetchPersistentNotifications, addNotification, API_URL, setPersistentNotifications]);

  return (
    <NotificationContext.Provider
      value={{ 
        notifications, 
        setNotifications,
        addNotification, 
        removeNotification,
        persistentNotifications,
        setPersistentNotifications,
        unreadCount,
        fetchPersistentNotifications,
        markAllRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
export const useNotifications = () => useContext(NotificationContext);
