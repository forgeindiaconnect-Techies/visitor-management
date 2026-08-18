const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

export const getNotifications = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/notifications`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.notifications)
      ? data.notifications
      : (Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Failed to load notifications from backend:', error);
    return [];
  }
};
