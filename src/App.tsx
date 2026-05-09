import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { Notifications } from './pages/Notifications';
import { Admin } from './pages/Admin';
import { Toaster } from '@/components/ui/sonner';
import { ShopkeeperLayout, CustomerLayout } from '@/components/Layout';
import '@/lib/i18n';

// Shop pages
import { ShopDashboard } from './pages/shop/ShopDashboard';
import { ShopCustomers } from './pages/shop/ShopCustomers';
import { ShopAddDebt } from './pages/shop/ShopAddDebt';
import { ShopDebts } from './pages/shop/ShopDebts';
import { ShopReports } from './pages/shop/ShopReports';

// Customer pages
import { CustomerHome } from './pages/customer/CustomerHome';
import { CustomerHistory } from './pages/customer/CustomerHistory';
import { CustomerReminders } from './pages/customer/CustomerReminders';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center dark:bg-zinc-950">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!user || !user.is_registered) return <Navigate to="/login" />;
  return <>{children}</>;
};

// Route handler that renders correct layout/pages based on user role
const RoleRouter = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;

  if (user.user_role === 'customer') {
    return (
      <CustomerLayout>
        <Routes>
          <Route path="/" element={<CustomerHome />} />
          <Route path="/history" element={<CustomerHistory />} />
          <Route path="/reminders" element={<CustomerReminders />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </CustomerLayout>
    );
  }

  // Default: shopkeeper
  return (
    <ShopkeeperLayout>
      <Routes>
        <Route path="/" element={<ShopDashboard />} />
        <Route path="/customers" element={<ShopCustomers />} />
        <Route path="/add-debt" element={<ShopAddDebt />} />
        <Route path="/debts" element={<ShopDebts />} />
        <Route path="/reports" element={<ShopReports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ShopkeeperLayout>
  );
};

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedRoute><RoleRouter /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
    </ThemeProvider>
  );
}
