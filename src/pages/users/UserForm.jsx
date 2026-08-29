import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { Save, X, User, Mail, Lock, Shield, Building, Phone } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/users`;

const UserForm = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { branches } = useBranch();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobileNumber: '',
    password: '',
    role: 'Security',
    status: 'Active',
    branch: currentUser?.branch || 'All Branches',
    createdBy: currentUser?.name || 'System'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // FIX: Force branch if not super admin to avoid saving in 'All Branches'
    const submissionData = { ...formData };
    if (!['Super Admin'].includes(currentUser?.role)) {
      submissionData.branch = currentUser.branch;
    }
    submissionData.createdByRole = currentUser?.role;
    submissionData.creatorBranch = currentUser?.branch;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Company-Id': currentUser?.companyId || '',
          'X-User-Id': currentUser?._id || currentUser?.id || '',
          'X-User-Role': currentUser?.role || 'User',
          'X-Branch-Id': currentUser?.branch || 'All Branches'
        },
        body: JSON.stringify({
          ...submissionData,
          companyId: currentUser?.companyId
        })
      });

      if (response.ok) {
        navigate('/users');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error: Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
            <p className="text-sm text-gray-500 mt-1">Create an account and assign dashboard access</p>
          </div>
          <button 
            onClick={() => navigate('/users')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <User size={16} className="text-gray-400" /> Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:bg-white transition-all"
                placeholder="e.g. Ravi Kumar"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <Mail size={16} className="text-gray-400" /> Email Address
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:bg-white transition-all"
                placeholder="e.g. ravi@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" /> Mobile Number
              </label>
              <input
                type="tel"
                name="mobileNumber"
                value={formData.mobileNumber}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:bg-white transition-all"
                placeholder="e.g. +91 9876543210"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <Lock size={16} className="text-gray-400" /> Initial Password
              </label>
              <input
                type="text"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:bg-white transition-all"
                placeholder="Enter a secure password"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                  <Shield size={16} className="text-gray-400" /> Dashboard Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:bg-white transition-all font-medium text-gray-700"
                >
                  {['Super Admin'].includes(currentUser?.role) && (
                    <>
                      <option value="Super Admin">Super Admin (All access)</option>
                      <option value="Branch Admin">Branch Manager</option>
                    </>
                  )}
                  <option value="MD">MD (Managing Director)</option>
                  <option value="Admin">Admin (Branch Administrator)</option>
                  <option value="Security">Security (Gate access only)</option>
                  <option value="HR">HR</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                  <Shield size={16} className="text-gray-400" /> Account Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:bg-white transition-all font-medium text-gray-700"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                  <Building size={16} className="text-gray-400" /> Assigned Branch
                </label>
                {!['Super Admin'].includes(currentUser?.role) ? (
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={currentUser.branch}
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-medium cursor-not-allowed"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-semibold bg-gray-200 px-2 py-1 rounded">
                      LOCKED
                    </div>
                  </div>
                ) : (
                  <select
                    name="branch"
                    value={formData.branch}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:bg-white transition-all font-medium text-gray-700"
                  >
                    <option value="All Branches">All Branches (Global Access)</option>
                    {branches.filter(b => b !== 'All Branches').map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/users')}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[var(--color-brand-indigo)] text-white hover:bg-[var(--color-brand-indigo-light)] font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
            >
              <Save size={18} />
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
