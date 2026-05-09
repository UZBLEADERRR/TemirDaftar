import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Bell, User as UserIcon, Shield, Home, Clock, FileText } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback } from '@/src/lib/telegram';

// Shopkeeper Layout
export const ShopkeeperLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const data = await apiCall('/api/notifications');
        setUnreadCount(data.filter((n: any) => !n.read).length);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const navItems = [
    { name: 'Bosh sahifa', path: '/', icon: LayoutDashboard },
    { name: 'Mijozlar', path: '/customers', icon: Users },
    { name: 'Qo\'shish', path: '/add-debt', icon: PlusCircle },
    { name: 'Hisobot', path: '/reports', icon: FileText },
    { name: 'Profil', path: '/profile', icon: UserIcon },
  ];

  if (user?.is_admin) {
    navItems.push({ name: 'Admin', path: '/admin', icon: Shield });
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto relative shadow-2xl overflow-hidden transition-colors">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center rounded-t-2xl z-50 transition-colors">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => hapticFeedback()}
              className={`flex-1 py-3 flex flex-col items-center gap-1 relative transition-colors ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium truncate px-1 max-w-full">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

// Customer Layout
export const CustomerLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const data = await apiCall('/api/notifications');
        setUnreadCount(data.filter((n: any) => !n.read).length);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const navItems = [
    { name: 'Qarzlarim', path: '/', icon: Home },
    { name: 'Tarix', path: '/history', icon: Clock },
    { name: 'Eslatmalar', path: '/reminders', icon: Bell, indicator: unreadCount > 0 },
    { name: 'Profil', path: '/profile', icon: UserIcon },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto relative shadow-2xl overflow-hidden transition-colors">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center rounded-t-2xl z-50 transition-colors">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => hapticFeedback()}
              className={`flex-1 py-3 flex flex-col items-center gap-1 relative transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {item.indicator && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-950 animate-pulse"></span>
                )}
              </div>
              <span className="text-[10px] font-medium truncate px-1 max-w-full">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

// Legacy Layout (keep for backward compat during transition)
export const Layout = ShopkeeperLayout;
