import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Login/RegisterPage';
import OnboardingPage from './pages/Onboarding/OnboardingPage';
import RetirementPlannerPage from './pages/RetirementPlanner/RetirementPlannerPage';
import ExpenseManagementPage from './pages/ExpenseManagement/ExpenseManagementPage';
import InvestmentPlannerPage from './pages/InvestmentPlanner/InvestmentPlannerPage';
import GoalManagementPage from './pages/GoalManagement/GoalManagementPage';
import FundManagementPage from './pages/FundManagement/FundManagementPage';
import HomePage from './pages/Home/HomePage';
import { Toaster } from 'react-hot-toast';

// Simple Protected Route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return children;
}

function HomeRoute() {
  const hasOnboarded = localStorage.getItem('hasCompletedOnboarding');
  if (!hasOnboarded) {
    return <Navigate to="/onboarding" />;
  }
  return <HomePage />;
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
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomeRoute />} />
            <Route path="expense-management" element={<ExpenseManagementPage />} />
            <Route path="retirement-planner" element={<RetirementPlannerPage />} />
            <Route path="goal-management" element={<GoalManagementPage />} />
            <Route path="fund-management" element={<FundManagementPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
