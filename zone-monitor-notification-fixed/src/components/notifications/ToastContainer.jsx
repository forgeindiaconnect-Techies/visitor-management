import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContainer = () => {
  const { notifications, removeNotification } = useNotification();

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-500" size={24} />;
      case 'error': return <XCircle className="text-red-500" size={24} />;
      case 'warning': return <AlertTriangle className="text-orange-500" size={24} />;
      case 'info':
      default: return <Info className="text-blue-500" size={24} />;
    }
  };

  const getBgClass = (type) => {
    switch (type) {
      case 'success': return 'border-green-500 bg-green-50';
      case 'error': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-orange-500 bg-orange-50';
      case 'info':
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {notifications.map(notif => (
        <div 
          key={notif.id}
          className={`pointer-events-auto overflow-hidden rounded-lg shadow-lg border-l-4 ${getBgClass(notif.type)} p-4 animate-in slide-in-from-right-8 duration-300 flex items-start`}
        >
          <div className="flex-shrink-0 mr-3">
            {getIcon(notif.type)}
          </div>
          <div className="flex-1 mr-2">
            <h4 className="text-sm font-bold text-gray-900">{notif.title}</h4>
            <p className="text-sm text-gray-700 mt-1">{notif.message}</p>
          </div>
          <button 
            onClick={() => removeNotification(notif.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
