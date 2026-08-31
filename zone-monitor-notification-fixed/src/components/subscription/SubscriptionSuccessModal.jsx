import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle } from 'lucide-react';
import { io } from 'socket.io-client';

const SubscriptionSuccessModal = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [data, setData] = useState({ plan: '', expiry: '' });

  useEffect(() => {
    if (!user) return;

    const rawApiUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
    const socketUrl = rawApiUrl.replace(/\/api\/?$/, '');
    const socket = io(socketUrl);

    socket.emit('join-notification-room', {
      userId: user?.id || user?._id,
      role: user?.role,
      companyId: user?.companyId
    });
    
    socket.on('new_notification', (notification) => {
      // Check if it's for this company and is a subscription success notification
      if (
        notification.companyId === user.companyId &&
        notification.type === 'Subscription' && 
        notification.title.includes('🎉')
      ) {
        // Parse the message: "Your subscription has been upgraded to Standard. It expires on 8/16/2026."
        // Or "Your subscription has been successfully renewed to the Standard plan."
        const match = notification.message.match(/upgraded to (.*?)\.|renewed to the (.*?) plan/);
        const plan = match ? (match[1] || match[2]) : user.subscription;
        
        const expiryMatch = notification.message.match(/expires on (.*?)\./);
        const expiry = expiryMatch ? expiryMatch[1] : (user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString() : 'N/A');

        setData({ plan, expiry });
        setShow(true);
      }
    });

    return () => socket.disconnect();
  }, [user]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden transform animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🎉 Subscription Activated</h2>
        <p className="text-gray-600 mb-6 font-medium">
          Your <span className="font-bold text-[#1E1B6E]">{data.plan}</span> Plan has been activated successfully.
        </p>
        
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Expires on</span>
            <span className="font-bold text-gray-900 text-lg">
              {data.expiry}
            </span>
          </div>
        </div>
        
        <button
          onClick={() => {
            setShow(false);
            window.location.reload(); // Reload to update auth context and remove lock screen if present
          }}
          className="w-full bg-[#1E1B6E] text-white rounded-xl py-3.5 font-bold hover:bg-indigo-900 transition-colors shadow-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default SubscriptionSuccessModal;
