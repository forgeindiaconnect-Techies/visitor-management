import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { Users, UserPlus, Search, Shield, Building, Trash2, GraduationCap, Briefcase, UserCheck, Edit, X, Save } from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com')}/api/users`;

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Active');
  const [loading, setLoading] = useState(true);
  const [branchStats, setBranchStats] = useState({ security: 0, admins: 0, visitors: 0 });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, userId: null, newStatus: null, actionText: '' });
  const [selectedUserEdit, setSelectedUserEdit] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: '',
    branch: '',
    department: ''
  });
  const [sendingInvite, setSendingInvite] = useState(false);

  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { activeBranch, branches } = useBranch();
  
  // Exclude 'All Branches' from the selectable list for individual users
  const assignableBranches = branches.filter(b => b !== 'All Branches');

  const sendUserInvitation = async () => {
    if (!inviteForm.name || !inviteForm.email || !inviteForm.role || !inviteForm.branch) {
      alert('Please complete all required fields');
      return;
    }

    try {
      setSendingInvite(true);
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const rawBaseUrl = baseUrl.replace(/\/api\/?$/, '');

      const response = await fetch(
        `${rawBaseUrl}/api/user-invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(inviteForm)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      alert(result.message);
      setInviteOpen(false);
      setInviteForm({
        name: '',
        email: '',
        role: '',
        branch: '',
        department: ''
      });
      fetchUsers();
    } catch (error) {
      alert(error.message);
    } finally {
      setSendingInvite(false);
    }
  };

  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'X-Company-Id': currentUser?.companyId || '',
    'X-User-Id': currentUser?._id || currentUser?.id || '',
    'X-User-Role': currentUser?.role || 'User',
    'X-Branch-Id': currentUser?.branch || 'All Branches'
  });

  useEffect(() => {
    fetchUsers();
    fetchBranchSummary();
  }, [activeBranch]);

  const fetchBranchSummary = async () => {
    if (activeBranch && activeBranch !== 'All Branches') {
      try {
        const res = await fetch(`${API_URL}/branch-summary?branch=${activeBranch}`, {
          headers: getHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setBranchStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch branch summary:', err);
      }
    } else {
      setBranchStats({ security: 0, admins: 0, visitors: 0 });
    }
  };

  const fetchUsers = async () => {
    try {
      let fetchUrl = API_URL;
      if (currentUser && !['Super Admin'].includes(currentUser.role)) {
        fetchUrl = `${API_URL}?branch=${encodeURIComponent(currentUser.branch)}`;
      } else if (activeBranch && activeBranch !== 'All Branches') {
        fetchUrl = `${API_URL}?branch=${encodeURIComponent(activeBranch)}`;
      }

      const response = await fetch(fetchUrl, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const userList = Array.isArray(data) ? data : (data?.data || []);
        setUsers(userList);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await fetch(`${API_URL}/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
      });
      if (response.ok) {
        setUsers(users.filter(u => u.id !== id));
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const updateUserDetails = async (id, updates) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 
          ...getHeaders(),
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => (u.id || u._id) === id ? updatedUser : u));
      }
    } catch (err) {
      console.error('Error updating user details:', err);
    }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setConfirmModal({
      isOpen: true,
      userId: id,
      newStatus,
      actionText: newStatus === 'Inactive' ? 'deactivate' : 'activate'
    });
  };

  const confirmToggleStatus = async () => {
    const { userId, newStatus } = confirmModal;
    setConfirmModal({ isOpen: false, userId: null, newStatus: null, actionText: '' });
    
    try {
      const response = await fetch(`${API_URL}/${userId}`, {
        method: 'PATCH',
        headers: { 
          ...getHeaders(),
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => (u.id || u._id) === userId ? updatedUser : u));
      }
    } catch (err) {
      console.error('Error updating user status:', err);
    }
  };

  const filteredUsers = users.filter(user => {
    const statusMatch = activeTab === 'Active' 
      ? (user.status === 'Active' || !user.status) 
      : (user.status === 'Inactive' || user.status === 'Blocked');
    const searchMatch = (user.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
      (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.role?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.mobileNumber || '').includes(searchQuery);
    return statusMatch && searchMatch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage system access and dashboard roles</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="px-4 py-2 bg-indigo-700 text-white font-semibold text-sm rounded-lg hover:bg-indigo-800 transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <UserPlus size={18} />
            <span>Invite User</span>
          </button>

          <button 
            onClick={() => navigate('/users/new')}
            className="px-4 py-2 bg-slate-800 text-white font-medium text-sm rounded-lg hover:bg-slate-900 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <UserPlus size={18} />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {activeBranch && activeBranch !== 'All Branches' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <Shield size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Security</p>
              <h3 className="text-2xl font-bold text-gray-900">{branchStats.security || 0}</h3>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Briefcase size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Admins</p>
              <h3 className="text-2xl font-bold text-gray-900">{branchStats.admins || 0}</h3>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Visitors</p>
              <h3 className="text-2xl font-bold text-gray-900">{branchStats.visitors}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setActiveTab('Active')}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'Active' ? 'border-[var(--color-brand-indigo)] text-[var(--color-brand-indigo)]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            Active Users
          </button>
          <button
            onClick={() => setActiveTab('Disabled')}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'Disabled' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            Disabled Users
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by name, email, role, or mobile..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-indigo)] focus:border-transparent transition-shadow"
              />
            </div>
          </div>
          <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
            Total Users: {filteredUsers.length}
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Name & Email</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Branch Access</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading users...</td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-[var(--color-brand-indigo)] font-bold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{u.name}</div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                          {u.mobileNumber && <div className="text-xs text-gray-400 mt-0.5">{u.mobileNumber}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                        ${u.role === 'Super Admin' ? 'bg-purple-100 text-purple-700' : ''}
                        ${u.role === 'MD' ? 'bg-blue-100 text-blue-700' : ''}
                        ${u.role === 'Branch Admin' ? 'bg-teal-100 text-teal-700' : ''}
                        ${u.role === 'Security' ? 'bg-orange-100 text-orange-700' : ''}
                        ${u.role === 'Visitor' ? 'bg-gray-100 text-gray-700' : ''}
                      `}>
                        <Shield size={12} />
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleUserStatus(u.id || u._id, u.status || 'Active')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity
                        ${u.status === 'Inactive' ? 'bg-red-100 text-red-700' : ''}
                        ${u.status === 'Blocked' ? 'bg-yellow-100 text-yellow-700' : ''}
                        ${(!u.status || u.status === 'Active') ? 'bg-green-100 text-green-700' : ''}
                      `}>
                        {u.status === 'Inactive' && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                        {u.status === 'Blocked' && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
                        {(!u.status || u.status === 'Active') && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                        {u.status || 'Active'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600 text-sm font-medium">
                        <Building size={16} className="text-gray-400" />
                        <span>{u.branch || 'All Branches'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedUserEdit(u); setEditStatus(u.status || 'Active'); }}
                          className="px-4 py-1.5 text-xs font-bold rounded-lg transition-colors border text-[var(--color-brand-indigo)] border-indigo-200 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-1.5"
                          title="Edit User"
                        >
                          <Edit size={14} /> Edit
                        </button>
                        <button 
                          onClick={() => deleteUser(u.id || u._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeBranch && activeBranch !== 'All Branches' && (
        <div className="mt-8 bg-slate-50 rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building size={20} className="text-[var(--color-brand-indigo)]" />
                {activeBranch} Branch Statistics
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Overview of total user types assigned to this branch.
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Security</p>
                <p className="text-xl font-bold text-gray-900">{branchStats.security || 0}</p>
              </div>
              <div className="w-px bg-gray-200"></div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admins</p>
                <p className="text-xl font-bold text-gray-900">{branchStats.admins || 0}</p>
              </div>
              <div className="w-px bg-gray-200"></div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitors</p>
                <p className="text-xl font-bold text-gray-900">{branchStats.visitors}</p>
              </div>
            </div>
            <div className="text-xs text-gray-400 font-medium">
              Last Updated: Today {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center border-t-4 border-orange-500">
            <Shield size={48} className="text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirm Action</h2>
            <p className="text-gray-500 mb-6">
              Are you sure you want to {confirmModal.actionText} this user?
              {confirmModal.actionText === 'deactivate' && ' They will immediately lose access to the system.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, userId: null, newStatus: null, actionText: '' })}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmToggleStatus}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                Yes, {confirmModal.actionText}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit User Modal */}
      {selectedUserEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden relative">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Edit size={18} className="text-[var(--color-brand-indigo)]" />
                Edit User Details
              </h3>
              <button 
                onClick={() => setSelectedUserEdit(null)} 
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const updates = {
                branch: formData.get('branch'),
                status: formData.get('status'),
                statusReason: formData.get('statusReason') || ''
              };
              await updateUserDetails(selectedUserEdit.id || selectedUserEdit._id, updates);
              setSelectedUserEdit(null);
              setEditStatus('');
            }}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Name</label>
                  <input readOnly defaultValue={selectedUserEdit.name} className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    required 
                    name="status" 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
                {editStatus === 'Blocked' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Blocking</label>
                    <textarea 
                      required 
                      name="statusReason" 
                      defaultValue={selectedUserEdit.statusReason || ''}
                      placeholder="e.g. Policy Violation"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white"
                      rows="2"
                    ></textarea>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select required name="branch" defaultValue={selectedUserEdit.branch} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-brand-indigo)] outline-none bg-white">
                    <option value="">Select Branch</option>
                    {assignableBranches.map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Changing the branch will automatically update the user's dashboard view upon their next login. No new credentials are required.
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setSelectedUserEdit(null)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--color-brand-indigo)] text-white rounded-lg font-medium flex items-center gap-2 hover:bg-[var(--color-brand-indigo-light)]">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVITE USER MODAL */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Invite Company User
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Sends a secure 24-hour activation link to the employee's email.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Employee Name *</label>
                <input
                  type="text"
                  placeholder="Employee Name"
                  value={inviteForm.name}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      name: event.target.value
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Employee Email *</label>
                <input
                  type="email"
                  placeholder="Employee Email"
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      email: event.target.value
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Role *</label>
                  <select
                    value={inviteForm.role}
                    onChange={(event) =>
                      setInviteForm({
                        ...inviteForm,
                        role: event.target.value
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium"
                    required
                  >
                    <option value="">Select Role</option>
                    <option value="Admin">Admin</option>
                    <option value="MD">MD</option>
                    <option value="HR">HR</option>
                    <option value="Senior HR">Senior HR</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Security">Security</option>
                    <option value="Employee">Employee</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Branch *</label>
                  <select
                    value={inviteForm.branch}
                    onChange={(event) =>
                      setInviteForm({
                        ...inviteForm,
                        branch: event.target.value
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium"
                    required
                  >
                    <option value="">Select Branch</option>
                    {assignableBranches.map((branch) => (
                      <option
                        key={branch._id || branch}
                        value={branch.branchName || branch}
                      >
                        {branch.branchName || branch}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  placeholder="Department (Optional)"
                  value={inviteForm.department}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      department: event.target.value
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={sendUserInvitation}
                disabled={sendingInvite}
                className="px-4 py-2 rounded-lg bg-indigo-700 text-sm font-semibold text-white hover:bg-indigo-800 transition disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {sendingInvite ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
