import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Lock, Bell, Shield, Save, Check } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  
  React.useEffect(() => {
    if (activeTab === 'approvals') {
      const fetchPermissions = async () => {
        try {
          setIsLoadingPermissions(true);
          const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
          const response = await fetch(`${API_URL}/api/approval-permissions`, {
            headers: { 
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'x-user-role': user?.role
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.permissions) setPermissions(data.permissions);
          }
        } catch (e) {
          console.error('Failed to load permissions', e);
        } finally {
          setIsLoadingPermissions(false);
        }
      };
      if (user?.role === 'Super Admin') fetchPermissions();
    }
  }, [activeTab, user]);

  const handleTogglePermission = (role) => {
    setPermissions((previous) =>
      previous.map((p) =>
        p.role === role ? { ...p, canApprove: !p.canApprove } : p
      )
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    if (activeTab === 'brand') {
      try {
        const logoUrl = document.getElementById('brand-logo').value;
        const primaryColor = document.getElementById('brand-color').value;
        
        const response = await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/company/branding`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Company-Id': user.companyId,
            'X-User-Role': user.role
          },
          body: JSON.stringify({ logoUrl, primaryColor })
        });
        
        if (response.ok) {
          const updatedBranding = await response.json();
          // Update the context user object slightly by mutating session/local storage for persistence
          const currentUser = JSON.parse(localStorage.getItem('zmvms_user') || sessionStorage.getItem('zmvms_user'));
          if (currentUser) {
            currentUser.branding = updatedBranding;
            if (localStorage.getItem('zmvms_user')) localStorage.setItem('zmvms_user', JSON.stringify(currentUser));
            if (sessionStorage.getItem('zmvms_user')) sessionStorage.setItem('zmvms_user', JSON.stringify(currentUser));
          }
          
          // Force apply CSS immediately
          document.documentElement.style.setProperty('--color-brand-indigo', primaryColor);
          
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        } else {
          alert('Failed to update brand settings. Ensure you have Super Admin permissions.');
        }
      } catch (err) {
        console.error(err);
        alert('Network error while saving.');
      }
    } else if (activeTab === 'approvals') {
      try {
        const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
        
        const savePromises = permissions.map(p => 
          fetch(`${API_URL}/api/approval-permissions/${p.role}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'x-user-role': user?.role
            },
            body: JSON.stringify({ canApprove: p.canApprove })
          })
        );
        
        const results = await Promise.all(savePromises);
        
        if (results.every(res => res.ok)) {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        } else {
          alert('✕ Failed to update approval permissions');
        }
      } catch (err) {
        console.error(err);
        alert('✕ Failed to update approval permissions');
      }
    } else {
      // Fake save for other tabs
      setTimeout(() => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }, 800);
    }
    setIsSaving(false);
  };

  const inputClass = "w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-[var(--color-brand-indigo)] outline-none transition-all";

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 mt-1">Manage your profile, security, and notification preferences.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-gray-100 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-indigo-50 text-[var(--color-brand-indigo)]' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
          >
            <User size={18} /> My Profile
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-indigo-50 text-[var(--color-brand-indigo)]' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
          >
            <Lock size={18} /> Security
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-indigo-50 text-[var(--color-brand-indigo)]' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
          >
            <Bell size={18} /> Notifications
          </button>
          {['Super Admin', 'Admin'].includes(user?.role) && (
            <button 
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'system' ? 'bg-indigo-50 text-[var(--color-brand-indigo)]' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
            >
              <Shield size={18} /> System Preferences
            </button>
          )}
          {user?.role === 'Super Admin' && ['Standard', 'Enterprise'].includes(user?.subscription) && (
            <button 
              onClick={() => setActiveTab('brand')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'brand' ? 'bg-indigo-50 text-[var(--color-brand-indigo)]' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
            >
              <Shield size={18} /> Brand & Theme
            </button>
          )}
          {user?.role === 'Super Admin' && (
            <button 
              onClick={() => setActiveTab('approvals')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'approvals' ? 'bg-indigo-50 text-[var(--color-brand-indigo)]' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}
            >
              <Check size={18} /> Approval Permissions
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8">
          <form onSubmit={handleSave} className="h-full flex flex-col">
            
            {activeTab === 'profile' && (
              <div className="space-y-6 flex-1 animate-in slide-in-from-right-4">
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input type="text" defaultValue={user?.name || ''} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input type="email" defaultValue={user?.email || ''} readOnly className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`} />
                    <p className="text-xs text-gray-400 mt-1">Contact IT support to change your email.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <input type="text" defaultValue={user?.role || ''} readOnly className={`${inputClass} bg-gray-50 text-gray-500`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Branch</label>
                    <input type="text" defaultValue={user?.branch || 'All Branches'} readOnly className={`${inputClass} bg-gray-50 text-gray-500`} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6 flex-1 animate-in slide-in-from-right-4">
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Change Password</h2>
                <div className="max-w-md space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                    <input type="password" placeholder="••••••••" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <input type="password" placeholder="••••••••" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                    <input type="password" placeholder="••••••••" className={inputClass} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6 flex-1 animate-in slide-in-from-right-4">
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Notification Preferences</h2>
                <div className="space-y-4 max-w-2xl">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div>
                      <p className="font-bold text-gray-800">Email Notifications</p>
                      <p className="text-sm text-gray-500">Receive daily summary reports and critical alerts via email.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div>
                      <p className="font-bold text-gray-800">SMS Alerts</p>
                      <p className="text-sm text-gray-500">Instant SMS updates for urgent restricted zone violations.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6 flex-1 animate-in slide-in-from-right-4">
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">System Preferences</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Default Branch View</label>
                    <select className={inputClass} defaultValue="All Branches">
                      <option>All Branches</option>
                      <option>Bangalore</option>
                      <option>Chennai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time Zone</label>
                    <select className={inputClass} defaultValue="IST">
                      <option value="IST">India Standard Time (IST)</option>
                      <option value="UTC">Coordinated Universal Time (UTC)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'brand' && (
              <div className="space-y-6 flex-1 animate-in slide-in-from-right-4">
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Brand & Theme</h2>
                <p className="text-sm text-gray-500 mb-6">Customize the look and feel of your Visitor Management System. Refresh the page after saving to see changes applied globally.</p>
                <div className="grid grid-cols-1 gap-6 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo URL</label>
                    <input 
                      type="url" 
                      id="brand-logo"
                      placeholder="https://example.com/logo.png" 
                      defaultValue={user?.branding?.logoUrl || ''} 
                      className={inputClass} 
                    />
                    <p className="text-xs text-gray-400 mt-1">Provide a direct URL to a publicly accessible image (PNG/JPG).</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Primary Brand Color</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="color" 
                        id="brand-color"
                        defaultValue={user?.branding?.primaryColor || '#1E1B6E'} 
                        className="w-16 h-12 p-1 border border-gray-200 rounded cursor-pointer" 
                      />
                      <span className="text-sm font-medium text-gray-600">Select your company's primary color.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'approvals' && (
              <div className="space-y-6 flex-1 animate-in slide-in-from-right-4">
                <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Approval Permissions</h2>
                <p className="text-sm text-gray-500 mb-6">Configure who can approve visitor requests.</p>
                
                {isLoadingPermissions ? (
                  <p className="text-sm font-medium text-gray-500">Loading approval permissions...</p>
                ) : (
                  <div className="space-y-4 max-w-xl">
                    {permissions.map((p) => {
                      const displayNames = {
                        'SUPER_ADMIN': 'Super Admin',
                        'MD': 'MD',
                        'SENIOR_HR': 'Senior HR',
                        'IT': 'IT'
                      };
                      const displayName = displayNames[p.role] || p.role;
                      
                      return (
                        <div key={p.role} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                          <span className="font-bold text-gray-800">{displayName}</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={p.canApprove}
                              onChange={() => handleTogglePermission(p.role)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      );
                    })}
                    
                    {/* Security - Fixed state */}
                    <div className="flex items-center justify-between p-4 rounded-lg border border-red-50 bg-red-50/50">
                      <div>
                        <span className="font-bold text-gray-800">Security</span>
                        <p className="text-xs text-red-600 mt-1">Approval permission cannot be enabled.</p>
                      </div>
                      <span className="text-sm font-medium text-gray-500 px-3 py-1 bg-gray-100 rounded-md">Not Available</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-end gap-4">
              {showSuccess && (
                <span className="text-sm font-bold text-green-600 flex items-center gap-1 animate-in fade-in">
                  <Check size={16} /> Saved Successfully
                </span>
              )}
              <button 
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Save size={18} />
                )}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
