import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VisitorProvider } from './context/VisitorContext';
import { ZoneProvider } from './context/ZoneContext';
import { BlacklistProvider } from './context/BlacklistContext';
import { NotificationProvider } from './context/NotificationContext';
import { BranchProvider } from './context/BranchContext';
import { AttendanceProvider } from './context/AttendanceContext';
import ToastContainer from './components/notifications/ToastContainer';
import SubscriptionReminders from './components/subscription/SubscriptionReminders';
import SubscriptionSuccessModal from './components/subscription/SubscriptionSuccessModal';
import { ShieldAlert } from 'lucide-react';
import { requestNotificationPermission, listenNotification } from './firebaseMessaging';

// Layouts
import MainLayout from './components/layout/MainLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NotificationsPage from './pages/dashboards/NotificationsPage';
import VisitorList from './pages/visitors/VisitorList';
import VisitorForm from './pages/visitors/VisitorForm';
import PreBookingForm from './pages/visitors/PreBookingForm';
import SecurityCheckIn from './pages/visitors/SecurityCheckIn';
import ReturningVisitor from './pages/visitors/ReturningVisitor';
import VisitorPass from './pages/public/VisitorPass';
import PreRegister from './pages/public/PreRegister';
import LandingPage from './pages/public/LandingPage';
import PublicPreBooking from './pages/public/PublicPreBooking';
import VisitorStatus from './pages/public/VisitorStatus';
import PreBookingRegistration from './pages/visitors/PreBookingRegistration';
import VisitorInvitation from './pages/VisitorInvitation';
import ApprovalList from './pages/approvals/ApprovalList';
import ApprovalDetails from './pages/approvals/ApprovalDetails';
import SuperAdminPreBookings from './pages/SuperAdminPreBookings';
import SaaSLanding from './pages/saas/SaaSLanding';
import ActivateAccount from './pages/auth/ActivateAccount';
import ZoneList from './pages/zones/ZoneList';
import EntryExitLogs from './pages/tracking/EntryExitLogs';
import LiveMonitoring from './pages/tracking/LiveMonitoring';
import BlacklistList from './pages/blacklist/BlacklistList';
import ReportsDashboard from './pages/reports/ReportsDashboard';
import UserList from './pages/users/UserList';
import UserForm from './pages/users/UserForm';
import AttendanceLog from './pages/tracking/AttendanceLog';
import Settings from './pages/settings/Settings';
import BranchSettings from './pages/settings/BranchSettings';

import Subscription from './pages/settings/Subscription';

import AuditLogs from './pages/dashboards/AuditLogs';

