import React, { useState, useEffect } from 'react';
import { Shield, Search, Activity, User, Monitor, Clock, Download, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { exportToCSV } from '../../utils/exportUtils';

const AuditLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const url = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/audit-logs`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Company-Id': user?.companyId
        }
      });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = (Array.isArray(logs) ? logs : []).filter(log => {
    const matchesSearch = 
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModule = filterModule === 'All' || log.module === filterModule;
    const matchesStatus = filterStatus === 'All' || log.status === filterStatus;
    
    let matchesDate = true;
    if (filterDate) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      matchesDate = logDate === filterDate;
    }

    return matchesSearch && matchesModule && matchesStatus && matchesDate;
  });

  const getModuleColor = (module) => {
    switch(module) {
      case 'Authentication': return 'bg-purple-100 text-purple-700';
      case 'Visitor': return 'bg-green-100 text-green-700';
      case 'User Management': return 'bg-blue-100 text-blue-700';
      case 'Tenant Management': return 'bg-indigo-100 text-indigo-700';
      case 'Subscription': return 'bg-orange-100 text-orange-700';
      case 'Settings': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleExport = () => {
    const exportData = filteredLogs.map(log => ({
      'Date & Time': new Date(log.createdAt).toLocaleString('en-US'),
      'Company': log.companyName,
      'User Name': log.userName,
      'Role': log.role,
      'Action': log.action,
      'Module': log.module,
      'Description': log.description || '',
      'Status': log.status || 'Success',
      'IP Address': log.ipAddress || 'Unknown',
      'Device Info': log.deviceInfo || 'Unknown'
    }));
    exportToCSV(exportData, 'Audit_Logs.csv');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-[#1E1B6E]" size={28} />
            Security Audit Logs
          </h1>
          <p className="text-gray-500 mt-1">Monitor all administrative and security actions in your company workspace</p>
        </div>
        <button 
          onClick={handleExport}
          className="px-4 py-2 bg-[#1E1B6E] hover:bg-opacity-90 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm text-sm"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-[#1E1B6E] focus:border-[#1E1B6E] sm:text-sm transition-colors bg-slate-50"
            placeholder="Search action or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <input 
          type="date"
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-[#1E1B6E] focus:border-[#1E1B6E] bg-slate-50 font-medium"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-[#1E1B6E] focus:border-[#1E1B6E] bg-slate-50 font-medium"
        >
          <option value="All">All Modules</option>
          <option value="Authentication">Authentication</option>
          <option value="Visitor">Visitor</option>
          <option value="User Management">User Management</option>
          <option value="Tenant Management">Tenant Management</option>
          <option value="Subscription">Subscription</option>
          <option value="Settings">Settings</option>
        </select>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-[#1E1B6E] focus:border-[#1E1B6E] bg-slate-50 font-medium"
        >
          <option value="All">All Statuses</option>
          <option value="Success">Success</option>
          <option value="Failure">Failure</option>
          <option value="Pending">Pending</option>
        </select>

        <button 
          onClick={fetchLogs}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-lg font-medium transition-colors border border-slate-200 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 border-b border-red-100">
            Error loading logs: {error}
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-semibold">Date & Time</th>
                <th className="px-6 py-4 font-semibold">User & Role</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Module</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E1B6E] mx-auto"></div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 font-medium bg-slate-50/50">
                    No audit logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800">
                          {new Date(log.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[11px]">
                          {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <div>
                          <div>{log.userName}</div>
                          <div className="text-[10px] text-gray-500 font-normal uppercase tracking-wider">{log.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-medium">
                      <div className="flex items-center gap-2">
                        <Activity size={14} className="text-[#1E1B6E]" />
                        <span>{log.action}</span>
                      </div>
                      {log.description && (
                        <p className="text-[11px] text-gray-500 mt-1 font-normal max-w-xs truncate" title={log.description}>{log.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getModuleColor(log.module)}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        log.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {log.status || 'Success'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
