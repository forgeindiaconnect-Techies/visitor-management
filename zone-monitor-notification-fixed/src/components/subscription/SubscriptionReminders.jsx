import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SubscriptionReminders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reminderState, setReminderState] = useState(null); // '6h', '1h', '15m', null
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'SaaS Super Admin' || user.isExpired || !user.subscriptionExpiresAt) {
      setReminderState(null);
      return;
    }

    const checkReminder = () => {
      const expiryDate = new Date(user.subscriptionExpiresAt).getTime();
      const now = new Date().getTime();
      const diffMs = expiryDate - now;

      if (diffMs <= 0) {
        setReminderState(null);
        return;
      }

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = diffMinutes / 60;

      // Ensure we don't spam them if they dismissed the exact same state
      const lastDismissedState = localStorage.getItem(`reminder_dismissed_state_${user.id}`);

      let currentState = null;

      if (diffMinutes <= 15) {
        currentState = '15m';
      } else if (diffHours <= 1) {
        currentState = '1h';
      } else if (diffHours <= 6) {
        currentState = '6h';
      }

      if (currentState && lastDismissedState !== currentState) {
        setReminderState(currentState);
      } else if (!currentState) {
        setReminderState(null);
      }
    };

    checkReminder();
    // Re-check every minute for precise 15m warnings
    const interval = setInterval(checkReminder, 60 * 1000);
    return () => clearInterval(interval);
  }, [user, dismissed]);

  if (!reminderState || dismissed) return null;

  const handleRenewNow = () => {
    setDismissed(true);
    localStorage.setItem(`reminder_dismissed_state_${user.id}`, reminderState);
    window.dispatchEvent(new Event('open-upgrade-modal'));
  };

  const handleLater = () => {
    setDismissed(true);
    localStorage.setItem(`reminder_dismissed_state_${user.id}`, reminderState);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-80">
        
        {reminderState === '6h' && (
          <div className="p-5 border-l-4 border-yellow-400">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
                <Bell size={20} />
              </div>
              <h3 className="font-bold text-gray-900">🔔 Reminder</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              ⚠ Your trial expires in 6 hours.
            </p>
            <div className="flex gap-2">
              <button onClick={handleRenewNow} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded-lg text-sm transition-colors">
                Upgrade Now
              </button>
              <button onClick={handleLater} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-lg text-sm transition-colors">
                Later
              </button>
            </div>
          </div>
        )}

        {reminderState === '1h' && (
          <div className="p-5 border-l-4 border-orange-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                <AlertTriangle size={20} />
              </div>
              <h3 className="font-bold text-gray-900">⚠ Action Required</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Only 1 hour remaining. Upgrade now to avoid interruption.
            </p>
            <div className="flex gap-2">
              <button onClick={handleRenewNow} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg text-sm transition-colors">
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {reminderState === '15m' && (
          <div className="p-5 border-l-4 border-red-600">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-red-100 p-2 rounded-full text-red-600">
                <AlertOctagon size={20} />
              </div>
              <h3 className="font-bold text-gray-900">🔔 Urgent</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4 font-semibold">
              Your trial will expire in 15 minutes.
            </p>
            <div className="flex gap-2">
              <button onClick={handleRenewNow} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm">
                Upgrade Now
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SubscriptionReminders;