const BrandInjector = () => {
  const { user } = useAuth();
  
  useEffect(() => {
    if (user?.branding?.primaryColor) {
      document.documentElement.style.setProperty('--color-brand-indigo', user.branding.primaryColor);
    } else {
      document.documentElement.style.setProperty('--color-brand-indigo', '#1E1B6E'); // Default
    }
  }, [user]);

  return null;
};

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Expiry is now handled by the SubscriptionModals overlay in MainLayout
  // so we don't force a redirect here anymore.
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />; // Redirect to dashboard if unauthorized
  }
  
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={!user ? <SaaSLanding /> : <Navigate to="/dashboard" replace />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/prebook" element={<PublicPreBooking />} />
      <Route path="/prebook/:companyId" element={<PublicPreBooking />} />
      <Route path="/pre-booking" element={<PublicPreBooking />} />
      <Route path="/pre-booking/:companyId" element={<PublicPreBooking />} />
      <Route path="/visitor-status/:token" element={<VisitorStatus />} />
      <Route path="/pass/:visitId" element={<VisitorPass />} />
      <Route path="/visitor-pass/:qrToken" element={<VisitorPass />} />
      <Route path="/pre-register" element={<PreRegister />} />
      <Route path="/pre-register/:companyId" element={<PreRegister />} />
      <Route path="/visitor-invitation/:token" element={<VisitorInvitation />} />
      <Route path="/activate-account/:token" element={<ActivateAccount />} />
      <Route path="/saas" element={<SaaSLanding />} />

      {/* Main Authenticated Layout */}
      <Route element={user ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="saas/companies" element={<ProtectedRoute allowedRoles={['SaaS Super Admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="saas/subscriptions" element={<ProtectedRoute allowedRoles={['SaaS Super Admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="saas/payments" element={<ProtectedRoute allowedRoles={['SaaS Super Admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="saas/upgrades" element={<ProtectedRoute allowedRoles={['SaaS Super Admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="saas/leads" element={<ProtectedRoute allowedRoles={['SaaS Super Admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute allowedRoles={['SaaS Super Admin', 'Super Admin', 'MD', 'Admin', 'Branch Admin', 'Security', 'HR']}><NotificationsPage /></ProtectedRoute>} />
        
        {/* User Management */}
        <Route path="users" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin']}><UserList /></ProtectedRoute>} />
        <Route path="users/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin']}><UserForm /></ProtectedRoute>} />
        <Route path="branches" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin']}><BranchSettings /></ProtectedRoute>} />
        
        {/* Visitor Management */}
        <Route path="visitors" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'Security', 'HR', 'Receptionist']}><VisitorList /></ProtectedRoute>} />
        <Route path="visitors/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'Security', 'HR', 'Receptionist']}><VisitorForm /></ProtectedRoute>} />
        <Route path="visitors/pre-booking" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'HR', 'Receptionist', 'Employee']}><PreBookingForm /></ProtectedRoute>} />
        <Route path="invitations" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'HR', 'Receptionist']}><PreBookingRegistration /></ProtectedRoute>} />
        <Route path="visitors/security" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'Security', 'Receptionist']}><SecurityCheckIn /></ProtectedRoute>} />
        <Route path="visitors/returning" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'Security', 'HR', 'Receptionist']}><ReturningVisitor /></ProtectedRoute>} />
        
        {/* Approvals & Pre-Bookings Module */}
        <Route path="pre-bookings" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'HR', 'Receptionist', 'Security']}><SuperAdminPreBookings /></ProtectedRoute>} />
        <Route path="super-admin/pre-bookings" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'HR', 'Receptionist', 'Security']}><SuperAdminPreBookings /></ProtectedRoute>} />
        <Route path="approvals" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'HR', 'Receptionist']}><ApprovalList /></ProtectedRoute>} />
        <Route path="approvals/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'HR', 'Receptionist']}><ApprovalDetails /></ProtectedRoute>} />
        
        {/* Tracking & Zones */}
        <Route path="zones" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin']}><ZoneList /></ProtectedRoute>} />
        <Route path="tracking" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'Branch Admin', 'Security', 'HR', 'Receptionist']}><LiveMonitoring /></ProtectedRoute>} />
        <Route path="live-monitoring" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'Branch Admin', 'Security', 'HR', 'Receptionist']}><LiveMonitoring /></ProtectedRoute>} />
        <Route path="attendance" element={<ProtectedRoute allowedRoles={['Super Admin', 'MD']}><AttendanceLog /></ProtectedRoute>} />
        <Route path="logs" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin']}><EntryExitLogs /></ProtectedRoute>} />
        <Route path="audit-logs" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin']}><AuditLogs /></ProtectedRoute>} />
        
        {/* Blacklist */}
        <Route path="blacklist" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'Security', 'Receptionist']}><BlacklistList /></ProtectedRoute>} />
        
        {/* Reports & Settings */}
        <Route path="reports" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'SaaS Super Admin', 'MD']}><ReportsDashboard /></ProtectedRoute>} />
        <Route path="subscription" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin']}><Subscription /></ProtectedRoute>} />

        <Route path="settings" element={<ProtectedRoute allowedRoles={['Super Admin', 'Company Admin', 'MD', 'Admin', 'Visitor', 'HR', 'Receptionist', 'Employee']}><Settings /></ProtectedRoute>} />
      </Route>

      {/* Root Route - Always renders Landing Page */}
      <Route path="/" element={<LandingPage />} />
    </Routes>
  );
};

function App() {
  useEffect(() => {
    requestNotificationPermission();
    listenNotification();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <BrandInjector />
        <NotificationProvider>
          <BranchProvider>
            <AttendanceProvider>
              <VisitorProvider>
                <ZoneProvider>
                  <BlacklistProvider>
                    <AppRoutes />
                    <ToastContainer />
                    <SubscriptionReminders />
                    <SubscriptionSuccessModal />
                  </BlacklistProvider>
                </ZoneProvider>
              </VisitorProvider>
            </AttendanceProvider>
          </BranchProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
