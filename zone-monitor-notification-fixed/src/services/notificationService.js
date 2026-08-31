import { normalizeNotifications } from '../utils/notificationUtils';

const API_URL = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://zone-monitor-u9db.onrender.com')).replace(/\/api\/?$/, '');

export const getNotifications = async () => {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
    const userStored = localStorage.getItem('zmvms_user') || sessionStorage.getItem('zmvms_user') || localStorage.getItem('user');
    const user = userStored ? JSON.parse(userStored) : null;

    const response = await fetch(`${API_URL}/api/notifications`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        'X-Company-Id': user?.companyId || '',
        'X-User-Id': user?._id || user?.id || '',
        'X-User-Role': user?.role || 'User',
        'X-Branch-Id': user?.branch || 'All Branches'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return normalizeNotifications(data);
  } catch (error) {
    console.error('GET /api/notifications failed:', error);
    return [];
  }
};
