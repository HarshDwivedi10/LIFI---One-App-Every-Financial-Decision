import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Login/RegisterPage';
import OnboardingPage from './pages/Onboarding/OnboardingPage';
import RetirementPlannerPage from './pages/RetirementPlanner/RetirementPlannerPage';
import ExpenseManagementPage from './pages/ExpenseManagement/ExpenseManagementPage';
import InvestmentPlannerPage from './pages/InvestmentPlanner/InvestmentPlannerPage';
import GoalManagementPage from './pages/GoalManagement/GoalManagementPage';
import FundManagementPage from './pages/FundManagement/FundManagementPage';
import ExpertConnectPage from './pages/ExpertConnect/ExpertConnectPage';
import DashboardPage from './pages/Home/HomePage';
import AdminDashboard from './pages/Admin/AdminDashboard';
import CoachManagement from './pages/Admin/CoachManagement';
import UserManagement from './pages/Admin/UserManagement';
import CoachDashboard from './pages/Coach/CoachDashboard';
import { Toaster } from 'react-hot-toast';

// Simple Protected Route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return children;
}

// Protected Route with Role check wrapper
function RoleProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  const userRole = user.role || 'ROLE_USER';

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    if (userRole === 'ROLE_ADMIN') return <Navigate to="/admin" replace />;
    if (userRole === 'ROLE_COACH') return <Navigate to="/coach" replace />;
    if (userRole === 'ROLE_USER') return <Navigate to="/" replace />;
    return <div>Unauthorized Access</div>;
  }
  
  return children;
}

// Dashboard is the main landing page after login
function HomeRoute() {
  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#333',
          color: '#fff',
        },
      }} />
      <Router>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Loading...</div>}>
        <NotificationProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin"
            element={
              <RoleProtectedRoute allowedRoles={['ROLE_ADMIN']}>
                <AdminDashboard />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/admin/coaches"
            element={
              <RoleProtectedRoute allowedRoles={['ROLE_ADMIN']}>
                <CoachManagement />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RoleProtectedRoute allowedRoles={['ROLE_ADMIN']}>
                <UserManagement />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/coach"
            element={
              <RoleProtectedRoute allowedRoles={['ROLE_COACH']}>
                <CoachDashboard />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <RoleProtectedRoute allowedRoles={['ROLE_USER']}>
                <AppLayout />
              </RoleProtectedRoute>
            }
          >
            <Route index element={<HomeRoute />} />
            <Route path="expense-management" element={<ExpenseManagementPage />} />
            <Route path="retirement-planner" element={<RetirementPlannerPage />} />
            <Route path="goal-management" element={<GoalManagementPage />} />
            <Route path="fund-management" element={<FundManagementPage />} />
            <Route path="expert-connect" element={<ExpertConnectPage />} />
          </Route>
        </Routes>
        </NotificationProvider>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}
