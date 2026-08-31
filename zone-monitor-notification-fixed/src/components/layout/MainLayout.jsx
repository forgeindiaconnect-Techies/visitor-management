import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';
import SubscriptionModals from '../subscription/SubscriptionModals';

const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const { user } = useAuth();

  const getSubscriptionReminder = () => {
    if (!user?.subscriptionExpiresAt || user.role === 'SaaS Super Admin') return null;
    
    const isPendingUpgrade = localStorage.getItem('zmvms_pending_upgrade') === 'true';
    if (isPendingUpgrade) return 'Your upgrade request is currently pending SaaS Admin approval.';

    const expiry = new Date(user.subscriptionExpiresAt);
    const now = new Date();
    
    // Check calendar dates directly for Today / Tomorrow
    const isToday = expiry.getDate() === now.getDate() && 
                    expiry.getMonth() === now.getMonth() && 
                    expiry.getFullYear() === now.getFullYear();
                    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = expiry.getDate() === tomorrow.getDate() && 
                       expiry.getMonth() === tomorrow.getMonth() && 
                       expiry.getFullYear() === tomorrow.getFullYear();

    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffTime < 0) return null; // handled by isExpired redirect
    if (isToday) return 'Your subscription expires today.';
    if (isTomorrow) return 'Your subscription expires tomorrow.';
    if (diffDays === 3) return 'Your subscription expires in 3 days.';
    if (diffDays === 7) return 'Your subscription expires in 7 days.';
    if (user?.subscription === 'One Day Trial' && diffDays < 7) {
       return `Your Free Trial expires in ${diffDays} days.`;
    }
    return null;
  };

  const trialText = getSubscriptionReminder();

  return (
    <div className="flex min-h-screen bg-slate-50 print:block print:min-h-0 print:h-auto">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <div className={`flex-1 flex flex-col min-w-0 w-full transition-all duration-300 ease-in-out print:block print:h-auto print:ml-0 ${isSidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        
        {trialText && (
          <div className="bg-yellow-50 border-b border-yellow-200 mt-16 px-4 py-2 text-center text-yellow-800 text-sm font-medium z-10 flex items-center justify-center space-x-2">
            <span>⏱️</span>
            <span>
              {trialText}
              {!localStorage.getItem('zmvms_pending_upgrade') && (
                <span className="ml-1 font-bold">Upgrade to unlock full access.</span>
              )}
            </span>
          </div>
        )}

        {/* The Modals wrapper that handles the expiration locking layer */}
        <SubscriptionModals />
        
        <main className={`flex-1 p-4 md:p-6 ${!trialText ? 'mt-16' : ''} overflow-y-auto min-w-0 overflow-x-hidden print:block print:p-0 print:m-0 print:overflow-visible print:h-auto`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
