import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { ScanUpload } from './pages/ScanUpload';
import { History } from './pages/History';
import { ScanDetail } from './pages/ScanDetail';
import { Reports } from './pages/Reports';
import { Analytics } from './pages/Analytics';
import { AdminUsers } from './pages/AdminUsers';
import { AdminAudit } from './pages/AdminAudit';
import { AdminSettings } from './pages/AdminSettings';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute><Login /></PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute><Register /></PublicRoute>
      } />

      {/* Protected Routes */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/scan" element={
          <ProtectedRoute><ScanUpload /></ProtectedRoute>
        } />
        <Route path="/scan/:id" element={
          <ProtectedRoute><ScanDetail /></ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute><History /></ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute><Reports /></ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute><Analytics /></ProtectedRoute>
        } />

        {/* Admin Routes */}
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>
        } />
        <Route path="/admin/audit" element={
          <ProtectedRoute allowedRoles={['admin']}><AdminAudit /></ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>
        } />
      </Route>

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}