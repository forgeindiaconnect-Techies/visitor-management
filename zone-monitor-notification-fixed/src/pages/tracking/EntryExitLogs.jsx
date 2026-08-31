import React, { useState } from 'react';
import { useVisitors } from '../../context/VisitorContext';
import { useZones } from '../../context/ZoneContext';
import { LogIn, LogOut, Search, Clock, MapPin } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const EntryExitLogs = () => {
  const { visitors, updateVisitorTracking } = useVisitors();
  const { zones } = useZones();
  const { addNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('');

  // We track Approved and Inside visitors
  const trackingVisitors = (Array.isArray(visitors) ? visitors : []).filter(v => 
    ['Approved', 'Inside'].includes(v.status) &&
    (v.visitorName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const postAlert = async (visitor, zoneName) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: visitor.id || visitor.visitId || 'UNKNOWN',
          visitorName: visitor.visitorName,
          branch: visitor.branch || 'Unknown',
          zoneName,
          type: 'Restricted Zone Violation',
          message: `Unauthorized attempt or restricted access flagged for ${visitor.visitorName} entering ${zoneName}.`,
          severity: 'High'
        })
      });
    } catch (e) {
      console.error('Failed to post alert:', e);
    }
  };

  const handleEntry = (visitor) => {
    if (!selectedZone) {
      alert("Please select a zone first!");
      return;
    }
    const zoneDetails = zones.find(z => z.name === selectedZone);
    if (zoneDetails?.restricted) {
      addNotification('RESTRICTED ZONE ALERT', `Unauthorized or restricted access warning for ${selectedZone}! Security has been notified.`, 'error');
      postAlert(visitor, selectedZone);
      const confirmRestricted = window.confirm(`WARNING: ${selectedZone} is a Restricted Zone! Violation logged. Do you still want to force allow entry?`);
      if (!confirmRestricted) return;
    }

    const timeString = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    updateVisitorTracking(visitor.id, {
      status: 'Inside',
      entryTime: timeString,
      currentZone: selectedZone
    });
  };

  const handleMoveZone = (visitor) => {
    if (!selectedZone) {
      alert("Please select a zone first!");
      return;
    }
    if (visitor.currentZone === selectedZone) {
      alert(`Visitor is already in ${selectedZone}`);
      return;
    }
    const zoneDetails = zones.find(z => z.name === selectedZone);
    if (zoneDetails?.restricted) {
      addNotification('RESTRICTED ZONE ALERT', `Unauthorized or restricted access warning for ${selectedZone}! Security has been notified.`, 'error');
      postAlert(visitor, selectedZone);
      const confirmRestricted = window.confirm(`WARNING: ${selectedZone} is a Restricted Zone! Violation logged. Do you still want to force allow entry?`);
      if (!confirmRestricted) return;
    }

    const timeString = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    updateVisitorTracking(visitor.id, {
      status: 'Inside', // remain inside
      currentZone: selectedZone,
      // Sending entryTime triggers a new zoneLog in backend
      entryTime: timeString 
    });
  };

  const handleExit = (visitorId) => {
    const timeString = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    updateVisitorTracking(visitorId, {
      status: 'Exited',
      exitTime: timeString,
      currentZone: null
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Entry & Exit Tracking</h1>
        <p className="text-gray-500 mt-1">Scan or manually mark visitor movements.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search approved visitors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none"
          />
        </div>
        
        <div className="flex-1">
          <select 
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white"
          >
            <option value="">-- Select Scanner/Zone Checkpoint --</option>
            {zones.map(z => (
              <option key={z.id} value={z.name}>{z.name} {z.restricted ? '(Restricted)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trackingVisitors.map(visitor => (
          <div key={visitor.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className={`h-2 ${visitor.status === 'Inside' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{visitor.visitorName}</h3>
                  <p className="text-xs text-gray-500">{visitor.companyName}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${visitor.status === 'Inside' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {visitor.status}
                </span>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin size={16} className="mr-2 text-gray-400" />
                  <span>{visitor.currentZone || 'Not Entered Yet'}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Clock size={16} className="mr-2 text-gray-400" />
                  <span>Entry: {visitor.entryTime || '--:--'}</span>
                </div>
              </div>

              {visitor.status === 'Approved' && (
                <button 
                  onClick={() => handleEntry(visitor)}
                  className="w-full flex items-center justify-center space-x-2 bg-green-50 text-green-700 hover:bg-green-100 py-2 rounded-lg font-medium transition-colors border border-green-200"
                >
                  <LogIn size={18} />
                  <span>Mark Entry</span>
                </button>
              )}
              
              {visitor.status === 'Inside' && (
                <div className="flex flex-col gap-2">
                  {selectedZone && selectedZone !== visitor.currentZone && (
                    <button 
                      onClick={() => handleMoveZone(visitor)}
                      className="w-full flex items-center justify-center space-x-2 bg-blue-50 text-blue-700 hover:bg-blue-100 py-2 rounded-lg font-medium transition-colors border border-blue-200"
                    >
                      <MapPin size={18} />
                      <span>Move to {selectedZone}</span>
                    </button>
                  )}
                  <button 
                    onClick={() => handleExit(visitor.id)}
                    className="w-full flex items-center justify-center space-x-2 bg-orange-50 text-orange-700 hover:bg-orange-100 py-2 rounded-lg font-medium transition-colors border border-orange-200"
                  >
                    <LogOut size={18} />
                    <span>Mark Exit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {trackingVisitors.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No approved or inside visitors found.
          </div>
        )}
      </div>
    </div>
  );
};

export default EntryExitLogs;
