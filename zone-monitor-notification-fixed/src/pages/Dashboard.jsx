import React from 'react';
import { useAuth } from '../context/AuthContext';
import SuperAdminDashboard from './dashboards/SuperAdminDashboard';
import MDDashboard from './dashboards/MDDashboard';
import AdminDashboard from './dashboards/AdminDashboard';
import SecurityDashboard from './dashboards/SecurityDashboard';
import VisitorDashboard from './dashboards/VisitorDashboard';
import SaaSPlatformDashboard from './dashboards/SaaSPlatformDashboard';

const DashboardRouter = () => {
  const { user } = useAuth();

  // Route to specific dashboards based on the user's role
  if (!user) return null;

  switch (user.role) {
    case 'SaaS Super Admin':
      return <SaaSPlatformDashboard />;
    case 'MD':
      return <MDDashboard />;
    case 'Admin':
      return <AdminDashboard />;
    case 'Security':
      return <SecurityDashboard />;
    case 'Visitor':
      return <VisitorDashboard />;
    case 'Super Admin':
    default:
      return <SuperAdminDashboard />;
  }
};

export default DashboardRouter;
