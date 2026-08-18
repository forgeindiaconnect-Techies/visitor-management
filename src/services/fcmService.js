const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

export const registerFCMToken = async () => {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.log('ServiceWorker or Notification API not supported on this browser.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission not granted:', permission);
      return null;
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    // Lazy import firebase messaging
    const { getMessaging, getToken } = await import('firebase/messaging');
    const { messaging } = await import('../firebase');

    if (!messaging) {
      console.warn('Firebase Messaging instance not available.');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      ...(vapidKey && { vapidKey }),
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.log('FCM token not returned from Firebase.');
      return null;
    }

    const authToken = localStorage.getItem('token');
    await fetch(`${API_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      body: JSON.stringify({ token })
    });

    console.log('FCM token registered successfully:', token);
    return token;
  } catch (error) {
    console.error('FCM registration error:', error);
    return null;
  }
};
