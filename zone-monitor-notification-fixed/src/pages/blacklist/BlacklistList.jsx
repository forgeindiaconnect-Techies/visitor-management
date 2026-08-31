import React, { useState } from 'react';
import { useBlacklist } from '../../context/BlacklistContext';
import { Ban, Search, ShieldAlert, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const BlacklistList = () => {
  const { blacklisted, addToBlacklist } = useBlacklist();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    visitorName: '', mobileNumber: '', reason: ''
  });

  const filteredBlacklist = blacklisted.filter(b => 
    b.visitorName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.mobileNumber.includes(searchTerm)
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    addToBlacklist({ ...formData, blockedBy: user?.name || 'Admin' });
    setIsModalOpen(false);
    setFormData({ visitorName: '', mobileNumber: '', reason: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="text-red-600" />
            Blacklist Management
          </h1>
          <p className="text-gray-500 mt-1">Manage blocked visitors to prevent future entries.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg flex items-center space-x-2 font-medium transition-colors shadow-md"
        >
          <Ban size={18} />
          <span>Block Visitor</span>
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
              placeholder="Search by name or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Blocked Person</th>
                <th className="px-6 py-4 font-medium">Mobile Number</th>
                <th className="px-6 py-4 font-medium">Reason for Block</th>
                <th className="px-6 py-4 font-medium">Blocked On</th>
                <th className="px-6 py-4 font-medium">Blocked By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBlacklist.map((person) => (
                <tr key={person.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{person.visitorName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{person.mobileNumber}</td>
                  <td className="px-6 py-4 text-sm text-red-600">{person.reason}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{person.blockedDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{person.blockedBy}</td>
                </tr>
              ))}
              {filteredBlacklist.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    No blacklisted visitors found.
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
            <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                <Ban size={20} /> Add to Blacklist
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-red-400 hover:text-red-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input required type="text" value={formData.visitorName} onChange={(e) => setFormData({...formData, visitorName: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" placeholder="e.g., John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input required type="tel" value={formData.mobileNumber} onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" placeholder="e.g., 9999999999" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Block</label>
                <textarea required value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none resize-none focus:border-red-500 focus:ring-1 focus:ring-red-500" rows="3" placeholder="Explain why this person is blocked..."></textarea>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">Block Visitor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlacklistList;
