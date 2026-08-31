import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Clock } from 'lucide-react';

const SubscriptionCountdown = () => {
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'SaaS Super Admin' || !user.subscriptionExpiresAt) return;

    const expiryTime = new Date(user.subscriptionExpiresAt).getTime();

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = expiryTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft('Expired');
        // Let the SubscriptionModals handle the freeze logic based on AuthContext state
        if (!user.isExpired) {
          // If the timer reaches zero while the user is active, force a reload to trigger the backend freeze
          setTimeout(() => window.location.reload(), 1000);
        }
        return;
      }

      // Calculate days, hours, minutes
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      let timeString = '';
      if (days > 0) {
        timeString = `${days} Day${days > 1 ? 's' : ''} ${hours} Hour${hours !== 1 ? 's' : ''}`;
      } else if (hours > 0) {
        timeString = `${hours} Hour${hours !== 1 ? 's' : ''} ${minutes} Minute${minutes !== 1 ? 's' : ''}`;
      } else {
        timeString = `${minutes} Minute${minutes !== 1 ? 's' : ''}`;
      }

      setTimeLeft(timeString);
    };

    calculateTimeLeft(); // Initial calculation
    const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [user]);

  if (!user || user.role === 'SaaS Super Admin') return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 text-center">
        <div className="p-4 bg-slate-50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current Plan</p>
          <p className="font-bold text-[#1E1B6E] text-lg">{user.subscription}</p>
        </div>
        <div className="p-4 flex flex-col items-center justify-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Remaining Time</p>
          <div className="flex items-center gap-2">
            <Clock size={16} className={isExpired ? 'text-red-500' : 'text-indigo-500'} />
            <p className={`font-bold text-lg ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
              {timeLeft}
            </p>
          </div>
        </div>
        <div className="p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Expiry Time</p>
          <p className="font-bold text-gray-900">
            {user.subscriptionExpiresAt 
              ? new Date(user.subscriptionExpiresAt).toLocaleString('en-US', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                }).replace(',', '\n')
              : 'N/A'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCountdown;
