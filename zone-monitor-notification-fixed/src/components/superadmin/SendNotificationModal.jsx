import React, { useState } from 'react';
import { X, Send, Bell, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const SendNotificationModal = ({ isOpen, onClose, company, onSend }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('System');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !company) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    setIsSending(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/super-admin/notify-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-User-Role': user?.role
        },
        body: JSON.stringify({
          companyId: company.code,
          title,
          message,
          type
        })
      });

      if (response.ok) {
        onSend && onSend();
        onClose();
        setTitle('');
        setMessage('');
        setType('System');
      } else {
        const errData = await response.json();
        alert('Failed to send notification: ' + errData.message);
      }
    } catch (error) {
      console.error(error);
      alert('Error sending notification.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Send size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Broadcast Notification</h2>
              <p className="text-sm text-gray-500">Send an instant alert to a tenant.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Target Company</label>
            <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium">
              {company.name} ({company.code})
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notification Type</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'System', icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                { id: 'Info', icon: Info, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
                { id: 'Warning', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    type === t.id 
                      ? `${t.border} ${t.bg} shadow-sm` 
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <t.icon size={20} className={type === t.id ? t.color : 'text-gray-400'} />
                  <span className={`text-sm font-medium ${type === t.id ? 'text-gray-900' : 'text-gray-500'}`}>
                    {t.id}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled Maintenance Notice"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Message</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter the notification body..."
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none resize-none"
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 font-medium bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-6 py-2.5 bg-[#1E1B6E] border border-transparent hover:bg-indigo-900 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <Send size={18} />
              {isSending ? 'Sending...' : 'Send Broadcast'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default SendNotificationModal;
