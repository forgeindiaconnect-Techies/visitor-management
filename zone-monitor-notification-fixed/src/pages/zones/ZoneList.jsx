import React, { useState } from 'react';
import { useZones } from '../../context/ZoneContext';
import { useVisitors } from '../../context/VisitorContext';
import { ShieldAlert, CheckCircle, Plus, Search, Users } from 'lucide-react';

const ZoneList = () => {
  const { zones, addZone } = useZones();
  const { allVisitors } = useVisitors();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedZoneForVisitors, setSelectedZoneForVisitors] = useState(null);
  const [formData, setFormData] = useState({
    name: '', type: 'Public Area', accessLevel: 'Public', description: '', status: 'Active'
  });

  const filteredZones = (Array.isArray(zones) ? zones : []).filter(z => 
    (z.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (z.branch || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Automatically set restricted boolean based on Access Level for backend logic
    const isRestricted = ['Staff Only', 'No Visitor Access', 'Special Approval', 'HR Only'].includes(formData.accessLevel) || formData.type === 'Restricted';
    
    addZone({ ...formData, restricted: isRestricted });
    setIsModalOpen(false);
    setFormData({ name: '', type: 'Public Area', accessLevel: 'Public', description: '', status: 'Active' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zone Management</h1>
          <p className="text-gray-500 mt-1">Manage physical zones and their security levels.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white px-5 py-2.5 rounded-lg flex items-center space-x-2 font-medium transition-colors shadow-md"
        >
          <Plus size={20} />
          <span>Add Zone</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search zones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Zone Name</th>
                <th className="px-6 py-4 font-medium">Zone Type</th>
                <th className="px-6 py-4 font-medium">Access Level</th>
                <th className="px-6 py-4 font-medium">Active Visitors</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredZones.map((zone) => (
                <tr key={zone.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{zone.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{zone.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{zone.accessLevel}</td>
                  <td className="px-6 py-4">
                    {(() => {
                      const safeAll = Array.isArray(allVisitors) ? allVisitors : [];
                      const visitorsInZone = safeAll.filter(v => v.status === 'Inside' && v.currentZone === zone.name);
                      return (
                        <button 
                          onClick={() => visitorsInZone.length > 0 && setSelectedZoneForVisitors(zone.name)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-max border transition-colors ${
                            visitorsInZone.length > 0 
                              ? 'bg-indigo-50 text-[var(--color-brand-indigo)] border-indigo-200 hover:bg-indigo-100 cursor-pointer' 
                              : 'bg-gray-50 text-gray-400 border-gray-200 cursor-default'
                          }`}
                        >
                          <Users size={12} /> {visitorsInZone.length}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{zone.description}</td>
                  <td className="px-6 py-4">
                    {zone.status === 'Active' ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1 w-max">
                        <CheckCircle size={12} /> Active
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center gap-1 w-max">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredZones.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No zones found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Add New Zone</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:border-[var(--color-brand-indigo)]" placeholder="e.g. Reception" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone Type</label>
                <input required type="text" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:border-[var(--color-brand-indigo)]" placeholder="e.g. Public Area" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
                <input required type="text" value={formData.accessLevel} onChange={(e) => setFormData({...formData, accessLevel: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:border-[var(--color-brand-indigo)]" placeholder="e.g. Public" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:border-[var(--color-brand-indigo)]" placeholder="e.g. Visitor Waiting Area" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none bg-white focus:border-[var(--color-brand-indigo)]">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--color-brand-indigo)] text-white rounded-lg">Save Zone</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedZoneForVisitors && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="text-[var(--color-brand-indigo)]" size={20} />
                Visitors in {selectedZoneForVisitors}
              </h3>
              <button 
                onClick={() => setSelectedZoneForVisitors(null)} 
                className="text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-100 rounded-full p-1 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              <div className="space-y-3">
                {(Array.isArray(allVisitors) ? allVisitors : []).filter(v => v.status === 'Inside' && v.currentZone === selectedZoneForVisitors).map(visitor => (
                  <div key={visitor.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-start gap-4 hover:border-[var(--color-brand-indigo)] hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-[var(--color-brand-indigo)] flex items-center justify-center font-bold shrink-0 text-lg">
                      {visitor.visitorName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{visitor.visitorName}</p>
                      <p className="text-xs text-gray-500 mt-0.5 font-medium">{visitor.companyName} • {visitor.mobileNumber}</p>
                      <div className="mt-3 text-xs text-gray-700 bg-slate-50 p-2.5 rounded-md border border-gray-100">
                        <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block mb-0.5">Host</span>
                        {visitor.hostName}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Entry Time</span>
                      <span className="text-xs font-mono text-gray-800 bg-gray-100 px-2 py-1 rounded">{visitor.entryTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoneList;
