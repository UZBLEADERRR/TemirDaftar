import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Debts } from './pages/Debts';
import { AddDebt } from './pages/AddDebt';
import { Scanner } from './pages/Scanner';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/Layout';
import '@/lib/i18n';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center dark:bg-zinc-950">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!user || !user.is_registered) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
          <Route path="/debts" element={<ProtectedRoute><Layout><Debts /></Layout></ProtectedRoute>} />
          <Route path="/add" element={<ProtectedRoute><Layout><AddDebt /></Layout></ProtectedRoute>} />
          <Route path="/scan" element={<ProtectedRoute><Layout><Scanner /></Layout></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Layout><Admin /></Layout></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}
