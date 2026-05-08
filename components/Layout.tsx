import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, List, Bell, ScanLine, User as UserIcon, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback } from '@/src/lib/telegram';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { t } = useTranslation();
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
    { name: t('home'), path: '/', icon: Home },
    { name: t('debts'), path: '/debts', icon: List },
    { name: t('scan'), path: '/scan', icon: ScanLine },
    { name: t('reminders', 'Eslatmalar'), path: '/notifications', icon: Bell, indicator: unreadCount > 0 },
    { name: t('profile'), path: '/profile', icon: UserIcon },
  ];

  // Add admin tab if user is admin
  if (user?.is_admin) {
    navItems.push({ name: 'Admin', path: '/admin', icon: Shield, indicator: false });
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 max-w-md mx-auto relative shadow-2xl overflow-hidden transition-colors">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-gray-200 dark:border-zinc-800 flex justify-between items-center rounded-t-2xl z-50 transition-colors">
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
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400'
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
