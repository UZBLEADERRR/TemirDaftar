import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall } from '@/src/lib/telegram';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const CustomerReminders = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiCall('/api/notifications')
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const markAllRead = async () => {
    try {
      await apiCall('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mt-4 mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Eslatmalar</h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5 text-xs rounded-xl">
            <BellOff size={14} />
            Hammasini o'qish
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="text-5xl">🔕</span>
          <p className="text-sm text-zinc-500">Eslatmalar yo'q</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`rounded-xl p-4 border ${
                n.read
                  ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                  : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  n.read ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-blue-100 dark:bg-blue-900/30'
                }`}>
                  <Bell size={14} className={n.read ? 'text-zinc-500' : 'text-blue-600 dark:text-blue-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{n.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{new Date(n.created_at).toLocaleString('uz-UZ')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
