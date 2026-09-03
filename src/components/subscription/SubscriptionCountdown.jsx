import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Clock, Sparkles } from 'lucide-react';

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
        if (!user.isExpired) {
          setTimeout(() => window.location.reload(), 1000);
        }
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      let timeString = '';
      if (days > 0) {
        timeString = `${days} Day${days > 1 ? 's' : ''} ${hours} Hr${hours !== 1 ? 's' : ''}`;
      } else if (hours > 0) {
        timeString = `${hours} Hour${hours !== 1 ? 's' : ''} ${minutes} Min${minutes !== 1 ? 's' : ''}`;
      } else {
        timeString = `${minutes} Min${minutes !== 1 ? 's' : ''}`;
      }

      setTimeLeft(timeString);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);

    return () => clearInterval(timer);
  }, [user]);

  if (!user || user.role === 'SaaS Super Admin') return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100 items-center text-center">
        {/* Column 1: Current Plan & Status */}
        <div className="p-4 bg-slate-50/70 flex flex-col items-center justify-center">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Current Plan</p>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#1E1B6E] text-base">{user.subscription || 'N/A'}</span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isExpired || user.isExpired ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
              {isExpired || user.isExpired ? 'Expired' : 'Active'}
            </span>
          </div>
        </div>

        {/* Column 2: Remaining Time */}
        <div className="p-4 flex flex-col items-center justify-center">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Remaining Time</p>
          <div className="flex items-center gap-1.5">
            <Clock size={16} className={isExpired ? 'text-red-500' : 'text-indigo-600'} />
            <p className={`font-extrabold text-base ${isExpired ? 'text-red-600' : 'text-slate-900'}`}>
              {timeLeft}
            </p>
          </div>
        </div>

        {/* Column 3: Expiry Date */}
        <div className="p-4 flex flex-col items-center justify-center">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Expiry Time</p>
          <p className="font-bold text-slate-800 text-sm">
            {user.subscriptionExpiresAt 
              ? new Date(user.subscriptionExpiresAt).toLocaleString('en-US', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })
              : 'N/A'
            }
          </p>
        </div>

        {/* Column 4: Upgrade Action */}
        <div className="p-4 flex items-center justify-center bg-slate-50/40">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-upgrade-modal'))}
            className="w-full max-w-[160px] py-2.5 px-4 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Sparkles size={14} className="text-amber-300" />
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCountdown;
