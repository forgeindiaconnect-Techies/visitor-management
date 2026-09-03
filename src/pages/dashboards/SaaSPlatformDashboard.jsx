import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building, Users, UserCheck, CreditCard, Calendar, Activity, Check, X, ShieldAlert, Sparkles, Plus, AlertCircle, RefreshCw, Eye, EyeOff, Download, Copy, ExternalLink } from 'lucide-react';
import { exportToCSV } from '../../utils/exportUtils';
import SendNotificationModal from '../../components/superadmin/SendNotificationModal';
import { io } from 'socket.io-client';

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
  const [saasLeads, setSaasLeads] = useState([]);
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Form states for creating a new company
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [subscription, setSubscription] = useState('Standard');
  const [expiryDate, setExpiryDate] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1E1B6E');
  const [initialBranch, setInitialBranch] = useState('Main Branch');
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [activeLeadTab, setActiveLeadTab] = useState('details');
  const [newCompany, setNewCompany] = useState({
    companyName: '',
    adminName: '',
    email: '',
    mobileNumber: '',
    password: '',
    plan: 'One Day Trial'
  });
  const [companyLogo, setCompanyLogo] = useState(null);
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
  const [editCompanyLogo, setEditCompanyLogo] = useState(null);

  const location = window.location;
  const pathname = location.pathname;
  
  // Determine active tab from URL
  let currentTab = 'Companies';
  if (pathname.includes('/saas/subscriptions')) currentTab = 'Subscriptions';
  else if (pathname.includes('/saas/payments')) currentTab = 'Payments';
  else if (pathname.includes('/saas/upgrades')) currentTab = 'Upgrade Requests';
  else if (pathname.includes('/saas/leads')) currentTab = 'Registrations';

  const activeTab = currentTab;
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedUpgradeCompany, setSelectedUpgradeCompany] = useState(null);
  const [upgradeData, setUpgradeData] = useState({ plan: 'Standard', durationDays: '30' });

  // Notification state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationCompany, setNotificationCompany] = useState(null);

  const [isRegistering, setIsRegistering] = useState(false);

  const handleCardClick = (tabName) => {
    // Navigate via browser history if card is clicked
    let path = '/saas/companies';
    if (tabName === 'Subscriptions') path = '/saas/subscriptions';
    else if (tabName === 'Payments') path = '/saas/payments';
    else if (tabName === 'Upgrade Requests') path = '/saas/upgrades';
    
    window.location.href = path;
  };

  const API_BASE = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      ...(user?.token && { 'Authorization': `Bearer ${user.token}` }),
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

      // Fetch saas leads
      const leadsRes = await fetch(`${API_BASE}/api/saas-leads`, {
        headers: getHeaders()
      });
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setSaasLeads(leadsData.data);
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

    const rawApi = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')).replace(/\/api\/?$/, '');
    const socket = io(rawApi);
    
    if (user) {
      socket.emit('join-notification-room', {
        userId: user._id || user.id,
        role: user.role,
        companyId: user.companyId
      });

      // Secure SaaS Admin Room Join
      if (user.role === 'SaaS Super Admin' && user.token) {
        socket.emit('join_saas_room', { token: user.token });
      }
    }

    const handleNewLead = (newLead) => {
      setSaasLeads((current) => {
        const alreadyExists = current.some(lead => lead._id === newLead._id);
        if (alreadyExists) return current;
        
        showToast(
          `New Registration: ${newLead.companyName} requested the ${
            newLead.requestedPlan || 'One Day Trial'
          } plan`,
          'info'
        );
        return [newLead, ...current];
      });
    };

    const handleLeadUpdated = (
      updatedLead
    ) => {
      setSaasLeads((currentLeads) =>
        currentLeads.map((lead) =>
          lead._id === updatedLead._id
            ? updatedLead
            : lead
        )
      );

      setSelectedLead((currentLead) =>
        currentLead?._id === updatedLead._id
          ? updatedLead
          : currentLead
      );
    };

    socket.on(
      'new_saas_lead',
      handleNewLead
    );

    socket.on(
      'saas_lead_updated',
      handleLeadUpdated
    );

    return () => {
      socket.off(
        'new_saas_lead',
        handleNewLead
      );

      socket.off(
        'saas_lead_updated',
        handleLeadUpdated
      );

      socket.disconnect();
    };
  }, []);

  const updatePaymentStatus = async (
    leadId,
    paymentStatus
  ) => {
    try {
      const token =
        localStorage.getItem('token') ||
        currentUser?.token;

      const configuredUrl =
        import.meta.env.VITE_API_URL ||
        'http://localhost:5000';

      const baseUrl = configuredUrl.replace(
        /\/api\/?$/,
        ''
      );

      const response = await fetch(
        `${baseUrl}/api/saas-leads/${leadId}/payment-status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            paymentStatus
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          'Failed to update payment status.'
        );
      }

      setSaasLeads((currentLeads) =>
        currentLeads.map((lead) =>
          lead._id === result.lead._id
            ? result.lead
            : lead
        )
      );

      showToast(
        `${result.lead.companyName}: Payment changed to ${result.lead.paymentStatus}`,
        'success'
      );
    } catch (error) {
      console.error(
        'Payment update error:',
        error
      );

      showToast(
        error.message ||
        'Unable to update payment status.',
        'error'
      );
    }
  };

  const getPlanBadgeClass = (plan) => {
    switch (plan) {
      case 'Enterprise':
        return 'bg-purple-100 text-purple-700 border-purple-200';

      case 'Standard':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';

      case 'Basic':
        return 'bg-blue-100 text-blue-700 border-blue-200';

      case 'One Day Trial':
      default:
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const getPaymentBadgeClass = (status) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-700 border-green-200';

      case 'Failed':
        return 'bg-red-100 text-red-700 border-red-200';

      case 'Not Required':
        return 'bg-slate-100 text-slate-700 border-slate-200';

      case 'Pending':
      default:
        return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

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

      if (editCompanyLogo) {
        try {
          const logoData = new FormData();
          logoData.append('logo', editCompanyLogo);
          const logoResponse = await fetch(`${API_BASE}/api/super-admin/companies/${editCompany.code}/logo`, {
            method: 'POST',
            headers: {
              ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
            },
            body: logoData
          });
          if (!logoResponse.ok) {
            console.warn('Logo upload failed, but company was updated.');
          }
        } catch (uploadErr) {
          console.error('Logo upload error:', uploadErr);
        }
      }

      showToast(`Company details updated successfully`, 'success');
      setShowEditModal(false);
      setEditCompany(null);
      setEditCompanyLogo(null);
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

      if (companyLogo && data.company && data.company.code) {
        try {
          const logoData = new FormData();
          logoData.append('logo', companyLogo);
          const logoResponse = await fetch(`${API_BASE}/api/super-admin/companies/${data.company.code}/logo`, {
            method: 'POST',
            headers: {
              ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
            },
            body: logoData
          });
          if (!logoResponse.ok) {
            console.warn('Logo upload failed, but company was created.');
          }
        } catch (uploadErr) {
          console.error('Logo upload error:', uploadErr);
        }
      }

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
      setCompanyLogo(null);
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

  const handleUpdateLeadStatus = async (leadId, status) => {
    try {
      const response = await fetch(`${API_BASE}/api/saas-leads/${leadId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update lead status');
      setNotification({ message: 'Lead status updated successfully', type: 'success' });
      fetchData();
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  const updateStatus = handleUpdateLeadStatus;

  const handleSendEmail = async (event) => {
    event.preventDefault();

    if (
      !selectedLead ||
      !emailSubject.trim() ||
      !emailMessage.trim()
    ) {
      showToast(
        'Subject and message are required.',
        'warning'
      );
      return;
    }

    try {
      setSendingEmail(true);

      const response = await fetch(
        `${API_BASE}/api/saas-leads/${selectedLead._id}/send-email`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            subject: emailSubject.trim(),
            message: emailMessage.trim()
          })
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          'Failed to process the email request.'
        );
      }

      // Update communication history for both sent and failed attempts.
      if (data.data) {
        setSaasLeads((currentLeads) =>
          currentLeads.map((lead) =>
            lead._id === selectedLead._id
              ? data.data
              : lead
          )
        );

        setSelectedLead(data.data);
      }

      if (data.delivered) {
        showToast(
          data.message ||
          'Email delivered successfully.',
          'success'
        );

        setEmailSubject('');
        setEmailMessage('');
      } else {
        showToast(
          data.message ||
          'Email was not delivered. The failed attempt was saved.',
          'warning'
        );

        // Keep the subject and message so the admin can retry.
      }
    } catch (error) {
      console.error(
        'Send lead email error:',
        error
      );

      showToast(
        error.message ||
        'Unable to process the email request.',
        'error'
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const createCompanyDashboard = async () => {
    if (!selectedLead || !expiryDate) {
      alert('Please select the subscription expiry date');
      return;
    }

    try {
      setCreating(true);

      const response = await fetch(
        `${API_BASE}/api/saas-leads/${selectedLead._id}/convert`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            subscription,
            subscriptionExpiresAt: expiryDate,
            primaryColor
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      showToast(result.message, 'success');

      setSaasLeads((current) =>
        current.map((lead) =>
          lead._id === selectedLead._id
            ? {
                ...lead,
                convertedCompanyId: result.data?.company?._id || true
              }
            : lead
        )
      );

      setSelectedLead(null);
      setExpiryDate('');
      fetchData(); // Optionally re-fetch to get updated companies list
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setCreating(false);
    }
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
        {/* Horizontal tabs removed since they are now in the side navigation bar */}

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
                    <th className="px-5 py-3.5 font-medium">Company Name</th>
                    <th className="px-5 py-3.5 font-medium">Company ID</th>
                    <th className="px-5 py-3.5 font-medium">Admin Email</th>
                    <th className="px-5 py-3.5 font-medium">Plan</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 font-medium">Expiry Date</th>
                    <th className="px-4 py-3.5 font-medium text-center">Branches</th>
                    <th className="px-4 py-3.5 font-medium text-center">Users</th>
                    <th className="px-4 py-3.5 font-medium text-center">Visitors</th>
                    <th className="px-4 py-3.5 font-medium text-center">Pre-Bookings</th>
                    <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {companies.map((comp) => (
                    <tr key={comp._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-gray-900">
                        <div className="flex items-center gap-3">
                          {comp.branding?.logoUrl ? (
                            <img src={comp.branding.logoUrl} alt="Logo" className="w-8 h-8 rounded object-contain bg-white shrink-0 shadow-sm" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[var(--color-brand-indigo)] font-bold shrink-0">
                              {comp.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{comp.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs bg-slate-100 text-gray-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                            {comp.code || comp.companyId}
                          </span>
                          <button
                            title="Copy Pre-Booking Link"
                            onClick={() => {
                              const link = `https://visitor-management-indol.vercel.app/pre-booking/${comp.code || comp.companyId}`;
                              navigator.clipboard.writeText(link);
                              showToast(`Copied pre-booking link for ${comp.name}!`, 'success');
                            }}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                          >
                            <Copy size={13} />
                          </button>
                          <a
                            title="Open Pre-Booking Link"
                            href={`/pre-booking/${comp.code || comp.companyId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600 font-medium">
                        {comp.adminEmail}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold px-2.5 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100 text-[11px]">
                          {comp.subscription || comp.plan}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          comp.status === 'Active' ? 'bg-green-100 text-green-700' : 
                          comp.status === 'Expired' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {comp.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                        {comp.subscriptionExpiresAt ? new Date(comp.subscriptionExpiresAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-gray-700">
                        {comp.branchCount || 0}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-gray-700">
                        {comp.userCount || 0}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-gray-700">
                        {comp.visitorCount || 0}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-[#1E1B6E]">
                        {comp.preBookingCount || 0}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button 
                          onClick={() => { setEditCompany({ ...comp }); setShowEditModal(true); }}
                          className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded hover:bg-blue-100 mr-1.5 border border-blue-200"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => { setNotificationCompany({ ...comp }); setShowNotificationModal(true); }}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded hover:bg-indigo-100 mr-1.5 border border-indigo-200"
                        >
                          Notify
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(comp._id, comp.status)}
                          className="px-2.5 py-1 bg-slate-100 text-gray-700 text-xs font-semibold rounded hover:bg-slate-200 mr-1.5 border border-slate-200"
                        >
                          {comp.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: comp._id, name: comp.name, code: comp.code })}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded border border-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {companies.length === 0 && !loading && (
                    <tr>
                      <td colSpan="11" className="px-6 py-12 text-center text-gray-500 font-medium bg-slate-50/50">
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
        {activeTab === 'Registrations' && (
          <>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Registrations / Sales Leads</h3>
                <p className="text-xs text-gray-500 mt-0.5">Manage new registrations and convert them to tenants.</p>
              </div>
            </div>
            
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Company Name</th>
                    <th className="px-6 py-4 font-medium">Contact</th>

                    <th className="px-6 py-4 font-medium">
                      Requested Plan
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Payment
                    </th>

                    <th className="px-6 py-4 font-medium">
                      Date
                    </th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {saasLeads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        <div className="flex items-center gap-3">
                          {lead.logoUrl ? (
                            <img 
                              src={lead.logoUrl} 
                              alt={`${lead.companyName} logo`} 
                              className="w-8 h-8 rounded object-contain bg-white shrink-0 shadow-sm border border-gray-100" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1E1B6E] font-bold shrink-0 text-xs">
                              {lead.companyName ? lead.companyName.charAt(0).toUpperCase() : 'C'}
                            </div>
                          )}
                          <span>{lead.companyName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-700">
                        {lead.contactPerson}
                        <div className="text-xs font-normal text-gray-500">{lead.email} | {lead.mobileNumber}</div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`rounded-full border px-2.5 py-1 font-semibold ${getPlanBadgeClass(
                              lead.requestedPlan || 'One Day Trial'
                            )}`}
                          >
                            {lead.requestedPlan || 'One Day Trial'}
                          </span>

                          <span className="text-[11px] text-slate-500">
                            {lead.requestedPlan === 'Enterprise'
                              ? 'Unlimited passes'
                              : lead.requestedPlan === 'Standard'
                                ? '3,000 passes'
                                : lead.requestedPlan === 'Basic'
                                  ? '500 passes'
                                  : '25 passes · 24 hours'}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs">
                        {(lead.requestedPlan ||
                          'One Day Trial') ===
                        'One Day Trial' ? (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                            Not Required
                          </span>
                        ) : (
                          <select
                            value={
                              lead.paymentStatus ||
                              'Pending'
                            }
                            onChange={(event) =>
                              updatePaymentStatus(
                                lead._id,
                                event.target.value
                              )
                            }
                            disabled={
                              Boolean(
                                lead.convertedCompanyId
                              )
                            }
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none ${getPaymentBadgeClass(
                              lead.paymentStatus ||
                              'Pending'
                            )} ${
                              lead.convertedCompanyId
                                ? 'cursor-not-allowed opacity-60'
                                : 'cursor-pointer'
                            }`}
                          >
                            <option value="Pending">
                              Pending
                            </option>

                            <option value="Paid">
                              Paid
                            </option>

                            <option value="Failed">
                              Failed
                            </option>

                            <option value="Refunded">
                              Refunded
                            </option>
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-600">
                        <div className="flex items-center space-x-1.5">
                          <Calendar size={13} className="text-gray-400" />
                          <span>{new Date(lead.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <select
                          value={lead.status}
                          onChange={(event) =>
                            updateStatus(lead._id, event.target.value)
                          }
                          className="px-2 py-1 border rounded bg-white text-xs"
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Demo Scheduled">
                            Demo Scheduled
                          </option>
                          <option value="Negotiation">Negotiation</option>
                          <option value="Won">Won</option>
                          <option value="Lost">Lost</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button 
                          onClick={() => { setSelectedLead(lead); setActiveLeadTab('details'); }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded transition-colors inline-block mr-1"
                        >
                          View Details
                        </button>
                        {lead.status === 'Won' &&
                         !lead.convertedCompanyId &&
                         (
                           (lead.requestedPlan ||
                             'One Day Trial') ===
                             'One Day Trial' ||
                           lead.paymentStatus === 'Paid'
                         ) && (
                          <button
                            type="button"
                            onClick={() => { setSelectedLead(lead); setActiveLeadTab('convert'); }}
                            className="rounded-lg bg-indigo-700 px-4 py-2 text-white text-xs font-bold shadow hover:bg-indigo-800 transition"
                          >
                            Create Dashboard
                          </button>
                        )}

                        {lead.status === 'Won' &&
                         !lead.convertedCompanyId &&
                         (lead.requestedPlan ||
                           'One Day Trial') !==
                           'One Day Trial' &&
                         lead.paymentStatus !== 'Paid' && (
                          <span className="ml-2 inline-block text-xs font-semibold text-orange-600">
                            Payment required before conversion
                          </span>
                        )}

                        {lead.convertedCompanyId && (
                          <span className="font-semibold text-green-700 text-xs bg-green-50 px-2.5 py-1 rounded inline-block">
                            Dashboard Created
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {saasLeads.length === 0 && !loading && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-medium bg-slate-50/50">
                        No sales leads found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedLead && (
              <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 z-50 backdrop-blur-sm overflow-y-auto">
                <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-[#1E1B6E] p-4 flex justify-between items-center text-white shrink-0">
                    <h2 className="text-lg font-bold">Lead Details</h2>
                    <button onClick={() => setSelectedLead(null)} className="text-gray-300 hover:text-white">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="flex border-b border-gray-200 shrink-0">
                    <button onClick={() => setActiveLeadTab('details')} className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeLeadTab === 'details' ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Overview</button>
                    <button onClick={() => setActiveLeadTab('email')} className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeLeadTab === 'email' ? 'border-[#1E1B6E] text-[#1E1B6E]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Email & History</button>
                    {selectedLead.status === 'Won' && !selectedLead.convertedCompanyId && (
                      <button onClick={() => setActiveLeadTab('convert')} className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeLeadTab === 'convert' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Convert to Tenant</button>
                    )}
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                    {activeLeadTab === 'details' && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-6 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                          {selectedLead.logoUrl ? (
                            <img src={selectedLead.logoUrl} alt={`${selectedLead.companyName} logo`} className="h-24 w-24 rounded-xl object-contain bg-gray-50 border border-gray-100" />
                          ) : (
                            <div className="h-24 w-24 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-300">
                              <Building size={32} />
                            </div>
                          )}
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900">{selectedLead.companyName}</h3>
                            <p className="text-gray-500 font-medium">{selectedLead.contactPerson}</p>
                            <div className="mt-2 flex gap-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">✉️ {selectedLead.email}</span>
                              <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">📱 {selectedLead.mobileNumber}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-3">
                            <div>
                              <span className="text-xs text-gray-400 font-semibold uppercase">Deal Status</span>
                              <p className="font-bold text-indigo-700">{selectedLead.status}</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 font-semibold uppercase">Expected Scale</span>
                              <p className="font-medium text-gray-700">{selectedLead.expectedBranches} Branches, {selectedLead.expectedEmployees} Employees</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 font-semibold uppercase">Registration Date</span>
                              <p className="font-medium text-gray-700">{new Date(selectedLead.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                          
                          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-3">
                            <div>
                              <span className="text-xs text-gray-400 font-semibold uppercase">Customer Message</span>
                              <p className="text-sm text-gray-700 italic border-l-2 border-indigo-200 pl-3 py-1 mt-1">{selectedLead.message || 'No message provided'}</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 font-semibold uppercase">Last Contacted</span>
                              <p className="font-medium text-gray-700">{selectedLead.lastContactedAt ? new Date(selectedLead.lastContactedAt).toLocaleString() : 'Never'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeLeadTab === 'email' && (
                      <div className="space-y-6">
                        <form onSubmit={handleSendEmail} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
                          <h4 className="font-bold text-gray-800 border-b pb-2">Send Email</h4>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
                            <input type="text" required value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-[#1E1B6E]" placeholder="FIC VMS Demo Discussion" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
                            <textarea rows="4" required value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="w-full border rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-[#1E1B6E]" placeholder="Thank you for registering..."></textarea>
                          </div>
                          <button type="submit" disabled={sendingEmail} className="bg-[#1E1B6E] text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-indigo-900 transition-colors">
                            {sendingEmail ? 'Sending...' : 'Send Email'}
                          </button>
                        </form>

                        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                          <h4 className="font-bold text-gray-800 border-b pb-2 mb-4">Communication History</h4>
                          {selectedLead.communicationHistory && selectedLead.communicationHistory.length > 0 ? (
                            <div className="space-y-4">
                              {selectedLead.communicationHistory.map((hist, idx) => (
                                <div key={idx} className="border-l-2 border-indigo-200 pl-4 py-1">
                                  <div className="flex justify-between items-start">
                                    <h5 className="font-bold text-gray-800 text-sm">{hist.subject}</h5>
                                    <span className="text-xs text-gray-500">{new Date(hist.sentAt).toLocaleString()}</span>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">Sent by: {hist.sentBy}</p>
                                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{hist.message}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No communication history yet.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {activeLeadTab === 'convert' && selectedLead.status === 'Won' && (
                      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm max-w-md mx-auto mt-4">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Building size={32} />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900">Provision Tenant Workspace</h3>
                          <p className="text-sm text-gray-500 mt-1">Convert this Won lead into an active tenant</p>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Subscription Plan</label>
                            <select value={subscription} onChange={e => setSubscription(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 outline-none focus:ring-1 focus:ring-green-500">
                              <option value="One Day Trial">One Day Trial</option>
                              <option value="Basic">Basic</option>
                              <option value="Standard">Standard</option>
                              <option value="Enterprise">Enterprise</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Expiry Date</label>
                            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 outline-none focus:ring-1 focus:ring-green-500" required />
                          </div>
                          {selectedLead?.logoUrl ? (
                            <div className="bg-slate-50 border border-gray-200 rounded-lg p-3 text-center">
                              <span className="text-xs font-semibold text-gray-500 block mb-1.5">Auto-Assigned Company Logo</span>
                              <img src={selectedLead.logoUrl} alt="Uploaded logo" className="h-16 object-contain mx-auto border rounded-md p-1 bg-white" />
                            </div>
                          ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 font-medium text-center">
                              No logo uploaded during registration. Default branding will be applied.
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Primary Colour</label>
                            <div className="flex items-center gap-2">
                              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                              <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs font-mono" />
                            </div>
                          </div>
                          
                          <button onClick={createCompanyDashboard} disabled={creating} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 mt-4">
                            {creating ? 'Creating...' : 'Create & Send Activation'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Company Logo (Optional)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setCompanyLogo(event.target.files[0])}
                    className="w-full text-sm border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E] bg-white"
                  />
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
              <button onClick={() => { setShowEditModal(false); setEditCompany(null); setEditCompanyLogo(null); }} className="text-white hover:text-gray-300">
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
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Logo (Optional)</label>
                {editCompany.branding?.logoUrl && (
                  <div className="mb-2 flex items-center gap-3 p-2 bg-gray-50 border rounded-lg">
                    <img src={editCompany.branding.logoUrl} alt="Current Logo" className="w-10 h-10 object-contain bg-white rounded border shadow-sm shrink-0" />
                    <div className="text-xs text-gray-500">
                      <p className="font-semibold text-gray-700">Current Logo</p>
                      <p>Upload a new image below to replace</p>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setEditCompanyLogo(event.target.files[0])}
                  className="w-full text-sm border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#1E1B6E] bg-white"
                />
              </div>
              
              <div className="mt-8 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditCompany(null); setEditCompanyLogo(null); }}
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
