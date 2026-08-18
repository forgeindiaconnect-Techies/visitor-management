import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building, Users, UserCheck, CreditCard, Calendar, Activity, Check, X, ShieldAlert, Sparkles, Plus, AlertCircle, RefreshCw, Eye, EyeOff, Download } from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import SendNotificationModal from '../../components/superadmin/SendNotificationModal';

const DashboardCard = ({ title, value, icon: Icon, colorClass, subtitle, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-xl shadow-md border border-gray-200 p-6 flex items-center space-x-4 transition-transform hover:-translate-y-1 hover:shadow-lg duration-300 ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${colorClass}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const SaaSPlatformDashboard = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [payments, setPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogFilters, setAuditLogFilters] = useState({
    search: '', date: '', company: '', module: 'All', status: 'All'
  });
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Form states for creating a new company
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompany, setNewCompany] = useState({
    companyName: '',
    adminName: '',
    email: '',
    mobileNumber: '',
    password: '',
    plan: 'One Day Trial'
  });
  const [showPassword, setShowPassword] = useState(false);

  // Mock payment simulator state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSimulation, setPaymentSimulation] = useState({
    companyCode: '',
    plan: 'Standard'
  });

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name, code }

  // Edit company state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCompany, setEditCompany] = useState(null);

  const [activeTab, setActiveTab] = useState('Companies');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedUpgradeCompany, setSelectedUpgradeCompany] = useState(null);
  const [upgradeData, setUpgradeData] = useState({ plan: 'Standard', durationDays: '30' });

  // Notification state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationCompany, setNotificationCompany] = useState(null);

  const [isRegistering, setIsRegistering] = useState(false);

  const handleCardClick = (tabName) => {
    setActiveTab(tabName);
    const panel = document.getElementById('main-panel');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const API_BASE = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'X-Company-Id': user?.companyId || 'SYSTEM',
      'X-User-Id': user?.id || 'bootstrap-saas',
      'X-User-Role': user?.role || 'SaaS Super Admin'
    };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch companies
      const compRes = await fetch(`${API_BASE}/api/super-admin/companies`, {
        headers: getHeaders()
      });
      if (!compRes.ok) throw new Error('Failed to fetch companies');
      const compData = await compRes.json();
      setCompanies(compData);

      // Fetch analytics
      const analyticsRes = await fetch(`${API_BASE}/api/super-admin/analytics`, {
        headers: getHeaders()
      });
      if (!analyticsRes.ok) throw new Error('Failed to fetch analytics');
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);

      // Fetch payments
      const paymentsRes = await fetch(`${API_BASE}/api/super-admin/payments`, {
        headers: getHeaders()
      });
      if (!paymentsRes.ok) throw new Error('Failed to fetch payments');
      const paymentsData = await paymentsRes.json();
      setPayments(paymentsData);

      // Fetch audit logs
      const auditRes = await fetch(`${API_BASE}/api/audit-logs`, {
        headers: getHeaders()
      });
      if (!auditRes.ok) throw new Error('Failed to fetch audit logs');
      const auditData = await auditRes.json();
      setAuditLogs(auditData);

      // Fetch upgrade requests
      const upgradeRes = await fetch(`${API_BASE}/api/super-admin/upgrade-requests`, {
        headers: getHeaders()
      });
      if (upgradeRes.ok) {
        const upgradeData = await upgradeRes.json();
        setUpgradeRequests(upgradeData);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleProcessUpgradeRequest = async (id, status) => {
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/upgrade-requests/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        showToast(`Request ${status} successfully`);
        fetchData();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to process request');
      }
    } catch (err) {
      alert('Network error while processing request');
    }
  };

  // Handle delete company (with cascade)
  const handleDeleteCompany = async () => {
    if (!deleteConfirm) return;
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/companies/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete company');

      showToast(data.message, 'success');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
      setDeleteConfirm(null);
    }
  };

  // Handle edit company
  const handleEditCompany = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/companies/${editCompany._id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ 
          name: editCompany.name,
          status: editCompany.status,
          subscription: editCompany.subscription
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update company');
      showToast(`Company details updated successfully`, 'success');
      setShowEditModal(false);
      setEditCompany(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Toggle company active/inactive status
  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      const response = await fetch(`${API_BASE}/api/super-admin/companies/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) throw new Error('Failed to update company status');
      showToast(`Company status updated to ${nextStatus}`, 'success');
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Update subscription tier
  const handlePlanChange = async (id, newPlan) => {
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/companies/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ subscription: newPlan })
      });
      if (!response.ok) throw new Error('Failed to update company subscription');
      showToast(`Subscription plan updated to ${newPlan}`, 'success');
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Process Subscription Upgrade
  const handleProcessUpgrade = async (e) => {
    e.preventDefault();
    if (!selectedUpgradeCompany) return;
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/companies/${selectedUpgradeCompany._id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ 
          subscription: upgradeData.plan,
          durationDays: upgradeData.durationDays
        })
      });
      if (!response.ok) throw new Error('Failed to upgrade subscription');
      showToast(`Subscription successfully upgraded to ${upgradeData.plan}`, 'success');
      setShowUpgradeModal(false);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Handle register new company
  const handleRegisterCompany = async (e) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/register-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Registration failed');

      showToast(`Registered successfully. Company Code: ${data.company.code}`, 'success');
      setShowCreateModal(false);
      setNewCompany({
        companyName: '',
        adminName: '',
        email: '',
        mobileNumber: '',
        password: '',
        plan: 'One Day Trial'
      });
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle mock payment simulation
  const handleMockPayment = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/auth/mock-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyCode: paymentSimulation.companyCode,
          plan: paymentSimulation.plan,
          paymentId: `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Payment simulation failed');

      showToast(`Mock payment successful! Subscription activated for ${paymentSimulation.companyCode}.`, 'success');
      setShowPaymentModal(false);
      setPaymentSimulation({ companyCode: '', plan: 'Standard' });
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredAuditLogs = (Array.isArray(auditLogs) ? auditLogs : []).filter(log => {
    const matchesSearch = 
      (log.action || '').toLowerCase().includes(auditLogFilters.search.toLowerCase()) ||
      (log.userName || '').toLowerCase().includes(auditLogFilters.search.toLowerCase());
    
    const matchesModule = auditLogFilters.module === 'All' || log.module === auditLogFilters.module;
    const matchesStatus = auditLogFilters.status === 'All' || log.status === auditLogFilters.status;
    const matchesCompany = auditLogFilters.company === '' || (log.companyName || '').toLowerCase().includes(auditLogFilters.company.toLowerCase());
    
    let matchesDate = true;
    if (auditLogFilters.date) {
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      matchesDate = logDate === auditLogFilters.date;
    }

    return matchesSearch && matchesModule && matchesStatus && matchesCompany && matchesDate;
  });

  const handleExportAuditLogs = () => {
    const exportData = filteredAuditLogs.map(log => ({
      'Date & Time': new Date(log.createdAt).toLocaleString('en-US'),
      'Company': log.companyName || 'Unknown',
      'User Name': log.userName,
      'Role': log.role,
      'Action': log.action,
      'Module': log.module,
      'Description': log.description || '',
      'Status': log.status || 'Success',
      'IP Address': log.ipAddress || 'Unknown'
    }));
    exportToCSV(exportData, 'SaaS_Audit_Logs.csv');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-1">
      {/* Toast Alert */}
      {notification && (
        <div className={`fixed top-5 right-5 z-[9999] p-4 rounded-xl shadow-lg border flex items-center space-x-2 animate-in slide-in-from-top duration-300 ${
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <AlertCircle size={20} className={notification.type === 'error' ? 'text-red-600' : 'text-green-600'} />
          <span className="font-medium text-sm">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={24} className="text-[#1E1B6E]" />
            SaaS Platform Administration Portal
          </h1>
          <p className="text-gray-500 mt-1">Monitor, manage, and configure multi-tenant subscription accounts</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl transition-colors border border-slate-200"
            title="Refresh statistics"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2.5 bg-[#1E1B6E] hover:bg-opacity-90 text-white rounded-xl font-semibold shadow-sm transition-colors text-sm"
          >
            Simulate Payment
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow-sm transition-colors flex items-center gap-1.5 text-sm"
          >
            <Plus size={16} />
            Add Tenant
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-2 text-red-800">
          <ShieldAlert size={20} className="text-red-600" />
          <span>Error loading data: {error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="Total Revenue" 
          value={analytics ? `₹${(analytics.totalRevenue || 0).toLocaleString('en-IN')}` : '-'} 
          icon={CreditCard} 
          colorClass="bg-indigo-50 text-[var(--color-brand-indigo)] border border-indigo-100" 
          onClick={() => handleCardClick('Payments')}
        />
        <DashboardCard 
          title="Today's Revenue" 
          value={analytics ? `₹${(analytics.todaysRevenue || 0).toLocaleString('en-IN')}` : '-'} 
          icon={Activity} 
          colorClass="bg-blue-50 text-blue-600 border border-blue-100" 
          onClick={() => handleCardClick('Payments')}
        />
        <DashboardCard 
          title="Active Companies" 
          value={analytics ? analytics.activeCompanies : '-'} 
          icon={Building} 
          colorClass="bg-green-50 text-green-600 border border-green-100" 
          onClick={() => handleCardClick('Subscriptions')}
        />
        <DashboardCard 
          title="Expired Companies" 
          value={analytics ? analytics.inactiveCompanies : '-'} 
          icon={ShieldAlert} 
          colorClass="bg-red-50 text-red-600 border border-red-100" 
          onClick={() => handleCardClick('Subscriptions')}
        />
      </div>

      {/* Main Panel */}
      <div id="main-panel" className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-slate-50 flex items-center px-4 space-x-1">
          <button 
            onClick={() => setActiveTab('Companies')}
            className={`px-6 py-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'Companies' ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-slate-100'}`}
          >
            Companies
          </button>
          <button 
            onClick={() => setActiveTab('Subscriptions')}
            className={`px-6 py-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'Subscriptions' ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-slate-100'}`}
          >
            Subscriptions
          </button>
          <button 
            onClick={() => setActiveTab('Payments')}
            className={`px-6 py-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'Payments' ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-slate-100'}`}
          >
            Payments
          </button>
          <button 
            onClick={() => setActiveTab('Audit Logs')}
            className={`px-6 py-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'Audit Logs' ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-slate-100'}`}
          >
            Audit Logs
          </button>
          <button 
            onClick={() => setActiveTab('Upgrade Requests')}
            className={`px-6 py-4 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'Upgrade Requests' ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-slate-100'}`}
          >
            Upgrade Requests
            {(Array.isArray(upgradeRequests) ? upgradeRequests : []).filter(req => req.status === 'Pending').length > 0 && (
              <span className="bg-red-500 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                {(Array.isArray(upgradeRequests) ? upgradeRequests : []).filter(req => req.status === 'Pending').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'Companies' && (
          <>
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Tenant Companies</h3>
                <p className="text-xs text-gray-500 mt-0.5">Manage details, active statuses, and expirations</p>
              </div>
              {analytics?.tiers && (
                <div className="flex space-x-4 text-xs font-semibold text-gray-600">
                  <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full border border-orange-100">1-Day Trial: {analytics.tiers.OneDayTrial}</span>
                  <span className="bg-slate-100 px-3 py-1 rounded-full border">Basic: {analytics.tiers.Basic}</span>
                  <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">Standard: {analytics.tiers.Standard}</span>
                  <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-100">Enterprise: {analytics.tiers.Enterprise}</span>
                </div>
              )}
              <button 
                onClick={() => exportToCSV(companies.map(c => ({ Name: c.name, Code: c.code, Subscription: c.subscription, Status: c.status, ExpiresAt: c.subscriptionExpiresAt })), 'companies_export.csv')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors ml-auto"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Company Name</th>
                    <th className="px-6 py-4 font-medium">Company Details</th>
                    <th className="px-6 py-4 font-medium text-center">Branches</th>
                    <th className="px-6 py-4 font-medium text-center">Security Users</th>
                    <th className="px-6 py-4 font-medium text-center">Visitors</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {companies.map((comp) => (
                    <tr key={comp._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">{comp.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono text-xs bg-slate-100 text-gray-700 px-2.5 py-1 rounded border border-slate-200 font-semibold w-max">
                            {comp.code}
                          </span>
                          <div className="text-[10px] text-gray-500 flex flex-col">
                            <span><strong className="text-gray-700">ID:</strong> {comp.adminEmail}</span>
                            <span><strong className="text-gray-700">PWD:</strong> {comp.adminPassword}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-700 text-xs">
                        {comp.branchCount || 0} / {comp.limits?.branches === -1 ? 'Unlimited' : comp.limits?.branches}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-700 text-xs">
                        {comp.securityCount || 0} / {comp.limits?.securityUsers === -1 ? 'Unlimited' : comp.limits?.securityUsers}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-700 text-xs">
                        {comp.visitorCount || 0} / {comp.limits?.visitors === -1 ? 'Unlimited' : comp.limits?.visitors}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          comp.status === 'Active' ? 'bg-green-100 text-green-700' : 
                          comp.status === 'Expired' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {comp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => { setEditCompany({ ...comp }); setShowEditModal(true); }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded hover:bg-blue-100 mr-2 border border-blue-200"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => { setNotificationCompany({ ...comp }); setShowNotificationModal(true); }}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded hover:bg-indigo-100 mr-2 border border-indigo-200"
                        >
                          Notify
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(comp._id, comp.status)}
                          className="px-3 py-1.5 bg-slate-100 text-gray-700 text-xs font-semibold rounded hover:bg-slate-200 mr-2 border border-slate-200"
                        >
                          {comp.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: comp._id, name: comp.name, code: comp.code })}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded border border-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {companies.length === 0 && !loading && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-medium bg-slate-50/50">
                        No tenant companies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'Subscriptions' && (
          <>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Subscription Management</h3>
              <p className="text-xs text-gray-500 mt-0.5">Track plans, expirations, and process upgrades</p>
            </div>
            
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Company Name</th>
                    <th className="px-6 py-4 font-medium">Plan Tier</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Expiry Date</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {companies.map((comp) => {
                    const expiry = new Date(comp.subscriptionExpiresAt);
                    const diffTime = expiry - new Date();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let statusColor = 'bg-green-100 text-green-700';
                    let statusDot = 'bg-green-500';
                    let statusText = 'Active';
                    
                    if (comp.status === 'Expired' || diffDays < 0) {
                      statusColor = 'bg-red-100 text-red-700';
                      statusDot = 'bg-red-500';
                      statusText = 'Expired';
                    } else if (diffDays <= 7) {
                      statusColor = 'bg-yellow-100 text-yellow-700';
                      statusDot = 'bg-yellow-500';
                      statusText = `Expiring (${diffDays}d)`;
                    }

                    return (
                      <tr key={`sub-${comp._id}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {comp.name}
                          <div className="text-xs text-gray-500 font-normal">{comp.code}</div>
                        </td>
                        <td className="px-6 py-4 font-bold text-[#1E1B6E] text-sm">
                          {comp.subscription}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
                            {statusText}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-600">
                          <div className="flex items-center space-x-1.5">
                            <Calendar size={13} className="text-gray-400" />
                            <span>{comp.subscriptionExpiresAt ? new Date(comp.subscriptionExpiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => {
                              setSelectedUpgradeCompany(comp);
                              setUpgradeData({ plan: comp.subscription === 'One Day Trial' ? 'Basic' : comp.subscription, durationDays: '30' });
                              setShowUpgradeModal(true);
                            }}
                            className="px-4 py-2 bg-[#1E1B6E] hover:bg-opacity-90 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                          >
                            {statusText === 'Expired' ? 'Renew' : 'Upgrade'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'Payments' && (
          <>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Payment History</h3>
                <p className="text-xs text-gray-500 mt-0.5">Track all subscription renewals and plan purchases</p>
              </div>
              <button 
                onClick={() => exportToCSV(payments.map(p => ({ InvoiceNo: p.invoiceNo, Company: p.companyName, Plan: p.plan, Amount: p.amount, GST: p.gst, Total: p.total, Date: p.paymentDate, Status: p.status })), 'payments_export.csv')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Company Name</th>
                    <th className="px-6 py-4 font-medium">Plan</th>
                    <th className="px-6 py-4 font-medium text-right">Amount</th>
                    <th className="px-6 py-4 font-medium">Payment Date</th>
                    <th className="px-6 py-4 font-medium">Expiry Date</th>
                    <th className="px-6 py-4 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((pay) => (
                    <tr key={`pay-${pay._id}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {pay.companyName}
                        <div className="text-xs text-gray-500 font-normal">{pay.companyId}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-[#1E1B6E] text-sm">
                        {pay.plan}
                        <div className="text-[10px] text-gray-500 font-normal mt-0.5">{pay.durationDays} Days</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 text-right">
                        ₹{pay.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-600">
                        <div className="flex items-center space-x-1.5">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{new Date(pay.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-600">
                        <div className="flex items-center space-x-1.5">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{new Date(pay.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          pay.status === 'Paid' ? 'bg-green-100 text-green-700' : 
                          pay.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {pay.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && !loading && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-medium bg-slate-50/50">
                        No payment records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'Audit Logs' && (
          <>
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Platform Audit Logs</h3>
                <p className="text-xs text-gray-500 mt-0.5">System-wide monitoring of critical administrative actions</p>
              </div>
              <button 
                onClick={handleExportAuditLogs}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>

            {/* Filters */}
            <div className="bg-slate-50 p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center flex-wrap">
              <input
                type="text"
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-[#1E1B6E] focus:border-[#1E1B6E] text-sm"
                placeholder="Search action or user..."
                value={auditLogFilters.search}
                onChange={(e) => setAuditLogFilters({...auditLogFilters, search: e.target.value})}
              />
              <input
                type="text"
                className="w-40 px-3 py-2 border border-gray-200 rounded-lg focus:ring-[#1E1B6E] focus:border-[#1E1B6E] text-sm"
                placeholder="Filter company..."
                value={auditLogFilters.company}
                onChange={(e) => setAuditLogFilters({...auditLogFilters, company: e.target.value})}
              />
              <input 
                type="date"
                className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-[#1E1B6E]"
                value={auditLogFilters.date}
                onChange={(e) => setAuditLogFilters({...auditLogFilters, date: e.target.value})}
              />
              <select
                value={auditLogFilters.module}
                onChange={(e) => setAuditLogFilters({...auditLogFilters, module: e.target.value})}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-[#1E1B6E]"
              >
                <option value="All">All Modules</option>
                <option value="Authentication">Auth</option>
                <option value="Visitor">Visitor</option>
                <option value="User Management">Users</option>
                <option value="Tenant Management">Tenants</option>
                <option value="Subscription">Subscription</option>
                <option value="Settings">Settings</option>
              </select>
              <select
                value={auditLogFilters.status}
                onChange={(e) => setAuditLogFilters({...auditLogFilters, status: e.target.value})}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-[#1E1B6E]"
              >
                <option value="All">All Statuses</option>
                <option value="Success">Success</option>
                <option value="Failure">Failure</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Date & Time</th>
                    <th className="px-6 py-4 font-medium">Company</th>
                    <th className="px-6 py-4 font-medium">User & Role</th>
                    <th className="px-6 py-4 font-medium">Action</th>
                    <th className="px-6 py-4 font-medium">Module</th>
                    <th className="px-6 py-4 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredAuditLogs.map((log) => (
                    <tr key={`saas-audit-${log._id}`} className="hover:bg-slate-50/50 transition-colors">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{log.companyName || 'Unknown'}</div>
                        <div className="text-[10px] text-gray-500 font-normal tracking-wider">{log.companyId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{log.userName}</div>
                        <div className="text-[10px] text-gray-500 font-normal uppercase tracking-wider">{log.role}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800">
                        <div className="flex items-center gap-2">
                          <Activity size={14} className="text-[#1E1B6E]" />
                          <span>{log.action}</span>
                        </div>
                        {log.description && (
                          <p className="text-[11px] text-gray-500 mt-1 font-normal max-w-xs truncate" title={log.description}>{log.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-gray-700">
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
                  ))}
                  {filteredAuditLogs.length === 0 && !loading && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-medium bg-slate-50/50">
                        No audit logs available matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'Upgrade Requests' && (
          <>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Pending Upgrade Requests</h3>
                <p className="text-xs text-gray-500 mt-0.5">Approve or reject subscription upgrades requested by tenants.</p>
              </div>
              <button 
                onClick={() => exportToCSV(upgradeRequests.map(r => ({ Company: r.companyName, RequestedPlan: r.requestedPlan, Amount: r.amount, Status: r.status, RequestedOn: r.createdAt })), 'upgrade_requests_export.csv')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Company</th>
                    <th className="px-6 py-4 font-medium">Current Plan</th>
                    <th className="px-6 py-4 font-medium">Requested Plan</th>
                    <th className="px-6 py-4 font-medium">Payment</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {upgradeRequests.map((req) => {
                    const company = companies.find(c => c.code === req.companyId);
                    return (
                    <tr key={req._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {req.companyName}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-700">
                        {company?.subscription || 'Trial'}
                      </td>
                      <td className="px-6 py-4 font-bold text-[#1E1B6E] text-sm">
                        {req.requestedPlan}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                          Paid (₹{req.amount})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {req.status === 'Pending' ? (
                          <>
                            <button 
                              onClick={() => handleProcessUpgradeRequest(req._id, 'Approved')}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleProcessUpgradeRequest(req._id, 'Rejected')}
                              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-lg transition-colors ml-2"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 font-semibold italic">Processed</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {upgradeRequests.length === 0 && !loading && (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-500 font-medium bg-slate-50/50">
                        No upgrade requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Upgrade Plan Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-gray-100 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Upgrade Subscription</h3>
                <p className="text-xs text-gray-500 mt-1">{selectedUpgradeCompany?.name}</p>
              </div>
              <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleProcessUpgrade} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Plan Tier</label>
                  <select 
                    required
                    value={upgradeData.plan}
                    onChange={(e) => setUpgradeData({...upgradeData, plan: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1E1B6E] focus:border-transparent transition-all outline-none text-gray-900 font-medium"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Standard">Standard</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Duration</label>
                  <select 
                    required
                    value={upgradeData.durationDays}
                    onChange={(e) => setUpgradeData({...upgradeData, durationDays: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1E1B6E] focus:border-transparent transition-all outline-none text-gray-900 font-medium"
                  >
                    <option value="30">1 Month (30 Days)</option>
                    <option value="90">3 Months (90 Days)</option>
                    <option value="365">1 Year (365 Days)</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-8 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 text-gray-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#1E1B6E] hover:bg-opacity-95 text-white font-semibold rounded-xl shadow-md transition-colors"
                >
                  Confirm Upgrade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1E1B6E] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-md">Register New Tenant Company</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-white hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRegisterCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Acme Industries"
                  value={newCompany.companyName}
                  onChange={(e) => setNewCompany({...newCompany, companyName: e.target.value})}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Plan Tier</label>
                  <select 
                    value={newCompany.plan}
                    onChange={(e) => setNewCompany({...newCompany, plan: e.target.value})}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]"
                  >
                    <option value="One Day Trial">One Day Trial (1 Day)</option>
                    <option value="Basic">Basic (30-Day Free Trial)</option>
                    <option value="Standard">Standard ($29/mo)</option>
                    <option value="Enterprise">Enterprise ($99/mo)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Super Admin Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. John Doe"
                    value={newCompany.adminName}
                    onChange={(e) => setNewCompany({...newCompany, adminName: e.target.value})}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]" 
                  />
                  <p className="mt-1 text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    Will be assigned the <span className="font-bold">Super Admin</span> role on their tenant dashboard
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Super Admin Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="e.g. admin@acme.com"
                  value={newCompany.email}
                  onChange={(e) => setNewCompany({...newCompany, email: e.target.value})}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 9876543210"
                    value={newCompany.mobileNumber}
                    onChange={(e) => setNewCompany({...newCompany, mobileNumber: e.target.value})}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Initial Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Password"
                      value={newCompany.password}
                      onChange={(e) => setNewCompany({...newCompany, password: e.target.value})}
                      className="w-full text-sm border rounded-lg p-2.5 pr-10 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700 flex items-start gap-2">
                <span className="mt-0.5 text-indigo-500">ℹ️</span>
                <span>After creation, the tenant's Super Admin can log in with their email and password to access their own <strong>Super Admin Dashboard</strong>.</span>
              </div>
              <button 
                type="submit"
                disabled={isRegistering}
                className="w-full bg-[#1E1B6E] hover:bg-opacity-90 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors mt-2"
              >
                {isRegistering ? 'Registering...' : 'Register Tenant & Create Super Admin'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MOCK PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1E1B6E] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-md">Mock Payment Simulator</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-white hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleMockPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Code to Upgrade</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. ACM723"
                  value={paymentSimulation.companyCode}
                  onChange={(e) => setPaymentSimulation({...paymentSimulation, companyCode: e.target.value})}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Upgrade Plan</label>
                <select 
                  value={paymentSimulation.plan}
                  onChange={(e) => setPaymentSimulation({...paymentSimulation, plan: e.target.value})}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]"
                >
                  <option value="Standard">Standard ($29/mo)</option>
                  <option value="Enterprise">Enterprise ($99/mo)</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors mt-2"
              >
                Simulate Stripe Success Callback
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#1E1B6E] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-md">Edit Tenant Company</h3>
              <button onClick={() => { setShowEditModal(false); setEditCompany(null); }} className="text-white hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Code</label>
                <input 
                  type="text" 
                  disabled
                  value={editCompany.code}
                  className="w-full text-sm border rounded-lg p-2.5 bg-gray-100 text-gray-500 cursor-not-allowed" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name</label>
                <input 
                  type="text" 
                  required
                  value={editCompany.name}
                  onChange={(e) => setEditCompany({...editCompany, name: e.target.value})}
                  className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Plan Tier</label>
                  <select 
                    value={editCompany.subscription}
                    onChange={(e) => setEditCompany({...editCompany, subscription: e.target.value})}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]"
                  >
                    <option value="One Day Trial">One Day Trial</option>
                    <option value="Basic">Basic</option>
                    <option value="Standard">Standard</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select 
                    value={editCompany.status}
                    onChange={(e) => setEditCompany({...editCompany, status: e.target.value})}
                    className="w-full text-sm border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-8 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditCompany(null); }}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-gray-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#1E1B6E] hover:bg-opacity-95 text-white font-semibold rounded-xl shadow-md transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl border max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-md flex items-center gap-2">
                <ShieldAlert size={18} /> Confirm Permanent Deletion
              </h3>
              <button onClick={() => setDeleteConfirm(null)} className="text-white hover:text-red-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <p className="font-bold mb-1">⚠️ This action cannot be undone!</p>
                <p>All data for this tenant will be <strong>permanently deleted</strong>, including:</p>
                <ul className="list-disc list-inside mt-1 text-xs space-y-0.5 text-red-700">
                  <li>All users (admin &amp; security staff)</li>
                  <li>All visitor records</li>
                  <li>Blacklist entries, zones, notifications</li>
                </ul>
              </div>
              <div className="bg-slate-50 border rounded-lg px-4 py-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Company to be deleted</p>
                <p className="font-bold text-gray-900 text-lg">{deleteConfirm.name}</p>
                <span className="font-mono text-xs bg-slate-200 text-gray-700 px-2 py-0.5 rounded">{deleteConfirm.code}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCompany}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
                >
                  Yes, Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Send Notification Modal */}
      <SendNotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        company={notificationCompany}
        onSend={() => setNotificationCompany(null)}
      />

    </div>
  );
};

export default SaaSPlatformDashboard;
